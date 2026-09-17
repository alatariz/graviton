// test/test_v260_squeezer_and_economizer.js - Graviton V2.6.0 Squeezer & Output Economizer Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  isStackTrace,
  isInternalFrame,
  squeezeStackTrace,
  squeezeMixedContent
} from '../src/stack-squeezer.js';
import {
  constructSuperPrompt,
  generateEconomizerDirective
} from '../src/pipeline.js';
import { runDoctor } from '../src/doctor.js';

console.log('\n===============================================================');
console.log('   RUNNING GRAVITON V2.6.0 SQUEEZER & ECONOMIZER TEST SUITE');
console.log('===============================================================\n');

// Test 1: isStackTrace detection
console.log('Test 1: Stack trace pattern detection...');
const nodeTrace = `TypeError: Cannot read properties of undefined (reading 'token')
    at handleAuth (C:\\project\\src\\auth.js:42:15)
    at Layer.handle [as handle_request] (C:\\project\\node_modules\\express\\lib\\router\\layer.js:95:5)
    at trim_prefix (C:\\project\\node_modules\\express\\lib\\router\\index.js:328:13)
    at C:\\project\\node_modules\\express\\lib\\router\\index.js:286:9
    at Function.process_params (C:\\project\\node_modules\\express\\lib\\router\\index.js:346:12)
    at next (C:\\project\\node_modules\\express\\lib\\router\\index.js:280:10)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)`;

const pyTrace = `Traceback (most recent call last):
  File "C:\\project\\main.py", line 12, in <module>
    app.run()
  File "C:\\Python312\\lib\\site-packages\\flask\\app.py", line 920, in run
    run_simple(t.cast(str, host), port, self, **options)
  File "C:\\Python312\\lib\\site-packages\\werkzeug\\serving.py", line 1052, in run_simple
    inner()
  File "C:\\Python312\\lib\\site-packages\\werkzeug\\serving.py", line 1005, in inner
    srv.serve_forever()
ZeroDivisionError: division by zero`;

const plainText = "tolong buatkan fungsi baru untuk menghitung diskon belanja";

assert.strictEqual(isStackTrace(nodeTrace), true);
assert.strictEqual(isStackTrace(pyTrace), true);
assert.strictEqual(isStackTrace(plainText), false);
console.log('  ✔ PASS: isStackTrace accurately differentiates stack traces from plain text.');

// Test 2: Node.js stack trace squeezing
console.log('Test 2: Node.js stack trace squeezing...');
const squeezedNode = squeezeStackTrace(nodeTrace, 'C:\\project');
assert(squeezedNode.includes("TypeError: Cannot read properties of undefined (reading 'token')"));
assert(squeezedNode.includes("at handleAuth (C:\\project\\src\\auth.js:42:15)"));
assert(squeezedNode.includes("internal library frames collapsed for token economy"));
assert(!squeezedNode.includes("node_modules\\express\\lib\\router\\layer.js"));

const origLinesNode = nodeTrace.split('\n').length;
const newLinesNode = squeezedNode.split('\n').length;
assert(newLinesNode < origLinesNode, 'Squeezed trace must have fewer lines');
console.log(`  ✔ PASS: Node.js stack trace compressed (${origLinesNode} -> ${newLinesNode} lines, saved ${origLinesNode - newLinesNode} lines).`);

// Test 3: Python traceback squeezing
console.log('Test 3: Python traceback squeezing...');
const squeezedPy = squeezeStackTrace(pyTrace, 'C:\\project');
assert(squeezedPy.includes("Traceback (most recent call last):"));
assert(squeezedPy.includes('File "C:\\project\\main.py", line 12, in <module>'));
assert(squeezedPy.includes("internal library frames collapsed for token economy"));
assert(squeezedPy.includes("ZeroDivisionError: division by zero"));
assert(!squeezedPy.includes("site-packages\\werkzeug"));

const origLinesPy = pyTrace.split('\n').length;
const newLinesPy = squeezedPy.split('\n').length;
assert(newLinesPy < origLinesPy, 'Squeezed Python trace must have fewer lines');
console.log(`  ✔ PASS: Python traceback compressed (${origLinesPy} -> ${newLinesPy} lines, saved ${origLinesPy - newLinesPy} lines).`);

