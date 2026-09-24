// test/test_v350_prompt_architect.js - Graviton V3.5.0 Autonomous Prompt Architect Unit Tests
import assert from 'assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import {
  analyzePromptProfile,
  architectPrompt
} from '../src/prompt-architect.js';
import { constructSuperPrompt } from '../src/pipeline.js';

console.log('\n===============================================================');
console.log('   GRAVITON V3.5.0 PROMPT ARCHITECT & REPROMPTER TEST SUITE');
console.log('===============================================================\n');

// -----------------------------------------------------------------------------
// [TEST 1] Sparse Game Dev Prompt Expansion (e.g. CS2 Web Clone)
// -----------------------------------------------------------------------------
console.log('[TEST 1] Testing sparse high-level game prompt expansion...');
const sparseGamePrompt = 'buatkan game duplikat cs2 based on web';
const profile1 = analyzePromptProfile(sparseGamePrompt);
assert.strictEqual(profile1.intent, 'game_dev', 'Must detect game_dev intent');
assert.strictEqual(profile1.isSparse, true, 'Short creation prompt must be marked as sparse');

const result1 = architectPrompt(sparseGamePrompt);
assert.strictEqual(result1.mode, 'expanded', 'Must expand sparse game prompt');
assert(result1.architectedPrompt.includes('Three.js'), 'Must specify Three.js / WebGL rendering engine');
assert(result1.architectedPrompt.includes('PointerLockControls'), 'Must specify first-person pointer lock controls');
assert(result1.architectedPrompt.includes('Raycaster'), 'Must specify raycast shooting mechanics');
assert(result1.architectedPrompt.includes('AK-47'), 'Must specify weapon arsenal');
assert(result1.architectedPrompt.includes('requestAnimationFrame'), 'Must specify 60 FPS delta-time game loop');
console.log('✔ PASS: Sparse game prompt successfully expanded into full technical architecture.\n');

// -----------------------------------------------------------------------------
// [TEST 2] Rambling Prompt De-Rambling & Imperative Normalization
// -----------------------------------------------------------------------------
console.log('[TEST 2] Testing conversational de-rambling & verb normalization...');
const ramblingPrompt = 'Halo selamat pagi tolong bantu saya untuk memperbaiki bug pada auth.js terima kasih banyak sebelumnya';
const profile2 = analyzePromptProfile(ramblingPrompt);
assert.strictEqual(profile2.isRambling, true, 'Must identify conversational filler');

const result2 = architectPrompt(ramblingPrompt);
assert.strictEqual(result2.mode, 'derambled', 'Must activate derambled mode');
assert(!result2.architectedPrompt.includes('Halo selamat pagi'), 'Must strip greetings');
assert(!result2.architectedPrompt.includes('tolong bantu saya'), 'Must strip conversational pleas');
assert(!result2.architectedPrompt.includes('terima kasih'), 'Must strip courtesy closings');
assert(result2.architectedPrompt.includes('auth.js'), 'Must strictly preserve target file');
assert(result2.architectedPrompt.includes('Perbaiki'), 'Must normalize passive verb to imperative');
assert(result2.tokensSaved > 0, 'Must record tokens saved from stripped filler');
console.log(`  De-rambled prompt: "${result2.architectedPrompt}" (Saved ~${result2.tokensSaved} tokens)`);
console.log('✔ PASS: Conversational filler stripped while preserving requirements.\n');

// -----------------------------------------------------------------------------
// [TEST 3] Multi-Action Capability List Extraction
// -----------------------------------------------------------------------------
console.log('[TEST 3] Testing multi-action capability list extraction with --fast flag...');
const multiActionPrompt = 'buat game cs2 yg bisa lompat bisa nembak musuh bisa ganti senjata bisa reload';
const result3 = architectPrompt(multiActionPrompt, { isFast: true });
assert.strictEqual(result3.mode, 'derambled', 'Must de-ramble into concise list under --fast');
assert(result3.architectedPrompt.includes('Buat game cs2'), 'Must preserve main objective');
assert(result3.architectedPrompt.includes('Lompat'), 'Must extract jump capability');
assert(result3.architectedPrompt.includes('Nembak musuh'), 'Must extract shooting capability');
assert(result3.architectedPrompt.includes('Ganti senjata'), 'Must extract weapon swap capability');
assert(result3.architectedPrompt.includes('Reload'), 'Must extract reload capability');
console.log('✔ PASS: Repetitive capability clauses parsed into structured requirements.\n');

