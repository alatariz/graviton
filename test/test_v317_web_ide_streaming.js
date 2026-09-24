// test/test_v317_web_ide_streaming.js - Graviton V3.17.0 Streaming & Anti-Splitting Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { fileURLToPath } from 'url';
import { server } from '../web/server.js';
import { extractCleanAssistantResponse } from '../bin/graviton-relay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

console.log('===============================================================');
console.log('   GRAVITON V3.17.0 WEB IDE STREAMING & CONTINUITY TEST SUITE');
console.log('===============================================================\n');

function httpPostStream(port, pathName, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request(`http://localhost:${port}${pathName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let rawData = '';
      const events = [];
      res.on('data', chunk => {
        const text = chunk.toString();
        rawData += text;
        const lines = text.split(/\r?\n/);
        let currentEvent = null;
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.substring(7).trim();
          } else if (line.startsWith('data: ') && currentEvent) {
            try {
              events.push({ event: currentEvent, data: JSON.parse(line.substring(6).trim()) });
            } catch {
              events.push({ event: currentEvent, raw: line.substring(6).trim() });
            }
          }
        }
      });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          rawData,
          events
        });
      });
    });
    req.on('error', reject);
    req.write(data);
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

const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v317-test-'));

async function runTests() {
  const TEST_PORT = 3995;

  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    // [TEST 1] Anti-Splitting Conversation Continuity (Auto-Continuity without conversationId)
    console.log('[TEST 1] Testing automatic conversation continuity across turns...');
    
    // Turn 1: Initial conversation turn
    const turn1Res = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'Initial project setup query',
      cwd: tmpBase,
      testMode: true
    });
    assert.strictEqual(turn1Res.status, 200);
    assert.ok(turn1Res.body.conversationId, 'Turn 1 must create a valid conversationId');
    const firstConvId = turn1Res.body.conversationId;

    // Turn 2: Follow-up query WITHOUT conversationId and WITHOUT isNew
    const turn2Res = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'Follow-up query in same context',
      cwd: tmpBase,
      testMode: true
    });
    assert.strictEqual(turn2Res.status, 200);
    assert.strictEqual(
      turn2Res.body.conversationId,
      firstConvId,
      'Turn 2 must automatically continue the active conversation and NOT split into a new one'
    );

    // Turn 3: Explicit New Chat intent (isNew: true)
    const turn3Res = await httpPost(TEST_PORT, '/api/chat', {
      prompt: 'Brand new topic query',
      cwd: tmpBase,
      isNew: true,
      testMode: true
    });
    assert.strictEqual(turn3Res.status, 200);
    assert.notStrictEqual(
      turn3Res.body.conversationId,
      firstConvId,
      'Turn 3 with isNew: true must create a new conversation thread'
    );
    console.log('  [OK] PASS: Automatic conversation continuity & intentional branch verified\n');

    // [TEST 2] Server-Sent Events (SSE) Real-Time Streaming in /api/chat
    console.log('[TEST 2] Testing SSE real-time streaming endpoint in /api/chat...');
    const streamRes = await httpPostStream(TEST_PORT, '/api/chat', {
      prompt: 'Test SSE streaming pipeline',
      cwd: tmpBase,
      conversationId: firstConvId,
      stream: true,
      testMode: true
    });

    assert.strictEqual(streamRes.status, 200);
    assert.ok(
      streamRes.headers['content-type'].includes('text/event-stream'),
      'Header must include text/event-stream'
    );
    assert.ok(
      streamRes.headers['cache-control'].includes('no-cache'),
      'Cache-Control must include no-cache'
    );

    const eventNames = streamRes.events.map(e => e.event);
    assert.ok(eventNames.includes('start'), 'Must stream "start" event');
    assert.ok(eventNames.includes('delta'), 'Must stream "delta" event');
    assert.ok(eventNames.includes('done'), 'Must stream "done" event');

    const doneEvent = streamRes.events.find(e => e.event === 'done');
    assert.ok(doneEvent, 'Done event must exist');
    assert.strictEqual(doneEvent.data.success, true);
    assert.strictEqual(doneEvent.data.conversationId, firstConvId);
    assert.ok(typeof doneEvent.data.cleanResponse === 'string');
    assert.ok(typeof doneEvent.data.sessionTokens === 'number');
    console.log('  [OK] PASS: SSE streaming protocol with start, delta, and done events verified\n');

    // [TEST 3] Clean Assistant Output Extractor & Anti-NDJSON Sanitization
    console.log('[TEST 3] Testing extractCleanAssistantResponse sanitization logic...');
    const mockNdjsonOutput = [
      '{"event":"start","timestamp":123456789}',
      '{"event":"tool_start","tool":"view_file","callId":"c1"}',
      '{"event":"tool_result","callId":"c1","status":"success"}',
      'Here is the verified implementation for your project:',
      '',
      '```javascript',
      'function testRunner() {',
      '  return true;',
      '}',
      '```',
      '',
      'All tests passed successfully.',
      '{"event":"finish","totalTokens":450}'
    ].join('\n');

    const clean = extractCleanAssistantResponse(mockNdjsonOutput, tmpBase, firstConvId);
    assert.strictEqual(clean.includes('{"event":"start"'), false, 'Clean output must not contain raw NDJSON start events');
    assert.strictEqual(clean.includes('{"event":"finish"'), false, 'Clean output must not contain raw NDJSON finish events');
    assert.ok(clean.includes('Here is the verified implementation'), 'Clean output must preserve genuine assistant text');
    assert.ok(clean.includes('function testRunner()'), 'Clean output must preserve markdown code blocks');
    console.log('  [OK] PASS: Raw NDJSON stream stripped and markdown code blocks preserved\n');

    // [TEST 4] Frontend Modern IDE Features & Zero-Emoji Validation
    console.log('[TEST 4] Testing index.html modern IDE components and zero-emoji compliance...');
    const html = fs.readFileSync(path.join(projectRoot, 'web', 'public', 'index.html'), 'utf8');

    // Markdown rendering & code box
    assert.ok(html.includes('renderMarkdown('), 'index.html must implement client-side renderMarkdown()');
    assert.ok(html.includes('code-box'), 'CSS must define .code-box');
    assert.ok(html.includes('code-box-header'), 'CSS must define .code-box-header');
    assert.ok(html.includes('btn-copy-code'), 'CSS must define .btn-copy-code');
    assert.ok(html.includes('code-box-pre'), 'CSS must define .code-box-pre');

    // Typing cursor & tool indicators
    assert.ok(html.includes('cursor-pulse'), 'CSS must define .cursor-pulse typing indicator');
    assert.ok(html.includes('tool-badge'), 'CSS must define .tool-badge');
    assert.ok(html.includes('tool-dot'), 'CSS must define .tool-dot');

    // Streaming fetch reader logic
    assert.ok(html.includes('getReader()'), 'Frontend must use streaming response reader');
    assert.ok(html.includes('TextDecoder'), 'Frontend must use TextDecoder for chunks');

    // Zero emojis check
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.strictEqual(emojiRegex.test(html), false, 'index.html must strictly comply with zero emojis');
    console.log('  [OK] PASS: Modern IDE components, markdown styling, and zero-emoji policy verified\n');

    console.log('===============================================================');
    console.log('  [OK] ALL 4 TESTS IN V3.17.0 STREAMING SUITE PASSED (100%)');
    console.log('===============================================================\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    } catch {}
  }
}

runTests().catch(err => {
  console.error('\n[ERROR] TEST FAILED:', err);
  process.exit(1);
});
