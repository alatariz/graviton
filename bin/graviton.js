#!/usr/bin/env node
// bin/graviton.js - Official GRAVITON CLI: Graviton V1.7.0 Interceptor Autonomous Execution Layer

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
  const isWin = process.platform === 'win32';
  if (isWin) {
    const proc = spawn('clip', { stdio: ['pipe', 'ignore', 'ignore'] });
    proc.stdin.write(text);
    proc.stdin.end();
  } else if (process.platform === 'darwin') {
    const proc = spawn('pbcopy', { stdio: ['pipe', 'ignore', 'ignore'] });
    proc.stdin.write(text);
    proc.stdin.end();
  } else {
    try {
      const proc = spawn('xclip', ['-selection', 'clipboard'], { stdio: ['pipe', 'ignore', 'ignore'] });
      proc.stdin.write(text);
      proc.stdin.end();
    } catch (e) {}
  }
}

const rawArgs = process.argv.slice(2);

async function main() {
  // 1. Version Banner: At the very beginning of CLI execution
  console.log('\x1b[1;36m[Graviton V1.8.0 Active]\x1b[0m');

  // Fire-and-forget self-cleaning shadow backup (zero latency impact)
  purgeOldBackups();

  // Parse boolean flags
  let isDeep = false;
  let isContinue = false;
  const filteredArgs = [];

  for (const arg of rawArgs) {
    if (arg === '--deep') {
      isDeep = true;
    } else if (arg === '-c' || arg === '--continue') {
      isContinue = true;
    } else if (arg !== '--dry-run') {
      filteredArgs.push(arg);
    }
  }

  const command = filteredArgs[0];

  // Check if piped from stdin (e.g. `git status | graviton` or `cat prompt.txt | graviton`)
  if (!process.stdin.isTTY && !command) {
    const rawPiped = fs.readFileSync(0, 'utf-8');
    if (rawPiped.trim()) {
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
  }

  // =========================================================================
  // NATIVE COMMAND ROUTER / INTERCEPTOR
  // =========================================================================
  // Intercept and route internal Graviton utility commands immediately.
  // Native commands MUST execute internal logic and call process.exit(0).
  // Under NO circumstances should native commands be sent to constructSuperPrompt
  // or relayed to the Antigravity child process!
  // =========================================================================

  // 1. HELP / USAGE
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
\x1b[1m\x1b[36mGRAVITON\x1b[0m — Autonomous AI Acceleration Layer for Antigravity

\x1b[1mUSAGE\x1b[0m
  graviton [options] "<prompt>"
  graviton <command> [args...]
  <command> | graviton

\x1b[1mOPTIONS\x1b[0m
  \x1b[33m--deep\x1b[0m                  Activate deep precision synthesis for complex technical architecture
  \x1b[33m-c, --continue\x1b[0m          Resume previous Antigravity session with synthesized prompt & auto-allow

\x1b[1mCOMMANDS\x1b[0m
  \x1b[32m"<raw_text>"\x1b[0m            [DEFAULT] Synthesize prompt via Graviton Core & execute with Antigravity Auto-Allow
  \x1b[32minit\x1b[0m [--global]         Initialize ~/.graviton directory and local Skill Vault
  \x1b[32mstats\x1b[0m, \x1b[32mgain\x1b[0m             Display lifetime telemetry dashboard & token savings
  \x1b[32mmap\x1b[0m                     Display workspace directory tree and detected dependencies
  \x1b[32mclean\x1b[0m "<raw_text>"       Only synthesize prompt & copy to clipboard (do not launch Antigravity)
  \x1b[32mrun\x1b[0m <cmd...>             Execute CLI command with streamlined terminal output filtering
  \x1b[32mgit\x1b[0m <git_args...>        Shorthand for "graviton run git <git_args>"
  \x1b[32mtest\x1b[0m <test_args...>      Shorthand for "graviton run test <test_args>"
  \x1b[32mserve\x1b[0m                    Launch local Web Studio on port 3000
  \x1b[32mversion\x1b[0m, \x1b[32m-v\x1b[0m             Display Graviton CLI version

\x1b[1mEXAMPLES\x1b[0m
  # Synthesize prompt and execute with Antigravity:
  graviton "Refactor auth.js to handle session expiration"

  # Deep precision architecture synthesis:
  graviton --deep "Build webhook handler for Stripe payments"

  # Pipe terminal outputs to Graviton:
  git status | graviton
`);
    process.exit(0);
  }

  // 2. VERSION
  if (command === 'version' || command === '--version' || command === '-v') {
    let version = '1.8.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
      version = pkg.version || version;
    } catch {}
    console.log(`\x1b[1m\x1b[36mGRAVITON\x1b[0m v${version} (Graviton V1.8.0 Execution Vanguard)`);
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

  // 4. TELEMETRY & STATS DASHBOARD (V1.7.0)
  if (command === 'gain' || command === 'stats' || command === 'status' || command === '--gain' || command === '--stats' || command === '--status') {
    const dashboard = formatTelemetryDashboard();
    console.log(dashboard);
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

  // 6. SERVE WEB STUDIO (Optional Local Web Dashboard)
  if (command === 'serve' || command === '--serve') {
    const webServerPath = path.join(__dirname, '..', 'web', 'server.js');
    if (fs.existsSync(webServerPath)) {
      import(pathToFileURL(webServerPath).href);
    } else {
      console.log('\x1b[33m[!] Graviton Studio (web) is not found in this environment.\x1b[0m');
    }
    return;
  }

  // 6. CLEAN ONLY (Prompt synthesis without Antigravity launch)
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

  // 7. RUN / GIT / TEST CLI LOG PRUNER (Streamlined terminal output filtering)
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

  // ZERO-TOKEN SUPERPROMPT ASSEMBLY & EXECUTION FLOW
  let input = command === 'prompt' ? filteredArgs.slice(1).join(' ') : filteredArgs.join(' ');
  if (!input && !process.stdin.isTTY) {
    input = fs.readFileSync(0, 'utf-8');
  }
  if (!input) {
    console.error('\x1b[31mError: Please provide prompt text or pipe into graviton.\x1b[0m');
    process.exit(1);
  }

  console.log(`\x1b[36m[GRAVITON]\x1b[0m Assembling SuperPrompt...`);

  const currentCwd = process.cwd();
  const superPrompt = constructSuperPrompt(input, currentCwd);

  const stats = loadStats();
  stats.promptsOptimized++;
  saveStats(stats);

  copyToClipboard(superPrompt);

  const exitCode = await runAntigravityWithAutoAllow(superPrompt, {
    continueSession: isContinue
  });

  if (exitCode === 0) {
    const odo = readOdometer();
    console.log(`\x1b[32m✔ Execution complete. (Session Est: ${odo.lastSessionTokens} tokens | Total: ${odo.totalTokens} tokens)\x1b[0m`);
  }
  process.exit(exitCode || 0);
}

main().catch(err => {
  const message = err && err.message ? err.message : String(err);
  console.error(`\x1b[1;31m[🚨 GRAVITON ERROR]\x1b[0m \x1b[31m${message}\x1b[0m`);
  process.exit(1);
});
