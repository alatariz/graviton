// test/test_v410_design_intelligence.js - Graviton V4.1.0 Design Intelligence & Skill Matrix Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  resolveDesignSystem,
  formatDesignSystemSpecification
} from '../src/design-intelligence.js';
import {
  resolveSkillDirectives,
  formatSkillDirectivesBlock
} from '../src/skill-matrix.js';
import {
  architectPrompt
} from '../src/prompt-architect.js';
import {
  constructSuperPrompt,
  getPromptCachePrefix
} from '../src/pipeline.js';

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V4.1.0 DESIGN INTELLIGENCE & SKILL MATRIX SUITE');
console.log('===============================================================\x1b[0m\n');

// [TEST 1] Testing Category Detection across Diverse Real-World Industries
console.log('[TEST 1] Testing industry category detection for 2026 aesthetics...');
const clinicDs = resolveDesignSystem('buatkan website klinik dokter gigi dan kesehatan');
assert.strictEqual(clinicDs.category, 'Healthcare, Clinic & Wellness', 'Must detect Healthcare');

const cryptoDs = resolveDesignSystem('buat web dashboard crypto bitcoin trading');
assert.strictEqual(cryptoDs.category, 'Fintech & Web3 Crypto', 'Must detect Fintech/Crypto');

const shopDs = resolveDesignSystem('buatkan toko online baju dan produk katalog');
assert.strictEqual(shopDs.category, 'Modern E-Commerce & Retail', 'Must detect E-Commerce');

const portfolioDs = resolveDesignSystem('buatkan web portfolio agency desainer');
assert.strictEqual(portfolioDs.category, 'Creative Portfolio & Agency', 'Must detect Portfolio');

const landingDs = resolveDesignSystem('buatkan landing page startup aplikasi');
assert.strictEqual(landingDs.category, 'Modern Startup Landing Page', 'Must detect Startup Landing');

const saasDs = resolveDesignSystem('buatkan dashboard analytics saas');
assert.strictEqual(saasDs.category, 'Modern SaaS & Analytics Dashboard', 'Must detect SaaS Dashboard');
console.log('  ✔ PASS: Categories resolved accurately across 6 industry domains\n');

// [TEST 2] Testing Design System Formatting & Anti-Pattern Enforcements
console.log('[TEST 2] Testing design specification formatting and anti-patterns...');
const clinicSpec = formatDesignSystemSpecification(clinicDs);
assert.ok(clinicSpec.includes('2026 UI/UX DESIGN INTELLIGENCE SPECIFICATION: HEALTHCARE'), 'Must format header');
assert.ok(clinicSpec.includes('WCAG-AAA'), 'Healthcare must enforce WCAG-AAA accessibility');
assert.ok(clinicSpec.includes('NEVER use dark cyberpunk neon'), 'Healthcare must forbid dark cyberpunk neon');

const cryptoSpec = formatDesignSystemSpecification(cryptoDs);
assert.ok(cryptoSpec.includes('Dark Mode (OLED)'), 'Crypto must use OLED dark mode');
assert.ok(cryptoSpec.includes('pulse beacon'), 'Crypto must include real-time pulse');
console.log('  ✔ PASS: Design specifications enforce high-contrast tokens and strict anti-patterns\n');

// [TEST 3] Testing Prompt Architect Integration
console.log('[TEST 3] Testing prompt-architect integration with contextual design systems...');
const clinicArch = architectPrompt('buatkan web klinik dokter');
assert.ok(clinicArch.architectedPrompt.includes('Healthcare, Clinic & Wellness'), 'Must include Healthcare in architected blueprint');
assert.ok(clinicArch.architectedPrompt.includes('WCAG-AA'), 'Must include WCAG accessibility');

const shopArch = architectPrompt('buatkan toko online fashion shop e-commerce');
assert.ok(shopArch.architectedPrompt.includes('Modern E-Commerce & Retail'), 'Must include E-Commerce in architected blueprint');
assert.ok(shopArch.architectedPrompt.includes('Drawer'), 'Must include cart drawer');
console.log('  ✔ PASS: Prompt architect injects contextual 2026 design systems instead of generic layouts\n');

