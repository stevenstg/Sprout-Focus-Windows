import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ActivityWatchClient } from '../integrations/activitywatch/client.js';
import { regenerateHistoryMarkdown } from '../guardian/history.js';
import {
  buildDomainAllowance,
  buildWindowAllowanceFromContext,
  createCategoryRule,
  domainMatches,
  normalizeDomain,
} from '../shared/models.js';
import { decideContext } from '../guardian/rules.js';

assert.equal(normalizeDomain('https://chat.openai.com/c/1'), 'chat.openai.com');
assert.equal(normalizeDomain('docs.github.com/en'), 'docs.github.com');

const domainRule = buildDomainAllowance('chat.openai.com', 'subdomain');
assert.equal(domainMatches(domainRule, 'chat.openai.com'), true);
assert.equal(domainMatches(domainRule, 'a.chat.openai.com'), true);
assert.equal(domainMatches(domainRule, 'openai.com'), false);

const windowContext = {
  timestamp: new Date().toISOString(),
  source: 'windows',
  title: 'Visual Studio Code',
  windowId: 101,
  processId: 1,
  processName: 'Code',
  processPath: 'C:/Program Files/Microsoft VS Code/Code.exe',
  isBrowser: false,
  browserName: '',
  url: '',
  domain: '',
  confidence: 0.7,
};
const allowance = buildWindowAllowanceFromContext(windowContext);
const decision = decideContext({
  context: windowContext,
  allowedWindows: [allowance],
  allowedDomains: [],
  systemSafelistEnabled: true,
});
assert.equal(decision.allowed, true);

const browserDecision = decideContext({
  context: {
    ...windowContext,
    title: 'ChatGPT',
    isBrowser: true,
    domain: 'chat.openai.com',
  },
  allowedWindows: [],
  allowedDomains: [domainRule],
  systemSafelistEnabled: true,
});
assert.equal(browserDecision.allowed, true);

const categoryDecision = decideContext({
  context: {
    ...windowContext,
    title: 'Claude - Project draft',
    processName: 'msedge.exe',
    processPath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  },
  allowedWindows: [],
  allowedDomains: [],
  allowedCategories: [createCategoryRule({ name: 'AI', pattern: 'Claude|ChatGPT|Gemini' })],
  systemSafelistEnabled: true,
});
assert.equal(categoryDecision.allowed, true);

const systemDecision = decideContext({
  context: {
    ...windowContext,
    title: 'Windows 资源管理器',
    processName: 'explorer.exe',
    processPath: 'C:/Windows/explorer.exe',
  },
  allowedWindows: [],
  allowedDomains: [],
  allowedCategories: [],
  systemSafelistEnabled: true,
});
assert.equal(systemDecision.allowed, true);
assert.equal(Boolean(systemDecision.matchedSystemRule), true);

const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'forest-history-'));
const logDir = path.join(tempRoot, 'logs');
const historyDir = path.join(tempRoot, 'history');
await fs.mkdir(logDir, { recursive: true });
await fs.writeFile(
  path.join(logDir, 'forest-2026-03-18.jsonl'),
  `${JSON.stringify({ kind: 'session-ended', payload: {
    startedAt: '2026-03-18T01:00:00.000Z',
    endedAt: '2026-03-18T01:25:00.000Z',
    durationMinutes: 25,
    actualDurationMinutes: 12,
    plannedDurationMinutes: 25,
    violationCount: 2,
    violations: [],
    allowedWindows: [{ label: 'Visual Studio Code' }],
    allowedDomains: [{ domain: 'chat.openai.com', matchMode: 'subdomain' }],
    allowedCategories: [{ name: 'AI', pattern: 'ChatGPT' }],
    primaryWindow: { label: 'Visual Studio Code' },
    primaryCategory: { name: 'AI' },
    completionReason: 'completed',
  } })}\n`,
  'utf8',
);
const historyResult = await regenerateHistoryMarkdown({ logDir, historyDir, dateKey: '2026-03-18' });
const markdown = await fs.readFile(historyResult.historyFile, 'utf8');
assert.equal(markdown.includes('## 当日摘要'), true);
assert.equal(markdown.includes('## '), true);
assert.equal(markdown.includes('Visual Studio Code'), true);
assert.equal(markdown.includes('实际时长：12 分钟'), true);
assert.equal(markdown.includes('计划时长：25 分钟'), true);

const client = new ActivityWatchClient();
const status = await client.probe();
assert.equal(typeof status.online, 'boolean');

console.log('smoke 通过');
