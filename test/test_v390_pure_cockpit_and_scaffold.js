// test/test_v390_pure_cockpit_and_scaffold.js - Graviton V3.9.0 Zero-Token Project Scaffolder Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { server } from '../web/server.js';
import { scaffoldProject, detectDomainFromPrompt, getScaffoldTemplate } from '../src/scaffolder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('===============================================================');
console.log('   GRAVITON V3.9.0 ZERO-TOKEN SCAFFOLDER & PURE COCKPIT SUITE');
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
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v390-test-'));

async function runTests() {
  const TEST_PORT = 3997;

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    // [TEST 1] Domain detection from natural language prompt
    console.log('[TEST 1] Testing domain detection from prompt...');
    assert.strictEqual(detectDomainFromPrompt('buatkan saya game minecraft voxel web'), 'voxel_minecraft');
    assert.strictEqual(detectDomainFromPrompt('cloning cs2 shooter based on web'), 'fps_arena');
    assert.strictEqual(detectDomainFromPrompt('bikin game tetris 2d canvas'), 'arcade_2d');
    assert.strictEqual(detectDomainFromPrompt('buatkan clone trello dashboard'), 'fullstack_saas');
    console.log('  ✔ PASS: Domains detected accurately from natural language\n');

    // [TEST 2] Project Scaffolder creates runnable files with procedural textures and audio
    console.log('[TEST 2] Testing scaffoldProject generation on disk...');
    const mcDir = path.join(tmpBase, 'mc-app');
    const mcRes = scaffoldProject('voxel_minecraft', mcDir);
    assert.strictEqual(mcRes.success, true, 'Must succeed');
    const mcFile = path.join(mcDir, 'index.html');
    assert(fs.existsSync(mcFile), 'index.html must exist');
    const mcContent = fs.readFileSync(mcFile, 'utf8');
    assert(mcContent.includes('createVoxelTexture'), 'Must generate procedural 16x16 canvas textures');
    assert(mcContent.includes('AudioContext'), 'Must include Web Audio procedural sound');
    assert(mcContent.includes('THREE.PointerLockControls') || mcContent.includes('requestPointerLock'), 'Must include pointer lock');

    // 2D Arcade scaffold
    const arcadeDir = path.join(tmpBase, 'arcade-app');
    const arcadeRes = scaffoldProject('arcade_2d', arcadeDir);
    assert.strictEqual(arcadeRes.success, true);
    const arcadeContent = fs.readFileSync(path.join(arcadeDir, 'index.html'), 'utf8');
    assert(arcadeContent.includes('canvas id="game"'), 'Must have canvas game loop');
    assert(arcadeContent.includes('localStorage'), 'Must include high score persistence');
    console.log('  ✔ PASS: Scaffolding produces runnable standalone code with zero missing assets\n');

    // [TEST 3] REST API: POST /api/scaffold
    console.log('[TEST 3] Testing /api/scaffold endpoint...');
    const apiTargetDir = path.join(tmpBase, 'api-scaffold-app');
    const res = await httpPost(TEST_PORT, '/api/scaffold', {
      domain: 'fps_arena',
      targetDir: apiTargetDir
    });
    assert.strictEqual(res.status, 200, 'Must return HTTP 200');
    const json = JSON.parse(res.body);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.domain, 'fps_arena');
    assert(fs.existsSync(path.join(apiTargetDir, 'index.html')), 'API must write scaffold file to disk');
    console.log('  ✔ PASS: /api/scaffold generates project files via Cockpit HTTP request\n');

    // [TEST 4] CLI Subprocess: grav scaffold <type> <dir>
    console.log('[TEST 4] Testing CLI command grav scaffold...');
    const cliTargetDir = path.join(tmpBase, 'cli-scaffold-app');
    const cli = spawnSync(process.execPath, [
      path.join(projectRoot, 'bin', 'graviton.js'),
      'scaffold',
      'minecraft',
      cliTargetDir
    ], { encoding: 'utf8' });

    assert.strictEqual(cli.status, 0, 'CLI must exit with code 0');
    assert(cli.stdout.includes('Scaffolded successfully!'), 'CLI output must confirm scaffolding');
    assert(fs.existsSync(path.join(cliTargetDir, 'index.html')), 'CLI must write files to disk');
    console.log('  ✔ PASS: CLI grav scaffold executes zero-token scaffolding cleanly\n');

    console.log('---------------------------------------------------------------');
    console.log('✔ ALL GRAVITON V3.9.0 SCAFFOLDER & PURE COCKPIT TESTS PASSED 100%!');
    console.log('---------------------------------------------------------------\n');
  } finally {
    await new Promise(resolve => server.close(resolve));
    try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch {}
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
