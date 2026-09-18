// src/sanity-guard.js - Graviton V3.0.0 Post-Run Syntax Sanity Guard
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/**
 * Lightweight structural lexical sanity validator.
 * Validates balanced brackets ({}, [], ()), unclosed strings/backticks,
 * unclosed comments, and unclosed JSX fragments without heavy external dependencies.
 * @param {string} code
 * @returns {{ valid: boolean, error?: string, line?: number, col?: number }}
 */
export function validateCodeStructure(code = '') {
  if (!code || typeof code !== 'string') return { valid: true };

  const stack = [];
  const jsxStack = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let backtickDepth = 0;
  const templateStack = [];
  let inLineComment = false;
  let inBlockComment = false;
  let escape = false;

  let currentLine = 1;
  let currentCol = 0;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const nextChar = code[i + 1] || '';

    currentCol++;
    if (char === '\n') {
      currentLine++;
      currentCol = 0;
      if (inLineComment) inLineComment = false;
      if (inSingleQuote || inDoubleQuote) {
        return {
          valid: false,
          error: 'Unterminated string literal (newline inside string)',
          line: currentLine - 1,
          col: currentCol
        };
      }
      continue;
    }

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    // Comments (only outside strings)
    const inString = inSingleQuote || inDoubleQuote || (backtickDepth > 0 && (templateStack.length === 0 || !templateStack[templateStack.length - 1]));
    if (!inString) {
      if (inLineComment) continue;
      if (inBlockComment) {
        if (char === '*' && nextChar === '/') {
          inBlockComment = false;
          i++;
          currentCol++;
        }
        continue;
      }
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        i++;
        currentCol++;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++;
        currentCol++;
        continue;
      }
    } else {
      if (inLineComment || inBlockComment) continue;
    }

    if (inLineComment || inBlockComment) continue;

    // Inside single or double quote
    if (inSingleQuote) {
      if (char === "'") inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      if (char === '"') inDoubleQuote = false;
      continue;
    }

    const canStartQuote = backtickDepth === 0 || (templateStack.length > 0 && templateStack[templateStack.length - 1]);
    if (canStartQuote) {
      if (char === "'") {
        inSingleQuote = true;
        continue;
      }
      if (char === '"') {
        inDoubleQuote = true;
        continue;
      }
    }

    // Template literal handling
    if (char === '`') {
      if (backtickDepth > 0 && templateStack.length > 0 && !templateStack[templateStack.length - 1]) {
        backtickDepth--;
        templateStack.pop();
      } else {
        backtickDepth++;
        templateStack.push(false);
      }
      continue;
    }

    // Check for ${ inside template string
    if (backtickDepth > 0 && templateStack.length > 0 && !templateStack[templateStack.length - 1]) {
      if (char === '$' && nextChar === '{') {
        templateStack[templateStack.length - 1] = true;
        stack.push({ char: '{', line: currentLine, col: currentCol, isTemplate: true });
        i++;
        currentCol++;
        continue;
      }
      continue;
    }

    // JSX Tag & Fragment Tracking
    if (char === '<') {
      // Fragment closing: </>
      if (nextChar === '/' && code[i + 2] === '>') {
        if (jsxStack.length === 0) {
          return { valid: false, error: "Unexpected closing JSX fragment '</>'", line: currentLine, col: currentCol };
        }
        const top = jsxStack.pop();
        if (top.tag !== '') {
          return { valid: false, error: `Mismatched JSX closing tag: expected '</${top.tag}>' but found '</>'`, line: currentLine, col: currentCol };
        }
        i += 2;
        currentCol += 2;
        continue;
      }
      // Fragment opening: <>
      if (nextChar === '>') {
        jsxStack.push({ tag: '', line: currentLine, col: currentCol });
        i++;
        currentCol++;
        continue;
      }
      // Closing tag: </tagname>
      if (nextChar === '/') {
        const closeMatch = code.slice(i).match(/^<\/([a-zA-Z][a-zA-Z0-9_.-]*)\s*>/);
        if (closeMatch) {
          const closingTag = closeMatch[1];
          if (jsxStack.length === 0) {
            return { valid: false, error: `Unexpected closing JSX tag '</${closingTag}>'`, line: currentLine, col: currentCol };
          }
          const top = jsxStack.pop();
          if (top.tag.toLowerCase() !== closingTag.toLowerCase()) {
            return { valid: false, error: `Mismatched JSX tag: expected '</${top.tag || 'fragment'}>' matching '<${top.tag || 'fragment'}>' from line ${top.line}, but found '</${closingTag}>'`, line: currentLine, col: currentCol };
          }
          i += closeMatch[0].length - 1;
          currentCol += closeMatch[0].length - 1;
          continue;
        }
      }
      // Opening tag: <tagname ...>
      const openMatch = code.slice(i).match(/^<([a-zA-Z][a-zA-Z0-9_.-]*)(?:>|\s[^>]*>)/);
      if (openMatch) {
        const fullTag = openMatch[0];
        const tagName = openMatch[1];
        const isSelfClosing = fullTag.trimEnd().endsWith('/>');
        const afterTag = code.slice(i + fullTag.length).trimStart();
        const isGeneric = (tagName.length === 1 && tagName === tagName.toUpperCase()) && (afterTag.startsWith('(') || afterTag.startsWith('='));

        if (!isSelfClosing && !isGeneric) {
          const isStandardHtml = /^(?:div|p|span|header|footer|main|section|article|nav|aside|h[1-6]|ul|ol|li|table|tr|td|th|tbody|thead|form|button|label|select|option|textarea|svg|canvas|video|audio|a)$/i.test(tagName);
          const isComponent = /^[A-Z][a-zA-Z0-9_]*$/.test(tagName);

          if (isStandardHtml || isComponent) {
            jsxStack.push({ tag: tagName, line: currentLine, col: currentCol });
            i += fullTag.length - 1;
            currentCol += fullTag.length - 1;
            continue;
          }
        }
      }
    }

    // Brackets tracking
    if (char === '{' || char === '(' || char === '[') {
      stack.push({ char, line: currentLine, col: currentCol, isTemplate: false });
    } else if (char === '}' || char === ')' || char === ']') {
      if (stack.length === 0) {
        return {
          valid: false,
          error: `Unexpected closing bracket '${char}'`,
          line: currentLine,
          col: currentCol
        };
      }
      const top = stack.pop();
      const expected = top.char === '{' ? '}' : top.char === '(' ? ')' : ']';
      if (char !== expected) {
        return {
          valid: false,
          error: `Mismatched bracket: expected '${expected}' matching '${top.char}' from line ${top.line}, but found '${char}'`,
          line: currentLine,
          col: currentCol
        };
      }
      if (top.isTemplate && templateStack.length > 0) {
        templateStack[templateStack.length - 1] = false;
      }
    }
  }

  if (inBlockComment) {
    return { valid: false, error: 'Unterminated block comment (/* ... */)', line: currentLine, col: currentCol };
  }
  if (backtickDepth > 0) {
    return { valid: false, error: 'Unterminated template literal (`...`)', line: currentLine, col: currentCol };
  }
  if (inSingleQuote || inDoubleQuote) {
    return { valid: false, error: 'Unterminated string literal', line: currentLine, col: currentCol };
  }
  if (stack.length > 0) {
    const unclosed = stack.pop();
    return {
      valid: false,
      error: `Unclosed bracket '${unclosed.char}' opened at line ${unclosed.line}:${unclosed.col}`,
      line: unclosed.line,
      col: unclosed.col
    };
  }
  if (jsxStack.length > 0) {
    const unclosed = jsxStack.pop();
    const tagDisplay = unclosed.tag ? `<${unclosed.tag}>` : '<>';
    return {
      valid: false,
      error: `Unclosed JSX tag '${tagDisplay}' opened at line ${unclosed.line}:${unclosed.col}`,
      line: unclosed.line,
      col: unclosed.col
    };
  }

  return { valid: true };
}

