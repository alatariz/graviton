// src/session-manager.js - Graviton V2.0.0 Workspace Conversation Manager
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';

/**
 * Graviton V2.0.0 Workspace Conversation Manager
 * Provides Antigravity IDE-style conversation history management:
 * - Multi-conversation tracking per workspace (.graviton-conversations.json)
 * - Auto-generated human-readable topic titles
 * - Switcher / Selector, Deletion, and Resumption
 * - Backwards-compatible session persistence (.graviton-session and ~/.graviton/sessions.json)
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

export function getWorkspaceConversationsPath(cwd = process.cwd()) {
  return path.join(path.resolve(cwd), '.graviton-conversations.json');
}

/**
 * Generates a clean, human-readable topic title (4-7 words) from a prompt.
 * Automatically strips boilerplate, polite fillers, and error log headers.
 * @param {string} prompt
 * @returns {string}
 */
export function generateConversationTitle(prompt) {
  if (!prompt || typeof prompt !== 'string') return 'New Conversation';
  
  let cleaned = prompt
    .replace(/\[SYSTEM DIRECTIVE[\s\S]*?\]/gi, '')
    .replace(/\[USER INSTRUCTION.*?\]:/gi, '')
    .trim();

  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'New Conversation';

  let title = lines[0];
  // Remove markdown headers, bullets, or leading numbers
  title = title.replace(/^#+\s*|^[-*•]\s*|^\d+\.\s*/, '');
  // Remove conversational filler preambles
  title = title.replace(/^(tolong|mohon|bantu saya|coba|please|pls|can you|could you|i want to|saya mau)\s+/i, '');
  // Capitalize first character
  title = title.charAt(0).toUpperCase() + title.slice(1);

  if (title.length > 50) {
    title = title.slice(0, 46).replace(/\s+\S*$/, '') + '...';
  }
  return title || 'New Conversation';
}

/**
 * Formats relative timestamp for UI display (e.g. "Just now", "5m ago", "2h ago", "Yesterday").
 * @param {number} timestamp
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Scans ~/.gemini/antigravity/brain to find the most recently updated conversation UUID.
 * @returns {string|null}
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
 * Retrieves the full conversations registry for the active workspace.
 * @param {string} cwd
 * @returns {{ activeId: string|null, conversations: Array<object> }}
 */
export function getWorkspaceConversations(cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);
  const convFile = getWorkspaceConversationsPath(normalizedCwd);

  let data = { activeId: null, conversations: [] };

  if (fs.existsSync(convFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(convFile, 'utf8'));
      if (parsed && Array.isArray(parsed.conversations)) {
        data.conversations = parsed.conversations;
        data.activeId = Object.prototype.hasOwnProperty.call(parsed, 'activeId')
          ? parsed.activeId
          : (parsed.conversations[0] ? parsed.conversations[0].id : null);
      }
    } catch {}
  }

  // Backward compatibility migration from .graviton-session if conversations is empty
  if (data.conversations.length === 0) {
    const legacySessionFile = path.join(normalizedCwd, '.graviton-session');
    if (fs.existsSync(legacySessionFile)) {
      try {
        const leg = JSON.parse(fs.readFileSync(legacySessionFile, 'utf8'));
        if (leg && leg.conversationId) {
          const item = {
            id: leg.conversationId,
            title: leg.title || generateConversationTitle(leg.lastPrompt || 'Sesi Awal'),
            createdAt: leg.createdAt || leg.updatedAt || Date.now(),
            updatedAt: leg.updatedAt || Date.now(),
            turns: leg.turns || 1,
            cumulativeTokens: leg.cumulativeTokens || 0,
            lastPrompt: leg.lastPrompt || '',
            activeFiles: leg.touchedFilesHistory || []
          };
          data.conversations = [item];
          data.activeId = item.id;
          saveWorkspaceConversationsState(normalizedCwd, data);
        }
      } catch {}
    }
  }

  return data;
}

