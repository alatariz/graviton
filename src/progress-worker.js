// src/progress-worker.js - Graviton V3.0.0 Live AI Progress Worker Thread
// Runs concurrently on a background OS thread during AI prompt processing.

import { parentPort } from 'worker_threads';

const phases = [
  { minSec: 0, pct: 15, text: 'Preparing context & ingesting workspace...' },
  { minSec: 3, pct: 35, text: 'Reasoning & analyzing targeted files...' },
  { minSec: 8, pct: 60, text: 'Executing tools & synthesizing solution...' },
  { minSec: 17, pct: 80, text: 'Validating diffs & verifying syntax...' },
  { minSec: 29, pct: 95, text: 'Finalizing response & streaming completion...' }
];

const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
let frameIdx = 0;
const startTime = Date.now();

const interval = setInterval(() => {
  const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
  let currentPhase = phases[0];
  for (let i = phases.length - 1; i >= 0; i--) {
    if (elapsedSec >= phases[i].minSec) {
      currentPhase = phases[i];
      break;
    }
  }
  const frame = frames[frameIdx++ % frames.length];
  process.stderr.write(`\r\x1b[36m${frame} [AI Progress ${currentPhase.pct}%] ${currentPhase.text} (${elapsedSec}s)\x1b[0m`);
}, 120);

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
