// build-aquamarine-pages.mjs - Luxury Diamond Blue/Aquamarine with 100vh Intro, Slower Smooth Animations, Clean Per-Page Layout, and Full Functional Search Modal
import fs from 'fs';
import { buildDocsHtml } from './docs-page.mjs';

// 1. Shared Global Navbar & Search Modal
const sharedHeaderAndSearch = (activePage = 'product') => `
  <!-- UNIFIED GRAVITON CORE LUXURY NAVBAR -->
  <header class="global-navbar">
    <div class="nav-inner">
      <!-- LEFT: Logo + Search pill -->
      <div class="nav-left">
        <a href="/" class="nav-logo-wrap">
          <img src="/icon.svg" alt="Graviton Singularity Logo">
          <span class="nav-brand-text">GRAVITON</span>
        </a>
        <button class="nav-search-bar" onclick="openSearchModal()" aria-label="Search">
          <svg class="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span class="search-label">Search</span>
          <kbd class="search-kbd">⌘K</kbd>
        </button>
      </div>

      <!-- CENTER: Dropdowns (Product, Docs, Resources, Community) -->
      <nav class="nav-center-links">
        <!-- 1. Product Dropdown -->
        <div class="nav-item has-dropdown ${activePage === 'product' ? 'active' : ''}">
          <a href="/#hero-showcase" class="nav-link">
            <span>Product</span>
            <svg class="chevron" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </a>
          <div class="dropdown-menu">
            <a href="/#get-started" class="dropdown-item">Install Graviton</a>
            <a href="/#evidence" class="dropdown-item">Token Savings</a>
            <a href="/#how-it-works" class="dropdown-item">Context Scoper</a>
            <a href="/#solution" class="dropdown-item">V3.0 Architecture</a>
            <a href="/#action" class="dropdown-item">See It In Action</a>
            <a href="/docs.html#conversation-management" class="dropdown-item item-pro">
              <span class="pro-dot"></span>
              <span>History (grav -c)</span>
            </a>
          </div>
        </div>

        <!-- 2. Docs Direct Link -->
        <div class="nav-item ${activePage === 'docs' ? 'active' : ''}">
          <a href="/docs.html" class="nav-link">
            <span>Docs</span>
          </a>
        </div>

        <!-- 3. Resources Dropdown -->
        <div class="nav-item has-dropdown">
          <a href="/#action" class="nav-link">
            <span>Resources</span>
            <svg class="chevron" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </a>
          <div class="dropdown-menu">
            <a href="/docs.html#cli-quickstart" class="dropdown-item">CLI Reference</a>
            <a href="/docs.html#doctor" class="dropdown-item">System Doctor</a>
            <a href="/docs.html#rollback" class="dropdown-item">Safety Rollback</a>
            <a href="/docs.html#ports" class="dropdown-item">Port Guard</a>
            <a href="https://github.com/alatariz/graviton" target="_blank" rel="noopener noreferrer" class="dropdown-item">GitHub Repository</a>
          </div>
        </div>

        <!-- 4. Community Dropdown with Icons -->
        <div class="nav-item has-dropdown">
          <a href="https://github.com/alatariz/graviton" class="nav-link">
            <span>Community</span>
            <svg class="chevron" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </a>
          <div class="dropdown-menu dropdown-community">
            <a href="https://github.com/alatariz/graviton" target="_blank" rel="noopener noreferrer" class="dropdown-item">
              <svg class="item-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>GitHub Repo</span>
            </a>
            <a href="https://discord.gg" target="_blank" rel="noopener noreferrer" class="dropdown-item">
              <svg class="item-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.894.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span>Discord</span>
            </a>
            <a href="https://x.com/alatariz" target="_blank" rel="noopener noreferrer" class="dropdown-item">
              <svg class="item-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>X (@alatariz)</span>
            </a>
            <a href="https://github.com/sponsors/alatariz" target="_blank" rel="noopener noreferrer" class="dropdown-item">
              <svg class="item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              <span>GitHub Sponsors</span>
            </a>
            <a href="https://github.com/alatariz/graviton/discussions" target="_blank" rel="noopener noreferrer" class="dropdown-item">
              <svg class="item-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>Discussions</span>
            </a>
          </div>
        </div>
      </nav>

      <!-- RIGHT: GitHub Stars, EN Switcher, Install Button -->
      <div class="nav-right">
        <a href="https://github.com/alatariz/graviton" target="_blank" rel="noopener noreferrer" class="nav-gh-stars" aria-label="GitHub Repository">
          <svg class="gh-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span class="gh-count">80.0k ★</span>
        </a>

        <div class="nav-lang-switch" title="Language: English">
          <svg class="globe-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
          <span>EN</span>
          <svg class="chevron" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>

        <a href="/#get-started" class="btn-nav-install">
          <span>Install Graviton →</span>
        </a>
      </div>
    </div>
  </header>

  <!-- SEARCH MODAL (SPOTLIGHT DIALOG) -->
  <dialog id="searchModal" class="search-dialog">
    <div class="search-dialog-box">
      <!-- Input bar with Esc badge -->
      <div class="search-input-wrap">
        <svg class="search-input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="spotlightInput" placeholder="Search commands, docs, tools..." autocomplete="off" spellcheck="false">
        <button class="search-esc-badge" onclick="closeSearchModal()" aria-label="Close dialog">Esc</button>
      </div>

      <!-- Results list or empty state -->
      <div class="search-results-list" id="searchResultsList">
        <div class="search-empty-prompt" id="searchEmptyPrompt">
          <div class="empty-title">Start typing to search...</div>
          <div class="empty-quick-list" id="emptyQuickList">
            <!-- Rendered by script -->
          </div>
        </div>
        <div id="searchDynamicResults" style="display: none;"></div>
      </div>

      <!-- Footer Shortcuts -->
      <div class="search-footer-shortcuts">
        <div class="shortcut-group">
          <span class="key-cap">↑</span>
          <span class="key-cap">↓</span>
          <span class="key-label">navigate</span>
        </div>
        <div class="shortcut-group">
          <span class="key-cap">↵</span>
          <span class="key-label">open</span>
        </div>
        <div class="shortcut-group">
          <span class="key-cap">Esc</span>
          <span class="key-label">close</span>
        </div>
      </div>
    </div>
  </dialog>
`;

