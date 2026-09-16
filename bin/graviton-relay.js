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
 * Computes spawn configuration dynamically checking the OS.
 * Windows Node.js Security Patch:
 * - On Windows (win32): spawn command is 'cmd.exe', args are ['/c', baseCommand, ...originalArgs], shell: false.
 *   This avoids EINVAL when spawning .cmd files and eliminates DEP0190 deprecation warning.
 * - On non-Windows: spawn command is baseCommand, args are originalArgs, shell: false.
 */
export function getSpawnConfig(options = {}) {
  const baseCommand = options.command || 'agy';
  const originalArgs = [
    '--dangerously-skip-permissions',
    '--effort', options.effort || 'high',
    '--mode', options.mode || 'accept-edits'
  ];

  if (options.continueSession) {
    originalArgs.push('--continue');
  }

  const isWindows = process.platform === 'win32';
  const spawnCmd = isWindows ? 'cmd.exe' : baseCommand;
  const spawnArgs = isWindows ? ['/c', baseCommand, ...originalArgs] : originalArgs;

  return {
    baseCommand,
    originalArgs,
    spawnCmd,
    spawnArgs
  };
}

/**
 * Executes Antigravity in pure One-Shot mode via Stdin.
 * Writes promptText to child.stdin and immediately closes it (stdin.end()),
 * forcing Antigravity to execute with --dangerously-skip-permissions and exit cleanly.
 *
 * Windows Node.js Security Patch:
 * - On Windows (win32): spawn 'cmd.exe' with ['/c', baseCommand, ...originalArgs] and shell: false.
 * - On non-Windows: spawn baseCommand directly with originalArgs and shell: false.
 */
export function runAntigravityWithAutoAllow(promptText, options = {}) {
  // Fire-and-forget self-cleaning shadow backup (zero latency impact)
  purgeOldBackups();

  const { spawnCmd, spawnArgs } = getSpawnConfig(options);

  // Ensure ~/.gemini/bin is in PATH for seamless cmd.exe resolution
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  const geminiBin = homeDir ? path.join(homeDir, '.gemini', 'bin') : '';
  let env = process.env;
  if (geminiBin && fs.existsSync(geminiBin)) {
    const currentPath = process.env.PATH || process.env.Path || '';
    if (!currentPath.includes(geminiBin)) {
      env = Object.assign({}, process.env, {
        PATH: `${geminiBin}${path.delimiter}${currentPath}`
      });
    }
  }

  // Pure Node.js spawn with shell: false across all platforms
  const child = spawn(spawnCmd, spawnArgs, {
    stdio: ['pipe', process.stdout, process.stderr],
    shell: false,
    env
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