// [TEST 4] Testing Expanded Skill Matrix Resolution
console.log('[TEST 4] Testing high-leverage skill triggers distilled from Godmode...');
const cleanCodeSkills = resolveSkillDirectives('tolong refactor dan rapikan kode struktur backend');
assert.ok(cleanCodeSkills.some(s => s.skill === 'clean-code'), 'Must trigger clean-code');

const debugSkills = resolveSkillDirectives('ada error crash exception di login');
assert.ok(debugSkills.some(s => s.skill === 'systematic-debugging'), 'Must trigger systematic-debugging');

const uiSkills = resolveSkillDirectives('buatkan desain tampilan modern bento dashboard');
assert.ok(uiSkills.some(s => s.skill.includes('ui-ux-pro-max')), 'Must trigger ui-ux-pro-max');

const formattedSkills = formatSkillDirectivesBlock('ada error dan perlu refactor clean code');
assert.ok(formattedSkills.includes('=== [GRAVITON RELEVANT SKILL CAPABILITIES ACTIVATED] ==='), 'Must include skill header');
assert.ok(formattedSkills.includes('clean-code'), 'Must include clean-code in formatted block');
assert.ok(formattedSkills.includes('systematic-debugging'), 'Must include systematic-debugging in formatted block');
console.log('  ✔ PASS: Skill matrix resolves clean-code, debugging, and UI/UX directives\n');

// [TEST 5] Testing End-to-End Pipeline Integration in constructSuperPrompt
console.log('[TEST 5] Testing constructSuperPrompt with design intelligence and skills...');
const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v410-test-'));

try {
  const superPrompt = constructSuperPrompt('buatkan web klinik dokter dan kesehatan modern', testDir);
  assert.ok(superPrompt.includes('Healthcare, Clinic & Wellness'), 'SuperPrompt must include contextual healthcare design');
  assert.ok(superPrompt.includes('[GRAVITON RELEVANT SKILL CAPABILITIES ACTIVATED]'), 'SuperPrompt must activate relevant skill directives');
  assert.ok(superPrompt.includes('ui-ux-pro-max'), 'SuperPrompt must activate ui-ux-pro-max skill');
  console.log('  ✔ PASS: constructSuperPrompt cleanly injects design intelligence and active skills\n');

  // [TEST 6] Testing Prefix Cache Determinism Across Consecutive Turns
  console.log('[TEST 6] Testing prefix cache determinism with active skill matrix...');
  const turn1 = constructSuperPrompt('buatkan landing page saas kopi', testDir, { isContinuous: true });
  const turn2 = constructSuperPrompt('sekarang tambahkan tombol checkout', testDir, { isContinuous: true });

  const prefix1 = getPromptCachePrefix(turn1);
  const prefix2 = getPromptCachePrefix(turn2);
  assert.strictEqual(prefix1, prefix2, 'Static cache prefix must remain 100% byte-for-byte identical across turns');
  console.log(`  ✔ PASS: 100% byte-for-byte prefix identity confirmed (${prefix1.length} bytes cached)\n`);

  // [TEST 7] Testing Zero-Emoji Compliance
  console.log('[TEST 7] Testing zero-emoji policy on V4.1.0 output...');
  const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
  assert.strictEqual(emojiRegex.test(superPrompt), false, 'SuperPrompt must contain zero emojis');
  assert.strictEqual(emojiRegex.test(clinicSpec), false, 'Design specification must contain zero emojis');
  assert.strictEqual(emojiRegex.test(formattedSkills), false, 'Skill directives block must contain zero emojis');
  console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

  console.log('===============================================================');
  console.log('✔ ALL GRAVITON V4.1.0 DESIGN INTELLIGENCE TESTS PASSED 100%!');
  console.log('===============================================================\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
