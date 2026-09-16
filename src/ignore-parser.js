import fs from 'fs';
import path from 'path';

/**
 * Graviton V1.7.0 Custom .gravignore Parser
 * Pure Node.js implementation: zero external dependencies.
 * Bypasses sensitive files, secret keys, and noise directories during
 * file hydration, dependency scraping, and workspace mapping.
 */

/**
 * Load and parse .gravignore rules from the specified directory.
 * Strips whitespace, ignores empty lines and comments (#).
 * Automatically checks for .gravignore (with backward-compatible fallback to .gravitonignore).
 * @param {string} cwd - Directory to look for .gravignore
 * @returns {string[]} Array of valid pattern strings
 */
export function loadGravIgnore(cwd = process.cwd()) {
  let ignoreFilePath = path.join(cwd, '.gravignore');
  if (!fs.existsSync(ignoreFilePath)) {
    const legacyPath = path.join(cwd, '.gravitonignore');
    if (fs.existsSync(legacyPath)) {
      ignoreFilePath = legacyPath;
    } else {
      return [];
    }
  }

  try {
    const raw = fs.readFileSync(ignoreFilePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    const patterns = [];

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }
      patterns.push(line);
    }

    return patterns;
  } catch {
    return [];
  }
}

// Backward-compatible alias
export const loadGravitonIgnore = loadGravIgnore;

/**
 * Compiles a single .gravignore pattern into a fast matcher function.
 * @param {string} pattern
 * @returns {(relPath: string, baseName: string) => boolean}
 */
export function compilePattern(pattern) {
  let p = pattern.trim().replace(/\\/g, '/');
  const isDirOnly = p.endsWith('/');
  if (isDirOnly) {
    p = p.slice(0, -1);
  }

  const fromRoot = p.startsWith('/');
  if (fromRoot) {
    p = p.slice(1);
  }

  const hasWildcard = p.includes('*') || p.includes('?');

  if (!hasWildcard) {
    return (relPath, baseName) => {
      // Direct basename match (e.g. pattern "foo.js" matches "sub/foo.js" if not fromRoot)
      if (!fromRoot && baseName === p) return true;
      // Relative path match
      if (relPath === p) return true;
      // Directory prefix match
      if (relPath.startsWith(p + '/')) return true;
      // In-path directory segment match if not anchored to root
      if (!fromRoot && relPath.includes('/' + p + '/')) return true;
      if (!fromRoot && relPath.endsWith('/' + p)) return true;
      return false;
    };
  }

  // Convert glob to regex safely
  let regexBody = p
    .replace(/[.+^$\{}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '§DOUBLE§')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/§DOUBLE§/g, '.*');

  let regex;
  try {
    if (fromRoot) {
      regex = new RegExp(`^${regexBody}(?:/.*)?$`, 'i');
    } else {
      regex = new RegExp(`(?:^|/)${regexBody}(?:/.*)?$`, 'i');
    }
  } catch {
    return () => false;
  }

  return (relPath, baseName) => {
    return regex.test(relPath) || regex.test(baseName);
  };
}

/**
 * Checks if a target file or directory path matches any .gravignore pattern.
 * @param {string} targetPath - File or folder path (absolute or relative)
 * @param {string[]} patterns - Array of ignore patterns
 * @param {string} cwd - Base working directory
 * @returns {boolean} True if the path must be bypassed
 */
export function isGravIgnored(targetPath, patterns = [], cwd = process.cwd()) {
  if (!patterns || patterns.length === 0 || !targetPath) {
    return false;
  }

  const absPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(cwd, targetPath);
  let relPath = path.relative(cwd, absPath).replace(/\\/g, '/');
  if (relPath.startsWith('./')) {
    relPath = relPath.slice(2);
  }

  const baseName = path.basename(absPath);

  for (const pattern of patterns) {
    const matcher = compilePattern(pattern);
    if (matcher(relPath, baseName)) {
      return true;
    }
  }

  return false;
}

// Backward-compatible alias
export const isGravitonIgnored = isGravIgnored;

/**
 * Creates a reusable, high-performance ignore filter object for a workspace.
 * @param {string} cwd
 * @returns {{ patterns: string[], isIgnored: (targetPath: string) => boolean }}
 */
export function createGravFilter(cwd = process.cwd()) {
  const patterns = loadGravIgnore(cwd);
  const matchers = patterns.map(compilePattern);

  return {
    patterns,
    isIgnored(targetPath) {
      if (matchers.length === 0 || !targetPath) return false;
      const absPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(cwd, targetPath);
      let relPath = path.relative(cwd, absPath).replace(/\\/g, '/');
      if (relPath.startsWith('./')) {
        relPath = relPath.slice(2);
      }
      const baseName = path.basename(absPath);

      for (let i = 0; i < matchers.length; i++) {
        if (matchers[i](relPath, baseName)) {
          return true;
        }
      }
      return false;
    }
  };
}

// Backward-compatible alias
export const createGravitonFilter = createGravFilter;
