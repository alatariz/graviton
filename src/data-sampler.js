// src/data-sampler.js - .0.0 Smart Data & JSON/CSV Sampler
import fs from 'fs';
import path from 'path';

/**
 * Detects if a file path is a tabular or raw structured data file.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isDataFile(filePath = '') {
  if (!filePath || typeof filePath !== 'string') return false;
  const ext = path.extname(filePath).toLowerCase();
  return ['.json', '.csv', '.tsv', '.ndjson'].includes(ext);
}

/**
 * Samples a JSON payload, generating a concise schema & sample structure.
 * Prevents dumping arrays with thousands of records.
 * @param {string} rawJson
 * @param {number} maxSample
 * @returns {string}
 */
export function sampleJsonData(rawJson, maxSample = 3) {
  if (!rawJson || typeof rawJson !== 'string') return '';
  const trimmed = rawJson.trim();

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // If not valid JSON, return first 50 lines as fallback
    const lines = trimmed.split('\n');
    if (lines.length > 50) {
      return lines.slice(0, 50).join('\n') + `\n[... ${lines.length - 50} lines truncated by Data Sampler ...]`;
    }
    return trimmed;
  }

  // Case 1: Array of objects or values
  if (Array.isArray(parsed)) {
    const totalCount = parsed.length;
    if (totalCount <= maxSample) {
      return JSON.stringify(parsed, null, 2);
    }

    const sampleItems = parsed.slice(0, maxSample);
    const schemaDesc = describeSchema(sampleItems[0]);

    return `
[GRAVITON DATA SAMPLER: JSON ARRAY]
- Total Records : ${totalCount.toLocaleString()} items
- Detected Schema: ${schemaDesc}
- Sample Records (Top ${maxSample}):
\`\`\`json
${JSON.stringify(sampleItems, null, 2)}
\`\`\`
- Directive to AI: This is a representative sample of ${totalCount} records. Construct your data transformations and functions based on this schema without requesting the full dataset.
`.trim();
  }

  // Case 2: Object with top-level collections
  if (typeof parsed === 'object' && parsed !== null) {
    const keys = Object.keys(parsed);
    let hasLargeArray = false;
    const sampledObj = {};

    for (const k of keys) {
      const val = parsed[k];
      if (Array.isArray(val) && val.length > maxSample) {
        hasLargeArray = true;
        sampledObj[k] = {
          _totalItems: val.length,
          _schema: describeSchema(val[0]),
          _sample: val.slice(0, maxSample),
          _note: `Sampled ${maxSample} of ${val.length} items by Graviton Data Sampler`
        };
      } else {
        sampledObj[k] = val;
      }
    }

    if (hasLargeArray) {
      return `
[GRAVITON DATA SAMPLER: STRUCTURED OBJECT]
\`\`\`json
${JSON.stringify(sampledObj, null, 2)}
\`\`\`
- Directive to AI: Large sub-arrays have been sampled for token economy. Write your logic based on the schema and sample items provided.
`.trim();
    }

    return JSON.stringify(parsed, null, 2);
  }

  return trimmed;
}

/**
 * Analyzes an object to describe its fields and data types.
 */
function describeSchema(item) {
  if (item === null || typeof item !== 'object') {
    return typeof item;
  }
  if (Array.isArray(item)) {
    return `Array<${describeSchema(item[0])}>`;
  }
  const fields = Object.entries(item).slice(0, 15).map(([k, v]) => {
    const t = Array.isArray(v) ? 'array' : typeof v;
    return `${k} (${t})`;
  });
  return fields.join(', ');
}

/**
 * Samples a CSV / TSV file, formatting headers and top rows into a clean Markdown table.
 * @param {string} rawCsv
 * @param {number} maxRows
 * @returns {string}
 */
export function sampleCsvData(rawCsv, maxRows = 5) {
  if (!rawCsv || typeof rawCsv !== 'string') return '';
  const lines = rawCsv.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return '';

  // Detect delimiter: comma, semicolon, or tab
  const headerLine = lines[0];
  let delimiter = ',';
  if (headerLine.includes('\t')) delimiter = '\t';
  else if (headerLine.includes(';') && !headerLine.includes(',')) delimiter = ';';

  function splitLine(line) {
    // Simple regex for CSV splitting preserving quoted fields
    const pattern = new RegExp(
      `(?:^|${delimiter === '\t' ? '\\t' : delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^"${delimiter === '\t' ? '\\t' : delimiter}]*))`,
      'g'
    );
    const cells = [];
    let match;
    while ((match = pattern.exec(line)) !== null) {
      let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      cells.push((val || '').trim());
    }
    return cells;
  }

  const headers = splitLine(headerLine);
  if (headers.length === 0) return rawCsv.slice(0, 500);

  const totalRows = lines.length - 1;
  const sampleRows = lines.slice(1, maxRows + 1).map(splitLine);

  const mdTable = [];
  mdTable.push(`| ${headers.join(' | ')} |`);
  mdTable.push(`| ${headers.map(() => '---').join(' | ')} |`);

  for (const row of sampleRows) {
    // Pad or trim cells to match header count
    const padded = headers.map((_, i) => row[i] || '');
    mdTable.push(`| ${padded.join(' | ')} |`);
  }

  const headerNotice = totalRows > maxRows
    ? `[GRAVITON DATA SAMPLER: CSV DATASET - ${totalRows.toLocaleString()} Total Rows (Top ${maxRows} Sampled)]`
    : `[GRAVITON DATA SAMPLER: CSV DATASET - ${totalRows} Rows]`;

  const footerNotice = totalRows > maxRows
    ? `\n\n*Note to AI: Dataset contains ${totalRows.toLocaleString()} rows. Only the first ${maxRows} rows are displayed above for token efficiency.*`
    : '';

  return `${headerNotice}\n\n${mdTable.join('\n')}${footerNotice}`;
}
