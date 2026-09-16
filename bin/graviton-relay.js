import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { purgeOldBackups, readOdometer } from '../src/pipeline.js';

/**
 * Resolves the command executable name based on the OS.
 * On Windows (win32), command must explicitly be appended with '.cmd' (e.g., 'agy.cmd' or 'antigravity.cmd').
 * For other platforms, uses the standard command (e.g., 'agy').
 */
export function getCrossPlatformCommand(cmd = 'antigravity') {
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
 * Dynamically resolves the antigravity executable path across Windows, macOS, and Linux
 * by searching through ~/.gemini/bin, process.env.PATH, and checking platform conventions.
 * On Windows: explicitly resolves to .cmd or .exe
 * On non-Windows: uses standard command name
 */
export function resolveAgyExecutable(commandName = 'antigravity') {
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
 * - On Windows (win32): uses the Single String Shell approach (spawn(fullCmd, [], { shell: true }))
 *   to eliminate argument truncation, bypass EINVAL on .cmd files, and avoid DEP0190 warnings.
 * - On non-Windows: standard spawn(baseCommand, originalArgs, { shell: false }).
 */
export function getSpawnConfig(options = {}) {
  const baseCommand = options.command || 'antigravity';
  const originalArgs = [
    '--dangerously-skip-permissions',
    '--effort', options.effort || 'high',
    '--mode', options.mode || 'accept-edits'
  ];

  if (options.continueSession) {
    originalArgs.push('--continue');
  }

  const isWindows = process.platform === 'win32';
  const fullCmd = baseCommand + (originalArgs.length > 0 ? ' ' + originalArgs.join(' ') : '');
  const spawnCmd = isWindows ? fullCmd : baseCommand;
  const spawnArgs = isWindows ? [] : originalArgs;
  const shell = isWindows ? true : false;

  return {
    baseCommand,
    originalArgs,
    fullCmd,
    spawnCmd,
    spawnArgs,
    shell
  };
}

/**
 * Executes Antigravity synchronously with full terminal I/O streaming.
 *
 * Graviton V1.8.2 Nuclear Synchronous Relay:
 * 1. Uses spawnSync('antigravity', process.argv.slice(2), { stdio: 'inherit', shell: true })
 * 2. Blocks the Node.js main thread strictly until Antigravity finishes.
 * 3. Checks result.error and exits cleanly with error log.
 * 4. Completely eliminates async fall-through or microtask premature termination.
 */
export function runAntigravityWithAutoAllow(promptText, options = {}) {
  // Fire-and-forget self-cleaning shadow backup (zero latency impact)
  purgeOldBackups();

  // Ensure ~/.gemini/bin is in PATH for seamless executable resolution
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

  const args = options.args || process.argv.slice(2);
  const stdioMode = options.stdio || 'inherit';

  // 3. Execute the relay using spawnSync
  const result = spawnSync('antigravity', args, {
    stdio: stdioMode,
    shell: true,
    env
  });

  // 4. After the spawnSync line, check the result:
  if (result.error) {
    console.error('Spawn Error:', result.error);
    if (options.rejectOnError) {
      throw result.error;
    }
    process.exit(1);
  }

  if (result.status !== 0 && result.status !== null) {
    console.log(`\x1b[1;31m[GRAVITON ERROR] Antigravity terminated abruptly with exit code ${result.status}\x1b[0m`);
    if (options.rejectOnError) {
      throw new Error(`[GRAVITON ERROR] Antigravity terminated abruptly with exit code ${result.status}`);
    }
    process.exit(result.status || 1);
  }

  return result;
}
