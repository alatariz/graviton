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
 * Headroom Heuristic: Compresses oversized JSON arrays into schema summaries
 */
export function compressHeadroomJson(text) {
  if (!text || typeof text !== 'string') return text;

  function compressValue(val, depth = 0) {
    if (depth > 4) return val;
    if (Array.isArray(val)) {
      if (val.length > 3) {
        const sample = val.slice(0, 2).map(item => compressValue(item, depth + 1));
        const omittedCount = val.length - 2;
        const first = val[0];
        const keys = first && typeof first === 'object' && !Array.isArray(first)
          ? Object.keys(first).join(', ')
          : typeof first;
        sample.push(`... Headroom compressed: [${omittedCount} items omitted | schema: { ${keys} }] ...`);
        return sample;
      }
      return val.map(item => compressValue(item, depth + 1));
    }
    if (val && typeof val === 'object') {
      const res = {};
      for (const [k, v] of Object.entries(val)) {
        res[k] = compressValue(v, depth + 1);
      }
      return res;
    }
    return val;
  }

  // Check if text is a single JSON payload
  const trimmed = text.trim();
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(compressValue(parsed), null, 2);
    } catch {
      // Fall through to regex replacement if not strict single JSON
    }
  }

  // Regex-based embedded JSON array detector
  return text.replace(/\[\s*\{[\s\S]*?\}\s*\]/g, (match) => {
    if (match.length < 200) return match;
    try {
      const parsed = JSON.parse(match);
      if (Array.isArray(parsed) && parsed.length > 3) {
        return JSON.stringify(compressValue(parsed), null, 2);
      }
    } catch {}
    return match;
  });
}

/**
 * RTK & Headroom Noise Pruner
 * Intercepts terminal chatter, removes progress lines, isolates tracebacks, and applies Headroom heuristics.
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

  // 3. Headroom heuristic: compress oversized JSON arrays
  out = compressHeadroomJson(out);

  // 4. RTK Terminal Log Filter: strip progress chatter, keep error & warning tracebacks
  const rawLines = out.split('\n');
  const filteredLines = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      filteredLines.push(line);
      continue;
    }

    // Always preserve error, warning, traceback, and file coordinate lines
    const isErrorOrTrace = /(?:error|exception|fail|fatal|panic|traceback|warning|stack|\bat\s+|\.js:\d+|\.ts:\d+|\.py:\d+|\.rs:\d+|-->\s*|AssertionError)/i.test(trimmed);
    if (isErrorOrTrace) {
      filteredLines.push(line);
      continue;
    }

    // Discard progress bars, spinners, package manager chatter
    const isProgressNoise = (
      /^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/.test(trimmed) ||
      /(?:\[[=> -]{5,}\]|\b\d+(?:\.\d+)?%\s*(?:done|complete)?|\b\d+\/\d+\s+(?:packages|files|crates))/i.test(trimmed) ||
      /(?:npm|yarn|pnpm)\s+(?:verb|timing|sill|http\s+fetch)/i.test(trimmed) ||
      /(?:^Compiling\s+[a-zA-Z0-9_-]+\s+v\d+)/i.test(trimmed) ||
      /(?:Downloading|Fetching|Extracting)\s+https?:/i.test(trimmed)
    );

    if (!isProgressNoise) {
      filteredLines.push(line);
    }
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
    ? `\nSuntikkan directive Antigravity Skills berikut:\n` + unlockedSkills.map(s => `- [${s.skill}] ${s.directive}`).join('\n')
    : '';

  const systemInstruction = `Kamu adalah Graviton Meta 2026 — Unified AI Acceleration & Token Optimization Engine.
Tugasmu: Melakukan kompresi dan re-sintesis prompt developer menjadi instruksi teknis bedah presisi tinggi dengan konsumsi token seminimal mungkin.

Aturan Lokasi: Selalu gunakan path dari [CWD] sebagai direktori utama untuk membuat, mengedit, atau membaca file. DILARANG menggunakan direktori scratch/sandbox bawaan kecuali diminta.

ATURAN 4 PILAR WAJIB (EXECUTE SIMULTANEOUSLY):
1. [PONYTAIL] — Buka tag <scratchpad> di awal output untuk memvalidasi 7 anak tangga efisiensi:
   1. YAGNI: Hapus spekulasi/fitur tak perlu, fokus hanya pada inti masalah.
   2. Reuse: Manfaatkan struktur kode/fungsi yang sudah ada.
   3. Stdlib: Utamakan built-in/standar runtime daripada kode kustom berbelit.
   4. Native: Gunakan fitur bahasa/platform native yang paling ringkas.
   5. Dependency: Hindari penambahan library/package eksternal baru.
   6. One-liner: Sederhanakan ekspresi jika memungkinkan tanpa mengurangi readability.
   7. Minimum that works: Tentukan intervensi teknis paling minimal yang langsung menyelesaikan tugas.

2. [CAVEMAN] — Di luar <scratchpad>, terapkan prinsip "Why use many token when few do trick":
   - Hapus semua salam pembuka, penutup, basa-basi, dan permohonan maaf.
   - Gunakan fragmen teknis super padat, tajam, dan langsung to-the-point.
   - Kunci 100% kode, file path, line numbers, dan traceback error asli secara absolut tanpa diubah atau dirangkum jika esensial.${skillDirectiveStr}

3. Format Output:
<scratchpad>
[Ponytail: 7 Staircases of Efficiency]
1. YAGNI: ...
2. Reuse: ...
3. Stdlib: ...
4. Native: ...
5. Dependency: ...
6. One-liner: ...
7. Minimum that works: ...
</scratchpad>

**Tujuan Utama:** [Fragmen teknis instruksi]
**Kode Terkait:** [Kode asli jika ada]
**Error Trace:** [Cuplikan traceback terisolasi jika ada]
**Spesifikasi Perbaikan:** [Poin-poin bedah minimal]

4. [HEADROOM] — Di akhir instruksi, selalu pastikan:
Be terse, don't restate context, and minimize output tokens.`;

  const userContent = `[CWD: ${currentCwd}]\n\n${cleanedText}`;

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: userContent }] }],
    generationConfig: { temperature: 0.15, maxOutputTokens: 2048 }
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
 * Emulates [PONYTAIL] 7-staircase validation, [CAVEMAN] zero-fluff extraction, and [HEADROOM] compactness.
 */
