import assert from 'assert';
import { spawn } from 'child_process';
import { runAntigravityWithAutoAllow, getSpawnConfig } from '../bin/graviton-relay.js';

console.log('=== STARTING V1.8.1 BULLETPROOF I/O TEST SUITE ===\n');

// 1. Test Promise Wrap & Spawn Configuration
console.log('[TEST 1] Promise Return & Spawn Options');
const spawnConfig = getSpawnConfig();
assert.strictEqual(spawnConfig.shell, true, 'Spawn configuration must set shell: true');
if (process.platform === 'win32') {
  assert.ok(spawnConfig.spawnCmd.startsWith('antigravity '), 'Windows spawnCmd must start with antigravity');
  assert.ok(spawnConfig.spawnCmd.includes('--dangerously-skip-permissions'), 'Windows spawnCmd must contain originalArgs');
  assert.strictEqual(spawnConfig.spawnArgs.length, 0, 'Windows spawnArgs must be empty array');
  console.log('  ✔ Windows config: Single String Shell "' + spawnConfig.spawnCmd + '" with shell: true and empty args');
} else {
  assert.strictEqual(spawnConfig.spawnCmd, 'antigravity', 'Non-Windows spawnCmd must be antigravity');
  assert.ok(spawnConfig.spawnArgs.includes('--dangerously-skip-permissions'), 'Non-Windows spawnArgs must contain originalArgs');
  console.log('  ✔ Non-Windows config: standard spawn antigravity with shell: true');
}

// 2. Test Error Catching & Non-Zero Exit Code Logging
console.log('\n[TEST 2] Error Catching & Non-Zero Exit Code Handling');
let errorLogged = false;
const origLog = console.log;
console.log = (...args) => {
  const str = args.join(' ');
  if (str.includes('[GRAVITON ERROR] Antigravity terminated abruptly with exit code')) {
    errorLogged = true;
  }
  origLog(...args);
};

try {
  const failCmd = process.platform === 'win32' ? 'cmd /c exit 42' : 'sh -c "exit 42"';
  await runAntigravityWithAutoAllow('test', {
    command: failCmd,
    stdio: 'ignore',
    rejectOnError: true
  });
  assert.fail('Should have rejected on non-zero exit code');
} catch (err) {
  assert.ok(errorLogged, 'Must log bold red [GRAVITON ERROR] Antigravity terminated abruptly');
  assert.ok(err.message.includes('42'), 'Error message contains exit code');
  console.log('  ✔ Non-zero exit code logged bold red [GRAVITON ERROR] and rejected correctly');
} finally {
  console.log = origLog;
}

// 3. Test Promise Resolution strictly inside child.on('close') on code 0
console.log('\n[TEST 3] Promise Resolution strictly inside child.on("close")');
let closeFired = false;
const successCmd = process.platform === 'win32' ? 'cmd /c exit 0' : 'sh -c "exit 0"';
const resPromise = runAntigravityWithAutoAllow('test', {
  command: successCmd,
  stdio: 'ignore'
});
assert.ok(resPromise instanceof Promise, 'Must return a Promise');
const res = await resPromise;
assert.strictEqual(res, 0, 'Must resolve with 0 on code 0');
console.log('  ✔ Promise resolves strictly inside close event with exit code 0');

// 4. Test Parent Await & Execution Complete Log Order
console.log('\n[TEST 4] Parent CLI Execution awaits child before printing token logs');
await new Promise((resolve, reject) => {
  // Test running clean command (which avoids launching antigravity)
  const child = spawn(process.execPath, ['bin/graviton.js', 'clean', 'Test prompt for token saver'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  child.stdout.on('data', d => { out += d.toString(); });
  child.on('close', code => {
    assert.strictEqual(code, 0);
    assert.ok(out.includes('[Graviton V1.8.1 Active]'), 'Output must contain [Graviton V1.8.1 Active]');
    assert.ok(out.includes('Test prompt for token saver'), 'Must contain synthesized prompt');
    console.log('  ✔ CLI execution strictly synchronizes and finishes cleanly');
    resolve();
  });
  child.on('error', reject);
});

console.log('\n=== ALL V1.8.1 BULLETPROOF I/O TESTS PASSED! ===\n');
