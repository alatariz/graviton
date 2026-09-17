// src/markitdown.js - Graviton V2.3.0 Zero-Dependency Office, PDF & Document to Markdown Transpiler
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { spawnSync } from 'child_process';
import { sampleCsvData, sampleJsonData } from './data-sampler.js';
import { getCachedMarkdown, setCachedMarkdown } from './cache-manager.js';

export const SUPPORTED_EXTENSIONS = new Set(['.docx', '.xlsx', '.pptx', '.pdf', '.csv', '.tsv', '.json']);
export const MAX_TRANSPILATION_SIZE = 20 * 1024 * 1024; // 20 MB safety limit

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
 * Lists all file entry names inside a ZIP archive buffer in pure Node.js.
 * @param {Buffer} zipBuffer
 * @returns {string[]}
 */
export function listZipEntries(zipBuffer) {
  if (!zipBuffer || !Buffer.isBuffer(zipBuffer)) return [];
  const entries = new Set();

  // 1. Central Directory Scan
  try {
    let cdOffset = zipBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    while (cdOffset !== -1 && cdOffset >= 0) {
      const filenameLen = zipBuffer.readUInt16LE(cdOffset + 28);
      const filename = zipBuffer.toString('utf8', cdOffset + 46, cdOffset + 46 + filenameLen);
      entries.add(filename);
      cdOffset = zipBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), cdOffset - 1);
    }
  } catch {}

  // 2. Local File Header Scan
  try {
    let offset = 0;
    while (offset < zipBuffer.length - 4) {
      const sig = zipBuffer.readUInt32LE(offset);
      if (sig !== 0x04034b50) break;
      const compressedSize = zipBuffer.readUInt32LE(offset + 18);
      const filenameLen = zipBuffer.readUInt16LE(offset + 26);
      const extraLen = zipBuffer.readUInt16LE(offset + 28);
      const filename = zipBuffer.toString('utf8', offset + 30, offset + 30 + filenameLen);
      entries.add(filename);
      if (compressedSize === 0) break;
      offset = offset + 30 + filenameLen + extraLen + compressedSize;
    }
  } catch {}

  return Array.from(entries);
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
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      return `[GRAVITON DOCUMENT NOTICE: "${path.basename(filePath)}" is not a valid ZIP/Office document (corrupted or unrecognized file header).]`;
    }
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
  } catch (err) {
    const errorMsg = err && err.message ? err.message : String(err);
    return `[GRAVITON DOCUMENT NOTICE: "${path.basename(filePath)}" could not be parsed (${errorMsg}). File may be corrupted or encrypted.]`;
  }
}

/**
 * Transpiles Microsoft Excel (.xlsx) spreadsheets to Clean Markdown tables.
 * @param {string} filePath
 * @param {number} maxRows
 * @returns {string}
 */
export function transpileXlsx(filePath, maxRows = 25) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      return `[GRAVITON DOCUMENT NOTICE: "${path.basename(filePath)}" is not a valid ZIP/Office document (corrupted or unrecognized file header).]`;
    }
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
  } catch (err) {
    const errorMsg = err && err.message ? err.message : String(err);
    return `[GRAVITON DOCUMENT NOTICE: "${path.basename(filePath)}" could not be parsed (${errorMsg}). File may be corrupted or encrypted.]`;
  }
}

/**
 * Transpiles Microsoft PowerPoint (.pptx) presentations to Clean Markdown slides.
 * @param {string} filePath
 * @param {number} maxSlides
 * @returns {string}
 */
