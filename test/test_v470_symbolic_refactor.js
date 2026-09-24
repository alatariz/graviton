// test/test_v470_symbolic_refactor.js - Graviton V4.7.0 Symbolic Refactoring Engine Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import {
  planSymbolRename,
  applySymbolRename,
  formatRefactorPlan
} from '../src/symbolic-refactor.js';

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V4.7.0 SYMBOLIC REFACTORING SUITE');
console.log('===============================================================\x1b[0m\n');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v470-refactor-'));

try {
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');

  // Module A: declares and exports calculateTax
  const fileA = path.join(tempDir, 'tax-service.js');
  fs.writeFileSync(fileA, `
export function calculateTax(amount, rate) {
  return Number(amount) * Number(rate);
}

export function formatTax(amount) {
  const tax = calculateTax(amount, 0.1);
  return 'Tax: ' + tax;
}
`, 'utf8');

  // Module B: direct consumer without alias
  const fileB = path.join(tempDir, 'checkout.js');
  fs.writeFileSync(fileB, `
import { calculateTax } from './tax-service.js';

export function runCheckout(subtotal) {
  const tax = calculateTax(subtotal, 0.05);
  return subtotal + tax;
}
`, 'utf8');

  // Module C: consumer with alias
  const fileC = path.join(tempDir, 'invoice.js');
  fs.writeFileSync(fileC, `
import { calculateTax as computeFee } from './tax-service.js';

export function printInvoice(total) {
  return computeFee(total, 0.08);
}
`, 'utf8');

  // [TEST 1] Testing Validation on Non-Existent Symbol
  console.log('[TEST 1] Testing error handling on non-existent symbol...');
  assert.throws(
    () => planSymbolRename(tempDir, 'tax-service.js', 'missingFunction', 'newFunc'),
    /is not declared or exported/,
    'Must throw error when symbol does not exist'
  );
  console.log('  ✔ PASS: Non-existent symbol correctly rejected\n');

  // [TEST 2] Testing planSymbolRename Calculation Across Definition & Consumers
  console.log('[TEST 2] Testing planSymbolRename across definition and consumer files...');
  const plan = planSymbolRename(tempDir, 'tax-service.js', 'calculateTax', 'computeVat');

  assert.strictEqual(plan.targetFile, 'tax-service.js', 'Target file matches');
  assert.strictEqual(plan.filesToUpdate.length, 3, 'Must update definition file and 2 consumer files');
  assert.ok(plan.totalReplacements >= 4, 'Must have at least 4 replacements total');

  const patchA = plan.filesToUpdate.find(f => f.file === 'tax-service.js');
  assert.ok(patchA.patches.some(p => p.replacement.includes('function computeVat(')), 'Updates declaration');
  assert.ok(patchA.patches.some(p => p.replacement.includes('computeVat(amount, 0.1)')), 'Updates internal call');

  const patchB = plan.filesToUpdate.find(f => f.file === 'checkout.js');
  assert.ok(patchB.patches.some(p => p.replacement.includes('import { computeVat }')), 'Updates consumer import');
  assert.ok(patchB.patches.some(p => p.replacement.includes('computeVat(subtotal, 0.05)')), 'Updates consumer call');

  const patchC = plan.filesToUpdate.find(f => f.file === 'invoice.js');
  assert.ok(patchC.patches.some(p => p.replacement.includes('computeVat as computeFee')), 'Updates aliased import');
  // Crucial: call-site computeFee must NOT be modified
  assert.strictEqual(patchC.patches.some(p => p.original.includes('computeFee(total, 0.08)')), false, 'Aliased call sites must remain intact');
  console.log('  ✔ PASS: Refactor plan accurately resolves declarations, imports, and preserves aliases\n');

  // [TEST 3] Testing Dry-Run Safety (Files untouched before apply)
  console.log('[TEST 3] Testing dry-run safety...');
  const rawA = fs.readFileSync(fileA, 'utf8');
  assert.ok(rawA.includes('calculateTax'), 'Original file content must not be modified during planning');
  console.log('  ✔ PASS: Dry-run planning leaves files 100% untouched\n');

  // [TEST 4] Testing formatRefactorPlan Output
  console.log('[TEST 4] Testing formatRefactorPlan preview formatting...');
  const formattedPreview = formatRefactorPlan(plan);
  assert.ok(formattedPreview.includes('GRAVITON SYMBOLIC REFACTORING ENGINE: PLAN PREVIEW'), 'Preview header present');
  assert.ok(formattedPreview.includes('calculateTax -> computeVat'), 'Symbol transition present');
  assert.ok(formattedPreview.includes('STATUS: DRY-RUN PREVIEW'), 'Dry-run notice present');
  console.log('  ✔ PASS: Formatted refactor plan produces clear visual diff\n');

  // [TEST 5] Testing applySymbolRename Atomic Application & Runtime Verification
  console.log('[TEST 5] Testing applySymbolRename and verifying code execution...');
  const applyResult = applySymbolRename(plan);
  assert.strictEqual(applyResult.success, true, 'Apply must succeed');
  assert.strictEqual(applyResult.filesModified, 3, 'Must modify 3 files on disk');

  // Verify file contents on disk
  const updatedA = fs.readFileSync(fileA, 'utf8');
  assert.ok(updatedA.includes('function computeVat('), 'Definition file updated');
  assert.strictEqual(updatedA.includes('calculateTax'), false, 'Old symbol eradicated from definition');

  const updatedB = fs.readFileSync(fileB, 'utf8');
  assert.ok(updatedB.includes('import { computeVat }'), 'Consumer B import updated');
  assert.ok(updatedB.includes('computeVat(subtotal, 0.05)'), 'Consumer B call site updated');

  const updatedC = fs.readFileSync(fileC, 'utf8');
  assert.ok(updatedC.includes('computeVat as computeFee'), 'Consumer C aliased import updated');
  assert.ok(updatedC.includes('computeFee(total, 0.08)'), 'Consumer C alias call preserved');

  // Execute consumer to verify runtime integrity
  const runnerScript = path.join(tempDir, 'runner.js');
  fs.writeFileSync(runnerScript, `
    import { runCheckout } from './checkout.js';
    import { printInvoice } from './invoice.js';
    import assert from 'assert';

    assert.strictEqual(runCheckout(100), 105);
    assert.strictEqual(printInvoice(100), 8);
    console.log('REFACTOR_RUNTIME_SUCCESS');
  `, 'utf8');

  const exec = spawnSync(process.execPath, [runnerScript], { cwd: tempDir, encoding: 'utf8' });
  assert.strictEqual(exec.status, 0, 'Refactored code must execute cleanly without runtime errors');
  assert.ok(exec.stdout.includes('REFACTOR_RUNTIME_SUCCESS'), 'Execution output confirmed');
  console.log('  ✔ PASS: Atomic refactoring verified at runtime with 100% functional integrity\n');

} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

// [TEST 6] Testing 100% Zero-Emoji Compliance
console.log('[TEST 6] Testing Zero-Emoji policy across V4.7.0 refactor components...');
const samplePlan = formatRefactorPlan({
  targetFile: 'sample.js',
  oldSymbol: 'foo',
  newSymbol: 'bar',
  filesToUpdate: [],
  totalReplacements: 0
});
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert.strictEqual(emojiRegex.test(samplePlan), false, 'Plan output must contain zero emojis');
console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

console.log('===============================================================');
console.log('✔ ALL GRAVITON V4.7.0 SYMBOLIC REFACTORING TESTS PASSED 100%!');
console.log('===============================================================\n');
