#!/usr/bin/env node
// bin/graviton.js - Official GRAVITON CLI: Full-Spectrum Token & Output Killer with Auto-Allow Relay

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { synthesizePrompt, estimateTokens } from '../src/pipeline.js';
import { filterCliOutput } from '../src/cli-filter.js';
import { detectWorkspaceContext } from '../src/workspace-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const STATS_FILE = path.join(os.homedir(), '.graviton-stats.json');
const AGY_PATH = 'C:\\Users\\WINDOWS\\.gemini\\bin\\agy.exe';

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

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  // Check if piped from stdin (e.g. `git status | graviton` or `cat prompt.txt | graviton`)
  if (!process.stdin.isTTY && !command) {
    const rawPiped = fs.readFileSync(0, 'utf-8');
    if (rawPiped.trim()) {
      // If it looks like terminal output or logs
      if (rawPiped.includes('On branch') || rawPiped.includes('test') || rawPiped.includes('PASS') || rawPiped.includes('FAIL') || rawPiped.includes('error:')) {
        const filtered = filterCliOutput('', rawPiped);
        console.log(filtered);
        process.exit(0);
      } else {
        // Piped prompt
        const res = await synthesizePrompt(rawPiped, process.env.GEMINI_API_KEY || null);
        copyToClipboard(res.optimizedText);
        console.log(res.optimizedText);
        process.exit(0);
      }
    }
  }

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    console.log(`
\x1b[1m\x1b[35mGRAVITON\x1b[0m — Autonomous AI Acceleration Layer for Antigravity

\x1b[1mUSAGE\x1b[0m
  graviton [options] "<prompt>"
  <command> | graviton

\x1b[1mCOMMANDS\x1b[0m
  \x1b[32m"<raw_text>"\x1b[0m         [DEFAULT] Synthesize prompt with lean model & run Antigravity with Auto-Allow!
  \x1b[32m-c, --continue\x1b[0m       Resume previous Antigravity session with synthesized prompt & auto-allow
  \x1b[32mclean\x1b[0m "<raw_text>"    Only synthesize prompt & copy to clipboard (do not launch Antigravity)
  \x1b[32mrun\x1b[0m <cmd...>          Execute CLI command with zero-latency RTK output pruning
  \x1b[32mgit\x1b[0m <git_args...>     Shorthand for "graviton run git <git_args>"
  \x1b[32mtest\x1b[0m <test_args...>   Shorthand for "graviton run test <test_args>"
  \x1b[32mgain\x1b[0m                  Display aggregate tokens & lines pruned across sessions
  \x1b[32mserve\x1b[0m                 Launch local luxury Web Studio on port 3000

\x1b[1mEXAMPLES\x1b[0m
  # 1-Shot: Auto-prune + auto-forward + auto-allow:
  graviton "perbaiki login auth.js kodenya..."

  # Resume previous session:
  graviton -c "sekarang buatkan unit testnya"

  # Pipe terminal outputs (RTK style):
  git status | graviton
`);
    process.exit(0);
  }

  // GAIN STATS
  if (command === 'gain') {
    const stats = loadStats();
    console.log(`\n\x1b[1m\x1b[35m=== GRAVITON EFFICIENCY GAINS ===\x1b[0m`);
    console.log(`  \x1b[36mCommands Processed    :\x1b[0m ${stats.commandsRun.toLocaleString()}`);
    console.log(`  \x1b[36mPrompts Synthesized   :\x1b[0m ${stats.promptsOptimized.toLocaleString()}`);
    console.log(`  \x1b[32mEstimated Tokens Saved:\x1b[0m \x1b[1m${stats.tokensSaved.toLocaleString()}\x1b[0m tokens`);
    console.log(`  \x1b[32mLines Filtered Out    :\x1b[0m \x1b[1m${stats.linesFiltered.toLocaleString()}\x1b[0m lines`);
    console.log(`\x1b[90mKeep your AI context clean and focused.\x1b[0m\n`);
    process.exit(0);
  }

  // SERVE WEB STUDIO
  if (command === 'serve') {
    import('../src/server.js');
    return;
  }

  // CLEAN ONLY
  if (command === 'clean') {
    let input = args.slice(1).join(' ');
    if (!input && !process.stdin.isTTY) {
      input = fs.readFileSync(0, 'utf-8');
    }
    if (!input) {
      console.error('\x1b[31mError: Please provide prompt text.\x1b[0m');
      process.exit(1);
    }
    const result = await synthesizePrompt(input, process.env.GEMINI_API_KEY || null);
    copyToClipboard(result.optimizedText);
    console.log(result.optimizedText);
    console.error(`\n\x1b[32m✔ Synthesized & Copied to clipboard!\x1b[0m \x1b[90m(-${result.stats.percentSaved}% tokens saved via ${result.stats.engine})\x1b[0m`);
    process.exit(0);
  }

  // RUN / GIT / TEST CLI LOG PRUNER
  if (command === 'run' || command === 'git' || command === 'test') {
    let cmdToRun = command === 'git' ? 'git' : command === 'test' ? 'npm' : args[1];
    let cmdArgs = command === 'git' ? args.slice(1) : command === 'test' ? ['test', ...args.slice(1)] : args.slice(2);

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

  // CHECK CONTINUE SESSION FLAG (-c / --continue)
  let isContinue = false;
  let rawArgs = args;
  if (command === '-c' || command === '--continue') {
    isContinue = true;
    rawArgs = args.slice(1);
  }

  let input = command === 'prompt' ? rawArgs.slice(1).join(' ') : rawArgs.join(' ');
  if (!input && !process.stdin.isTTY) {
    input = fs.readFileSync(0, 'utf-8');
  }
  if (!input) {
    console.error('\x1b[31mError: Please provide prompt text or pipe into graviton.\x1b[0m');
    process.exit(1);
  }

  console.log(`\x1b[35m[1/3 GRAVITON]\x1b[0m Synthesizing prompt with free lean engine...`);
  const apiKey = process.env.GEMINI_API_KEY || null;
  const result = await synthesizePrompt(input, apiKey);

  const stats = loadStats();
  stats.promptsOptimized++;
  stats.tokensSaved += result.stats.tokensSaved;
  saveStats(stats);

  copyToClipboard(result.optimizedText);
  console.log(`\x1b[32m[2/3 PROMPT SYNTHESIZED]\x1b[0m Saved ${result.stats.tokensSaved} tokens (-${result.stats.percentSaved}%). Copied to clipboard.`);
  console.log(`\x1b[90m--------------------------------------------------\x1b[0m`);
  console.log(result.optimizedText);
  console.log(`\x1b[90m--------------------------------------------------\x1b[0m`);

  console.log(`\x1b[36m[3/3 RELAYING TO ANTIGRAVITY]\x1b[0m Launching Antigravity with \x1b[1mAuto-Allow (--dangerously-skip-permissions)\x1b[0m...`);

  const agyArgs = [
    '--dangerously-skip-permissions',
    '--effort', 'high',
    '--mode', 'accept-edits'
  ];

  if (isContinue) {
    agyArgs.push('--continue');
  }

  agyArgs.push('--prompt-interactive', result.optimizedText);

  const agyChild = spawn(AGY_PATH, agyArgs, {
    stdio: 'inherit',
    shell: true
  });

  agyChild.on('close', code => {
    process.exit(code || 0);
  });
}

main().catch(err => {
  console.error('\x1b[31mGraviton Error:\x1b[0m', err);
  process.exit(1);
});