// 2. Build index.html
const buildIndexHtml = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GRAVITON — Autonomous AI Control & Noise Acceleration Layer for Antigravity</title>
  <meta name="description" content="Open-source CLI proxy & prompt synthesizer. Keeps your Antigravity context clean, unlocks specialized skills, and runs with continuous auto-allow.">
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    /* DIAMOND BLUE / AQUAMARINE LUXURY DESIGN SYSTEM */
    :root {
      --bg: #040711;
      --bg-surface: #060c1d;
      --bg-card: rgba(8, 16, 34, 0.7);
      --border: rgba(56, 189, 248, 0.12);
      --border-light: rgba(56, 189, 248, 0.22);
      --border-aqua: rgba(0, 240, 255, 0.35);
      --text-main: #f1f5f9;
      --text-dim: #94a3b8;
      --text-muted: #64748b;
      
      /* Diamond Aquamarine Core */
      --aqua: #00f0ff;
      --aqua-bright: #38bdf8;
      --aqua-ice: #bae6fd;
      --aqua-deep: #0284c7;
      --aqua-glow: rgba(0, 240, 255, 0.28);
      --diamond-glow: rgba(56, 189, 248, 0.35);

      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', Consolas, monospace;
    }

    /* VIEW TRANSITIONS BETWEEN PAGES (CROSS-DOCUMENT SLIDE) */
    @media (prefers-reduced-motion: no-preference) {
      @view-transition {
        navigation: auto;
      }
    }
    ::view-transition-old(root) {
      animation: 0.5s cubic-bezier(0.16, 1, 0.3, 1) both pageSlideOut;
    }
    ::view-transition-new(root) {
      animation: 0.5s cubic-bezier(0.16, 1, 0.3, 1) both pageSlideIn;
    }
    @keyframes pageSlideOut {
      to { transform: translateX(-40px); opacity: 0; }
    }
    @keyframes pageSlideIn {
      from { transform: translateX(40px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html {
      scroll-behavior: smooth;
      color-scheme: dark;
      scroll-padding-top: 58px;
      overflow-y: auto;
      overflow-x: hidden;
    }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      overflow-x: hidden;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    /* PAGE STAGES CONFIGURATION */
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
      scroll-margin-top: 58px;
      box-sizing: border-box;
    }
    /* UNIVERSAL LINK RESET - NO PURPLE VISITED LINKS, NO UNDERLINES */
    a, a:visited, a:hover, a:active, a:focus {
      text-decoration: none !important;
    }

    /* GLOBAL NAVBAR VISITED & ACTIVE RESETS */
    .global-navbar a,
    .global-navbar a:visited,
    .global-navbar a:active,
    .global-navbar a:focus {
      text-decoration: none !important;
      color: inherit;
    }

    .nav-logo-wrap,
    .nav-logo-wrap:visited {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      text-decoration: none !important;
      color: #ffffff !important;
    }

    .nav-link,
    .nav-link:visited {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: #94a3b8 !important;
      text-decoration: none !important;
      font-size: 0.88rem;
      font-weight: 500;
      padding: 0.4rem 0;
      transition: color 0.15s ease;
      position: relative;
    }
    .nav-link:hover,
    .nav-item:hover > .nav-link,
    .nav-item.active > .nav-link,
    .nav-item.active > .nav-link:visited {
      color: #ffffff !important;
      text-decoration: none !important;
    }

    .dropdown-item,
    .dropdown-item:visited {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.5rem 0.85rem;
      font-size: 0.86rem;
      font-weight: 500;
      color: #94a3b8 !important;
      text-decoration: none !important;
      border-radius: 7px;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .dropdown-item:hover,
    .dropdown-item:active {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff !important;
      text-decoration: none !important;
    }

    .dropdown-item.item-pro,
    .dropdown-item.item-pro:visited {
      color: #cbd5e1 !important;
      text-decoration: none !important;
    }
    .dropdown-item.item-pro:hover {
      color: #ffffff !important;
    }

    .nav-gh-stars,
    .nav-gh-stars:visited {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      color: #94a3b8 !important;
      text-decoration: none !important;
      font-size: 0.82rem;
      font-weight: 500;
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
      transition: color 0.15s ease;
    }
    .nav-gh-stars:hover {
      color: #ffffff !important;
      text-decoration: none !important;
    }
    .nav-gh-stars .gh-count,
    .nav-gh-stars:visited .gh-count {
      color: #94a3b8 !important;
    }
    .nav-gh-stars:hover .gh-count {
      color: #ffffff !important;
    }

    .btn-nav-install,
    .btn-nav-install:visited {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      border: 1px solid rgba(0, 240, 255, 0.4);
      background: rgba(0, 240, 255, 0.05);
      color: var(--aqua) !important;
      padding: 0.38rem 1.15rem;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 600;
      text-decoration: none !important;
      transition: all 0.25s ease;
    }
    .btn-nav-install:hover {
      background: var(--aqua) !important;
      color: #040711 !important;
      border-color: var(--aqua);
      box-shadow: 0 0 20px var(--aqua-glow);
      text-decoration: none !important;
    }

    .search-result-item,
    .search-result-item:visited {
      color: var(--text-main) !important;
      text-decoration: none !important;
    }


    /* BACKGROUND CYBERNETIC AQUAMARINE GRID */
    .viewport-grid {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: 
        radial-gradient(circle at 50% 15%, rgba(0, 240, 255, 0.12) 0%, transparent 60%),
        radial-gradient(circle at 85% 45%, rgba(56, 189, 248, 0.08) 0%, transparent 50%),
        linear-gradient(to right, rgba(56, 189, 248, 0.03) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(56, 189, 248, 0.03) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 48px 48px, 48px 48px;
      pointer-events: none;
      z-index: 0;
    }

    /* CLEAN CONTENT REVEAL EFFECT (VISIBLE BY DEFAULT) */
    .slide-reveal-left,
    .slide-reveal-right,
    .slide-reveal-up {
      opacity: 1;
      transform: none;
      transition: opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .slide-reveal-left.is-revealed,
    .slide-reveal-right.is-revealed,
    .slide-reveal-up.is-revealed {
      opacity: 1 !important;
      transform: none !important;
    }

    
    /* ========================================================
       GRAVITON CORE HIGH-PRECISION NAVBAR
       ======================================================== */
    .global-navbar {
      position: sticky;
      top: 0;
      z-index: 1000;
      height: 58px;
      background: rgba(8, 12, 22, 0.88);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .nav-inner {
      max-width: 1400px;
      height: 100%;
      margin: 0 auto;
      padding: 0 1.75rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    /* Left Group */
    .nav-left {
      display: flex;
      align-items: center;
      gap: 1.25rem;
    }
    .nav-logo-wrap {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      text-decoration: none;
      color: #fff;
    }
    .nav-logo-wrap img {
      width: 24px;
      height: 24px;
      filter: drop-shadow(0 0 8px var(--aqua-glow));
    }
    .nav-brand-text {
      font-size: 0.96rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      color: #ffffff;
    }

    /* Search input pill */
    .nav-search-bar {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 0 0.65rem;
      height: 30px;
      color: #64748b;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s ease;
    }
    .nav-search-bar:hover {
      background: rgba(0, 240, 255, 0.06);
      border-color: rgba(0, 240, 255, 0.3);
      color: #cbd5e1;
    }
    .nav-search-bar .search-icon {
      stroke: #64748b;
      transition: stroke 0.2s;
    }
    .nav-search-bar:hover .search-icon {
      stroke: var(--aqua);
    }
    .nav-search-bar .search-label {
      font-size: 0.8rem;
      color: #64748b;
    }
    .nav-search-bar:hover .search-label {
      color: #cbd5e1;
    }
    .nav-search-bar .search-kbd {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      padding: 1px 4px;
      font-size: 0.68rem;
      font-family: var(--font-mono);
      color: #64748b;
    }
    .nav-search-bar:hover .search-kbd {
      color: var(--aqua-ice);
      border-color: rgba(0, 240, 255, 0.2);
    }

    /* Center Links */
    .nav-center-links {
      display: flex;
      align-items: center;
      gap: 1.75rem;
    }
    .nav-item {
      position: relative;
    }
    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.88rem;
      font-weight: 500;
      padding: 0.4rem 0;
      transition: color 0.15s ease;
      position: relative;
    }
    .nav-link:hover,
    .nav-item:hover .nav-link,
    .nav-item.active .nav-link {
      color: #ffffff;
    }
    .nav-link .chevron {
      transition: transform 0.2s ease;
      stroke: #64748b;
    }
    .nav-item:hover .nav-link .chevron {
      transform: rotate(180deg);
      stroke: #cbd5e1;
    }
    .nav-item.active .nav-link::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--aqua);
      box-shadow: 0 0 8px var(--aqua);
    }

    /* Graviton Core Dropdown Cards */
    .dropdown-menu {
      position: absolute;
      top: calc(100% + 10px);
      left: 50%;
      transform: translateX(-50%) translateY(-4px);
      min-width: 170px;
      background: #0b1220;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 6px;
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.75), 0 0 1px rgba(0, 240, 255, 0.2);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.18s cubic-bezier(0.16, 1, 0.3, 1), transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 1010;
    }
    .dropdown-menu::before {
      content: '';
      position: absolute;
      top: -12px;
      left: 0;
      right: 0;
      height: 12px;
    }
    .nav-item:hover .dropdown-menu {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(-50%) translateY(0);
    }
    .dropdown-community {
      min-width: 195px;
    }
    .dropdown-item {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      padding: 0.5rem 0.85rem;
      font-size: 0.86rem;
      font-weight: 500;
      color: #94a3b8;
      text-decoration: none;
      border-radius: 7px;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .dropdown-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: #ffffff;
    }
    .dropdown-item.item-pro {
      color: #cbd5e1;
    }
    .dropdown-item.item-pro:hover {
      color: #ffffff;
    }
    .pro-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--aqua);
      box-shadow: 0 0 8px var(--aqua);
      display: inline-block;
      flex-shrink: 0;
    }
    .dropdown-item .item-icon {
      color: #64748b;
      flex-shrink: 0;
      transition: color 0.15s;
    }
    .dropdown-item:hover .item-icon {
      color: var(--aqua-bright);
    }

    /* Right Group */
    .nav-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .nav-gh-stars {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.82rem;
      font-weight: 500;
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
      transition: color 0.15s ease;
    }
    .nav-gh-stars:hover {
      color: #ffffff;
    }
    .nav-gh-stars .gh-icon {
      color: #cbd5e1;
    }
    .nav-gh-stars .gh-count {
      color: #94a3b8;
    }
    .nav-gh-stars:hover .gh-count {
      color: #ffffff;
    }

    .nav-lang-switch {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      color: #94a3b8;
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;
      padding: 0.35rem 0.5rem;
      border-radius: 6px;
      transition: color 0.15s ease;
    }
    .nav-lang-switch:hover {
      color: #ffffff;
    }
    .nav-lang-switch .globe-icon {
      stroke: #64748b;
    }
    .nav-lang-switch:hover .globe-icon {
      stroke: #cbd5e1;
    }

    .btn-nav-install {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      border: 1px solid rgba(0, 240, 255, 0.4);
      background: rgba(0, 240, 255, 0.05);
      color: var(--aqua);
      padding: 0.38rem 1.15rem;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.25s ease;
    }
    .btn-nav-install:hover {
      background: var(--aqua);
      color: #040711;
      border-color: var(--aqua);
      box-shadow: 0 0 20px var(--aqua-glow);
    }

    /* ========================================================
       GRAVITON CORE SPOTLIGHT SEARCH MODAL
       ======================================================== */
    .search-dialog {
      position: fixed;
      inset: 0;
      margin: auto;
      background: transparent;
      border: none;
      padding: 0;
      z-index: 99999;
      outline: none;
    }
    .search-dialog::backdrop {
      background: rgba(2, 5, 12, 0.75);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    .search-dialog-box {
      background: #0c1322;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      width: 580px;
      max-width: 92vw;
      box-shadow: 0 25px 80px rgba(0, 0, 0, 0.9), 0 0 1px rgba(0, 240, 255, 0.2);
      overflow: hidden;
      animation: searchModalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes searchModalIn {
      from { opacity: 0; transform: scale(0.97) translateY(-8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .search-input-wrap {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.95rem 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .search-input-icon {
      stroke: #64748b;
      flex-shrink: 0;
    }
    .search-input-wrap input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      font-size: 0.98rem;
      color: #ffffff;
      font-family: inherit;
    }
    .search-input-wrap input::placeholder {
      color: #64748b;
    }
    .search-esc-badge {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #94a3b8;
      border-radius: 4px;
      padding: 0.15rem 0.45rem;
      font-size: 0.72rem;
      font-family: var(--font-mono);
      cursor: pointer;
      transition: all 0.15s;
    }
    .search-esc-badge:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }

    .search-results-list {
      max-height: 380px;
      overflow-y: auto;
      padding: 0.6rem;
    }
    .search-empty-prompt {
      padding: 0.4rem;
    }
    .empty-title {
      font-size: 0.98rem;
      font-weight: 600;
      color: #e2e8f0;
      padding: 0.6rem 0.8rem 0.8rem;
    }
    .empty-quick-list {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .search-result-item {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.7rem 0.9rem;
      border-radius: 8px;
      text-decoration: none;
      color: var(--text-main);
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .search-result-item:hover,
    .search-result-item.selected {
      background: rgba(255, 255, 255, 0.05);
      border-left: 2px solid var(--aqua);
    }
    .res-icon {
      font-size: 1.15rem;
      flex-shrink: 0;
    }
    .res-body {
      flex: 1;
      min-width: 0;
    }
    .res-title {
      font-size: 0.88rem;
      font-weight: 600;
      color: #ffffff;
    }
    .res-sub {
      font-size: 0.76rem;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .res-badge {
      font-family: var(--font-mono);
      font-size: 0.68rem;
      color: var(--aqua);
      background: rgba(0, 240, 255, 0.08);
      border: 1px solid rgba(0, 240, 255, 0.2);
      padding: 0.15rem 0.45rem;
      border-radius: 4px;
      flex-shrink: 0;
    }

    /* Footer Shortcuts */
    .search-footer-shortcuts {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding: 0.65rem 1.25rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      font-size: 0.74rem;
      color: #64748b;
      font-family: var(--font-mono);
    }
    .shortcut-group {
      display: flex;
      align-items: center;
      gap: 0.35rem;
    }
    .key-cap {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 4px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: #94a3b8;
      font-size: 0.7rem;
    }
    .key-label {
      color: #64748b;
      font-family: var(--font-sans);
    }

    @media (max-width: 960px) {
      .nav-center-links { display: none; }
      .nav-lang-switch { display: none; }
    }
    @media (max-width: 600px) {
      .nav-search-bar .search-label,
      .nav-search-bar .search-kbd { display: none; }
      .nav-gh-stars .gh-count { display: none; }
      .btn-nav-install span { font-size: 0.75rem; }
    }


    /* SECTION BADGES */
    .section-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--aqua);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 1.2rem;
    }
    .section-tag::before {
      content: '●';
      font-size: 0.7rem;
      color: var(--aqua);
      text-shadow: 0 0 8px var(--aqua);
    }

    .pill-banner-link {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(0, 240, 255, 0.06);
      border: 1px solid rgba(0, 240, 255, 0.25);
      padding: 0.35rem 0.9rem;
      border-radius: 999px;
      font-size: 0.8rem;
      color: var(--text-dim);
      text-decoration: none;
      margin-bottom: 1.5rem;
      transition: all 0.2s;
    }
    .pill-banner-link:hover {
      border-color: var(--aqua);
      color: #fff;
      box-shadow: 0 0 15px rgba(0, 240, 255, 0.2);
    }
    .pill-banner-link span.badge-dot {
      color: var(--aqua);
      font-weight: 700;
    }

    /* LASER AXIS */
    .laser-line-axis {
      position: absolute;
      top: 0; left: 50%;
      width: 1px;
      height: 100%;
      background: linear-gradient(180deg, transparent 0%, rgba(0, 240, 255, 0.45) 25%, rgba(56, 189, 248, 0.45) 75%, transparent 100%);
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 1;
    }
    .laser-particle {
      position: absolute;
      top: 0; left: -2px;
      width: 5px; height: 40px;
      background: linear-gradient(180deg, transparent, var(--aqua), #fff);
      filter: drop-shadow(0 0 12px var(--aqua));
      border-radius: 999px;
      animation: laserTravel 8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    @keyframes laserTravel {
      0% { top: -5%; opacity: 0; }
      15% { opacity: 1; }
      85% { opacity: 1; }
      100% { top: 105%; opacity: 0; }
    }

    /* ========================================================= */
    /* 1. HERO TOP INTRO STAGE (FULL 100VH VIEWPORT STANDALONE) */
    /* ========================================================= */
    .hero-top-stage {
      position: relative;
      min-height: calc(100vh - 58px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 2rem 2rem 3rem;
      z-index: 2;
      animation: heroSlowFadeIn 1.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes heroSlowFadeIn {
      0% { opacity: 0; transform: translateY(25px); }
      100% { opacity: 1; transform: translateY(0); }
    }

    .hero-totem-wrap {
      position: relative;
      margin-bottom: 1.4rem;
      cursor: pointer;
    }
    .hero-totem-aura {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 200px; height: 200px;
      background: radial-gradient(circle, rgba(0, 240, 255, 0.32) 0%, transparent 70%);
      filter: blur(35px);
      pointer-events: none;
    }
    .hero-totem-icon {
      width: 110px;
      height: 110px;
      filter: drop-shadow(0 0 30px rgba(0, 240, 255, 0.55));
      animation: totemBreathing 7s ease-in-out infinite;
    }
    @keyframes totemBreathing {
      0%, 100% { transform: translateY(0px) scale(1); }
      50% { transform: translateY(-7px) scale(1.02); }
    }
    .totem-brand-sub {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      letter-spacing: 0.45em;
      color: var(--aqua-bright);
      margin-top: 1rem;
    }

    .hero-pre-title {
      font-size: 1.25rem;
      color: var(--text-dim);
      margin-bottom: 0.5rem;
      font-weight: 400;
    }
    .hero-main-title {
      font-size: 3.6rem;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: #fff;
      margin-bottom: 1.8rem;
    }

    .btn-see-how {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(56, 189, 248, 0.05);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.65rem 1.5rem;
      color: var(--text-dim);
      font-size: 0.85rem;
      font-family: var(--font-mono);
      text-decoration: none;
      transition: all 0.3s;
    }
    .btn-see-how:hover {
      border-color: var(--aqua);
      background: rgba(0, 240, 255, 0.1);
      color: #fff;
      transform: translateY(2px);
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.25);
    }

    /* ========================================================= */
    /* 2. HERO DUAL SPLIT SECTION (DEDICATED PAGE MIN-HEIGHT 85VH) */
    /* ========================================================= */
    .section-stage-showcase {
      position: relative;
      min-height: calc(100vh - 58px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 3.5rem 2rem 2.5rem;
      z-index: 2;
    }
    .hero-split-grid {
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 5rem;
      align-items: center;
    }
    .hero-split-left h2 {
      font-size: 4.2rem;
      line-height: 1.05;
      font-weight: 700;
      letter-spacing: -0.04em;
      margin-bottom: 1.5rem;
    }
    .hero-split-left h2 .accent-aqua {
      color: var(--aqua);
      text-shadow: 0 0 35px var(--aqua-glow);
    }
    .hero-split-desc {
      font-size: 1.1rem;
      color: var(--text-dim);
      line-height: 1.65;
      margin-bottom: 2.4rem;
      max-width: 540px;
    }
    .hero-actions-row {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 2rem;
      flex-wrap: wrap;
    }
    .btn-primary-pill {
      background: var(--aqua);
      color: #021526;
      font-weight: 700;
      padding: 0.8rem 1.9rem;
      border-radius: 999px;
      text-decoration: none;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.25s;
      box-shadow: 0 0 25px var(--aqua-glow);
    }
    .btn-primary-pill:hover {
      background: #7dd3fc;
      transform: translateY(-1px);
      box-shadow: 0 0 35px rgba(0, 240, 255, 0.6);
    }
    .btn-glass-pill {
      background: rgba(56, 189, 248, 0.04);
      border: 1px solid var(--border);
      color: #fff;
      font-weight: 500;
      padding: 0.8rem 1.7rem;
      border-radius: 999px;
      text-decoration: none;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.25s;
    }
    .btn-glass-pill:hover {
      background: rgba(56, 189, 248, 0.08);
      border-color: var(--aqua);
    }
    .hero-meta-strip {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    /* THE FLOATING CLEAN CONTEXT SLAB */
    .matrix-phone-slab {
      background: rgba(6, 12, 28, 0.9);
      border: 1px solid rgba(0, 240, 255, 0.35);
      border-radius: 22px;
      padding: 1.8rem;
      box-shadow: 0 25px 60px -15px rgba(0,0,0,0.8), 0 0 40px rgba(0, 240, 255, 0.15);
      backdrop-filter: blur(20px);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .matrix-phone-slab:hover {
      border-color: rgba(0, 240, 255, 0.6);
      box-shadow: 0 30px 70px -15px rgba(0,0,0,0.9), 0 0 55px rgba(0, 240, 255, 0.25);
    }
    .slab-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 0.78rem;
      margin-bottom: 1.5rem;
      padding-bottom: 0.8rem;
      border-bottom: 1px solid rgba(56, 189, 248, 0.1);
    }
    .slab-header .slab-title {
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .slab-header .slab-title::before {
      content: '●';
      color: var(--aqua);
      text-shadow: 0 0 8px var(--aqua);
    }
    .slab-header .slab-status {
      color: var(--aqua);
      font-weight: 700;
    }

    .matrix-canvas-wrap {
      width: 100%;
      height: 240px;
      position: relative;
      overflow: hidden;
      border-radius: 10px;
      background: #02050d;
      margin-bottom: 1.5rem;
      border: 1px solid rgba(56, 189, 248, 0.08);
    }
    canvas#matrixCanvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    .slab-led-bar {
      display: flex;
      gap: 4px;
      margin-bottom: 0.8rem;
    }
    .led-dot {
      flex: 1;
      height: 5px;
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.06);
      transition: all 0.3s;
    }
    .led-dot.active {
      background: var(--aqua);
      box-shadow: 0 0 8px var(--aqua);
    }
    .slab-footer-info {
      display: flex;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-dim);
    }

    /* STATS BANNER COUNTER */
    .stats-strip-wrap {
      max-width: 1400px;
      margin: 3rem auto 0;
      width: 100%;
      padding: 0 2rem;
      z-index: 2;
      position: relative;
    }
    .stats-strip {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 1.5rem;
      padding: 2.5rem 0;
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }
    .stat-metric-val {
      font-size: 2.6rem;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: #fff;
      line-height: 1;
      margin-bottom: 0.4rem;
    }
    .stat-metric-label {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--text-dim);
    }

    /* ========================================================= */
    /* 3. SECTION 01 / THE PROBLEM (MIN-HEIGHT 85VH) */
    /* ========================================================= */
    .section-stage-problem {
      min-height: calc(100vh - 58px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 3.5rem 2rem;
      position: relative;
      z-index: 2;
    }
    .section-problem-grid {
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
      display: grid;
      grid-template-columns: 1.1fr 1.3fr 0.8fr;
      gap: 4rem;
      align-items: center;
    }
    .problem-left-col h2 {
      font-size: 2.8rem;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: -0.03em;
      margin-bottom: 1.2rem;
    }
    .problem-left-col h2 em {
      font-style: italic;
      font-weight: 400;
      color: #fff;
    }
    .problem-left-col p {
      font-size: 1rem;
      color: var(--text-dim);
      line-height: 1.6;
    }

    .breakdown-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.8rem;
      backdrop-filter: blur(16px);
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }
    .b-card-head {
      display: flex;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-dim);
      margin-bottom: 1.5rem;
    }
    .b-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.82rem;
      font-family: var(--font-mono);
      margin-bottom: 0.85rem;
    }
    .b-row-label {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      color: var(--text-dim);
      width: 190px;
    }
    .b-row-dot {
      width: 6px; height: 6px;
      border-radius: 50%;
    }
    .b-row-track {
      flex: 1;
      height: 4px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 999px;
      margin: 0 1rem;
      overflow: hidden;
    }
    .b-row-fill {
      height: 100%;
      border-radius: 999px;
    }
    .b-row-pct {
      color: var(--text-muted);
      width: 38px;
      text-align: right;
    }
    .b-subnote {
      font-family: var(--font-mono);
      font-size: 0.7rem;
      color: var(--text-muted);
      margin: 1.2rem 0;
    }
    .b-footer-bar {
      border-top: 1px solid var(--border);
      padding-top: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--aqua);
    }
    .b-footer-progress {
      flex: 1;
      height: 4px;
      background: rgba(0, 240, 255, 0.15);
      border-radius: 999px;
      margin-left: 1.5rem;
      overflow: hidden;
    }
    .b-footer-fill {
      width: 86%;
      height: 100%;
      background: var(--aqua);
      box-shadow: 0 0 12px var(--aqua);
    }

    .problem-right-col {
      font-size: 1.15rem;
      line-height: 1.7;
      color: #94a3b8;
    }
    .problem-right-col strong {
      color: #fff;
      font-weight: 600;
    }

    /* ========================================================= */
    /* 4. SECTION 02 / THE SOLUTION (MIN-HEIGHT 80VH) */
    /* ========================================================= */
    .section-stage-solution {
      min-height: calc(100vh - 58px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 3.5rem 2rem;
      position: relative;
      z-index: 2;
    }
    .section-solution-grid {
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 5rem;
      align-items: flex-start;
    }
    .solution-left h2 {
      font-size: 3rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 1.2rem;
    }
    .solution-left h2 em {
      font-style: italic;
      font-weight: 400;
    }
    .solution-left p {
      font-size: 1.05rem;
      color: var(--text-dim);
      line-height: 1.6;
    }
    .specs-table-box {
      border-top: 1px solid var(--border);
    }
    .specs-table-title {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      color: var(--text-muted);
      letter-spacing: 0.12em;
      margin-bottom: 1rem;
      padding-top: 0.4rem;
    }
    .spec-table-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.1rem 0;
      border-bottom: 1px solid rgba(56, 189, 248, 0.06);
      font-family: var(--font-mono);
      font-size: 0.85rem;
    }
    .spec-label {
      color: var(--text-dim);
      letter-spacing: 0.05em;
    }
    .spec-val {
      color: #fff;
      font-weight: 500;
    }

    /* ========================================================= */
    /* 5. SECTION 03 / SEE IT IN ACTION (MIN-HEIGHT 85VH) */
    /* ========================================================= */
    .section-stage-action {
      min-height: calc(100vh - 58px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 3.5rem 2rem;
      position: relative;
      z-index: 2;
    }
    .section-action-grid {
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
      display: grid;
      grid-template-columns: 0.9fr 1.3fr;
      gap: 4.5rem;
      align-items: flex-start;
    }
    .action-left h2 {
      font-size: 3rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 1.2rem;
    }
    .action-left h2 em {
      font-style: italic;
      font-weight: 400;
    }
    .action-left p {
      font-size: 1.05rem;
      color: var(--text-dim);
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .action-link-btn {
      color: var(--aqua);
      text-decoration: none;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: gap 0.2s;
    }
    .action-link-btn:hover { gap: 0.6rem; }

    .action-terminal-card {
      background: #02050e;
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 25px 60px rgba(0,0,0,0.6);
    }
    .action-tabs-bar {
      display: flex;
      gap: 1.5rem;
      padding: 0 1.5rem;
      background: rgba(56, 189, 248, 0.02);
      border-bottom: 1px solid var(--border);
    }
    .action-tab-item {
      padding: 0.85rem 0;
      font-family: var(--font-mono);
      font-size: 0.82rem;
      color: var(--text-dim);
      cursor: pointer;
      position: relative;
      border: none;
      background: none;
      transition: color 0.2s;
    }
    .action-tab-item:hover { color: #fff; }
    .action-tab-item.active {
      color: #fff;
    }
    .action-tab-item.active::after {
      content: '';
      position: absolute;
      bottom: -1px; left: 0; right: 0;
      height: 2px;
      background: var(--aqua);
      box-shadow: 0 0 10px var(--aqua);
    }
    .action-split-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .action-col {
      padding: 1.5rem;
    }
    .action-col:first-child {
      border-right: 1px solid rgba(56, 189, 248, 0.08);
    }
    .action-col-head {
      display: flex;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 0.72rem;
      margin-bottom: 1rem;
      color: var(--text-muted);
    }
    .action-col-head .label-raw { color: #f87171; }
    .action-col-head .label-clean { color: var(--aqua); font-weight: 600; }
    .action-code-pane {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      line-height: 1.6;
      color: #cbd5e1;
      height: 290px;
      overflow-y: auto;
      white-space: pre;
    }
    .action-code-pane.clean { color: #7dd3fc; }

    /* ========================================================= */
    /* 6. SECTION 04 / THE EVIDENCE (MIN-HEIGHT 90VH) */
    /* ========================================================= */
    .section-stage-evidence {
      min-height: calc(100vh - 58px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 3.5rem 2rem;
      position: relative;
      z-index: 2;
    }
    .section-evidence-wrap {
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }
    .evidence-head-block {
      margin-bottom: 3rem;
    }
    .evidence-head-block h2 {
      font-size: 3rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 0.6rem;
    }
    .evidence-head-block h2 em {
      font-style: italic;
      font-weight: 400;
    }
    .evidence-head-block p {
      font-size: 1.05rem;
      color: var(--text-dim);
    }

    .evidence-duo-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2.5rem;
    }
    .evidence-window {
      background: #02050e;
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 25px 60px rgba(0,0,0,0.6);
    }
    .evidence-window-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1.2rem;
      background: rgba(56, 189, 248, 0.03);
      border-bottom: 1px solid var(--border);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-dim);
    }
    .mac-dots {
      display: flex;
      gap: 6px;
    }
    .mac-dot {
      width: 9px; height: 9px;
      border-radius: 50%;
    }
    .evidence-pre {
      padding: 1.5rem;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      line-height: 1.65;
      color: #cbd5e1;
      height: 380px;
      overflow: auto;
      white-space: pre;
    }
    .evidence-footer-caption {
      margin-top: 1.2rem;
    }
    .badge-pill-cyan {
      display: inline-flex;
      align-items: center;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid rgba(0, 240, 255, 0.3);
      color: var(--aqua);
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 0.6rem;
    }
    .evidence-footer-caption p {
      font-size: 0.88rem;
      color: var(--text-dim);
      line-height: 1.5;
    }

    /* ========================================================= */
    /* 7. SECTION 05 / THE IMPACT (MIN-HEIGHT 85VH) */
    /* ========================================================= */
    .section-stage-impact {
      min-height: calc(100vh - 58px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 3.5rem 2rem;
      position: relative;
      z-index: 2;
    }
    .section-impact-wrap {
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }
    .impact-top-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 4.5rem;
      margin-bottom: 5rem;
      align-items: flex-start;
    }
    .impact-left h2 {
      font-size: 3.2rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 1rem;
    }
    .impact-left h2 em {
      font-style: italic;
      font-weight: 400;
    }
    .impact-left p {
      font-size: 1.05rem;
      color: var(--text-dim);
    }
    .impact-cards-trio {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.8rem;
    }
    .impact-trio-card {
      border-left: 1px solid var(--border);
      padding-left: 1.8rem;
    }
    .trio-icon-circle {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: rgba(0, 240, 255, 0.08);
      border: 1px solid rgba(0, 240, 255, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--aqua);
      margin-bottom: 1.2rem;
      font-size: 0.9rem;
    }
    .impact-trio-card h3 {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #fff;
    }
    .impact-trio-card p {
      font-size: 0.88rem;
      color: var(--text-dim);
      line-height: 1.5;
    }

    .stack-strip-wrap {
      text-align: center;
      border-top: 1px solid var(--border);
      padding-top: 3.5rem;
    }
    .stack-strip-title {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-muted);
      letter-spacing: 0.2em;
      text-transform: uppercase;
      margin-bottom: 2.2rem;
    }
    .stack-logos-row {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 3rem;
      flex-wrap: wrap;
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--text-dim);
    }
    .stack-item {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      transition: color 0.2s;
    }
    .stack-item:hover { color: #fff; }

    /* ========================================================= */
    /* 8. SECTION 06 / GET STARTED (MIN-HEIGHT 85VH) */
    /* ========================================================= */
    .section-stage-get-started {
      min-height: calc(100vh - 58px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 3.5rem 2rem;
      position: relative;
      z-index: 2;
    }
    .section-get-started-wrap {
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }
    .get-started-head {
      margin-bottom: 3.5rem;
    }
    .get-started-head h2 {
      font-size: 3rem;
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 0.8rem;
    }
    .get-started-head h2 em {
      font-style: italic;
      font-weight: 400;
    }
    .get-started-head p {
      font-size: 1.05rem;
      color: var(--text-dim);
    }
    .get-started-top-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.8rem;
      margin-bottom: 2.5rem;
    }
    .start-card-box {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 1.8rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .start-card-box h3 {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 0.4rem;
    }
    .start-card-box p {
      font-size: 0.82rem;
      color: var(--text-dim);
      margin-bottom: 1.5rem;
    }
    .cmd-box-row {
      background: #02050e;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--aqua);
      margin-bottom: 0.6rem;
    }
    .cmd-box-row button {
      background: none;
      border: none;
      color: var(--text-dim);
      cursor: pointer;
      font-size: 0.85rem;
      transition: color 0.2s;
    }
    .cmd-box-row button:hover { color: #fff; }

    .hook-activation-box {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2.2rem;
    }
    .hook-title {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 1.2rem;
    }
    .hook-tabs {
      display: flex;
      gap: 0.6rem;
      margin-bottom: 1.5rem;
    }
    .hook-tab {
      background: rgba(56, 189, 248, 0.03);
      border: 1px solid var(--border);
      color: var(--text-dim);
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .hook-tab.active {
      background: rgba(0, 240, 255, 0.12);
      border-color: var(--aqua);
      color: var(--aqua);
    }
    .hook-cmd-display {
      background: #02050e;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem 1.2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 0.88rem;
      color: var(--aqua);
      margin-bottom: 1.2rem;
    }
    .hook-desc-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.85rem;
      color: var(--text-dim);
      flex-wrap: wrap;
      gap: 1rem;
    }
    .hook-desc-footer a {
      color: var(--aqua);
      text-decoration: none;
      font-family: var(--font-mono);
    }

    /* ========================================================= */
    /* 9. SECTION 07 / LIVE STUDIO PLAYGROUND */
    /* ========================================================= */
    .section-stage-studio {
      min-height: calc(100vh - 58px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 3.5rem 2rem 5rem;
      position: relative;
      z-index: 2;
    }
    .section-studio-wrap {
      max-width: 1400px;
      margin: 0 auto;
      width: 100%;
    }
    .studio-box-shell {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 25px 60px rgba(0,0,0,0.6);
    }
    .studio-topbar {
      padding: 1rem 1.8rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(56, 189, 248, 0.02);
    }
    .studio-split-panes {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: 380px;
    }
    .studio-pane {
      padding: 1.8rem;
      display: flex;
      flex-direction: column;
    }
    .studio-pane:first-child {
      border-right: 1px solid var(--border);
    }
    textarea.studio-input {
      flex: 1;
      width: 100%;
      background: #02050e;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.2rem;
      color: var(--text-main);
      font-family: var(--font-mono);
      font-size: 0.85rem;
      resize: none;
      outline: none;
      line-height: 1.6;
    }
    textarea.studio-input:focus { border-color: var(--aqua); }
    .studio-output {
      flex: 1;
      width: 100%;
      background: #02050e;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.2rem;
      color: var(--aqua-ice);
      font-family: var(--font-mono);
      font-size: 0.85rem;
      overflow-y: auto;
      white-space: pre-wrap;
      line-height: 1.6;
    }
    .studio-bottombar {
      padding: 1.2rem 1.8rem;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(56, 189, 248, 0.02);
    }
    .btn-synthesize-run {
      background: var(--aqua);
      color: #021526;
      font-weight: 700;
      border: none;
      padding: 0.65rem 1.6rem;
      border-radius: 8px;
      cursor: pointer;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      transition: all 0.25s;
    }
    .btn-synthesize-run:hover {
      background: #7dd3fc;
      box-shadow: 0 0 20px var(--aqua-glow);
    }

    /* FOOTER */
    footer {
      border-top: 1px solid var(--border);
      background: #02040b;
      padding: 5rem 2rem 3rem;
      position: relative;
      z-index: 2;
    }
    .footer-inner {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 1fr;
      gap: 3rem;
      margin-bottom: 4rem;
    }
    .footer-brand h4 {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      margin-bottom: 0.8rem;
    }
    .footer-brand p {
      font-size: 0.88rem;
      color: var(--text-dim);
      max-width: 320px;
      line-height: 1.6;
    }
    .footer-col h5 {
      font-size: 0.85rem;
      font-weight: 600;
      color: #fff;
      margin-bottom: 1.2rem;
    }
    .footer-col a {
      display: block;
      font-size: 0.85rem;
      color: var(--text-dim);
      text-decoration: none;
      margin-bottom: 0.65rem;
      transition: color 0.2s;
    }
    .footer-col a:hover { color: #fff; }
    .footer-bottom {
      max-width: 1400px;
      margin: 0 auto;
      border-top: 1px solid rgba(56, 189, 248, 0.06);
      padding-top: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.82rem;
      color: var(--text-muted);
      flex-wrap: wrap;
      gap: 1rem;
    }

    #toast {
      position: fixed;
      bottom: 2rem; right: 2rem;
      background: var(--aqua);
      color: #021526;
      font-weight: 700;
      padding: 0.85rem 1.4rem;
      border-radius: 8px;
      font-size: 0.88rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.6);
      display: none;
      z-index: 9999;
      font-family: var(--font-mono);
      animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes toastIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    @media (max-width: 1024px) {
      .hero-split-grid { grid-template-columns: 1fr; gap: 3rem; }
      .section-problem-grid { grid-template-columns: 1fr; gap: 2.5rem; }
      .section-solution-grid { grid-template-columns: 1fr; gap: 2.5rem; }
      .section-action-grid { grid-template-columns: 1fr; gap: 2.5rem; }
      .evidence-duo-grid { grid-template-columns: 1fr; }
      .impact-top-grid { grid-template-columns: 1fr; gap: 2.5rem; }
      .impact-cards-trio { grid-template-columns: 1fr; gap: 2rem; }
      .get-started-top-cards { grid-template-columns: 1fr; }
      .footer-inner { grid-template-columns: 1fr 1fr; }
      .stats-strip { grid-template-columns: repeat(2, 1fr); }
      .nav-center-links { display: none; }
    }
    @media (max-width: 768px) {
      .studio-split-panes { grid-template-columns: 1fr; }
      .studio-pane:first-child { border-right: none; border-bottom: 1px solid var(--border); }
      .action-split-content { grid-template-columns: 1fr; }
      .action-col:first-child { border-right: none; border-bottom: 1px solid rgba(56, 189, 248, 0.06); }
      .hero-split-left h2 { font-size: 2.8rem; }
      .footer-inner { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="viewport-grid"></div>

  ${sharedHeaderAndSearch('product')}

  <main>
    <!-- 1. FULL VIEWPORT INTRO HERO: TOTEM + SEE HOW IT WORKS (ONLY THIS IS SHOWN ON LOAD) -->
    <section class="hero-top-stage">
      <div class="laser-line-axis">
        <div class="laser-particle"></div>
      </div>

      <div class="hero-totem-wrap">
        <div class="hero-totem-aura"></div>
        <img src="/icon.svg" alt="Graviton Singularity Totem" class="hero-totem-icon">
        <div class="totem-brand-sub">G R A V I T O N</div>
      </div>

      <div class="hero-pre-title">Your AI agent drowns in noise &amp; lost context.</div>
      <h1 class="hero-main-title">Graviton brings pinpoint clarity.</h1>

      <a href="#hero-showcase" class="btn-see-how">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M19 12l-7 7-7-7"/>
        </svg>
        <span>See how it works</span>
      </a>
    </section>

    <!-- 2. STAGE: DUAL SHOWCASE SPLIT (CLEAN CONTEXT BETTER AGENTS + SLAB) -->
    <section id="hero-showcase" class="section-stage-showcase">
      <div class="hero-split-grid">
        <div class="hero-split-left slide-reveal-left">
          <a href="#get-started" class="pill-banner-link">
            <span class="badge-dot">●</span>
            <span><strong>Graviton V3.0.0:</strong> 20 Autonomous Engines &amp; Production-Ready AI Acceleration →</span>
          </a>
          <h2>
            Clean context.<br>
            <span class="accent-aqua">Pinpoint accuracy.</span>
          </h2>
          <p class="hero-split-desc">
            Graviton is the zero-auth terminal accelerator and Autonomous Intelligent Context Engine built specifically for Google Antigravity. It orchestrates 20 autonomous background engines: pins exact target files directly into prompts (eliminating 100% of exploratory search loops), prunes -95% terminal &amp; stack trace noise, compresses multi-turn diffs, transpiles Office &amp; PDF docs in 0ms via content-addressable cache, manages IDE conversation history (<code>grav -c</code>), and auto-relays execution in &lt; 0.8ms using 100% offline Node.js V8 standard libraries.
          </p>

          <div class="hero-actions-row">
            <a href="#get-started" class="btn-primary-pill">
              <span>Install Graviton →</span>
            </a>
            <a href="https://github.com/alatariz/graviton" target="_blank" class="btn-glass-pill">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              <span>View on GitHub ↗</span>
            </a>
          </div>

          <div class="hero-meta-strip">
            V3.0.0 · Open source · GNU AGPLv3 · Built for Google Antigravity
          </div>
        </div>

        <div class="matrix-phone-slab slide-reveal-right">
          <div class="slab-header">
            <span class="slab-title">INTELLIGENT CONTEXT</span>
            <span class="slab-status">100% OFFLINE</span>
          </div>

          <div class="matrix-canvas-wrap">
            <canvas id="matrixCanvas"></canvas>
          </div>

          <div class="slab-led-bar">
            <div class="led-dot active"></div><div class="led-dot active"></div><div class="led-dot active"></div>
            <div class="led-dot active"></div><div class="led-dot active"></div><div class="led-dot active"></div><div class="led-dot active"></div>
            <div class="led-dot active"></div><div class="led-dot active"></div><div class="led-dot active"></div><div class="led-dot active"></div>
            <div class="led-dot active"></div><div class="led-dot active"></div><div class="led-dot active"></div><div class="led-dot active"></div>
            <div class="led-dot active"></div><div class="led-dot active"></div><div class="led-dot active"></div><div class="led-dot active"></div>
          </div>

          <div class="slab-footer-info">
            <span>Room for reasoning</span>
            <span style="color: var(--aqua); font-weight: 700;">88% Tokens Saved · 0 Loops</span>
          </div>
        </div>
      </div>

      <!-- STATS BANNER STRIP (INTEGRATED INTO SHOWCASE STAGE) -->
      <div class="stats-strip-wrap slide-reveal-up">
        <div class="stats-strip">
          <div class="stat-box-item">
            <div class="stat-metric-val">88.9%</div>
            <div class="stat-metric-label">Tokens Saved</div>
          </div>
          <div class="stat-box-item">
            <div class="stat-metric-val">0 Loops</div>
            <div class="stat-metric-label">Target Pinning</div>
          </div>
          <div class="stat-box-item">
            <div class="stat-metric-val">&lt; 0.8ms</div>
            <div class="stat-metric-label">Dispatch Latency</div>
          </div>
          <div class="stat-box-item">
            <div class="stat-metric-val">100%</div>
            <div class="stat-metric-label">Pure Node V8 stdlib</div>
          </div>
          <div class="stat-box-item">
            <div class="stat-metric-val">Zero</div>
            <div class="stat-metric-label">External API Keys</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. STAGE: 01 / THE PROBLEM -->
    <section id="how-it-works" class="section-stage-problem">
      <div class="section-problem-grid">
        <div class="problem-left-col slide-reveal-left">
          <div class="section-tag">01 / The Problem</div>
          <h2>Your context<br>window is<br><em>valuable</em></h2>
          <p>
            AI agents don't need more output. They need more relevant output. Graviton prevents terminal output noise and conversational fluff from triggering premature auto-compact.
          </p>
        </div>

        <div class="breakdown-card slide-reveal-up">
          <div class="b-card-head">
            <span>AI CONTEXT</span>
            <span style="color: var(--aqua); font-weight: 700;">14% USED</span>
          </div>

          <div class="b-row">
            <div class="b-row-label">
              <span class="b-row-dot" style="background: #38bdf8;"></span>
              <span>System prompt & tools</span>
            </div>
            <div class="b-row-track"><div class="b-row-fill" style="width: 3%; background: #38bdf8;"></div></div>
            <span class="b-row-pct">3%</span>
          </div>

          <div class="b-row">
            <div class="b-row-label">
              <span class="b-row-dot" style="background: var(--aqua);"></span>
              <span>MCP tools</span>
            </div>
            <div class="b-row-track"><div class="b-row-fill" style="width: 1%; background: var(--aqua);"></div></div>
            <span class="b-row-pct">1%</span>
          </div>

          <div class="b-row">
            <div class="b-row-label">
              <span class="b-row-dot" style="background: #a78bfa;"></span>
              <span>Memory files</span>
            </div>
            <div class="b-row-track"><div class="b-row-fill" style="width: 1%; background: #a78bfa;"></div></div>
            <span class="b-row-pct">1%</span>
          </div>

          <div class="b-row">
            <div class="b-row-label">
              <span class="b-row-dot" style="background: #f59e0b;"></span>
              <span>Skills matrix</span>
            </div>
            <div class="b-row-track"><div class="b-row-fill" style="width: 0.5%; background: #f59e0b;"></div></div>
            <span class="b-row-pct">0.5%</span>
          </div>

          <div class="b-row">
            <div class="b-row-label">
              <span class="b-row-dot" style="background: #818cf8;"></span>
              <span>Conversation history</span>
            </div>
            <div class="b-row-track"><div class="b-row-fill" style="width: 8%; background: #818cf8;"></div></div>
            <span class="b-row-pct">8%</span>
          </div>

          <div class="b-row">
            <div class="b-row-label">
              <span class="b-row-dot" style="background: #ef4444;"></span>
              <span>CLI output / logs</span>
            </div>
            <div class="b-row-track"><div class="b-row-fill" style="width: 0.5%; background: #ef4444;"></div></div>
            <span class="b-row-pct" style="color: var(--aqua);">0% (Pruned)</span>
          </div>

          <div class="b-subnote">Example session, varies by project and tooling</div>

          <div class="b-footer-bar">
            <span>More room for reasoning.</span>
            <div class="b-footer-progress">
              <div class="b-footer-fill"></div>
            </div>
          </div>
        </div>

        <div class="problem-right-col slide-reveal-right">
          Too much noise means <strong>higher costs</strong>, <strong>slower reasoning</strong> and <strong>less capable agents</strong>.
        </div>
      </div>
    </section>

        <!-- 4. STAGE: 02 / THE SOLUTION (GRAVITON CORE ARCHITECTURE) -->
    <section id="solution" class="section-stage-solution">
      <div class="section-solution-grid">
        <div class="solution-left slide-reveal-left">
          <div class="section-tag">02 / Graviton Core Architecture</div>
          <h2>Intelligent Scope &amp;<br><em>Autonomous Relay</em></h2>
          <p>
            Graviton V3.0.0 is an offline, zero-auth autonomous intelligence layer that turns vague developer instructions into target-pinned, context-pruned execution blueprints before they touch Google Antigravity.
          </p>
          <div style="margin-top: 1.5rem; display: flex; gap: 0.8rem; flex-wrap: wrap;">
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">🎯 Smart Target Pinning</span>
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">💬 IDE Conversation History</span>
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">⚡ Terminal Log Filter (-95%)</span>
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">🛡️ Lockfile &amp; Asset Shield</span>
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">📉 Delta Diff Compressor</span>
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">📑 0ms Document Transpiler</span>
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">🔍 Runtime Trace Squeezer</span>
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">🚨 Syntax Sanity Guard</span>
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">⏪ Safety Rollback Guard</span>
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">🩺 System Doctor</span>
            <span class="res-badge" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;">🚀 20 Autonomous Engines</span>
          </div>
        </div>

        <div class="specs-table-box slide-reveal-right">
          <div class="specs-table-title">GRAVITON V3.0.0 CORE SPECIFICATIONS</div>

          <div class="spec-table-row">
            <span class="spec-label">TARGET PINNING</span>
            <span class="spec-val" style="color: var(--aqua);">Smart Target Pinning: Fuzzy matches keywords &amp; pins target file directly into prompt turn. 100% search loops cut.</span>
          </div>
          <div class="spec-table-row">
            <span class="spec-label">DELTA COMPRESSION</span>
            <span class="spec-val" style="color: #38bdf8;">Delta Diff Compressor: Sends line-level diff hunks per turn with out-of-band disk modification sync (-70% token waste).</span>
          </div>
          <div class="spec-table-row">
            <span class="spec-label">DOC TRANSPILER</span>
            <span class="spec-val">0ms Transpiler &amp; Cache: Transpiles Word, PDF, Excel, and CSV to Markdown with 0 dependencies and SHA-256 local cache.</span>
          </div>
          <div class="spec-table-row">
            <span class="spec-label">TRACE SQUEEZER</span>
            <span class="spec-val">Runtime Trace Squeezer: Collapses internal vendor/node frames from error stacks into token-saving placeholders (-88%).</span>
          </div>
          <div class="spec-table-row">
            <span class="spec-label">CONVERSATION</span>
            <span class="spec-val">Antigravity IDE History: Multi-turn thread management (<code>grav -c</code>), resume (<code>grav -c 1</code>), or fresh start (<code>grav -n</code>).</span>
          </div>
          <div class="spec-table-row">
            <span class="spec-label">LOG PRUNER</span>
            <span class="spec-val">Terminal Noise Filter: Intercepts ANSI colors, cargo/npm progress floods, and compresses stack traces (-95% token noise).</span>
          </div>
          <div class="spec-table-row">
            <span class="spec-label">MINIFIED SHIELD</span>
            <span class="spec-val" style="color: #38bdf8;">Lockfile &amp; Asset Shield: Neutralizes catastrophic 35,000-token .min.js context explosions and auto-redacts credentials.</span>
          </div>
          <div class="spec-table-row">
            <span class="spec-label">SANITY GUARD</span>
            <span class="spec-val">Syntax Sanity Guard: AST bracket/JSX/decorator validation and Node/Python syntax checks with automated rollback.</span>
          </div>
          <div class="spec-table-row">
            <span class="spec-label">SAFETY ROLLBACK</span>
            <span class="spec-val" style="color: var(--aqua);">Safety Rollback &amp; Diff: Pre-session snapshots in <code>~/.graviton/backups/</code>. Review edits (<code>grav diff</code>) or revert (<code>grav rb</code>).</span>
          </div>
          <div class="spec-table-row">
            <span class="spec-label">PORT GUARD</span>
            <span class="spec-val">Process Tree Daemon Guard: Terminate dev server trees cleanly (<code>taskkill /F /T</code>) with synchronous socket release checks.</span>
          </div>
          <div class="spec-table-row">
            <span class="spec-label">IGNORE ENGINE</span>
            <span class="spec-val" style="color: #38bdf8;">Hierarchical Ignore Engine: Enforces recursive <code>.gravignore</code> and <code>.gitignore</code> rules across all hydration loops.</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. STAGE: 03 / SEE IT IN ACTION -->
    <section id="action" class="section-stage-action">
      <div class="section-action-grid">
        <div class="action-left slide-reveal-left">
          <div class="section-tag">03 / See It In Action</div>
          <h2>The difference is<br><em>clear</em></h2>
          <p>
            Compare real output before and after Graviton, and see what gets filtered.
          </p>
          <a href="#how-it-works" class="action-link-btn">
            <span>Why was this removed? →</span>
          </a>
        </div>

        <div class="action-terminal-card slide-reveal-right">
          <div class="action-tabs-bar">
            <button class="action-tab-item active" onclick="switchActionTab('command', this)">Terminal Filter</button>
            <button class="action-tab-item" onclick="switchActionTab('pinning', this)">Target Pinning</button>
            <button class="action-tab-item" onclick="switchActionTab('history', this)">IDE History (-c)</button>
            <button class="action-tab-item" onclick="switchActionTab('rollback', this)">Rollback &amp; Diff</button>
            <button class="action-tab-item" onclick="switchActionTab('architect', this)">Pro Architect (-d)</button>
          </div>

          <div class="action-split-content">
            <div class="action-col">
              <div class="action-col-head">
                <span class="label-raw">WITHOUT GRAVITON</span>
                <span id="raw-line-count">1,042 LINES</span>
              </div>
              <div id="raw-code-view" class="action-code-pane"></div>
            </div>

            <div class="action-col">
              <div class="action-col-head">
                <span class="label-clean">WITH GRAVITON</span>
                <span id="clean-line-count">4 LINES (-99%)</span>
              </div>
              <div id="clean-code-view" class="action-code-pane clean"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 6. STAGE: 04 / THE EVIDENCE -->
    <section id="evidence" class="section-stage-evidence">
      <div class="section-evidence-wrap slide-reveal-up">
        <div class="evidence-head-block">
          <div class="section-tag">04 / The Evidence</div>
          <h2>Measure your graviton <em>gains</em></h2>
          <p>Real graviton gain output from a developer's daily use.</p>
        </div>

        <div class="evidence-duo-grid">
          <div class="slide-reveal-left">
            <div class="evidence-window">
              <div class="evidence-window-top">
                <div class="mac-dots">
                  <span class="mac-dot" style="background: #ef4444;"></span>
                  <span class="mac-dot" style="background: #f59e0b;"></span>
                  <span class="mac-dot" style="background: #00f0ff;"></span>
                </div>
                <span style="color: #38bdf8;">$ graviton gain</span>
                <span>10:31 · 03.03.26</span>
              </div>
              <div class="evidence-pre"><span style="color: var(--aqua);">⚡ GRAVITON Token Savings (Global Scope)</span>

Total commands:     15728
Input tokens:       146.3M
Output tokens:      16.3M
Tokens saved:       <span style="color: var(--aqua); font-weight: 700;">130.0M (88.9%)</span>
Total exec time:    780m5s (avg 3.0s)
Efficiency meter:   <span style="background: var(--aqua); color: #021526; font-weight: 700; padding: 0 4px;">██████████████████████████████</span> 88.9%

<span style="color: #94a3b8;">By Command</span>
#  Command                 Count    Saved    Avg%   Time   Impact
-----------------------------------------------------------------
1. graviton gh pr diff        72    18.1M   72.0%  648ms   <span style="color: #38bdf8;">████████</span>
2. graviton curl -s ...        1    16.3M  100.0%   8.1s   <span style="color: #38bdf8;">███████</span>
3. graviton read            1164    12.2M   22.7%    5ms   <span style="color: #38bdf8;">█████</span>
4. graviton git diff          88     4.1M   66.9%   33ms   <span style="color: #38bdf8;">██</span>
5. graviton test vitest      210     8.4M   91.2%  420ms   <span style="color: #38bdf8;">████</span></div>
            </div>
            <div class="evidence-footer-caption">
              <span class="badge-pill-cyan">88.9% efficiency</span>
              <p>After a few weeks of daily use: <strong>15,720 commands processed, 130M tokens saved.</strong></p>
            </div>
          </div>

          <div class="slide-reveal-right">
            <div class="evidence-window">
              <div class="evidence-window-top">
                <div class="mac-dots">
                  <span class="mac-dot" style="background: #ef4444;"></span>
                  <span class="mac-dot" style="background: #f59e0b;"></span>
                  <span class="mac-dot" style="background: #00f0ff;"></span>
                </div>
                <span style="color: #38bdf8;">$ graviton gain --all</span>
                <span>Daily Breakdown (35 dailys)</span>
              </div>
              <div class="evidence-pre"><span style="color: #94a3b8;">Date         Cmds    Input    Output     Saved  Saved%   Time</span>
-------------------------------------------------------------
2026-03-03    118     1.3M    129.2K      1.1M   89.5%   1.6s
2026-03-02    1200    8.5M      1.7M      6.8M   80.2%   1.1s
2026-03-01     98   178.3K     86.4K     92.6K   51.8%   1.2s
2026-02-28    550     6.1M    532.6K      5.5M   91.2%  581ms
2026-02-27    222     1.8M     89.3K      1.7M   95.1%  695ms
2026-02-26    487     4.2M      1.3M      2.9M   69.0%   1.0s
2026-02-25    203     1.2M    169.8K      1.1M   90.0%  373ms
2026-02-24     34   316.8K     46.3K    270.5K   85.4%   1.5s
2026-02-23    383     2.2M    234.7K      1.9M   89.6%   1.3s
2026-02-22    474     3.0M    234.0K      2.8M   95.0%  487ms
2026-02-21    140   222.2K     18.4K    203.8K   91.8%   1.5s
-------------------------------------------------------------
<span style="color: var(--aqua); font-weight: 700;">TOTAL               146.3M     16.3M    130.0M   88.9% (Clean)</span></div>
            </div>
            <div class="evidence-footer-caption">
              <span class="badge-pill-cyan">Per-command analytics</span>
              <p>Daily, weekly and monthly stats by command. Run <code>graviton gain</code> to see yours.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 7. STAGE: 05 / THE IMPACT -->
    <section id="impact" class="section-stage-impact">
      <div class="section-impact-wrap slide-reveal-up">
        <div class="impact-top-grid">
          <div class="impact-left">
            <div class="section-tag">05 / The Impact</div>
            <h2>More <em>efficiency</em></h2>
            <p>Less noise. More useful context. Fewer tokens.</p>
          </div>

          <div class="impact-cards-trio">
            <div class="impact-trio-card">
              <div class="trio-icon-circle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>
                </svg>
              </div>
              <h3>Less noise</h3>
              <p>Cleaner context window.</p>
            </div>

            <div class="impact-trio-card">
              <div class="trio-icon-circle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
                </svg>
              </div>
              <h3>Better reasoning</h3>
              <p>More relevant information reaches the agent.</p>
            </div>

            <div class="impact-trio-card">
              <div class="trio-icon-circle">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3>Fewer tokens</h3>
              <p>Less unnecessary output enters the context.</p>
            </div>
          </div>
        </div>

        <div class="stack-strip-wrap">
          <div class="stack-strip-title">WORKS WITH YOUR AI CODING STACK</div>
          <div class="stack-logos-row">
            <div class="stack-item"><span>✦</span> Antigravity CLI</div>
            <div class="stack-item"><span>✱</span> Claude Code</div>
            <div class="stack-item"><span>⬡</span> Cursor</div>
            <div class="stack-item"><span>🐙</span> GitHub Copilot</div>
            <div class="stack-item"><span>⚙</span> Codex</div>
            <div class="stack-item"><span>✧</span> Gemini CLI</div>
            <div class="stack-item"><span>≈</span> Windsurf</div>
            <div class="stack-item"><span>□</span> Cline</div>
            <div class="stack-item"><span>&lt;&gt;</span> OpenCode</div>
          </div>
        </div>
      </div>
    </section>

    <!-- 8. STAGE: 06 / GET STARTED -->
    <section id="get-started" class="section-stage-get-started">
      <div class="section-get-started-wrap slide-reveal-up">
        <div class="get-started-head">
          <div class="section-tag">06 / Get Started</div>
          <h2>Running in <em>30 seconds</em></h2>
          <p>Install Node.js, the Google Antigravity CLI, and Graviton globally on any workstation.</p>
        </div>

        <div class="get-started-top-cards">
          <div class="start-card-box">
            <div>
              <h3>Step 1: Install Node.js</h3>
              <p>Node.js >= 18.0.0 (v20+ LTS recommended).</p>
            </div>
            <div class="cmd-box-row">
              <span>$ winget install OpenJS.NodeJS.LTS</span>
              <button onclick="copyText('winget install OpenJS.NodeJS.LTS')">⧉</button>
            </div>
          </div>

          <div class="start-card-box">
            <div>
              <h3>Step 2: Antigravity CLI (agy)</h3>
              <p>Official command-line binary from Google.</p>
            </div>
            <div class="cmd-box-row">
              <span>irm https://antigravity.google/cli/install.ps1 | iex</span>
              <button onclick="copyText('irm https://antigravity.google/cli/install.ps1 | iex')">⧉</button>
            </div>
          </div>

          <div class="start-card-box">
            <div>
              <h3>Step 3: Install Graviton</h3>
              <p>Global installation via GitHub repository.</p>
            </div>
            <div class="cmd-box-row">
              <span>$ npm install -g github:alatariz/graviton</span>
              <button onclick="copyText('npm install -g github:alatariz/graviton')">⧉</button>
            </div>
          </div>
        </div>

        <div class="hook-activation-box">
          <div class="hook-title">Step 4: Verify System Health with Graviton Doctor</div>
          <div class="hook-cmd-display">
            <span>$ grav doc</span>
            <button onclick="copyText('grav doc')" style="background:none; border:none; color:var(--text-dim); cursor:pointer;">⧉ Copy</button>
          </div>

          <div class="hook-desc-footer">
            <span>Diagnoses Node.js version, Antigravity CLI (agy) binary resolution, brain directory, and permissions in 1 second. Run <code>grav doc --fix</code> for automated remediation.</span>
            <a href="/docs.html#installation">Full install guide →</a>
          </div>
        </div>
      </div>
    </section>

    <!-- 9. STAGE: 07 / LIVE STUDIO PLAYGROUND -->
    <section id="demo" class="section-stage-studio">
      <div class="section-studio-wrap slide-reveal-up">
        <div class="section-tag">07 / Interactive Studio</div>
        <h2 style="font-size: 2.5rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 2rem;">
          Test the synthesis engine live
        </h2>

        <div class="studio-box-shell">
          <div class="studio-topbar">
            <span style="font-family: var(--font-mono); font-size: 0.8rem; color: #a5b4fc;">
              Graviton V3.0.0 Engine · Zero External API Keys · 100% Offline V8 Execution
            </span>
            <button class="btn-see-how" onclick="loadSamplePrompt()" style="padding: 0.35rem 0.9rem;">
              Load sample verbose prompt
            </button>
          </div>

          <div class="studio-split-panes">
            <div class="studio-pane">
              <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.8rem;">
                <span>Developer Input (Raw)</span>
                <span id="studio-in-tokens">0 tokens</span>
              </div>
              <textarea id="studio-in-text" class="studio-input" placeholder="Type or paste verbose prompt / raw terminal output..."></textarea>
            </div>

            <div class="studio-pane">
              <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim); margin-bottom: 0.8rem;">
                <span>Graviton Synthesized (Clean)</span>
                <span id="studio-out-tokens" style="color: var(--aqua);">0 tokens</span>
              </div>
              <div id="studio-out-text" class="studio-output">// Press Ctrl+Enter or click "Synthesize" to run...</div>
            </div>
          </div>

          <div class="studio-bottombar">
            <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-dim);">
              Auto-copies to clipboard on synthesis · Continuous Auto-Allow Ready
            </div>
            <button class="btn-synthesize-run" onclick="executeStudioSynthesize()">
              <span>Synthesize & Prune (Ctrl+Enter)</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- FOOTER -->
  <footer>
    <div class="footer-inner">
      <div class="footer-brand">
        <h4>GRAVITON</h4>
        <p>Autonomous AI acceleration & noise pruning layer built exclusively for Google Antigravity developers.</p>
      </div>

      <div class="footer-col">
        <h5>Product</h5>
        <a href="#how-it-works">How It Works</a>
        <a href="#solution">Architecture</a>
        <a href="#action">Code Comparison</a>
        <a href="#evidence">Terminal Gains</a>
        <a href="#demo">Live Studio</a>
      </div>

      <div class="footer-col">
        <h5>Documentation</h5>
        <a href="/docs.html">Introduction</a>
        <a href="/docs.html#installation">Installation</a>
        <a href="/docs.html#cli-quickstart">CLI Commands</a>
        <a href="/docs.html#skill-matrix">Skill Matrix</a>
        <a href="/docs.html#privacy">Privacy & Redaction</a>
      </div>

      <div class="footer-col">
        <h5>Community</h5>
        <a href="https://github.com/alatariz/graviton" target="_blank">GitHub Repository ↗</a>
        <a href="https://github.com/alatariz/graviton/releases" target="_blank">Releases ↗</a>
        <a href="https://github.com/alatariz" target="_blank">Maintainer (@alatariz)</a>
        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--aqua); display: block; margin-top: 1rem;">
          ● All Systems Operational
        </span>
      </div>
    </div>

    <div class="footer-bottom">
      <div>© 2026 GRAVITON by Akmal Fauzan (@alatariz). Open Source under GNU AGPLv3.</div>
      <div>Designed with calm precision. Engineered for Graviton Core.</div>
    </div>
  </footer>

  <div id="toast">✔ Copied to clipboard</div>

  <script>
    // TOAST HELPER
    function showToast(text) {
      const toast = document.getElementById('toast');
      toast.innerText = text;
      toast.style.display = 'block';
      setTimeout(() => { toast.style.display = 'none'; }, 2400);
    }

    function copyText(str) {
      navigator.clipboard.writeText(str);
      showToast('✔ Copied: ' + str);
    }

    
    
    // SEARCH MODAL FUNCTIONALITY (SPOTLIGHT)
    const searchModal = document.getElementById('searchModal');
    const spotlightInput = document.getElementById('spotlightInput');
    const searchResultsList = document.getElementById('searchResultsList');
    const searchEmptyPrompt = document.getElementById('searchEmptyPrompt');
    const emptyQuickList = document.getElementById('emptyQuickList');
    const searchDynamicResults = document.getElementById('searchDynamicResults');

    const SEARCH_ITEMS = [
      { title: 'Install Graviton V3.0.0', sub: 'npm install -g github:alatariz/graviton', link: '/#get-started', badge: 'Install', icon: '⚡' },
      { title: 'Smart Target Pinning', sub: 'Fuzzy-match and pin exact target file directly into prompt turn', link: '/docs.html#target-pinning', badge: 'Core', icon: '🎯' },
      { title: 'Antigravity IDE History (grav -c)', sub: 'Multi-turn conversation switcher, picker, and grav -n', link: '/docs.html#conversation-management', badge: 'History', icon: '💬' },
      { title: 'Interactive REPL Chat (grav chat)', sub: 'Live chat shell with dynamic prompt indicator and slash commands', link: '/docs.html#repl-chat', badge: 'REPL', icon: '⚡' },
      { title: 'System Health Doctor (grav doc)', sub: 'Environment diagnostics and auto-remediation via --fix', link: '/docs.html#doctor', badge: 'Doctor', icon: '🩺' },
      { title: 'Safety Rollback & Diff (grav rb)', sub: 'Pre-session file snapshots in ~/.graviton/backups/ & diff viewer', link: '/docs.html#rollback', badge: 'Safety', icon: '⏪' },
      { title: 'Port Guard & Dev Daemons (grav port)', sub: 'Run background servers cleanly and inspect listening ports', link: '/docs.html#port-guard', badge: 'Daemons', icon: '🛡️' },
      { title: 'Session Compactor (grav cmp)', sub: 'Compress continuous sessions to refresh context window', link: '/docs.html#session-compactor', badge: 'Memory', icon: '📦' },
      { title: 'Execution Modes (-f vs -d)', sub: 'Fast execution without planning vs Deep architectural synthesis', link: '/docs.html#execution-modes', badge: 'Modes', icon: '⚙️' },
      { title: 'CLI Command Reference', sub: 'Complete syntax table with all commands and short aliases', link: '/docs.html#cli-reference', badge: 'Docs', icon: '📖' },
      { title: 'Antigravity Skill Matrix', sub: 'Modern Web, BigQuery ETL, Flutter, and Testing directives', link: '/docs.html#skill-matrix', badge: 'Skills', icon: '🗝️' },
      { title: 'Privacy & Secret Redaction', sub: 'Automatic credential scrubbing into [REDACTED_SECRET]', link: '/docs.html#privacy', badge: 'Security', icon: '🔒' }
    ];

    let currentSelectedIndex = -1;

    function renderSearchItemHtml(item, idx) {
      return '<a href="' + item.link + '" class="search-result-item" onclick="closeSearchModal()" data-index="' + idx + '">' +
        '<span class="res-icon">' + item.icon + '</span>' +
        '<div class="res-body">' +
          '<div class="res-title">' + item.title + '</div>' +
          '<div class="res-sub">' + item.sub + '</div>' +
        '</div>' +
        '<span class="res-badge">' + item.badge + '</span>' +
      '</a>';
    }

    function renderEmptyState() {
      if (!emptyQuickList) return;
      emptyQuickList.innerHTML = SEARCH_ITEMS.slice(0, 4).map(function(item, idx) {
        return renderSearchItemHtml(item, idx);
      }).join('');
    }

    function openSearchModal() {
      if (searchModal) {
        searchModal.showModal();
        currentSelectedIndex = -1;
        if (spotlightInput) {
          spotlightInput.value = '';
          spotlightInput.focus();
        }
        if (searchEmptyPrompt) searchEmptyPrompt.style.display = 'block';
        if (searchDynamicResults) {
          searchDynamicResults.style.display = 'none';
          searchDynamicResults.innerHTML = '';
        }
        renderEmptyState();
      }
    }

    function closeSearchModal() {
      if (searchModal && searchModal.open) {
        searchModal.close();
      }
    }

    if (searchModal) {
      searchModal.addEventListener('click', function(e) {
        const rect = searchModal.getBoundingClientRect();
        const isInDialog = (
          rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
          rect.left <= e.clientX && e.clientX <= rect.left + rect.width
        );
        if (!isInDialog) closeSearchModal();
      });
    }

    // Keyboard Shortcuts: Ctrl+K / Cmd+K and Arrow Navigation
    window.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchModal();
      }
      if (e.key === 'Escape' && searchModal && searchModal.open) {
        closeSearchModal();
      }

      if (searchModal && searchModal.open) {
        const items = searchResultsList.querySelectorAll('.search-result-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
          e.preventDefault();
          currentSelectedIndex = (currentSelectedIndex + 1) % items.length;
          updateSelected(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          currentSelectedIndex = (currentSelectedIndex - 1 + items.length) % items.length;
          updateSelected(items);
        } else if (e.key === 'Enter') {
          if (currentSelectedIndex >= 0 && items[currentSelectedIndex]) {
            e.preventDefault();
            items[currentSelectedIndex].click();
          }
        }
      }
    });

    function updateSelected(items) {
      items.forEach(function(item, idx) {
        if (idx === currentSelectedIndex) {
          item.classList.add('selected');
          item.scrollIntoView({ block: 'nearest' });
        } else {
          item.classList.remove('selected');
        }
      });
    }

    if (spotlightInput) {
      spotlightInput.addEventListener('input', function(e) {
        const query = e.target.value.toLowerCase().trim();
        currentSelectedIndex = -1;

        if (!query) {
          if (searchEmptyPrompt) searchEmptyPrompt.style.display = 'block';
          if (searchDynamicResults) {
            searchDynamicResults.style.display = 'none';
            searchDynamicResults.innerHTML = '';
          }
          renderEmptyState();
          return;
        }

        if (searchEmptyPrompt) searchEmptyPrompt.style.display = 'none';
        if (searchDynamicResults) searchDynamicResults.style.display = 'block';

        const filtered = SEARCH_ITEMS.filter(function(item) {
          return item.title.toLowerCase().indexOf(query) !== -1 || 
                 item.sub.toLowerCase().indexOf(query) !== -1 || 
                 item.badge.toLowerCase().indexOf(query) !== -1;
        });

        if (filtered.length === 0) {
          searchDynamicResults.innerHTML = '<div style="padding: 2rem 1rem; text-align: center; color: var(--text-dim); font-size: 0.9rem;">No matching docs or commands found for &quot;' + query + '&quot;</div>';
          return;
        }

        searchDynamicResults.innerHTML = filtered.map(function(item, idx) {
          return renderSearchItemHtml(item, idx);
        }).join('');
      });
    }

    // SCROLL SLIDE-IN REVEAL OBSERVER (AUTHENTIC 1.25s SMOOTH SCROLL ANIMATION)
    function initScrollReveal() {
      const elements = document.querySelectorAll('.slide-reveal-left, .slide-reveal-right, .slide-reveal-up');
      if (!('IntersectionObserver' in window)) {
        elements.forEach(function(el) { el.classList.add('is-revealed'); });
        return;
      }
      const observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });

      elements.forEach(function(el) {
        const rect = el.getBoundingClientRect();
        // ONLY elements already on screen above fold are revealed on load
        // All lower elements will smoothly slide in when scrolled into view
        if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
          el.classList.add('is-revealed');
        } else {
          observer.observe(el);
        }
      });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initScrollReveal);
    } else {
      initScrollReveal();
    }

    // MATRIX DOTS CANVAS SIMULATION IN AQUAMARINE (OPTIMIZED WITH INTERSECTION OBSERVER)
    const canvas = document.getElementById('matrixCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let w = canvas.width = (canvas.parentElement ? canvas.parentElement.clientWidth : 300);
      let h = canvas.height = (canvas.parentElement ? canvas.parentElement.clientHeight : 150);

      window.addEventListener('resize', function() {
        if (!canvas.parentElement) return;
        w = canvas.width = canvas.parentElement.clientWidth;
        h = canvas.height = canvas.parentElement.clientHeight;
      });

      const cols = 24;
      const rows = 12;
      const drops = [
        { col: 3, row: 0, speed: 0.12 },
        { col: 8, row: 2, speed: 0.16 },
        { col: 14, row: 5, speed: 0.14 },
        { col: 19, row: 1, speed: 0.18 }
      ];

      let animationFrameId = null;
      let isCanvasVisible = false;

      function renderMatrix() {
        if (!isCanvasVisible) {
          animationFrameId = null;
          return;
        }

        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < drops.length; i++) {
          const drop = drops[i];
          drop.row += drop.speed;
          if (drop.row > rows) {
            drop.row = 0;
            drop.col = Math.floor(Math.random() * cols);
            drop.speed = 0.1 + Math.random() * 0.12;
          }
        }
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = (c + 0.5) * (w / cols);
            const y = (r + 0.5) * (h / rows);
            let alpha = 0.08;
            for (let i = 0; i < drops.length; i++) {
              const drop = drops[i];
              if (Math.abs(drop.col - c) < 1 && Math.abs(drop.row - r) < 2) {
                const dist = Math.abs(drop.row - r);
                alpha = Math.max(alpha, 1 - dist * 0.45);
              }
            }
            ctx.fillStyle = alpha > 0.4 ? 'rgba(0, 240, 255, ' + alpha + ')' : 'rgba(186, 230, 253, ' + (alpha * 0.7) + ')';
            ctx.beginPath();
            ctx.arc(x, y, alpha > 0.4 ? 2.2 : 1.4, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        animationFrameId = requestAnimationFrame(renderMatrix);
      }

      if ('IntersectionObserver' in window) {
        const matrixObserver = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              if (!isCanvasVisible) {
                isCanvasVisible = true;
                if (!animationFrameId) {
                  animationFrameId = requestAnimationFrame(renderMatrix);
                }
              }
            } else {
              isCanvasVisible = false;
              if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
              }
            }
          });
        }, { threshold: 0.05 });

        matrixObserver.observe(canvas);
      } else {
        isCanvasVisible = true;
        renderMatrix();
      }
    }

        // ACTION TAB PRESETS (GRAVITON CORE SHOWCASE)
    const ACTION_PRESETS = JSON.parse(atob('eyJjb21tYW5kIjp7InJhd0xpbmVzIjoiMSwwNDIgTElORVMiLCJjbGVhbkxpbmVzIjoiNCBMSU5FUyAoLTk5JSkiLCJyYXciOiIkIGNhcmdvIGJ1aWxkXG4gICBDb21waWxpbmcgbGliYyB2MC4yLjE1NVxuICAgQ29tcGlsaW5nIHByb2MtbWFjcm8yIHYxLjAuODVcbiAgIENvbXBpbGluZyB1bmljb2RlLWlkZW50IHYxLjAuMTJcbiAgIENvbXBpbGluZyBxdW90ZSB2MS4wLjM2XG4gICBDb21waWxpbmcgc3luIHYyLjAuNjZcbiAgIENvbXBpbGluZyBjZmctaWYgdjEuMC4wXG4gICBDb21waWxpbmcgb25jZV9jZWxsIHYxLjE5LjBcbls9PT09PiAgICAgICAgICAgICAgIF0gMTQvMjE0IGNyYXRlcyBjb21waWxlZCAoZXRhIDEycykuLi5cbndhcm5pbmc6IHVudXNlZCB2YXJpYWJsZTogJ3JhdydcbiAgLS0+IHNyYy9maWx0ZXIucnM6MjE0Ojlcbndhcm5pbmc6IGZpZWxkIGlzIG5ldmVyIHJlYWQ6ICdkZXB0aCdcbiAgLS0+IHNyYy90cmVlLnJzOjg3OjVcbiAgIENvbXBpbGluZyBzZXJkZSB2MS4wLjE5N1xuICAgQ29tcGlsaW5nIGFueWhvdyB2MS4wLjc5XG4uLi4gMSwwMjggbW9yZSBsaW5lcyBvZiBwcm9ncmVzcyBub2lzZSAuLi5cbkZpbmlzaGVkIGRldiBbdW5vcHRpbWl6ZWRdIGluIDMyLjQ4cyIsImNsZWFuIjoiJCBncmF2aXRvbiBydW4gY2FyZ28gYnVpbGRcbltUZXJtaW5hbCBOb2lzZSBGaWx0ZXI6IDEsMDM4IHByb2dyZXNzIGxpbmVzIGRpc2NhcmRlZF1cbuKclCBidWlsZCBmaW5pc2hlZCBpbiAzMi40cyAoMjE0IGNyYXRlcylcbndhcm5pbmc6IHVudXNlZCB2YXJpYWJsZTogJ3JhdycgLS0+IHNyYy9maWx0ZXIucnM6MjE0Ojlcbndhcm5pbmc6IGZpZWxkIGlzIG5ldmVyIHJlYWQ6ICdkZXB0aCcgLS0+IHNyYy90cmVlLnJzOjg3OjUifSwicGlubmluZyI6eyJyYXdMaW5lcyI6IjQgU0VBUkNIIExPT1BTICh+MTBrIFRPS0VOUykiLCJjbGVhbkxpbmVzIjoiMCBMT09QUyAoSU5TVEFOVCBQSU5OSU5HKSIsInJhdyI6Ij4gUHJvbXB0OiBcIkZpeCBlbWFpbCB2YWxpZGF0aW9uIGluIGF1dGguanNcIlxuXG5bQW50aWdyYXZpdHkgVHVybiAxXTogZmluZF9ieV9uYW1lKFwiKmF1dGgqXCIpIC0+IDE0IGZpbGVzIHJldHVybmVkXG5bQW50aWdyYXZpdHkgVHVybiAyXTogdmlld19maWxlKFwic2VydmVyL3JvdXRlcy9hdXRoLmpzXCIpIC0+IHdyb25nIGZpbGVcbltBbnRpZ3Jhdml0eSBUdXJuIDNdOiBncmVwX3NlYXJjaChcInZlcmlmeUVtYWlsXCIsIFwic3JjL1wiKSAtPiA4IG1hdGNoZXNcbltBbnRpZ3Jhdml0eSBUdXJuIDRdOiB2aWV3X2ZpbGUoXCJzcmMvY29udHJvbGxlcnMvYXV0aC5qc1wiKSAtPiBUYXJnZXQgZm91bmRcbi4uLiA5LDg1MCB0b2tlbnMgd2FzdGVkIGFjcm9zcyAzMiBzZWNvbmRzIG9mIHNlYXJjaGluZyAuLi4iLCJjbGVhbiI6IiQgZ3JhdiBcIkZpeCBlbWFpbCB2YWxpZGF0aW9uIGluIGF1dGguanNcIlxuXG5bR1JBVklUT04gVjIuMC4wIFNNQVJUIFRBUkdFVCBQSU5ORVJdXG7inJQgSW5kZXhlZCB3b3Jrc3BhY2UgQVNUICgwLjRtcylcbuKclCBQaW5uZWQgdGFyZ2V0IGZpbGUgZGlyZWN0bHkgaW50byBwcm9tcHQ6IGZpbGU6Ly8vc3JjL2NvbnRyb2xsZXJzL2F1dGguanNcblxuPiBHb29nbGUgQW50aWdyYXZpdHkgZXhlY3V0ZXMgZWRpdHMgb24gc3JjL2NvbnRyb2xsZXJzL2F1dGguanMgaW1tZWRpYXRlbHkgKHR1cm5hcm91bmQ6IDIuMXMpIn0sImhpc3RvcnkiOnsicmF3TGluZXMiOiJDT05URVhUIExPU1QgQUNST1NTIFRPUElDUyIsImNsZWFuTGluZXMiOiJJREUgSElTVE9SWSBTRUxFQ1RPUiAoZ3JhdiAtYykiLCJyYXciOiI+IERldmVsb3BlciBvcGVucyB0ZXJtaW5hbCB0byBjb250aW51ZSB5ZXN0ZXJkYXkncyBzZXNzaW9uOlxuVXNlcjogXCJhZGQgdW5pdCB0ZXN0cyBmb3IgdGhlIGF1dGggY2hhbmdlc1wiXG5BbnRpZ3Jhdml0eTogXCJJIGRvbid0IGhhdmUgY29udGV4dCBvbiB5b3VyIGF1dGggY2hhbmdlcy4gUGxlYXNlIHByb3ZpZGUgdGhlIGZpbGVzIG9yIHJlcGVhdCB0aGUgcmVxdWlyZW1lbnRzLlwiXG4uLi4gRGV2ZWxvcGVyIGZvcmNlZCB0byByZS1leHBsYWluIGVudGlyZSBwcm9qZWN0IGNvbnRleHQgLi4uIiwiY2xlYW4iOiIkIGdyYXYgLWNcbj09PSBHUkFWSVRPTiBDT05WRVJTQVRJT05TIChBbnRpZ3Jhdml0eSBJREUgSGlzdG9yeSkgPT09XG5Xb3Jrc3BhY2U6IEM6XFxwcm9qZWN0XG5cbiAgWzFdIOKXjyBbQWN0aXZlXSBcIkZpeCBlbWFpbCB2YWxpZGF0aW9uIGluIGF1dGguanNcIlxuICAgICAgSUQ6IGRjMjkwODY0Li4uIHwgNCB0dXJucyB8IH4xMi41ayB0b2tlbnMgfCA1bSBhZ29cbiAgWzJdIOKXiyBcIlNldHVwIEV4cHJlc3Mgc2VydmVyIGluIGluZGV4LmpzXCJcbiAgICAgIElEOiBlODJiMTA5YS4uLiB8IDEgdHVybiB8IH4zLjJrIHRva2VucyB8IDJoIGFnb1xuXG5BQ1RJT05TOiA8bnVtYmVyPiBzZWxlY3QgfCBkIDxudW1iZXI+IGRlbGV0ZSB8IG4gbmV3XG4kIGdyYXYgLWMgMSBcImFkZCB1bml0IHRlc3RzIHdpdGggamVzdFwiIn0sInJvbGxiYWNrIjp7InJhd0xpbmVzIjoiQlJPS0VOIFNZTlRBWCBJTiBXT1JLU1BBQ0UiLCJjbGVhbkxpbmVzIjoiU0FGRVRZIFJPTExCQUNLICYgRElGRiAoZ3JhdiByYikiLCJyYXciOiJb8J+aqCBHUkFWSVRPTiBTQU5JVFkgQUxFUlRdIDEgYnJva2VuIHN5bnRheCBmaWxlIGRldGVjdGVkIVxuICDinJYgc3JjL2NvbnRyb2xsZXJzL2F1dGguanM6IFVuZXhwZWN0ZWQgdG9rZW4gJ30nIChsaW5lIDQyKVxuV29ya3NwYWNlIGJyb2tlbiwgdGVzdHMgZmFpbGluZy4iLCJjbGVhbiI6IiQgZ3JhdiBkaWZmXG4tLS0gYS9zcmMvY29udHJvbGxlcnMvYXV0aC5qc1xuKysrIGIvc3JjL2NvbnRyb2xsZXJzL2F1dGguanNcbkBAIC00MCwzICs0MCwzIEBAXG4tICByZXR1cm4gdXNlci5lbWFpbDtcbisgIHJldHVybiB1c2VyPy5lbWFpbCA/PyBudWxsOyB9XG5cbiQgZ3JhdiByYlxuW0dSQVZJVE9OXSBJbml0aWF0aW5nIFNhZmV0eSBSb2xsYmFjayBHdWFyZC4uLlxu4pyUIFJldmVydGVkOiBzcmMvY29udHJvbGxlcnMvYXV0aC5qc1xu4pyUIFdvcmtzcGFjZSByZXN0b3JlZCBjbGVhbmx5IHRvIHByZS1zZXNzaW9uIHN0YXRlLiJ9LCJhcmNoaXRlY3QiOnsicmF3TGluZXMiOiJWQUdVRSBJTlNUUlVDVElPTiIsImNsZWFuTGluZXMiOiJBUkNISVRFQ1QgTU9ERSAoZ3JhdiAtZCkiLCJyYXciOiJQbGVhc2UgYnVpbGQgYW4gZXZlbnQtZHJpdmVuIHBheW1lbnQgcHJvY2Vzc29yIHdpdGggaWRlbXBvdGVudCB3ZWJob29rcyBhbmQgZXJyb3IgcmVjb3ZlcnkuIiwiY2xlYW4iOiJbQ1dEOiAvd29ya3NwYWNlL3Byb2plY3RdXG5cbjxncmF2aXRvbl9wbGFuPjogSW1wbGVtZW50IGlkZW1wb3RlbnQgd2ViaG9vayBwcm9jZXNzaW5nIHdpdGggdGltaW5nLXNhZmUgSE1BQyB2ZXJpZmljYXRpb24gYW5kIGRpc3RyaWJ1dGVkIGxvY2sgZGVkdXBsaWNhdGlvbi5cblxuW1RBUkdFVCBTUEVDSUZJQ0FUSU9OU106IEJ1aWxkIGlkZW1wb3RlbnQgcGF5bWVudCB3ZWJob29rIGNvbnN1bWVyLiBWZXJpZnkgc2lnbmF0dXJlIHdpdGggY3J5cHRvLnRpbWluZ1NhZmVFcXVhbCwgYWNxdWlyZSBkaXN0cmlidXRlZCBsb2NrLCBleGVjdXRlIGF0b21pYyBsZWRnZXIgdHJhbnNhY3Rpb24sIGFuZCByZXR1cm4gMjAwIE9LLiJ9fQ=='));

    function switchActionTab(key, btn) {
      document.querySelectorAll('.action-tab-item').forEach(function(b) { b.classList.remove('active'); });
      if (btn) btn.classList.add('active');
      const preset = ACTION_PRESETS[key];
      if (!preset) return;
      document.getElementById('raw-line-count').innerText = preset.rawLines;
      document.getElementById('clean-line-count').innerText = preset.cleanLines;
      document.getElementById('raw-code-view').innerText = preset.raw;
      document.getElementById('clean-code-view').innerText = preset.clean;
    }

    switchActionTab('command', null);

        // LIVE STUDIO SCRIPT (GRAVITON CORE ROUTING)
    let isDeepGear = false;

    function setStudioGear(deep) {
      isDeepGear = deep;
      const flashBtn = document.getElementById('gear-btn-flash');
      const proBtn = document.getElementById('gear-btn-pro');
      if (flashBtn && proBtn) {
        if (deep) {
          proBtn.style.border = '1px solid var(--aqua)';
          proBtn.style.background = 'rgba(0, 240, 255, 0.15)';
          proBtn.style.color = '#ffffff';
          flashBtn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
          flashBtn.style.background = 'transparent';
          flashBtn.style.color = '#94a3b8';
        } else {
          flashBtn.style.border = '1px solid var(--aqua)';
          flashBtn.style.background = 'rgba(0, 240, 255, 0.15)';
          flashBtn.style.color = '#ffffff';
          proBtn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
          proBtn.style.background = 'transparent';
          proBtn.style.color = '#94a3b8';
        }
      }
      showToast('Switched to ' + (deep ? 'Deep Mode: Architectural Synthesis (-d)' : 'Fast Mode: Instant Precision (-f)'));
    }

    function loadSamplePrompt() {
      const el = document.getElementById('studio-in-text');
      if (el) {
        if (isDeepGear) {
          el.value = "Architect an event-driven microservices backend for checkout that is resilient to network partitions and prevents double billing when payment webhooks are delivered multiple times.";
        } else {
          el.value = "Hey Antigravity! Please fix the TypeError in src/api/auth.js where req.user is undefined when token verification fails. Return a 401 Unauthorized status with { error: 'Invalid token' }.";
        }
        updateStudioTokens();
      }
    }

    function updateStudioTokens() {
      const input = document.getElementById('studio-in-text');
      if (!input) return;
      const val = input.value;
      const tokSpan = document.getElementById('studio-in-tokens');
      if (tokSpan) tokSpan.innerText = Math.round(val.length / 3.8) + ' tokens';
    }

    const studioInputEl = document.getElementById('studio-in-text');
    if (studioInputEl) {
      studioInputEl.addEventListener('input', updateStudioTokens);
      studioInputEl.addEventListener('keydown', function(e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') executeStudioSynthesize();
      });
    }

    async function executeStudioSynthesize() {
      const input = document.getElementById('studio-in-text');
      if (!input) return;
      const prompt = input.value.trim();
      if (!prompt) return;
      try {
        const res = await fetch('/api/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt, deep: isDeepGear })
        });
        const data = await res.json();
        if (data.optimizedText) {
          document.getElementById('studio-out-text').innerText = data.optimizedText;
          document.getElementById('studio-out-tokens').innerText = data.stats.optimizedTokens + ' tokens (' + data.stats.engine + ')';
          navigator.clipboard.writeText(data.optimizedText);
          showToast('✔ Synthesized & Copied to clipboard (- ' + data.stats.percentSaved + '% saved)');
        }
      } catch (e) {
        showToast('Error: ' + e.message);
      }
    }

    // =========================================================
      </script>
</body>
</html>
`;

fs.writeFileSync('public/index.html', buildIndexHtml(), 'utf8');
fs.writeFileSync('public/docs.html', buildDocsHtml(sharedHeaderAndSearch), 'utf8');
console.log('Successfully generated public/index.html and public/docs.html with per-page rhythm and interactive spotlight search!');
