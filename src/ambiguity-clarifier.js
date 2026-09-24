// src/ambiguity-clarifier.js - Graviton V5.1.1 Requirement Specification Clarifier
// Analyzes underspecified prompts and deterministically synthesizes technical constraints.

export const DOMAIN_PATTERNS = {
  AUTH: {
    triggers: ['auth', 'login', 'signup', 'register', 'jwt', 'session', 'password', 'user'],
    defaults: [
      'Auth Mechanism: Token-based stateless authentication or secure session cookies.',
      'Security: Enforce password hashing (bcrypt/argon2 or crypto) and input sanitization.',
      'Error Handling: Generic 401 Unauthorized response for failed attempts without user enumeration.'
    ]
  },
  DASHBOARD: {
    triggers: ['dashboard', 'analytics', 'chart', 'metric', 'grafik', 'visualisasi', 'admin'],
    defaults: [
      'UI Layout: Responsive grid with clean metric KPI cards and responsive charts.',
      'Data Binding: Reactive state management with defensive loading and empty states.',
      'Theme: High-contrast professional palette matching workspace design tokens.'
    ]
  },
  API: {
    triggers: ['api', 'endpoint', 'rest', 'crud', 'route', 'backend', 'service', 'controller'],
    defaults: [
      'Protocol: RESTful JSON over HTTP with standardized status codes (200, 201, 400, 404, 500).',
      'Validation: Strict boundary checking for query parameters and JSON payloads.',
      'Response Envelope: Consistent { success: boolean, data?: any, error?: string } shape.'
    ]
  },
  DATABASE: {
    triggers: ['database', 'db', 'sql', 'sqlite', 'schema', 'tabel', 'query', 'migration'],
    defaults: [
      'Storage Target: Lightweight zero-config embedded storage (SQLite or local JSON file storage).',
      'Integrity: Explicit foreign key constraints and defensive indexing on primary keys.',
      'Safety: Parameterized queries or prepared statements to prevent injection.'
    ]
  },
  GENERAL_UI: {
    triggers: ['web', 'page', 'halaman', 'ui', 'tampilan', 'modal', 'navbar', 'form'],
    defaults: [
      'Aesthetics: Clean modern typography, accessible contrast, and zero external framework lock-in.',
      'Interactivity: Native semantic HTML5 with declarative DOM event handling.',
      'Accessibility: Complete ARIA roles, keyboard navigation, and visible focus states.'
    ]
  }
};

/**
 * Analyze a prompt to determine ambiguity and missing architectural constraints.
 * @param {string} prompt - Raw user instruction
 * @returns {object} Ambiguity analysis result
 */
export function analyzePromptAmbiguity(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return {
      isAmbiguous: true,
      score: 100,
      wordCount: 0,
      domain: 'GENERAL_UI',
      missingDimensions: ['Full prompt specification missing'],
      recommendations: DOMAIN_PATTERNS.GENERAL_UI.defaults
    };
  }

  const cleanText = prompt.trim();
  const words = cleanText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const lower = cleanText.toLowerCase();

  // Identify domain
  let detectedDomain = 'GENERAL_UI';
  for (const [domKey, domMeta] of Object.entries(DOMAIN_PATTERNS)) {
    if (domMeta.triggers.some(t => lower.includes(t))) {
      detectedDomain = domKey;
      break;
    }
  }

  const missingDimensions = [];
  let score = 0;

  // Metric 1: Word Count (Short prompts are inherently ambiguous)
  if (wordCount <= 3) {
    score += 45;
    missingDimensions.push('Extreme brevity (less than 4 words)');
  } else if (wordCount <= 7) {
    score += 25;
    missingDimensions.push('Brief instruction with omitted edge-case parameters');
  }

  // Metric 2: Missing Technology/Runtime Specification
  const hasTech = /(?:node|express|fastify|react|vite|vue|html|css|tailwind|sqlite|postgres|mongodb|vanilla|vanillajs|threejs)/.test(lower);
  if (!hasTech) {
    score += 25;
    missingDimensions.push('Unspecified technology stack or runtime environment');
  }

  // Metric 3: Missing Contract / Error Handling Specification
  const hasContract = /(?:return|format|json|error|status|schema|validasi|validation|type)/.test(lower);
  if (!hasContract) {
    score += 20;
    missingDimensions.push('Unspecified return envelope or error handling contract');
  }

  // Metric 4: Vague generic verbs ("bikin", "buat", "fix", "update", "tambah") without detail
  if (/^(?:bikin|buat|buatkan|fix|perbaiki|tambah|update)\s+[a-zA-Z0-9_$]+$/i.test(cleanText)) {
    score += 20;
    missingDimensions.push('Overly generic directive lacking input/output boundaries');
  }

  score = Math.min(100, score);
  const isAmbiguous = score >= 40;
  const recommendations = DOMAIN_PATTERNS[detectedDomain].defaults;

  return {
    prompt: cleanText,
    isAmbiguous,
    score,
    wordCount,
    domain: detectedDomain,
    missingDimensions,
    recommendations
  };
}

/**
 * Synthesize a deterministic technical specification block to clarify ambiguous prompts.
 * @param {object} analysis - Result of analyzePromptAmbiguity
 * @returns {string} Injected specification block
 */
export function synthesizeClarifiedSpecificationBlock(analysis) {
  if (!analysis || !analysis.isAmbiguous) return '';

  const lines = [
    '=== [GRAVITON CLARIFIED ENGINEERING SPECIFICATION] ===',
    `Domain Detected      : ${analysis.domain}`,
    `Ambiguity Score      : ${analysis.score}/100 [Vague Prompt Intercepted]`,
    'Engineering Baseline Directives (Enforced to prevent hallucinations):'
  ];

  for (const rec of analysis.recommendations) {
    lines.push(`  - ${rec}`);
  }

  lines.push('You MUST build according to these architectural constraints without unnecessary boilerplate.');
  lines.push('======================================================');

  return lines.join('\n');
}
