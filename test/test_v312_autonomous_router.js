// test/test_v312_autonomous_router.js - Test Suite for Graviton V3.12.0 Autonomous Zero-Option Intent Engine
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  detectScaffoldIntent,
  detectBundleIntent,
  detectPlayIntent,
  autoHealWorkspaceFiles
} from '../src/autonomous-router.js';

console.log('=== STARTING GRAVITON V3.12.0 AUTONOMOUS ROUTER TEST SUITE ===\n');

// Setup temporary isolated test directory
const testDir = path.join(os.tmpdir(), `graviton_v312_test_${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

// Prevent real browser window from popping up
process.env.NODE_ENV = 'test';
process.env.GRAVITON_NO_BROWSER = '1';

// [TEST 1] Detects scaffold intent on natural language prompt and scaffolds immediately (0 tokens)
console.log('[TEST 1] Natural prompt triggers zero-token scaffold and live preview without manual flags');
(async () => {
  const prompt = 'buatkan game minecraft voxel 3d lengkap dengan zombie mob';
  const res = await detectScaffoldIntent(prompt, testDir);

  assert.strictEqual(res.triggered, true, 'Should trigger scaffolding on creation prompt');
  assert.strictEqual(res.domain, 'voxel_minecraft', 'Should detect voxel_minecraft domain');
  assert.ok(fs.existsSync(path.join(testDir, 'index.html')), 'index.html should be created on disk');
  assert.ok(res.directive.includes('[AUTONOMOUS ZERO-TOKEN FOUNDATION READY]'), 'Should contain foundation directive');
  assert.ok(res.runner && res.runner.url, 'Live runner should be spawned');
  console.log('  ✔ Natural language prompt autonomously scaffolded voxel_minecraft & launched live preview\n');

  // [TEST 2] Does not overwrite index.html if already exists unless forced
  console.log('[TEST 2] Does not overwrite existing index.html on subsequent feature additions');
  const followUpPrompt = 'tambahkan pedang berlian dan panah';
  const followUpRes = await detectScaffoldIntent(followUpPrompt, testDir);

  assert.strictEqual(followUpRes.triggered, false, 'Should NOT re-scaffold when index.html already exists');
  console.log('  ✔ Existing project protected from accidental re-scaffolding\n');

  // [TEST 3] Pure bundling intent detection and execution (0 tokens, 0ms)
  console.log('[TEST 3] Pure bundle prompt bundles project into standalone HTML locally without Gemini');
  // Create a dummy CSS and JS file to test inlining
  fs.writeFileSync(path.join(testDir, 'style.css'), 'body { background: #111; }', 'utf8');
  fs.writeFileSync(path.join(testDir, 'game.js'), 'console.log("ready");', 'utf8');
  fs.writeFileSync(
    path.join(testDir, 'index.html'),
    '<!DOCTYPE html><html><head><link rel="stylesheet" href="style.css"></head><body><script src="game.js"></script></body></html>',
    'utf8'
  );

  const bundlePrompt = 'satukan kodingan web ini jadi satu file html offline';
  const bundleRes = detectBundleIntent(bundlePrompt, testDir);

  assert.strictEqual(bundleRes.handled, true, 'Pure bundle should be handled immediately');
  assert.strictEqual(bundleRes.isPure, true, 'Should recognize pure bundling intent');
  assert.strictEqual(bundleRes.shouldBundlePostExecution, false, 'Should not require post execution');
  assert.ok(bundleRes.result && bundleRes.result.success, 'Bundle operation should succeed');
  assert.ok(fs.existsSync(bundleRes.result.outputPath), 'Bundle file should exist on disk');
  console.log(`  ✔ Autonomously bundled multi-file project into: ${bundleRes.result.outputPath}\n`);

  // [TEST 4] Hybrid bundling intent (edit code first, then bundle post-execution)
  console.log('[TEST 4] Hybrid prompt schedules bundling post-execution');
  const hybridPrompt = 'tambahkan tombol pause lalu bundle jadi 1 file';
  const hybridRes = detectBundleIntent(hybridPrompt, testDir);

  assert.strictEqual(hybridRes.handled, false, 'Hybrid prompt should NOT exit immediately');
  assert.strictEqual(hybridRes.isPure, false, 'Should be recognized as non-pure');
  assert.strictEqual(hybridRes.shouldBundlePostExecution, true, 'Should flag for post-execution bundling');
  console.log('  ✔ Hybrid intent correctly flags bundling for post-execution\n');

  // [TEST 5] Pure play intent detection
  console.log('[TEST 5] Pure play prompt launches preview server and opens browser');
  const playPrompt = 'coba mainkan gamenya';
  const playRes = await detectPlayIntent(playPrompt, testDir);

  assert.strictEqual(playRes.handled, true, 'Play intent should be handled');
  assert.ok(playRes.runner && playRes.runner.url, 'Live runner should be active');
  console.log('  ✔ Play prompt handled autonomously\n');

  // [TEST 6] Auto-healing workspace files post-execution
  console.log('[TEST 6] autoHealWorkspaceFiles automatically repairs unclosed brackets & trailing commas');
  const brokenJs = 'function updateGame() {\n  if (player.alive) {\n    score += 10;'; // missing 2 closing brackets
  const brokenJson = '{\n  "name": "test",\n  "version": "1.0.0",\n}'; // trailing comma before }

  const brokenJsPath = path.join(testDir, 'player.js');
  const brokenJsonPath = path.join(testDir, 'config.json');
  fs.writeFileSync(brokenJsPath, brokenJs, 'utf8');
  fs.writeFileSync(brokenJsonPath, brokenJson, 'utf8');

  const healRes = autoHealWorkspaceFiles(testDir);
  assert.strictEqual(healRes.filesHealedCount >= 2, true, 'Should heal both files');

  const healedJs = fs.readFileSync(brokenJsPath, 'utf8');
  assert.ok(healedJs.endsWith('\n}\n}'), 'Should have closed unclosed braces in JS');

  const healedJson = fs.readFileSync(brokenJsonPath, 'utf8');
  assert.doesNotThrow(() => JSON.parse(healedJson), 'Repaired JSON should parse cleanly without trailing comma');
  console.log(`  ✔ Repaired ${healRes.filesHealedCount} broken files automatically without user intervention\n`);

  // Cleanup
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  console.log('=== ALL GRAVITON V3.12.0 AUTONOMOUS ROUTER TESTS PASSED 100%! ===\n');
})();
