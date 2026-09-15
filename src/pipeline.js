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

  const formatted = `[WORKSPACE MAP:\n${treeStructure}\n]\n[EXISTING DEPENDENCIES: ${depListStr}]`;

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
 * Graviton Core Precision Synthesizer (Gemini API Engine)
 * Maximizes Signal-to-Noise ratio, removes fluff, smartly expands technical specs, and enforces native-first.
 */
export async function repromptWithAI(cleanedText, apiKey, unlockedSkills = [], workspaceMap = null) {
  const currentCwd = process.cwd();
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const skillDirectiveStr = unlockedSkills.length > 0
    ? `\nAdditional Skill Directives (execute natively):\n` + unlockedSkills.map(s => `- [${s.skill}] ${s.directive}`).join('\n')
    : '';

  const systemInstruction = `Role: You are the Graviton Core Synthesizer. Your job is to maximize the Signal-to-Noise ratio of the user's prompt.

Rule 1 (Remove Fluff): Completely remove all conversational fluff, emotions, and greetings.

Rule 2 (Smart Expansion): If the user's technical request is ambiguous, EXPAND and clarify the technical specifications. Add necessary constraints (e.g., error handling, edge cases) to ensure the execution is precise. The final output can be longer than the input if it prevents execution errors.

Rule 3 (Native-First): Strictly prohibit the use of external libraries (like moment.js, lodash) if the task can be efficiently solved with standard language APIs (Native/Stdlib).

Rule 4 (Context Alignment): Analyze the [WORKSPACE MAP] and [EXISTING DEPENDENCIES]. Your [TARGET SPECIFICATIONS] MUST seamlessly align with the existing project structure. Do not suggest creating new files if appropriate files already exist. Do not prohibit external libraries if they are already listed in the [EXISTING DEPENDENCIES].

Location Rule: Always use the path specified in [CWD] as the root execution directory for reading, editing, or creating files. Do NOT use temporary or sandbox scratchpaths unless explicitly requested.${skillDirectiveStr}

Output Format:
Your output must strictly and exclusively follow this format (in English):

[CWD: ${currentCwd}]

<graviton_plan>: 1-2 sentences explaining the minimal, native-first technical approach.

[TARGET SPECIFICATIONS]: The highly precise, clarified task instructions.

[ERROR LOG]: (Only if present, heavily truncated to strictly show tracebacks).`;

  const wsMapStr = workspaceMap || buildWorkspaceMap(currentCwd);
  const userContent = `[CWD: ${currentCwd}]\n\n${wsMapStr}\n\n${cleanedText}`;

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: userContent }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Graviton Core Synthesizer request failed (${res.status})`);
  }

  const data = await res.json();
  const reprompted = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reprompted) throw new Error('No content returned from Graviton Core Synthesizer');

  const trimmed = reprompted.trim();
  return trimmed.startsWith('[CWD:') ? trimmed : `[CWD: ${currentCwd}]\n\n${trimmed}`;
}

/**
 * Local Deterministic Synthesizer (Graviton Core Offline Precision Synthesizer)
 * Emulates Rule 1 (Remove Fluff), Rule 2 (Smart Expansion), Rule 3 (Native-First), and exact format.
 */
export function repromptLocally(rawText, workspaceContext = null, unlockedSkills = [], workspaceMap = null) {
  const currentCwd = process.cwd();
  const wsMap = workspaceMap || buildWorkspaceMap(currentCwd);
  const codeBlocks = [];

  // 1. Extract code blocks
  let text = rawText.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    codeBlocks.push({ lang, code: code.trim() });
    return '';
  });
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)$/g, (match, lang, code) => {
    codeBlocks.push({ lang, code: code.trim() });
    return '';
  });

  // 2. Extract Error Traceback if present (heavily truncated to strictly show tracebacks)
  let errorSnippet = null;
  const errorMatch = text.match(/(?:(?:Type|Syntax|Reference|Range|URI)?Error:[^\n]+(?:\n\s+at\s+[^\n]+)+|\bException:[^\n]+(?:\n\s+at\s+[^\n]+)+|\bpanic:[^\n]+(?:\n\s+at\s+[^\n]+)+|\bFATAL:[^\n]+|error\[E\d+\]:[^\n]+(?:\n\s+-->\s+[^\n]+)+|AssertionError[^\n]+)/i);
  if (errorMatch) {
    const rawError = errorMatch[0].trim();
    const errLines = rawError.split('\n');
    const cleanErrLines = [errLines[0].trim()];
    for (let i = 1; i < errLines.length; i++) {
      const line = errLines[i].trim();
      if (!line.includes('node:internal') && !line.includes('node_modules')) {
        cleanErrLines.push('  ' + line);
      }
      if (cleanErrLines.length >= 3) break;
    }
    errorSnippet = cleanErrLines.join('\n');
    text = text.replace(errorMatch[0], '');
  }

  // 3. Rule 4 (Context Alignment) & Rule 3 (Native-First): Check for external library requests
  const depMatch = wsMap.match(/\[EXISTING DEPENDENCIES:\s*([^\]]*)\]/i);
  const existingDeps = depMatch && depMatch[1].trim() !== 'none'
    ? depMatch[1].split(',').map(d => d.trim().toLowerCase())
    : [];

  const externalLibRegex = /\b(?:install|pasang|tambah(?:kan)?|pakai|gunakan|pake|import|use|add)\s+(?:library\s+|package\s+|module\s+|modul\s+)?(moment(?:\.js)?|lodash|underscore|dayjs|date-fns|axios|tailwind(?:css)?|jquery|chalk|express|ws)\b/i;
  const libMatch = rawText.match(externalLibRegex);
  const requestedLib = libMatch ? libMatch[1].toLowerCase().replace(/\.js$/, '') : null;
  const isAlreadyInstalled = requestedLib && existingDeps.includes(requestedLib);
  const hasExternalLib = requestedLib && !isAlreadyInstalled;

  // 4. Rule 1 (Remove Fluff): Completely remove conversational fluff, emotions, and greetings
  const fluffPatterns = [
    /\b(?:halo|hai|hey|hi|hello|selamat\s+(?:pagi|siang|sore|malam)|good\s+(?:morning|afternoon|evening))\b/gi,
    /\b(?:antigravity|ai|gemini|assistant|bot)\b/gi,
    /\b(?:bro|kawan|gan|bang|mas|mbak|pak|bu|guys|there|teman|dude|mate)\b/gi,
    /\b(?:tolong(?:in)?|bantu(?:an)?|bantu\s+saya|mohon|please|help|could\s+you|can\s+you)\b/gi,
    /\b(?:pusing|bingung|mumet|capek|stress|curhat|kesel|error\s+terus|kenapa\s+ya|frustrated|stuck)\b/gi,
    /\b(?:terima\s+kasih(?:\s+banyak)?(?:\s+ya)?(?:\s+sebelumnya)?|makasih|thanks(?:\s+a\s+lot|\s+in\s+advance)?|thank\s+you)\b/gi,
    /\b(?:dong|deh|sih|nih|tuh|kan|lah|ya|kok|banget|bener|amat|sekali)\b/gi,
    /\b(?:saya\s+ingin|saya\s+mau|aku\s+mau|aku\s+ingin|mau|ingin|i\s+want\s+to|i\s+need\s+to|would\s+like\s+to)\b/gi,
    /\b(?:kodenya\s+(?:seperti\s+ini|adalah)|seperti\s+ini|begini(?:\s+kodenya)?|here\s+is\s+the\s+code)\b/gi
  ];

  for (const pat of fluffPatterns) {
    text = text.replace(pat, '');
  }

  if (hasExternalLib) {
    text = text.replace(externalLibRegex, '');
  }

  text = text.replace(/^[,\s.!?;:]+|[,\s.!?;:]+$/g, '').replace(/\s+/g, ' ').trim();

  // Extract file names (filtering out external library keywords)
  const fileNames = (rawText.match(/\b[\w./\\-]+\.(?:js|ts|jsx|tsx|py|rs|go|html|css|json|md|yaml|yml)\b/gi) || [])
    .filter(f => !/^(?:moment|lodash|underscore|dayjs|date-fns|axios|tailwind|jquery|chalk|express|ws)(?:\.js)?$/i.test(f));
  const uniqueFiles = Array.from(new Set(fileNames));

  // Context Alignment: match mentioned terms against workspace map files if none found explicitly
  if (uniqueFiles.length === 0) {
    const wsFiles = Array.from(wsMap.matchAll(/(?:├──|└──|\/)\s*([a-zA-Z0-9_.-]+\.[a-zA-Z0-9]+)/g)).map(m => m[1]);
    for (const f of wsFiles) {
      const baseNoExt = f.replace(/\.[^.]+$/, '').toLowerCase();
      if (baseNoExt.length > 2 && text.toLowerCase().includes(baseNoExt)) {
        uniqueFiles.push(f);
        break;
      }
    }
  }

  // 5. Rule 2 (Smart Expansion) & Rule 4 (Context Alignment): Clarify and expand technical specifications
  let targetSpecs = '';
  if (hasExternalLib) {
    targetSpecs = 'Strictly prohibit the use of external libraries. Solve the requirement natively using standard runtime APIs.';
    if (text) {
      targetSpecs += ' ' + text.charAt(0).toUpperCase() + text.slice(1) + '.';
    }
    targetSpecs += ' Enforce native language features, robust input validation, and zero external dependency footprint.';
  } else if (isAlreadyInstalled) {
    targetSpecs = `Utilize the existing '${requestedLib}' dependency configured in project dependencies.`;
    if (text) {
      targetSpecs += ' ' + text.charAt(0).toUpperCase() + text.slice(1) + '.';
    }
    targetSpecs += ' Seamlessly align with existing workspace architecture and conventions.';
  } else if (text) {
    let cleanText = text.replace(/^memperbaiki\b/i, 'Fix')
                        .replace(/^membuat(?:kan)?\b/i, 'Implement')
                        .replace(/^menambahkan\b/i, 'Add')
                        .replace(/^mengubah\b/i, 'Refactor')
                        .replace(/^perbaiki\b/i, 'Fix')
                        .replace(/^buat\b/i, 'Implement');
    targetSpecs = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
    if (!targetSpecs.endsWith('.')) targetSpecs += '.';
    
    // Smart expansion: append necessary precision constraints if ambiguous
    if (errorSnippet || /fix|perbaiki|error|bug/i.test(targetSpecs)) {
      targetSpecs += ' Ensure defensive null-checks, proper error handling, and robust edge-case validation.';
    } else {
      targetSpecs += ' Follow standard language idioms, modular structure, and prevent runtime regressions.';
    }
  } else if (uniqueFiles.length > 0) {
    targetSpecs = `Refactor and resolve code in ${uniqueFiles.join(', ')}. Ensure strict type safety, input validation, and defensive error handling.`;
  } else {
    targetSpecs = 'Resolve technical task natively with strict error handling and input validation.';
  }

  if (uniqueFiles.length > 0 && !targetSpecs.includes(uniqueFiles[0])) {
    targetSpecs += ` Target file(s): ${uniqueFiles.join(', ')}.`;
  }

  if (codeBlocks.length > 0) {
    const formattedCode = codeBlocks.map(cb => '```' + (cb.lang || '') + '\n' + cb.code + '\n```').join('\n\n');
    targetSpecs += '\n\nRelated Code:\n' + formattedCode;
  }

  // 6. Plan Statement (1-2 sentences explaining minimal native-first technical approach)
  let planText = '';
  if (hasExternalLib) {
    planText = 'Implement the solution exclusively with standard runtime APIs, avoiding third-party packages. Execute minimal, targeted changes with strict error handling.';
  } else if (isAlreadyInstalled) {
    planText = `Leverage existing project dependency '${requestedLib}' aligned with the current workspace architecture without adding redundant packages.`;
  } else if (errorSnippet) {
    planText = 'Isolate and resolve the root cause of the error traceback using native language facilities. Apply defensive guard clauses to ensure edge-case stability.';
  } else {
    planText = 'Execute the requested specifications using native standard APIs with minimal structural changes. Validate inputs and handle edge cases cleanly.';
  }

  // 7. Assemble standardized Graviton Core format
  const lines = [
    `[CWD: ${currentCwd}]`,
    '',
    `<graviton_plan>: ${planText}`,
    '',
    `[TARGET SPECIFICATIONS]: ${targetSpecs}`
  ];

  if (errorSnippet) {
    lines.push('');
    lines.push('[ERROR LOG]:');
    lines.push('```\n' + errorSnippet + '\n```');
  }

  return lines.join('\n').trim();
}

/**
 * Main Synthesizer Orchestrator
 */
export async function synthesizePrompt(rawText, apiKey, options = {}) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      originalText: '',
      optimizedText: '',
      workspaceMap: '',
      stats: { originalTokens: 0, optimizedTokens: 0, tokensSaved: 0, percentSaved: 0, engine: 'None' }
    };
  }

  const currentCwd = options.cwd || process.cwd();
  const workspaceMap = options.workspaceMap || buildWorkspaceMap(currentCwd);
  const workspaceContext = options.workspaceContext || detectWorkspaceContext(currentCwd);
  const builtInSkills = resolveSkillDirectives(rawText);
  const vaultSkills = loadLocalSkillVault(rawText);
  const allSkills = [...builtInSkills, ...vaultSkills];

  const originalTokens = estimateTokens(rawText);
  const stage1Text = pruneNoise(rawText);

  let optimizedText = '';
  let engineUsed = 'Graviton Core Synthesizer (Local)';

  if (apiKey) {
    try {
      optimizedText = await repromptWithAI(stage1Text, apiKey, allSkills, workspaceMap);
      engineUsed = 'Graviton Core Synthesizer (Gemini)';
    } catch (e) {
      optimizedText = repromptLocally(stage1Text, workspaceContext, allSkills, workspaceMap);
      engineUsed = 'Graviton Core Synthesizer (Local Fallback)';
    }
  } else {
    optimizedText = repromptLocally(stage1Text, workspaceContext, allSkills, workspaceMap);
  }

  // Ensure [CWD: ...] is at the very top
  if (!optimizedText.startsWith('[CWD:')) {
    optimizedText = `[CWD: ${currentCwd}]\n\n` + optimizedText.trim();
  }

  const optimizedTokens = estimateTokens(optimizedText);
  const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
  const percentSaved = originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0;

  return {
    originalText: rawText,
    optimizedText,
    workspaceMap,
    stats: {
      originalTokens,
      optimizedTokens,
      tokensSaved,
      percentSaved,
      engine: engineUsed,
      unlockedSkills: allSkills.map(s => s.skill)
    }
  };
}
