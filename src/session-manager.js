// src/session-manager.js - Graviton V1.8.5 Workspace Session Manager
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Graviton V1.8.5 Workspace Session Manager
 * Provides rock-solid session continuity scoped strictly to the active workspace directory.
 * Stores conversation mapping both locally in workspace (.graviton-session) and globally (~/.graviton/sessions.json).
 */

export function getBrainDir() {
  const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir() || '';
  return path.join(homeDir, '.gemini', 'antigravity', 'brain');
}

export function getGlobalSessionsFilePath() {
  const homeDir = os.homedir();
  const gravitonDir = path.join(homeDir, '.graviton');
  return path.join(gravitonDir, 'sessions.json');
}

/**
 * Scans ~/.gemini/antigravity/brain to find the most recently updated conversation UUID.
 * Filters out metadata/temp directories.
 * @returns {string|null} The latest conversation ID
 */
export function getLatestConversationId() {
  const brainDir = getBrainDir();
  if (!fs.existsSync(brainDir)) return null;

  try {
    const entries = fs.readdirSync(brainDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'tempmediaStorage' && !d.name.startsWith('.'))
      .map(d => {
        const fullPath = path.join(brainDir, d.name);
        try {
          return { name: d.name, mtime: fs.statSync(fullPath).mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.mtime - a.mtime);

    return entries.length > 0 ? entries[0].name : null;
  } catch {
    return null;
  }
}

/**
 * Validates if a conversation directory physically exists in brain.
 * @param {string} conversationId
 * @returns {boolean}
 */
export function isValidConversation(conversationId) {
  if (!conversationId || typeof conversationId !== 'string') return false;
  const brainDir = getBrainDir();
  const targetDir = path.join(brainDir, conversationId);
  try {
    return fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Retrieves the recorded conversation session for a workspace.
 * Checks local .graviton-session first, then global ~/.graviton/sessions.json.
 * Validates that the conversation directory still exists in brain/.
 * @param {string} cwd
 * @returns {{ conversationId: string, updatedAt: number, lastPrompt?: string }|null}
 */
export function getWorkspaceSession(cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);
  const localFile = path.join(normalizedCwd, '.graviton-session');

  // 1. Try local file in workspace
  if (fs.existsSync(localFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(localFile, 'utf8'));
      if (data && data.conversationId && isValidConversation(data.conversationId)) {
        return data;
      }
    } catch {}
  }

  // 2. Try global registry
  const globalFile = getGlobalSessionsFilePath();
  if (fs.existsSync(globalFile)) {
    try {
      const allSessions = JSON.parse(fs.readFileSync(globalFile, 'utf8'));
      const session = allSessions[normalizedCwd];
      if (session && session.conversationId && isValidConversation(session.conversationId)) {
        return session;
      }
    } catch {}
  }

  return null;
}

/**
 * Saves or updates the workspace session mapping.
 * Writes to both local .graviton-session and global ~/.graviton/sessions.json.
 * @param {string} cwd
 * @param {string} conversationId
 * @param {string} lastPrompt
 */
export function saveWorkspaceSession(cwd = process.cwd(), conversationId, lastPrompt = '') {
  if (!conversationId || typeof conversationId !== 'string') return;
  const normalizedCwd = path.resolve(cwd);
  const sessionData = {
    conversationId,
    updatedAt: Date.now(),
    lastPrompt: (lastPrompt || '').slice(0, 200)
  };

  // 1. Write local .graviton-session
  try {
    const localFile = path.join(normalizedCwd, '.graviton-session');
    fs.writeFileSync(localFile, JSON.stringify(sessionData, null, 2), 'utf8');
  } catch {}

  // 2. Write global sessions.json
  try {
    const globalFile = getGlobalSessionsFilePath();
    const globalDir = path.dirname(globalFile);
    if (!fs.existsSync(globalDir)) {
      fs.mkdirSync(globalDir, { recursive: true });
    }
    let allSessions = {};
    if (fs.existsSync(globalFile)) {
      try {
        allSessions = JSON.parse(fs.readFileSync(globalFile, 'utf8'));
      } catch {
        allSessions = {};
      }
    }
    allSessions[normalizedCwd] = sessionData;
    fs.writeFileSync(globalFile, JSON.stringify(allSessions, null, 2), 'utf8');
  } catch {}
}

/**
 * Clears the session for a given workspace.
 * @param {string} cwd
 */
export function clearWorkspaceSession(cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);
  const localFile = path.join(normalizedCwd, '.graviton-session');

  try {
    if (fs.existsSync(localFile)) {
      fs.unlinkSync(localFile);
    }
  } catch {}

  try {
    const globalFile = getGlobalSessionsFilePath();
    if (fs.existsSync(globalFile)) {
      const allSessions = JSON.parse(fs.readFileSync(globalFile, 'utf8'));
      if (allSessions[normalizedCwd]) {
        delete allSessions[normalizedCwd];
        fs.writeFileSync(globalFile, JSON.stringify(allSessions, null, 2), 'utf8');
      }
    }
  } catch {}
}