/**
 * Saves conversations registry state to disk and keeps .graviton-session in sync.
 * @param {string} cwd
 * @param {{ activeId: string|null, conversations: Array<object> }} state
 */
function saveWorkspaceConversationsState(cwd, state) {
  const normalizedCwd = path.resolve(cwd);
  const convFile = getWorkspaceConversationsPath(normalizedCwd);

  try {
    fs.writeFileSync(convFile, JSON.stringify(state, null, 2), 'utf8');
  } catch {}

  // Sync to .graviton-session for active conversation
  const activeConv = state.activeId ? (state.conversations.find(c => c.id === state.activeId) || null) : null;
  const localSessionFile = path.join(normalizedCwd, '.graviton-session');
  if (activeConv) {
    const sessionData = {
      conversationId: activeConv.id,
      title: activeConv.title,
      updatedAt: activeConv.updatedAt,
      turns: activeConv.turns,
      cumulativeTokens: activeConv.cumulativeTokens,
      lastPrompt: activeConv.lastPrompt,
      touchedFilesHistory: activeConv.activeFiles || []
    };
    try {
      fs.writeFileSync(localSessionFile, JSON.stringify(sessionData, null, 2), 'utf8');
    } catch {}

    // Also sync to global ~/.graviton/sessions.json
    try {
      const globalFile = getGlobalSessionsFilePath();
      const globalDir = path.dirname(globalFile);
      if (!fs.existsSync(globalDir)) fs.mkdirSync(globalDir, { recursive: true });
      let allSessions = {};
      if (fs.existsSync(globalFile)) {
        try { allSessions = JSON.parse(fs.readFileSync(globalFile, 'utf8')); } catch {}
      }
      allSessions[normalizedCwd] = sessionData;
      fs.writeFileSync(globalFile, JSON.stringify(allSessions, null, 2), 'utf8');
    } catch {}
  } else {
    try {
      if (fs.existsSync(localSessionFile)) fs.unlinkSync(localSessionFile);
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
}

/**
 * Retrieves the currently active conversation in the workspace.
 * @param {string} cwd
 * @returns {object|null}
 */
export function getActiveConversation(cwd = process.cwd()) {
  const { activeId, conversations } = getWorkspaceConversations(cwd);
  if (!activeId || conversations.length === 0) return null;
  return conversations.find(c => c.id === activeId) || null;
}

/**
 * Sets the active conversation by 1-based index or conversation UUID.
 * @param {string} cwd
 * @param {number|string} indexOrId
 * @returns {object|null} The activated conversation
 */
export function setActiveConversation(cwd = process.cwd(), indexOrId) {
  const normalizedCwd = path.resolve(cwd);
  const state = getWorkspaceConversations(normalizedCwd);

  let target = null;
  if (typeof indexOrId === 'number' || (/^\d+$/).test(String(indexOrId).trim())) {
    const idx = parseInt(indexOrId, 10) - 1;
    if (idx >= 0 && idx < state.conversations.length) {
      target = state.conversations[idx];
    }
  } else if (typeof indexOrId === 'string') {
    const needle = indexOrId.toLowerCase().trim();
    target = state.conversations.find(c => c.id.toLowerCase().startsWith(needle));
  }

  if (target) {
    state.activeId = target.id;
    saveWorkspaceConversationsState(normalizedCwd, state);
    return target;
  }
  return null;
}

/**
 * Retrieves conversation turn history from Antigravity transcript logs or workspace registry.
 * Dual-layer recovery:
 * 1. Native Antigravity transcript: parses ~/.gemini/antigravity/brain/<id>/.system_generated/logs/transcript.jsonl
 * 2. Graviton workspace registry: reads conversation.history and lastPrompt from .graviton-conversations.json
 * @param {string} cwd
 * @param {string|number} indexOrId
 * @param {number} maxTurns
 * @returns {{ id: string|null, title: string, turns: Array<{ role: string, text: string, timestamp?: number|string }>, totalTurns: number, activeFiles: string[] }}
 */
export function getConversationHistory(cwd = process.cwd(), indexOrId = null, maxTurns = 5) {
  const normalizedCwd = path.resolve(cwd);
  const state = getWorkspaceConversations(normalizedCwd);

  let targetConv = null;
  if (!indexOrId || indexOrId === 'active') {
    targetConv = state.activeId ? state.conversations.find(c => c.id === state.activeId) : state.conversations[0];
  } else if (typeof indexOrId === 'number' || /^\d+$/.test(String(indexOrId).trim())) {
    const idx = parseInt(indexOrId, 10) - 1;
    targetConv = (idx >= 0 && idx < state.conversations.length) ? state.conversations[idx] : null;
  } else if (typeof indexOrId === 'string') {
    targetConv = state.conversations.find(c => c.id.toLowerCase().startsWith(indexOrId.toLowerCase().trim()));
  }

  const convId = targetConv ? targetConv.id : (typeof indexOrId === 'string' && indexOrId.length > 10 ? indexOrId : null);
  if (!convId) {
    return { id: null, title: 'No Conversation', turns: [], totalTurns: 0, activeFiles: [] };
  }

  const title = targetConv ? targetConv.title : 'Conversation';
  const brainDir = getBrainDir();
  const transcriptFile = path.join(brainDir, convId, '.system_generated', 'logs', 'transcript.jsonl');

  const parsedTurns = [];

  if (fs.existsSync(transcriptFile)) {
    try {
      const content = fs.readFileSync(transcriptFile, 'utf8');
      const lines = content.trim().split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type === 'USER_INPUT' && entry.content) {
            let text = entry.content;
            const reqMatch = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
            if (reqMatch) text = reqMatch[1].trim();
            text = text.replace(/<[^>]+>/g, '').trim();
            if (text) {
              parsedTurns.push({
                role: 'user',
                text,
                timestamp: entry.created_at || null
              });
            }
          }
        } catch {}
      }
    } catch {}
  }

  // Fallback to internal registry history or lastPrompt if transcript wasn't found or empty
  if (parsedTurns.length === 0) {
    if (targetConv && Array.isArray(targetConv.history) && targetConv.history.length > 0) {
      targetConv.history.forEach(h => parsedTurns.push(h));
    } else if (targetConv && targetConv.lastPrompt) {
      parsedTurns.push({
        role: 'user',
        text: targetConv.lastPrompt,
        timestamp: targetConv.updatedAt
      });
    }
  }

  const totalTurns = parsedTurns.length || (targetConv ? targetConv.turns || 1 : 1);
  const recentTurns = parsedTurns.slice(-maxTurns);

  return {
    id: convId,
    title,
    turns: recentTurns,
    totalTurns,
    activeFiles: targetConv ? targetConv.activeFiles || [] : []
  };
}

