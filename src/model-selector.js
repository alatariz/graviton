// src/model-selector.js - Graviton Autonomous Prompt-Aware Model Selector
/**
 * Graviton V3.13.0 Autonomous Model Selector
 * 
 * Decoupled Architecture:
 * 1. Effort Resolution:
 *    - Direct Command (no flags)  -> effort: 'medium'
 *    - Fast Command (-f, --fast)  -> effort: 'low'
 *    - Deep Command (-d, --deep)  -> effort: 'high'
 * 
 * 2. Model Tier Selection (100% Autonomous based on Prompt Analysis):
 *    - Lightweight, cosmetic, or explanatory tasks -> 'gemini-3.8-flash'
 *    - Architectural, game engine, multi-file, or algorithmic tasks -> 'gemini-3.1-pro'
 * 
 * 3. Model String Mapping:
 *    - Flash + low    -> 'gemini-3.8-flash-low'
 *    - Flash + medium -> 'gemini-3.8-flash-medium'
 *    - Flash + high   -> 'gemini-3.8-flash-high'
 *    - Pro + low      -> 'gemini-3.1-pro-low'
 *    - Pro + medium   -> 'gemini-3.1-pro-high'
 *    - Pro + high     -> 'gemini-3.1-pro-high'
 */

// Heuristics for Pro tier (high reasoning, complex architecture)
const PRO_TIER_PATTERNS = [
  // Game Development & 3D
  /\b(?:game|permainan|minecraft|voxel|3d|three\.js|threejs|canvas|phaser|physics|collision|fps|shooter|arcade|raycast|webgl|shader|procedural)\b/i,
  // System Architecture & Heavy Refactoring
  /\b(?:architect|arsitektur|refactor|restructure|system\s+design|microservice|clean\s+architecture|monorepo)\b/i,
  // Backend, Auth, & Databases
  /\b(?:database|basis\s+data|schema|migration|migrasi|sql|sqlite|postgres|mysql|prisma|mongo|orm|auth|authentication|autentikasi|jwt|oauth|session|login|signup|payment|stripe|webhook|api\s+route|fullstack)\b/i,
  // Deep Debugging & Concurrency
  /\b(?:race\s+condition|deadlock|memory\s+leak|kebocoran\s+memori|concurrency|async\s+sync|deadlock|infinite\s+loop|profiling|bottleneck)\b/i,
  // Complex Algorithms & State Engines
  /\b(?:algorithm|algoritma|ast|compiler|parser|tree\s+traversal|graph|cryptography|state\s+machine|state\s+management|redux|zustand)\b/i,
  // Broad feature creation
  /\b(?:buatkan\s+(?:saya\s+)?(?:sistem|aplikasi|game|backend|fullstack|engine)|build\s+(?:a\s+)?(?:system|app|application|game|backend|engine))\b/i
];

// Heuristics for Flash tier (lightweight, cosmetic, explanatory)
const FLASH_TIER_PATTERNS = [
  // CSS & Styling Tweaks
  /\b(?:css|style|styling|color|warna|font|padding|margin|border|radius|align|rata\s+tengah|dark\s+mode\s+toggle|spacing|jarak|tampilan)\b/i,
  // Typos, Renaming, Comments & Docstrings
  /\b(?:typo|ejaan|rename|ganti\s+nama|comment|komentar|docstring|documentation|dokumentasi|readme|format\s+json|prettify|indent)\b/i,
  // Q&A and Explanations
  /\b(?:explain|jelaskan|apa\s+maksud|what\s+is|kenapa\s+error|arti\s+kode|how\s+to\s+run|tanya|bantu\s+jelaskan)\b/i,
  // Minor helper functions & simple regex
  /\b(?:regex|regular\s+expression|validasi\s+email|email\s+validation|trim|capitalize|format\s+date|format\s+tanggal|simple\s+helper)\b/i,
  // Simple unit test additions
  /\b(?:unit\s+test\s+(?:simple|sederhana|kecil|for\s+helper))\b/i
];

/**
 * Classifies a user prompt into 'flash' or 'pro' tier based on technical complexity.
 * @param {string} prompt
 * @param {object} [context]
 * @returns {{ tier: 'flash' | 'pro', reason: string, score: number }}
 */
