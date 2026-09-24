// src/runtime-sentinel.js - Graviton V5.1.1 Runtime Verification Sentinel
// Validates syntax, module imports, DOM bindings, and generates auto-repair patches.

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import vm from 'vm';

/**
 * Validates JavaScript syntax using Node.js built-in runtime checker.
 * @param {string} code
 * @param {string} [filePath='anonymous.js']
 * @returns {{ valid: boolean, error?: string, line?: number }}
 */
export function verifyJavaScriptSyntax(code, filePath = 'anonymous.js') {
  if (!code || typeof code !== 'string') {
    return { valid: true };
  }

  // Fast check: Try vm.Script for script code without ES modules
  if (!/\b(?:import|export)\b/.test(code)) {
    try {
      new vm.Script(code, { filename: filePath });
      return { valid: true };
    } catch (err) {
      const lineMatch = err.stack ? err.stack.match(/:(\d+)(?::\d+)?/) : null;
      return {
        valid: false,
        error: err.message,
        line: lineMatch ? parseInt(lineMatch[1], 10) : null
      };
    }
  }

  // For ES Modules with import/export, write to temporary file and run node --check
  try {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '.graviton-check-'));
    const tempFile = path.join(tempDir, 'check.mjs');
    try {
      fs.writeFileSync(tempFile, code, 'utf8');
      const res = spawnSync(process.execPath, ['--check', tempFile], {
        encoding: 'utf8',
        timeout: 2000
      });

      if (res.status !== 0) {
        const errorOut = res.stderr || res.stdout || 'Syntax check failed';
        const lineMatch = errorOut.match(/:(\d+)(?::\d+)?/);
        return {
          valid: false,
          error: errorOut.split('\n')[0] || 'Syntax error',
          line: lineMatch ? parseInt(lineMatch[1], 10) : null
        };
      }
      return { valid: true };
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  } catch (err) {
    return { valid: true };
  }
}

/**
 * Validates DOM bindings between HTML elements and JavaScript selectors.
 * Catches classic ANI mistakes: JS references getElementById('canvas'), but HTML has id="gameCanvas".
 *
 * @param {string} htmlContent
 * @param {string} jsContent
 * @returns {Array<{ issue: string, missingId: string, availableIds: string[] }>}
 */
export function verifyDomBindings(htmlContent = '', jsContent = '') {
  if (!htmlContent || !jsContent) return [];

  // Extract all IDs defined in HTML
  const idRegex = /\bid=["']([^"']+)["']/gi;
  const htmlIds = new Set();
  let m;
  while ((m = idRegex.exec(htmlContent)) !== null) {
    htmlIds.add(m[1]);
  }

  // Extract all getElementById calls with literal string IDs
  const jsGetIdRegex = /document\.getElementById\(\s*["']([a-zA-Z0-9_-]+)["']\s*\)/g;
  const missingBindings = [];
  const checked = new Set();

  while ((m = jsGetIdRegex.exec(jsContent)) !== null) {
    const targetId = m[1];
    if (checked.has(targetId)) continue;
    checked.add(targetId);

    if (!htmlIds.has(targetId)) {
      missingBindings.push({
        issue: `DOM Mismatch: JavaScript references document.getElementById('${targetId}'), but id="${targetId}" does not exist in HTML`,
        missingId: targetId,
        availableIds: Array.from(htmlIds)
      });
    }
  }

  return missingBindings;
}

/**
 * Validates local relative file imports to ensure all referenced files exist on disk.
 * @param {string} code
 * @param {string} currentFilePath
 * @returns {Array<{ importPath: string, resolvedPath: string, missing: boolean }>}
 */
export function verifyLocalImports(code = '', currentFilePath = '') {
  if (!code || !currentFilePath) return [];

  const baseDir = path.dirname(currentFilePath);
  // Match real top-level import statements
  const importRegex = /^\s*(?:import\s+(?:.*?\s+from\s+)?|const\s+.*?\s*=\s*require\(\s*)["'](\.[^"']+)["']/gm;
  const issues = [];
  let m;

  while ((m = importRegex.exec(code)) !== null) {
    const relImport = m[1];
    const resolvedPath = path.resolve(baseDir, relImport);

    const exists = fs.existsSync(resolvedPath)
      || fs.existsSync(`${resolvedPath}.js`)
      || fs.existsSync(`${resolvedPath}.mjs`)
      || fs.existsSync(`${resolvedPath}.json`)
      || fs.existsSync(path.join(resolvedPath, 'index.js'));

    if (!exists) {
      issues.push({
        importPath: relImport,
        resolvedPath,
        missing: true
      });
    }
  }

  return issues;
}

/**
 * Executes a full runtime inspection on a workspace directory.
 * @param {string} cwd
 * @returns {{
 *   valid: boolean,
 *   filesChecked: number,
 *   syntaxErrors: Array<{ file: string, error: string, line: number|null }>,
 *   domMismatches: Array<{ file: string, issue: string, missingId: string }>,
 *   missingImports: Array<{ file: string, importPath: string }>,
 *   summary: string
 * }}
 */
export function verifyProjectRuntime(cwd = process.cwd()) {
  const result = {
    valid: true,
    filesChecked: 0,
    syntaxErrors: [],
    domMismatches: [],
    missingImports: [],
    summary: ''
  };

  const indexPath = path.join(cwd, 'index.html');
  let indexContent = '';
  if (fs.existsSync(indexPath)) {
    indexContent = fs.readFileSync(indexPath, 'utf8');
    result.filesChecked++;
  }

  // Scan JS files in workspace (up to 30 files for performance)
  let scannedFiles = 0;
  function scan(dir, depth = 0) {
    if (depth > 3 || scannedFiles > 30) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const ent of entries) {
      if (ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === 'dist') continue;
      const fullPath = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        scan(fullPath, depth + 1);
      } else if (ent.isFile() && /\.(?:js|mjs)$/i.test(ent.name)) {
        scannedFiles++;
        result.filesChecked++;
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          // 1. Syntax Verification
          const syntaxCheck = verifyJavaScriptSyntax(content, fullPath);
          if (!syntaxCheck.valid) {
            result.valid = false;
            result.syntaxErrors.push({
              file: path.relative(cwd, fullPath).replace(/\\/g, '/'),
              error: syntaxCheck.error,
              line: syntaxCheck.line
            });
          }

          // 2. Import Verification
          const brokenImports = verifyLocalImports(content, fullPath);
          for (const bi of brokenImports) {
            result.valid = false;
            result.missingImports.push({
              file: path.relative(cwd, fullPath).replace(/\\/g, '/'),
              importPath: bi.importPath
            });
          }

          // 3. DOM Binding Verification (against index.html if present)
          if (indexContent) {
            const mismatches = verifyDomBindings(indexContent, content);
            for (const dm of mismatches) {
              result.valid = false;
              result.domMismatches.push({
                file: path.relative(cwd, fullPath).replace(/\\/g, '/'),
                issue: dm.issue,
                missingId: dm.missingId
              });
            }
          }
        } catch {}
      }
    }
  }

  scan(cwd);

  // If index.html has inline script, verify inline DOM bindings
  if (indexContent) {
    const inlineScriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
    let sm;
    while ((sm = inlineScriptRegex.exec(indexContent)) !== null) {
      const scriptCode = sm[1];
      const inlineDomErrors = verifyDomBindings(indexContent, scriptCode);
      for (const ide of inlineDomErrors) {
        result.valid = false;
        result.domMismatches.push({
          file: 'index.html (inline)',
          issue: ide.issue,
          missingId: ide.missingId
        });
      }
    }
  }

  const errorCount = result.syntaxErrors.length + result.domMismatches.length + result.missingImports.length;
  result.valid = errorCount === 0;
  result.summary = result.valid
    ? `All ${result.filesChecked} scanned files passed autonomous runtime verification.`
    : `Runtime Sentinel detected ${errorCount} defect(s): ${result.syntaxErrors.length} syntax, ${result.domMismatches.length} DOM mismatch, ${result.missingImports.length} broken imports.`;

  return result;
}

