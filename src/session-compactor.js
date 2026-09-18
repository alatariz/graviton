// src/session-compactor.js - Graviton V3.2.0 Smart Session Compaction & Autonomous Sliding Window
import fs from 'fs';
import path from 'path';
import { getWorkspaceSession, saveWorkspaceSession, clearWorkspaceSession, getConversationHistory } from './session-manager.js';

export const SLIDING_WINDOW_SIZE = 4;
export const AUTONOMOUS_COMPACT_THRESHOLD = 5;
const MAX_RECOMMENDED_TURNS = 8;
const MAX_RECOMMENDED_TOKENS = 80000;

/**
 * Tracks turn metrics and token estimates for the active workspace session.
 * @param {string} cwd
 * @param {number} tokenDelta
 * @param {string[]} touchedFiles
 * @returns {object} Updated session data
 */
export function trackSessionTurn(cwd = process.cwd(), tokenDelta = 0, touchedFiles = []) {
  const normalizedCwd = path.resolve(cwd);
  const sessionFile = path.join(normalizedCwd, '.graviton-session');
  let sessionData = {};

  if (fs.existsSync(sessionFile)) {
    try {
      sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    } catch {
      sessionData = {};
    }
  }

  sessionData.turns = (sessionData.turns || 0) + 1;
  sessionData.cumulativeTokens = (sessionData.cumulativeTokens || 0) + Math.max(0, tokenDelta);
  sessionData.updatedAt = Date.now();

  if (!Array.isArray(sessionData.touchedFilesHistory)) {
    sessionData.touchedFilesHistory = [];
  }

  if (Array.isArray(touchedFiles)) {
    for (const f of touchedFiles) {
      if (f && !sessionData.touchedFilesHistory.includes(f)) {
        sessionData.touchedFilesHistory.push(f);
      }
    }
  }

  try {
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');
  } catch {}

  return sessionData;
}

/**
 * Checks if the current session has exceeded healthy token or turn thresholds.
 * @param {string} cwd
 * @returns {{ advise: boolean, turns: number, cumulativeTokens: number, message: string }}
 */
export function checkCompactionStatus(cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);
  const sessionFile = path.join(normalizedCwd, '.graviton-session');
  
  if (!fs.existsSync(sessionFile)) {
    return { advise: false, turns: 0, cumulativeTokens: 0, message: '' };
  }

  try {
    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    const turns = sessionData.turns || 0;
    const tokens = sessionData.cumulativeTokens || 0;

    const advise = turns >= MAX_RECOMMENDED_TURNS || tokens >= MAX_RECOMMENDED_TOKENS;
    let message = '';
    if (advise) {
      message = `\n\x1b[33m[GRAVITON ADVISORY] Continuous session has reached ${turns} turns (~ ${tokens} tokens).\x1b[0m\n` +
        `\x1b[90mExcessively long context windows may slow down response times and consume extra tokens.\x1b[0m\n` +
        `\x1b[36m👉 Recommendation:\x1b[0m Run '\x1b[1mgraviton compact\x1b[0m' to refresh the context window while preserving core working memory.\n`;
    }

    return { advise, turns, cumulativeTokens: tokens, message };
  } catch {
    return { advise: false, turns: 0, cumulativeTokens: 0, message: '' };
  }
}

/**
 * Performs smart session compaction:
 * Summarizes files modified and milestones into a memory snapshot,
 * then clears the bulky raw conversation ID so the next prompt begins with a fresh,
 * lightweight context window primed with architectural memory.
 * @param {string} cwd
 * @returns {{ success: boolean, summary: string, message: string }}
 */
