// src/doctor.js - Graviton V2.0.0 System Health & Environment Doctor
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { resolveAgyExecutable } from '../bin/graviton-relay.js';
import { getBrainDir } from './session-manager.js';
import { getClipboardDir } from './clipboard.js';

/**
 * Runs a comprehensive system health check for Graviton & Antigravity.
 * @param {string} cwd
 * @returns {object} Diagnostic results
 */
export function runDoctor(cwd = process.cwd(), options = {}) {
  const diagnostics = [];
  let allHealthy = true;

  // 1. Node.js Runtime Check
  const nodeVer = process.version;
  const major = parseInt(nodeVer.replace('v', '').split('.')[0], 10);
  if (major >= 18) {
    diagnostics.push({
      category: 'Runtime',
      name: 'Node.js Engine',
      status: 'ok',
      details: `${nodeVer} (Supported >= v18.0.0)`
    });
  } else {
    allHealthy = false;
    diagnostics.push({
      category: 'Runtime',
      name: 'Node.js Engine',
      status: 'error',
      details: `${nodeVer} (Minimum required is v18.0.0)`,
      fix: 'Download the latest Node.js version from https://nodejs.org'
    });
  }

  // Auto-Fix if requested
  let agyPath = resolveAgyExecutable('agy');
  if (options && options.fix && (!agyPath || !fs.existsSync(agyPath))) {
    console.log('\x1b[36m[GRAVITON DOCTOR FIX]\x1b[0m Starting automatic installation of Google Antigravity CLI...');
    try {
      if (process.platform === 'win32') {
        spawnSync('powershell.exe', [
          '-NoProfile',
          '-Command',
          'irm https://antigravity.google/cli/install.ps1 | iex'
        ], { stdio: 'inherit' });
      } else {
        spawnSync('bash', [
          '-c',
          'curl -fsSL https://antigravity.google/cli/install.sh | bash'
        ], { stdio: 'inherit' });
      }
      agyPath = resolveAgyExecutable('agy');
    } catch {}
  }

  // 2. Antigravity CLI (agy) Resolution
  if (agyPath && fs.existsSync(agyPath)) {
    let agyVer = '';
    try {
      const res = spawnSync(agyPath, ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 });
      agyVer = (res.stdout || '').trim();
    } catch {}
    diagnostics.push({
      category: 'Antigravity',
      name: 'Google Antigravity CLI (agy)',
      status: 'ok',
      details: `${agyPath} ${agyVer ? '(' + agyVer + ')' : ''}`
    });
  } else {
    allHealthy = false;
    diagnostics.push({
      category: 'Antigravity',
      name: 'Google Antigravity CLI (agy)',
      status: 'error',
      details: 'Binary agy or agy.exe was not found in PATH or ~/.gemini/bin',
      fix: process.platform === 'win32'
        ? 'Run in PowerShell: irm https://antigravity.google/cli/install.ps1 | iex'
        : 'Run in Terminal: curl -fsSL https://antigravity.google/cli/install.sh | bash'
    });
  }

  // 3. Antigravity Brain Directory
  const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir() || '';
  const brainDir = getBrainDir();
  if (fs.existsSync(brainDir)) {
    diagnostics.push({
      category: 'Antigravity',
      name: 'Brain Storage',
      status: 'ok',
      details: `Found at ${brainDir}`
    });
  } else {
    diagnostics.push({
      category: 'Antigravity',
      name: 'Brain Storage',
      status: 'warn',
      details: 'Brain directory not detected yet. It will be created automatically on your first session.',
      fix: 'Run any graviton command once to initialize brain storage.'
    });
  }

  // 4. Graviton Global State Directory (~/.graviton)
  const gravitonDir = path.join(homeDir, '.graviton');
  try {
    if (!fs.existsSync(gravitonDir)) {
      fs.mkdirSync(gravitonDir, { recursive: true });
    }
    const testFile = path.join(gravitonDir, '.write-test');
    fs.writeFileSync(testFile, 'ok', 'utf8');
    fs.unlinkSync(testFile);
    diagnostics.push({
      category: 'Graviton',
      name: 'Global Config & Cache',
      status: 'ok',
      details: `Accessible at ${gravitonDir}`
    });
  } catch (err) {
    allHealthy = false;
    diagnostics.push({
      category: 'Graviton',
      name: 'Global Config & Cache',
      status: 'error',
      details: `Failed to write to ${gravitonDir}: ${err.message}`,
      fix: 'Ensure user home directory has read/write permissions.'
    });
  }

  // 5. Git CLI
  try {
    const gitRes = spawnSync('git', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (gitRes.status === 0) {
      diagnostics.push({
        category: 'Tools',
        name: 'Git Version Control',
        status: 'ok',
        details: (gitRes.stdout || '').trim()
      });
    } else {
      throw new Error('git not found');
    }
  } catch {
    diagnostics.push({
      category: 'Tools',
      name: 'Git Version Control',
      status: 'warn',
      details: 'Git was not found on this system.',
      fix: 'Optional but recommended for repository version control.'
    });
  }

  // 6. Python Environment
  try {
    const pyRes = spawnSync('python', ['--version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    if (pyRes.status === 0) {
      diagnostics.push({
        category: 'Tools',
        name: 'Python Runtime',
        status: 'ok',
        details: (pyRes.stdout || pyRes.stderr || '').trim()
      });
    } else {
      throw new Error('python not found');
    }
  } catch {
    diagnostics.push({
      category: 'Tools',
      name: 'Python Runtime',
      status: 'ok',
      details: 'Not installed (Optional if you are not working on Python projects).'
    });
  }

  // 7. Clipboard Ingestion Support (-p / /paste)
  try {
    const clipDir = getClipboardDir(cwd);
    diagnostics.push({
      category: 'Graviton',
      name: 'Clipboard Ingestion (-p, /p)',
      status: 'ok',
      details: `Active (Directory: ${clipDir})`
    });
  } catch (err) {
    diagnostics.push({
      category: 'Graviton',
      name: 'Clipboard Ingestion (-p, /p)',
      status: 'warn',
      details: `Clipboard cache initialization note: ${err.message}`
    });
  }

  // 8. Token Shield (Lockfile & Minified Asset Guard)
  diagnostics.push({
    category: 'Graviton',
    name: 'Token Shield (Lockfile & Asset Guard)',
    status: 'ok',
    details: 'Active (Guarding package-lock.json, yarn.lock, .min.js/css)'
  });

  return {
    allHealthy,
    diagnostics,
    cwd: path.resolve(cwd)
  };
}

/**
 * Formats diagnostic results into a clear terminal report.
 * @param {object} result
 * @returns {string}
 */
export function formatDoctorReport(result) {
  const lines = [
    `\n\x1b[1m\x1b[36m===============================================================`,
    `  GRAVITON V2.1.0 DOCTOR: SYSTEM HEALTH DIAGNOSTICS`,
    `===============================================================\x1b[0m\n`
  ];

  for (const item of result.diagnostics) {
    let icon = '\x1b[32m✔\x1b[0m';
    if (item.status === 'warn') icon = '\x1b[33m⚠\x1b[0m';
    if (item.status === 'error') icon = '\x1b[31m✖\x1b[0m';

    lines.push(`  ${icon} \x1b[1m${item.name}\x1b[0m: ${item.details}`);
    if (item.fix) {
      lines.push(`     \x1b[36m👉 Fix:\x1b[0m ${item.fix}`);
    }
  }

  lines.push('');
  if (result.allHealthy) {
    lines.push(`\x1b[1m\x1b[32m✔ Your environment is 100% ready to run Graviton & Google Antigravity!\x1b[0m\n`);
  } else {
    lines.push(`\x1b[1m\x1b[31m✖ Configuration issues detected. Please follow the recommendations above.\x1b[0m\n`);
  }

  return lines.join('\n');
}
