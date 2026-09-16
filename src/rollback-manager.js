// src/rollback-manager.js - Graviton V1.9.0 Safety Rollback Guard
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createGravitonFilter } from './ignore-parser.js';

/**
 * Graviton V1.9.0 Safety Rollback Guard
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
 * Reverts the workspace to the state prior to the most recent AI session.
 * Restores modified files from shadow backup and deletes newly created files.
 * @param {string} cwd
 * @returns {{ success: boolean, restored: string[], removed: string[], message?: string }}
 */
export function executeRollback(cwd = process.cwd()) {
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

  const restored = [];
  const removed = [];

  // Revert modified files
  if (Array.isArray(manifest.modified)) {
    for (const item of manifest.modified) {
      const originalPath = item.original;
      const backupPath = item.backup;
      if (backupPath && fs.existsSync(backupPath)) {
        try {
          const originalDir = path.dirname(originalPath);
          if (!fs.existsSync(originalDir)) {
            fs.mkdirSync(originalDir, { recursive: true });
          }
          fs.copyFileSync(backupPath, originalPath);
          const rel = path.relative(normalizedCwd, originalPath).replace(/\\/g, '/');
          restored.push(rel);
        } catch {}
      }
    }
  }

  // Delete newly created files
  if (Array.isArray(manifest.created)) {
    for (const filePath of manifest.created) {
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          const rel = path.relative(normalizedCwd, filePath).replace(/\\/g, '/');
          removed.push(rel);
        } catch {}
      }
    }
  }

  // Clean up local manifest so rollback is not accidentally duplicated
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

  return {
    success: true,
    restored,
    removed,
    message: `Rollback complete: ${restored.length} files restored, ${removed.length} new files removed.`
  };
}
