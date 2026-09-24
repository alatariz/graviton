// src/live-researcher.js - Graviton V5.1.1 Library Grounding & API Invariants Engine
// Ingests modern library specifications and ecosystem invariants.

export const GROUNDED_LIBRARY_REGISTRY = {
  tailwind_v4: {
    name: 'Tailwind CSS v4 (2026 Modern Standard)',
    triggers: ['tailwind', 'tailwindcss', 'tw4', 'tailwind v4', 'tailwind 4'],
    invariants: [
      'Tailwind v4 uses single CSS import: `@import "tailwindcss";` (NEVER use deprecated `@tailwind base; @tailwind components; @tailwind utilities;`).',
      'Configuration is CSS-first: Define theme tokens via `@theme { --color-brand: #...; }` rather than legacy `tailwind.config.js`.',
      'Container queries and color-mix() are native without external plugins.'
    ],
    verifiedCdn: 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4'
  },
  three_js: {
    name: 'Three.js Modern 3D WebGL Engine',
    triggers: ['threejs', 'three.js', 'three js', 'webgl', '3d canvas', 'three.min.js'],
    invariants: [
      'Use modern BoxGeometry, SphereGeometry, PlaneGeometry (NEVER use deprecated CubeGeometry).',
      'Color management: Use sRGB color space (`renderer.outputColorSpace = THREE.SRGBColorSpace`).',
      'Controls import: PointerLockControls and OrbitControls must be loaded via JSM module or official CDN bundle.',
      'Clock: Calculate delta time with `clock.getDelta()` inside requestAnimationFrame loop for frame-rate-independent physics.'
    ],
    verifiedCdn: 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
  },
  lucide_icons: {
    name: 'Lucide Modern SVG Iconography',
    triggers: ['lucide', 'icon', 'icons', 'feather', 'svg icon', 'iconography'],
    invariants: [
      'Render icons via `<i data-lucide="icon-name"></i>` and initialize with `lucide.createIcons()` after DOMContentLoaded.',
      'Always set explicit stroke-width (default 1.75px) and size (16px, 20px, 24px) for clean alignment.',
      'Provide fallback SVG paths or clean inline SVG for zero-dependency standalone bundling.'
    ],
    verifiedCdn: 'https://unpkg.com/lucide@latest'
  },
  chart_js: {
    name: 'Chart.js v4 Modern Visualization Engine',
    triggers: ['chart', 'chartjs', 'chart.js', 'grafik', 'candlestick', 'analytics graph'],
    invariants: [
      'Chart.js v4 requires registering controllers, elements, and scales or using auto bundle.',
      'Responsive option: Always specify `responsive: true, maintainAspectRatio: false` inside a relative positioned container.',
      'Dark mode colors: Set grid lines to `rgba(255, 255, 255, 0.08)` and label text to `#94a3b8`.'
    ],
    verifiedCdn: 'https://cdn.jsdelivr.net/npm/chart.js'
  },
  canvas_confetti: {
    name: 'Canvas Confetti Interactive FX',
    triggers: ['confetti', 'celebration', 'party', 'fireworks', 'selamat', 'reward'],
    invariants: [
      'Call `confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } })` on achievement milestones.',
      'Wrap in defensive try/catch check `typeof confetti === "function"` to prevent crashes if CDN is delayed.'
    ],
    verifiedCdn: 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
  }
};

/**
 * Detects matching library requirements from a user prompt or source code.
 * @param {string} promptText
 * @returns {Array<object>}
 */
export function detectGroundedLibraries(promptText = '') {
  const p = (promptText || '').toLowerCase();
  const matched = [];

  for (const [key, lib] of Object.entries(GROUNDED_LIBRARY_REGISTRY)) {
    if (lib.triggers.some(trig => p.includes(trig))) {
      matched.push({ key, ...lib });
    }
  }

  return matched;
}

/**
 * Synthesizes a Grounded Live Research directive block for AI prompt injection.
 * Overrides obsolete training cut-off weights with verified 2026 syntax invariants.
 *
 * @param {string} promptText
 * @returns {string}
 */
export function synthesizeGroundedResearchBlock(promptText = '') {
  const libs = detectGroundedLibraries(promptText);
  if (libs.length === 0) return '';

  const lines = [
    '=== [GRAVITON GROUNDED LIVE INTEL & 2026 API INVARIANTS] ===',
    'GROUNDING NOTICE: The following verified 2026 API standards override legacy pre-training training weights:'
  ];

  for (const lib of libs) {
    lines.push(`\n[LIBRARY: ${lib.name}]`);
    for (const inv of lib.invariants) {
      lines.push(`- ${inv}`);
    }
    if (lib.verifiedCdn) {
      lines.push(`- Verified Production CDN: ${lib.verifiedCdn}`);
    }
  }

  lines.push('\nStrict Constraint: Apply the exact modern invariants above. Do NOT use deprecated legacy syntax.');
  lines.push('===========================================================');

  return lines.join('\n');
}
