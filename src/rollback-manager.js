// src/rollback-manager.js - .0.0 Safety Rollback Guard
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createGravitonFilter } from './ignore-parser.js';

/**
 * .0.0 Safety Rollback Guard
 * Provides one-click instant restoration of files modified or created during an AI session.
 */

export function getManifestsDir() {
  const dir = path.join(os.homedir(), '.graviton', 'manifests');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getBackupsDir() {
  const dir = path.join(os.homedir(), '.graviton', 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__',
  '.gemini', 'coverage', '.next', 'target', '.turbo',
  '.cache', 'venv', '.venv', '.idea', '.vscode',
  '.graviton', '.graviton-session'
]);

/**
 * Captures a recursive list of all file relative paths in a workspace.
 * Skips ignored noise directories and .gravignore rules.
 * @param {string} cwd
 * @param {number} maxDepth
 * @returns {Set<string>} Set of relative file paths
 */
export function captureWorkspaceSnapshot(cwd = process.cwd(), maxDepth = 4) {
  const snapshot = new Set();
  const filter = createGravitonFilter(cwd);

  function walk(currentDir, depth) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.graviton')) continue;
        if (entry.isDirectory()) {
          if (IGNORE_DIRS.has(entry.name)) continue;
          const fullPath = path.join(currentDir, entry.name);
          if (filter.isIgnored(fullPath)) continue;
          walk(fullPath, depth + 1);
        } else if (entry.isFile()) {
          const fullPath = path.join(currentDir, entry.name);
          if (filter.isIgnored(fullPath)) continue;
          const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
          snapshot.add(relPath);
        }
      }
    } catch {}
  }

  walk(cwd, 0);
  return snapshot;
}

/**
 * Creates shadow backups of modified files and generates a session manifest.
 * @param {string} cwd
 * @param {string} conversationId
 * @param {Array<{original: string, backup: string}>} backedUpFiles
 * @param {Set<string>} initialSnapshot
 * @returns {object} Manifest object
 */
export function saveSessionManifest(cwd = process.cwd(), conversationId = '', backedUpFiles = [], initialSnapshot = new Set()) {
  const normalizedCwd = path.resolve(cwd);
  const currentSnapshot = captureWorkspaceSnapshot(normalizedCwd);

  // Detect newly created files
  const newlyCreated = [];
  for (const file of currentSnapshot) {
    if (!initialSnapshot.has(file)) {
      newlyCreated.push(path.resolve(normalizedCwd, file));
    }
  }

  const manifest = {
    conversationId,
    workspace: normalizedCwd,
    timestamp: Date.now(),
    modified: backedUpFiles || [],
    created: newlyCreated
  };

  // 1. Write local workspace manifest
  try {
    const localManifest = path.join(normalizedCwd, '.graviton-manifest.json');
    fs.writeFileSync(localManifest, JSON.stringify(manifest, null, 2), 'utf8');
  } catch {}

  // 2. Write global manifest in ~/.graviton/manifests/
  try {
    const manifestsDir = getManifestsDir();
    const manifestFile = path.join(manifestsDir, `manifest-${Date.now()}.json`);
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2), 'utf8');

    // Update workspace latest index
    const indexPath = path.join(manifestsDir, 'workspace-manifests.json');
    let index = {};
    if (fs.existsSync(indexPath)) {
      try {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      } catch {}
    }
    index[normalizedCwd] = manifest;
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  } catch {}

  return manifest;
}

/**
 * Retrieves the list of reversible items from the latest workspace session manifest.
 * Each item has a 1-based index (id), type ('modified' | 'created'), and relative path.
 * @param {string} cwd
 * @returns {Array<{ id: number, type: 'modified' | 'created', path: string, original?: string, backup?: string }>}
 */
export function listRollbackItems(cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);
  let manifest = null;

  const localManifest = path.join(normalizedCwd, '.graviton-manifest.json');
  if (fs.existsSync(localManifest)) {
    try {
      manifest = JSON.parse(fs.readFileSync(localManifest, 'utf8'));
    } catch {}
  }

  if (!manifest) {
    try {
      const manifestsDir = getManifestsDir();
      const indexPath = path.join(manifestsDir, 'workspace-manifests.json');
      if (fs.existsSync(indexPath)) {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        manifest = index[normalizedCwd];
      }
    } catch {}
  }

  if (!manifest) return [];

  const items = [];
  let counter = 1;

  if (Array.isArray(manifest.modified)) {
    for (const mod of manifest.modified) {
      const rel = path.relative(normalizedCwd, mod.original).replace(/\\/g, '/');
      items.push({
        id: counter++,
        type: 'modified',
        path: rel,
        original: mod.original,
        backup: mod.backup
      });
    }
  }

  if (Array.isArray(manifest.created)) {
    for (const createdPath of manifest.created) {
      const rel = path.relative(normalizedCwd, createdPath).replace(/\\/g, '/');
      items.push({
        id: counter++,
        type: 'created',
        path: rel,
        original: createdPath
      });
    }
  }

  return items;
}