// Test 4: Squeeze mixed content in user prompts
console.log('Test 4: Mixed content squeezing...');
const mixedPrompt = `tolong perbaiki error berikut saat login:\n\n${nodeTrace}\n\nterima kasih banyak!`;
const mixedRes = squeezeMixedContent(mixedPrompt, 'C:\\project');
assert.strictEqual(mixedRes.hasTrace, true);
assert(mixedRes.linesSaved >= 4);
assert(mixedRes.squeezedText.includes("tolong perbaiki error berikut saat login:"));
assert(mixedRes.squeezedText.includes("terima kasih banyak!"));
assert(mixedRes.squeezedText.includes("internal library frames collapsed for token economy"));
console.log(`  ✔ PASS: Mixed prompt preserved while error trace was cleanly compacted (saved ${mixedRes.linesSaved} lines).`);

// Test 5: Output Token Economizer directive generation
console.log('Test 5: Output Token Economizer directive logic...');
const standardPrompt = "ubah warna tombol navbar menjadi biru";
const newFilePrompt1 = "buat file baru src/utils/helpers.js untuk format mata uang";
const newFilePrompt2 = "create a new file component/Button.tsx";

const standardDirective = generateEconomizerDirective(standardPrompt);
assert(standardDirective.includes("[GRAVITON RESPONSE ECONOMIZER]"));
assert(standardDirective.includes("DO NOT rewrite full files"));
assert(standardDirective.includes("Search/Replace"));

// Brand new files should bypass diff restriction
const newFileDirective1 = generateEconomizerDirective(newFilePrompt1);
assert.strictEqual(newFileDirective1, '');
const newFileDirective2 = generateEconomizerDirective(newFilePrompt2);
assert.strictEqual(newFileDirective2, '');

// rawOutput option should disable directive
const rawOutputDirective = generateEconomizerDirective(standardPrompt, { rawOutput: true });
assert.strictEqual(rawOutputDirective, '');
console.log('  ✔ PASS: Output Economizer directive correctly applies to edits and bypasses new file creation / rawOutput.');

// Test 6: Pipeline integration in constructSuperPrompt
console.log('Test 6: Pipeline integration of Squeezer & Economizer...');
const testWorkspace = path.join(os.tmpdir(), 'graviton_v260_test_' + Date.now());
fs.mkdirSync(testWorkspace, { recursive: true });

try {
  // Test prompt with embedded error trace
  const promptWithTrace = `ada bug di endpoint:\n${nodeTrace}`;
  const superPrompt = constructSuperPrompt(promptWithTrace, testWorkspace);

  assert(superPrompt.includes("[GRAVITON RESPONSE ECONOMIZER]"));
  assert(superPrompt.includes("internal library frames collapsed for token economy"));
  assert(!superPrompt.includes("layer.js:95:5")); // vendor frame pruned

  // Test with --no-squeeze
  const superPromptNoSqueeze = constructSuperPrompt(promptWithTrace, testWorkspace, { noSqueeze: true });
  assert(superPromptNoSqueeze.includes("layer.js:95:5")); // vendor frame retained

  // Test with --raw-output
  const superPromptRaw = constructSuperPrompt("edit server.js", testWorkspace, { rawOutput: true });
  assert(!superPromptRaw.includes("[GRAVITON RESPONSE ECONOMIZER]"));

  console.log('  ✔ PASS: Pipeline cleanly applies Stack Squeezer and Output Economizer directives.');
} finally {
  try {
    fs.rmSync(testWorkspace, { recursive: true, force: true });
  } catch {}
}

// Test 7: Doctor diagnostic check #12
console.log('Test 7: Doctor diagnostic check #12...');
const doc = runDoctor(process.cwd());
const check12 = doc.diagnostics.find(d => d.name === 'Stack Trace Squeezer & Output Economizer');
assert(check12, 'Diagnostic check #12 must be present');
assert.strictEqual(check12.status, 'ok');
console.log('  ✔ PASS: Doctor check #12 verified.');

console.log('\n---------------------------------------------------------------');
console.log('✔ ALL GRAVITON V2.6.0 SQUEEZER & ECONOMIZER TESTS PASSED 100%!');
console.log('---------------------------------------------------------------\n');
