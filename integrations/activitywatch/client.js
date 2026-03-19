import { createGuardianStatus, isProbablyBrowser, normalizeDomain } from '../../shared/models.js';

const DEFAULT_BASE_URL = 'http://127.0.0.1:5600/api/0';
const RECENT_EVENT_WINDOW_MS = 12_000;
const PROBE_CACHE_MS = 8_000;

function asBucketArray(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  return Object.entries(payload).map(([id, value]) => ({
    id,
    ...(value ?? {}),
  }));
}

function pickLatest(items) {
  return [...items]
    .filter(Boolean)
    .sort((left, right) => {
      const leftTime = Date.parse(left.timestamp ?? left.end ?? left.start ?? 0);
      const rightTime = Date.parse(right.timestamp ?? right.end ?? right.start ?? 0);
      return rightTime - leftTime;
    })[0];
}

function scoreBucket(bucket) {
  const id = String(bucket?.id ?? '').toLowerCase();
  const host = String(bucket?.hostname ?? '').toLowerCase();
  const updatedAt = Date.parse(bucket?.last_updated ?? bucket?.created ?? 0);
  let score = Number.isFinite(updatedAt) ? updatedAt : 0;

  if (host && host !== 'unknown') {
    score += 10_000;
  }

  if (id.includes('_')) {
    score += 5_000;
  }

  return score;
}

function pickBestBucket(buckets, predicate) {
  return [...buckets]
    .filter(predicate)
    .sort((left, right) => scoreBucket(right) - scoreBucket(left))[0];
}

