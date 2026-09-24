// src/autonomous-router.js - .0.0 Autonomous Zero-Option Intent Engine
import fs from 'fs';
import path from 'path';
import { detectDomainFromPrompt, scaffoldProject } from './scaffolder.js';
import { bundleWebApplication } from './bundler.js';
import { launchLiveRunner } from './live-runner.js';
import { selfHealFile } from './self-healer.js';

/**
 * Checks if a natural language prompt is asking to build/create a game or web application.
 * If index.html does not exist in workspace, autonomously scaffolds the foundation
 * and starts the live-reload server before forwarding the enriched prompt to AI.
 *
 * @param {string} promptText
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<{
 *   triggered: boolean,
 *   domain?: string,
 *   filesCreated?: string[],
 *   runner?: { port: number, url: string, pid: number },
 *   directive?: string,
 *   reason?: string
 * }>}
 */
export async function detectScaffoldIntent(promptText = '', cwd = process.cwd()) {
  const clean = promptText.toLowerCase();

  // Creation verbs
  const hasCreateVerb = /\b(?:buat(?:kan)?|bikin|create|build|make|scaffold|generate|duplikat|clone)\b/i.test(clean);
  const domain = detectDomainFromPrompt(promptText);

  // If prompt is clearly asking to create a supported game/app domain
  const isRecognizedDomain = domain && domain !== 'general_web';
  const isGeneralWebCreate = domain === 'general_web' && hasCreateVerb && /\b(?:web|website|halaman|landing|app|aplikasi)\b/i.test(clean);

  if (!hasCreateVerb && !isRecognizedDomain) {
    return { triggered: false, reason: 'No creation intent' };
  }

  const indexPath = path.join(cwd, 'index.html');
  const indexExists = fs.existsSync(indexPath);

  // If index.html already exists, do not overwrite unless explicitly requested
  const isForceNew = /\b(?:dari\s+nol|from\s+scratch|overwrite|timpa|ulang|fresh)\b/i.test(clean);
  if (indexExists && !isForceNew) {
    return { triggered: false, domain, reason: 'index.html already exists' };
  }

  // Execute autonomous zero-token scaffolding
  const targetDomain = isRecognizedDomain ? domain : 'general_web';
  const scaffoldRes = scaffoldProject(targetDomain, cwd);

  let runner = null;
  try {
    runner = await launchLiveRunner(cwd);
  } catch (err) {
    // Non-fatal if port or headless env prevents launch
  }

  const directive = `[AUTONOMOUS ZERO-TOKEN FOUNDATION READY]\nGraviton has autonomously generated the complete runnable ${targetDomain} architecture in index.html (canvas, 60fps loop, controls, textures, audio). Do NOT generate the boilerplate or rewrite the whole file from scratch. Inspect index.html and directly implement the user's specific requested features: "${promptText}" into the existing codebase.`;

  return {
    triggered: true,
    domain: targetDomain,
    filesCreated: scaffoldRes.filesCreated || ['index.html'],
    runner,
    directive
  };
}

/**
 * Checks if a natural language prompt is requesting to bundle / export a multi-file
 * web application into a single standalone offline HTML file.
 *
 * @param {string} promptText
 * @param {string} [cwd=process.cwd()]
 * @returns {{
 *   handled: boolean,
 *   isBundleIntent: boolean,
 *   isPure: boolean,
 *   shouldBundlePostExecution: boolean,
 *   result?: object
 * }}
 */
