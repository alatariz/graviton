// test/test_v316_ide_features.js - Graviton V3.16.0 Developer IDE & Fast/Grav/Deep Suite
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
console.log('   GRAVITON V3.16.0 DEVELOPER IDE & FAST/GRAV/DEEP TEST SUITE');
console.log('===============================================================\n');

function httpGet(port, pathName) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${port}${pathName}`, { method: 'GET' }, res => {
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
    req.end();
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

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v316-test-'));

async function runTests() {
  const TEST_PORT = 3994;

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    // [TEST 1] Native OS Folder Picker & Explorer Reveal APIs
    console.log('[TEST 1] Testing /api/pick-folder & /api/reveal-folder...');
    const pickRes = await httpPost(TEST_PORT, '/api/pick-folder', { mockPath: tmpBase });
    assert.strictEqual(pickRes.status, 200);
    assert.strictEqual(pickRes.body.success, true);
    assert.strictEqual(path.resolve(pickRes.body.cwd), path.resolve(tmpBase));

    const revealRes = await httpPost(TEST_PORT, '/api/reveal-folder', { cwd: tmpBase });
    assert.strictEqual(revealRes.status, 200);
    assert.strictEqual(revealRes.body.success, true);
    console.log('  ✔ PASS: Folder picker and explorer reveal endpoints verified\n');

    // [TEST 2] Fast, Grav, Deep Effort Mapping in /api/chat
    console.log('[TEST 2] Testing Fast, Grav, Deep effort routing in /api/chat...');
    
    // 2a. Fast effort
    const fastRes = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'Quick check of app syntax',
      effort: 'fast',
      dryRun: true,
      cwd: tmpBase
    });
    assert.strictEqual(fastRes.status, 200);
    assert.strictEqual(fastRes.body.effortName, 'Fast');
    assert.strictEqual(fastRes.body.modelRouting.agyEffort, 'low');

    // 2b. Grav effort (balanced default)
    const gravRes = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'Refactor calculateInvoice function',
      effort: 'grav',
      dryRun: true,
      cwd: tmpBase
    });
    assert.strictEqual(gravRes.status, 200);
    assert.strictEqual(gravRes.body.effortName, 'Grav');
    assert.strictEqual(gravRes.body.modelRouting.agyEffort, 'high'); // for gemini-3.1-pro architectural or normal

    // 2c. Deep effort
    const deepRes = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'Architect a multi-tenant microservices architecture with kubernetes',
      effort: 'deep',
      dryRun: true,
      cwd: tmpBase
    });
    assert.strictEqual(deepRes.status, 200);
    assert.strictEqual(deepRes.body.effortName, 'Deep');
    assert.strictEqual(deepRes.body.modelRouting.agyEffort, 'high');
    console.log('  ✔ PASS: Fast, Grav, Deep effort controls mapped correctly\n');

    // [TEST 3] CLI Telemetry & Odometer Synchronization in /api/hud
    console.log('[TEST 3] Testing Odometer and Telemetry synchronization in /api/hud...');
    const hudRes = await httpGet(TEST_PORT, '/api/hud');
    assert.strictEqual(hudRes.status, 200);
    assert.ok(hudRes.body.odometer, 'HUD must include odometer data');
    assert.ok(typeof hudRes.body.odometer.totalTokens === 'number', 'Total tokens must be a number');
    assert.ok(hudRes.body.telemetry, 'HUD must include local telemetry data');
    console.log('  ✔ PASS: HUD returns synchronized odometer and telemetry directly\n');

    // [TEST 4] Verification of HTML IDE layout: Menubar, Splitters, and Fast/Grav/Deep buttons
    console.log('[TEST 4] Testing index.html IDE layout elements and zero emojis...');
    const html = fs.readFileSync(path.join(projectRoot, 'web', 'public', 'index.html'), 'utf8');

    // Menus exist
    assert.ok(html.includes('id="menuFile"'), 'File menu must exist');
    assert.ok(html.includes('id="menuEdit"'), 'Edit menu must exist');
    assert.ok(html.includes('id="menuView"'), 'View menu must exist');
    assert.ok(html.includes('id="menuTerminal"'), 'Terminal menu must exist');
    assert.ok(html.includes('id="menuHelp"'), 'Help menu must exist');

    // Resizers exist
    assert.ok(html.includes('id="sidebarResizer"'), 'Horizontal sidebar resizer must exist');
    assert.ok(html.includes('id="bottomDrawerResizer"'), 'Vertical bottom drawer resizer must exist');

    // Effort buttons exist: Fast, Grav, Deep
    assert.ok(html.includes('id="effortFast"'), 'Fast effort button must exist');
    assert.ok(html.includes('id="effortGrav"'), 'Grav effort button must exist');
    assert.ok(html.includes('id="effortDeep"'), 'Deep effort button must exist');

    // Confirm "Low", "Medium", "High" are removed from the effort buttons
    assert.strictEqual(html.includes('Low (-f)'), false, 'Old Low label must be removed');
    assert.strictEqual(html.includes('Medium (Default)'), false, 'Old Medium label must be removed');
    assert.strictEqual(html.includes('High (-d)'), false, 'Old High label must be removed');

    // Zero Emojis
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.strictEqual(emojiRegex.test(html), false, 'index.html must not contain any emojis');
    // [TEST 5] Multi-Turn Chat Continuation in /api/chat
    console.log('[TEST 5] Testing conversation continuity and token metrics in /api/chat...');
    const firstChat = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'First prompt in session',
      cwd: tmpBase,
      testMode: true
    });
    assert.strictEqual(firstChat.status, 200);
    assert.ok(firstChat.body.conversationId, 'Initial chat must return a conversationId');
    assert.ok(typeof firstChat.body.sessionTokens === 'number', 'Must return sessionTokens');
    assert.ok(typeof firstChat.body.lifetimeTokens === 'number', 'Must return lifetimeTokens');
    const assignedConvId = firstChat.body.conversationId;

    // Send reply specifying the active conversationId
    const replyChat = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'Replying to the same conversation',
      conversationId: assignedConvId,
      cwd: tmpBase,
      testMode: true
    });
    assert.strictEqual(replyChat.status, 200);
    assert.strictEqual(replyChat.body.conversationId, assignedConvId, 'Replying must retain the exact same conversationId and NOT create a new chat');
    assert.ok(replyChat.body.sessionTokens >= firstChat.body.sessionTokens, 'Session tokens must accumulate');

    // Verify /api/conversation-history returns both turns (user + assistant)
    const historyRes = await httpGet(TEST_PORT, `/api/conversation-history?cwd=${encodeURIComponent(tmpBase)}&id=${encodeURIComponent(assignedConvId)}`);
    assert.strictEqual(historyRes.status, 200);
    assert.ok(historyRes.body.turns.length >= 2, 'History must contain user and assistant turns');
    const roles = historyRes.body.turns.map(t => t.role);
    assert.ok(roles.includes('user'), 'Must contain user turns');
    assert.ok(roles.includes('assistant'), 'Must contain assistant turns');
    console.log('  ✔ PASS: Multi-turn conversation continuity and two-way turns verified\n');

    // [TEST 6] Verification of Browse button and Token Badge UI elements
    console.log('[TEST 6] Testing Browse button and token badges in index.html...');
    assert.ok(html.includes('browseWorkspaceFolder()'), 'Browse button must call browseWorkspaceFolder()');
    assert.ok(html.includes('id="activeChatTokens"'), 'Chat header must contain activeChatTokens badge');
    assert.ok(html.includes('id="statusbarTokens"'), 'Status bar must contain statusbarTokens');
    assert.ok(html.includes('.turn-token-footer'), 'turn-token-footer CSS class must exist');
    console.log('  ✔ PASS: Browse button and token odometer UI elements verified\n');

    console.log('===============================================================');
    console.log('  ✔  ALL 6 TESTS IN DEVELOPER IDE SUITE PASSED (100%)');
    console.log('===============================================================\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch(err => {
  console.error('\n✖ TEST FAILED:', err);
  process.exit(1);
});