export function transpilePptx(filePath, maxSlides = 30) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      return `[GRAVITON DOCUMENT NOTICE: "${path.basename(filePath)}" is not a valid ZIP/Office document (corrupted or unrecognized file header).]`;
    }
    const allEntries = listZipEntries(buf);
    const slideEntries = allEntries
      .filter(e => /ppt\/slides\/slide\d+\.xml/i.test(e))
      .sort((a, b) => {
        const numA = parseInt((a.match(/slide(\d+)\.xml/i) || [])[1] || '0', 10);
        const numB = parseInt((b.match(/slide(\d+)\.xml/i) || [])[1] || '0', 10);
        return numA - numB;
      });

    // If listZipEntries didn't catch, sequentially probe slide1.xml to slide100.xml
    if (slideEntries.length === 0) {
      for (let i = 1; i <= 100; i++) {
        const probeName = `ppt/slides/slide${i}.xml`;
        const xml = extractZipEntry(buf, probeName, filePath);
        if (xml) {
          slideEntries.push(probeName);
        } else {
          break;
        }
      }
    }

    if (slideEntries.length === 0) {
      return `[MARKITDOWN NOTICE: No slides detected in PowerPoint ${path.basename(filePath)}]`;
    }

    const totalSlides = slideEntries.length;
    const processedSlides = slideEntries.slice(0, maxSlides);
    const slideOutputs = [];

    for (let idx = 0; idx < processedSlides.length; idx++) {
      const slideName = processedSlides[idx];
      const slideXml = extractZipEntry(buf, slideName, filePath);
      if (!slideXml) continue;

      const slideNum = idx + 1;
      let slideTitle = '';
      const bodyItems = [];

      // Detect shapes: <p:sp>...</p:sp>
      const shapeRegex = /<p:sp[\s\S]*?<\/p:sp>/g;
      let spMatch;

      while ((spMatch = shapeRegex.exec(slideXml)) !== null) {
        const shape = spMatch[0];
        const isTitleShape = /<p:ph[^>]*type=["'](?:title|ctrTitle)["']/i.test(shape);
        const shapeText = extractDrawingMlText(shape);

        if (isTitleShape && shapeText) {
          slideTitle = shapeText.trim();
        } else if (shapeText) {
          const paragraphs = shapeText.split('\n').map(p => p.trim()).filter(Boolean);
          for (const p of paragraphs) {
            bodyItems.push(p);
          }
        }
      }

      // Fallback: If no explicit title shape found, take first paragraph as title
      if (!slideTitle && bodyItems.length > 0) {
        slideTitle = bodyItems.shift();
      }

      const titleHeader = `## Slide ${slideNum}: ${slideTitle || `Slide ${slideNum}`}`;
      const formattedBody = bodyItems.map(item => item.startsWith('-') ? item : `- ${item}`).join('\n');

      slideOutputs.push(`${titleHeader}\n\n${formattedBody || '*(No text content)*'}`.trim());
    }

    const footer = totalSlides > maxSlides
      ? `\n\n*Note to AI: Presentation contains ${totalSlides} slides. Top ${maxSlides} slides displayed above by MarkItDown.*`
      : '';

    const baseName = path.basename(filePath);
    return `
[GRAVITON MARKITDOWN: POWERPOINT TRANSPILER]
Presentation: \`${baseName}\` (${totalSlides} Slides)

${slideOutputs.join('\n\n---\n\n')}${footer}
`.trim();
  } catch (err) {
    const errorMsg = err && err.message ? err.message : String(err);
    return `[GRAVITON DOCUMENT NOTICE: "${path.basename(filePath)}" could not be parsed (${errorMsg}). File may be corrupted or encrypted.]`;
  }
}

/**
 * Transpiles PDF documents to Clean Markdown pages.
 * Zero-dependency pure Node.js FlateDecode stream parser with native fallbacks.
 * @param {string} filePath
 * @param {number} maxPages
 * @returns {string}
 */
export function transpilePdf(filePath, maxPages = 40) {
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length < 5 || buf.toString('utf8', 0, 5) !== '%PDF-') {
      return `[GRAVITON DOCUMENT NOTICE: "${path.basename(filePath)}" is not a valid PDF file (missing %PDF- header).]`;
    }
    const content = buf.toString('binary');
    const pages = [];
    let pageNum = 1;

    // Scan PDF streams
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;

    while ((match = streamRegex.exec(content)) !== null) {
      if (pages.length >= maxPages) break;
      const rawStream = Buffer.from(match[1], 'binary');
      let decompressed = '';

      try {
        decompressed = zlib.inflateSync(rawStream).toString('utf8');
      } catch {
        try {
          decompressed = zlib.inflateRawSync(rawStream).toString('utf8');
        } catch {
          decompressed = rawStream.toString('utf8');
        }
      }

      if (decompressed && decompressed.includes('BT')) {
        const pageLines = extractTextFromPdfStream(decompressed);
        if (pageLines.length > 0) {
          pages.push({
            page: pageNum++,
            text: pageLines.join('\n')
          });
        }
      }
    }

    // Fallback: uncompressed ASCII string extraction if no FlateDecode streams matched
    if (pages.length === 0) {
      const rawStrings = [];
      const tjRegex = /\(([^)]{2,})\)\s*Tj/g;
      let rMatch;
      while ((rMatch = tjRegex.exec(content)) !== null) {
        const cleaned = cleanPdfString(rMatch[1]);
        if (cleaned.trim()) rawStrings.push(cleaned.trim());
      }
      if (rawStrings.length > 0) {
        pages.push({ page: 1, text: rawStrings.join('\n') });
      }
    }

    if (pages.length === 0) {
      return `[MARKITDOWN NOTICE: No extractable text found in ${path.basename(filePath)} (Scanned/Image-only PDF)]`;
    }

    const baseName = path.basename(filePath);
    const pagesMd = pages.map(p => `### Page ${p.page}\n\n${p.text}`).join('\n\n---\n\n');

    return `
[GRAVITON MARKITDOWN: PDF TRANSPILER]
Document: \`${baseName}\` (${pages.length} Pages Extracted)

${pagesMd}
`.trim();
  } catch (err) {
    const errorMsg = err && err.message ? err.message : String(err);
    return `[GRAVITON DOCUMENT NOTICE: "${path.basename(filePath)}" could not be parsed (${errorMsg}). File may be corrupted or encrypted.]`;
  }
}