function normalizeTitle(value = '') {
  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function titlesLookRelated(left = '', right = '') {
  const a = normalizeTitle(left);
  const b = normalizeTitle(right);
  if (!a || !b) {
    return false;
  }

  return a === b || a.includes(b) || b.includes(a);
}

function isRecent(event, maxAgeMs = RECENT_EVENT_WINDOW_MS) {
  if (!event) {
    return false;
  }

  const time = Date.parse(event.timestamp ?? event.end ?? event.start ?? 0);
  return Number.isFinite(time) && Date.now() - time <= maxAgeMs;
}

function normalizeWindowEvent(event) {
  if (!event?.data) {
    return null;
  }

  return {
    timestamp: event.timestamp ?? event.end ?? event.start ?? new Date().toISOString(),
    app: event.data.app ?? event.data.application ?? '',
    title: event.data.title ?? '',
  };
}

function normalizeWebEvent(event) {
  if (!event?.data) {
    return null;
  }

  const url = event.data.url ?? event.data.current_url ?? '';
  const domain = normalizeDomain(url);
  return {
    timestamp: event.timestamp ?? event.end ?? event.start ?? new Date().toISOString(),
    browserName: event.data.app ?? event.data.browser ?? '',
    title: event.data.title ?? event.data.tab_title ?? '',
    url,
    domain,
  };
}

export class ActivityWatchClient {
  constructor({ baseUrl = DEFAULT_BASE_URL } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.cachedStatus = null;
    this.lastProbeAt = 0;
  }

  async probe(force = false) {
    if (!force && this.cachedStatus && Date.now() - this.lastProbeAt < PROBE_CACHE_MS) {
      return this.cachedStatus;
    }

    try {
      const buckets = asBucketArray(await this.#fetchJson(`${this.baseUrl}/buckets`, 900));
      const windowBucket = pickBestBucket(buckets, (bucket) => this.#looksLikeWindowBucket(bucket));
      const webBucket = pickBestBucket(buckets, (bucket) => this.#looksLikeWebBucket(bucket));
      const status = createGuardianStatus({
        online: true,
        baseUrl: this.baseUrl,
        windowBucketId: windowBucket?.id ?? null,
        webBucketId: webBucket?.id ?? null,
        mode: webBucket?.id ? 'browser-aware' : 'window-aware',
        note: webBucket?.id ? 'ActivityWatch 在线，已启用标签页域名判定' : 'ActivityWatch 在线，当前仅增强窗口识别',
      });

      this.cachedStatus = status;
      this.lastProbeAt = Date.now();
      return status;
    } catch (error) {
      const status = createGuardianStatus({
        baseUrl: this.baseUrl,
        note: `ActivityWatch 不可用：${error.message}`,
      });
      this.cachedStatus = status;
      this.lastProbeAt = Date.now();
      return status;
    }
  }

  async enrichContext(systemContext) {
    const status = await this.probe();
    if (!status.online) {
      return { context: systemContext, guardianStatus: status };
    }

    const [windowEvent, webEvent] = await Promise.all([
      status.windowBucketId ? this.#getLatestEvent(status.windowBucketId, 'window') : Promise.resolve(null),
      status.webBucketId ? this.#getLatestEvent(status.webBucketId, 'web') : Promise.resolve(null),
    ]);

    let merged = {
      ...systemContext,
      source: 'windows',
      confidence: 0.6,
    };

    if (windowEvent && isRecent(windowEvent) && (titlesLookRelated(systemContext.title, windowEvent.title) || this.#namesLookRelated(systemContext.processName, windowEvent.app))) {
      merged = {
        ...merged,
        source: 'merged',
        title: windowEvent.title || merged.title,
        processName: windowEvent.app || merged.processName,
        confidence: 0.82,
      };
    }

    const browserLike = systemContext.isBrowser || isProbablyBrowser(systemContext.processName) || isProbablyBrowser(systemContext.processPath);
    if (browserLike && webEvent && isRecent(webEvent) && this.#browserMatchesContext(systemContext, webEvent)) {
      merged = {
        ...merged,
        source: 'merged',
        isBrowser: true,
        browserName: webEvent.browserName || merged.browserName || merged.processName,
        url: webEvent.url,
        domain: webEvent.domain,
        title: webEvent.title || merged.title,
        confidence: 0.95,
      };
    }

    return {
      context: merged,
      guardianStatus: status,
    };
  }

  async #getLatestEvent(bucketId, kind) {
    const encodedBucketId = encodeURIComponent(bucketId);
    const now = new Date();
    const start = new Date(now.getTime() - RECENT_EVENT_WINDOW_MS).toISOString();
    const end = now.toISOString();
    const candidates = [
      `${this.baseUrl}/buckets/${encodedBucketId}/events?limit=5`,
      `${this.baseUrl}/buckets/${encodedBucketId}/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&limit=5`,
      `${this.baseUrl}/buckets/${encodedBucketId}/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    ];

    for (const url of candidates) {
      try {
        const response = await this.#fetchJson(url, 900);
        const rows = Array.isArray(response) ? response : Array.isArray(response?.events) ? response.events : [];
        if (!rows.length) {
          continue;
        }

        const latest = pickLatest(rows);
        return kind === 'web' ? normalizeWebEvent(latest) : normalizeWindowEvent(latest);
      } catch {
        continue;
      }
    }

    return null;
  }

  async #fetchJson(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  #looksLikeWindowBucket(bucket) {
    const blob = `${bucket.id ?? ''} ${bucket.type ?? ''} ${bucket.client ?? ''}`.toLowerCase();
    return blob.includes('currentwindow') || blob.includes('watcher-window');
  }

  #looksLikeWebBucket(bucket) {
    const blob = `${bucket.id ?? ''} ${bucket.type ?? ''} ${bucket.client ?? ''}`.toLowerCase();
    return blob.includes('web.tab.current') || blob.includes('watcher-web');
  }

  #namesLookRelated(left = '', right = '') {
    const a = String(left).toLowerCase();
    const b = String(right).toLowerCase();
    return Boolean(a && b && (a.includes(b) || b.includes(a)));
  }

  #browserMatchesContext(systemContext, webEvent) {
    if (!webEvent?.url) {
      return false;
    }

    const processLooksBrowser = isProbablyBrowser(systemContext.processName) || isProbablyBrowser(systemContext.processPath);
    const eventLooksBrowser = isProbablyBrowser(webEvent.browserName);
    if (!processLooksBrowser && !eventLooksBrowser) {
      return false;
    }

    if (titlesLookRelated(systemContext.title, webEvent.title)) {
      return true;
    }

    return this.#namesLookRelated(systemContext.processName, webEvent.browserName);
  }
}

export default ActivityWatchClient;
