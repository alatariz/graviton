#!/usr/bin/env node
// bin/graviton.js - Official GRAVITON CLI: Graviton V2.0.0 Autonomous Execution Layer

process.on('uncaughtException', (err) => {
  const message = err && err.message ? err.message : String(err);
  console.error(`\x1b[1;31m[🚨 GRAVITON ERROR]\x1b[0m \x1b[31m${message}\x1b[0m`);
  process.exit(1);
});

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
import { getTelemetry, formatTelemetryDashboard, recordTelemetry } from '../src/telemetry.js';
import { synthesizePrompt, estimateTokens, buildWorkspaceMap, constructSuperPrompt, readOdometer, purgeOldBackups } from '../src/pipeline.js';
import { filterCliOutput } from '../src/cli-filter.js';
import { runAntigravityWithAutoAllow } from './graviton-relay.js';
import {
  getWorkspaceSession,
  clearWorkspaceSession,
  getWorkspaceConversations,
  getActiveConversation,
  setActiveConversation,
  saveWorkspaceConversation,
  deleteWorkspaceConversation,
  formatConversationList,
  generateConversationTitle,
  runInteractiveConversationPicker,
  getConversationHistory,
  formatConversationHistory
} from '../src/session-manager.js';
import { executeRollback } from '../src/rollback-manager.js';
import { startBackgroundDaemon, stopDaemonOrPort, listActivePorts, findProcessOnPort, killProcessOnPort, detectWorkspaceDevServer } from '../src/port-guard.js';
import { startChatRepl } from '../src/chat-repl.js';
import { compactWorkspaceSession } from '../src/session-compactor.js';
import { runDoctor, formatDoctorReport } from '../src/doctor.js';
import { getSessionDiff } from '../src/diff-viewer.js';
import { resolveTargetScope } from '../src/context-scoper.js';
import { captureClipboard, formatClipboardAttachment } from '../src/clipboard.js';
import { isTranspilableDocument, transpileFileToMarkdown } from '../src/markitdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATS_FILE = path.join(os.homedir(), '.graviton-stats.json');

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { commandsRun: 0, promptsOptimized: 0, tokensSaved: 0, linesFiltered: 0 };
}

function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  } catch (e) {}
}

function copyToClipboard(text) {
  try {
    const isWin = process.platform === 'win32';
    if (isWin) {
      const proc = spawn('clip', { stdio: ['pipe', 'ignore', 'ignore'] });
      proc.on('error', () => {});
      if (proc.stdin) {
        proc.stdin.on('error', () => {});
        proc.stdin.write(text);
        proc.stdin.end();
      }
    } else if (process.platform === 'darwin') {
      const proc = spawn('pbcopy', { stdio: ['pipe', 'ignore', 'ignore'] });
      proc.on('error', () => {});
      if (proc.stdin) {
        proc.stdin.on('error', () => {});
        proc.stdin.write(text);
        proc.stdin.end();
      }
    } else {
      const proc = spawn('xclip', ['-selection', 'clipboard'], { stdio: ['pipe', 'ignore', 'ignore'] });
      proc.on('error', () => {});
      if (proc.stdin) {
        proc.stdin.on('error', () => {});
        proc.stdin.write(text);
        proc.stdin.end();
      }
    }
  } catch (e) {}
}

const rawArgs = process.argv.slice(2);

