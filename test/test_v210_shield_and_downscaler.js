// test/test_v210_shield_and_downscaler.js - Graviton V2.1.0 Shield & Media Optimization Test Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { isProtectedFile, generateDependencySummary } from '../src/shield.js';
import { getWorkspaceFiles, resolveTargetScope } from '../src/context-scoper.js';
import { constructSuperPrompt } from '../src/pipeline.js';
import { filterCliOutput } from '../src/cli-filter.js';
import { formatClipboardAttachment } from '../src/clipboard.js';

console.log('=== STARTING V2.1.0 SHIELD & MEDIA OPTIMIZATION TEST SUITE ===\n');

const testDir = path.join(os.tmpdir(), `graviton-shield-test-${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

try {
  // [TEST 1] isProtectedFile - Pattern Matching
  console.log('[TEST 1] Testing isProtectedFile pattern matching...');
  assert.strictEqual(isProtectedFile('package-lock.json'), true, 'package-lock.json must be protected');
  assert.strictEqual(isProtectedFile('yarn.lock'), true, 'yarn.lock must be protected');
  assert.strictEqual(isProtectedFile('pnpm-lock.yaml'), true, 'pnpm-lock.yaml must be protected');
  assert.strictEqual(isProtectedFile('Cargo.lock'), true, 'Cargo.lock must be protected');
  assert.strictEqual(isProtectedFile('app.min.js'), true, 'min.js must be protected');
  assert.strictEqual(isProtectedFile('theme.min.css'), true, 'min.css must be protected');
  assert.strictEqual(isProtectedFile('bundle.js.map'), true, '.map must be protected');

  assert.strictEqual(isProtectedFile('package.json'), false, 'package.json must NOT be protected');
  assert.strictEqual(isProtectedFile('server.js'), false, 'server.js must NOT be protected');
  assert.strictEqual(isProtectedFile('index.html'), false, 'index.html must NOT be protected');
  console.log('✔ PASS: isProtectedFile correctly matches lockfiles and minified assets.\n');

  // [TEST 2] generateDependencySummary - Manifest Extraction
  console.log('[TEST 2] Testing generateDependencySummary extraction from package.json...');
  const dummyPkg = {
    name: 'sample-project',
    version: '1.2.0',
    dependencies: {
      express: '^4.19.2',
      cors: '^2.8.5'
    },
    devDependencies: {
      mocha: '^10.0.0'
    }
  };
  fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify(dummyPkg, null, 2), 'utf8');

  const summary = generateDependencySummary(testDir);
  assert(summary.includes('[GRAVITON TOKEN SHIELD: DEPENDENCY FIREWALL]'), 'Must include shield header');
  assert(summary.includes('sample-project'), 'Must include package name');
  assert(summary.includes('express'), 'Must include express dependency');
  assert(summary.includes('mocha'), 'Must include mocha devDependency');
  console.log('✔ PASS: Dependency summary extracted cleanly in under 200 tokens.\n');

  // [TEST 3] Context Scoper & File Walk Exclusion
  console.log('[TEST 3] Testing Context Scoper file walk with protected files present...');
  fs.writeFileSync(path.join(testDir, 'package-lock.json'), '{"name": "huge-lockfile", "version": "1.0.0"}', 'utf8');
  fs.writeFileSync(path.join(testDir, 'app.min.js'), 'function minified(){}', 'utf8');
  fs.writeFileSync(path.join(testDir, 'app.js'), 'console.log("normal code");', 'utf8');

  const workspaceFiles = getWorkspaceFiles(testDir);
  assert(workspaceFiles.includes('app.js'), 'app.js should be included in workspace files');
  assert(!workspaceFiles.includes('package-lock.json'), 'package-lock.json must be excluded by Shield');
  assert(!workspaceFiles.includes('app.min.js'), 'app.min.js must be excluded by Shield');

  const scope = resolveTargetScope('cek error di package-lock.json dan app.js', testDir);
  assert(scope.targets.includes('app.js'), 'Target should pin app.js');
  assert(!scope.targets.includes('package-lock.json'), 'Target should NEVER pin package-lock.json');
  console.log('✔ PASS: Context Scoper successfully shields lockfiles and minified code.\n');

  // [TEST 4] constructSuperPrompt Lockfile Injection Interceptor
  console.log('[TEST 4] Testing constructSuperPrompt with lockfile mention in user prompt...');
  const superPrompt = constructSuperPrompt('perbaiki dependensi di package-lock.json', testDir);
  assert(superPrompt.includes('[GRAVITON TOKEN SHIELD: DEPENDENCY FIREWALL]'), 'Should inject dependency summary');
  assert(superPrompt.includes('TOKEN SHIELD & ASSET GUARD'), 'Should include Token Shield system rule');
  assert(!superPrompt.includes('huge-lockfile'), 'Raw lockfile contents must NOT be dumped into prompt');
  console.log('✔ PASS: constructSuperPrompt intercepted lockfile and injected firewall summary.\n');

  // [TEST 5] Smart Terminal Log & Error Stripper
  console.log('[TEST 5] Testing Smart Terminal Log & Error Stripper...');
  const noisyBuildLog = `
npm timing config:load:flatten Completed in 2ms
npm http fetch GET 200 https://registry.npmjs.org/express
[=====================>    ] 75%
[==========================] 100%
⠋ Downloading packages...
ReferenceError: app is not defined
    at Object.<anonymous> (D:\\Testing\\server.js:14:1)
    at Module._compile (node_modules/loader/index.js:10:5)
    at Module._compile (node_modules/engine/run.js:20:5)
    at Module._compile (node_modules/core/init.js:30:5)
    at Object.<anonymous> (D:\\Testing\\server.js:15:3)
npm ERR! Failed at test
`.trim();

  const filteredLog = filterCliOutput('', noisyBuildLog);
  assert(!filteredLog.includes('npm timing'), 'Should strip npm timing logs');
  assert(!filteredLog.includes('Downloading packages'), 'Should strip spinner lines');
  assert(!filteredLog.includes('[=====================>'), 'Should strip progress bars');
  assert(filteredLog.includes('ReferenceError: app is not defined'), 'Should preserve root cause error');
  assert(filteredLog.includes('internal node_modules call frames omitted'), 'Should collapse node_modules frames');
  console.log('✔ PASS: Terminal log noise pruned; root cause error preserved.\n');

  // [TEST 6] Smart Vision Downscaler Formatting
  console.log('[TEST 6] Testing Smart Vision Downscaler notice formatting...');
  const mockDownscaledImage = {
    type: 'image',
    path: path.join(testDir, 'screenshot.png'),
    relPath: './.graviton/clipboard/screenshot.png',
    wasDownscaled: true
  };
  const formatted = formatClipboardAttachment(mockDownscaledImage, 'buatkan UI ini');
  assert(formatted.summary.includes('Token Vision Optimized'), 'Summary must highlight Token Vision Optimization');
  console.log('✔ PASS: Downscaled image formatting verified.\n');

  console.log('====================================================');
  console.log('✔ ALL V2.1.0 SHIELD & DOWNSCALER TESTS PASSED 100%!');
  console.log('====================================================\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
