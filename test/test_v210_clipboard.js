// test/test_v210_clipboard.js - Graviton V2.1.0 Clipboard Ingestion Test Suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getClipboardDir, captureClipboard, formatClipboardAttachment } from '../src/clipboard.js';

console.log('=== STARTING V2.1.0 CLIPBOARD INGESTION TEST SUITE ===\n');

const testDir = path.join(os.tmpdir(), `graviton-clipboard-test-${Date.now()}`);
fs.mkdirSync(testDir, { recursive: true });

try {
  // [TEST 1] Directory Creation & Resolution
  console.log('[TEST 1] Testing getClipboardDir resolution...');
  const clipDir = getClipboardDir(testDir);
  assert(fs.existsSync(clipDir), 'Clipboard directory should be created');
  assert(clipDir.endsWith(path.join('.graviton', 'clipboard')), 'Clipboard directory should be inside .graviton/clipboard');
  console.log('✔ PASS: Clipboard directory resolved and created.\n');

  // [TEST 2] formatClipboardAttachment - Image Type
  console.log('[TEST 2] Testing formatClipboardAttachment for images...');
  const mockImageResult = {
    type: 'image',
    path: path.join(testDir, 'screenshot.png'),
    relPath: './.graviton/clipboard/screenshot.png'
  };
  const imgFormatted = formatClipboardAttachment(mockImageResult, 'Fix this UI');
  assert(imgFormatted.enhancedPrompt.includes('[GRAVITON CLIPBOARD IMAGE ATTACHMENT]'), 'Should contain image attachment header');
  assert(imgFormatted.enhancedPrompt.includes('view_file'), 'Should instruct AI to use view_file');
  assert(imgFormatted.enhancedPrompt.includes('./.graviton/clipboard/screenshot.png'), 'Should mention the image file path');
  assert(imgFormatted.enhancedPrompt.includes('Fix this UI'), 'Should preserve user request');
  assert.deepStrictEqual(imgFormatted.targetFiles, ['./.graviton/clipboard/screenshot.png'], 'Target files should pin image');
  assert(imgFormatted.summary.includes('Image captured'), 'Summary should mention image captured');
  console.log('✔ PASS: Image attachment formatting verified.\n');

  // [TEST 3] formatClipboardAttachment - Default Prompt for Image
  console.log('[TEST 3] Testing formatClipboardAttachment for image with empty user prompt...');
  const imgNoPrompt = formatClipboardAttachment(mockImageResult, '');
  assert(imgNoPrompt.enhancedPrompt.includes('Please analyze this screenshot image carefully'), 'Should provide fallback instruction');
  console.log('✔ PASS: Default image instruction verified.\n');

  // [TEST 4] formatClipboardAttachment - Copied Files Type
  console.log('[TEST 4] Testing formatClipboardAttachment for copied files...');
  const mockFilesResult = {
    type: 'files',
    files: [path.join(testDir, 'spec.pdf'), path.join(testDir, 'design.sketch')]
  };
  const filesFormatted = formatClipboardAttachment(mockFilesResult, 'Check specs');
  assert(filesFormatted.enhancedPrompt.includes('[GRAVITON CLIPBOARD FILES ATTACHMENT]'), 'Should contain files attachment header');
  assert(filesFormatted.targetFiles.length === 2, 'Should target both files');
  assert(filesFormatted.summary.includes('spec.pdf'), 'Summary should mention spec.pdf');
  console.log('✔ PASS: File attachment formatting verified.\n');

  // [TEST 5] formatClipboardAttachment - Text Snippet Type
  console.log('[TEST 5] Testing formatClipboardAttachment for text snippets...');
  const mockTextResult = {
    type: 'text',
    text: 'function calculateTax(subtotal) { return subtotal * 0.11; }'
  };
  const textFormatted = formatClipboardAttachment(mockTextResult, 'Refactor this code');
  assert(textFormatted.enhancedPrompt.includes('[GRAVITON CLIPBOARD SNIPPET]:'), 'Should contain clipboard snippet block');
  assert(textFormatted.enhancedPrompt.includes('calculateTax'), 'Should include the snippet text');
  assert(textFormatted.enhancedPrompt.includes('Refactor this code'), 'Should include user request');
  assert(textFormatted.summary.includes('Text snippet captured'), 'Summary should mention text snippet');
  console.log('✔ PASS: Text snippet attachment formatting verified.\n');

  // [TEST 6] formatClipboardAttachment - Empty Type
  console.log('[TEST 6] Testing formatClipboardAttachment for empty clipboard...');
  const mockEmptyResult = { type: 'empty' };
  const emptyFormatted = formatClipboardAttachment(mockEmptyResult, 'just a prompt');
  assert.strictEqual(emptyFormatted.enhancedPrompt, 'just a prompt', 'Should leave prompt untouched');
  assert.strictEqual(emptyFormatted.targetFiles.length, 0, 'Target files should be empty');
  console.log('✔ PASS: Empty clipboard formatting verified.\n');

  // [TEST 7] captureClipboard OS Execution Smoke Test
  console.log('[TEST 7] Testing live captureClipboard execution...');
  const liveResult = captureClipboard(testDir);
  assert(typeof liveResult === 'object', 'captureClipboard must return an object');
  assert(['image', 'files', 'text', 'empty', 'error'].includes(liveResult.type), `Type must be valid, received: ${liveResult.type}`);
  console.log(`✔ PASS: Live capture completed with status: ${liveResult.type}\n`);

  console.log('====================================================');
  console.log('✔ ALL V2.1.0 CLIPBOARD INGESTION TESTS PASSED 100%!');
  console.log('====================================================\n');
} finally {
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch {}
}
