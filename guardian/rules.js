import { domainMatches } from '../shared/models.js';
import { matchSystemSafelist } from './system-safelist.js';

export function isInternalForestWindow(context) {
  const label = `${context.processName ?? ''} ${context.processPath ?? ''} ${context.title ?? ''}`.toLowerCase();
  return label.includes('sprout');
}

export function decideContext({ context, allowedWindows, allowedDomains, allowedCategories, systemSafelistEnabled }) {
  if (!context?.windowId) {
    return {
      allowed: true,
      reason: '未检测到有效前台窗口',
      matchedWindow: null,
      matchedDomain: null,
      matchedCategory: null,
      matchedSystemRule: null,
    };
  }

  if (isInternalForestWindow(context)) {
    return {
      allowed: true,
      reason: 'Sprout 自身界面允许前台显示',
      matchedWindow: null,
      matchedDomain: null,
      matchedCategory: null,
      matchedSystemRule: null,
    };
  }

  const matchedSystemRule = matchSystemSafelist(context, systemSafelistEnabled);
  if (matchedSystemRule) {
    return {
      allowed: true,
      reason: `命中系统安全白名单 ${matchedSystemRule.name}`,
      matchedWindow: null,
      matchedDomain: null,
      matchedCategory: null,
      matchedSystemRule,
    };
  }

  if (context.isBrowser && context.domain) {
    const matchedDomain = allowedDomains.find((rule) => domainMatches(rule, context.domain));
    if (matchedDomain) {
      return {
        allowed: true,
        reason: `域名 ${context.domain} 命中允许规则`,
        matchedWindow: null,
        matchedDomain,
        matchedCategory: null,
        matchedSystemRule: null,
      };
    }
  }

  const matchedWindow = allowedWindows.find((rule) => windowMatches(rule, context));
  if (matchedWindow) {
    return {
      allowed: true,
      reason: '当前窗口命中允许列表',
      matchedWindow,
      matchedDomain: null,
      matchedCategory: null,
      matchedSystemRule: null,
    };
  }

  const matchedCategory = (allowedCategories || []).find((rule) => categoryMatches(rule, context));
  if (matchedCategory) {
    return {
      allowed: true,
      reason: `命中分类规则 ${matchedCategory.name}`,
      matchedWindow: null,
      matchedDomain: null,
      matchedCategory,
      matchedSystemRule: null,
    };
  }

  return {
    allowed: false,
    reason: context.isBrowser && context.domain
      ? `域名 ${context.domain} 和当前窗口都未命中允许规则`
      : '当前窗口不在允许列表中',
    matchedWindow: null,
    matchedDomain: null,
    matchedCategory: null,
    matchedSystemRule: null,
  };
}

function windowMatches(rule, context) {
  if (!rule || !context) {
    return false;
  }

  if (rule.windowId != null && context.windowId != null && rule.windowId === context.windowId) {
    return true;
  }

  const samePath = Boolean(rule.processPath && context.processPath && rule.processPath.toLowerCase() === context.processPath.toLowerCase());
  const sameTitle = Boolean(rule.initialTitle && context.title && rule.initialTitle.trim() === context.title.trim());
  return samePath && sameTitle;
}

function categoryMatches(rule, context) {
  if (!rule?.enabled || !rule.pattern) {
    return false;
  }

  const haystack = [
    context.title,
    context.processName,
    context.processPath,
    context.domain,
    context.url,
  ]
    .filter(Boolean)
    .join(' || ');

  if (!haystack) {
    return false;
  }

  try {
    return new RegExp(rule.pattern, 'i').test(haystack);
  } catch {
    return rule.pattern
      .split('|')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)
      .some((token) => haystack.toLowerCase().includes(token));
  }
}