async function main() {
  // 1. Version Banner: At the very beginning of CLI execution
  console.log('\x1b[1;36m[Graviton V3.0.0 Active]\x1b[0m');

  // Fire-and-forget self-cleaning shadow backup (zero latency impact)
  purgeOldBackups();

  // Parse boolean flags and conversation arguments
  let isDeep = false;
  let isFast = false;
  let isPaste = false;
  let isMarkdown = false;
  let markdownFile = null;
  let isFull = false;
  let isNoDelta = false;
  let isNoSqueeze = false;
  let isRawOutput = false;
  let isNew = false;
  let isConversationMode = false;
  let conversationAction = null;
  let conversationTarget = null;
  const filteredArgs = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === '--deep' || arg === '-d') {
      isDeep = true;
    } else if (arg === '--fast' || arg === '-f') {
      isFast = true;
    } else if (arg === '--paste' || arg === '-p') {
      isPaste = true;
    } else if (arg === '--markdown' || arg === '-m') {
      isMarkdown = true;
      const next = rawArgs[i + 1];
      if (next && !next.startsWith('-')) {
        markdownFile = next;
        i++;
      }
    } else if (arg === '--full') {
      isFull = true;
    } else if (arg === '--no-delta') {
      isNoDelta = true;
    } else if (arg === '--no-squeeze') {
      isNoSqueeze = true;
    } else if (arg === '--raw-output') {
      isRawOutput = true;
    } else if (arg === '-n' || arg === '--n' || arg === '--new' || arg === '--fresh') {
      isNew = true;
    } else if (arg === '-c' || arg === '--c' || arg === '--conversation' || arg === 'conversation') {
      isConversationMode = true;
      const next = rawArgs[i + 1];
      if (next && (next === 'del' || next === 'delete' || next === 'd' || next === 'rm')) {
        conversationAction = 'delete';
        conversationTarget = rawArgs[i + 2] || null;
        i += 2;
      } else if (next && /^\d+$/.test(next)) {
        conversationTarget = next;
        i++;
      }
    } else if (arg !== '--dry-run') {
      filteredArgs.push(arg);
    }
  }

  const command = filteredArgs[0];

  // 1a. Handle standalone flags without commands
  if (isDeep && !command && !isConversationMode) {
    console.log(`\n\x1b[33m[GRAVITON TIP]\x1b[0m \x1b[1m-d, --deep\x1b[0m activates deep architecture synthesis for a prompt.\n` +
      `  Usage: \x1b[36mgrav -d "<prompt>"\x1b[0m (e.g. grav -d "architect a microservices backend")\n` +
      `  For system diagnostics, run: \x1b[36mgrav doc\x1b[0m or \x1b[36mgrav doctor\x1b[0m\n`);
    process.exit(0);
  }

  if (isFast && !command && !isConversationMode) {
    console.log(`\n\x1b[33m[GRAVITON TIP]\x1b[0m \x1b[1m-f, --fast\x1b[0m activates ultra-fast execution (low effort, skip planning).\n` +
      `  Usage: \x1b[36mgrav -f "<prompt>"\x1b[0m (e.g. grav -f "fix typo in README")\n`);
    process.exit(0);
  }

  // Check if piped from stdin (e.g. `git status | graviton` or `cat prompt.txt | graviton`)
  if (!process.stdin.isTTY && !command && !isConversationMode && !isDeep && !isFast) {
    try {
      const rawPiped = fs.readFileSync(0, 'utf-8');
      if (rawPiped && rawPiped.trim()) {
        if (rawPiped.includes('On branch') || rawPiped.includes('test') || rawPiped.includes('PASS') || rawPiped.includes('FAIL') || rawPiped.includes('error:')) {
          const filtered = filterCliOutput('', rawPiped);
          console.log(filtered);
          process.exit(0);
        } else {
          const res = await synthesizePrompt(rawPiped);
          copyToClipboard(res.optimizedText);
          console.log(res.optimizedText);
          process.exit(0);
        }
      }
    } catch {}
  }

  // =========================================================================
  // NATIVE COMMAND ROUTER / INTERCEPTOR
  // =========================================================================

  // 1. HELP / USAGE
  if ((!command && !isConversationMode && !isPaste) || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
\x1b[1m\x1b[36mGRAVITON\x1b[0m — Autonomous AI Acceleration Layer for Antigravity \x1b[90m(CLI: \x1b[33mgraviton\x1b[90m or \x1b[33mgrav\x1b[90m)\x1b[0m

\x1b[1mAUTONOMOUS ENGINES\x1b[0m
  Autonomous Execution Pipe      Non-interactive relay bypassing manual CLI confirmation pauses
  Brevity Protocol Enforcer      Enforces zero-fluff technical directives & strips AI preambles
  Surgical Diff Enforcer         Restricts code mutations to minimal blast radius & diff hunks
  Patch Response Economizer      Enforces Search/Replace patch responses instead of full rewrites
  Terminal Stream Filter         Strips build chatter, progress bars, and isolates errors
  Runtime Trace Squeezer         Prunes internal vendor & framework frames from error logs
  Selective Context Scoper       Targeted workspace mapping & referenced file extraction
  Static Import Resolver         Shallow dependency graph tracing across JS, TS, Py, Go, Rust
  Lockfile & Asset Shield        Blocks bulky dependency lockfiles and minified bundles
  Delta Diff Compressor          Sends only line-level diff hunks across conversational turns
  Structural Code Outliner       Collapses function bodies (>120 lines) & shrinks SVG paths
  Document Transpiler            Auto-transpiles Office (.docx, .pptx, .xlsx) & PDF to Markdown
  Content-Addressable Cache      Instant 0ms retrieval of transpiled documents via SHA-256 hashing
  JSON Schema Compactor          Squashes oversized JSON arrays into structural summaries
  Tabular Data Sampler           Smart tabular compaction for CSV, TSV, and large datasets
  Memory Distillation Engine     Compacts long multi-turn sessions into distilled memory blocks
  Syntax Sanity Validator        Pre/post-flight syntax checks with automated shadow rollback
  Noise & Secret Redactor        Prunes prompt filler noise and automatically redacts exposed keys
  Daemon & Port Guard            Automated background dev server management & conflict resolution
  Hierarchical Ignore Engine     Enforces recursive .gitignore and .gravignore exclusions

\x1b[1mUSAGE\x1b[0m \x1b[90m(Run with 'graviton' or shorthand 'grav')\x1b[0m
  graviton "<prompt>"            (or: grav "<prompt>")
  graviton <file> [prompt]       (Auto-transpiles .docx, .pdf, .pptx, .xlsx, .csv, code)
  graviton -c [number] [prompt]  (or: grav -c [number])
  graviton <command> [args...]   (or: grav <command>)
  <command> | graviton           (or: <command> | grav)

\x1b[1mOPTIONS\x1b[0m
  -f, --fast                     Fast execution mode without planning (effort: low)
  -d, --deep                     Deep architecture mode with full planning
  -p, --paste                    Attach clipboard content (images, files, text)
  -c, --conversation [number]    Open conversation history, select topic, or resume
  -n, --new                      Start a fresh conversation topic explicitly

\x1b[1mCOMMANDS\x1b[0m
  "<raw_text>"                   [DEFAULT] Synthesize prompt via Graviton Core & execute
  chat, repl                     Launch interactive REPL chat session (Antigravity CLI History support)
  diff                           Review colorized line-by-line diff of recent modifications made by AI
  doctor, doc                    Diagnose system health, Node.js runtime, & Antigravity (agy) installation
  compact, cmp                   Compact long continuous session to refresh context window & save tokens
  undo, rollback, rb             Revert files modified or created during the most recent AI session
  start <cmd...>                 Launch long-running dev server cleanly as background daemon (non-hanging)
  stop [port|all]                Terminate background daemon or free blocked development port
  ports, port                    Scan and display active listening development ports (3000, 5173, etc.)
  init [--global]                Initialize ~/.graviton directory and local Skill Vault
  stats, gain                    Display lifetime telemetry dashboard & token savings
  map                            Display workspace directory tree and detected dependencies
  clean "<raw_text>"             Only synthesize prompt & copy to clipboard (do not launch Antigravity)
  web, studio                    Launch Graviton Web Studio, live playground & visualizer (http://localhost:3000)
  run <cmd...>                   Execute CLI command with streamlined terminal output filtering
  version, -v                    Display Graviton CLI version

\x1b[1mCONVERSATION MANAGEMENT EXAMPLES (Using 'grav' shorthand)\x1b[0m
  # Open interactive conversation history picker:
  grav -c

  # Resume conversation #1 in interactive chat:
  grav -c 1

  # Execute instruction directly within conversation #1:
  grav -c 1 "add email validation in auth.js"

  # Delete conversation #2 from history:
  grav -c del 2

  # Explicitly start a fresh conversation:
  grav -n "create a new REST API endpoint"
`);
    process.exit(0);
  }

  // 1b. CONVERSATION MODE HANDLER (when no prompt is given)
  if (isConversationMode && filteredArgs.length === 0) {
    if (conversationAction === 'delete') {
      if (!conversationTarget) {
        console.error('\x1b[31mError: Specify the conversation number to delete (e.g. graviton -c del 2).\x1b[0m');
        process.exit(1);
      }
      const res = deleteWorkspaceConversation(process.cwd(), conversationTarget);
      if (res.success) {
        console.log(`\x1b[32m✔ ${res.message}\x1b[0m`);
      } else {
        console.log(`\x1b[31m✖ ${res.message}\x1b[0m`);
      }
      process.exit(0);
    }

    if (conversationTarget) {
      const selected = setActiveConversation(process.cwd(), conversationTarget);
      if (selected) {
        const hist = getConversationHistory(process.cwd(), selected.id, 5);
        console.log(formatConversationHistory(hist));
        console.log(`\x1b[90mEntering interactive chat with active conversation...\x1b[0m`);
        process.stdin.resume();
        await startChatRepl({ cwd: process.cwd(), isDeep });
        return;
      } else {
        console.log(`\x1b[31m✖ Conversation '${conversationTarget}' not found.\x1b[0m`);
      }
      process.exit(0);
    }

    // Launch interactive conversation picker
    const selected = await runInteractiveConversationPicker(process.cwd());
    if (selected && selected.id && !selected.deleted && !selected.isNew) {
      console.log(`\x1b[90mEntering interactive chat with active conversation...\x1b[0m`);
      process.stdin.resume();
      await startChatRepl({ cwd: process.cwd(), isDeep });
      return;
    }
    process.exit(0);
  }

  // 2. VERSION
  if (command === 'version' || command === '--version' || command === '-v') {
    let version = '2.0.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
      version = pkg.version || version;
    } catch {}
    console.log(`\x1b[1m\x1b[36mGRAVITON\x1b[0m v${version} (Graviton V3.0.0 Production-Ready Autonomous Engine)`);
    process.exit(0);
  }

  // 3. INIT (Setup ~/.graviton and Local Skill Vault)
  if (command === 'init' || command === '--init') {
    const gravitonDir = path.join(os.homedir(), '.graviton');
    const skillsDir = path.join(gravitonDir, 'skills');

    if (!fs.existsSync(skillsDir)) {
      fs.mkdirSync(skillsDir, { recursive: true });
    }

    const initialSkills = {
      'modern-web.md': `# Modern Web Guidance\nKeywords: web, modal, css, html, dialog, responsive, animation\nDirective: Enforce native <dialog>, CSS container queries, :has selectors, view transitions, and zero-layout-shift practices.`,
      'bigquery.md': `# BigQuery SQL Optimization\nKeywords: bigquery, sql, etl, partition, cluster, dataset, table\nDirective: Enforce partitioning, clustering, avoided SELECT *, and idempotent MERGE mutations.`,
      'antigravity-core.md': `# Antigravity Core Directive\nKeywords: performance, core, leak, background, relay, signal\nDirective: Enforce zero memory leaks, signal forwarding, and autonomous task execution with Auto-Allow.`
    };

    let createdCount = 0;
    for (const [filename, content] of Object.entries(initialSkills)) {
      const target = path.join(skillsDir, filename);
      if (!fs.existsSync(target)) {
        fs.writeFileSync(target, content, 'utf8');
        createdCount++;
      }
    }

    if (!fs.existsSync(STATS_FILE)) {
      saveStats({ commandsRun: 0, promptsOptimized: 0, tokensSaved: 0, linesFiltered: 0 });
    }

    const localIgnore = path.join(process.cwd(), '.gravignore');
    let ignoreStatus = 'Found';
    if (!fs.existsSync(localIgnore)) {
      const defaultIgnore = `# Graviton Ignore Rules (.gravignore)\n# Patterns matched here are strictly bypassed during file hydration and dependency scraping.\n\n# Sensitive credentials\n.env*\n*.pem\n*.key\nsecrets/\n\n# Build & dependency noise\nnode_modules/\ndist/\nbuild/\ncoverage/\n*.log\n\n# Minified bundles\n*.min.js\n*.min.css\n`;
      fs.writeFileSync(localIgnore, defaultIgnore, 'utf8');
      ignoreStatus = 'Created (.gravignore)';
    }

    console.log(`\n\x1b[1m\x1b[36m=== GRAVITON INITIALIZATION ===\x1b[0m`);
    console.log(`  \x1b[32m✔\x1b[0m Graviton Config Path : \x1b[1m${gravitonDir}\x1b[0m`);
    console.log(`  \x1b[32m✔\x1b[0m Local Skill Vault    : \x1b[1m${skillsDir}\x1b[0m`);
    console.log(`  \x1b[32m✔\x1b[0m Skills Status        : \x1b[1m${Object.keys(initialSkills).length}\x1b[0m skills available (${createdCount} new)`);
    console.log(`  \x1b[32m✔\x1b[0m Workspace Ignore     : \x1b[1m${ignoreStatus}\x1b[0m`);
    console.log(`  \x1b[32m✔\x1b[0m Auto-Allow Relay     : Active`);
    console.log(`\x1b[90mGraviton initialized successfully. Ready to accelerate Antigravity.\x1b[0m\n`);
    process.exit(0);
  }

  // 4. TELEMETRY & STATS DASHBOARD
  if (command === 'gain' || command === 'stats' || command === 'status' || command === '--gain' || command === '--stats' || command === '--status') {
    const dashboard = formatTelemetryDashboard();
    console.log(dashboard);
    process.exit(0);
  }

  // 4b. WEB STUDIO & VISUALIZER
  if (command === 'web' || command === 'studio' || command === 'ui') {
    const webDir = path.join(__dirname, '..', 'web');
    const serverPath = path.join(webDir, 'server.js');
    if (fs.existsSync(serverPath)) {
      console.log(`\n\x1b[1m\x1b[36m=== GRAVITON V3.0.0 WEB STUDIO ===\x1b[0m`);
      console.log(`\x1b[90mLocation: ${webDir}\x1b[0m\n`);
      const nodeModules = path.join(webDir, 'node_modules');
      if (!fs.existsSync(nodeModules)) {
        console.log(`\x1b[33mTo launch the local web visualizer and studio:\x1b[0m`);
        console.log(`  \x1b[36mcd web && npm install && npm start\x1b[0m\n`);
        console.log(`Then open \x1b[1mhttp://localhost:3000\x1b[0m in your browser.\n`);
      } else {
        console.log(`Starting Graviton Web Studio at \x1b[1mhttp://localhost:3000\x1b[0m...`);
        const proc = spawn('node', [serverPath], { cwd: webDir, stdio: 'inherit' });
        proc.on('close', code => process.exit(code || 0));
        return;
      }
    } else {
      console.log(`\x1b[33mGraviton Web Studio is located in the repository at ./web\x1b[0m`);
    }
    process.exit(0);
  }

  // 5. MAP & WORKSPACE HYDRATION
  if (command === 'map' || command === '--map') {
    const wsMap = buildWorkspaceMap(process.cwd());
    console.log(`\n\x1b[1m\x1b[36m=== GRAVITON WORKSPACE HYDRATION ===\x1b[0m`);
    console.log(wsMap);
    console.log(`\x1b[90mActive working directory mapped with depth 2.\x1b[0m\n`);
    process.exit(0);
  }

  // 5b. SAFETY ROLLBACK GUARD
  if (command === 'undo' || command === 'rollback' || command === 'rb' || command === '--undo' || command === '--rollback') {
    console.log('\x1b[36m[GRAVITON]\x1b[0m Initiating Safety Rollback Guard...');
    const res = executeRollback(process.cwd());
    if (res.success) {
      console.log(`\n\x1b[1m\x1b[32m=== GRAVITON ROLLBACK SUCCESSFUL ===\x1b[0m`);
      if (res.restored.length > 0) {
        console.log(`\x1b[32m  ✔ Restored ${res.restored.length} modified file(s):\x1b[0m`);
        res.restored.forEach(f => console.log(`     - \x1b[1m${f}\x1b[0m`));
      }
      if (res.removed.length > 0) {
        console.log(`\x1b[33m  ✔ Removed ${res.removed.length} newly created file(s):\x1b[0m`);
        res.removed.forEach(f => console.log(`     - \x1b[1m${f}\x1b[0m`));
      }
      console.log(`\n\x1b[90mWorkspace restored to pre-session state.\x1b[0m\n`);
    } else {
      console.log(`\x1b[33m[!] ${res.message || 'No changes to rollback.'}\x1b[0m`);
    }
    process.exit(0);
  }

  // 5c. BACKGROUND DAEMON LAUNCHER
  if (command === 'start') {
    const cmdToRun = filteredArgs.slice(1).join(' ');
    if (!cmdToRun) {
      console.error('\x1b[31mError: Please specify the command to run as a background daemon (e.g. graviton start "node server.js").\x1b[0m');
      process.exit(1);
    }
    console.log(`\x1b[36m[GRAVITON]\x1b[0m Starting background daemon: \x1b[1m${cmdToRun}\x1b[0m...`);
    const daemon = startBackgroundDaemon(cmdToRun, process.cwd());
    console.log(`\x1b[32m✔ Background daemon running (PID: ${daemon.pid})\x1b[0m`);
    console.log(`\x1b[90mUse 'graviton stop' to terminate, or 'graviton ports' to inspect listening ports.\x1b[0m\n`);
    process.exit(0);
  }

  // 5d. PORT GUARD & DAEMON STOPPER
  if (command === 'stop') {
    const target = filteredArgs[1] || 'all';
    console.log(`\x1b[36m[GRAVITON]\x1b[0m Stopping daemons / freeing port: \x1b[1m${target}\x1b[0m...`);
    const results = stopDaemonOrPort(target, process.cwd());
    if (results.length > 0) {
      results.forEach(r => {
        console.log(`\x1b[32m  ✔ ${r.message || `Stopped process ${r.target}`}\x1b[0m`);
      });
    } else {
      console.log(`\x1b[90mNo active background daemons or blocked ports found.\x1b[0m`);
    }
    process.exit(0);
  }

  // 5e. PORT SCANNER
  if (command === 'ports' || command === '--ports' || command === 'port') {
    console.log(`\n\x1b[1m\x1b[36m=== GRAVITON PORT GUARD: ACTIVE DEV PORTS ===\x1b[0m`);
    const active = listActivePorts();
    if (active.length === 0) {
      console.log(`  \x1b[32m✔\x1b[0m All common dev ports (3000, 3001, 4200, 5173, 8000, 8080) are free!`);
    } else {
      active.forEach(item => {
        console.log(`  \x1b[33m●\x1b[0m Port \x1b[1m${item.port}\x1b[0m is occupied by PID \x1b[1m${item.pid}\x1b[0m \x1b[90m(use 'graviton stop ${item.port}' to free)\x1b[0m`);
      });
    }
    console.log('');
    process.exit(0);
  }

  // 5f. INTERACTIVE REPL CHAT
  if (command === 'chat' || command === 'repl' || command === 'interactive') {
    await startChatRepl({ cwd: process.cwd(), isDeep });
    return;
  }

  // 5g. SMART SESSION COMPACTOR
  if (command === 'compact' || command === '--compact' || command === 'cmp') {
    console.log('\x1b[36m[GRAVITON]\x1b[0m Compacting active workspace session...');
    const res = compactWorkspaceSession(process.cwd());
    if (res.success) {
      console.log(`\x1b[32m✔ ${res.message}\x1b[0m`);
    } else {
      console.log(`\x1b[33m[!] ${res.message}\x1b[0m`);
    }
    process.exit(0);
  }

  // 5h. SYSTEM HEALTH DOCTOR
  if (command === 'doctor' || command === '--doctor' || command === 'doc') {
    const docResult = runDoctor(process.cwd(), { fix: rawArgs.includes('--fix') });
    console.log(formatDoctorReport(docResult));
    process.exit(docResult.allHealthy ? 0 : 1);
  }

  // 5i. SESSION DIFF REVIEW
  if (command === 'diff' || command === '--diff') {
    const diffReport = getSessionDiff(process.cwd());
    console.log(diffReport);
    process.exit(0);
  }

  // 6. SERVE WEB STUDIO
  if (command === 'serve' || command === '--serve') {
    const webServerPath = path.join(__dirname, '..', 'web', 'server.js');
    if (fs.existsSync(webServerPath)) {
      import(pathToFileURL(webServerPath).href);
    } else {
      console.log('\x1b[33m[!] Graviton Studio (web) is not found in this environment.\x1b[0m');
    }
    return;
  }

  // 6b. CLEAN ONLY
  if (command === 'clean') {
    let input = filteredArgs.slice(1).join(' ');
    if (!input && !process.stdin.isTTY) {
      input = fs.readFileSync(0, 'utf-8');
    }
    if (!input) {
      console.error('\x1b[31mError: Please provide prompt text.\x1b[0m');
      process.exit(1);
    }
    const superPrompt = constructSuperPrompt(input, process.cwd());
    copyToClipboard(superPrompt);
    console.log(superPrompt);
    console.error(`\n\x1b[32m✔ SuperPrompt assembled & Copied to clipboard!\x1b[0m \x1b[90m(Graviton Zero-Token Middleware)\x1b[0m`);
    process.exit(0);
  }

  // 6c. VERSION
  if (command === 'version' || command === '--version' || command === '-v') {
    console.log('GRAVITON v2.1.0 (Graviton V2.1.0 Intelligent Context Engine & Token Shield)');
    process.exit(0);
  }

  // 7. RUN / GIT / TEST CLI LOG PRUNER
  if (command === 'run' || command === 'git' || command === 'test') {
    let cmdToRun = command === 'git' ? 'git' : command === 'test' ? 'npm' : filteredArgs[1];
    let cmdArgs = command === 'git' ? filteredArgs.slice(1) : command === 'test' ? ['test', ...filteredArgs.slice(1)] : filteredArgs.slice(2);

    const fullCmd = [cmdToRun, ...cmdArgs].join(' ');
    const child = spawn(cmdToRun, cmdArgs, { shell: true, stdio: ['inherit', 'pipe', 'pipe'] });
    let rawOut = '';
    let rawErr = '';

    child.stdout.on('data', chunk => { rawOut += chunk.toString(); });
    child.stderr.on('data', chunk => { rawErr += chunk.toString(); });

    child.on('close', code => {
      const rawTotal = (rawOut + (rawErr ? '\n' + rawErr : '')).trim();
      if (!rawTotal) process.exit(code || 0);

      const filtered = filterCliOutput(fullCmd, rawTotal);
      const origLines = rawTotal.split('\n').length;
      const filteredLines = filtered.split('\n').length;
      const origTokens = estimateTokens(rawTotal);
      const filteredTokens = estimateTokens(filtered);

      const stats = loadStats();
      stats.commandsRun++;
      stats.linesFiltered += Math.max(0, origLines - filteredLines);
      stats.tokensSaved += Math.max(0, origTokens - filteredTokens);
      saveStats(stats);

      console.log(filtered);
      if (origLines > filteredLines) {
        const pct = Math.round(((origLines - filteredLines) / origLines) * 100);
        console.error(`\x1b[90m[graviton: ${origLines} → ${filteredLines} lines (${pct}% pruned, saved ~${Math.max(0, origTokens - filteredTokens)} tokens)]\x1b[0m`);
      }
      process.exit(code || 0);
    });
    return;
  }

  // =========================================================================
  // ZERO-TOKEN SUPERPROMPT ASSEMBLY & EXECUTION FLOW
  // =========================================================================
  let input = command === 'prompt' ? filteredArgs.slice(1).join(' ') : filteredArgs.join(' ');
  if (!input && !process.stdin.isTTY) {
    input = fs.readFileSync(0, 'utf-8');
  }

  const currentCwd = process.cwd();
  let clipboardAttachment = null;

  if (isPaste) {
    console.log(`\x1b[36m[GRAVITON CLIPBOARD]\x1b[0m Checking system clipboard...`);
    const clipResult = captureClipboard(currentCwd);
    if (clipResult.type === 'empty' && !input) {
      console.log(`\x1b[33m[!] Clipboard is empty. Please copy an image, file, or text first.\x1b[0m`);
      process.exit(0);
    }
    const formatted = formatClipboardAttachment(clipResult, input);
    input = formatted.enhancedPrompt;
    clipboardAttachment = formatted;
    if (formatted.summary) {
      console.log(`\x1b[35m[GRAVITON CLIPBOARD]\x1b[0m ${formatted.summary}`);
    }
  }

  let markdownTargetFile = null;
  if (isMarkdown && markdownFile) {
    const fullDocPath = path.resolve(currentCwd, markdownFile);
    if (fs.existsSync(fullDocPath)) {
      console.log(`\x1b[36m[GRAVITON AUTONOMOUS TRANSPILER]\x1b[0m Transpiling \x1b[1m${path.basename(fullDocPath)}\x1b[0m to clean Markdown...`);
      const transpiled = transpileFileToMarkdown(fullDocPath);
      input = `${transpiled}\n\nUser Request:\n${input || 'Please inspect and analyze this document, then assist with any necessary code changes.'}`;
      markdownTargetFile = path.relative(currentCwd, fullDocPath).replace(/\\/g, '/');
    } else {
      console.log(`\x1b[33m[!] Document file '${markdownFile}' was not found in workspace.\x1b[0m`);
    }
  } else if (filteredArgs.length > 0) {
    // Autonomous Document Detection: auto-executes when user passes docx, pdf, xlsx, pptx, csv without flags
    const firstArg = filteredArgs[0];
    const potentialDocPath = path.resolve(currentCwd, firstArg);
    if (fs.existsSync(potentialDocPath) && fs.statSync(potentialDocPath).isFile() && isTranspilableDocument(potentialDocPath)) {
      console.log(`\x1b[36m[GRAVITON AUTONOMOUS TRANSPILER]\x1b[0m Auto-detected document: \x1b[1m${path.basename(potentialDocPath)}\x1b[0m -> Transpiling to clean Markdown...`);
      const transpiled = transpileFileToMarkdown(potentialDocPath);
      const remainingPrompt = filteredArgs.slice(1).join(' ').trim();
      input = `${transpiled}\n\nUser Request:\n${remainingPrompt || 'Please inspect, analyze, and assist with this document.'}`;
      markdownTargetFile = path.relative(currentCwd, potentialDocPath).replace(/\\/g, '/');
    }
  }

  if (!input) {
    console.error('\x1b[31mError: Please provide prompt text, use -p with clipboard, or pipe into graviton.\x1b[0m');
    process.exit(1);
  }

  console.log(`\x1b[36m[GRAVITON]\x1b[0m Assembling SuperPrompt...`);
  let targetConversationId = null;
  let continueSession = false;
  let activeTitle = null;

  if (isNew) {
    clearWorkspaceSession(currentCwd);
    console.log(`\x1b[33m[GRAVITON]\x1b[0m Starting fresh conversation for workspace: \x1b[1m${currentCwd}\x1b[0m`);
  } else if (isConversationMode) {
    if (conversationTarget) {
      const selected = setActiveConversation(currentCwd, conversationTarget);
      if (selected) {
        targetConversationId = selected.id;
        continueSession = true;
        activeTitle = selected.title;
        console.log(`\x1b[36m[GRAVITON]\x1b[0m Resuming conversation [${conversationTarget}]: "\x1b[33m${activeTitle}\x1b[0m" (${targetConversationId.slice(0, 8)}...)`);
      } else {
        console.error(`\x1b[31mError: Conversation '${conversationTarget}' not found.\x1b[0m`);
        process.exit(1);
      }
    } else {
      const active = getActiveConversation(currentCwd);
      if (active && active.id) {
        targetConversationId = active.id;
        continueSession = true;
        activeTitle = active.title;
        console.log(`\x1b[36m[GRAVITON]\x1b[0m Continuing conversation: "\x1b[33m${activeTitle}\x1b[0m" (${targetConversationId.slice(0, 8)}...)`);
      } else {
        continueSession = false;
        console.log(`\x1b[36m[GRAVITON]\x1b[0m No active conversation found. Starting new conversation...`);
      }
    }
  } else {
    // DEFAULT FLOW: Each new command without -c automatically starts a fresh conversation!
    continueSession = false;
    targetConversationId = null;
    activeTitle = null;
    console.log(`\x1b[36m[GRAVITON]\x1b[0m Starting new conversation (use \x1b[33m-c\x1b[0m to resume existing topic)...`);
  }

  const superPrompt = constructSuperPrompt(input, currentCwd, {
    isContinuous: continueSession,
    conversationTitle: activeTitle,
    conversationId: targetConversationId,
    full: isFull,
    noDelta: isNoDelta,
    noSqueeze: isNoSqueeze,
    rawOutput: isRawOutput
  });

  const targetScope = resolveTargetScope(input, currentCwd);
  if (clipboardAttachment && clipboardAttachment.targetFiles && clipboardAttachment.targetFiles.length > 0) {
    for (const tf of clipboardAttachment.targetFiles) {
      if (!targetScope.targets.includes(tf)) {
        targetScope.targets.unshift(tf);
      }
    }
  }
  if (markdownTargetFile && !targetScope.targets.includes(markdownTargetFile)) {
    targetScope.targets.unshift(markdownTargetFile);
  }
  if (targetScope && targetScope.targets && targetScope.targets.length > 0) {
    const scopeLabel = targetScope.isLastTouch ? 'Last-Touch Context' : 'Smart Scoper';
    console.log(`\x1b[35m[GRAVITON CONTEXT SCOPER]\x1b[0m Targeted Files: \x1b[1m${targetScope.targets.join(', ')}\x1b[0m \x1b[90m(${scopeLabel})\x1b[0m`);
  } else {
    console.log(`\x1b[35m[GRAVITON CONTEXT SCOPER]\x1b[0m Workspace Mapping Active \x1b[90m(General Exploration)\x1b[0m`);
  }

  const stats = loadStats();
  stats.promptsOptimized++;
  saveStats(stats);

  copyToClipboard(superPrompt);

  // Port Conflict Auto-Healer & Dev Server Pre-Interceptor
  const isDevServerPrompt = /\b(jalankan|start|nyalakan|run|serve|host)\b/i.test(input) && /\b(dev|server|web|vite|next|app|localhost|port)(?:nya)?\b/i.test(input);
  if (isDevServerPrompt) {
    const commonPorts = [3000, 5173, 8080];
    for (const port of commonPorts) {
      const occupied = findProcessOnPort(port);
      if (occupied) {
        console.log(`\x1b[33m[GRAVITON PORT HEALER]\x1b[0m Port ${port} occupied by PID ${occupied.pid}. Auto-freeing...`);
        killProcessOnPort(port);
      }
    }

    // Pure Run Interceptor: If user simply wants to run existing web/server and didn't ask to create/edit/inspect files
    const isPureRunPrompt = /^(?:coba\s+)?(?:tolong\s+)?(?:jalankan|start|nyalakan|run|serve|host)\s+(?:web(?:nya)?|server(?:nya)?|dev|app(?:nya)?|localhost)$/i.test(input.trim())
      || /^(?:jalankan|start|nyalakan|run)\s+(?:web(?:nya)?|server(?:nya)?)$/i.test(input.trim());
    const isNotInspectOrCreate = !/\b(cek|lihat|buat|bikin|create|edit|ubah|ganti|tambah|fix|perbaiki)\b/i.test(input);

    if (isPureRunPrompt && isNotInspectOrCreate) {
      const existingDev = detectWorkspaceDevServer(currentCwd);
      if (existingDev && existingDev.exists && existingDev.command) {
        console.log(`\x1b[36m[GRAVITON]\x1b[0m Detected existing dev server (\x1b[1m${existingDev.command}\x1b[0m). Launching background daemon...`);
        const daemon = startBackgroundDaemon(existingDev.command, currentCwd);
        console.log(`\x1b[1m\x1b[32m✔ Web server active at \x1b[1;36mhttp://localhost:${existingDev.port}/\x1b[0m (PID: ${daemon.pid})`);
        console.log(`\x1b[90mTip: Run 'grav stop' to terminate, or 'grav ports' to view listening ports.\x1b[0m\n`);
        process.exit(0);
      }
    }
  }

  const result = runAntigravityWithAutoAllow(superPrompt, {
    conversationId: targetConversationId,
    continueSession,
    cwd: currentCwd,
    isDeep,
    isFast,
    userPrompt: input,
    effort: isFast ? 'low' : (isDeep ? 'high' : 'high'),
    mode: isFast ? 'accept-edits' : (isDeep ? 'plan' : 'accept-edits')
  });

  if (result && result.error) {
    console.error('Spawn Error:', result.error);
    process.exit(1);
  }

  if (result && result.status !== 0 && result.status !== null) {
    process.exit(result.status);
  }

  // Post-Execution Dev Server Daemonizer:
  // If the prompt requested running or serving a web server, ensure background daemon is active!
  if (isDevServerPrompt) {
    const devServer = detectWorkspaceDevServer(currentCwd);
    if (devServer && devServer.exists && devServer.command) {
      const active = findProcessOnPort(devServer.port);
      if (!active) {
        const daemon = startBackgroundDaemon(devServer.command, currentCwd);
        console.log(`\n\x1b[1m\x1b[32m[GRAVITON DEV DAEMON]\x1b[0m Web server running at \x1b[1;36mhttp://localhost:${devServer.port}/\x1b[0m (PID: ${daemon.pid})`);
        console.log(`\x1b[90mTip: Run 'grav stop' to terminate, or 'grav ports' to view listening ports.\x1b[0m\n`);
      } else {
        console.log(`\n\x1b[1m\x1b[32m[GRAVITON DEV DAEMON]\x1b[0m Web server is actively listening at \x1b[1;36mhttp://localhost:${devServer.port}/\x1b[0m (PID: ${active.pid})\n`);
      }
    }
  }

  const odo = readOdometer();
  const activeSession = getActiveConversation(currentCwd);
  const sessionTag = activeSession && activeSession.id
    ? `Topic: "${activeSession.title}" (${activeSession.id.slice(0, 8)}...) | `
    : '';
  console.log(`\x1b[32m✔ Execution complete. (${sessionTag}Session Est: ${odo.lastSessionTokens} tokens | Total: ${odo.totalTokens} tokens)\x1b[0m`);
  process.exit(0);
}

main().catch(err => {
  const message = err && err.message ? err.message : String(err);
  console.error(`\x1b[1;31m[🚨 GRAVITON ERROR]\x1b[0m \x1b[31m${message}\x1b[0m`);
  process.exit(1);
});
