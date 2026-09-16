/**
 * Graviton V2.0.0 Smart Session Compactor Test Suite
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  trackSessionTurn,
  checkCompactionStatus,
  compactWorkspaceSession,
  getCompactMemoryDirective
} from '../src/session-compactor.js';
import { saveWorkspaceSession, getWorkspaceSession } from '../src/session-manager.js';

async function runTests() {
  console.log('=== STARTING V2.0.0 SESSION COMPACTOR TEST SUITE ===\n');

  const testDir = path.join(os.tmpdir(), 'graviton_v200_compactor_test_' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  // [TEST 1] Session Turn Tracking & Token Accumulation
  console.log('[TEST 1] Turn Tracking & Token Accumulation');
  const session1 = trackSessionTurn(testDir, 5000, ['src/app.js']);
  assert.strictEqual(session1.turns, 1, 'Turns should be 1');
  assert.strictEqual(session1.cumulativeTokens, 5000, 'Tokens should be 5000');
  assert.deepStrictEqual(session1.touchedFilesHistory, ['src/app.js']);

  const session2 = trackSessionTurn(testDir, 7000, ['src/api.js']);
  assert.strictEqual(session2.turns, 2, 'Turns should increment to 2');
  assert.strictEqual(session2.cumulativeTokens, 12000, 'Tokens should accumulate to 12000');
  assert.strictEqual(session2.touchedFilesHistory.length, 2);
  console.log('  ✔ Turns and cumulative tokens tracked accurately');

  // [TEST 2] Compaction Threshold Detection
  console.log('\n[TEST 2] Compaction Threshold Advisory');
  const normalStatus = checkCompactionStatus(testDir);
  assert.strictEqual(normalStatus.advise, false, 'Should not advise compaction for short sessions');

  // Simulate 8 turns
  for (let i = 0; i < 6; i++) {
    trackSessionTurn(testDir, 10000, ['src/component_' + i + '.js']);
  }
  const advisedStatus = checkCompactionStatus(testDir);
  assert.strictEqual(advisedStatus.advise, true, 'Should advise compaction after 8 turns');
  assert.strictEqual(advisedStatus.turns, 8, 'Turns should be 8');
  assert.ok(advisedStatus.message.includes('graviton compact'), 'Message should advise running graviton compact');
  console.log('  ✔ Correctly triggered compaction advisory at threshold');

  // [TEST 3] Execute Session Compaction
  console.log('\n[TEST 3] Execute Session Compaction');
  const compactResult = compactWorkspaceSession(testDir);
  assert.strictEqual(compactResult.success, true, 'Compaction should succeed');
  
  // Verify session was cleared
  const clearedSession = getWorkspaceSession(testDir);
  assert.strictEqual(clearedSession, null, 'Active conversation ID should be cleared on compaction');

  // Verify compact memory file was written
  const memoryDirective = getCompactMemoryDirective(testDir);
  assert.ok(memoryDirective, 'Compact memory directive should exist');
  assert.ok(memoryDirective.includes('GRAVITON PERSISTED COMPACT MEMORY'), 'Directive should have header');
  assert.ok(memoryDirective.includes('src/app.js'), 'Memory should preserve touched files');
  console.log('  ✔ Compaction cleanly reset session while preserving memory directive');

  // Clean up
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  console.log('\n=== ALL V2.0.0 SESSION COMPACTOR TESTS PASSED! ===\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
