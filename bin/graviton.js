#!/usr/bin/env node
// bin/graviton.js - Official GRAVITON CLI: Meta 2026 Dual-Clutch Engine with Autonomous Auto-Allow Relay

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { synthesizePrompt, estimateTokens } from '../src/pipeline.js';
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
  // Parse boolean flags
  let isDryRun = false;
  let isDeep = false;
  let isContinue = false;
  const filteredArgs = [];

  for (const arg of rawArgs) {
    if (arg === '--dry-run') {
      isDryRun = true;
    } else if (arg === '--deep') {
      isDeep = true;
    } else if (arg === '-c' || arg === '--continue') {
      isContinue = true;
    } else {
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
        const res = await synthesizePrompt(rawPiped, process.env.GEMINI_API_KEY || null, { deep: isDeep });
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
  // Under NO circumstances should native commands be sent to repromptWithAI
  // or relayed to the Antigravity child process!
  // =========================================================================

  // 1. HELP / USAGE
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(`
\x1b[1m\x1b[36mGRAVITON\x1b[0m — Autonomous AI Acceleration Layer for Antigravity (Meta 2026)

\x1b[1mUSAGE\x1b[0m
  graviton [options] "<prompt>"
  graviton <command> [args...]
  <command> | graviton

\x1b[1mOPTIONS\x1b[0m
  \x1b[33m--dry-run\x1b[0m               Simulate token reduction & display savings without launching Antigravity
  \x1b[33m--deep\x1b[0m                  Activate Gear 2 (Gemini 3.1 Pro Architect) for complex system decomposition
  \x1b[33m-c, --continue\x1b[0m          Resume previous Antigravity session with synthesized prompt & auto-allow

\x1b[1mCOMMANDS\x1b[0m
  \x1b[32m"<raw_text>"\x1b[0m            [DEFAULT] Synthesize prompt via Dual-Clutch Engine & run Antigravity with Auto-Allow
  \x1b[32minit\x1b[0m [--global]         Initialize ~/.graviton directory and local Skill Vault
  \x1b[32mgain\x1b[0m, \x1b[32mstats\x1b[0m             Display aggregate tokens & lines pruned across sessions
  \x1b[32mclean\x1b[0m "<raw_text>"       Only synthesize prompt & copy to clipboard (do not launch Antigravity)
  \x1b[32mrun\x1b[0m <cmd...>             Execute CLI command with zero-latency RTK output pruning
  \x1b[32mgit\x1b[0m <git_args...>        Shorthand for "graviton run git <git_args>"
  \x1b[32mtest\x1b[0m <test_args...>      Shorthand for "graviton run test <test_args>"
  \x1b[32mserve\x1b[0m                    Launch local Web Studio on port 3000
  \x1b[32mversion\x1b[0m, \x1b[32m-v\x1b[0m             Display Graviton CLI version

\x1b[1mEXAMPLES\x1b[0m
  # Default 1-Shot with Gear 1 (Flash 3.8 Sanitizer):
  graviton "perbaiki login auth.js kodenya..."

  # Deep Architectural Breakdown with Gear 2 (Pro 3.1 Architect):
  graviton --deep "buatkan payment gateway webhook handler"

  # Dry-run token savings forecast:
  graviton --dry-run "buat query BigQuery transaksi harian..."

  # Pipe terminal outputs (RTK style):
  git status | graviton
`);
    process.exit(0);
  }

  // 2. VERSION
  if (command === 'version' || command === '--version' || command === '-v') {
    let version = '1.0.0';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
      version = pkg.version || version;
    } catch {}
    console.log(`\x1b[1m\x1b[36mGRAVITON\x1b[0m v${version} (Meta 2026 Overclocking Architecture)`);
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
      'antigravity-overclock.md': `# Antigravity Overclocking Directive\nKeywords: overclock, performance, leak, background, relay, signal\nDirective: Enforce zero memory leaks, signal forwarding, and autonomous task execution with Auto-Allow.`
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

    console.log(`\n\x1b[1m\x1b[36m=== GRAVITON INITIALIZATION ===\x1b[0m`);
    console.log(`  \x1b[32m✔\x1b[0m Graviton Config Path : \x1b[1m${gravitonDir}\x1b[0m`);
    console.log(`  \x1b[32m✔\x1b[0m Local Skill Vault    : \x1b[1m${skillsDir}\x1b[0m`);
    console.log(`  \x1b[32m✔\x1b[0m Skills Status        : \x1b[1m${Object.keys(initialSkills).length}\x1b[0m skills available (${createdCount} new)`);
    console.log(`  \x1b[32m✔\x1b[0m Auto-Allow Relay     : Active`);
    console.log(`\x1b[90mGraviton initialized successfully. Ready to accelerate Antigravity.\x1b[0m\n`);
    process.exit(0);
  }

  // 4. GAIN & STATS
  if (command === 'gain' || command === 'stats' || command === '--gain' || command === '--stats') {
    const stats = loadStats();
    console.log(`\n\x1b[1m\x1b[36m=== GRAVITON EFFICIENCY GAINS ===\x1b[0m`);
    console.log(`  \x1b[36mCommands Processed    :\x1b[0m ${stats.commandsRun.toLocaleString()}`);
    console.log(`  \x1b[36mPrompts Synthesized   :\x1b[0m ${stats.promptsOptimized.toLocaleString()}`);
    console.log(`  \x1b[32mEstimated Tokens Saved:\x1b[0m \x1b[1m${stats.tokensSaved.toLocaleString()}\x1b[0m tokens`);
    console.log(`  \x1b[32mLines Filtered Out    :\x1b[0m \x1b[1m${stats.linesFiltered.toLocaleString()}\x1b[0m lines`);
    console.log(`\x1b[90mKeep your AI context clean, fast, and focused.\x1b[0m\n`);
    process.exit(0);
  }

  // 5. SERVE WEB STUDIO
  if (command === 'serve' || command === '--serve') {
    import('../src/server.js');
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
    const result = await synthesizePrompt(input, process.env.GEMINI_API_KEY || null, { deep: isDeep });
    copyToClipboard(result.optimizedText);
    console.log(result.optimizedText);
    console.error(`\n\x1b[32m✔ Synthesized & Copied to clipboard!\x1b[0m \x1b[90m(-${result.stats.percentSaved}% tokens saved via ${result.stats.engine})\x1b[0m`);
    process.exit(0);
  }

  // 7. RUN / GIT / TEST CLI LOG PRUNER (Zero-latency RTK output pruning)
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

  // PROMPT SYNTHESIS & EXECUTION FLOW
  let input = command === 'prompt' ? filteredArgs.slice(1).join(' ') : filteredArgs.join(' ');
  if (!input && !process.stdin.isTTY) {
    input = fs.readFileSync(0, 'utf-8');
  }
  if (!input) {
    console.error('\x1b[31mError: Please provide prompt text or pipe into graviton.\x1b[0m');
    process.exit(1);
  }

  console.log(`\x1b[35m[1/3 GRAVITON]\x1b[0m Synthesizing prompt via \x1b[1mUnified Meta 2026 Engine\x1b[0m...`);

  const apiKey = process.env.GEMINI_API_KEY || null;
  const result = await synthesizePrompt(input, apiKey, { deep: isDeep });

  const stats = loadStats();
  stats.promptsOptimized++;
  stats.tokensSaved += result.stats.tokensSaved;
  saveStats(stats);

  copyToClipboard(result.optimizedText);

  // DRY-RUN / GAIN FORECASTER
  if (isDryRun) {
    console.log(`\n\x1b[33m[DRY-RUN GAIN FORECASTER]\x1b[0m Execution bypassed (--dry-run active)`);
    console.log(`\x1b[1mRaw: ${result.stats.originalTokens} tokens -> Graviton: ${result.stats.optimizedTokens} tokens. Saved: ${result.stats.percentSaved}%.\x1b[0m`);
    console.log(`\x1b[90mEngine: ${result.stats.engine}\x1b[0m`);
    console.log(`\x1b[90m--------------------------------------------------\x1b[0m`);
    console.log(result.optimizedText);
    console.log(`\x1b[90m--------------------------------------------------\x1b[0m`);
    console.log(`\x1b[32m✔ Synthesized prompt copied to clipboard!\x1b[0m\n`);
    process.exit(0);
  }

  console.log(`\x1b[32m[2/3 PROMPT SYNTHESIZED]\x1b[0m Saved ${result.stats.tokensSaved} tokens (-${result.stats.percentSaved}% via ${result.stats.engine}). Copied to clipboard.`);
  console.log(`\x1b[90m--------------------------------------------------\x1b[0m`);
  console.log(result.optimizedText);
  console.log(`\x1b[90m--------------------------------------------------\x1b[0m`);

  console.log(`\x1b[36m[3/3 RELAYING TO ANTIGRAVITY]\x1b[0m Launching Antigravity in \x1b[1mOne-Shot Auto-Allow Mode\x1b[0m...`);

  const child = runAntigravityWithAutoAllow(result.optimizedText, {
    continueSession: isContinue
  });

  child.on('close', code => {
    process.exit(code || 0);
  });
}

main().catch(err => {
  console.error('\x1b[31mGraviton Error:\x1b[0m', err);
  process.exit(1);
});
