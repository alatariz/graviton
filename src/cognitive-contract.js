// src/cognitive-contract.js - Graviton V3.6.0 Cognitive Execution Contract & Gemini Overclock Engine

/**
 * Domain-specific critical failure modes and edge cases.
 * Pre-emptively injecting these guards into the prompt prevents 3-5 turns of debugging loops.
 */
export const DOMAIN_EDGE_CASES = {
  voxel_minecraft: [
    'Collision & Tunneling: Clamp player velocity and use AABB voxel collision so the player never falls through the floor or glitches through block corners.',
    'Pointer Lock Lifecycle: Handle pointerlockchange and pointerlockerror events gracefully; show a click-to-play overlay when pointer lock is lost.',
    'Voxel Face Normal Raycasting: Ensure right-click placement uses the intersection face normal (intersection.face.normal) so blocks attach to the correct exterior surface.',
    'Procedural Canvas Textures (Zero 404s): Generate 16x16 pixel-art canvas textures for Grass, Dirt, Stone, and Wood procedurally; never rely on missing external texture PNG files.',
    'Canvas Resizing: Dynamically update camera aspect ratio and renderer size on window resize events to eliminate aspect distortion.',
    'Audio Synthesis Fallback: Unlock Web Audio AudioContext on first user gesture to prevent browser autoplay policy blocks, synthesizing sound clicks procedurally.'
  ],
  game_dev: [
    'Frame-rate Independence: Multiply all movement, physics, and animations by delta time (clock.getDelta()) to guarantee consistent gameplay across 60Hz, 120Hz, and 144Hz displays.',
    'Procedural Assets (Zero 404s): Use HTML5 Canvas pixel-art or procedural vector shapes for sprites; never rely on external image/audio files that trigger 404 errors.',
    'Procedural Web Audio: Generate sound effects (pew, jump, hit, explosion) using Web Audio API oscillators and gain envelopes with zero external audio assets.',
    'Memory Leak Prevention: Dispose unused geometries, materials, and textures when removing entities from the scene.',
    'Input Key Tracking: Use a Set or map of currently pressed keys to handle simultaneous multi-key presses (e.g. W + Space for running jump) without stutter.',
    'Canvas Boundary Clamping: Prevent entities or player camera from moving outside the playable arena boundaries.'
  ],
  backend_api: [
    'Unhandled Promise Rejection: Wrap all asynchronous route handlers in try/catch or an async error boundary to prevent server crashes.',
    'Input Validation: Strictly validate request params and bodies before processing; return 400 Bad Request with informative error fields.',
    'CORS & Security Headers: Configure permissive CORS for local dev testing while maintaining clean JSON headers.',
    'State Idempotency: Ensure ID generation (e.g. crypto.randomUUID) is deterministic or conflict-free.'
  ],
  frontend_ui: [
    'Responsive Viewport Overflow: Use overflow-x: hidden on root containers and test layouts down to 360px mobile widths.',
    'Accessibility & Keyboard Traps: Provide visible focus rings, ARIA labels for icon-only buttons, and Esc key handlers on modal overlays.',
    'Hydration & DOM State: Check element existence before attaching event listeners to avoid "Cannot read properties of null".'
  ],
  database_sql: [
    'SQL Injection Defense: Use parameterized queries for all dynamic variables.',
    'Connection Leaks: Release database clients back to the pool in a finally block.',
    'Index Coverage: Ensure filtered and joined columns have corresponding indexes.'
  ],
  bug_fix: [
    'Root Cause Isolation: Fix the underlying source of the error rather than masking it with a superficial try/catch.',
    'Regression Prevention: Ensure existing working functionality and signatures remain intact.'
  ]
};

/**
 * Synthesizes domain-specific edge cases and architectural invariants based on intent.
 * @param {string} intent
 * @param {string} [promptText='']
 * @returns {string[]}
 */
