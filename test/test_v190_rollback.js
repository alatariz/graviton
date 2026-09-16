// test/test_v190_rollback.js - Graviton V1.9.0 Safety Rollback Guard Test Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  captureWorkspaceSnapshot,
  saveSessionManifest,
  executeRollback,
  getBackupsDir
} from '../src/rollback-manager.js';

console.log('=== STARTING V1.9.0 ROLLBACK GUARD TEST SUITE ===\n');

const tempWorkspace = path.join(os.tmpdir(), 'graviton-test-rollback-' + Date.now());
fs.mkdirSync(tempWorkspace, { recursive: true });

try {
  // 1. Setup original files
  const fileA = path.join(tempWorkspace, 'index.html');
  const fileB = path.join(tempWorkspace, 'config.js');
  fs.writeFileSync(fileA, '<h1>Original Title</h1>', 'utf8');
  fs.writeFileSync(fileB, 'export const env = "production";', 'utf8');

  // Take initial snapshot
  const initialSnapshot = captureWorkspaceSnapshot(tempWorkspace);
  assert.ok(initialSnapshot.has('index.html'), 'Initial snapshot must include index.html');
  assert.ok(initialSnapshot.has('config.js'), 'Initial snapshot must include config.js');
  console.log('[TEST 1] Initial Snapshot Capture');
  console.log('  ✔ Snapshot accurately captured ' + initialSnapshot.size + ' workspace files');

  // 2. Simulate AI modification & shadow backup
  const backupsDir = getBackupsDir();
  const backupA = path.join(backupsDir, `index.html_test_${Date.now()}.bak`);
  fs.copyFileSync(fileA, backupA);

  // Now AI modifies fileA and creates a new unwanted fileC
  fs.writeFileSync(fileA, '<h1>Corrupted AI Title</h1>', 'utf8');
  const fileC = path.join(tempWorkspace, 'unwanted-created-by-ai.js');
  fs.writeFileSync(fileC, 'console.log("bad code");', 'utf8');

  // Save session manifest
  const backedUpFiles = [{ original: fileA, backup: backupA }];
  const manifest = saveSessionManifest(tempWorkspace, 'mock-session-v190', backedUpFiles, initialSnapshot);

  assert.strictEqual(manifest.modified.length, 1, 'Manifest must have 1 modified file');
  assert.strictEqual(manifest.created.length, 1, 'Manifest must have 1 created file');
  assert.ok(manifest.created[0].includes('unwanted-created-by-ai.js'), 'Created file must be identified');
  console.log('\n[TEST 2] Delta Detection & Manifest Generation');
  console.log('  ✔ Correctly detected modified: index.html and newly created: unwanted-created-by-ai.js');

  // 3. Execute Rollback
  console.log('\n[TEST 3] Execute Safety Rollback Guard');
  const rollbackResult = executeRollback(tempWorkspace);
  assert.strictEqual(rollbackResult.success, true, 'Rollback must succeed');
  assert.strictEqual(rollbackResult.restored.length, 1, 'Must restore 1 file');
  assert.strictEqual(rollbackResult.removed.length, 1, 'Must remove 1 file');

  // Verify file contents
  const restoredContent = fs.readFileSync(fileA, 'utf8');
  assert.strictEqual(restoredContent, '<h1>Original Title</h1>', 'index.html content must be restored exactly');
  assert.ok(!fs.existsSync(fileC), 'unwanted-created-by-ai.js must be completely removed from disk');

  console.log('  ✔ Modified file content restored to 100% original state');
  console.log('  ✔ Newly created file safely deleted from disk');
  console.log('  ✔ Rollback report: ' + rollbackResult.message);

  // 4. Test Second Undo on Clean State returns graceful message
  console.log('\n[TEST 4] Subsequent Rollback on clean state');
  const secondRollback = executeRollback(tempWorkspace);
  assert.strictEqual(secondRollback.success, false, 'Second rollback should report nothing to rollback');
  console.log('  ✔ Handled cleanly without errors: ' + secondRollback.message);

  console.log('\n=== ALL V1.9.0 ROLLBACK GUARD TESTS PASSED! ===\n');
} finally {
  try {
    fs.rmSync(tempWorkspace, { recursive: true, force: true });
  } catch {}
}