export function compactWorkspaceSession(cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);
  const sessionFile = path.join(normalizedCwd, '.graviton-session');
  const memoryFile = path.join(normalizedCwd, '.graviton-compact-memory.json');

  let sessionData = {};
  if (fs.existsSync(sessionFile)) {
    try {
      sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    } catch {}
  }

  let previousMemory = null;
  if (fs.existsSync(memoryFile)) {
    try {
      previousMemory = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
    } catch {}
  }

  const touched = sessionData.touchedFilesHistory || [];
  const turns = sessionData.turns || 0;
  const tokens = sessionData.cumulativeTokens || 0;

  // Merge active files cumulatively: recent touched files take priority over older memory
  const mergedFilesSet = new Set();
  for (const f of touched) mergedFilesSet.add(f);
  if (previousMemory && Array.isArray(previousMemory.activeFiles)) {
    for (const f of previousMemory.activeFiles) mergedFilesSet.add(f);
  }

  const activeFiles = Array.from(mergedFilesSet).slice(0, 15);
  const totalTurns = (previousMemory && previousMemory.previousTurns ? previousMemory.previousTurns : 0) + turns;
  const totalTokens = (previousMemory && previousMemory.tokensSavedEstimate ? previousMemory.tokensSavedEstimate : 0) + tokens;

  const summary = {
    compactedAt: Date.now(),
    previousTurns: totalTurns,
    tokensSavedEstimate: totalTokens,
    activeFiles,
    memo: `Project context compacted after ${totalTurns} turns. Active working files: ${activeFiles.join(', ') || 'none'}.`
  };

  try {
    fs.writeFileSync(memoryFile, JSON.stringify(summary, null, 2), 'utf8');
    // Clear the active session so next turn starts with clean conversation ID
    clearWorkspaceSession(normalizedCwd);
    return {
      success: true,
      summary: summary.memo,
      message: `Session successfully compacted! Active memory saved (${activeFiles.length} files tracked). Context window refreshed.`
    };
  } catch (err) {
    return {
      success: false,
      summary: '',
      message: `Failed to compact session: ${err.message}`
    };
  }
}

/**
 * Distills past conversational turns into a high-density, concise memory summary.
 * @param {Array<{ role: string, text: string, timestamp?: any }>} pastTurns
 * @param {string[]} touchedFiles
 * @returns {string} Distilled memory summary
 */
export function distillPastTurns(pastTurns = [], touchedFiles = []) {
  if (!Array.isArray(pastTurns) || pastTurns.length === 0) {
    const filesMsg = touchedFiles.length > 0
      ? `\nKey Files Modified: ${touchedFiles.slice(0, 10).join(', ')}.`
      : '';
    return `Earlier Context Milestones:\n- Previous turns established working context.${filesMsg}`;
  }

  const bulletPoints = [];
  for (let i = 0; i < pastTurns.length; i++) {
    const t = pastTurns[i];
    let summary = (t.text || '').replace(/\r?\n/g, ' ').trim();
    if (summary.length > 90) {
      summary = summary.slice(0, 87) + '...';
    }
    if (summary) {
      bulletPoints.push(`- Turn ${i + 1}: ${summary}`);
    }
  }

  const filesNote = touchedFiles.length > 0
    ? `\nKey Files Modified: ${touchedFiles.slice(0, 10).join(', ')}.`
    : '';

  return `Earlier Context Milestones (${bulletPoints.length} turns):\n${bulletPoints.join('\n')}${filesNote}`;
}

/**
 * Evaluates the active conversation and automatically applies a sliding-window compaction
 * when turns exceed AUTONOMOUS_COMPACT_THRESHOLD (default: 5 turns).
 * Retains the latest SLIDING_WINDOW_SIZE turns (default: 4 turns) in full fidelity,
 * and distills older turns into persisted working memory.
 * 
 * @param {string} cwd
 * @param {string} [conversationId]
 * @param {object} [options]
 * @returns {{ autoCompacted: boolean, turnsCompacted: number, activeTurns: number, tokensSavedEstimate: number, summary?: string }}
 */
