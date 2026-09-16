import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { purgeOldBackups } from '../src/pipeline.js';

/**
 * Resolves the command executable name based on the OS.
 * On Windows (win32), command must explicitly be appended with '.cmd' (e.g., 'agy.cmd' or 'antigravity.cmd').
 * For other platforms, uses the standard command (e.g., 'agy').
 */
export function getCrossPlatformCommand(cmd = 'agy') {
  if (process.platform === 'win32') {
    const ext = path.extname(cmd).toLowerCase();
    if (ext === '.cmd' || ext === '.exe' || ext === '.bat') {
      return cmd;
    }
    return `${cmd}.cmd`;
  }
  return cmd;
}

/**
 * Dynamically resolves the agy executable path across Windows, macOS, and Linux
 * by searching through ~/.gemini/bin, process.env.PATH, and checking platform conventions.
 * On Windows: explicitly resolves to .cmd or .exe
 * On non-Windows: uses standard command name
 */
export function resolveAgyExecutable(commandName = 'agy') {
  const isWindows = process.platform === 'win32';
  const defaultCommand = getCrossPlatformCommand(commandName);

  // 1. Explicit environment variable override
  if (process.env.AGY_PATH && fs.existsSync(process.env.AGY_PATH)) {
    return process.env.AGY_PATH;
  }

  // 2. Check ~/.gemini/bin/ directory
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  if (homeDir) {
    if (isWindows) {
      const winCandidates = [
        path.join(homeDir, '.gemini', 'bin', `${commandName}.exe`),
        path.join(homeDir, '.gemini', 'bin', `${commandName}.cmd`),
        path.join(homeDir, '.gemini', 'bin', `${commandName}.bat`),
        path.join(homeDir, '.gemini', 'bin', 'antigravity.cmd'),
        path.join(homeDir, '.gemini', 'bin', 'antigravity.exe')
      ];
      for (const candidate of winCandidates) {
        if (fs.existsSync(candidate)) return candidate;
      }
    } else {
      const unixCandidates = [
        path.join(homeDir, '.gemini', 'bin', commandName),
        path.join(homeDir, '.gemini', 'bin', 'antigravity')
      ];
      for (const candidate of unixCandidates) {
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }

  // 3. Search in system PATH
  const envPath = process.env.PATH || process.env.Path || '';
  const dirs = envPath.split(path.delimiter);
  const extensions = isWindows
    ? (process.env.PATHEXT ? process.env.PATHEXT.split(';') : ['.CMD', '.EXE', '.BAT'])
    : [''];

  for (const dir of dirs) {
    if (!dir) continue;
    if (isWindows) {
      for (const ext of extensions) {
        const candidate = path.join(dir, `${commandName}${ext.toLowerCase()}`);
        if (fs.existsSync(candidate)) return candidate;
        const upperCandidate = path.join(dir, `${commandName}${ext.toUpperCase()}`);
        if (fs.existsSync(upperCandidate)) return upperCandidate;
      }
    } else {
      const candidate = path.join(dir, commandName);
      try {
        if (fs.existsSync(candidate)) {
          fs.accessSync(candidate, fs.constants.X_OK);
          return candidate;
        }
      } catch {}
    }
  }

  // 4. Default fallback: explicit .cmd on Windows (e.g. agy.cmd or antigravity.cmd), standard command on others
  return defaultCommand;
}

/**
 * Executes Antigravity in pure One-Shot mode via Stdin.
 * Writes promptText to child.stdin and immediately closes it (stdin.end()),
 * forcing Antigravity to execute with --dangerously-skip-permissions and exit cleanly.
 *
 * Uses ironclad cross-platform child_process.spawn without 'shell: true' (avoiding DEP0190),
 * dynamically resolving .cmd on Windows and passing arguments as a standard array.
 */
export function runAntigravityWithAutoAllow(promptText, options = {}) {
  // Fire-and-forget self-cleaning shadow backup (zero latency impact)
  purgeOldBackups();

  const commandName = options.command || 'agy';
  const agyExecutable = resolveAgyExecutable(commandName);

  const args = [
    '--dangerously-skip-permissions',
    '--effort', options.effort || 'high',
    '--mode', options.mode || 'accept-edits'
  ];

  if (options.continueSession) {
    args.push('--continue');
  }

  // Ironclad cross-platform spawn: no shell: true (avoids DEP0190 deprecation warning)
  const child = spawn(agyExecutable, args, {
    stdio: ['pipe', process.stdout, process.stderr]
  });

  // Programmatically write promptText into child.stdin and close stream
  if (promptText) {
    child.stdin.write(promptText);
  }
  child.stdin.end();

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
