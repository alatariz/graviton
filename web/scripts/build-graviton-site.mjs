import fs from 'fs';
import path from 'path';
import vm from 'vm';

const repoDir = 'C:\\Users\\WINDOWS\\.gemini\\antigravity\\scratch\\gemini-token-saver';
const webDir = path.join(repoDir, 'web');
const publicDir = path.join(webDir, 'public');
const scratchDir = 'C:\\Users\\WINDOWS\\.gemini\\antigravity\\brain\\dc290864-05e3-4823-855f-a8cd29304c6b\\scratch';

console.log('=== Building Graviton Site: All User Fixes & Polish ===');

// Clean Inline SVGs (Lucide style) - ZERO EMOJIS
const icons = {
  zap: `<svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
  activity: `<svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>`,
  shield: `<svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  database: `<svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`,
  terminal: `<svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
  lock: `<svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`,
  cpu: `<svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>`,
  git: `<svg class="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M6 21V9a9 9 0 0 0 9 9"></path></svg>`,
  github: `<svg class="gh-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>`,
  external: `<svg class="icon-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`,
  chevron: `<svg class="chevron" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
  search: `<svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  arrowRight: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
  copy: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
};

// -------------------------------------------------------------
// Unified Sticky Navbar for both index.html and docs.html
// -------------------------------------------------------------
const sharedHeaderAndSearch = (activePage = 'product') => `
  <!-- GRAVITON STICKY FROSTED NAVBAR -->
  <header class="global-navbar site-header">
    <div class="nav-inner">
      <!-- LEFT: Logo + Frosted Search Pill -->
      <div class="nav-left">
        <a href="/" class="nav-logo-wrap" aria-label="Graviton Home">
          <img src="/icon.svg" alt="Graviton Atom Logo" width="28" height="28">
          <span class="nav-brand-text">GRAVITON</span>
        </a>
        <button class="nav-search-bar" onclick="openSearchModal()" aria-label="Search Documentation">
          ${icons.search}
          <span class="search-label">Search docs...</span>
        </button>
      </div>

      <!-- CENTER: Clean Navigation with Dropdown Hover Bridge -->
      <nav class="nav-center-links">
        <div class="nav-item has-dropdown ${activePage === 'product' ? 'active' : ''}">
          <a href="/#hero-showcase" class="nav-link">
            <span>Product</span>
            ${icons.chevron}
          </a>
          <div class="dropdown-menu">
            <a href="/#hero-showcase" class="dropdown-item">Architecture Overview</a>
            <a href="/#how-it-works" class="dropdown-item">The Problem</a>
            <a href="/#solution" class="dropdown-item">Core Specifications</a>
            <a href="/#action" class="dropdown-item">See It In Action</a>
            <a href="/#evidence" class="dropdown-item">Terminal Gains</a>
            <a href="/#impact" class="dropdown-item">Impact Metrics</a>
            <a href="/#get-started" class="dropdown-item">Installation</a>
            <a href="/#demo" class="dropdown-item">Interactive Studio</a>
          </div>
        </div>

        <div class="nav-item has-dropdown ${activePage === 'docs' ? 'active' : ''}">
          <a href="/docs.html" class="nav-link">
            <span>Docs</span>
            ${icons.chevron}
          </a>
          <div class="dropdown-menu">
            <a href="/docs.html#overview" class="dropdown-item">
              <span>Deep-Dive Docs</span>
            </a>
            <a href="/docs.html#architecture" class="dropdown-item">Core Architecture Pillars</a>
            <a href="/docs.html#file-hydration" class="dropdown-item">Zero-Token File Hydration</a>
            <a href="/docs.html#priority-sorting" class="dropdown-item">Smart Density Sorting</a>
            <a href="/docs.html#minified-shield" class="dropdown-item">The Minified Shield</a>
            <a href="/docs.html#shadow-backups" class="dropdown-item">Detached Shadow Backups</a>
            <a href="/docs.html#cli-quickstart" class="dropdown-item">CLI Quickstart</a>
            <a href="/docs.html#skill-matrix" class="dropdown-item">Skill Matrix</a>
            <a href="/docs.html#privacy" class="dropdown-item">Security &amp; Jail Boundary</a>
          </div>
        </div>

        <div class="nav-item has-dropdown">
          <a href="https://github.com/alatariz/graviton" class="nav-link">
            <span>Community</span>
            ${icons.chevron}
          </a>
          <div class="dropdown-menu dropdown-community">
            <a href="https://github.com/alatariz/graviton" target="_blank" rel="noopener noreferrer" class="dropdown-item">
              ${icons.github}
              <span>GitHub Repository</span>
            </a>
            <a href="https://github.com/alatariz/graviton/issues" target="_blank" rel="noopener noreferrer" class="dropdown-item">
              ${icons.external}
              <span>Report Issue</span>
            </a>
            <a href="https://github.com/alatariz/graviton/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" class="dropdown-item">
              ${icons.shield}
              <span>Apache-2.0 License</span>
            </a>
          </div>
        </div>
      </nav>

      <!-- RIGHT: GitHub Link & Action -->
      <div class="nav-right">
        <a href="https://github.com/alatariz/graviton" target="_blank" rel="noopener noreferrer" class="nav-gh-link" aria-label="GitHub Repository">
          ${icons.github}
          <span>GitHub</span>
        </a>

        <a href="/#get-started" class="btn-nav-install">
          <span>Install Graviton</span>
          ${icons.arrowRight}
        </a>
      </div>
    </div>
  </header>

  <!-- SEARCH SPOTLIGHT MODAL (Frosted Glass Pill) -->
  <dialog id="searchModal" class="search-modal">
    <div class="search-modal-content">
      <div class="search-modal-head">
        ${icons.search}
        <input type="text" id="spotlightInput" placeholder="Search architecture, specifications, commands..." autocomplete="off">
        <button type="button" class="btn-search-close" onclick="closeSearchModal()" aria-label="Close">ESC</button>
      </div>
      <div class="search-results-box" id="searchResultsList">
        <a href="/#solution" class="search-result-item" onclick="closeSearchModal()">
          <span class="res-icon-wrap">${icons.activity}</span>
          <div class="res-body">
            <div class="res-title">Core Specifications: Safe Pruning &amp; Jail</div>
            <div class="res-sub">Safe Pruning, Minified Shield, and Path Traversal Jail</div>
          </div>
          <span class="res-badge">Specs</span>
        </a>
        <a href="/#evidence" class="search-result-item" onclick="closeSearchModal()">
          <span class="res-icon-wrap">${icons.git}</span>
          <div class="res-body">
            <div class="res-title">Terminal Gains: 88.9% Efficiency</div>
            <div class="res-sub">130M tokens saved across daily developer runs</div>
          </div>
          <span class="res-badge">Gains</span>
        </a>
        <a href="/docs.html#file-hydration" class="search-result-item" onclick="closeSearchModal()">
          <span class="res-icon-wrap">${icons.zap}</span>
          <div class="res-body">
            <div class="res-title">Zero-Token File Hydration</div>
            <div class="res-sub">Local AST regex file matching and 500-line bounded hydration</div>
          </div>
          <span class="res-badge">Engine</span>
        </a>
        <a href="/docs.html#priority-sorting" class="search-result-item" onclick="closeSearchModal()">
          <span class="res-icon-wrap">${icons.cpu}</span>
          <div class="res-body">
            <div class="res-title">Smart Density Sorting</div>
            <div class="res-sub">Language-agnostic directory evaluation prioritizing code density</div>
          </div>
          <span class="res-badge">Map</span>
        </a>
        <a href="/docs.html#minified-shield" class="search-result-item" onclick="closeSearchModal()">
          <span class="res-icon-wrap">${icons.shield}</span>
          <div class="res-body">
            <div class="res-title">The Minified Shield</div>
            <div class="res-sub">Token bomb blocker intercepting .min.js/.min.css and massive JSON</div>
          </div>
          <span class="res-badge">Defense</span>
        </a>
        <a href="/docs.html#shadow-backups" class="search-result-item" onclick="closeSearchModal()">
          <span class="res-icon-wrap">${icons.database}</span>
          <div class="res-body">
            <div class="res-title">Detached Shadow Backups</div>
            <div class="res-sub">Zero-collateral Git safety with background OS garbage collection</div>
          </div>
          <span class="res-badge">Safety</span>
        </a>
        <a href="/docs.html#cli-quickstart" class="search-result-item" onclick="closeSearchModal()">
          <span class="res-icon-wrap">${icons.terminal}</span>
          <div class="res-body">
            <div class="res-title">CLI Quickstart: graviton &amp; grav</div>
            <div class="res-sub">Dual-command usage and quote-free terminal acceleration</div>
          </div>
          <span class="res-badge">CLI</span>
        </a>
      </div>
    </div>
  </dialog>
`;

