// src/doctor.js - Graviton V2.0.0 System Health & Environment Doctor
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { resolveAgyExecutable } from '../bin/graviton-relay.js';

/**
 * Runs a comprehensive system health check for Graviton & Antigravity.
 * @param {string} cwd
 * @returns {object} Diagnostic results
 */
export function runDoctor(cwd = process.cwd()) {
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
      fix: 'Unduh versi Node.js terbaru dari https://nodejs.org'
    });
  }

  // 2. Antigravity CLI (agy) Resolution
  const agyPath = resolveAgyExecutable('agy');
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
      details: 'Binary agy atau agy.exe tidak ditemukan di PATH atau ~/.gemini/bin',
      fix: process.platform === 'win32'
        ? 'Jalankan di PowerShell: irm https://antigravity.google/cli/install.ps1 | iex'
        : 'Jalankan di Terminal: curl -fsSL https://antigravity.google/cli/install.sh | bash'
    });
  }

  // 3. Antigravity Brain Directory
  const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir() || '';
  const brainDir = path.join(homeDir, '.gemini', 'antigravity', 'brain');
  if (fs.existsSync(brainDir)) {
    diagnostics.push({
      category: 'Antigravity',
      name: 'Brain Storage',
      status: 'ok',
      details: `Ditemukan di ${brainDir}`
    });
  } else {
    diagnostics.push({
      category: 'Antigravity',
      name: 'Brain Storage',
      status: 'warn',
      details: 'Direktori brain belum terdeteksi. Akan otomatis dibuat saat sesi pertama dijalankan.',
      fix: 'Jalankan perintah graviton sekali untuk menginisialisasi brain.'
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
      details: `Dapat diakses di ${gravitonDir}`
    });
  } catch (err) {
    allHealthy = false;
    diagnostics.push({
      category: 'Graviton',
      name: 'Global Config & Cache',
      status: 'error',
      details: `Gagal menulis ke ${gravitonDir}: ${err.message}`,
      fix: 'Pastikan folder user memiliki izin read/write.'
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
      details: 'Git tidak ditemukan di sistem ini.',
      fix: 'Opsional tapi direkomendasikan untuk pelacakan versi kode.'
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
      details: 'Tidak terpasang (Opsional jika Anda tidak mengerjakan project Python).'
    });
  }

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
    `  GRAVITON V2.0.0 DOCTOR: SYSTEM HEALTH DIAGNOSTICS`,
    `===============================================================\x1b[0m\n`
  ];

  for (const item of result.diagnostics) {
    let icon = '\x1b[32m✔\x1b[0m';
    if (item.status === 'warn') icon = '\x1b[33m⚠\x1b[0m';
    if (item.status === 'error') icon = '\x1b[31m✖\x1b[0m';

    lines.push(`  ${icon} \x1b[1m${item.name}\x1b[0m: ${item.details}`);
    if (item.fix) {
      lines.push(`     \x1b[36m👉 Solusi:\x1b[0m ${item.fix}`);
    }
  }

  lines.push('');
  if (result.allHealthy) {
    lines.push(`\x1b[1m\x1b[32m✔ Sistem Anda 100% siap menjalankan Graviton & Google Antigravity!\x1b[0m\n`);
  } else {
    lines.push(`\x1b[1m\x1b[31m✖ Ditemukan kendala konfigurasi. Silakan ikuti solusi di atas.\x1b[0m\n`);
  }

  return lines.join('\n');
}
