// src/skill-matrix.js - .0.0 Antigravity Skills & Trigger Matrix
// Enriched with high-leverage engineering skills distilled from Antigravity Godmode.

export const SKILL_TRIGGERS = [
  {
    keywords: ['ui', 'web', 'website', 'dashboard', 'landing', 'css', 'html', 'tailwind', 'component', 'modal', 'navbar', 'responsive', 'frontend', 'desain', 'tampilan', 'bento', 'design'],
    skill: 'ui-ux-pro-max & modern-web-guidance',
    directive: 'Enforce 2026 visual standards (Bento Grid, subtle glassmorphism, high-contrast accessible tokens, micro-interactions, zero-dated guarantee).'
  },
  {
    keywords: ['clean', 'refactor', 'srp', 'dry', 'kiss', 'struktur', 'rapihkan', 'rapikan', 'perbaiki kode', 'clean code'],
    skill: 'clean-code',
    directive: 'Apply Single Responsibility, guard clauses for edge cases, flat nesting (max 2 levels), and immutability with zero dead comments.'
  },
  {
    keywords: ['debug', 'bug', 'error', 'fix', 'crash', 'rusak', 'gagal', 'exception', 'stacktrace', 'traceback', 'perbaiki'],
    skill: 'systematic-debugging',
    directive: 'Follow scientific method: Reproduce -> Isolate minimal case -> Hypothesize root cause -> Test controlled fix. Never blindly guess.'
  },
  {
    keywords: ['performance', 'performa', 'lemot', 'slow', 'cepat', 'speed', 'optimize', 'optimasi', 'memory leak', 'lcp', 'inp'],
    skill: 'performance-profiling',
    directive: 'Optimize Core Web Vitals (LCP, INP, CLS), hardware-accelerated transforms, debounce/throttle handlers, and prevent layout thrashing.'
  },
  {
    keywords: ['api', 'rest', 'endpoint', 'backend', 'express', 'fastapi', 'nest', 'crud', 'controller'],
    skill: 'api-patterns',
    directive: 'Use standard REST status codes (200, 201, 400, 404, 500), payload validation, uniform error envelopes, and idempotent methods.'
  },
  {
    keywords: ['sql', 'database', 'table', 'query', 'migration', 'schema', 'sqlite', 'postgres', 'mysql', 'prisma', 'bigquery'],
    skill: 'database-design & bigquery-sql',
    directive: 'Enforce foreign key constraints, B-tree indexing on filter/join columns, avoid SELECT *, and safe idempotent migrations.'
  },
  {
    keywords: ['game', 'canvas', 'physics', 'threejs', 'three.js', 'webgl', 'flappy', 'minecraft', 'arcade'],
    skill: 'game-development',
    directive: 'Maintain 60 FPS requestAnimationFrame delta loop, AABB collision boundaries, and procedural Web Audio with zero external audio assets.'
  },
  {
    keywords: ['flutter', 'dart', 'widget', 'app', 'mobile'],
    skill: 'flutter-apply-architecture-best-practices',
    directive: 'Apply layered reactive Flutter architecture (UI, Domain, Data) and automated unit test mocks.'
  },
  {
    keywords: ['firebase', 'auth', 'firestore', 'login', 'token', 'rules'],
    skill: 'firebase-firestore & firebase-auth-basics',
    directive: 'Apply secure Firestore security rules and structured auth error handling.'
  },
  {
    keywords: ['test', 'unit test', 'jest', 'vitest', 'spec', 'coverage'],
    skill: 'automated-testing-patterns',
    directive: 'Execute complete test verification without mocks pollution or brittle selectors.'
  },
  {
    keywords: ['stitch', 'figma', 'prototype', 'screen'],
    skill: 'stitch-mcp',
    directive: 'Utilize Google Stitch MCP for high-fidelity component synchronization.'
  }
];

/**
 * Resolves active skills and directives based on keywords found in prompt text.
 * @param {string} rawPrompt
 * @returns {Array<{ skill: string, directive: string }>}
 */
export function resolveSkillDirectives(rawPrompt = '') {
  const promptLower = (rawPrompt || '').toLowerCase();
  const matched = [];
  const seenSkills = new Set();

  for (const item of SKILL_TRIGGERS) {
    if (item.keywords.some(kw => promptLower.includes(kw))) {
      if (!seenSkills.has(item.skill)) {
        seenSkills.add(item.skill);
        matched.push({ skill: item.skill, directive: item.directive });
      }
    }
  }

  return matched;
}

/**
 * Formats matched skill directives into a dense markdown block suitable for prompt injection.
 * @param {string} rawPrompt
 * @returns {string}
 */
export function formatSkillDirectivesBlock(rawPrompt = '') {
  const matched = resolveSkillDirectives(rawPrompt);
  if (matched.length === 0) return '';

  const lines = [
    '=== [GRAVITON RELEVANT SKILL CAPABILITIES ACTIVATED] ===',
    ...matched.map(m => `- ${m.skill}: ${m.directive}`)
  ];

  return lines.join('\n');
}
