import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  loadGravIgnore,
  loadGravitonIgnore,
  isGravIgnored,
  isGravitonIgnored
} from '../src/ignore-parser.js';
import {
  getTelemetry,
  recordTelemetrySync,
  formatTelemetryDashboard
} from '../src/telemetry.js';
import {
  constructSuperPrompt,
  buildWorkspaceMap
} from '../src/pipeline.js';

console.log('\n=== STARTING V1.7.0 TEST SUITE (.gravignore) ===\n');

// -------------------------------------------------------------
// 1. .gravignore Parser Unit Tests
// -------------------------------------------------------------
console.log('[TEST 1] .gravignore Parsing and Pattern Compilation');

const tmpDir = path.join(os.tmpdir(), 'graviton-v170-test-' + Date.now());
fs.mkdirSync(tmpDir, { recursive: true });

// Create a realistic .gravignore
const ignoreContent = `
# Graviton Ignore Rules (.gravignore)
# Security & Credentials
.env*
*.key
*.pem
secrets/
/top_level_secret.js

# Build artifacts
dist/
coverage/
*.min.js

# Temporary files
temp*
`;

fs.writeFileSync(path.join(tmpDir, '.gravignore'), ignoreContent, 'utf8');

const loadedPatterns = loadGravIgnore(tmpDir);
assert.strictEqual(loadedPatterns.length, 9, 'Should load exactly 9 non-empty, non-comment patterns');
assert.ok(loadedPatterns.includes('secrets/'), 'Should contain secrets/');
assert.ok(loadedPatterns.includes('*.key'), 'Should contain *.key');

// Test alias
const aliasPatterns = loadGravitonIgnore(tmpDir);
assert.strictEqual(aliasPatterns.length, 9, 'loadGravitonIgnore alias should work identical to loadGravIgnore');
console.log('  ✔ loadGravIgnore & alias correctly ignore comments and blank lines');

// Test isGravIgnored matching
assert.strictEqual(isGravIgnored('secrets/credentials.json', loadedPatterns, tmpDir), true, 'secrets/* should be ignored');
assert.strictEqual(isGravIgnored('sub/secrets/key.pem', loadedPatterns, tmpDir), true, 'Nested secrets/ should be ignored');
assert.strictEqual(isGravIgnored('server.key', loadedPatterns, tmpDir), true, '*.key should be ignored');
assert.strictEqual(isGravIgnored('client.pem', loadedPatterns, tmpDir), true, '*.pem should be ignored');
assert.strictEqual(isGravIgnored('bundle.min.js', loadedPatterns, tmpDir), true, '*.min.js should be ignored');
assert.strictEqual(isGravIgnored('temp_cache.tmp', loadedPatterns, tmpDir), true, 'temp* should be ignored');
assert.strictEqual(isGravIgnored('src/auth.js', loadedPatterns, tmpDir), false, 'src/auth.js should NOT be ignored');
assert.strictEqual(isGravIgnored('package.json', loadedPatterns, tmpDir), false, 'package.json should NOT be ignored');

// Test alias isGravitonIgnored
assert.strictEqual(isGravitonIgnored('server.key', loadedPatterns, tmpDir), true, 'isGravitonIgnored alias should return true');

console.log('  ✔ Pattern matcher handles wildcards, directory prefixes, and file names accurately');

// -------------------------------------------------------------
// 2. Hydration & Dependency Scraping Bypass Tests
// -------------------------------------------------------------
console.log('\n[TEST 2] File Hydration and Dependency Scraping Bypass');

// Setup dummy project files inside tmpDir
const srcDir = path.join(tmpDir, 'src');
const secretsDir = path.join(tmpDir, 'secrets');
fs.mkdirSync(srcDir, { recursive: true });
fs.mkdirSync(secretsDir, { recursive: true });

// Normal files
fs.writeFileSync(path.join(srcDir, 'index.js'), "import './safe.js';\nimport '../secrets/private.key';\nconsole.log('Hello');", 'utf8');
fs.writeFileSync(path.join(srcDir, 'safe.js'), "export const SAFE = true;", 'utf8');