// -----------------------------------------------------------------------------
// [TEST 4] Backend & REST API Technical Expansion (--deep mode)
// -----------------------------------------------------------------------------
console.log('[TEST 4] Testing Backend / REST API architectural expansion...');
const apiPrompt = 'bikin rest api backend';
const result4 = architectPrompt(apiPrompt, { isDeep: true });
assert.strictEqual(result4.mode, 'expanded', 'Must expand in deep mode');
assert.strictEqual(result4.intent, 'backend_api', 'Must detect backend_api intent');
assert(result4.architectedPrompt.includes('Standard REST Endpoints'), 'Must specify standard REST routes');
assert(result4.architectedPrompt.includes('Schema Validation'), 'Must specify payload validation');
assert(result4.architectedPrompt.includes('Error Middleware'), 'Must specify error handling middleware');
console.log('✔ PASS: REST API prompt successfully expanded.\n');

// -----------------------------------------------------------------------------
// [TEST 5] UI Component Architectural Expansion
// -----------------------------------------------------------------------------
console.log('[TEST 5] Testing UI component architectural expansion...');
const uiPrompt = 'buatkan responsive dashboard layout';
const result5 = architectPrompt(uiPrompt);
assert.strictEqual(result5.mode, 'expanded', 'Must expand UI prompt');
assert.strictEqual(result5.intent, 'frontend_ui', 'Must detect frontend_ui intent');
assert(result5.architectedPrompt.includes('Semantic Structure'), 'Must specify semantic HTML5 & a11y');
assert(result5.architectedPrompt.includes('Responsive Layout'), 'Must specify responsive Flexbox/Grid');
assert(result5.architectedPrompt.includes('Design System'), 'Must specify CSS variables & tokens');
console.log('✔ PASS: UI dashboard prompt expanded with accessibility & tokens.\n');

// -----------------------------------------------------------------------------
// [TEST 6] Error Log Clean Passthrough (Zero Distortion)
// -----------------------------------------------------------------------------
console.log('[TEST 6] Testing error log and stack trace passthrough...');
const errorLog = `TypeError: Cannot read properties of undefined (reading 'headers')
    at verifyUser (src/api/auth.js:2:24)
    at Module._compile (node:internal/modules/cjs/loader:1356:14)`;

const result6 = architectPrompt(errorLog);
assert.strictEqual(result6.mode, 'passthrough', 'Errors must never be expanded into scaffolding specs');
assert.strictEqual(result6.architectedPrompt, errorLog, 'Error log must pass through with 100% fidelity');
console.log('✔ PASS: Error logs protected with zero modification.\n');

// -----------------------------------------------------------------------------
// [TEST 7] Pipeline Integration in constructSuperPrompt
// -----------------------------------------------------------------------------
console.log('[TEST 7] Testing pipeline integration in constructSuperPrompt...');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-prompt-arch-'));
try {
  // 1. Sparse prompt in constructSuperPrompt expands
  const super1 = constructSuperPrompt('buatkan game duplikat cs2 based on web', tmpDir);
  assert(super1.includes('ARCHITECTED TECHNICAL SPECIFICATION: Web 3D FPS Game Clone'), 'Pipeline must inject architected spec');
  assert(super1.includes('Three.js'), 'Pipeline must contain Three.js engine spec');

  // 2. Rambling prompt in constructSuperPrompt de-rambles
  const super2 = constructSuperPrompt('Halo selamat pagi tolong perbaiki error di auth.js terima kasih', tmpDir);
  assert(!super2.includes('Halo selamat pagi'), 'Pipeline must strip greeting');
  assert(!super2.includes('terima kasih'), 'Pipeline must strip courtesy');
  assert(super2.includes('Perbaiki error di auth.js'), 'Pipeline must normalize to imperative');
  console.log('✔ PASS: constructSuperPrompt seamlessly integrates Autonomous Prompt Architect.\n');
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

console.log('===============================================================');
console.log('✔ ALL GRAVITON V3.5.0 PROMPT ARCHITECT TESTS PASSED 100%');
console.log('===============================================================\n');
