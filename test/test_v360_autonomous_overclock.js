// test/test_v360_autonomous_overclock.js - Graviton V3.6.0 Autonomous Overclock & Cognitive Contract Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  constructSuperPrompt,
  architectPrompt,
  buildCognitiveContract,
  synthesizeDomainEdgeCases,
  formatDeterministicCachePrompt,
  getPromptCachePrefix
} from '../src/pipeline.js';
import { analyzePromptProfile } from '../src/prompt-architect.js';

console.log('===============================================================');
console.log('   GRAVITON V3.6.0 AUTONOMOUS OVERCLOCK TEST SUITE');
console.log('===============================================================\n');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v360-test-'));

try {
  // [TEST 1] Autonomous Minecraft / Voxel Clone Expansion
  console.log('[TEST 1] Testing autonomous expansion of sparse Minecraft clone prompt...');
  const rawMinecraftPrompt = 'buatkan saya cloning dari game minecraft tapi based on web';
  const profile = analyzePromptProfile(rawMinecraftPrompt);

  assert.strictEqual(profile.isSparse, true, 'Short creation prompt must be recognized as sparse');
  assert.strictEqual(profile.intent, 'voxel_minecraft', 'Intent must be classified as voxel_minecraft');

  const architectResult = architectPrompt(rawMinecraftPrompt);
  assert.strictEqual(architectResult.mode, 'expanded', 'Mode must be expanded');
  assert(architectResult.architectedPrompt.includes('Web 3D Voxel Sandbox Game (Minecraft Clone)'), 'Must expand into Minecraft clone spec');
  assert(architectResult.architectedPrompt.includes('3D Voxel Engine & World Generation'), 'Must include Voxel Engine');
  assert(architectResult.architectedPrompt.includes('Mining & Building Mechanics (Voxel Raycasting)'), 'Must include mining and building');
  assert(architectResult.architectedPrompt.includes('Inventory Hotbar & Dynamic HUD'), 'Must include hotbar HUD');
  assert(architectResult.architectedPrompt.includes('PointerLockControls'), 'Must include first-person controls');
  assert(architectResult.architectedPrompt.includes('collision detection'), 'Must include collision detection');
  assert(architectResult.architectedPrompt.includes('Web Audio API'), 'Must include procedural audio');
  assert(architectResult.architectedPrompt.includes('60 FPS Game Loop'), 'Must include 60 FPS loop');
  console.log('  ✔ PASS: Sparse Minecraft prompt automatically expanded into 7-point production blueprint\n');

  // [TEST 2] Zero-Stub Cognitive Contract Generation
  console.log('[TEST 2] Testing zero-stub cognitive execution contract generation...');
  const contract = buildCognitiveContract();
  assert(contract.includes('ZERO-STUB MANDATE'), 'Must include zero-stub mandate');
  assert(contract.includes('// TODO'), 'Must explicitly forbid // TODO stubs');
  assert(contract.includes('100% COMPLETE & RUNNABLE'), 'Must mandate complete runnable code');
  assert(contract.includes('DEFENSIVE ERROR BOUNDARIES'), 'Must mandate error boundaries');
  console.log('  ✔ PASS: Zero-stub cognitive contract generated with all guardrails\n');

  // [TEST 3] Domain-Specific Pre-Emptive Edge-Case Synthesis
  console.log('[TEST 3] Testing domain-specific edge-case synthesis...');
  const voxelEdgeCases = synthesizeDomainEdgeCases('voxel_minecraft', rawMinecraftPrompt);
  assert(voxelEdgeCases.some(e => e.includes('AABB voxel collision')), 'Must include collision safety');
  assert(voxelEdgeCases.some(e => e.includes('Pointer Lock Lifecycle')), 'Must include pointer lock lifecycle');
  assert(voxelEdgeCases.some(e => e.includes('intersection.face.normal')), 'Must include face normal raycasting');

  const apiEdgeCases = synthesizeDomainEdgeCases('backend_api');
  assert(apiEdgeCases.some(e => e.includes('Unhandled Promise Rejection')), 'Must include unhandled promise guard');

  const uiEdgeCases = synthesizeDomainEdgeCases('frontend_ui');
  assert(uiEdgeCases.some(e => e.includes('Responsive Viewport Overflow')), 'Must include viewport overflow guard');
  console.log('  ✔ PASS: Domain edge cases synthesized accurately across domains\n');

  // [TEST 4] Deterministic Cache Layout Formatting
  console.log('[TEST 4] Testing deterministic cache prompt formatting...');
  const formattedCache = formatDeterministicCachePrompt({
    systemDirective: 'System Directives Here',
    workspaceBlock: '[WORKSPACE MAP]',
    cognitiveContract: contract,
    domainInvariants: 'Invariants',
    userInstruction: 'User Instruction Tail'
  });

  const sysIdx = formattedCache.indexOf('[SYSTEM DIRECTIVE]');
  const wsIdx = formattedCache.indexOf('[WORKSPACE MAP]');
  const contractIdx = formattedCache.indexOf('ZERO-STUB MANDATE');
  const userIdx = formattedCache.indexOf('[USER INSTRUCTION & TARGET OBJECTIVE]');

  assert(sysIdx < wsIdx, 'System directive must precede workspace block');
  assert(wsIdx < contractIdx, 'Workspace block must precede cognitive contract');
  assert(contractIdx < userIdx, 'Cognitive contract must precede user instruction tail');
  console.log('  ✔ PASS: Cache sections ordered deterministically with dynamic content at tail\n');

  // [TEST 5] Pipeline constructSuperPrompt Integration & Zero-Stub Injection
  console.log('[TEST 5] Testing constructSuperPrompt with autonomous Minecraft expansion...');
  const superPrompt = constructSuperPrompt(rawMinecraftPrompt, testDir);

  assert(superPrompt.includes('Web 3D Voxel Sandbox Game (Minecraft Clone)'), 'SuperPrompt must include Minecraft blueprint');
  assert(superPrompt.includes('GRAVITON COGNITIVE EXECUTION CONTRACT: ZERO-STUB & PRODUCTION-READY'), 'SuperPrompt must include zero-stub contract');
  assert(superPrompt.includes('PRE-EMPTIVE DOMAIN SAFETY & EDGE-CASE INVARIANTS'), 'SuperPrompt must include pre-emptive edge-case invariants');
  assert(superPrompt.includes('AABB voxel collision'), 'SuperPrompt must include voxel collision guard');
  console.log('  ✔ PASS: constructSuperPrompt successfully executes end-to-end autonomous overclock\n');

  // [TEST 6] Cache Prefix Determinism Across Consecutive Turns
  console.log('[TEST 6] Testing prompt cache prefix byte-for-byte identity across turns...');
  const turn1Prompt = constructSuperPrompt('buatkan game minecraft web', testDir, { isContinuous: true });
  const turn2Prompt = constructSuperPrompt('tambahkan zombie monster', testDir, { isContinuous: true });

  const prefix1 = getPromptCachePrefix(turn1Prompt);
  const prefix2 = getPromptCachePrefix(turn2Prompt);

  assert.strictEqual(prefix1, prefix2, 'Static cache prefix must be 100% byte-for-byte identical across turns');
  console.log(`  ✔ PASS: 100% byte-for-byte prefix identity confirmed (${prefix1.length} bytes cached)\n`);

  console.log('---------------------------------------------------------------');
  console.log('✔ ALL V3.6.0 AUTONOMOUS OVERCLOCK TESTS PASSED 100%!');
  console.log('---------------------------------------------------------------\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
