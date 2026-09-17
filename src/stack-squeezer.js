// src/stack-squeezer.js - Graviton V2.6.0 Smart Stack Trace Squeezer
import path from 'path';

/**
 * Checks if a string or block contains a recognized runtime stack trace.
 * @param {string} text
 * @returns {boolean}
 */
export function isStackTrace(text) {
  if (!text || typeof text !== 'string') return false;

  // Node.js / JavaScript stack trace indicators
  const hasNodeTrace = /(?:\b(?:Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|AssertionError)\b.*?\n\s+at\s+|\s+at\s+[a-zA-Z0-9_$.<>]+\s+\(.*?\))/m.test(text);

  // Python stack trace indicators
  const hasPythonTrace = /Traceback \(most recent call last\):|File\s+"[^"]+",\s+line\s+\d+/m.test(text);

  return hasNodeTrace || hasPythonTrace;
}

/**
 * Evaluates whether a stack trace line represents an internal runtime or third-party vendor frame.
 * @param {string} line
 * @param {string} [cwd]
 * @returns {boolean}
 */
export function isInternalFrame(line, cwd = process.cwd()) {
  if (!line || typeof line !== 'string') return false;

  // JavaScript / Node.js vendor & internal runtime indicators
  if (/\bnode_modules[\\/]/.test(line)) return true;
  if (/\((?:node:internal|internal[\\/]modules|node:async_hooks|node:events)/.test(line)) return true;
  if (/\bat\s+async\s+.*\(node:internal/.test(line)) return true;
  if (/\bat\s+(?:Module\._compile|Module\._extensions|Module\.load|Module\._load|Function\.executeUserEntryPoint|wrapSafe)\b/.test(line)) return true;

  // Python vendor & stdlib runtime indicators
  if (/[\\/](?:site-packages|dist-packages)[\\/]/.test(line)) return true;
  if (/[\\/]lib[\\/]python\d+\.\d+[\\/](?:runpy|threading|unittest|importlib)[\\/]/.test(line)) return true;

  return false;
}

/**
 * Squeezes a pure stack trace block, collapsing internal/vendor frames.
 * @param {string} traceText
 * @param {string} [cwd]
 * @returns {string}
 */
export function squeezeStackTrace(traceText, cwd = process.cwd()) {
  if (!traceText || typeof traceText !== 'string') return traceText;

  const lines = traceText.split(/\r?\n/);
  const result = [];
  let collapsedCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFrame = /^\s+at\s+/.test(line) || /^\s*File\s+"/.test(line);

    if (isFrame && isInternalFrame(line, cwd)) {
      collapsedCount++;
      // If next line is Python code snippet belonging to this frame
      if (i + 1 < lines.length && /^\s{4,}[^\s]/.test(lines[i + 1]) && !/^\s+at\s+/.test(lines[i + 1]) && !/^\s*File\s+"/.test(lines[i + 1])) {
        i++; // skip snippet
      }
    } else {
      if (collapsedCount > 0) {
        result.push(`    ... [${collapsedCount} internal library frames collapsed for token economy]`);
        collapsedCount = 0;
      }
      result.push(line);
    }
  }

  if (collapsedCount > 0) {
    result.push(`    ... [${collapsedCount} internal library frames collapsed for token economy]`);
  }

  return result.join('\n');
}

/**
 * Scans mixed text (e.g. user prompt with embedded error log) and compacts stack traces.
 * @param {string} text
 * @param {string} [cwd]
 * @returns {{ squeezedText: string, linesSaved: number, hasTrace: boolean }}
 */
export function squeezeMixedContent(text, cwd = process.cwd()) {
  if (!text || typeof text !== 'string') {
    return { squeezedText: text || '', linesSaved: 0, hasTrace: false };
  }

  if (!isStackTrace(text)) {
    return { squeezedText: text, linesSaved: 0, hasTrace: false };
  }

  const origLineCount = text.split(/\r?\n/).length;
  const squeezed = squeezeStackTrace(text, cwd);
  const newLineCount = squeezed.split(/\r?\n/).length;
  const linesSaved = Math.max(0, origLineCount - newLineCount);

  return {
    squeezedText: squeezed,
    linesSaved,
    hasTrace: linesSaved > 0
  };
}
