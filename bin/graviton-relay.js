import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { purgeOldBackups } from '../src/pipeline.js';

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
 * - On Windows (win32): spawn command is 'cmd.exe', args are ['/c', baseCommand, ...originalArgs], shell: false.
 *   This avoids EINVAL when spawning .cmd files and eliminates DEP0190 deprecation warning.
 * - On non-Windows: spawn command is baseCommand, args are originalArgs, shell: false.
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
 * Executes Antigravity with full terminal I/O streaming.
 *
 * Graviton V1.8.0 Execution Vanguard:
 * 1. Strictly sets { stdio: 'inherit' } so terminal streams are connected directly.
 * 2. Wraps execution in a Promise that resolves only on the 'close' or 'exit' event.
 * 3. Timeout Guardrails: 15-minute max execution timeout (forcefully kills child and throws clean error).
 * 4. SIGINT Interceptor: Cleanly kills child process if user presses Ctrl+C, preventing zombie processes.
 * 5. Windows Security Patch: Uses cmd.exe /c with shell: false on Windows, eliminating EINVAL and DEP0190.
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

  const timeoutMs = options.timeoutMs || (15 * 60 * 1000); // 15-minute max execution timeout

  return new Promise((resolve, reject) => {
    // 1 & 2. In child_process.spawn options, strictly set { stdio: 'inherit' }
    const spawnStdio = options.stdio || 'inherit';
    const child = spawn(spawnCmd, spawnArgs, {
      stdio: spawnStdio,
      shell: false,
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

    // 3. Timeout Guardrails: 15-minute max execution timeout
    const timeoutTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      killChildProcess('SIGKILL');
      cleanup();
      reject(new Error('Antigravity execution timed out after 15 minutes (max execution guardrail exceeded).'));
    }, timeoutMs);

    // 4. SIGINT Interceptor: cleanly kill child process on Ctrl+C to prevent zombie background processes
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

    // Write prompt text into stdin if stdin stream exists (e.g. piped stdio)
    if (child.stdin && promptText) {
      try {
        child.stdin.write(promptText);
        child.stdin.end();
      } catch {}
    }

    // Handle spawn error (e.g. executable not found ENOENT)
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    });

    // 2. Wrap execution in Promise that resolves only on 'close' or 'exit' event
    const handleCompletion = (code, signal) => {
      if (settled) return;
      settled = true;
      cleanup();
      const exitCode = code !== null ? code : (signal ? 1 : 0);
      resolve(exitCode);
    };

    child.on('exit', handleCompletion);
    child.on('close', handleCompletion);
  });
}
