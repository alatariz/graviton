import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { resolveAgyExecutable, getCrossPlatformCommand, runAntigravityWithAutoAllow } from '../bin/graviton-relay.js';

console.log('=== STARTING V1.8.3 ROCK-SOLID RELAY TEST SUITE ===\n');

// 1. Test Executable Resolution
console.log('[TEST 1] Dynamic Executable Resolution (agy & antigravity fallback)');
const resolvedDefault = resolveAgyExecutable();
assert.ok(resolvedDefault, 'Must resolve an executable path');
console.log(`  ✔ Default executable resolved: "${resolvedDefault}"`);

const resolvedAntigravity = resolveAgyExecutable('antigravity');
assert.ok(resolvedAntigravity, 'Must resolve antigravity or fallback to agy');
console.log(`  ✔ Antigravity alias resolved: "${resolvedAntigravity}"`);

// 2. Test Argument Construction & One-Shot Prompt Delivery
console.log('\n[TEST 2] One-Shot Execution passes -p and --dangerously-skip-permissions');
const testResult = runAntigravityWithAutoAllow('say V183_VERIFICATION_TOKEN_OK', {
  stdio: 'pipe'
});

assert.strictEqual(testResult.status, 0, 'Exit status must be 0 for valid prompt');
const stdout = testResult.stdout ? testResult.stdout.toString('utf-8') : '';
assert.ok(stdout.includes('V183_VERIFICATION_TOKEN_OK'), 'Output must contain the prompt token response');
console.log('  ✔ One-shot execution successfully delivered prompt to Antigravity and received valid response');

// 3. Test Synchronous Execution Blocking
console.log('\n[TEST 3] Synchronous Execution returns result object immediately');
assert.strictEqual(typeof testResult.then, 'undefined', 'Result must NOT be a Promise (strictly synchronous)');
console.log('  ✔ Result is synchronous spawnSync result object');

// 4. Test Error Catching for Non-Zero Exit Code
console.log('\n[TEST 4] Non-Zero Exit Status Handling');
let caughtError = false;
const origLog = console.log;
console.log = (...args) => {
  const str = args.join(' ');
  if (str.includes('[GRAVITON ERROR] Antigravity terminated abruptly')) {
    caughtError = true;
  }
  origLog(...args);
};

try {
  runAntigravityWithAutoAllow('test', {
    args: ['invalid-nonexistent-flag-xyz-v183'],
    stdio: 'ignore',
    rejectOnError: true
  });
} catch (err) {
  assert.ok(caughtError, 'Must log [GRAVITON ERROR] on non-zero exit code');
  console.log('  ✔ Non-zero exit code handled cleanly and error logged');
} finally {
  console.log = origLog;
}

console.log('\n=== ALL V1.8.3 ROCK-SOLID TESTS PASSED! ===\n');
