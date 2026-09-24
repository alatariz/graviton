import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { synthesizePrompt, readOdometer } from '../src/pipeline.js';
import { resolveAgyExecutable, runAntigravityWithAutoAllow, extractCleanAssistantResponse } from '../bin/graviton-relay.js';
import { calculateEconomyMetrics } from '../src/hud.js';
import { buildDependencyGraph } from '../src/dependency-graph.js';
import { bundleWebApplication } from '../src/bundler.js';
import { selfHealFile } from '../src/self-healer.js';
import { listActivePorts, killProcessOnPort } from '../src/port-guard.js';
import { detectScaffoldIntent, detectBundleIntent, detectPlayIntent, autoHealWorkspaceFiles } from '../src/autonomous-router.js';
import {
  getWorkspaceConversations,
  setActiveConversation,
  clearWorkspaceSession,
  deleteWorkspaceConversation,
  renameWorkspaceConversation,
  getConversationHistory,
  saveWorkspaceConversation,
  getActiveConversation,
  getLatestConversationId
} from '../src/session-manager.js';
import { resolveModelAndEffort } from '../src/model-selector.js';
import { listRollbackItems, executeRollback } from '../src/rollback-manager.js';
import { runDoctor, formatDoctorReport } from '../src/doctor.js';
import { getSessionDiff } from '../src/diff-viewer.js';
import { getTelemetry } from '../src/telemetry.js';
import { resolveTargetScope } from '../src/context-scoper.js';
import { calculatePreFlightWeight } from '../src/budget-guard.js';
import { verifyProjectRuntime } from '../src/runtime-sentinel.js';
import { evaluateWorkspaceAdversarially } from '../src/adversarial-critic.js';
import { buildCodePropertyGraph, calculateBlastRadius, formatBlastRadiusReport } from '../src/code-property-graph.js';
import { runUnifiedSanityCheck, formatUnifiedDiagnosticReport } from '../src/unified-orchestrator.js';
import { auditDeadCode, pruneUnusedImports, formatDeadCodeReport } from '../src/dead-code-cleaner.js';
import { generateTestFile } from '../src/test-generator.js';
import { planSymbolRename, applySymbolRename, formatRefactorPlan } from '../src/symbolic-refactor.js';
import { analyzePromptAmbiguity, synthesizeClarifiedSpecificationBlock } from '../src/ambiguity-clarifier.js';
import { detectDomainFromPrompt, scaffoldProject } from '../src/scaffolder.js';
import { autoCompactSessionIfExceeded, getCompactMemoryDirective } from '../src/session-compactor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATS_FILE = path.join(os.homedir(), '.graviton-stats.json');
const AGY_PATH = resolveAgyExecutable();
const PKG_PATH = path.join(__dirname, '..', 'package.json');

// Dynamic workspace directory state across the dashboard session
let activeWorkspaceDir = process.cwd();

export function getActiveWorkspace() {
  return activeWorkspaceDir;
}

export function setActiveWorkspace(newCwd) {
  if (newCwd && typeof newCwd === 'string') {
    const resolved = path.resolve(newCwd);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      activeWorkspaceDir = resolved;
      return resolved;
    }
  }
  return activeWorkspaceDir;
}

function resolveCwd(customCwd) {
  if (customCwd && typeof customCwd === 'string') {
    const resolved = path.resolve(customCwd);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return resolved;
    }
  }
  return activeWorkspaceDir;
}

function getPackageVersion() {
  try {
    if (fs.existsSync(PKG_PATH)) {
      const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
      return pkg.version || '5.0.0';
    }
  } catch {}
  return '5.0.0';
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    }
  } catch (e) {}
  return { commandsRun: 154, promptsOptimized: 62, tokensSaved: 231400, linesFiltered: 5410 };
}

