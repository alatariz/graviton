#!/usr/bin/env node
import { loadGravIgnore, isGravIgnored, createGravFilter, loadGravitonIgnore, isGravitonIgnored, createGravitonFilter } from './ignore-parser.js';
import { getTelemetry, recordTelemetry, formatTelemetryDashboard } from './telemetry.js';
import { resolveTargetScope } from './context-scoper.js';
import { getCompactMemoryDirective } from './session-compactor.js';
import { isProtectedFile, generateDependencySummary } from './shield.js';
import { isTranspilableDocument, transpileFileToMarkdown } from './markitdown.js';
import { isSkeletonCandidate, isAstCandidate, generateAstFunctionIndex, skeletonizeCode, shrinkSvg } from './code-outliner.js';
import { resolveDeltaHydration } from './delta-compressor.js';
import { squeezeMixedContent } from './stack-squeezer.js';
import { architectPrompt } from './prompt-architect.js';
import { buildCognitiveContract, synthesizeDomainEdgeCases, formatDeterministicCachePrompt } from './cognitive-contract.js';
import { buildDependencyGraph, formatAsciiGraph, getSurgicalContextFiles } from './dependency-graph.js';
import { bundleWebApplication } from './bundler.js';
import { healCodeSyntax, healRelativeImports, selfHealFile } from './self-healer.js';
import { calculateEconomyMetrics, renderAsciiHud } from './hud.js';
import { synthesizeAgiCognitiveHarness, executeSocraticDialectic, generateTeleologicalContract, compressToNeuroSymbolic } from './synthetic-agi.js';
import { formatSkillDirectivesBlock, resolveSkillDirectives } from './skill-matrix.js';
import { resolveDesignSystem, formatDesignSystemSpecification } from './design-intelligence.js';
import { verifyProjectRuntime, verifyJavaScriptSyntax, verifyDomBindings, verifyLocalImports, generateSelfCorrectionDirective, autoHealMissingDomElement } from './runtime-sentinel.js';
import { detectGroundedLibraries, synthesizeGroundedResearchBlock, GROUNDED_LIBRARY_REGISTRY } from './live-researcher.js';
import { analyzePromptAmbiguity, synthesizeClarifiedSpecificationBlock, DOMAIN_PATTERNS } from './ambiguity-clarifier.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { redactSecrets } from './workspace-helper.js';

export { architectPrompt } from './prompt-architect.js';
export { buildCognitiveContract, synthesizeDomainEdgeCases, formatDeterministicCachePrompt } from './cognitive-contract.js';
export { buildDependencyGraph, formatAsciiGraph, getSurgicalContextFiles } from './dependency-graph.js';
export { bundleWebApplication } from './bundler.js';
export { healCodeSyntax, healRelativeImports, selfHealFile } from './self-healer.js';
export { calculateEconomyMetrics, renderAsciiHud } from './hud.js';
export { detectScaffoldIntent, detectBundleIntent, detectPlayIntent, autoHealWorkspaceFiles } from './autonomous-router.js';
export { synthesizeAgiCognitiveHarness, executeSocraticDialectic, generateTeleologicalContract, compressToNeuroSymbolic } from './synthetic-agi.js';
export { resolveSkillDirectives, formatSkillDirectivesBlock } from './skill-matrix.js';
export { resolveDesignSystem, formatDesignSystemSpecification } from './design-intelligence.js';
export { verifyProjectRuntime, verifyJavaScriptSyntax, verifyDomBindings, verifyLocalImports, generateSelfCorrectionDirective, autoHealMissingDomElement } from './runtime-sentinel.js';
export { detectGroundedLibraries, synthesizeGroundedResearchBlock, GROUNDED_LIBRARY_REGISTRY } from './live-researcher.js';
export { analyzePromptAmbiguity, synthesizeClarifiedSpecificationBlock, DOMAIN_PATTERNS } from './ambiguity-clarifier.js';

export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Graviton Core JSON Compressor: Compresses oversized JSON arrays (> 3 elements)
 * Replaces middle section with string `[... GRAVITON CORE: X items truncated ...]`,
 * preserving only the first and last elements.
 */
export function compressJsonArray(text) {
  if (!text || typeof text !== 'string') return text;

  function compressArray(arr, depth = 0) {
    if (!Array.isArray(arr)) return arr;
    if (arr.length > 3) {
      const truncatedCount = arr.length - 2;
      const first = compressValue(arr[0], depth + 1);
      const last = compressValue(arr[arr.length - 1], depth + 1);
      return [
        first,
        `[... GRAVITON CORE: ${truncatedCount} items truncated ...]`,
        last
      ];
    }
    return arr.map(item => compressValue(item, depth + 1));
  }

  function compressValue(val, depth = 0) {
    if (depth > 6) return val;
    if (Array.isArray(val)) {
      return compressArray(val, depth);
    }
    if (val && typeof val === 'object' && val !== null) {
      const res = {};
      for (const [k, v] of Object.entries(val)) {
        res[k] = compressValue(v, depth + 1);
      }
      return res;
    }
    return val;
  }

  // 1. Check if text is a single JSON payload (array or object)
  const trimmed = text.trim();
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(compressValue(parsed), null, 2);
    } catch {}
  }

  // 2. Balanced bracket scanner for embedded JSON arrays within freeform text
  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '[') {
      let depth = 0;
      let inString = false;
      let escape = false;
      let j = i;
      let found = false;

      for (; j < text.length; j++) {
        const char = text[j];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '[') depth++;
          else if (char === ']') {
            depth--;
            if (depth === 0) {
              found = true;
              break;
            }
          }
        }
      }

      if (found) {
        const candidate = text.slice(i, j + 1);
        try {
          const parsed = JSON.parse(candidate);
          if (Array.isArray(parsed) && parsed.length > 3) {
            const compressed = compressArray(parsed);
            result += JSON.stringify(compressed, null, 2);
            i = j + 1;
            continue;
          }
        } catch {}
      }
    }
    result += text[i];
    i++;
  }

  return result;
}


