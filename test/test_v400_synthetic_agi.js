// test/test_v400_synthetic_agi.js - Graviton V4.0.0 Synthetic AGI Metacognitive Suite
import assert from 'assert';
import {
  resolveCritiqueDomain,
  executeSocraticDialectic,
  generateTeleologicalContract,
  compressToNeuroSymbolic,
  synthesizeAgiCognitiveHarness
} from '../src/synthetic-agi.js';
import { constructSuperPrompt, getPromptCachePrefix } from '../src/pipeline.js';

console.log('===============================================================');
console.log('   GRAVITON V4.0.0 SYNTHETIC AGI METACOGNITIVE TEST SUITE');
console.log('===============================================================\n');

// [TEST 1] Domain Adversarial Critique Mapping
console.log('[TEST 1] Testing domain critique mapping across diverse engineering domains...');
assert.strictEqual(resolveCritiqueDomain('buatkan login jwt auth'), 'auth_security');
assert.strictEqual(resolveCritiqueDomain('buatkan 3d minecraft voxel canvas'), 'voxel_game');
assert.strictEqual(resolveCritiqueDomain('buatkan database schema and sql query'), 'database_sql');
assert.strictEqual(resolveCritiqueDomain('buatkan REST API express endpoints'), 'backend_api');
assert.strictEqual(resolveCritiqueDomain('buatkan modern interactive web dashboard'), 'fullstack_web');
console.log('  ✔ PASS: Domains mapped accurately to specialized architectural critique models\n');

// [TEST 2] Socratic Dialectic Triad (Thesis -> Antithesis -> Synthesis)
console.log('[TEST 2] Testing Socratic Dialectic generation and failure mode neutralization...');
const dialectic = executeSocraticDialectic('buatkan modern kanban board web app', 'frontend_ui');
assert.ok(dialectic.thesis, 'Thesis must be generated');
assert.ok(Array.isArray(dialectic.antithesis) && dialectic.antithesis.length >= 3, 'Antithesis must contain at least 3 failure modes');
assert.ok(dialectic.synthesis, 'Synthesis must be generated');
assert.ok(dialectic.formattedBlock.includes('THESIS'), 'Block must contain THESIS header');
assert.ok(dialectic.formattedBlock.includes('ANTITHESIS'), 'Block must contain ANTITHESIS header');
assert.ok(dialectic.formattedBlock.includes('SYNTHESIS'), 'Block must contain SYNTHESIS header');
console.log('  ✔ PASS: Socratic Dialectic synthesizes thesis, adversarial failure modes, and resolution\n');

// [TEST 3] Teleological Definition of Done (Goal-First Inverse Specification)
console.log('[TEST 3] Testing Teleological Backpropagation & Acceptance Assertions...');
const teleology = generateTeleologicalContract('buatkan realtime chat system', 'fullstack_web');
assert.ok(teleology.acceptanceCriteria.length >= 4, 'Must include acceptance criteria');
assert.ok(teleology.invariants.length >= 3, 'Must include formal state invariants');
assert.ok(teleology.formattedBlock.includes('TELEOLOGICAL DEFINITION OF DONE'), 'Must contain DoD header');
assert.ok(teleology.formattedBlock.includes('∀ action ∈ UserActions'), 'Must contain mathematical state invariant');
console.log('  ✔ PASS: Teleological contract formulates testable assertions and mathematical state boundaries\n');

// [TEST 4] High-Density Neuro-Symbolic Compression
console.log('[TEST 4] Testing Neuro-Symbolic compression of linguistic fluff...');
const verboseText = 'Please make sure to fully implement all methods and it is strictly forbidden to use empty stubs.';
const compressed = compressToNeuroSymbolic(verboseText);
assert.ok(!compressed.includes('Please make sure to'), 'Must strip polite preamble');
assert.ok(compressed.includes('ENFORCE:'), 'Must replace with high-density directive token');
assert.ok(compressed.includes('NEVER:'), 'Must replace forbidden phrasing with dense constraint');
console.log('  ✔ PASS: Neuro-symbolic compression eliminates conversational fluff\n');

// [TEST 5] Full Cognitive Harness Assembly & Token Economy
console.log('[TEST 5] Testing unified Synthetic AGI Cognitive Harness...');
const harnessResult = synthesizeAgiCognitiveHarness('buatkan web dashboard crypto tracking', 'fullstack_web');
assert.ok(harnessResult.harness.includes('SYNTHETIC AGI METACOGNITIVE HARNESS'), 'Must include Synthetic AGI header');
assert.ok(harnessResult.tokenEstimate > 50 && harnessResult.tokenEstimate < 600, 'Harness must be compact (< 600 tokens)');
console.log(`  ✔ PASS: Unified harness assembled with dense footprint (~${harnessResult.tokenEstimate} tokens)\n`);

// [TEST 6] End-to-End Pipeline Integration in constructSuperPrompt
console.log('[TEST 6] Testing constructSuperPrompt integration with Synthetic AGI...');
const testCwd = process.cwd();
const superPrompt = constructSuperPrompt('buatkan interactive analytics dashboard', testCwd);
assert.ok(superPrompt.includes('SYNTHETIC AGI METACOGNITIVE HARNESS'), 'SuperPrompt must include Synthetic AGI harness');
assert.ok(superPrompt.includes('SOCRATIC DIALECTIC RESOLUTION'), 'SuperPrompt must include Socratic Dialectic');
assert.ok(superPrompt.includes('TELEOLOGICAL DEFINITION OF DONE'), 'SuperPrompt must include Teleological DoD');
assert.ok(superPrompt.includes('ZERO-STUB MANDATE'), 'SuperPrompt must preserve Zero-Stub Cognitive Contract');

// Verify prefix caching alignment
const cachePrefix = getPromptCachePrefix(superPrompt);
assert.ok(cachePrefix.includes('GRAVITON COGNITIVE EXECUTION CONTRACT'), 'Prefix must preserve Zero-Stub Cognitive Contract');
assert.ok(superPrompt.includes('SYNTHETIC AGI METACOGNITIVE HARNESS'), 'SuperPrompt must include Synthetic AGI harness');
console.log('  ✔ PASS: constructSuperPrompt cleanly injects AGI harness with prefix caching alignment\n');

// [TEST 7] Bypass option (noAgi)
console.log('[TEST 7] Testing options.noAgi bypass flag...');
const bypassedPrompt = constructSuperPrompt('buatkan interactive analytics dashboard', testCwd, { noAgi: true });
assert.strictEqual(bypassedPrompt.includes('GRAVITON V4.0.0 SYNTHETIC AGI METACOGNITIVE HARNESS'), false, 'Harness must be omitted when noAgi is true');
console.log('  ✔ PASS: options.noAgi cleanly bypasses metacognitive harness when instructed\n');

// [TEST 8] Zero-Emoji Compliance
console.log('[TEST 8] Testing zero-emoji policy on Synthetic AGI output...');
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert.strictEqual(emojiRegex.test(superPrompt), false, 'SuperPrompt must strictly contain zero emojis');
console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

console.log('===============================================================');
console.log('✔ ALL GRAVITON V4.0.0 SYNTHETIC AGI TESTS PASSED 100%!');
console.log('===============================================================\n');
