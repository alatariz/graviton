// src/cache-manager.js - Graviton V2.3.0 Document Transpilation Caching Layer
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * Returns the transpiler cache directory.
 * Defaults to workspace `.graviton/cache/transpiler` or user home directory fallback.
 * @param {string} cwd
 * @returns {string}
 */
export function getTranspilerCacheDir(cwd = process.cwd()) {
  const wsDir = path.join(path.resolve(cwd), '.graviton', 'cache', 'transpiler');
  try {
    if (!fs.existsSync(wsDir)) {
      fs.mkdirSync(wsDir, { recursive: true });
    }
    return wsDir;
  } catch {
    const homeDir = path.join(os.homedir(), '.graviton', 'cache', 'transpiler');
    if (!fs.existsSync(homeDir)) {
      try {
        fs.mkdirSync(homeDir, { recursive: true });
      } catch {}
    }
    return homeDir;
  }
}

/**
 * Generates a unique cache key for a document based on its path, size, and modification timestamp.
 * Runs in microseconds without reading full file content.
 * @param {string} filePath
 * @returns {string|null}
 */
export function computeFileHashKey(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const rawSignature = `${path.resolve(filePath)}:${stat.size}:${Math.floor(stat.mtimeMs)}`;
    return crypto.createHash('sha256').update(rawSignature).digest('hex');
  } catch {
    return null;
  }
}

/**
 * Retrieves cached markdown for a given file if available and up to date.
 * @param {string} filePath
 * @param {string} cwd
 * @returns {string|null}
 */
export function getCachedMarkdown(filePath, cwd = process.cwd()) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const key = computeFileHashKey(filePath);
  if (!key) return null;

  const cacheDir = getTranspilerCacheDir(cwd);
  const cacheFile = path.join(cacheDir, `${key}.md`);

  try {
    if (fs.existsSync(cacheFile)) {
      return fs.readFileSync(cacheFile, 'utf8');
    }
  } catch {}

  return null;
}

/**
 * Saves transpiled markdown to the cache directory.
 * @param {string} filePath
 * @param {string} markdownContent
 * @param {string} cwd
 * @returns {boolean}
 */
export function setCachedMarkdown(filePath, markdownContent, cwd = process.cwd()) {
  if (!filePath || !markdownContent) return false;

  const key = computeFileHashKey(filePath);
  if (!key) return false;

  const cacheDir = getTranspilerCacheDir(cwd);
  const cacheFile = path.join(cacheDir, `${key}.md`);

  try {
    fs.writeFileSync(cacheFile, markdownContent, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * Clears all cached document transpilation entries.
 * @param {string} cwd
 * @returns {number} Count of removed cache files
 */
export function clearTranspilerCache(cwd = process.cwd()) {
  const cacheDir = getTranspilerCacheDir(cwd);
  let count = 0;
  try {
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          fs.unlinkSync(path.join(cacheDir, file));
          count++;
        }
      }
    }
  } catch {}
  return count;
}
