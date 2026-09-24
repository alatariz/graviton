// test/test_v450_code_property_graph.js - Graviton V4.5.0 Code Property Graph Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  parseFileSymbols,
  buildCodePropertyGraph,
  calculateBlastRadius,
  formatBlastRadiusReport,
  synthesizeBlastRadiusDirective,
  RISK_LEVEL,
  CPG_NODE_TYPE
} from '../src/code-property-graph.js';

console.log('\x1b[1m\x1b[36m===============================================================');
console.log('   GRAVITON V4.5.0 CODE PROPERTY GRAPH & RELATIONAL MEMORY SUITE');
console.log('===============================================================\x1b[0m\n');

// [TEST 1] Testing AST File Symbol & Import/Export Parsing
console.log('[TEST 1] Testing parseFileSymbols on source code...');
const sampleCode = `
import { helperA, helperB as aliasB } from './utils.js';
import defaultEngine from './engine.js';

export function processPipeline(data) {
  const step1 = helperA(data);
  const step2 = aliasB(step1);
  return step2;
}

export const PIPELINE_VERSION = '1.0.0';

function internalWorker() {
  console.log('working');
}
`;
const parsed = parseFileSymbols(sampleCode, 'pipeline.js');
assert.strictEqual(parsed.exports.length, 2, 'Must extract 2 exports');
assert.ok(parsed.exports.some(e => e.name === 'processPipeline' && e.type === CPG_NODE_TYPE.FUNCTION), 'Must extract processPipeline export');
assert.ok(parsed.exports.some(e => e.name === 'PIPELINE_VERSION' && e.type === CPG_NODE_TYPE.VARIABLE), 'Must extract PIPELINE_VERSION export');
assert.strictEqual(parsed.imports.length, 2, 'Must extract 2 import statements');
assert.ok(parsed.calls.includes('helperA'), 'Must record helperA invocation');
assert.ok(parsed.calls.includes('aliasB'), 'Must record aliasB invocation');
console.log('  ✔ PASS: AST parsing correctly maps exports, imports, and calls\n');

// [TEST 2] Testing Multi-File Graph Construction & Reverse Dependency Resolution
console.log('[TEST 2] Testing buildCodePropertyGraph on multi-module hierarchy...');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graviton-v450-cpg-'));

