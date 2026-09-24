// src/prompt-architect.js - .0.0 Autonomous Prompt Architect & Dynamic Reprompter
import { resolveDesignSystem } from './design-intelligence.js';

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
  if (/\b(?:minecraft|voxel|sandbox|crafting)\b/i.test(clean)) {
    intent = 'voxel_minecraft';
  } else if (/\b(?:game|cs2|fps|shooter|canvas|three\.?js|webgl|phaser|permainan|arcade|player|weapon|flappy|snake|tetris|pong|pacman|chess|catur|mario|platformer)\b/i.test(clean)) {
    intent = 'game_dev';
  } else if (/\b(?:api|backend|rest|crud|endpoint|express|fastapi|nest|controller|route|microservice)\b/i.test(clean)) {
    intent = 'backend_api';
  } else if (/\b(?:dashboard|landing\s+page|ui|frontend|react|vue|component|modal|navbar|tailwind|html|css|trello|kanban|todo|spotify|ecommerce|shop|store|calculator|kalkulator|editor|aplikasi|app|web|website|web\s*app)\b/i.test(clean)) {
    intent = 'frontend_ui';
  } else if (/\b(?:database|sql|table|schema|migration|bigquery|postgres|mysql|sqlite|query)\b/i.test(clean)) {
    intent = 'database_sql';
  } else if (hasError || /\b(?:fix|debug|error|bug|broken|perbaiki|rusak|gagal)\b/i.test(clean)) {
    intent = 'bug_fix';
  }

  // A prompt is sparse if it asks to build/create a full system in < 25 words without technical specs
  const isCreationVerb = /\b(?:buat(?:kan)?|bikin|create|build|make|scaffold|duplikat|clone|cloning)\b/i.test(clean);
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

  // 0. VOXEL SANDBOX / MINECRAFT 3D BLUEPRINT
  const isMinecraftExplicit = /\b(?:minecraft|voxel|crafting|sandbox)\b/i.test(cleanPrompt);
  if (intent === 'voxel_minecraft' || isMinecraftExplicit) {
    return `[ARCHITECTED TECHNICAL SPECIFICATION: Web 3D Voxel Sandbox Game (Minecraft Clone)]\n` +
      `User Request: "${cleanPrompt}"\n\n` +
      `Execute the complete implementation using modern Three.js (via CDN/module) and vanilla JavaScript:\n\n` +
      `1. 3D Voxel Engine & World Generation:\n` +
      `   - PerspectiveCamera (FOV 75, near 0.1, far 1000) with WebGLRenderer, responsive resize listener, and antialiasing.\n` +
      `   - Procedural terrain generation using heightmap algorithms producing rolling hills, plains, and stone foundation layers.\n` +
      `   - Spatial 3D coordinate mapping storing voxel positions and block types (Grass, Dirt, Stone, Wood, Cobblestone).\n` +
      `   - Textured / multi-colored voxel cube meshes with distinct Grass top/sides, Dirt, Stone, Wood, and Cobblestone materials.\n\n` +
      `2. Mining & Building Mechanics (Voxel Raycasting):\n` +
      `   - Center-screen Raycaster tracking target block with dynamic wireframe outline highlighting the hovered block.\n` +
      `   - Left-Click (Break/Mine): Instant block removal from 3D world with procedural particle burst and inventory update.\n` +
      `   - Right-Click (Place/Build): Attach selected hotbar block onto the target face using intersection face normal (intersection.face.normal).\n\n` +
      `3. Player Physics, Kinematics & Controls:\n` +
      `   - First-person PointerLockControls with click-to-play instructions overlay.\n` +
      `   - WASD vector movement with ground friction, acceleration, and Sprint (Shift key).\n` +
      `   - Gravity (-30 m/s²) and Jump physics (Spacebar).\n` +
      `   - Voxel AABB collision detection preventing player from falling through the world floor or walking through solid blocks.\n\n` +
      `4. Inventory Hotbar & Dynamic HUD:\n` +
      `   - Sleek bottom HUD hotbar with 5 active slots: [1] Grass, [2] Dirt, [3] Stone, [4] Wood, [5] Cobblestone.\n` +
      `   - Active slot selection via 1-5 number keys and mouse scroll wheel with glowing visual border indicator.\n` +
      `   - Centered minimal crosshair (+).\n\n` +
      `5. Environment & Procedural Web Audio:\n` +
      `   - Dynamic sky background with procedural directional sunlight creating depth and soft shadows.\n` +
      `   - Procedural Web Audio API sound generator producing audio clicks and pops for block placement and mining (zero external audio file dependencies).\n\n` +
      `6. Main 60 FPS Game Loop:\n` +
      `   - High-performance requestAnimationFrame loop calculating delta time (clock.getDelta()) to guarantee smooth frame-rate-independent physics.`;
  }

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

    // 2D Arcade & Board Game Blueprint (Flappy Bird, Snake, Tetris, Pacman, Chess, etc.)
    const is2dArcade = /\b(?:flappy|bird|snake|tetris|pong|pacman|arkanoid|breakout|space\s*invaders|catur|chess|2d|arcade)\b/i.test(cleanPrompt);
    if (is2dArcade) {
      return `[ARCHITECTED TECHNICAL SPECIFICATION: Web 2D Arcade Game]\n` +
        `User Request: "${cleanPrompt}"\n\n` +
        `Implement complete modular 2D HTML5 Canvas game with clean vanilla JavaScript:\n\n` +
        `1. Canvas Rendering & Scaling:\n` +
        `   - High-DPI crisp Canvas setup (handling devicePixelRatio) with auto-centering and letterboxing.\n` +
        `   - Clean 60 FPS requestAnimationFrame game loop with delta-time physics and pause/resume capability.\n\n` +
        `2. Entity & Physics Engine:\n` +
        `   - Player entity with velocity, acceleration, gravity, or grid-step kinematics.\n` +
        `   - Obstacle / enemy / piece spawner with bounding-box (AABB) or grid collision detection.\n` +
        `   - Score, combo multiplier, difficulty progression scaling over time, and High Score persistence in localStorage.\n\n` +
        `3. Controls & Input Handling:\n` +
        `   - Responsive keyboard (Arrows, WASD, Space), mouse/pointer, and mobile touch tap/swipe support.\n` +
        `   - Prevent default browser scrolling on game keys (Space, Arrow keys).\n\n` +
        `4. Visual FX & Procedural Audio:\n` +
        `   - Particle effect generator for explosions, collisions, and score pickups.\n` +
        `   - Procedural Web Audio API sound synthesizer (jump beep, coin ding, game-over crash) with zero external audio dependencies.\n\n` +
        `5. Game State Machine & HUD:\n` +
        `   - Distinct states: Start Menu, Playing, Paused, and Game Over screen with instant restart (Space/R key or tap).`;
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

  // 3. FRONTEND & FULL-STACK WEB APPLICATION BLUEPRINT (2026 Modern Design Standard)
  if (intent === 'frontend_ui') {
    const ds = resolveDesignSystem(cleanPrompt, intent);
    const isWebAppClone = /\b(?:clone|cloning|duplikat|saas|trello|kanban|spotify|ecommerce|shop|store)\b/i.test(cleanPrompt)
      || (/\b(?:app|aplikasi)\b/i.test(cleanPrompt) && !/\b(?:layout|component|navbar|modal)\b/i.test(cleanPrompt));
    if (isWebAppClone) {
      return `[ARCHITECTED TECHNICAL SPECIFICATION: Production Interactive Web Application - 2026 Modern Design Standard]\n` +
        `User Request: "${cleanPrompt}"\n\n` +
        `Execute complete implementation with modern 2026 web design standards, clean HTML5, CSS3, and vanilla JavaScript:\n\n` +
        `1. 2026 Modern Visual Design System & Aesthetics (${ds.category}):\n` +
        `   - Design Pattern & Style: ${ds.pattern} with ${ds.style}.\n` +
        `   - Color Palette Tokens: Background (${ds.palette.bg}), Surfaces (${ds.palette.surface}), Borders (${ds.palette.border}), Primary Accent (${ds.palette.primary}), Text (${ds.palette.text}), Muted (${ds.palette.muted}).\n` +
        `   - Contemporary Typography: High-legibility sans-serif stack (${ds.typography}), gradient hero headings (linear-gradient(135deg, #ffffff 0%, #94a3b8 100%)), and uppercase tracked badge pills.\n` +
        `   - Key Visual Effects: ${ds.keyEffects}.\n` +
        `   - Anti-Dated Guarantee: Strictly NO default unstyled HTML tables, NO plain gray backgrounds, NO standard browser blue buttons. Every component must be refined with custom sleek scrollbars, rounded geometry (border-radius: 8px to 14px), and inline SVGs.\n` +
        `   - Strict Anti-Patterns: ${ds.antiPatterns}.\n\n` +
        `2. Micro-Interactions, Motion & Feedback:\n` +
        `   - Hardware-accelerated smooth transitions (transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)).\n` +
        `   - Hover lift effects (transform: translateY(-2px)) and tactile button press depression (transform: scale(0.98)).\n` +
        `   - Elegant non-blocking toast notifications (auto-dismissing after 3s) for all user actions instead of primitive alert().\n` +
        `   - Glassmorphic modal dialog with backdrop blur (Escape key and outside-click dismiss).\n\n` +
        `3. Responsive Fluid Layout & Navigation:\n` +
        `   - Sticky / floating top navigation bar with brand badge, search/filter input, and quick action buttons.\n` +
        `   - Fluid CSS Grid / Flexbox layout adapting seamlessly from 360px mobile viewports to ultra-wide displays without horizontal scroll.\n\n` +
        `4. Reactive State Management & Local Persistence:\n` +
        `   - Centralized reactive state store managing user entities, active views, search queries, and filter states.\n` +
        `   - Automatic localStorage synchronization ensuring full data persistence across browser reloads with pre-seeded initial records.\n\n` +
        `5. Core Functional Mechanisms & Full CRUD:\n` +
        `   - Full CRUD operations (Create, Read, Update, Delete) with instant DOM updates.\n` +
        `   - Real-time search filter and category pills with live count indicators.\n` +
        `   - Empty state placeholders with clean SVG graphics when items or search results are empty.\n\n` +
        `6. Zero-Stub Production Guarantee:\n` +
        `   - 100% complete, runnable, standalone code ready to view in browser immediately with zero dependencies.`;
    }

    return `[ARCHITECTED TECHNICAL SPECIFICATION: 2026 Ultra-Modern Responsive UI Component - ${ds.category}]\n` +
      `User Request: "${cleanPrompt}"\n\n` +
      `Implement production-ready user interface with 2026 design excellence:\n` +
      `1. Semantic Structure: Clean semantic HTML5 elements with accessibility roles and ARIA labels adapting from mobile (360px) to ultra-wide.\n` +
      `2. Responsive Layout: Responsive Flexbox/Grid adapting gracefully across viewports without horizontal overflow.\n` +
      `3. Design System & 2026 Aesthetics: ${ds.style}. Color Tokens: bg=${ds.palette.bg}, surface=${ds.palette.surface}, border=${ds.palette.border}, primary=${ds.palette.primary}, text=${ds.palette.text}. Typography: ${ds.typography}.\n` +
      `4. Interactive State & Micro-Interactions: Reactive event handling, smooth hover transforms (translateY(-2px)), button active states, keyboard navigation (Tab/Esc/Enter), and non-blocking toast notifications.\n` +
      `5. Zero-Dated Polish: No default unstyled HTML elements, custom sleek scrollbars, gradient headings, and inline SVG icons.\n` +
      `6. Anti-Patterns: ${ds.antiPatterns}.`;
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

  // Universal Fallback for any sparse creation request (2026 Modern Standard)
  const isCreationVerb = /\b(?:buat(?:kan)?|bikin|create|build|make|scaffold|duplikat|clone|cloning)\b/i.test(cleanPrompt);
  if (isCreationVerb) {
    const ds = resolveDesignSystem(cleanPrompt, 'general');
    return `[ARCHITECTED TECHNICAL SPECIFICATION: 2026 Production Web Application - ${ds.category}]\n` +
      `User Request: "${cleanPrompt}"\n\n` +
      `Execute complete implementation with 2026 modern design standards:\n\n` +
      `1. 2026 Design System: ${ds.pattern} with ${ds.style}. Color tokens: bg=${ds.palette.bg}, surface=${ds.palette.surface}, border=${ds.palette.border}, primary=${ds.palette.primary}.\n` +
      `2. Responsive Fluid Layout: CSS Grid/Flexbox adapting gracefully from mobile to desktop without horizontal scroll.\n` +
      `3. State & Persistence: Centralized reactive state with localStorage persistence and pre-populated seed data.\n` +
      `4. Interactive Polish: Micro-interactions (hover lift, active press), non-blocking toast alerts, modal dialogs, and zero stubs.\n` +
      `5. Strict Anti-Patterns: ${ds.antiPatterns}.`;
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
