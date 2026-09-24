// src/stack-squeezer.js - .0.0 Smart Stack Trace Squeezer
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
 * Checks if a string or block contains test runner output (Jest, Vitest, Mocha, pytest, go test, cargo test).
 * @param {string} text
 * @returns {boolean}
 */
export function isTestOutput(text) {
  if (!text || typeof text !== 'string') return false;
  const hasJest = /(?:PASS|FAIL)\s+.*?\.(?:test|spec)\.[a-zA-Z]+|Test Suites:\s+\d+|Tests:\s+\d+\s+(?:passed|failed)|Ran all test suites/i.test(text);
  const hasMochaOrNode = /(?:✓|✔|\bx\b|✕)\s+.*?\(\d+\s*m?s\)|#\s+(?:tests|pass|fail)\s+\d+|ℹ\s+(?:tests|pass|fail)\s+\d+|▶\s+[^\n]+/i.test(text);
  const hasPytest = /(?:===+\s*(?:FAILURES|test session starts|short test summary info)\s*===+|tests?\/.*?\.py\s+[.F]+|pytest-[\d.]+)/i.test(text);
  const hasGoTest = /(?:=== RUN\s+[a-zA-Z0-9_]+|--- (?:PASS|FAIL):\s+[a-zA-Z0-9_]+)/i.test(text);
  const hasCargoTest = /(?:running\s+\d+\s+tests|test\s+[a-zA-Z0-9_:]+\s+\.\.\.\s+(?:ok|FAILED))/i.test(text);

  return hasJest || hasMochaOrNode || hasPytest || hasGoTest || hasCargoTest;
}

/**
 * Checks if a string contains compiler or build tool chatter (Webpack, Vite, tsc, Cargo build).
 * @param {string} text
 * @returns {boolean}
 */
export function isBuildOutput(text) {
  if (!text || typeof text !== 'string') return false;
  const hasCargoBuild = /^\s*Compiling\s+[a-zA-Z0-9_-]+\s+v\d+/m.test(text);
  const hasBundler = /(?:\[vite\]|webpack\s+compiled|\[\d+\/\d+\]\s+Building|tsc\s+--build|rollup\s+v\d+)/i.test(text);
  const hasNpmBuild = /(?:npm run build|yarn build|pnpm build)/i.test(text);
  return hasCargoBuild || hasBundler || hasNpmBuild;
}

/**
 * Condenses test runner outputs across Jest, Vitest, Mocha, Node test runner, pytest, go test, and cargo test.
 * Collapses dozens of passing tests into a single summary line while isolating failures and assertion diffs.
 * @param {string} rawText
 * @param {object} [options]
 * @returns {string}
 */
