// test/test_v314_granular_undo_and_model_fix.js - Graviton V3.14.0 Granular Undo & Model Resolution Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { resolveModelAndEffort } from '../src/model-selector.js';
import { cleanTerminalOutput } from '../bin/graviton-relay.js';
import {
  captureWorkspaceSnapshot,
  saveSessionManifest,
  executeRollback,
  listRollbackItems,
  getBackupsDir
} from '../src/rollback-manager.js';

console.log('===============================================================');
console.log('   GRAVITON V3.14.0 GRANULAR UNDO & MODEL RESOLUTION TEST SUITE');
console.log('===============================================================\n');

async function runTests() {
  // [TEST 1] Safe Model & Effort Resolution for Antigravity CLI
  console.log('[TEST 1] Testing baseModel & agyEffort compatibility mapping...');
  
  // Pro tier with direct command (medium effort requested by user)
  const proDirect = resolveModelAndEffort({ prompt: 'buatkan game voxel 3d minecraft three.js' });
  assert.strictEqual(proDirect.tier, 'pro');
  assert.strictEqual(proDirect.effort, 'medium', 'User-facing effort should be medium');
  assert.strictEqual(proDirect.baseModel, 'gemini-3.1-pro', 'Base model must be clean gemini-3.1-pro');
  assert.strictEqual(proDirect.agyEffort, 'high', 'Pro medium effort must map to high for agy compatibility');

  // Pro tier with fast command (-f -> low)
  const proFast = resolveModelAndEffort({ isFast: true, prompt: 'buatkan game 3d physics' });
  assert.strictEqual(proFast.effort, 'low');
  assert.strictEqual(proFast.baseModel, 'gemini-3.1-pro');
  assert.strictEqual(proFast.agyEffort, 'low');

  // Flash tier with direct command (medium effort)
  const flashDirect = resolveModelAndEffort({ prompt: 'perbaiki typo di README.md' });
  assert.strictEqual(flashDirect.tier, 'flash');
  assert.strictEqual(flashDirect.effort, 'medium');
  assert.strictEqual(flashDirect.baseModel, 'gemini-3.8-flash');
  assert.strictEqual(flashDirect.agyEffort, 'medium');

  // Flash tier with fast command (-f -> low)
  const flashFast = resolveModelAndEffort({ isFast: true, prompt: 'ganti warna border menjadi biru' });
  assert.strictEqual(flashFast.effort, 'low');
  assert.strictEqual(flashFast.baseModel, 'gemini-3.8-flash');
  assert.strictEqual(flashFast.agyEffort, 'low');

  console.log('  ✔ PASS: Base model and effort resolution prevents agy command line conflicts\n');

  // [TEST 2] Terminal Output Cleansing: Asterisks, Hashes, and Approval Requests
  console.log('[TEST 2] Testing cleanTerminalOutput formatting & approval removal...');

  const sampleRawOutput = [
    '# Implementation Plan',
    'Modifying **excel/buka_aplikasi.bat** and **excel/css/styles.css**.',
    '### Action Items',
    '- Updated __config.json__ with proper settings.',
    'AWAITING USER APPROVAL TO EXECUTE MODIFICATIONS ON TARGET SCOPE',
    'SUMMARY OF ACTIONABLE DECISIONS Please review the implementation plan and approve to proceed with execution',
    'Please review the implementation plan and approve to proceed',
    'Sure! Here is the completed execution.'
  ].join('\n');

  const cleaned = cleanTerminalOutput(sampleRawOutput);

  // Must not have ** or __
  assert.ok(!cleaned.includes('**'), 'Cleaned output must not contain **');
  assert.ok(!cleaned.includes('__'), 'Cleaned output must not contain __');
  assert.ok(cleaned.includes('excel/buka_aplikasi.bat'), 'File path preserved without bold markers');
  assert.ok(cleaned.includes('excel/css/styles.css'), 'File path preserved without bold markers');

  // Must not have # headers
  assert.ok(!cleaned.includes('# Implementation Plan'), 'Cleaned output must strip header #');
  assert.ok(cleaned.includes('Implementation Plan'), 'Header text preserved as clean text');

  // Must not have approval requests
  assert.ok(!cleaned.includes('AWAITING USER APPROVAL'), 'Approval request line must be completely stripped');
  assert.ok(!cleaned.includes('SUMMARY OF ACTIONABLE DECISIONS'), 'Actionable decisions request line must be completely stripped');
  assert.ok(!cleaned.includes('Please review the implementation plan'), 'Review prompt must be completely stripped');

  console.log('  ✔ PASS: Raw Markdown asterisks, hashes, and approval prompts stripped cleanly\n');

  // [TEST 3] Granular Rollback Per Point (e.g. grav --undo 1, 2)
  console.log('[TEST 3] Testing selective granular rollback by item indices...');

  const tempWorkspace = path.join(os.tmpdir(), 'graviton-test-granular-' + Date.now());
  fs.mkdirSync(tempWorkspace, { recursive: true });

  try {
    const file1 = path.join(tempWorkspace, 'app.js');
    const file2 = path.join(tempWorkspace, 'styles.css');
    fs.writeFileSync(file1, 'console.log("original app");', 'utf8');
    fs.writeFileSync(file2, 'body { color: black; }', 'utf8');

    const initialSnapshot = captureWorkspaceSnapshot(tempWorkspace);

    // AI modifies file1 and file2, and creates file3
    const backupsDir = getBackupsDir();
    const backup1 = path.join(backupsDir, `app_${Date.now()}.bak`);
    const backup2 = path.join(backupsDir, `styles_${Date.now()}.bak`);
    fs.copyFileSync(file1, backup1);
    fs.copyFileSync(file2, backup2);

    fs.writeFileSync(file1, 'console.log("corrupted app");', 'utf8');
    fs.writeFileSync(file2, 'body { color: red; }', 'utf8');
    const file3 = path.join(tempWorkspace, 'new-file.js');
    fs.writeFileSync(file3, 'console.log("unwanted");', 'utf8');

    // Save session manifest
    const backedUpFiles = [
      { original: file1, backup: backup1 },
      { original: file2, backup: backup2 }
    ];
    saveSessionManifest(tempWorkspace, 'test-granular-session', backedUpFiles, initialSnapshot);

    // 3a. List items
    const items = listRollbackItems(tempWorkspace);
    assert.strictEqual(items.length, 3, 'Must list 3 items (2 modified, 1 created)');
    assert.strictEqual(items[0].id, 1);
    assert.strictEqual(items[1].id, 2);
    assert.strictEqual(items[2].id, 3);
    console.log('  ✔ Listed 3 rollback items with 1-based IDs');

    // 3b. Selectively rollback items 1 and 3 (app.js and new-file.js), leave item 2 (styles.css)
    const partialRes = executeRollback(tempWorkspace, [1, 3]);
    assert.strictEqual(partialRes.success, true);
    assert.strictEqual(partialRes.restored.length, 1, 'Restored 1 file (app.js)');
    assert.strictEqual(partialRes.removed.length, 1, 'Removed 1 file (new-file.js)');
    assert.strictEqual(partialRes.remainingCount, 1, '1 file must remain in manifest');

    // Verify app.js is restored, new-file.js is deleted, but styles.css is still modified
    assert.strictEqual(fs.readFileSync(file1, 'utf8'), 'console.log("original app");');
    assert.ok(!fs.existsSync(file3), 'new-file.js must be deleted');
    assert.strictEqual(fs.readFileSync(file2, 'utf8'), 'body { color: red; }', 'styles.css must still be in modified state');
    console.log('  ✔ Selective rollback [1, 3] restored app.js and deleted new-file.js, leaving styles.css');

    // 3c. Subsequent rollback of remaining item (styles.css)
    const remainingItems = listRollbackItems(tempWorkspace);
    assert.strictEqual(remainingItems.length, 1, 'Manifest must have 1 remaining item');
    assert.strictEqual(remainingItems[0].path, 'styles.css');

    const finalRes = executeRollback(tempWorkspace, [1]);
    assert.strictEqual(finalRes.success, true);
    assert.strictEqual(finalRes.remainingCount, 0, 'No files remaining in manifest');
    assert.strictEqual(fs.readFileSync(file2, 'utf8'), 'body { color: black; }', 'styles.css restored');
    assert.strictEqual(listRollbackItems(tempWorkspace).length, 0, 'Manifest cleared');
    console.log('  ✔ Final selective rollback restored styles.css and cleanly cleared manifest');

  } finally {
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch {}
  }

  console.log('\n---------------------------------------------------------------');
  console.log('✔ ALL GRAVITON V3.14.0 GRANULAR UNDO & MODEL RESOLUTION TESTS PASSED 100%!');
  console.log('---------------------------------------------------------------\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
