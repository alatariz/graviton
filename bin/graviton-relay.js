// bin/graviton-relay.js - Runs agy with --dangerously-skip-permissions
import { spawn } from 'child_process';
import path from 'path';

const agyPath = 'C:\\Users\\WINDOWS\\.gemini\\bin\\agy.exe';

export function runAntigravityWithAutoAllow(promptText, options = {}) {
  const args = [
    '--dangerously-skip-permissions',
    '--effort', options.effort || 'high',
    '--mode', options.mode || 'accept-edits'
  ];

  if (options.continueSession) {
    args.push('--continue');
  }

  // Use interactive or print mode
  if (options.printOnly) {
    args.push('--print', promptText);
  } else {
    args.push('--prompt-interactive', promptText);
  }

  console.log(`\x1b[35m[GRAVITON ➔ ANTIGRAVITY RELAY]\x1b[0m Auto-Allow Active (--dangerously-skip-permissions)`);

  const child = spawn(agyPath, args, {
    stdio: 'inherit',
    shell: true
  });

  return child;
}
