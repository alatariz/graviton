import assert from 'assert';
import { runAntigravityWithAutoAllow } from '../bin/graviton-relay.js';

console.log('=== STARTING NUCLEAR SYNCHRONOUS RELAY TEST SUITE ===\n');

// 1. Test Synchronous Execution without Promise
console.log('[TEST 1] Synchronous Execution returns result object immediately');
const result = runAntigravityWithAutoAllow('test', {
  args: ['--version'],
  stdio: 'ignore'
});

assert.ok(result && typeof result === 'object', 'Result must be an object from spawnSync');
assert.strictEqual(typeof result.then, 'undefined', 'Result must NOT be a Promise (strictly synchronous)');
assert.strictEqual(result.status, 0, 'Exit status must be 0 for --version');
console.log('  ✔  Function executed completely synchronously, returned status 0 without any Promise');

// 2. Test Error Checking & Non-Zero Exit Code
console.log('\n[TEST 2] Non-zero status handling');
let loggedError = false;
const origLog = console.log;
console.log = (...args) => {
  const str = args.join(' ');
  if (str.includes('[GRAVITON ERROR] Antigravity terminated abruptly with exit code')) {
    loggedError = true;
  }
  origLog(...args);
};

try {
  runAntigravityWithAutoAllow('test', {
    args: ['invalid-nonexistent-flag-xyz'],
    stdio: 'ignore',
    rejectOnError: true
  });
} catch (err) {
  assert.ok(loggedError, 'Must log [GRAVITON ERROR] on non-zero exit code');
  console.log('  ✔  Non-zero exit code handled cleanly');
} finally {
  console.log = origLog;
}

console.log('\n=== ALL NUCLEAR SYNCHRONOUS TESTS PASSED! ===\n');
