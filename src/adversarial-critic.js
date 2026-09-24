// src/adversarial-critic.js - Graviton V5.1.1 Adversarial Red-Team & Verification Critic
// Rigorous verification for code security, resilience, and memory leak prevention.

import fs from 'fs';
import path from 'path';
import { collectWorkspaceFiles } from './workspace-helper.js';

export const CRITIC_CATEGORIES = {
  SECURITY: 'SECURITY',
  RESILIENCE: 'RESILIENCE',
  PERFORMANCE: 'PERFORMANCE',
  RESOURCES: 'RESOURCES'
};

export const SEVERITY = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW'
};

/**
 * Perform deep adversarial scan on a single code snippet or file content.
 * @param {string} code - Source code string (JavaScript, TypeScript, or HTML)
 * @param {string} [fileName='inline'] - Name or path of file being evaluated
 * @returns {object} Analysis result { passed, score, findings, stats }
 */
export function evaluateCodeAdversarially(code, fileName = 'inline') {
  if (!code || typeof code !== 'string') {
    return {
      passed: true,
      score: 100,
      fileName,
      findings: [],
      stats: { high: 0, medium: 0, low: 0 }
    };
  }

  const findings = [];
  const lines = code.split('\n');

  // Strip block comments and line comments for pattern analysis to reduce noise
  const cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

  // 1. SECURITY: Raw innerHTML or outerHTML injection without sanitization
  const innerHtmlRegex = /\.inner(?:HTML|HTML\s*)\s*=\s*([^;\n]+)/g;
  let match;
  while ((match = innerHtmlRegex.exec(cleanCode)) !== null) {
    const assignedExpr = match[1].trim();
    // Allow only strictly enclosed static string literals
    const isSafeLiteral = (
      (/^'[^'\\]*'$/.test(assignedExpr)) ||
      (/^"[^"\\]*"$/.test(assignedExpr)) ||
      (/^`[^`\\$]*`$/.test(assignedExpr))
    );
    if (!isSafeLiteral) {
      const lineNo = getLineNumber(code, match.index);
      findings.push({
        category: CRITIC_CATEGORIES.SECURITY,
        severity: SEVERITY.HIGH,
        ruleId: 'SEC-XSS-INNERHTML',
        file: fileName,
        line: lineNo,
        description: `Potential XSS vector: Unsanitized dynamic expression assigned to innerHTML: "${assignedExpr.slice(0, 50)}"`,
        remediation: 'Use textContent, safe DOM creation (createElement), or an explicit HTML sanitizer before assignment.'
      });
    }
  }

  // 2. SECURITY: Insecure evaluation (eval / new Function)
  const evalRegex = /\b(?:eval|new\s+Function)\s*\(/g;
  while ((match = evalRegex.exec(cleanCode)) !== null) {
    const lineNo = getLineNumber(code, match.index);
    findings.push({
      category: CRITIC_CATEGORIES.SECURITY,
      severity: SEVERITY.HIGH,
      ruleId: 'SEC-CODE-EVAL',
      file: fileName,
      line: lineNo,
      description: 'Arbitrary code execution primitive detected (eval or Function constructor).',
      remediation: 'Replace dynamic evaluation with static AST parsers or deterministic lookup tables.'
    });
  }

  // 3. RESILIENCE: Unchecked JSON.parse without try/catch
  const jsonParseRegex = /JSON\.parse\s*\(/g;
  while ((match = jsonParseRegex.exec(cleanCode)) !== null) {
    const matchIdx = match.index;
    const surroundingBlock = getSurroundingScope(cleanCode, matchIdx);
    if (!surroundingBlock.includes('try') && !surroundingBlock.includes('catch')) {
      const lineNo = getLineNumber(code, matchIdx);
      findings.push({
        category: CRITIC_CATEGORIES.RESILIENCE,
        severity: SEVERITY.MEDIUM,
        ruleId: 'RES-UNGUARDED-JSON',
        file: fileName,
        line: lineNo,
        description: 'JSON.parse called outside of a try/catch block. Malformed JSON will cause unhandled crash.',
        remediation: 'Enclose JSON.parse in try/catch or use a defensive safeParse utility.'
      });
    }
  }

  // 4. RESILIENCE: Unhandled async Promise / fetch without catch
  const fetchRegex = /\bfetch\s*\([^)]*\)(?!\s*\.catch|\s*\.then\([^)]*,)/g;
  while ((match = fetchRegex.exec(cleanCode)) !== null) {
    const surroundingBlock = getSurroundingScope(cleanCode, match.index);
    // If not in try/catch and not chained with catch
    if (!surroundingBlock.includes('try') && !surroundingBlock.includes('catch') && !cleanCode.slice(match.index, match.index + 100).includes('await')) {
      const lineNo = getLineNumber(code, match.index);
      findings.push({
        category: CRITIC_CATEGORIES.RESILIENCE,
        severity: SEVERITY.MEDIUM,
        ruleId: 'RES-UNHANDLED-FETCH',
        file: fileName,
        line: lineNo,
        description: 'Asynchronous fetch network operation without error handler or await within try/catch.',
        remediation: 'Ensure all network requests have explicit .catch() handlers or are awaited inside try/catch.'
      });
    }
  }

  // 5. RESOURCES: Event listener memory leak
  // Detection: window.addEventListener or document.addEventListener for high-frequency events (scroll, resize, mousemove)
  const leakRegex = /(?:window|document)\.addEventListener\s*\(\s*['"](scroll|resize|mousemove|touchmove)['"]/g;
  while ((match = leakRegex.exec(cleanCode)) !== null) {
    const eventName = match[1];
    const hasRemoval = cleanCode.includes('removeEventListener') || cleanCode.includes('AbortController') || cleanCode.includes('signal');
    if (!hasRemoval) {
      const lineNo = getLineNumber(code, match.index);
      findings.push({
        category: CRITIC_CATEGORIES.RESOURCES,
        severity: SEVERITY.MEDIUM,
        ruleId: 'RES-LISTENER-LEAK',
        file: fileName,
        line: lineNo,
        description: `High-frequency event listener added ('${eventName}') without matching cleanup or AbortSignal.`,
        remediation: 'Supply an AbortController signal or store reference for removeEventListener teardown.'
      });
    }
  }

  // 6. RESOURCES: Unbound setInterval
  const intervalRegex = /\bsetInterval\s*\(/g;
  while ((match = intervalRegex.exec(cleanCode)) !== null) {
    if (!cleanCode.includes('clearInterval')) {
      const lineNo = getLineNumber(code, match.index);
      findings.push({
        category: CRITIC_CATEGORIES.RESOURCES,
        severity: SEVERITY.LOW,
        ruleId: 'RES-UNBOUND-INTERVAL',
        file: fileName,
        line: lineNo,
        description: 'setInterval registered without clearInterval reference in file.',
        remediation: 'Retain timer ID handle and implement clearInterval on teardown/destruction.'
      });
    }
  }

  // 7. PERFORMANCE: Regular Expression Catastrophic Backtracking (ReDoS)
  const redosRegex = /\/([^\/\n]*\([^)\n]*[+*]\)[+*][^\/\n]*)\//g;
  while ((match = redosRegex.exec(cleanCode)) !== null) {
    const pattern = match[1];
    const lineNo = getLineNumber(code, match.index);
    findings.push({
      category: CRITIC_CATEGORIES.PERFORMANCE,
      severity: SEVERITY.HIGH,
      ruleId: 'PERF-REDOS-VULN',
      file: fileName,
      line: lineNo,
      description: `Nested quantifier in RegExp literal /${pattern}/ presents catastrophic backtracking risk (ReDoS).`,
      remediation: 'Simplify regular expression to eliminate nested non-finite quantifiers (e.g. (a+)+).'
    });
  }

  // Calculate score: Start at 100, High -25, Medium -10, Low -5
  let score = 100;
  const stats = { high: 0, medium: 0, low: 0 };
  for (const f of findings) {
    if (f.severity === SEVERITY.HIGH) {
      score -= 25;
      stats.high++;
    } else if (f.severity === SEVERITY.MEDIUM) {
      score -= 10;
      stats.medium++;
    } else {
      score -= 5;
      stats.low++;
    }
  }
  score = Math.max(0, score);
  const passed = stats.high === 0 && score >= 75;

  return {
    passed,
    score,
    fileName,
    findings,
    stats
  };
}

/**
 * Scan an entire workspace for adversarial security and resilience defects.
 * @param {string} workspaceDir - Directory path to audit
 * @param {object} [options]
 * @returns {object} Workspace audit summary
 */
export function evaluateWorkspaceAdversarially(workspaceDir, options = {}) {
  const targetDir = path.resolve(workspaceDir || process.cwd());
  const maxFiles = options.maxFiles || 100;
  const filesToScan = collectWorkspaceFiles(targetDir, {
    maxFiles,
    extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.html']
  });

  const fileReports = [];
  let totalHigh = 0;
  let totalMedium = 0;
  let totalLow = 0;
  let cumulativeScore = 0;

  for (const filePath of filesToScan) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relPath = path.relative(targetDir, filePath);
      const rep = evaluateCodeAdversarially(content, relPath);
      fileReports.push(rep);
      totalHigh += rep.stats.high;
      totalMedium += rep.stats.medium;
      totalLow += rep.stats.low;
      cumulativeScore += rep.score;
    } catch {}
  }

  const fileCount = fileReports.length;
  const averageScore = fileCount > 0 ? Math.round(cumulativeScore / fileCount) : 100;
  const passed = totalHigh === 0 && averageScore >= 75;

  return {
    workspaceDir: targetDir,
    filesAudited: fileCount,
    passed,
    averageScore,
    totalFindings: totalHigh + totalMedium + totalLow,
    stats: {
      high: totalHigh,
      medium: totalMedium,
      low: totalLow
    },
    reports: fileReports.filter(r => r.findings.length > 0)
  };
}

/**
 * Format a human-readable adversarial critique report.
 * @param {object} auditReport - Result of evaluateWorkspaceAdversarially or evaluateCodeAdversarially
 * @returns {string} Formatted critique block
 */
export function formatAdversarialCritique(auditReport) {
  const out = [];
  out.push('===============================================================');
  out.push('   GRAVITON ADVERSARIAL RED-TEAM & CRITIC REPORT');
  out.push('===============================================================');

  const isWorkspace = 'workspaceDir' in auditReport;
  const score = isWorkspace ? auditReport.averageScore : auditReport.score;
  const passed = auditReport.passed;

  out.push(`Status : ${passed ? '[PASSED]' : '[DEFECTS DETECTED]'}`);
  out.push(`Rigor Score : ${score}/100`);
  out.push(`Severity Breakdown : High: ${auditReport.stats.high}, Medium: ${auditReport.stats.medium}, Low: ${auditReport.stats.low}`);

  if (isWorkspace) {
    out.push(`Files Audited : ${auditReport.filesAudited}`);
    out.push(`Target Workspace : ${auditReport.workspaceDir}`);
  } else {
    out.push(`Target File : ${auditReport.fileName}`);
  }
  out.push('---------------------------------------------------------------');

  const findings = isWorkspace
    ? auditReport.reports.flatMap(r => r.findings)
    : auditReport.findings;

  if (findings.length === 0) {
    out.push('DIALECTICAL CHALLENGE:');
    out.push('  No security or architectural anti-patterns detected.');
    out.push('  Code passes adversarial verification with maximum integrity.');
  } else {
    out.push('DIALECTICAL CHALLENGES & VULNERABILITY VECTORS:');
    findings.forEach((f, idx) => {
      out.push(`[#${idx + 1}] [${f.severity}] ${f.ruleId} (${f.file}:${f.line})`);
      out.push(`    Defect     : ${f.description}`);
      out.push(`    Remedy     : ${f.remediation}`);
    });
    out.push('---------------------------------------------------------------');
    out.push('MANDATORY HARDENING DIRECTIVE:');
    out.push('Remediate all HIGH and MEDIUM defects prior to production delivery.');
  }

  out.push('===============================================================');
  return out.join('\n');
}