/**
 * Graviton Core Safe Noise Filter
 * Splits input into lines and applies strict Whitelist vs Blacklist rules:
 * - [WHITELIST]: Preserves lines containing: TypeError, Exception, Error:, at , ReferenceError
 * - [BLACKLIST]: Drops lines ONLY IF starting with: npm WARN, info , warning:, npm notice
 * - [FAILSAFE]: If pruned result is empty, returns original rawText intact!
 */
export function pruneNoise(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string') return '';

  // 0. Rate Limit Interceptor (Fatal Alarm)
  const RATE_LIMIT_REGEX = /429|Too Many Requests|Quota Exceeded|exhausted/i;
  if (RATE_LIMIT_REGEX.test(rawText)) {
    console.error('\x1b[1m\x1b[31m[FATAL: ANTIGRAVITY API RATE LIMIT EXCEEDED. TAKE A BREAK.]\x1b[0m');
    process.exit(1);
  }

  // 0b. Unauthenticated Interceptor (Fatal Alarm)
  const UNAUTH_REGEX = /not recognized|not found|unauthorized|login/i;
  if (!options.isPrompt && UNAUTH_REGEX.test(rawText)) {
    console.error('\x1b[1m\x1b[31m[FATAL: Antigravity CLI is missing or not authenticated. Please install and login to Antigravity first.]\x1b[0m');
    process.exit(1);
  }

  let out = redactSecrets(rawText);

  // 1. Remove ANSI escape sequences
  out = out.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  out = out.replace(/\[[0-9;]+m/g, '');

  // 2. Compress huge base64 strings
  out = out.replace(/data:(image|audio|video|application)\/[a-zA-Z0-9.-]+;base64,[A-Za-z0-9+/=]{60,}/g, (match, mime) => {
    const sizeKb = Math.round((match.length * 0.75) / 1024);
    return `[data:${mime};base64 ~${sizeKb}KB omitted]`;
  });

  // 3. Compress oversized JSON arrays (> 3 elements)
  out = compressJsonArray(out);

  // 4. Split input into lines
  const rawLines = out.replace(/\r\n/g, '\n').split('\n');

  // [WHITELIST]: Universal Error Matcher across JS/TS, Python, Go, Rust, etc.
  const WHITELIST_REGEX = /TypeError|Exception|Error:|at\s+|ReferenceError|Traceback|panic:|fatal error:/i;

  // [BLACKLIST]: Surgical terminal noise (npm, pip, cargo, go, yarn, pnpm at start of line, or bracketed info/debug, > prompt)
  const BLACKLIST_REGEX = /^(?:npm|pip|cargo|go|yarn|pnpm)\s+(?:WARN|notice|info|ERR! code)|^(?:\[INFO\]|\[DEBUG\]|>)/i;

  const filteredLines = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. [WHITELIST RULE 1]: Bounded User JSON / Object log protection ({ or } AND length < 200)
    if ((line.includes('{') || line.includes('}')) && line.length < 200) {
      filteredLines.push(line);
      continue;
    }

    // 2. [WHITELIST RULE 2]: Universal Error & Traceback Matcher
    if (WHITELIST_REGEX.test(line)) {
      filteredLines.push(line);
      continue;
    }

    // 3. [BLACKLIST]: Surgical terminal noise at start of line
    if (BLACKLIST_REGEX.test(trimmed)) {
      continue;
    }

    filteredLines.push(line);
  }

  // 5. Rejoin array into string
  let result = filteredLines.join('\n');

  // 6. Clean excessive blank lines
  result = result.replace(/^\s*[\r\n]/gm, '').trim();

  // 7. [FAILSAFE KRUSIAL]: Jika hasil akhir pemotongan ternyata kosong (result.trim() === ''),
  // maka kembalikan input aslinya secara utuh! Jangan pernah mengembalikan string kosong ke AI.
  if (!result || result.trim() === '') {
    return rawText.trim();
  }

  return result.trim();
}


// Recognized code extensions (language-agnostic: JS/TS, Python, Go, Rust, Java, C/C++, etc.)
export const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.hpp'
]);

// Static extensions (score 0)
export const STATIC_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.pdf', '.lock',
  '.webp', '.woff', '.woff2', '.ttf', '.eot'
]);

/**
 * Calculates code density ratio for a directory (language-agnostic)
 */
export function calculateDirCodeDensity(dirPath) {
  try {
    let codeCount = 0;
    let totalCount = 0;

    function countFiles(targetDir, depth = 0) {
      try {
        const subEntries = fs.readdirSync(targetDir, { withFileTypes: true });
        for (const sub of subEntries) {
          if (sub.name.startsWith('.') && sub.name !== '.env.example') continue;
          if (/^(node_modules|\.git|dist|build|__pycache__|\.next|\.turbo|\.cache)$/i.test(sub.name)) continue;

          if (sub.isDirectory()) {
            if (depth < 1) {
              countFiles(path.join(targetDir, sub.name), depth + 1);
            }
          } else {
            totalCount++;
            const ext = path.extname(sub.name).toLowerCase();
            if (CODE_EXTENSIONS.has(ext)) {
              codeCount++;
            }
          }
        }
      } catch {}
    }

    countFiles(dirPath, 0);

    const ratio = totalCount > 0 ? (codeCount / totalCount) : 0;
    return { ratio, codeCount, totalCount };
  } catch {
    return { ratio: 0, codeCount: 0, totalCount: 0 };
  }
}

/**
 * Graviton Core Workspace Hydration: Builds a high-speed, context-aware directory tree
 * and extracts installed dependencies from package.json, requirements.txt, etc.
 * Ignores heavy noise directories (node_modules, .git, dist, build, etc.) and caps depth at 2 levels.
 */
