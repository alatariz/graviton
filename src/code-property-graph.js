// src/code-property-graph.js - Graviton V5.0.0 Code Property Graph (CPG) & Semantic Relational Memory
// Multi-dimensional AST, Call Graph, and Blast Radius Engine.

import fs from 'fs';
import path from 'path';
import { normalizePath, collectWorkspaceFiles } from './workspace-helper.js';

/**
 * Node in the Code Property Graph representing a file or symbol.
 */
export const CPG_NODE_TYPE = {
  FILE: 'FILE',
  FUNCTION: 'FUNCTION',
  CLASS: 'CLASS',
  VARIABLE: 'VARIABLE'
};

export const CPG_EDGE_TYPE = {
  IMPORTS: 'IMPORTS',
  EXPORTS: 'EXPORTS',
  CALLS: 'CALLS',
  DEFINES: 'DEFINES'
};

export const RISK_LEVEL = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

/**
 * Parse a source file content to extract declarations, imports, exports, and function calls.
 * @param {string} code - Source code string
 * @param {string} relPath - Relative file path
 * @returns {object} Extracted file metadata
 */
export function parseFileSymbols(code, relPath) {
  const exports = [];
  const imports = [];
  const functions = [];
  const calls = [];

  // Strip comments to avoid false matches
  const cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

  // 1. Parse Imports
  // import { a, b as c } from './module.js' or import x from 'y'
  const importRegex = /import\s+(?:(\*\s+as\s+[a-zA-Z0-9_$]+)|([a-zA-Z0-9_$]+)|(?:\{([^}]+)\}))\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(cleanCode)) !== null) {
    const defaultImport = match[2];
    const namedImports = match[3];
    const sourcePath = match[4];

    const symbols = [];
    if (defaultImport) {
      symbols.push({ name: defaultImport.trim(), isDefault: true });
    }
    if (namedImports) {
      namedImports.split(',').forEach(s => {
        const parts = s.trim().split(/\s+as\s+/);
        if (parts[0]) {
          symbols.push({
            imported: parts[0].trim(),
            local: (parts[1] || parts[0]).trim()
          });
        }
      });
    }

    imports.push({
      source: sourcePath,
      symbols,
      raw: match[0]
    });
  }

  // 2. Parse Exports
  // export function foo() / export const bar / export default baz / export { a, b }
  const exportFuncRegex = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g;
  while ((match = exportFuncRegex.exec(cleanCode)) !== null) {
    exports.push({ name: match[1], type: CPG_NODE_TYPE.FUNCTION, isDefault: false });
  }

  const exportConstRegex = /export\s+(?:const|let|var)\s+([a-zA-Z0-9_$]+)/g;
  while ((match = exportConstRegex.exec(cleanCode)) !== null) {
    exports.push({ name: match[1], type: CPG_NODE_TYPE.VARIABLE, isDefault: false });
  }

  const exportClassRegex = /export\s+class\s+([a-zA-Z0-9_$]+)/g;
  while ((match = exportClassRegex.exec(cleanCode)) !== null) {
    exports.push({ name: match[1], type: CPG_NODE_TYPE.CLASS, isDefault: false });
  }

  const exportNamedRegex = /export\s+\{([^}]+)\}/g;
  while ((match = exportNamedRegex.exec(cleanCode)) !== null) {
    match[1].split(',').forEach(s => {
      const parts = s.trim().split(/\s+as\s+/);
      const name = (parts[1] || parts[0]).trim();
      if (name) {
        exports.push({ name, type: CPG_NODE_TYPE.VARIABLE, isDefault: false });
      }
    });
  }

  // 3. Parse Local Functions
  const funcRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\s*\(([^)]*)\)/g;
  while ((match = funcRegex.exec(cleanCode)) !== null) {
    const fnName = match[1];
    const params = match[2].split(',').map(p => p.trim()).filter(Boolean);
    functions.push({ name: fnName, params });
  }

  // 4. Parse Function Invocations / Calls
  const callRegex = /\b([a-zA-Z0-9_$]+)\s*\(/g;
  const reservedKeywords = new Set([
    'if', 'for', 'while', 'switch', 'catch', 'function', 'return',
    'import', 'export', 'typeof', 'instanceof', 'void', 'delete', 'await'
  ]);

  while ((match = callRegex.exec(cleanCode)) !== null) {
    const callee = match[1];
    if (!reservedKeywords.has(callee) && !calls.includes(callee)) {
      calls.push(callee);
    }
  }

  return {
    file: relPath,
    exports,
    imports,
    functions,
    calls
  };
}

/**
 * Build the full Code Property Graph for a workspace.
 * @param {string} workspaceDir - Workspace root directory
 * @param {object} [options]
 * @returns {object} Complete Code Property Graph
 */
