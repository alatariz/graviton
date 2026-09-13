// src/pipeline.js - Graviton: Precision Prompt Synthesizer & Antigravity Skill Unlocker
import { redactSecrets, detectWorkspaceContext } from './workspace-helper.js';
import { resolveSkillDirectives } from './skill-matrix.js';

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

  // 3. Deduplicate repetitive log lines
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

  // 4. Remove cosmetic separators
  out = out.replace(/^[ \t]*(?:\/\/|#|\/\*)[ \t]*[-=~*#]{5,}[ \t]*(?:\*\/)?$/gm, '');

  // 5. Strip trailing AI disclaimers
  const trailingFluff = [
    /(?:Hope\s+this\s+helps!?(?:\s+Let\s+me\s+know\s+if\s+you\s+need\s+anything\s+else\.?)?)\s*$/gi,
    /(?:Please\s+let\s+me\s+know\s+if\s+you\s+have\s+any\s+(?:other\s+)?questions(?:\s+or\s+need\s+further\s+assistance)?\.?)\s*$/gi,
    /(?:Feel\s+free\s+to\s+ask\s+if\s+you\s+have\s+any\s+(?:more\s+)?questions\.?)\s*$/gi,
    /(?:Semoga\s+(?:ini\s+)?membantu!?(?:\s+Beri\s+tahu\s+saya\s+jika\s+ada\s+pertanyaan\.?)?)\s*$/gi
  ];
  for (const pat of trailingFluff) {
    out = out.replace(pat, '');
  }

  return out.trim();
}

/**
 * Lean Model Semantic Synthesizer
 */
export async function repromptWithAI(cleanedText, apiKey, unlockedSkills = []) {
  const model = 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const skillDirectiveStr = unlockedSkills.length > 0
    ? `\nSuntikkan directive untuk Antigravity Skills berikut jika relevan:\n` + unlockedSkills.map(s => `- [Skill: ${s.skill}] ${s.directive}`).join('\n')
    : '';

  const systemInstruction = `Kamu adalah Graviton: Precision Prompt Synthesizer khusus untuk coding agent Antigravity.
Tugasmu: Ambil pesan mentah/curhat/log error dari developer, lalu TULIS ULANG (REPROMPT) menjadi instruksi koding yang SANGAT PRESISI, TO-THE-POINT, dan TERSTRUKTUR RAPI untuk dieksekusi Antigravity.

Panduan Penulisan Ulang:
1. Buang total salam pembuka ("Halo", "Selamat pagi"), basa-basi, dan ucapan terima kasih/penutup.
2. Buang spam log terminal, pertahankan hanya inti pesan error dan baris kode penyebabnya.
3. Kunci dan pertahankan 100% blok kode asli dan path file asli tanpa diubah satu huruf pun.${skillDirectiveStr}
4. Format output dalam markdown rapi:
   - **Tujuan Utama:** (Tegas dan to-the-point)
   - **Kode Terkait:** (jika ada kode, sertakan blok markdown asli)
   - **Error yang Terjadi:** (jika ada error, sertakan cuplikan error bersih)
   - **Spesifikasi Perbaikan:** (poin-poin konkret yang harus dikerjakan)
5. Dilarang memberikan teks pembuka atau penutup apa pun. Langsung berikan hasil akhirnya.`;

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: [{ text: cleanedText }] }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 2048 }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Gemini Flash API request failed');
  }

  const data = await res.json();
  const reprompted = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reprompted) throw new Error('No reprompt text returned from Gemini Flash');
  return reprompted.trim();
}

/**
 * Local Deterministic Synthesizer
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

  const parts = [];
  if (taskPoints.length === 1) {
    parts.push(`**Tujuan Utama:**\n${taskPoints[0]}.`);
  } else if (taskPoints.length > 1) {
    parts.push(`**Tujuan Utama & Spesifikasi:**\n` + taskPoints.map(t => `- ${t}.`).join('\n'));
  } else if (text.trim()) {
    parts.push(`**Tujuan Utama:**\n${text.trim()}`);
  }

  if (codeBlocks.length > 0) {
    const formattedCode = codeBlocks.map(cb => '```' + (cb.lang || '') + '\n' + cb.code + '\n```').join('\n\n');
    parts.push(`**Kode Terkait:**\n${formattedCode}`);
  }

  if (errorSnippet) {
    parts.push(`**Error yang Terjadi:**\n\`\`\`\n${errorSnippet}\n\`\`\``);
  }

  return parts.join('\n\n').trim();
}

export async function synthesizePrompt(rawText, apiKey, options = {}) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      originalText: '',
      optimizedText: '',
      stats: { originalTokens: 0, optimizedTokens: 0, tokensSaved: 0, percentSaved: 0, engine: 'None' }
    };
  }

  const workspaceContext = options.workspaceContext || detectWorkspaceContext();
  const unlockedSkills = resolveSkillDirectives(rawText);
  const originalTokens = estimateTokens(rawText);
  const stage1Text = pruneNoise(rawText);

  let optimizedText = '';
  let engineUsed = 'Local Lean Engine';

  if (apiKey) {
    try {
      optimizedText = await repromptWithAI(stage1Text, apiKey, unlockedSkills);
      engineUsed = 'Gemini 2.5 Flash (Lean AI Tier)';
    } catch (e) {
      optimizedText = repromptLocally(stage1Text, workspaceContext, unlockedSkills);
      engineUsed = 'Local Engine (AI Fallback)';
    }
  } else {
    optimizedText = repromptLocally(stage1Text, workspaceContext, unlockedSkills);
    engineUsed = 'Local Zero-Cost Engine';
  }

  // Inject Skill unlocks & Workspace context
  const headers = [];
  if (workspaceContext && workspaceContext.mainFiles && workspaceContext.mainFiles.length > 0) {
    headers.push(`[Workspace: ${workspaceContext.type} @ ${workspaceContext.cwd}]`);
  }
  if (unlockedSkills.length > 0) {
    const skillList = unlockedSkills.map(s => s.skill).join(', ');
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
      unlockedSkills: unlockedSkills.map(s => s.skill)
    }
  };
}
