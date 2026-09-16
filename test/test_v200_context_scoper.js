/**
 * Graviton V2.0.0 Target Scoping & Delta Prompting Test Suite
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  extractKeywords,
  resolveTargetScope,
  buildScopedPrompt,
  isFollowUpPrompt
} from '../src/context-scoper.js';

async function runTests() {
  console.log('=== STARTING V2.0.0 TARGET SCOPER & DELTA PROMPTING TEST SUITE ===\n');

  const testDir = path.join(os.tmpdir(), 'graviton_v200_scoper_test_' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  // Setup mock workspace
  const compDir = path.join(testDir, 'src', 'components');
  const apiDir = path.join(testDir, 'src', 'api');
  fs.mkdirSync(compDir, { recursive: true });
  fs.mkdirSync(apiDir, { recursive: true });

  fs.writeFileSync(path.join(compDir, 'Navbar.jsx'), 'export function Navbar() {}', 'utf8');
  fs.writeFileSync(path.join(compDir, 'Button.jsx'), 'export function Button() {}', 'utf8');
  fs.writeFileSync(path.join(apiDir, 'auth.js'), 'export function login() {}', 'utf8');

  // [TEST 1] Keyword Extraction
  console.log('[TEST 1] Keyword Extraction');
  const kws = extractKeywords('tolong ubah warna background navbar dan perbaiki auth endpoint login');
  assert.ok(kws.includes('navbar'), 'Should extract navbar');
  assert.ok(kws.includes('auth'), 'Should extract auth');
  assert.ok(kws.includes('login'), 'Should extract login');
  assert.ok(!kws.includes('tolong'), 'Should filter stop word "tolong"');
  console.log('  ✔ Correctly extracted domain keywords: ' + kws.join(', '));

  // [TEST 2] Target Resolution Matching File Names
  console.log('\n[TEST 2] Predictive Target Resolution');
  const scope1 = resolveTargetScope('ganti style navbar biar lebih modern', testDir);
  assert.ok(scope1.targets.length > 0, 'Should find targets');
  assert.strictEqual(scope1.targets[0], 'src/components/Navbar.jsx', 'Top target should be Navbar.jsx');
  assert.ok(scope1.directive.includes('Navbar.jsx'), 'Directive should reference Navbar.jsx');
  console.log('  ✔ Correctly resolved primary target: ' + scope1.targets[0]);

  // [TEST 3] Ambiguous Prompt & Last-Touch Context
  console.log('\n[TEST 3] Last-Touch Context for Ambiguous Prompts');
  // Write a mock session manifest
  const manifest = {
    modified: [path.join(testDir, 'src', 'api', 'auth.js')],
    created: []
  };
  fs.writeFileSync(path.join(testDir, '.graviton-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  assert.strictEqual(isFollowUpPrompt('perbaiki lagi warnanya'), true, 'Should detect follow-up prompt');
  
  const scope2 = resolveTargetScope('perbaiki lagi dong', testDir);
  assert.strictEqual(scope2.isLastTouch, true, 'Should use Last-Touch Context');
  assert.strictEqual(scope2.targets[0], 'src/api/auth.js', 'Should target last touched file: auth.js');
  console.log('  ✔ Correctly attached Last-Touch Context: ' + scope2.targets[0]);

  // [TEST 4] Delta Prompting (Pruning Workspace Map on Continuous Sessions)
  console.log('\n[TEST 4] Delta Prompting in Continuous Sessions');
  const mockWorkspaceMap = '[FULL WORKSPACE DIRECTORY TREE (5000 tokens)]';
  const fullPrompt = buildScopedPrompt('perbaiki navbar', testDir, false, mockWorkspaceMap);
  const deltaPrompt = buildScopedPrompt('perbaiki navbar', testDir, true, mockWorkspaceMap);

  assert.ok(fullPrompt.includes(mockWorkspaceMap), 'Fresh session must include full workspace map');
  assert.ok(!deltaPrompt.includes(mockWorkspaceMap), 'Continuous session must PRUNE full workspace map');
  assert.ok(deltaPrompt.includes('[SESSION CONTINUITY ACTIVE]'), 'Continuous session must signal continuity');
  console.log('  ✔ Verified Delta Prompting successfully strips redundant full tree map');

  // Clean up
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  console.log('\n=== ALL V2.0.0 TARGET SCOPER & DELTA PROMPTING TESTS PASSED! ===\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
