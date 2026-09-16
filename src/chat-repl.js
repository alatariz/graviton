// src/chat-repl.js - Graviton V2.0.0 Interactive REPL Shell
import readline from 'readline';
import path from 'path';
import { constructSuperPrompt, readOdometer } from './pipeline.js';
import { runAntigravityWithAutoAllow } from '../bin/graviton-relay.js';
import {
  getWorkspaceSession,
  clearWorkspaceSession,
  getWorkspaceConversations,
  getActiveConversation,
  setActiveConversation,
  deleteWorkspaceConversation,
  renameWorkspaceConversation,
  formatConversationList
} from './session-manager.js';
import { executeRollback } from './rollback-manager.js';
import { listActivePorts, stopDaemonOrPort } from './port-guard.js';
import { compactWorkspaceSession, checkCompactionStatus } from './session-compactor.js';
import { inspectSessionFiles } from './sanity-guard.js';
import { getSessionDiff } from './diff-viewer.js';
import { runDoctor, formatDoctorReport } from './doctor.js';

/**
 * Starts an interactive REPL shell for Graviton.
 * Allows conversational prompts without shell quotation escaping in Windows PowerShell/CMD.
 * Supports Antigravity IDE-style conversation history switcher (/c, /n, /rename).
 * Supports debounced multiline paste buffering so multi-line code/prompts are not fractured.
 * @param {object} options
 */
