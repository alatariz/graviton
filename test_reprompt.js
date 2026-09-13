// test_reprompt.js - Refined Parser

function cleanAndFormatTask(text) {
  // 1. Remove greetings
  text = text.replace(/^(?:halo|selamat\s+(?:pagi|siang|sore|malam)|hey|hi|good\s+(?:morning|afternoon|evening))\b[^\n.!?]*[.!?,]?/gim, '');
  text = text.replace(/(?:hope\s+you\s+(?:are\s+doing\s+well|have\s+a\s+great\s+day)[^.!?\n]*[.!?]?)/gim, '');
  text = text.replace(/(?:semoga\s+harimu\s+menyenangkan[^.!?\n]*[.!?]?)/gim, '');

  // 2. Remove thanks & closings
  text = text.replace(/(?:terima\s+kasih\s+(?:banyak\s+)?(?:ya\s+)?(?:sebelumnya\s+ya|sebelumnya)?[^.!?\n]*[.!?]?)/gim, '');
  text = text.replace(/(?:thanks\s+(?:a\s+lot|in\s+advance)?[^.!?\n]*[.!?]?)/gim, '');
  text = text.replace(/(?:thank\s+you\s+(?:so\s+much|very\s+much)?(?:in\s+advance)?[^.!?\n]*[.!?]?)/gim, '');
  text = text.replace(/(?:let\s+me\s+know\s+if\s+you\s+have\s+any\s+questions[^.!?\n]*[.!?]?)/gim, '');

  // 3. Remove conversational filler phrases
  text = text.replace(/(?:saya\s+ingin\s+(?:kamu\s+|anda\s+)?(?:tolong\s+)?(?:bantu\s+saya\s+untuk\s+)?)/gim, '');
  text = text.replace(/(?:bisakah\s+(?:kamu\s+|anda\s+)?(?:tolong\s+)?)/gim, '');
  text = text.replace(/(?:could\s+you\s+(?:please\s+)?(?:kindly\s+)?(?:help\s+me\s+(?:to\s+)?)?)/gim, '');
  text = text.replace(/(?:can\s+you\s+(?:please\s+)?(?:kindly\s+)?(?:help\s+me\s+(?:to\s+)?)?)/gim, '');
  text = text.replace(/(?:tolong\s+(?:bantu\s+saya\s+untuk\s+)?)/gim, '');

  // 4. Remove meta narrative (like "Kodenya seperti ini:", "Saat saya jalankan ..., muncul error ...")
  text = text.replace(/(?:kodenya\s+(?:seperti\s+ini|adalah)[\s:]*)/gim, '');
  text = text.replace(/(?:here\s+is\s+the\s+code[\s:]*)/gim, '');
  text = text.replace(/(?:saat\s+saya\s+jalankan[^\n]+muncul\s+error[^\n]*)/gim, '');
  text = text.replace(/(?:when\s+i\s+run[^\n]+i\s+get[^\n]*error[^\n]*)/gim, '');

  return text.trim();
}