try {
  // Setup module tree:
  // a.js (core utility) <- b.js (service) <- c.js (controller)
  //                                       <- test_b.js (test file)
  fs.writeFileSync(path.join(tempDir, 'a.js'), `
    export function computeSum(x, y) { return x + y; }
    export const PI = 3.14159;
  `);

  fs.writeFileSync(path.join(tempDir, 'b.js'), `
    import { computeSum } from './a.js';
    export function calculateTotal(items) {
      return items.reduce((acc, val) => computeSum(acc, val), 0);
    }
  `);

  fs.writeFileSync(path.join(tempDir, 'c.js'), `
    import { calculateTotal } from './b.js';
    export function handleRequest(req) {
      return calculateTotal(req.items);
    }
  `);

  fs.writeFileSync(path.join(tempDir, 'test_b.js'), `
    import { calculateTotal } from './b.js';
    console.log(calculateTotal([1, 2, 3]));
  `);

  const cpg = buildCodePropertyGraph(tempDir);
  assert.strictEqual(cpg.totalFiles, 4, 'Must index all 4 files');
  assert.ok(cpg.totalSymbols >= 3, 'Must index exported symbols');

  // Verify reverse dependencies
  assert.ok(cpg.reverseDeps['a.js'].includes('b.js'), 'a.js must have direct dependent b.js');
  assert.ok(cpg.reverseDeps['b.js'].includes('c.js'), 'b.js must have direct dependent c.js');
  assert.ok(cpg.reverseDeps['b.js'].includes('test_b.js'), 'b.js must have direct dependent test_b.js');
  console.log('  ✔ PASS: Code Property Graph builds cross-file dependency topology\n');

  // [TEST 3] Testing Blast Radius Calculation (Direct & Transitive)
  console.log('[TEST 3] Testing calculateBlastRadius on core module a.js...');
  const blastA = calculateBlastRadius(cpg, 'a.js');
  assert.strictEqual(blastA.found, true, 'Target a.js must be found in graph');
  assert.strictEqual(blastA.directConsumers.length, 1, 'a.js has 1 direct consumer (b.js)');
  assert.ok(blastA.directConsumers.includes('b.js'), 'Direct consumer must be b.js');
  assert.ok(blastA.indirectConsumers.includes('c.js'), 'c.js must be transitive indirect consumer');
  assert.ok(blastA.indirectConsumers.includes('test_b.js'), 'test_b.js must be transitive indirect consumer');
  assert.strictEqual(blastA.impactScore, 3, 'Total blast impact must be 3 files');
  assert.ok(blastA.recommendedVerification.includes('test_b.js'), 'Recommended verification must prioritize tests');
  console.log('  ✔ PASS: Blast radius detects direct and transitive downstream ripple effect\n');

  // [TEST 4] Testing Leaf Node Blast Radius
  console.log('[TEST 4] Testing calculateBlastRadius on leaf consumer c.js...');
  const blastC = calculateBlastRadius(cpg, 'c.js');
  assert.strictEqual(blastC.directConsumers.length, 0, 'Leaf consumer has 0 direct consumers');
  assert.strictEqual(blastC.indirectConsumers.length, 0, 'Leaf consumer has 0 indirect consumers');
  assert.strictEqual(blastC.riskLevel, RISK_LEVEL.LOW, 'Leaf consumer modification is LOW risk');
  console.log('  ✔ PASS: Leaf node safely evaluated as LOW risk\n');

  // [TEST 5] Testing formatBlastRadiusReport
  console.log('[TEST 5] Testing formatBlastRadiusReport formatting...');
  const reportText = formatBlastRadiusReport(blastA);
  assert.ok(reportText.includes('GRAVITON CODE PROPERTY GRAPH: BLAST RADIUS REPORT'), 'Header present');
  assert.ok(reportText.includes('Target File      : a.js'), 'Target file present');
  assert.ok(reportText.includes('DIRECT CONSUMERS (Will directly break if exports change)'), 'Direct section present');
  assert.ok(reportText.includes('INDIRECT DOWNSTREAM CONSUMERS'), 'Indirect section present');
  console.log('  ✔ PASS: Formatted blast report contains structured risk telemetry\n');

  // [TEST 6] Testing synthesizeBlastRadiusDirective for Prompt Injection
  console.log('[TEST 6] Testing synthesizeBlastRadiusDirective prompt constraints...');
  const directive = synthesizeBlastRadiusDirective(cpg, ['a.js']);
  assert.ok(directive.includes('=== [GRAVITON CODE PROPERTY GRAPH: BLAST RADIUS CONSTRAINTS] ==='), 'Directive header present');
  assert.ok(directive.includes('TARGET: a.js'), 'Target identified');
  assert.ok(directive.includes('CRITICAL INVARIANT: You MUST preserve all existing function signatures'), 'Contract preservation invariant enforced');
  console.log('  ✔ PASS: Cognitive blast radius constraints successfully generated\n');

} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

// [TEST 7] Testing 100% Zero-Emoji Compliance
console.log('[TEST 7] Testing Zero-Emoji policy across V4.5.0 CPG components...');
const sampleBlast = formatBlastRadiusReport({
  found: false,
  target: 'unknown.js',
  riskLevel: RISK_LEVEL.LOW,
  directConsumers: [],
  indirectConsumers: []
});
const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
assert.strictEqual(emojiRegex.test(sampleBlast), false, 'Report output must contain zero emojis');
console.log('  ✔ PASS: 100% Zero-Emoji standard verified\n');

console.log('===============================================================');
console.log('✔ ALL GRAVITON V4.5.0 CODE PROPERTY GRAPH TESTS PASSED 100%!');
console.log('===============================================================\n');
