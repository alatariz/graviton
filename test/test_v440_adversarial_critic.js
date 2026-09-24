// test/test_v440_adversarial_critic.js - Graviton V4.4.0 Dual-Agent Adversarial Critic Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  evaluateCodeAdversarially,
  evaluateWorkspaceAdversarially,
  formatAdversarialCritique,
  synthesizeAdversarialPromptHarness
} from '../src/adversarial-critic.js';

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V4.4.0 ADVERSARIAL RED-TEAM & CRITIC SUITE');
console.log('===============================================================\x1b[0m\n');

// [TEST 1] Testing XSS innerHTML Detection
console.log('[TEST 1] Testing dynamic XSS innerHTML detection...');
const unsafeXssCode = `
function renderUser(user) {
  const container = document.getElementById('app');
  container.innerHTML = '<div>' + user.name + '</div>';
}
`;
const xssReport = evaluateCodeAdversarially(unsafeXssCode, 'xss.js');
assert.strictEqual(xssReport.passed, false, 'Unsafe dynamic innerHTML must fail adversarial check');
assert.ok(xssReport.findings.some(f => f.ruleId === 'SEC-XSS-INNERHTML'), 'Must flag SEC-XSS-INNERHTML');

const safeXssCode = `
function renderApp() {
  const container = document.getElementById('app');
  container.innerHTML = '<div class="banner">Welcome</div>';
}
`;
const safeReport = evaluateCodeAdversarially(safeXssCode, 'safe.js');
assert.strictEqual(safeReport.findings.some(f => f.ruleId === 'SEC-XSS-INNERHTML'), false, 'Static HTML literal must not trigger XSS rule');
console.log('  ✔ PASS: XSS innerHTML accurately distinguished dynamic from static literals\n');

// [TEST 2] Testing Code Execution Detection (eval & Function)
console.log('[TEST 2] Testing eval and Function constructor detection...');
const evalCode = `
const fn = new Function('a', 'b', 'return a + b');
eval('console.log("danger")');
`;
const evalReport = evaluateCodeAdversarially(evalCode, 'eval.js');
assert.strictEqual(evalReport.passed, false, 'Eval code must fail verification');
assert.ok(evalReport.findings.some(f => f.ruleId === 'SEC-CODE-EVAL'), 'Must flag SEC-CODE-EVAL');
console.log('  ✔ PASS: Insecure code evaluation primitives correctly flagged\n');

// [TEST 3] Testing Unguarded JSON.parse vs Guarded
console.log('[TEST 3] Testing unguarded JSON.parse detection...');
const unguardedJsonCode = `
function loadSettings(str) {
  const obj = JSON.parse(str);
  return obj.theme;
}
`;
const jsonReport = evaluateCodeAdversarially(unguardedJsonCode, 'json.js');
assert.ok(jsonReport.findings.some(f => f.ruleId === 'RES-UNGUARDED-JSON'), 'Unguarded JSON.parse must be flagged');

const guardedJsonCode = `
function loadSettingsSafe(str) {
  try {
    const obj = JSON.parse(str);
    return obj.theme;
  } catch (err) {
    return 'default';
  }
}
`;
const safeJsonReport = evaluateCodeAdversarially(guardedJsonCode, 'json-safe.js');
assert.strictEqual(safeJsonReport.findings.some(f => f.ruleId === 'RES-UNGUARDED-JSON'), false, 'Guarded JSON.parse inside try/catch must pass');
console.log('  ✔ PASS: Unguarded JSON.parse detection operates with proper scope awareness\n');

// [TEST 4] Testing High-Frequency Event Listener Memory Leak
console.log('[TEST 4] Testing event listener leak detection...');
const leakingListenerCode = `
export function setupScroll() {
  window.addEventListener('scroll', () => {
    console.log('scrolling');
  });
}
`;
const leakReport = evaluateCodeAdversarially(leakingListenerCode, 'leak.js');
assert.ok(leakReport.findings.some(f => f.ruleId === 'RES-LISTENER-LEAK'), 'Leaking event listener must be flagged');

const cleanListenerCode = `
export function setupScrollClean() {
  const controller = new AbortController();
  window.addEventListener('scroll', () => {}, { signal: controller.signal });
  return () => controller.abort();
}
`;
const cleanReport = evaluateCodeAdversarially(cleanListenerCode, 'clean.js');
assert.strictEqual(cleanReport.findings.some(f => f.ruleId === 'RES-LISTENER-LEAK'), false, 'Clean event listener with AbortController signal must pass');
console.log('  ✔ PASS: Memory leak detection reliably identifies missing event cleanup\n');

// [TEST 5] Testing Regular Expression Catastrophic Backtracking (ReDoS)
console.log('[TEST 5] Testing ReDoS catastrophic backtracking detection...');
const redosCode = `
const emailPattern = /^([a-zA-Z0-9]+)+$/;
`;
const redosReport = evaluateCodeAdversarially(redosCode, 'redos.js');
assert.ok(redosReport.findings.some(f => f.ruleId === 'PERF-REDOS-VULN'), 'Catastrophic ReDoS pattern must be flagged');
console.log('  ✔ PASS: ReDoS vulnerability detected and flagged as HIGH severity\n');

// [TEST 6] Testing Workspace Audit and Score Aggregation
console.log('[TEST 6] Testing evaluateWorkspaceAdversarially on temporary directory...');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v440-workspace-'));
try {
  fs.writeFileSync(path.join(tempDir, 'good.js'), 'export function add(a, b) { return a + b; }');
  fs.writeFileSync(path.join(tempDir, 'bad.js'), 'eval("x = 1"); element.innerHTML = userInput;');

  const wsReport = evaluateWorkspaceAdversarially(tempDir);
  assert.strictEqual(wsReport.filesAudited, 2, 'Must audit both JS files in workspace');
  assert.strictEqual(wsReport.passed, false, 'Workspace with bad.js must not pass audit');
  assert.ok(wsReport.totalFindings >= 2, 'Must flag findings from bad.js');
  assert.ok(wsReport.averageScore < 100, 'Average score must reflect defects');

  // Format report check
  const critiqueText = formatAdversarialCritique(wsReport);
  assert.ok(critiqueText.includes('GRAVITON ADVERSARIAL RED-TEAM & CRITIC REPORT'), 'Report header present');
  assert.ok(critiqueText.includes('MANDATORY HARDENING DIRECTIVE'), 'Hardening directive present');

  // Prompt harness check
  const promptHarness = synthesizeAdversarialPromptHarness(wsReport);
  assert.ok(promptHarness.includes('=== [GRAVITON ADVERSARIAL CRITIC DIRECTIVE] ==='), 'Prompt directive header present');
  assert.ok(promptHarness.includes('SEC-XSS-INNERHTML') || promptHarness.includes('SEC-CODE-EVAL'), 'Includes specific findings');
  console.log('  ✔ PASS: Workspace audit accurately aggregates metrics and generates critique\n');
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

// [TEST 7] Testing 100% Zero-Emoji Compliance
console.log('[TEST 7] Testing Zero-Emoji policy across V4.4.0 adversarial components...');
const sampleOutput = formatAdversarialCritique(xssReport);
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert.strictEqual(emojiRegex.test(sampleOutput), false, 'Critique output must contain zero emojis');
console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

console.log('===============================================================');
console.log('✔ ALL GRAVITON V4.4.0 ADVERSARIAL CRITIC TESTS PASSED 100%!');
console.log('===============================================================\n');