// Ignored files
fs.writeFileSync(path.join(secretsDir, 'private.key'), "SUPER_SECRET_PRIVATE_KEY_DATA", 'utf8');
fs.writeFileSync(path.join(tmpDir, 'secret_token.key'), "API_KEY_12345", 'utf8');

// Run constructSuperPrompt in tmpDir
const testPrompt = "Fix issue in src/index.js and check secrets/private.key and secret_token.key";
const superPrompt = constructSuperPrompt(testPrompt, tmpDir);

// Verify that safe files were hydrated
assert.ok(superPrompt.includes('src/index.js'), 'safe file src/index.js must be present');
assert.ok(superPrompt.includes('src/safe.js'), 'safe dependency src/safe.js must be present');

// Verify that ignored files were completely BYPASSED
assert.ok(!superPrompt.includes('SUPER_SECRET_PRIVATE_KEY_DATA'), 'secrets/private.key content must be completely bypassed');
assert.ok(!superPrompt.includes('API_KEY_12345'), 'secret_token.key content must be completely bypassed');
assert.ok(!superPrompt.includes('[AUTO-INJECTED FILE: secrets/private.key]'), 'Ignored file header must not be injected');

console.log('  ✔ File hydration and dependency scraping strictly bypass .gravignore files');

// -------------------------------------------------------------
// 3. Workspace Map Ignore Filtering Tests
// -------------------------------------------------------------
console.log('\n[TEST 3] Workspace Map respects .gravignore');

const wsMap = buildWorkspaceMap(tmpDir);
assert.ok(!wsMap.includes('secrets/'), 'secrets/ directory must be excluded from workspace map');
assert.ok(!wsMap.includes('secret_token.key'), 'secret_token.key must be excluded from workspace map');
assert.ok(wsMap.includes('safe.js'), 'safe.js must remain visible in workspace map');

console.log('  ✔ Workspace map prunes all .gravignore patterns');

// -------------------------------------------------------------
// 4. Local Telemetry & Dashboard Tests
// -------------------------------------------------------------
console.log('\n[TEST 4] Local Analytics Telemetry & Dashboard');

const beforeTelemetry = getTelemetry();
assert.ok(typeof beforeTelemetry.intercepted_calls === 'number', 'intercepted_calls must be number');
assert.ok(typeof beforeTelemetry.files_ignored === 'number', 'files_ignored must be number');
assert.ok(typeof beforeTelemetry.estimated_tokens_saved === 'number', 'estimated_tokens_saved must be number');

// Test recording
recordTelemetrySync({
  calls: 2,
  filesIgnored: 3,
  tokensSaved: 1500
});

const afterTelemetry = getTelemetry();
assert.strictEqual(afterTelemetry.intercepted_calls, beforeTelemetry.intercepted_calls + 2, 'calls should increment by 2');
assert.strictEqual(afterTelemetry.files_ignored, beforeTelemetry.files_ignored + 3, 'files_ignored should increment by 3');
assert.strictEqual(afterTelemetry.estimated_tokens_saved, beforeTelemetry.estimated_tokens_saved + 1500, 'tokensSaved should increment by 1500');

// Test dashboard output
const dashboardOutput = formatTelemetryDashboard(afterTelemetry);
assert.ok(dashboardOutput.includes('GRAVITON ENTERPRISE TELEMETRY DASHBOARD'), 'Dashboard title must be present');
assert.ok(dashboardOutput.includes('Intercepted Relay Calls'), 'Calls metric must be present');
assert.ok(dashboardOutput.includes('Files Ignored & Shielded'), 'Ignored files metric must be present');
assert.ok(dashboardOutput.includes('Estimated Tokens Saved'), 'Tokens saved metric must be present');

console.log('  ✔ Telemetry safely updates ~/.graviton/stats.json');
console.log('  ✔ formatTelemetryDashboard outputs sleek aligned ASCII table');

// Clean up temporary test directory
try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch {}

console.log('\n=== ALL V1.7.0 UNIT TESTS PASSED SUCCESSFULLY! ===\n');
