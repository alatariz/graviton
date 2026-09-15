// src/pipeline.js - Graviton Core: Precision Context & Execution Optimization Engine
import fs from 'fs';
import path from 'path';
import os from 'os';
import { redactSecrets, detectWorkspaceContext } from './workspace-helper.js';
import { resolveSkillDirectives } from './skill-matrix.js';

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

  // [WHITELIST]: Jika baris mengandung kata TypeError, Exception, Error:, at , atau ReferenceError,
  // baris tersebut WAJIB DIPERTAHANKAN (jangan dipotong regex apa pun).
  const WHITELIST_REGEX = /(?:TypeError|ReferenceError|Exception|Error:|\bat\s+)/;

  // [BLACKLIST]: Jika tidak masuk whitelist, hapus baris HANYA JIKA dimulai dengan (atau dominan berisi):
  // npm WARN, info , warning:, npm notice, serta bracketed tags/build logs
  const BLACKLIST_REGEX = /^\s*(?:\[(?:info|warn|warning|notice)\]\s*|\[.*?\]\s*info\s+|npm WARN|info\s+|warning:|npm notice|downloading|downloaded|compiling|building)/i;

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
    if (BLACKLIST_REGEX.test(line)) {
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
 * Local Skill Vault Reader (~/.graviton/skills/)
 * Automatically scans and injects relevant skill markdown files based on prompt keywords.
 */
export function loadLocalSkillVault(promptText = '') {
  const skillsDir = path.join(os.homedir(), '.graviton', 'skills');
  const matchedSkills = [];

  try {
    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
      const initialSkills = {
        'modern-web.md': `# Modern Web Guidance\nKeywords: web, modal, css, html, dialog, responsive, animation\nDirective: Enforce native <dialog>, CSS container queries, :has selectors, view transitions, and zero-layout-shift practices.`,
        'bigquery.md': `# BigQuery SQL Optimization\nKeywords: bigquery, sql, etl, partition, cluster, dataset, table\nDirective: Enforce partitioning, clustering, avoided SELECT *, and idempotent MERGE mutations.`,
        'antigravity-core.md': `# Antigravity Core Directive\nKeywords: performance, core, leak, background, relay, signal\nDirective: Enforce zero memory leaks, signal forwarding, and autonomous task execution with Auto-Allow.`
      };
      for (const [filename, content] of Object.entries(initialSkills)) {
        fs.writeFileSync(path.join(skillsDir, filename), content, 'utf8');
      }
    }

    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));
    const lowerPrompt = promptText.toLowerCase();

    for (const file of files) {
      const filePath = path.join(skillsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const baseName = path.basename(file, '.md').toLowerCase();

      const kwMatch = content.match(/Keywords:\s*([^\n]+)/i);
      const keywords = kwMatch
        ? kwMatch[1].split(',').map(k => k.trim().toLowerCase())
        : [baseName];

      const isMatch = keywords.some(k => k && lowerPrompt.includes(k)) || lowerPrompt.includes(baseName);
      if (isMatch) {
        const dirMatch = content.match(/Directive:\s*([^\n]+)/i);
        const directive = dirMatch ? dirMatch[1].trim() : content.slice(0, 160).replace(/\n/g, ' ');
        matchedSkills.push({
          skill: `LocalVault:${baseName}`,
          directive: directive,
          content: content.trim()
        });
      }
    }
  } catch (err) {
    // Fail gracefully if skills directory is not readable
  }

  return matchedSkills;
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

  // 2. Traverse directory tree
  function scan(dir, depth, prefix = '') {
    if (depth > maxDepth) return;
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

    const limit = 20;
    const items = filtered.slice(0, limit);

    items.forEach((item, index) => {
      const isLast = index === items.length - 1 && filtered.length <= limit;
      const pointer = isLast ? '└── ' : '├── ';

      if (item.isDirectory()) {
        treeLines.push(`${prefix}${pointer}${item.name}/`);
        scan(path.join(dir, item.name), depth + 1, prefix + (isLast ? '    ' : '│   '));
      } else {
        treeLines.push(`${prefix}${pointer}${item.name}`);
      }
    });

    if (filtered.length > limit) {
      treeLines.push(`${prefix}└── ... and ${filtered.length - limit} more items`);
    }
  }

  scan(cwd, 1, '');

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
 * Graviton Zero-Token Middleware: Assembles the SuperPrompt locally via fs & regex.
 * Zero token cost, zero external API calls.
 */
export function constructSuperPrompt(userInput, cwd = process.cwd()) {
  const currentCwd = cwd || process.cwd();
  const cleanedInput = pruneNoise(userInput || '');
  const workspaceInfo = buildWorkspaceMap(currentCwd);

  // Smart File Hydration: detect file names mentioned in userInput
  const fileRegex = /\b([a-zA-Z0-9_./\\-]+\.(?:js|jsx|ts|tsx|py|rs|go|html|css|json|md|yaml|yml|sql|sh))\b/gi;
  const matches = (userInput.match(fileRegex) || []).map(m => m.trim());
  const uniqueFiles = Array.from(new Set(matches));

  const injectedFiles = [];
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
        const content = fs.readFileSync(resolved, 'utf8');
        const lines = content.split('\n');
        const cappedLines = lines.slice(0, 300).join('\n');
        const ext = path.extname(resolved).slice(1) || '';
        const relPath = path.relative(currentCwd, resolved).replace(/\\/g, '/');

        injectedFiles.push(
          `[AUTO-INJECTED FILE: ${relPath || filename}]\n\`\`\`${ext}\n${cappedLines}\n\`\`\``
        );
      } catch {}
    }
  }

  const injectedFilesBlock = injectedFiles.length > 0
    ? '\n\n' + injectedFiles.join('\n\n')
    : '';

  const systemDirective = `You are Antigravity, executed via Graviton. Act as a Ruthless Editor. Remove conversational fluff. Think in <graviton_plan> before coding. Strictly prioritize native/stdlib over external dependencies. Output absolute minimal code.`;

  return `[SYSTEM DIRECTIVE]: "${systemDirective}"

[CWD]: ${currentCwd}

${workspaceInfo}${injectedFilesBlock}

[USER INSTRUCTION & ERROR LOG]:
${cleanedInput}`.trim();
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
