const KNOWN_BROWSERS = [
  'chrome',
  'msedge',
  'edge',
  'brave',
  'firefox',
  'vivaldi',
  'opera',
  'arc',
];

export function normalizeDomain(input) {
  if (!input) {
    return '';
  }

  const value = String(input).trim();
  if (!value) {
    return '';
  }

  try {
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value) ? value : `https://${value}`;
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return value
      .replace(/^https?:\/\//i, '')
      .split('/')[0]
      .split('?')[0]
      .trim()
      .toLowerCase();
  }
}

export function isProbablyBrowser(nameOrPath = '') {
  const lower = String(nameOrPath).toLowerCase();
  return KNOWN_BROWSERS.some((browser) => lower.includes(browser));
}

export function createGuardianStatus(overrides = {}) {
  return {
    online: false,
    baseUrl: 'http://127.0.0.1:5600/api/0',
    windowBucketId: null,
    webBucketId: null,
    mode: 'windows-only',
    note: 'ActivityWatch 未连接',
    checkedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createEmptyActiveContext() {
  return {
    timestamp: new Date().toISOString(),
    source: 'windows',
    title: '',
    windowId: null,
    processId: null,
    processName: '',
    processPath: '',
    isBrowser: false,
    browserName: '',
    url: '',
    domain: '',
    confidence: 0,
  };
}

export function createInitialSessionState() {
  return {
    status: 'idle',
    startedAt: null,
    endsAt: null,
    durationMinutes: 25,
    remainingMs: 0,
    violationCount: 0,
    violations: [],
    allowedWindows: [],
    allowedDomains: [],
    allowedCategories: [],
    systemSafelistEnabled: true,
    recentAllowedWindow: null,
    currentContext: createEmptyActiveContext(),
    guardianStatus: createGuardianStatus(),
    exitProtection: {
      type: 'hold',
      holdToExitMs: 3000,
    },
    summary: null,
  };
}

export function createSystemSafelistRule({
  id,
  name,
  description = '',
  processPatterns = [],
  titlePatterns = [],
  enabled = true,
} = {}) {
  return {
    id: id || `system-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: name || '未命名系统规则',
    description,
    processPatterns,
    titlePatterns,
    enabled,
  };
}

export function getDefaultSystemSafelistRules() {
  return [
    createSystemSafelistRule({
      id: 'system-explorer',
      name: '资源管理器与任务栏',
      description: '放行 explorer.exe 承载的资源管理器、任务栏、开始菜单、系统托盘等壳窗口。',
      processPatterns: ['C:\\Windows\\explorer.exe', 'explorer.exe'],
    }),
    createSystemSafelistRule({
      id: 'system-shell-hosts',
      name: '开始菜单与系统壳宿主',
      description: '放行 ShellExperienceHost、StartMenuExperienceHost、SearchHost 等系统壳进程。',
      processPatterns: ['ShellExperienceHost.exe', 'StartMenuExperienceHost.exe', 'SearchHost.exe', 'SearchApp.exe'],
    }),
    createSystemSafelistRule({
      id: 'system-lock-screen',
      name: '锁屏与登录界面',
      description: '放行 LockApp 和登录相关系统界面。',
      processPatterns: ['LockApp.exe', 'LogonUI.exe'],
      titlePatterns: ['Windows 默认锁屏界面', '锁屏'],
    }),
    createSystemSafelistRule({
      id: 'system-settings-security',
      name: '系统设置与安全弹窗',
      description: '放行系统设置、UAC、安全与凭据确认相关窗口。',
      processPatterns: ['SystemSettings.exe', 'consent.exe', 'CredentialUIBroker.exe', 'SecurityHealthSystray.exe', 'taskmgr.exe'],
      titlePatterns: ['用户帐户控制', 'Windows 安全', '凭据', '安全'],
    }),
    createSystemSafelistRule({
      id: 'system-dialogs',
      name: '文件选择与系统对话框',
      description: '放行常见打开、保存、浏览文件夹、通知和系统对话框。',
      titlePatterns: ['打开', '另存为', '保存为', '选择文件', '浏览文件夹', '选择文件夹', '通知', '系统托盘溢出窗口'],
    }),
    createSystemSafelistRule({
      id: 'system-screenshot',
      name: '截图工具',
      description: '放行 Windows 截图工具（截图和草图、Snipping Tool）及截图相关覆盖层。',
      processPatterns: ['SnippingTool.exe', 'ScreenSketch.exe', 'ScreenClippingHost.exe'],
      titlePatterns: ['截图和草图', 'Snipping Tool', '截图工具', 'Screen Snip'],
    }),
  ];
}

export function createCategoryRule({
  id,
  name,
  color = '#38bdf8',
  pattern = '',
  enabled = true,
  createdAt,
} = {}) {
  return {
    id: id || `category-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    name: name || '未命名分类',
    color,
    pattern: String(pattern || '').trim(),
    enabled,
    createdAt: createdAt || new Date().toISOString(),
  };
}

export function getDefaultCategoryRules() {
  return [
    createCategoryRule({ id: 'cat-programming', name: 'Programming', color: '#4ade80', pattern: 'GitHub|Stack Overflow|Bitbucket|GitLab|vim|Spyder|kate|Ghidra|Scite|Code|Visual Studio|PyCharm|WebStorm|Terminal|PowerShell' }),
    createCategoryRule({ id: 'cat-ai', name: 'AI', color: '#a78bfa', pattern: 'ChatGPT|Google AI Studio|Claude|Gemini|Copilot|OpenAI|Anthropic|WindowsTerminal|Windows PowerShell|PowerShell' }),
    createCategoryRule({ id: 'cat-notes', name: 'Notes', color: '#f472b6', pattern: 'Open Notebook|Obsidian|Typora|Notion|OneNote|adobe' }),
    createCategoryRule({ id: 'cat-paper', name: 'Paper', color: '#38bdf8', pattern: 'zotero|pdf|论文|paper|Reader|Acrobat' }),
    createCategoryRule({ id: 'cat-office', name: 'Office', color: '#fb923c', pattern: 'powerpoint|word|excel|powerpnt|Acrobat|WPS' }),
    createCategoryRule({ id: 'cat-media', name: 'Media', color: '#f43f5e', pattern: 'Photoshop|GIMP|Inkscape|Premiere|剪映|Image|画图' }),
    createCategoryRule({ id: 'cat-comms', name: 'Comms', color: '#67e8f9', pattern: '微信|WeChat|QQ|Slack|Teams|Discord|Telegram|飞书' }),
    createCategoryRule({ id: 'cat-fun', name: '摸鱼', color: '#84cc16', pattern: 'msedge.exe|Edge|Bilibili|抖音|微博|小红书|youtube|娱乐|wechat' }),
  ];
}

export function buildWindowAllowanceFromContext(context) {
  return {
    id: `win-${context.windowId}-${Date.now()}`,
    label: context.title || context.processName || '未命名窗口',
    processPath: context.processPath || '',
    processName: context.processName || '',
    initialTitle: context.title || '',
    windowId: context.windowId ?? null,
    createdAt: new Date().toISOString(),
  };
}

export function buildDomainAllowance(input, mode = 'subdomain') {
  const domain = normalizeDomain(input);
  return {
    id: `domain-${domain}-${Date.now()}`,
    label: domain || input,
    domain,
    matchMode: mode === 'exact' ? 'exact' : 'subdomain',
    createdAt: new Date().toISOString(),
  };
}

export function domainMatches(rule, domain) {
  if (!rule?.domain || !domain) {
    return false;
  }

  const normalizedRule = normalizeDomain(rule.domain);
  const normalizedDomain = normalizeDomain(domain);
  if (!normalizedRule || !normalizedDomain) {
    return false;
  }

  if (rule.matchMode === 'exact') {
    return normalizedRule === normalizedDomain;
  }

  return normalizedDomain === normalizedRule || normalizedDomain.endsWith(`.${normalizedRule}`);
}

export function formatRemaining(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDurationMinutes(totalMinutes = 0) {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) {
    return `${rest} 分钟`;
  }

  if (rest === 0) {
    return `${hours} 小时`;
  }

  return `${hours} 小时 ${rest} 分钟`;
}
