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
  formatConversationList,
  getConversationHistory,
  formatConversationHistory
} from './session-manager.js';
import { executeRollback } from './rollback-manager.js';
import { listActivePorts, stopDaemonOrPort } from './port-guard.js';
import { compactWorkspaceSession, checkCompactionStatus } from './session-compactor.js';
import { inspectSessionFiles } from './sanity-guard.js';
import { getSessionDiff } from './diff-viewer.js';
import { runDoctor, formatDoctorReport } from './doctor.js';
import { resolveTargetScope } from './context-scoper.js';
import { captureClipboard, formatClipboardAttachment } from './clipboard.js';

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
    ? `\x1b[33m● Active Topic: "${active.title}" (${active.id.slice(0, 8)}...)\x1b[0m`
    : `\x1b[90m(Fresh session - first prompt will automatically title the topic)\x1b[0m`;

  console.log(`
\x1b[1m\x1b[36m===============================================================
  GRAVITON V2.0.0 INTERACTIVE REPL CHAT (CLI HISTORY)
===============================================================\x1b[0m
\x1b[90mWorkspace   : \x1b[1m${cwd}\x1b[0m
${activeTopicDisplay}
\x1b[90mType your prompt directly without outer quotes.\x1b[0m
Commands: \x1b[33m/c\x1b[90m (history), \x1b[33m/n\x1b[90m (new chat), \x1b[33m/p\x1b[90m (paste clipboard), \x1b[33m/undo\x1b[90m, \x1b[33m/diff\x1b[90m, \x1b[33m/compact\x1b[90m, \x1b[33m/ports\x1b[90m, \x1b[33m/doctor\x1b[90m, \x1b[33m/exit\x1b[0m
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
        console.log(`\x1b[31m✖ Conversation '${target}' not found.\x1b[0m`);
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
        console.log(`\x1b[32m✔ ${res.message}\x1b[0m`);
      } else {
        console.log(`\x1b[31m✖ ${res.message}\x1b[0m`);
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
        console.log(`\x1b[32m✔ ${res.message}\x1b[0m`);
      } else {
        console.log(`\x1b[31m✖ ${res.message}\x1b[0m`);
      }
      updatePrompt();
      rl.prompt();
      return;
    }

    if (input === '/new' || input === '/n' || input === '--n' || input === 'n') {
      clearWorkspaceSession(cwd);
      console.log('\x1b[32m✔ Session reset. Next prompt will start a fresh conversation with a new topic.\x1b[0m');
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
      console.log('\x1b[36m[GRAVITON]\x1b[0m Running Safety Rollback Guard...');
      const res = executeRollback(cwd);
      if (res.success) {
        console.log(`\x1b[32m✔ Rollback completed: ${res.restored.length} files restored, ${res.removed.length} new files removed.\x1b[0m`);
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
        console.log('  \x1b[32m✔ All local dev ports (3000, 5173, etc.) are free!\x1b[0m');
      } else {
        activePorts.forEach(p => console.log(`  \x1b[33m● Port ${p.port} active (PID: ${p.pid})\x1b[0m`));
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
        results.forEach(r => console.log(`  \x1b[32m✔ ${r.message || 'Process terminated'}\x1b[0m`));
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
        console.log(`  \x1b[36m● Active Topic:\x1b[0m "${curActive.title}"`);
        console.log(`  \x1b[36m● Conversation ID:\x1b[0m ${curActive.id.slice(0, 8)}...`);
        console.log(`  \x1b[36m● Turns:\x1b[0m ${curActive.turns || 1}`);
        console.log(`  \x1b[36m● Estimated Tokens:\x1b[0m ~ ${curActive.cumulativeTokens || odo.lastSessionTokens} tokens`);
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

      const existingSession = getActiveConversation(cwd);
      let targetConvId = null;
      let continueSession = false;
      let activeTitle = null;

      if (existingSession && existingSession.id) {
        targetConvId = existingSession.id;
        continueSession = true;
        activeTitle = existingSession.title;
        console.log(`\x1b[36m[GRAVITON V2.0]\x1b[0m Continuing conversation: "\x1b[1m${activeTitle}\x1b[0m" (${targetConvId.slice(0, 8)}...)`);
      } else {
        console.log(`\x1b[36m[GRAVITON V2.0]\x1b[0m Starting new conversation in workspace...`);
      }

      const superPrompt = constructSuperPrompt(executionPrompt, cwd, {
        isContinuous: continueSession,
        conversationTitle: activeTitle
      });

      const targetScope = resolveTargetScope(executionPrompt, cwd);
      if (clipboardFiles.length > 0) {
        for (const cf of clipboardFiles) {
          if (!targetScope.targets.includes(cf)) {
            targetScope.targets.unshift(cf);
          }
        }
      }
      if (targetScope && targetScope.targets && targetScope.targets.length > 0) {
        const scopeLabel = targetScope.isLastTouch ? 'Last-Touch Context' : 'Smart Scoper';
        console.log(`\x1b[35m[GRAVITON CONTEXT SCOPER]\x1b[0m Targeted Files: \x1b[1m${targetScope.targets.join(', ')}\x1b[0m \x1b[90m(${scopeLabel})\x1b[0m`);
      } else {
        console.log(`\x1b[35m[GRAVITON CONTEXT SCOPER]\x1b[0m Workspace Mapping Active \x1b[90m(General Exploration)\x1b[0m`);
      }

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
