// src/budget-guard.js - .0.0 Pre-Flight Budget Guard & Dry-Run Inspector
import fs from 'fs';
import path from 'path';
import { estimateTokens } from './pipeline.js';
import { resolveTargetScope } from './context-scoper.js';

/**
 * Parses user-provided budget string (e.g. '15k', '25000', '1.5m', '500') into integer token count.
 * @param {string|number} input
 * @returns {number|null}
 */
export function parseBudgetLimit(input) {
  if (typeof input === 'number') {
    return input > 0 ? Math.floor(input) : null;
  }
  if (!input || typeof input !== 'string') return null;

  const clean = input.trim().toLowerCase();
  const match = clean.match(/^(\d+(?:\.\d+)?)\s*([km])?$/);
  if (!match) return null;

  const num = parseFloat(match[1]);
  const unit = match[2];

  if (unit === 'k') {
    return Math.floor(num * 1000);
  }
  if (unit === 'm') {
    return Math.floor(num * 1000000);
  }
  return Math.floor(num);
}

/**
 * Calculates pre-flight context weights (prompt, directives, and target files) before execution.
 * @param {string} promptText
 * @param {string} cwd
 * @param {object} [options]
 * @returns {object} Pre-flight weight analysis
 */
export function calculatePreFlightWeight(promptText, cwd = process.cwd(), options = {}) {
  const effectiveCwd = path.resolve(cwd);
  const promptTokens = estimateTokens(promptText || '');

  // Directives & superPrompt overhead
  const superPromptText = options.superPrompt || '';
  const superPromptTokens = superPromptText ? estimateTokens(superPromptText) : 750;

  // Resolve targeted files
  let targets = [];
  if (Array.isArray(options.targetFiles) && options.targetFiles.length > 0) {
    targets = options.targetFiles;
  } else if (promptText) {
    const scope = resolveTargetScope(promptText, effectiveCwd);
    targets = scope?.targets || [];
  }

  const targetFileDetails = [];
  let targetFilesTokens = 0;

  for (const relPath of targets) {
    const fullPath = path.isAbsolute(relPath) ? relPath : path.join(effectiveCwd, relPath);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      try {
        const stats = fs.statSync(fullPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split(/\r?\n/).length;
        const tokens = estimateTokens(content);
        targetFileDetails.push({
          relPath: path.relative(effectiveCwd, fullPath).replace(/\\/g, '/'),
          lines,
          bytes: stats.size,
          estimatedTokens: tokens
        });
        targetFilesTokens += tokens;
      } catch {}
    }
  }

  const totalEstimatedTokens = promptTokens + superPromptTokens + targetFilesTokens;
  const budgetLimit = parseBudgetLimit(options.budgetLimit);
  const isWithinBudget = budgetLimit ? totalEstimatedTokens <= budgetLimit : true;

  return {
    promptText: promptText || '',
    promptTokens,
    superPromptTokens,
    targetFiles: targetFileDetails,
    targetFilesTokens,
    totalEstimatedTokens,
    budgetLimit,
    isWithinBudget
  };
}

/**
 * Formats human-readable pre-flight inspection report.
 * @param {object} weightData
 * @param {object} [options]
 * @returns {string} Colorized report
 */
export function formatPreFlightReport(weightData, options = {}) {
  const {
    promptTokens,
    superPromptTokens,
    targetFiles,
    targetFilesTokens,
    totalEstimatedTokens,
    budgetLimit,
    isWithinBudget
  } = weightData;

  const lines = [];
  lines.push('\x1b[1m\x1b[36m===============================================================');
  lines.push('   GRAVITON PRE-FLIGHT CONTEXT & BUDGET INSPECTOR');
  lines.push('===============================================================\x1b[0m');

  lines.push(`  \x1b[1mPrompt Direct Input\x1b[0m   : ~${promptTokens.toLocaleString()} tokens`);
  lines.push(`  \x1b[1mDirectives Overhead\x1b[0m   : ~${superPromptTokens.toLocaleString()} tokens \x1b[90m(Brevity & Surgical Diffs)\x1b[0m`);

  if (targetFiles.length > 0) {
    lines.push(`  \x1b[1mTargeted Files (${targetFiles.length})\x1b[0m  : ~${targetFilesTokens.toLocaleString()} tokens`);
    for (const f of targetFiles) {
      const kb = (f.bytes / 1024).toFixed(1);
      lines.push(`    \x1b[90m↳\x1b[0m \x1b[33m${f.relPath}\x1b[0m \x1b[90m(${f.lines.toLocaleString()} lines, ${kb} KB) -> ~${f.estimatedTokens.toLocaleString()} tokens\x1b[0m`);
    }
  } else {
    lines.push(`  \x1b[1mTargeted Files\x1b[0m        : \x1b[90mNone explicitly referenced\x1b[0m`);
  }

  lines.push('\x1b[90m---------------------------------------------------------------\x1b[0m');
  lines.push(`  \x1b[1;37mTotal Estimated Turn\x1b[0m  : \x1b[1;36m~${totalEstimatedTokens.toLocaleString()} tokens\x1b[0m`);

  if (budgetLimit) {
    const pct = ((totalEstimatedTokens / budgetLimit) * 100).toFixed(1);
    if (isWithinBudget) {
      lines.push(`  \x1b[1mBudget Ceiling\x1b[0m        : \x1b[32m${budgetLimit.toLocaleString()} tokens (✔  WITHIN BUDGET: ${pct}%)\x1b[0m`);
    } else {
      const excess = totalEstimatedTokens - budgetLimit;
      lines.push(`  \x1b[1mBudget Ceiling\x1b[0m        : \x1b[1;31m${budgetLimit.toLocaleString()} tokens (✖  EXCEEDED by +${excess.toLocaleString()} tokens, ${pct}%)\x1b[0m`);
    }
  } else {
    lines.push(`  \x1b[1mBudget Ceiling\x1b[0m        : \x1b[90mUnbounded (Tip: set via --budget 20k)\x1b[0m`);
  }
  lines.push('\x1b[90m---------------------------------------------------------------\x1b[0m');

  return lines.join('\n');
}

/**
 * Checks if estimated tokens violate a budget limit.
 * @param {number} estimatedTokens
 * @param {number|string} budgetLimit
 * @returns {{ violated: boolean, estimated: number, limit: number|null, message?: string }}
 */
export function checkBudgetViolation(estimatedTokens, budgetLimit) {
  const limit = parseBudgetLimit(budgetLimit);
  if (!limit || limit <= 0) {
    return { violated: false, estimated: estimatedTokens, limit: null };
  }

  if (estimatedTokens > limit) {
    const excess = estimatedTokens - limit;
    return {
      violated: true,
      estimated: estimatedTokens,
      limit,
      excess,
      message: `Estimated turn context (~${estimatedTokens.toLocaleString()} tokens) exceeds budget limit of ${limit.toLocaleString()} tokens by +${excess.toLocaleString()} tokens.`
    };
  }

  return {
    violated: false,
    estimated: estimatedTokens,
    limit,
    excess: 0
  };
}
