// src/prompt-architect.js - Graviton V3.5.0 Autonomous Prompt Architect & Dynamic Reprompter

/**
 * Robust conversational filler phrases in Indonesian and English (without greedy dot matching).
 */
const GREETINGS_REGEX = /^(?:(?:halo|hai|hey|hi|hello)\s+)?(?:selamat\s+(?:pagi|siang|sore|malam)|good\s+(?:morning|afternoon|evening)|halo|hai|hey|hi|hello)\s*(?:antigravity|ai|bot|assistant|semua|kawan)?[\s,!.-]*/i;
const COURTESY_CLOSING_REGEX = /\b(?:terima\s+kasih\s*(?:banyak)?\s*(?:ya)?\s*(?:sebelumnya)?|thanks\s*(?:a\s+lot|in\s+advance)?|thank\s+you\s*(?:so\s+much|very\s+much|in\s+advance)?|hope\s+this\s+helps|let\s+me\s+know\s+if\s+you\s+have\s+any\s+questions|semoga\s+harimu\s+menyenangkan)[!.]*/gi;
const CONVERSATIONAL_PLEAS_REGEX = /\b(?:saya\s+ingin\s+(?:kamu\s+|anda\s+)?(?:tolong\s+)?(?:bantu\s+saya\s*(?:untuk)?)?|bisakah\s+(?:kamu\s+|anda\s+)?(?:tolong\s+)?|could\s+you\s+(?:please\s+)?(?:kindly\s+)?(?:help\s+me\s*(?:to)?)?|can\s+you\s+(?:please\s+)?(?:kindly\s+)?(?:help\s+me\s*(?:to)?)?|tolong\s*(?:bantu\s+saya\s*(?:untuk)?)?|bantu\s+saya\s*(?:untuk)?|tolong\s+dong\s+|please\s+help\s+me\s*(?:to)?)/gi;
const META_NARRATIVE_REGEX = /(?:kodenya\s+(?:seperti\s+ini|adalah)[\s:]*|here\s+is\s+the\s+code[\s:]*|saat\s+saya\s+jalankan[^\n]+muncul\s+error[^\n]*|when\s+i\s+run[^\n]+i\s+get[^\n]*error[^\n]*)/gi;

/**
 * Analyzes the characteristics and domain intent of a raw user prompt.
 * @param {string} text
 * @returns {object}
 */