export function buildCodePropertyGraph(workspaceDir, options = {}) {
  const root = path.resolve(workspaceDir || process.cwd());
  const maxFiles = options.maxFiles || 150;
  const filePaths = collectWorkspaceFiles(root, {
    maxFiles,
    extensions: ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx']
  });

  const graph = {
    root,
    files: {},          // relPath -> parsed metadata
    symbolMap: {},      // symbolKey -> { definingFile, type, consumers: [] }
    dependencyGraph: {},// relPath -> [ importedRelPaths ]
    reverseDeps: {},    // relPath -> [ dependentRelPaths ] (who imports me)
    totalSymbols: 0,
    totalFiles: 0
  };

  // Step 1: Parse all files
  for (const absPath of filePaths) {
    try {
      const relPath = normalizePath(path.relative(root, absPath));
      const code = fs.readFileSync(absPath, 'utf8');
      const parsed = parseFileSymbols(code, relPath);
      graph.files[relPath] = parsed;
      graph.dependencyGraph[relPath] = [];
      graph.reverseDeps[relPath] = [];
    } catch {}
  }

  // Step 2: Build Symbol Map and resolve cross-file dependencies
  for (const [relPath, fileData] of Object.entries(graph.files)) {
    // Register exports
    for (const exp of fileData.exports) {
      const symKey = `${relPath}#${exp.name}`;
      graph.symbolMap[symKey] = {
        name: exp.name,
        definingFile: relPath,
        type: exp.type,
        consumers: []
      };
      graph.totalSymbols++;
    }

    // Resolve imports to target files
    const fileDir = path.dirname(path.join(root, relPath));
    for (const imp of fileData.imports) {
      let resolvedTarget = resolveImportTarget(root, fileDir, imp.source);
      if (resolvedTarget && graph.files[resolvedTarget]) {
        if (!graph.dependencyGraph[relPath].includes(resolvedTarget)) {
          graph.dependencyGraph[relPath].push(resolvedTarget);
        }
        if (!graph.reverseDeps[resolvedTarget]) {
          graph.reverseDeps[resolvedTarget] = [];
        }
        if (!graph.reverseDeps[resolvedTarget].includes(relPath)) {
          graph.reverseDeps[resolvedTarget].push(relPath);
        }

        // Connect imported symbols to consumer file
        for (const sym of imp.symbols) {
          const symName = sym.imported || sym.name;
          const symKey = `${resolvedTarget}#${symName}`;
          if (graph.symbolMap[symKey]) {
            if (!graph.symbolMap[symKey].consumers.includes(relPath)) {
              graph.symbolMap[symKey].consumers.push(relPath);
            }
          }
        }
      }
    }
  }

  graph.totalFiles = Object.keys(graph.files).length;
  return graph;
}

/**
 * Compute the blast radius of modifying a specific file or symbol.
 * @param {object} cpg - Code Property Graph
 * @param {string} target - Relative file path or symbol name
 * @returns {object} Blast radius analysis
 */
export function calculateBlastRadius(cpg, target) {
  const normTarget = normalizePath(target);
  let targetFile = normTarget;

  // If target looks like 'foo.js#myFunction', split it
  let targetSymbol = null;
  if (normTarget.includes('#')) {
    const parts = normTarget.split('#');
    targetFile = parts[0];
    targetSymbol = parts[1];
  }

  // Find matching file in graph
  const matchedFile = Object.keys(cpg.files).find(f =>
    f === targetFile || f.endsWith('/' + targetFile) || f.endsWith('\\' + targetFile)
  );

  if (!matchedFile) {
    return {
      target,
      found: false,
      riskLevel: RISK_LEVEL.LOW,
      directConsumers: [],
      indirectConsumers: [],
      affectedSymbols: [],
      impactScore: 0,
      recommendedVerification: []
    };
  }

  // 1. Direct consumers (files that directly import targetFile)
  const direct = cpg.reverseDeps[matchedFile] || [];

  // 2. Indirect consumers (transitive importers via BFS)
  const indirect = new Set();
  const queue = [...direct];
  const visited = new Set([matchedFile, ...direct]);

  while (queue.length > 0) {
    const current = queue.shift();
    const upstreams = cpg.reverseDeps[current] || [];
    for (const upstream of upstreams) {
      if (!visited.has(upstream)) {
        visited.add(upstream);
        indirect.add(upstream);
        queue.push(upstream);
      }
    }
  }

  // 3. Impacted symbols defined in targetFile
  const affectedSymbols = Object.entries(cpg.symbolMap)
    .filter(([key, meta]) => meta.definingFile === matchedFile)
    .map(([key, meta]) => ({
      name: meta.name,
      consumers: meta.consumers
    }));

  const totalImpacted = direct.length + indirect.size;
  let riskLevel = RISK_LEVEL.LOW;
  if (totalImpacted >= 10 || direct.length >= 6) {
    riskLevel = RISK_LEVEL.CRITICAL;
  } else if (totalImpacted >= 5 || direct.length >= 3) {
    riskLevel = RISK_LEVEL.HIGH;
  } else if (totalImpacted >= 2) {
    riskLevel = RISK_LEVEL.MEDIUM;
  }

  // Determine recommended verification files (priority: tests first, then direct consumers)
  const verificationSet = new Set();
  const allAffected = [...direct, ...indirect];
  for (const f of allAffected) {
    if (f.includes('test') || f.includes('spec')) {
      verificationSet.add(f);
    }
  }
  for (const f of direct) {
    verificationSet.add(f);
  }

  return {
    target: matchedFile,
    symbol: targetSymbol,
    found: true,
    riskLevel,
    impactScore: totalImpacted,
    directConsumers: direct,
    indirectConsumers: Array.from(indirect),
    affectedSymbols,
    recommendedVerification: Array.from(verificationSet)
  };
}

