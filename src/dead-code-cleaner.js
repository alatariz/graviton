// src/dead-code-cleaner.js - Graviton V5.0.0 Dead-Code & Unused Symbol Eliminator
// Detects unused imports, orphaned functions, and dead exports using Code Property Graph.

import fs from 'fs';
import path from 'path';
import { buildCodePropertyGraph } from './code-property-graph.js';

/**
 * Scan a workspace for dead code, unused imports, and orphaned functions.
 * @param {string} workspaceDir - Target workspace directory
 * @param {object} [options]
 * @returns {object} Audit report { unusedImports, unusedExports, orphanedFunctions, stats }
 */
export function auditDeadCode(workspaceDir, options = {}) {
  const root = path.resolve(workspaceDir || process.cwd());
  const cpg = buildCodePropertyGraph(root);

  const unusedImports = [];
  const unusedExports = [];
  const orphanedFunctions = [];

  const entrypointNames = new Set([
    'index.js', 'main.js', 'server.js', 'app.js', 'graviton.js', 'run_all.js'
  ]);

  for (const [relPath, fileData] of Object.entries(cpg.files)) {
    const absPath = path.join(root, relPath);
    if (!fs.existsSync(absPath)) continue;

    const content = fs.readFileSync(absPath, 'utf8');
    const baseName = path.basename(relPath).toLowerCase();
    const isEntrypoint = entrypointNames.has(baseName) || relPath.startsWith('bin/') || relPath.startsWith('bin\\') || relPath.startsWith('test/') || relPath.startsWith('test\\');

    // 1. Detect Unused Imports
    for (const imp of fileData.imports) {
      for (const sym of imp.symbols) {
        const localName = sym.local || sym.imported || sym.name;
        if (!localName) continue;

        // Check occurrences of localName in file content outside the import statement itself
        const importIdx = content.indexOf(imp.raw);
        const before = content.slice(0, importIdx);
        const after = content.slice(importIdx + imp.raw.length);
        const restContent = before + after;

        const usageRegex = new RegExp(`\\b${localName}\\b`);
        if (!usageRegex.test(restContent)) {
          unusedImports.push({
            file: relPath,
            symbol: localName,
            importSource: imp.source,
            rawImport: imp.raw
          });
        }
      }
    }

    // 2. Detect Unused Exports (Only for non-entrypoints and non-test files)
    if (!isEntrypoint) {
      for (const exp of fileData.exports) {
        const symKey = `${relPath}#${exp.name}`;
        const meta = cpg.symbolMap[symKey];
        if (meta && meta.consumers.length === 0) {
          // Check if it's called internally within the same file
          const internalUsageRegex = new RegExp(`\\b${exp.name}\\b`, 'g');
          const occurrences = (content.match(internalUsageRegex) || []).length;
          // If only occurs once (the export declaration itself), it's completely dead
          if (occurrences <= 1) {
            unusedExports.push({
              file: relPath,
              symbol: exp.name,
              type: exp.type
            });
          }
        }
      }
    }

    // 3. Detect Orphaned Local Functions (Declared but never called inside or outside)
    for (const fn of fileData.functions) {
      const isExported = fileData.exports.some(e => e.name === fn.name);
      if (!isExported) {
        const nameRegex = new RegExp(`\\b${fn.name}\\b`, 'g');
        const count = (content.match(nameRegex) || []).length;
        // Function declaration itself counts as 1. If count === 1, it is never called.
        if (count === 1) {
          orphanedFunctions.push({
            file: relPath,
            functionName: fn.name,
            params: fn.params
          });
        }
      }
    }
  }

  const totalDeadItems = unusedImports.length + unusedExports.length + orphanedFunctions.length;

  return {
    workspaceDir: root,
    totalDeadItems,
    stats: {
      unusedImportsCount: unusedImports.length,
      unusedExportsCount: unusedExports.length,
      orphanedFunctionsCount: orphanedFunctions.length
    },
    unusedImports,
    unusedExports,
    orphanedFunctions
  };
}

/**
 * Format a human-readable dead code audit report.
 * @param {object} report - Report from auditDeadCode
 * @returns {string} Formatted text report
 */
