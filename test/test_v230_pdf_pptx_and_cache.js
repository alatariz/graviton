// test/test_v230_pdf_pptx_and_cache.js - Graviton V2.3.0 PDF, PPTX, & Document Cache Test Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import { isTranspilableDocument, transpilePdf, transpilePptx, transpileFileToMarkdown } from '../src/markitdown.js';
import { getCachedMarkdown, setCachedMarkdown, computeFileHashKey, clearTranspilerCache } from '../src/cache-manager.js';
import { constructSuperPrompt } from '../src/pipeline.js';
import { runDoctor, formatDoctorReport } from '../src/doctor.js';

console.log('=== STARTING V2.3.0 PDF, PPTX, & DOCUMENT CACHE TEST SUITE ===\n');

const testDir = path.join(os.tmpdir(), `graviton-v230-test-${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

/**
 * Creates a minimal valid PKZIP archive buffer in pure Node.js.
 */
function createMinimalZip(entries) {
  const parts = [];
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
    const deflated = zlib.deflateRawSync(dataBuf);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // Local header signature
    localHeader.writeUInt16LE(20, 4);         // Version needed
    localHeader.writeUInt16LE(0, 6);          // Flags
    localHeader.writeUInt16LE(8, 8);          // Method 8: Deflate
    localHeader.writeUInt16LE(0, 10);         // Mod time
    localHeader.writeUInt16LE(0, 12);         // Mod date
    localHeader.writeUInt32LE(0, 14);         // CRC-32 dummy
    localHeader.writeUInt32LE(deflated.length, 18); // Compressed size
    localHeader.writeUInt32LE(dataBuf.length, 22);  // Uncompressed size
    localHeader.writeUInt16LE(nameBuf.length, 26);  // Filename length
    localHeader.writeUInt16LE(0, 28);               // Extra field length

    parts.push(localHeader, nameBuf, deflated);
  }
  return Buffer.concat(parts);
}

try {
  // [TEST 1] Extension Recognition for PDF and PPTX
  console.log('[TEST 1] Testing isTranspilableDocument extension support for PDF and PPTX...');
  assert.strictEqual(isTranspilableDocument('specifications.pdf'), true, '.pdf must be recognized');
  assert.strictEqual(isTranspilableDocument('presentation.pptx'), true, '.pptx must be recognized');
  assert.strictEqual(isTranspilableDocument('DOCUMENT.PDF'), true, 'case-insensitive extension matching');
  assert.strictEqual(isTranspilableDocument('SLIDES.PPTX'), true, 'case-insensitive extension matching');
  assert.strictEqual(isTranspilableDocument('main.rs'), false, '.rs is not a document format');
  console.log('✔ PASS: PDF and PPTX extensions recognized.\n');

  // [TEST 2] PDF Transpiler (FlateDecode Stream Text Extraction)
  console.log('[TEST 2] Testing transpilePdf zero-dependency stream extractor...');
  const pdfStreamText = 'BT /F1 14 Tf 72 700 Td (Cloud Architecture Specification) Tj T* [(Microservices) -250 (Design) -250 (Pattern)] TJ ET';
  const deflatedStream = zlib.deflateSync(Buffer.from(pdfStreamText, 'utf8'));

  const mockPdfBuffer = Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Page /Length ' + deflatedStream.length + ' /Filter /FlateDecode >>\nstream\n'),
    deflatedStream,
    Buffer.from('\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n')
  ]);

  const pdfFile = path.join(testDir, 'specs.pdf');
  fs.writeFileSync(pdfFile, mockPdfBuffer);

  const transpiledPdf = transpilePdf(pdfFile);
  assert(transpiledPdf.includes('[GRAVITON MARKITDOWN: PDF TRANSPILER]'), 'Must contain PDF transpiler header');
  assert(transpiledPdf.includes('Cloud Architecture Specification'), 'Must extract direct string (Tj)');
  assert(transpiledPdf.includes('Microservices Design Pattern'), 'Must extract kerning-separated string array (TJ)');
  assert(transpiledPdf.includes('### Page 1'), 'Must include page heading');
  console.log('✔ PASS: PDF text streams and kerning operators parsed into Clean Markdown.\n');

  // [TEST 3] PowerPoint Transpiler (OpenXML Multi-Slide Extraction)
  console.log('[TEST 3] Testing transpilePptx zero-dependency presentation parser...');
  const slide1Xml = `
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:txBody>
          <a:p><a:r><a:t>Graviton V2.3 Roadmap</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>Zero-dependency PDF and PPTX</a:t></a:r></a:p>
          <a:p><a:r><a:t>Sub-millisecond Document Caching</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`.trim();

  const slide2Xml = `
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>
        <p:txBody>
          <a:p><a:r><a:t>Performance Metrics</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:txBody>
          <a:p><a:r><a:t>Token Savings: 95%</a:t></a:r></a:p>
          <a:p><a:r><a:t>Cache Latency: 0ms</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`.trim();

  const pptxBuffer = createMinimalZip([
    { name: 'ppt/slides/slide1.xml', data: slide1Xml },
    { name: 'ppt/slides/slide2.xml', data: slide2Xml }
  ]);

  const pptxFile = path.join(testDir, 'presentation.pptx');
  fs.writeFileSync(pptxFile, pptxBuffer);

  const transpiledPptx = transpilePptx(pptxFile);
  assert(transpiledPptx.includes('[GRAVITON MARKITDOWN: POWERPOINT TRANSPILER]'), 'Must contain PPTX transpiler header');
  assert(transpiledPptx.includes('## Slide 1: Graviton V2.3 Roadmap'), 'Slide 1 title must be parsed');
  assert(transpiledPptx.includes('- Zero-dependency PDF and PPTX'), 'Slide 1 bullets must be parsed');
  assert(transpiledPptx.includes('## Slide 2: Performance Metrics'), 'Slide 2 title must be parsed');
  assert(transpiledPptx.includes('- Token Savings: 95%'), 'Slide 2 bullets must be parsed');
  assert(transpiledPptx.includes('---'), 'Slides must be separated by dividers');
  console.log('✔ PASS: PPTX multi-slide titles, paragraphs, and dividers transpiled to Markdown.\n');

  // [TEST 4] Document Caching Layer
  console.log('[TEST 4] Testing Document Caching layer (hash-key generation, cache hits, invalidation)...');
  const cacheKey = computeFileHashKey(pdfFile);
  assert(typeof cacheKey === 'string' && cacheKey.length === 64, 'Cache key must be a valid SHA-256 hash');

  // First call caches the result
  const res1 = transpileFileToMarkdown(pdfFile, { cwd: testDir });
  const cached = getCachedMarkdown(pdfFile, testDir);
  assert.strictEqual(cached, res1, 'Cached content must exactly match first transpilation');

  // Second call must return cached copy immediately
  const res2 = transpileFileToMarkdown(pdfFile, { cwd: testDir });
  assert.strictEqual(res2, res1, 'Subsequent call must return identical cached result');

  // Test cache invalidation when file changes
  fs.appendFileSync(pdfFile, '\n% update');
  const cacheKeyAfterUpdate = computeFileHashKey(pdfFile);
  assert.notStrictEqual(cacheKeyAfterUpdate, cacheKey, 'Cache key must change when file modified');

  // Test clearTranspilerCache
  const cleared = clearTranspilerCache(testDir);
  assert(cleared >= 1, 'clearTranspilerCache must remove cache files');
  console.log('✔ PASS: Document Caching layer provides instant hits and safe invalidation.\n');

  // [TEST 5] Pipeline Document Hydration Integration
  console.log('[TEST 5] Testing constructSuperPrompt with PDF and PPTX mentions...');
  const superPrompt = constructSuperPrompt('tolong analisa dokumen specs.pdf dan file presentation.pptx', testDir);
  assert(superPrompt.includes('[GRAVITON MARKITDOWN: PDF TRANSPILER]'), 'SuperPrompt must hydrate PDF');
  assert(superPrompt.includes('Cloud Architecture Specification'), 'PDF content must be injected');
  assert(superPrompt.includes('[GRAVITON MARKITDOWN: POWERPOINT TRANSPILER]'), 'SuperPrompt must hydrate PPTX');
  assert(superPrompt.includes('Graviton V2.3 Roadmap'), 'PPTX content must be injected');
  console.log('✔ PASS: PDF and PPTX documents auto-transpiled and hydrated in SuperPrompt.\n');

  // [TEST 6] Doctor Diagnostics Check for V2.3.0
  console.log('[TEST 6] Testing Doctor diagnostics for V2.3.0...');
  const docRes = runDoctor(testDir);
  const transpilerCheck = docRes.diagnostics.find(d => d.name.includes('Office & Data Transpiler'));
  assert(transpilerCheck, 'Doctor must include MarkItDown transpiler check');
  assert(transpilerCheck.details.includes('.pdf'), 'Doctor must mention .pdf');
  assert(transpilerCheck.details.includes('.json'), 'Doctor must mention .json');

  const report = formatDoctorReport(docRes);
  assert(report.includes('GRAVITON') && report.includes('DOCTOR'), 'Report header must feature DOCTOR banner');
  console.log('✔ PASS: Doctor diagnostics verified for Graviton V2.3.0.\n');

  console.log('====================================================');
  console.log('✔ ALL V2.3.0 PDF, PPTX, & CACHE TESTS PASSED 100%!');
  console.log('====================================================\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
