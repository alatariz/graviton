// src/pipeline.js - Graviton Core: Precision Context & Execution Optimization Engine
import fs from 'fs';
import path from 'path';
import os from 'os';
import { redactSecrets, detectWorkspaceContext } from './workspace-helper.js';
import { resolveSkillDirectives } from './skill-matrix.js';

/**
 * Fast Token Estimator
 */
export function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const wordsAndPunct = text.match(/\w+|[^\s\w]|\s+/g) || [];
  let tokenCount = 0;
  for (const token of wordsAndPunct) {
    if (/^\s+$/.test(token)) {
      tokenCount += Math.ceil(token.length / 4);
    } else if (/^[A-Za-z0-9_]+$/.test(token)) {
      tokenCount += Math.ceil(token.length / 3.8);
    } else {
      tokenCount += Math.ceil(token.length / 1.5);
    }
  }
  return Math.max(1, Math.round(tokenCount));
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
 * Graviton Core Noise Filter
 * Pure heuristic & regex string filter executed BEFORE text reaches the AI Synthesizer.
 * Enforces:
 * - JSON array compression (> 3 elements) to first and last items.
 * - Detection & destruction of terminal noise (npm WARN, npm notice, info, Downloaded, Compiling, Building).
 * - Exclusive preservation of critical error lines (TypeError, ReferenceError, Exception, panic, FATAL, at stack trace).
 */
export function pruneNoise(rawText) {
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

  // 4. Terminal Log Filter
  // Exclusively preserve: TypeError, ReferenceError, Exception, panic, FATAL, or at (stack trace)
  const TERMINAL_EXCLUSIVE_ERROR_REGEX = /(?:TypeError|ReferenceError|Exception|panic|FATAL|^\s*at\s+|\bat\s+(?:[A-Za-z0-9_$.<>]+\s+)?\([^)]+:\d+:\d+\))/i;

  // Detect and destroy: npm WARN, npm notice, info, Downloaded, Compiling, Building, plus spinners/progress bars
  const TERMINAL_NOISE_REGEX = (
    /(?:npm\s+WARN|npm\s+notice|(?:^\s*|[\[:]|\b(?:npm|yarn|pnpm)\s+)info\b|Downloaded|Compiling|Building)/i
  );
  const PROGRESS_NOISE_REGEX = (
    /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/ ||
    /(?:\[[=> -]{5,}\]|\b\d+(?:\.\d+)?%\s*(?:done|complete)?|\b\d+\/\d+\s+(?:packages|files|crates))/i ||
    /(?:npm|yarn|pnpm)\s+(?:verb|timing|sill|http\s+fetch)/i ||
    /(?:Downloading|Fetching|Extracting)\s+https?:/i
  );

  const rawLines = out.split('\n');
  const filteredLines = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      filteredLines.push(line);
      continue;
    }

    // 1. Exclusively preserve critical error & traceback lines
    if (TERMINAL_EXCLUSIVE_ERROR_REGEX.test(trimmed)) {
      filteredLines.push(line);
      continue;
    }

    // 2. Detect and destroy noise lines
    if (TERMINAL_NOISE_REGEX.test(trimmed) || PROGRESS_NOISE_REGEX.test(trimmed)) {
      // Completely dropped
      continue;
    }

    filteredLines.push(line);
  }
  out = filteredLines.join('\n');

  // 5. Deduplicate repetitive log lines cleanly
  const lines = out.split('\n');
  const deduplicated = [];
  let prevLine = null;
  let repeatCount = 0;

  const flushRepeats = () => {
    if (repeatCount > 2) {
      deduplicated.push(`   ↳ [Repeated ${repeatCount}x: "${prevLine.slice(0, 50)}..."]`);
    } else if (repeatCount > 0) {
      for (let i = 0; i < repeatCount; i++) deduplicated.push(prevLine);
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed === prevLine) {
      repeatCount++;
    } else {
      flushRepeats();
      prevLine = trimmed;
      repeatCount = 0;
      deduplicated.push(line);
    }
  }
  flushRepeats();
  out = deduplicated.join('\n');

  // 6. Remove cosmetic separators
  out = out.replace(/^[ \t]*(?:\/\/|#|\/\*)[ \t]*[-=~*#]{5,}[ \t]*(?:\*\/)?$/gm, '');

  // 7. Strip trailing AI disclaimers
  const trailingFluff = [
    /(?:Hope\s+this\s+helps!?(?:\s+Let\s+me\s+know\s+if\s+you\s+need\s+anything\s+else\.?)?)\s*$/gi,
    /(?:Please\s+let\s+me\s+know\s+if\s+you\s+have\s+any\s+(?:other\s+)?questions(?:\s+or\s+need\s+further\s+assistance)?\.?)?\s*$/gi,
    /(?:Feel\s+free\s+to\s+ask\s+if\s+you\s+have\s+any\s+(?:more\s+)?questions\.?)?\s*$/gi,
    /(?:Semoga\s+(?:ini\s+)?membantu!?(?:\s+Beri\s+tahu\s+saya\s+jika\s+ada\s+pertanyaan\.?)?)\s*$/gi
  ];
  for (const pat of trailingFluff) {
    out = out.replace(pat, '');
  }

  return out.trim();
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
      if (e.isDirectory() && ignoreDirs.has(e.name)) return false;
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

  const systemDirective = `You are Antigravity, executed via Graviton. Act as a Ruthless Editor. Remove conversational fluff. Think in <graviton_plan> before coding. Strictly prioritize native/stdlib over external dependencies. Output absolute minimal code.`;

  return `[SYSTEM DIRECTIVE]: "${systemDirective}"

[CWD]: ${currentCwd}

${workspaceInfo}

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
  const originalTokens = estimateTokens(rawText);
  const optimizedTokens = estimateTokens(superPrompt);

  return {
    originalText: rawText,
    optimizedText: superPrompt,
    superPrompt,
    workspaceMap,
    stats: {
      originalTokens,
      optimizedTokens,
      tokensSaved: Math.max(0, originalTokens - optimizedTokens),
      percentSaved: originalTokens > 0 ? Math.max(0, Math.round(((originalTokens - optimizedTokens) / originalTokens) * 100)) : 0,
      engine: 'Graviton Zero-Token Middleware'
    }
  };
}
