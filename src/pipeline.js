import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { redactSecrets } from './workspace-helper.js';

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
export function pruneNoise(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';
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

  // [BLACKLIST]: Ecosystem-agnostic terminal noise (npm, pip, cargo, go, info/warning, build/download steps)
  const BLACKLIST_REGEX = /^(?:npm|pip|cargo|go)\s+(?:WARN|notice|info)|^(?:info\s+|warning:|npm notice)|\[.*?\]\s*(?:info|debug)|downloading|compiling|building/i;

  const filteredLines = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 1. [WHITELIST] rule
    if (WHITELIST_REGEX.test(line)) {
      filteredLines.push(line);
      continue;
    }

    // 2. [BLACKLIST] rule
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
    '.cache', 'venv', '.venv', '.idea', '.vscode'
  ]);
  const gitignorePatterns = [];

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

    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    const filtered = entries.filter(e => {
      if (e.name.startsWith('.') && e.name !== '.env.example') return false;
      const relItemPath = path.relative(cwd, path.join(dir, e.name)).replace(/\\/g, '/');
      if (isIgnored(e.name, relItemPath)) return false;
      return true;
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
 * File Truncation (Anti-Bom File)
 * Reads file content and splits by lines (\n).
 * If lines exceed 500, takes first 500 lines and appends:
 * \n// [...FILE TRUNCATED: MAX 500 LINES EXCEEDED...]
 */
export function readAndTruncateFile(filePath, maxLines = 500) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    if (lines.length > maxLines) {
      return lines.slice(0, maxLines).join('\n') + '\n// [...FILE TRUNCATED: MAX 500 LINES EXCEEDED...]';
    }
    return lines.join('\n');
  } catch {
    return null;
  }
}

/**
 * Auto-Git Save Point (Pengganti Rasa Takut)
 * Creates a pre-execution git commit snapshot synchronously before forwarding prompt.
 * Fails silently if directory is not a git repo or if working tree is clean.
 */
export function createGitSavePoint(cwd = process.cwd()) {
  try {
    execSync('git add . && git commit -m "graviton_savepoint: pre-execution backup"', {
      cwd: cwd || process.cwd(),
      stdio: 'ignore'
    });
  } catch {}
}

/**
 * Shallow Dependency Resolver
 * Resolves relative local dependency paths (depth = 1) across JS/TS, Python, Go, Rust
 */
export function resolveLocalDependency(baseDir, relativeImport) {
  try {
    const candidate = path.resolve(baseDir, relativeImport);
    // 1. Direct file match
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
    // 2. Common extensions (JS/TS, Python, Go, Rust, etc.)
    const exts = ['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx', '.json', '.py', '.go', '.rs'];
    for (const ext of exts) {
      const withExt = candidate + ext;
      if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
        return withExt;
      }
    }
    // 3. Directory index or Python package
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
 * Graviton V1.2 Zero-Token Middleware: Assembles the SuperPrompt locally via fs & regex.
 * Zero token cost, zero external API calls.
 */
export function constructSuperPrompt(userInput, cwd = process.cwd(), options = {}) {
  const currentCwd = cwd || process.cwd();
  const cleanedInput = pruneNoise(userInput || '');
  const workspaceInfo = buildWorkspaceMap(currentCwd);

  // Smart File Hydration: detect file names mentioned in userInput
  const fileRegex = /\b([a-zA-Z0-9_./\\-]+\.(?:js|jsx|ts|tsx|py|rs|go|html|css|json|md|yaml|yml|sql|sh))\b/gi;
  const matches = ((userInput || '').match(fileRegex) || []).map(m => m.trim());
  const uniqueFiles = Array.from(new Set(matches));

  const injectedFiles = [];
  const injectedDependencies = [];
  const handledPaths = new Set();

  for (const filename of uniqueFiles) {
    if (filename.startsWith('http://') || filename.startsWith('https://')) continue;

    let candidatePath = path.resolve(currentCwd, filename);
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
        if (fs.existsSync(p) && fs.statSync(p).isFile()) {
          resolved = p;
          break;
        }
      }
    }

    if (resolved && !handledPaths.has(resolved)) {
      handledPaths.add(resolved);
      try {
        const cappedContent = readAndTruncateFile(resolved, 500);
        if (cappedContent !== null) {
          const ext = path.extname(resolved).slice(1) || '';
          const relPath = path.relative(currentCwd, resolved).replace(/\\/g, '/');

          injectedFiles.push(
            `[AUTO-INJECTED FILE: ${relPath || filename}]\n\`\`\`${ext}\n${cappedContent}\n\`\`\``
          );

          // 2. Shallow Dependency Scraping (Universal across JS/TS, Python, Go, Rust, depth = 1)
          const rawFileContent = fs.readFileSync(resolved, 'utf8');
          const depRegex = /(?:import\s+.*?from\s+['"]|require\(['"]|import\s+['"]|from\s+.*?import\s+|from\s+['"]?)((?:\.\/|\.\.\/)[^'"\s]+)/g;
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
            const resolvedDep = resolveLocalDependency(fileDir, depImport);
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

  const systemDirective = `You are Antigravity, executed via Graviton. Act as a Ruthless Editor. Remove conversational fluff. Think in <graviton_plan> before coding. Strictly prioritize native/stdlib over external dependencies. Output absolute minimal code.`;

  const finalPrompt = `[SYSTEM DIRECTIVE]: "${systemDirective}"

[CWD]: ${currentCwd}

${workspaceInfo}${injectedFilesBlock}

[USER INSTRUCTION & ERROR LOG]:
${cleanedInput}`.trim();

  // Local Trip Odometer: Silently track tokens
  const promptTokens = estimateTokens(finalPrompt);
  recordOdometer(promptTokens);

  return finalPrompt;
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
