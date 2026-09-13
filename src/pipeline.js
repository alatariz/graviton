// src/pipeline.js - Graviton Meta 2026: 4-Pillar Compression & Dual-Clutch Engine
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
 * Gigi 1: Gemini 3.8 Flash - The Sanitizer (Default)
 * Operates under [CAVEMAN] (zero pleasantries, technical fragments) and [PONYTAIL] (7 staircases of laziness in <scratchpad>).
 */
export async function repromptWithFlashSanitizer(cleanedText, apiKey, unlockedSkills = []) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const skillDirectiveStr = unlockedSkills.length > 0
    ? `\nSuntikkan directive Antigravity Skills berikut:\n` + unlockedSkills.map(s => `- [${s.skill}] ${s.directive}`).join('\n')
    : '';

  const systemInstruction = `Kamu adalah Graviton Meta 2026 — Dual-Clutch Engine [Gear 1: Gemini 3.8 Flash - The Sanitizer].
Tugasmu: Pembersihan kilat bug, log, dan prompt developer dengan kecepatan tertinggi dan konsumsi token paling minimal.

PROTOKOL WAJIB:
1. [PONYTAIL] — Di dalam tag <scratchpad>, jalankan 7 anak tangga kemalasan (The 7 Staircases of Laziness):
   1. Root Cause Isolation
   2. Fluff & Boilerplate Elimination
   3. Exact Error Signature & Traceback Pinpointing
   4. File Path & Line Coordinate Matching
   5. Minimal Surgery Plan (perubahan sesedikit mungkin)
   6. Zero Regressions & Layout Shift Protection
   7. Compactness & Token Budget Verification
2. [CAVEMAN] — Di luar <scratchpad>, gunakan gaya komunikasi CAVEMAN:
   - Tanpa salam, tanpa basa-basi, tanpa sopan santun.
   - Gunakan fragmen teknis padat, to-the-point, dan tajam.
   - Kunci 100% kode dan error asli tanpa modifikasi tak perlu.${skillDirectiveStr}
   - Format:
     <scratchpad>
     [7 Staircases Analysis...]
     </scratchpad>
     **Tujuan Utama:** [fragmen teknis ringkas]
     **Kode Terkait:** [kode asli jika ada]
     **Error Trace:** [cuplikan error terisolasi jika ada]
     **Spesifikasi Perbaikan:** [poin-poin bedah minimal]`;

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: cleanedText }] }],
    generationConfig: { temperature: 0.15, maxOutputTokens: 2048 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini Flash 3.8 request failed (${res.status})`);
  }

  const data = await res.json();
  const reprompted = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reprompted) throw new Error('No content returned from Gemini Flash 3.8');
  return reprompted.trim();
}

/**
 * Gigi 2: Gemini 3.1 Pro - The Architect (Triggered by --deep)
 * Performs deep architectural dissection with Step-by-Step planning in <scratchpad> before scaffold code.
 */
export async function repromptWithProArchitect(cleanedText, apiKey, unlockedSkills = []) {
  const model = 'gemini-2.5-pro';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const skillDirectiveStr = unlockedSkills.length > 0
    ? `\nSuntikkan directive arsitektur berikut:\n` + unlockedSkills.map(s => `- [${s.skill}] ${s.directive}`).join('\n')
    : '';

  const systemInstruction = `Kamu adalah Graviton Meta 2026 — Dual-Clutch Engine [Gear 2: Gemini 3.1 Pro - The Architect].
Tugasmu: Bedah arsitektur sistem tingkat lanjut untuk instruksi koding kompleks yang membutuhkan perancangan modular mendalam.

PROTOKOL WAJIB:
1. Di dalam tag <scratchpad>, buat perencanaan implementasi arsitektur komprehensif:
   - System Decomposition & Data Flow Analysis
   - Step 1: Core Foundation & Data Contracts
   - Step 2: Service Layer & Business Logic Orchestration
   - Step 3: Edge Cases, Signal Handling & Security
   - Step 4: Verification, Boundary Validation & Zero-Downtime Migration
2. Di luar <scratchpad>, berikan cetak biru arsitektur tingkat tinggi beserta kerangka kode production-ready:${skillDirectiveStr}
   Format:
   <scratchpad>
   [Architectural Blueprint & Step-by-Step Breakdown...]
   </scratchpad>
   **Arsitektur & Spesifikasi Sistem:** [Rencana arsitektur modular terperinci]
   **Langkah Implementasi:** [Step 1, Step 2, Step 3 konkret]
   **Kerangka Kode Production-Ready:** [Interface, Types, Implementation Scaffolding]`;

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: cleanedText }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini Pro 3.1 request failed (${res.status})`);
  }

  const data = await res.json();
  const reprompted = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reprompted) throw new Error('No content returned from Gemini Pro 3.1');
  return reprompted.trim();
}

