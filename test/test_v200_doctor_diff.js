/**
 * Graviton V2.0.0 Doctor, Diff Viewer, & Python Sanity Test Suite
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { runDoctor, formatDoctorReport } from '../src/doctor.js';
import { computeLineDiff, formatFileDiff, getSessionDiff } from '../src/diff-viewer.js';
import { checkFileSyntax } from '../src/sanity-guard.js';

async function runTests() {
  console.log('=== STARTING V2.0.0 DOCTOR, DIFF, & PYTHON SANITY TEST SUITE ===\n');

  // [TEST 1] Doctor Diagnostics
  console.log('[TEST 1] Doctor System Health Diagnostics');
  const docResult = runDoctor(process.cwd());
  assert.strictEqual(typeof docResult.allHealthy, 'boolean', 'Doctor should report allHealthy boolean');
  assert.ok(Array.isArray(docResult.diagnostics), 'Doctor should provide diagnostics array');
  assert.ok(docResult.diagnostics.length >= 4, 'Doctor should inspect at least Node, Agy, Brain, Config');

  const report = formatDoctorReport(docResult);
  assert.ok(report.includes('GRAVITON') && report.includes('DOCTOR'), 'Formatted report should contain header');
  console.log('  ✔ Doctor successfully inspected system and generated health report');

  // [TEST 2] Line Diff Computation & Formatting
  console.log('\n[TEST 2] Line Diff Computation & ANSI Formatting');
  const oldText = 'const x = 1;\nconst y = 2;\n';
  const newText = 'const x = 1;\nconst y = 3;\nconst z = 4;\n';
  
  const diff = computeLineDiff(oldText, newText);
  assert.ok(diff.length > 0, 'Diff should produce elements');
  const hasAdd = diff.some(d => d.type === 'add');
  const hasDel = diff.some(d => d.type === 'del');
  assert.ok(hasAdd, 'Diff should record additions');
  assert.ok(hasDel, 'Diff should record deletions');

  const formattedDiff = formatFileDiff('src/app.js', diff);
  assert.ok(formattedDiff.includes('pre-session state'), 'Should have old header');
  assert.ok(formattedDiff.includes('post-AI modifications'), 'Should have new header');
  console.log('  ✔ Line diff correctly identified changes (+ additions and - deletions)');

  // [TEST 3] Session Diff from Mock Manifest
  console.log('\n[TEST 3] Session Diff Manifest Inspection');
  const testDir = path.join(os.tmpdir(), 'graviton_v200_diff_test_' + Date.now());
  fs.mkdirSync(testDir, { recursive: true });

  const originalFile = path.join(testDir, 'index.js');
  const backupFile = path.join(testDir, 'index.js.bak');
  fs.writeFileSync(backupFile, 'console.log("hello");\n', 'utf8');
  fs.writeFileSync(originalFile, 'console.log("hello world");\n', 'utf8');

  const manifest = {
    modified: [{ original: originalFile, backup: backupFile }],
    created: [path.join(testDir, 'newfile.js')]
  };
  fs.writeFileSync(path.join(testDir, '.graviton-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

  const sessionDiffReport = getSessionDiff(testDir);
  assert.ok(sessionDiffReport.includes('index.js'), 'Diff should mention index.js');
  assert.ok(sessionDiffReport.includes('newfile.js'), 'Diff should mention newly created file');
  console.log('  ✔ Session diff successfully generated from manifest');

  // [TEST 4] Python Syntax Sanity Check
  console.log('\n[TEST 4] Python Syntax Sanity Check');
  const validPy = path.join(testDir, 'script_valid.py');
  const brokenPy = path.join(testDir, 'script_broken.py');
  fs.writeFileSync(validPy, 'def add(a, b):\n    return a + b\n', 'utf8');
  fs.writeFileSync(brokenPy, 'def add(a, b\n    return a + b\n', 'utf8'); // Missing colon & paren

  const pyValidRes = checkFileSyntax(validPy);
  assert.strictEqual(pyValidRes.valid, true, 'Valid Python file should pass');

  const pyBrokenRes = checkFileSyntax(brokenPy);
  if (!pyBrokenRes.skipped) {
    assert.strictEqual(pyBrokenRes.valid, false, 'Broken Python file should fail');
    assert.ok(pyBrokenRes.error, 'Broken Python should report SyntaxError');
    console.log('  ✔ Python syntax check correctly detected broken Python syntax: ' + pyBrokenRes.error);
  } else {
    console.log('  ℹ Python runtime not installed on host environment (gracefully skipped)');
  }

  // Clean up
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}

  console.log('\n=== ALL V2.0.0 DOCTOR, DIFF, & PYTHON SANITY TESTS PASSED! ===\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
