// test/test_v200_conversation_manager.js - Graviton V2.0.0 Conversation Manager Test Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  generateConversationTitle,
  formatRelativeTime,
  getWorkspaceConversations,
  getActiveConversation,
  setActiveConversation,
  saveWorkspaceConversation,
  deleteWorkspaceConversation,
  renameWorkspaceConversation,
  formatConversationList,
  getWorkspaceSession,
  saveWorkspaceSession,
  clearWorkspaceSession
} from '../src/session-manager.js';
import { constructSuperPrompt } from '../src/pipeline.js';

console.log('=== STARTING V2.0.0 CONVERSATION MANAGER (IDE-STYLE) TEST SUITE ===\n');

// -------------------------------------------------------------------------
// TEST 1: Auto-Generated Topic Titles
// -------------------------------------------------------------------------
console.log('[TEST 1] Auto-Generated Topic Titles');
const title1 = generateConversationTitle('tolong perbaiki bug validasi email pada auth.js');
assert.strictEqual(title1, 'Perbaiki bug validasi email pada auth.js');

const title2 = generateConversationTitle('Fix TypeError: Cannot read property data of undefined in server.js');
assert.ok(title2.startsWith('Fix TypeError: Cannot read property'), 'Title must capture core error');

const title3 = generateConversationTitle('   ');
assert.strictEqual(title3, 'Percakapan Baru');

console.log('  ✔ generateConversationTitle correctly extracts clean, concise topic titles');

// -------------------------------------------------------------------------
// TEST 2: Multi-Conversation Lifecycle in Workspace
// -------------------------------------------------------------------------
console.log('\n[TEST 2] Multi-Conversation Registry Lifecycle (Create, List, Switch, Delete)');
const tempDir = path.join(os.tmpdir(), 'graviton-conv-test-' + Date.now());
fs.mkdirSync(tempDir, { recursive: true });

try {
  // Initially empty
  const initial = getWorkspaceConversations(tempDir);
  assert.strictEqual(initial.conversations.length, 0);
  assert.strictEqual(initial.activeId, null);

  // 1. Create Conversation 1
  const conv1 = saveWorkspaceConversation(tempDir, 'uuid-conv-1', 'buatkan server express di index.js', { tokens: 3500 });
  assert.ok(conv1);
  assert.strictEqual(conv1.id, 'uuid-conv-1');
  assert.strictEqual(conv1.title, 'Buatkan server express di index.js');
  assert.strictEqual(conv1.turns, 1);
  assert.strictEqual(conv1.cumulativeTokens, 3500);

  let state = getWorkspaceConversations(tempDir);
  assert.strictEqual(state.conversations.length, 1);
  assert.strictEqual(state.activeId, 'uuid-conv-1');
  console.log('  ✔ Conversation 1 saved with auto-title and set as active');

  // 2. Create Conversation 2 (Simulates user starting a new chat)
  const conv2 = saveWorkspaceConversation(tempDir, 'uuid-conv-2', 'tolong buatkan file README dan lisensi MIT', { tokens: 1200 });
  assert.ok(conv2);
  assert.strictEqual(conv2.id, 'uuid-conv-2');
  assert.strictEqual(conv2.title, 'Buatkan file README dan lisensi MIT');
  
  state = getWorkspaceConversations(tempDir);
  assert.strictEqual(state.conversations.length, 2);
  assert.strictEqual(state.activeId, 'uuid-conv-2'); // newly created becomes active
  console.log('  ✔ Conversation 2 created and newly activated');

  // 3. Update Conversation 1 (Multi-turn continuity)
  const conv1Turn2 = saveWorkspaceConversation(tempDir, 'uuid-conv-1', 'tambahkan route /users', { tokens: 2000 });
  assert.strictEqual(conv1Turn2.turns, 2);
  assert.strictEqual(conv1Turn2.cumulativeTokens, 5500);
  assert.strictEqual(getActiveConversation(tempDir).id, 'uuid-conv-1');
  console.log('  ✔ Multi-turn continuation updates turns and tokens seamlessly');

  // 4. Switch Active Conversation
  const switched = setActiveConversation(tempDir, 2); // switch to conversation at index 2 (1-based)
  assert.ok(switched);
  assert.strictEqual(switched.id, 'uuid-conv-2');
  assert.strictEqual(getActiveConversation(tempDir).id, 'uuid-conv-2');
  console.log('  ✔ Switched active conversation to #2');

  // 5. Rename Conversation
  const renameRes = renameWorkspaceConversation(tempDir, 'active', 'REST API & User Routes');
  assert.ok(renameRes.success);
  assert.strictEqual(getActiveConversation(tempDir).title, 'REST API & User Routes');
  console.log('  ✔ Renamed active conversation title');

  // 6. Delete Conversation
  const delRes = deleteWorkspaceConversation(tempDir, 1); // delete first item
  assert.ok(delRes.success);
  state = getWorkspaceConversations(tempDir);
  assert.strictEqual(state.conversations.length, 1);
  console.log('  ✔ Deleted conversation from registry successfully');

  // 7. Format Output List
  const listFormatted = formatConversationList(tempDir);
  assert.ok(listFormatted.includes('GRAVITON CONVERSATIONS'), 'Must contain header');
  assert.ok(listFormatted.includes('REST API & User Routes') || listFormatted.includes('Buatkan server'), 'Must display active title');
  console.log('  ✔ formatConversationList renders attractive ANSI history');

} finally {
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

// -------------------------------------------------------------------------
// TEST 3: Topic Anchoring in constructSuperPrompt
// -------------------------------------------------------------------------
console.log('\n[TEST 3] Active Topic Anchoring in constructSuperPrompt');
const testCwd = process.cwd();
const anchoredPrompt = constructSuperPrompt('perbaiki error CORS', testCwd, {
  isContinuous: true,
  conversationTitle: 'Fix Authentication & Session'
});

assert.ok(anchoredPrompt.includes('[ACTIVE CONVERSATION TOPIC]: "Fix Authentication & Session"'), 'SuperPrompt must include active topic anchor');
assert.ok(anchoredPrompt.includes('Stay strictly focused on resolving tasks within this conversation topic'), 'Prompt must enforce strict focus');
console.log('  ✔ constructSuperPrompt successfully injects topic anchoring directive');

// -------------------------------------------------------------------------
// TEST 4: Backwards Compatibility with getWorkspaceSession
// -------------------------------------------------------------------------
console.log('\n[TEST 4] Backwards Compatibility with getWorkspaceSession & clearWorkspaceSession');
const tempCompat = path.join(os.tmpdir(), 'graviton-compat-' + Date.now());
fs.mkdirSync(tempCompat, { recursive: true });

try {
  saveWorkspaceSession(tempCompat, 'compat-uuid-1', 'initial prompt');
  const session = getWorkspaceSession(tempCompat);
  assert.ok(session);
  assert.strictEqual(session.conversationId, 'compat-uuid-1');

  clearWorkspaceSession(tempCompat);
  const afterClear = getWorkspaceSession(tempCompat);
  assert.strictEqual(afterClear, null);
  console.log('  ✔ Backward-compatible session methods function perfectly');
} finally {
  try {
    fs.rmSync(tempCompat, { recursive: true, force: true });
  } catch {}
}

console.log('\n=== ALL V2.0.0 CONVERSATION MANAGER TESTS PASSED! ===\n');
