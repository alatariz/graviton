// src/design-intelligence.js - Graviton V5.1.1 Design Intelligence Matrix
// Modern aesthetic standards, dynamic palettes, typography, and UI anti-patterns.

export const DESIGN_CATEGORIES = {
  fintech_crypto: {
    category: 'Fintech & Web3 Crypto',
    pattern: 'Conversion-Optimized & Data-Dense',
    style: 'Dark Mode (OLED) + Glassmorphism',
    palette: {
      bg: '#07090e',
      surface: 'rgba(14, 20, 32, 0.75)',
      border: 'rgba(56, 189, 248, 0.18)',
      primary: '#38bdf8', // Electric cyan
      success: '#10b981', // Emerald gain
      danger: '#ef4444',  // Coral loss
      text: '#f8fafc',
      muted: '#94a3b8'
    },
    typography: "system-ui, -apple-system, 'Inter', 'Geist', monospace for numbers",
    keyEffects: 'Real-time chart visualization, live pulse beacon badges, blur-16px frosted card backdrop',
    antiPatterns: 'Never use light blinding backgrounds, never omit security/trust indicators, avoid static layouts without numeric trends'
  },
  ecommerce_store: {
    category: 'Modern E-Commerce & Retail',
    pattern: 'Feature-Rich Product Showcase + Slide-over Drawer',
    style: 'Vibrant Modern Retail with Layered Surfaces',
    palette: {
      bg: '#0b0f19',
      surface: 'rgba(18, 24, 38, 0.85)',
      border: 'rgba(255, 255, 255, 0.1)',
      primary: '#6366f1', // Indigo modern
      accent: '#f59e0b',  // Amber rating
      success: '#10b981', // Green stock
      danger: '#f43f5e',  // Sale badge
      text: '#ffffff',
      muted: '#a1a1aa'
    },
    typography: "system-ui, -apple-system, 'Plus Jakarta Sans', 'Inter', sans-serif",
    keyEffects: 'Card hover elevation (translateY -4px), star rating breakdown, sticky cart badge counter, badge ribbons',
    antiPatterns: 'Never use flat unstyled tables, never use text-heavy product listings without high-contrast visual cards'
  },
  healthcare_wellness: {
    category: 'Healthcare, Clinic & Wellness',
    pattern: 'Trust-Driven & Accessible (WCAG-AAA)',
    style: 'Clean Clinical Modern with High Readability',
    palette: {
      bg: '#f8fafc',
      surface: '#ffffff',
      border: '#e2e8f0',
      primary: '#0284c7', // Medical trust blue
      secondary: '#0d9488', // Teal health
      success: '#16a34a',
      danger: '#dc2626',
      text: '#0f172a',
      muted: '#64748b'
    },
    typography: "system-ui, -apple-system, 'Plus Jakarta Sans', 'Inter', sans-serif (16px+ base font)",
    keyEffects: 'Gentle card shadow (0 4px 20px rgba(0,0,0,0.05)), doctor profile pills, booking modal, emergency highlight',
    antiPatterns: 'Strictly NEVER use dark cyberpunk neon or purple gaming gradients, never use low-contrast text below WCAG-AA standards'
  },
  saas_dashboard: {
    category: 'Modern SaaS & Analytics Dashboard',
    pattern: 'Bento Grid + Data-Dense Analytics',
    style: 'Glassmorphism + Modern Clean Bento',
    palette: {
      bg: '#090d16',
      surface: 'rgba(15, 23, 42, 0.75)',
      border: 'rgba(255, 255, 255, 0.08)',
      primary: '#38bdf8', // Sky
      accent: '#818cf8',  // Indigo
      success: '#10b981', // Emerald
      danger: '#ef4444',
      text: '#f8fafc',
      muted: '#94a3b8'
    },
    typography: "system-ui, -apple-system, 'Inter', 'Geist', sans-serif",
    keyEffects: 'Bento grid responsive layout, KPI metric cards with sparkline/trend pills, data table with filter/search pills',
    antiPatterns: 'Never build plain gray dashboards, never omit responsive breakpoints for mobile screens'
  },
  creative_portfolio: {
    category: 'Creative Portfolio & Agency',
    pattern: 'Storytelling-Driven & Case Study Showcase',
    style: 'Minimalist Editorial + Monochromatic High Contrast',
    palette: {
      bg: '#0a0a0a',
      surface: 'rgba(24, 24, 27, 0.8)',
      border: 'rgba(255, 255, 255, 0.12)',
      primary: '#fafafa',
      accent: '#d4d4d8',
      success: '#22c55e',
      danger: '#ef4444',
      text: '#ffffff',
      muted: '#a1a1aa'
    },
    typography: "system-ui, -apple-system, 'Cinzel', 'Playfair Display', 'Inter', sans-serif",
    keyEffects: 'Large hero typography (font-size 2.5rem+), smooth hover reveals, interactive case study preview modal, minimal border lines',
    antiPatterns: 'Never use generic corporate templates, never use childish pastel color palettes'
  },
  startup_landing: {
    category: 'Modern Startup Landing Page',
    pattern: 'Hero-Centric + Social Proof + Bento Grid + Interactive Demo',
    style: '2026 Aurora Glow & Glassmorphic Depth',
    palette: {
      bg: '#05070e',
      surface: 'rgba(15, 23, 42, 0.7)',
      border: 'rgba(255, 255, 255, 0.08)',
      primary: '#38bdf8', // Cyan
      accent: '#a855f7',  // Purple glow
      success: '#10b981',
      danger: '#f43f5e',
      text: '#ffffff',
      muted: '#94a3b8'
    },
    typography: "system-ui, -apple-system, 'Plus Jakarta Sans', 'Inter', sans-serif",
    keyEffects: 'Radial-gradient background glow, animated pill badge, 3-tier Bento Grid features, interactive tabs/preview, pricing monthly/annual toggle',
    antiPatterns: 'Never create static text-only landing pages, avoid cluttered non-responsive navigation'
  }
};

