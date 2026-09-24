// src/workspace-helper.js - Graviton V5.1.1 Workspace Utilities & Secret Scrubbing
import fs from 'fs';
import path from 'path';

export function normalizePath(p) {
  if (!p || typeof p !== 'string') return '';
  return p.replace(/\\/g, '/');
}

export function collectWorkspaceFiles(dir, options = {}) {
  const maxFiles = options.maxFiles || 500;
  const extensions = options.extensions ? new Set(options.extensions) : null;
  const ignoredDirs = new Set(options.ignoredDirs || [
    'node_modules', '.git', 'dist', 'build', '.gemini', '.cache', 'coverage', '.graviton'
  ]);
  const results = [];

  function walk(currentDir) {
    if (results.length >= maxFiles) return;
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) break;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!extensions || extensions.has(ext)) {
          results.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return results;
}

export function redactSecrets(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;
  
  // 1. Google API keys
  out = out.replace(/\bAIzaSy[A-Za-z0-9_-]{33}\b/g, '[REDACTED_GOOGLE_KEY]');
  
  // 2. OpenAI / Anthropic / GitHub keys
  out = out.replace(/\b(?:sk-[a-zA-Z0-9]{20,}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36})\b/g, '[REDACTED_API_KEY]');
  
  // 3. JWT Tokens
  out = out.replace(/\beyJ[a-zA-Z0-9_-]{15,}\.eyJ[a-zA-Z0-9_-]{15,}\.[a-zA-Z0-9_-]{15,}\b/g, '[REDACTED_JWT]');
  
  // 4. DB connection URLs with passwords
  out = out.replace(/\b(mongodb(?:\+srv)?|postgres(?:ql)?|mysql):\/\/[^\s:]+:[^\s@]+@[^\s/]+/gi, '$1://[USER]:[REDACTED_PASS]@...');
  
  return out;
}

export function detectWorkspaceContext(cwd = process.cwd()) {
  const context = {
    cwd,
    type: 'Generic Project',
    mainFiles: []
  };

  try {
    const files = fs.readdirSync(cwd);
    if (files.includes('package.json')) {
      context.type = 'Node.js / JavaScript';
    } else if (files.includes('Cargo.toml')) {
      context.type = 'Rust';
    } else if (files.includes('go.mod')) {
      context.type = 'Go';
    } else if (files.includes('requirements.txt') || files.includes('pyproject.toml')) {
      context.type = 'Python';
    }

    // Capture first source files
    context.mainFiles = files.filter(f => !f.startsWith('.') && !['node_modules', 'target', 'dist', 'build', '.git'].includes(f)).slice(0, 8);
  } catch (e) {}

  return context;
}
