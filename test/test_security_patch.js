import assert from 'assert';
import { getSpawnConfig } from '../bin/graviton-relay.js';

console.log('=== TESTING WINDOWS NODE.JS SECURITY PATCH ===\n');

// 1. Test on current platform (Windows win32)
const configDefault = getSpawnConfig();
if (process.platform === 'win32') {
  assert.strictEqual(configDefault.shell, true, 'On Windows, shell must strictly be true');
  assert.ok(configDefault.spawnCmd.startsWith('agy '), 'Windows spawnCmd must start with agy');
  assert.ok(configDefault.spawnCmd.includes('--dangerously-skip-permissions'), 'Must include originalArgs');
  assert.strictEqual(configDefault.spawnArgs.length, 0, 'spawnArgs must be empty array for single string shell');
  console.log('  ✔ Windows default config: Single String Shell with args array');
}

// 2. Test with custom alias 'antigravity'
const configAntigravity = getSpawnConfig({ command: 'antigravity' });
if (process.platform === 'win32') {
  assert.ok(configAntigravity.spawnCmd.startsWith('antigravity '));
  assert.strictEqual(configAntigravity.spawnArgs.length, 0);
  console.log('  ✔ Windows alias config: Single String Shell for custom command');
}

// 3. Test with continueSession & custom options
const configContinue = getSpawnConfig({ continueSession: true, effort: 'low', mode: 'architect' });
assert.ok(configContinue.originalArgs.includes('--continue'), 'Should contain --continue');
assert.ok(configContinue.originalArgs.includes('--effort'), 'Should contain --effort');
assert.ok(configContinue.originalArgs.includes('low'), 'Should contain low');
assert.ok(configContinue.originalArgs.includes('--mode'), 'Should contain --mode');
assert.ok(configContinue.originalArgs.includes('architect'), 'Should contain architect');
console.log('  ✔ Options and --continue correctly relayed in args array');

// 4. Test simulated non-Windows platform (Linux / macOS)
const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
try {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  const linuxConfig = getSpawnConfig({ command: 'antigravity' });
  assert.strictEqual(linuxConfig.spawnCmd, 'antigravity', 'On Linux with custom command, spawnCmd must match');
  assert.strictEqual(linuxConfig.spawnArgs[0], '--dangerously-skip-permissions', 'On Linux, no /c prepended');
  assert.strictEqual(linuxConfig.spawnArgs.length, 5, 'On Linux, length matches originalArgs');

  const linuxDefault = getSpawnConfig();
  assert.strictEqual(linuxDefault.spawnCmd, 'agy', 'On Linux default, spawnCmd is agy');
  console.log('  ✔ Non-Windows platforms (Linux/macOS) use base command (agy) with originalArgs');
} finally {
  Object.defineProperty(process, 'platform', originalPlatform);
}

console.log('\n=== ALL SECURITY PATCH TESTS PASSED! ===\n');
