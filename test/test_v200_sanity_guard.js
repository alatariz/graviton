/**
 * Graviton V2.0.0 Post-Run Syntax Sanity Guard Test Suite
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  checkFileSyntax,
  checkSyntaxSanity,
  formatSanityReport
} from '../src/sanity-guard.js';

async function runTests() {
  console.log('=== STARTING V2.0.0 SYNTAX SANITY GUARD TEST SUITE ===\n');

  const testDir = path.join(os.tmpdir(), 'graviton_v200_sanity_test_' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');

  const validJs = path.join(testDir, 'valid.js');
  const brokenJs = path.join(testDir, 'broken.js');
  const validJson = path.join(testDir, 'valid.json');
  const brokenJson = path.join(testDir, 'broken.json');

  fs.writeFileSync(validJs, 'export function add(a, b) { return a + b; }\n', 'utf8');
  fs.writeFileSync(brokenJs, 'export function add(a, b { return a + b; }\n', 'utf8'); // Missing paren
  fs.writeFileSync(validJson, JSON.stringify({ name: "graviton", version: 2 }, null, 2), 'utf8');
  fs.writeFileSync(brokenJson, '{\n  "name": "graviton",\n  "unclosed": \n', 'utf8'); // Broken JSON

  // [TEST 1] Valid JavaScript Check
  console.log('[TEST 1] Valid JavaScript File');
  const res1 = checkFileSyntax(validJs);
  assert.strictEqual(res1.valid, true, 'Valid JS should pass syntax check');
  console.log('  ✔ Valid JS passed check cleanly');

  // [TEST 2] Broken JavaScript Detection
  console.log('\n[TEST 2] Broken JavaScript File Detection');
  const res2 = checkFileSyntax(brokenJs);
  assert.strictEqual(res2.valid, false, 'Broken JS must fail syntax check');
  assert.ok(res2.error, 'Error message must be present');
  console.log('  ✔ Broken JS detected accurately: ' + res2.error);

  // [TEST 3] JSON Validation
  console.log('\n[TEST 3] JSON Validation');
  const resJson1 = checkFileSyntax(validJson);
  assert.strictEqual(resJson1.valid, true, 'Valid JSON should pass');

  const resJson2 = checkFileSyntax(brokenJson);
  assert.strictEqual(resJson2.valid, false, 'Broken JSON must fail');
  assert.ok(resJson2.error, 'Broken JSON should report error');
  console.log('  ✔ Broken JSON detected accurately: ' + resJson2.error);

  // [TEST 4] Batch Syntax Sanity Check
  console.log('\n[TEST 4] Batch Syntax Sanity Check');
  const batchReport = checkSyntaxSanity([validJs, brokenJs, validJson, brokenJson]);
  assert.strictEqual(batchReport.hasErrors, true, 'Batch check should report errors');
  assert.strictEqual(batchReport.issues.length, 2, 'Should detect exactly 2 issues (brokenJs & brokenJson)');
  console.log('  ✔ Batch check caught exactly 2 broken files out of 4');

  // [TEST 5] Report Formatting
  console.log('\n[TEST 5] Sanity Report Formatting');
  const formatted = formatSanityReport(batchReport.issues);
  assert.ok(formatted.includes('GRAVITON SANITY GUARD WARNING'), 'Should format header');
  assert.ok(formatted.includes('broken.js'), 'Should mention broken.js');
  assert.ok(formatted.includes('graviton undo'), 'Should include remediation tip');
  console.log('  ✔ Formatted alert contains remediation guidance');

  // Clean up
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  console.log('\n=== ALL V2.0.0 SYNTAX SANITY GUARD TESTS PASSED! ===\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