/**
 * Universal dispatcher: transpiles DOCX, XLSX, PPTX, PDF, CSV, TSV, or JSON to clean Markdown.
 * Uses caching layer for sub-millisecond repeated responses.
 * @param {string} filePath
 * @param {object} [options]
 * @returns {string}
 */
export function transpileFileToMarkdown(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return `[MARKITDOWN ERROR: File not found -> ${filePath}]`;
  }

  // Check file size safety limit
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_TRANSPILATION_SIZE) {
      return `[GRAVITON DEFENSIVE GUARD: File exceeds 20MB safety limit (${(stat.size / (1024 * 1024)).toFixed(1)}MB). Transpilation skipped to preserve stability.]`;
    }
  } catch {}

  // Check cache first
  const cached = getCachedMarkdown(filePath, options.cwd || process.cwd());
  if (cached) {
    return cached;
  }

  const ext = path.extname(filePath).toLowerCase();
  let result = '';

  try {
    if (ext === '.docx') {
      result = transpileDocx(filePath);
    } else if (ext === '.xlsx') {
      result = transpileXlsx(filePath);
    } else if (ext === '.pptx') {
      result = transpilePptx(filePath);
    } else if (ext === '.pdf') {
      result = transpilePdf(filePath);
    } else if (ext === '.csv' || ext === '.tsv') {
      const raw = fs.readFileSync(filePath, 'utf8');
      result = sampleCsvData(raw);
    } else if (ext === '.json') {
      const raw = fs.readFileSync(filePath, 'utf8');
      const sampled = sampleJsonData(raw);
      if (!sampled.startsWith('[GRAVITON DATA SAMPLER')) {
        result = `\`\`\`json\n// File: ${path.basename(filePath)}\n${sampled}\n\`\`\``;
      } else {
        result = sampled;
      }
    } else {
      result = fs.readFileSync(filePath, 'utf8');
    }
  } catch (err) {
    const errorMsg = err && err.message ? err.message : String(err);
    return `[GRAVITON DEFENSIVE GUARD: Error reading "${path.basename(filePath)}" (${errorMsg}).]`;
  }

  // Save to cache
  if (result) {
    setCachedMarkdown(filePath, result, options.cwd || process.cwd());
  }

  return result;
}

/**
 * Helper to pull text from DrawingML tags (<a:t>) inside PowerPoint shapes.
 */
function extractDrawingMlText(shapeXml) {
  const pRegex = /<a:p[\s\S]*?<\/a:p>/g;
  const paragraphs = [];
  let pMatch;

  while ((pMatch = pRegex.exec(shapeXml)) !== null) {
    const pBlock = pMatch[0];
    const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
    const pieces = [];
    let tMatch;
    while ((tMatch = tRegex.exec(pBlock)) !== null) {
      pieces.push(tMatch[1]);
    }
    const full = pieces.join('').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    if (full) {
      paragraphs.push(full);
    }
  }

  return paragraphs.join('\n');
}

/**
 * Helper to pull text from Word/Spreadsheet XML tags (<w:t>, <t>, etc.)
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

/**
 * Decodes text strings and positioning from decompressed PDF stream.
 */
function extractTextFromPdfStream(decompressed) {
  const lines = [];
  const btRegex = /BT([\s\S]*?)ET/g;
  let btMatch;

  while ((btMatch = btRegex.exec(decompressed)) !== null) {
    const block = btMatch[1];
    let currentLine = '';

    // Regex for Tj, TJ, and text line breaks
    const opRegex = /(?:\(([^)]*)\)\s*Tj)|(?:\[([\s\S]*?)\]\s*TJ)|(?:\(([^)]*)\)\s*['"])|(?:(?:[-0-9.]+\s+)+T[dD])|(?:T\*)/g;
    let opMatch;

    while ((opMatch = opRegex.exec(block)) !== null) {
      if (opMatch[1] !== undefined) {
        // (string) Tj
        currentLine += cleanPdfString(opMatch[1]);
      } else if (opMatch[2] !== undefined) {
        // [(str) kern (str)] TJ
        const inner = opMatch[2];
        const innerRegex = /(?:\(([^)]*)\))|(-?\d+(?:\.\d+)?)/g;
        let item;
        while ((item = innerRegex.exec(inner)) !== null) {
          if (item[1] !== undefined) {
            currentLine += cleanPdfString(item[1]);
          } else if (item[2] !== undefined) {
            const kern = parseFloat(item[2]);
            if (kern < -100) {
              currentLine += ' ';
            }
          }
        }
      } else if (opMatch[3] !== undefined) {
        // ' or " newline operator
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = cleanPdfString(opMatch[3]);
      } else {
        // Td, TD, T* line break
        if (currentLine.trim()) {
          lines.push(currentLine.trim());
          currentLine = '';
        }
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
  }

  return lines;
}

/**
 * Unescapes characters in PDF string objects.
 */
function cleanPdfString(str) {
  if (!str) return '';
  return str
    .replace(/\\([0-7]{1,3})/g, (m, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}