// -------------------------------------------------------------
// Common Styles for Sticky Navbar and Modal
// -------------------------------------------------------------
const commonNavbarStyles = `
  /* FIXED / STICKY GLOBAL NAVBAR (STAYS WHILE SCROLLING) */
  .global-navbar,
  .site-header {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 64px !important;
    background: rgba(4, 7, 17, 0.92) !important;
    backdrop-filter: blur(24px) !important;
    -webkit-backdrop-filter: blur(24px) !important;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
    z-index: 1000 !important;
    box-sizing: border-box !important;
  }
  .nav-inner {
    max-width: 1400px;
    height: 100%;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .nav-left {
    display: flex;
    align-items: center;
    gap: 1.25rem;
  }
  .nav-logo-wrap {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    text-decoration: none !important;
    color: #ffffff !important;
  }
  .nav-brand-text {
    font-size: 0.95rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #ffffff;
  }
  .nav-search-bar {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    padding: 0.42rem 1.05rem;
    color: var(--text-dim, #94a3b8);
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }
  .nav-search-bar:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(0, 240, 255, 0.45);
    color: #ffffff;
    box-shadow: 0 0 24px rgba(0, 240, 255, 0.28);
    transform: translateY(-1px);
  }
  .nav-center-links {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .nav-item {
    position: relative;
  }
  .nav-link {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.85rem;
    font-size: 0.84rem;
    font-weight: 500;
    color: var(--text-dim, #94a3b8) !important;
    text-decoration: none !important;
    border-radius: 6px;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .nav-link:hover,
  .nav-item.active .nav-link {
    color: #ffffff !important;
    background: rgba(255, 255, 255, 0.04);
  }
  .dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    min-width: 200px;
    background: #0b1220;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 6px;
    box-shadow: 0 20px 45px rgba(0, 0, 0, 0.85), 0 0 1px rgba(0, 240, 255, 0.2);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 1010;
  }
  .dropdown-menu::before {
    content: '';
    position: absolute;
    top: -16px;
    left: 0;
    right: 0;
    height: 16px;
    background: transparent;
  }
  .nav-item:hover .dropdown-menu {
    opacity: 1;
    pointer-events: auto;
    transform: translateX(-50%) translateY(0);
  }
  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.5rem 0.85rem;
    font-size: 0.84rem;
    color: #94a3b8 !important;
    text-decoration: none !important;
    border-radius: 7px;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .dropdown-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #ffffff !important;
  }
  .nav-right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .nav-gh-link {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: #cbd5e1 !important;
    text-decoration: none !important;
    font-size: 0.84rem;
    font-weight: 500;
    transition: color 0.15s ease;
  }
  .nav-gh-link:hover { color: #ffffff !important; }
  .btn-nav-install {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid rgba(0, 240, 255, 0.4);
    background: rgba(0, 240, 255, 0.06);
    color: #00f0ff !important;
    padding: 0.4rem 1.15rem;
    border-radius: 9999px;
    font-size: 0.82rem;
    font-weight: 600;
    text-decoration: none !important;
    transition: all 0.25s ease;
  }
  .btn-nav-install:hover {
    background: #00f0ff !important;
    color: #040711 !important;
    box-shadow: 0 0 20px rgba(0, 240, 255, 0.4);
  }

  /* SEARCH SPOTLIGHT MODAL */
  .search-modal {
    margin: auto;
    background: transparent;
    border: none;
    padding: 0;
    max-width: 600px;
    width: 92vw;
  }
  .search-modal::backdrop {
    background: rgba(4, 7, 17, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .search-modal-content {
    background: #080e1e;
    border: 1px solid rgba(0, 240, 255, 0.3);
    border-radius: 16px;
    box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 240, 255, 0.15);
    overflow: hidden;
  }
  .search-modal-head {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 1.1rem 1.4rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .search-modal-head input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: #ffffff;
    font-size: 1rem;
    font-family: var(--font-sans, sans-serif);
  }
  .btn-search-close {
    font-family: var(--font-mono, monospace);
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
  }
  .search-results-box {
    max-height: 380px;
    overflow-y: auto;
    padding: 0.8rem;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .search-result-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: background 0.15s ease;
  }
  .search-result-item:hover {
    background: rgba(0, 240, 255, 0.08);
  }
  .res-icon-wrap {
    color: #00f0ff;
    display: flex;
    align-items: center;
  }
  .res-body {
    flex: 1;
  }
  .res-title {
    font-size: 0.9rem;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 0.15rem;
  }
  .res-sub {
    font-size: 0.75rem;
    color: #94a3b8;
  }
  .res-badge {
    font-family: var(--font-mono, monospace);
    font-size: 0.68rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    background: rgba(0, 240, 255, 0.1);
    color: #00f0ff;
    border: 1px solid rgba(0, 240, 255, 0.25);
  }
`;

