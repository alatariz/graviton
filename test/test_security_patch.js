import assert from 'assert';
import { getSpawnConfig } from '../bin/graviton-relay.js';

console.log('=== TESTING WINDOWS NODE.JS SECURITY PATCH ===\n');

// 1. Test on current platform (Windows win32)
const configDefault = getSpawnConfig();
assert.strictEqual(configDefault.spawnCmd, 'cmd.exe', 'On Windows, spawnCmd must strictly be cmd.exe');
assert.strictEqual(configDefault.spawnArgs[0], '/c', 'First arg must be /c');
assert.strictEqual(configDefault.spawnArgs[1], 'antigravity', 'Second arg must be default antigravity');
assert.ok(configDefault.spawnArgs.includes('--dangerously-skip-permissions'), 'Must include originalArgs');
console.log('  ✔ Windows default config: cmd.exe with args [\'/c\', \'antigravity\', ...originalArgs]');

// 2. Test with custom alias 'agy'
const configAgy = getSpawnConfig({ command: 'agy' });
assert.strictEqual(configAgy.spawnCmd, 'cmd.exe');
assert.strictEqual(configAgy.spawnArgs[0], '/c');
assert.strictEqual(configAgy.spawnArgs[1], 'agy');
console.log('  ✔ Windows alias config: cmd.exe with args [\'/c\', \'agy\', ...originalArgs]');

// 3. Test with continueSession & custom options
const configContinue = getSpawnConfig({ continueSession: true, effort: 'low', mode: 'architect' });
assert.ok(configContinue.spawnArgs.includes('--continue'), 'Should contain --continue');
assert.ok(configContinue.spawnArgs.includes('--effort'), 'Should contain --effort');
assert.ok(configContinue.spawnArgs.includes('low'), 'Should contain low');
assert.ok(configContinue.spawnArgs.includes('--mode'), 'Should contain --mode');
assert.ok(configContinue.spawnArgs.includes('architect'), 'Should contain architect');
console.log('  ✔ Options and --continue correctly relayed in args array');

// 4. Test simulated non-Windows platform (Linux / macOS)
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
try {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  const linuxConfig = getSpawnConfig({ command: 'agy' });
  assert.strictEqual(linuxConfig.spawnCmd, 'agy', 'On Linux with custom command, spawnCmd must match');
  assert.strictEqual(linuxConfig.spawnArgs[0], '--dangerously-skip-permissions', 'On Linux, no /c prepended');
  assert.strictEqual(linuxConfig.spawnArgs.length, 5, 'On Linux, length matches originalArgs');

  const linuxDefault = getSpawnConfig();
  assert.strictEqual(linuxDefault.spawnCmd, 'antigravity', 'On Linux default, spawnCmd is antigravity');
  console.log('  ✔ Non-Windows platforms (Linux/macOS) use base command (antigravity) with originalArgs');
} finally {
  Object.defineProperty(process, 'platform', originalPlatform);
}

console.log('\n=== ALL SECURITY PATCH TESTS PASSED! ===\n');
