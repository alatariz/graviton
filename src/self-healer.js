// src/self-healer.js - Graviton V3.7.0 Pre-Flight Syntax & Import Self-Healing Guard
import fs from 'fs';
import path from 'path';

/**
 * Validates and auto-heals common code syntax issues:
 * 1. Unclosed brackets, parentheses, curly braces, and template literals
 * 2. Truncated single-line or multi-line strings at EOF
 * 3. JSON trailing commas or unclosed objects/arrays
 *
 * @param {string} code
 * @param {string} [ext='js']
 * @returns {{ healedCode: string, wasHealed: boolean, issuesFixed: string[] }}
 */
export function healCodeSyntax(code, ext = 'js') {
  if (!code || typeof code !== 'string') {
    return { healedCode: code || '', wasHealed: false, issuesFixed: [] };
  }

  let cleaned = code;
  const issuesFixed = [];
  const normalizedExt = (ext || '').replace(/^\./, '').toLowerCase();

  // 1. JSON Specific Self-Healing
  if (normalizedExt === 'json') {
    try {
      JSON.parse(cleaned);
      return { healedCode: cleaned, wasHealed: false, issuesFixed: [] };
    } catch (e) {
      // Remove trailing commas before } or ]
      const noTrailingComma = cleaned.replace(/,\s*([}\]])/g, '$1');
      if (noTrailingComma !== cleaned) {
        try {
          JSON.parse(noTrailingComma);
          return {
            healedCode: noTrailingComma,
            wasHealed: true,
            issuesFixed: ['Removed trailing commas in JSON']
          };
        } catch {}
      }

      // Check for unclosed brackets in JSON
      const openBraces = (cleaned.match(/\{/g) || []).length;
      const closeBraces = (cleaned.match(/\}/g) || []).length;
      const openBrackets = (cleaned.match(/\[/g) || []).length;
      const closeBrackets = (cleaned.match(/\]/g) || []).length;

      let healedJson = noTrailingComma.trim();
      if (openBrackets > closeBrackets) {
        healedJson += ']'.repeat(openBrackets - closeBrackets);
        issuesFixed.push(`Auto-closed ${openBrackets - closeBrackets} missing ']'`);
      }
      if (openBraces > closeBraces) {
        healedJson += '}'.repeat(openBraces - closeBraces);
        issuesFixed.push(`Auto-closed ${openBraces - closeBraces} missing '}'`);
      }

      try {
        JSON.parse(healedJson);
        return { healedCode: healedJson, wasHealed: true, issuesFixed };
      } catch {
        // Return original if unfixable
        return { healedCode: code, wasHealed: false, issuesFixed: [] };
      }
    }
  }

  // 2. JavaScript / TypeScript / General Code Self-Healing
  const bracketStack = [];
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;
  let isEscaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const nextChar = cleaned[i + 1] || '';

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      isEscaped = true;
      continue;
    }

    // Handle single-line comments
    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }

    // Handle block comments
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    // Comment starters (outside strings)
    if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
      if (char === '/' && nextChar === '/') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inBlockComment = true;
        i++;
        continue;
      }
    }

    // String literals
    if (char === "'" && !inDoubleQuote && !inBacktick) {
      inSingleQuote = !inSingleQuote;
      continue;
    }
    if (char === '"' && !inSingleQuote && !inBacktick) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }
    if (char === '`' && !inSingleQuote && !inDoubleQuote) {
      inBacktick = !inBacktick;
      continue;
    }

    // If inside a string, don't track brackets
    if (inSingleQuote || inDoubleQuote || inBacktick) {
      continue;
    }

    // Bracket tracking
    if (char === '{' || char === '(' || char === '[') {
      bracketStack.push(char);
    } else if (char === '}') {
      if (bracketStack.length > 0 && bracketStack[bracketStack.length - 1] === '{') {
        bracketStack.pop();
      }
    } else if (char === ')') {
      if (bracketStack.length > 0 && bracketStack[bracketStack.length - 1] === '(') {
        bracketStack.pop();
      }
    } else if (char === ']') {
      if (bracketStack.length > 0 && bracketStack[bracketStack.length - 1] === '[') {
        bracketStack.pop();
      }
    }
  }

  let healed = cleaned;

  // Auto-close open strings/backticks at EOF
  if (inSingleQuote) {
    healed += "'";
    issuesFixed.push("Auto-closed unclosed single quote at EOF");
  }
  if (inDoubleQuote) {
    healed += '"';
    issuesFixed.push('Auto-closed unclosed double quote at EOF');
  }
  if (inBacktick) {
    healed += '`';
    issuesFixed.push('Auto-closed unclosed template literal backtick at EOF');
  }

  // Auto-close unclosed brackets in reverse order
  if (bracketStack.length > 0) {
    const missingClosers = [];
    while (bracketStack.length > 0) {
      const openChar = bracketStack.pop();
      if (openChar === '{') missingClosers.push('\n}');
      else if (openChar === '(') missingClosers.push(')');
      else if (openChar === '[') missingClosers.push(']');
    }
    healed += missingClosers.join('');
    issuesFixed.push(`Auto-closed ${missingClosers.length} missing bracket(s)`);
  }

  return {
    healedCode: healed,
    wasHealed: issuesFixed.length > 0,
    issuesFixed
  };
}

