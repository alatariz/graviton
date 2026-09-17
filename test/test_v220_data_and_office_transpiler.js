// test/test_v220_data_and_office_transpiler.js - Graviton V2.2.0 Data & Office Transpiler Test Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import zlib from 'zlib';
import { isDataFile, sampleJsonData, sampleCsvData } from '../src/data-sampler.js';
import { isTranspilableDocument, transpileDocx, transpileXlsx, transpileFileToMarkdown } from '../src/markitdown.js';
import { constructSuperPrompt } from '../src/pipeline.js';
import { runDoctor, formatDoctorReport } from '../src/doctor.js';

console.log('=== STARTING V2.2.0 DATA & OFFICE TRANSPILER TEST SUITE ===\n');

const testDir = path.join(os.tmpdir(), `graviton-markitdown-test-${Date.now()}`);
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
  // [TEST 1] Extension Recognition
  console.log('[TEST 1] Testing isDataFile & isTranspilableDocument detection...');
  assert.strictEqual(isDataFile('records.json'), true);
  assert.strictEqual(isDataFile('sales.csv'), true);
  assert.strictEqual(isDataFile('metrics.tsv'), true);
  assert.strictEqual(isDataFile('report.docx'), false);
  assert.strictEqual(isDataFile('server.js'), false);

  assert.strictEqual(isTranspilableDocument('document.docx'), true);
  assert.strictEqual(isTranspilableDocument('financials.xlsx'), true);
  assert.strictEqual(isTranspilableDocument('dataset.csv'), true);
  assert.strictEqual(isTranspilableDocument('schema.json'), true);
  assert.strictEqual(isTranspilableDocument('photo.jpg'), false);
  assert.strictEqual(isTranspilableDocument('index.html'), false);
  console.log('✔ PASS: File extensions recognized accurately.\n');

  // [TEST 2] JSON Data Sampler - Large Array
  console.log('[TEST 2] Testing sampleJsonData with large JSON array...');
  const largeArray = [];
  for (let i = 1; i <= 50; i++) {
    largeArray.push({ id: i, name: `User_${i}`, role: i % 2 === 0 ? 'Admin' : 'Member', active: true });
  }
  const sampledJson = sampleJsonData(JSON.stringify(largeArray), 3);
  assert(sampledJson.includes('[GRAVITON DATA SAMPLER: JSON ARRAY]'), 'Must include Data Sampler header');
  assert(sampledJson.includes('Total Records : 50 items'), 'Must report accurate total count');
  assert(sampledJson.includes('Detected Schema: id (number), name (string), role (string), active (boolean)'), 'Must describe schema');
  assert(sampledJson.includes('User_1') && sampledJson.includes('User_2') && sampledJson.includes('User_3'), 'Must include top 3 items');
  assert(!sampledJson.includes('User_10'), 'Must NOT include items past sample size');
  assert(sampledJson.includes('Directive to AI'), 'Must include directive to AI');
  console.log('✔ PASS: Large JSON array sampled into schema and top 3 records.\n');

  // [TEST 3] JSON Data Sampler - Small Array & Structured Object
  console.log('[TEST 3] Testing sampleJsonData with small array and structured object...');
  const smallArray = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
  const smallSampled = sampleJsonData(JSON.stringify(smallArray), 3);
  assert(!smallSampled.includes('[GRAVITON DATA SAMPLER'), 'Small array must remain plain JSON');
  assert(smallSampled.includes('Alice') && smallSampled.includes('Bob'));

  const structuredObj = {
    appName: 'GravitonApp',
    users: largeArray
  };
  const objSampled = sampleJsonData(JSON.stringify(structuredObj), 3);
  assert(objSampled.includes('[GRAVITON DATA SAMPLER: STRUCTURED OBJECT]'), 'Must handle large sub-arrays in objects');
  assert(objSampled.includes('_totalItems'), 'Must annotate sub-arrays with _totalItems');
  console.log('✔ PASS: Small JSON preserved; structured object sub-arrays sampled.\n');

  // [TEST 4] CSV & TSV Data Sampler
  console.log('[TEST 4] Testing sampleCsvData formatting into Markdown tables...');
  const csvData = `ID,Product,Price,Quantity
101,Keyboard,49.99,15
102,Mouse,24.50,30
103,Monitor,199.00,8
104,Headphones,79.99,12
105,Desk Lamp,19.99,50
106,Webcam,59.99,20
107,Microphone,89.00,10`;

  const sampledCsv = sampleCsvData(csvData, 3);
  assert(sampledCsv.includes('[GRAVITON DATA SAMPLER: CSV DATASET - 7 Total Rows (Top 3 Sampled)]'), 'Must show header notice');
  assert(sampledCsv.includes('| ID | Product | Price | Quantity |'), 'Must include Markdown table header');
  assert(sampledCsv.includes('| --- | --- | --- | --- |'), 'Must include Markdown table separator');
  assert(sampledCsv.includes('| 101 | Keyboard | 49.99 | 15 |'), 'Must include first row');
  assert(sampledCsv.includes('| 103 | Monitor | 199.00 | 8 |'), 'Must include third row');
  assert(!sampledCsv.includes('Webcam'), 'Must NOT include row 6 when sample size is 3');

  // Test TSV delimiter detection
  const tsvData = `User\tScore\tRank\nAlice\t98\t1\nBob\t92\t2`;
  const sampledTsv = sampleCsvData(tsvData, 5);
  assert(sampledTsv.includes('| User | Score | Rank |'), 'TSV should be formatted into Markdown table');
  console.log('✔ PASS: CSV and TSV formatted into clean Markdown tables with token limits.\n');

  // [TEST 5] DOCX Transpiler (Pure Node.js Zero-Dep)
  console.log('[TEST 5] Testing transpileDocx zero-dependency Office parser...');
  const docXml = `
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Executive Summary</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>This proposal outlines the token reduction strategy.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr>
      <w:r><w:t>Feature 1: Smart Data Sampler</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Component</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Status</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Transpiler</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Verified</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>
  `.trim();

  const docxBuffer = createMinimalZip([{ name: 'word/document.xml', data: docXml }]);
  const docxFile = path.join(testDir, 'proposal.docx');
  fs.writeFileSync(docxFile, docxBuffer);

  const transpiledDocx = transpileDocx(docxFile);
  assert(transpiledDocx.includes('[GRAVITON MARKITDOWN: DOCX TRANSPILER]'), 'Must contain MarkItDown header');
  assert(transpiledDocx.includes('# Executive Summary'), 'Heading1 must be converted to Markdown #');
  assert(transpiledDocx.includes('This proposal outlines the token reduction strategy.'), 'Paragraph text must be extracted');
  assert(transpiledDocx.includes('- Feature 1: Smart Data Sampler'), 'Numbered/bulleted item must be converted to list item');
  assert(transpiledDocx.includes('| Component | Status |'), 'Table header must be converted to Markdown table');
  assert(transpiledDocx.includes('| Transpiler | Verified |'), 'Table cells must be converted to Markdown row');
  console.log('✔ PASS: DOCX headings, paragraphs, lists, and tables transpiled to Markdown.\n');

  // [TEST 6] XLSX Transpiler (Pure Node.js Zero-Dep)
  console.log('[TEST 6] Testing transpileXlsx zero-dependency Excel parser...');
  const sharedStringsXml = `
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <si><t>Month</t></si>
  <si><t>Revenue</t></si>
  <si><t>January</t></si>
  <si><t>February</t></si>
</sst>
  `.trim();

  const sheetXml = `
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>2</v></c>
      <c r="B2"><v>15000</v></c>
    </row>
    <row r="3">
      <c r="A3" t="s"><v>3</v></c>
      <c r="B3"><v>22000</v></c>
    </row>
  </sheetData>
</worksheet>
  `.trim();

  const xlsxBuffer = createMinimalZip([
    { name: 'xl/sharedStrings.xml', data: sharedStringsXml },
    { name: 'xl/worksheets/sheet1.xml', data: sheetXml }
  ]);
  const xlsxFile = path.join(testDir, 'financials.xlsx');
  fs.writeFileSync(xlsxFile, xlsxBuffer);

  const transpiledXlsx = transpileXlsx(xlsxFile);
  assert(transpiledXlsx.includes('[GRAVITON MARKITDOWN: EXCEL TRANSPILER]'), 'Must contain MarkItDown header');
  assert(transpiledXlsx.includes('| Month | Revenue |'), 'Shared string headers must form table header');
  assert(transpiledXlsx.includes('| January | 15000 |'), 'Rows with mixed string & numbers must form table rows');
  assert(transpiledXlsx.includes('| February | 22000 |'), 'Second row parsed successfully');
  console.log('✔ PASS: XLSX shared strings and numeric cells transpiled to Markdown table.\n');

  // [TEST 7] Pipeline Integration & Document Hydration
  console.log('[TEST 7] Testing constructSuperPrompt with document hydration...');
  // Create sample CSV in testDir
  fs.writeFileSync(path.join(testDir, 'sample_dataset.csv'), `Name,Role\nDevA,Engineer\nDevB,Architect`, 'utf8');

  const superPrompt = constructSuperPrompt('tolong analisa sample_dataset.csv dan proposal.docx', testDir);
  assert(superPrompt.includes('[GRAVITON DATA SAMPLER: CSV DATASET'), 'CSV mentioned in prompt must be hydrated via sampler');
  assert(superPrompt.includes('| Name | Role |'), 'CSV table must be injected into superPrompt');
  assert(superPrompt.includes('[GRAVITON MARKITDOWN: DOCX TRANSPILER]'), 'DOCX mentioned in prompt must be hydrated via MarkItDown');
  assert(superPrompt.includes('# Executive Summary'), 'DOCX markdown content must be injected');
  console.log('✔ PASS: Documents and datasets auto-transpiled and hydrated in superPrompt.\n');

  // [TEST 8] Doctor Diagnostics Check
  console.log('[TEST 8] Testing Doctor diagnostics for MarkItDown...');
  const docRes = runDoctor(testDir);
  const transpilerCheck = docRes.diagnostics.find(d => d.name.includes('Office & Data Transpiler'));
  assert(transpilerCheck, 'Doctor must include Office & Data Transpiler check');
  assert.strictEqual(transpilerCheck.status, 'ok', 'Status must be ok');

  const report = formatDoctorReport(docRes);
  assert(report.includes('GRAVITON') && report.includes('DOCTOR'), 'Report must feature doctor banner');
  console.log('✔ PASS: Doctor diagnostics verified for MarkItDown.\n');

  console.log('====================================================');
  console.log('✔ ALL V2.2.0 DATA & TRANSPILER TESTS PASSED 100%!');
  console.log('====================================================\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
