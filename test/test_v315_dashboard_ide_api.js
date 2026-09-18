// test/test_v315_dashboard_ide_api.js - Graviton V3.15.0 Developer IDE Dashboard API Tests
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
console.log('   GRAVITON V3.15.0 DEVELOPER IDE DASHBOARD API TEST SUITE');
console.log('===============================================================\n');

function httpGet(port, pathName) {
  return new Promise((resolve, reject) => {
    const req = http.request(`http://localhost:${port}${pathName}`, { method: 'GET' }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) }));
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

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v315-test-'));

async function runTests() {
  const TEST_PORT = 3995;

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    // [TEST 1] Workspace directory inspection & switching
    console.log('[TEST 1] Testing workspace directory inspection and switching...');
    const wsRes = await httpGet(TEST_PORT, '/api/workspace');
    assert.strictEqual(wsRes.status, 200);
    assert.ok(wsRes.body.cwd, 'Default CWD should be returned');

    // Switch to temp directory
    const switchRes = await httpPost(TEST_PORT, '/api/workspace', { cwd: tmpBase });
    assert.strictEqual(switchRes.status, 200);
    assert.strictEqual(switchRes.body.success, true);
    assert.strictEqual(path.resolve(switchRes.body.cwd), path.resolve(tmpBase));

    // Non-existent directory handling
    const nonExistRes = await httpPost(TEST_PORT, '/api/workspace', { cwd: path.join(tmpBase, 'non_existent_folder_xyz') });
    assert.strictEqual(nonExistRes.status, 404);
    assert.strictEqual(nonExistRes.body.error.includes('Directory not found'), true);
    console.log('  ✔ PASS: Dynamic workspace directory inspection and switching verified\n');

    // [TEST 2] Conversation management endpoints (New, List, Rename, Select, Delete)
    console.log('[TEST 2] Testing conversation management endpoints...');
    const convsRes = await httpGet(TEST_PORT, `/api/conversations?cwd=${encodeURIComponent(tmpBase)}`);
    assert.strictEqual(convsRes.status, 200);
    assert.ok(Array.isArray(convsRes.body.conversations));

    // Create a mock conversation in tmpBase
    const convFile = path.join(tmpBase, '.graviton-conversations.json');
    const mockState = {
      activeId: 'test-uuid-1',
      conversations: [
        {
          id: 'test-uuid-1',
          title: 'Initial Test Chat',
          updatedAt: Date.now(),
          turns: 2,
          cumulativeTokens: 1500,
          lastPrompt: 'Hello Graviton',
          history: [
            { role: 'user', text: 'Hello Graviton', timestamp: Date.now() - 1000 }
          ]
        },
        {
          id: 'test-uuid-2',
          title: 'Second Test Chat',
          updatedAt: Date.now() - 2000,
          turns: 1,
          cumulativeTokens: 500,
          lastPrompt: 'Build app',
          history: [
            { role: 'user', text: 'Build app', timestamp: Date.now() - 2000 }
          ]
        }
      ]
    };
    fs.writeFileSync(convFile, JSON.stringify(mockState, null, 2), 'utf8');

    // Fetch updated conversations
    const updatedConvs = await httpGet(TEST_PORT, `/api/conversations?cwd=${encodeURIComponent(tmpBase)}`);
    assert.strictEqual(updatedConvs.body.conversations.length, 2);
    assert.strictEqual(updatedConvs.body.activeId, 'test-uuid-1');

    // Rename conversation
    const renameRes = await httpPost(TEST_PORT, '/api/conversations/rename', {
      cwd: tmpBase,
      id: 'test-uuid-1',
      title: 'Renamed Topic Title'
    });
    assert.strictEqual(renameRes.status, 200);
    assert.strictEqual(renameRes.body.success, true);
    assert.strictEqual(renameRes.body.conversation.title, 'Renamed Topic Title');

    // Switch active conversation
    const selectRes = await httpPost(TEST_PORT, '/api/conversations/select', {
      cwd: tmpBase,
      id: 'test-uuid-2'
    });
    assert.strictEqual(selectRes.status, 200);
    assert.strictEqual(selectRes.body.success, true);
    assert.strictEqual(selectRes.body.conversation.id, 'test-uuid-2');

    // Get conversation history
    const historyRes = await httpGet(TEST_PORT, `/api/conversation-history?cwd=${encodeURIComponent(tmpBase)}&id=test-uuid-2`);
    assert.strictEqual(historyRes.status, 200);
    assert.strictEqual(historyRes.body.id, 'test-uuid-2');
    assert.ok(Array.isArray(historyRes.body.turns));

    // Delete conversation
    const deleteRes = await httpPost(TEST_PORT, '/api/conversations/delete', {
      cwd: tmpBase,
      id: 'test-uuid-2'
    });
    assert.strictEqual(deleteRes.status, 200);
    assert.strictEqual(deleteRes.body.success, true);

    // Verify deleted
    const afterDelete = await httpGet(TEST_PORT, `/api/conversations?cwd=${encodeURIComponent(tmpBase)}`);
    assert.strictEqual(afterDelete.body.conversations.length, 1);
    console.log('  ✔ PASS: Conversation CRUD operations verified\n');

    // [TEST 3] Visual CLI commands (/api/command)
    console.log('[TEST 3] Testing visual CLI command endpoint...');
    
    // 3a. diff command
    const diffRes = await httpPost(TEST_PORT, '/api/command', { command: 'diff', cwd: tmpBase });
    assert.strictEqual(diffRes.status, 200);
    assert.strictEqual(diffRes.body.command, 'diff');
    assert.ok(typeof diffRes.body.output === 'string');

    // 3b. undo_list command
    const undoListRes = await httpPost(TEST_PORT, '/api/command', { command: 'undo_list', cwd: tmpBase });
    assert.strictEqual(undoListRes.status, 200);
    assert.ok(Array.isArray(undoListRes.body.items));

    // 3c. doctor command
    const docRes = await httpPost(TEST_PORT, '/api/command', { command: 'doctor', cwd: tmpBase });
    assert.strictEqual(docRes.status, 200);
    assert.ok(Array.isArray(docRes.body.diagnostics));
    assert.ok(typeof docRes.body.report === 'string');

    // 3d. stats command
    const statsRes = await httpPost(TEST_PORT, '/api/command', { command: 'stats', cwd: tmpBase });
    assert.strictEqual(statsRes.status, 200);
    assert.ok(statsRes.body.hud);
    assert.ok(statsRes.body.telemetry);

    // 3e. graph command
    const graphRes = await httpPost(TEST_PORT, '/api/command', { command: 'graph', cwd: tmpBase });
    assert.strictEqual(graphRes.status, 200);
    assert.ok(typeof graphRes.body.graph.fileCount === 'number');

    // 3f. ports command
    const portsRes = await httpPost(TEST_PORT, '/api/command', { command: 'ports', cwd: tmpBase });
    assert.strictEqual(portsRes.status, 200);
    assert.ok(Array.isArray(portsRes.body.ports));

    // 3g. version command
    const verRes = await httpPost(TEST_PORT, '/api/command', { command: 'version' });
    assert.strictEqual(verRes.status, 200);
    assert.ok(verRes.body.version);
    console.log('  ✔ PASS: Visual CLI commands executed and structured reports returned\n');

    // [TEST 4] Chat execution endpoint with Effort & Dry Run (/api/chat)
    console.log('[TEST 4] Testing /api/chat execution with Effort & Dry Run...');

    // Dry Run mode with Low effort
    const dryRunRes = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'Refactor calculatePayroll logic in payroll.js',
      effort: 'low',
      dryRun: true,
      cwd: tmpBase
    });
    assert.strictEqual(dryRunRes.status, 200);
    assert.strictEqual(dryRunRes.body.success, true);
    assert.strictEqual(dryRunRes.body.dryRun, true);
    assert.strictEqual(dryRunRes.body.modelRouting.agyEffort, 'low');
    assert.ok(dryRunRes.body.targetScope);
    assert.ok(dryRunRes.body.preFlight);

    // Dry Run mode with High effort
    const dryRunDeep = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'Build a comprehensive full-stack e-commerce system with auth and stripe',
      effort: 'high',
      dryRun: true,
      cwd: tmpBase
    });
    assert.strictEqual(dryRunDeep.status, 200);
    assert.strictEqual(dryRunDeep.body.modelRouting.agyEffort, 'high');
    assert.strictEqual(dryRunDeep.body.modelRouting.baseModel, 'gemini-3.1-pro');

    // Simulated test mode live execution
    const liveTestRes = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'Fix syntax error in index.html',
      effort: 'medium',
      dryRun: false,
      testMode: true,
      cwd: tmpBase
    });
    assert.strictEqual(liveTestRes.status, 200);
    assert.strictEqual(liveTestRes.body.success, true);
    assert.strictEqual(liveTestRes.body.execution.status, 'completed');
    console.log('  ✔ PASS: Chat execution with effort routing and dry-run verified\n');

    // [TEST 5] Open in CLI endpoint (/api/open-cli)
    console.log('[TEST 5] Testing /api/open-cli...');
    const cliRes = await httpPost(TEST_PORT, '/api/open-cli', {
      cwd: tmpBase,
      id: 'test-uuid-1',
      dryRun: true
    });
    assert.strictEqual(cliRes.status, 200);
    assert.strictEqual(cliRes.body.success, true);
    assert.strictEqual(cliRes.body.command, 'grav -c test-uuid-1');
    assert.strictEqual(path.resolve(cliRes.body.cwd), path.resolve(tmpBase));
    console.log('  ✔ PASS: Open in CLI external terminal payload verified\n');

    // [TEST 6] Zero Emoji & No "Cockpit" Verification
    console.log('[TEST 6] Testing zero emojis and no Cockpit mentions...');
    const htmlContent = fs.readFileSync(path.join(projectRoot, 'web', 'public', 'index.html'), 'utf8');
    const serverContent = fs.readFileSync(path.join(projectRoot, 'web', 'server.js'), 'utf8');

    // Test for common emoji Unicode ranges (Surrogate pairs / Emoji blocks)
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.strictEqual(emojiRegex.test(htmlContent), false, 'index.html must not contain emojis');
    assert.strictEqual(emojiRegex.test(serverContent), false, 'server.js must not contain emojis');

    // Assert no "Cockpit" in user-facing title or headings
    assert.strictEqual(htmlContent.includes('GRAVITON COCKPIT'), false, 'index.html must not use GRAVITON COCKPIT');
    assert.strictEqual(htmlContent.includes('Cockpit'), false, 'index.html must not contain the word Cockpit');
    assert.strictEqual(serverContent.includes('GRAVITON DEVELOPER COCKPIT ONLINE'), false, 'server.js banner must use DASHBOARD');
    console.log('  ✔ PASS: Zero emojis and clean DASHBOARD branding verified\n');

    console.log('===============================================================');
    console.log('  ✔  ALL 6 TESTS IN DEVELOPER IDE DASHBOARD SUITE PASSED (100%)');
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