export function buildWorkspaceMap(cwd = process.cwd(), options = {}) {
  const maxDepth = options.maxDepth || 2;
  const ignoreDirs = new Set([
    'node_modules', '.git', 'dist', 'build', '__pycache__',
    '.gemini', 'coverage', '.next', 'target', '.turbo',
    '.cache', 'venv', '.venv', '.idea', '.vscode',
    '.graviton', '.graviton-session'
  ]);
  const gitignorePatterns = [];
  const gravitonFilter = createGravitonFilter(cwd);

  // Gitignore Respecter: Check and parse .gitignore from cwd
  try {
    const gitignorePath = path.join(cwd, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      for (let line of gitignoreContent.split('\n')) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const normalized = line.replace(/^\/+|\/+$/g, '');
        if (normalized) {
          ignoreDirs.add(normalized);
          gitignorePatterns.push(normalized);
        }
      }
    }
  } catch {}

  const treeLines = [];
  const dependencies = [];

  // 1. Extract installed dependencies
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = Object.keys(pkg.dependencies || {});
      const devDeps = Object.keys(pkg.devDependencies || {});
      for (const d of [...deps, ...devDeps]) {
        if (!dependencies.includes(d)) dependencies.push(d);
      }
    }
  } catch {}

  try {
    const reqPath = path.join(cwd, 'requirements.txt');
    if (fs.existsSync(reqPath)) {
      const lines = fs.readFileSync(reqPath, 'utf8').split('\n');
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        const name = line.split(/[=<>~!@\s]/)[0].trim();
        if (name && !dependencies.includes(name)) dependencies.push(name);
      }
    }
  } catch {}

  // Helper to test if name or relative path matches gitignore pattern
  function isIgnored(name, relPath) {
    if (name.startsWith('.graviton') || relPath.startsWith('.graviton')) return true;
    if (ignoreDirs.has(name) || ignoreDirs.has(relPath)) return true;
    for (const pattern of gitignorePatterns) {
      if (name === pattern || relPath === pattern) return true;
      if (pattern.includes('*') || pattern.includes('?')) {
        const regexStr = '^' + pattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.') + '$';
        try {
          const re = new RegExp(regexStr, 'i');
          if (re.test(name) || re.test(relPath)) return true;
        } catch {}
      }
    }
    return false;
  }

  let fileCount = 0;
  const MAX_FILES = 50;
  let isTruncated = false;

  // 2. Traverse directory tree
  function scan(dir, depth, prefix = '') {
    if (depth > maxDepth || isTruncated) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const filtered = entries.filter(e => {
      if (e.name.startsWith('.') && e.name !== '.env.example') return false;
      const fullItemPath = path.join(dir, e.name);
      if (gravitonFilter.isIgnored(fullItemPath)) return false;
      const relItemPath = path.relative(cwd, fullItemPath).replace(/\\/g, '/');
      if (isIgnored(e.name, relItemPath)) return false;
      return true;
    });

    // Extension-Based Code-Density Sorting (Language-Agnostic):
    // Calculate code density for each item in filtered
    const itemScores = new Map();
    for (const item of filtered) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        const density = calculateDirCodeDensity(fullPath);
        itemScores.set(item, {
          isDir: true,
          ratio: density.ratio,
          codeCount: density.codeCount,
          totalCount: density.totalCount,
          isStatic: density.totalCount > 0 && density.codeCount === 0
        });
      } else {
        const ext = path.extname(item.name).toLowerCase();
        const isCode = CODE_EXTENSIONS.has(ext);
        const isStatic = STATIC_EXTENSIONS.has(ext);
        itemScores.set(item, {
          isDir: false,
          ratio: isCode ? 1.0 : (isStatic ? 0 : 0.5),
          codeCount: isCode ? 1 : 0,
          totalCount: 1,
          isStatic
        });
      }
    }

    function getBucket(score) {
      if (score.isDir) {
        if (score.ratio > 0) return 0; // High code-density directories at the top
        return 3; // Zero code / static directories at the bottom
      } else {
        if (score.isStatic) return 3; // Static files at the bottom (score 0)
        if (score.ratio === 1.0) return 1; // Direct code files
        return 2; // Config files, docs, markdown, etc.
      }
    }

    filtered.sort((a, b) => {
      const sA = itemScores.get(a);
      const sB = itemScores.get(b);
      const bA = getBucket(sA);
      const bB = getBucket(sB);

      if (bA !== bB) return bA - bB;

      // Within the same bucket:
      if (sA.isDir && sB.isDir) {
        if (sB.ratio !== sA.ratio) return sB.ratio - sA.ratio;
        if (sB.codeCount !== sA.codeCount) return sB.codeCount - sA.codeCount;
      } else if (!sA.isDir && !sB.isDir) {
        if (sB.ratio !== sA.ratio) return sB.ratio - sA.ratio;
      }
      return a.name.localeCompare(b.name);
    });

    for (let index = 0; index < filtered.length; index++) {
      if (fileCount >= MAX_FILES) {
        isTruncated = true;
        break;
      }
      const item = filtered[index];
      const isLast = index === filtered.length - 1;
      const pointer = isLast ? '└── ' : '├── ';

      if (item.isDirectory()) {
        treeLines.push(`${prefix}${pointer}${item.name}/`);
        scan(path.join(dir, item.name), depth + 1, prefix + (isLast ? '    ' : '│   '));
        if (isTruncated) break;
      } else {
        fileCount++;
        treeLines.push(`${prefix}${pointer}${item.name}`);
        if (fileCount >= MAX_FILES) {
          isTruncated = true;
          break;
        }
      }
    }
  }

  scan(cwd, 1, '');

  if (isTruncated) {
    treeLines.push('... [WORKSPACE MAP TRUNCATED: MAX 50 FILES REACHED]');
  }

  const treeStructure = treeLines.length > 0 ? treeLines.join('\n') : '(empty)';
  const depListStr = dependencies.length > 0 ? dependencies.join(', ') : 'none';

  const formatted = `[WORKSPACE MAP]:\n${treeStructure}\n\n[DEPENDENCIES]: ${depListStr}`;

  if (options.asObject) {
    return {
      tree: treeStructure,
      map: treeStructure,
      dependencies,
      dependenciesStr: depListStr,
      formatted
    };
  }

  return formatted;
}

/**
 * File Truncation & Minified Protection (Anti-Bom File)
 * Checks if the file extension is .min.js, .min.css, or if the first line exceeds 1000 characters.
 * If minified, returns a token-safe placeholder.
 * Otherwise, splits by lines (\n) and caps at maxLines (500).
 */
