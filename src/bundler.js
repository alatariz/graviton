// src/bundler.js - Graviton V3.7.0 Zero-Setup Standalone App Bundler & Exporter
import fs from 'fs';
import path from 'path';

/**
 * MIME types for inlining images.
 */
const IMAGE_MIMES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

/**
 * Bundles a multi-file web app (HTML + local CSS + local JS + local images) into a single,
 * self-contained, double-clickable offline-ready HTML file.
 *
 * @param {string} [entryHtml='index.html']
 * @param {string} [outputFile=null]
 * @param {string} [cwd=process.cwd()]
 * @returns {{
 *   success: boolean,
 *   outputPath: string,
 *   originalSize: number,
 *   bundledSize: number,
 *   filesInlined: string[],
 *   error?: string
 * }}
 */
export function bundleWebApplication(entryHtml = 'index.html', outputFile = null, cwd = process.cwd()) {
  const fullEntryPath = path.resolve(cwd, entryHtml);
  if (!fs.existsSync(fullEntryPath) || !fs.statSync(fullEntryPath).isFile()) {
    return {
      success: false,
      outputPath: '',
      originalSize: 0,
      bundledSize: 0,
      filesInlined: [],
      error: `Entry file '${entryHtml}' not found in workspace.`
    };
  }

  const entryDir = path.dirname(fullEntryPath);
  const rawHtml = fs.readFileSync(fullEntryPath, 'utf8');
  const originalSize = Buffer.byteLength(rawHtml, 'utf8');
  const filesInlined = [];

  let bundledHtml = rawHtml;

  // 1. Inline CSS stylesheets (<link rel="stylesheet" href="...">)
  const linkRegex = /<link[^>]+rel=["']stylesheet["'][^>]*>|<link[^>]+href=["']([^"']+\.css)["'][^>]*rel=["']stylesheet["'][^>]*>/gi;
  bundledHtml = bundledHtml.replace(linkRegex, (match) => {
    const hrefMatch = match.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch || !hrefMatch[1]) return match;

    const href = hrefMatch[1];
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
      return match; // Keep external CDN styles
    }

    const cssPath = path.resolve(entryDir, href);
    if (fs.existsSync(cssPath) && fs.statSync(cssPath).isFile()) {
      try {
        const cssContent = fs.readFileSync(cssPath, 'utf8');
        filesInlined.push(path.relative(cwd, cssPath).replace(/\\/g, '/'));
        return `<style data-inlined="${href}">\n${cssContent}\n</style>`;
      } catch {}
    }
    return match;
  });

  // 2. Inline JavaScript scripts (<script src="..."></script>)
  const scriptRegex = /<script\b([^>]*)src=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/script>/gi;
  bundledHtml = bundledHtml.replace(scriptRegex, (match, before, src, after, body) => {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) {
      return match; // Keep external CDN scripts (Three.js, Phaser, etc.)
    }

    const jsPath = path.resolve(entryDir, src);
    if (fs.existsSync(jsPath) && fs.statSync(jsPath).isFile()) {
      try {
        const jsContent = fs.readFileSync(jsPath, 'utf8');
        filesInlined.push(path.relative(cwd, jsPath).replace(/\\/g, '/'));
        const extraAttrs = [before, after].map(s => s.trim()).filter(Boolean).join(' ');
        const attrStr = extraAttrs ? ` ${extraAttrs}` : '';
        return `<script${attrStr} data-inlined="${src}">\n${jsContent}\n</script>`;
      } catch {}
    }
    return match;
  });

  // 3. Inline local small images as Base64 (<img src="...">)
  const imgRegex = /<img\b([^>]*)src=["']([^"']+)["']([^>]*)>/gi;
  bundledHtml = bundledHtml.replace(imgRegex, (match, before, src, after) => {
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('data:') || src.startsWith('//')) {
      return match;
    }

    const imgPath = path.resolve(entryDir, src);
    const ext = path.extname(src).toLowerCase();
    if (IMAGE_MIMES[ext] && fs.existsSync(imgPath) && fs.statSync(imgPath).isFile()) {
      try {
        const stat = fs.statSync(imgPath);
        // Only inline images under 500KB to prevent bloated HTML files
        if (stat.size <= 500 * 1024) {
          const buffer = fs.readFileSync(imgPath);
          const base64 = buffer.toString('base64');
          const dataUri = `data:${IMAGE_MIMES[ext]};base64,${base64}`;
          filesInlined.push(path.relative(cwd, imgPath).replace(/\\/g, '/'));
          return `<img ${before}src="${dataUri}"${after}>`;
        }
      } catch {}
    }
    return match;
  });

  // 4. Determine output destination
  let finalOutputPath;
  if (outputFile) {
    finalOutputPath = path.resolve(cwd, outputFile);
  } else {
    const distDir = path.join(cwd, 'dist');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    finalOutputPath = path.join(distDir, 'bundle.html');
  }

  const outDir = path.dirname(finalOutputPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(finalOutputPath, bundledHtml, 'utf8');
  const bundledSize = Buffer.byteLength(bundledHtml, 'utf8');

  return {
    success: true,
    outputPath: finalOutputPath,
    originalSize,
    bundledSize,
    filesInlined
  };
}
