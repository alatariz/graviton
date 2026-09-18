// src/code-outliner.js - Graviton V2.4.0 Smart Code Outliner & Zero-Waste Skeletonizer
import path from 'path';

/**
 * Collapses lengthy open-source license and copyright boilerplate at the beginning of a file.
 * @param {string} code
 * @returns {string}
 */
export function collapseLicenseHeader(code) {
  if (!code || typeof code !== 'string') return '';
  const trimmed = code.trimStart();

  // 1. Block comment license: /* ... */
  if (trimmed.startsWith('/*')) {
    const endIdx = trimmed.indexOf('*/');
    if (endIdx !== -1 && endIdx < 3000) {
      const comment = trimmed.slice(0, endIdx + 2);
      if (/copyright|license|spdx-license|all rights reserved/i.test(comment)) {
        const lineCount = comment.split(/\r?\n/).length;
        if (lineCount > 3) {
          const remainder = trimmed.slice(endIdx + 2).trimStart();
          return `/* [License Header Omitted: ${lineCount} lines] */\n\n${remainder}`;
        }
      }
    }
  }

  // 2. Line comment license: // or #
  const lines = code.split('\n');
  let commentLineCount = 0;
  let commentContent = '';

  for (let i = 0; i < Math.min(60, lines.length); i++) {
    const l = lines[i].trim();
    if (l.startsWith('//') || l.startsWith('#')) {
      commentLineCount++;
      commentContent += ' ' + l;
    } else if (l === '') {
      continue;
    } else {
      break;
    }
  }

  if (commentLineCount > 3 && /copyright|license|spdx-license|all rights reserved/i.test(commentContent)) {
    const remainder = lines.slice(commentLineCount).join('\n').trimStart();
    return `// [License Header Omitted: ${commentLineCount} lines]\n\n${remainder}`;
  }

  return code;
}

/**
 * Compresses raw SVG markup by summarizing dense path coordinate strings.
 * Saves 80-95% tokens on vector graphic files.
 * @param {string} svgContent
 * @returns {string}
 */
export function shrinkSvg(svgContent) {
  if (!svgContent || typeof svgContent !== 'string') return '';

  let processed = svgContent;

  // Remove XML comments
  processed = processed.replace(/<!--[\s\S]*?-->/g, '');

  // Shrink long path d attributes (> 50 chars)
  processed = processed.replace(/\bd="([^"]{50,})"/gi, (match, pathData) => {
    return `d="[... vector path ${pathData.length} chars ...]"`;
  });

  // Shrink long polygon/polyline points attributes (> 50 chars)
  processed = processed.replace(/\bpoints="([^"]{50,})"/gi, (match, pts) => {
    return `points="[... ${pts.split(/\s+/).length} points ...]"`;
  });

  return `<!-- [GRAVITON SVG OPTIMIZED: Vector coordinates summarized for token economy] -->\n${processed.trim()}`;
}

/**
 * Generates a skeletonized outline of a JavaScript or TypeScript file.
 * Preserves import statements, exported signatures, and the targeted focus function in full detail.
 * @param {string} code
 * @param {object} [options]
 * @returns {string}
 */
