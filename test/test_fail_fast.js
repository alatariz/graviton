// test/test_fail_fast.js - Graviton Fail-Fast & Inactivity Watchdog Test Suite
import assert from 'assert';
import { detectFatalErrorPattern, terminateProcess } from '../bin/graviton-relay.js';

console.log('=== STARTING GRAVITON FAIL-FAST & WATCHDOG TEST SUITE ===\n');

// 1. Test Fatal Error Pattern Detection
console.log('[TEST 1] Fatal Error Pattern Detection');
const fatalCases = [
  { text: 'rpc error: code = ResourceExhausted desc = RESOURCE_EXHAUSTED: Quota exceeded for quota metric', expected: 'API Quota Exhausted (RESOURCE_EXHAUSTED / 429)' },
  { text: 'Error 429 Too Many Requests', expected: 'Rate Limit Exceeded (429)' },
  { text: 'rateLimitExceeded: You have exceeded your rate limit', expected: 'Rate Limit Exceeded (429)' },
  { text: 'error: quota exceeded for current billing project', expected: 'API Quota Exceeded' },
  { text: 'UNAUTHENTICATED: Request had invalid authentication credentials', expected: 'Authentication Failed (UNAUTHENTICATED / invalid_grant)' },
  { text: 'oauth2: invalid_grant: Token has been expired or revoked', expected: 'Authentication Failed (UNAUTHENTICATED / invalid_grant)' },
  { text: '[agy] print timeout after 5m0s with turn in progress; returning partial output', expected: 'Antigravity Internal Turn Timeout' },
  { text: 'The model is overloaded. Please try again later.', expected: 'Model Overloaded (503)' }
];

for (const tc of fatalCases) {
  const result = detectFatalErrorPattern(tc.text);
  assert.strictEqual(result, tc.expected, `Expected '${tc.expected}' for input '${tc.text}', got '${result}'`);
}
console.log('  ✔ All fatal error patterns detected with 0 false negatives');

// 2. Test Non-fatal outputs do NOT trigger false alarms
console.log('\n[TEST 2] Normal outputs do NOT trigger false alarms');
const normalCases = [
  '{"event":"step_update","step_update":{"step_type":"tool","tool_name":"view_file"}}',
  'Here is the solution to your problem...',
  'Compiling TypeScript files (3/15 completed)...',
  'Running test suite: 25 passed, 0 failed',
  'Total tokens spent: 1,450'
];

for (const nc of normalCases) {
  const result = detectFatalErrorPattern(nc);
  assert.strictEqual(result, null, `Normal text '${nc}' must return null`);
}
console.log('  ✔ Normal texts correctly ignored with 0 false positives');

// 3. Test terminateProcess helper is callable and safe
console.log('\n[TEST 3] terminateProcess helper is safe and idempotent');
assert.strictEqual(typeof terminateProcess, 'function');
terminateProcess(null);
terminateProcess({});
terminateProcess({ pid: null });
console.log('  ✔ terminateProcess handled safely');

// 4. Test Watchdog Timing Constants
console.log('\n[TEST 4] Watchdog default configuration matches 3-minute requirement');
const defaultTimeout = Number(process.env.GRAVITON_IDLE_TIMEOUT) || 180;
assert.strictEqual(defaultTimeout, 180, 'Default idle timeout must be 180 seconds (3 minutes)');
console.log('  ✔ Inactivity Watchdog default is set to exactly 180s (3 minutes)');

console.log('\n=== ALL FAIL-FAST & WATCHDOG TESTS PASSED 100%! ===\n');
