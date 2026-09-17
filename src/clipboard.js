// src/clipboard.js - Graviton V2.1.0 Native Clipboard Ingestion Engine
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

/**
 * Returns the workspace clipboard cache directory.
 * @param {string} cwd
 * @returns {string}
 */
export function getClipboardDir(cwd = process.cwd()) {
  const dir = path.join(path.resolve(cwd), '.graviton', 'clipboard');
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {}
  }
  return dir;
}

/**
 * Captures clipboard contents using OS-native utilities (Zero External Dependencies).
 * Supports images (PNG screenshots), copied files, and text snippets.
 * @param {string} cwd
 * @returns {{ type: 'image'|'files'|'text'|'empty'|'error', path?: string, relPath?: string, files?: string[], text?: string, error?: string }}
 */
export function captureClipboard(cwd = process.cwd()) {
  const resolvedCwd = path.resolve(cwd);
  const clipDir = getClipboardDir(resolvedCwd);
  const destImg = path.join(clipDir, 'clipboard.png');

  try {
    if (process.platform === 'win32') {
      return captureWindowsClipboard(destImg, resolvedCwd);
    } else if (process.platform === 'darwin') {
      return captureMacClipboard(destImg, resolvedCwd);
    } else {
      return captureLinuxClipboard(destImg, resolvedCwd);
    }
  } catch (err) {
    return { type: 'error', error: err.message || String(err) };
  }
}

/**
 * Windows native clipboard capture using PowerShell STA and System.Windows.Forms.
 */
function captureWindowsClipboard(destImg, cwd) {
  const escapedDest = destImg.replace(/'/g, "''");
  const psScript = `
Add-Type -AssemblyName System.Windows.Forms,System.Drawing;
try {
  if ([System.Windows.Forms.Clipboard]::ContainsImage()) {
    $img = [System.Windows.Forms.Clipboard]::GetImage();
    if ($img -ne $null) {
      $img.Save('${escapedDest}', [System.Drawing.Imaging.ImageFormat]::Png);
      $img.Dispose();
      Write-Output "TYPE:IMAGE|${escapedDest}";
      exit 0;
    }
  }
  if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) {
    $files = [System.Windows.Forms.Clipboard]::GetFileDropList();
    if ($files.Count -gt 0) {
      Write-Output "TYPE:FILES|$($files -join '|')";
      exit 0;
    }
  }
  if ([System.Windows.Forms.Clipboard]::ContainsText()) {
    $text = [System.Windows.Forms.Clipboard]::GetText();
    if (-not [string]::IsNullOrWhiteSpace($text)) {
      Write-Output "TYPE:TEXT|$text";
      exit 0;
    }
  }
  Write-Output "TYPE:EMPTY";
} catch {
  Write-Output "TYPE:ERROR|$($_.Exception.Message)";
}
`.trim();

  const res = spawnSync('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-Sta',
    '-Command',
    psScript
  ], { encoding: 'utf8', timeout: 6000 });

  if (res.error) {
    return { type: 'error', error: res.error.message };
  }

  const rawOut = (res.stdout || '').trim();
  return parseClipboardOutput(rawOut, destImg, cwd);
}

/**
 * macOS native clipboard capture using osascript and pbpaste.
 */
function captureMacClipboard(destImg, cwd) {
  const osaScript = `
try
  set theClipboard to the clipboard as «class PNGf»
  set theFile to open for access POSIX file "${destImg}" with write permission
  set eof theFile to 0
  write theClipboard to theFile
  close access theFile
  return "TYPE:IMAGE|${destImg}"
on error
  return "TRY_TEXT"
end try
`;
  const res = spawnSync('osascript', ['-e', osaScript], { encoding: 'utf8', timeout: 4000 });
  const raw = (res.stdout || '').trim();

  if (raw.startsWith('TYPE:IMAGE') && fs.existsSync(destImg)) {
    return {
      type: 'image',
      path: destImg,
      relPath: path.relative(cwd, destImg).replace(/\\/g, '/')
    };
  }

  // Fallback to text via pbpaste
  try {
    const textRes = spawnSync('pbpaste', [], { encoding: 'utf8', timeout: 2000 });
    const text = (textRes.stdout || '').trim();
    if (text) {
      return { type: 'text', text };
    }
  } catch {}

  return { type: 'empty' };
}

/**
 * Linux native clipboard capture using xclip or wl-paste.
 */
