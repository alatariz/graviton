// test/test_v490_ambiguity_clarifier.js - Graviton V4.9.0 Prompt Ambiguity & Requirement Clarifier Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  analyzePromptAmbiguity,
  synthesizeClarifiedSpecificationBlock,
  DOMAIN_PATTERNS
} from '../src/ambiguity-clarifier.js';
import {
  constructSuperPrompt,
  getPromptCachePrefix
} from '../src/pipeline.js';

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V4.9.0 PROMPT AMBIGUITY & CLARIFIER SUITE');
console.log('===============================================================\x1b[0m\n');

// [TEST 1] Testing Detection of Vague Short Prompts
console.log('[TEST 1] Testing analyzePromptAmbiguity on high-entropy brief prompts...');
const briefAuth = analyzePromptAmbiguity('bikin auth');
assert.strictEqual(briefAuth.isAmbiguous, true, 'Short prompt "bikin auth" must be flagged as ambiguous');
assert.strictEqual(briefAuth.domain, 'AUTH', 'Must correctly identify AUTH domain');
assert.ok(briefAuth.score >= 50, 'Ambiguity score must be high for 2-word prompt');
assert.ok(briefAuth.missingDimensions.some(d => d.includes('brevity')), 'Must flag extreme brevity');

const briefApi = analyzePromptAmbiguity('buatkan api order');
assert.strictEqual(briefApi.isAmbiguous, true, 'Short prompt "buatkan api order" must be flagged');
assert.strictEqual(briefApi.domain, 'API', 'Must correctly identify API domain');
console.log('  ✔ PASS: Vague brief prompts accurately flagged with domain resolution\n');

// [TEST 2] Testing Well-Specified Detailed Prompts (Should NOT be flagged)
console.log('[TEST 2] Testing analyzePromptAmbiguity on clear, well-specified instructions...');
const detailedPrompt = 'Buatkan REST API Express di src/user.js yang mengembalikan payload JSON status 200 dan error 404 dengan validasi input';
const detailedAnalysis = analyzePromptAmbiguity(detailedPrompt);
assert.strictEqual(detailedAnalysis.isAmbiguous, false, 'Detailed prompt with tech stack and schema must not be flagged as ambiguous');
assert.ok(detailedAnalysis.score < 40, 'Ambiguity score must be below threshold');
console.log('  ✔ PASS: Detailed technical prompts pass without unnecessary intervention\n');

// [TEST 3] Testing synthesizeClarifiedSpecificationBlock Structure
console.log('[TEST 3] Testing specification block synthesis...');
const specBlock = synthesizeClarifiedSpecificationBlock(briefAuth);
assert.ok(specBlock.includes('=== [GRAVITON CLARIFIED ENGINEERING SPECIFICATION] ==='), 'Header present');
assert.ok(specBlock.includes('Domain Detected      : AUTH'), 'Domain identified in spec');
assert.ok(specBlock.includes('Token-based stateless authentication'), 'Includes auth engineering defaults');
assert.ok(specBlock.includes('password hashing'), 'Includes security baseline');
console.log('  ✔ PASS: Clarified specification block synthesized with clean architectural baselines\n');

// [TEST 4] Testing End-to-End Pipeline Integration in constructSuperPrompt
console.log('[TEST 4] Testing constructSuperPrompt with prompt ambiguity clarification...');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v490-pipeline-'));

try {
  const superPrompt = constructSuperPrompt('bikin dashboard', tempDir);
  assert.ok(superPrompt.includes('=== [GRAVITON CLARIFIED ENGINEERING SPECIFICATION] ==='), 'SuperPrompt must include clarified engineering spec');
  assert.ok(superPrompt.includes('DASHBOARD'), 'Domain DASHBOARD specified');
  assert.ok(superPrompt.includes('Responsive grid with clean metric KPI cards'), 'Dashboard baseline present');

  // Test bypass flag
  const bypassed = constructSuperPrompt('bikin dashboard', tempDir, { noClarify: true });
  assert.strictEqual(bypassed.includes('=== [GRAVITON CLARIFIED ENGINEERING SPECIFICATION] ==='), false, 'noClarify must bypass clarification');
  console.log('  ✔ PASS: constructSuperPrompt successfully enriches vague prompts and honors bypass flags\n');

  // [TEST 5] Testing Prefix Cache Determinism Across Consecutive Turns
  console.log('[TEST 5] Testing prefix cache determinism with ambiguity clarifier active...');
  const turn1 = constructSuperPrompt('bikin dashboard', tempDir, { isContinuous: true });
  const turn2 = constructSuperPrompt('tambah grafik pendapatan', tempDir, { isContinuous: true });

  const prefix1 = getPromptCachePrefix(turn1);
  const prefix2 = getPromptCachePrefix(turn2);
  assert.strictEqual(prefix1, prefix2, 'Static cache prefix must remain 100% byte-for-byte identical across turns');
  console.log(`  ✔ PASS: 100% byte-for-byte prefix identity confirmed (${prefix1.length} bytes cached)\n`);

} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

// [TEST 6] Testing 100% Zero-Emoji Compliance
console.log('[TEST 6] Testing Zero-Emoji policy across V4.9.0 components...');
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert.strictEqual(emojiRegex.test(specBlock), false, 'Specification block must contain zero emojis');
console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

console.log('===============================================================');
console.log('✔ ALL GRAVITON V4.9.0 PROMPT AMBIGUITY TESTS PASSED 100%!');
console.log('===============================================================\n');
