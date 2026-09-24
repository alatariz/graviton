// src/dependency-graph.js - .0.0 Autonomous AST Dependency Graph Engine
import fs from 'fs';
import path from 'path';
import { createGravitonFilter } from './ignore-parser.js';

/**
 * Supported source extensions for dependency parsing.
 */
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.py', '.html', '.css']);

/**
 * Extracts dependencies from source code based on file extension.
 * @param {string} code
 * @param {string} ext
 * @returns {string[]}
 */
export function extractImportSpecifiers(code, ext) {
  if (!code || typeof code !== 'string') return [];
  const specifiers = [];

  if (['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx'].includes(ext)) {
    // ES Modules and CommonJS
    const jsRegex = /(?:import\s+(?:(?:[\w*\s{},]+)\s+from\s+)?['"]|require\(['"]|export\s+(?:(?:[\w*\s{},]+)\s+from\s+)?['"]|import\(['"])((?:\.\/|\.\.\/)[^'"\s]+)/g;
    let match;
    while ((match = jsRegex.exec(code)) !== null) {
      if (match[1]) specifiers.push(match[1]);
    }
  } else if (ext === '.py') {
    // Python local imports
    const pyRegex = /(?:from\s+(\.[a-zA-Z0-9_.]*)\s+import|import\s+(\.[a-zA-Z0-9_.]+))/g;
    let match;
    while ((match = pyRegex.exec(code)) !== null) {
      const spec = match[1] || match[2];
      if (spec) specifiers.push(spec);
    }
  } else if (ext === '.html') {
    // HTML script and link tags
    const htmlRegex = /(?:<script[^>]+src=['"]([^'"]+)['"]|<link[^>]+href=['"]([^'"]+)['"])/gi;
    let match;
    while ((match = htmlRegex.exec(code)) !== null) {
      const spec = match[1] || match[2];
      if (spec && !spec.startsWith('http://') && !spec.startsWith('https://')) {
        specifiers.push(spec);
      }
    }
  } else if (ext === '.css') {
    // CSS @import
    const cssRegex = /@import\s+(?:url\(['"]?|['"])([^'")]+)['"]?\)?/gi;
    let match;
    while ((match = cssRegex.exec(code)) !== null) {
      if (match[1] && !match[1].startsWith('http://') && !match[1].startsWith('https://')) {
        specifiers.push(match[1]);
      }
    }
  }

  return Array.from(new Set(specifiers));
}

/**
 * Resolves an imported specifier to a concrete workspace-relative file path.
 * @param {string} fromRelPath
 * @param {string} specifier
 * @param {string} cwd
 * @returns {string|null}
 */
export function resolveDependencyPath(fromRelPath, specifier, cwd) {
  const fromAbsDir = path.dirname(path.resolve(cwd, fromRelPath));
  let candidateAbs = path.resolve(fromAbsDir, specifier);

  // 1. Exact match
  if (fs.existsSync(candidateAbs) && fs.statSync(candidateAbs).isFile()) {
    return path.relative(cwd, candidateAbs).replace(/\\/g, '/');
  }

  // 2. Extension fallbacks
  for (const ext of ['.js', '.mjs', '.ts', '.jsx', '.tsx', '.json', '.css']) {
    const testFile = candidateAbs + ext;
    if (fs.existsSync(testFile) && fs.statSync(testFile).isFile()) {
      return path.relative(cwd, testFile).replace(/\\/g, '/');
    }
  }

  // 3. Index file in folder
  for (const ext of ['.js', '.mjs', '.ts', '.jsx', '.tsx']) {
    const testIndex = path.join(candidateAbs, 'index' + ext);
    if (fs.existsSync(testIndex) && fs.statSync(testIndex).isFile()) {
      return path.relative(cwd, testIndex).replace(/\\/g, '/');
    }
  }

  return null;
}

/**
 * Builds the complete Directed Acyclic Graph (DAG) for a workspace.
 * @param {string} [cwd=process.cwd()]
 * @param {object} [options={}]
 * @returns {{
 *   nodes: Record<string, { path: string, sizeBytes: number, lineCount: number, dependencies: string[], dependents: string[] }>,
 *   fileCount: number,
 *   edgeCount: number,
 *   entryPoints: string[],
 *   isolatedFiles: string[],
 *   circular: Array<[string, string]>
 * }}
 */
export function buildDependencyGraph(cwd = process.cwd(), options = {}) {
  const filter = createGravitonFilter(cwd);
  const nodes = {};
  const queue = [cwd];
  const allFiles = [];

  // 1. Recursive workspace scan
  while (queue.length > 0) {
    const currentDir = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');

      if (filter.isIgnored(fullPath) || entry.name.startsWith('.')) {
        continue;
      }
      if (['node_modules', 'dist', 'build', 'coverage', '.git', '.gemini'].includes(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SOURCE_EXTENSIONS.has(ext)) {
          allFiles.push({ fullPath, relPath, ext });
        }
      }
    }
  }

  // 2. Initialize nodes
  for (const file of allFiles) {
    let sizeBytes = 0;
    let lineCount = 0;
    try {
      const stat = fs.statSync(file.fullPath);
      sizeBytes = stat.size;
      const content = fs.readFileSync(file.fullPath, 'utf8');
      lineCount = content.split('\n').length;
    } catch {}

    nodes[file.relPath] = {
      path: file.relPath,
      ext: file.ext,
      sizeBytes,
      lineCount,
      dependencies: [],
      dependents: []
    };
  }

  // 3. Resolve edges
  let edgeCount = 0;
  for (const file of allFiles) {
    let content = '';
    try {
      content = fs.readFileSync(file.fullPath, 'utf8');
    } catch {
      continue;
    }

    const rawSpecifiers = extractImportSpecifiers(content, file.ext);
    for (const spec of rawSpecifiers) {
      const resolvedRel = resolveDependencyPath(file.relPath, spec, cwd);
      if (resolvedRel && nodes[resolvedRel] && resolvedRel !== file.relPath) {
        if (!nodes[file.relPath].dependencies.includes(resolvedRel)) {
          nodes[file.relPath].dependencies.push(resolvedRel);
          edgeCount++;
        }
        if (!nodes[resolvedRel].dependents.includes(file.relPath)) {
          nodes[resolvedRel].dependents.push(file.relPath);
        }
      }
    }
  }

  // 4. Identify entry points, isolated files, circular pairs
  const entryPoints = [];
  const isolatedFiles = [];
  const circular = [];

  for (const [relPath, node] of Object.entries(nodes)) {
    if (node.dependents.length === 0 && node.dependencies.length > 0) {
      entryPoints.push(relPath);
    } else if (node.dependents.length === 0 && node.dependencies.length === 0) {
      isolatedFiles.push(relPath);
    }

    for (const dep of node.dependencies) {
      if (nodes[dep] && nodes[dep].dependencies.includes(relPath)) {
        const pair = [relPath, dep].sort();
        if (!circular.some(c => c[0] === pair[0] && c[1] === pair[1])) {
          circular.push(pair);
        }
      }
    }
  }

  return {
    nodes,
    fileCount: allFiles.length,
    edgeCount,
    entryPoints,
    isolatedFiles,
    circular
  };
}

/**
 * Formats the dependency graph into a hierarchical Unicode tree for terminal output.
 * @param {object} graph
 * @returns {string}
 */
export function formatAsciiGraph(graph) {
  const { nodes, fileCount, edgeCount, entryPoints, isolatedFiles, circular } = graph;
  const lines = [
    '===============================================================',
    '   GRAVITON AUTONOMOUS DEPENDENCY GRAPH',
    '==============================================================='
  ];

  const roots = entryPoints.length > 0 ? entryPoints : Object.keys(nodes).slice(0, 5);

  const visited = new Set();

  function printBranch(nodePath, prefix = '', isLast = true) {
    const node = nodes[nodePath];
    if (!node) return;

    const marker = isLast ? '└── ' : '├── ';
    lines.push(`${prefix}${marker}\x1b[1m${nodePath}\x1b[0m \x1b[90m(${node.lineCount} lines)\x1b[0m`);

    if (visited.has(nodePath)) {
      return;
    }
    visited.add(nodePath);

    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const deps = node.dependencies;

    for (let i = 0; i < deps.length; i++) {
      printBranch(deps[i], childPrefix, i === deps.length - 1);
    }
  }

  for (let i = 0; i < roots.length; i++) {
    const rootPath = roots[i];
    const isLast = i === roots.length - 1;
    lines.push(`\n\x1b[36m[ENTRY POINT]:\x1b[0m \x1b[1m${rootPath}\x1b[0m`);
    const node = nodes[rootPath];
    if (node) {
      for (let j = 0; j < node.dependencies.length; j++) {
        printBranch(node.dependencies[j], '  ', j === node.dependencies.length - 1);
      }
    }
  }

  lines.push('\n---------------------------------------------------------------');
  lines.push(`Total Files: \x1b[32m${fileCount}\x1b[0m | Dependency Links: \x1b[36m${edgeCount}\x1b[0m | Isolated: \x1b[33m${isolatedFiles.length}\x1b[0m`);
  if (circular.length > 0) {
    lines.push(`Circular Dependency Warnings (${circular.length}):`);
    circular.forEach(c => lines.push(`  \x1b[33m●\x1b[0m  ${c[0]} <---> ${c[1]}`));
  }
  lines.push('---------------------------------------------------------------');

  return lines.join('\n');
}

/**
 * Returns surgically pruned context files for a target file (direct dependencies + direct callers).
 * @param {string} targetFile
 * @param {object} graph
 * @returns {string[]}
 */
export function getSurgicalContextFiles(targetFile, graph) {
  if (!graph || !graph.nodes) return [];
  const normalized = targetFile.replace(/\\/g, '/');
  const node = graph.nodes[normalized];
  if (!node) return [];

  const contextSet = new Set([normalized]);
  node.dependencies.forEach(d => contextSet.add(d));
  node.dependents.forEach(d => contextSet.add(d));

  return Array.from(contextSet);
}