export function repromptLocally(rawText, workspaceContext = null, unlockedSkills = []) {
  const codeBlocks = [];

  let text = rawText.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    codeBlocks.push({ lang, code: code.trim() });
    return '';
  });
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)$/g, (match, lang, code) => {
    codeBlocks.push({ lang, code: code.trim() });
    return '';
  });

  // [CAVEMAN] Strip conversational noise
  text = text.replace(/^(?:halo|selamat\s+(?:pagi|siang|sore|malam)|hey|hi|good\s+(?:morning|afternoon|evening))\s*(?:antigravity|ai|gemini|kawan|bro|there)?[\s,!.-]*/gim, '');
  text = text.replace(/(?:terima\s+kasih(?:\s+banyak)?(?:\s+ya)?(?:\s+sebelumnya)?[\s,!.-]*)/gim, '');
  text = text.replace(/(?:thanks(?:\s+a\s+lot|\s+in\s+advance)?[\s,!.-]*)/gim, '');
  text = text.replace(/[,]?\s*(?:ya\s*|dong\s*|deh\s*)[.!?,]*$/gim, '');
  text = text.replace(/(?:saya\s+ingin\s+(?:kamu\s+|anda\s+)?(?:tolong\s+)?(?:bantu\s+saya\s+untuk\s+)?)/gim, '');
  text = text.replace(/(?:kodenya\s+(?:seperti\s+ini|adalah)[\s:]*)/gim, '');

  let errorSnippet = null;
  const errorMatch = text.match(/(?:(?:Type|Syntax|Reference|Range)?Error:[^\n]+(?:\n\s+at\s+[^\n]+)+)/);
  if (errorMatch) {
    const rawError = errorMatch[0];
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
    text = text.replace(rawError, '');
  }

  const rawSentences = text.split(/\n+|\.\s+/).map(s => s.trim()).filter(s => s.length > 5);
  const taskPoints = [];
  for (let s of rawSentences) {
    s = s.replace(/^[-,*•]\s*/, '').replace(/\?+$/, '');
    s = s.replace(/^memperbaiki\b/i, 'Perbaiki');
    s = s.replace(/^membuat(?:kan)?\b/i, 'Buat');
    s = s.replace(/^menambahkan\b/i, 'Tambahkan');
    s = s.replace(/^mengubah\b/i, 'Ubah');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!taskPoints.some(existing => existing.toLowerCase().includes(s.toLowerCase().slice(0, 20)))) {
      taskPoints.push(s);
    }
  }

  const targetTask = taskPoints[0] || text.trim() || 'Perbaikan kode dan optimasi';

  // [PONYTAIL] 7 Staircases of Efficiency
  const scratchpad = `<scratchpad>
[Ponytail: 7 Staircases of Efficiency]
1. YAGNI: Isolate core technical requirement: ${targetTask}.
2. Reuse: Leverage existing codebase patterns in ${workspaceContext?.type || 'active workspace'}.
3. Stdlib: Prefer standard runtime APIs and language built-ins.
4. Native: Utilize idiomatic native constructs without over-engineering.
5. Dependency: Zero extraneous external packages.
6. One-liner: Keep modifications atomic and concise.
7. Minimum that works: Surgical patch with zero regressions and zero layout shift.
</scratchpad>`;

  const body = [scratchpad];
  if (taskPoints.length === 1) {
    body.push(`**Tujuan Utama:**\n${taskPoints[0]}.`);
  } else if (taskPoints.length > 1) {
    body.push(`**Tujuan Utama & Spesifikasi:**\n` + taskPoints.map(t => `- ${t}.`).join('\n'));
  } else if (text.trim()) {
    body.push(`**Tujuan Utama:**\n${text.trim()}`);
  }

  if (codeBlocks.length > 0) {
    const formattedCode = codeBlocks.map(cb => '```' + (cb.lang || '') + '\n' + cb.code + '\n```').join('\n\n');
    body.push(`**Kode Terkait:**\n${formattedCode}`);
  }

  if (errorSnippet) {
    body.push('**Error Trace:**\n```\n' + errorSnippet + '\n```');
  }

  // [HEADROOM] Compactness directive
  body.push(`Be terse, don't restate context, and minimize output tokens.`);

  return body.join('\n\n').trim();
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

  // Inject CWD, Workspace context & Skill unlocks headers
  const currentCwd = process.cwd();
  const headers = [`[CWD: ${currentCwd}]`];
  if (workspaceContext && workspaceContext.mainFiles && workspaceContext.mainFiles.length > 0) {
    headers.push(`[Workspace: ${workspaceContext.type} @ ${workspaceContext.cwd}]`);
  }
  if (allSkills.length > 0) {
    const skillList = allSkills.map(s => s.skill).join(', ');
    headers.push(`[Antigravity Skill Activated: ${skillList}]`);
  }

  // Remove any redundant [CWD: ...] from beginning of optimizedText to prevent duplicates
  optimizedText = optimizedText.replace(/^\[CWD:[^\]]+\]\s*/i, '').trim();

  if (headers.length > 0) {
    optimizedText = headers.join('\n') + '\n\n' + optimizedText;
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