export function readAndTruncateFile(filePath, maxLines = 500) {
  try {
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName.endsWith('.min.js') || fileName.endsWith('.min.css')) {
      return '// [MINIFIED FILE DETECTED: CONTENT OMITTED FOR TOKEN SAFETY]';
    }
    const stat = fs.statSync(filePath);
    if (stat.size > 10 * 1024 * 1024) {
      return '// [GRAVITON DEFENSIVE GUARD: File exceeds 10MB safety limit. Content omitted for stability.]';
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    const firstLineEnd = raw.indexOf('\n');
    const firstLine = firstLineEnd === -1 ? raw : raw.slice(0, firstLineEnd);
    if (firstLine.length > 1000) {
      return '// [MINIFIED FILE DETECTED: CONTENT OMITTED FOR TOKEN SAFETY]';
    }
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n') + '\n// [...FILE TRUNCATED: MAX 500 LINES EXCEEDED...]';
    }
    return lines.join('\n');
  } catch {
    return null;
  }
}

let _latestShadowBackups = [];

export function getLatestShadowBackups() {
  return _latestShadowBackups;
}

/**
 * Shadow Backup (Pengganti Git Savepoint)
 * Copies detected hydrated files to ~/.graviton/backups/
 * Formatted as [nama_file]_[timestamp].bak
 * Prevents collateral staging on sensitive files like .env.
 */
export function createShadowBackup(filePaths, cwd = process.cwd()) {
  if (!filePaths) return [];
  const files = Array.isArray(filePaths) ? filePaths : [filePaths];
  const backupDir = path.join(os.homedir(), '.graviton', 'backups');

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  } catch {
    return [];
  }

  const backedUp = [];
  const timestamp = Date.now();

  for (const f of files) {
    try {
      const absPath = path.isAbsolute(f) ? f : path.resolve(cwd, f);
      if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
        const baseName = path.basename(absPath);
        const backupFileName = `${baseName}_${timestamp}.bak`;
        const backupPath = path.join(backupDir, backupFileName);
        fs.copyFileSync(absPath, backupPath);
        backedUp.push({ original: absPath, backup: backupPath });
      }
    } catch {}
  }

  _latestShadowBackups = backedUp;
  return backedUp;
}

/**
 * Synchronous-Detached Garbage Collection (Self-Cleaning Shadow Backup)
 * Spawns a completely detached background node process using child_process.spawn
 * with detached: true and stdio: 'ignore'. Calls unref() on the child.
 * Ensures the OS finishes purging expired backups (> 7 days) even if Graviton instantly exits.
 */
export function purgeOldBackups(backupDir = path.join(os.homedir(), '.graviton', 'backups'), maxAgeDays = 7) {
  try {
    if (!fs.existsSync(backupDir)) return null;

    const cleanScript = `
      const fs = require('fs');
      const path = require('path');
      const dir = ${JSON.stringify(backupDir)};
      const maxAgeMs = ${maxAgeDays} * 24 * 60 * 60 * 1000;
      const now = Date.now();
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isFile() && e.name.endsWith('.bak')) {
            const p = path.join(dir, e.name);
            try {
              const s = fs.statSync(p);
              if (s.mtime && (now - s.mtime.getTime()) > maxAgeMs) {
                fs.unlinkSync(p);
              }
            } catch {}
          }
        }
      } catch {}
    `.replace(/\s+/g, ' ').trim();

    const child = spawn(process.execPath, ['-e', cleanScript], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
    return child;
  } catch {
    return null;
  }
}

/**
 * Dynamic TSConfig / JSConfig Paths Loader
 * Simple parser for compilerOptions.paths from tsconfig.json or jsconfig.json
 * Strips comments safely and returns { paths, baseUrl }
 */
export function loadConfigAliasMap(cwd = process.cwd()) {
  const rootDir = cwd || process.cwd();
  const configFiles = ['tsconfig.json', 'jsconfig.json'];

  for (const cf of configFiles) {
    const configPath = path.join(rootDir, cf);
    if (fs.existsSync(configPath)) {
      try {
        let content = fs.readFileSync(configPath, 'utf8');
        // Strip single-line comments (//...) and multi-line comments (/* ... */)
        content = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        const parsed = JSON.parse(content);
        const pathsObj = parsed?.compilerOptions?.paths;
        const rawBaseUrl = parsed?.compilerOptions?.baseUrl || '.';
        const baseUrl = path.resolve(rootDir, rawBaseUrl);
        if (pathsObj && typeof pathsObj === 'object') {
          return { paths: pathsObj, baseUrl };
        }
      } catch {}
    }
  }
  return null;
}

/**
 * Shallow Dependency Resolver
 * Resolves relative local dependency paths (depth = 1) across JS/TS, Python, Go, Rust
 * Supports Path Aliases (@/ and ~/) via dynamic tsconfig/jsconfig paths with fallback to ./src/
 */
export function resolveLocalDependency(baseDir, relativeImport, cwd = process.cwd()) {
  try {
    const candidatePaths = [];
    const rootDir = cwd || process.cwd();

    // 1. Path Alias Resolver (@/ and ~/)
    if (relativeImport.startsWith('@/') || relativeImport.startsWith('~/')) {
      const config = loadConfigAliasMap(rootDir);
      let matchedConfigPath = false;

      if (config && config.paths) {
        for (const [aliasPattern, targetList] of Object.entries(config.paths)) {
          const targets = Array.isArray(targetList) ? targetList : [targetList];
          if (aliasPattern.endsWith('/*')) {
            const prefix = aliasPattern.slice(0, -2) + '/';
            if (relativeImport.startsWith(prefix)) {
              const suffix = relativeImport.slice(prefix.length);
              for (const target of targets) {
                const targetBase = target.endsWith('/*') ? target.slice(0, -2) : target;
                candidatePaths.push(path.resolve(config.baseUrl, targetBase, suffix));
                matchedConfigPath = true;
              }
            }
          } else if (relativeImport === aliasPattern) {
            for (const target of targets) {
              candidatePaths.push(path.resolve(config.baseUrl, target));
              matchedConfigPath = true;
            }
          }
        }
      }

      // Fallback to ./src/ if no config exists or alias not defined in paths
      if (!matchedConfigPath) {
        const unaliased = relativeImport.replace(/^[@~]\//, '');
        candidatePaths.push(path.resolve(rootDir, 'src', unaliased));
        candidatePaths.push(path.resolve(rootDir, unaliased));
        if (baseDir) {
          candidatePaths.push(path.resolve(baseDir, 'src', unaliased));
          candidatePaths.push(path.resolve(baseDir, unaliased));
        }
      }
    } else {
      candidatePaths.push(path.resolve(baseDir, relativeImport));
    }

    const exts = ['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.json', '.py', '.go', '.rs'];
    const activeCwd = path.resolve(cwd || process.cwd());
    const defaultCwd = path.resolve(process.cwd());

    for (const candidate of candidatePaths) {
      // Path Traversal Jail: Enforce boundary using path.resolve()
      // If the resolved path does not start with process.cwd(), ignore it entirely.
      const resolvedCandidate = path.resolve(candidate);
      const activePrefix = activeCwd.endsWith(path.sep) ? activeCwd : activeCwd + path.sep;
      const defaultPrefix = defaultCwd.endsWith(path.sep) ? defaultCwd : defaultCwd + path.sep;
      const isInside = (resolvedCandidate === activeCwd || resolvedCandidate.startsWith(activePrefix)) ||
                       (resolvedCandidate === defaultCwd || resolvedCandidate.startsWith(defaultPrefix));
      if (!isInside) {
        continue;
      }

      // Direct file match
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
      // Common extensions (JS/TS, Python, Go, Rust, etc.)
      for (const ext of exts) {
        const withExt = candidate + ext;
        if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
          return withExt;
        }
      }
      // Directory index or Python package
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        for (const ext of exts) {
          const indexFile = path.join(candidate, 'index' + ext);
          if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
            return indexFile;
          }
        }
        const pyInit = path.join(candidate, '__init__.py');
        if (fs.existsSync(pyInit) && fs.statSync(pyInit).isFile()) {
          return pyInit;
        }
      }
    }
  } catch {}
  return null;
}

