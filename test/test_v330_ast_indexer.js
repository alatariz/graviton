// test/test_v330_ast_indexer.js - Graviton V3.3.0 AST File Skeletonizer & Function Indexer Test Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import {
  isAstCandidate,
  isSkeletonCandidate,
  countBraceDelta,
  parseJsTsAst,
  parsePythonAst,
  parseGoAst,
  parseRustAst,
  generateAstFunctionIndex,
  formatAstFunctionIndex
} from '../src/code-outliner.js';
import { constructSuperPrompt } from '../src/pipeline.js';

console.log('=== STARTING V3.3.0 AST FUNCTION INDEXER TEST SUITE ===\n');

const testDir = path.join(os.tmpdir(), `graviton-v330-test-${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

try {
  // [TEST 1] JavaScript & TypeScript AST Extraction
  console.log('[TEST 1] Testing parseJsTsAst declaration and line-range extraction...');
  const sampleJs = `import path from 'path';
import fs from 'fs';

const BASE_URL = 'https://api.example.com';

export function parseWorkbook(buffer, options = {}) {
  let rows = [];
  for (let i = 0; i < 50; i++) {
    rows.push({ id: i });
  }
  return rows;
}

export class SpreadsheetManager {
  constructor() {
    this.sheets = [];
  }

  addSheet(name) {
    this.sheets.push({ name });
  }
}

export const exportToCsv = async (sheet) => {
  return sheet.name;
};

export interface SheetConfig {
  maxRows: number;
}
`;

  const jsRes = parseJsTsAst(sampleJs, 'sheet.ts');
  assert.strictEqual(jsRes.totalLines, 31, 'Total lines must match');
  assert.strictEqual(jsRes.entries.length, 5, 'Must find 5 entries (1 setup + 4 declarations)');

  const setupEntry = jsRes.entries[0];
  assert.strictEqual(setupEntry.type, 'setup', 'First entry must be setup');
  assert.strictEqual(setupEntry.startLine, 1, 'Setup starts at line 1');
  assert.strictEqual(setupEntry.endLine, 5, 'Setup ends before first function');

  const funcEntry = jsRes.entries.find(e => e.name === 'parseWorkbook');
  assert.ok(funcEntry, 'Must find parseWorkbook');
  assert.strictEqual(funcEntry.type, 'function');
  assert.strictEqual(funcEntry.startLine, 6);
  assert.strictEqual(funcEntry.endLine, 12);
  assert.strictEqual(funcEntry.lineCount, 7);

  const classEntry = jsRes.entries.find(e => e.name === 'SpreadsheetManager');
  assert.ok(classEntry, 'Must find SpreadsheetManager');
  assert.strictEqual(classEntry.type, 'class');
  assert.strictEqual(classEntry.startLine, 14);
  assert.strictEqual(classEntry.endLine, 22);

  const arrowEntry = jsRes.entries.find(e => e.name === 'exportToCsv');
  assert.ok(arrowEntry, 'Must find exportToCsv');
  assert.strictEqual(arrowEntry.type, 'function');
  assert.strictEqual(arrowEntry.startLine, 24);
  assert.strictEqual(arrowEntry.endLine, 26);

  const interfaceEntry = jsRes.entries.find(e => e.name === 'SheetConfig');
  assert.ok(interfaceEntry, 'Must find SheetConfig interface');
  assert.strictEqual(interfaceEntry.startLine, 28);
  assert.strictEqual(interfaceEntry.endLine, 30);
  console.log('✔ PASS: JS/TS declarations and exact line ranges parsed accurately.\n');

  // [TEST 2] Python AST Extraction (Indentation Tracking)
  console.log('[TEST 2] Testing parsePythonAst with indentation-based scopes...');
  const samplePy = `import os
import sys

TIMEOUT = 60

def initialize_database(db_url):
    print("Connecting to DB...")
    return connect(db_url)

class SpreadsheetProcessor:
    def __init__(self, name):
        self.name = name

    def process(self):
        return True

async def export_results(data, output_path):
    with open(output_path, 'w') as f:
        f.write(data)
`;

  const pyRes = parsePythonAst(samplePy, 'engine.py');
  assert.strictEqual(pyRes.entries.length, 4, 'Must find 4 entries (1 setup + 3 definitions)');
  
  const pySetup = pyRes.entries[0];
  assert.strictEqual(pySetup.type, 'setup');
  assert.strictEqual(pySetup.startLine, 1);
  assert.strictEqual(pySetup.endLine, 5);

  const pyDb = pyRes.entries.find(e => e.name === 'initialize_database');
  assert.ok(pyDb);
  assert.strictEqual(pyDb.type, 'function');
  assert.strictEqual(pyDb.startLine, 6);
  assert.strictEqual(pyDb.endLine, 8);

  const pyClass = pyRes.entries.find(e => e.name === 'SpreadsheetProcessor');
  assert.ok(pyClass);
  assert.strictEqual(pyClass.type, 'class');
  assert.strictEqual(pyClass.startLine, 10);
  assert.strictEqual(pyClass.endLine, 15);

  const pyExport = pyRes.entries.find(e => e.name === 'export_results');
  assert.ok(pyExport);
  assert.strictEqual(pyExport.type, 'function');
  assert.strictEqual(pyExport.startLine, 17);
  assert.strictEqual(pyExport.endLine, 19);
  console.log('✔ PASS: Python def/class declarations and indent line ranges verified.\n');

  // [TEST 3] Go & Rust AST Extraction
  console.log('[TEST 3] Testing parseGoAst and parseRustAst...');
  const sampleGo = `package main

import "net/http"

type ServerConfig struct {
    Port int
    Host string
}

func NewServer(cfg ServerConfig) *Server {
    return &Server{cfg: cfg}
}

func (s *Server) Start() error {
    return nil
}
`;

  const goRes = parseGoAst(sampleGo, 'main.go');
  assert.strictEqual(goRes.entries.length, 4, 'Must find 4 Go entries');
  assert.ok(goRes.entries.some(e => e.name === 'ServerConfig' && e.type === 'struct'));
  assert.ok(goRes.entries.some(e => e.name === 'NewServer' && e.type === 'function'));
  assert.ok(goRes.entries.some(e => e.name === 'Start' && e.type === 'function'));

  const sampleRs = `use std::collections::HashMap;

pub struct Config {
    pub timeout: u64,
}

impl Config {
    pub fn default() -> Self {
        Config { timeout: 30 }
    }
}

pub async fn run_service(cfg: Config) -> Result<(), ()> {
    Ok(())
}
`;

  const rsRes = parseRustAst(sampleRs, 'lib.rs');
  assert.strictEqual(rsRes.entries.length, 4, 'Must find 4 Rust entries');
  assert.ok(rsRes.entries.some(e => e.name === 'Config' && e.type === 'struct'));
  assert.ok(rsRes.entries.some(e => e.name === 'Config' && e.type === 'impl'));
  assert.ok(rsRes.entries.some(e => e.name === 'run_service' && e.type === 'function'));
  console.log('✔ PASS: Go and Rust AST extractors verified.\n');

  // [TEST 4] AST Candidate Evaluation (isAstCandidate)
  console.log('[TEST 4] Testing isAstCandidate threshold evaluation (>250 lines)...');
  assert.strictEqual(isAstCandidate('app.js', 150), false, '150 lines is not AST candidate (standard skeleton applies)');
  assert.strictEqual(isAstCandidate('app.js', 251), true, '251 lines is AST candidate');
  assert.strictEqual(isAstCandidate('large_service.py', 400), true, 'Python file > 250 lines is AST candidate');
  assert.strictEqual(isAstCandidate('data.csv', 1000), false, 'CSV file handled by MarkItDown, not AST');
  assert.strictEqual(isAstCandidate('readme.md', 500), false, 'Markdown file is not AST candidate');
  console.log('✔ PASS: isAstCandidate accurately gates files > 250 lines.\n');

  // [TEST 5] Target Focus Extraction
  console.log('[TEST 5] Testing generateAstFunctionIndex with target focus function...');
  const focusRes = generateAstFunctionIndex(sampleJs, 'sheet.js', { focusName: 'exportToCsv' });
  assert.ok(focusRes.targetFocusEntry, 'Must match target focus entry');
  assert.strictEqual(focusRes.targetFocusEntry.name, 'exportToCsv');
  assert.strictEqual(focusRes.targetFocusEntry.startLine, 24);
  assert.strictEqual(focusRes.targetFocusEntry.endLine, 26);
  assert.ok(focusRes.targetFocusCode.includes('[GRAVITON TARGET FOCUS: sheet.js#exportToCsv (Lines L24-L26)]'));
  assert.ok(focusRes.targetFocusCode.includes('24: export const exportToCsv = async (sheet) => {'));
  console.log('✔ PASS: Target focus function extracted with exact line numbers.\n');

  // [TEST 6] Large File Shield & Token Reduction (>80% savings)
  console.log('[TEST 6] Testing token reduction on 350-line file...');
  const bigFileLines = ['import fs from "fs";\nimport path from "path";\n'];
  for (let i = 1; i <= 35; i++) {
    bigFileLines.push(`export function calculationModule_${i}(data, factor) {
  let acc = 0;
  for (let j = 0; j < 10; j++) {
    acc += (data[j] || 0) * factor;
  }
  const intermediate = acc * Math.PI;
  const variance = (intermediate - factor) / 2;
  const normalized = Math.max(0, Math.min(100, variance));
  const rounded = Math.round(normalized * 100) / 100;
  const telemetry = { iter: i, val: rounded, ts: Date.now(), mode: 'production' };
  console.log('Calculation module telemetry event:', telemetry);
  return telemetry.val;
}
`);
  }
  const bigFileCode = bigFileLines.join('\n');
  const bigFileRes = generateAstFunctionIndex(bigFileCode, 'bigWorkbook.js');
  assert.strictEqual(bigFileRes.isLargeFile, true, 'Must identify as large file');
  assert.ok(bigFileRes.totalLines > 250, 'Must be > 250 lines');
  assert.ok(bigFileRes.reductionPct >= 80, `Must achieve >=80% token reduction (actual: ${bigFileRes.reductionPct}%)`);
  assert.ok(bigFileRes.formattedIndex.includes('⚡ Large file detected (>250 lines). DO NOT load the entire file into context.'));
  assert.ok(bigFileRes.formattedIndex.includes("⚡ Use 'view_file' with 'StartLine' and 'EndLine' targeting specific ranges below:"));
  console.log(`✔ PASS: 350-line file reduced by ${bigFileRes.reductionPct}% (~${bigFileRes.tokensSavedEstimate.toLocaleString()} tokens saved).\n`);

  // [TEST 7] Pipeline constructSuperPrompt Integration
  console.log('[TEST 7] Testing constructSuperPrompt hydration with large file (>250 lines)...');
  const largeFilePath = path.join(testDir, 'hugeEngine.js');
  fs.writeFileSync(largeFilePath, bigFileCode, 'utf8');

  // Case A: Prompt mentions file without focus -> Injects AST Function Index
  const promptA = constructSuperPrompt('tolong analisis file hugeEngine.js di workspace ini', testDir);
  assert.ok(promptA.includes('[GRAVITON AST FUNCTION INDEX: hugeEngine.js'), 'Must inject AST function index');
  assert.ok(promptA.includes("Use 'view_file' with 'StartLine' and 'EndLine'"), 'Must include surgical view directive');
  assert.ok(/L\d+-L\d+/.test(promptA), 'Must list function line ranges');
  assert.ok(!promptA.includes('acc += (data[j] || 0) * factor'), 'Must NOT dump full function bodies');

  // Case B: Prompt mentions file WITH focus -> Injects AST Index + Target Focus Code
  const promptB = constructSuperPrompt('tolong perbaiki calculationModule_5 di hugeEngine.js', testDir);
  assert.ok(promptB.includes('[GRAVITON AST FUNCTION INDEX: hugeEngine.js'), 'Must include AST index');
  assert.ok(promptB.includes('[GRAVITON TARGET FOCUS: hugeEngine.js#calculationModule_5'), 'Must include target focus block');
  assert.ok(promptB.includes('export function calculationModule_5(data, factor) {'), 'Target function implementation must be present');

  // Case C: With --full option -> bypasses AST index and loads entire file
  const promptC = constructSuperPrompt('tolong analisis hugeEngine.js', testDir, { full: true });
  assert.ok(promptC.includes('[AUTO-INJECTED FILE: hugeEngine.js]'), 'Full mode must bypass AST index');
  assert.ok(promptC.includes('export function calculationModule_1(data, factor) {'), 'Full code must be present');
  console.log('✔ PASS: Pipeline auto-hydrates AST Function Index for large files.\n');

  // [TEST 8] CLI `grav index <file>` Execution
  console.log('[TEST 8] Testing CLI `grav index <file>` command...');
  const cliOutput = execSync(`node "${path.resolve('bin/graviton.js')}" index "${largeFilePath}"`, { encoding: 'utf8' });
  assert.ok(cliOutput.includes('GRAVITON AST FUNCTION INDEXER'), 'CLI output must include AST banner');
  assert.ok(cliOutput.includes('hugeEngine.js'), 'Must display filename');
  assert.ok(cliOutput.includes('Surgical View Guide'), 'Must include surgical view guide');
  assert.ok(cliOutput.includes('saved'), 'Must display token economy savings');
  console.log('✔ PASS: CLI `grav index <file>` command executes cleanly.\n');

  console.log('====================================================');
  console.log('✔ ALL V3.3.0 AST FUNCTION INDEXER TESTS PASSED 100%!');
  console.log('====================================================\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