/**
 * Format a human-readable blast radius impact report.
 * @param {object} blastReport
 * @returns {string} Formatted report
 */
export function formatBlastRadiusReport(blastReport) {
  const out = [];
  out.push('===============================================================');
  out.push('   GRAVITON CODE PROPERTY GRAPH: BLAST RADIUS REPORT');
  out.push('===============================================================');

  if (!blastReport.found) {
    out.push(`Target : ${blastReport.target} [NOT FOUND IN CPG GRAPH]`);
    out.push('No blast radius detected.');
    out.push('===============================================================');
    return out.join('\n');
  }

  out.push(`Target File      : ${blastReport.target}`);
  if (blastReport.symbol) {
    out.push(`Target Symbol    : ${blastReport.symbol}`);
  }
  out.push(`Blast Risk Level : [${blastReport.riskLevel}]`);
  out.push(`Total Impacted   : ${blastReport.impactScore} files (${blastReport.directConsumers.length} direct, ${blastReport.indirectConsumers.length} indirect)`);
  out.push('---------------------------------------------------------------');

  if (blastReport.directConsumers.length > 0) {
    out.push('DIRECT CONSUMERS (Will directly break if exports change):');
    blastReport.directConsumers.forEach(f => out.push(`  -> ${f}`));
  } else {
    out.push('DIRECT CONSUMERS: None (Isolated module or leaf node)');
  }

  if (blastReport.indirectConsumers.length > 0) {
    out.push('\nINDIRECT DOWNSTREAM CONSUMERS (Transitive impact):');
    blastReport.indirectConsumers.forEach(f => out.push(`  ... ${f}`));
  }

  if (blastReport.recommendedVerification.length > 0) {
    out.push('\nRECOMMENDED VERIFICATION SUITES (Verify after modification):');
    blastReport.recommendedVerification.forEach(f => out.push(`  [VERIFY] ${f}`));
  }

  out.push('===============================================================');
  return out.join('\n');
}

/**
 * Generate dialectical blast-radius cognitive constraint for prompt injection.
 * Informs the assistant of downstream consumers so it does not introduce breaking API changes.
 * @param {object} cpg
 * @param {string[]} targetFiles
 * @returns {string} Injected cognitive directive
 */
export function synthesizeBlastRadiusDirective(cpg, targetFiles = []) {
  if (!cpg || !targetFiles || targetFiles.length === 0) return '';

  const highRiskReports = [];
  for (const tf of targetFiles) {
    const report = calculateBlastRadius(cpg, tf);
    if (report.found && (report.riskLevel === RISK_LEVEL.HIGH || report.riskLevel === RISK_LEVEL.CRITICAL || report.directConsumers.length > 0)) {
      highRiskReports.push(report);
    }
  }

  if (highRiskReports.length === 0) return '';

  const lines = [
    '=== [GRAVITON CODE PROPERTY GRAPH: BLAST RADIUS CONSTRAINTS] ===',
    'Modifications to the following target files will impact external consumers:',
  ];

  for (const r of highRiskReports) {
    lines.push(`- TARGET: ${r.target} [Risk: ${r.riskLevel}]`);
    lines.push(`  Direct Dependents (${r.directConsumers.length}): ${r.directConsumers.slice(0, 4).join(', ')}${r.directConsumers.length > 4 ? '...' : ''}`);
    lines.push(`  CRITICAL INVARIANT: You MUST preserve all existing function signatures and export contracts.`);
  }

  lines.push('================================================================');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveImportTarget(root, currentDir, importPath) {
  // Only resolve relative imports (e.g. ./foo.js, ../bar)
  if (!importPath.startsWith('.')) return null;

  const candidateBase = path.resolve(currentDir, importPath);
  const extensions = ['', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '/index.js'];

  for (const ext of extensions) {
    const candidate = candidateBase + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return normalizePath(path.relative(root, candidate));
    }
  }
  return null;
}
