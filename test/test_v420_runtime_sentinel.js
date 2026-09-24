// test/test_v420_runtime_sentinel.js - Graviton V4.2.0 Autonomous Runtime Verification Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  verifyJavaScriptSyntax,
  verifyDomBindings,
  verifyLocalImports,
  verifyProjectRuntime,
  generateSelfCorrectionDirective,
  autoHealMissingDomElement
} from '../src/runtime-sentinel.js';

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V4.2.0 AUTONOMOUS RUNTIME SENTINEL TEST SUITE');
console.log('===============================================================\x1b[0m\n');

// [TEST 1] JavaScript Syntax Verification
console.log('[TEST 1] Testing JavaScript syntax verification...');
const validCode = 'function add(a, b) { return a + b; }\nconsole.log(add(2, 3));';
const syntaxValid = verifyJavaScriptSyntax(validCode);
assert.strictEqual(syntaxValid.valid, true, 'Valid code must pass syntax check');

const brokenCode = 'function broken() { if (true) { console.log("missing brace");';
const syntaxBroken = verifyJavaScriptSyntax(brokenCode);
assert.strictEqual(syntaxBroken.valid, false, 'Broken code must fail syntax check');
assert.ok(syntaxBroken.error, 'Must report syntax error message');
console.log('  ✔ PASS: Syntax validator accurately detects syntax defects\n');

// [TEST 2] DOM Binding Mismatch Verification
console.log('[TEST 2] Testing DOM binding mismatch detection between HTML and JS...');
const testHtml = '<!DOCTYPE html><html><body><canvas id="gameCanvas"></canvas><div id="score">0</div></body></html>';
const testJs = 'const canvas = document.getElementById("gameCanvas"); const missingBtn = document.getElementById("startBtn");';

const domErrors = verifyDomBindings(testHtml, testJs);
assert.strictEqual(domErrors.length, 1, 'Must detect exactly 1 missing DOM element');
assert.strictEqual(domErrors[0].missingId, 'startBtn', 'Must identify startBtn as missing');
assert.ok(domErrors[0].issue.includes("document.getElementById('startBtn')"), 'Must formulate detailed mismatch issue');
console.log('  ✔ PASS: DOM binding checker flags missing selectors before runtime execution\n');

// [TEST 3] Local Relative Import Verification
console.log('[TEST 3] Testing local relative import verification...');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v420-test-'));

try {
  const existingModule = path.join(tempDir, 'math.js');
  fs.writeFileSync(existingModule, 'export function multiply(a, b) { return a * b; }', 'utf8');

  const mainFile = path.join(tempDir, 'main.js');
  const codeWithImports = 'import { multiply } from "./math.js";\nimport { ghost } from "./non_existent.js";';

  const importIssues = verifyLocalImports(codeWithImports, mainFile);
  assert.strictEqual(importIssues.length, 1, 'Must detect exactly 1 missing import');
  assert.strictEqual(importIssues[0].importPath, './non_existent.js', 'Must identify missing module');
  console.log('  ✔ PASS: Import validator flags missing local dependency files\n');

  // [TEST 4] Full Workspace Runtime Inspection
  console.log('[TEST 4] Testing full workspace runtime inspection...');
  fs.writeFileSync(path.join(tempDir, 'index.html'), '<!DOCTYPE html><html><body><div id="app"></div></body></html>', 'utf8');
  fs.writeFileSync(path.join(tempDir, 'app.js'), 'document.getElementById("missingElement").addEventListener("click", () => {});', 'utf8');

  const report = verifyProjectRuntime(tempDir);
  assert.strictEqual(report.valid, false, 'Project must be flagged as having defects');
  assert.strictEqual(report.domMismatches.length, 1, 'Must detect 1 DOM mismatch in workspace');
  assert.strictEqual(report.domMismatches[0].missingId, 'missingElement');
  console.log('  ✔ PASS: Full workspace scan detects latent runtime defects\n');

  // [TEST 5] Self-Correction Diagnostic Directive Generation
  console.log('[TEST 5] Testing self-correction diagnostic directive generation...');
  const directive = generateSelfCorrectionDirective(report);
  assert.ok(directive.includes('=== [GRAVITON AUTONOMOUS RUNTIME SENTINEL: DEFECT ISOLATION REPORT] ==='), 'Must include sentinel header');
  assert.ok(directive.includes('DOM BINDING MISMATCH'), 'Must include DOM mismatch diagnostic');
  assert.ok(directive.includes('missingElement'), 'Must mention missing element ID');
  assert.ok(directive.includes('Mandatory Action'), 'Must include actionable repair instruction');
  console.log('  ✔ PASS: Self-correction directive generated with surgical diagnostic clarity\n');

  // [TEST 6] Auto-Healing of Missing DOM Elements
  console.log('[TEST 6] Testing autonomous healing of broken DOM element bindings...');
  const brokenHtml = '<!DOCTYPE html><html><body><h1>Game</h1></body></html>';
  const healRes = autoHealMissingDomElement(brokenHtml, 'score');
  assert.strictEqual(healRes.wasHealed, true, 'Must report healed state');
  assert.ok(healRes.healedHtml.includes('<div id="score"></div>'), 'Must inject missing element into HTML');
  console.log('  ✔ PASS: Auto-healing repairs broken DOM container bindings\n');

  // [TEST 7] Zero-Emoji Compliance
  console.log('[TEST 7] Testing zero-emoji policy on V4.2.0 output...');
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.strictEqual(emojiRegex.test(report.summary), false, 'Report summary must contain zero emojis');
  assert.strictEqual(emojiRegex.test(directive), false, 'Self-correction directive must contain zero emojis');
  console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

  console.log('===============================================================');
  console.log('✔ ALL GRAVITON V4.2.0 RUNTIME SENTINEL TESTS PASSED 100%!');
  console.log('===============================================================\n');
} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}
