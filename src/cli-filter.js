// src/cli-filter.js - Graviton V2.0.0 Deterministic Terminal Output Filter

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
  const clean = stripAnsi(raw);
  const lines = clean.split('\n');
  const failures = [];
  let summary = '';
  let inFailure = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/FAIL|✕|ERR!|error:/i)) {
      inFailure = true;
      failures.push(line);
    } else if (inFailure) {
      if (trimmed.startsWith('at ') || trimmed.startsWith('-->') || trimmed.includes('Expected:') || trimmed.includes('Received:')) {
        failures.push('  ' + trimmed);
      } else if (trimmed === '' || trimmed.startsWith('PASS') || trimmed.startsWith('✓')) {
        inFailure = false;
      }
    }

    if (trimmed.match(/(?:Tests?:|test result:).*?(?:passed|failed)/i)) {
      summary = trimmed;
    }
  }

  if (failures.length > 0) {
    return `✖ Test Failures:\n${failures.slice(0, 25).join('\n')}\n\n${summary || 'Run tests with --verbose for full trace.'}`;
  }

  if (summary) {
    return `✓ ${summary}`;
  }

  return lines.filter(l => !l.includes('node_modules') && !l.includes('Debugger attached')).slice(0, 20).join('\n');
}

export function filterBuildOutput(raw) {
  const clean = stripAnsi(raw);
  const lines = clean.split('\n');
  const warnings = [];
  const errors = [];
  let summary = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/error\b|error\[E\d+\]/i)) {
      errors.push(trimmed);
    } else if (trimmed.match(/warning\b/i)) {
      warnings.push(trimmed);
    } else if (trimmed.match(/Finished|compiled successfully|built in/i)) {
      summary = trimmed;
    }
  }

  if (errors.length > 0) {
    return `✖ Build Failed:\n${errors.slice(0, 15).join('\n')}\n\n${warnings.length > 0 ? `(${warnings.length} warnings omitted)` : ''}`;
  }

  if (summary) {
    return `✓ ${summary} · ${warnings.length > 0 ? `${warnings.length} warnings` : '0 warnings'}`;
  }

  return clean.split('\n').filter(l => l.trim().length > 0).slice(-5).join('\n');
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
  cleaned = cleaned.replace(/^[-\\|/]\s*.*$/gm, '');
  cleaned = cleaned.replace(/\b(?:\d{1,3}%|\d+\/\d+)\s+\[[=>\s]+\]/g, '');
  
  const lines = cleaned.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0);
  if (lines.length > 30) {
    return `${lines.slice(0, 10).join('\n')}\n   ↳ [... ${lines.length - 20} lines filtered by Graviton ...]\n${lines.slice(-10).join('\n')}`;
  }
  return lines.join('\n');
}
