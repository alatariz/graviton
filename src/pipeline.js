// src/pipeline.js - Graviton Meta 2026: Unified 4-Pillar Compression Engine
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
 * Headroom Heuristic: Compresses oversized JSON arrays (> 3 elements)
 * Replaces middle section with string `[... HEADROOM COMPRESSION: X items truncated ...]`,
 * preserving only the first and last elements.
 */
export function compressHeadroomJson(text) {
  if (!text || typeof text !== 'string') return text;

  function compressArray(arr, depth = 0) {
    if (!Array.isArray(arr)) return arr;
    if (arr.length > 3) {
      const truncatedCount = arr.length - 2;
      const first = compressValue(arr[0], depth + 1);
      const last = compressValue(arr[arr.length - 1], depth + 1);
      return [
        first,
        `[... HEADROOM COMPRESSION: ${truncatedCount} items truncated ...]`,
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
 * RTK & Headroom Noise Pruner
 * Pure heuristic & regex string filter executed BEFORE text reaches the AI Synthesizer.
 * Enforces:
 * - [HEADROOM LOGIC]: JSON array compression (> 3 elements) to first and last items.
 * - [RTK LOGIC]: Detection & destruction of terminal noise (npm WARN, npm notice, info, Downloaded, Compiling, Building).
 * - [RTK LOGIC]: Exclusive preservation of critical error lines (TypeError, ReferenceError, Exception, panic, FATAL, at stack trace).
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

  // 3. [HEADROOM LOGIC] Compress oversized JSON arrays (> 3 elements)
  out = compressHeadroomJson(out);

  // 4. [RTK LOGIC] Terminal Log Filter
  // Exclusively preserve: TypeError, ReferenceError, Exception, panic, FATAL, or at  (stack trace)
  const RTK_EXCLUSIVE_ERROR_REGEX = /(?:TypeError|ReferenceError|Exception|panic|FATAL|^\s*at\s+|\bat\s+(?:[A-Za-z0-9_$.<>]+\s+)?\([^)]+:\d+:\d+\))/i;

  // Detect and destroy: npm WARN, npm notice, info, Downloaded, Compiling, Building, plus spinners/progress bars
  const RTK_NOISE_REGEX = (
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
    if (RTK_EXCLUSIVE_ERROR_REGEX.test(trimmed)) {
      filteredLines.push(line);
      continue;
    }

    // 2. Detect and destroy noise lines
    if (RTK_NOISE_REGEX.test(trimmed) || PROGRESS_NOISE_REGEX.test(trimmed)) {
      // Completely destroyed / dropped
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
        'modern-web.md': `# Modern Web Guidance
Keywords: web, modal, css, html, dialog, responsive, animation
Directive: Enforce native <dialog>, CSS container queries, :has selectors, view transitions, and zero-layout-shift practices.`,
        'bigquery.md': `# BigQuery SQL Optimization
Keywords: bigquery, sql, etl, partition, cluster, dataset, table
Directive: Enforce partitioning, clustering, avoided SELECT *, and idempotent MERGE mutations.`,
        'antigravity-overclock.md': `# Antigravity Overclocking Directive
Keywords: overclock, performance, leak, background, relay, signal
Directive: Enforce zero memory leaks, signal forwarding, and autonomous task execution with Auto-Allow.`
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
 * Unified Meta 2026 Engine: Single solid system prompt uniting all 4 pillars
 * - [CAVEMAN]: "Why use many token when few do trick." Buang basa-basi, pertahankan kode/path/error secara absolut.
 * - [PONYTAIL]: Wajib buka <scratchpad> untuk memvalidasi 7 anak tangga efisiensi:
 *   (YAGNI, Reuse, Stdlib, Native, Dependency, One-liner, Minimum that works).
 * - [HEADROOM]: Tambahkan direktif "Be terse, don't restate context, and minimize output tokens." di akhir instruksi.
 */
export async function repromptWithAI(cleanedText, apiKey, unlockedSkills = []) {
  const currentCwd = process.cwd();
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const skillDirectiveStr = unlockedSkills.length > 0
    ? `\nDirective Skills tambahan (eksekusi secara native):\n` + unlockedSkills.map(s => `- [${s.skill}] ${s.directive}`).join('\n')
    : '';

  const systemInstruction = `[RUTHLESS CAVEMAN]: Kamu adalah Text Parser yang kejam. Tugasmu adalah MENGHAPUS TOTAL semua basa-basi manusia (contoh: 'Halo', 'tolong', 'bro', 'pusing', 'terima kasih'). JANGAN pernah memasukkan kata-kata emosional ke dalam output spesifikasi. Ekstrak HANYA instruksi teknis murni, nama file, dan pesan error/traceback.

Aturan Lokasi: Selalu gunakan path dari [CWD] sebagai direktori utama untuk membuat, mengedit, atau membaca file. DILARANG menggunakan direktori scratch/sandbox bawaan kecuali diminta.

[PONYTAIL ENFORCER]: Jika user meminta untuk menginstal library eksternal (seperti moment.js, lodash, tailwind) untuk tugas yang BISA diselesaikan dengan fungsi bawaan (Native/Stdlib), kamu WAJIB MENGUBAH perintah user tersebut. Ganti kalimatnya menjadi: 'DILARANG menggunakan library eksternal. Selesaikan secara native.' Paksa Antigravity untuk menjadi pemalas yang efisien.${skillDirectiveStr}

[FORMAT OUTPUT]:
Output reprompt HANYA boleh berisi:
[CWD: ${currentCwd}]
<scratchpad> (Berisi pemaksaan 7 aturan Ponytail)
Task: (Sangat singkat, padat, tanpa bahasa gaul/curhat)
Error Log: (Jika ada)

Format output persis:
[CWD: ${currentCwd}]

<scratchpad>
[Ponytail: 7 Staircases of Efficiency]
1. YAGNI: Hapus spekulasi/fitur tak perlu, fokus hanya pada inti masalah.
2. Reuse: Manfaatkan kode/struktur yang ada di direktori kerja.
3. Stdlib: Utamakan fungsi bawaan runtime/standar daripada library eksternal.
4. Native: Gunakan fitur bahasa/platform native yang paling ringkas.
5. Dependency: DILARANG menggunakan library eksternal jika bisa native. Selesaikan secara native.
6. One-liner: Sederhanakan implementasi sesingkat dan seefisien mungkin.
7. Minimum that works: Tentukan intervensi teknis paling minimal yang menyelesaikan tugas.
</scratchpad>

Task:
[Instruksi teknis murni, sangat singkat, padat, tanpa bahasa gaul/curhat/basa-basi. Sebutkan nama file dan kode esensial jika ada.]

Error Log:
[Pesan error/traceback jika ada dalam input. Jika TIDAK ada error pada input user, bagian Error Log ini WAJIB DIHAPUS dan TIDAK BOLEH DITULIS.]`;

  const userContent = `[CWD: ${currentCwd}]\n\n${cleanedText}`;

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
    throw new Error(err.error?.message || `Gemini Unified Engine request failed (${res.status})`);
  }

  const data = await res.json();
  const reprompted = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reprompted) throw new Error('No content returned from Gemini Unified Engine');

  const trimmed = reprompted.trim();
  return trimmed.startsWith('[CWD:') ? trimmed : `[CWD: ${currentCwd}]\n\n${trimmed}`;
}

/**
 * Local Deterministic Synthesizer (Zero-cost offline Unified Meta 2026 Engine)
 * Emulates [RUTHLESS CAVEMAN], [PONYTAIL ENFORCER], and strict [FORMAT OUTPUT].
 */
export function repromptLocally(rawText, workspaceContext = null, unlockedSkills = []) {
  const currentCwd = process.cwd();
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

  // 2. Extract Error Traceback if present
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

  // 3. [PONYTAIL ENFORCER] Check for external library requests (moment, lodash, tailwind, etc.)
  const externalLibRegex = /\b(?:install|pasang|tambah(?:kan)?|pakai|gunakan|pake|import)\s+(?:library\s+|package\s+|modul\s+)?(moment(?:\.js)?|lodash|underscore|dayjs|date-fns|axios|tailwind(?:css)?|jquery|chalk)\b/i;
  const hasExternalLib = externalLibRegex.test(rawText);

  // 4. [RUTHLESS CAVEMAN] Ruthlessly strip all fluff, emotions, greetings, and boilerplate
  const fluffPatterns = [
    /\b(?:halo|hai|hey|hi|hello|selamat\s+(?:pagi|siang|sore|malam)|good\s+(?:morning|afternoon|evening))\b/gi,
    /\b(?:antigravity|ai|gemini|assistant|bot)\b/gi,
    /\b(?:bro|kawan|gan|bang|mas|mbak|pak|bu|guys|there|teman)\b/gi,
    /\b(?:tolong(?:in)?|bantu(?:an)?|bantu\s+saya|mohon|please|help)\b/gi,
    /\b(?:pusing|bingung|mumet|capek|stress|curhat|kesel|error\s+terus|kenapa\s+ya)\b/gi,
    /\b(?:terima\s+kasih(?:\s+banyak)?(?:\s+ya)?(?:\s+sebelumnya)?|makasih|thanks(?:\s+a\s+lot|\s+in\s+advance)?)\b/gi,
    /\b(?:dong|deh|sih|nih|tuh|kan|lah|ya|kok|banget|bener|amat|sekali)\b/gi,
    /\b(?:saya\s+ingin|saya\s+mau|aku\s+mau|aku\s+ingin|mau|ingin)\b/gi,
    /\b(?:kodenya\s+(?:seperti\s+ini|adalah)|seperti\s+ini|begini(?:\s+kodenya)?)\b/gi
  ];

  for (const pat of fluffPatterns) {
    text = text.replace(pat, '');
  }

  // If external lib was requested, remove the library call phrase
  if (hasExternalLib) {
    text = text.replace(externalLibRegex, '');
  }

  // Clean leading/trailing punctuation and whitespace
  text = text.replace(/^[,\s.!?;:]+|[,\s.!?;:]+$/g, '').replace(/\s+/g, ' ').trim();

  // Extract file names if any (filtering out any external library names)
  const fileNames = (rawText.match(/\b[\w./\\-]+\.(?:js|ts|jsx|tsx|py|rs|go|html|css|json|md|yaml|yml)\b/gi) || [])
    .filter(f => !/^(?:moment|lodash|underscore|dayjs|date-fns|axios|tailwind|jquery|chalk)(?:\.js)?$/i.test(f));
  const uniqueFiles = Array.from(new Set(fileNames));

  // Build clean task statement
  let taskInstruction = '';
  if (hasExternalLib) {
    taskInstruction = 'DILARANG menggunakan library eksternal. Selesaikan secara native.';
    if (text) {
      taskInstruction += ' ' + text.charAt(0).toUpperCase() + text.slice(1);
    }
  } else if (text) {
    let cleanedClean = text.replace(/^memperbaiki\b/i, 'Perbaiki')
                          .replace(/^membuat(?:kan)?\b/i, 'Buat')
                          .replace(/^menambahkan\b/i, 'Tambahkan')
                          .replace(/^mengubah\b/i, 'Ubah');
    taskInstruction = cleanedClean.charAt(0).toUpperCase() + cleanedClean.slice(1);
  } else if (uniqueFiles.length > 0) {
    taskInstruction = `Perbaiki dan selesaikan kode pada ${uniqueFiles.join(', ')}.`;
  } else {
    taskInstruction = 'Perbaiki kode dan selesaikan secara native.';
  }

  taskInstruction = taskInstruction.replace(/[,\s;:.]*$/, '.').trim();

  if (uniqueFiles.length > 0 && !taskInstruction.includes(uniqueFiles[0])) {
    taskInstruction += ` Target file: ${uniqueFiles.join(', ')}.`;
  }

  if (codeBlocks.length > 0) {
    const formattedCode = codeBlocks.map(cb => '```' + (cb.lang || '') + '\n' + cb.code + '\n```').join('\n\n');
    taskInstruction += '\n\nKode Terkait:\n' + formattedCode;
  }

  // 5. Construct final output strictly according to [FORMAT OUTPUT]
  const lines = [
    `[CWD: ${currentCwd}]`,
    '',
    `<scratchpad>`,
    `[Ponytail: 7 Staircases of Efficiency]`,
    `1. YAGNI: Hapus spekulasi/fitur tak perlu, fokus hanya pada inti masalah.`,
    `2. Reuse: Manfaatkan kode/struktur yang ada di direktori kerja.`,
    `3. Stdlib: Utamakan fungsi bawaan runtime/standar daripada library eksternal.`,
    `4. Native: Gunakan fitur bahasa/platform native yang paling ringkas.`,
    `5. Dependency: ${hasExternalLib ? 'DILARANG menggunakan library eksternal. Selesaikan secara native.' : 'DILARANG menambah dependensi baru jika bisa native.'}`,
    `6. One-liner: Sederhanakan implementasi sesingkat dan seefisien mungkin.`,
    `7. Minimum that works: Tentukan intervensi teknis paling minimal yang menyelesaikan tugas.`,
    `</scratchpad>`,
    '',
    `Task:`,
    taskInstruction
  ];

  if (errorSnippet) {
    lines.push('');
    lines.push('Error Log:');
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
      stats: { originalTokens: 0, optimizedTokens: 0, tokensSaved: 0, percentSaved: 0, engine: 'None' }
    };
  }

  const workspaceContext = options.workspaceContext || detectWorkspaceContext();
  const builtInSkills = resolveSkillDirectives(rawText);
  const vaultSkills = loadLocalSkillVault(rawText);
  const allSkills = [...builtInSkills, ...vaultSkills];

  const originalTokens = estimateTokens(rawText);
  const stage1Text = pruneNoise(rawText);

  let optimizedText = '';
  let engineUsed = 'Unified Meta 2026 Engine (Local)';

  if (apiKey) {
    try {
      optimizedText = await repromptWithAI(stage1Text, apiKey, allSkills);
      engineUsed = 'Unified Meta 2026 Engine (Gemini)';
    } catch (e) {
      optimizedText = repromptLocally(stage1Text, workspaceContext, allSkills);
      engineUsed = 'Unified Meta 2026 Engine (Local Fallback)';
    }
  } else {
    optimizedText = repromptLocally(stage1Text, workspaceContext, allSkills);
  }

  // Ensure [CWD: ...] is at the very top and output strictly complies with [FORMAT OUTPUT]
  const currentCwd = process.cwd();
  if (!optimizedText.startsWith('[CWD:')) {
    optimizedText = `[CWD: ${currentCwd}]\n\n` + optimizedText.trim();
  }

  const optimizedTokens = estimateTokens(optimizedText);
  const tokensSaved = Math.max(0, originalTokens - optimizedTokens);
  const percentSaved = originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 100) : 0;

  return {
    originalText: rawText,
    optimizedText,
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