/**
 * Formats conversation history into a clear terminal summary so the user knows where they left off.
 * @param {object} historyData
 * @returns {string}
 */
export function formatConversationHistory(historyData) {
  if (!historyData || !historyData.id) {
    return '\x1b[90mNo conversation history found.\x1b[0m\n';
  }

  const shortId = historyData.id.slice(0, 8);
  const total = historyData.totalTurns || historyData.turns.length;

  let out = `\n\x1b[1m\x1b[36m===============================================================\n`;
  out += `  CONVERSATION TOPIC: "${historyData.title}" (${shortId}...)\n`;
  out += `  Total Turns: ${total} | Context: Active\n`;
  out += `===============================================================\x1b[0m\n\n`;

  if (historyData.turns.length === 0) {
    out += `  \x1b[90m(No previous messages recorded yet in this topic)\x1b[0m\n\n`;
  } else {
    out += `\x1b[1mRecent Discussion Summary:\x1b[0m\n`;
    historyData.turns.forEach((turn, idx) => {
      const turnNum = total - historyData.turns.length + idx + 1;
      let cleanText = turn.text;
      if (cleanText.length > 200) {
        cleanText = cleanText.slice(0, 197).replace(/\s+\S*$/, '') + '...';
      }
      out += `  \x1b[1m\x1b[33m[Turn ${turnNum}]\x1b[0m \x1b[37m${cleanText.replace(/\r?\n/g, ' ')}\x1b[0m\n`;
    });
    out += '\n';
  }

  if (historyData.activeFiles && historyData.activeFiles.length > 0) {
    out += `  \x1b[90mModified Files: ${historyData.activeFiles.slice(0, 5).join(', ')}${historyData.activeFiles.length > 5 ? '...' : ''}\x1b[0m\n`;
  }

  out += `\x1b[32m✔ Active topic switched: "${historyData.title}"\x1b[0m\n`;
  out += `\x1b[90mYou can now continue this conversation below.\x1b[0m\n`;
  out += `\x1b[36m===============================================================\x1b[0m\n`;

  return out;
}

