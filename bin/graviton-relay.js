import { spawnSync, spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { purgeOldBackups, readOdometer, getLatestShadowBackups } from '../src/pipeline.js';
import { getLatestConversationId, saveWorkspaceSession } from '../src/session-manager.js';
import { captureWorkspaceSnapshot, saveSessionManifest } from '../src/rollback-manager.js';
import { inspectSessionFiles } from '../src/sanity-guard.js';
import { trackSessionTurn, checkCompactionStatus, autoCompactSessionIfExceeded } from '../src/session-compactor.js';

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
 * Safely and cleanly terminates a child process and its entire process tree.
 * On Windows, leverages taskkill /T /F to eliminate all orphaned subprocesses.
 */
export function terminateProcess(child) {
  if (!child || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
    } else {
      child.kill('SIGKILL');
    }
  } catch {}
}

/**
 * Inspects a string for known fatal error patterns from Google Antigravity, gRPC, or CLI limits.
 * Returns the human-readable error reason if detected, or null otherwise.
 */
export function detectFatalErrorPattern(text) {
  if (!text || typeof text !== 'string') return null;
  if (/RESOURCE_EXHAUSTED/i.test(text)) {
    return 'API Quota Exhausted (RESOURCE_EXHAUSTED / 429)';
  }
  if (/quota\s+exceeded/i.test(text)) {
    return 'API Quota Exceeded';
  }
  if (/rate\s*limit\s*exceeded|too\s+many\s+requests/i.test(text)) {
    return 'Rate Limit Exceeded (429)';
  }
  if (/UNAUTHENTICATED|invalid_grant/i.test(text)) {
    return 'Authentication Failed (UNAUTHENTICATED / invalid_grant)';
  }
  if (/\[agy\]\s*print\s+timeout/i.test(text)) {
    return 'Antigravity Internal Turn Timeout';
  }
  if (/model\s+is\s+overloaded/i.test(text)) {
    return 'Model Overloaded (503)';
  }
  return null;
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
 * Graviton V3.0.0 Rock-Solid Synchronous Relay:
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
  let env = Object.assign({}, process.env);
  if (geminiBin && fs.existsSync(geminiBin)) {
    const currentPath = env.PATH || env.Path || '';
    if (!currentPath.includes(geminiBin)) {
      env.PATH = `${geminiBin}${path.delimiter}${currentPath}`;
    }
  }

  // ISOLATION: Strip parent Antigravity IDE GUI environment variables.
  // When a terminal is opened inside Antigravity IDE, these variables cause agy.exe
  // to hook into the IDE GUI via language server RPC, which triggers interactive GUI
  // confirmation modals and overrides autonomous CLI mode (--dangerously-skip-permissions).
  delete env.ANTIGRAVITY_CONVERSATION_ID;
  delete env.ANTIGRAVITY_LS_ADDRESS;
  delete env.ANTIGRAVITY_AGENT;
  delete env.ANTIGRAVITY_CSRF_TOKEN;
  delete env.ANTIGRAVITY_TRAJECTORY_ID;
  delete env.ANTIGRAVITY_SOURCE_METADATA;
  delete env.ANTIGRAVITY_PROJECT_ID;
  delete env.ANTIGRAVITY_AGENTAPI_EXE;

  // Dynamically resolve executable (checks agy and antigravity in ~/.gemini/bin, AppData, and PATH)
  const commandName = options.command || 'agy';
  const agyExecutable = resolveAgyExecutable(commandName);

  // Validate executable existence
  if (!agyExecutable || !fs.existsSync(agyExecutable)) {
    console.error(
      `\n\x1b[1;31m[🚨 GRAVITON FATAL ERROR]\x1b[0m Google Antigravity CLI (\x1b[33magy\x1b[0m) is not installed on this machine!\n\n` +
      `Graviton is an autonomous acceleration layer for Google Antigravity. Binary \x1b[33magy\x1b[0m or \x1b[33magy.exe\x1b[0m was not found on your system.\n` +
      `\x1b[90m(Note: Antigravity Desktop App alone does not automatically link CLI commands without agy).\x1b[0m\n\n` +
      `\x1b[1mHow to Install Google Antigravity CLI on Windows:\x1b[0m\n` +
      `Open a new PowerShell terminal and execute:\n` +
      `  \x1b[36mirm https://antigravity.google/cli/install.ps1 | iex\x1b[0m\n\n` +
      `Or in Command Prompt (CMD):\n` +
      `  \x1b[36mcurl -fsSL https://antigravity.google/cli/install.cmd -o install.cmd && install.cmd && del install.cmd\x1b[0m\n\n` +
      `If Antigravity CLI is installed in a custom location, configure its path:\n` +
      `  \x1b[33msetx AGY_PATH "C:\\path\\to\\agy.exe"\x1b[0m\n`
    );
    if (options.rejectOnError) {
      throw new Error('Google Antigravity CLI (agy) was not found on this machine.');
    }
    process.exit(1);
  }

  if (!options.args && !options.silent) {
    const modelTag = options.model ? `Model: \x1b[1m${options.model}\x1b[0m | ` : '';
    const resolvedEffort = options.effort || (options.isFast ? 'low' : (options.isDeep ? 'high' : 'medium'));
    const effortTag = `Effort: \x1b[1m${resolvedEffort}\x1b[0m`;
    const reasonTag = options.modelReason ? ` \x1b[90m(${options.modelReason})\x1b[0m` : '';
    console.log(`\x1b[36m[GRAVITON]\x1b[0m ${modelTag}${effortTag}${reasonTag}`);
  }

  const executionCwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const initialSnapshot = captureWorkspaceSnapshot(executionCwd);

  // Construct arguments: use options.args if provided, otherwise assemble auto-allow flags + prompt
  let args;
  if (options.args) {
    args = [...options.args];
  } else {
    const resolvedEffort = options.effort || (options.isFast ? 'low' : (options.isDeep ? 'high' : 'medium'));
    const resolvedMode = options.mode || (options.isDeep ? 'plan' : 'accept-edits');
    args = [
      '--dangerously-skip-permissions',
      '--effort', resolvedEffort,
      '--mode', resolvedMode,
      '--print-timeout', options.printTimeout || '20m',
      '--output-format', 'stream-json'
    ];

    if (options.model) {
      args.push('--model', options.model);
    }

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

  // Determine shell option:
  let useShell = false;
  if (typeof options.shell === 'boolean') {
    useShell = options.shell;
  } else if (process.platform === 'win32') {
    const ext = path.extname(agyExecutable).toLowerCase();
    if (ext === '.cmd' || ext === '.bat' || !path.isAbsolute(agyExecutable)) {
      useShell = true;
    }
  }

  // 1. Synchronous Execution Path: when options.args or options.sync is specified
  if (options.args || options.sync) {
    const stdioMode = options.stdio || 'inherit';
    const result = spawnSync(agyExecutable, args, {
      cwd: executionCwd,
      stdio: stdioMode,
      shell: useShell,
      maxBuffer: 64 * 1024 * 1024,
      env
    });

    try {
      const latestConvId = getLatestConversationId();
      if (latestConvId) {
        const promptToSave = options.userPrompt || promptText;
        saveWorkspaceSession(executionCwd, latestConvId, promptToSave);
      }
      const shadowBackups = getLatestShadowBackups ? getLatestShadowBackups() : [];
      saveSessionManifest(executionCwd, latestConvId || '', shadowBackups, initialSnapshot);

      const odo = readOdometer();
      trackSessionTurn(executionCwd, odo.lastSessionTokens || 0, shadowBackups.map(b => b.original), promptToSave);
      inspectSessionFiles(executionCwd);

      const autoComp = autoCompactSessionIfExceeded(executionCwd, latestConvId);
      if (autoComp && autoComp.autoCompacted && autoComp.message) {
        console.log(`\n${autoComp.message}`);
      }
    } catch {}

    if (result.error) {
      console.error('Spawn Error:', result.error);
      if (options.rejectOnError) throw result.error;
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

  // 2. Real-Time Streaming Path: parses NDJSON events to provide live tool execution feedback & streaming
  return new Promise((resolve, reject) => {
    const child = spawn(agyExecutable, args, {
      cwd: executionCwd,
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: useShell,
      env
    });

    let stdoutBuffer = '';
    let lastReportedTool = null;
    let hasReceivedResponse = false;
    let turnTokens = 0;
    const startTime = Date.now();
    let currentActiveTool = null;
    let toolStartTime = null;

    // Watchdog and Fail-Fast state
    // Default idle timeout is 180s (3 minutes) as requested by the user, with a warning at 90s.
    const IDLE_TIMEOUT_SEC = Number(process.env.GRAVITON_IDLE_TIMEOUT) || (options.idleTimeout || 180);
    const IDLE_WARN_SEC = Math.floor(IDLE_TIMEOUT_SEC / 2);
    let lastActivityTime = Date.now();
    let hasWarnedIdle = false;
    let aborted = false;
    let failReason = null;

    const recordActivity = () => {
      lastActivityTime = Date.now();
      hasWarnedIdle = false;
    };

    const triggerFailFast = (reason) => {
      if (aborted) return;
      aborted = true;
      failReason = reason;
      terminateProcess(child);
    };

    const watchdog = setInterval(() => {
      if (aborted) return;
      const now = Date.now();
      const idleSec = Math.floor((now - lastActivityTime) / 1000);
      const totalElapsedSec = Math.floor((now - startTime) / 1000);

      // Periodic reasoning update when waiting (every 5 seconds when idleSec >= 5, no active tool, and no text streaming)
      if (!hasReceivedResponse && !currentActiveTool && idleSec >= 5 && idleSec % 5 === 0) {
        console.log(`\x1b[90m[GRAVITON] AI analyzing context & thinking... (${totalElapsedSec}s elapsed)\x1b[0m`);
      }

      // Gentle warning when quiet for half the idle timeout (90s)
      if (idleSec >= IDLE_WARN_SEC && !hasWarnedIdle) {
        hasWarnedIdle = true;
        console.log(`\x1b[33m[!] Antigravity is quiet (no activity for ${idleSec}s). Still waiting (limit: ${IDLE_TIMEOUT_SEC}s), or press Ctrl+C to cancel.\x1b[0m`);
      }

      // Inactivity timeout abort at 3 minutes (180s)
      if (idleSec >= IDLE_TIMEOUT_SEC) {
        console.error(`\n\x1b[1;31m[🚨 GRAVITON FAIL-FAST]\x1b[0m Antigravity stalled with no activity for ${IDLE_TIMEOUT_SEC}s (3 minutes).`);
        console.error(`\x1b[90mTerminated stalled process. No tokens or time wasted waiting blindly.\x1b[0m`);
        triggerFailFast(`Inactivity timeout: Antigravity stopped responding (no activity for ${IDLE_TIMEOUT_SEC}s / 3m)`);
      }
    }, 1000);

    const checkFatal = (text) => {
      const fatal = detectFatalErrorPattern(text);
      if (fatal && !aborted) {
        console.error(`\n\x1b[1;31m[🚨 GRAVITON FAIL-FAST]\x1b[0m Fatal error detected: \x1b[1m${fatal}\x1b[0m`);
        console.error(`\x1b[90mTerminated immediately to prevent waiting or wasting tokens.\x1b[0m`);
        triggerFailFast(fatal);
      }
    };

    child.stdout.on('data', chunk => {
      recordActivity();
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        checkFatal(line);
        if (aborted) break;

        try {
          const data = JSON.parse(line);
          if (data.event === 'step_update' && data.step_update) {
            const step = data.step_update;

            // Real-time tool updates with clear icons and filenames
            if (step.step_type === 'tool') {
              if (step.state === 'ACTIVE') {
                const toolName = step.tool_name;
                const params = step.tool_info?.parameters || {};
                currentActiveTool = toolName;
                toolStartTime = Date.now();
                let toolDesc = '';

                if (toolName === 'view_file') {
                  const file = params.AbsolutePath || params.TargetFile || '';
                  toolDesc = `\x1b[36m⚙  [AI Working]\x1b[0m Inspecting \x1b[1m${path.basename(file) || file}\x1b[0m...`;
                } else if (toolName === 'write_to_file' || toolName === 'replace_file_content' || toolName === 'multi_replace_file_content') {
                  const file = params.TargetFile || params.AbsolutePath || '';
                  toolDesc = `\x1b[33m✍  [AI Working]\x1b[0m Modifying \x1b[1m${path.basename(file) || file}\x1b[0m...`;
                } else if (toolName === 'run_command') {
                  const cmd = (params.CommandLine || '').slice(0, 45);
                  toolDesc = `\x1b[35m▶  [AI Working]\x1b[0m Running: \x1b[1m${cmd}\x1b[0m...`;
                } else if (toolName === 'grep_search' || toolName === 'find_by_name') {
                  toolDesc = `\x1b[34m🔍 [AI Working]\x1b[0m Searching codebase: \x1b[1m${params.Query || params.Pattern || ''}\x1b[0m...`;
                } else {
                  toolDesc = `\x1b[36m⚙  [AI Tool]\x1b[0m Executing \x1b[1m${toolName}\x1b[0m...`;
                }

                if (toolDesc && toolDesc !== lastReportedTool) {
                  lastReportedTool = toolDesc;
                  console.log(toolDesc);
                }
              } else if (step.state === 'DONE') {
                const dur = step.duration_seconds
                  ? `${step.duration_seconds.toFixed(1)}s`
                  : (toolStartTime ? `${((Date.now() - toolStartTime) / 1000).toFixed(1)}s` : '');
                const durStr = dur ? ` \x1b[90m(${dur})\x1b[0m` : '';
                console.log(`   \x1b[32m✔\x1b[0m Done${durStr}`);
                currentActiveTool = null;
                toolStartTime = null;
              }
            }

            // Stream agent response text live as it arrives
            if (step.step_type === 'agent_response' && step.text_delta) {
              currentActiveTool = null;
              hasReceivedResponse = true;
              process.stdout.write(step.text_delta);
            }

            // Track tokens
            if (step.usage && step.usage.total_tokens) {
              turnTokens = step.usage.total_tokens;
            }
          } else if (data.event === 'result' && data.result) {
            if (data.result.usage && data.result.usage.total_tokens) {
              turnTokens = data.result.usage.total_tokens;
            }
            if (!hasReceivedResponse && data.result.response) {
              process.stdout.write(data.result.response);
            }
            if (data.result.status && data.result.status !== 'SUCCESS') {
              triggerFailFast(`Antigravity result status: ${data.result.status}`);
            }
          }
        } catch {
          // If non-JSON text line, output directly
          process.stdout.write(line + '\n');
        }
      }
    });

    child.stderr.on('data', chunk => {
      recordActivity();
      const text = chunk.toString();
      checkFatal(text);
      if (!aborted) {
        process.stderr.write(text);
      }
    });

    child.on('error', err => {
      clearInterval(watchdog);
      if (options.rejectOnError) return reject(err);
      resolve({ status: 1, error: err, aborted: false, timedOut: false });
    });

    child.on('close', code => {
      clearInterval(watchdog);

      try {
        const latestConvId = getLatestConversationId();
        if (latestConvId) {
          const promptToSave = options.userPrompt || promptText;
          saveWorkspaceSession(executionCwd, latestConvId, promptToSave);
        }
        const shadowBackups = getLatestShadowBackups ? getLatestShadowBackups() : [];
        saveSessionManifest(executionCwd, latestConvId || '', shadowBackups, initialSnapshot);

        const odo = readOdometer();
        trackSessionTurn(executionCwd, turnTokens || odo.lastSessionTokens || 0, shadowBackups.map(b => b.original), promptToSave);
        inspectSessionFiles(executionCwd);

        const autoComp = autoCompactSessionIfExceeded(executionCwd, latestConvId);
        if (autoComp && autoComp.autoCompacted && autoComp.message) {
          console.log(`\n${autoComp.message}`);
        }
      } catch {}

      const isOk = !aborted && code === 0 && !failReason;
      const finalStatus = isOk ? 0 : (code !== 0 && code !== null ? code : 1);
      const isTimedOut = Boolean(aborted || (failReason && /timeout/i.test(failReason)));

      if (!isOk && options.rejectOnError) {
        return reject(new Error(failReason || `[GRAVITON ERROR] Antigravity terminated abruptly with exit code ${code}`));
      }

      resolve({
        status: finalStatus,
        aborted,
        timedOut: isTimedOut,
        failReason,
        error: isOk ? null : new Error(failReason || `Antigravity exited with code ${code}`)
      });
    });
  });
}