/**
 * Checks a single file for syntax errors using native Node.js parser, Python compiler, or Structural parser.
 * Eliminates false-positives on modern TSX/JSX, decorators (@Component), and Python 3.12 syntax.
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
      const code = fs.readFileSync(normalizedPath, 'utf8');

      // Check if file contains JSX, Decorators, or TypeScript annotations
      const hasJsxOrDecorator = /(?:<[A-Za-z][A-Za-z0-9_.-]*(\s+[^>]*)?>)|(?:<>|<\/>)|(?:^\s*@[A-Za-z_][A-Za-z0-9_]*)/m.test(code);

      if (hasJsxOrDecorator) {
        const structRes = validateCodeStructure(code);
        if (!structRes.valid) {
          return {
            file: filePath,
            valid: false,
            error: structRes.error,
            line: structRes.line,
            col: structRes.col
          };
        }
        return { file: filePath, valid: true };
      }

      const res = spawnSync(process.execPath, ['--check', normalizedPath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
      });

      if (res.status !== 0) {
        let errorText = (res.stderr || res.stdout || '').trim();

        // Always fallback to check as ES Module if CommonJS check fails
        try {
          const modRes = spawnSync(process.execPath, ['--input-type=module', '--check', '-'], {
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

        // If error is caused by JSX or decorator in .js, fallback to structural check
        if (errorText.includes("Unexpected token '<'") || errorText.includes("Unexpected token '@'")) {
          const fallbackStruct = validateCodeStructure(code);
          if (fallbackStruct.valid) {
            return { file: filePath, valid: true };
          }
        }

        let line = null;
        let col = null;

        const match = errorText.match(/:(\d+):(\d+)/) || errorText.match(/line (\d+)/i);
        if (match) {
          line = parseInt(match[1], 10);
          if (match[2]) col = parseInt(match[2], 10);
        }

        const lines = errorText.split(/\r?\n/).filter(Boolean);
        const firstLine = lines.find(l => l.includes('Error')) || lines[0] || 'SyntaxError';
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

  // 2. TypeScript & JSX Files (.ts, .tsx, .jsx)
  if (ext === '.ts' || ext === '.tsx' || ext === '.jsx') {
    try {
      const code = fs.readFileSync(normalizedPath, 'utf8');
      const structRes = validateCodeStructure(code);
      if (!structRes.valid) {
        return {
          file: filePath,
          valid: false,
          error: structRes.error,
          line: structRes.line,
          col: structRes.col
        };
      }
      return { file: filePath, valid: true };
    } catch (err) {
      return { file: filePath, valid: false, error: err.message };
    }
  }

  // 3. JSON Files (.json)
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

  // 4. Python Files (.py)
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
        const pyCode = fs.readFileSync(normalizedPath, 'utf8');
        const struct = validateCodeStructure(pyCode);
        if (!struct.valid) {
          return {
            file: filePath,
            valid: false,
            error: struct.error,
            line: struct.line,
            col: struct.col
          };
        }
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
    `\n\x1b[1;33m[GRAVITON SANITY GUARD WARNING]\x1b[0m`,
    `\x1b[33mDetected potential syntax issues in files recently modified by AI:\x1b[0m`
  ];

  for (const issue of issues) {
    const loc = issue.line ? ` (Line ${issue.line}${issue.col ? ':' + issue.col : ''})` : '';
    lines.push(`  \x1b[31m●\x1b[0m  \x1b[1m${issue.file}\x1b[0m${loc}: \x1b[90m${issue.error}\x1b[0m`);
  }

  lines.push(`\x1b[36mRecommendation:\x1b[0m Type '\x1b[1mgraviton undo\x1b[0m' to revert changes, or instruct: '\x1b[1mgraviton "fix the recent syntax error"\x1b[0m'\n`);

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
