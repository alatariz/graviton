// src/unified-orchestrator.js - Graviton V5.0.0 Unified Coordinator Engine
// Master coordinator orchestrating static analysis, AST property graphs, and runtime verification.

import fs from 'fs';
import path from 'path';
import { analyzePromptAmbiguity, synthesizeClarifiedSpecificationBlock } from './ambiguity-clarifier.js';
import { synthesizeGroundedResearchBlock } from './live-researcher.js';
import { resolveDesignSystem, formatDesignSystemSpecification } from './design-intelligence.js';
import { buildCodePropertyGraph, calculateBlastRadius, formatBlastRadiusReport } from './code-property-graph.js';
import { evaluateWorkspaceAdversarially, formatAdversarialCritique } from './adversarial-critic.js';
import { verifyProjectRuntime, generateSelfCorrectionDirective } from './runtime-sentinel.js';
import { auditDeadCode, formatDeadCodeReport } from './dead-code-cleaner.js';
import { generateTestFile } from './test-generator.js';
import { constructSuperPrompt, getPromptCachePrefix } from './pipeline.js';

/**
 * Execute unified end-to-end orchestration analysis for a user request.
 * @param {string} userInput - Raw user prompt
 * @param {string} workspaceDir - Target workspace directory
 * @param {object} [options]
 * @returns {object} Orchestration plan and synthesized prompt
 */
export function executeUnifiedOrchestration(userInput, workspaceDir = process.cwd(), options = {}) {
  const root = path.resolve(workspaceDir);
  const promptText = userInput || '';

  // 1. Ingestion & Ambiguity Analysis
  const ambiguity = analyzePromptAmbiguity(promptText);

  // 2. Code Property Graph & Blast Radius
  const cpg = buildCodePropertyGraph(root);

  // 3. Grounded 2026 API Research
  const groundedBlock = synthesizeGroundedResearchBlock(promptText);

  // 4. Design System Resolution
  const designSystem = resolveDesignSystem(promptText);

  // 5. Synthesize SuperPrompt through the pipeline
  const superPrompt = constructSuperPrompt(promptText, root, options);

  return {
    version: '5.0.0',
    workspaceDir: root,
    inputPrompt: promptText,
    ambiguityAnalysis: ambiguity,
    cpgSummary: {
      totalFiles: cpg.totalFiles,
      totalSymbols: cpg.totalSymbols
    },
    hasGrounding: Boolean(groundedBlock),
    designSystem: designSystem.category,
    superPrompt
  };
}

/**
 * Run a unified multi-engine health check across the workspace.
 * Integrates Sentinel (Syntax & DOM), Critic (Security & Leaks), and Dead-Code Cleaner.
 * @param {string} workspaceDir - Workspace directory
 * @returns {object} Unified sanity report
 */
export function runUnifiedSanityCheck(workspaceDir = process.cwd()) {
  const root = path.resolve(workspaceDir);

  // Engine 1: Runtime Sentinel
  const sentinelReport = verifyProjectRuntime(root);

  // Engine 2: Adversarial Critic
  const criticReport = evaluateWorkspaceAdversarially(root);

  // Engine 3: Dead-Code Eliminator
  const deadCodeReport = auditDeadCode(root);

  // Engine 4: Code Property Graph
  const cpg = buildCodePropertyGraph(root);

  const overallPassed = sentinelReport.valid && criticReport.passed;

  return {
    version: '5.0.0',
    workspaceDir: root,
    passed: overallPassed,
    sentinel: sentinelReport,
    critic: criticReport,
    deadCode: deadCodeReport,
    cpg: {
      totalFiles: cpg.totalFiles,
      totalSymbols: cpg.totalSymbols
    }
  };
}

/**
 * Format a human-readable unified diagnostic report.
 * @param {object} sanityReport
 * @returns {string} Formatted report
 */
export function formatUnifiedDiagnosticReport(sanityReport) {
  const out = [];
  out.push('===============================================================');
  out.push('   GRAVITON V5.0.0 UNIFIED AUTONOMOUS COORDINATOR REPORT');
  out.push('===============================================================');
  out.push(`Workspace Target   : ${sanityReport.workspaceDir}`);
  out.push(`Overall Integrity  : ${sanityReport.passed ? '[HEALTHY]' : '[ATTENTION REQUIRED]'}`);
  out.push('---------------------------------------------------------------');

  // Sentinel Summary
  out.push('1. RUNTIME SENTINEL:');
  out.push(`   Status          : ${sanityReport.sentinel.valid ? 'VALID' : 'DEFECTS DETECTED'}`);
  out.push(`   Summary         : ${sanityReport.sentinel.summary}`);

  // Critic Summary
  out.push('2. ADVERSARIAL CRITIC:');
  out.push(`   Rigor Score     : ${sanityReport.critic.averageScore}/100 [${sanityReport.critic.passed ? 'PASSED' : 'DEFECTS DETECTED'}]`);
  out.push(`   Findings        : High: ${sanityReport.critic.stats.high}, Med: ${sanityReport.critic.stats.medium}, Low: ${sanityReport.critic.stats.low}`);

  // Dead Code Summary
  out.push('3. ENTROPY & DEAD CODE:');
  out.push(`   Unused Items    : ${sanityReport.deadCode.totalDeadItems} total (${sanityReport.deadCode.stats.unusedImportsCount} imports, ${sanityReport.deadCode.stats.unusedExportsCount} exports)`);

  // CPG Summary
  out.push('4. CODE PROPERTY GRAPH:');
  out.push(`   Graph Topology  : ${sanityReport.cpg.totalFiles} files indexed, ${sanityReport.cpg.totalSymbols} symbols mapped`);

  out.push('===============================================================');
  return out.join('\n');
}
