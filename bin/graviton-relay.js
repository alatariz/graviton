import { spawnSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { purgeOldBackups, readOdometer, getLatestShadowBackups } from '../src/pipeline.js';
import { getLatestConversationId, saveWorkspaceSession } from '../src/session-manager.js';
import { captureWorkspaceSnapshot, saveSessionManifest } from '../src/rollback-manager.js';
import { inspectSessionFiles } from '../src/sanity-guard.js';
import { trackSessionTurn, checkCompactionStatus } from '../src/session-compactor.js';

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
 * Detects if an executable is the Electron GUI desktop app instead of the CLI.
 * Electron desktop apps detach immediately on Windows and do not process CLI stdin/prompts.
 */
export function isGuiExecutable(filePath) {
  if (!filePath) return false;
  const lower = filePath.toLowerCase();
  if (lower.endsWith('antigravity.exe')) {
    const dir = path.dirname(filePath);
    if (
      fs.existsSync(path.join(dir, 'resources.pak')) ||
      fs.existsSync(path.join(dir, 'chrome_100_percent.pak')) ||
      fs.existsSync(path.join(dir, 'snapshot_blob.bin')) ||
      lower.includes('programs\\antigravity')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Dynamically resolves the antigravity / agy executable path across Windows, macOS, and Linux
 * by searching through ~/.gemini/bin, AppData/Local/agy/bin, system PATH, and system discovery (where/which).
 * Strictly filters out GUI desktop apps (Antigravity.exe) to ensure only the CLI runner (agy) is selected.
 * Returns the absolute path if found, or null if not found.
 */
export function resolveAgyExecutable(commandName = 'agy') {
  const isWindows = process.platform === 'win32';

  // 1. Explicit environment variable override
  if (process.env.AGY_PATH && fs.existsSync(process.env.AGY_PATH)) {
    if (!isGuiExecutable(process.env.AGY_PATH)) {
      return process.env.AGY_PATH;
    }
  }

  // CLI executable names (check 'agy' first as it is the canonical CLI binary)
  const searchNames = ['agy', 'antigravity'];

  const homeDir = process.env.USERPROFILE || process.env.HOME || '';
  const localAppData = process.env.LOCALAPPDATA || (homeDir ? path.join(homeDir, 'AppData', 'Local') : '');

  // 2. Check standard CLI installation directories
  const candidateDirectories = [];
  if (homeDir) {
    candidateDirectories.push(
      path.join(homeDir, '.gemini', 'bin'),
      path.join(homeDir, '.gemini', 'antigravity-cli', 'bin'),
      path.join(homeDir, '.antigravity', 'bin')
    );
  }
  if (isWindows && localAppData) {
    candidateDirectories.push(
      path.join(localAppData, 'agy', 'bin'),
      path.join(localAppData, 'Programs', 'agy', 'bin')
    );
  }

  for (const dir of candidateDirectories) {
    if (!fs.existsSync(dir)) continue;
    for (const name of searchNames) {
      if (isWindows) {
        const winCandidates = [
          path.join(dir, `${name}.exe`),
          path.join(dir, `${name}.cmd`),
          path.join(dir, `${name}.bat`),
          path.join(dir, name)
        ];
        for (const candidate of winCandidates) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && !isGuiExecutable(candidate)) {
            return candidate;
          }
        }
      } else {
        const candidate = path.join(dir, name);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && !isGuiExecutable(candidate)) {
          return candidate;
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
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && !isGuiExecutable(candidate)) {
            return candidate;
          }
          const upperCandidate = path.join(dir, `${name}${ext.toUpperCase()}`);
          if (fs.existsSync(upperCandidate) && fs.statSync(upperCandidate).isFile() && !isGuiExecutable(upperCandidate)) {
            return upperCandidate;
          }
        }
      } else {
        const candidate = path.join(dir, name);
        try {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && !isGuiExecutable(candidate)) {
            fs.accessSync(candidate, fs.constants.X_OK);
            return candidate;
          }
        } catch {}
      }
    }
  }

  // 4. Try resolving via where.exe (Windows) or which (Unix)
  if (isWindows) {
    for (const name of searchNames) {
      try {
        const out = execSync(`where.exe ${name}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        const lines = out.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (fs.existsSync(line) && fs.statSync(line).isFile() && !isGuiExecutable(line)) {
            return line;
          }
        }
      } catch {}
    }
  } else {
    for (const name of searchNames) {
      try {
        const out = execSync(`which ${name}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (out && fs.existsSync(out) && fs.statSync(out).isFile() && !isGuiExecutable(out)) {
          return out;
        }
      } catch {}
    }
  }

  // 5. If not found, return null (strictly reject non-existent or GUI binaries)
  return null;
}

