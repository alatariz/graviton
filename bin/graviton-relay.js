// bin/graviton-relay.js - Graviton Meta 2026: Autonomous Auto-Allow Relay
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Dynamically resolves the agy executable path across Windows, macOS, and Linux
 * by searching through process.env.PATH and checking standard fallback directories.
 */
export function resolveAgyExecutable() {
  const isWindows = process.platform === 'win32';
  const binName = 'agy';
  const pathexts = isWindows
    ? (process.env.PATHEXT ? process.env.PATHEXT.split(';') : ['.EXE', '.CMD', '.BAT'])
    : [''];

  const envPath = process.env.PATH || process.env.Path || '';
  const dirs = envPath.split(path.delimiter);

  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of pathexts) {
      const candidate = path.join(dir, isWindows ? `${binName}${ext.toLowerCase()}` : binName);
      try {
        if (fs.existsSync(candidate)) {
          if (!isWindows) {
            fs.accessSync(candidate, fs.constants.X_OK);
          }
          return candidate;
        }
        if (isWindows && ext) {
          const upperCandidate = path.join(dir, `${binName}${ext.toUpperCase()}`);
          if (fs.existsSync(upperCandidate)) {
            return upperCandidate;
          }
        }
      } catch {
        // Skip directory if not readable
      }
    }
  }

  // Fallback: check ~/.gemini/bin/agy[.exe]
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  if (homeDir) {
    const candidate = path.join(homeDir, '.gemini', 'bin', isWindows ? 'agy.exe' : 'agy');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Default fallback to command name for standard shell resolution
  return isWindows ? 'agy.cmd' : 'agy';
}

/**
 * Executes Antigravity with autonomous Auto-Allow bypass.
 * Programmatically intercepts stdout/stderr for interactive approval prompts ([Y/n], Allow this?, Press Enter)
 * and feeds affirmative response to stdin for 100% autonomous operation.
 */
export function runAntigravityWithAutoAllow(promptText, options = {}) {
  const agyExecutable = resolveAgyExecutable();

  const args = [
    '--dangerously-skip-permissions',
    '--effort', options.effort || 'high',
    '--mode', options.mode || 'accept-edits'
  ];

  if (options.continueSession) {
    args.push('--continue');
  }

  if (options.printOnly) {
    args.push('--print', promptText);
  } else {
    args.push('--prompt-interactive', promptText);
  }

  console.log(`\x1b[35m[GRAVITON ➔ ANTIGRAVITY RELAY]\x1b[0m Auto-Allow Active (--dangerously-skip-permissions)`);

  const child = spawn(agyExecutable, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false
  });

  // Relay process.stdin to child
  if (process.stdin.isTTY) {
    process.stdin.setRawMode?.(true);
    process.stdin.resume();
    process.stdin.pipe(child.stdin);
  }

  // Approval prompt patterns
  const approvalPromptRegex = /(?:\[[Yy]\/[Nn]\]|\([Yy]\/[Nn]\)|Allow\s+(?:this|once|always)|Press\s+Enter|Do\s+you\s+want\s+to\s+proceed|Confirm\?|Approve\?)/i;
  const pressEnterRegex = /Press\s+Enter/i;

  let streamBuffer = '';

  function handleOutputChunk(chunk, targetStream) {
    targetStream.write(chunk);
    const text = chunk.toString();
    streamBuffer += text;

    // Retain only last 500 characters to check prompt
    if (streamBuffer.length > 500) {
      streamBuffer = streamBuffer.slice(-500);
    }

    if (approvalPromptRegex.test(streamBuffer)) {
      if (pressEnterRegex.test(streamBuffer)) {
        child.stdin.write('\n');
        process.stdout.write('\n\x1b[33m[GRAVITON AUTO-ALLOW]\x1b[0m Auto-pressed Enter.\n');
      } else {
        child.stdin.write('y\n');
        process.stdout.write('\n\x1b[33m[GRAVITON AUTO-ALLOW]\x1b[0m Auto-confirmed with "y".\n');
      }
      streamBuffer = '';
    }
  }

  child.stdout.on('data', (chunk) => handleOutputChunk(chunk, process.stdout));
  child.stderr.on('data', (chunk) => handleOutputChunk(chunk, process.stderr));

  // Forward termination signals
  const forwardSignal = (signal) => {
    if (child && !child.killed) {
      try {
        child.kill(signal);
      } catch {
        // Child might have already exited
      }
    }
  };

  const sigintHandler = () => forwardSignal('SIGINT');
  const sigtermHandler = () => forwardSignal('SIGTERM');

  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);

  child.on('exit', (code, signal) => {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode?.(false);
      process.stdin.pause();
    }
    process.removeListener('SIGINT', sigintHandler);
    process.removeListener('SIGTERM', sigtermHandler);
    if (code !== null) {
      process.exitCode = code;
    } else if (signal) {
      process.kill(process.pid, signal);
    }
  });

  return child;
}
