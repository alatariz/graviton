// test/run_all.js - Graviton V3.0.0 Master Test Runner
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
  'test_v250_delta_compression.js',
  'test_v260_squeezer_and_economizer.js',
  'test_v270_defensive_io.js',
  'test_v280_syntax_and_daemon.js',
  'test_v290_e2e_stress.js',
  'test_v300_typo_and_progress.js',
  'test_fail_fast.js',
  'test_v310_budget_guard.js',
  'test_v320_sliding_window.js',
  'test_v330_ast_indexer.js',
  'test_v340_terminal_squeezer.js',
  'test_v350_prompt_architect.js',
  'test_v360_autonomous_overclock.js',
  'test_v370_ecosystem.js',
  'test_v380_cockpit_and_assets.js',
  'test_v390_pure_cockpit_and_scaffold.js',
  'test_v310_auto_compactor.js',
  'test_v311_live_runner.js',
  'test_v312_autonomous_router.js',
  'test_v313_model_selector.js',
  'test_v314_granular_undo_and_model_fix.js',
  'test_v315_dashboard_ide_api.js',
  'test_v316_ide_features.js',
  'test_v317_web_ide_streaming.js',
  'test_v400_synthetic_agi.js',
  'test_v410_design_intelligence.js',
  'test_v420_runtime_sentinel.js',
  'test_v430_live_researcher.js',
  'test_v440_adversarial_critic.js',
  'test_v450_code_property_graph.js',
  'test_v460_test_generator.js',
  'test_v470_symbolic_refactor.js',
  'test_v480_dead_code_cleaner.js',
  'test_v490_ambiguity_clarifier.js',
  'test_v500_unified_orchestrator.js',
  'test_v510_web_agent_tools.js'
];

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON MASTER TEST SUITE RUNNER');
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
    console.log('\x1b[32m✔  PASS\x1b[0m');
    passed++;
  } else {
    console.log('\x1b[31m✖  FAIL\x1b[0m');
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
  console.log('\x1b[1;32m✔  ALL GRAVITON TEST SUITES PASSED 100%!\x1b[0m\n');
  process.exit(0);
}
