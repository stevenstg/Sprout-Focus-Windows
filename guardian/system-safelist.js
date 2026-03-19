import { getDefaultSystemSafelistRules } from '../shared/models.js';

function normalize(value = '') {
  return String(value || '').toLowerCase();
}

function includesAny(text, patterns = []) {
  const target = normalize(text);
  return patterns.some((pattern) => target.includes(normalize(pattern)));
}

export function getSystemSafelistRules() {
  return getDefaultSystemSafelistRules();
}

export function matchSystemSafelist(context, enabled = true, rules = getSystemSafelistRules()) {
  if (!enabled || !context) {
    return null;
  }

  const processPath = normalize(context.processPath);
  const processName = normalize(context.processName);
  const title = normalize(context.title);

  for (const rule of rules) {
    if (!rule.enabled) {
      continue;
    }

    const matchesProcess = !rule.processPatterns?.length
      || includesAny(processPath, rule.processPatterns)
      || includesAny(processName, rule.processPatterns);
    const matchesTitle = !rule.titlePatterns?.length || includesAny(title, rule.titlePatterns);

    if (matchesProcess && matchesTitle) {
      return rule;
    }
  }

  return null;
}
