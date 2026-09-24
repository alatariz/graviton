import { spawnSync, spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { purgeOldBackups, readOdometer, getLatestShadowBackups } from '../src/pipeline.js';
import { getLatestConversationId, saveWorkspaceSession, getConversationHistory } from '../src/session-manager.js';
import { captureWorkspaceSnapshot, saveSessionManifest } from '../src/rollback-manager.js';
import { inspectSessionFiles } from '../src/sanity-guard.js';
import { trackSessionTurn, autoCompactSessionIfExceeded } from '../src/session-compactor.js';

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
 * Cleans raw terminal output:
 * 1. Drops interactive approval / confirmation prompts ("AWAITING USER APPROVAL...", etc.)
 * 2. Strips Markdown bold formatting (**text** and __text__)
 * 3. Strips Markdown header tokens (#, ##, ###)
 * 4. Strips conversational pleasantries and filler
 */
export function cleanTerminalOutput(text) {
  if (!text || typeof text !== 'string') return '';

  const lines = text.split(/\r?\n/);
  const cleanedLines = [];

  for (let line of lines) {
    // Drop approval or confirmation requests
    if (
      /AWAITING USER APPROVAL/i.test(line) ||
      /SUMMARY OF ACTIONABLE DECISIONS/i.test(line) ||
      /Please review the implementation plan and approve/i.test(line) ||
      /approve to proceed/i.test(line) ||
      /User Review Required/i.test(line) ||
      /Awaiting your approval/i.test(line)
    ) {
      continue;
    }

    // Strip markdown headers (# at start of line)
    line = line.replace(/^#{1,6}\s+/g, '');

    // Strip markdown bold **text** or __text__
    line = line.replace(/\*\*(.*?)\*\*/g, '$1');
    line = line.replace(/__(.*?)__/g, '$1');
    line = line.replace(/\*\*/g, '');

    // Strip conversational filler / greetings
    line = line.replace(/^(?:Certainly!|Sure!|Here is|Here's|I have completed|Feel free to|Let me know if)[^.\n]*[.:]/i, '');

    cleanedLines.push(line);
  }

  return cleanedLines.join('\n');
}

/**
 * Extracts clean assistant text from raw Antigravity output or NDJSON stream.
 * Guarantees that raw JSON envelopes are stripped and authentic model text is returned.
 * @param {string|Buffer} rawOutput
 * @param {string} cwd
 * @param {string|null} convId
 * @param {boolean} preserveMarkdown
 * @returns {string}
 */
export function extractCleanAssistantResponse(rawOutput, cwd = process.cwd(), convId = null, preserveMarkdown = true) {
  if (!rawOutput) return '';
  const str = typeof rawOutput === 'string' ? rawOutput : rawOutput.toString('utf8');

  // Check if output contains NDJSON stream lines
  if (str.includes('{"event"') || str.includes('"step_type"') || str.includes('"event":')) {
    let deltas = '';
    let finalResp = '';
    const nonJsonLines = [];
    const lines = str.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        nonJsonLines.push('');
        continue;
      }
      try {
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
          const data = JSON.parse(trimmed);
          if (data.event === 'step_update' && data.step_update) {
            if (data.step_update.step_type === 'agent_response' && data.step_update.text_delta) {
              deltas += data.step_update.text_delta;
            }
          } else if (data.event === 'result' && data.result && data.result.response) {
            finalResp = data.result.response;
          }
          // It's a JSON event, so skip it from clean output
          continue;
        }
      } catch {}
      nonJsonLines.push(line);
    }
    const candidate = (finalResp || deltas || nonJsonLines.join('\n')).trim();
    if (candidate) {
      return preserveMarkdown ? candidate : cleanTerminalOutput(candidate);
    }
  }

  // Fallback: check transcript log if conversation ID is available
  if (convId) {
    try {
      const hist = getConversationHistory(cwd, convId, 5);
      if (hist && Array.isArray(hist.turns) && hist.turns.length > 0) {
        const lastTurn = hist.turns[hist.turns.length - 1];
        if (lastTurn && lastTurn.role === 'assistant' && lastTurn.text) {
          return preserveMarkdown ? lastTurn.text : cleanTerminalOutput(lastTurn.text);
        }
      }
    } catch {}
  }

  return preserveMarkdown ? str.trim() : cleanTerminalOutput(str).trim();
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
 * Graviton Rock-Solid Synchronous Relay:
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
      `\n\x1b[1;31m[GRAVITON FATAL ERROR]\x1b[0m Google Antigravity CLI (\x1b[33magy\x1b[0m) is not installed on this machine!\n\n` +
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

  // 1. Resolve normalized model and effort for Antigravity CLI (agy)
  let resolvedEffort = options.effort || (options.isFast ? 'low' : (options.isDeep ? 'high' : 'medium'));
  let normalizedModel = options.model || '';

  if (normalizedModel) {
    if (normalizedModel.includes('gemini-3.1-pro')) {
      normalizedModel = 'gemini-3.1-pro';
      // agy only supports 'low' and 'high' effort for gemini-3.1-pro
      if (resolvedEffort === 'medium') {
        resolvedEffort = 'high';
      }
    } else if (normalizedModel.includes('gemini-3.8-flash')) {
      normalizedModel = 'gemini-3.8-flash';
    } else if (normalizedModel.includes('gemini-3.7-flash')) {
      normalizedModel = 'gemini-3.7-flash';
    }
  }

  if (!options.args && !options.silent) {
    const displayModel = normalizedModel || options.model || '';
    const modelTag = displayModel ? `Model: \x1b[1m${displayModel}\x1b[0m | ` : '';
    const userEffort = options.effort || (options.isFast ? 'low' : (options.isDeep ? 'high' : 'medium'));
    const effortTag = `Effort: \x1b[1m${userEffort}\x1b[0m`;
    const reasonTag = options.modelReason ? ` \x1b[90m(${options.modelReason})\x1b[0m` : '';
    console.log(`\x1b[36m[GRAVITON MODEL SELECTOR]\x1b[0m ${modelTag}${effortTag}${reasonTag}`);
  }

  const executionCwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const initialSnapshot = captureWorkspaceSnapshot(executionCwd);

  // Construct arguments: use options.args if provided, otherwise assemble auto-allow flags + prompt
  let args;
  if (options.args) {
    args = [...options.args];
  } else {
    const resolvedMode = options.mode || (options.isDeep ? 'plan' : 'accept-edits');
    args = [
      '--dangerously-skip-permissions',
      '--effort', resolvedEffort,
      '--mode', resolvedMode,
      '--print-timeout', options.printTimeout || '20m',
      '--output-format', 'stream-json'
    ];

    if (normalizedModel) {
      args.push('--model', normalizedModel);
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
      const latestConvId = options.conversationId || getLatestConversationId();
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

    try {
      const latestConvId = options.conversationId || getLatestConversationId();
      result.cleanResponse = extractCleanAssistantResponse(result.stdout, executionCwd, latestConvId, true);
      result.conversationId = latestConvId;
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
    let cleanAccumulatedText = '';
    let detectedConvId = null;
    const startTime = Date.now();
    let currentActiveTool = null;
    let toolStartTime = null;

    // Watchdog and Fail-Fast state
    // Hardcoded idle kill disabled to protect large generation / deep reasoning tasks.
    // Can be configured via GRAVITON_IDLE_TIMEOUT environment variable if needed.
    const IDLE_TIMEOUT_SEC = Number(process.env.GRAVITON_IDLE_TIMEOUT) || 0;
    const IDLE_WARN_SEC = IDLE_TIMEOUT_SEC > 0 ? Math.floor(IDLE_TIMEOUT_SEC / 2) : 90;
    let lastActivityTime = Date.now();
    let hasWarnedIdle = false;
    let aborted = false;
    let failReason = null;
    let toolLineActive = false;
    let streamLineBuffer = '';
    let toolExecutionCount = 0;
    const defaultMaxSteps = options.isFast ? 15 : (options.isDeep ? 40 : 25);
    const MAX_TOOL_STEPS = Number(process.env.GRAVITON_MAX_TOOL_STEPS) || defaultMaxSteps;
    const fileViewTracker = {};
    let scratchProbeCount = 0;
    let filesModifiedCount = 0;

    const processStreamChunk = (chunk, isFinal = false) => {
      streamLineBuffer += chunk;
      const lines = streamLineBuffer.split('\n');
      if (!isFinal) {
        streamLineBuffer = lines.pop() || '';
      } else {
        streamLineBuffer = '';
      }

      for (const rawLine of lines) {
        const cleaned = cleanTerminalOutput(rawLine);
        if (cleaned && cleaned.trim()) {
          process.stdout.write(cleaned + '\n');
        }
      }
    };

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

      // Periodic reasoning update when waiting (every 30 seconds when idleSec >= 15, no active tool, and no text streaming)
      if (!hasReceivedResponse && !currentActiveTool && idleSec >= 15 && totalElapsedSec > 0 && totalElapsedSec % 30 === 0) {
        console.log(`\x1b[90m[GRAVITON] AI analyzing context & thinking... (${totalElapsedSec}s elapsed)\x1b[0m`);
      }

      // Gentle warning when quiet (only if idle timeout explicitly enabled)
      if (IDLE_TIMEOUT_SEC > 0 && idleSec >= IDLE_WARN_SEC && !hasWarnedIdle) {
        hasWarnedIdle = true;
        console.log(`\x1b[33m[!] Antigravity is quiet (no activity for ${idleSec}s). Still waiting (limit: ${IDLE_TIMEOUT_SEC}s), or press Ctrl+C to cancel.\x1b[0m`);
      }

      // Inactivity timeout abort ONLY if explicitly configured
      if (IDLE_TIMEOUT_SEC > 0 && idleSec >= IDLE_TIMEOUT_SEC) {
        console.error(`\n\x1b[1;31m[GRAVITON FAIL-FAST]\x1b[0m Antigravity stalled with no activity for ${IDLE_TIMEOUT_SEC}s.`);
        console.error(`\x1b[90mTerminated stalled process. No tokens or time wasted waiting blindly.\x1b[0m`);
        triggerFailFast(`Inactivity timeout: Antigravity stopped responding (no activity for ${IDLE_TIMEOUT_SEC}s)`);
      }
    }, 1000);

    const checkFatal = (text) => {
      const fatal = detectFatalErrorPattern(text);
      if (fatal && !aborted) {
        console.error(`\n\x1b[1;31m[GRAVITON FAIL-FAST]\x1b[0m Fatal error detected: \x1b[1m${fatal}\x1b[0m`);
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
          if (data.conversation_id) {
            detectedConvId = data.conversation_id;
          }
          if (data.event === 'step_update' && data.step_update) {
            const step = data.step_update;

            // Real-time tool updates with clear icons and filenames on single line
            if (step.step_type === 'tool') {
              if (step.state === 'ACTIVE') {
                const toolName = step.tool_name;
                const params = step.tool_info?.parameters || {};
                currentActiveTool = toolName;
                toolStartTime = Date.now();
                let toolDesc = '';

                if (toolName === 'view_file') {
                  const file = params.AbsolutePath || params.TargetFile || '';
                  if (file) {
                    const normFile = path.resolve(file);
                    fileViewTracker[normFile] = (fileViewTracker[normFile] || 0) + 1;
                    if (fileViewTracker[normFile] >= 3) {
                      process.stdout.write(`\n\x1b[33m[GRAVITON ANTI-LOOP]\x1b[0m "${path.basename(file)}" inspected ${fileViewTracker[normFile]}x. Enforcing direct edits...\x1b[0m\n`);
                    }
                  }
                  toolDesc = `\x1b[36m●  [AI Working]\x1b[0m Inspecting \x1b[1m${path.basename(file) || file}\x1b[0m...`;
                } else if (toolName === 'write_to_file' || toolName === 'replace_file_content' || toolName === 'multi_replace_file_content') {
                  filesModifiedCount++;
                  const file = params.TargetFile || params.AbsolutePath || '';
                  toolDesc = `\x1b[33m●  [AI Working]\x1b[0m Modifying \x1b[1m${path.basename(file) || file}\x1b[0m...`;
                } else if (toolName === 'run_command') {
                  const rawCmd = params.CommandLine || '';
                  if (/node\s+(?:-e|--eval)|python\s+-c|Get-ChildItem/i.test(rawCmd)) {
                    scratchProbeCount++;
                    if (scratchProbeCount >= 2) {
                      process.stdout.write(`\n\x1b[33m[GRAVITON REPL GUARD]\x1b[0m AI running ad-hoc inspection script (${scratchProbeCount}x). Enforcing direct file edits...\x1b[0m\n`);
                    }
                  }
                  const cmd = rawCmd.slice(0, 45);
                  toolDesc = `\x1b[35m●  [AI Working]\x1b[0m Running: \x1b[1m${cmd}\x1b[0m...`;
                } else if (toolName === 'grep_search' || toolName === 'find_by_name') {
                  toolDesc = `\x1b[34m●  [AI Working]\x1b[0m Searching codebase: \x1b[1m${params.Query || params.Pattern || ''}\x1b[0m...`;
                } else {
                  toolDesc = `\x1b[36m●  [AI Tool]\x1b[0m Executing \x1b[1m${toolName}\x1b[0m...`;
                }

                if (toolDesc && toolDesc !== lastReportedTool) {
                  lastReportedTool = toolDesc;
                  process.stdout.write(`\r\x1b[K${toolDesc}`);
                  toolLineActive = true;
                }

                if (options.onToolUpdate) {
                  try {
                    options.onToolUpdate({
                      state: 'ACTIVE',
                      tool: toolName,
                      parameters: params,
                      desc: cleanTerminalOutput(toolDesc).trim()
                    });
                  } catch {}
                }
              } else if (step.state === 'DONE') {
                toolExecutionCount++;
                const dur = step.duration_seconds
                  ? `${step.duration_seconds.toFixed(1)}s`
                  : (toolStartTime ? `${((Date.now() - toolStartTime) / 1000).toFixed(1)}s` : '');
                const durStr = dur ? ` \x1b[90m(${dur})\x1b[0m` : '';
                if (toolLineActive) {
                  process.stdout.write(`\r\x1b[K\x1b[36m●  [AI Tool]\x1b[0m Executed ${step.tool_name}${durStr}`);
                }
                currentActiveTool = null;
                toolStartTime = null;

                if (options.onToolUpdate) {
                  try {
                    options.onToolUpdate({
                      state: 'DONE',
                      tool: step.tool_name,
                      duration: step.duration_seconds || (dur ? parseFloat(dur) : null),
                      stepCount: toolExecutionCount
                    });
                  } catch {}
                }

                // Autonomous Circuit Breaker: Prevent infinite exploratory tool loops
                if (!aborted) {
                  if (filesModifiedCount === 0 && toolExecutionCount >= 18) {
                    console.error(`\n\x1b[1;33m[GRAVITON CIRCUIT BREAKER]\x1b[0m Pure inspection loop detected without code edits (${toolExecutionCount} steps). Finalizing execution.\x1b[0m`);
                    triggerFailFast(`Pure inspection loop detected without code edits (${toolExecutionCount} steps).`);
                  } else if (toolExecutionCount >= MAX_TOOL_STEPS) {
                    console.error(`\n\x1b[1;33m[GRAVITON CIRCUIT BREAKER]\x1b[0m Autonomous tool limit reached (${toolExecutionCount} steps). Finalizing execution to prevent runaway token loop.\x1b[0m`);
                    triggerFailFast(`Tool execution loop limit exceeded (${MAX_TOOL_STEPS} steps).`);
                  }
                }
              }
            }

            // Stream agent response text live as it arrives
            if (step.step_type === 'agent_response' && step.text_delta) {
              if (toolLineActive) {
                process.stdout.write('\n');
                toolLineActive = false;
              }
              currentActiveTool = null;
              hasReceivedResponse = true;
              cleanAccumulatedText += step.text_delta;
              processStreamChunk(step.text_delta);
              if (options.onTextDelta) {
                try {
                  options.onTextDelta(step.text_delta);
                } catch {}
              }
            }

            // Track tokens
            if (step.usage && step.usage.total_tokens) {
              turnTokens = step.usage.total_tokens;
            }
          } else if (data.event === 'result' && data.result) {
            if (data.result.usage && data.result.usage.total_tokens) {
              turnTokens = data.result.usage.total_tokens;
            }
            if (toolLineActive) {
              process.stdout.write('\n');
              toolLineActive = false;
            }
            if (!hasReceivedResponse && data.result.response) {
              cleanAccumulatedText = data.result.response;
              processStreamChunk(data.result.response, true);
            } else {
              processStreamChunk('', true);
            }
            if (options.onResult) {
              try {
                options.onResult(data.result);
              } catch {}
            }
            if (data.result.status && data.result.status !== 'SUCCESS') {
              triggerFailFast(`Antigravity result status: ${data.result.status}`);
            }
          }
        } catch {
          // If non-JSON text line, output directly
          if (toolLineActive) {
            process.stdout.write('\n');
            toolLineActive = false;
          }
          processStreamChunk(line + '\n');
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
      if (toolLineActive) {
        process.stdout.write('\r\x1b[K');
        toolLineActive = false;
      }
      processStreamChunk('', true);

      const latestConvId = options.conversationId || detectedConvId || getLatestConversationId();
      try {
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

      if (!isOk) {
        console.error(`\n\x1b[33m[GRAVITON TIP]\x1b[0m For fast direct execution, use \x1b[1m-f\x1b[0m (e.g. \x1b[36mgrav -f "<task>"\x1b[0m). For deep architectural reasoning, use \x1b[1m-d\x1b[0m (\x1b[36mgrav -d "<task>"\x1b[0m).`);
      }

      if (!isOk && options.rejectOnError) {
        return reject(new Error(failReason || `[GRAVITON ERROR] Antigravity terminated abruptly with exit code ${code}`));
      }

      let finalCleanText = cleanAccumulatedText
        ? cleanAccumulatedText.trim()
        : extractCleanAssistantResponse('', executionCwd, latestConvId, true);

      if (!finalCleanText && aborted && failReason) {
        if (/loop limit exceeded|circuit breaker/i.test(failReason)) {
          finalCleanText = `[GRAVITON CIRCUIT BREAKER ACTIVE]\nTool execution limit reached (${MAX_TOOL_STEPS} steps). Execution was automatically halted to prevent runaway token expenditure.\nAll file modifications made up to this step were preserved on disk.`;
        } else {
          finalCleanText = `[GRAVITON NOTICE]: Execution halted (${failReason}).`;
        }
      }

      resolve({
        status: finalStatus,
        aborted,
        timedOut: isTimedOut,
        failReason,
        turnTokens,
        accumulatedText: finalCleanText,
        cleanResponse: finalCleanText,
        conversationId: latestConvId,
        error: isOk ? null : new Error(failReason || `Antigravity exited with code ${code}`)
      });
    });
  });
}
