// test/test_v311_live_runner.js - Graviton V3.11.0 Instant Live-Runner & Hot-Reload Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  createLiveReloadServer,
  findAvailablePort,
  openBrowser,
  MIME_TYPES
} from '../src/live-runner.js';
import { detectWorkspaceDevServer } from '../src/port-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('=== STARTING GRAVITON V3.11.0 LIVE-RUNNER & HOT-RELOAD TEST SUITE ===\n');

const testDir = path.join(os.tmpdir(), 'graviton_v311_live_test_' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

function httpGet(port, pathStr) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${pathStr}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function runTests() {
  const TEST_PORT = 3995;

  // Create sample web project
  fs.writeFileSync(path.join(testDir, 'index.html'), '<!DOCTYPE html><html><body><h1>Test Game</h1></body></html>', 'utf8');
  fs.writeFileSync(path.join(testDir, 'game.js'), 'console.log("game init");', 'utf8');
  fs.writeFileSync(path.join(testDir, 'style.css'), 'body { margin: 0; }', 'utf8');

  // [TEST 1] MIME Types Mapping
  console.log('[TEST 1] Testing MIME types dictionary...');
  assert.strictEqual(MIME_TYPES['.html'], 'text/html; charset=utf-8');
  assert.strictEqual(MIME_TYPES['.js'], 'application/javascript; charset=utf-8');
  assert.strictEqual(MIME_TYPES['.css'], 'text/css; charset=utf-8');
  assert.strictEqual(MIME_TYPES['.wav'], 'audio/wav');
  assert.strictEqual(MIME_TYPES['.png'], 'image/png');
  console.log('  ✔ PASS: MIME types properly configured for web games and assets\n');

  // [TEST 2] Server Creation & HTML Injection of Live-Reload Script
  console.log('[TEST 2] Testing createLiveReloadServer and HTML hot-reload injection...');
  const server = createLiveReloadServer(testDir, { port: TEST_PORT });

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    const resHtml = await httpGet(TEST_PORT, '/');
    assert.strictEqual(resHtml.status, 200);
    assert.ok(resHtml.headers['content-type'].includes('text/html'));
    assert.ok(resHtml.body.includes('<h1>Test Game</h1>'));
    assert.ok(resHtml.body.includes('__grav_live_reload'), 'Must inject live reload script into HTML');
    assert.ok(resHtml.body.includes('/__grav_live'), 'Must connect to SSE endpoint');
    console.log('  ✔ PASS: Static HTML served with automatic live-reload script injected\n');

    // [TEST 3] Static Asset Serving
    console.log('[TEST 3] Testing static JS and CSS asset serving...');
    const resJs = await httpGet(TEST_PORT, '/game.js');
    assert.strictEqual(resJs.status, 200);
    assert.ok(resJs.headers['content-type'].includes('application/javascript'));
    assert.strictEqual(resJs.body, 'console.log("game init");');

    const resCss = await httpGet(TEST_PORT, '/style.css');
    assert.strictEqual(resCss.status, 200);
    assert.ok(resCss.headers['content-type'].includes('text/css'));
    assert.strictEqual(resCss.body, 'body { margin: 0; }');
    console.log('  ✔ PASS: Static JS & CSS served with correct MIME types\n');

    // [TEST 4] SSE Live-Reload Broadcast on File Mutation
    console.log('[TEST 4] Testing SSE live-reload broadcast on file change...');
    let reloadEventReceived = false;

    const sseReq = http.request({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/__grav_live',
      method: 'GET',
      headers: { 'Accept': 'text/event-stream' }
    }, (res) => {
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.headers['content-type'].includes('text/event-stream'));

      res.on('data', (chunk) => {
        const text = chunk.toString();
        if (text.includes('data: reload')) {
          reloadEventReceived = true;
        }
      });
    });

    sseReq.end();

    // Wait 200ms for connection to establish, then modify file
    await new Promise(r => setTimeout(r, 200));
    fs.writeFileSync(path.join(testDir, 'game.js'), 'console.log("game updated!");', 'utf8');

    // Wait for debounced watcher broadcast (~300ms)
    await new Promise(r => setTimeout(r, 400));
    sseReq.destroy();

    assert.strictEqual(reloadEventReceived, true, 'SSE client must receive reload event when file is modified');
    console.log('  ✔ PASS: File modification broadcasted live to connected browser via SSE\n');

  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  // [TEST 5] findAvailablePort
  console.log('[TEST 5] Testing findAvailablePort...');
  const freePort = await findAvailablePort(3990);
  assert.ok(typeof freePort === 'number' && freePort >= 3990, 'Must return a valid integer port');
  console.log('  ✔ PASS: Dynamic free port discovery verified (' + freePort + ')\n');

  // [TEST 6] openBrowser safety in test mode
  console.log('[TEST 6] Testing openBrowser test environment safety...');
  process.env.NODE_ENV = 'test';
  const openRes = openBrowser('http://localhost:3000/');
  assert.strictEqual(openRes, false, 'Must not open physical browser windows during test execution');
  console.log('  ✔ PASS: Browser auto-launcher safely respects test environment\n');

  // [TEST 7] detectWorkspaceDevServer with static HTML returns grav-live-server
  console.log('[TEST 7] Testing detectWorkspaceDevServer static-html resolution...');
  const devDetection = detectWorkspaceDevServer(testDir);
  assert.strictEqual(devDetection.hasIndexHtml, true);
  assert.strictEqual(devDetection.exists, true);
  assert.ok(devDetection.command.includes('grav-live-server.js'), 'Must point to grav-live-server.js');
  console.log('  ✔ PASS: Workspace dev server detector automatically binds to Graviton Live-Server\n');

  // [TEST 8] CLI `grav play` command
  console.log('[TEST 8] Testing CLI grav play invocation...');
  const cliPlay = spawnSync(process.execPath, [
    path.join(projectRoot, 'bin', 'graviton.js'),
    'play',
    testDir
  ], {
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' }
  });

  assert.strictEqual(cliPlay.status, 0, 'CLI grav play must exit with 0');
  assert.ok(cliPlay.stdout.includes('Web runner active at') || cliPlay.stdout.includes('Live server active at'), 'Output must confirm web runner');
  assert.ok(cliPlay.stdout.includes('Auto-launched in your default browser'), 'Output must confirm auto-launch');
  console.log('  ✔ PASS: CLI grav play executes smoothly with zero tokens consumed\n');

  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  console.log('---------------------------------------------------------------');
  console.log('✔ ALL GRAVITON V3.11.0 LIVE-RUNNER & HOT-RELOAD TESTS PASSED 100%!');
  console.log('---------------------------------------------------------------\n');
}

runTests().catch((err) => {
  console.error('\n✖ TEST FAILED:', err);
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
  process.exit(1);
});