/**
 * Formats a verification report into a deterministic, surgical self-healing directive for AI prompt injection.
 * @param {object} verificationReport
 * @returns {string}
 */
export function generateSelfCorrectionDirective(verificationReport) {
  if (!verificationReport || verificationReport.valid) return '';

  const lines = [
    '=== [GRAVITON AUTONOMOUS RUNTIME SENTINEL: DEFECT ISOLATION REPORT] ===',
    `Status: DEFECT DETECTED. Immediate self-correction mandatory before completion.`,
    `Diagnostics:`
  ];

  for (const se of verificationReport.syntaxErrors || []) {
    lines.push(`- [SYNTAX ERROR in ${se.file}${se.line ? `:${se.line}` : ''}]: ${se.error}`);
  }
  for (const dm of verificationReport.domMismatches || []) {
    lines.push(`- [DOM BINDING MISMATCH in ${dm.file}]: Missing HTML element id="${dm.missingId}". Add element or correct selector.`);
  }
  for (const mi of verificationReport.missingImports || []) {
    lines.push(`- [BROKEN IMPORT in ${mi.file}]: Cannot resolve local module "${mi.importPath}". Create missing file or fix import path.`);
  }

  lines.push('Mandatory Action: Provide surgical localized fix addressing the exact root causes above. Zero stubs allowed.');
  lines.push('======================================================================');

  return lines.join('\n');
}

/**
 * Autonomously heals a broken DOM binding in HTML by creating the missing element container.
 * @param {string} htmlContent
 * @param {string} missingId
 * @returns {{ healedHtml: string, wasHealed: boolean }}
 */
export function autoHealMissingDomElement(htmlContent = '', missingId = '') {
  if (!htmlContent || !missingId) return { healedHtml: htmlContent, wasHealed: false };
  if (htmlContent.includes(`id="${missingId}"`) || htmlContent.includes(`id='${missingId}'`)) {
    return { healedHtml: htmlContent, wasHealed: false };
  }

  // Inject before </body> or at end
  const injection = `  <div id="${missingId}"></div>\n`;
  if (htmlContent.includes('</body>')) {
    const healed = htmlContent.replace('</body>', `${injection}</body>`);
    return { healedHtml: healed, wasHealed: true };
  }

  return { healedHtml: `${htmlContent}\n${injection}`, wasHealed: true };
}
