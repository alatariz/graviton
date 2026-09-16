import assert from 'assert';
import { spawn } from 'child_process';
import { runAntigravityWithAutoAllow, getSpawnConfig } from '../bin/graviton-relay.js';

console.log('=== STARTING V1.8.1 BULLETPROOF I/O TEST SUITE ===\n');

// 1. Test Single String Shell on Windows & standard spawn on non-Windows
console.log('[TEST 1] Single String Shell & Non-Windows Spawn Config');
const spawnConfig = getSpawnConfig();
if (process.platform === 'win32') {
  assert.strictEqual(spawnConfig.shell, true, 'Windows must use shell: true');
  assert.ok(spawnConfig.spawnCmd.startsWith('antigravity '), 'Windows spawnCmd must start with antigravity');
  assert.ok(spawnConfig.spawnCmd.includes('--dangerously-skip-permissions'), 'Windows spawnCmd must contain originalArgs');
  assert.strictEqual(spawnConfig.spawnArgs.length, 0, 'Windows spawnArgs must be empty array');
  console.log('  ✔ Windows config: Single String Shell "' + spawnConfig.spawnCmd + '" with shell: true and empty args');
} else {
  assert.strictEqual(spawnConfig.shell, false, 'Non-Windows must use shell: false');
  assert.strictEqual(spawnConfig.spawnCmd, 'antigravity', 'Non-Windows spawnCmd must be antigravity');
  assert.ok(spawnConfig.spawnArgs.includes('--dangerously-skip-permissions'), 'Non-Windows spawnArgs must contain originalArgs');
  console.log('  ✔ Non-Windows config: standard spawn antigravity with shell: false');
}

// 2. Test Error Catching & Non-Zero Exit Code Logging
console.log('\n[TEST 2] Exit Code Logging & Abrupt Termination');
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
  // Use a command that exits with code 42
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

// 3. Test Success Resolution on code 0
console.log('\n[TEST 3] Success Resolution on Exit Code 0');
let successLogged = false;
console.log = (...args) => {
  const str = args.join(' ');
  if (str.includes('Execution complete')) {
    successLogged = true;
  }
  origLog(...args);
};

try {
  const successCmd = process.platform === 'win32' ? 'cmd /c exit 0' : 'sh -c "exit 0"';
  const res = await runAntigravityWithAutoAllow('test', {
    command: successCmd,
    stdio: 'ignore'
  });
  assert.strictEqual(res, 0, 'Must resolve with 0 on code 0');
  assert.ok(successLogged, 'Must print success message on code 0');
  console.log('  ✔ Code 0 resolves cleanly and prints Execution complete');
} finally {
  console.log = origLog;
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
    assert.ok(out.includes('[Graviton V1.8.1 Active]'), 'Output must contain [Graviton V1.8.1 Active]');
    console.log('  ✔ [Graviton V1.8.1 Active] banner displayed cleanly at CLI startup');
    resolve();
  });
  child.on('error', reject);
});

console.log('\n=== ALL V1.8.1 BULLETPROOF I/O TESTS PASSED! ===\n');