/**
 * Scans relative imports in source code and auto-patches missing file extensions
 * (e.g. `import foo from './utils'` -> `import foo from './utils.js'` if utils.js exists).
 *
 * @param {string} filePath
 * @param {string} code
 * @param {string} [cwd=process.cwd()]
 * @returns {{ healedCode: string, wasHealed: boolean, issuesFixed: string[] }}
 */
export function healRelativeImports(filePath, code, cwd = process.cwd()) {
  if (!code || typeof code !== 'string') {
    return { healedCode: code || '', wasHealed: false, issuesFixed: [] };
  }

  const baseDir = filePath ? path.dirname(path.resolve(cwd, filePath)) : cwd;
  const issuesFixed = [];

  const importRegex = /(import\s+(?:(?:[\w*\s{},]+)\s+from\s+)?['"]|require\(['"]|export\s+(?:(?:[\w*\s{},]+)\s+from\s+)?['"])((?:\.\/|\.\.\/)[^'"]+)(['"]\)?)/g;

  const healedCode = code.replace(importRegex, (match, prefix, specifier, suffix) => {
    // If specifier already has an extension like .js, .mjs, .json, leave it
    if (path.extname(specifier)) {
      return match;
    }

    const candidateExtensions = ['.js', '.mjs', '.cjs', '.json', '.ts'];
    for (const ext of candidateExtensions) {
      const testPath = path.resolve(baseDir, specifier + ext);
      if (fs.existsSync(testPath) && fs.statSync(testPath).isFile()) {
        const healedSpecifier = specifier + ext;
        issuesFixed.push(`Patched import extension: "${specifier}" -> "${healedSpecifier}"`);
        return `${prefix}${healedSpecifier}${suffix}`;
      }
    }

    // Check directory index (e.g. './utils' -> './utils/index.js')
    for (const ext of ['.js', '.mjs']) {
      const indexPath = path.resolve(baseDir, specifier, 'index' + ext);
      if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
        const healedSpecifier = `${specifier}/index${ext}`;
        issuesFixed.push(`Patched directory import: "${specifier}" -> "${healedSpecifier}"`);
        return `${prefix}${healedSpecifier}${suffix}`;
      }
    }

    return match;
  });

  return {
    healedCode,
    wasHealed: issuesFixed.length > 0,
    issuesFixed
  };
}

/**
 * Combined self-healing entry point for any file.
 * @param {string} filePath
 * @param {string} code
 * @param {string} [cwd=process.cwd()]
 * @returns {{ healedCode: string, wasHealed: boolean, issuesFixed: string[] }}
 */
export function selfHealFile(filePath, code, cwd = process.cwd()) {
  const ext = filePath ? path.extname(filePath) : 'js';
  const syntaxRes = healCodeSyntax(code, ext);
  const importRes = healRelativeImports(filePath, syntaxRes.healedCode, cwd);

  const allIssues = [...syntaxRes.issuesFixed, ...importRes.issuesFixed];

  return {
    healedCode: importRes.healedCode,
    wasHealed: allIssues.length > 0,
    issuesFixed: allIssues
  };
}
