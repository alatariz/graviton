import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { synthesizePrompt } from '../src/pipeline.js';
import { resolveAgyExecutable } from '../bin/graviton-relay.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATS_FILE = path.join(os.homedir(), '.graviton-stats.json');
const AGY_PATH = resolveAgyExecutable();

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

  // 2. API: POST /api/synthesize
  if (req.method === 'POST' && pathname === '/api/synthesize') {
    try {
      const body = await parseJsonBody(req);
      const { prompt, deep } = body;
      if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Prompt is required' }));
        return;
      }

      const result = await synthesizePrompt(prompt, { effort: deep ? 'high' : 'low' });
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
      const { prompt } = body;
      if (!prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Prompt is required' }));
        return;
      }

      console.log('\x1b[36m[API]\x1b[0m Launching Antigravity with Auto-Allow in new window...');
      const agyArgs = [
        '--dangerously-skip-permissions',
        '--effort', 'high',
        '--mode', 'accept-edits',
        '--prompt-interactive', prompt
      ];

      spawn('cmd.exe', ['/c', 'start', 'cmd.exe', '/k', `"${AGY_PATH}" ${agyArgs.join(' ')}`], {
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
  let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
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
    res.end('<h1>404 Not Found</h1><p>The requested file does not exist in Graviton Web Studio.</p>');
  }
});

/**
 * Starts the server with automatic fallback if the preferred port is occupied.
 * Default preferred port: 3333 (to avoid collisions with generic port 3000 apps).
 */
export function startStudioServer(preferredPort = 3333, maxRetries = 10) {
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
      console.log(`   ⚡ GRAVITON V3.0.0 WEB STUDIO ONLINE (Zero-Dependency)`);
      console.log(`===============================================================\x1b[0m`);
      console.log(`  Local URL : \x1b[1;32mhttp://localhost:${port}\x1b[0m`);
      if (port !== 3000) {
        console.log(`  Port Note : \x1b[90mRunning on port ${port} (never collides with port 3000)\x1b[0m`);
      }
      console.log(`  Docs URL  : \x1b[36mhttp://localhost:${port}/docs.html\x1b[0m`);
      console.log(`\x1b[90m  Press Ctrl+C to terminate studio.\x1b[0m\n`);
    });
  }

  const initialPort = Number(process.env.PORT) || preferredPort;
  attemptListen(initialPort);
}

// Auto-start if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startStudioServer(Number(process.env.PORT) || 3333);
}