// -------------------------------------------------------------
// BUILD INDEX.HTML
// -------------------------------------------------------------
function buildIndex() {
  let html = fs.readFileSync(path.join(scratchDir, 'original-index.html'), 'utf8');

  // 1. Replace navbar with sticky unified navbar
  const oldNavStart = html.indexOf('<header class="global-navbar">');
  const oldNavEnd = html.indexOf('</header>') + 9;
  if (oldNavStart !== -1 && oldNavEnd !== -1) {
    html = html.slice(0, oldNavStart) + sharedHeaderAndSearch('product') + html.slice(oldNavEnd);
  }

  // Remove old search modal dialog if present
  const oldSearchDialogStart = html.indexOf('<dialog id="searchModal"');
  if (oldSearchDialogStart !== -1) {
    const oldSearchDialogEnd = html.indexOf('</dialog>', oldSearchDialogStart) + 9;
    html = html.slice(0, oldSearchDialogStart) + html.slice(oldSearchDialogEnd);
  }

  // 2. Inject Styles before </style>
  const indexStyles = `
    ${commonNavbarStyles}

    /* BODY TOP PADDING TO CLEAR FIXED NAVBAR */
    body {
      padding-top: 64px !important;
    }

    /* HERO Z-INDEX RESOLUTION: Laser passes strictly BEHIND */
    .laser-line-axis {
      z-index: -1 !important;
      pointer-events: none !important;
    }
    .hero-top-stage {
      position: relative !important;
    }
    .hero-totem-wrap,
    .hero-pre-title,
    .hero-main-title,
    .hero-tagline,
    .btn-see-how {
      position: relative !important;
      z-index: 5 !important;
    }

    /* CRITICAL VISIBILITY FIX: NEVER HIDE CONTENT */
    .slide-reveal-left,
    .slide-reveal-right,
    .slide-reveal-up {
      opacity: 1 !important;
      transform: none !important;
      visibility: visible !important;
    }

    /* STRICT BI-DIRECTIONAL SCROLL SNAPPING */
    html {
      scroll-behavior: smooth !important;
      scroll-snap-type: y mandatory !important;
      scroll-padding-top: 64px !important;
    }
    .hero-top-stage,
    .section-stage-showcase,
    .section-stage-problem,
    .section-stage-solution,
    .section-stage-action,
    .section-stage-evidence,
    .section-stage-impact,
    .section-stage-get-started,
    .section-stage-studio,
    footer {
      scroll-snap-align: start !important;
      scroll-snap-stop: always !important;
      scroll-margin-top: 64px !important;
      box-sizing: border-box !important;
    }
  `;
  html = html.replace('</style>', indexStyles + '\n  </style>');

  // 3. Fix laser z-index in original style block
  html = html.replace(/(\.laser-line-axis\s*\{[^}]*z-index:\s*)1;/g, '$1-1 !important;');

  // 4. Overwrite slide-reveal classes in original style block so opacity is never 0
  html = html.replace(
    /\.slide-reveal-left\s*\{[^}]*\}/g,
    '.slide-reveal-left { opacity: 1 !important; transform: none !important; }'
  );
  html = html.replace(
    /\.slide-reveal-right\s*\{[^}]*\}/g,
    '.slide-reveal-right { opacity: 1 !important; transform: none !important; }'
  );
  html = html.replace(
    /\.slide-reveal-up\s*\{[^}]*\}/g,
    '.slide-reveal-up { opacity: 1 !important; transform: none !important; }'
  );

  // 5. Update initScrollReveal() so elements are immediately revealed
  html = html.replace(
    /function initScrollReveal\(\) \{[\s\S]*?initScrollReveal\(\);[\s\S]*?\}/,
    `function initScrollReveal() {
      const elements = document.querySelectorAll('.slide-reveal-left, .slide-reveal-right, .slide-reveal-up');
      elements.forEach(function(el) { el.classList.add('is-revealed'); });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initScrollReveal);
    } else {
      initScrollReveal();
    }`
  );

  // 6. PURGE ALL EMOJIS (Zero Emojis directive)
  html = html.replaceAll('⚡ GRAVITON', 'GRAVITON');
  html = html.replaceAll('⚡ Terminal Log Filter', 'Terminal Log Filter');
  html = html.replaceAll('📦 JSON Array Compression', 'JSON Array Compression');
  html = html.replaceAll('✂️ Native-First Execution', 'Native-First Execution');
  html = html.replaceAll('🎯 Precision Synthesis', 'Precision Synthesis');
  html = html.replaceAll('🚀 Autonomous Relay', 'Autonomous Relay');
  html = html.replaceAll('⚡', '');
  html = html.replaceAll('📦', '');
  html = html.replaceAll('✂️', '');
  html = html.replaceAll('✂', '');
  html = html.replaceAll('🎯', '');
  html = html.replaceAll('🚀', '');
  html = html.replaceAll('🐙', '');
  html = html.replaceAll('⚙', '');
  html = html.replaceAll('💎', '');
  html = html.replaceAll('📊', '');
  html = html.replaceAll('🗝', '');
  html = html.replaceAll('🧪', '');
  html = html.replaceAll('🛡', '');
  html = html.replaceAll('🔒', '');
  html = html.replaceAll('📐', '');
  html = html.replaceAll('✦', '');
  html = html.replaceAll('✱', '');
  html = html.replaceAll('✧', '');
  html = html.replaceAll('✔', '[OK]');

  // Replace unicode copy symbol with clean SVG
  html = html.replaceAll('<button onclick="copyText(\'npm install -g @alatariz/graviton\')">⧉</button>', `<button onclick="copyText('npm install -g graviton')" aria-label="Copy">${icons.copy}</button>`);
  html = html.replaceAll('<button onclick="copyText(\'npx @alatariz/graviton\')">⧉</button>', `<button onclick="copyText('graviton Fix auth in src/auth.js')" aria-label="Copy">${icons.copy}</button>`);
  html = html.replaceAll('⧉ Copy', `${icons.copy} <span>Copy</span>`);
  html = html.replaceAll('⧉', icons.copy);

  // 7. FIX JAVASCRIPT SYNTAX IN PRESETS (NO DUPLICATE QUOTES!)
  // In original-index.html:
  // raw: "Halo selamat pagi ... " -> replace with clean single-quoted or safely double-quoted English string
  html = html.replace(
    /raw:\s*"Halo selamat pagi[^"]*"/,
    'raw: "Hello Antigravity! Please help resolve the error in verifyUser within auth.js.\\nCode snippet:\\nexport function verify(req) {\\n  return req.user.id;\\n}\\nThank you!"'
  );
  html = html.replace(
    /raw:\s*"Tolong buatkan sistem webhook[^"]*"/,
    'raw: "Implement an idempotent payment gateway webhook processor that handles duplicate payloads and network retries safely."'
  );

  html = html.replace(
    /el\.value\s*=\s*"Selamat pagi Antigravity![^"]*";/,
    'el.value = "Hello Antigravity! Please resolve the TypeError in src/api/auth.js.\\nRuntime exception: TypeError: Cannot read property of undefined. Please provide defensive null handling.";'
  );
  html = html.replace(
    /el\.value\s*=\s*"Tolong rancang arsitektur[^"]*";/,
    'el.value = "Design an idempotent event-driven checkout architecture with distributed locks and timing-safe webhook verification to prevent double billing.";'
  );

  // Calibrate wheel snapper for perfect per-page snapping
  const tunedPageSnapper = `
    // =========================================================
    // TUNED BI-DIRECTIONAL PER-PAGE SCROLL SNAP CONTROLLER
    // =========================================================
    (function initPerStageSnapper() {
      const stageSelectors = [
        '.hero-top-stage',
        '.section-stage-showcase',
        '.section-stage-problem',
        '.section-stage-solution',
        '.section-stage-action',
        '.section-stage-evidence',
        '.section-stage-impact',
        '.section-stage-get-started',
        '.section-stage-studio',
        'footer'
      ];

      function getStages() {
        return stageSelectors.map(function(s) { return document.querySelector(s); }).filter(Boolean);
      }

      let isSnapping = false;
      let snapLockTimer = null;

      function getCurrentIndex(stages) {
        const scrollY = window.scrollY || window.pageYOffset;
        const probe = scrollY + 90;
        for (let i = stages.length - 1; i >= 0; i--) {
          if (probe >= stages[i].offsetTop) return i;
        }
        return 0;
      }

      function scrollToStageIndex(stages, idx) {
        if (idx < 0 || idx >= stages.length) return;
        isSnapping = true;
        clearTimeout(snapLockTimer);

        const target = stages[idx];
        const targetTop = target.getBoundingClientRect().top + window.scrollY - 64;

        window.scrollTo({
          top: Math.max(0, targetTop),
          behavior: 'smooth'
        });

        snapLockTimer = setTimeout(function() {
          isSnapping = false;
        }, 700);
      }

      window.addEventListener('wheel', function(e) {
        const searchModal = document.getElementById('searchModal');
        if (searchModal && searchModal.open) return;
        if (e.ctrlKey) return;

        let node = e.target;
        while (node && node !== document.body && node !== document.documentElement) {
          if (node.classList && (
            node.classList.contains('search-results-box') ||
            node.classList.contains('action-code-pane') ||
            node.tagName === 'TEXTAREA'
          )) {
            return;
          }
          node = node.parentElement;
        }

        const delta = e.deltaY;
        if (Math.abs(delta) < 18) return;

        if (isSnapping) {
          e.preventDefault();
          return;
        }

        const stages = getStages();
        const currentIdx = getCurrentIndex(stages);
        const currentStage = stages[currentIdx];
        if (!currentStage) return;

        const rect = currentStage.getBoundingClientRect();
        const vh = window.innerHeight;

        if (delta > 0) {
          // Scroll Down
          if (rect.bottom > vh + 60) return;
          if (currentIdx < stages.length - 1) {
            e.preventDefault();
            scrollToStageIndex(stages, currentIdx + 1);
          }
        } else {
          // Scroll Up
          if (rect.top < -60) return;
          if (currentIdx > 0) {
            e.preventDefault();
            scrollToStageIndex(stages, currentIdx - 1);
          }
        }
      }, { passive: false });

      window.addEventListener('keydown', function(e) {
        const searchModal = document.getElementById('searchModal');
        if (searchModal && searchModal.open) return;
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

        const stages = getStages();
        const currentIdx = getCurrentIndex(stages);

        if (e.key === 'PageDown' || (e.key === 'ArrowDown' && e.altKey)) {
          e.preventDefault();
          scrollToStageIndex(stages, currentIdx + 1);
        } else if (e.key === 'PageUp' || (e.key === 'ArrowUp' && e.altKey)) {
          e.preventDefault();
          scrollToStageIndex(stages, currentIdx - 1);
        }
      });
    })();
  `;

  const oldSnapperStart = html.indexOf('(function initInteractiveEngine()');
  if (oldSnapperStart !== -1) {
    const oldSnapperEnd = html.indexOf('})();', oldSnapperStart) + 5;
    html = html.slice(0, oldSnapperStart) + tunedPageSnapper + html.slice(oldSnapperEnd);
  } else {
    const oldLegacySnapper = html.indexOf('(function initPageSnapper()');
    if (oldLegacySnapper !== -1) {
      const oldLegacyEnd = html.indexOf('})();', oldLegacySnapper) + 5;
      html = html.slice(0, oldLegacySnapper) + tunedPageSnapper + html.slice(oldLegacyEnd);
    }
  }

  return html;
}

