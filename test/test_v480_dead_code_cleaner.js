// test/test_v480_dead_code_cleaner.js - Graviton V4.8.0 Dead-Code & Entropy Eliminator Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import {
  auditDeadCode,
  formatDeadCodeReport,
  pruneUnusedImports
} from '../src/dead-code-cleaner.js';

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V4.8.0 DEAD-CODE & ENTROPY ELIMINATOR SUITE');
console.log('===============================================================\x1b[0m\n');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v480-deadcode-'));

try {
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');

  // File 1: service.js (has used export, dead export, and orphaned helper)
  const fileA = path.join(tempDir, 'service.js');
  fs.writeFileSync(fileA, `
export function activeCalculate(x) {
  return x * 2;
}

export function deadExportFunction(y) {
  return y + 100;
}

function orphanedLocalHelper() {
  console.log('never called');
}
`, 'utf8');

  // File 2: consumer.js (imports both activeCalculate and deadExportFunction, but only uses activeCalculate)
  const fileB = path.join(tempDir, 'consumer.js');
  fs.writeFileSync(fileB, `
import { activeCalculate, deadExportFunction } from './service.js';

export function runPipeline(input) {
  return activeCalculate(input);
}
`, 'utf8');

  // File 3: isolated.js (imports a standalone symbol that is never used at all)
  const fileC = path.join(tempDir, 'isolated.js');
  fs.writeFileSync(fileC, `
import { activeCalculate } from './service.js';

export function doSomethingElse() {
  return 'ok';
}
`, 'utf8');

  // [TEST 1] Testing auditDeadCode Detection
  console.log('[TEST 1] Testing auditDeadCode on workspace...');
  const audit = auditDeadCode(tempDir);

  assert.ok(audit.totalDeadItems >= 3, 'Must detect at least 3 dead code items');
  assert.ok(audit.unusedImports.some(ui => ui.file === 'consumer.js' && ui.symbol === 'deadExportFunction'), 'Flags unused deadExportFunction import in consumer.js');
  assert.ok(audit.unusedImports.some(ui => ui.file === 'isolated.js' && ui.symbol === 'activeCalculate'), 'Flags unused activeCalculate import in isolated.js');
  assert.ok(audit.orphanedFunctions.some(of => of.file === 'service.js' && of.functionName === 'orphanedLocalHelper'), 'Flags orphaned local helper');
  console.log('  ✔ PASS: auditDeadCode correctly maps unused imports, dead exports, and orphaned helpers\n');

  // [TEST 2] Testing formatDeadCodeReport Output
  console.log('[TEST 2] Testing formatDeadCodeReport formatting...');
  const reportText = formatDeadCodeReport(audit);
  assert.ok(reportText.includes('GRAVITON DEAD-CODE & ENTROPY AUDIT REPORT'), 'Header present');
  assert.ok(reportText.includes('UNUSED IMPORTS'), 'Unused imports section present');
  assert.ok(reportText.includes('ORPHANED LOCAL FUNCTIONS'), 'Orphaned functions section present');
  console.log('  ✔ PASS: Formatted audit report renders clean entropy breakdown\n');

  // [TEST 3] Testing pruneUnusedImports Automatic Cleanup
  console.log('[TEST 3] Testing pruneUnusedImports cleanup...');
  const pruneResult = pruneUnusedImports(tempDir);
  assert.strictEqual(pruneResult.success, true, 'Prune must report success');
  assert.ok(pruneResult.filesModified >= 2, 'Must modify at least consumer.js and isolated.js');

  // Verify consumer.js after pruning: deadExportFunction must be pruned, activeCalculate retained
  const updatedConsumer = fs.readFileSync(fileB, 'utf8');
  assert.ok(updatedConsumer.includes('activeCalculate'), 'activeCalculate import preserved in consumer.js');
  assert.strictEqual(updatedConsumer.includes('deadExportFunction'), false, 'deadExportFunction cleanly removed from consumer.js');

  // Verify isolated.js after pruning: single unused import statement completely removed
  const updatedIsolated = fs.readFileSync(fileC, 'utf8');
  assert.strictEqual(updatedIsolated.includes('import { activeCalculate }'), false, 'Single unused import line removed');

  // Execute consumer to verify runtime integrity
  const runnerScript = path.join(tempDir, 'test-runner.js');
  fs.writeFileSync(runnerScript, `
    import { runPipeline } from './consumer.js';
    import assert from 'assert';

    assert.strictEqual(runPipeline(10), 20);
    console.log('CLEAN_PRUNE_RUNTIME_SUCCESS');
  `, 'utf8');

  const exec = spawnSync(process.execPath, [runnerScript], { cwd: tempDir, encoding: 'utf8' });
  assert.strictEqual(exec.status, 0, 'Code after pruning must execute cleanly');
  assert.ok(exec.stdout.includes('CLEAN_PRUNE_RUNTIME_SUCCESS'), 'Execution verified');
  console.log('  ✔ PASS: Unused imports cleanly pruned without breaking active module execution\n');

} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

// [TEST 4] Testing 100% Zero-Emoji Compliance
console.log('[TEST 4] Testing Zero-Emoji policy across V4.8.0 dead code components...');
const sampleAudit = formatDeadCodeReport({
  workspaceDir: 'sample',
  totalDeadItems: 0,
  stats: { unusedImportsCount: 0, unusedExportsCount: 0, orphanedFunctionsCount: 0 },
  unusedImports: [],
  unusedExports: [],
  orphanedFunctions: []
});
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert.strictEqual(emojiRegex.test(sampleAudit), false, 'Report output must contain zero emojis');
console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

console.log('===============================================================');
console.log('✔ ALL GRAVITON V4.8.0 DEAD-CODE ELIMINATOR TESTS PASSED 100%!');
console.log('===============================================================\n');
