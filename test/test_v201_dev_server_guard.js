// test/test_v201_dev_server_guard.js
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { detectWorkspaceDevServer } from '../src/port-guard.js';

console.log('=== STARTING V2.0.1 DEV SERVER AUTO-DAEMON TEST SUITE ===\n');

const tmpDir = path.join(os.tmpdir(), `graviton-dev-test-${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });

try {
  // TEST 1: detect server.js with custom PORT
  console.log('[TEST 1] Detect server.js with custom PORT');
  const serverCode = `
    const http = require('http');
    const PORT = process.env.PORT || 8080;
    const server = http.createServer((req, res) => res.end('OK'));
    server.listen(PORT);
  `;
  fs.writeFileSync(path.join(tmpDir, 'server.js'), serverCode, 'utf8');

  const detected1 = detectWorkspaceDevServer(tmpDir);
  assert.strictEqual(detected1.exists, true, 'Server.js must exist');
  assert.strictEqual(detected1.command, 'node server.js');
  assert.strictEqual(detected1.port, 8080, 'Must detect port 8080');
  assert.strictEqual(detected1.type, 'node-server');
  console.log('  ✔ Correctly detected server.js with port ' + detected1.port);

  // TEST 2: detect package.json with vite
  console.log('\n[TEST 2] Detect package.json with Vite');
  fs.unlinkSync(path.join(tmpDir, 'server.js'));
  const pkgVite = {
    name: 'test-vite',
    scripts: { dev: 'vite' },
    devDependencies: { vite: '^5.0.0' }
  };
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgVite), 'utf8');

  const detected2 = detectWorkspaceDevServer(tmpDir);
  assert.strictEqual(detected2.exists, true);
  assert.strictEqual(detected2.command, 'npm run dev');
  assert.strictEqual(detected2.port, 5173, 'Vite dev server defaults to 5173');
  assert.strictEqual(detected2.type, 'vite');
  console.log('  ✔ Correctly detected Vite project with port ' + detected2.port);

  // TEST 3: detect static HTML
  console.log('\n[TEST 3] Detect static index.html');
  fs.unlinkSync(path.join(tmpDir, 'package.json'));
  fs.writeFileSync(path.join(tmpDir, 'index.html'), '<h1>Hello</h1>', 'utf8');

  const detected3 = detectWorkspaceDevServer(tmpDir);
  assert.strictEqual(detected3.hasIndexHtml, true);
  assert.strictEqual(detected3.type, 'static-html');
  console.log('  ✔ Correctly identified static HTML project');

  console.log('\n=== ALL V2.0.1 DEV SERVER TESTS PASSED! ===\n');
} finally {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}