/**
 * Local Trip Odometer (Pelacak Token Offline)
 * Tracks session tokens and cumulative total in ~/.graviton/odometer.json
 */
export function getOdometerPath() {
  return path.join(os.homedir(), '.graviton', 'odometer.json');
}

export function readOdometer() {
  try {
    const odoPath = getOdometerPath();
    if (fs.existsSync(odoPath)) {
      const data = JSON.parse(fs.readFileSync(odoPath, 'utf8'));
      return {
        totalTokens: Number(data.totalTokens) || 0,
        lastSessionTokens: Number(data.lastSessionTokens) || 0,
        sessionsCount: Number(data.sessionsCount) || 0,
        updatedAt: data.updatedAt || null
      };
    }
  } catch {}
  return { totalTokens: 0, lastSessionTokens: 0, sessionsCount: 0, updatedAt: null };
}

export function recordOdometer(sessionTokens) {
  try {
    const gravitonDir = path.join(os.homedir(), '.graviton');
    if (!fs.existsSync(gravitonDir)) {
      fs.mkdirSync(gravitonDir, { recursive: true });
    }
    const current = readOdometer();
    const totalTokens = current.totalTokens + sessionTokens;
    const data = {
      totalTokens,
      lastSessionTokens: sessionTokens,
      sessionsCount: current.sessionsCount + 1,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(getOdometerPath(), JSON.stringify(data, null, 2), 'utf8');
    return { sessionTokens, totalTokens };
  } catch {
    return { sessionTokens, totalTokens: sessionTokens };
  }
}

/**
 * .0.0 Output Token Economizer:
 * Injects concise diff-response directives unless the user is explicitly creating a new file from scratch.
 * @param {string} userInput
 * @param {object} options
 * @returns {string}
 */
export function generateEconomizerDirective(userInput, options = {}) {
  if (options && options.rawOutput) return '';
  const isCreatingNewFile = /\b(?:buat(?:kan)?\s+file\s+baru|create\s+(?:a\s+)?new\s+file|write\s+(?:the\s+)?entire\s+file|buatkan\s+dari\s+nol|scaffold)\b/i.test(userInput || '');
  if (isCreatingNewFile) return '';
  return `[GRAVITON RESPONSE ECONOMIZER]\nWhen modifying existing files, DO NOT rewrite full files in response output. Output localized Search/Replace blocks or Unified Diffs to conserve tokens.\n`;
}

/**
 * .0.0 Zero-Token Middleware: Assembles the SuperPrompt locally via fs & regex.
 * Zero token cost, zero external API calls.
 */
export function constructSuperPrompt(userInput, cwd = process.cwd(), options = {}) {
  // Fire-and-forget self-cleaning shadow backup (zero latency impact)
  purgeOldBackups();

  const currentCwd = cwd || process.cwd();
  let cleanedInput = pruneNoise(userInput || '', { isPrompt: true });

  // Stack Trace Squeezer
  if (!options.noSqueeze) {
    const traceResult = squeezeMixedContent(cleanedInput, currentCwd);
    if (traceResult.hasTrace) {
      cleanedInput = traceResult.squeezedText;
    }
  }

  // Autonomous Prompt Architect & Dynamic Reprompter
  let architectIntent = 'general';
  if (!options.noArchitect) {
    const architectResult = architectPrompt(cleanedInput, {
      cwd: currentCwd,
      isDeep: Boolean(options.isDeep),
      isFast: Boolean(options.isFast)
    });
    if (architectResult.architectedPrompt && architectResult.architectedPrompt !== cleanedInput) {
      cleanedInput = architectResult.architectedPrompt;
    }
    architectIntent = architectResult.intent || 'general';
  }

  // Pre-emptive Domain Safety & Edge-Case Invariants (V3.6.0 Overclock Engine)
  if (!options.noOverclock && !options.noEdgeCases) {
    const edgeCases = synthesizeDomainEdgeCases(architectIntent, cleanedInput);
    if (edgeCases && edgeCases.length > 0 && !cleanedInput.includes('[PRE-EMPTIVE DOMAIN SAFETY & EDGE-CASE INVARIANTS]')) {
      const edgeCaseList = edgeCases.map((ec, idx) => `   - ${ec}`).join('\n');
      cleanedInput = `${cleanedInput}\n\n=== [PRE-EMPTIVE DOMAIN SAFETY & EDGE-CASE INVARIANTS] ===\n${edgeCaseList}`;
    }
  }

  // Synthetic AGI Metacognitive Engine (V4.0.0 1:1 Dialectic & Teleological Invariants)
  if (!options.noAgi && !options.noMetacognition) {
    const agiResult = synthesizeAgiCognitiveHarness(cleanedInput, architectIntent, options);
    if (agiResult && agiResult.harness && !cleanedInput.includes('[.0.0 SYNTHETIC AGI METACOGNITIVE HARNESS]')) {
      cleanedInput = `${cleanedInput}\n\n${agiResult.harness}`;
    }
  }

  // Dynamic Skill Capabilities Matrix (V4.1.0 High-Leverage Skills)
  if (!options.noSkills) {
    const skillsBlock = formatSkillDirectivesBlock(cleanedInput);
    if (skillsBlock && !cleanedInput.includes('[GRAVITON RELEVANT SKILL CAPABILITIES ACTIVATED]')) {
      cleanedInput = `${cleanedInput}\n\n${skillsBlock}`;
    }
  }

  // Grounded Live Intel & 2026 API Invariants (V4.3.0 Grounding Engine)
  if (!options.noGrounding && !options.noResearch) {
    const researchBlock = synthesizeGroundedResearchBlock(cleanedInput);
    if (researchBlock && !cleanedInput.includes('[GRAVITON GROUNDED LIVE INTEL & 2026 API INVARIANTS]')) {
      cleanedInput = `${cleanedInput}\n\n${researchBlock}`;
    }
  }

  // Prompt Ambiguity & Requirement Clarifier (V4.9.0)
  if (!options.noClarify) {
    const ambiguityAnalysis = analyzePromptAmbiguity(userInput || cleanedInput);
    if (ambiguityAnalysis.isAmbiguous) {
      const clarifiedBlock = synthesizeClarifiedSpecificationBlock(ambiguityAnalysis);
      if (clarifiedBlock && !cleanedInput.includes('[GRAVITON CLARIFIED ENGINEERING SPECIFICATION]')) {
        cleanedInput = `${cleanedInput}\n\n${clarifiedBlock}`;
      }
    }
  }

  const workspaceInfo = buildWorkspaceMap(currentCwd);
  const gravitonFilter = createGravitonFilter(currentCwd);
  let sessionFilesIgnored = 0;

  // Smart File Hydration: detect file names mentioned in userInput
  const fileRegex = /\b([a-zA-Z0-9_./\\-]+\.(?:js|jsx|ts|tsx|py|rs|go|html|css|json|md|yaml|yml|sql|sh|docx|xlsx|pptx|pdf|csv|tsv))\b/gi;
  const matches = ((userInput || '').match(fileRegex) || []).map(m => m.trim());
  const uniqueFiles = Array.from(new Set(matches));

  const injectedFiles = [];
  const injectedDependencies = [];
  const handledPaths = new Set();

  for (const filename of uniqueFiles) {
    if (filename.startsWith('http://') || filename.startsWith('https://')) continue;
    if (gravitonFilter.isIgnored(filename)) {
      sessionFilesIgnored++;
      continue;
    }
    if (isProtectedFile(filename)) {
      sessionFilesIgnored++;
      injectedFiles.push(generateDependencySummary(currentCwd));
      continue;
    }

    let candidatePath = path.resolve(currentCwd, filename);
    if (gravitonFilter.isIgnored(candidatePath)) {
      sessionFilesIgnored++;
      continue;
    }
    let resolved = null;

    if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
      resolved = candidatePath;
    } else {
      const baseName = path.basename(filename);
      const searchDirs = [currentCwd];
      try {
        const topEntries = fs.readdirSync(currentCwd, { withFileTypes: true });
        for (const e of topEntries) {
          if (e.isDirectory() && !['node_modules', '.git', 'dist', 'build'].includes(e.name)) {
            searchDirs.push(path.join(currentCwd, e.name));
          }
        }
      } catch {}

      for (const d of searchDirs) {
        const p = path.join(d, baseName);
        if (!gravitonFilter.isIgnored(p) && fs.existsSync(p) && fs.statSync(p).isFile()) {
          resolved = p;
          break;
        }
      }
    }

    if (resolved && !handledPaths.has(resolved)) {
      handledPaths.add(resolved);
      try {
        if (isTranspilableDocument(resolved)) {
          const transpiled = transpileFileToMarkdown(resolved);
          injectedFiles.push(transpiled);
          continue;
        }

        const stat = fs.statSync(resolved);
        if (stat.size > 10 * 1024 * 1024) {
          injectedFiles.push(`// [GRAVITON DEFENSIVE GUARD: "${path.relative(currentCwd, resolved).replace(/\\/g, '/')}" exceeds 10MB safety limit (${(stat.size / (1024 * 1024)).toFixed(1)}MB). Content omitted for stability.]`);
          continue;
        }

        const rawFileContent = fs.readFileSync(resolved, 'utf8');
        const lineCount = rawFileContent.split('\n').length;
        const ext = path.extname(resolved).slice(1) || '';
        const relPath = path.relative(currentCwd, resolved).replace(/\\/g, '/');
        const cappedContent = readAndTruncateFile(resolved, 500);

        // DELTA COMPRESSION HOOK
        // If continuous conversation session is active and delta is not disabled:
        if (options.isContinuous && !options.noDelta) {
          const deltaResult = resolveDeltaHydration(resolved, rawFileContent, currentCwd, {
            conversationId: options.conversationId,
            threshold: options.deltaThreshold || 0.4
          });

          if (deltaResult.mode === 'unchanged' || deltaResult.mode === 'delta') {
            injectedFiles.push(deltaResult.text);
            continue;
          }
        }

        if (!options.full && isAstCandidate(resolved, lineCount)) {
          let focusName = null;
          const candidateWords = (userInput || '').match(/[a-zA-Z_$][a-zA-Z0-9_$]{2,}/g) || [];
          for (const word of candidateWords) {
            if (new RegExp(`\\b(?:function|def|class|const|let|var|func|fn)\\s+${word}\\b`, 'i').test(rawFileContent)) {
              focusName = word;
              break;
            }
          }

          const astResult = generateAstFunctionIndex(rawFileContent, relPath || filename, { focusName });
          injectedFiles.push(astResult.formattedIndex);
          if (focusName && astResult.targetFocusCode) {
            injectedFiles.push(astResult.targetFocusCode);
          }
        } else if (!options.full && isSkeletonCandidate(resolved, lineCount)) {
          let focusName = null;
          const candidateWords = (userInput || '').match(/[a-zA-Z_$][a-zA-Z0-9_$]{2,}/g) || [];
          for (const word of candidateWords) {
            if (new RegExp(`\\b(?:function|def|class|const|let|var)\\s+${word}\\b`, 'i').test(rawFileContent)) {
              focusName = word;
              break;
            }
          }

          const skeleton = skeletonizeCode(rawFileContent, ext, { focusName });
          injectedFiles.push(
            `[GRAVITON CODE SKELETON: ${relPath || filename} - Implementation Collapsed for Token Economy]\n\`\`\`${ext}\n${skeleton}\n\`\`\``
          );
        } else {
          if (cappedContent !== null) {
            injectedFiles.push(
              `[AUTO-INJECTED FILE: ${relPath || filename}]\n\`\`\`${ext}\n${cappedContent}\n\`\`\``
            );
          }
        }

        // 2. Shallow Dependency Scraping (Universal across JS/TS, Python, Go, Rust, depth = 1; skip for minified)
        if (cappedContent !== '// [MINIFIED FILE DETECTED: CONTENT OMITTED FOR TOKEN SAFETY]') {
          const depRegex = /(?:import\s+.*?from\s+['"]|require\(['"]|import\s+['"]|from\s+.*?import\s+|from\s+['"]?)((?:\.\/|\.\.\/|@\/|~\/)[^'"\s]+)/g;
          const detectedDeps = [];
          let match;
          while ((match = depRegex.exec(rawFileContent)) !== null) {
            const depImport = match[1] ? match[1].replace(/['";]+$/, '').trim() : null;
            if (depImport && !detectedDeps.includes(depImport)) {
              detectedDeps.push(depImport);
            }
          }

          const fileDir = path.dirname(resolved);
          for (const depImport of detectedDeps) {
            const resolvedDep = resolveLocalDependency(fileDir, depImport, currentCwd);
            if (resolvedDep && gravitonFilter.isIgnored(resolvedDep)) {
              sessionFilesIgnored++;
              continue;
            }
            if (resolvedDep && !handledPaths.has(resolvedDep)) {
              handledPaths.add(resolvedDep);
              const depContent = readAndTruncateFile(resolvedDep, 500);
              if (depContent !== null) {
                const depExt = path.extname(resolvedDep).slice(1) || '';
                const relDepPath = path.relative(currentCwd, resolvedDep).replace(/\\/g, '/');
                injectedDependencies.push(
                  `[AUTO-INJECTED DEPENDENCY: ${relDepPath}]\n\`\`\`${depExt}\n${depContent}\n\`\`\``
                );
              }
            }
          }
        }
      } catch {}
    }
  }

  // Shadow Backup: Automatically back up detected hydrated files into ~/.graviton/backups/
  if (handledPaths.size > 0) {
    createShadowBackup(Array.from(handledPaths), currentCwd);
  }

  const allInjected = [];
  if (injectedFiles.length > 0) {
    allInjected.push(injectedFiles.join('\n\n'));
  }
  if (injectedDependencies.length > 0) {
    allInjected.push(injectedDependencies.join('\n\n'));
  }

  const injectedFilesBlock = allInjected.length > 0
    ? '\n\n' + allInjected.join('\n\n')
    : '';

  const targetScope = resolveTargetScope(userInput, currentCwd);
  const compactMemory = getCompactMemoryDirective(currentCwd);
  const isContinuous = Boolean(options && options.isContinuous);
  const conversationTitle = options && options.conversationTitle ? options.conversationTitle : null;

  const systemDirective = `You are Antigravity, executed via Graviton in autonomous mode.
CRITICAL WORKSPACE & DIRECTORY ISOLATION RULES:
1. The active workspace and project root is strictly located at [CWD]: "${currentCwd}".
2. You MUST create all new files, project structures, code, dependencies, and folders strictly INSIDE this [CWD] directory (or relative to it).
3. NEVER create files or projects in ~/.gemini, in scratch directories, or in any parent/root directory outside [CWD].
4. DEV & WEB SERVER LIFECYCLE: When asked to run, start, or serve a web project: Antigravity CLI terminates background child processes on session exit. Therefore, NEVER run persistent continuous web servers (e.g. 'node server.js', 'npm run dev', 'vite', 'python -m http.server') directly with run_command in an infinite wait. Instead, inspect/prepare the web files (e.g. server.js, index.html), report the local URL (e.g. http://localhost:3000/), and finish immediately — Graviton's daemon engine will automatically launch and manage the persistent background daemon.
5. TOKEN SHIELD & ASSET GUARD: NEVER read, search, or dump raw dependency lockfiles (package-lock.json, yarn.lock, pnpm-lock.yaml, composer.lock, Cargo.lock) or minified assets (.min.js, .min.css). If analyzing dependencies or troubleshooting packages, read package.json exclusively. Lockfiles contain redundant resolution metadata that wastes tens of thousands of tokens.
6. [BREVITY PROTOCOL]: Output zero pleasantries, zero conversational filler, and zero apologies. Use terse, dense technical fragments. Execute requested tasks directly using tools without asking questions. Always complete requested actions before finishing.
7. TARGET SCOPE & CONTEXT FOCUS: If a targeted scope is provided below, proceed directly to inspect or edit the designated target files. Do NOT perform redundant exploratory tool calls (list_dir or grep_search) across the workspace.
8. [SURGICAL CODE MODIFICATION & OUTPUT ECONOMIZER]: Follow the minimal blast radius rule. Never rewrite unaffected methods or entire files in responses. Provide localized Search/Replace blocks or Unified Diffs, keeping explanations minimal.
9. [CLEAN CLI OUTPUT]: This is a direct terminal CLI session. NEVER use raw Markdown bold asterisks (**) or header hashes (###, ##, #) in explanatory text. Use clean plain text with simple bullet points (-) and uppercase section headers without asterisks.
10. [AUTONOMOUS DIRECT EXECUTION - ZERO APPROVAL REQUESTS]: You are executing with full autonomous privileges (--dangerously-skip-permissions). NEVER output phrases requesting user approval or review, such as "AWAITING USER APPROVAL", "SUMMARY OF ACTIONABLE DECISIONS", "Please review the implementation plan and approve", or ask the user for confirmation. Execute modifications immediately and autonomously.`.replace(/\r\n/g, '\n');

  // Delta Prompting: in continuous sessions, omit repetitive workspace tree map to conserve tokens
  const workspaceBlock = isContinuous
    ? `[GRAVITON SESSION CONTINUITY ACTIVE]\nWorkspace tree already indexed in previous turn. Delta Target Scope applied below.`
    : workspaceInfo;

  const targetDirectiveBlock = targetScope && targetScope.directive ? `\n\n${targetScope.directive}` : '';
  const compactMemoryBlock = compactMemory ? `\n\n${compactMemory}` : '';
  const topicDirectiveBlock = conversationTitle
    ? `\n\n[ACTIVE CONVERSATION TOPIC]: "${conversationTitle}"\nStay strictly focused on resolving tasks within this conversation topic.`
    : '';
  const economizerDirective = generateEconomizerDirective(userInput, options);
  const economizerBlock = economizerDirective ? `\n\n${economizerDirective}` : '';
  const cognitiveContract = !options.noContract ? buildCognitiveContract(options) : '';
  const cognitiveContractBlock = cognitiveContract ? `\n\n${cognitiveContract}` : '';

  const finalPrompt = `[SYSTEM DIRECTIVE]: "${systemDirective}"

[CWD]: ${currentCwd}
${compactMemoryBlock}${targetDirectiveBlock}${topicDirectiveBlock}${economizerBlock}${cognitiveContractBlock}

${workspaceBlock}${injectedFilesBlock}

[USER INSTRUCTION & ERROR LOG]:
${cleanedInput}`.replace(/\r\n/g, '\n').trim();


  // Local Trip Odometer: Silently track tokens
  const promptTokens = estimateTokens(finalPrompt);
  recordOdometer(promptTokens);

  // Local Analytics Telemetry
  const rawInputTokens = estimateTokens(userInput);
  const cleanedInputTokens = estimateTokens(cleanedInput);
  const inputTokensSaved = Math.max(0, rawInputTokens - cleanedInputTokens);
  const minifiedCount = Array.from(handledPaths).filter(p => {
    const b = path.basename(p).toLowerCase();
    return b.endsWith('.min.js') || b.endsWith('.min.css');
  }).length;
  const totalTokensSaved = inputTokensSaved + (minifiedCount * 8000);
  recordTelemetry({
    calls: 1,
    filesIgnored: sessionFilesIgnored,
    tokensSaved: totalTokensSaved
  });

  return finalPrompt;
}

/**
 * Extracts the static cache prefix of a prompt to verify LLM KV Context Caching alignment.
 * @param {string} promptText
 * @returns {string}
 */
export function getPromptCachePrefix(promptText) {
  if (!promptText || typeof promptText !== 'string') return '';
  const marker = '[USER INSTRUCTION & ERROR LOG]:';
  const idx = promptText.indexOf(marker);
  if (idx !== -1) {
    return promptText.slice(0, idx).trim();
  }
  return promptText;
}

/**
 * Local Deterministic Synthesizer (Graviton Zero-Token Middleware Wrapper)
 */
export function repromptLocally(rawText, workspaceContext = null, unlockedSkills = [], workspaceMap = null) {
  const currentCwd = process.cwd();
  return constructSuperPrompt(rawText, currentCwd);
}

/**
 * Main Synthesizer Orchestrator (Zero-Token Middleware)
 */
export async function synthesizePrompt(rawText, apiKey = null, options = {}) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      originalText: '',
      optimizedText: '',
      superPrompt: '',
      workspaceMap: '',
      stats: { originalTokens: 0, optimizedTokens: 0, tokensSaved: 0, percentSaved: 0, engine: 'Graviton Zero-Token Middleware' }
    };
  }

  const currentCwd = options.cwd || process.cwd();
  const superPrompt = constructSuperPrompt(rawText, currentCwd);
  const workspaceMap = options.workspaceMap || buildWorkspaceMap(currentCwd);
  const prunedText = pruneNoise(rawText);
  const originalTokens = estimateTokens(rawText);
  const prunedTokens = estimateTokens(prunedText);
  const optimizedTokens = estimateTokens(superPrompt);
  const tokensSaved = Math.max(0, originalTokens - prunedTokens);
  const percentSaved = originalTokens > 0 ? Math.max(0, Math.round((tokensSaved / originalTokens) * 100)) : 0;

  return {
    originalText: rawText,
    prunedText,
    optimizedText: superPrompt,
    superPrompt,
    workspaceMap,
    stats: {
      originalTokens,
      prunedTokens,
      optimizedTokens,
      tokensSaved,
      percentSaved,
      engine: 'Graviton Zero-Token Middleware'
    }
  };
}

// Standalone CLI invocation handler
if (process.argv[1]) {
  try {
    const isDirectCli = path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
    if (isDirectCli) {
      process.on('uncaughtException', (err) => {
        const message = err && err.message ? err.message : String(err);
        console.error(`\x1b[1;31m[GRAVITON ERROR]\x1b[0m \x1b[31m${message}\x1b[0m`);
        process.exit(1);
      });
      await import('../bin/graviton.js');
    }
  } catch {}
}

export {
  loadGravIgnore,
  isGravIgnored,
  createGravFilter,
  loadGravitonIgnore,
  isGravitonIgnored,
  createGravitonFilter,
  getTelemetry,
  recordTelemetry,
  formatTelemetryDashboard
};
