// test/test_v300_typo_and_progress.js - Graviton V3.0.0 Typo Guard & Progress Indicator Suite
import assert from 'assert';
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeArgsWithTypoGuard } from '../src/typo-guard.js';
import { startAiProgressIndicator } from '../src/progress-indicator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('=== STARTING GRAVITON V3.0.0 TYPO GUARD & PROGRESS SUITE ===\n');

// 1. Test Keyboard Slip Help Auto-Corrections
console.log('[TEST 1] Typo Guard intercepts help slips (=h, =help, -help, hlep, ?)');
const helpInputs = ['=h', '==h', '=help', '==help', '-help', 'hlep', 'halp', 'hepl', '?', '-?'];
for (const input of helpInputs) {
  const res = sanitizeArgsWithTypoGuard([input]);
  assert.strictEqual(res.interceptedAction, 'help', `Input '${input}' must be intercepted as help`);
  assert.deepStrictEqual(res.args, ['-h'], `Input '${input}' must auto-correct to '-h'`);
  assert.ok(res.notice && res.notice.includes('Keyboard slip detected'), `Must provide helpful notice for '${input}'`);
}
console.log('  ✔ All help keyboard slips auto-corrected to -h (0 tokens spent)');

// 2. Test Version Keyboard Slip Auto-Corrections
console.log('\n[TEST 2] Typo Guard intercepts version slips (=v, =version, -version, versin)');
const verInputs = ['=v', '==v', '=version', '-version', 'versin'];
for (const input of verInputs) {
  const res = sanitizeArgsWithTypoGuard([input]);
  assert.strictEqual(res.interceptedAction, 'version', `Input '${input}' must be intercepted as version`);
  assert.deepStrictEqual(res.args, ['-v'], `Input '${input}' must auto-correct to '-v'`);
}
console.log('  ✔ All version keyboard slips auto-corrected to -v (0 tokens spent)');

// 3. Test Command Slips (doctor, stats, web, diff, compact, undo)
console.log('\n[TEST 3] Typo Guard intercepts command slips');
assert.strictEqual(sanitizeArgsWithTypoGuard(['=doc']).interceptedAction, 'doctor');
assert.strictEqual(sanitizeArgsWithTypoGuard(['doktor']).interceptedAction, 'doctor');
assert.strictEqual(sanitizeArgsWithTypoGuard(['=stats']).interceptedAction, 'stats');
assert.strictEqual(sanitizeArgsWithTypoGuard(['=web']).interceptedAction, 'web');
assert.strictEqual(sanitizeArgsWithTypoGuard(['=diff']).interceptedAction, 'diff');
assert.strictEqual(sanitizeArgsWithTypoGuard(['=compact']).interceptedAction, 'compact');
assert.strictEqual(sanitizeArgsWithTypoGuard(['=undo']).interceptedAction, 'undo');
console.log('  ✔ Command slips correctly auto-corrected');

// 4. Test Stray Punctuation Interception
console.log('\n[TEST 4] Typo Guard intercepts accidental stray punctuation');
const straySymbols = ['=', '==', '+', '++', '/', '\\', ';', ';;', '!', '?', '~'];
for (const sym of straySymbols) {
  const res = sanitizeArgsWithTypoGuard([sym]);
  assert.ok(res.interceptedAction === 'stray_symbol' || res.interceptedAction === 'help', `Symbol '${sym}' must be caught`);
  assert.ok(res.notice && (res.notice.includes('Stray input symbol') || res.notice.includes('Keyboard slip')));
}
console.log('  ✔ Accidental stray symbols safely caught without calling AI');

// 5. Test Multi-argument Flag Corrections
console.log('\n[TEST 5] Multi-argument flag slips are corrected');
const flagTests = [
  { in: ['=f', 'fix typo'], out: ['-f', 'fix typo'] },
  { in: ['=d', 'architect backend'], out: ['-d', 'architect backend'] },
  { in: ['=p', 'analyze code'], out: ['-p', 'analyze code'] },
  { in: ['=c', '1'], out: ['-c', '1'] },
  { in: ['=n', 'new topic'], out: ['-n', 'new topic'] }
];
for (const ft of flagTests) {
  const res = sanitizeArgsWithTypoGuard(ft.in);
  assert.deepStrictEqual(res.args, ft.out, `Flag '${ft.in[0]}' must be corrected`);
  assert.ok(res.notice && res.notice.includes('Correcting flag'));
}
console.log('  ✔ Multi-argument flags corrected');

// 6. Test Legitimate Prompts are NOT intercepted
console.log('\n[TEST 6] Legitimate code snippets & prompts pass through untouched');
const legitPrompts = [
  ['var x = 5 + 10;'],
  ['fix', 'the', 'bug', 'in', 'server.js'],
  ['calculate', 'pi', 'using', 'monte', 'carlo']
];
for (const p of legitPrompts) {
  const res = sanitizeArgsWithTypoGuard(p);
  assert.strictEqual(res.interceptedAction, null, `Prompt '${p.join(' ')}' must not be intercepted`);
  assert.deepStrictEqual(res.args, p);
}
console.log('  ✔ Legitimate prompts pass through with zero false positives');

// 7. Test Live AI Progress Controller Lifecycle
console.log('\n[TEST 7] Live AI Progress Indicator Controller Lifecycle');
const controller = startAiProgressIndicator({ stdio: 'ignore' });
assert.ok(controller && typeof controller.stop === 'function');
controller.stop(); // Safe idempotent call
controller.stop();
console.log('  ✔ Progress indicator controller safely initialized and terminated');

// 8. E2E CLI Invocations
console.log('\n[TEST 8] E2E CLI Invocations via subprocess');

// 8a. `grav =h` executes help locally
const cliHelp = spawnSync(process.execPath, [path.join(projectRoot, 'bin', 'graviton.js'), '=h'], {
  encoding: 'utf8'
});
assert.strictEqual(cliHelp.status, 0);
assert.ok(cliHelp.stdout.includes('[GRAVITON TYPO GUARD]'), 'Must display typo guard notice');
assert.ok(cliHelp.stdout.includes('AUTONOMOUS ENGINES'), 'Must display help screen');
console.log('  ✔ grav =h prints help with 0 tokens spent');

// 8b. `grav =` intercepts stray symbol cleanly
const cliStray = spawnSync(process.execPath, [path.join(projectRoot, 'bin', 'graviton.js'), '='], {
  encoding: 'utf8'
});
assert.strictEqual(cliStray.status, 0);
assert.ok(cliStray.stdout.includes('Stray input symbol detected'), 'Must display stray symbol notice');
assert.ok(cliStray.stdout.includes("Tip: run 'grav -h' for help & options"), 'Must display help tip');
console.log('  ✔ grav = intercepts stray symbol cleanly with 0 tokens spent');

// 8c. `grav =v` executes version locally
const cliVer = spawnSync(process.execPath, [path.join(projectRoot, 'bin', 'graviton.js'), '=v'], {
  encoding: 'utf8'
});
assert.strictEqual(cliVer.status, 0);
assert.ok(cliVer.stdout.includes('v3.') && cliVer.stdout.includes('Production-Ready Autonomous Engine'), 'Must display version 3.x');
console.log('  ✔ grav =v prints version with 0 tokens spent');

console.log('\n=== ALL TYPO GUARD & PROGRESS TESTS PASSED 100%! ===\n');