export function classifyModelForPrompt(prompt, context = {}) {
  if (!prompt || typeof prompt !== 'string') {
    return { tier: 'flash', reason: 'Empty prompt defaults to Flash', score: 0 };
  }

  const cleanText = prompt.trim();
  let proScore = 0;
  let flashScore = 0;
  const matchedProReasons = [];
  const matchedFlashReasons = [];

  // 1. Evaluate Pro tier patterns
  for (const pattern of PRO_TIER_PATTERNS) {
    if (pattern.test(cleanText)) {
      proScore += 2;
      const match = cleanText.match(pattern);
      if (match) matchedProReasons.push(match[0].toLowerCase());
    }
  }

  // 2. Evaluate Flash tier patterns
  for (const pattern of FLASH_TIER_PATTERNS) {
    if (pattern.test(cleanText)) {
      flashScore += 2;
      const match = cleanText.match(pattern);
      if (match) matchedFlashReasons.push(match[0].toLowerCase());
    }
  }

  // 3. Multi-file context influence
  if (context.targetFiles && Array.isArray(context.targetFiles)) {
    if (context.targetFiles.length > 3) {
      proScore += 3;
      matchedProReasons.push(`multi-file scope (${context.targetFiles.length} files)`);
    } else if (context.targetFiles.length === 1 && proScore === 0) {
      flashScore += 1;
    }
  }

  // 4. Word count & length heuristics
  const words = cleanText.split(/\s+/).filter(Boolean);
  if (words.length <= 8 && proScore === 0) {
    flashScore += 1;
    matchedFlashReasons.push('concise query');
  }

  // 5. Explicit creation of new components/features
  if (/\b(?:buatkan|create|build|implementasi|implement|bikin)\b/i.test(cleanText) && !/\b(?:warna|color|typo|comment|css)\b/i.test(cleanText)) {
    proScore += 1;
    matchedProReasons.push('feature creation intent');
  }

  // Decision logic
  if (proScore > flashScore) {
    return {
      tier: 'pro',
      reason: matchedProReasons.length > 0
        ? `Architectural / Complex task (${matchedProReasons.slice(0, 2).join(', ')})`
        : 'Deep reasoning required for structural task',
      score: proScore
    };
  }

  if (flashScore > proScore) {
    return {
      tier: 'flash',
      reason: matchedFlashReasons.length > 0
        ? `Lightweight / Local task (${matchedFlashReasons.slice(0, 2).join(', ')})`
        : 'Fast inference optimal for simple edit',
      score: flashScore
    };
  }

  // Tie-breaker: If user is asking to build/create, lean Pro. Otherwise lean Flash.
  if (/\b(?:buat|bikin|create|build|develop)\b/i.test(cleanText)) {
    return {
      tier: 'pro',
      reason: 'Feature construction defaults to Pro reasoning',
      score: 1
    };
  }

  return {
    tier: 'flash',
    reason: 'Standard editing optimal for Flash speed & cost efficiency',
    score: 0
  };
}

/**
 * Resolves the final model name and effort setting for execution.
 * Decouples CLI flags (-f -> low, -d -> high, default -> medium) from model tier (Flash vs Pro).
 * 
 * @param {object} options
 * @param {boolean} [options.isFast] - If true, effort = 'low'
 * @param {boolean} [options.isDeep] - If true, effort = 'high'
 * @param {string} [options.effort] - Explicit override ('low' | 'medium' | 'high')
 * @param {string} [options.prompt] - User prompt for classification
 * @param {object} [options.context] - Workspace context (e.g. targetFiles)
 * @returns {{ effort: 'low' | 'medium' | 'high', tier: 'flash' | 'pro', modelName: string, reason: string }}
 */
export function resolveModelAndEffort(options = {}) {
  // 1. Resolve effort strictly from CLI flags
  let effort = 'medium';
  if (options.effort) {
    effort = options.effort;
  } else if (options.isFast) {
    effort = 'low';
  } else if (options.isDeep) {
    effort = 'high';
  }

  // 2. Resolve model tier autonomously from prompt
  const classification = classifyModelForPrompt(options.prompt || '', options.context || {});
  const tier = classification.tier;

  // 3. Map to Antigravity CLI supported model names
  let modelName;
  if (tier === 'pro') {
    if (effort === 'low') {
      modelName = 'gemini-3.1-pro-low';
    } else {
      // For both medium and high, gemini-3.1-pro-high delivers optimal Pro reasoning
      modelName = 'gemini-3.1-pro-high';
    }
  } else {
    // Flash tier has low, medium, high variants
    if (effort === 'low') {
      modelName = 'gemini-3.8-flash-low';
    } else if (effort === 'high') {
      modelName = 'gemini-3.8-flash-high';
    } else {
      modelName = 'gemini-3.8-flash-medium';
    }
  }

  return {
    effort,
    tier,
    modelName,
    reason: classification.reason
  };
}