/**
 * Local Deterministic Synthesizer (Zero-cost offline engine)
 */
export function repromptLocally(rawText, workspaceContext = null, unlockedSkills = [], options = {}) {
  const isDeep = Boolean(options.deep);
  const codeBlocks = [];

  let text = rawText.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    codeBlocks.push({ lang, code: code.trim() });
    return '';
  });
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)$/g, (match, lang, code) => {
    codeBlocks.push({ lang, code: code.trim() });
    return '';
  });

  // Strip conversational noise
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

  if (isDeep) {
    // Gear 2 Local Emulation: Pro 3.1 Architect
    const scratchpad = `<scratchpad>
[Architectural Breakdown]
Step 1: Parse requirements and isolate interface boundary for: ${taskPoints[0] || text.trim() || 'Core module'}.
Step 2: Define modular separation of concerns and robust type contracts.
Step 3: Guard edge cases, handle signal interrupts (SIGINT/SIGTERM), and prevent resource leaks.
Step 4: Execute structured implementation with zero regressions.
</scratchpad>`;

    const body = [
      scratchpad,
      `**Arsitektur & Spesifikasi Sistem:**\nImplementasikan perombakan arsitektur modular untuk ${taskPoints[0] || text.trim()}.`,
      `**Langkah Implementasi:**\n` + (taskPoints.length > 0 ? taskPoints.map((t, idx) => `Step ${idx + 1}: ${t}.`).join('\n') : 'Step 1: Implementasi logic inti.\nStep 2: Testing & verifikasi.')
    ];

    if (codeBlocks.length > 0) {
      const formattedCode = codeBlocks.map(cb => '```' + (cb.lang || '') + '\n' + cb.code + '\n```').join('\n\n');
      body.push(`**Kerangka Kode Production-Ready:**\n${formattedCode}`);
    }
    if (errorSnippet) {
      body.push('**Error Signature:**\n```\n' + errorSnippet + '\n```');
    }
    return body.join('\n\n').trim();
  } else {
    // Gear 1 Local Emulation: Flash 3.8 Sanitizer (Caveman + Ponytail)
    const scratchpad = `<scratchpad>
[Ponytail: 7 Staircases]
1. Root cause: ${taskPoints[0] || 'Direct code optimization'}
2. Fluff: stripped conversational greeting/boilerplate
3. Error: ${errorSnippet ? 'Isolated stack trace' : 'None detected'}
4. Target: ${workspaceContext?.type || 'Current workspace'}
5. Surgery plan: minimal atomic modification
6. Protection: zero layout shift & zero regressions
7. Token budget: compressed to essential technical fragments
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
      body.push('**Error yang Terjadi:**\n```\n' + errorSnippet + '\n```');
    }

    return body.join('\n\n').trim();
  }
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

  const isDeep = Boolean(options.deep);
  const workspaceContext = options.workspaceContext || detectWorkspaceContext();
  const builtInSkills = resolveSkillDirectives(rawText);
  const vaultSkills = loadLocalSkillVault(rawText);
  const allSkills = [...builtInSkills, ...vaultSkills];

  const originalTokens = estimateTokens(rawText);
  const stage1Text = pruneNoise(rawText);

  let optimizedText = '';
  let engineUsed = isDeep ? 'Pro 3.1 Architect (Local)' : 'Flash 3.8 Sanitizer (Local)';

  if (apiKey) {
    try {
      if (isDeep) {
        optimizedText = await repromptWithProArchitect(stage1Text, apiKey, allSkills);
        engineUsed = 'Gemini 3.1 Pro [Gear 2: Architect]';
      } else {
        optimizedText = await repromptWithFlashSanitizer(stage1Text, apiKey, allSkills);
        engineUsed = 'Gemini 3.8 Flash [Gear 1: Sanitizer]';
      }
    } catch (e) {
      optimizedText = repromptLocally(stage1Text, workspaceContext, allSkills, { deep: isDeep });
      engineUsed = isDeep ? 'Pro 3.1 Architect (Fallback)' : 'Flash 3.8 Sanitizer (Fallback)';
    }
  } else {
    optimizedText = repromptLocally(stage1Text, workspaceContext, allSkills, { deep: isDeep });
  }

  // Inject Skill unlocks & Workspace context
  const headers = [];
  if (workspaceContext && workspaceContext.mainFiles && workspaceContext.mainFiles.length > 0) {
    headers.push(`[Workspace: ${workspaceContext.type} @ ${workspaceContext.cwd}]`);
  }
  if (allSkills.length > 0) {
    const skillList = allSkills.map(s => s.skill).join(', ');
    headers.push(`[Antigravity Skill Activated: ${skillList}]`);
  }

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
