// test/run_all.js - Graviton V2.0.0 Master Test Runner
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testFiles = [
  'test_reprompt.js',
  'test_v185.js',
  'test_v190_port_guard.js',
  'test_v190_rollback.js',
  'test_v200_context_scoper.js',
  'test_v200_sanity_guard.js',
  'test_v200_session_compactor.js',
  'test_v200_doctor_diff.js',
  'test_v200_conversation_manager.js',
  'test_v201_dev_server_guard.js',
  'test_v210_clipboard.js',
  'test_v210_shield_and_downscaler.js',
  'test_v220_data_and_office_transpiler.js',
  'test_v230_pdf_pptx_and_cache.js',
  'test_v240_code_skeletonizer.js',
  'test_v250_delta_compression.js'
];

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V2.5.0 MASTER TEST SUITE RUNNER');
console.log('===============================================================\x1b[0m\n');

let passed = 0;
let failed = 0;

for (const file of testFiles) {
  const filePath = path.join(__dirname, file);
  process.stdout.write(`\x1b[90mRunning ${file}...\x1b[0m `);
  
  const result = spawnSync(process.execPath, [filePath], {
    cwd: path.dirname(__dirname),
    stdio: 'pipe',
    encoding: 'utf8'
  });

  if (result.status === 0) {
    console.log('\x1b[32m✔ PASS\x1b[0m');
    passed++;
  } else {
    console.log('\x1b[31m✖ FAIL\x1b[0m');
    const combinedOutput = ((result.stdout || '') + '\n' + (result.stderr || '')).trim();
    const encoded = combinedOutput.replace(/\r?\n/g, '%0A');
    console.error(`::error file=${file},title=TestFailed::${encoded}`);
    if (result.stdout) console.log(result.stdout);
    if (result.stderr) console.error(result.stderr);
    failed++;
  }
}

console.log('\n\x1b[1m---------------------------------------------------------------\x1b[0m');
console.log(`Final Result: \x1b[32m${passed} passed\x1b[0m, \x1b[${failed > 0 ? '31' : '32'}m${failed} failed\x1b[0m (${testFiles.length} total suites)`);
console.log('\x1b[1m---------------------------------------------------------------\x1b[0m\n');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[1;32m✔ ALL GRAVITON V2.5.0 TEST SUITES PASSED 100%!\x1b[0m\n');
  process.exit(0);
}