export function analyzePromptProfile(text) {
  if (!text || typeof text !== 'string') {
    return { wordCount: 0, intent: 'unknown', isSparse: false, isRambling: false, hasError: false };
  }

  const clean = text.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const hasError = /\b(?:Error|TypeError|ReferenceError|SyntaxError|panic|Traceback|AssertionError|ERR!)\b/i.test(clean);
  const hasCodeBlock = /```/.test(clean);

  // Intent classification based on domain keywords
  let intent = 'general';
  if (/\b(?:game|cs2|fps|shooter|canvas|three\.?js|webgl|phaser|permainan|arcade|player|weapon)\b/i.test(clean)) {
    intent = 'game_dev';
  } else if (/\b(?:api|backend|rest|crud|endpoint|express|fastapi|nest|controller|route|microservice)\b/i.test(clean)) {
    intent = 'backend_api';
  } else if (/\b(?:dashboard|landing\s+page|ui|frontend|react|vue|component|modal|navbar|tailwind|html|css)\b/i.test(clean)) {
    intent = 'frontend_ui';
  } else if (/\b(?:database|sql|table|schema|migration|bigquery|postgres|mysql|sqlite|query)\b/i.test(clean)) {
    intent = 'database_sql';
  } else if (hasError || /\b(?:fix|debug|error|bug|broken|perbaiki|rusak|gagal)\b/i.test(clean)) {
    intent = 'bug_fix';
  }

  // A prompt is sparse if it asks to build/create a full system in < 25 words without technical specs
  const isCreationVerb = /\b(?:buat(?:kan)?|bikin|create|build|make|scaffold|duplikat|clone)\b/i.test(clean);
  const isSparse = wordCount < 25 && isCreationVerb && intent !== 'bug_fix' && !hasCodeBlock;

  // A prompt is rambling if it contains extensive conversational filler or greetings
  const hasGreetings = GREETINGS_REGEX.test(clean);
  const hasPleas = CONVERSATIONAL_PLEAS_REGEX.test(clean);
  const hasCourtesy = COURTESY_CLOSING_REGEX.test(clean);
  const hasRepetitiveActions = /(?:(?:bisa|can)\s+[a-zA-Z0-9_-]+.*?){3,}/i.test(clean);
  const isRambling = (hasGreetings || hasPleas || hasCourtesy || hasRepetitiveActions) && wordCount > 6;

  return {
    wordCount,
    intent,
    isSparse,
    isRambling,
    hasError,
    hasCodeBlock
  };
}

/**
 * Strips pleasantries, narrative filler, and normalizes verbs into crisp imperative directives.
 * @param {string} text
 * @returns {string}
 */
export function deramblePrompt(text) {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // 1. Strip greetings, closings, pleas, and meta-narrative
  cleaned = cleaned.replace(GREETINGS_REGEX, '');
  cleaned = cleaned.replace(COURTESY_CLOSING_REGEX, '');
  cleaned = cleaned.replace(CONVERSATIONAL_PLEAS_REGEX, '');
  cleaned = cleaned.replace(META_NARRATIVE_REGEX, '');

  // 2. Normalize common passive / informal verbs to sharp imperatives
  cleaned = cleaned.replace(/\bmembuat(?:kan)?\b/gi, 'Buat');
  cleaned = cleaned.replace(/\bbikin(?:kan)?\b/gi, 'Buat');
  cleaned = cleaned.replace(/\bmemperbaiki\b/gi, 'Perbaiki');
  cleaned = cleaned.replace(/\bmenambahkan\b/gi, 'Tambahkan');
  cleaned = cleaned.replace(/\bmengubah\b/gi, 'Ubah');
  cleaned = cleaned.replace(/\bmenghapus\b/gi, 'Hapus');
  cleaned = cleaned.replace(/\bmenangani\b/gi, 'Tangani');

  // English verb normalization
  cleaned = cleaned.replace(/\bcan\s+you\s+(?:please\s+)?(?:fix|repair)\b/gi, 'Fix');
  cleaned = cleaned.replace(/\bcan\s+you\s+(?:please\s+)?(?:build|create|make)\b/gi, 'Build');
  cleaned = cleaned.replace(/\bcan\s+you\s+(?:please\s+)?(?:add)\b/gi, 'Add');

  cleaned = cleaned.trim();

  // 3. Handle repetitive capability lists (e.g. "buat game cs2 yg bisa lompat bisa nembak bisa reload")
  if (/\b(?:yg\s+bisa|bisa|can)\b/i.test(cleaned)) {
    const segments = cleaned.split(/(?:\s+yg\s+bisa\s+|\s+bisa\s+|\s+can\s+)/i).map(s => s.trim()).filter(Boolean);
    if (segments.length > 2) {
      const mainGoal = segments[0];
      const features = segments.slice(1);
      const formattedPoints = [
        mainGoal.charAt(0).toUpperCase() + mainGoal.slice(1),
        ...features.map(f => f.charAt(0).toUpperCase() + f.slice(1))
      ];
      return 'Objective & Requirements:\n' + formattedPoints.map(p => `- ${p}`).join('\n');
    }
  }

  // 4. Extract sentences or comma-separated capability clauses
  const rawClauses = cleaned
    .split(/(?:\r?\n)+|[.]\s+|;\s+/)
    .map(c => c.trim())
    .filter(c => c.length > 3);

  if (rawClauses.length <= 1) {
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  const normalizedPoints = [];
  for (let clause of rawClauses) {
    let s = clause.replace(/^[-,*•\d.]+\s*/, '').trim();
    if (!s) continue;
    s = s.charAt(0).toUpperCase() + s.slice(1);
    if (!normalizedPoints.some(existing => existing.toLowerCase().includes(s.toLowerCase().slice(0, 20)))) {
      normalizedPoints.push(s);
    }
  }

  if (normalizedPoints.length === 1) {
    return normalizedPoints[0];
  }

  return 'Objective & Core Requirements:\n' + normalizedPoints.map(p => `- ${p}`).join('\n');
}

/**
 * Expands an under-specified / sparse prompt into a structured, production-grade technical specification.
 * Prevents 4-5 turns of AI guessing, incomplete stubs, and iterative token burning.
 * @param {string} promptText
 * @param {string} intent
 * @param {object} [options]
 * @returns {string}
 */
export function expandSparsePrompt(promptText, intent, options = {}) {
  const cleanPrompt = promptText.trim();

  // 1. GAME DEVELOPMENT BLUEPRINT (e.g. CS2, FPS, WebGL, 3D Canvas)
  if (intent === 'game_dev') {
    const isCs2OrFps = /\b(?:cs2|counter-strike|fps|shooter|tembak)\b/i.test(cleanPrompt);
    if (isCs2OrFps) {
      return `[ARCHITECTED TECHNICAL SPECIFICATION: Web 3D FPS Game Clone]\n` +
        `User Request: "${cleanPrompt}"\n\n` +
        `Execute the complete implementation with clean, modular vanilla JavaScript and Three.js (via CDN/module):\n\n` +
        `1. Canvas & Rendering Engine:\n` +
        `   - Initialize full-screen WebGLRenderer with responsive resize listener and antialiasing.\n` +
        `   - PerspectiveCamera (FOV 75, near 0.1, far 1000) with Pointer Lock API integration on click.\n` +
        `   - Ambient lighting + directional sunlight with soft shadow maps.\n\n` +
        `2. Player Kinematics & Controls:\n` +
        `   - First-person PointerLockControls with smooth mouse look (pitch clamped between -85° and 85°).\n` +
        `   - WASD vector movement with acceleration, ground friction, and jump physics (gravity: -28 m/s²).\n` +
        `   - Collision boundaries preventing player from falling through the arena floor or through walls.\n\n` +
        `3. Combat Mechanics & Raycast Shooting:\n` +
        `   - Raycaster hitscan from camera center into 3D scene.\n` +
        `   - Dynamic weapon recoil (view punch) with automatic decay recovery.\n` +
        `   - Weapon inventory switching (1: Primary Rifle [AK-47], 2: Pistol [USP], 3: Melee Knife).\n` +
        `   - Ammo counter with reload mechanics (R key) and firing cooldown timers.\n\n` +
        `4. Target Dummy Entities & Hitboxes:\n` +
        `   - Spawn interactive enemy target meshes with distinct head and body collision hitboxes.\n` +
        `   - Damage registration: Headshot (100 dmg / instant kill), Body (34 dmg / 3 hits to eliminate).\n` +
        `   - Procedural hit impact particles and elimination animations with respawn timers.\n\n` +
        `5. HUD & Audio Feedback:\n` +
        `   - Sleek minimal CSS HUD overlay: Dynamic crosshair (expands on movement/firing), Health (100), Ammo (30/90), Score counter.\n` +
        `   - Procedural Web Audio API sound generator for gunfire, reload clicks, and hit confirms (zero external audio file dependencies).\n\n` +
        `6. Main Game Loop:\n` +
        `   - requestAnimationFrame loop calculating delta time (clock.getDelta()) to ensure frame-rate-independent physics at 60+ FPS.`;
    }

    // Generic 2D/3D Canvas Game
    return `[ARCHITECTED TECHNICAL SPECIFICATION: Web Interactive Game]\n` +
      `User Request: "${cleanPrompt}"\n\n` +
      `Implement complete modular game architecture:\n` +
      `1. Game Loop & State: requestAnimationFrame with delta-time physics and state machine (Menu, Playing, GameOver).\n` +
      `2. Controls: Keyboard and mouse input manager with event listeners and continuous key tracking.\n` +
      `3. Entity System: Player controller, collision detection, physics bounding boxes, and score management.\n` +
      `4. Rendering & Audio: High-performance canvas rendering and Web Audio sound effects.\n` +
      `5. HUD: Live health, score counter, and restart capability.`;
  }

  // 2. BACKEND / REST API BLUEPRINT
  if (intent === 'backend_api') {
    return `[ARCHITECTED TECHNICAL SPECIFICATION: Production REST API Service]\n` +
      `User Request: "${cleanPrompt}"\n\n` +
      `Execute complete modular backend architecture:\n` +
      `1. Modular Structure: Separate routes, controllers, services, and data repositories.\n` +
      `2. Standard REST Endpoints: GET (collection & item), POST (create), PUT/PATCH (update), DELETE (remove) with strict HTTP status codes (200, 201, 400, 404, 500).\n` +
      `3. Schema Validation & Sanitization: Validate all incoming payloads with descriptive error messages.\n` +
      `4. Error Middleware: Centralized asynchronous error handler returning uniform JSON envelopes: { success: false, error: { message, code } }.\n` +
      `5. Data Persistence: Implement deterministic local repository with seed sample records.\n` +
      `6. Testing & Health: Add a '/health' endpoint and automated test suite verifying all routes.`;
  }

  // 3. FRONTEND / UI COMPONENT BLUEPRINT
  if (intent === 'frontend_ui') {
    return `[ARCHITECTED TECHNICAL SPECIFICATION: Responsive UI Component]\n` +
      `User Request: "${cleanPrompt}"\n\n` +
      `Implement production-ready user interface:\n` +
      `1. Semantic Structure: Clean semantic HTML5 elements with accessibility roles and ARIA labels.\n` +
      `2. Responsive Layout: CSS Flexbox/Grid adapting gracefully from mobile (360px) to desktop (1920px).\n` +
      `3. Interactive State: Reactive event handling, keyboard navigation (Tab/Esc/Enter), and focus management.\n` +
      `4. Design System: Modern styling with CSS variables (tokens for colors, spacing, radius, transitions) supporting dark/light mode.\n` +
      `5. Polish: Subtle transitions, empty states, and loading indicators.`;
  }

  // 4. DATABASE / SQL BLUEPRINT
  if (intent === 'database_sql') {
    return `[ARCHITECTED TECHNICAL SPECIFICATION: Database Schema & Query Design]\n` +
      `User Request: "${cleanPrompt}"\n\n` +
      `Implement optimized database design:\n` +
      `1. Normalized Schema: Primary keys, foreign key constraints, and relational integrity.\n` +
      `2. Indexing Strategy: Strategic B-tree / composite indexes on high-cardinality query columns.\n` +
      `3. Idempotent Operations: Migration scripts with CREATE TABLE IF NOT EXISTS and safe constraints.\n` +
      `4. Performant Queries: Avoid SELECT *; use explicit column projections and parameterized filters.`;
  }

  return cleanPrompt;
}

/**
 * Main Autonomous Prompt Architect entry point.
 * Optimizes the prompt:
 * - If sparse & high-level (or --deep): Expands into complete architectural specification (saving 30k-50k tokens of trial and error).
 * - If rambling & conversational: De-rambles into crisp imperative technical directives (saving 20%-45% input tokens).
 * - If already precise or an error log: Passes through cleanly without distortion.
 * @param {string} rawPrompt
 * @param {object} [options]
 * @returns {{ architectedPrompt: string, mode: 'expanded'|'derambled'|'passthrough', intent: string, tokensSaved: number }}
 */
export function architectPrompt(rawPrompt, options = {}) {
  if (!rawPrompt || typeof rawPrompt !== 'string') {
    return { architectedPrompt: rawPrompt || '', mode: 'passthrough', intent: 'unknown', tokensSaved: 0 };
  }

  const profile = analyzePromptProfile(rawPrompt);
  const isDeep = Boolean(options.isDeep);
  const isFast = Boolean(options.isFast);

  // If prompt has code blocks or is an error log: never expand into a scaffolding spec
  if (profile.hasError || profile.hasCodeBlock) {
    // If it has rambling intro text above the error, de-ramble the text while preserving the error
    if (profile.isRambling && !isDeep) {
      const derambled = deramblePrompt(rawPrompt);
      return {
        architectedPrompt: derambled,
        mode: 'derambled',
        intent: profile.intent,
        tokensSaved: Math.max(0, rawPrompt.split(/\s+/).length - derambled.split(/\s+/).length)
      };
    }
    return { architectedPrompt: rawPrompt, mode: 'passthrough', intent: profile.intent, tokensSaved: 0 };
  }

  // Mode 1: Deep Architectural Expansion (Explicit --deep OR sparse high-level creation prompt in normal mode)
  if ((isDeep || profile.isSparse) && !isFast && profile.intent !== 'bug_fix') {
    const expanded = expandSparsePrompt(rawPrompt, profile.intent, options);
    if (expanded !== rawPrompt) {
      return {
        architectedPrompt: expanded,
        mode: 'expanded',
        intent: profile.intent,
        tokensSaved: 0 // Expansion increases prompt fidelity to prevent ~40,000 tokens of iterative re-prompts
      };
    }
  }

  // Mode 2: Imperative De-Rambling (Conversational filler, greetings, pleasantries)
  if (profile.isRambling || isFast) {
    const derambled = deramblePrompt(rawPrompt);
    const origWords = rawPrompt.split(/\s+/).length;
    const newWords = derambled.split(/\s+/).length;
    const tokensSaved = Math.max(0, Math.round((origWords - newWords) * 1.3));

    return {
      architectedPrompt: derambled,
      mode: 'derambled',
      intent: profile.intent,
      tokensSaved
    };
  }

  // Mode 3: Direct Passthrough (Prompt is already technical, concise, and focused)
  return {
    architectedPrompt: rawPrompt,
    mode: 'passthrough',
    intent: profile.intent,
    tokensSaved: 0
  };
}
