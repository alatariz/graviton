// test/test_v370_ecosystem.js - Graviton V3.7.0 Developer Cockpit & Ecosystem Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  healCodeSyntax,
  healRelativeImports
} from '../src/self-healer.js';
import {
  buildDependencyGraph,
  formatAsciiGraph,
  getSurgicalContextFiles
} from '../src/dependency-graph.js';
import { bundleWebApplication } from '../src/bundler.js';
import { calculateEconomyMetrics, renderAsciiHud } from '../src/hud.js';

console.log('===============================================================');
console.log('   GRAVITON V3.7.0 DEVELOPER COCKPIT TEST SUITE');
console.log('===============================================================\n');

const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v370-test-'));

try {
  // [TEST 1] Syntax Self-Healing (Unclosed Brackets, Strings, JSON)
  console.log('[TEST 1] Testing syntax self-healing guard...');
  const brokenJs = `function calculateTotal(items) {
  if (!items) {
    return 0;
  return items.map(i => {
    return i.price * (1 + i.tax);`;

  const healedJs = healCodeSyntax(brokenJs, 'js');
  assert.strictEqual(healedJs.wasHealed, true, 'Must detect unclosed brackets');
  assert(healedJs.healedCode.endsWith('}'), 'Must auto-close trailing braces');
  assert(healedJs.issuesFixed.length > 0, 'Must record fixed issues');

  // JSON trailing commas and missing braces
  const brokenJson = '{\n  "name": "graviton",\n  "active": true,\n}';
  const healedJson = healCodeSyntax(brokenJson, 'json');
  assert.strictEqual(healedJson.wasHealed, true, 'Must heal trailing comma');
  assert.doesNotThrow(() => JSON.parse(healedJson.healedCode), 'Healed JSON must be valid');
  console.log('  ✔ PASS: Syntax self-healer auto-closes brackets and repairs JSON\n');

  // [TEST 2] Relative Import Extension Self-Healing
  console.log('[TEST 2] Testing relative import auto-healing...');
  const utilsFile = path.join(testDir, 'utils.js');
  fs.writeFileSync(utilsFile, 'export function helper() { return 42; }', 'utf8');

  const compDir = path.join(testDir, 'components');
  fs.mkdirSync(compDir, { recursive: true });
  fs.writeFileSync(path.join(compDir, 'index.js'), 'export const Card = {};', 'utf8');

  const mainFile = path.join(testDir, 'main.js');
  const rawImports = `import { helper } from './utils';\nimport { Card } from './components';\nconsole.log(helper());`;

  const healedImports = healRelativeImports(mainFile, rawImports, testDir);
  assert.strictEqual(healedImports.wasHealed, true, 'Must patch missing extensions');
  assert(healedImports.healedCode.includes("./utils.js"), 'Must append .js to utils');
  assert(healedImports.healedCode.includes("./components/index.js"), 'Must resolve directory index');
  console.log('  ✔ PASS: Relative import paths healed with correct file extensions\n');

  // [TEST 3] Autonomous Dependency Graph Extraction & DAG
  console.log('[TEST 3] Testing autonomous multi-file dependency graph...');
  const serviceFile = path.join(testDir, 'service.js');
  fs.writeFileSync(serviceFile, `import { helper } from './utils.js';\nexport function run() {}`, 'utf8');

  const appFile = path.join(testDir, 'app.js');
  fs.writeFileSync(appFile, `import { run } from './service.js';\nrun();`, 'utf8');

  const isolatedFile = path.join(testDir, 'standalone.js');
  fs.writeFileSync(isolatedFile, `console.log("isolated");`, 'utf8');

  const graph = buildDependencyGraph(testDir);
  assert(graph.fileCount >= 4, 'Must index all workspace source files');
  assert(graph.edgeCount >= 2, 'Must record import edges');
  assert(graph.entryPoints.includes('app.js'), 'app.js must be recognized as entry point');
  assert(graph.isolatedFiles.includes('standalone.js'), 'standalone.js must be recognized as isolated');

  const asciiGraph = formatAsciiGraph(graph);
  assert(asciiGraph.includes('app.js'), 'ASCII graph must show app.js');
  assert(asciiGraph.includes('service.js'), 'ASCII graph must show service.js');

  const surgicalContext = getSurgicalContextFiles('service.js', graph);
  assert(surgicalContext.includes('service.js'), 'Must include target file');
  assert(surgicalContext.includes('utils.js'), 'Must include downstream dependency');
  assert(surgicalContext.includes('app.js'), 'Must include upstream caller');
  assert(!surgicalContext.includes('standalone.js'), 'Must prune isolated file');
  console.log('  ✔ PASS: Dependency graph built, rendered, and surgical scoper verified\n');

  // [TEST 4] Zero-Setup Standalone App Bundler
  console.log('[TEST 4] Testing zero-setup standalone app bundler...');
  const webDir = path.join(testDir, 'my-web-game');
  fs.mkdirSync(webDir, { recursive: true });

  fs.writeFileSync(path.join(webDir, 'style.css'), 'body { background: #000; color: #fff; }', 'utf8');
  fs.writeFileSync(path.join(webDir, 'game.js'), 'console.log("Game Loaded!");', 'utf8');
  fs.writeFileSync(
    path.join(webDir, 'index.html'),
    `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
  <script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
</head>
<body>
  <h1>My 3D Game</h1>
  <script src="game.js"></script>
</body>
</html>`,
    'utf8'
  );

  const bundleRes = bundleWebApplication('index.html', 'dist/bundle.html', webDir);
  assert.strictEqual(bundleRes.success, true, 'Bundler must succeed');
  assert(fs.existsSync(bundleRes.outputPath), 'Bundled file must exist on disk');

  const bundledContent = fs.readFileSync(bundleRes.outputPath, 'utf8');
  assert(bundledContent.includes('<style data-inlined="style.css">'), 'CSS must be inlined');
  assert(bundledContent.includes('body { background: #000;'), 'CSS content must be present');
  assert(bundledContent.includes('data-inlined="game.js"'), 'JS must be inlined');
  assert(bundledContent.includes('console.log("Game Loaded!");'), 'JS content must be present');
  assert(bundledContent.includes('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js'), 'CDN scripts must be preserved');
  console.log('  ✔ PASS: Web app successfully bundled into standalone offline HTML\n');

  // [TEST 5] Live Economy HUD & Cost Calculations
  console.log('[TEST 5] Testing savings HUD & cost calculator...');
  const metrics = calculateEconomyMetrics({
    tokensSaved: 1_000_000,
    commandsRun: 120,
    promptsOptimized: 45,
    linesFiltered: 3500
  });

  assert.strictEqual(metrics.tokensSaved, 1_000_000, 'Must record tokens saved');
  assert.strictEqual(metrics.flashSavingsUsd, 0.075, 'Must calculate Gemini Flash savings at $0.075/1M');
  assert.strictEqual(metrics.proSavingsUsd, 1.25, 'Must calculate Gemini Pro savings at $1.25/1M');
  assert.strictEqual(metrics.idrSavings, 20_000, 'Must calculate IDR savings at 16k rate');

  const asciiHud = renderAsciiHud(metrics);
  assert(asciiHud.includes('DEVELOPER COCKPIT & ECONOMY HUD'), 'Must render HUD header');
  assert(asciiHud.includes('1,000,000 tokens'), 'Must display tokens');
  assert(asciiHud.includes('+$1.25 USD'), 'Must display Gemini Pro savings');
  console.log('  ✔ PASS: Economy HUD and currency conversions calculated accurately\n');

  console.log('---------------------------------------------------------------');
  console.log('✔ ALL V3.7.0 DEVELOPER COCKPIT TESTS PASSED 100%!');
  console.log('---------------------------------------------------------------\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
