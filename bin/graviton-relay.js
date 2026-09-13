// bin/graviton-relay.js - Runs agy with --dangerously-skip-permissions
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

export function runAntigravityWithAutoAllow(promptText, options = {}) {
  const agyPath = resolveAgyExecutable();

  const args = [
    '--dangerously-skip-permissions',
    '--effort', options.effort || 'high',
    '--mode', options.mode || 'accept-edits'
  ];

  if (options.continueSession) {
    args.push('--continue');
  }

  // Use interactive or print mode
  if (options.printOnly) {
    args.push('--print', promptText);
  } else {
    args.push('--prompt-interactive', promptText);
  }

  console.log(`\x1b[35m[GRAVITON ➔ ANTIGRAVITY RELAY]\x1b[0m Auto-Allow Active (--dangerously-skip-permissions)`);

  const child = spawn(agyPath, args, {
    stdio: 'inherit',
    shell: true
  });

  // Forward termination signals to child process
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

