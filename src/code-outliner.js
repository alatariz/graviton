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
        const totalCollapsed = i - collapsedStartLine;
        output.push(collapsedHeader.replace(/\{$/, `{ /* ... ${totalCollapsed} lines collapsed ... */ }`));
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
 * Helper to count net balance of { and } in a line, ignoring strings and comments.
 */
function countBraceDelta(line) {
  let delta = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : '';

    if (inString) {
      if (ch === stringChar && prev !== '\\') {
        inString = false;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = true;
      stringChar = ch;
      continue;
    }

    // Ignore inline comments
    if (ch === '/' && line[i + 1] === '/') {
      break;
    }

    if (ch === '{') delta++;
    else if (ch === '}') delta--;
  }

  return delta;
}
