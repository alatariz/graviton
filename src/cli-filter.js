// src/cli-filter.js - Graviton V3.4.0 Deterministic Terminal & Test Runner Squeezer
import { condenseTestOutput, condenseBuildOutput } from './stack-squeezer.js';

export function stripAnsi(str) {
  if (!str) return '';
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').replace(/\[[0-9;]+m/g, '');
}

export function filterGitStatus(raw) {
  const clean = stripAnsi(raw);
  const lines = clean.split('\n');
  const results = [];
  let branch = '';
  let ahead = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('On branch ')) {
      branch = trimmed.replace('On branch ', '');
    } else if (trimmed.includes('Your branch is ahead of')) {
      const match = trimmed.match(/by (\d+) commit/);
      if (match) ahead = ` ↑${match[1]}`;
    } else if (trimmed.startsWith('modified:')) {
      results.push(`  M ${trimmed.replace('modified:', '').trim()}`);
    } else if (trimmed.startsWith('deleted:')) {
      results.push(`  D ${trimmed.replace('deleted:', '').trim()}`);
    } else if (trimmed.startsWith('new file:')) {
      results.push(`  A ${trimmed.replace('new file:', '').trim()}`);
    } else if (trimmed.startsWith('renamed:')) {
      results.push(`  R ${trimmed.replace('renamed:', '').trim()}`);
    } else if (trimmed && !trimmed.startsWith('(') && !trimmed.startsWith('Changes ') && !trimmed.startsWith('Untracked files:') && !trimmed.startsWith('no changes added')) {
      if (!trimmed.includes('use "git')) {
        results.push(`  ? ${trimmed}`);
      }
    }
  }

  const header = `branch: ${branch || 'main'}${ahead}`;
  if (results.length === 0) {
    return `${header} · working tree clean`;
  }
  return `${header}\n${results.join('\n')}`;
}

export function filterTestOutput(raw) {
  return condenseTestOutput(raw);
}

export function filterBuildOutput(raw) {
  return condenseBuildOutput(raw);
}

export function filterCliOutput(command, rawOutput) {
  const cmd = (command || '').toLowerCase();
  if (cmd.includes('git status')) {
    return filterGitStatus(rawOutput);
  }
  if (cmd.includes('test')) {
    return filterTestOutput(rawOutput);
  }
  if (cmd.includes('build') || cmd.includes('tsc')) {
    return filterBuildOutput(rawOutput);
  }

  let cleaned = stripAnsi(rawOutput);
  // Handle carriage return spinners and progress bars
  cleaned = cleaned.replace(/\r/g, '\n');
  cleaned = cleaned.replace(/^[-\\|/]\s*.*$/gm, '');
  cleaned = cleaned.replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]\s*.*$/gm, '');
  cleaned = cleaned.replace(/\[[=>\s#-]{3,}\]\s*(?:\d{1,3}%|\d+\/\d+)?/g, '');
  cleaned = cleaned.replace(/(?:\d{1,3}%|\d+\/\d+)\s*\[[=>\s#-]{3,}\]/g, '');
  cleaned = cleaned.replace(/^npm\s+(?:http|verb|timing)\s+.*$/gm, '');

  const rawLines = cleaned.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0);
  
  // Stack frame compaction: collapse contiguous node_modules traces
  const lines = [];
  let nodeModulesCount = 0;

  for (const l of rawLines) {
    if (l.includes('node_modules') && l.trim().startsWith('at ')) {
      nodeModulesCount++;
      if (nodeModulesCount === 1) {
        lines.push('    ↳ [... internal node_modules call frames omitted ...]');
      }
    } else {
      nodeModulesCount = 0;
      lines.push(l);
    }
  }

  if (lines.length > 30) {
    return `${lines.slice(0, 10).join('\n')}\n   ↳ [... ${lines.length - 20} lines filtered by Graviton ...]\n${lines.slice(-10).join('\n')}`;
  }
  return lines.join('\n');
}