export function detectBundleIntent(promptText = '', cwd = process.cwd()) {
  const clean = promptText.toLowerCase();

  // Pattern matching bundling or single-file export requests
  const isBundlePattern = /\b(?:bundle|satukan|gabungkan|export|jadikan|make|compile)\b.*?\b(?:(?:1|satu|single)\s+file|standalone|offline|bundle)\b/i.test(clean)
    || /\b(?:bundle|export)\s+(?:html|web|app)\b/i.test(clean)
    || /\b(?:jadikan|export|buat)\s+(?:standalone|offline)\s+html\b/i.test(clean);

  if (!isBundlePattern) {
    return { handled: false, isBundleIntent: false, isPure: false, shouldBundlePostExecution: false };
  }

  // Check if user is asking to modify code first before bundling
  const isEditingPrompt = /\b(?:tambah(?:kan)?|ubah|edit|ganti|perbaiki|fix|buatkan|create|add|update|modify)\b/i.test(clean);

  if (isEditingPrompt) {
    // Hybrid: Let AI perform the code edit first, then auto-bundle post-execution
    return {
      handled: false,
      isBundleIntent: true,
      isPure: false,
      shouldBundlePostExecution: true
    };
  }

  // Pure bundle request: Execute locally in 0ms without consuming AI tokens!
  const entryPath = fs.existsSync(path.join(cwd, 'index.html')) ? 'index.html' : null;
  if (!entryPath) {
    return {
      handled: false,
      isBundleIntent: true,
      isPure: true,
      shouldBundlePostExecution: false,
      error: 'No index.html found in workspace to bundle.'
    };
  }

  const bundleRes = bundleWebApplication(entryPath, null, cwd);
  return {
    handled: true,
    isBundleIntent: true,
    isPure: true,
    shouldBundlePostExecution: false,
    result: bundleRes
  };
}

/**
 * Checks if a natural language prompt is simply asking to play, test, or preview
 * the game or web project without code changes.
 *
 * @param {string} promptText
 * @param {string} [cwd=process.cwd()]
 * @returns {Promise<{ handled: boolean, runner?: object }>}
 */
export async function detectPlayIntent(promptText = '', cwd = process.cwd()) {
  const clean = promptText.trim().toLowerCase();

  const isPurePlay = /^(?:coba\s+)?(?:tolong\s+)?(?:play|mainkan|tes|test|preview)\s+(?:game(?:nya)?|web(?:nya)?|proyek(?:nya)?)$/i.test(clean)
    || /^(?:play|mainkan)$/i.test(clean);

  if (!isPurePlay) {
    return { handled: false };
  }

  const indexPath = path.join(cwd, 'index.html');
  if (!fs.existsSync(indexPath)) {
    scaffoldProject('voxel_minecraft', cwd);
  }

  const runner = await launchLiveRunner(cwd);
  return { handled: true, runner };
}

/**
 * Automatically inspects files in the workspace (or specifically touched files)
 * and runs selfHealFile to repair unclosed brackets, trailing commas, and ESM relative imports.
 *
 * @param {string} [cwd=process.cwd()]
 * @param {string[]} [specifiedFiles=[]]
 * @returns {{ filesHealedCount: number, healedFiles: Array<{ file: string, issues: string[] }> }}
 */
export function autoHealWorkspaceFiles(cwd = process.cwd(), specifiedFiles = []) {
  const candidates = [];

  if (specifiedFiles && specifiedFiles.length > 0) {
    for (const f of specifiedFiles) {
      const fullPath = path.isAbsolute(f) ? f : path.resolve(cwd, f);
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        candidates.push(fullPath);
      }
    }
  } else {
    // Scan recent code files in workspace (depth 2)
    const scanDir = (dir, depth = 0) => {
      if (depth > 2) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || ['node_modules', 'dist', 'build', 'coverage'].includes(entry.name)) {
            continue;
          }
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            scanDir(full, depth + 1);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (['.js', '.mjs', '.cjs', '.ts', '.json', '.html', '.css'].includes(ext)) {
              candidates.push(full);
            }
          }
        }
      } catch {}
    };
    scanDir(cwd, 0);
  }

  const healedFiles = [];

  for (const filePath of candidates) {
    try {
      const rawCode = fs.readFileSync(filePath, 'utf8');
      const relPath = path.relative(cwd, filePath).replace(/\\/g, '/');
      const healRes = selfHealFile(relPath, rawCode, cwd);

      if (healRes.wasHealed && healRes.healedCode !== rawCode) {
        fs.writeFileSync(filePath, healRes.healedCode, 'utf8');
        healedFiles.push({
          file: relPath,
          issues: healRes.issuesFixed
        });
      }
    } catch {}
  }

  return {
    filesHealedCount: healedFiles.length,
    healedFiles
  };
}