export async function startChatRepl(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());

  const active = getActiveConversation(cwd);
  const activeTopicDisplay = active && active.title
    ? `\x1b[33m● Topik Aktif: "${active.title}" (${active.id.slice(0, 8)}...)\x1b[0m`
    : `\x1b[90m(Sesi baru - prompt pertama akan otomatis menjadi judul topik)\x1b[0m`;

  console.log(`
\x1b[1m\x1b[36m===============================================================
  GRAVITON V2.0.0 INTERACTIVE REPL CHAT (IDE HISTORY)
===============================================================\x1b[0m
\x1b[90mWorkspace   : \x1b[1m${cwd}\x1b[0m
${activeTopicDisplay}
\x1b[90mKetik prompt secara bebas tanpa tanda petik luar ("...").\x1b[0m
Perintah: \x1b[33m/c\x1b[90m (riwayat chat), \x1b[33m/n\x1b[90m (chat baru), \x1b[33m/undo\x1b[90m, \x1b[33m/diff\x1b[90m, \x1b[33m/compact\x1b[90m, \x1b[33m/ports\x1b[90m, \x1b[33m/doctor\x1b[90m, \x1b[33m/exit\x1b[0m
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  function updatePrompt() {
    const cur = getActiveConversation(cwd);
    const shortTitle = cur && cur.title
      ? (cur.title.length > 20 ? cur.title.slice(0, 18) + '..' : cur.title)
      : null;
    const topicTag = shortTitle ? ` \x1b[90m[[33m${shortTitle}[90m][0m` : '';
    rl.setPrompt(`\x1b[1;36mgraviton${topicTag}> \x1b[0m`);
  }

  updatePrompt();
  rl.prompt();

  let pasteBuffer = [];
  let pasteTimer = null;

  async function handleExecution(rawInput) {
    const input = rawInput.trim();

    if (!input) {
      updatePrompt();
      rl.prompt();
      return;
    }

    // 1. SLASH COMMANDS
    if (input === '/exit' || input === '/quit' || input === 'exit' || input === 'quit') {
      console.log('\x1b[90mKeluar dari Graviton REPL. Sampai jumpa!\x1b[0m\n');
      rl.close();
      process.exit(0);
    }

    if (input === '/help') {
      console.log(`
\x1b[1mDAFTAR PERINTAH REPL:\x1b[0m
  \x1b[33m/c\x1b[0m, \x1b[33m--c\x1b[0m           Tampilkan daftar riwayat percakapan (Antigravity IDE History)
  \x1b[33m/c <nomor>\x1b[0m       Beralih ke percakapan nomor tertentu (contoh: \x1b[1m/c 2\x1b[0m)
  \x1b[33m/n\x1b[0m, \x1b[33m--n\x1b[0m, \x1b[33m/new\x1b[0m     Mulai percakapan baru di workspace ini
  \x1b[33m/del <nomor>\x1b[0m     Hapus percakapan dari riwayat (contoh: \x1b[1m/del 2\x1b[0m)
  \x1b[33m/rename <judul>\x1b[0m  Ubah judul topik percakapan aktif
  \x1b[33m/undo\x1b[0m            Membatalkan perubahan sesi AI terakhir (Rollback)
  \x1b[33m/diff\x1b[0m            Tinjau perbedaan baris kode yang baru saja diedit oleh AI
  \x1b[33m/compact\x1b[0m         Meringkas sesi panjang & me-refresh context window
  \x1b[33m/doctor\x1b[0m          Jalankan diagnosa kesehatan sistem & Google Antigravity
  \x1b[33m/ports\x1b[0m           Cek daftar port dev yang sedang aktif
  \x1b[33m/stop [port]\x1b[0m     Hentikan background server atau bebaskan port
  \x1b[33m/status\x1b[0m          Cek informasi sesi dan token aktif
  \x1b[33m/exit\x1b[0m            Keluar dari Graviton REPL
`);
      updatePrompt();
      rl.prompt();
      return;
    }

    // CONVERSATION MANAGER COMMANDS (/c, /conversation, --c)
    if (input === '/c' || input === '--c' || input === '/conversation' || input === '/chats') {
      const listStr = formatConversationList(cwd);
      console.log(listStr);
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input.startsWith('/c ') || input.startsWith('--c ')) {
      const target = input.replace(/^(\/c|--c)\s+/, '').trim();
      const sel = setActiveConversation(cwd, target);
      if (sel) {
        console.log(`\x1b[32m✔ Beralih ke topik percakapan: "${sel.title}" (${sel.id.slice(0, 8)}...)\x1b[0m`);
      } else {
        console.log(`\x1b[31m✖ Percakapan '${target}' tidak ditemukan.\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input.startsWith('/del ') || input.startsWith('/d ')) {
      const target = input.replace(/^(\/del|\/d)\s+/, '').trim();
      const res = deleteWorkspaceConversation(cwd, target);
      if (res.success) {
        console.log(`\x1b[32m✔ ${res.message}\x1b[0m`);
      } else {
        console.log(`\x1b[31m✖ ${res.message}\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input.startsWith('/rename ')) {
      const newTitle = input.replace(/^\/rename\s+/, '').trim();
      const res = renameWorkspaceConversation(cwd, 'active', newTitle);
      if (res.success) {
        console.log(`\x1b[32m✔ ${res.message}\x1b[0m`);
      } else {
        console.log(`\x1b[31m✖ ${res.message}\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/new' || input === '/n' || input === '--n') {
      clearWorkspaceSession(cwd);
      console.log('\x1b[32m✔ Sesi di-reset. Prompt berikutnya akan menjadi percakapan baru dengan topik baru.\x1b[0m');
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/diff') {
      const diffOutput = getSessionDiff(cwd);
      console.log(diffOutput);
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/doctor') {
      const docResult = runDoctor(cwd);
      console.log(formatDoctorReport(docResult));
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/undo' || input === '/rollback') {
      console.log('\x1b[36m[GRAVITON]\x1b[0m Menjalankan Safety Rollback Guard...');
      const res = executeRollback(cwd);
      if (res.success) {
        console.log(`\x1b[32m✔ Rollback selesai: ${res.restored.length} file dipulihkan, ${res.removed.length} file baru dihapus.\x1b[0m`);
      } else {
        console.log(`\x1b[33m[!] ${res.message}\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/compact') {
      const res = compactWorkspaceSession(cwd);
      console.log(`\x1b[32m✔ ${res.message}\x1b[0m`);
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/ports') {
      const activePorts = listActivePorts();
      if (activePorts.length === 0) {
        console.log('  \x1b[32m✔ Semua port dev (3000, 5173, dll) bebas!\x1b[0m');
      } else {
        activePorts.forEach(p => console.log(`  \x1b[33m● Port ${p.port} aktif (PID: ${p.pid})\x1b[0m`));
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input.startsWith('/stop')) {
      const parts = input.split(/\s+/);
      const target = parts[1] || 'all';
      const results = stopDaemonOrPort(target, cwd);
      if (results.length > 0) {
        results.forEach(r => console.log(`  \x1b[32m✔ ${r.message || 'Proses dihentikan'}\x1b[0m`));
      } else {
        console.log('  \x1b[90mTidak ada daemon atau port aktif yang ditemukan.\x1b[0m');
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/status') {
      const curActive = getActiveConversation(cwd);
      const odo = readOdometer();
      if (curActive && curActive.id) {
        console.log(`  \x1b[36m● Topik Aktif:\x1b[0m "${curActive.title}"`);
        console.log(`  \x1b[36m● ID Percakapan:\x1b[0m ${curActive.id.slice(0, 8)}...`);
        console.log(`  \x1b[36m● Turns:\x1b[0m ${curActive.turns || 1}`);
        console.log(`  \x1b[36m● Estimasi Token Sesi:\x1b[0m ~ ${curActive.cumulativeTokens || odo.lastSessionTokens} tokens`);
      } else {
        console.log('  \x1b[90mBelum ada sesi aktif di workspace ini.\x1b[0m');
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    // 2. REGULAR PROMPT EXECUTION (Conversational continuity preserved)
    try {
      const existingSession = getActiveConversation(cwd);
      let targetConvId = null;
      let continueSession = false;
      let activeTitle = null;

      if (existingSession && existingSession.id) {
        targetConvId = existingSession.id;
        continueSession = true;
        activeTitle = existingSession.title;
        console.log(`\x1b[36m[GRAVITON V2.0]\x1b[0m Melanjutkan obrolan: "\x1b[1m${activeTitle}\x1b[0m" (${targetConvId.slice(0, 8)}...)`);
      } else {
        console.log(`\x1b[36m[GRAVITON V2.0]\x1b[0m Memulai percakapan baru di workspace...`);
      }

      const superPrompt = constructSuperPrompt(input, cwd, {
        isContinuous: continueSession,
        conversationTitle: activeTitle
      });

      runAntigravityWithAutoAllow(superPrompt, {
        conversationId: targetConvId,
        continueSession,
        cwd,
        isDeep: options.isDeep || false
      });

      // Post-execution: Syntax Sanity Check & Compaction advisory
      inspectSessionFiles(cwd);
      const compStatus = checkCompactionStatus(cwd);
      if (compStatus.advise) {
        console.log(compStatus.message);
      }

    } catch (err) {
      console.error(`\x1b[1;31m[GRAVITON ERROR]\x1b[0m ${err.message}`);
    }

    console.log('');
    updatePrompt();
    rl.prompt();
  }

  // Handle multiline paste buffering
  rl.on('line', (line) => {
    pasteBuffer.push(line);
    if (pasteTimer) clearTimeout(pasteTimer);
    pasteTimer = setTimeout(() => {
      const combined = pasteBuffer.join('\n');
      pasteBuffer = [];
      handleExecution(combined);
    }, 60);
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
