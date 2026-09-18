#!/usr/bin/env node
// bin/grav-live-server.js - Graviton Live-Reload Dev Server Daemon Entrypoint
import path from 'path';
import { createLiveReloadServer } from '../src/live-runner.js';

const targetDir = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : process.cwd();
const port = parseInt(process.argv[3], 10) || 3000;

const server = createLiveReloadServer(targetDir, { port });
server.listen(port, () => {
  console.log(`[GRAVITON LIVE] Server active at http://localhost:${port}/ (Serving: ${targetDir})`);
});
