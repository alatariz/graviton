// src/chat-repl.js - Graviton V2.0.0 Interactive REPL Shell
import readline from 'readline';
import path from 'path';
import { constructSuperPrompt, readOdometer } from './pipeline.js';
import { runAntigravityWithAutoAllow } from '../bin/graviton-relay.js';
import { getWorkspaceSession, clearWorkspaceSession } from './session-manager.js';
import { executeRollback } from './rollback-manager.js';
import { listActivePorts, stopDaemonOrPort } from './port-guard.js';
import { compactWorkspaceSession, checkCompactionStatus } from './session-compactor.js';
import { inspectSessionFiles } from './sanity-guard.js';

/**
 * Starts an interactive REPL shell for Graviton.
 * Allows conversational prompts without shell quotation escaping in Windows PowerShell/CMD.
 * @param {object} options
 */
export async function startChatRepl(options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());

  console.log(`
\x1b[1m\x1b[36m===============================================================
  GRAVITON V2.0.0 INTERACTIVE REPL CHAT
===============================================================\x1b[0m
\x1b[90mWorkspace : [1m${cwd}\x1b[0m
\x1b[90mKetik prompt secara bebas tanpa perlu tanda petik luar ("...").
Perintah internal: \x1b[33m/undo\x1b[90m, \x1b[33m/compact\x1b[90m, \x1b[33m/ports\x1b[90m, \x1b[33m/stop\x1b[90m, \x1b[33m/status\x1b[90m, \x1b[33m/exit\x1b[0m
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '\x1b[1;36mgraviton> \x1b[0m'
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
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
  \x1b[33m/undo\x1b[0m         Membatalkan perubahan sesi AI terakhir (Rollback)
  \x1b[33m/compact\x1b[0m      Meringkas sesi panjang & me-refresh context window
  \x1b[33m/ports\x1b[0m        Cek daftar port dev yang sedang aktif
  \x1b[33m/stop [port]\x1b[0m  Hentikan background server atau bebaskan port
  \x1b[33m/status\x1b[0m       Cek informasi sesi dan token aktif
  \x1b[33m/new\x1b[0m          Reset sesi aktif di workspace ini
  \x1b[33m/exit\x1b[0m         Keluar dari Graviton REPL
`);
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
      rl.prompt();
      return;
    }

    if (input === '/compact') {
      const res = compactWorkspaceSession(cwd);
      console.log(`\x1b[32m✔ ${res.message}\x1b[0m`);
      rl.prompt();
      return;
    }

    if (input === '/ports') {
      const active = listActivePorts();
      if (active.length === 0) {
        console.log('  \x1b[32m✔ Semua port dev (3000, 5173, dll) bebas!\x1b[0m');
      } else {
        active.forEach(p => console.log(`  \x1b[33m● Port ${p.port} aktif (PID: ${p.pid})\x1b[0m`));
      }
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
      rl.prompt();
      return;
    }

    if (input === '/status') {
      const session = getWorkspaceSession(cwd);
      const odo = readOdometer();
      if (session && session.conversationId) {
        console.log(`  \x1b[36m● Sesi Aktif:\x1b[0m ${session.conversationId.slice(0, 8)}...`);
        console.log(`  \x1b[36m● Turns:\x1b[0m ${session.turns || 1}`);
        console.log(`  \x1b[36m● Estimasi Token Sesi:\x1b[0m ~ ${session.cumulativeTokens || odo.lastSessionTokens} tokens`);
      } else {
        console.log('  \x1b[90mBelum ada sesi aktif di workspace ini.\x1b[0m');
      }
      rl.prompt();
      return;
    }

    if (input === '/new') {
      clearWorkspaceSession(cwd);
      console.log('\x1b[32m✔ Sesi workspace di-reset ke sesi baru.\x1b[0m');
      rl.prompt();
      return;
    }

    // 2. REGULAR PROMPT EXECUTION
    try {
      const existingSession = getWorkspaceSession(cwd);
      let targetConvId = null;
      let continueSession = false;

      if (existingSession && existingSession.conversationId) {
        targetConvId = existingSession.conversationId;
        continueSession = true;
      }

      console.log(`\x1b[36m[GRAVITON V2.0]\x1b[0m Menyiapkan prompt & target scoping...`);
      const superPrompt = constructSuperPrompt(input, cwd, { isContinuous: continueSession });

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
    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}
