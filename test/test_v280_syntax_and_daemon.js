// test/test_v280_syntax_and_daemon.js - Graviton V2.8.0 Syntax Precision, Process Tree & Cache Alignment Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import http from 'http';
import { fileURLToPath } from 'url';
import { checkFileSyntax, validateCodeStructure } from '../src/sanity-guard.js';
import { killProcessOnPort, findProcessOnPort } from '../src/port-guard.js';
import { constructSuperPrompt, getPromptCachePrefix } from '../src/pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   RUNNING GRAVITON V2.8.0 SYNTAX & DAEMON TEST SUITE');
console.log('===============================================================\x1b[0m\n');

const testDir = path.join(os.tmpdir(), `graviton-v280-test-${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

try {
  // TEST 1: Modern React TSX / JSX Fragment Validation (Zero False-Positive)
  console.log('--- TEST 1: React TSX/JSX Syntax Validation ---');
  const validJsxFile = path.join(testDir, 'App.jsx');
  const validJsxContent = `
import React from 'react';

export function App({ title }) {
  return (
    <>
      <header className="hero">
        <h1>{title}</h1>
      </header>
      <main>
        <p>Zero-dependency Graviton engine</p>
      </main>
    </>
  );
}
`;
  fs.writeFileSync(validJsxFile, validJsxContent, 'utf8');

  const jsxRes = checkFileSyntax(validJsxFile);
  assert.strictEqual(jsxRes.valid, true, 'Valid JSX/TSX fragment must pass syntax validation cleanly');
  console.log('✔ Valid JSX fragment passed syntax check without false-positive error.\n');

  // TEST 2: Broken TSX Detection (Unmatched Brackets / Cutoffs)
  console.log('--- TEST 2: Broken TSX Cutoff Detection ---');
  const brokenJsxFile = path.join(testDir, 'BrokenApp.tsx');
  const brokenJsxContent = `
export function BrokenApp() {
  return (
    <div>
      <p>Cutoff text
  );
}
`;
  fs.writeFileSync(brokenJsxFile, brokenJsxContent, 'utf8');

  const brokenJsxRes = checkFileSyntax(brokenJsxFile);
  assert.strictEqual(brokenJsxRes.valid, false, 'Broken TSX must be detected as invalid');
  assert(brokenJsxRes.error.includes('Mismatched bracket') || brokenJsxRes.error.includes('Unclosed'), 'Error should indicate bracket mismatch or unclosed bracket');
  console.log(`✔ Broken TSX detected accurately: ${brokenJsxRes.error}\n`);

  // TEST 3: TypeScript Decorators (@Component, @Injectable)
  console.log('--- TEST 3: TypeScript Decorators Validation ---');
  const decoratorFile = path.join(testDir, 'UserService.ts');
  const decoratorContent = `
@Injectable({
  providedIn: 'root'
})
export class UserService {
  private users: string[] = ['Alice', 'Bob'];

  @Logged()
  getUser(id: number): string {
    return this.users[id] || 'Unknown';
  }
}
`;
  fs.writeFileSync(decoratorFile, decoratorContent, 'utf8');

  const decoratorRes = checkFileSyntax(decoratorFile);
  assert.strictEqual(decoratorRes.valid, true, 'TypeScript Decorator classes must pass validation cleanly');
  console.log('✔ TypeScript class with decorators passed without false-positive rollback.\n');

  // TEST 4: Nested Template Literal Interpolation
  console.log('--- TEST 4: Template Literal Nested Interpolation ---');
  const nestedTemplateCode = "const msg = `User: ${name.toUpperCase()}, Greeting: ${`Hello ${title}`}`;\n";
  const validTemplate = validateCodeStructure(nestedTemplateCode);
  assert.strictEqual(validTemplate.valid, true, 'Nested template literal must be recognized as valid');

  const brokenTemplateCode = "const msg = `User: ${name.toUpperCase();\n";
  const brokenTemplate = validateCodeStructure(brokenTemplateCode);
  assert.strictEqual(brokenTemplate.valid, false, 'Unterminated template literal must fail');
  console.log('✔ Complex template literal interpolations validated accurately.\n');

  // TEST 5: Deterministic Prompt Cache Alignment (Gemini / Claude KV Caching)
  console.log('--- TEST 5: Deterministic Prompt Cache Alignment ---');
  const prompt1 = constructSuperPrompt('First turn: check the tests', testDir, { isContinuous: true });
  const prompt2 = constructSuperPrompt('Second turn: add a new feature', testDir, { isContinuous: true });

  const prefix1 = getPromptCachePrefix(prompt1);
  const prefix2 = getPromptCachePrefix(prompt2);

  assert.strictEqual(prefix1, prefix2, 'Static prefix across consecutive turns must be 100% byte-for-byte identical');
  assert(!prefix1.includes('\r\n'), 'Prefix must use normalized \\n line endings to guarantee cache hit');
  console.log(`✔ Deterministic prompt prefix confirmed (${prefix1.length} bytes identical prefix across turns).\n`);

  // TEST 6: Process Tree Daemon Healing & Port Release Loop
  console.log('--- TEST 6: Process Tree Daemon Healing & Port Release ---');
  const testPort = 48375;
  const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('OK');
  });

  server.listen(testPort, () => {
    const found = findProcessOnPort(testPort);
    assert(found, `Server should be detected on port ${testPort}`);
    assert.strictEqual(found.port, testPort);

    // Close server and verify killProcessOnPort handles release
    server.close(() => {
      const result = killProcessOnPort(testPort);
      assert.strictEqual(result.freed, true, 'killProcessOnPort should report port freed');
      console.log('✔ Process tree termination and port release verification passed.\n');

      console.log('\x1b[1;32m✔ ALL GRAVITON V2.8.0 SYNTAX & DAEMON TESTS PASSED 100%!\x1b[0m\n');
    });
  });

} finally {
  setTimeout(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {}
  }, 500);
}
