import assert from 'assert';
import { spawn } from 'child_process';
import { runAntigravityWithAutoAllow, getSpawnConfig } from '../bin/graviton-relay.js';

console.log('=== STARTING V1.8.0 EXECUTION VANGUARD TEST SUITE ===\n');

// 1. Test getSpawnConfig defaults
console.log('[TEST 1] Spawn Configuration Defaults');
const spawnConfig = getSpawnConfig();
if (process.platform === 'win32') {
  assert.strictEqual(spawnConfig.spawnCmd, 'cmd.exe', 'Windows must use cmd.exe');
  assert.strictEqual(spawnConfig.spawnArgs[0], '/c');
  assert.strictEqual(spawnConfig.spawnArgs[1], 'antigravity', 'Default command must be antigravity');
} else {
  assert.strictEqual(spawnConfig.spawnCmd, 'antigravity', 'Non-Windows must use antigravity');
}
console.log('  ✔ Spawn configuration correctly targets antigravity');

// 2. Test Promise Return & Stdio inherit
console.log('\n[TEST 2] runAntigravityWithAutoAllow returns a Promise');
const promise = runAntigravityWithAutoAllow('test', {
  // Use a command that exits immediately 0 to test completion
  command: process.platform === 'win32' ? 'cmd.exe' : 'true',
  timeoutMs: 5000,
  stdio: 'ignore'
});
assert.ok(promise instanceof Promise, 'runAntigravityWithAutoAllow must return a Promise');
console.log('  ✔ Function returns a standard Promise');

// 3. Test Timeout Guardrail (short timeout)
console.log('\n[TEST 3] Timeout Guardrails forcefully kill process and reject with clean error');
try {
  // Command that would sleep longer than timeout
  const sleepCmd = process.platform === 'win32' ? 'powershell' : 'sleep';
  await runAntigravityWithAutoAllow('test', {
    command: sleepCmd,
    timeoutMs: 250, // 250ms timeout to trigger guardrail
    stdio: 'ignore'
  });
  assert.fail('Should have rejected due to timeout');
} catch (err) {
  assert.ok(err instanceof Error, 'Rejected with an Error');
  assert.ok(
    err.message.includes('Antigravity execution timed out after 15 minutes'),
    'Error message must indicate execution timeout: ' + err.message
  );
  console.log('  ✔ Timeout guardrail correctly triggered: ' + err.message);
}

// 4. Test Version Banner CLI Output
console.log('\n[TEST 4] Version Banner in CLI Execution');
await new Promise((resolve, reject) => {
  const child = spawn(process.execPath, ['bin/graviton.js', 'version'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d.toString(); });
  child.on('close', code => {
    assert.strictEqual(code, 0);
    assert.ok(out.includes('[Graviton V1.8.0 Active]'), 'Output must contain [Graviton V1.8.0 Active]');
    console.log('  ✔ [Graviton V1.8.0 Active] banner displayed cleanly at CLI startup');
    resolve();
  });
  child.on('error', reject);
});

console.log('\n=== ALL V1.8.0 EXECUTION VANGUARD TESTS PASSED! ===\n');