function captureLinuxClipboard(destImg, cwd) {
  // Check Wayland wl-paste first
  try {
    const wlCheck = spawnSync('which', ['wl-paste'], { encoding: 'utf8' });
    if (wlCheck.status === 0) {
      const imgRes = spawnSync('wl-paste', ['--type', 'image/png'], { timeout: 3000 });
      if (imgRes.status === 0 && imgRes.stdout && imgRes.stdout.length > 0) {
        fs.writeFileSync(destImg, imgRes.stdout);
        return {
          type: 'image',
          path: destImg,
          relPath: path.relative(cwd, destImg).replace(/\\/g, '/')
        };
      }
      const txtRes = spawnSync('wl-paste', ['--type', 'text/plain'], { encoding: 'utf8', timeout: 2000 });
      const txt = (txtRes.stdout || '').trim();
      if (txt) return { type: 'text', text: txt };
    }
  } catch {}

  // Check X11 xclip
  try {
    const targetsRes = spawnSync('xclip', ['-selection', 'clipboard', '-t', 'TARGETS', '-o'], { encoding: 'utf8', timeout: 2000 });
    const targets = (targetsRes.stdout || '');
    if (targets.includes('image/png')) {
      const imgRes = spawnSync('xclip', ['-selection', 'clipboard', '-t', 'image/png', '-o'], { timeout: 3000 });
      if (imgRes.status === 0 && imgRes.stdout && imgRes.stdout.length > 0) {
        fs.writeFileSync(destImg, imgRes.stdout);
        return {
          type: 'image',
          path: destImg,
          relPath: path.relative(cwd, destImg).replace(/\\/g, '/')
        };
      }
    }
    const txtRes = spawnSync('xclip', ['-selection', 'clipboard', '-o'], { encoding: 'utf8', timeout: 2000 });
    const txt = (txtRes.stdout || '').trim();
    if (txt) return { type: 'text', text: txt };
  } catch {}

  return { type: 'empty' };
}

/**
 * Parses script output into structured clipboard data.
 */
function parseClipboardOutput(rawOut, destImg, cwd) {
  const line = rawOut.split('\n').find(l => l.startsWith('TYPE:')) || 'TYPE:EMPTY';
  const parts = line.split('|');
  const typeTag = parts[0].replace('TYPE:', '').trim();

  if (typeTag === 'IMAGE') {
    const imgPath = parts[1] || destImg;
    const rel = path.relative(cwd, imgPath).replace(/\\/g, '/');
    return {
      type: 'image',
      path: imgPath,
      relPath: rel.startsWith('.') ? rel : `./${rel}`
    };
  }

  if (typeTag === 'FILES') {
    const files = parts.slice(1).join('|').split('|').map(f => f.trim()).filter(Boolean);
    return {
      type: 'files',
      files
    };
  }

  if (typeTag === 'TEXT') {
    const text = parts.slice(1).join('|').trim();
    return {
      type: 'text',
      text
    };
  }

  if (typeTag === 'ERROR') {
    return {
      type: 'error',
      error: parts.slice(1).join('|') || 'Failed to capture clipboard'
    };
  }

  return { type: 'empty' };
}

/**
 * Formats user prompt with clipboard attachment directives.
 * @param {object} clipResult
 * @param {string} promptText
 * @returns {{ enhancedPrompt: string, targetFiles: string[], summary: string }}
 */
export function formatClipboardAttachment(clipResult, promptText = '') {
  const cleanPrompt = (promptText || '').trim();
  const targetFiles = [];
  let summary = '';

  if (clipResult.type === 'image') {
    targetFiles.push(clipResult.relPath);
    summary = `Image captured: ${clipResult.relPath}`;
    const userInstruction = cleanPrompt || 'Please analyze this screenshot image carefully and implement/fix the corresponding interface or code.';
    const enhancedPrompt = `
[GRAVITON CLIPBOARD IMAGE ATTACHMENT]
- Image File: \`${clipResult.relPath}\`
- Instruction to AI: Use \`view_file\` to inspect \`${clipResult.relPath}\` visually (examine layout, colors, typography, UI elements, or error messages), then implement the required changes.

User Request:
${userInstruction}
`.trim();

    return { enhancedPrompt, targetFiles, summary };
  }

  if (clipResult.type === 'files') {
    summary = `Files detected: ${clipResult.files.map(f => path.basename(f)).join(', ')}`;
    targetFiles.push(...clipResult.files);
    const userInstruction = cleanPrompt || 'Please inspect the provided file(s) and address any requested changes.';
    const enhancedPrompt = `
[GRAVITON CLIPBOARD FILES ATTACHMENT]
- Attached File(s): ${clipResult.files.map(f => `\`${f}\``).join(', ')}
- Instruction to AI: Inspect and process the attached files above according to the user request.

User Request:
${userInstruction}
`.trim();

    return { enhancedPrompt, targetFiles, summary };
  }

  if (clipResult.type === 'text') {
    const preview = clipResult.text.length > 60 ? clipResult.text.slice(0, 57) + '...' : clipResult.text;
    summary = `Text snippet captured (${clipResult.text.length} chars): "${preview.replace(/\r?\n/g, ' ')}"`;
    const userInstruction = cleanPrompt || 'Please review the following clipboard snippet and assist:';
    const enhancedPrompt = `
${userInstruction}

[GRAVITON CLIPBOARD SNIPPET]:
\`\`\`
${clipResult.text}
\`\`\`
`.trim();

    return { enhancedPrompt, targetFiles, summary };
  }

  // Fallback for empty or error
  return {
    enhancedPrompt: cleanPrompt,
    targetFiles: [],
    summary: clipResult.type === 'empty' ? 'Clipboard was empty' : `Clipboard notice: ${clipResult.error || 'unsupported'}`
  };
}
