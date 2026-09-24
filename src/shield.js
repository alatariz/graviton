// src/shield.js - .0.0 Token Shield (Lockfile & Minified Asset Guard)
import fs from 'fs';
import path from 'path';

export const PROTECTED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'cargo.lock',
  'poetry.lock',
  'gemfile.lock',
  'npm-shrinkwrap.json'
]);

export const PROTECTED_EXTENSIONS = new Set([
  '.min.js',
  '.min.css',
  '.map',
  '.bundle.js',
  '.sqlite',
  '.db'
]);

/**
 * Checks if a relative or absolute file path corresponds to a protected heavy asset.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isProtectedFile(filePath = '') {
  if (!filePath || typeof filePath !== 'string') return false;
  const baseName = path.basename(filePath).toLowerCase();

  if (PROTECTED_FILENAMES.has(baseName)) {
    return true;
  }

  for (const ext of PROTECTED_EXTENSIONS) {
    if (baseName.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Generates a compact ~150-token summary of project dependencies from package.json
 * instead of letting an LLM read 40,000 lines of package-lock.json.
 * @param {string} cwd
 * @returns {string}
 */
export function generateDependencySummary(cwd = process.cwd()) {
  const pkgPath = path.join(path.resolve(cwd), 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return '[TOKEN SHIELD] No package.json found. Do NOT inspect raw lockfiles.';
  }

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const prodDeps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    
    const lines = [
      `[GRAVITON TOKEN SHIELD: DEPENDENCY FIREWALL]`,
      `- Package: ${pkg.name || 'unnamed'} (v${pkg.version || '1.0.0'})`,
      `- Dependencies (${prodDeps.length}): ${prodDeps.slice(0, 15).join(', ')}${prodDeps.length > 15 ? '...' : ''}`,
      `- DevDependencies (${devDeps.length}): ${devDeps.slice(0, 15).join(', ')}${devDeps.length > 15 ? '...' : ''}`,
      `- Notice to AI: Raw lockfiles (package-lock.json, yarn.lock, etc.) are protected by Graviton Token Shield to prevent dumping tens of thousands of redundant lines. Use the manifest above for all dependency inquiries.`
    ];
    return lines.join('\n');
  } catch (err) {
    return `[TOKEN SHIELD] Error reading package.json: ${err.message}. Avoid inspecting lockfiles.`;
  }
}
