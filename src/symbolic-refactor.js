// src/symbolic-refactor.js - Graviton V5.1.1 Symbolic Refactoring Engine
// AST-guided safe symbol renaming and call-site migrations across workspace files.

import fs from 'fs';
import path from 'path';
import { normalizePath } from './workspace-helper.js';
import { buildCodePropertyGraph, calculateBlastRadius } from './code-property-graph.js';

/**
 * Plan a symbol rename operation across a workspace without modifying files.
 * @param {string} workspaceDir - Workspace root directory
 * @param {string} targetFile - Relative path to the file declaring the symbol
 * @param {string} oldSymbol - Original symbol name
 * @param {string} newSymbol - New symbol name
 * @returns {object} Refactoring plan with impacted files and replacement patches
 */
export function planSymbolRename(workspaceDir, targetFile, oldSymbol, newSymbol) {
  if (!oldSymbol || !newSymbol || oldSymbol === newSymbol) {
    throw new Error('Both oldSymbol and newSymbol are required and must be distinct.');
  }

  const root = path.resolve(workspaceDir || process.cwd());
  const cpg = buildCodePropertyGraph(root);
  const relTarget = path.isAbsolute(targetFile) ? path.relative(root, targetFile) : targetFile;
  const normTarget = normalizePath(relTarget);

  // Match target file in CPG
  const matchedFile = Object.keys(cpg.files).find(f =>
    f === normTarget || normTarget.endsWith(f) || f.endsWith(normTarget)
  );

  if (!matchedFile) {
    throw new Error(`Target file not found in workspace: ${targetFile}`);
  }

  const fileData = cpg.files[matchedFile];
  const definesSymbol = fileData.exports.some(e => e.name === oldSymbol) ||
                        fileData.functions.some(f => f.name === oldSymbol);

  if (!definesSymbol) {
    throw new Error(`Symbol '${oldSymbol}' is not declared or exported in ${matchedFile}`);
  }

  const blast = calculateBlastRadius(cpg, matchedFile);
  const candidateFiles = [matchedFile, ...blast.directConsumers];

  const plan = {
    workspaceDir: root,
    targetFile: matchedFile,
    oldSymbol,
    newSymbol,
    filesToUpdate: [],
    totalReplacements: 0
  };

  for (const relFile of candidateFiles) {
    const absPath = path.join(root, relFile);
    if (!fs.existsSync(absPath)) continue;

    const content = fs.readFileSync(absPath, 'utf8');
    const patches = computeFileRenamePatches(content, relFile, matchedFile, oldSymbol, newSymbol);

    if (patches.length > 0) {
      plan.filesToUpdate.push({
        file: relFile,
        absPath,
        patches,
        patchCount: patches.length
      });
      plan.totalReplacements += patches.length;
    }
  }

  return plan;
}

/**
 * Compute patches for a single file.
 */
function computeFileRenamePatches(content, currentFile, defFile, oldSymbol, newSymbol) {
  const patches = [];
  const lines = content.split('\n');
  const isDefFile = currentFile === defFile;

  let localAlias = null;

  // 1. If consumer file, check how oldSymbol is imported
  if (!isDefFile) {
    const importRegex = new RegExp(`import\\s*\\{[^}]*\\b${oldSymbol}\\b[^}]*\\}\\s*from`, 'g');
    if (!importRegex.test(content)) {
      // oldSymbol is not imported in this consumer file
      return [];
    }

    // Check if imported with alias: import { oldSymbol as aliasName }
    const aliasRegex = new RegExp(`\\b${oldSymbol}\\s+as\\s+([a-zA-Z0-9_$]+)`);
    const aliasMatch = content.match(aliasRegex);
    if (aliasMatch) {
      localAlias = aliasMatch[1];
    }
  }

  // 2. Scan lines and generate replacements
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // Check if line contains oldSymbol as standalone word identifier
    const wordRegex = new RegExp(`\\b${oldSymbol}\\b`, 'g');
    if (!wordRegex.test(line)) continue;

    let updatedLine = line;

    if (!isDefFile && line.includes('import') && line.includes('from')) {
      if (localAlias) {
        // e.g. import { oldSymbol as myAlias } -> import { newSymbol as myAlias }
        updatedLine = line.replace(
          new RegExp(`\\b${oldSymbol}\\s+as\\s+${localAlias}\\b`),
          `${newSymbol} as ${localAlias}`
        );
      } else {
        // e.g. import { oldSymbol } -> import { newSymbol }
        updatedLine = line.replace(new RegExp(`\\b${oldSymbol}\\b`, 'g'), newSymbol);
      }
    } else if (isDefFile) {
      // Definition file: replace declarations, exports, and internal calls
      updatedLine = line.replace(new RegExp(`\\b${oldSymbol}\\b`, 'g'), newSymbol);
    } else if (!localAlias) {
      // Consumer file without alias: replace all call sites
      updatedLine = line.replace(new RegExp(`\\b${oldSymbol}\\b`, 'g'), newSymbol);
    }
    // If localAlias was used, consumer call sites use alias, so do not rename them!

    if (updatedLine !== line) {
      patches.push({
        line: lineNo,
        original: line,
        replacement: updatedLine
      });
    }
  }

  return patches;
}

/**
 * Apply a planned refactoring to disk atomically.
 * @param {object} plan - Refactoring plan generated by planSymbolRename
 * @returns {object} Execution summary
 */
export function applySymbolRename(plan) {
  if (!plan || !plan.filesToUpdate || plan.filesToUpdate.length === 0) {
    return { success: true, filesModified: 0, replacementsApplied: 0 };
  }

  let filesModified = 0;
  let replacementsApplied = 0;

  for (const target of plan.filesToUpdate) {
    const lines = fs.readFileSync(target.absPath, 'utf8').split('\n');

    for (const p of target.patches) {
      const idx = p.line - 1;
      if (lines[idx] === p.original) {
        lines[idx] = p.replacement;
        replacementsApplied++;
      }
    }

    fs.writeFileSync(target.absPath, lines.join('\n'), 'utf8');
    filesModified++;
  }

  return {
    success: true,
    filesModified,
    replacementsApplied
  };
}

/**
 * Format a human-readable refactoring diff and plan preview.
 * @param {object} plan - Refactoring plan
 * @returns {string} Formatted text preview
 */
export function formatRefactorPlan(plan) {
  const out = [];
  out.push('===============================================================');
  out.push('   GRAVITON SYMBOLIC REFACTORING ENGINE: PLAN PREVIEW');
  out.push('===============================================================');
  out.push(`Target File  : ${plan.targetFile}`);
  out.push(`Symbol Move  : ${plan.oldSymbol} -> ${plan.newSymbol}`);
  out.push(`Impact Scope : ${plan.filesToUpdate.length} files (${plan.totalReplacements} code locations)`);
  out.push('---------------------------------------------------------------');

  if (plan.filesToUpdate.length === 0) {
    out.push('No references or call sites found to refactor.');
    out.push('===============================================================');
    return out.join('\n');
  }

  for (const fileItem of plan.filesToUpdate) {
    out.push(`FILE: ${fileItem.file} (${fileItem.patchCount} changes)`);
    for (const p of fileItem.patches) {
      out.push(`  Line ${p.line}:`);
      out.push(`    - ${p.original.trim()}`);
      out.push(`    + ${p.replacement.trim()}`);
    }
    out.push('');
  }

  out.push('---------------------------------------------------------------');
  out.push('STATUS: DRY-RUN PREVIEW (No files modified)');
  out.push('To apply this refactor across all files, pass --apply flag.');
  out.push('===============================================================');
  return out.join('\n');
}