export function formatDeadCodeReport(report) {
  const out = [];
  out.push('===============================================================');
  out.push('   GRAVITON DEAD-CODE & ENTROPY AUDIT REPORT');
  out.push('===============================================================');
  out.push(`Target Workspace   : ${report.workspaceDir}`);
  out.push(`Dead Code Findings : ${report.totalDeadItems} total items`);
  out.push(`Breakdown          : ${report.stats.unusedImportsCount} unused imports, ${report.stats.unusedExportsCount} unused exports, ${report.stats.orphanedFunctionsCount} orphaned functions`);
  out.push('---------------------------------------------------------------');

  if (report.totalDeadItems === 0) {
    out.push('No dead code, unused imports, or orphaned functions detected.');
    out.push('Workspace entropy is minimal. Maximum codebase hygiene.');
    out.push('===============================================================');
    return out.join('\n');
  }

  if (report.unusedImports.length > 0) {
    out.push('UNUSED IMPORTS (Imports that are never referenced in file body):');
    report.unusedImports.forEach(ui => {
      out.push(`  -> ${ui.file}: '${ui.symbol}' from '${ui.importSource}'`);
    });
    out.push('');
  }

  if (report.unusedExports.length > 0) {
    out.push('UNUSED EXPORTS (Exported symbols with 0 consumers and no internal calls):');
    report.unusedExports.forEach(ue => {
      out.push(`  -> ${ue.file}: [${ue.type}] ${ue.symbol}`);
    });
    out.push('');
  }

  if (report.orphanedFunctions.length > 0) {
    out.push('ORPHANED LOCAL FUNCTIONS (Internal helpers declared but never invoked):');
    report.orphanedFunctions.forEach(of => {
      out.push(`  -> ${of.file}: function ${of.functionName}(${of.params.join(', ')})`);
    });
    out.push('');
  }

  out.push('---------------------------------------------------------------');
  out.push('REMEDIATION:');
  out.push('Prune unused symbols to save context window tokens and reduce entropy.');
  out.push('To automatically prune unused imports, run: grav prune --apply');
  out.push('===============================================================');
  return out.join('\n');
}

/**
 * Prune unused imports from files in a workspace.
 * @param {string} workspaceDir - Workspace root directory
 * @param {object} [options]
 * @returns {object} Summary { filesModified, symbolsPruned }
 */
export function pruneUnusedImports(workspaceDir, options = {}) {
  const root = path.resolve(workspaceDir || process.cwd());
  const audit = auditDeadCode(root, options);

  if (audit.unusedImports.length === 0) {
    return { success: true, filesModified: 0, symbolsPruned: 0 };
  }

  // Group by file
  const byFile = {};
  for (const item of audit.unusedImports) {
    if (!byFile[item.file]) byFile[item.file] = [];
    byFile[item.file].push(item.symbol);
  }

  let filesModified = 0;
  let symbolsPruned = 0;

  for (const [relFile, symbolsToRemove] of Object.entries(byFile)) {
    const absPath = path.join(root, relFile);
    if (!fs.existsSync(absPath)) continue;

    let content = fs.readFileSync(absPath, 'utf8');
    const originalContent = content;

    for (const sym of symbolsToRemove) {
      // 1. Single imported symbol on its own line: import { foo } from '...'
      const singleImportRegex = new RegExp(`^\\s*import\\s*\\{\\s*${sym}\\s*\\}\\s*from\\s*['"][^'"]+['"];?\\r?\\n?`, 'm');
      if (singleImportRegex.test(content)) {
        content = content.replace(singleImportRegex, '');
        symbolsPruned++;
        continue;
      }

      // 2. Part of multi-import: import { foo, bar } from '...'
      // Case A: middle or end -> ', foo'
      const commaFollowRegex = new RegExp(`,\\s*${sym}\\b`, 'g');
      if (commaFollowRegex.test(content)) {
        content = content.replace(commaFollowRegex, '');
        symbolsPruned++;
        continue;
      }

      // Case B: beginning -> 'foo, '
      const commaLeadRegex = new RegExp(`\\b${sym}\\s*,\\s*`, 'g');
      if (commaLeadRegex.test(content)) {
        content = content.replace(commaLeadRegex, '');
        symbolsPruned++;
        continue;
      }
    }

    if (content !== originalContent) {
      fs.writeFileSync(absPath, content, 'utf8');
      filesModified++;
    }
  }

  return {
    success: true,
    filesModified,
    symbolsPruned
  };
}
