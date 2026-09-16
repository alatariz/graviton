import { spawn } from 'child_process';
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
 * Executes Antigravity with full terminal I/O streaming.
 *
 * Graviton V1.8.1 Bulletproof I/O:
 * 1. Windows: Single String Shell ('antigravity ' + originalArgs.join(' ')) with { stdio: 'inherit', shell: true }.
 * 2. Non-Windows: standard spawn with ('antigravity', originalArgs, { stdio: 'inherit', shell: false }).
 * 3. Error Catching: .on('error', (err) => console.error('[GRAVITON CRASH]', err)).
 * 4. Exit Code Logging: .on('close'), if code !== 0 logs bold red [GRAVITON ERROR]; if code === 0 resolves and prints success.
 */
export function runAntigravityWithAutoAllow(promptText, options = {}) {
  // Fire-and-forget self-cleaning shadow backup (zero latency impact)
  purgeOldBackups();

  const { baseCommand, originalArgs, fullCmd } = getSpawnConfig(options);

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

  const timeoutMs = options.timeoutMs || (15 * 60 * 1000); // 15-minute max execution timeout

  return new Promise((resolve, reject) => {
    let child;
    const stdioMode = options.stdio || 'inherit';

    // 1 & 5. Set spawn options to { stdio: 'inherit', shell: true }
    const isWindows = process.platform === 'win32';
    const spawnCmd = isWindows ? fullCmd : baseCommand;
    const spawnArgs = isWindows ? [] : originalArgs;

    child = spawn(spawnCmd, spawnArgs, {
      stdio: stdioMode,
      shell: true,
      env
    });

    let settled = false;

    // Helper to safely force-kill child process (preventing zombie processes)
    const killChildProcess = (signal = 'SIGKILL') => {
      if (child && !child.killed) {
        try {
          if (process.platform === 'win32' && child.pid) {
            try {
              spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], { stdio: 'ignore', shell: false });
            } catch {}
          }
          child.kill(signal);
        } catch {}
      }
    };

    const cleanup = () => {
      clearTimeout(timeoutTimer);
      process.removeListener('SIGINT', sigintHandler);
      process.removeListener('SIGTERM', sigtermHandler);
    };

    // Timeout Guardrails: 15-minute max execution timeout
    const timeoutTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      killChildProcess('SIGKILL');
      cleanup();
      reject(new Error('Antigravity execution timed out after 15 minutes (max execution guardrail exceeded).'));
    }, timeoutMs);

    // SIGINT Interceptor: cleanly kill child process on Ctrl+C to prevent zombie background processes
    const sigintHandler = () => {
      killChildProcess('SIGINT');
      cleanup();
      process.exit(130);
    };

    const sigtermHandler = () => {
      killChildProcess('SIGTERM');
      cleanup();
      process.exit(143);
    };

    process.on('SIGINT', sigintHandler);
    process.on('SIGTERM', sigtermHandler);

    // 3. Error Catching: Add a .on('error', (err) => console.error('[GRAVITON CRASH]', err)) listener
    child.on('error', (err) => {
      console.error('[GRAVITON CRASH]', err);
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    });

    // 2. Inside the Promise, resolve() MUST only be called inside the child.on('close') event
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (code !== 0) {
        console.log(`\x1b[1;31m[GRAVITON ERROR] Antigravity terminated abruptly with exit code ${code}\x1b[0m`);
        if (options.rejectOnError) {
          reject(new Error(`[GRAVITON ERROR] Antigravity terminated abruptly with exit code ${code}`));
        } else {
          process.exit(code || 1);
        }
      } else {
        resolve(code || 0);
      }
    });
  });
}
