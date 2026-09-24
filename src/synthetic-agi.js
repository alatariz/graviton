// src/synthetic-agi.js - Graviton V5.1.1 Synthetic Metacognitive Reasoning Engine
// Principal architect reasoning through deterministic cognitive pipelines:
// 1. Socratic Dialectic (Thesis -> Antithesis -> Synthesis)
// 2. Teleological Backpropagation (Goal-First Inverse Specification & Definition of Done)
// 3. Neuro-Symbolic Invariants (Mathematical & State Invariants)
// 4. Token-Efficient Prefix Alignment (Zero-Cost Local Heuristics)

export const DOMAIN_ADVERSARIAL_CRITIQUES = {
  fullstack_web: {
    thesis: 'Deliver modular, responsive interactive web application with reactive state and visual design excellence.',
    antithesis: [
      'State-DOM Desynchronization: Frequent state updates without reactive render triggers cause UI stale states.',
      'Data Loss on Reload: Lack of deterministic persistence causes immediate state loss on refresh.',
      'Accessibility & Viewport Breakages: Layout breaks on mobile (<400px); keyboard navigation traps modal focus.',
      'Unescaped Input Vulnerabilities: Rendering raw text in innerHTML risks client-side XSS injection.'
    ],
    synthesis: 'Bind centralized state to reactive render cycle; auto-sync to localStorage; enforce responsive fluid grid; sanitize all dynamic user injections with textContent/DOM methods.'
  },
  backend_api: {
    thesis: 'Provide high-throughput, modular REST/service backend with standard status envelopes.',
    antithesis: [
      'Unhandled Asynchronous Rejections: Missing async error middleware causes Node process termination.',
      'Payload Structure Vulnerability: Processing unvalidated payloads causes runtime TypeError / undefined property access.',
      'CORS & Security Misconfigurations: Missing headers block local browser client integration.'
    ],
    synthesis: 'Wrap all route handlers in centralized async error handler; validate and sanitize all payloads at boundary; configure standard CORS and JSON headers.'
  },
  voxel_game: {
    thesis: 'Implement immersive 3D/canvas interactive environment with smooth player controller and physics.',
    antithesis: [
      'Collision Tunneling: High-velocity frame steps cause camera/player to fall through terrain meshes.',
      'External Asset 404s: Relying on remote textures or audio files causes silent rendering failures offline.',
      'PointerLock Disconnect: Lost mouse lock without resume overlay creates unrecoverable game state.'
    ],
    synthesis: 'Clamp delta physics with discrete bounding box raycasts; generate procedural canvas pixel textures & Web Audio oscillators; attach resume click handlers.'
  },
  database_sql: {
    thesis: 'Construct performant, normalized relational schema and optimized query projection.',
    antithesis: [
      'Full Table Scans: Missing indexes on high-cardinality foreign keys cause O(N) linear query cost.',
      'Migration Destructiveness: Non-idempotent scripts fail on rerun or risk data dropping.'
    ],
    synthesis: 'Apply B-Tree indexes to all join/filter keys; generate strictly idempotent CREATE TABLE IF NOT EXISTS migrations with foreign key constraints.'
  },
  auth_security: {
    thesis: 'Implement secure authentication, session management, and role-based authorization.',
    antithesis: [
      'Token Storage Insecurity: Storing unencrypted sensitive tokens in accessible global state.',
      'Session Expiration Trap: Missing token refresh or expiration handling stalls user workflows.'
    ],
    synthesis: 'Implement cryptographically secure token validation; handle expiration with clean re-authentication states; isolate credentials from DOM exposure.'
  },
  general: {
    thesis: 'Execute production-ready, modular system according to exact user requirements.',
    antithesis: [
      'Ambiguity & Partial Mock Implementation: Writing placeholders (// TODO) instead of complete logic.',
      'Silent Failure Modes: Suppressing exceptions with empty catch blocks without recovery.'
    ],
    synthesis: 'Enforce zero-stub completeness guarantee; implement explicit error boundaries and deterministic logging.'
  }
};

/**
 * Detects domain critique category from user prompt and architect intent.
 * @param {string} promptText
 * @param {string} intent
 * @returns {string}
 */
export function resolveCritiqueDomain(promptText = '', intent = 'general') {
  const p = (promptText || '').toLowerCase();

  if (/\b(?:auth|login|jwt|session|password|token|credential|security)\b/.test(p)) {
    return 'auth_security';
  }
  if (/\b(?:minecraft|voxel|crafting)\b/.test(p) || (/\b(?:threejs|three\.?js|webgl|3d)\b/.test(p) && /\b(?:game|scene|world|canvas)\b/.test(p)) || intent === 'voxel_minecraft') {
    return 'voxel_game';
  }
  if (/\b(?:sql|database|table|query|migration|schema|sqlite|postgres)\b/.test(p) || intent === 'database_sql') {
    return 'database_sql';
  }
  if (/\b(?:api|endpoint|backend|server|express|rest|route|controller)\b/.test(p) || intent === 'backend_api') {
    return 'backend_api';
  }
  if (/\b(?:web|ui|dashboard|frontend|app|clone|component|page|css|html|tampilan|game)\b/.test(p) || intent === 'frontend_ui' || intent === 'game_dev') {
    return 'fullstack_web';
  }
  return 'general';
}

