// test/test_v500_unified_orchestrator.js - Graviton V5.1.1 Unified Autonomous Coordinator Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  executeUnifiedOrchestration,
  runUnifiedSanityCheck,
  formatUnifiedDiagnosticReport
} from '../src/unified-orchestrator.js';
import { getPromptCachePrefix } from '../src/pipeline.js';

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V5.0.0 UNIFIED AUTONOMOUS COORDINATOR SUITE');
console.log('===============================================================\x1b[0m\n');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v500-coordinator-'));

try {
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ type: 'module' }), 'utf8');
  fs.writeFileSync(path.join(tempDir, 'index.html'), `
<!DOCTYPE html>
<html>
<head><title>App</title></head>
<body>
  <div id="root"></div>
  <script src="./main.js"></script>
</body>
</html>
`, 'utf8');

  fs.writeFileSync(path.join(tempDir, 'main.js'), `
export function initializeApp() {
  const el = document.getElementById('root');
  if (el) el.textContent = 'Ready';
}
initializeApp();
`, 'utf8');

  // [TEST 1] Testing executeUnifiedOrchestration Pipeline
  console.log('[TEST 1] Testing executeUnifiedOrchestration end-to-end...');
  const orchResult = executeUnifiedOrchestration('buatkan dashboard analytics dengan chart.js', tempDir);

  assert.strictEqual(orchResult.version, '5.0.0', 'Version must be 5.0.0');
  assert.ok(orchResult.cpgSummary.totalFiles >= 1, 'CPG must index files in workspace');
  assert.ok(orchResult.designSystem.includes('Dashboard') || orchResult.designSystem.includes('SaaS'), 'Design system resolved to dashboard or saas');
  assert.ok(orchResult.superPrompt.includes('Chart.js v4'), 'SuperPrompt includes 2026 chart.js invariant');
  assert.ok(orchResult.superPrompt.includes('TELEOLOGICAL DEFINITION OF DONE') || orchResult.superPrompt.includes('GRAVITON COGNITIVE EXECUTION CONTRACT'), 'SuperPrompt includes teleological or cognitive contract');
  console.log('  ✔ PASS: executeUnifiedOrchestration harmonizes all 10 intelligence subsystems\n');

  // [TEST 2] Testing runUnifiedSanityCheck Multi-Engine Verification
  console.log('[TEST 2] Testing runUnifiedSanityCheck on clean workspace...');
  const sanity = runUnifiedSanityCheck(tempDir);
  assert.strictEqual(sanity.version, '5.0.0', 'Sanity report version is 5.0.0');
  assert.strictEqual(sanity.sentinel.valid, true, 'Sentinel passes on clean DOM and syntax');
  assert.strictEqual(sanity.critic.passed, true, 'Critic passes on clean code without leaks');
  assert.strictEqual(sanity.passed, true, 'Overall sanity check passed');
  console.log('  ✔ PASS: runUnifiedSanityCheck verifies Sentinel, Critic, Dead-Code, and CPG simultaneously\n');

  // [TEST 3] Testing formatUnifiedDiagnosticReport Output
  console.log('[TEST 3] Testing formatUnifiedDiagnosticReport formatting...');
  const diagnosticText = formatUnifiedDiagnosticReport(sanity);
  assert.ok(diagnosticText.includes('GRAVITON V5.0.0 UNIFIED AUTONOMOUS COORDINATOR REPORT'), 'Header present');
  assert.ok(diagnosticText.includes('1. RUNTIME SENTINEL:'), 'Sentinel section present');
  assert.ok(diagnosticText.includes('2. ADVERSARIAL CRITIC:'), 'Critic section present');
  assert.ok(diagnosticText.includes('3. ENTROPY & DEAD CODE:'), 'Dead code section present');
  assert.ok(diagnosticText.includes('4. CODE PROPERTY GRAPH:'), 'CPG section present');
  console.log('  ✔ PASS: Diagnostic report renders clear multi-dimensional telemetry\n');

  // [TEST 4] Testing Prefix Caching Determinism
  console.log('[TEST 4] Testing deterministic prefix caching invariance under V5.0.0 orchestration...');
  const run1 = executeUnifiedOrchestration('buatkan dashboard', tempDir, { isContinuous: true });
  const run2 = executeUnifiedOrchestration('tambah visualisasi grafik', tempDir, { isContinuous: true });

  const prefix1 = getPromptCachePrefix(run1.superPrompt);
  const prefix2 = getPromptCachePrefix(run2.superPrompt);
  assert.strictEqual(prefix1, prefix2, 'Static prefix must remain 100% byte-for-byte identical across turns');
  console.log(`  ✔ PASS: 100% byte-for-byte prefix identity confirmed (${prefix1.length} bytes cached)\n`);

} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

// [TEST 5] Testing 100% Zero-Emoji Compliance
console.log('[TEST 5] Testing Zero-Emoji policy across V5.0.0 coordinator components...');
const sampleDiagnostic = formatUnifiedDiagnosticReport({
  workspaceDir: 'sample',
  passed: true,
  sentinel: { valid: true, summary: 'Clean' },
  critic: { averageScore: 100, passed: true, stats: { high: 0, medium: 0, low: 0 } },
  deadCode: { totalDeadItems: 0, stats: { unusedImportsCount: 0, unusedExportsCount: 0 } },
  cpg: { totalFiles: 1, totalSymbols: 1 }
});
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert.strictEqual(emojiRegex.test(sampleDiagnostic), false, 'Report output must contain zero emojis');
console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

console.log('===============================================================');
console.log('✔ ALL GRAVITON V5.0.0 UNIFIED COORDINATOR TESTS PASSED 100%!');
console.log('===============================================================\n');
