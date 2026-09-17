// src/sanity-guard.js - Graviton V2.0.0 Post-Run Syntax Sanity Guard
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/**
 * Checks a single file for syntax errors using native Node.js parser or JSON parser.
 * @param {string} filePath
 * @returns {{ file: string, valid: boolean, error?: string, line?: number, col?: number }}
 */
export function checkFileSyntax(filePath) {
  const normalizedPath = path.resolve(filePath);
  if (!fs.existsSync(normalizedPath)) {
    return { file: filePath, valid: true };
  }

  const ext = path.extname(normalizedPath).toLowerCase();

  // 1. JavaScript Files (.js, .mjs, .cjs)
  if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
    try {
      const res = spawnSync(process.execPath, ['--check', normalizedPath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });

      if (res.status !== 0) {
        let errorText = (res.stderr || res.stdout || '').trim();

        // Always fallback to check as ES Module if CommonJS check fails
        try {
          const code = fs.readFileSync(normalizedPath, 'utf8');
          const modRes = spawnSync(process.execPath, ['--input-type=module', '--check'], {
            input: code,
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
          });
          if (modRes.status === 0) {
            return { file: filePath, valid: true };
          }
          if (modRes.stderr) {
            errorText = modRes.stderr.trim();
          }
        } catch {}

        let line = null;
        let col = null;

        // Try to parse line and column from errorText: filename:line:col or line:col
        const match = errorText.match(/:(\d+):(\d+)/) || errorText.match(/line (\d+)/i);
        if (match) {
          line = parseInt(match[1], 10);
          if (match[2]) col = parseInt(match[2], 10);
        }

        // Clean up error message (take first 2 non-empty lines)
        const firstLine = errorText.split(/\r?\n/).filter(Boolean)[0] || 'SyntaxError';
        return {
          file: filePath,
          valid: false,
          error: firstLine,
          line,
          col,
          rawError: errorText
        };
      }
    } catch (err) {
      return { file: filePath, valid: false, error: err.message };
    }
  }

  // 2. JSON Files (.json)
  if (ext === '.json') {
    try {
      const content = fs.readFileSync(normalizedPath, 'utf8');
      JSON.parse(content);
    } catch (err) {
      let line = null;
      const match = err.message.match(/at position (\d+)/) || err.message.match(/line (\d+)/i);
      if (match) line = parseInt(match[1], 10);
      return {
        file: filePath,
        valid: false,
        error: err.message,
        line
      };
    }
  }

  // 3. Python Files (.py)
  if (ext === '.py') {
    try {
      const pyBin = process.platform === 'win32' ? 'python' : 'python3';
      let pyRes = spawnSync(pyBin, ['-m', 'py_compile', normalizedPath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });
      if (pyRes.error && pyBin !== 'python') {
        pyRes = spawnSync('python', ['-m', 'py_compile', normalizedPath], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe']
        });
      }
      if (pyRes.error || pyRes.status === null) {
        return { file: filePath, valid: true, skipped: true };
      }
      if (pyRes.status !== 0) {
        const errorText = (pyRes.stderr || pyRes.stdout || '').trim();
        let line = null;
        const match = errorText.match(/line (\d+)/i);
        if (match) line = parseInt(match[1], 10);
        const lines = errorText.split(/\r?\n/).filter(Boolean);
        const firstLine = lines.find(l => l.includes('SyntaxError')) || lines[lines.length - 1] || 'Python SyntaxError';
        return {
          file: filePath,
          valid: false,
          error: firstLine,
          line,
          rawError: errorText
        };
      }
    } catch {}
  }

  return { file: filePath, valid: true };
}

/**
 * Checks a list of file paths for syntax issues.
 * @param {string[]} filePaths
 * @returns {{ hasErrors: boolean, issues: Array<{ file: string, error: string, line?: number, col?: number }> }}
 */
export function checkSyntaxSanity(filePaths = []) {
  const issues = [];

  for (const fp of filePaths) {
    if (!fp) continue;
    const result = checkFileSyntax(fp);
    if (!result.valid) {
      issues.push(result);
    }
  }

  return {
    hasErrors: issues.length > 0,
    issues
  };
}

/**
 * Formats a terminal warning report for detected syntax issues.
 * @param {Array<{ file: string, error: string, line?: number, col?: number }>} issues
 * @returns {string}
 */
export function formatSanityReport(issues = []) {
  if (!issues || issues.length === 0) return '';

  const lines = [
    `\n\x1b[1;33m⚠️  [GRAVITON SANITY GUARD WARNING]\x1b[0m`,
    `\x1b[33mDetected potential syntax issues in files recently modified by AI:\x1b[0m`
  ];

  for (const issue of issues) {
    const loc = issue.line ? ` (Line ${issue.line}${issue.col ? ':' + issue.col : ''})` : '';
    lines.push(`  \x1b[31m●\x1b[0m \x1b[1m${issue.file}\x1b[0m${loc}: \x1b[90m${issue.error}\x1b[0m`);
  }

  lines.push(`\x1b[36m👉 Recommendation:\x1b[0m Type '\x1b[1mgraviton undo\x1b[0m' to revert changes, or instruct: '\x1b[1mgraviton "fix the recent syntax error"\x1b[0m'\n`);

  return lines.join('\n');
}

/**
 * Automatically inspects files recorded in the workspace's latest manifest.
 * @param {string} cwd
 * @returns {{ hasErrors: boolean, issues: Array<object> }}
 */
export function inspectSessionFiles(cwd = process.cwd()) {
  const manifestPath = path.join(path.resolve(cwd), '.graviton-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { hasErrors: false, issues: [] };
  }

  try {
    const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const filesToCheck = [];

    if (Array.isArray(data.modified)) {
      for (const item of data.modified) {
        const p = typeof item === 'string' ? item : (item.original || '');
        if (p) filesToCheck.push(p);
      }
    }
    if (Array.isArray(data.created)) {
      for (const item of data.created) {
        if (item) filesToCheck.push(item);
      }
    }

    const report = checkSyntaxSanity(filesToCheck);
    if (report.hasErrors) {
      console.warn(formatSanityReport(report.issues));
    }
    return report;
  } catch {
    return { hasErrors: false, issues: [] };
  }
}
