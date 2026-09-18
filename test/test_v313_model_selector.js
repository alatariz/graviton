// test/test_v313_model_selector.js - Graviton V3.13.0 Autonomous Model & Effort Selector Tests
import assert from 'assert';
import http from 'http';
import { classifyModelForPrompt, resolveModelAndEffort } from '../src/model-selector.js';
import { server } from '../web/server.js';

console.log('===============================================================');
console.log('   GRAVITON V3.13.0 AUTONOMOUS MODEL ROUTER TEST SUITE');
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

async function runTests() {
  // [TEST 1] Effort Resolution Decoupled from CLI Flags
  console.log('[TEST 1] Testing effort resolution based on CLI flags...');
  
  // Direct command (no flags) -> medium
  const directRes = resolveModelAndEffort({ prompt: 'buatkan game voxel 3d' });
  assert.strictEqual(directRes.effort, 'medium', 'Direct command without flags must resolve to effort medium');

  // Fast command (-f, --fast) -> low
  const fastRes = resolveModelAndEffort({ isFast: true, prompt: 'buatkan game voxel 3d' });
  assert.strictEqual(fastRes.effort, 'low', 'Fast command must resolve to effort low');

  // Deep command (-d, --deep) -> high
  const deepRes = resolveModelAndEffort({ isDeep: true, prompt: 'buatkan game voxel 3d' });
  assert.strictEqual(deepRes.effort, 'high', 'Deep command must resolve to effort high');
  console.log('  ✔ PASS: Effort resolution (-f -> low, -d -> high, default -> medium) verified\n');

  // [TEST 2] Autonomous Prompt Classification (Flash vs Pro)
  console.log('[TEST 2] Testing prompt-aware autonomous model tier classification...');
  
  // Light prompts -> Flash
  const light1 = classifyModelForPrompt('ganti warna tombol login menjadi hijau dan rata tengah');
  assert.strictEqual(light1.tier, 'flash', 'CSS styling must classify as Flash');

  const light2 = classifyModelForPrompt('perbaiki typo ejaan di file README.md dan tambahkan comment');
  assert.strictEqual(light2.tier, 'flash', 'Typo and comments must classify as Flash');

  const light3 = classifyModelForPrompt('tolong jelaskan apa maksud fungsi calculateEconomyMetrics');
  assert.strictEqual(light3.tier, 'flash', 'Code explanation must classify as Flash');

  const light4 = classifyModelForPrompt('buatkan simple regex untuk validasi email');
  assert.strictEqual(light4.tier, 'flash', 'Simple regex helper must classify as Flash');

  // Heavy prompts -> Pro
  const heavy1 = classifyModelForPrompt('buatkan saya game minecraft voxel 3d web');
  assert.strictEqual(heavy1.tier, 'pro', '3D Minecraft game must classify as Pro');

  const heavy2 = classifyModelForPrompt('arsitekturkan microservices authentication dengan JWT dan session database postgres');
  assert.strictEqual(heavy2.tier, 'pro', 'Microservices auth architecture must classify as Pro');

  const heavy3 = classifyModelForPrompt('debug race condition dan memory leak pada websocket synchronization handler');
  assert.strictEqual(heavy3.tier, 'pro', 'Race condition and memory leak debugging must classify as Pro');

  const heavy4 = classifyModelForPrompt('refactor seluruh arsitektur database schema dan migration script');
  assert.strictEqual(heavy4.tier, 'pro', 'Database schema refactoring must classify as Pro');
  console.log('  ✔ PASS: Prompt-aware autonomous model tier classification verified\n');

  // [TEST 3] Combinatorial Model String Mapping
  console.log('[TEST 3] Testing combined model string mapping across effort and tiers...');

  // Flash combinations
  const flashLow = resolveModelAndEffort({ isFast: true, prompt: 'ganti warna border ke abu-abu' });
  assert.strictEqual(flashLow.tier, 'flash');
  assert.strictEqual(flashLow.effort, 'low');
  assert.strictEqual(flashLow.modelName, 'gemini-3.8-flash-low');

  const flashMed = resolveModelAndEffort({ prompt: 'perbaiki typo di README' });
  assert.strictEqual(flashMed.tier, 'flash');
  assert.strictEqual(flashMed.effort, 'medium');
  assert.strictEqual(flashMed.modelName, 'gemini-3.8-flash-medium');

  const flashHigh = resolveModelAndEffort({ isDeep: true, prompt: 'jelaskan secara mendalam cara kerja AST indexing' });
  assert.strictEqual(flashHigh.tier, 'flash');
  assert.strictEqual(flashHigh.effort, 'high');
  assert.strictEqual(flashHigh.modelName, 'gemini-3.8-flash-high');

  // Pro combinations
  const proLow = resolveModelAndEffort({ isFast: true, prompt: 'buatkan game 3d canvas physics' });
  assert.strictEqual(proLow.tier, 'pro');
  assert.strictEqual(proLow.effort, 'low');
  assert.strictEqual(proLow.modelName, 'gemini-3.1-pro-low', 'Fast mode on heavy task must select Pro with low effort');

  const proMed = resolveModelAndEffort({ prompt: 'buatkan saya game minecraft voxel' });
  assert.strictEqual(proMed.tier, 'pro');
  assert.strictEqual(proMed.effort, 'medium');
  assert.strictEqual(proMed.modelName, 'gemini-3.1-pro-high', 'Direct command on heavy task must select Pro with high capability');

  const proHigh = resolveModelAndEffort({ isDeep: true, prompt: 'arsitekturkan fullstack distributed state machine' });
  assert.strictEqual(proHigh.tier, 'pro');
  assert.strictEqual(proHigh.effort, 'high');
  assert.strictEqual(proHigh.modelName, 'gemini-3.1-pro-high');
  console.log('  ✔ PASS: Combined model string mapping across effort & tiers verified\n');

  // [TEST 4] Cockpit REST API /api/route Integration
  console.log('[TEST 4] Testing Cockpit /api/route modelRouting payload...');
  const TEST_PORT = 3995;
  await new Promise((resolve, reject) => {
    server.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });

  try {
    const res = await httpPost(TEST_PORT, '/api/route', {
      prompt: 'buatkan game fps multiplayer',
      fast: true
    });
    assert.strictEqual(res.status, 200);
    const json = JSON.parse(res.body);
    assert(json.modelRouting, 'Response must include modelRouting');
    assert.strictEqual(json.modelRouting.tier, 'pro');
    assert.strictEqual(json.modelRouting.effort, 'low');
    assert.strictEqual(json.modelRouting.modelName, 'gemini-3.1-pro-low');
    console.log('  ✔ PASS: Cockpit /api/route modelRouting payload operational\n');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  console.log('---------------------------------------------------------------');
  console.log('✔ ALL GRAVITON V3.13.0 MODEL SELECTOR TESTS PASSED 100%!');
  console.log('---------------------------------------------------------------\n');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
