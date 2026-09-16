// src/diff-viewer.js - Graviton V2.0.0 Colorized Session Diff Viewer
import fs from 'fs';
import path from 'path';

/**
 * Computes a line-by-line diff between two text strings without external dependencies.
 * @param {string} oldText
 * @param {string} newText
 * @returns {Array<{ type: 'same'|'add'|'del', line: string, oldLineNo?: number, newLineNo?: number }>}
 */
export function computeLineDiff(oldText, newText) {
  const oldLines = oldText.split(/\r?\n/);
  const newLines = newText.split(/\r?\n/);
  const diff = [];

  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      diff.push({ type: 'same', line: oldLines[i], oldLineNo: i + 1, newLineNo: j + 1 });
      i++;
      j++;
    } else {
      // Check for lookahead match
      let foundMatch = false;
      for (let look = 1; look <= 3; look++) {
        if (i + look < oldLines.length && oldLines[i + look] === newLines[j]) {
          // Deletions occurred in oldLines
          for (let d = 0; d < look; d++) {
            diff.push({ type: 'del', line: oldLines[i + d], oldLineNo: i + d + 1 });
          }
          i += look;
          foundMatch = true;
          break;
        }
        if (j + look < newLines.length && oldLines[i] === newLines[j + look]) {
          // Additions occurred in newLines
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

  return diff;
}

/**
 * Formats line diff into a clean, colorized ANSI unified diff.
 * @param {string} filePath
 * @param {Array<object>} diff
 * @returns {string}
 */
export function formatFileDiff(filePath, diff) {
  const hasChanges = diff.some(d => d.type === 'add' || d.type === 'del');
  if (!hasChanges) {
    return `\x1b[90m--- ${filePath} (No content changes)\x1b[0m`;
  }

  const output = [
    `\x1b[1m\x1b[36m--- a/${filePath} (pre-session state)\x1b[0m`,
    `\x1b[1m\x1b[36m+++ b/${filePath} (post-AI modifications)\x1b[0m`
  ];

  for (const item of diff) {
    if (item.type === 'del') {
      output.push(`\x1b[31m- ${item.line}\x1b[0m`);
    } else if (item.type === 'add') {
      output.push(`\x1b[32m+ ${item.line}\x1b[0m`);
    } else {
      // Keep a small context of unchanged lines
      output.push(`\x1b[90m  ${item.line}\x1b[0m`);
    }
  }

  return output.join('\n');
}

/**
 * Inspects changes from the latest session manifest and outputs a complete diff.
 * @param {string} cwd
 * @returns {string} Colorized diff report
 */
export function getSessionDiff(cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);
  const manifestPath = path.join(normalizedCwd, '.graviton-manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return '\x1b[33m[!] Tidak ditemukan riwayat perubahan sesi Graviton di workspace ini.\x1b[0m';
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const reports = [
      `\n\x1b[1m\x1b[36m=== GRAVITON V2.0.0 SESSION DIFF REVIEW ===\x1b[0m`
    ];

    let changeCount = 0;

    // 1. Process modified files
    if (Array.isArray(manifest.modified) && manifest.modified.length > 0) {
      for (const item of manifest.modified) {
        const origPath = typeof item === 'string' ? item : (item.original || '');
        const backupPath = typeof item === 'string' ? null : (item.backup || '');
        const relPath = path.relative(normalizedCwd, origPath).replace(/\\/g, '/');

        if (backupPath && fs.existsSync(backupPath) && fs.existsSync(origPath)) {
          const oldText = fs.readFileSync(backupPath, 'utf8');
          const newText = fs.readFileSync(origPath, 'utf8');
          const diff = computeLineDiff(oldText, newText);
          reports.push('\n' + formatFileDiff(relPath, diff));
          changeCount++;
        }
      }
    }

    // 2. Process newly created files
    if (Array.isArray(manifest.created) && manifest.created.length > 0) {
      for (const newFilePath of manifest.created) {
        const relPath = path.relative(normalizedCwd, newFilePath).replace(/\\/g, '/');
        reports.push(`\n\x1b[32m+ [NEW FILE CREATED BY AI] ${relPath}\x1b[0m`);
        changeCount++;
      }
    }

    if (changeCount === 0) {
      return '\x1b[90mTidak ada perubahan file pada sesi terakhir.\x1b[0m';
    }

    reports.push(`\n\x1b[36m👉 Tip:\x1b[0m Untuk membatalkan semua perubahan di atas, ketik '\x1b[1mgraviton undo\x1b[0m'.\n`);
    return reports.join('\n');
  } catch (err) {
    return `\x1b[31mGagal membaca session diff: ${err.message}\x1b[0m`;
  }
}
