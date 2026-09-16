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
export function resolveAgyExecutable(commandName = 'agy') {
  const isWindows = process.platform === 'win32';
  const defaultCommand = getCrossPlatformCommand(commandName);

  // 1. Explicit environment variable override
  if (process.env.AGY_PATH && fs.existsSync(process.env.AGY_PATH)) {
    return process.env.AGY_PATH;
  }

  const searchNames = commandName === 'antigravity'
    ? ['antigravity', 'agy']
    : ['agy', 'antigravity'];

  // 2. Check ~/.gemini/bin/ directory
  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  if (homeDir) {
    const geminiBin = path.join(homeDir, '.gemini', 'bin');
    if (fs.existsSync(geminiBin)) {
      for (const name of searchNames) {
        if (isWindows) {
          const winCandidates = [
            path.join(geminiBin, `${name}.exe`),
            path.join(geminiBin, `${name}.cmd`),
            path.join(geminiBin, `${name}.bat`),
            path.join(geminiBin, name)
          ];
          for (const candidate of winCandidates) {
            if (fs.existsSync(candidate)) return candidate;
          }
        } else {
          const candidate = path.join(geminiBin, name);
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    }
  }

  // 3. Search in system PATH
  const envPath = process.env.PATH || process.env.Path || '';
  const dirs = envPath.split(path.delimiter);
  const extensions = isWindows
    ? (process.env.PATHEXT ? process.env.PATHEXT.split(';') : ['.EXE', '.CMD', '.BAT'])
    : [''];

  for (const dir of dirs) {
    if (!dir) continue;
    for (const name of searchNames) {
      if (isWindows) {
        for (const ext of extensions) {
          const candidate = path.join(dir, `${name}${ext.toLowerCase()}`);
          if (fs.existsSync(candidate)) return candidate;
          const upperCandidate = path.join(dir, `${name}${ext.toUpperCase()}`);
          if (fs.existsSync(upperCandidate)) return upperCandidate;
        }
      } else {
        const candidate = path.join(dir, name);
        try {
          if (fs.existsSync(candidate)) {
            fs.accessSync(candidate, fs.constants.X_OK);
            return candidate;
          }
        } catch {}
      }
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
 * Graviton V1.8.3 Rock-Solid Synchronous Relay:
 * 1. Resolves binary path searching both 'agy' and 'antigravity' in ~/.gemini/bin and PATH.
 * 2. Injects superPrompt via -p (or -i if interactive) with --dangerously-skip-permissions.
 * 3. Uses shell: false for native binaries (.exe on Windows, ELF on Linux, Mach-O on macOS)
 *    to eliminate shell escaping and argument truncation bugs, with fallback to shell: true for .cmd/.bat.
 * 4. Strictly blocks the Node.js main thread until Antigravity completely finishes.
 * 5. Handles errors cleanly and checks exit code.
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

  // Dynamically resolve executable (checks agy and antigravity in ~/.gemini/bin and system PATH)
  const commandName = options.command || 'agy';
  const agyExecutable = resolveAgyExecutable(commandName);

  // Construct arguments: use options.args if provided, otherwise assemble auto-allow flags + prompt
  let args;
  if (options.args) {
    args = [...options.args];
  } else {
    args = [
      '--dangerously-skip-permissions',
      '--effort', options.effort || (options.isDeep ? 'high' : 'high'),
      '--mode', options.mode || (options.isDeep ? 'plan' : 'accept-edits')
    ];

    if (options.continueSession) {
      args.push('--continue');
    }

    if (promptText) {
      if (options.interactive) {
        args.push('-i', promptText);
      } else {
        args.push('-p', promptText);
      }
    }
  }

  const stdioMode = options.stdio || 'inherit';

  // Determine shell option:
  // On Windows, if executable is .cmd or .bat or non-absolute, shell: true is needed.
  // If executable is an .exe (like agy.exe) or Unix binary, shell: false executes directly
  // avoiding cmd.exe argument corruption and escaping issues.
  let useShell = false;
  if (typeof options.shell === 'boolean') {
    useShell = options.shell;
  } else if (process.platform === 'win32') {
    const ext = path.extname(agyExecutable).toLowerCase();
    if (ext === '.cmd' || ext === '.bat' || !path.isAbsolute(agyExecutable)) {
      useShell = true;
    }
  }

  // Execute the relay using spawnSync
  const result = spawnSync(agyExecutable, args, {
    stdio: stdioMode,
    shell: useShell,
    env
  });

  // Handle spawn errors
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      console.error(
        '\x1b[1;31m[🚨 GRAVITON ERROR]\x1b[0m Google Antigravity CLI (\x1b[33magy\x1b[0m) was not found on this system.\n' +
        'Please ensure Antigravity is installed in ~/.gemini/bin or added to your PATH.\n' +
        'For installation instructions, visit: https://github.com/google-deepmind/antigravity'
      );
    } else {
      console.error('Spawn Error:', result.error);
    }
    if (options.rejectOnError) {
      throw result.error;
    }
    process.exit(1);
  }

  // Handle non-zero exit status
  if (result.status !== 0 && result.status !== null) {
    console.log(`\x1b[1;31m[GRAVITON ERROR] Antigravity terminated abruptly with exit code ${result.status}\x1b[0m`);
    if (options.rejectOnError) {
      throw new Error(`[GRAVITON ERROR] Antigravity terminated abruptly with exit code ${result.status}`);
    }
    process.exit(result.status || 1);
  }

  return result;
}