export function checkAndApplySlidingWindow(cwd = process.cwd(), conversationId = null, options = {}) {
  const normalizedCwd = path.resolve(cwd);
  const windowSize = options.windowSize || SLIDING_WINDOW_SIZE;
  const threshold = options.threshold || AUTONOMOUS_COMPACT_THRESHOLD;

  const sessionFile = path.join(normalizedCwd, '.graviton-session');
  let sessionData = {};
  if (fs.existsSync(sessionFile)) {
    try {
      sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    } catch {
      sessionData = {};
    }
  }

  const currentTurns = sessionData.turns || 0;
  if (currentTurns < threshold) {
    return {
      autoCompacted: false,
      turnsCompacted: 0,
      activeTurns: currentTurns,
      tokensSavedEstimate: 0
    };
  }

  // Calculate turns to prune/distill
  const turnsToCompact = currentTurns - windowSize;
  if (turnsToCompact <= 0) {
    return {
      autoCompacted: false,
      turnsCompacted: 0,
      activeTurns: currentTurns,
      tokensSavedEstimate: 0
    };
  }

  // Load history if available to create high-quality distillation
  const targetId = conversationId || sessionData.conversationId;
  let historyTurns = [];
  if (targetId) {
    try {
      const hist = getConversationHistory(normalizedCwd, targetId, currentTurns);
      if (hist && Array.isArray(hist.turns)) {
        historyTurns = hist.turns;
      }
    } catch {}
  }

  const pastToDistill = historyTurns.slice(0, turnsToCompact);
  const touched = sessionData.touchedFilesHistory || [];
  const distilledMemo = distillPastTurns(pastToDistill, touched);

  // Estimate tokens saved: earlier turns average ~2,500 - 5,000 tokens per turn
  const tokensSavedEstimate = Math.max(1200, turnsToCompact * 3500);

  // Update .graviton-compact-memory.json
  const memoryFile = path.join(normalizedCwd, '.graviton-compact-memory.json');
  let previousMemory = null;
  if (fs.existsSync(memoryFile)) {
    try {
      previousMemory = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
    } catch {}
  }

  const totalCompactedTurns = (previousMemory?.previousTurns || 0) + turnsToCompact;
  const totalTokensSaved = (previousMemory?.tokensSavedEstimate || 0) + tokensSavedEstimate;

  const memoryPayload = {
    compactedAt: Date.now(),
    slidingWindowActive: true,
    windowSize,
    previousTurns: totalCompactedTurns,
    tokensSavedEstimate: totalTokensSaved,
    activeFiles: touched.slice(0, 15),
    memo: distilledMemo
  };

  try {
    fs.writeFileSync(memoryFile, JSON.stringify(memoryPayload, null, 2), 'utf8');

    // Slide the session turn counter so it stays bounded to the window size
    sessionData.turns = windowSize;
    sessionData.cumulativeTokens = Math.max(1000, (sessionData.cumulativeTokens || 0) - tokensSavedEstimate);
    sessionData.lastSlidingCompactionAt = Date.now();
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');

    return {
      autoCompacted: true,
      turnsCompacted: turnsToCompact,
      activeTurns: windowSize,
      tokensSavedEstimate,
      summary: distilledMemo
    };
  } catch (err) {
    return {
      autoCompacted: false,
      turnsCompacted: 0,
      activeTurns: currentTurns,
      tokensSavedEstimate: 0,
      error: err.message
    };
  }
}

/**
 * Reads compact memory if available to prepend to fresh sessions.
 * @param {string} cwd
 * @returns {string|null}
 */
export function getCompactMemoryDirective(cwd = process.cwd()) {
  const memoryFile = path.join(path.resolve(cwd), '.graviton-compact-memory.json');
  if (!fs.existsSync(memoryFile)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
    if (data && data.memo) {
      const windowTag = data.slidingWindowActive ? ` (Autonomous Sliding Window: Active)` : '';
      return `[GRAVITON PERSISTED COMPACT MEMORY${windowTag}]\n${data.memo}\n`;
    }
  } catch {}
  return null;
}