/**
 * Saves or updates a conversation in the workspace registry.
 * Auto-generates title if new, increments turns, and updates token metrics.
 * @param {string} cwd
 * @param {string} conversationId
 * @param {string} prompt
 * @param {object} metadata
 * @returns {object} The saved conversation
 */
export function saveWorkspaceConversation(cwd = process.cwd(), conversationId, prompt = '', metadata = {}) {
  if (!conversationId || typeof conversationId !== 'string') return null;
  const normalizedCwd = path.resolve(cwd);
  const state = getWorkspaceConversations(normalizedCwd);

  let existing = state.conversations.find(c => c.id === conversationId);

  if (existing) {
    existing.updatedAt = Date.now();
    existing.turns = (existing.turns || 1) + 1;
    if (metadata.tokens) {
      existing.cumulativeTokens = (existing.cumulativeTokens || 0) + metadata.tokens;
    }
    if (metadata.activeFiles && Array.isArray(metadata.activeFiles)) {
      existing.activeFiles = Array.from(new Set([...(existing.activeFiles || []), ...metadata.activeFiles]));
    }
    if (prompt) {
      existing.lastPrompt = prompt.slice(0, 200);
      existing.history = existing.history || [];
      existing.history.push({
        role: 'user',
        text: prompt.slice(0, 300),
        timestamp: Date.now()
      });
      if (existing.history.length > 20) {
        existing.history = existing.history.slice(-20);
      }
    }
    if (metadata.title) {
      existing.title = metadata.title;
    }
    const idx = state.conversations.indexOf(existing);
    if (idx > 0) {
      state.conversations.splice(idx, 1);
      state.conversations.unshift(existing);
    }
  } else {
    const title = metadata.title || generateConversationTitle(prompt);
    existing = {
      id: conversationId,
      title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      turns: 1,
      cumulativeTokens: metadata.tokens || 0,
      lastPrompt: (prompt || '').slice(0, 200),
      activeFiles: metadata.activeFiles || [],
      history: prompt ? [{ role: 'user', text: prompt.slice(0, 300), timestamp: Date.now() }] : []
    };
    state.conversations.unshift(existing);
  }

  state.activeId = conversationId;
  saveWorkspaceConversationsState(normalizedCwd, state);
  return existing;
}

/**
 * Deletes a conversation from the workspace registry.
 * @param {string} cwd
 * @param {number|string} indexOrId
 * @returns {{ success: boolean, deleted: object|null, message: string }}
 */
export function deleteWorkspaceConversation(cwd = process.cwd(), indexOrId) {
  const normalizedCwd = path.resolve(cwd);
  const state = getWorkspaceConversations(normalizedCwd);

  let targetIndex = -1;
  if (typeof indexOrId === 'number' || (/^\d+$/).test(String(indexOrId).trim())) {
    const idx = parseInt(indexOrId, 10) - 1;
    if (idx >= 0 && idx < state.conversations.length) {
      targetIndex = idx;
    }
  } else if (typeof indexOrId === 'string') {
    const needle = indexOrId.toLowerCase().trim();
    targetIndex = state.conversations.findIndex(c => c.id.toLowerCase().startsWith(needle));
  }

  if (targetIndex === -1) {
    return { success: false, deleted: null, message: `Conversation '${indexOrId}' not found.` };
  }

  const deleted = state.conversations.splice(targetIndex, 1)[0];

  if (state.activeId === deleted.id) {
    state.activeId = state.conversations.length > 0 ? state.conversations[0].id : null;
  }

  saveWorkspaceConversationsState(normalizedCwd, state);
  return {
    success: true,
    deleted,
    message: `Conversation "${deleted.title}" (${deleted.id.slice(0, 8)}...) was deleted.`
  };
}

