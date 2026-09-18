// src/chat-repl.js - Graviton Interactive REPL Shell
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
  formatConversationList,
  getConversationHistory,
  formatConversationHistory
} from './session-manager.js';
import { executeRollback } from './rollback-manager.js';
import { listActivePorts, stopDaemonOrPort } from './port-guard.js';
import { compactWorkspaceSession, checkCompactionStatus, checkAndApplySlidingWindow, autoCompactSessionIfExceeded } from './session-compactor.js';
import { inspectSessionFiles } from './sanity-guard.js';
import { getSessionDiff } from './diff-viewer.js';
import { runDoctor, formatDoctorReport } from './doctor.js';
import { resolveTargetScope } from './context-scoper.js';
import { captureClipboard, formatClipboardAttachment } from './clipboard.js';
import { isTranspilableDocument, transpileFileToMarkdown } from './markitdown.js';
import { listSessionSnapshots, clearSessionSnapshots } from './delta-compressor.js';
import { resolveModelAndEffort } from './model-selector.js';

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
    ? `\x1b[33m●  Active Topic: "${active.title}" (${active.id.slice(0, 8)}...)\x1b[0m`
    : `\x1b[90m(Fresh session - first prompt will automatically title the topic)\x1b[0m`;

  console.log(`
\x1b[1m\x1b[36m===============================================================
  GRAVITON INTERACTIVE REPL CHAT
===============================================================\x1b[0m
\x1b[90mWorkspace   : \x1b[1m${cwd}\x1b[0m
${activeTopicDisplay}
\x1b[90mType your prompt directly without outer quotes.\x1b[0m
Commands: \x1b[33m/c\x1b[90m (history), \x1b[33m/n\x1b[90m (new chat), \x1b[33m/p\x1b[90m (paste), \x1b[33m/delta\x1b[90m, \x1b[33m/undo\x1b[90m, \x1b[33m/diff\x1b[90m, \x1b[33m/compact\x1b[90m, \x1b[33m/doctor\x1b[90m, \x1b[33m/exit\x1b[0m
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
    const topicTag = shortTitle ? ` \x1b[90m[ \x1b[33m${shortTitle}\x1b[90m ]\x1b[0m` : '';
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
      console.log('\x1b[90mExiting Graviton REPL. Goodbye!\x1b[0m\n');
      rl.close();
      process.exit(0);
    }

    if (input === '/help') {
      console.log(`
\x1b[1mREPL COMMANDS:\x1b[0m
  \x1b[33m/c\x1b[0m, \x1b[33m--c\x1b[0m, \x1b[33m/chats\x1b[0m      View conversation history list (Antigravity CLI History)
  \x1b[33m/c <number>\x1b[0m       Switch to and view conversation history (e.g. \x1b[1m/c 2\x1b[0m)
  \x1b[33m/n\x1b[0m, \x1b[33m--n\x1b[0m, \x1b[33m/new\x1b[0m, \x1b[33mn\x1b[0m    Start a fresh conversation in this workspace
  \x1b[33m/p\x1b[0m, \x1b[33m/paste [prompt]\x1b[0m    Attach image/files/text from clipboard to prompt
  \x1b[33m/m <file>\x1b[0m, \x1b[33m/markdown\x1b[0m     Transpile Office/PDF/data document to Markdown
  \x1b[33m/delta\x1b[0m               View cached file snapshots for active topic
  \x1b[33m/reset-delta\x1b[0m         Clear delta snapshots for active topic
  \x1b[33m/del <number>\x1b[0m, \x1b[33md <n>\x1b[0m  Delete conversation from history (e.g. \x1b[1md 2\x1b[0m)
  \x1b[33m/rename <title>\x1b[0m    Rename active conversation topic
  \x1b[33m/undo\x1b[0m            Undo last AI changes (Rollback)
  \x1b[33m/diff\x1b[0m            Review code diffs made in the latest session
  \x1b[33m/compact\x1b[0m         Compact long session & refresh context window
  \x1b[33m/doctor\x1b[0m          Run system & Google Antigravity health checks
  \x1b[33m/ports\x1b[0m           List active local development ports
  \x1b[33m/stop [port]\x1b[0m     Stop background daemon or free port
  \x1b[33m/status\x1b[0m          Display active conversation & token metrics
  \x1b[33m/exit\x1b[0m            Exit Graviton REPL
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
        const hist = getConversationHistory(cwd, sel.id, 5);
        console.log(formatConversationHistory(hist));
      } else {
        console.log(`\x1b[31m✖  Conversation '${target}' not found.\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    // DIRECT NUMBER SELECTION (e.g. 1, 2, 3...)
    if (/^\d+$/.test(input)) {
      const targetNum = parseInt(input, 10);
      const { conversations } = getWorkspaceConversations(cwd);
      if (targetNum >= 1 && targetNum <= conversations.length) {
        const sel = setActiveConversation(cwd, targetNum);
        if (sel) {
          const hist = getConversationHistory(cwd, sel.id, 5);
          console.log(formatConversationHistory(hist));
          updatePrompt();
          rl.prompt();
          return;
        }
      }
    }

    // DIRECT DELETION (e.g. d 1, /d 1, /del 1)
    if (/^(\/del|\/d|d|del)\s+\d+$/i.test(input)) {
      const target = input.replace(/^(\/del|\/d|d|del)\s+/i, '').trim();
      const res = deleteWorkspaceConversation(cwd, target);
      if (res.success) {
        console.log(`\x1b[32m✔  ${res.message}\x1b[0m`);
      } else {
        console.log(`\x1b[31m✖  ${res.message}\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === 'q') {
      console.log('\x1b[90mCancelled.\x1b[0m');
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input.startsWith('/rename ')) {
      const newTitle = input.replace(/^\/rename\s+/, '').trim();
      const res = renameWorkspaceConversation(cwd, 'active', newTitle);
      if (res.success) {
        console.log(`\x1b[32m✔  ${res.message}\x1b[0m`);
      } else {
        console.log(`\x1b[31m✖  ${res.message}\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/new' || input === '/n' || input === '--n' || input === 'n') {
      clearWorkspaceSession(cwd);
      console.log('\x1b[32m✔  Session reset. Next prompt will start a fresh conversation with a new topic.\x1b[0m');
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

    if (input === '/delta' || input === '/snapshots') {
      const active = getActiveConversation(cwd);
      const convId = active ? active.id : 'default';
      const snaps = listSessionSnapshots(cwd, convId);
      if (snaps.length === 0) {
        console.log('  \x1b[90mNo file snapshots currently cached for this session.\x1b[0m');
      } else {
        console.log(`\n\x1b[1m\x1b[36m=== ACTIVE CONVERSATION DELTA SNAPSHOTS (${snaps.length} files) ===\x1b[0m`);
        snaps.forEach(s => console.log(`  \x1b[32m✔\x1b[0m  \x1b[1m${s.file}\x1b[0m (${s.lineCount} lines) - updated ${new Date(s.updatedAt).toLocaleTimeString()}`));
        console.log(`\x1b[90mSubsequent turns will only send diff hunks for these files.\x1b[0m\n`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/reset-delta' || input === '/cleardelta') {
      const active = getActiveConversation(cwd);
      const convId = active ? active.id : 'default';
      clearSessionSnapshots(cwd, convId);
      console.log('  \x1b[32m✔  Delta snapshots cleared for this session. Next turn will establish fresh baselines.\x1b[0m');
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
      console.log('\x1b[36m[GRAVITON]\x1b[0m Running Safety Rollback Guard...');
      const res = executeRollback(cwd);
      if (res.success) {
        console.log(`\x1b[32m✔  Rollback completed: ${res.restored.length} files restored, ${res.removed.length} new files removed.\x1b[0m`);
      } else {
        console.log(`\x1b[33m[!] ${res.message}\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/compact') {
      const res = compactWorkspaceSession(cwd);
      console.log(`\x1b[32m✔  ${res.message}\x1b[0m`);
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/ports') {
      const activePorts = listActivePorts();
      if (activePorts.length === 0) {
        console.log('  \x1b[32m✔  All local dev ports (3000, 5173, etc.) are free!\x1b[0m');
      } else {
        activePorts.forEach(p => console.log(`  \x1b[33m●  Port ${p.port} active (PID: ${p.pid})\x1b[0m`));
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
        results.forEach(r => console.log(`  \x1b[32m✔  ${r.message || 'Process terminated'}\x1b[0m`));
      } else {
        console.log('  \x1b[90mNo active background daemons or ports found.\x1b[0m');
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/status') {
      const curActive = getActiveConversation(cwd);
      const odo = readOdometer();
      if (curActive && curActive.id) {
        console.log(`  \x1b[36m●  Active Topic:\x1b[0m "${curActive.title}"`);
        console.log(`  \x1b[36m●  Conversation ID:\x1b[0m ${curActive.id.slice(0, 8)}...`);
        console.log(`  \x1b[36m●  Turns:\x1b[0m ${curActive.turns || 1}`);
        console.log(`  \x1b[36m●  Estimated Tokens:\x1b[0m ~ ${curActive.cumulativeTokens || odo.lastSessionTokens} tokens`);
      } else {
        console.log('  \x1b[90mNo active conversation in this workspace yet.\x1b[0m');
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    // 2. REGULAR PROMPT EXECUTION (Conversational continuity preserved)
    try {
      let executionPrompt = input;
      let clipboardFiles = [];

      if (input === '/p' || input.startsWith('/p ') || input === '/paste' || input.startsWith('/paste ')) {
        const promptText = input.replace(/^(\/paste|\/p)\s*/i, '').trim();
        console.log(`\x1b[36m[GRAVITON CLIPBOARD]\x1b[0m Checking system clipboard...`);
        const clipResult = captureClipboard(cwd);
        if (clipResult.type === 'empty' && !promptText) {
          console.log(`\x1b[33m[!] Clipboard is empty. Please copy an image, file, or text first.\x1b[0m`);
          updatePrompt();
          rl.prompt();
          return;
        }
        const formatted = formatClipboardAttachment(clipResult, promptText);
        executionPrompt = formatted.enhancedPrompt;
        clipboardFiles = formatted.targetFiles || [];
        if (formatted.summary) {
          console.log(`\x1b[35m[GRAVITON CLIPBOARD]\x1b[0m ${formatted.summary}`);
        }
      }

      let markdownFiles = [];
      if (input === '/m' || input.startsWith('/m ') || input === '/markdown' || input.startsWith('/markdown ')) {
        const parts = input.replace(/^(\/markdown|\/m)\s*/i, '').trim().split(/\s+/);
        const targetFile = parts[0];
        const restPrompt = parts.slice(1).join(' ');
        if (!targetFile) {
          console.log(`\x1b[33m[!] Usage: /m <filepath> [optional prompt]\x1b[0m`);
          updatePrompt();
          rl.prompt();
          return;
        }
        const fullDocPath = path.resolve(cwd, targetFile);
        if (!fs.existsSync(fullDocPath)) {
          console.log(`\x1b[31m✖  File '${targetFile}' not found in workspace.\x1b[0m`);
          updatePrompt();
          rl.prompt();
          return;
        }
        console.log(`\x1b[36m[GRAVITON MARKITDOWN]\x1b[0m Transpiling \x1b[1m${path.basename(fullDocPath)}\x1b[0m to clean Markdown...`);
        const transpiled = transpileFileToMarkdown(fullDocPath);
        executionPrompt = `${transpiled}\n\nUser Request:\n${restPrompt || 'Please inspect and analyze this document, then assist with any necessary code changes.'}`;
        markdownFiles.push(path.relative(cwd, fullDocPath).replace(/\\/g, '/'));
      }

      const existingSession = getActiveConversation(cwd);
      let targetConvId = null;
      let continueSession = false;
      let activeTitle = null;

      if (existingSession && existingSession.id) {
        targetConvId = existingSession.id;
        continueSession = true;
        activeTitle = existingSession.title;
        console.log(`\x1b[36m[GRAVITON]\x1b[0m Continuing topic: "\x1b[1m${activeTitle}\x1b[0m" (${targetConvId.slice(0, 8)}...)`);
        const autoComp = checkAndApplySlidingWindow(cwd, targetConvId);
        if (autoComp.autoCompacted) {
          console.log(`\x1b[36m[GRAVITON AUTO-COMPACTOR]\x1b[0m Distilled ${autoComp.turnsCompacted} earlier turns into working memory (Estimated ~${autoComp.tokensSavedEstimate.toLocaleString()} tokens saved).`);
        }
      }

      const superPrompt = constructSuperPrompt(executionPrompt, cwd, {
        isContinuous: continueSession,
        conversationTitle: activeTitle,
        conversationId: targetConvId || 'repl_session'
      });

      const targetScope = resolveTargetScope(executionPrompt, cwd);
      if (clipboardFiles.length > 0) {
        for (const cf of clipboardFiles) {
          if (!targetScope.targets.includes(cf)) {
            targetScope.targets.unshift(cf);
          }
        }
      }
      if (markdownFiles.length > 0) {
        for (const mf of markdownFiles) {
          if (!targetScope.targets.includes(mf)) {
            targetScope.targets.unshift(mf);
          }
        }
      }
      if (targetScope && targetScope.targets && targetScope.targets.length > 0) {
        const scopeLabel = targetScope.isLastTouch ? 'Last-Touch Context' : 'Smart Scoper';
        console.log(`\x1b[35m[GRAVITON CONTEXT SCOPER]\x1b[0m Targeted Files: \x1b[1m${targetScope.targets.join(', ')}\x1b[0m \x1b[90m(${scopeLabel})\x1b[0m`);
      }

      const modelInfo = resolveModelAndEffort({
        isDeep: options.isDeep || false,
        prompt: executionPrompt,
        context: {
          targetFiles: targetScope?.targets || []
        }
      });

      const result = await runAntigravityWithAutoAllow(superPrompt, {
        conversationId: targetConvId,
        continueSession,
        cwd,
        isDeep: options.isDeep || false,
        effort: modelInfo.effort,
        model: modelInfo.modelName,
        modelTier: modelInfo.tier,
        modelReason: modelInfo.reason
      });

      const odo = readOdometer();
      if (result && (result.error || (result.status !== 0 && result.status !== null) || result.aborted || result.timedOut)) {
        const reason = result.failReason || (result.error && result.error.message) || `Process exited with code ${result.status}`;
        console.log(`\n\x1b[1;31m✖  Execution incomplete: ${reason}\x1b[0m`);
        console.log(`\x1b[90m(Session: ~${Number(odo.lastSessionTokens || 0).toLocaleString()} tokens | Lifetime Odometer: ${Number(odo.totalTokens || 0).toLocaleString()} tokens)\x1b[0m`);
      } else {
        console.log(`\x1b[32m✔  Execution complete. (Session: ~${Number(odo.lastSessionTokens || 0).toLocaleString()} tokens | Lifetime Odometer: ${Number(odo.totalTokens || 0).toLocaleString()} tokens)\x1b[0m`);
      }

      // Post-execution: Syntax Sanity Check & Autonomous Compaction
      inspectSessionFiles(cwd);
      const autoComp = autoCompactSessionIfExceeded(cwd, activeConversationId);
      if (autoComp && autoComp.autoCompacted && autoComp.message) {
        console.log(`\n${autoComp.message}`);
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