export function synthesizeDomainEdgeCases(intent, promptText = '') {
  const isMinecraft = /\b(?:minecraft|voxel|crafting|sandbox|perlin|simplex)\b/i.test(promptText);
  if (isMinecraft || intent === 'voxel_minecraft') {
    return DOMAIN_EDGE_CASES.voxel_minecraft;
  }

  if (DOMAIN_EDGE_CASES[intent]) {
    return DOMAIN_EDGE_CASES[intent];
  }

  return [
    'Production Completeness: Ensure all modules, imports, and functions are fully implemented with zero stubs.',
    'Defensive Boundaries: Guard against undefined/null arguments and handle error states gracefully.'
  ];
}

/**
 * Builds the Zero-Stub Cognitive Execution Contract.
 * Injected automatically by default to force Gemini Flash and Pro to produce first-turn complete code.
 * @param {object} [options={}]
 * @returns {string}
 */
export function buildCognitiveContract(options = {}) {
  const lines = [
    '=== [GRAVITON COGNITIVE EXECUTION CONTRACT: ZERO-STUB & PRODUCTION-READY] ===',
    '1. ZERO-STUB MANDATE: You are strictly forbidden from writing placeholder comments (e.g. "// TODO", "/* implement later */", "..."), omitting function bodies, or delivering partial mock implementations.',
    '2. 100% COMPLETE & RUNNABLE: Every file created or updated must be completely realized with full working logic, necessary imports, and state handlers so the project runs immediately upon generation.',
    '3. DEFENSIVE ERROR BOUNDARIES: All asynchronous operations, event handlers, and data parsing must include defensive safeguards and error boundaries to prevent runtime crashes.',
    '4. MACHINE-VERIFIABLE QUALITY: Focus 100% of reasoning and generation tokens on clean, elegant, modular implementation. Deliver exact working files ready for production.'
  ];

  return lines.join('\n');
}

/**
 * Formats prompt sections into a deterministic layout optimized for LLM KV prompt caching.
 * By keeping static immutable tokens (system directives, workspace boundaries, cognitive contracts)
 * anchored at the top, providers like Gemini, Claude, and OpenAI reuse KV caches across turns,
 * delivering 50-75% token cost reductions and 2-3x faster response times.
 *
 * @param {object} params
 * @param {string} params.systemDirective
 * @param {string} params.workspaceBlock
 * @param {string} params.cognitiveContract
 * @param {string} params.domainInvariants
 * @param {string} params.injectedFilesBlock
 * @param {string} params.userInstruction
 * @returns {string}
 */
export function formatDeterministicCachePrompt({
  systemDirective = '',
  workspaceBlock = '',
  cognitiveContract = '',
  domainInvariants = '',
  injectedFilesBlock = '',
  userInstruction = ''
}) {
  const blocks = [];

  // Anchor 1: Static System Directives (Frozen Prefix)
  if (systemDirective) {
    blocks.push(`[SYSTEM DIRECTIVE]: "${systemDirective}"`);
  }

  // Anchor 2: Project Workspace Context & Ignore Shields
  if (workspaceBlock) {
    blocks.push(workspaceBlock);
  }

  // Anchor 3: Cognitive Contract & Domain Edge-Case Guarantees
  if (cognitiveContract) {
    blocks.push(cognitiveContract);
  }
  if (domainInvariants) {
    blocks.push(`=== [PRE-EMPTIVE DOMAIN SAFETY & EDGE-CASE INVARIANTS] ===\n${domainInvariants}`);
  }

  // Anchor 4: Auto-Injected Files / AST Skeletons (if any)
  if (injectedFilesBlock && injectedFilesBlock.trim()) {
    blocks.push(injectedFilesBlock.trim());
  }

  // Anchor 5: Dynamic Tail (User Request & Error Trace)
  // Placing dynamic turns at the end preserves cache hits for the entire prefix!
  blocks.push(`[USER INSTRUCTION & TARGET OBJECTIVE]:\n${userInstruction.trim()}`);

  return blocks.join('\n\n').replace(/\r\n/g, '\n').trim();
}
