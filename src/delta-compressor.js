// src/delta-compressor.js - Graviton V2.5.0 Delta Compression & Turn Diff Caching Engine
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { normalizePosixPath } from './ignore-parser.js';

/**
 * Computes a SHA-256 hash of text content.
 * @param {string} content
 * @returns {string}
 */
export function computeFileHash(content) {
  if (typeof content !== 'string') return '';
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

/**
 * Resolves the snapshot storage directory for a workspace and conversation.
 * @param {string} cwd
 * @param {string} [conversationId]
 * @returns {string}
 */
export function getSnapshotDir(cwd = process.cwd(), conversationId = 'default') {
  const safeId = (conversationId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const snapshotDir = path.join(path.resolve(cwd), '.graviton', 'snapshots', safeId);
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }
  return snapshotDir;
}

/**
 * Sanitizes a relative file path for safe filename storage on disk.
 * @param {string} relPath
 * @returns {string}
 */
function getSafeFileName(relPath) {
  return relPath.replace(/[/\\?%*:|"<>]/g, '_') + '.snap';
}

/**
 * Retrieves manifest metadata for a conversation session.
 * @param {string} snapshotDir
 * @returns {object}
 */
function getManifest(snapshotDir) {
  const manifestPath = path.join(snapshotDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      return { files: {} };
    }
  }
  return { files: {} };
}

/**
 * Saves manifest metadata for a conversation session.
 * @param {string} snapshotDir
 * @param {object} manifest
 */
function saveManifest(snapshotDir, manifest) {
  try {
    const manifestPath = path.join(snapshotDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  } catch {}
}

/**
 * Records a file snapshot for the current conversation session.
 * @param {string} cwd
 * @param {string} relPath
 * @param {string} content
 * @param {string} [conversationId]
 * @returns {{ hash: string, lineCount: number }}
 */
export function recordFileSnapshot(cwd, relPath, content, conversationId = 'default') {
  const snapshotDir = getSnapshotDir(cwd, conversationId);
  const hash = computeFileHash(content);
  const normalizedRel = normalizePosixPath(relPath);
  const lineCount = content.split(/\r?\n/).length;

  const manifest = getManifest(snapshotDir);
  const safeName = getSafeFileName(normalizedRel);
  const contentPath = path.join(snapshotDir, safeName);

  try {
    fs.writeFileSync(contentPath, content, 'utf8');
    manifest.files = manifest.files || {};
    manifest.files[normalizedRel] = {
      hash,
      lineCount,
      safeName,
      updatedAt: Date.now()
    };
    saveManifest(snapshotDir, manifest);
  } catch {}

  return { hash, lineCount };
}

/**
 * Retrieves the previously recorded snapshot of a file.
 * @param {string} cwd
 * @param {string} relPath
 * @param {string} [conversationId]
 * @returns {{ hash: string, content: string, lineCount: number } | null}
 */
export function getPreviousSnapshot(cwd, relPath, conversationId = 'default') {
  const snapshotDir = getSnapshotDir(cwd, conversationId);
  const normalizedRel = normalizePosixPath(relPath);
  const manifest = getManifest(snapshotDir);

  if (!manifest.files || !manifest.files[normalizedRel]) {
    return null;
  }

  const meta = manifest.files[normalizedRel];
  const contentPath = path.join(snapshotDir, meta.safeName);

  if (fs.existsSync(contentPath)) {
    try {
      const content = fs.readFileSync(contentPath, 'utf8');
      return {
        hash: meta.hash,
        lineCount: meta.lineCount,
        content
      };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Computes a standard unified diff with context hunks between old and new text.
 * Zero external dependencies.
 * @param {string} oldText
 * @param {string} newText
 * @param {string} [relPath='file']
 * @param {number} [contextLines=3]
 * @returns {{ diffText: string, additions: number, deletions: number, changeRatio: number }}
 */
export function computeHunkDiff(oldText, newText, relPath = 'file', contextLines = 3) {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);

  // Line diff elements: 'same' | 'add' | 'del'
  const diff = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      diff.push({ type: 'same', line: oldLines[i], oldLineNo: i + 1, newLineNo: j + 1 });
      i++;
      j++;
    } else {
      let foundMatch = false;
      for (let look = 1; look <= 5; look++) {
        if (i + look < oldLines.length && oldLines[i + look] === newLines[j]) {
          for (let d = 0; d < look; d++) {
            diff.push({ type: 'del', line: oldLines[i + d], oldLineNo: i + d + 1 });
          }
          i += look;
          foundMatch = true;
          break;
        }
        if (j + look < newLines.length && oldLines[i] === newLines[j + look]) {
          for (let a = 0; a < look; a++) {
            diff.push({ type: 'add', line: newLines[j + a], newLineNo: j + a + 1 });
          }
          j += look;
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        if (i < oldLines.length) {
          diff.push({ type: 'del', line: oldLines[i], oldLineNo: i + 1 });
          i++;
        }
        if (j < newLines.length) {
          diff.push({ type: 'add', line: newLines[j], newLineNo: j + 1 });
          j++;
        }
      }
    }
  }

  let additions = 0;
  let deletions = 0;
  for (const item of diff) {
    if (item.type === 'add') additions++;
    if (item.type === 'del') deletions++;
  }

  const changeRatio = (additions + deletions) / Math.max(1, oldLines.length);

  // If no changes at all
  if (additions === 0 && deletions === 0) {
    return { diffText: '', additions: 0, deletions: 0, changeRatio: 0 };
  }

  // Construct standard hunk blocks with surrounding context
  const hunks = [];
  let currentHunk = null;

  for (let idx = 0; idx < diff.length; idx++) {
    const item = diff[idx];
    if (item.type === 'add' || item.type === 'del') {
      if (!currentHunk) {
        // Collect pre-context
        const preStart = Math.max(0, idx - contextLines);
        const preContext = diff.slice(preStart, idx);
        currentHunk = {
          items: [...preContext],
          lastChangeIdx: idx
        };
      }
      currentHunk.items.push(item);
      currentHunk.lastChangeIdx = currentHunk.items.length - 1;
    } else if (currentHunk) {
      currentHunk.items.push(item);
      // Check if we have exceeded context lines after the last change
      const trailingContext = currentHunk.items.length - 1 - currentHunk.lastChangeIdx;
      if (trailingContext >= contextLines) {
        hunks.push(currentHunk.items);
        currentHunk = null;
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk.items);
  }

  // Format hunk headers @@ -oldStart,oldCount +newStart,newCount @@
  const diffOutput = [
    `--- a/${relPath}`,
    `+++ b/${relPath}`
  ];

  for (const hunk of hunks) {
    let oldStart = null;
    let newStart = null;
    let oldCount = 0;
    let newCount = 0;

    for (const item of hunk) {
      if (item.type === 'same') {
        if (oldStart === null) oldStart = item.oldLineNo;
        if (newStart === null) newStart = item.newLineNo;
        oldCount++;
        newCount++;
      } else if (item.type === 'del') {
        if (oldStart === null) oldStart = item.oldLineNo;
        oldCount++;
      } else if (item.type === 'add') {
        if (newStart === null) newStart = item.newLineNo;
        newCount++;
      }
    }

    oldStart = oldStart || 1;
    newStart = newStart || 1;

    diffOutput.push(`@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`);
    for (const item of hunk) {
      if (item.type === 'same') {
        diffOutput.push(` ${item.line}`);
      } else if (item.type === 'del') {
        diffOutput.push(`-${item.line}`);
      } else if (item.type === 'add') {
        diffOutput.push(`+${item.line}`);
      }
    }
  }

  return {
    diffText: diffOutput.join('\n'),
    additions,
    deletions,
    changeRatio
  };
}

/**
 * Resolves conversational delta hydration for a source file.
 * Returns either:
 * - { mode: 'baseline', content: rawContent }
 * - { mode: 'unchanged', text: string }
 * - { mode: 'delta', text: string, additions, deletions, savedPct }
 * - { mode: 'full', content: rawContent, note: string }
 * 
 * @param {string} filePath Absolute or relative path to file
 * @param {string} rawContent Current content of the file
 * @param {string} [cwd] Workspace directory
 * @param {object} [options] Options
 * @returns {object}
 */
export function resolveDeltaHydration(filePath, rawContent, cwd = process.cwd(), options = {}) {
  const currentCwd = path.resolve(cwd);
  const relPath = normalizePosixPath(
    path.isAbsolute(filePath)
      ? path.relative(currentCwd, filePath)
      : filePath
  );

  const conversationId = options.conversationId || 'default';
  const threshold = typeof options.threshold === 'number' ? options.threshold : 0.4;

  // If delta is explicitly disabled
  if (options.noDelta) {
    return { mode: 'full', content: rawContent };
  }

  const prev = getPreviousSnapshot(currentCwd, relPath, conversationId);

  // 1. FIRST TIME SEEN IN THIS SESSION: Establish baseline snapshot
  if (!prev) {
    recordFileSnapshot(currentCwd, relPath, rawContent, conversationId);
    return {
      mode: 'baseline',
      content: rawContent
    };
  }

  const currentHash = computeFileHash(rawContent);

  // 2. UNCHANGED: Content is 100% identical to previous turn
  if (currentHash === prev.hash) {
    return {
      mode: 'unchanged',
      relPath,
      text: `[GRAVITON CONTEXT REUSE: ${relPath}]\n// (Content unchanged from previous turn in this conversation - reference existing context in memory)`
    };
  }

  // 3. MODIFIED: Compute Unified Diff Hunk
  const diffResult = computeHunkDiff(prev.content, rawContent, relPath);

  // If modifications are within the compression threshold (<= 40% changed lines)
  if (diffResult.changeRatio <= threshold && diffResult.diffText.length < rawContent.length) {
    // Record updated snapshot for subsequent turns
    recordFileSnapshot(currentCwd, relPath, rawContent, conversationId);

    const savedPct = Math.max(0, Math.round((1 - (diffResult.diffText.length / Math.max(1, rawContent.length))) * 100));

    return {
      mode: 'delta',
      relPath,
      additions: diffResult.additions,
      deletions: diffResult.deletions,
      savedPct,
      text: `[GRAVITON TURN DELTA: ${relPath} (+${diffResult.additions}, -${diffResult.deletions} lines since previous turn)]\n\`\`\`diff\n${diffResult.diffText}\n\`\`\``
    };
  }

  // 4. MAJOR REWRITE (> 40% lines changed): Fallback to full content and refresh snapshot
  recordFileSnapshot(currentCwd, relPath, rawContent, conversationId);
  return {
    mode: 'full',
    content: rawContent,
    note: 'major rewrite'
  };
}

/**
 * Clears all snapshots stored for a specific conversation session.
 * @param {string} cwd
 * @param {string} [conversationId]
 * @returns {boolean}
 */
export function clearSessionSnapshots(cwd = process.cwd(), conversationId = 'default') {
  try {
    const snapshotDir = getSnapshotDir(cwd, conversationId);
    if (fs.existsSync(snapshotDir)) {
      fs.rmSync(snapshotDir, { recursive: true, force: true });
      return true;
    }
  } catch {}
  return false;
}

/**
 * Lists all tracked snapshots in a conversation session.
 * @param {string} cwd
 * @param {string} [conversationId]
 * @returns {Array<{ file: string, lineCount: number, updatedAt: number }>}
 */
export function listSessionSnapshots(cwd = process.cwd(), conversationId = 'default') {
  const snapshotDir = getSnapshotDir(cwd, conversationId);
  const manifest = getManifest(snapshotDir);
  const result = [];

  if (manifest.files) {
    for (const [file, meta] of Object.entries(manifest.files)) {
      result.push({
        file,
        lineCount: meta.lineCount,
        updatedAt: meta.updatedAt
      });
    }
  }
  return result;
}