/**
 * Renames a conversation title.
 * @param {string} cwd
 * @param {number|string} indexOrId
 * @param {string} newTitle
 * @returns {{ success: boolean, conversation: object|null, message: string }}
 */
export function renameWorkspaceConversation(cwd = process.cwd(), indexOrId, newTitle) {
  const normalizedCwd = path.resolve(cwd);
  const state = getWorkspaceConversations(normalizedCwd);

  let target = null;
  if (!indexOrId || indexOrId === 'active') {
    target = state.conversations.find(c => c.id === state.activeId) || state.conversations[0];
  } else if (typeof indexOrId === 'number' || (/^\d+$/).test(String(indexOrId).trim())) {
    const idx = parseInt(indexOrId, 10) - 1;
    target = state.conversations[idx];
  } else if (typeof indexOrId === 'string') {
    target = state.conversations.find(c => c.id.toLowerCase().startsWith(indexOrId.toLowerCase().trim()));
  }

  if (!target) {
    return { success: false, conversation: null, message: 'Conversation not found.' };
  }

  target.title = (newTitle || '').trim() || target.title;
  saveWorkspaceConversationsState(normalizedCwd, state);
  return {
    success: true,
    conversation: target,
    message: `Conversation title updated to: "${target.title}"`
  };
}

/**
 * Formats the conversation list into an attractive ANSI string (Antigravity IDE style).
 * @param {string} cwd
 * @returns {string}
 */
export function formatConversationList(cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);
  const { activeId, conversations } = getWorkspaceConversations(normalizedCwd);

  if (!conversations || conversations.length === 0) {
    return `\n\x1b[90m[GRAVITON]\x1b[0m No conversation history found in this workspace.\n\x1b[90m(Type any regular prompt to start a new conversation).\x1b[0m\n`;
  }

  let out = `\n\x1b[1m\x1b[36m=== GRAVITON CONVERSATIONS (Antigravity IDE History) ===\x1b[0m\n`;
  out += `\x1b[90mWorkspace: ${normalizedCwd}\x1b[0m\n\n`;

  conversations.forEach((conv, index) => {
    const num = index + 1;
    const isActive = conv.id === activeId;
    const statusBullet = isActive ? `\x1b[32m● [Active]\x1b[0m` : `\x1b[90m○\x1b[0m`;
    const titleFormatted = isActive ? `\x1b[1m\x1b[37m"${conv.title}"\x1b[0m` : `\x1b[37m"${conv.title}"\x1b[0m`;
    const tokensK = conv.cumulativeTokens ? `~${Math.round(conv.cumulativeTokens / 100) / 10}k` : '0';
    const relativeTime = formatRelativeTime(conv.updatedAt);

    out += `  \x1b[1m\x1b[33m[${num}]\x1b[0m ${statusBullet} ${titleFormatted}\n`;
    out += `      \x1b[90mID: ${conv.id.slice(0, 8)}... | ${conv.turns || 1} turns | ${tokensK} tokens | ${relativeTime}\x1b[0m\n`;
  });

  out += `\n\x1b[1mACTIONS:\x1b[0m\n`;
  out += `  \x1b[36m<number>\x1b[0m    Select & resume conversation (e.g. \x1b[1m1\x1b[0m)\n`;
  out += `  \x1b[31md <number>\x1b[0m  Delete conversation from history (e.g. \x1b[1md 2\x1b[0m)\n`;
  out += `  \x1b[32mn\x1b[0m           Start fresh conversation\n`;
  out += `  \x1b[90mq\x1b[0m           Cancel / Exit\n`;

  return out;
}