/**
 * Computes spawn configuration dynamically checking the OS.
 * Windows Node.js Security Patch:
 * - On Windows (win32): uses the Single String Shell approach (spawn(fullCmd, [], { shell: true }))
 *   to eliminate argument truncation, bypass EINVAL on .cmd files, and avoid DEP0190 warnings.
 * - On non-Windows: standard spawn(baseCommand, originalArgs, { shell: false }).
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
 * Graviton V1.8.4 Rock-Solid Synchronous Relay:
 * 1. Resolves binary path searching both 'agy' and 'antigravity' in ~/.gemini/bin, AppData, and PATH.
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

  // Dynamically resolve executable (checks agy and antigravity in ~/.gemini/bin, AppData, and PATH)
  const commandName = options.command || 'agy';
  const agyExecutable = resolveAgyExecutable(commandName);

  // Validate executable existence
  if (!agyExecutable || !fs.existsSync(agyExecutable)) {
    console.error(
      `\n\x1b[1;31m[🚨 GRAVITON FATAL ERROR]\x1b[0m Google Antigravity CLI (\x1b[33magy\x1b[0m) belum terpasang di laptop ini!\n\n` +
      `Graviton adalah akselerator CLI untuk Google Antigravity. Binary \x1b[33magy\x1b[0m atau \x1b[33magy.exe\x1b[0m tidak ditemukan di sistem ini.\n` +
      `\x1b[90m(Catatan: Antigravity Desktop App tidak menjalankan perintah CLI secara otomatis).\x1b[0m\n\n` +
      `\x1b[1mCara Memasang Google Antigravity CLI di Windows:\x1b[0m\n` +
      `Buka PowerShell baru dan jalankan:\n` +
      `  \x1b[36mirm https://antigravity.google/cli/install.ps1 | iex\x1b[0m\n\n` +
      `Atau di Command Prompt (CMD):\n` +
      `  \x1b[36mcurl -fsSL https://antigravity.google/cli/install.cmd -o install.cmd && install.cmd && del install.cmd\x1b[0m\n\n` +
      `Jika Antigravity CLI sudah terpasang di lokasi khusus, atur path-nya:\n` +
      `  \x1b[33msetx AGY_PATH "C:\\path\\to\\agy.exe"\x1b[0m\n`
    );
    if (options.rejectOnError) {
      throw new Error('Google Antigravity CLI (agy) was not found on this machine.');
    }
    process.exit(1);
  }

  console.log(`\x1b[90m[GRAVITON] Relay target: ${agyExecutable}\x1b[0m`);
  console.log(`\x1b[36m[GRAVITON]\x1b[0m Relaying prompt to Antigravity CLI (Auto-Allow active)...`);

  const executionCwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const initialSnapshot = captureWorkspaceSnapshot(executionCwd);

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

    if (options.addDir !== false) {
      args.push('--add-dir', executionCwd);
    }

    if (options.conversationId) {
      args.push('--conversation', options.conversationId);
    } else if (options.continueSession) {
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

  // Execute the relay using spawnSync with workspace directory confinement
  const result = spawnSync(agyExecutable, args, {
    cwd: executionCwd,
    stdio: stdioMode,
    shell: useShell,
    env
  });

  // Auto-detect and record conversation ID and session manifest for rollback guard
  try {
    const latestConvId = getLatestConversationId();
    if (latestConvId) {
      saveWorkspaceSession(executionCwd, latestConvId, promptText);
    }
    const shadowBackups = getLatestShadowBackups ? getLatestShadowBackups() : [];
    saveSessionManifest(executionCwd, latestConvId || '', shadowBackups, initialSnapshot);

    // V2.0 Track turn metrics
    const odo = readOdometer();
    trackSessionTurn(executionCwd, odo.lastSessionTokens || 0, shadowBackups.map(b => b.original));

    // V2.0 Post-execution Syntax Sanity Guard
    inspectSessionFiles(executionCwd);

    // V2.0 Session Compactor Advisory
    const comp = checkCompactionStatus(executionCwd);
    if (comp && comp.advise) {
      console.log(comp.message);
    }
  } catch {}

  // Handle spawn errors
  if (result.error) {
    console.error('Spawn Error:', result.error);
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
