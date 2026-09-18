// test/test_v380_cockpit_and_assets.js - Graviton V3.8.0 Developer Cockpit & Procedural Assets Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { server } from '../web/server.js';
import { synthesizeDomainEdgeCases } from '../src/cognitive-contract.js';
import { expandSparsePrompt } from '../src/prompt-architect.js';
import { calculateEconomyMetrics } from '../src/hud.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===============================================================');
console.log('   GRAVITON V3.8.0 COCKPIT & PROCEDURAL ASSET TEST SUITE');
console.log('===============================================================\n');

function httpGet(port, pathName) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}${pathName}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

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

async function runTests() {
  const TEST_PORT = 3998;

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    // [TEST 1] Root Route serves Developer Cockpit, not installation page
    console.log('[TEST 1] Testing / and /dashboard routes serve Developer Cockpit...');
    const resRoot = await httpGet(TEST_PORT, '/');
    assert.strictEqual(resRoot.status, 200, 'Root must return HTTP 200');
    assert(resRoot.body.includes('GRAVITON COCKPIT'), 'Root must be the Developer Cockpit');
    assert(resRoot.body.includes('Active Port Guard'), 'Cockpit must include Port Guard');
    assert(resRoot.body.includes('Zero-Setup Single-File Bundler'), 'Cockpit must include Bundler');
    assert(resRoot.body.includes('Autonomous Dependency Graph'), 'Cockpit must include Graph');

    const resDash = await httpGet(TEST_PORT, '/dashboard');
    assert.strictEqual(resDash.status, 200, '/dashboard must return HTTP 200');
    assert(resDash.body.includes('GRAVITON COCKPIT'), '/dashboard must serve the Cockpit');
    console.log('  ✔ PASS: / and /dashboard successfully serve the Developer Cockpit\n');

    // [TEST 2] Installation & Docs pages are preserved and accessible
    console.log('[TEST 2] Testing /landing.html and /docs.html routes...');
    const resLanding = await httpGet(TEST_PORT, '/landing.html');
    assert.strictEqual(resLanding.status, 200, '/landing.html must return HTTP 200');
    assert(resLanding.body.includes('Install Graviton'), '/landing.html must contain installation content');
    assert(resLanding.body.includes('Cockpit HUD'), '/landing.html must contain link back to Cockpit');

    const resDocs = await httpGet(TEST_PORT, '/docs.html');
    assert.strictEqual(resDocs.status, 200, '/docs.html must return HTTP 200');
    assert(resDocs.body.includes('Documentation'), '/docs.html must contain documentation content');
    assert(resDocs.body.includes('Cockpit HUD'), '/docs.html must contain link back to Cockpit');
    console.log('  ✔ PASS: /landing.html and /docs.html fully accessible with bidirectional links\n');

    // [TEST 3] Developer Cockpit REST APIs (HUD, Ports, Graph, Heal)
    console.log('[TEST 3] Testing Cockpit REST APIs...');
    const resHud = await httpGet(TEST_PORT, '/api/hud');
    assert.strictEqual(resHud.status, 200, '/api/hud must return 200');
    const hudJson = JSON.parse(resHud.body);
    assert('tokensSaved' in hudJson, 'HUD must contain tokensSaved');
    assert('flashSavingsUsd' in hudJson, 'HUD must contain flashSavingsUsd');
    assert('proSavingsUsd' in hudJson, 'HUD must contain proSavingsUsd');
    assert('idrSavings' in hudJson, 'HUD must contain idrSavings');
    assert('cacheHitPct' in hudJson, 'HUD must contain cacheHitPct');

    const resPorts = await httpGet(TEST_PORT, '/api/ports');
    assert.strictEqual(resPorts.status, 200, '/api/ports must return 200');
    assert(Array.isArray(JSON.parse(resPorts.body)), '/api/ports must return array');

    const resGraph = await httpGet(TEST_PORT, '/api/graph');
    assert.strictEqual(resGraph.status, 200, '/api/graph must return 200');
    const graphJson = JSON.parse(resGraph.body);
    assert(typeof graphJson.fileCount === 'number', 'Graph must report fileCount');

    const resHeal = await httpPost(TEST_PORT, '/api/heal', {
      filePath: 'test.js',
      code: 'function broken() { return 1;'
    });
    assert.strictEqual(resHeal.status, 200, '/api/heal must return 200');
    const healJson = JSON.parse(resHeal.body);
    assert.strictEqual(healJson.wasHealed, true, 'Must heal unclosed brace');
    assert(healJson.healedCode.endsWith('}'), 'Healed code must end with brace');
    console.log('  ✔ PASS: Cockpit REST APIs (/api/hud, /api/ports, /api/graph, /api/heal) operational\n');

    // [TEST 4] Procedural Asset & Audio Directives in Game Blueprints
    console.log('[TEST 4] Testing procedural texture & audio directives in game blueprints...');
    const minecraftCases = synthesizeDomainEdgeCases('voxel_minecraft', 'buat game minecraft web');
    assert(minecraftCases.some(c => c.includes('Procedural Canvas Textures') || c.includes('Zero 404s')), 'Minecraft domain must include zero-404 canvas texture directive');
    assert(minecraftCases.some(c => c.includes('Audio Synthesis') || c.includes('Web Audio')), 'Minecraft domain must include procedural audio directive');

    const gameCases = synthesizeDomainEdgeCases('game_dev', 'buat game cs2 fps');
    assert(gameCases.some(c => c.includes('Procedural Assets') || c.includes('Zero 404s')), 'Game dev domain must include zero-404 procedural asset directive');
    assert(gameCases.some(c => c.includes('Procedural Web Audio')), 'Game dev domain must include procedural audio directive');

    const expandedMc = expandSparsePrompt('buatkan game minecraft voxel 3d based on web', 'voxel_minecraft');
    assert(expandedMc.includes('Web Audio API sound generator') || expandedMc.includes('Procedural Web Audio'), 'Expanded prompt must mandate zero-dependency procedural audio');
    console.log('  ✔ PASS: Procedural asset & audio directives enforced in game contracts\n');

    console.log('---------------------------------------------------------------');
    console.log('✔ ALL GRAVITON V3.8.0 COCKPIT & ASSET TESTS PASSED 100%!');
    console.log('---------------------------------------------------------------\n');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