export function condenseTestOutput(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string') return rawText;

  const clean = rawText
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\[[0-9;]+m/g, '')
    .replace(/\r/g, '\n');

  const lines = clean.split('\n');

  let passedTestsCount = 0;
  let passingSuitesCount = 0;
  let failedTestsCount = 0;
  let failedSuitesCount = 0;

  const failureLines = [];
  const summaryLines = [];
  const userPrefix = [];
  const userSuffix = [];
  let hasStartedTests = false;
  let seenSummary = false;
  let inFailureSection = false;
  let inPassingSuite = false;
  let lastWasOmitted = false;
  let currentGoRunLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (!hasStartedTests && userPrefix.length > 0) {
        userPrefix.push('');
      } else if (seenSummary && userSuffix.length > 0) {
        userSuffix.push('');
      } else if (inFailureSection && failureLines.length > 0 && failureLines[failureLines.length - 1] !== '') {
        failureLines.push('');
      }
      continue;
    }

    const isTestStart = /^(?:PASS|FAIL|▶)\s+/i.test(trimmed) ||
      /^===\s*(?:RUN|test session starts|FAILURES)/i.test(trimmed) ||
      /^running\s+\d+\s+tests/i.test(trimmed) ||
      /^---\s*(?:PASS|FAIL):/i.test(trimmed) ||
      /^test\s+[a-zA-Z0-9_:]+\s+\.\.\.\s+(?:ok|FAILED)/i.test(trimmed) ||
      /^tests?\/.*?\.py\s+[.F]+/i.test(trimmed) ||
      /^(?:✓|✔|\bx\b|✕)\s+.*?\(\d+\s*m?s\)/i.test(trimmed);

    if (!hasStartedTests) {
      if (isTestStart) {
        hasStartedTests = true;
      } else {
        userPrefix.push(line);
        continue;
      }
    }

    const isSummaryLine = /^(?:Test Suites?:|Tests?:|Snapshots?:|Time:|Ran all test suites|ℹ\s+(?:tests|pass|fail))/i.test(trimmed) ||
      /^=+ (?:[0-9]+ failed|[0-9]+ passed|short test summary info)/i.test(trimmed) ||
      /^test result: (?:FAILED|ok)/i.test(trimmed) ||
      /^(?:FAIL|ok)\s+[a-zA-Z0-9_./\\-]+\s+[\d.]+s/i.test(trimmed);

    if (isSummaryLine) {
      seenSummary = true;
      if (!summaryLines.includes(trimmed) && !trimmed.startsWith('Snapshots: 0') && !trimmed.startsWith('Time:')) {
        summaryLines.push(trimmed);
      }
      inFailureSection = false;
      continue;
    }

    if (seenSummary) {
      userSuffix.push(line);
      continue;
    }

    // Jest / Vitest / Node PASS suite
    if (/^PASS\s+/i.test(trimmed)) {
      inPassingSuite = true;
      inFailureSection = false;
      passingSuitesCount++;
      continue;
    }

    // Jest / Vitest FAIL suite
    if (/^FAIL\s+/i.test(trimmed)) {
      inPassingSuite = false;
      inFailureSection = true;
      failedSuitesCount++;
      failureLines.push(trimmed);
      continue;
    }

    // Individual passing tests
    if (/^(?:✓|✔|\bPASS\b)/i.test(trimmed) || (inPassingSuite && /^(?:✓|✔)/.test(trimmed))) {
      passedTestsCount++;
      continue;
    }

    // Go test RUN header
    if (/^===\s*RUN\s+/i.test(trimmed)) {
      inPassingSuite = false;
      inFailureSection = false;
      currentGoRunLines = [line];
      continue;
    }

    // Pytest passing dots
    const pyDotsMatch = trimmed.match(/^tests?\/.*?\.py\s+([.]+)/);
    if (pyDotsMatch) {
      passedTestsCount += pyDotsMatch[1].length;
      passingSuitesCount++;
      continue;
    }

    // Go / Cargo passing test lines
    if (/^---\s*PASS:/i.test(trimmed) || /^test\s+.*?\s+\.\.\.\s+ok$/i.test(trimmed)) {
      currentGoRunLines = [];
      passedTestsCount++;
      continue;
    }

    // Individual failing test markers
    if (/^(?:✕|✖|---\s*FAIL:|test\s+.*?\s+\.\.\.\s+FAILED|●\s+)/i.test(trimmed)) {
      inFailureSection = true;
      failedTestsCount++;
      if (currentGoRunLines.length > 0) {
        failureLines.push(...currentGoRunLines);
        currentGoRunLines = [];
      }
      failureLines.push(line);
      lastWasOmitted = false;
      continue;
    }

    // If inside a pending Go test run, buffer its output lines until PASS or FAIL
    if (currentGoRunLines.length > 0) {
      currentGoRunLines.push(line);
      continue;
    }

    // Pytest & Cargo failure header
    if (/^(?:=+ FAILURES =+|failures:)/i.test(trimmed)) {
      inFailureSection = true;
      failureLines.push(trimmed);
      lastWasOmitted = false;
      continue;
    }

    // When inside failure section: capture relevant details and collapse internal stack frames
    if (inFailureSection) {
      if (/^\s+at\s+/.test(line)) {
        if (isInternalFrame(line)) {
          if (!lastWasOmitted) {
            failureLines.push('    ↳ [... internal library frames collapsed for token economy ...]');
            lastWasOmitted = true;
          }
          continue;
        }
      }
      lastWasOmitted = false;
      failureLines.push(line);
    }
  }

  const hasFailures = failedSuitesCount > 0 || failedTestsCount > 0 || failureLines.length > 0;

  let testBlock = '';
  if (!hasFailures) {
    if (passedTestsCount === 0 && passingSuitesCount === 0 && summaryLines.length === 0) {
      return rawText;
    }
    const suitesText = passingSuitesCount > 0 ? ` across ${passingSuitesCount} suites` : '';
    const countText = passedTestsCount > 0 ? `${passedTestsCount} tests` : 'All tests';
    testBlock = `✔  ${countText} passed${suitesText} (0 failures). Output condensed for token economy.`;
  } else {
    const cleanFailures = failureLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const summaryText = summaryLines.join(' | ') || `Tests: ${failedTestsCount || 1} failed, ${passedTestsCount} passed`;
    testBlock = `[GRAVITON TEST SQUEEZER: ${failedTestsCount || 1} failed, ${passedTestsCount} passed]\n` +
      (passedTestsCount > 0 ? `✔  ${passedTestsCount} passing tests collapsed for token economy.\n\n` : '') +
      `✖  Test Failures & Diffs:\n${cleanFailures}\n\n` +
      `Test Summary: ${summaryText}`;
  }

  const parts = [];
  const cleanPrefix = userPrefix.join('\n').trim();
  if (cleanPrefix) parts.push(cleanPrefix);
  parts.push(testBlock);
  const cleanSuffix = userSuffix.join('\n').trim();
  if (cleanSuffix) parts.push(cleanSuffix);

  return parts.join('\n\n');
}

