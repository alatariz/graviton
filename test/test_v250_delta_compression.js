// test/test_v250_delta_compression.js - Graviton V2.5.0 Delta Compression & Turn Diff Caching Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  computeFileHash,
  recordFileSnapshot,
  getPreviousSnapshot,
  computeHunkDiff,
  resolveDeltaHydration,
  clearSessionSnapshots,
  listSessionSnapshots
} from '../src/delta-compressor.js';
import { constructSuperPrompt } from '../src/pipeline.js';
import { runDoctor } from '../src/doctor.js';

console.log('\n===============================================================');
console.log('   RUNNING GRAVITON V2.5.0 DELTA COMPRESSION TEST SUITE');
console.log('===============================================================\n');

const testDir = path.join(os.tmpdir(), 'graviton_v250_test_' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

try {
  // Test 1: computeFileHash and snapshot recording/retrieval
  console.log('Test 1: Baseline snapshot recording and retrieval...');
  const sampleContent = 'function hello() {\n  console.log("world");\n}\n';
  const hash = computeFileHash(sampleContent);
  assert.strictEqual(typeof hash, 'string');
  assert.strictEqual(hash.length, 64);

  const convId = 'test_conv_1';
  recordFileSnapshot(testDir, 'src/test.js', sampleContent, convId);

  const retrieved = getPreviousSnapshot(testDir, 'src/test.js', convId);
  assert(retrieved, 'Snapshot should be retrieved');
  assert.strictEqual(retrieved.hash, hash);
  assert.strictEqual(retrieved.content, sampleContent);
  console.log('  ✔ PASS: Baseline snapshot stored and retrieved cleanly.');

  // Test 2: computeHunkDiff unified diff generation
  console.log('Test 2: computeHunkDiff line-level hunk generation...');
  const oldCode = [
    'import auth from "./auth.js";',
    'export function handleLogin(req) {',
    '  const user = req.body.user;',
    '  if (!user) throw new Error("Missing user");',
    '  return user;',
    '}'
  ].join('\n');

  const newCode = [
    'import auth from "./auth.js";',
    'export function handleLogin(req) {',
    '  const user = req.body.user;',
    '  if (!isValid(user)) throw new Error("Invalid user");',
    '  if (!user) throw new Error("Missing user");',
    '  return user;',
    '}'
  ].join('\n');

  const diff = computeHunkDiff(oldCode, newCode, 'src/login.js');
  assert.strictEqual(diff.additions, 1);
  assert.strictEqual(diff.deletions, 0);
  assert(diff.diffText.includes('+  if (!isValid(user)) throw new Error("Invalid user");'));
  assert(diff.diffText.includes('@@ -1,6 +1,7 @@'));
  console.log('  ✔ PASS: Unified hunk diff accurately captures additions and context.');

  // Test 3: resolveDeltaHydration across 4 multi-turn scenarios
  console.log('Test 3: Multi-turn conversational delta hydration lifecycle...');
  const convId2 = 'test_conv_lifecycle';
  const fileRel = 'src/service.js';
  const filePath = path.join(testDir, fileRel);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  const turn1Content = Array.from({ length: 25 }, (_, i) => `const val${i} = ${i * 10};`).join('\n');
  fs.writeFileSync(filePath, turn1Content, 'utf8');

  // Turn 1: Fresh baseline
  const resTurn1 = resolveDeltaHydration(filePath, turn1Content, testDir, { conversationId: convId2 });
  assert.strictEqual(resTurn1.mode, 'baseline');
  assert.strictEqual(resTurn1.content, turn1Content);

  // Turn 2: Unchanged file in subsequent turn -> Context Reuse Pointer
  const resTurn2 = resolveDeltaHydration(filePath, turn1Content, testDir, { conversationId: convId2 });
  assert.strictEqual(resTurn2.mode, 'unchanged');
  assert(resTurn2.text.includes('[GRAVITON CONTEXT REUSE: src/service.js]'));
  assert(resTurn2.text.length < 150); // Massive token reduction

  // Turn 3: Minor modification (1 line changed out of 25 -> 4% ratio) -> Turn Delta Hunk
  const lines3 = turn1Content.split('\n');
  lines3[5] = 'const val5 = "MODIFIED_IN_TURN_3";';
  const turn3Content = lines3.join('\n');
  fs.writeFileSync(filePath, turn3Content, 'utf8');

  const resTurn3 = resolveDeltaHydration(filePath, turn3Content, testDir, { conversationId: convId2 });
  assert.strictEqual(resTurn3.mode, 'delta');
  assert(resTurn3.text.includes('[GRAVITON TURN DELTA: src/service.js (+1, -1 lines since previous turn)]'));
  assert(resTurn3.text.includes('+const val5 = "MODIFIED_IN_TURN_3";'));
  assert(resTurn3.savedPct > 50, `Expected token savings > 50%, got ${resTurn3.savedPct}%`);

  // Turn 4: Major rewrite (> 40% lines changed) -> Fallback to full hydration
  const turn4Content = 'const completelyRewritten = true;\nconsole.log("rewritten");\n';
  fs.writeFileSync(filePath, turn4Content, 'utf8');

  const resTurn4 = resolveDeltaHydration(filePath, turn4Content, testDir, { conversationId: convId2 });
  assert.strictEqual(resTurn4.mode, 'full');
  assert.strictEqual(resTurn4.note, 'major rewrite');
  console.log('  ✔ PASS: Full lifecycle (baseline -> context reuse -> diff hunk -> major rewrite fallback) verified.');

  // Test 4: --no-delta bypass flag
  console.log('Test 4: Bypass delta compression with noDelta option...');
  const resBypass = resolveDeltaHydration(filePath, turn4Content, testDir, {
    conversationId: convId2,
    noDelta: true
  });
  assert.strictEqual(resBypass.mode, 'full');
  assert.strictEqual(resBypass.content, turn4Content);
  console.log('  ✔ PASS: noDelta option successfully bypasses delta compression.');

  // Test 5: listSessionSnapshots and clearSessionSnapshots
  console.log('Test 5: Snapshot listing and cache clearing...');
  const snapshots = listSessionSnapshots(testDir, convId2);
  assert(snapshots.length >= 1);
  assert.strictEqual(snapshots[0].file, 'src/service.js');

  const cleared = clearSessionSnapshots(testDir, convId2);
  assert.strictEqual(cleared, true);
  const snapshotsAfter = listSessionSnapshots(testDir, convId2);
  assert.strictEqual(snapshotsAfter.length, 0);
  console.log('  ✔ PASS: Session snapshot listing and cache clearing work properly.');

  // Test 6: Pipeline integration in constructSuperPrompt
  console.log('Test 6: Pipeline hydration integration in constructSuperPrompt...');
  const pipeFile = path.join(testDir, 'pipeline_test.js');
  const pipeContent = Array.from({ length: 30 }, (_, i) => `function step${i}() { return ${i}; }`).join('\n');
  fs.writeFileSync(pipeFile, pipeContent, 'utf8');

  const pipeConvId = 'pipe_conv_' + Date.now();

  // Prompt Turn 1: establishes baseline
  const prompt1 = constructSuperPrompt('inspect pipeline_test.js for errors', testDir, {
    isContinuous: true,
    conversationId: pipeConvId
  });
  assert(prompt1.includes('pipeline_test.js'));

  // Prompt Turn 2: same file unchanged -> should emit [GRAVITON CONTEXT REUSE]
  const prompt2 = constructSuperPrompt('now explain pipeline_test.js to me', testDir, {
    isContinuous: true,
    conversationId: pipeConvId
  });
  assert(prompt2.includes('[GRAVITON CONTEXT REUSE: pipeline_test.js]'));

  // Prompt Turn 3: modify 1 function -> should emit [GRAVITON TURN DELTA]
  const modifiedPipeContent = pipeContent.replace('function step5() { return 5; }', 'function step5() { return 9999; }');
  fs.writeFileSync(pipeFile, modifiedPipeContent, 'utf8');

  const prompt3 = constructSuperPrompt('fix pipeline_test.js step5 return value', testDir, {
    isContinuous: true,
    conversationId: pipeConvId
  });
  assert(prompt3.includes('[GRAVITON TURN DELTA: pipeline_test.js'));
  assert(prompt3.includes('+function step5() { return 9999; }'));
  console.log('  ✔ PASS: Pipeline hydration seamlessly emits context reuse and delta hunks across continuous turns.');

  // Test 7: Doctor Diagnostics Check #11
  console.log('Test 7: Doctor diagnostic check #11...');
  const doc = runDoctor(testDir);
  const check11 = doc.diagnostics.find(d => d.name === 'Delta Compression & Turn Diff Caching');
  assert(check11, 'Check #11 must exist in diagnostics');
  assert.strictEqual(check11.status, 'ok');
  console.log('  ✔ PASS: Doctor diagnostic check #11 verified.');

  console.log('\n---------------------------------------------------------------');
  console.log('✔ ALL GRAVITON V2.5.0 DELTA COMPRESSION TESTS PASSED 100%!');
  console.log('---------------------------------------------------------------\n');

} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
