// test/test_v510_web_agent_tools.js - Graviton V5.1.0 Web Agent Tools & Autonomous Integration Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { fileURLToPath } from 'url';
import { server } from '../web/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('===============================================================');
console.log('   GRAVITON V5.1.0 WEB AGENT & AUTONOMOUS TOOLS TEST SUITE');
console.log('===============================================================\n');

function httpPost(port, pathName, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(`http://localhost:${port}${pathName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v510-test-'));

async function runTests() {
  const TEST_PORT = 3999;

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    // Setup mock project in tmpBase
    const srcDir = path.join(tmpBase, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    const sampleFile = path.join(srcDir, 'math-utils.js');
    fs.writeFileSync(sampleFile, `
import fs from 'fs';
import path from 'path'; // unused import

export function computeSum(a, b) {
  return a + b;
}

export function computeProduct(a, b) {
  return a * b;
}
`, 'utf8');

    const consumerFile = path.join(srcDir, 'app.js');
    fs.writeFileSync(consumerFile, `
import { computeSum } from './math-utils.js';

export function runMain() {
  return computeSum(10, 20);
}
`, 'utf8');

    // [TEST 1] POST /api/command with 'check' (Unified diagnostic check)
    console.log('[TEST 1] Testing /api/command with "check"...');
    const checkRes = await httpPost(TEST_PORT, '/api/command', { command: 'check', cwd: tmpBase });
    assert.strictEqual(checkRes.status, 200);
    assert.strictEqual(checkRes.body.command, 'check');
    assert.ok(checkRes.body.report, 'Report should be returned');
    assert.ok(typeof checkRes.body.formatted === 'string', 'Formatted report should be string');
    assert.ok('sentinel' in checkRes.body.report, 'Sentinel report should be included');
    assert.ok('critic' in checkRes.body.report, 'Critic report should be included');
    assert.ok('deadCode' in checkRes.body.report, 'DeadCode report should be included');
    assert.ok('cpg' in checkRes.body.report, 'CPG report should be included');
    console.log('  ✔ PASS: Unified Health Check command executed successfully\n');

    // [TEST 2] POST /api/command with 'deadcode' and 'prune'
    console.log('[TEST 2] Testing /api/command with "deadcode" and "prune"...');
    const deadRes = await httpPost(TEST_PORT, '/api/command', { command: 'deadcode', cwd: tmpBase });
    assert.strictEqual(deadRes.status, 200);
    assert.strictEqual(deadRes.body.command, 'deadcode');
    assert.ok(deadRes.body.audit);
    assert.ok(deadRes.body.audit.totalDeadItems >= 1, 'Should find unused path import');

    const pruneRes = await httpPost(TEST_PORT, '/api/command', { command: 'prune', cwd: tmpBase });
    assert.strictEqual(pruneRes.status, 200);
    assert.strictEqual(pruneRes.body.command, 'prune');
    assert.ok(pruneRes.body.result);
    assert.ok(pruneRes.body.result.symbolsPruned >= 1, 'Should prune unused symbol');
    console.log('  ✔ PASS: Dead code audit and one-click pruning verified\n');

    // [TEST 3] POST /api/command with 'blast'
    console.log('[TEST 3] Testing /api/command with "blast"...');
    const blastRes = await httpPost(TEST_PORT, '/api/command', {
      command: 'blast',
      cwd: tmpBase,
      args: { target: 'src/math-utils.js' }
    });
    assert.strictEqual(blastRes.status, 200);
    assert.strictEqual(blastRes.body.command, 'blast');
    assert.ok(blastRes.body.report);
    assert.ok(typeof blastRes.body.formatted === 'string');
    assert.ok(blastRes.body.report.directConsumers.length >= 1, 'Should identify app.js as consumer');
    console.log('  ✔ PASS: Blast radius calculation and formatting verified\n');

    // [TEST 4] POST /api/command with 'gentest'
    console.log('[TEST 4] Testing /api/command with "gentest"...');
    const gentestRes = await httpPost(TEST_PORT, '/api/command', {
      command: 'gentest',
      cwd: tmpBase,
      args: { target: sampleFile }
    });
    assert.strictEqual(gentestRes.status, 200);
    assert.strictEqual(gentestRes.body.command, 'gentest');
    assert.ok(gentestRes.body.testFilePath);
    assert.ok(fs.existsSync(gentestRes.body.testFilePath), 'Generated test file must exist on disk');
    assert.ok(gentestRes.body.testCount >= 1, 'Should map exported functions');
    console.log('  ✔ PASS: Deterministic test scaffold generation verified\n');

    // [TEST 5] POST /api/command with 'refactor_plan' and 'refactor_apply'
    console.log('[TEST 5] Testing /api/command with "refactor_plan" & "refactor_apply"...');
    const planRes = await httpPost(TEST_PORT, '/api/command', {
      command: 'refactor_plan',
      cwd: tmpBase,
      args: {
        file: sampleFile,
        oldSymbol: 'computeSum',
        newSymbol: 'calculateTotalSum'
      }
    });
    assert.strictEqual(planRes.status, 200);
    assert.strictEqual(planRes.body.command, 'refactor_plan');
    assert.ok(planRes.body.plan);
    assert.ok(planRes.body.plan.filesToUpdate.length >= 2, 'Should find definition in math-utils and call in app.js');
    assert.ok(planRes.body.plan.totalReplacements >= 2, 'Should map at least 2 replacement locations');

    const applyRes = await httpPost(TEST_PORT, '/api/command', {
      command: 'refactor_apply',
      cwd: tmpBase,
      args: {
        file: sampleFile,
        oldSymbol: 'computeSum',
        newSymbol: 'calculateTotalSum'
      }
    });
    assert.strictEqual(applyRes.status, 200);
    assert.strictEqual(applyRes.body.command, 'refactor_apply');
    assert.ok(applyRes.body.result.filesModified >= 2, 'Both files should be updated');
    const appContent = fs.readFileSync(consumerFile, 'utf8');
    assert.ok(appContent.includes('calculateTotalSum'), 'Consumer file must use new symbol');
    console.log('  ✔ PASS: AST-guided symbol refactoring planned and applied successfully\n');

    // [TEST 6] POST /api/command with 'clarify'
    console.log('[TEST 6] Testing /api/command with "clarify"...');
    const clarifyRes = await httpPost(TEST_PORT, '/api/command', {
      command: 'clarify',
      cwd: tmpBase,
      args: { prompt: 'bikin auth user' }
    });
    assert.strictEqual(clarifyRes.status, 200);
    assert.strictEqual(clarifyRes.body.command, 'clarify');
    assert.ok(clarifyRes.body.analysis.isAmbiguous, 'Short prompt should be detected as ambiguous');
    assert.ok(typeof clarifyRes.body.specification === 'string');
    console.log('  ✔ PASS: Prompt ambiguity clarification endpoint verified\n');

    console.log('---------------------------------------------------------------');
    console.log('✔  ALL V5.1.0 WEB AGENT & AUTONOMOUS TOOLS TESTS PASSED!');
    console.log('---------------------------------------------------------------\n');
  } finally {
    await new Promise(resolve => server.close(resolve));
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch(err => {
  console.error('\n✖ TEST FAILED:', err);
  process.exit(1);
});
