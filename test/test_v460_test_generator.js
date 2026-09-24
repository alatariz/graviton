// test/test_v460_test_generator.js - Graviton V4.6.0 Deterministic Test Auto-Generator Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import {
  extractExportSignatures,
  generateUnitTestScaffold,
  generateTestFile
} from '../src/test-generator.js';

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V4.6.0 DETERMINISTIC TEST AUTO-GENERATOR SUITE');
console.log('===============================================================\x1b[0m\n');

// [TEST 1] Testing Export Signature Extraction
console.log('[TEST 1] Testing extractExportSignatures on functions, classes, and constants...');
const sourceCode = `
export async function fetchData(url, options = {}) {
  return { status: 200 };
}

export function calculateScore(items, count) {
  return items.length * count;
}

export class OrderService {
  process() { return true; }
}

export const API_BASE_URL = 'https://api.example.com';
export { calculateScore as scoreAlias };
`;

const signatures = extractExportSignatures(sourceCode);
assert.strictEqual(signatures.length, 5, 'Must extract 5 exported symbols');

const fetchSig = signatures.find(s => s.name === 'fetchData');
assert.ok(fetchSig, 'fetchData must be detected');
assert.strictEqual(fetchSig.isAsync, true, 'fetchData must be marked async');
assert.deepStrictEqual(fetchSig.params, ['url', 'options'], 'fetchData params must match without defaults');

const calcSig = signatures.find(s => s.name === 'calculateScore');
assert.ok(calcSig, 'calculateScore must be detected');
assert.strictEqual(calcSig.isAsync, false, 'calculateScore must be sync');

const classSig = signatures.find(s => s.name === 'OrderService');
assert.ok(classSig, 'OrderService class must be detected');
assert.strictEqual(classSig.type, 'class', 'OrderService must have type class');

const varSig = signatures.find(s => s.name === 'API_BASE_URL');
assert.ok(varSig, 'API_BASE_URL must be detected');
assert.strictEqual(varSig.type, 'variable', 'API_BASE_URL must have type variable');
console.log('  ✔ PASS: Export signatures extracted with correct typing and parameter mapping\n');

// [TEST 2] Testing generateUnitTestScaffold Syntax and Structure
console.log('[TEST 2] Testing generateUnitTestScaffold generated test code structure...');
const testScaffold = generateUnitTestScaffold(sourceCode, {
  relSourcePath: './service.js',
  suiteTitle: 'service'
});

assert.ok(testScaffold.includes("import assert from 'assert';"), 'Must import assert');
assert.ok(testScaffold.includes("import {\n  fetchData,\n  calculateScore,"), 'Must import extracted symbols');
assert.ok(testScaffold.includes('assert.strictEqual(typeof fetchData, \'function\''), 'Must assert function type');
assert.ok(testScaffold.includes('assert.strictEqual(typeof OrderService, \'function\''), 'Must assert class constructor');
assert.ok(testScaffold.includes('assert.ok(API_BASE_URL !== undefined'), 'Must assert variable existence');
console.log('  ✔ PASS: Test scaffold synthesized with full assertions and imports\n');

// [TEST 3] Testing End-to-End File Generation & Native Execution
console.log('[TEST 3] Testing generateTestFile and executing generated test with Node.js runtime...');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v460-testgen-'));

try {
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  const sourcePath = path.join(tempDir, 'math-service.js');
  const testPath = path.join(tempDir, 'test_math-service.js');

  fs.writeFileSync(sourcePath, `
    export function add(a, b) {
      return Number(a || 0) + Number(b || 0);
    }

    export function formatCurrency(amount) {
      return '$' + Number(amount || 0).toFixed(2);
    }

    export class MathHelper {
      square(n) { return n * n; }
    }

    export const VERSION = '2.0.0';
  `, 'utf8');

  const genResult = generateTestFile(sourcePath, testPath);
  assert.strictEqual(genResult.success, true, 'Test generation must report success');
  assert.ok(fs.existsSync(testPath), 'Generated test file must exist on disk');

  // Execute the generated test file via Node
  const execResult = spawnSync(process.execPath, [testPath], {
    cwd: tempDir,
    encoding: 'utf8'
  });

  if (execResult.status !== 0) {
    console.error('Generated test output:', execResult.stdout);
    console.error('Generated test error:', execResult.stderr);
  }
  assert.strictEqual(execResult.status, 0, 'Generated test file must execute and exit with code 0');
  assert.ok(execResult.stdout.includes('ALL AUTO-GENERATED TESTS FOR MATH-SERVICE PASSED 100%!'), 'Success confirmation in stdout');
  console.log('  ✔ PASS: Generated unit test executed natively in Node.js and passed 100%\n');

} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

// [TEST 4] Testing 100% Zero-Emoji Compliance
console.log('[TEST 4] Testing Zero-Emoji policy across V4.6.0 test generator components...');
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert.strictEqual(emojiRegex.test(testScaffold), false, 'Generated test code must contain zero emojis');
console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

console.log('===============================================================');
console.log('✔ ALL GRAVITON V4.6.0 TEST AUTO-GENERATOR TESTS PASSED 100%!');
console.log('===============================================================\n');
