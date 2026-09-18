// test/test_v320_sliding_window.js - Graviton V3.2.0 Autonomous Sliding-Window Compactor Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  distillPastTurns,
  checkAndApplySlidingWindow,
  getCompactMemoryDirective,
  trackSessionTurn,
  SLIDING_WINDOW_SIZE,
  AUTONOMOUS_COMPACT_THRESHOLD
} from '../src/session-compactor.js';

console.log('=== STARTING GRAVITON V3.2.0 AUTONOMOUS SLIDING-WINDOW TEST SUITE ===\n');

const testDir = path.join(os.tmpdir(), 'graviton_v320_sliding_test_' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

// 1. Test distillPastTurns
console.log('[TEST 1] distillPastTurns summarizes turns into high-density memory');
const mockTurns = [
  { role: 'user', text: 'Initialize express server with CORS and dotenv' },
  { role: 'user', text: 'Create user registration endpoint in auth.js with bcrypt hashing' },
  { role: 'user', text: 'Fix json parsing middleware in server.js' },
  { role: 'user', text: 'Add unit tests for registration route in auth.test.js' }
];
const touched = ['server.js', 'auth.js', 'auth.test.js'];

const distilled = distillPastTurns(mockTurns, touched);
assert.ok(distilled.includes('Earlier Context Milestones (4 turns)'), 'Must include milestones header');
assert.ok(distilled.includes('Initialize express server'), 'Must include turn 1 summary');
assert.ok(distilled.includes('Key Files Modified: server.js, auth.js, auth.test.js'), 'Must include files summary');
console.log('  ✔ distillPastTurns creates structured, clean summary');

// 2. Test checkAndApplySlidingWindow under threshold
console.log('\n[TEST 2] Under threshold (e.g. 2 turns) does not compact');
trackSessionTurn(testDir, 4000, ['server.js']);
trackSessionTurn(testDir, 5000, ['auth.js']);

const underResult = checkAndApplySlidingWindow(testDir);
assert.strictEqual(underResult.autoCompacted, false, 'Must not auto-compact under threshold');
assert.strictEqual(underResult.turnsCompacted, 0);
console.log('  ✔ Short sessions pass through untouched');

// 3. Test checkAndApplySlidingWindow over threshold (e.g. 6 turns with window size 4)
console.log('\n[TEST 3] Over threshold auto-compacts older turns');
// Add 4 more turns to reach 6 turns total
for (let i = 0; i < 4; i++) {
  trackSessionTurn(testDir, 6000, ['route_' + i + '.js']);
}

const overResult = checkAndApplySlidingWindow(testDir, null, {
  threshold: 5,
  windowSize: 4
});

assert.strictEqual(overResult.autoCompacted, true, 'Must auto-compact when turns >= 5');
assert.strictEqual(overResult.turnsCompacted, 2, 'Must compact 6 - 4 = 2 turns');
assert.strictEqual(overResult.activeTurns, 4, 'Active window must be set to 4');
assert.ok(overResult.tokensSavedEstimate > 0, 'Tokens saved must be > 0');

// Verify .graviton-session turns counter was slid down to 4
const sessionData = JSON.parse(fs.readFileSync(path.join(testDir, '.graviton-session'), 'utf8'));
assert.strictEqual(sessionData.turns, 4, 'Session turns counter must be adjusted to window size (4)');
assert.ok(sessionData.lastSlidingCompactionAt, 'Compaction timestamp must be recorded');

// Verify .graviton-compact-memory.json was written with slidingWindowActive: true
const memoryDirective = getCompactMemoryDirective(testDir);
assert.ok(memoryDirective && memoryDirective.includes('Autonomous Sliding Window: Active'), 'Directive must include sliding window tag');
assert.ok(memoryDirective.includes('Earlier Context Milestones'), 'Directive must include distilled memo');
console.log('  ✔ Sliding window automatically engaged, adjusted turns, and saved persisted memory');

// Clean up
try {
  fs.rmSync(testDir, { recursive: true, force: true });
} catch {}

console.log('\n=== ALL AUTONOMOUS SLIDING-WINDOW TESTS PASSED 100%! ===\n');
