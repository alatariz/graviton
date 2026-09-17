// src/session-compactor.js - Graviton V2.0.0 Smart Session Compaction & Token Budget Guard
import fs from 'fs';
import path from 'path';
import { getWorkspaceSession, saveWorkspaceSession, clearWorkspaceSession } from './session-manager.js';

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

  const touched = sessionData.touchedFilesHistory || [];
  const turns = sessionData.turns || 0;
  const tokens = sessionData.cumulativeTokens || 0;

  const summary = {
    compactedAt: Date.now(),
    previousTurns: turns,
    tokensSavedEstimate: tokens,
    activeFiles: touched,
    memo: `Project context compacted after ${turns} turns. Active working files: ${touched.join(', ') || 'none'}.`
  };

  try {
    fs.writeFileSync(memoryFile, JSON.stringify(summary, null, 2), 'utf8');
    // Clear the active session so next turn starts with clean conversation ID
    clearWorkspaceSession(normalizedCwd);
    return {
      success: true,
      summary: summary.memo,
      message: `Session successfully compacted! Active memory saved (${touched.length} files tracked). Context window refreshed.`
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
      return `[GRAVITON PERSISTED COMPACT MEMORY]\n${data.memo}\n`;
    }
  } catch {}
  return null;
}