/**
 * Executes a Triadic Socratic Dialectic (Thesis -> Antithesis -> Synthesis).
 * Resolves architectural and logical edge-cases locally before sending prompt to AI model.
 * 
 * @param {string} promptText
 * @param {string} intent
 * @param {object} [options={}]
 * @returns {{ thesis: string, antithesis: string[], synthesis: string, formattedBlock: string }}
 */
export function executeSocraticDialectic(promptText = '', intent = 'general', options = {}) {
  const domain = resolveCritiqueDomain(promptText, intent);
  const critique = DOMAIN_ADVERSARIAL_CRITIQUES[domain] || DOMAIN_ADVERSARIAL_CRITIQUES.general;

  const lines = [
    `[SOCRATIC DIALECTIC RESOLUTION - DOMAIN: ${domain.toUpperCase()}]`,
    `1. THESIS: ${critique.thesis}`,
    `2. ANTITHESIS (CRITICAL FAILURE MODES NEUTRALIZED):`,
    ...critique.antithesis.map(a => `   - ${a}`),
    `3. SYNTHESIS (MANDATORY INVARIANT): ${critique.synthesis}`
  ];

  return {
    domain,
    thesis: critique.thesis,
    antithesis: critique.antithesis,
    synthesis: critique.synthesis,
    formattedBlock: lines.join('\n')
  };
}

/**
 * Generates a Teleological Definition of Done (Goal-First Inverse Specification).
 * Defines the mathematical invariants, testable acceptance criteria, and completion bounds.
 *
 * @param {string} promptText
 * @param {string} intent
 * @param {object} [options={}]
 * @returns {{ acceptanceCriteria: string[], invariants: string[], formattedBlock: string }}
 */
export function generateTeleologicalContract(promptText = '', intent = 'general', options = {}) {
  const domain = resolveCritiqueDomain(promptText, intent);

  const criteria = [
    'Executable Completeness: 100% of declared modules, functions, and handlers must be fully implemented with zero stubs or placeholders.',
    'Testable Assertions: Every primary user action must produce verifiable state transitions and deterministic feedback.',
    'Offline & Dependency Resiliency: Zero external runtime network dependencies (fonts/images/audio must be procedural or local).',
    'Error Containment: All asynchronous operations and user inputs must have explicit try/catch or boundary fallbacks.'
  ];

  const invariants = [
    '∀ action ∈ UserActions: state_transition_deterministic(action) == true',
    '∀ error ∈ ExpectedErrors: caught_by_boundary(error) ∧ user_notified(error) == true',
    '∀ asset ∈ RequiredAssets: is_procedural_or_local(asset) == true'
  ];

  const lines = [
    `[TELEOLOGICAL DEFINITION OF DONE (GOAL-FIRST INVERSE SPECIFICATION)]`,
    `Acceptance Assertions:`,
    ...criteria.map((c, idx) => `   [A${idx + 1}] ${c}`),
    `Formal State Invariants:`,
    ...invariants.map(inv => `   ${inv}`)
  ];

  return {
    domain,
    acceptanceCriteria: criteria,
    invariants,
    formattedBlock: lines.join('\n')
  };
}

/**
 * Compresses cognitive specification into high-density neuro-symbolic notation.
 * Strips conversational fluff while maximizing transformer attention adherence.
 *
 * @param {string} text
 * @returns {string}
 */
export function compressToNeuroSymbolic(text = '') {
  if (!text || typeof text !== 'string') return '';

  return text
    .replace(/\bplease\s+(?:ensure|make sure|note that|remember to)\b/gi, 'ENFORCE:')
    .replace(/\bit is strictly forbidden to\b/gi, 'NEVER:')
    .replace(/\bmake sure to fully implement\b/gi, 'COMPLETE:')
    .replace(/\bwithout any errors or bugs\b/gi, 'ZERO_DEFECTS:')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Synthesizes the full .0.0 Synthetic AGI Cognitive Harness.
 * Combines Socratic Dialectic and Teleological Verification into a single zero-token local harness.
 *
 * @param {string} promptText
 * @param {string} intent
 * @param {object} [options={}]
 * @returns {{ harness: string, dialectic: object, teleology: object, tokenEstimate: number }}
 */
export function synthesizeAgiCognitiveHarness(promptText = '', intent = 'general', options = {}) {
  const dialectic = executeSocraticDialectic(promptText, intent, options);
  const teleology = generateTeleologicalContract(promptText, intent, options);

  const harness = [
    '=== [.0.0 SYNTHETIC AGI METACOGNITIVE HARNESS] ===',
    dialectic.formattedBlock,
    '',
    teleology.formattedBlock,
    '============================================================='
  ].join('\n');

  const tokenEstimate = Math.ceil(harness.length / 4);

  return {
    harness,
    dialectic,
    teleology,
    tokenEstimate
  };
}