export function reprompt(rawText) {
  // 1. Extract and preserve code blocks
  const codeBlocks = [];
  let text = rawText.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    codeBlocks.push({ lang, code: code.trim() });
    return '';
  });

  // Handle unclosed code block
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)$/g, (match, lang, code) => {
    codeBlocks.push({ lang, code: code.trim() });
    return '';
  });

  // 2. Strip trailing AI boilerplate
  const trailingFluff = [
    /(?:Hope\s+this\s+helps!?(?:\s+Let\s+me\s+know\s+if\s+you\s+need\s+anything\s+else\.?)?)/gi,
    /(?:Please\s+let\s+me\s+know\s+if\s+you\s+have\s+any\s+(?:other\s+)?questions(?:\s+or\s+need\s+further\s+assistance)?\.?)/gi,
    /(?:Feel\s+free\s+to\s+ask\s+if\s+you\s+have\s+any\s+(?:more\s+)?questions\.?)/gi,
    /(?:As\s+an\s+AI(?:\s+language\s+model)?,?\s+I\s+recommend\s+testing\s+this\s+before\s+production\.?)/gi,
    /(?:Semoga\s+(?:ini\s+)?membantu!?(?:\s+Beri\s+tahu\s+saya\s+jika\s+ada\s+pertanyaan\.?)?)/gi,
    /(?:Jika\s+ada\s+yang\s+kurang\s+jelas,\s+silakan\s+tanyakan\s+kembali\.?)/gi
  ];
  for (const pat of trailingFluff) {
    text = text.replace(pat, '');
  }

  // 3. Clean ANSI
  text = text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  text = text.replace(/\[[0-9;]+m/g, '');

  // 4. Detect and isolate errors / stack traces
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

  // 5. Remove repetitive log lines (like [info] Compiling ..., [ERROR] ...)
  text = text.replace(/(?:\[info\][^\n]+\n?)+/gi, '');
  text = text.replace(/(?:\[ERROR\][^\n]+\n?)+/gi, '');

  // 6. Clean and extract instructions
  text = cleanAndFormatTask(text);

  // Split into clean sentence list
  const rawSentences = text.split(/\n+|\.\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 5);

  // Normalise verbs to imperative (e.g. "memperbaiki" -> "Perbaiki")
  const taskPoints = [];
  for (let s of rawSentences) {
    s = s.replace(/^[-,*•]\s*/, '');
    s = s.replace(/\?+$/, '');
    s = s.replace(/^memperbaiki\b/i, 'Perbaiki');
    s = s.replace(/^membuat(?:kan)?\b/i, 'Buat');
    s = s.replace(/^menambahkan\b/i, 'Tambahkan');
    s = s.replace(/^mengubah\b/i, 'Ubah');
    s = s.replace(/^menangani\b/i, 'Tangani');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!taskPoints.some(existing => existing.toLowerCase().includes(s.toLowerCase().slice(0, 20)))) {
      taskPoints.push(s);
    }
  }

  // Assemble Beautiful Reprompt
  const parts = [];

  // Goal & Task
  if (taskPoints.length === 1) {
    parts.push(`**Tujuan:**\n${taskPoints[0]}.`);
  } else if (taskPoints.length > 1) {
    parts.push(`**Tujuan & Instruksi:**\n` + taskPoints.map(t => `- ${t}.`).join('\n'));
  }

  // Code Blocks
  if (codeBlocks.length > 0) {
    const formattedCode = codeBlocks.map(cb => '```' + (cb.lang || '') + '\n' + cb.code + '\n```').join('\n\n');
    parts.push(`**Kode Terkait:**\n${formattedCode}`);
  }

  // Error Snippet
  if (errorSnippet) {
    parts.push(`**Error yang Terjadi:**\n\`\`\`\n${errorSnippet}\n\`\`\``);
  }

  return parts.join('\n\n');
}

const testInput = `Halo Antigravity selamat pagi! Semoga harimu menyenangkan.
Saya ingin kamu tolong bantu saya untuk memperbaiki error pada file \`src/api/auth.js\`.
Kodenya seperti ini:

\`\`\`javascript
export async function verifyUser(req, res) {
  const token = req.headers['authorization'];
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  return true;
}
\`\`\`

Saat saya jalankan \`npm test\`, muncul error panjang sekali seperti ini:
[ERROR] Test suite failed to run
[info] Compiling test modules (0/8)...
[info] Compiling test modules (0/8)...
[info] Compiling test modules (0/8)...
TypeError: Cannot read properties of undefined (reading 'headers')
    at verifyUser (src/api/auth.js:2:24)
    at Module._compile (node:internal/modules/cjs/loader:1356:14)

Bisakah kamu tolong perbaiki fungsi \`verifyUser\` di atas agar menangani request mock dengan aman?
Terima kasih banyak ya sebelumnya!

Hope this helps! Let me know if you have any questions.`;

console.log(reprompt(testInput));
