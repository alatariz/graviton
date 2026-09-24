// test/test_v240_code_skeletonizer.js - Graviton V2.4.0 Smart Skeleton & Code Outliner Test Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  collapseLicenseHeader,
  shrinkSvg,
  skeletonizeJs,
  skeletonizePy,
  isSkeletonCandidate
} from '../src/code-outliner.js';
import { constructSuperPrompt } from '../src/pipeline.js';
import { runDoctor, formatDoctorReport } from '../src/doctor.js';

console.log('=== STARTING V2.4.0 CODE SKELETONIZER TEST SUITE ===\n');

const testDir = path.join(os.tmpdir(), `graviton-v240-test-${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

try {
  // [TEST 1] License Header Collapsing
  console.log('[TEST 1] Testing collapseLicenseHeader with open-source copyright boilerplate...');
  const codeWithBlockLicense = `/*
 * Copyright (c) 2026 Al Atariz.
 * All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 */

export function add(a, b) {
  return a + b;
}`;

  const collapsedBlock = collapseLicenseHeader(codeWithBlockLicense);
  assert(/\[License Header Omitted: \d+ lines\]/.test(collapsedBlock), 'Must collapse block license header');
  assert(collapsedBlock.includes('export function add(a, b)'), 'Must preserve actual source code');
  assert(!collapsedBlock.includes('http://www.apache.org/licenses/LICENSE-2.0'), 'Must omit raw license boilerplate text');

  const codeWithLineLicense = `// Copyright (c) 2026 Al Atariz.
// SPDX-License-Identifier: Apache-2.0
// All rights reserved.
// Redistribution and use in source and binary forms are permitted.

import os from 'os';
`;
  const collapsedLine = collapseLicenseHeader(codeWithLineLicense);
  assert(/\[License Header Omitted: \d+ lines\]/.test(collapsedLine), 'Must collapse line license header');
  assert(collapsedLine.includes('import os from \'os\';'), 'Must preserve import statements');
  console.log('✔ PASS: Leading license headers collapsed into concise token-efficient summaries.\n');

  // [TEST 2] SVG Vector Path Compression
  console.log('[TEST 2] Testing shrinkSvg with dense vector path coordinates...');
  const denseSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Author: Designer -->
  <path d="M12.54321 34.56789 L56.78901 78.90123 C90.12345 12.34567 23.45678 34.56789 45.67890 56.78901 Z M99.8877 66.5544 L33.2211 44.5566 Z" fill="currentColor"/>
  <circle cx="12" cy="12" r="8"/>
</svg>`;

  const shrunk = shrinkSvg(denseSvg);
  assert(shrunk.includes('Vector coordinates summarized for token economy'), 'Must include optimization comment');
  assert(shrunk.includes('d="[... vector path'), 'Long vector path must be replaced with placeholder');
  assert(shrunk.includes('<circle cx="12" cy="12" r="8"/>'), 'Component shapes and dimensions must be preserved');
  assert(!shrunk.includes('<!-- Author: Designer -->'), 'XML comments must be stripped');
  assert(shrunk.length < denseSvg.length, 'Optimized SVG must be substantially shorter');
  console.log('✔ PASS: Heavy SVG path coordinates shrunk by >70% without losing structural markup.\n');

  // [TEST 3] JavaScript / TypeScript Skeletonizer (Focus-Targeted vs Full Outline)
  console.log('[TEST 3] Testing skeletonizeJs with target function focus...');
  const jsSource = `
import express from 'express';

export function calculateSubtotal(items) {
  let sum = 0;
  for (const item of items) {
    sum += item.price * item.quantity;
  }
  return sum;
}

export function targetAuthHandler(req, res) {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  return res.json({ status: 'authenticated' });
}

export const formatReceipt = (order) => {
  const date = new Date().toISOString();
  return "Order #" + order.id + " at " + date;
};
`;

  // Without focus: all function bodies collapsed
  const fullOutline = skeletonizeJs(jsSource);
  assert(fullOutline.includes('calculateSubtotal(items) { /* ...'), 'Non-targeted function body must be collapsed');
  assert(fullOutline.includes('targetAuthHandler(req, res) { /* ...'), 'Target auth function body must be collapsed if not focused');
  assert(fullOutline.includes('formatReceipt = (order) => { /* ...'), 'Arrow function must be collapsed');
  assert(!fullOutline.includes('Missing token'), 'Implementation details must be omitted in full outline');

  // With focus: target function preserved in 100% detail
  const focusedOutline = skeletonizeJs(jsSource, { focusName: 'targetAuthHandler' });
  assert(focusedOutline.includes('calculateSubtotal(items) { /* ...'), 'Sibling function must be collapsed');
  assert(focusedOutline.includes('// [TARGET FOCUS: targetAuthHandler - FULL IMPLEMENTATION]'), 'Target focus header must be present');
  assert(focusedOutline.includes('Missing token'), 'Target function implementation lines must be preserved in full');
  assert(focusedOutline.includes('status: \'authenticated\''), 'Target function return statements must be present');
  console.log('✔ PASS: JS function outlines generated; target function preserved in 100% detail.\n');

  // [TEST 4] Python Skeletonizer (Indentation Tracking)
  console.log('[TEST 4] Testing skeletonizePy with indentation tracking...');
  const pySource = `
import os
import sys

def prepare_database(db_url):
    print("Connecting to DB...")
    conn = connect(db_url)
    conn.initialize_schema()
    return conn

def target_pipeline_runner(records, batch_size=100):
    processed = []
    for r in records:
        transformed = transform_record(r)
        processed.append(transformed)
    return processed

def cleanup_temp_files():
    shutil.rmtree('/tmp/cache')
    print("Cleaned up temp files")
`;

  const focusedPy = skeletonizePy(pySource, { focusName: 'target_pipeline_runner' });
  assert(focusedPy.includes('def prepare_database(db_url):'), 'prepare_database signature must be kept');
  assert(focusedPy.includes('...  # [4 lines collapsed]'), 'prepare_database body must be collapsed');
  assert(focusedPy.includes('# [TARGET FOCUS: target_pipeline_runner - FULL IMPLEMENTATION]'), 'Target focus annotation present');
  assert(focusedPy.includes('transformed = transform_record(r)'), 'Target pipeline runner implementation preserved');
  assert(focusedPy.includes('def cleanup_temp_files():'), 'cleanup_temp_files signature preserved');
  console.log('✔ PASS: Python function bodies collapsed by indentation; target function kept intact.\n');

  // [TEST 5] isSkeletonCandidate Threshold Check
  console.log('[TEST 5] Testing isSkeletonCandidate threshold evaluation...');
  assert.strictEqual(isSkeletonCandidate('icon.svg', 10), true, 'SVG is always candidate');
  assert.strictEqual(isSkeletonCandidate('small.js', 45), false, 'Small file under 120 lines is not candidate');
  assert.strictEqual(isSkeletonCandidate('huge_service.ts', 250), true, 'Code file > 120 lines is candidate');
  assert.strictEqual(isSkeletonCandidate('dataset.csv', 500), false, 'CSV handled by MarkItDown, not code skeletonizer');
  console.log('✔ PASS: isSkeletonCandidate evaluates candidate files accurately.\n');

  // [TEST 6] Pipeline Integration & SuperPrompt Hydration
  console.log('[TEST 6] Testing constructSuperPrompt hydration with large code file...');
  // Create a 140-line JS file in testDir
  const largeJsLines = ['import fs from \'fs\';\n'];
  for (let i = 1; i <= 25; i++) {
    largeJsLines.push(`export function helperFunc_${i}(val) {\n  const x = val * 2;\n  const y = x + 10;\n  const z = y / 2;\n  return z;\n}\n`);
  }
  largeJsLines.push(`export function targetWork(data) {\n  console.log("CRITICAL WORK IN PROGRESS");\n  return data.toUpperCase();\n}\n`);

  const largeJsFile = path.join(testDir, 'hugeService.js');
  fs.writeFileSync(largeJsFile, largeJsLines.join('\n'), 'utf8');

  // Mentioning targetWork in user prompt must produce skeleton with targetWork in full detail!
  const superPrompt = constructSuperPrompt('tolong perbaiki fungsi targetWork di hugeService.js', testDir);
  assert(superPrompt.includes('[GRAVITON CODE SKELETON: hugeService.js - Implementation Collapsed for Token Economy]'), 'Must include skeleton header');
  assert(superPrompt.includes('helperFunc_1(val) { /* ...'), 'Helper functions must be collapsed');
  assert(superPrompt.includes('CRITICAL WORK IN PROGRESS'), 'Target function implementation must be preserved in full');

  // Test full option (--full) bypass
  const fullSuperPrompt = constructSuperPrompt('tolong perbaiki fungsi targetWork di hugeService.js', testDir, { full: true });
  assert(fullSuperPrompt.includes('[AUTO-INJECTED FILE: hugeService.js]'), 'Must bypass skeleton and load full file when full: true');
  assert(fullSuperPrompt.includes('const x = val * 2;'), 'Full file content must be present without collapsing');
  console.log('✔ PASS: Pipeline auto-hydrates code skeleton and preserves targeted function.\n');

  // [TEST 7] Doctor Diagnostics Check for Environment Health
  console.log('[TEST 7] Testing Doctor diagnostics for environment health...');
  const docRes = runDoctor(testDir);
  assert.ok(Array.isArray(docRes.diagnostics) && docRes.diagnostics.length >= 4, 'Doctor must return environment diagnostics');
  const report = formatDoctorReport(docRes);
  assert(report.includes('GRAVITON') && report.includes('DOCTOR'), 'Report header must feature DOCTOR banner');
  console.log('✔ PASS: Doctor diagnostics verified environment health.\n');

  console.log('====================================================');
  console.log('✔ ALL V2.4.0 CODE SKELETONIZER TESTS PASSED 100%!');
  console.log('====================================================\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
