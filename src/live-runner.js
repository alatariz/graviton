// src/live-runner.js - .0.0 Autonomous Live-Runner & Instant Browser Hot-Reload
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { findProcessOnPort, startBackgroundDaemon } from './port-guard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8'
};

const LIVE_RELOAD_SCRIPT = `
<!-- Graviton Live Reload -->
<script id="__grav_live_reload">
(function(){
  try {
    var es = new EventSource('/__grav_live');
    es.onmessage = function(e){
      if (e.data === 'reload') {
        console.log('[GRAVITON] Live file mutation detected. Reloading...');
        location.reload();
      }
    };
    es.onerror = function(){
      setTimeout(function(){ location.reload(); }, 2500);
    };
  } catch(e) {}
})();
</script>
`;

/**
 * Cross-platform browser launcher.
 * @param {string} url
 * @returns {boolean}
 */
export function openBrowser(url) {
  if (process.env.NODE_ENV === 'test' || process.env.CI || process.env.GRAVITON_NO_BROWSER) {
    return false;
  }
  try {
    if (process.platform === 'win32') {
      spawn('cmd.exe', ['/c', 'start', '""', url], { detached: true, stdio: 'ignore' }).unref();
    } else if (process.platform === 'darwin') {
      spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Finds an available TCP port starting from startPort.
 * @param {number} startPort
 * @returns {Promise<number>}
 */
export async function findAvailablePort(startPort = 3000) {
  for (let p = startPort; p < startPort + 50; p++) {
    const proc = findProcessOnPort(p);
    if (!proc) {
      // Confirm port can be bound
      const isFree = await new Promise((resolve) => {
        const tester = http.createServer();
        tester.once('error', () => resolve(false));
        tester.once('listening', () => {
          tester.close(() => resolve(true));
        });
        tester.listen(p);
      });
      if (isFree) return p;
    }
  }
  return startPort;
}

/**
 * Creates a standalone HTTP server with static file serving, SSE live-reload, and file watching.
 * @param {string} workspaceDir
 * @param {object} [options={}]
 * @returns {http.Server}
 */
export function createLiveReloadServer(workspaceDir, options = {}) {
  const rootDir = path.resolve(workspaceDir);
  const sseClients = new Set();
  let watchDebounceTimer = null;

  // Set up recursive file watcher for live-reload
  let watcher = null;
  try {
    watcher = fs.watch(rootDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      const cleanName = filename.replace(/\\/g, '/');
      if (
        cleanName.includes('.git/') ||
        cleanName.includes('node_modules/') ||
        cleanName.includes('.graviton') ||
        cleanName.endsWith('.tmp')
      ) {
        return;
      }

      if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
      watchDebounceTimer = setTimeout(() => {
        for (const client of sseClients) {
          try {
            client.write('data: reload\n\n');
          } catch {}
        }
      }, 150);
    });
  } catch {}

  const server = http.createServer((req, res) => {
    // 1. SSE Live Reload Stream Endpoint
    if (req.url === '/__grav_live') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });
      res.write(': graviton live-reload connected\n\n');
      sseClients.add(res);

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // 2. Static File Handler
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);
    if (pathname === '/') pathname = '/index.html';

    const safePath = path.normalize(path.join(rootDir, pathname));
    if (!safePath.startsWith(rootDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Access Denied');
      return;
    }

    if (!fs.existsSync(safePath) || fs.statSync(safePath).isDirectory()) {
      const fallbackIndex = path.join(rootDir, 'index.html');
      if (fs.existsSync(fallbackIndex)) {
        serveHtml(fallbackIndex, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end(`File not found: ${pathname}`);
      }
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    if (ext === '.html' || ext === '.htm') {
      serveHtml(safePath, res);
    } else {
      const mime = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(safePath).pipe(res);
    }
  });

  function serveHtml(filePath, res) {
    try {
      let html = fs.readFileSync(filePath, 'utf8');
      if (!html.includes('__grav_live_reload')) {
        if (html.includes('</body>')) {
          html = html.replace('</body>', `${LIVE_RELOAD_SCRIPT}\n</body>`);
        } else if (html.includes('</html>')) {
          html = html.replace('</html>', `${LIVE_RELOAD_SCRIPT}\n</html>`);
        } else {
          html += LIVE_RELOAD_SCRIPT;
        }
      }
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Error reading HTML: ${err.message}`);
    }
  }

  const originalClose = server.close.bind(server);
  server.close = function (cb) {
    if (watcher) {
      try { watcher.close(); } catch {}
    }
    for (const client of sseClients) {
      try { client.end(); } catch {}
    }
    sseClients.clear();
    return originalClose(cb);
  };

  return server;
}

/**
 * Launches the Live-Reload server as a background daemon and opens the default browser.
 * @param {string} workspaceDir
 * @param {object} [options={}]
 * @returns {Promise<{ port: number, pid: number, url: string, autoOpened: boolean }>}
 */
export async function launchLiveRunner(workspaceDir = process.cwd(), options = {}) {
  const rootDir = path.resolve(workspaceDir);
  const preferredPort = options.port || 3000;

  // Check if a process is already listening on preferredPort
  let activePort = preferredPort;
  const existingProc = findProcessOnPort(preferredPort);

  let daemonRecord = null;
  if (!existingProc) {
    activePort = await findAvailablePort(preferredPort);
    const serverScript = path.join(__dirname, '..', 'bin', 'grav-live-server.js');
    const cmd = `node "${serverScript}" "${rootDir}" ${activePort}`;
    daemonRecord = startBackgroundDaemon(cmd, rootDir);
  } else {
    daemonRecord = { pid: existingProc.pid, command: 'existing' };
  }

  const url = `http://localhost:${activePort}/`;
  let autoOpened = false;

  if (options.noBrowser !== true && options.openBrowser !== false) {
    autoOpened = openBrowser(url);
  }

  return {
    port: activePort,
    pid: daemonRecord.pid,
    url,
    autoOpened
  };
}
