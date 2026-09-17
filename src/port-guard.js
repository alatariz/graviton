// src/port-guard.js - Graviton V2.0.0 Background Daemon & Port Guard
import { execSync, spawn, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Graviton V2.0.0 Port Guard & Daemon Manager
 * Detects and frees blocked ports, manages background dev server processes,
 * and ensures no orphan zombie servers leak on Windows or Unix.
 */

export function getDaemonsFilePath() {
  const gravitonDir = path.join(os.homedir(), '.graviton');
  if (!fs.existsSync(gravitonDir)) {
    fs.mkdirSync(gravitonDir, { recursive: true });
  }
  return path.join(gravitonDir, 'daemons.json');
}

/**
 * Finds the listening process ID (PID) on a given TCP port.
 * @param {number|string} port
 * @returns {{ port: number, pid: number }|null}
 */
export function findProcessOnPort(port) {
  const p = parseInt(port, 10);
  if (isNaN(p) || p <= 0 || p > 65535) return null;

  const isWindows = process.platform === 'win32';

  if (isWindows) {
    try {
      const output = execSync(`netstat -ano -p tcp`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const lines = output.split(/\r?\n/);
      for (const line of lines) {
        const trimmed = line.trim();
        // Look for TCP [local address]:port ... LISTENING [pid]
        if (trimmed.includes(`:${p} `) && trimmed.includes('LISTENING')) {
          const parts = trimmed.split(/\s+/);
          const pidStr = parts[parts.length - 1];
          const pid = parseInt(pidStr, 10);
          if (!isNaN(pid) && pid > 0) {
            return { port: p, pid };
          }
        }
      }
    } catch {}
  } else {
    try {
      const output = execSync(`lsof -ti :${p}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const firstPid = output.split(/\s+/)[0];
      const pid = parseInt(firstPid, 10);
      if (!isNaN(pid) && pid > 0) {
        return { port: p, pid };
      }
    } catch {}

    try {
      // Fallback using fuser (common on Linux)
      const output = execSync(`fuser ${p}/tcp 2>/dev/null`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const firstPid = output.split(/\s+/)[0];
      const pid = parseInt(firstPid, 10);
      if (!isNaN(pid) && pid > 0) {
        return { port: p, pid };
      }
    } catch {}

    try {
      // Fallback using ss (iproute2 on Linux)
      const output = execSync(`ss -lptn 'sport = :${p}' 2>/dev/null`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const m = output.match(/pid=(\d+)/);
      if (m && m[1]) {
        return { port: p, pid: parseInt(m[1], 10) };
      }
    } catch {}
  }

  return null;
}


/**
 * Forcefully terminates a process and all its children (Tree Kill).
 * @param {number} pid
 * @returns {boolean} True if successfully killed
 */
export function killProcessTree(pid) {
  if (!pid || pid <= 0) return false;
  const isWindows = process.platform === 'win32';

  try {
    if (isWindows) {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 -${pid} 2>/dev/null || kill -9 ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    // Process might already be terminated
    return false;
  }
}

/**
 * Kills any process currently listening on the specified port.
 * @param {number|string} port
 * @returns {{ port: number, freed: boolean, pid?: number, error?: string }}
 */
export function killProcessOnPort(port) {
  const p = parseInt(port, 10);
  const found = findProcessOnPort(p);

  if (!found) {
    return { port: p, freed: true, message: `Port ${p} is already free.` };
  }

  killProcessTree(found.pid);

  // Synchronous verification loop (handles Windows socket teardown delay)
  for (let attempt = 0; attempt < 3; attempt++) {
    const stillFound = findProcessOnPort(p);
    if (!stillFound) {
      return { port: p, freed: true, pid: found.pid, message: `Freed port ${p} (terminated PID ${found.pid}).` };
    }
    killProcessTree(stillFound.pid);
    try {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    } catch {}
  }

  const finalFound = findProcessOnPort(p);
  if (!finalFound) {
    return { port: p, freed: true, pid: found.pid, message: `Freed port ${p} (terminated PID ${found.pid}).` };
  }

  return { port: p, freed: false, pid: found.pid, error: `Could not terminate PID ${found.pid} on port ${p}.` };
}

/**
 * Scans common local development ports and reports listening processes.
 * @param {number[]} commonPorts
 * @returns {Array<{ port: number, pid: number }>}
 */
export function listActivePorts(commonPorts = [3000, 3001, 4200, 5173, 8000, 8080, 8081]) {
  const active = [];
  for (const port of commonPorts) {
    const found = findProcessOnPort(port);
    if (found) {
      active.push(found);
    }
  }
  return active;
}

/**
 * Spawns a long-running dev command as a detached background daemon.
 * Returns immediately to keep the terminal responsive.
 * @param {string} commandString
 * @param {string} cwd
 * @returns {{ pid: number, command: string, cwd: string }}
 */
export function startBackgroundDaemon(commandString, cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);
  let childPid = null;

  // On Windows, use PowerShell Start-Process with -WindowStyle Hidden via Base64 -EncodedCommand
  // to guarantee 100% immune argument escaping (no quote, backtick, or $ variable mangling)
  if (process.platform === 'win32') {
    try {
      const b64Cmd = Buffer.from(commandString, 'utf8').toString('base64');
      const b64Cwd = Buffer.from(normalizedCwd, 'utf8').toString('base64');
      const psScript = `$cmd = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${b64Cmd}")); $dir = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String("${b64Cwd}")); Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", $cmd) -WorkingDirectory $dir -WindowStyle Hidden -PassThru | Select-Object -ExpandProperty Id`;
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');

      const res = spawnSync('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-WindowStyle', 'Hidden',
        '-EncodedCommand',
        encoded
      ], { encoding: 'utf8', windowsHide: true });

      const parsedPid = parseInt((res.stdout || '').trim(), 10);
      if (!isNaN(parsedPid) && parsedPid > 0) {
        childPid = parsedPid;
      }
    } catch {}
  }

  // Fallback for Unix or if Windows Start-Process was not used
  if (!childPid) {
    const child = spawn(commandString, [], {
      cwd: normalizedCwd,
      shell: true,
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    child.unref();
    childPid = child.pid;
  }

  const daemonRecord = {
    success: Boolean(childPid),
    pid: childPid,
    command: commandString,
    cwd: normalizedCwd,
    startedAt: Date.now()
  };

  try {
    const daemonsFile = getDaemonsFilePath();
    let daemons = [];
    if (fs.existsSync(daemonsFile)) {
      try {
        daemons = JSON.parse(fs.readFileSync(daemonsFile, 'utf8'));
      } catch {
        daemons = [];
      }
    }
    daemons.push(daemonRecord);
    fs.writeFileSync(daemonsFile, JSON.stringify(daemons, null, 2), 'utf8');
  } catch {}

  return daemonRecord;
}

/**
 * Stops background daemons or frees a given port.
 * @param {string|number} target - Port number, PID, or 'all'
 * @param {string} cwd - Current workspace
 * @returns {Array<{ target: string|number, status: string }>}
 */
export function stopDaemonOrPort(target, cwd = process.cwd()) {
  const results = [];
  const normalizedCwd = path.resolve(cwd);
  const daemonsFile = getDaemonsFilePath();
  let daemons = [];

  if (fs.existsSync(daemonsFile)) {
    try {
      daemons = JSON.parse(fs.readFileSync(daemonsFile, 'utf8'));
    } catch {
      daemons = [];
    }
  }

  const targetNum = parseInt(target, 10);

  // Check if target is a registered daemon PID
  const isMatchingPid = !isNaN(targetNum) && daemons.some(d => d.pid === targetNum);

  if (isMatchingPid) {
    const remaining = [];
    for (const d of daemons) {
      if (d.pid === targetNum) {
        killProcessTree(d.pid);
        results.push({ target: d.pid, status: 'stopped', command: d.command });
      } else {
        remaining.push(d);
      }
    }
    try {
      fs.writeFileSync(daemonsFile, JSON.stringify(remaining, null, 2), 'utf8');
    } catch {}
    return results;
  }

  // If a numeric port is given (1-65535)
  if (!isNaN(targetNum) && targetNum > 0 && targetNum <= 65535) {
    const res = killProcessOnPort(targetNum);
    results.push({ target: targetNum, status: res.freed ? 'freed' : 'failed', message: res.message || res.error });
    return results;
  }

  // Otherwise stop daemons registered in daemons.json for workspace or all
  const remaining = [];
  for (const d of daemons) {
    if (!target || target === 'all' || d.cwd === normalizedCwd) {
      killProcessTree(d.pid);
      results.push({ target: d.pid, status: 'stopped', command: d.command });
    } else {
      remaining.push(d);
    }
  }

  try {
    fs.writeFileSync(daemonsFile, JSON.stringify(remaining, null, 2), 'utf8');
  } catch {}

  return results;
}

/**
 * Analyzes workspace files to auto-detect dev server run commands and listening ports.
 * @param {string} cwd
 * @returns {{ command: string|null, port: number, type: string, exists: boolean, hasIndexHtml?: boolean }}
 */
export function detectWorkspaceDevServer(cwd = process.cwd()) {
  const normalizedCwd = path.resolve(cwd);

  // 1. Check package.json
  const pkgPath = path.join(normalizedCwd, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const scripts = pkg.scripts || {};
      const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      if (scripts.dev) {
        let port = 3000;
        let type = 'npm-dev';
        if (allDeps.vite || scripts.dev.includes('vite')) {
          port = 5173;
          type = 'vite';
        } else if (allDeps.next || scripts.dev.includes('next')) {
          port = 3000;
          type = 'next';
        } else if (allDeps.astro || scripts.dev.includes('astro')) {
          port = 4321;
          type = 'astro';
        }
        return { command: 'npm run dev', port, type, exists: true };
      }

      if (scripts.start) {
        return { command: 'npm start', port: 3000, type: 'npm-start', exists: true };
      }
    } catch {}
  }

  // 2. Check server.js / app.js
  for (const serverFileName of ['server.js', 'app.js']) {
    const sPath = path.join(normalizedCwd, serverFileName);
    if (fs.existsSync(sPath)) {
      try {
        const content = fs.readFileSync(sPath, 'utf8');
        if (/http\.createServer|express\(|koa\(|fastify\(/i.test(content) || /\.listen\(/i.test(content)) {
          let port = 3000;
          const portMatch = content.match(/PORT\s*=\s*(?:process\.env\.PORT\s*\|\|\s*)?(\d{4,5})/i)
            || content.match(/\.listen\(\s*(?:PORT\s*,\s*|process\.env\.PORT\s*\|\|\s*)?(\d{4,5})/i);
          if (portMatch && portMatch[1]) {
            const parsed = parseInt(portMatch[1], 10);
            if (!isNaN(parsed) && parsed > 0) port = parsed;
          }
          return { command: `node ${serverFileName}`, port, type: 'node-server', exists: true };
        }
      } catch {}
    }
  }

  // 3. Check Python app.py / main.py
  for (const pyFile of ['app.py', 'main.py']) {
    const pyPath = path.join(normalizedCwd, pyFile);
    if (fs.existsSync(pyPath)) {
      try {
        const content = fs.readFileSync(pyPath, 'utf8');
        if (/Flask|FastAPI|uvicorn|django/i.test(content)) {
          const port = /uvicorn/i.test(content) ? 8000 : 5000;
          return { command: `python ${pyFile}`, port, type: 'python-server', exists: true };
        }
      } catch {}
    }
  }

  // 4. Check index.html (Static Web)
  const indexPath = path.join(normalizedCwd, 'index.html');
  if (fs.existsSync(indexPath)) {
    return { command: 'node server.js', port: 3000, type: 'static-html', exists: false, hasIndexHtml: true };
  }

  return { command: null, port: 3000, type: 'none', exists: false };
}