/**
 * Generate dialectical adversary prompt instructions for the AI assistant.
 * Injected as cognitive constraint during refinement turns.
 * @param {object} auditReport
 * @returns {string} Injected cognitive directive
 */
export function synthesizeAdversarialPromptHarness(auditReport) {
  if (!auditReport || auditReport.passed) return '';

  const findings = 'reports' in auditReport
    ? auditReport.reports.flatMap(r => r.findings)
    : auditReport.findings;

  if (findings.length === 0) return '';

  const topIssues = findings.slice(0, 5).map(f =>
    `- [${f.severity}] [${f.ruleId}] Line ${f.line} in ${f.file}: ${f.description} -> FIX: ${f.remediation}`
  ).join('\n');

  return `
=== [GRAVITON ADVERSARIAL CRITIC DIRECTIVE] ===
The Dialectical Adversary Critic flagged the following architectural & security flaws:
${topIssues}
You MUST resolve all flagged defect vectors in your response. Ensure complete sanitization, error isolation, and resource teardown.
==============================================
`.trim();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLineNumber(code, index) {
  return code.slice(0, index).split('\n').length;
}

function getSurroundingScope(code, index, range = 250) {
  const start = Math.max(0, index - range);
  const end = Math.min(code.length, index + range);
  return code.slice(start, end);
}