/**
 * Resolves the optimal 2026 design system based on prompt content and category intent.
 * @param {string} promptText
 * @param {string} [intent='general']
 * @returns {object}
 */
export function resolveDesignSystem(promptText = '', intent = 'general') {
  const p = (promptText || '').toLowerCase();

  // 1. Healthcare / Clinic / Wellness
  if (/\b(?:klinik|dokter|hospital|rumahsakit|medis|medical|kesehatan|health|clinic|dentist|gigi|farmasi|pharmacy|wellness|spa)\b/.test(p)) {
    return DESIGN_CATEGORIES.healthcare_wellness;
  }

  // 2. Fintech / Crypto / Trading
  if (/\b(?:crypto|bitcoin|trading|forex|wallet|fintech|saham|stock|kripto|investasi|investment|token|coin)\b/.test(p)) {
    return DESIGN_CATEGORIES.fintech_crypto;
  }

  // 3. E-commerce / Store / Retail / Shop
  if (/\b(?:toko|store|shop|ecommerce|e-commerce|belanja|produk|product|cart|keranjang|jual|beli|katalog|catalog|checkout)\b/.test(p)) {
    return DESIGN_CATEGORIES.ecommerce_store;
  }

  // 4. Creative Portfolio / Agency / Studio
  if (/\b(?:portfolio|portofolio|fotografi|photography|agency|studio|cv|resume|seniman|artist|desainer|designer)\b/.test(p)) {
    return DESIGN_CATEGORIES.creative_portfolio;
  }

  // 5. Landing Page / Startup
  if (/\b(?:landing\s*page|landingpage|startup|company\s*profile|promosi|waitlist|launch)\b/.test(p)) {
    return DESIGN_CATEGORIES.startup_landing;
  }

  // 6. Default to SaaS / Dashboard
  return DESIGN_CATEGORIES.saas_dashboard;
}

/**
 * Formats the selected design system into a dense, machine-verifiable technical directive.
 * @param {object} designSystem
 * @returns {string}
 */
export function formatDesignSystemSpecification(designSystem) {
  const d = designSystem;
  return [
    `=== [2026 UI/UX DESIGN INTELLIGENCE SPECIFICATION: ${d.category.toUpperCase()}] ===`,
    `Aesthetic Pattern: ${d.pattern}`,
    `Visual Style: ${d.style}`,
    `Color Tokens: bg=${d.palette.bg}, surface=${d.palette.surface}, border=${d.palette.border}, primary=${d.palette.primary}, text=${d.palette.text}, muted=${d.palette.muted}`,
    `Typography Stack: ${d.typography}`,
    `Key Visual Effects: ${d.keyEffects}`,
    `Strict Anti-Patterns: ${d.antiPatterns}`,
    `Quality Standard: Zero-Dated Guarantee. Never use default unstyled HTML tables, primitive alert(), or plain browser elements.`
  ].join('\n');
}
