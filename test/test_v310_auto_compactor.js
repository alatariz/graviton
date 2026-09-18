// test/test_v310_auto_compactor.js - Graviton V3.10.0 Autonomous Auto-Compactor & Continuity Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  trackSessionTurn,
  checkCompactionStatus,
  checkAndApplySlidingWindow,
  autoCompactSessionIfExceeded,
  getCompactMemoryDirective,
  AUTONOMOUS_COMPACT_THRESHOLD,
  SLIDING_WINDOW_SIZE,
  STANDARD_TOKEN_LIMIT
} from '../src/session-compactor.js';

console.log('=== STARTING GRAVITON V3.10.0 AUTONOMOUS AUTO-COMPACTOR TEST SUITE ===\n');

const testDir = path.join(os.tmpdir(), 'graviton_v310_compactor_test_' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

try {
  // [TEST 1] Verify Standard Limits Constants
  console.log('[TEST 1] Standard Limits Constants verification');
  assert.strictEqual(AUTONOMOUS_COMPACT_THRESHOLD, 6, 'Standard turn threshold must be 6');
  assert.strictEqual(SLIDING_WINDOW_SIZE, 4, 'Standard sliding window must be 4');
  assert.strictEqual(STANDARD_TOKEN_LIMIT, 25000, 'Standard token limit must be 25,000');
  console.log('  ✔ Standard limits verified: 6 turns, 25k tokens, 4 sliding window turns');

  // [TEST 2] Turn Tracking with Prompts History
  console.log('\n[TEST 2] trackSessionTurn records promptsHistory for high-fidelity continuity');
  trackSessionTurn(testDir, 2000, ['index.html'], 'buatkan game minecraft voxel 3d');
  trackSessionTurn(testDir, 3000, ['game.js'], 'tambahkan zombie dan skeleton mobs');

  const s1 = JSON.parse(fs.readFileSync(path.join(testDir, '.graviton-session'), 'utf8'));
  assert.strictEqual(s1.turns, 2);
  assert.strictEqual(s1.cumulativeTokens, 5000);
  assert.deepStrictEqual(s1.promptsHistory, [
    'buatkan game minecraft voxel 3d',
    'tambahkan zombie dan skeleton mobs'
  ]);
  console.log('  ✔ Turn prompts safely recorded in promptsHistory');

  // [TEST 3] Under Standard Threshold: No Compaction
  console.log('\n[TEST 3] autoCompactSessionIfExceeded does nothing under threshold');
  const underCheck = autoCompactSessionIfExceeded(testDir);
  assert.strictEqual(underCheck.autoCompacted, false);
  assert.strictEqual(underCheck.turnsCompacted, 0);
  console.log('  ✔ Under-threshold sessions continue untouched');

  // [TEST 4] Reach Standard Limit of 6 Turns: Autonomous Auto-Compaction
  console.log('\n[TEST 4] Reaching 6 turns automatically executes sliding-window compaction');
  trackSessionTurn(testDir, 4000, ['audio.js'], 'tambahkan block break sound effect');
  trackSessionTurn(testDir, 4000, ['inventory.js'], 'buatkan inventory hotbar 9 slot');
  trackSessionTurn(testDir, 4000, ['style.css'], 'tambahkan custom crosshair HUD');
  trackSessionTurn(testDir, 4000, ['world.js'], 'tambahkan day night cycle');

  // Now turns = 6
  const s2 = JSON.parse(fs.readFileSync(path.join(testDir, '.graviton-session'), 'utf8'));
  assert.strictEqual(s2.turns, 6);

  const autoResult = autoCompactSessionIfExceeded(testDir);
  assert.strictEqual(autoResult.autoCompacted, true, 'Must auto-compact at standard limit');
  assert.strictEqual(autoResult.turnsCompacted, 2, 'Must compact 6 - 4 = 2 turns');
  assert.strictEqual(autoResult.activeTurns, 4, 'Sliding window must retain 4 active turns');
  assert.ok(autoResult.tokensSavedEstimate > 0, 'Tokens saved must be > 0');
  assert.ok(autoResult.message.includes('[GRAVITON AUTO-COMPACTOR]'), 'Must include auto-compactor badge');
  assert.ok(autoResult.message.includes('Standard limit reached'), 'Must mention standard limit');
  console.log('  ✔ Autonomous compaction executed silently and automatically without user intervention');

  // [TEST 5] Project Continuity Verification
  console.log('\n[TEST 5] Project continuity directive and assets injected into memory');
  const memoryDirective = getCompactMemoryDirective(testDir);
  assert.ok(memoryDirective, 'Memory directive must exist');
  assert.ok(memoryDirective.includes('Earlier Context Milestones'), 'Must summarize earlier milestones');
  assert.ok(memoryDirective.includes('buatkan game minecraft voxel 3d'), 'Must preserve turn 1 goal in milestone summary');
  assert.ok(memoryDirective.includes('[PROJECT WORKING ASSETS]'), 'Must include working assets tag');
  assert.ok(memoryDirective.includes('index.html'), 'Must track index.html');
  assert.ok(memoryDirective.includes('game.js'), 'Must track game.js');
  assert.ok(memoryDirective.includes('[PROJECT CONTINUITY DIRECTIVE]'), 'Must include continuity directive for Gemini');
  console.log('  ✔ Complete project context and assets preserved for seamless continuation');

  // [TEST 6] Token Limit Trigger (Exceeding 25,000 tokens)
  console.log('\n[TEST 6] Heavy token usage (>25,000 tokens) triggers autonomous compaction');
  const heavyDir = path.join(os.tmpdir(), 'graviton_heavy_tokens_test_' + Date.now());
  fs.mkdirSync(heavyDir, { recursive: true });

  // Track 5 turns with heavy token payloads (6,000 tokens each = 30,000 tokens)
  for (let i = 0; i < 5; i++) {
    trackSessionTurn(heavyDir, 6000, ['heavy_' + i + '.js'], 'heavy task ' + i);
  }

  const tokenResult = autoCompactSessionIfExceeded(heavyDir);
  assert.strictEqual(tokenResult.autoCompacted, true, 'Must auto-compact when tokens >= 25,000');
  assert.strictEqual(tokenResult.activeTurns, 4);
  console.log('  ✔ Token ceiling violation autonomously compacted before hitting API limits');

  try {
    fs.rmSync(heavyDir, { recursive: true, force: true });
  } catch {}

} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}

console.log('\n=== ALL GRAVITON V3.10.0 AUTO-COMPACTOR TESTS PASSED 100%! ===\n');