/**
 * Backward-compatible session getter.
 * @param {string} cwd
 * @returns {object|null}
 */
export function getWorkspaceSession(cwd = process.cwd()) {
  const active = getActiveConversation(cwd);
  if (!active) return null;
  return {
    conversationId: active.id,
    title: active.title,
    updatedAt: active.updatedAt,
    turns: active.turns,
    cumulativeTokens: active.cumulativeTokens,
    lastPrompt: active.lastPrompt
  };
}

/**
 * Backward-compatible session saver.
 * @param {string} cwd
 * @param {string} conversationId
 * @param {string} lastPrompt
 */
export function saveWorkspaceSession(cwd = process.cwd(), conversationId, lastPrompt = '') {
  return saveWorkspaceConversation(cwd, conversationId, lastPrompt);
}

/**
 * Clears or resets the active workspace session (starts fresh).
 * @param {string} cwd
 */
export function clearWorkspaceSession(cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);
  const state = getWorkspaceConversations(normalizedCwd);
  state.activeId = null;
  saveWorkspaceConversationsState(normalizedCwd, state);

  const localFile = path.join(normalizedCwd, '.graviton-session');
  try {
    if (fs.existsSync(localFile)) fs.unlinkSync(localFile);
  } catch {}
}

/**
 * Runs interactive conversation picker in the terminal (Antigravity IDE style).
 * @param {string} cwd
 * @param {Function} onSelectCallback
 * @returns {Promise<object|null>}
 */
export async function runInteractiveConversationPicker(cwd = process.cwd(), onSelectCallback = null) {
  const normalizedCwd = path.resolve(cwd);
  const listOutput = formatConversationList(normalizedCwd);
  console.log(listOutput);

  const { conversations } = getWorkspaceConversations(normalizedCwd);
  if (!conversations || conversations.length === 0 || !process.stdin.isTTY) {
    return null;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\x1b[1;36mSelect action (1-' + conversations.length + ', d <no>, n, q): \x1b[0m', async (answer) => {
      rl.close();
      const trimmed = (answer || '').trim();

      if (!trimmed || trimmed.toLowerCase() === 'q') {
        console.log('\x1b[90mCancelled.\x1b[0m\n');
        resolve(null);
        return;
      }

      if (trimmed.toLowerCase() === 'n' || trimmed.toLowerCase() === 'new') {
        clearWorkspaceSession(normalizedCwd);
        console.log('\x1b[32m✔ Fresh conversation ready. Previous session reset.\x1b[0m\n');
        resolve({ isNew: true });
        return;
      }

      if (trimmed.toLowerCase().startsWith('d ') || trimmed.toLowerCase().startsWith('del ')) {
        const parts = trimmed.split(/\s+/);
        const targetNum = parts[1];
        const res = deleteWorkspaceConversation(normalizedCwd, targetNum);
        if (res.success) {
          console.log(`\x1b[32m✔ ${res.message}\x1b[0m\n`);
        } else {
          console.log(`\x1b[31m✖ ${res.message}\x1b[0m\n`);
        }
        resolve({ deleted: true });
        return;
      }

      if (/^\d+$/.test(trimmed)) {
        const selected = setActiveConversation(normalizedCwd, trimmed);
        if (selected) {
          const hist = getConversationHistory(normalizedCwd, selected.id, 5);
          console.log(formatConversationHistory(hist));
          if (typeof onSelectCallback === 'function') {
            await onSelectCallback(selected);
          }
          resolve(selected);
          return;
        } else {
          console.log(`\x1b[31m✖ Invalid conversation number '${trimmed}'.\x1b[0m\n`);
          resolve(null);
          return;
        }
      }

      console.log('\x1b[33mUnrecognized choice.\x1b[0m\n');
      resolve(null);
    });
  });
}
