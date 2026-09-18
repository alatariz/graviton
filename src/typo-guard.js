// src/typo-guard.js - Graviton V3.0.0 Smart Typo & Keyboard Slip Guard
// Intercepts accidental key slips (e.g. '=' adjacent to '-') and stray punctuation locally with 0 tokens.

/**
 * Inspects CLI arguments for common keyboard slips and typographical errors.
 * On standard QWERTY keyboards, '-' and '=' are physical neighbors.
 * Users frequently type '=h' instead of '-h', '=v' instead of '-v', etc.
 *
 * @param {string[]} rawArgs - Raw arguments passed to process.argv.slice(2)
 * @returns {{ args: string[], interceptedAction: string|null, notice: string|null, symbol?: string }}
 */
export function sanitizeArgsWithTypoGuard(rawArgs = []) {
  if (!rawArgs || rawArgs.length === 0) {
    return { args: rawArgs, interceptedAction: null, notice: null };
  }

  const first = (rawArgs[0] || '').trim();

  // 1. Single argument inspections
  if (rawArgs.length === 1) {
    // 1a. Help variations ('=h', '=help', '-help', 'hlep', 'halp', 'hepl', '?', '-?')
    if (/^={1,2}h(?:elp)?$/i.test(first) || /^-help$/i.test(first) || /^hlep$/i.test(first) || /^halp$/i.test(first) || /^hepl$/i.test(first) || /^(?:\?|-\?)$/.test(first)) {
      return {
        args: ['-h'],
        interceptedAction: 'help',
        notice: `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected ('=' is adjacent to '-'). Auto-correcting \x1b[1m'${first}'\x1b[0m to \x1b[32m'-h'\x1b[0m (Help)...`
      };
    }

    // 1b. Version variations ('=v', '==v', '=version', '-version', 'versin')
    if (/^={1,2}v(?:ersion)?$/i.test(first) || /^-version$/i.test(first) || /^versin$/i.test(first)) {
      return {
        args: ['-v'],
        interceptedAction: 'version',
        notice: `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected ('=' is adjacent to '-'). Auto-correcting \x1b[1m'${first}'\x1b[0m to \x1b[32m'-v'\x1b[0m (Version)...`
      };
    }

    // 1c. Doctor variations ('=doc', '=doctor', 'doktor', 'doctro')
    if (/^={1,2}doc(?:tor)?$/i.test(first) || /^doktor$/i.test(first) || /^doctro$/i.test(first)) {
      return {
        args: ['doc'],
        interceptedAction: 'doctor',
        notice: `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected. Auto-correcting \x1b[1m'${first}'\x1b[0m to \x1b[32m'doc'\x1b[0m (Doctor)...`
      };
    }

    // 1d. Stats variations ('=stats', '=gain')
    if (/^={1,2}(?:stats?|gain)$/i.test(first)) {
      return {
        args: ['stats'],
        interceptedAction: 'stats',
        notice: `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected. Auto-correcting \x1b[1m'${first}'\x1b[0m to \x1b[32m'stats'\x1b[0m...`
      };
    }

    // 1e. Web Studio variations ('=web', '=studio', '=ui')
    if (/^={1,2}(?:web|studio|ui)$/i.test(first)) {
      return {
        args: ['web'],
        interceptedAction: 'web',
        notice: `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected. Auto-correcting \x1b[1m'${first}'\x1b[0m to \x1b[32m'web'\x1b[0m...`
      };
    }

    // 1f. Diff variations ('=diff')
    if (/^={1,2}diff$/i.test(first)) {
      return {
        args: ['diff'],
        interceptedAction: 'diff',
        notice: `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected. Auto-correcting \x1b[1m'${first}'\x1b[0m to \x1b[32m'diff'\x1b[0m...`
      };
    }

    // 1g. Compact variations ('=compact', '=cmp')
    if (/^={1,2}(?:compact|cmp)$/i.test(first)) {
      return {
        args: ['compact'],
        interceptedAction: 'compact',
        notice: `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected. Auto-correcting \x1b[1m'${first}'\x1b[0m to \x1b[32m'compact'\x1b[0m...`
      };
    }

    // 1h. Undo / Rollback variations ('=undo', '=rollback', '=rb')
    if (/^={1,2}(?:undo|rollback|rb)$/i.test(first)) {
      return {
        args: ['undo'],
        interceptedAction: 'undo',
        notice: `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected. Auto-correcting \x1b[1m'${first}'\x1b[0m to \x1b[32m'undo'\x1b[0m...`
      };
    }

    // 1i. Stray Punctuation / Symbol Slip (e.g. '=', '==', '+', '/', '\', ';', etc.)
    // Matches 1 to 4 punctuation characters with NO alphanumeric characters
    if (/^[=+\\/;~`!@#$%^&*()<>.,?:|\\-]{1,4}$/.test(first)) {
      return {
        args: [],
        interceptedAction: 'stray_symbol',
        symbol: first,
        notice: `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Stray input symbol detected (\x1b[1m'${first}'\x1b[0m). No prompt provided.\n   \x1b[90m(Tip: run 'grav -h' for help & options)\x1b[0m`
      };
    }
  }

  // 2. Multi-argument flags correction (e.g. 'grav =f "prompt"', 'grav =d "prompt"')
  const modifiedArgs = [...rawArgs];
  let correctedNotice = null;

  if (/^={1,2}f(?:ast)?$/i.test(first)) {
    modifiedArgs[0] = '-f';
    correctedNotice = `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected ('=' is adjacent to '-'). Correcting flag \x1b[1m'${first}'\x1b[0m to \x1b[32m'-f'\x1b[0m...`;
  } else if (/^={1,2}d(?:eep)?$/i.test(first)) {
    modifiedArgs[0] = '-d';
    correctedNotice = `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected ('=' is adjacent to '-'). Correcting flag \x1b[1m'${first}'\x1b[0m to \x1b[32m'-d'\x1b[0m...`;
  } else if (/^={1,2}p(?:aste)?$/i.test(first)) {
    modifiedArgs[0] = '-p';
    correctedNotice = `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected ('=' is adjacent to '-'). Correcting flag \x1b[1m'${first}'\x1b[0m to \x1b[32m'-p'\x1b[0m...`;
  } else if (/^={1,2}c(?:onversation)?$/i.test(first)) {
    modifiedArgs[0] = '-c';
    correctedNotice = `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected ('=' is adjacent to '-'). Correcting flag \x1b[1m'${first}'\x1b[0m to \x1b[32m'-c'\x1b[0m...`;
  } else if (/^={1,2}n(?:ew)?$/i.test(first)) {
    modifiedArgs[0] = '-n';
    correctedNotice = `\x1b[33m[GRAVITON TYPO GUARD]\x1b[0m Keyboard slip detected ('=' is adjacent to '-'). Correcting flag \x1b[1m'${first}'\x1b[0m to \x1b[32m'-n'\x1b[0m...`;
  }

  return {
    args: modifiedArgs,
    interceptedAction: null,
    notice: correctedNotice
  };
}
