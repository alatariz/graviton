// src/progress-worker.js - Graviton V3.0.0 Live AI Progress Worker Thread
// Runs concurrently on a background OS thread during AI prompt processing.

import { parentPort } from 'worker_threads';

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let frameIdx = 0;
const startTime = Date.now();

// Clean 500ms heartbeat interval that does not overwhelm Windows CMD buffer
const interval = setInterval(() => {
  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
  const frame = frames[frameIdx++ % frames.length];
  process.stderr.write(`\r\x1b[36m${frame} [GRAVITON] AI reasoning & analyzing context... (${elapsedSec}s)\x1b[0m`);
}, 500);

if (parentPort) {
  parentPort.on('message', (msg) => {
    if (msg === 'stop') {
      clearInterval(interval);
      try {
        process.stderr.write('\r\x1b[K');
      } catch {}
      process.exit(0);
    }
  });
}