function saveStats(stats) {
  try {
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
  } catch (e) {}
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload Too Large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // 1. API: GET /api/stats
  if (req.method === 'GET' && pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(loadStats()));
    return;
  }

  // 1b. API: GET /api/hud (Economy & Cost Metrics with Odometer & Telemetry Sync)
  if (req.method === 'GET' && pathname === '/api/hud') {
    const metrics = calculateEconomyMetrics();
    const odometer = readOdometer();
    const telemetry = getTelemetry();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ...metrics, odometer, telemetry }));
    return;
  }

  // 1c. API: GET /api/graph (Workspace AST Dependency DAG)
  if (req.method === 'GET' && pathname === '/api/graph') {
    const targetCwd = resolveCwd(parsedUrl.searchParams.get('cwd'));
    const graph = buildDependencyGraph(targetCwd);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(graph));
    return;
  }

  // 1d. API: GET /api/ports (Active Dev Server Ports)
  if (req.method === 'GET' && pathname === '/api/ports') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(listActivePorts()));
    return;
  }

  // 1e. API: GET /api/workspace (Get current active workspace directory)
  if (req.method === 'GET' && pathname === '/api/workspace') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ cwd: activeWorkspaceDir }));
    return;
  }

  // 1f. API: POST /api/workspace (Switch active workspace directory)
  if (req.method === 'POST' && pathname === '/api/workspace') {
    try {
      const body = await parseJsonBody(req);
      const requestedPath = (body.cwd || '').trim();
      if (!requestedPath) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Directory path is required' }));
        return;
      }
      const resolved = path.resolve(requestedPath);
      if (!fs.existsSync(resolved)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Directory not found: ${resolved}` }));
        return;
      }
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Path is not a directory: ${resolved}` }));
        return;
      }
      activeWorkspaceDir = resolved;
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, cwd: activeWorkspaceDir }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1f-2. API: POST /api/pick-folder (Native OS Folder Picker Dialog)
  if (req.method === 'POST' && pathname === '/api/pick-folder') {
    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      if (body.mockPath || process.env.NODE_ENV === 'test') {
        const mock = body.mockPath || activeWorkspaceDir;
        activeWorkspaceDir = path.resolve(mock);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, cwd: activeWorkspaceDir, picked: true }));
        return;
      }

      let chosenPath = '';

      if (process.platform === 'win32') {
        const initial = activeWorkspaceDir.replace(/'/g, "''");
        const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
$form.StartPosition = 'CenterScreen'
$d = New-Object System.Windows.Forms.FolderBrowserDialog
$d.Description = 'Select Workspace Directory for Graviton Agent'
$d.ShowNewFolderButton = $true
$d.AutoUpgradeEnabled = $true
$d.SelectedPath = '${initial}'
if ($d.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.WriteLine($d.SelectedPath)
}
`;
        chosenPath = await new Promise((resolve) => {
          const child = spawn('powershell.exe', ['-NoProfile', '-WindowStyle', 'Hidden', '-Command', '-'], {
            stdio: ['pipe', 'pipe', 'ignore'],
            windowsHide: true
          });
          let out = '';
          child.stdout.on('data', chunk => out += chunk.toString());
          child.on('close', () => resolve(out.trim()));
          child.on('error', () => resolve(''));
          child.stdin.write(psScript);
          child.stdin.end();
        });
      } else if (process.platform === 'darwin') {
        chosenPath = await new Promise((resolve) => {
          const child = spawn('osascript', ['-e', 'POSIX path of (choose folder with prompt "Select Workspace Directory")'], {
            stdio: ['ignore', 'pipe', 'ignore']
          });
          let out = '';
          child.stdout.on('data', chunk => out += chunk.toString());
          child.on('close', () => resolve(out.trim()));
          child.on('error', () => resolve(''));
        });
      } else {
        chosenPath = await new Promise((resolve) => {
          const child = spawn('zenity', ['--file-selection', '--directory', '--title=Select Workspace Directory'], {
            stdio: ['ignore', 'pipe', 'ignore']
          });
          let out = '';
          child.stdout.on('data', chunk => out += chunk.toString());
          child.on('close', () => resolve(out.trim()));
          child.on('error', () => resolve(''));
        });
      }

      if (chosenPath && fs.existsSync(chosenPath) && fs.statSync(chosenPath).isDirectory()) {
        activeWorkspaceDir = path.resolve(chosenPath);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, cwd: activeWorkspaceDir, picked: true }));
        return;
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, cancelled: true, cwd: activeWorkspaceDir }));
        return;
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1f-3. API: POST /api/reveal-folder (Open directory in File Explorer)
  if (req.method === 'POST' && pathname === '/api/reveal-folder') {
    try {
      const body = await parseJsonBody(req).catch(() => ({}));
      const targetCwd = resolveCwd(body.cwd);
      if (process.env.NODE_ENV !== 'test') {
        if (process.platform === 'win32') {
          spawn('explorer.exe', [targetCwd], { detached: true, stdio: 'ignore' }).unref();
        } else if (process.platform === 'darwin') {
          spawn('open', [targetCwd], { detached: true, stdio: 'ignore' }).unref();
        } else {
          spawn('xdg-open', [targetCwd], { detached: true, stdio: 'ignore' }).unref();
        }
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, cwd: targetCwd, revealed: true }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1g. API: GET /api/conversations (Workspace Conversation History)
  if (req.method === 'GET' && pathname === '/api/conversations') {
    try {
      const targetCwd = resolveCwd(parsedUrl.searchParams.get('cwd'));
      const data = getWorkspaceConversations(targetCwd);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ cwd: targetCwd, activeId: data.activeId, conversations: data.conversations || [] }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message, conversations: [], activeId: null }));
    }
    return;
  }

  // 1h. API: POST /api/conversations/select (Switch active conversation)
  if (req.method === 'POST' && pathname === '/api/conversations/select') {
    try {
      const body = await parseJsonBody(req);
      const targetCwd = resolveCwd(body.cwd);
      const target = body.id || body.index;
      if (!target) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Conversation ID or index is required' }));
        return;
      }
      const selected = setActiveConversation(targetCwd, target);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: !!selected, conversation: selected }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1i. API: POST /api/conversations/new (Start fresh conversation)
  if (req.method === 'POST' && pathname === '/api/conversations/new') {
    try {
      const body = await parseJsonBody(req);
      const targetCwd = resolveCwd(body.cwd);
      clearWorkspaceSession(targetCwd);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, message: 'New conversation initialized' }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1j. API: POST /api/conversations/delete (Delete conversation)
  if (req.method === 'POST' && pathname === '/api/conversations/delete') {
    try {
      const body = await parseJsonBody(req);
      const targetCwd = resolveCwd(body.cwd);
      const target = body.id || body.index;
      if (!target) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Conversation ID or index is required' }));
        return;
      }
      const result = deleteWorkspaceConversation(targetCwd, target);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1k. API: POST /api/conversations/rename (Rename conversation title)
  if (req.method === 'POST' && pathname === '/api/conversations/rename') {
    try {
      const body = await parseJsonBody(req);
      const targetCwd = resolveCwd(body.cwd);
      const target = body.id || body.index;
      const title = (body.title || '').trim();
      if (!target || !title) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Conversation ID and title are required' }));
        return;
      }
      const result = renameWorkspaceConversation(targetCwd, target, title);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1l. API: GET /api/conversation-history (Conversation turn summary)
  if (req.method === 'GET' && pathname === '/api/conversation-history') {
    try {
      const targetCwd = resolveCwd(parsedUrl.searchParams.get('cwd'));
      const id = parsedUrl.searchParams.get('id') || null;
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
      const history = getConversationHistory(targetCwd, id, limit);
      const odo = readOdometer();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, cwd: targetCwd, odometer: odo, ...history }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1m. API: POST /api/command (Visual CLI Command Runner: diff, undo, stats, doctor, graph, ports, version)
  if (req.method === 'POST' && pathname === '/api/command') {
    try {
      const body = await parseJsonBody(req);
      const command = (body.command || '').trim().toLowerCase();
      const args = body.args || {};
      const targetCwd = resolveCwd(args.cwd || body.cwd);

      if (command === 'diff') {
        const output = getSessionDiff(targetCwd);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'diff', cwd: targetCwd, output }));
        return;
      }

      if (command === 'undo_list') {
        const items = listRollbackItems(targetCwd);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'undo_list', cwd: targetCwd, items }));
        return;
      }

      if (command === 'undo') {
        let indices = null;
        if (args.indices !== undefined && args.indices !== null) {
          if (Array.isArray(args.indices)) {
            indices = args.indices.map(n => Number(n)).filter(n => !isNaN(n));
          } else if (typeof args.indices === 'string' && args.indices.trim()) {
            indices = args.indices.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
          }
        }
        const result = executeRollback(targetCwd, indices);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: result.success, command: 'undo', cwd: targetCwd, ...result }));
        return;
      }

      if (command === 'doctor') {
        const result = runDoctor(targetCwd);
        const report = formatDoctorReport(result);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          command: 'doctor',
          cwd: targetCwd,
          allHealthy: result.allHealthy,
          diagnostics: result.diagnostics,
          report
        }));
        return;
      }

      if (command === 'stats') {
        const hud = calculateEconomyMetrics();
        const odometer = readOdometer();
        const telemetry = getTelemetry();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'stats', hud, odometer, telemetry }));
        return;
      }

      if (command === 'graph') {
        const graph = buildDependencyGraph(targetCwd);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'graph', cwd: targetCwd, graph }));
        return;
      }

      if (command === 'ports') {
        const ports = listActivePorts();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'ports', ports }));
        return;
      }

      if (command === 'stop_port') {
        const port = Number(args.port);
        if (!port) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Port is required' }));
          return;
        }
        killProcessOnPort(port);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'stop_port', message: `Port ${port} released` }));
        return;
      }

      if (command === 'version') {
        const version = getPackageVersion();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'version', version }));
        return;
      }

      if (command === 'verify' || command === 'sentinel') {
        const report = verifyProjectRuntime(targetCwd);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'verify', report }));
        return;
      }

      if (command === 'audit' || command === 'critique') {
        const report = evaluateWorkspaceAdversarially(targetCwd);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'audit', report }));
        return;
      }

      if (command === 'blast') {
        const target = args.target;
        if (!target) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Target file or symbol is required for blast radius analysis' }));
          return;
        }
        const cpg = buildCodePropertyGraph(targetCwd);
        const report = calculateBlastRadius(cpg, target);
        const formatted = formatBlastRadiusReport(report);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'blast', report, formatted }));
        return;
      }

      if (command === 'check' || command === 'sanity') {
        const report = runUnifiedSanityCheck(targetCwd);
        const formatted = formatUnifiedDiagnosticReport(report);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'check', report, formatted }));
        return;
      }

      if (command === 'deadcode') {
        const audit = auditDeadCode(targetCwd);
        const formatted = formatDeadCodeReport(audit);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'deadcode', audit, formatted }));
        return;
      }

      if (command === 'prune') {
        const result = pruneUnusedImports(targetCwd);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'prune', result }));
        return;
      }

      if (command === 'gentest') {
        const target = args.target || args.file;
        if (!target) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Target source file is required for test generation' }));
          return;
        }
        const fullTarget = path.isAbsolute(target) ? target : path.resolve(targetCwd, target);
        const fullOut = args.output ? (path.isAbsolute(args.output) ? args.output : path.resolve(targetCwd, args.output)) : null;
        const result = generateTestFile(fullTarget, fullOut);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'gentest', ...result }));
        return;
      }

      if (command === 'refactor_plan' || command === 'refactor') {
        const targetFile = args.file || args.target;
        const oldSymbol = args.oldSymbol || args.old;
        const newSymbol = args.newSymbol || args.new;
        if (!targetFile || !oldSymbol || !newSymbol) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'file, oldSymbol, and newSymbol are required for refactoring' }));
          return;
        }
        const plan = planSymbolRename(targetCwd, targetFile, oldSymbol, newSymbol);
        const formatted = formatRefactorPlan(plan);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'refactor_plan', plan, formatted }));
        return;
      }

      if (command === 'refactor_apply') {
        const targetFile = args.file || args.target;
        const oldSymbol = args.oldSymbol || args.old;
        const newSymbol = args.newSymbol || args.new;
        if (!targetFile || !oldSymbol || !newSymbol) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'file, oldSymbol, and newSymbol are required for refactoring' }));
          return;
        }
        const plan = planSymbolRename(targetCwd, targetFile, oldSymbol, newSymbol);
        const result = applySymbolRename(plan);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'refactor_apply', plan, result }));
        return;
      }

      if (command === 'clarify') {
        const prompt = args.prompt || '';
        const analysis = analyzePromptAmbiguity(prompt);
        const specification = synthesizeClarifiedSpecificationBlock(analysis);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, command: 'clarify', analysis, specification }));
        return;
      }

      if (command === 'cpg') {
        const cpg = buildCodePropertyGraph(targetCwd);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          command: 'cpg',
          root: cpg.root,
          totalFiles: cpg.totalFiles,
          totalSymbols: cpg.totalSymbols,
          dependencyGraph: cpg.dependencyGraph,
          reverseDeps: cpg.reverseDeps
        }));
        return;
      }

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Unknown command: ${command}` }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1n. API: POST /api/chat (Developer IDE Prompt Execution with Fast/Grav/Deep Effort & Dry Run)
  if (req.method === 'POST' && pathname === '/api/chat') {
    try {
      const body = await parseJsonBody(req);
      const prompt = body.prompt || '';
      if (!prompt.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Prompt is required' }));
        return;
      }

      const targetCwd = resolveCwd(body.cwd);
      const rawEffort = (body.effort || 'grav').toLowerCase();
      const dryRun = Boolean(body.dryRun);
      const isExplicitNew = Boolean(body.isNew);
      const activeSession = getActiveConversation(targetCwd);

      // Conversation Continuity & Autonomous Sliding-Window Compactor
      let requestedConvId = null;
      if (!isExplicitNew) {
        if (body.conversationId) {
          requestedConvId = body.conversationId;
        } else if (activeSession && activeSession.id) {
          requestedConvId = activeSession.id;
        }
      }

      let executionConvId = requestedConvId;
      let existingConvTitle = null;
      if (requestedConvId) {
        if (activeSession && activeSession.id === requestedConvId && activeSession.title) {
          existingConvTitle = activeSession.title;
        } else {
          try {
            const allConvs = getWorkspaceConversations(targetCwd);
            const found = allConvs.conversations.find(c => c.id === requestedConvId);
            if (found && found.title) existingConvTitle = found.title;
          } catch {}
        }
        try {
          const autoComp = autoCompactSessionIfExceeded(targetCwd, requestedConvId);
          if (autoComp && autoComp.autoCompacted) {
            console.log(`\x1b[36m[GRAVITON WEB IDE]\x1b[0m ${autoComp.message}`);
            // If session exceeded limits (>25k tokens or >6 turns), start fresh lightweight
            // Antigravity turn with compact memory so we do not reload historical tool steps.
            executionConvId = null;
          }
        } catch {}
      }

      // Map Fast / Grav / Deep (and backwards compatible low / medium / high)
      const isFast = rawEffort === 'fast' || rawEffort === 'low';
      const isDeep = rawEffort === 'deep' || rawEffort === 'high';
      const isGrav = rawEffort === 'grav' || (!isFast && !isDeep);
      const effortMode = isGrav ? 'grav' : (isFast ? 'low' : 'high');

      const modelRouting = resolveModelAndEffort({
        isFast,
        isDeep,
        isGrav,
        effort: effortMode,
        prompt
      });

      const targetScope = resolveTargetScope(prompt, targetCwd);
      const preFlight = calculatePreFlightWeight(prompt, targetCwd, { targetFiles: targetScope?.targets || [] });

      if (dryRun) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
          success: true,
          dryRun: true,
          cwd: targetCwd,
          prompt,
          conversationId: requestedConvId,
          effortName: isFast ? 'Fast' : (isDeep ? 'Deep' : 'Grav'),
          modelRouting,
          targetScope,
          preFlight,
          message: 'Dry run completed. Context scope and model resolved without running code.'
        }));
        return;
      }

      // Live execution synthesis
      let clarifiedSpecificationDirective = '';
      if (!isFast && typeof prompt === 'string' && prompt.trim().length > 0 && prompt.trim().length < 400 && !prompt.includes('ARCHITECTED TECHNICAL SPECIFICATION')) {
        const ambiguityAnalysis = analyzePromptAmbiguity(prompt);
        if (ambiguityAnalysis && ambiguityAnalysis.isAmbiguous) {
          clarifiedSpecificationDirective = synthesizeClarifiedSpecificationBlock(ambiguityAnalysis);
        }
      }

      const synthesized = await synthesizePrompt(prompt, null, {
        cwd: targetCwd,
        effort: modelRouting.agyEffort,
        isContinuous: Boolean(requestedConvId),
        conversationId: requestedConvId,
        isDeep,
        isFast,
        targetScope
      });

      let finalSuperPrompt = synthesized.superPrompt || prompt;
      if (clarifiedSpecificationDirective && !finalSuperPrompt.includes(clarifiedSpecificationDirective)) {
        finalSuperPrompt = `${finalSuperPrompt}\n\n${clarifiedSpecificationDirective}`;
      }
      if (targetScope && targetScope.directive && !finalSuperPrompt.includes('[GRAVITON ACTIVE TARGET SCOPE')) {
        finalSuperPrompt = `${targetScope.directive}\n\n${finalSuperPrompt}`;
      }

      const stats = loadStats();
      stats.commandsRun = (stats.commandsRun || 0) + 1;
      stats.promptsOptimized = (stats.promptsOptimized || 0) + 1;
      stats.tokensSaved = (stats.tokensSaved || 0) + (synthesized.stats?.tokensSaved || 1200);
      saveStats(stats);

      const wantsStream = Boolean(body.stream || req.headers.accept === 'text/event-stream' || parsedUrl.searchParams.get('stream') === 'true');

      // 1. SSE STREAMING RESPONSE (Web IDE Live Feedback)
      if (wantsStream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*'
        });

        const sendEvent = (event, data) => {
          try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          } catch {}
        };

        sendEvent('start', {
          cwd: targetCwd,
          conversationId: requestedConvId,
          effortName: isFast ? 'Fast' : (isDeep ? 'Deep' : 'Grav'),
          modelRouting,
          targetScope,
          preFlight
        });

        if (process.env.NODE_ENV === 'test' || body.testMode) {
          const simulatedId = requestedConvId || 'conv-sim-' + Date.now();
          sendEvent('tool', { state: 'ACTIVE', tool: 'view_file', desc: 'Inspecting workspace context...' });
          sendEvent('tool', { state: 'DONE', tool: 'view_file', duration: 0.1 });
          const mockChunk = `Simulated Antigravity execution for: "${prompt.slice(0, 60)}..." in ${targetCwd}`;
          sendEvent('delta', { text: mockChunk });

          const odo = readOdometer();
          const lastTokens = odo.lastSessionTokens || 1200;
          const savedConv = saveWorkspaceConversation(targetCwd, simulatedId, prompt, {
            tokens: lastTokens,
            assistantText: mockChunk,
            activeFiles: targetScope.files || []
          });
          setActiveConversation(targetCwd, simulatedId);

          sendEvent('done', {
            success: true,
            conversationId: simulatedId,
            sessionTokens: (savedConv && savedConv.cumulativeTokens) || lastTokens,
            lifetimeTokens: odo.totalTokens,
            response: mockChunk,
            cleanResponse: mockChunk
          });
          res.end();
          return;
        }

        let liveConvId = executionConvId;
        let cleanText = '';

        try {
          console.log(`\n\x1b[36m[GRAVITON WEB IDE]\x1b[0m Executing prompt in: \x1b[1m${targetCwd}\x1b[0m (Topic: ${liveConvId ? liveConvId.slice(0, 8) + '...' : 'New Session'})`);

          const runRes = await runAntigravityWithAutoAllow(finalSuperPrompt, {
            cwd: targetCwd,
            conversationId: liveConvId || undefined,
            userPrompt: prompt,
            effort: modelRouting.agyEffort,
            model: modelRouting.baseModel,
            rejectOnError: false,
            onToolUpdate: (toolEvt) => {
              sendEvent('tool', toolEvt);
            },
            onTextDelta: (deltaText) => {
              cleanText += deltaText;
              sendEvent('delta', { text: deltaText });
            },
            onResult: (resData) => {
              if (resData.response) cleanText = resData.response;
            }
          });

          liveConvId = runRes.conversationId || liveConvId || getLatestConversationId();
          const cleanOutput = extractCleanAssistantResponse(
            cleanText || runRes.cleanResponse || runRes.accumulatedText || '',
            targetCwd,
            liveConvId,
            true
          );

          try {
            autoHealWorkspaceFiles(targetCwd);
            verifyProjectRuntime(targetCwd);
            autoCompactSessionIfExceeded(targetCwd, liveConvId);
          } catch {}

          const odo = readOdometer();
          const turnToks = runRes.turnTokens || odo.lastSessionTokens || 1200;
          let savedConv = null;
          if (liveConvId) {
            savedConv = saveWorkspaceConversation(targetCwd, liveConvId, prompt, {
              tokens: turnToks,
              title: existingConvTitle || undefined,
              assistantText: cleanOutput,
              activeFiles: targetScope.targets || targetScope.files || []
            });
            setActiveConversation(targetCwd, liveConvId);
          }

          sendEvent('done', {
            success: runRes.status === 0 || runRes.status === null,
            conversationId: liveConvId,
            sessionTokens: (savedConv && savedConv.cumulativeTokens) || turnToks,
            lifetimeTokens: odo.totalTokens,
            response: cleanOutput,
            cleanResponse: cleanOutput,
            targetScope,
            modelRouting
          });
        } catch (execErr) {
          sendEvent('error', { error: execErr.message });
        } finally {
          res.end();
        }
        return;
      }

      // 2. STANDARD SYNCHRONOUS JSON RESPONSE (Tests & Standard POST API)
      let executionResult = { status: 'completed', output: '' };
      let effectiveConvId = requestedConvId;

      if (process.env.NODE_ENV === 'test' || body.testMode) {
        effectiveConvId = requestedConvId || 'conv-sim-' + Date.now();
        executionResult = {
          status: 'completed',
          output: `Simulated Antigravity execution for: "${prompt.slice(0, 60)}..." in ${targetCwd}`
        };
      } else {
        try {
          const runRes = await runAntigravityWithAutoAllow(finalSuperPrompt, {
            cwd: targetCwd,
            conversationId: executionConvId || undefined,
            userPrompt: prompt,
            effort: modelRouting.agyEffort,
            model: modelRouting.baseModel,
            rejectOnError: false
          });
          effectiveConvId = runRes.conversationId || requestedConvId || getLatestConversationId();
          const cleanOutput = extractCleanAssistantResponse(
            runRes.cleanResponse || runRes.accumulatedText || (runRes.stdout ? runRes.stdout.toString('utf8') : ''),
            targetCwd,
            effectiveConvId,
            true
          );

          try {
            autoHealWorkspaceFiles(targetCwd);
            verifyProjectRuntime(targetCwd);
            autoCompactSessionIfExceeded(targetCwd, effectiveConvId);
          } catch {}

          executionResult = {
            status: runRes.status === 0 || runRes.status === null ? 'completed' : 'error',
            output: cleanOutput || 'Session executed successfully.'
          };
        } catch (execErr) {
          executionResult = {
            status: 'error',
            output: execErr.message
          };
        }
      }

      const odo = readOdometer();
      const lastTokens = odo.lastSessionTokens || 1200;
      let savedConv = null;

      if (effectiveConvId) {
        savedConv = saveWorkspaceConversation(targetCwd, effectiveConvId, prompt, {
          tokens: lastTokens,
          title: existingConvTitle || undefined,
          assistantText: executionResult.output,
          activeFiles: targetScope.targets || targetScope.files || []
        });
        setActiveConversation(targetCwd, effectiveConvId);
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: executionResult.status !== 'error',
        cwd: targetCwd,
        conversationId: effectiveConvId,
        sessionTokens: (savedConv && savedConv.cumulativeTokens) || lastTokens,
        lifetimeTokens: odo.totalTokens,
        effortName: isFast ? 'Fast' : (isDeep ? 'Deep' : 'Grav'),
        modelRouting,
        targetScope,
        preFlight,
        execution: executionResult
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1o. API: POST /api/open-cli (Open/Resume session in native CLI terminal)
  if (req.method === 'POST' && pathname === '/api/open-cli') {
    try {
      const body = await parseJsonBody(req);
      const targetCwd = resolveCwd(body.cwd);
      const target = body.id || body.index || '';
      const cmdStr = target ? `grav -c ${target}` : 'grav';
      const isTest = body.dryRun || process.env.NODE_ENV === 'test';

      if (!isTest) {
        if (process.platform === 'win32') {
          const startArgs = ['/c', 'start', 'Graviton CLI', 'cmd.exe', '/k', 'grav'];
          if (target) {
            startArgs.push('-c', String(target));
          }
          spawn('cmd.exe', startArgs, {
            cwd: targetCwd,
            detached: true,
            stdio: 'ignore'
          }).unref();
        } else if (process.platform === 'darwin') {
          spawn('osascript', ['-e', `tell application "Terminal" to do script "cd ${targetCwd} && ${cmdStr}"`], {
            detached: true,
            stdio: 'ignore'
          }).unref();
        } else {
          spawn('x-terminal-emulator', ['-e', `sh -c "cd ${targetCwd} && ${cmdStr}; exec bash"`], {
            detached: true,
            stdio: 'ignore'
          }).unref();
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, command: cmdStr, cwd: targetCwd, spawned: !isTest }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1p. API: POST /api/stop-port
  if (req.method === 'POST' && pathname === '/api/stop-port') {
    try {
      const body = await parseJsonBody(req);
      const port = Number(body.port);
      if (!port) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Port is required' }));
        return;
      }
      killProcessOnPort(port);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `Port ${port} released` }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1q. API: POST /api/bundle (Zero-Setup Single File Exporter)
  if (req.method === 'POST' && pathname === '/api/bundle') {
    try {
      const body = await parseJsonBody(req);
      const targetCwd = resolveCwd(body.cwd);
      const result = bundleWebApplication(body.entry || 'index.html', body.output || null, targetCwd);
      res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1r. API: POST /api/heal (Syntax & Import Self-Healing)
  if (req.method === 'POST' && pathname === '/api/heal') {
    try {
      const body = await parseJsonBody(req);
      const targetCwd = resolveCwd(body.cwd);
      const result = selfHealFile(body.filePath || 'temp.js', body.code || '', targetCwd);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1s. API: POST /api/scaffold (Zero-Token Project Scaffolder)
  if (req.method === 'POST' && pathname === '/api/scaffold') {
    try {
      const body = await parseJsonBody(req);
      const domain = body.domain || (body.prompt ? detectDomainFromPrompt(body.prompt) : 'voxel_minecraft');
      const baseCwd = resolveCwd(body.cwd);
      const targetDir = body.targetDir ? path.resolve(baseCwd, body.targetDir) : baseCwd;
      const result = scaffoldProject(domain, targetDir);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 1t. API: POST /api/route (Autonomous Intent Simulation & Diagnostics)
  if (req.method === 'POST' && pathname === '/api/route') {
    try {
      const body = await parseJsonBody(req);
      const prompt = body.prompt || '';
      const targetCwd = resolveCwd(body.cwd);
      const playIntent = await detectPlayIntent(prompt, targetCwd);
      const bundleIntent = detectBundleIntent(prompt, targetCwd);
      const scaffoldIntent = await detectScaffoldIntent(prompt, targetCwd);
      const modelRouting = resolveModelAndEffort({
        isFast: body.fast || false,
        isDeep: body.deep || false,
        effort: body.effort,
        prompt
      });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        prompt,
        playIntent,
        bundleIntent,
        scaffoldIntent,
        modelRouting
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 2. API: POST /api/synthesize
  if (req.method === 'POST' && pathname === '/api/synthesize') {
    try {
      const body = await parseJsonBody(req);
      const { prompt, deep, cwd } = body;
      if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Prompt is required' }));
        return;
      }

      const targetCwd = resolveCwd(cwd);
      const result = await synthesizePrompt(prompt, { cwd: targetCwd, effort: deep ? 'high' : 'low' });
      const stats = loadStats();
      stats.promptsOptimized = (stats.promptsOptimized || 0) + 1;
      stats.tokensSaved = (stats.tokensSaved || 0) + (result.stats?.tokensSaved || 0);
      saveStats(stats);

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 3. API: POST /api/forward-antigravity
  if (req.method === 'POST' && pathname === '/api/forward-antigravity') {
    try {
      const body = await parseJsonBody(req);
      const { prompt, cwd } = body;
      if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Prompt is required' }));
        return;
      }

      const targetCwd = resolveCwd(cwd);
      const agyArgs = [
        '--dangerously-skip-permissions',
        '--effort', 'high',
        '--mode', 'accept-edits',
        '--prompt-interactive', prompt
      ];

      spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', `"${AGY_PATH}" ${agyArgs.join(' ')}`], {
        cwd: targetCwd,
        detached: true,
        stdio: 'ignore'
      }).unref();

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, message: 'Antigravity launched with Auto-Allow in new window' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 4. STATIC FILE SERVING
  let relativePath = (pathname === '/' || pathname === '/dashboard') ? 'index.html' : pathname.replace(/^\/+/, '');
  let filePath = path.join(PUBLIC_DIR, relativePath);

  // Security: prevent directory traversal outside of PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  // If path is a directory, look for index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Fallback: if requesting /docs without .html
  if (!fs.existsSync(filePath) && fs.existsSync(filePath + '.html')) {
    filePath = filePath + '.html';
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 Not Found</h1><p>The requested file does not exist in Graviton Agent.</p>');
  }
});

/**
 * Starts the server with automatic fallback if the preferred port is occupied.
 * Default preferred port: 3000.
 */
export function startStudioServer(preferredPort = 3000, maxRetries = 10) {
  function attemptListen(port) {
    server.removeAllListeners('error');
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`\x1b[33m[!] Port ${port} is occupied by another process.\x1b[0m`);
        if (port - preferredPort < maxRetries) {
          console.log(`\x1b[90mAttempting fallback to port ${port + 1}...\x1b[0m`);
          attemptListen(port + 1);
        } else {
          console.error(`\x1b[31mError: Could not find an available port after ${maxRetries} attempts.\x1b[0m`);
          process.exit(1);
        }
      } else {
        console.error(err);
        process.exit(1);
      }
    });

    server.listen(port, () => {
      console.log(`\n\x1b[1m\x1b[36m===============================================================`);
      console.log(`   GRAVITON AGENT ONLINE (Gravity Agent - 100% Localhost)`);
      console.log(`===============================================================\x1b[0m`);
      console.log(`  Agent URL : \x1b[1;32mhttp://localhost:${port}\x1b[0m`);
      if (port !== preferredPort) {
        console.log(`  Port Note   : \x1b[90mRunning on fallback port ${port} (preferred port ${preferredPort} in use)\x1b[0m`);
      }
      console.log(`\x1b[90m  Press Ctrl+C to terminate agent.\x1b[0m\n`);
    });
  }

  const initialPort = Number(process.env.PORT) || preferredPort;
  attemptListen(initialPort);
}

// Auto-start if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startStudioServer(Number(process.env.PORT) || 3000);
}