export function skeletonizeJs(code, options = {}) {
  const focusName = (options.focusName || '').toLowerCase().trim();
  const lines = code.split('\n');
  const output = [];

  let inTargetFunction = false;
  let inCollapsedFunction = false;
  let braceDepth = 0;
  let collapsedStartLine = 0;
  let collapsedHeader = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // If currently inside the target function (focused), keep full lines intact
    if (inTargetFunction) {
      output.push(line);
      braceDepth += countBraceDelta(line);
      if (braceDepth <= 0) {
        inTargetFunction = false;
        braceDepth = 0;
      }
      continue;
    }

    // If currently inside a collapsed function, count braces until closed
    if (inCollapsedFunction) {
      braceDepth += countBraceDelta(line);
      if (braceDepth <= 0) {
        inCollapsedFunction = false;
        braceDepth = 0;
        const startLineNum = collapsedStartLine + 1;
        const endLineNum = i + 1;
        const totalCollapsed = i - collapsedStartLine;
        output.push(collapsedHeader.replace(/\{$/, `{ /* ... L${startLineNum}-L${endLineNum} (${totalCollapsed} lines collapsed) ... */ }`));
      }
      continue;
    }

    // Detect function / method / class declaration
    const isFuncDecl = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function(?:\s+([a-zA-Z0-9_$]+)|\s*\()/i.test(trimmed)
      || /^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>\s*\{/i.test(trimmed)
      || /^(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*(?:get\s+|set\s+)?([a-zA-Z0-9_$]+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/i.test(trimmed);

    if (isFuncDecl && trimmed.endsWith('{') && braceDepth === 0) {
      // Extract function name
      let funcName = '';
      const fnMatch = trimmed.match(/(?:function\s+|const\s+|let\s+|var\s+)([a-zA-Z0-9_$]+)/i);
      if (fnMatch) {
        funcName = fnMatch[1];
      } else {
        const methodMatch = trimmed.match(/^(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*(?:get\s+|set\s+)?([a-zA-Z0-9_$]+)\s*\(/i);
        if (methodMatch) {
          funcName = methodMatch[1];
        }
      }
      const isTarget = focusName && funcName && funcName.toLowerCase() === focusName;

      if (isTarget) {
        inTargetFunction = true;
        braceDepth = countBraceDelta(line);
        output.push(`// [TARGET FOCUS: ${funcName} - FULL IMPLEMENTATION]`);
        output.push(line);
      } else {
        inCollapsedFunction = true;
        collapsedStartLine = i;
        collapsedHeader = line;
        braceDepth = countBraceDelta(line);
      }
      continue;
    }

    output.push(line);
  }

  // Clean trailing unclosed collapsed block fallback
  if (inCollapsedFunction) {
    output.push(collapsedHeader.replace(/\{$/, '{ /* ... implementation collapsed ... */ }'));
  }

  return output.join('\n');
}

/**
 * Generates a skeletonized outline of a Python file.
 * Preserves module imports, class structures, and target focus functions.
 * @param {string} code
 * @param {object} [options]
 * @returns {string}
 */
export function skeletonizePy(code, options = {}) {
  const focusName = (options.focusName || '').toLowerCase().trim();
  const lines = code.split('\n');
  const output = [];

  let inTargetDef = false;
  let inCollapsedDef = false;
  let defIndent = 0;
  let collapsedCount = 0;
  let defSignature = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const currentIndent = line.search(/\S/);

    // Skip empty lines in state transitions
    if (trimmed === '') {
      if (inTargetDef) output.push(line);
      continue;
    }

    if (inTargetDef) {
      if (currentIndent > defIndent) {
        output.push(line);
        continue;
      } else {
        inTargetDef = false;
      }
    }

    if (inCollapsedDef) {
      if (currentIndent > defIndent) {
        collapsedCount++;
        continue;
      } else {
        inCollapsedDef = false;
        output.push(defSignature);
        output.push(`${' '.repeat(defIndent + 4)}...  # [${collapsedCount} lines collapsed]`);
      }
    }

    // Detect def or async def
    const defMatch = line.match(/^(\s*)(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\(/i);
    if (defMatch) {
      defIndent = defMatch[1].length;
      const funcName = defMatch[2];
      const isTarget = focusName && funcName && funcName.toLowerCase() === focusName;

      if (isTarget) {
        inTargetDef = true;
        output.push(`${' '.repeat(defIndent)}# [TARGET FOCUS: ${funcName} - FULL IMPLEMENTATION]`);
        output.push(line);
      } else {
        inCollapsedDef = true;
        collapsedCount = 0;
        defSignature = line;
      }
      continue;
    }

    output.push(line);
  }

  if (inCollapsedDef) {
    output.push(defSignature);
    output.push(`${' '.repeat(defIndent + 4)}...  # [${collapsedCount} lines collapsed]`);
  }

  return output.join('\n');
}

/**
 * Universal code skeletonizer dispatcher.
 * @param {string} code
 * @param {string} ext
 * @param {object} [options]
 * @returns {string}
 */
export function skeletonizeCode(code, ext = '', options = {}) {
  if (!code || typeof code !== 'string') return '';
  const cleanExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`;

  // 1. First collapse boilerplate license headers
  let content = collapseLicenseHeader(code);

  // 2. SVG Shrinking
  if (cleanExt === '.svg' || content.includes('<svg')) {
    return shrinkSvg(content);
  }

  // 3. JavaScript / TypeScript
  if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(cleanExt)) {
    return skeletonizeJs(content, options);
  }

  // 4. Python
  if (cleanExt === '.py') {
    return skeletonizePy(content, options);
  }

  return content;
}

/**
 * Checks if a file qualifies for smart skeletonization.
 * @param {string} filePath
 * @param {number} lineCount
 * @returns {boolean}
 */
export function isSkeletonCandidate(filePath, lineCount) {
  if (!filePath || typeof filePath !== 'string') return false;
  const ext = path.extname(filePath).toLowerCase();

  // SVGs are always candidates
  if (ext === '.svg') return true;

  // Code files with more than 120 lines
  const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.cs'];
  return codeExts.includes(ext) && lineCount > 120;
}

/**
 * Checks if a file qualifies for AST Function Indexing (Graviton V3.3.0 Large File Shield).
 * Automatically triggered on source code files > 250 lines.
 * @param {string} filePath
 * @param {number} lineCount
 * @returns {boolean}
 */
export function isAstCandidate(filePath, lineCount) {
  if (!filePath || typeof filePath !== 'string') return false;
  const ext = path.extname(filePath).toLowerCase();
  const codeExts = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.cs'];
  return codeExts.includes(ext) && lineCount > 250;
}

/**
 * Helper to count net balance of { and } in a line, ignoring strings, line comments, and block comments.
 */
export function countBraceDelta(line, state = {}) {
  let delta = 0;
  let inString = state.inString || false;
  let stringChar = state.stringChar || '';
  let inBlockComment = state.inBlockComment || false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = i < line.length - 1 ? line[i + 1] : '';

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (ch === stringChar) {
        let backslashCount = 0;
        let k = i - 1;
        while (k >= 0 && line[k] === '\\') {
          backslashCount++;
          k--;
        }
        if (backslashCount % 2 === 0) {
          inString = false;
        }
      }
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      break; // Single line comment
    }

    // Check for regex literal /.../ (e.g. /\{$/, /[{}]/)
    if (ch === '/' && next !== '/' && next !== '*') {
      let k = i - 1;
      while (k >= 0 && /\s/.test(line[k])) k--;
      const prevNonSpace = k >= 0 ? line[k] : '';
      if (k === -1 || /[=(,:[!&|?;~]/.test(prevNonSpace)) {
        let regEscape = false;
        let regInCharClass = false;
        let m = i + 1;
        for (; m < line.length; m++) {
          const rc = line[m];
          if (regEscape) {
            regEscape = false;
            continue;
          }
          if (rc === '\\') {
            regEscape = true;
            continue;
          }
          if (rc === '[') {
            regInCharClass = true;
            continue;
          }
          if (rc === ']' && regInCharClass) {
            regInCharClass = false;
            continue;
          }
          if (rc === '/' && !regInCharClass) {
            break;
          }
        }
        if (m < line.length && line[m] === '/') {
          i = m; // Skip past the regex literal
          continue;
        }
      }
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }

    if (ch === '{') delta++;
    else if (ch === '}') delta--;
  }

  // Only template literals (`) and block comments persist across lines in JavaScript/TypeScript
  if (stringChar !== '`') {
    inString = false;
  }

  state.inString = inString;
  state.stringChar = inString ? stringChar : '';
  state.inBlockComment = inBlockComment;
  return delta;
}

/**
 * Parses JavaScript and TypeScript files into AST declaration entries with exact line ranges.
 */
export function parseJsTsAst(code, filename = '') {
  const lines = code.split('\n');
  const entries = [];
  let braceDepth = 0;
  let currentDecl = null;
  let firstDeclLine = null;
  const braceState = {};

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    if (currentDecl) {
      currentDecl.rawLines.push(line);
      braceDepth += countBraceDelta(line, braceState);
      if (braceDepth <= 0) {
        currentDecl.endLine = lineNum;
        currentDecl.lineCount = currentDecl.endLine - currentDecl.startLine + 1;
        entries.push(currentDecl);
        currentDecl = null;
        braceDepth = 0;
      }
      continue;
    }

    if (braceDepth === 0) {
      const funcMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function(?:\s*\*|\s+)?([a-zA-Z0-9_$]+)?\s*\(([^)]*)\)/i);
      const arrowMatch = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*(?:=>|function)/i);
      const classMatch = trimmed.match(/^(?:export\s+)?(?:default\s+)?class\s+([a-zA-Z0-9_$]+)(?:\s+extends\s+[a-zA-Z0-9_$]+)?/i);
      const tsMatch = trimmed.match(/^(?:export\s+)?(?:interface|type)\s+([a-zA-Z0-9_$]+)/i);

      let declType = null;
      let declName = null;
      let declSig = null;

      if (funcMatch) {
        declType = 'function';
        declName = funcMatch[1] || 'anonymous';
        declSig = trimmed.replace(/\s*\{.*$/, '');
      } else if (arrowMatch) {
        declType = 'function';
        declName = arrowMatch[1];
        declSig = trimmed.replace(/\s*\{.*$/, '');
      } else if (classMatch) {
        declType = 'class';
        declName = classMatch[1];
        declSig = trimmed.replace(/\s*\{.*$/, '');
      } else if (tsMatch) {
        declType = 'type';
        declName = tsMatch[1];
        declSig = trimmed.replace(/\s*\{.*$/, '');
      }

      if (declType && declName) {
        if (firstDeclLine === null) {
          firstDeclLine = lineNum;
          if (lineNum > 1) {
            entries.push({
              type: 'setup',
              name: 'Imports & Module Setup',
              signature: 'Imports & Module Setup',
              startLine: 1,
              endLine: lineNum - 1,
              lineCount: lineNum - 1,
              rawLines: lines.slice(0, lineNum - 1)
            });
          }
        }

        const delta = countBraceDelta(line, braceState);
        if (delta > 0) {
          braceDepth = delta;
          currentDecl = {
            type: declType,
            name: declName,
            signature: declSig,
            startLine: lineNum,
            endLine: lineNum,
            rawLines: [line]
          };
        } else if (trimmed.includes(';') || (trimmed.endsWith('}') && delta === 0)) {
          entries.push({
            type: declType,
            name: declName,
            signature: declSig,
            startLine: lineNum,
            endLine: lineNum,
            lineCount: 1,
            rawLines: [line]
          });
        } else {
          braceDepth = 0;
          currentDecl = {
            type: declType,
            name: declName,
            signature: declSig,
            startLine: lineNum,
            endLine: lineNum,
            rawLines: [line]
          };
        }
      }
    }
  }

  if (currentDecl) {
    currentDecl.endLine = lines.length;
    currentDecl.lineCount = currentDecl.endLine - currentDecl.startLine + 1;
    entries.push(currentDecl);
  }

  return { totalLines: lines.length, entries };
}

/**
 * Parses Python files into AST declaration entries with exact line ranges using indentation.
 */
export function parsePythonAst(code, filename = '') {
  const lines = code.split('\n');
  const entries = [];
  let currentDecl = null;
  let firstDeclLine = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.search(/\S/);

    if (trimmed === '') continue;

    if (currentDecl) {
      if (indent > currentDecl.indent) {
        currentDecl.endLine = lineNum;
        currentDecl.rawLines.push(line);
        continue;
      } else {
        currentDecl.lineCount = currentDecl.endLine - currentDecl.startLine + 1;
        entries.push(currentDecl);
        currentDecl = null;
      }
    }

    const defMatch = line.match(/^(\s*)(?:async\s+)?def\s+([a-zA-Z0-9_]+)\s*\((.*)/i);
    const classMatch = line.match(/^(\s*)class\s+([a-zA-Z0-9_]+)/i);

    if (defMatch || classMatch) {
      const matchIndent = (defMatch || classMatch)[1].length;
      if (matchIndent === 0 || matchIndent <= 4) {
        if (firstDeclLine === null) {
          firstDeclLine = lineNum;
          if (lineNum > 1) {
            entries.push({
              type: 'setup',
              name: 'Imports & Module Setup',
              signature: 'Imports & Module Setup',
              startLine: 1,
              endLine: lineNum - 1,
              lineCount: lineNum - 1,
              rawLines: lines.slice(0, lineNum - 1)
            });
          }
        }

        const isClass = Boolean(classMatch);
        const name = isClass ? classMatch[2] : defMatch[2];
        const sig = trimmed.replace(/:$/, '');

        currentDecl = {
          type: isClass ? 'class' : 'function',
          name,
          signature: sig,
          indent: matchIndent,
          startLine: lineNum,
          endLine: lineNum,
          rawLines: [line]
        };
      }
    }
  }

  if (currentDecl) {
    currentDecl.lineCount = currentDecl.endLine - currentDecl.startLine + 1;
    entries.push(currentDecl);
  }

  return { totalLines: lines.length, entries };
}

/**
 * Parses Go files into AST declaration entries with exact line ranges.
 */
export function parseGoAst(code, filename = '') {
  const lines = code.split('\n');
  const entries = [];
  let braceDepth = 0;
  let currentDecl = null;
  let firstDeclLine = null;
  const braceState = {};

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    if (currentDecl) {
      currentDecl.rawLines.push(line);
      braceDepth += countBraceDelta(line, braceState);
      if (braceDepth <= 0) {
        currentDecl.endLine = lineNum;
        currentDecl.lineCount = currentDecl.endLine - currentDecl.startLine + 1;
        entries.push(currentDecl);
        currentDecl = null;
        braceDepth = 0;
      }
      continue;
    }

    if (braceDepth === 0) {
      const funcMatch = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([a-zA-Z0-9_]+)\s*\(/i);
      const typeMatch = trimmed.match(/^type\s+([a-zA-Z0-9_]+)\s+(struct|interface)/i);

      if (funcMatch || typeMatch) {
        if (firstDeclLine === null) {
          firstDeclLine = lineNum;
          if (lineNum > 1) {
            entries.push({
              type: 'setup',
              name: 'Package & Imports Setup',
              signature: 'Package & Imports Setup',
              startLine: 1,
              endLine: lineNum - 1,
              lineCount: lineNum - 1,
              rawLines: lines.slice(0, lineNum - 1)
            });
          }
        }

        const isFunc = Boolean(funcMatch);
        const name = isFunc ? funcMatch[1] : typeMatch[1];
        const sig = trimmed.replace(/\s*\{.*$/, '');
        const delta = countBraceDelta(line, braceState);

        braceDepth = delta;
        currentDecl = {
          type: isFunc ? 'function' : (typeMatch[2] === 'struct' ? 'struct' : 'interface'),
          name,
          signature: sig,
          startLine: lineNum,
          endLine: lineNum,
          rawLines: [line]
        };

        if (delta <= 0 && trimmed.endsWith('}')) {
          currentDecl.lineCount = 1;
          entries.push(currentDecl);
          currentDecl = null;
          braceDepth = 0;
        }
      }
    }
  }

  if (currentDecl) {
    currentDecl.endLine = lines.length;
    currentDecl.lineCount = currentDecl.endLine - currentDecl.startLine + 1;
    entries.push(currentDecl);
  }

  return { totalLines: lines.length, entries };
}

/**
 * Parses Rust files into AST declaration entries with exact line ranges.
 */
export function parseRustAst(code, filename = '') {
  const lines = code.split('\n');
  const entries = [];
  let braceDepth = 0;
  let currentDecl = null;
  let firstDeclLine = null;
  const braceState = {};

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    if (currentDecl) {
      currentDecl.rawLines.push(line);
      braceDepth += countBraceDelta(line, braceState);
      if (braceDepth <= 0) {
        currentDecl.endLine = lineNum;
        currentDecl.lineCount = currentDecl.endLine - currentDecl.startLine + 1;
        entries.push(currentDecl);
        currentDecl = null;
        braceDepth = 0;
      }
      continue;
    }

    if (braceDepth === 0) {
      const fnMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/i);
      const structMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?struct\s+([a-zA-Z0-9_]+)/i);
      const enumMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?enum\s+([a-zA-Z0-9_]+)/i);
      const implMatch = trimmed.match(/^impl(?:\s*<[^>]+>)?(?:\s+[a-zA-Z0-9_]+ for)?\s+([a-zA-Z0-9_]+)/i);

      if (fnMatch || structMatch || enumMatch || implMatch) {
        if (firstDeclLine === null) {
          firstDeclLine = lineNum;
          if (lineNum > 1) {
            entries.push({
              type: 'setup',
              name: 'Crate Attributes & Modules',
              signature: 'Crate Attributes & Modules',
              startLine: 1,
              endLine: lineNum - 1,
              lineCount: lineNum - 1,
              rawLines: lines.slice(0, lineNum - 1)
            });
          }
        }

        const name = (fnMatch && fnMatch[1]) || (structMatch && structMatch[1]) || (enumMatch && enumMatch[1]) || (implMatch && implMatch[1]);
        const type = fnMatch ? 'function' : structMatch ? 'struct' : enumMatch ? 'enum' : 'impl';
        const sig = trimmed.replace(/\s*\{.*$/, '');
        const delta = countBraceDelta(line, braceState);

        braceDepth = delta;
        currentDecl = {
          type,
          name,
          signature: sig,
          startLine: lineNum,
          endLine: lineNum,
          rawLines: [line]
        };

        if (delta <= 0 && trimmed.endsWith(';')) {
          currentDecl.lineCount = 1;
          entries.push(currentDecl);
          currentDecl = null;
          braceDepth = 0;
        }
      }
    }
  }

  if (currentDecl) {
    currentDecl.endLine = lines.length;
    currentDecl.lineCount = currentDecl.endLine - currentDecl.startLine + 1;
    entries.push(currentDecl);
  }

  return { totalLines: lines.length, entries };
}

/**
 * Generic fallback AST parser for C, C++, Java, C#.
 */
export function parseGenericAst(code, filename = '') {
  return parseJsTsAst(code, filename);
}

/**
 * Generates an AST Function Index for any supported source code file.
 * Accurately extracts top-level functions, classes, interfaces, and line ranges.
 * Shields 1,000+ line files from swallowing 30k+ tokens during view_file calls.
 * 
 * @param {string} code
 * @param {string} [filename]
 * @param {object} [options]
 * @returns {object}
 */
export function generateAstFunctionIndex(code, filename = '', options = {}) {
  if (!code || typeof code !== 'string') {
    return {
      filename: filename || 'unknown',
      totalLines: 0,
      isLargeFile: false,
      entries: [],
      functionsFound: 0,
      formattedIndex: '',
      originalTokens: 0,
      indexTokens: 0,
      tokensSavedEstimate: 0,
      reductionPct: 0
    };
  }

  const cleanExt = path.extname(filename).toLowerCase();
  let parsed;

  if (['.py'].includes(cleanExt)) {
    parsed = parsePythonAst(code, filename);
  } else if (['.go'].includes(cleanExt)) {
    parsed = parseGoAst(code, filename);
  } else if (['.rs'].includes(cleanExt)) {
    parsed = parseRustAst(code, filename);
  } else if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(cleanExt)) {
    parsed = parseJsTsAst(code, filename);
  } else {
    parsed = parseGenericAst(code, filename);
  }

  const entries = parsed.entries || [];
  const totalLines = parsed.totalLines || code.split('\n').length;
  const isLargeFile = totalLines > 250;
  const functionEntries = entries.filter(e => e.type !== 'setup');

  const focusName = (options.focusName || '').toLowerCase().trim();
  let targetFocusEntry = null;
  let targetFocusCode = null;

  if (focusName) {
    targetFocusEntry = entries.find(e => e.name && e.name.toLowerCase() === focusName) || null;
    if (targetFocusEntry && targetFocusEntry.rawLines) {
      const lineFormatted = targetFocusEntry.rawLines.map((l, idx) => `${targetFocusEntry.startLine + idx}: ${l}`).join('\n');
      targetFocusCode = `[GRAVITON TARGET FOCUS: ${path.basename(filename)}#${targetFocusEntry.name} (Lines L${targetFocusEntry.startLine}-L${targetFocusEntry.endLine})]\n\`\`\`${cleanExt.replace('.', '')}\n${lineFormatted}\n\`\`\``;
    }
  }

  const displayName = path.basename(filename) || 'SourceFile';
  const originalTokens = Math.ceil(code.length / 4);

  // Format the surgical view index
  const headerLines = [
    `[GRAVITON AST FUNCTION INDEX: ${displayName} (${totalLines} lines | ${functionEntries.length} declarations)]`,
    `⚡ Large file detected (>250 lines). DO NOT load the entire file into context.`,
    `⚡ Use 'view_file' with 'StartLine' and 'EndLine' targeting specific ranges below:`,
    `--------------------------------------------------------------------------------`
  ];

  const rowLines = entries.map(e => {
    const range = `L${e.startLine}-L${e.endLine}`.padEnd(10, ' ');
    const typeLabel = e.type === 'setup' ? 'Setup' : e.type;
    const focusMarker = targetFocusEntry && targetFocusEntry.name === e.name ? ' 🎯 [TARGET FOCUS]' : '';
    return `  ${range} : [${typeLabel}] ${e.signature || e.name}${focusMarker}`;
  });

  const divider = `--------------------------------------------------------------------------------`;
  const formattedIndex = `${headerLines.join('\n')}\n${rowLines.join('\n')}\n${divider}`;
  const indexTokens = Math.ceil(formattedIndex.length / 4);
  const tokensSavedEstimate = Math.max(0, originalTokens - indexTokens);
  const reductionPct = originalTokens > 0 ? Math.round((tokensSavedEstimate / originalTokens) * 100) : 0;

  return {
    filename: displayName,
    filePath: filename,
    totalLines,
    isLargeFile,
    entries,
    functionsFound: functionEntries.length,
    targetFocusEntry,
    targetFocusCode,
    formattedIndex,
    originalTokens,
    indexTokens,
    tokensSavedEstimate,
    reductionPct
  };
}

/**
 * Formats AST Function Index for terminal CLI display (e.g. `grav index <file>`).
 * @param {object} astResult
 * @param {object} [options]
 * @returns {string}
 */
export function formatAstFunctionIndex(astResult, options = {}) {
  const isAnsi = options.ansi !== false;
  const cyan = isAnsi ? '\x1b[36m' : '';
  const yellow = isAnsi ? '\x1b[33m' : '';
  const green = isAnsi ? '\x1b[32m' : '';
  const gray = isAnsi ? '\x1b[90m' : '';
  const bold = isAnsi ? '\x1b[1m' : '';
  const reset = isAnsi ? '\x1b[0m' : '';

  const header = `\n${bold}${cyan}================================================================================${reset}\n` +
    `${bold}  GRAVITON AST FUNCTION INDEXER ${reset}${gray}(V3.3.0 Large File Shield)${reset}\n` +
    `${bold}${cyan}================================================================================${reset}\n` +
    `  ${bold}File:${reset} ${astResult.filename} ${gray}(${astResult.totalLines} lines)${reset}\n` +
    `  ${bold}Declarations:${reset} ${green}${astResult.functionsFound} found${reset}\n` +
    `  ${bold}Token Economy:${reset} ~${astResult.originalTokens.toLocaleString()} tokens → ~${astResult.indexTokens.toLocaleString()} tokens ` +
    `${bold}${green}(${astResult.reductionPct}% saved, ~${astResult.tokensSavedEstimate.toLocaleString()} tokens protected)${reset}\n\n` +
    `  ${yellow}⚡ Surgical View Guide: Use 'view_file' with 'StartLine' and 'EndLine' below:${reset}\n` +
    `  ${gray}----------------------------------------------------------------------------${reset}`;

  const rows = astResult.entries.map(e => {
    const range = `${cyan}L${e.startLine}-L${e.endLine}${reset}`.padEnd(isAnsi ? 20 : 10, ' ');
    const typeLabel = e.type === 'setup' ? `${gray}[Setup]${reset}` : `${green}[${e.type}]${reset}`;
    const nameStr = e.type === 'setup' ? `${gray}${e.name}${reset}` : `${bold}${e.signature || e.name}${reset}`;
    return `    ${range} : ${typeLabel} ${nameStr}`;
  });

  const footer = `  ${gray}----------------------------------------------------------------------------${reset}\n` +
    `  ${gray}Tip: Run 'grav "<prompt>"' to auto-index large files during execution.${reset}\n`;

  return `${header}\n${rows.join('\n')}\n${footer}`;
}

