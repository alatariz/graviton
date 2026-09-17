// src/markitdown.js - Graviton V2.2.0 Zero-Dependency Office & Document to Markdown Transpiler
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawnSync } from 'child_process';
import { sampleCsvData, sampleJsonData } from './data-sampler.js';

export const SUPPORTED_EXTENSIONS = new Set(['.docx', '.xlsx', '.csv', '.tsv', '.json']);

/**
 * Checks if a file path is a transpilable document or data format.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isTranspilableDocument(filePath = '') {
  if (!filePath || typeof filePath !== 'string') return false;
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

/**
 * Extracts a specific file entry from a ZIP archive buffer in pure Node.js (Zero-Dependency).
 * Falls back to OS-native utilities (PowerShell / unzip) if buffer parsing encounters extended ZIP64.
 * @param {Buffer} zipBuffer
 * @param {string} entryName
 * @param {string} [filePathFallback]
 * @returns {string|null}
 */
export function extractZipEntry(zipBuffer, entryName, filePathFallback = '') {
  if (!zipBuffer || !Buffer.isBuffer(zipBuffer)) return null;

  try {
    let offset = 0;
    while (offset < zipBuffer.length - 4) {
      const sig = zipBuffer.readUInt32LE(offset);
      if (sig !== 0x04034b50) break; // End of local file headers

      const method = zipBuffer.readUInt16LE(offset + 8);
      const compressedSize = zipBuffer.readUInt32LE(offset + 18);
      const filenameLen = zipBuffer.readUInt16LE(offset + 26);
      const extraLen = zipBuffer.readUInt16LE(offset + 28);

      const filename = zipBuffer.toString('utf8', offset + 30, offset + 30 + filenameLen);
      const dataStart = offset + 30 + filenameLen + extraLen;

      if (filename === entryName) {
        if (compressedSize > 0) {
          const slice = zipBuffer.subarray(dataStart, dataStart + compressedSize);
          if (method === 0) {
            return slice.toString('utf8');
          } else if (method === 8) {
            return zlib.inflateRawSync(slice).toString('utf8');
          }
        }
      }

      // If sizes were in data descriptor (bit 3), fall through to Central Directory scan below
      if (compressedSize === 0) break;
      offset = dataStart + compressedSize;
    }
  } catch {}

  // Central Directory Scan (Handles data descriptors and arbitrary zip ordering)
  try {
    let cdOffset = zipBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    while (cdOffset !== -1 && cdOffset >= 0) {
      const method = zipBuffer.readUInt16LE(cdOffset + 10);
      const compressedSize = zipBuffer.readUInt32LE(cdOffset + 20);
      const filenameLen = zipBuffer.readUInt16LE(cdOffset + 28);
      const extraLen = zipBuffer.readUInt16LE(cdOffset + 30);
      const commentLen = zipBuffer.readUInt16LE(cdOffset + 32);
      const localHeaderOffset = zipBuffer.readUInt32LE(cdOffset + 42);

      const filename = zipBuffer.toString('utf8', cdOffset + 46, cdOffset + 46 + filenameLen);
      if (filename === entryName) {
        const localFnLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
        const localExtLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
        const dataStart = localHeaderOffset + 30 + localFnLen + localExtLen;
        const slice = zipBuffer.subarray(dataStart, dataStart + compressedSize);
        if (method === 0) {
          return slice.toString('utf8');
        } else if (method === 8) {
          return zlib.inflateRawSync(slice).toString('utf8');
        }
      }

      cdOffset = zipBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), cdOffset - 1);
    }
  } catch {}

  // OS-native fallback (PowerShell on Windows, unzip on Unix)
  if (filePathFallback && fs.existsSync(filePathFallback)) {
    try {
      if (process.platform === 'win32') {
        const escaped = filePathFallback.replace(/'/g, "''");
        const entryEscaped = entryName.replace(/'/g, "''");
        const psCmd = `
Add-Type -AssemblyName System.IO.Compression.FileSystem;
$zip = [System.IO.Compression.ZipFile]::OpenRead('${escaped}');
$entry = $zip.GetEntry('${entryEscaped}');
if ($entry -ne $null) {
  $s = $entry.Open();
  $r = New-Object System.IO.StreamReader($s);
  $r.ReadToEnd();
  $r.Dispose();
  $s.Dispose();
}
$zip.Dispose();
`.trim();
        const res = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], { encoding: 'utf8', timeout: 5000 });
        if (res.status === 0 && res.stdout) {
          return res.stdout;
        }
      } else {
        const res = spawnSync('unzip', ['-p', filePathFallback, entryName], { encoding: 'utf8', timeout: 4000 });
        if (res.status === 0 && res.stdout) {
          return res.stdout;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Transpiles Microsoft Word (.docx) documents to Clean Markdown.
 * @param {string} filePath
 * @returns {string}
 */
export function transpileDocx(filePath) {
  const buf = fs.readFileSync(filePath);
  const docXml = extractZipEntry(buf, 'word/document.xml', filePath);
  if (!docXml) {
    return `[MARKITDOWN NOTICE: Could not extract word/document.xml from ${path.basename(filePath)}]`;
  }

  const outputLines = [];

  // Match tables: <w:tbl>...</w:tbl>
  // Or paragraphs: <w:p>...</w:p>
  const blockRegex = /<w:tbl[\s\S]*?<\/w:tbl>|<w:p[\s\S]*?<\/w:p>/g;
  let match;

  while ((match = blockRegex.exec(docXml)) !== null) {
    const block = match[0];

    if (block.startsWith('<w:tbl')) {
      // Parse Table
      const rows = [];
      const rowRegex = /<w:tr[\s\S]*?<\/w:tr>/g;
      let rMatch;
      while ((rMatch = rowRegex.exec(block)) !== null) {
        const rBlock = rMatch[0];
        const cells = [];
        const cellRegex = /<w:tc[\s\S]*?<\/w:tc>/g;
        let cMatch;
        while ((cMatch = cellRegex.exec(rBlock)) !== null) {
          const cText = extractTextFromXml(cMatch[0]);
          cells.push(cText.replace(/\|/g, '\\|').trim());
        }
        if (cells.length > 0) rows.push(cells);
      }

      if (rows.length > 0) {
        const maxCols = Math.max(...rows.map(r => r.length));
        const header = rows[0];
        while (header.length < maxCols) header.push('');
        outputLines.push(`| ${header.join(' | ')} |`);
        outputLines.push(`| ${header.map(() => '---').join(' | ')} |`);
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          while (row.length < maxCols) row.push('');
          outputLines.push(`| ${row.join(' | ')} |`);
        }
        outputLines.push('');
      }
    } else {
      // Parse Paragraph
      const text = extractTextFromXml(block).trim();
      if (!text) continue;

      const headingMatch = block.match(/<w:pStyle\s+[^>]*w:val=["']Heading(\d)["']/i);
      const isBullet = block.includes('<w:numPr');

      if (headingMatch) {
        const level = Math.min(6, parseInt(headingMatch[1], 10) || 1);
        outputLines.push(`${'#'.repeat(level)} ${text}\n`);
      } else if (isBullet) {
        outputLines.push(`- ${text}`);
      } else {
        outputLines.push(`${text}\n`);
      }
    }
  }

  const baseName = path.basename(filePath);
  return `
[GRAVITON MARKITDOWN: DOCX TRANSPILER]
Document: \`${baseName}\` (Converted to Clean Markdown)

${outputLines.join('\n').trim()}
`.trim();
}

/**
 * Transpiles Microsoft Excel (.xlsx) spreadsheets to Clean Markdown tables.
 * @param {string} filePath
 * @param {number} maxRows
 * @returns {string}
 */
export function transpileXlsx(filePath, maxRows = 25) {
  const buf = fs.readFileSync(filePath);
  const sharedXml = extractZipEntry(buf, 'xl/sharedStrings.xml', filePath);
  const sheetXml = extractZipEntry(buf, 'xl/worksheets/sheet1.xml', filePath);

  if (!sheetXml) {
    return `[MARKITDOWN NOTICE: Could not extract sheet1.xml from ${path.basename(filePath)}]`;
  }

  // 1. Build shared strings dictionary
  const sharedStrings = [];
  if (sharedXml) {
    const siRegex = /<si[\s\S]*?<\/si>/g;
    let sMatch;
    while ((sMatch = siRegex.exec(sharedXml)) !== null) {
      sharedStrings.push(extractTextFromXml(sMatch[0]));
    }
  }

  // 2. Parse sheet rows
  const parsedRows = [];
  const rowRegex = /<row\s+[^>]*r=["'](\d+)["'][\s\S]*?<\/row>/g;
  let rMatch;

  while ((rMatch = rowRegex.exec(sheetXml)) !== null) {
    const rBlock = rMatch[0];
    const cells = [];
    const cellRegex = /<c\s+[^>]*r=["']([A-Z]+)(\d+)["']([^>]*)>([\s\S]*?)<\/c>/g;
    let cMatch;

    while ((cMatch = cellRegex.exec(rBlock)) !== null) {
      const colLetters = cMatch[1];
      const attrs = cMatch[3];
      const inner = cMatch[4];

      let val = '';
      if (attrs.includes('t="s"')) {
        // Shared string index
        const vMatch = inner.match(/<v>(\d+)<\/v>/);
        if (vMatch) {
          const idx = parseInt(vMatch[1], 10);
          val = sharedStrings[idx] || '';
        }
      } else if (attrs.includes('t="inlineStr"')) {
        val = extractTextFromXml(inner);
      } else {
        const vMatch = inner.match(/<v>([^<]+)<\/v>/);
        if (vMatch) val = vMatch[1];
      }

      cells.push(val.replace(/\|/g, '\\|').trim());
    }

    if (cells.length > 0) parsedRows.push(cells);
  }

  if (parsedRows.length === 0) {
    return `[MARKITDOWN: Empty Excel Spreadsheet - ${path.basename(filePath)}]`;
  }

  const totalRows = parsedRows.length;
  const sampleRows = parsedRows.slice(0, maxRows);
  const maxCols = Math.max(...sampleRows.map(r => r.length));

  const mdTable = [];
  const header = sampleRows[0];
  while (header.length < maxCols) header.push('');
  mdTable.push(`| ${header.join(' | ')} |`);
  mdTable.push(`| ${header.map(() => '---').join(' | ')} |`);

  for (let i = 1; i < sampleRows.length; i++) {
    const row = sampleRows[i];
    while (row.length < maxCols) row.push('');
    mdTable.push(`| ${row.join(' | ')} |`);
  }

  const footer = totalRows > maxRows
    ? `\n\n*Note to AI: Sheet contains ${totalRows.toLocaleString()} rows. Top ${maxRows} rows displayed above by MarkItDown for token economy.*`
    : '';

  const baseName = path.basename(filePath);
  return `
[GRAVITON MARKITDOWN: EXCEL TRANSPILER]
Spreadsheet: \`${baseName}\` (${totalRows.toLocaleString()} Rows)

${mdTable.join('\n')}${footer}
`.trim();
}

/**
 * Universal dispatcher: transpiles DOCX, XLSX, CSV, or JSON to clean Markdown representation.
 * @param {string} filePath
 * @returns {string}
 */
export function transpileFileToMarkdown(filePath) {
  if (!fs.existsSync(filePath)) {
    return `[MARKITDOWN ERROR: File not found -> ${filePath}]`;
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.docx') {
    return transpileDocx(filePath);
  }
  if (ext === '.xlsx') {
    return transpileXlsx(filePath);
  }
  if (ext === '.csv' || ext === '.tsv') {
    const raw = fs.readFileSync(filePath, 'utf8');
    return sampleCsvData(raw);
  }
  if (ext === '.json') {
    const raw = fs.readFileSync(filePath, 'utf8');
    const sampled = sampleJsonData(raw);
    if (!sampled.startsWith('[GRAVITON DATA SAMPLER')) {
      return `\`\`\`json\n// File: ${path.basename(filePath)}\n${sampled}\n\`\`\``;
    }
    return sampled;
  }

  return fs.readFileSync(filePath, 'utf8');
}

/**
 * Helper to pull text from XML tags (<w:t>, <t>, etc.)
 */
function extractTextFromXml(xmlStr) {
  const tRegex = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g;
  const pieces = [];
  let m;
  while ((m = tRegex.exec(xmlStr)) !== null) {
    pieces.push(m[1]);
  }
  return pieces.join('').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
}