/**
 * Reverts the workspace to the state prior to the most recent AI session.
 * Supports granular selective rollback by item indices (e.g. [1, 2]).
 * Restores modified files from shadow backup and deletes newly created files.
 * @param {string} cwd
 * @param {number[]|null} [targetIndices] Optional 1-based indices to selectively rollback
 * @returns {{ success: boolean, restored: string[], removed: string[], remainingCount?: number, message?: string }}
 */
export function executeRollback(cwd = process.cwd(), targetIndices = null) {
  const normalizedCwd = path.resolve(cwd);
  let manifest = null;

  // 1. Try local manifest first
  const localManifest = path.join(normalizedCwd, '.graviton-manifest.json');
  if (fs.existsSync(localManifest)) {
    try {
      manifest = JSON.parse(fs.readFileSync(localManifest, 'utf8'));
    } catch {}
  }

  // 2. Fallback to global registry
  if (!manifest) {
    try {
      const manifestsDir = getManifestsDir();
      const indexPath = path.join(manifestsDir, 'workspace-manifests.json');
      if (fs.existsSync(indexPath)) {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        manifest = index[normalizedCwd];
      }
    } catch {}
  }

  if (!manifest || (!manifest.modified?.length && !manifest.created?.length)) {
    return {
      success: false,
      restored: [],
      removed: [],
      message: 'No recorded Graviton session found to rollback in this workspace.'
    };
  }

  // Build unified item list
  const allItems = [];
  let counter = 1;
  if (Array.isArray(manifest.modified)) {
    for (const mod of manifest.modified) {
      allItems.push({
        id: counter++,
        type: 'modified',
        original: mod.original,
        backup: mod.backup,
        rel: path.relative(normalizedCwd, mod.original).replace(/\\/g, '/')
      });
    }
  }
  if (Array.isArray(manifest.created)) {
    for (const createdPath of manifest.created) {
      allItems.push({
        id: counter++,
        type: 'created',
        original: createdPath,
        rel: path.relative(normalizedCwd, createdPath).replace(/\\/g, '/')
      });
    }
  }

  // Filter items if specific targetIndices provided (e.g. [1, 2])
  let itemsToProcess = allItems;
  let hasFilter = false;
  if (Array.isArray(targetIndices) && targetIndices.length > 0) {
    hasFilter = true;
    const targetsSet = new Set(targetIndices.map(n => Number(n)));
    itemsToProcess = allItems.filter(item => targetsSet.has(item.id));
    if (itemsToProcess.length === 0) {
      return {
        success: false,
        restored: [],
        removed: [],
        message: `No matching items found for item numbers: ${targetIndices.join(', ')} (Available: 1 to ${allItems.length})`
      };
    }
  }

  const restored = [];
  const removed = [];
  const processedIds = new Set();

  for (const item of itemsToProcess) {
    if (item.type === 'modified') {
      if (item.backup && fs.existsSync(item.backup)) {
        try {
          const originalDir = path.dirname(item.original);
          if (!fs.existsSync(originalDir)) {
            fs.mkdirSync(originalDir, { recursive: true });
          }
          fs.copyFileSync(item.backup, item.original);
          restored.push(item.rel);
          processedIds.add(item.id);
        } catch {}
      }
    } else if (item.type === 'created') {
      if (fs.existsSync(item.original)) {
        try {
          fs.unlinkSync(item.original);
          removed.push(item.rel);
          processedIds.add(item.id);
        } catch {}
      } else {
        removed.push(item.rel);
        processedIds.add(item.id);
      }
    }
  }

  // Update or clear manifest
  const remainingItems = allItems.filter(item => !processedIds.has(item.id));

  if (remainingItems.length === 0 || !hasFilter) {
    // Completely cleaned up
    try {
      if (fs.existsSync(localManifest)) {
        fs.unlinkSync(localManifest);
      }
      const manifestsDir = getManifestsDir();
      const indexPath = path.join(manifestsDir, 'workspace-manifests.json');
      if (fs.existsSync(indexPath)) {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        delete index[normalizedCwd];
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
      }
    } catch {}
  } else {
    // Partial rollback: update manifest with remaining items
    const remainingModified = remainingItems
      .filter(it => it.type === 'modified')
      .map(it => ({ original: it.original, backup: it.backup }));
    const remainingCreated = remainingItems
      .filter(it => it.type === 'created')
      .map(it => it.original);

    manifest.modified = remainingModified;
    manifest.created = remainingCreated;

    try {
      fs.writeFileSync(localManifest, JSON.stringify(manifest, null, 2), 'utf8');
      const manifestsDir = getManifestsDir();
      const indexPath = path.join(manifestsDir, 'workspace-manifests.json');
      if (fs.existsSync(indexPath)) {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        index[normalizedCwd] = manifest;
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
      }
    } catch {}
  }

  return {
    success: true,
    restored,
    removed,
    remainingCount: remainingItems.length,
    message: `Rollback complete: ${restored.length} files restored, ${removed.length} new files removed.` +
      (remainingItems.length > 0 ? ` (${remainingItems.length} file(s) remain in session manifest)` : '')
  };
}
