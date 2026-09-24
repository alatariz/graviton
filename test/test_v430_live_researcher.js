// test/test_v430_live_researcher.js - Graviton V4.3.0 Dynamic Live Research & Grounding Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  detectGroundedLibraries,
  synthesizeGroundedResearchBlock,
  GROUNDED_LIBRARY_REGISTRY
} from '../src/live-researcher.js';
import {
  constructSuperPrompt,
  getPromptCachePrefix
} from '../src/pipeline.js';

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V4.3.0 DYNAMIC LIVE RESEARCH & GROUNDING SUITE');
console.log('===============================================================\x1b[0m\n');

// [TEST 1] Testing Modern Library Requirement Detection
console.log('[TEST 1] Testing detection of modern 2026 libraries in natural prompts...');
const tailwindLibs = detectGroundedLibraries('buatkan web dengan tailwind v4 dan lucide icons');
assert.ok(tailwindLibs.some(l => l.key === 'tailwind_v4'), 'Must detect Tailwind v4');
assert.ok(tailwindLibs.some(l => l.key === 'lucide_icons'), 'Must detect Lucide Icons');

const threeLibs = detectGroundedLibraries('buatkan scene 3d webgl dengan threejs dan chart analytics');
assert.ok(threeLibs.some(l => l.key === 'three_js'), 'Must detect Three.js');
assert.ok(threeLibs.some(l => l.key === 'chart_js'), 'Must detect Chart.js');
console.log('  ✔ PASS: Modern library detection accurately maps targets\n');

// [TEST 2] Testing Grounded 2026 Invariants Extraction
console.log('[TEST 2] Testing extraction of breaking change invariants...');
const tailwindBlock = synthesizeGroundedResearchBlock('pakai tailwind');
assert.ok(tailwindBlock.includes('@import "tailwindcss";'), 'Must enforce single CSS import for Tailwind v4');
assert.ok(tailwindBlock.includes('NEVER use deprecated') && tailwindBlock.includes('@tailwind base'), 'Must forbid deprecated @tailwind directives');
assert.ok(tailwindBlock.includes('https://cdn.jsdelivr.net'), 'Must include verified CDN');

const threeBlock = synthesizeGroundedResearchBlock('threejs 3d canvas');
assert.ok(threeBlock.includes('NEVER use deprecated CubeGeometry'), 'Must forbid deprecated CubeGeometry');
assert.ok(threeBlock.includes('clock.getDelta()'), 'Must enforce delta-time clock physics');
console.log('  ✔ PASS: Invariant extractor eliminates pre-training hallucinations\n');

// [TEST 3] Testing End-to-End Pipeline Integration in constructSuperPrompt
console.log('[TEST 3] Testing constructSuperPrompt with live research grounding...');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v430-test-'));

try {
  const superPrompt = constructSuperPrompt('buatkan web dashboard dengan tailwind v4 dan chart.js', testDir);
  assert.ok(superPrompt.includes('=== [GRAVITON GROUNDED LIVE INTEL & 2026 API INVARIANTS] ==='), 'SuperPrompt must include grounded intel block');
  assert.ok(superPrompt.includes('Tailwind CSS v4'), 'SuperPrompt must ground Tailwind v4');
  assert.ok(superPrompt.includes('Chart.js v4'), 'SuperPrompt must ground Chart.js v4');
  console.log('  ✔ PASS: constructSuperPrompt cleanly injects verified API invariants\n');

  // [TEST 4] Testing Bypass Option (noGrounding)
  console.log('[TEST 4] Testing options.noGrounding bypass flag...');
  const bypassed = constructSuperPrompt('buatkan web dengan tailwind v4', testDir, { noGrounding: true });
  assert.strictEqual(bypassed.includes('=== [GRAVITON GROUNDED LIVE INTEL & 2026 API INVARIANTS] ==='), false, 'Must omit grounded block when bypassed');
  console.log('  ✔ PASS: options.noGrounding cleanly bypasses grounding when requested\n');

  // [TEST 5] Testing Prefix Cache Determinism Across Consecutive Turns
  console.log('[TEST 5] Testing prefix cache determinism across turns with grounding...');
  const turn1 = constructSuperPrompt('buatkan web dashboard tailwind', testDir, { isContinuous: true });
  const turn2 = constructSuperPrompt('tambahkan grafik interaktif', testDir, { isContinuous: true });

  const prefix1 = getPromptCachePrefix(turn1);
  const prefix2 = getPromptCachePrefix(turn2);
  assert.strictEqual(prefix1, prefix2, 'Static cache prefix must remain 100% byte-for-byte identical across turns');
  console.log(`  ✔ PASS: 100% byte-for-byte prefix identity confirmed (${prefix1.length} bytes cached)\n`);

  // [TEST 6] Testing Zero-Emoji Compliance
  console.log('[TEST 6] Testing zero-emoji policy on V4.3.0 output...');
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.strictEqual(emojiRegex.test(superPrompt), false, 'SuperPrompt must contain zero emojis');
  assert.strictEqual(emojiRegex.test(tailwindBlock), false, 'Grounded block must contain zero emojis');
  console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

  console.log('===============================================================');
  console.log('✔ ALL GRAVITON V4.3.0 LIVE RESEARCH TESTS PASSED 100%!');
  console.log('===============================================================\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
