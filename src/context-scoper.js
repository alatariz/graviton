// src/context-scoper.js - .0.0 Smart Target Pinning & Delta Scoping Engine
import fs from 'fs';
import path from 'path';
import { createGravitonFilter } from './ignore-parser.js';
import { isProtectedFile } from './shield.js';

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__',
  '.gemini', 'coverage', '.next', 'target', '.turbo',
  '.cache', 'venv', '.venv', '.idea', '.vscode',
  '.graviton', '.graviton-session'
]);

const STOP_WORDS = new Set([
  'tolong', 'buatkan', 'bikin', 'perbaiki', 'ubah', 'ganti', 'tambah',
  'tambahkan', 'update', 'fix', 'change', 'make', 'create', 'add', 'the',
  'this', 'that', 'with', 'from', 'into', 'file', 'code', 'dong', 'ya',
  'bisa', 'tolongin', 'lagi', 'coba', 'please', 'help', 'and', 'for'
]);

/**
 * Traverses the workspace and collects relative file paths.
 * @param {string} cwd
 * @param {number} maxDepth
 * @returns {string[]}
 */
export function getWorkspaceFiles(cwd = process.cwd(), maxDepth = 4) {
  const files = [];
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
          if (filter.isIgnored(fullPath) || isProtectedFile(entry.name)) continue;
          const relPath = path.relative(cwd, fullPath).replace(/\\/g, '/');
          files.push(relPath);
        }
      }
    } catch {}
  }

  walk(cwd, 0);
  return files;
}

/**
 * Extracts meaningful tokens and search keywords from user prompt.
 * @param {string} prompt
 * @returns {string[]}
 */
export function extractKeywords(prompt = '') {
  if (!prompt || typeof prompt !== 'string') return [];
  const words = prompt.toLowerCase().match(/[a-z0-9_\-\.]+/g) || [];
  return words.filter(w => w.length >= 3 && !STOP_WORDS.has(w));
}

/**
 * Retrieves the list of files touched in the most recent session from .graviton-manifest.json.
 * @param {string} cwd
 * @returns {string[]}
 */
export function getLastTouchedFiles(cwd = process.cwd()) {
  const manifestPath = path.join(path.resolve(cwd), '.graviton-manifest.json');
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const touched = [];
    if (Array.isArray(data.modified)) {
      for (const item of data.modified) {
        const p = typeof item === 'string' ? item : item.original;
        if (p && !isProtectedFile(p)) touched.push(path.relative(cwd, p).replace(/\\/g, '/'));
      }
    }
    if (Array.isArray(data.created)) {
      for (const item of data.created) {
        if (item && !isProtectedFile(item)) touched.push(path.relative(cwd, item).replace(/\\/g, '/'));
      }
    }
    return touched.filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Detects if a prompt is brief, vague, or a follow-up refinement.
 * @param {string} prompt
 * @returns {boolean}
 */
export function isFollowUpPrompt(prompt = '') {
  const trimmed = prompt.trim();
  if (trimmed.length < 40) return true;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= 6) return true;
  
  const followUpIndicators = [
    'perbaiki lagi', 'tambahin', 'styling', 'warnanya', 'animasi',
    'benerin lagi', 'jalankan', 'run it', 'start it', 'coba lagi',
    'masih error', 'fix the error', 'make it better', 'update it'
  ];
  const lower = trimmed.toLowerCase();
  return followUpIndicators.some(ind => lower.includes(ind));
}

/**
 * Resolves the primary target files and directory scope for a given prompt.
 * Combines zero-token fuzzy scoring with Last-Touch memory.
 * @param {string} prompt
 * @param {string} cwd
 * @returns {{ targets: string[], isLastTouch: boolean, directive: string }}
 */
export function resolveTargetScope(prompt = '', cwd = process.cwd()) {
  const allFiles = getWorkspaceFiles(cwd);
  const keywords = extractKeywords(prompt);
  const promptLower = prompt.toLowerCase();
  const normalizedPromptLower = promptLower.replace(/\\/g, '/');

  const scoredFiles = [];

  for (const relFile of allFiles) {
    const lowerRel = relFile.toLowerCase();
    const baseName = path.basename(relFile).toLowerCase();
    const nameWithoutExt = baseName.includes('.') ? baseName.slice(0, baseName.lastIndexOf('.')) : baseName;
    let score = 0;

    // 1. Direct explicit file mention in prompt (supporting both slash and backslash)
    if (promptLower.includes(baseName) || normalizedPromptLower.includes(lowerRel) || promptLower.includes(lowerRel)) {
      score += 100;
    } else if (nameWithoutExt.length >= 3 && (promptLower.includes(nameWithoutExt) || normalizedPromptLower.includes(nameWithoutExt))) {
      score += 80;
    }

    // 2. Keyword stem matching
    for (const kw of keywords) {
      if (baseName.includes(kw)) {
        score += 50;
      } else if (lowerRel.includes(kw)) {
        score += 25;
      }
    }

    if (score > 0) {
      scoredFiles.push({ file: relFile, score });
    }
  }

  scoredFiles.sort((a, b) => b.score - a.score);
  let targets = scoredFiles.slice(0, 3).map(s => s.file);
  let isLastTouch = false;

  // If no high-confidence target was found, or if it's an ambiguous follow-up, use Last-Touch Context
  if (targets.length === 0 || (isFollowUpPrompt(prompt) && targets.length === 0)) {
    const lastTouched = getLastTouchedFiles(cwd);
    if (lastTouched.length > 0) {
      targets = lastTouched.slice(0, 3);
      isLastTouch = true;
    }
  }

  let directive = '';
  if (targets.length > 0) {
    const targetList = targets.map(t => '`' + t + '`').join(', ');
    const sourceLabel = isLastTouch ? 'Last-Touch Context' : 'Predicted Target Scope';
    directive = `
[GRAVITON ACTIVE TARGET SCOPE (${sourceLabel})]
- Primary Target File(s): ${targetList}
- Directive to AI: Focus your changes directly on the target file(s) above. Do NOT perform redundant exploratory tool calls (list_dir/grep_search).
`.trim();
  }

  return {
    targets,
    isLastTouch,
    directive
  };
}

/**
 * Builds the prompt payload for the AI agent.
 * In continuous sessions, strips the heavy workspace map to achieve Delta Prompting.
 * @param {string} promptText
 * @param {string} cwd
 * @param {boolean} isContinuous
 * @param {string} workspaceMap
 * @returns {string}
 */
export function buildScopedPrompt(promptText, cwd = process.cwd(), isContinuous = false, workspaceMap = '') {
  const scope = resolveTargetScope(promptText, cwd);
  const parts = [];

  if (scope.directive) {
    parts.push(scope.directive);
  }

  // Delta Prompting: in continuous session, workspace map is already in agent transcript
  if (!isContinuous && workspaceMap) {
    parts.push(workspaceMap);
  } else if (isContinuous) {
    parts.push(`[SESSION CONTINUITY ACTIVE] Workspace context is preserved from previous turns. Focus on incremental delta.`);
  }

  parts.push(promptText);
  return parts.join('\n\n');
}
