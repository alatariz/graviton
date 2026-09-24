// src/progress-indicator.js - .0.0 Live AI Progress Indicator Controller
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Spawns a background worker thread to render live AI progress indicators
 * with rotating spinner, stage percentages, and elapsed seconds.
 *
 * @param {object} options
 * @param {boolean} [options.enabled=true] - Whether progress indicator is active
 * @param {string} [options.stdio] - Stdio configuration
 * @returns {{ stop: () => void }} Controller to stop and clear indicator
 */
export function startAiProgressIndicator(options = {}) {
  // Only activate in interactive terminals where stderr is a TTY and stdio is not ignored
  const isInteractive = Boolean(process.stderr && process.stderr.isTTY);
  const isEnabled = options.enabled !== false && options.stdio !== 'ignore' && process.env.NODE_ENV !== 'test';

  if (!isInteractive || !isEnabled) {
    return {
      stop: () => {}
    };
  }

  let worker = null;
  const workerPath = path.join(__dirname, 'progress-worker.js');

  try {
    worker = new Worker(workerPath);
    worker.on('error', () => {
      // Gracefully silence any worker error to avoid crashing CLI
    });
  } catch {
    return {
      stop: () => {}
    };
  }

  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (worker) {
      try {
        worker.postMessage('stop');
        worker.terminate();
      } catch {}
      worker = null;
    }
    try {
      process.stderr.write('\r\x1b[K');
    } catch {}
  };

  // Ensure clean exit if interrupted
  const cleanExit = () => {
    stop();
  };
  process.once('SIGINT', cleanExit);
  process.once('SIGTERM', cleanExit);
  process.once('exit', cleanExit);

  return { stop };
}