/**
 * Strips bundler progress chatter, spinners, and collapses Cargo dependency compilation.
 * @param {string} rawText
 * @param {object} [options]
 * @returns {string}
 */
export function condenseBuildOutput(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string') return rawText;

  let clean = rawText
    .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\[[0-9;]+m/g, '')
    .replace(/\r/g, '\n');

  clean = clean.replace(/^[-\\|/]\s*.*$/gm, '');
  clean = clean.replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s*.*$/gm, '');
  clean = clean.replace(/\[[=>\s#-]{3,}\]\s*(?:\d{1,3}%|\d+\/\d+)?/g, '');
  clean = clean.replace(/(?:\d{1,3}%|\d+\/\d+)\s*\[[=>\s#-]{3,}\]/g, '');
  clean = clean.replace(/^npm\s+(?:http|verb|timing)\s+.*$/gm, '');

  const lines = clean.split('\n').map(l => l.trimEnd());
  const result = [];
  let cargoDepCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      if (result.length > 0 && result[result.length - 1] !== '') {
        result.push('');
      }
      continue;
    }

    if (/^\s*Compiling\s+[a-zA-Z0-9_-]+\s+v\d+/i.test(trimmed)) {
      cargoDepCount++;
      continue;
    } else if (cargoDepCount > 0) {
      result.push(`   ↳ [... compiled ${cargoDepCount} dependencies ...]`);
      cargoDepCount = 0;
    }

    if (/^\[vite\]\s+hmr\s+update/i.test(trimmed)) {
      continue;
    }

    if (/(?:building|transforming)\s+\(\d+\/\d+\)/i.test(trimmed) || /\[\d+\/\d+\]\s+Building/i.test(trimmed)) {
      continue;
    }

    result.push(line);
  }

  if (cargoDepCount > 0) {
    result.push(`   ↳ [... compiled ${cargoDepCount} dependencies ...]`);
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Scans mixed text (e.g. user prompt with embedded test logs, build logs, or error stack traces)
 * and compacts them for maximum token economy.
 * @param {string} text
 * @param {string} [cwd]
 * @returns {{ squeezedText: string, linesSaved: number, hasTrace: boolean }}
 */
export function squeezeMixedContent(text, cwd = process.cwd()) {
  if (!text || typeof text !== 'string') {
    return { squeezedText: text || '', linesSaved: 0, hasTrace: false };
  }

  const origLineCount = text.split(/\r?\n/).length;
  let processed = text;
  let modified = false;

  // 1. Check if contains test runner output
  if (isTestOutput(processed)) {
    const condensed = condenseTestOutput(processed);
    if (condensed !== processed) {
      processed = condensed;
      modified = true;
    }
  }

  // 2. Check if contains build output
  if (isBuildOutput(processed)) {
    const condensed = condenseBuildOutput(processed);
    if (condensed !== processed) {
      processed = condensed;
      modified = true;
    }
  }

  // 3. Check if contains stack trace
  if (isStackTrace(processed)) {
    const squeezed = squeezeStackTrace(processed, cwd);
    if (squeezed !== processed) {
      processed = squeezed;
      modified = true;
    }
  }

  const newLineCount = processed.split(/\r?\n/).length;
  const linesSaved = Math.max(0, origLineCount - newLineCount);

  return {
    squeezedText: processed,
    linesSaved,
    hasTrace: modified || linesSaved > 0
  };
}

