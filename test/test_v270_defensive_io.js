// test/test_v270_defensive_io.js - Graviton V2.7.0 Defensive I/O & Integrity Tests
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { normalizePosixPath, isGravIgnored, createGravFilter } from '../src/ignore-parser.js';
import { resolveTargetScope } from '../src/context-scoper.js';
import { readAndTruncateFile } from '../src/pipeline.js';
import { transpileDocx, transpileXlsx, transpilePptx, transpilePdf, transpileFileToMarkdown } from '../src/markitdown.js';
import { recordFileSnapshot, resolveDeltaHydration } from '../src/delta-compressor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   RUNNING GRAVITON V2.7.0 DEFENSIVE I/O & INTEGRITY SUITE');
console.log('===============================================================\x1b[0m\n');

const testDir = path.join(os.tmpdir(), `graviton-v270-test-${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

try {
  // TEST 1: Universal Path Normalization (POSIX & Windows)
  console.log('--- TEST 1: Universal Path Normalization ---');
  assert.strictEqual(normalizePosixPath('src\\components\\Button.jsx'), 'src/components/Button.jsx');
  assert.strictEqual(normalizePosixPath('./src/components/Button.jsx'), 'src/components/Button.jsx');
  assert.strictEqual(normalizePosixPath('.\\src\\components\\Button.jsx'), 'src/components/Button.jsx');
  assert.strictEqual(normalizePosixPath('src/nested/../components/Button.jsx'), 'src/components/Button.jsx');
  assert.strictEqual(normalizePosixPath('///src/components///Button.jsx'), 'src/components/Button.jsx');
  assert.strictEqual(normalizePosixPath(''), '');
  assert.strictEqual(normalizePosixPath(null), '');
  console.log('✔ Universal path normalization handles Windows backslashes, dots, and slashes correctly.\n');

  // TEST 2: Cross-Platform .gravignore & Case-Insensitivity
  console.log('--- TEST 2: Cross-Platform .gravignore Matching ---');
  const ignoreContent = `
# Logs and builds
*.log
dist/
build/*.map
temp\\*
`;
  fs.writeFileSync(path.join(testDir, '.gravignore'), ignoreContent, 'utf8');
  const gravFilter = createGravFilter(testDir);

  // Mixed slashes
  assert.strictEqual(gravFilter.isIgnored('dist\\bundle.js'), true, 'Should ignore dist\\bundle.js');
  assert.strictEqual(gravFilter.isIgnored('dist/bundle.js'), true, 'Should ignore dist/bundle.js');
  assert.strictEqual(gravFilter.isIgnored('build\\app.js.map'), true, 'Should ignore build\\app.js.map');
  assert.strictEqual(gravFilter.isIgnored('build/app.js.map'), true, 'Should ignore build/app.js.map');

  // Windows case-insensitivity
  if (process.platform === 'win32') {
    assert.strictEqual(gravFilter.isIgnored('ERROR.LOG'), true, 'Should ignore uppercase ERROR.LOG on Windows');
    assert.strictEqual(gravFilter.isIgnored('DIST/app.js'), true, 'Should ignore uppercase DIST/ on Windows');
  }
  assert.strictEqual(gravFilter.isIgnored('src/index.js'), false, 'Should not ignore src/index.js');
  console.log('✔ Cross-platform .gravignore correctly matches mixed slashes and case differences.\n');

  // TEST 3: Context-Scoper Windows Path Resolution
  console.log('--- TEST 3: Context-Scoper Windows Path Resolution ---');
  const scoperDir = path.join(testDir, 'src', 'auth');
  fs.mkdirSync(scoperDir, { recursive: true });
  fs.writeFileSync(path.join(scoperDir, 'login.js'), 'export function login() {}', 'utf8');

  // Prompt references file using Windows backslash
  const winPrompt = 'Please fix the token validation logic in src\\auth\\login.js';
  const scopeResult = resolveTargetScope(winPrompt, testDir);
  assert(scopeResult.targets.includes('src/auth/login.js'), 'Primary file should resolve from Windows path');
  console.log('✔ Context-scoper resolves exact targets even when prompt contains Windows backslashes.\n');

  // TEST 4: Big-File Defensive Guard (>10MB safety cap)
  console.log('--- TEST 4: Big-File Defensive Guard ---');
  const bigFilePath = path.join(testDir, 'oversized_bundle.js');
  // Create an 11 MB dummy file safely using truncate
  const fd = fs.openSync(bigFilePath, 'w');
  fs.ftruncateSync(fd, 11 * 1024 * 1024); // 11MB
  fs.closeSync(fd);

  const truncated = readAndTruncateFile(bigFilePath);
  assert(truncated.includes('GRAVITON DEFENSIVE GUARD'), 'Should return defensive guard message for >10MB file');
  assert(truncated.includes('10MB safety limit'), 'Should mention 10MB safety limit');

  // Test 20MB limit in transpileFileToMarkdown
  const hugeDocPath = path.join(testDir, 'huge_doc.pdf');
  const fd2 = fs.openSync(hugeDocPath, 'w');
  fs.ftruncateSync(fd2, 22 * 1024 * 1024); // 22MB
  fs.closeSync(fd2);

  const transpileHuge = transpileFileToMarkdown(hugeDocPath);
  assert(transpileHuge.includes('GRAVITON DEFENSIVE GUARD'), 'Should return defensive guard message for >20MB document');
  assert(transpileHuge.includes('20MB safety limit'), 'Should mention 20MB safety limit');
  console.log('✔ Big-file defensive guards protect memory and stability against >10MB / >20MB files.\n');

  // TEST 5: Corrupt & Non-Standard Office / PDF Fail-Safe
  console.log('--- TEST 5: Corrupt & Non-Standard Document Fail-Safe ---');
  const corruptDocx = path.join(testDir, 'corrupt.docx');
  fs.writeFileSync(corruptDocx, Buffer.from('NOT_A_ZIP_HEADER_JUST_GARBAGE_BYTES'));

  const docxRes = transpileDocx(corruptDocx);
  assert(docxRes.includes('GRAVITON DOCUMENT NOTICE'), 'Corrupt DOCX must return a graceful notice');
  assert(docxRes.includes('not a valid ZIP/Office document'), 'Notice should state invalid ZIP/Office document');

  const corruptXlsx = path.join(testDir, 'corrupt.xlsx');
  fs.writeFileSync(corruptXlsx, Buffer.from('FAKE_XLSX_DATA'));
  const xlsxRes = transpileXlsx(corruptXlsx);
  assert(xlsxRes.includes('GRAVITON DOCUMENT NOTICE'), 'Corrupt XLSX must return a graceful notice');

  const corruptPptx = path.join(testDir, 'corrupt.pptx');
  fs.writeFileSync(corruptPptx, Buffer.from('FAKE_PPTX_DATA'));
  const pptxRes = transpilePptx(corruptPptx);
  assert(pptxRes.includes('GRAVITON DOCUMENT NOTICE'), 'Corrupt PPTX must return a graceful notice');

  const corruptPdf = path.join(testDir, 'corrupt.pdf');
  fs.writeFileSync(corruptPdf, Buffer.from('INVALID_PDF_NO_HEADER'));
  const pdfRes = transpilePdf(corruptPdf);
  assert(pdfRes.includes('GRAVITON DOCUMENT NOTICE'), 'Corrupt PDF must return a graceful notice');
  assert(pdfRes.includes('missing %PDF- header'), 'Notice should state missing %PDF- header');

  const dispatcherRes = transpileFileToMarkdown(corruptDocx);
  assert(dispatcherRes.includes('GRAVITON DOCUMENT NOTICE'), 'Dispatcher must gracefully return corrupt notice');
  console.log('✔ All corrupt/non-standard office and PDF documents fail safely without crashing.\n');

  // TEST 6: Delta-Compressor Cross-Platform Snapshot Keys
  console.log('--- TEST 6: Delta-Compressor Cross-Platform Normalization ---');
  const convId = 'v270-test';
  const snapshotFile = 'src/service/payment.js';
  const fullSnapPath = path.join(testDir, snapshotFile);
  fs.mkdirSync(path.dirname(fullSnapPath), { recursive: true });
  const initialCode = 'export function pay() { return true; }\n';
  fs.writeFileSync(fullSnapPath, initialCode, 'utf8');
  recordFileSnapshot(testDir, snapshotFile, initialCode, convId);

  // Hydration query with Windows backslash
  const winHydration = resolveDeltaHydration(path.join(testDir, 'src\\service\\payment.js'), initialCode, testDir, {
    conversationId: convId
  });
  assert.strictEqual(winHydration.mode, 'unchanged', 'Normalized path must match existing snapshot as unchanged');
  console.log('✔ Delta compressor snapshot keys are normalized across Windows and POSIX separators.\n');

  console.log('\x1b[1;32m✔ ALL GRAVITON V2.7.0 DEFENSIVE I/O & INTEGRITY TESTS PASSED 100%!\x1b[0m\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