// -------------------------------------------------------------
// BUILD DOCS.HTML
// -------------------------------------------------------------
function buildDocs() {
  let docs = fs.readFileSync(path.join(scratchDir, 'original-docs.html'), 'utf8');

  // 1. Replace old navbar with the exact same sticky navbar
  const oldHeaderStart = docs.indexOf('<header class="global-navbar">');
  const oldHeaderEnd = docs.indexOf('</header>') + 9;
  if (oldHeaderStart !== -1 && oldHeaderEnd !== -1) {
    docs = docs.slice(0, oldHeaderStart) + sharedHeaderAndSearch('docs') + docs.slice(oldHeaderEnd);
  }

  // Remove old search modal dialog if present
  const oldSearchDialogStart = docs.indexOf('<dialog id="searchModal"');
  if (oldSearchDialogStart !== -1) {
    const oldSearchDialogEnd = docs.indexOf('</dialog>', oldSearchDialogStart) + 9;
    docs = docs.slice(0, oldSearchDialogStart) + docs.slice(oldSearchDialogEnd);
  }

  // 2. Remove "On this page" right column (<aside class="sidebar-right">...</aside>)
  const tocStart = docs.indexOf('<aside class="sidebar-right">');
  if (tocStart !== -1) {
    const tocEnd = docs.indexOf('</aside>', tocStart) + 8;
    docs = docs.slice(0, tocStart) + docs.slice(tocEnd);
  } else {
    const altTocStart = docs.indexOf('<aside class="docs-toc">');
    if (altTocStart !== -1) {
      const altTocEnd = docs.indexOf('</aside>', altTocStart) + 8;
      docs = docs.slice(0, altTocStart) + docs.slice(altTocEnd);
    }
  }

  // 3. Update Docs CSS:
  // - No black box background on sidebar (.docs-sidebar { background: transparent !important; border: none !important; })
  // - Sidebar sticky (top: 84px)
  // - Active highlight styling with aqua glow
  // - 2-column layout (260px minmax(0, 1fr)) without the 3rd TOC column
  const docsSpecificStyles = `
    ${commonNavbarStyles}

    /* BODY PADDING TO CLEAR FIXED NAVBAR */
    body {
      padding-top: 64px !important;
      min-height: 100vh !important;
      background: #030712 !important;
      color: #f8fafc !important;
      font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, sans-serif) !important;
      overflow-y: auto !important;
      scroll-snap-type: none !important;
    }

    /* UNIFIED 2-COLUMN DOCS LAYOUT (NO UNNECESSARY RIGHT TOC) */
    .docs-layout,
    .docs-container {
      max-width: 1400px !important;
      margin: 0 auto !important;
      padding: 2.5rem 2rem 5rem !important;
      display: grid !important;
      grid-template-columns: 260px minmax(0, 1fr) !important;
      gap: 3.5rem !important;
      align-items: start !important;
      box-sizing: border-box !important;
    }

    /* DOCS SIDEBAR: TRANSPARENT (NO BLACK BOX), STICKY */
    .docs-sidebar {
      position: sticky !important;
      top: 84px !important;
      height: calc(100vh - 104px) !important;
      overflow-y: auto !important;
      background: transparent !important;
      border: none !important;
      border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
      box-shadow: none !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
      padding-right: 1.5rem !important;
      scrollbar-width: thin;
      z-index: 50 !important;
    }
    .sidebar-group {
      margin-bottom: 2rem !important;
    }
    .sidebar-group-title {
      font-size: 0.72rem !important;
      font-weight: 700 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.1em !important;
      color: #64748b !important;
      margin-bottom: 0.75rem !important;
      font-family: var(--font-mono, monospace) !important;
    }
    .sidebar-links {
      display: flex !important;
      flex-direction: column !important;
      gap: 0.25rem !important;
    }
    .sidebar-link {
      display: block !important;
      padding: 0.5rem 0.85rem !important;
      color: #94a3b8 !important;
      text-decoration: none !important;
      font-size: 0.86rem !important;
      border-radius: 8px !important;
      border: 1px solid transparent !important;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }
    .sidebar-link:hover {
      color: #ffffff !important;
      background: rgba(255, 255, 255, 0.05) !important;
    }
    /* ACTIVE HIGHLIGHT: AQUA GLOW PILL */
    .sidebar-link.active {
      color: #00f0ff !important;
      background: rgba(0, 240, 255, 0.1) !important;
      border: 1px solid rgba(0, 240, 255, 0.32) !important;
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.2) !important;
      font-weight: 600 !important;
    }

    /* MAIN CONTENT EXPANSION */
    .docs-content {
      min-width: 0 !important;
      max-width: 960px !important;
    }
    .docs-content h1 {
      font-size: 2.6rem !important;
      font-weight: 800 !important;
      letter-spacing: -0.03em !important;
      margin-bottom: 0.6rem !important;
      color: #ffffff !important;
    }
    .docs-lead {
      font-size: 1.05rem !important;
      color: #94a3b8 !important;
      line-height: 1.65 !important;
      margin-bottom: 3rem !important;
    }
    .docs-section {
      margin-bottom: 4rem !important;
      scroll-margin-top: 90px !important;
    }
    .docs-section h2 {
      font-size: 1.6rem !important;
      font-weight: 700 !important;
      color: #ffffff !important;
      margin-bottom: 1.25rem !important;
      letter-spacing: -0.02em !important;
    }
    .docs-section p {
      font-size: 0.95rem !important;
      color: #94a3b8 !important;
      line-height: 1.7 !important;
      margin-bottom: 1.25rem !important;
    }
    .docs-callout {
      background: rgba(8, 14, 30, 0.6) !important;
      border: 1px solid rgba(0, 240, 255, 0.25) !important;
      border-radius: 12px !important;
      padding: 1.5rem !important;
      margin: 1.5rem 0 !important;
    }
    .docs-callout p {
      color: #e2e8f0 !important;
      margin: 0 !important;
    }
    .code-block {
      background: #02050e !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      border-radius: 10px !important;
      padding: 1.25rem !important;
      font-family: var(--font-mono, monospace) !important;
      font-size: 0.85rem !important;
      overflow-x: auto !important;
      margin: 1.25rem 0 !important;
      color: #cbd5e1 !important;
    }

    @media (max-width: 900px) {
      .docs-layout, .docs-container {
        grid-template-columns: 1fr !important;
      }
      .docs-sidebar {
        display: none !important;
      }
    }
  `;

  docs = docs.replace('</style>', docsSpecificStyles + '\n  </style>');

  // 4. PURGE ALL EMOJIS IN DOCS
  docs = docs.replaceAll('⚡ GRAVITON', 'GRAVITON');
  docs = docs.replaceAll('⚡', '');
  docs = docs.replaceAll('📦', '');
  docs = docs.replaceAll('✂️', '');
  docs = docs.replaceAll('✂', '');
  docs = docs.replaceAll('🎯', '');
  docs = docs.replaceAll('🚀', '');
  docs = docs.replaceAll('🐙', '');
  docs = docs.replaceAll('⚙', '');
  docs = docs.replaceAll('💎', '');
  docs = docs.replaceAll('📊', '');
  docs = docs.replaceAll('🗝', '');
  docs = docs.replaceAll('🧪', '');
  docs = docs.replaceAll('🛡', '');
  docs = docs.replaceAll('🔒', '');
  docs = docs.replaceAll('📐', '');
  docs = docs.replaceAll('✦', '');
  docs = docs.replaceAll('✱', '');
  docs = docs.replaceAll('✧', '');
  docs = docs.replaceAll('✔', '[OK]');
  docs = docs.replaceAll('★', '');

  // 5. Injected Script for Docs: Instant Active Highlight on Click + Smooth Scroll Spy
  const docsInteractiveScript = `
  <script>
    // Search Modal Handlers
    const searchModal = document.getElementById('searchModal');
    const spotlightInput = document.getElementById('spotlightInput');

    function openSearchModal() {
      if (searchModal) {
        searchModal.showModal();
        if (spotlightInput) {
          spotlightInput.value = '';
          spotlightInput.focus();
        }
      }
    }

    function closeSearchModal() {
      if (searchModal && searchModal.open) searchModal.close();
    }

    if (searchModal) {
      searchModal.addEventListener('click', function(e) {
        const rect = searchModal.getBoundingClientRect();
        const inDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
        if (!inDialog) closeSearchModal();
      });
    }

    window.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && searchModal && searchModal.open) {
        closeSearchModal();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchModal();
      }
    });

    // SIDEBAR ACTIVE HIGHLIGHT HANDLER (CLICK + SCROLL SPY)
    (function initSidebarSpy() {
      const links = document.querySelectorAll('.sidebar-link');
      const targetIds = [
        'overview', 'vision', 'how-it-works', 'architecture',
        'file-hydration', 'priority-sorting', 'minified-shield',
        'shadow-backups', 'installation', 'cli-quickstart',
        'auto-allow', 'skill-matrix', 'privacy'
      ];

      // Instant click highlight
      links.forEach(function(link) {
        link.addEventListener('click', function(e) {
          links.forEach(function(l) { l.classList.remove('active'); });
          this.classList.add('active');
        });
      });

      // Reliable Scroll Spy
      let isScrollingTimer = null;
      window.addEventListener('scroll', function() {
        const scrollPos = window.scrollY + 110;
        let activeId = targetIds[0];

        for (let i = 0; i < targetIds.length; i++) {
          const el = document.getElementById(targetIds[i]);
          if (el && el.offsetTop <= scrollPos) {
            activeId = targetIds[i];
          }
        }

        links.forEach(function(link) {
          const href = link.getAttribute('href');
          link.classList.toggle('active', href === '#' + activeId);
        });
      }, { passive: true });
    })();
  </script>
  `;

  // Replace or inject script at end of docs.html
  const oldScriptStart = docs.indexOf('<script>');
  if (oldScriptStart !== -1) {
    const oldScriptEnd = docs.lastIndexOf('</script>') + 9;
    docs = docs.slice(0, oldScriptStart) + docsInteractiveScript + docs.slice(oldScriptEnd);
  } else {
    docs = docs.replace('</body>', docsInteractiveScript + '\n</body>');
  }

  return docs;
}

// Generate index.html
const finalIndex = buildIndex();
fs.writeFileSync(path.join(publicDir, 'index.html'), finalIndex, 'utf8');
console.log('✔ Generated web/public/index.html (' + finalIndex.length + ' bytes)');

// Verify index script syntax!
const scriptMatch = finalIndex.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/i);
if (scriptMatch) {
  try {
    new vm.Script(scriptMatch[1]);
    console.log('✔ index.html Script SYNTAX IS 100% VALID!');
  } catch (err) {
    console.error('❌ index.html Script SYNTAX ERROR:', err.message);
  }
}

// Generate docs.html
const finalDocs = buildDocs();
fs.writeFileSync(path.join(publicDir, 'docs.html'), finalDocs, 'utf8');
console.log('✔ Generated web/public/docs.html (' + finalDocs.length + ' bytes)');

// Sync build script
fs.writeFileSync(path.join(webDir, 'scripts', 'build-graviton-site.mjs'), fs.readFileSync(path.join(scratchDir, 'build-perfect-site-v2.mjs'), 'utf8'), 'utf8');
console.log('✔ Synced to web/scripts/build-graviton-site.mjs');

console.log('=== Build Complete! ===');
