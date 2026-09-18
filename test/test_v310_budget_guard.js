// test/test_v310_budget_guard.js - Graviton V3.1.0 Pre-Flight Budget Guard & Dry-Run Suite
import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseBudgetLimit,
  calculatePreFlightWeight,
  formatPreFlightReport,
  checkBudgetViolation
} from '../src/budget-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('=== STARTING GRAVITON V3.1.0 BUDGET GUARD & DRY-RUN TEST SUITE ===\n');

// 1. Test Budget String Parsing
console.log('[TEST 1] Budget string parser (k, m, raw numbers)');
assert.strictEqual(parseBudgetLimit('15k'), 15000);
assert.strictEqual(parseBudgetLimit('15K'), 15000);
assert.strictEqual(parseBudgetLimit('2.5k'), 2500);
assert.strictEqual(parseBudgetLimit('1m'), 1000000);
assert.strictEqual(parseBudgetLimit('1.5M'), 1500000);
assert.strictEqual(parseBudgetLimit('25000'), 25000);
assert.strictEqual(parseBudgetLimit(30000), 30000);
assert.strictEqual(parseBudgetLimit('invalid'), null);
assert.strictEqual(parseBudgetLimit(''), null);
assert.strictEqual(parseBudgetLimit(null), null);
console.log('  ✔ All budget string representations parsed accurately');

// 2. Test calculatePreFlightWeight
console.log('\n[TEST 2] calculatePreFlightWeight on workspace files');
const weight = calculatePreFlightWeight('check server in package.json', projectRoot, {
  budgetLimit: '20k'
});

assert.ok(weight.promptTokens > 0, 'Prompt tokens must be > 0');
assert.ok(weight.superPromptTokens > 0, 'SuperPrompt overhead must be calculated');
assert.ok(Array.isArray(weight.targetFiles), 'Target files must be an array');
assert.ok(weight.totalEstimatedTokens > 0, 'Total estimated tokens must be > 0');
assert.strictEqual(weight.budgetLimit, 20000, 'Budget limit must be 20,000');
assert.strictEqual(weight.isWithinBudget, true, 'Turn must be within 20k budget');
console.log('  ✔ Pre-flight context weight computed correctly');

// 3. Test formatPreFlightReport
console.log('\n[TEST 3] formatPreFlightReport terminal formatting');
const report = formatPreFlightReport(weight);
assert.ok(report.includes('GRAVITON PRE-FLIGHT CONTEXT & BUDGET INSPECTOR'), 'Report must contain header');
assert.ok(report.includes('Total Estimated Turn'), 'Report must contain total estimated turn');
assert.ok(report.includes('WITHIN BUDGET'), 'Report must indicate budget status');
console.log('  ✔ Pre-flight inspection report formatted cleanly');

// 4. Test checkBudgetViolation
console.log('\n[TEST 4] checkBudgetViolation logic');
const passCheck = checkBudgetViolation(5000, '10k');
assert.strictEqual(passCheck.violated, false, '5k is within 10k budget');

const failCheck = checkBudgetViolation(15000, '10k');
assert.strictEqual(failCheck.violated, true, '15k violates 10k budget');
assert.strictEqual(failCheck.excess, 5000, 'Excess must be 5k');
assert.ok(failCheck.message.includes('exceeds budget limit'), 'Message must explain violation');

const unbudgetedCheck = checkBudgetViolation(15000, null);
assert.strictEqual(unbudgetedCheck.violated, false, 'Unbounded budget never violates');
console.log('  ✔ Budget violations correctly detected');

console.log('\n=== ALL BUDGET GUARD & DRY-RUN TESTS PASSED 100%! ===\n');
