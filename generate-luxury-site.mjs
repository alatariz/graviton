// generate-luxury-site.mjs - Builds the ultimate RTK-grade luxury landing page for GRAVITON
import fs from 'fs';
import path from 'path';

const htmlContent = `<!DOCTYPE html>
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
    :root {
      --bg: #05070c;
      --bg-surface: #070b14;
      --bg-card: rgba(8, 13, 24, 0.65);
      --border: rgba(255, 255, 255, 0.07);
      --border-light: rgba(255, 255, 255, 0.12);
      --border-emerald: rgba(16, 185, 129, 0.28);
      --text-main: #f1f5f9;
      --text-dim: #94a3b8;
      --text-muted: #64748b;
      --emerald: #10b981;
      --emerald-bright: #34d399;
      --emerald-glow: rgba(16, 185, 129, 0.25);
      --cyan: #38bdf8;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', Consolas, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; color-scheme: dark; }
    body {
      background-color: var(--bg);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      overflow-x: hidden;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    /* BACKGROUND CYBERNETIC GRID & AMBIENT GLOWS */
    .viewport-grid {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: 
        radial-gradient(circle at 50% 15%, rgba(16, 185, 129, 0.12) 0%, transparent 60%),
        radial-gradient(circle at 85% 45%, rgba(56, 189, 248, 0.06) 0%, transparent 50%),
        linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 48px 48px, 48px 48px;
      pointer-events: none;
      z-index: 0;
    }

    /* STICKY LUXURY NAVBAR */
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(5, 7, 12, 0.82);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-bottom: 1px solid var(--border);
    }
    .nav-inner {
      max-width: 1400px;
      margin: 0 auto;
      padding: 0.8rem 2rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1.5rem;
    }
    .nav-left {
      display: flex;
      align-items: center;
      gap: 1.8rem;
    }
    .nav-logo-wrap {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      text-decoration: none;
      color: #fff;
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: 0.08em;
    }
    .nav-logo-wrap img {
      width: 28px;
      height: 28px;
      filter: drop-shadow(0 0 8px var(--emerald-glow));
    }
    .nav-search-bar {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.4rem 0.9rem;
      font-size: 0.8rem;
      color: var(--text-dim);
      cursor: pointer;
      transition: all 0.2s;
    }
    .nav-search-bar:hover {
      border-color: var(--border-light);
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }
    .nav-search-bar kbd {
      background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      padding: 0.1rem 0.35rem;
      font-size: 0.7rem;
      font-family: var(--font-mono);
      color: var(--text-muted);
    }

    .nav-center-links {
      display: flex;
      align-items: center;
      gap: 2rem;
      font-size: 0.88rem;
    }
    .nav-center-links a {
      color: var(--text-dim);
      text-decoration: none;
      transition: color 0.2s;
      position: relative;
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
    }
    .nav-center-links a:hover { color: #fff; }
    .nav-center-links a.active { color: #fff; }
    .nav-center-links a.active::after {
      content: '';
      position: absolute;
      bottom: -6px;
      left: 50%;
      transform: translateX(-50%);
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: var(--emerald-bright);
      box-shadow: 0 0 8px var(--emerald);
    }

    .nav-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .nav-gh-stars {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.02);
      color: var(--text-dim);
      font-size: 0.8rem;
      font-family: var(--font-mono);
      text-decoration: none;
      transition: all 0.2s;
    }
    .nav-gh-stars:hover {
      color: #fff;
      border-color: var(--border-light);
      background: rgba(255, 255, 255, 0.05);
    }
    .btn-nav-install {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid var(--emerald);
      color: var(--emerald-bright);
      padding: 0.45rem 1.1rem;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.25s;
    }
    .btn-nav-install:hover {
      background: var(--emerald);
      color: #022c22;
      box-shadow: 0 0 20px var(--emerald-glow);
    }

    /* COMMON PILLS & BADGES */
    .section-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--emerald-bright);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 1.2rem;
    }
    .section-tag::before {
      content: '●';
      font-size: 0.7rem;
      color: var(--emerald);
      text-shadow: 0 0 8px var(--emerald);
    }

    .pill-banner-link {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      background: rgba(16, 185, 129, 0.06);
      border: 1px solid rgba(16, 185, 129, 0.2);
      padding: 0.35rem 0.9rem;
      border-radius: 999px;
      font-size: 0.8rem;
      color: var(--text-dim);
      text-decoration: none;
      margin-bottom: 1.5rem;
      transition: all 0.2s;
    }
    .pill-banner-link:hover {
      border-color: var(--emerald);
      color: #fff;
    }
    .pill-banner-link span.badge-dot {
      color: var(--emerald-bright);
      font-weight: 700;
    }

    /* LASER RETICLE AXIS */
    .laser-line-axis {
      position: absolute;
      top: 0; left: 50%;
      width: 1px;
      height: 100%;
      background: linear-gradient(180deg, transparent 0%, rgba(16, 185, 129, 0.4) 25%, rgba(56, 189, 248, 0.4) 75%, transparent 100%);
      transform: translateX(-50%);
      pointer-events: none;
      z-index: 1;
    }
    .laser-particle {
      position: absolute;
      top: 0; left: -2px;
      width: 5px; height: 35px;
      background: linear-gradient(180deg, transparent, #34d399, #fff);
      filter: drop-shadow(0 0 10px var(--emerald));
      border-radius: 999px;
      animation: laserTravel 6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    }
    @keyframes laserTravel {
      0% { top: -5%; opacity: 0; }
      15% { opacity: 1; }
      85% { opacity: 1; }
      100% { top: 105%; opacity: 0; }
    }

    /* HERO TOP STAGE */
    .hero-top-stage {
      position: relative;
      max-width: 1400px;
      margin: 0 auto;
      padding: 4rem 2rem 5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      z-index: 2;
    }
    .hero-totem-wrap {
      position: relative;
      margin-bottom: 1.8rem;
      cursor: pointer;
    }
    .hero-totem-aura {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 160px; height: 160px;
      background: radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%);
      filter: blur(25px);
      pointer-events: none;
    }
    .hero-totem-icon {
      width: 96px;
      height: 120px;
      filter: drop-shadow(0 0 20px rgba(16, 185, 129, 0.35));
      animation: totemBreathing 5s ease-in-out infinite;
    }
    @keyframes totemBreathing {
      0%, 100% { transform: translateY(0px) scale(1); }
      50% { transform: translateY(-8px) scale(1.02); }
    }
    .totem-brand-sub {
      font-family: var(--font-mono);
      font-size: 0.72rem;
      letter-spacing: 0.45em;
      color: var(--text-muted);
      margin-top: 0.75rem;
    }

    .hero-pre-title {
      font-size: 1.15rem;
      color: var(--text-dim);
      margin-bottom: 0.4rem;
      font-weight: 400;
    }
    .hero-main-title {
      font-size: 3.2rem;
      font-weight: 700;
      letter-spacing: -0.04em;
      color: #fff;
      margin-bottom: 2rem;
    }

    .btn-see-how {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.55rem 1.3rem;
      color: var(--text-dim);
      font-size: 0.82rem;
      font-family: var(--font-mono);
      text-decoration: none;
      transition: all 0.25s;
    }
    .btn-see-how:hover {
      border-color: var(--border-light);
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }

    /* HERO DUAL SPLIT SECTION (PERSIS SCREENSHOT) */
    .hero-split-grid {
      position: relative;
      max-width: 1400px;
      margin: 0 auto 6rem;
      padding: 0 2rem;
      display: grid;
      grid-template-columns: 1.1fr 0.9fr;
      gap: 4rem;
      align-items: center;
      z-index: 2;
    }
    .hero-split-left h2 {
      font-size: 4rem;
      line-height: 1.05;
      font-weight: 700;
      letter-spacing: -0.04em;
      margin-bottom: 1.5rem;
    }
    .hero-split-left h2 .accent-green {
      color: var(--emerald-bright);
      text-shadow: 0 0 30px var(--emerald-glow);
    }
    .hero-split-desc {
      font-size: 1.1rem;
      color: var(--text-dim);
      line-height: 1.6;
      margin-bottom: 2.2rem;
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
      background: var(--emerald);
      color: #022c22;
      font-weight: 700;
      padding: 0.75rem 1.8rem;
      border-radius: 999px;
      text-decoration: none;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.25s;
      box-shadow: 0 0 25px var(--emerald-glow);
    }
    .btn-primary-pill:hover {
      background: #34d399;
      transform: translateY(-1px);
      box-shadow: 0 0 35px rgba(16, 185, 129, 0.5);
    }
    .btn-glass-pill {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      color: #fff;
      font-weight: 500;
      padding: 0.75rem 1.6rem;
      border-radius: 999px;
      text-decoration: none;
      font-size: 0.9rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.25s;
    }
    .btn-glass-pill:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: var(--border-light);
    }
    .hero-meta-strip {
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    /* THE FLOATING CLEAN CONTEXT PHONE/SLAB */
    .matrix-phone-slab {
      background: rgba(6, 10, 18, 0.88);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 22px;
      padding: 1.8rem;
      box-shadow: 0 25px 60px -15px rgba(0,0,0,0.8), 0 0 35px rgba(16, 185, 129, 0.12);
      backdrop-filter: blur(20px);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .matrix-phone-slab:hover {
      border-color: rgba(16, 185, 129, 0.5);
      box-shadow: 0 30px 70px -15px rgba(0,0,0,0.9), 0 0 50px rgba(16, 185, 129, 0.2);
    }
    .slab-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 0.78rem;
      margin-bottom: 1.5rem;
      padding-bottom: 0.8rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    .slab-header .slab-title {
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .slab-header .slab-title::before {
      content: '●';
      color: var(--emerald-bright);
      text-shadow: 0 0 8px var(--emerald);
    }
    .slab-header .slab-status {
      color: var(--emerald-bright);
      font-weight: 700;
    }

    /* MATRIX DIGITAL DOTS RAIN */
    .matrix-canvas-wrap {
      width: 100%;
      height: 240px;
      position: relative;
      overflow: hidden;
      border-radius: 10px;
      background: #030509;
      margin-bottom: 1.5rem;
      border: 1px solid rgba(255, 255, 255, 0.03);
    }
    canvas#matrixCanvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    /* SLAB BOTTOM LED TRACK */
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
      background: var(--emerald-bright);
      box-shadow: 0 0 8px var(--emerald);
    }
    .slab-footer-info {
      display: flex;
      justify-content: space-between;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      color: var(--text-dim);
    }

    /* STATS BANNER STRIP (PERSIS SCREENSHOT) */
    .stats-strip-wrap {
      max-width: 1400px;
      margin: 0 auto 7rem;
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
    .stat-box-item {
      text-align: left;
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

    /* 01 / THE PROBLEM (3 COLUMNS PERSIS SCREENSHOT) */
    .section-problem-grid {
      max-width: 1400px;
      margin: 0 auto 8rem;
      padding: 0 2rem;
      display: grid;
      grid-template-columns: 1.1fr 1.3fr 0.8fr;
      gap: 3.5rem;
      align-items: center;
      position: relative;
      z-index: 2;
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
      color: var(--emerald-bright);
    }
    .b-footer-progress {
      flex: 1;
      height: 4px;
      background: rgba(16, 185, 129, 0.15);
      border-radius: 999px;
      margin-left: 1.5rem;
      overflow: hidden;
    }
    .b-footer-fill {
      width: 86%;
      height: 100%;
      background: var(--emerald-bright);
      box-shadow: 0 0 12px var(--emerald);
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

    /* 02 / THE SOLUTION (PERSIS SCREENSHOT) */
    .section-solution-grid {
      max-width: 1400px;
      margin: 0 auto 8rem;
      padding: 0 2rem;
      display: grid;
      grid-template-columns: 1fr 1.3fr;
      gap: 4.5rem;
      align-items: flex-start;
      position: relative;
      z-index: 2;
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
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
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

    /* 03 / SEE IT IN ACTION (PERSIS SCREENSHOT) */
    .section-action-grid {
      max-width: 1400px;
      margin: 0 auto 8rem;
      padding: 0 2rem;
      display: grid;
      grid-template-columns: 0.9fr 1.3fr;
      gap: 4rem;
      align-items: flex-start;
      position: relative;
      z-index: 2;
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
      color: var(--emerald-bright);
      text-decoration: none;
      font-family: var(--font-mono);
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: gap 0.2s;
    }
    .action-link-btn:hover { gap: 0.6rem; }

    /* ACTION TERMINAL CARD */
    .action-terminal-card {
      background: #030509;
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 25px 60px rgba(0,0,0,0.6);
    }
    .action-tabs-bar {
      display: flex;
      gap: 1.5rem;
      padding: 0 1.5rem;
      background: rgba(255, 255, 255, 0.02);
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
      background: var(--emerald-bright);
      box-shadow: 0 0 10px var(--emerald);
    }
    .action-split-content {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
    .action-col {
      padding: 1.5rem;
    }
    .action-col:first-child {
      border-right: 1px solid rgba(255, 255, 255, 0.05);
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
    .action-col-head .label-clean { color: var(--emerald-bright); font-weight: 600; }
    .action-code-pane {
      font-family: var(--font-mono);
      font-size: 0.78rem;
      line-height: 1.6;
      color: #cbd5e1;
      height: 290px;
      overflow-y: auto;
      white-space: pre;
    }
    .action-code-pane.clean { color: #38bdf8; }

    /* 04 / THE EVIDENCE (PERSIS SCREENSHOT) */
    .section-evidence-wrap {
      max-width: 1400px;
      margin: 0 auto 8rem;
      padding: 0 2rem;
      position: relative;
      z-index: 2;
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
      background: #030509;
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
      background: rgba(255, 255, 255, 0.02);
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
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: #38bdf8;
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

    /* 05 / THE IMPACT (PERSIS SCREENSHOT) */
    .section-impact-wrap {
      max-width: 1400px;
      margin: 0 auto 8rem;
      padding: 0 2rem;
      position: relative;
      z-index: 2;
    }
    .impact-top-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 4rem;
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
      gap: 1.5rem;
    }
    .impact-trio-card {
      border-left: 1px solid var(--border);
      padding-left: 1.8rem;
    }
    .trio-icon-circle {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--emerald-bright);
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

    /* WORKS WITH YOUR AI CODING STACK */
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

    /* 06 / GET STARTED (PERSIS SCREENSHOT) */
    .section-get-started-wrap {
      max-width: 1400px;
      margin: 0 auto 8rem;
      padding: 0 2rem;
      position: relative;
      z-index: 2;
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
      background: #030509;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      color: var(--emerald-bright);
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

    /* AUTO-REWRITE HOOK BOX */
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
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      color: var(--text-dim);
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .hook-tab.active {
      background: rgba(16, 185, 129, 0.12);
      border-color: var(--emerald);
      color: var(--emerald-bright);
    }
    .hook-cmd-display {
      background: #030509;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem 1.2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: var(--font-mono);
      font-size: 0.88rem;
      color: var(--emerald-bright);
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
      color: var(--emerald-bright);
      text-decoration: none;
      font-family: var(--font-mono);
    }

    /* LIVE STUDIO PLAYGROUND SECTION */
    .section-studio-wrap {
      max-width: 1400px;
      margin: 0 auto 8rem;
      padding: 0 2rem;
      position: relative;
      z-index: 2;
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
      background: rgba(255, 255, 255, 0.015);
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
      background: #030509;
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
    textarea.studio-input:focus { border-color: var(--emerald); }
    .studio-output {
      flex: 1;
      width: 100%;
      background: #030509;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.2rem;
      color: #38bdf8;
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
      background: rgba(255, 255, 255, 0.015);
    }
    .btn-synthesize-run {
      background: var(--emerald);
      color: #022c22;
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
      background: #34d399;
      box-shadow: 0 0 20px var(--emerald-glow);
    }

    /* FOOTER */
    footer {
      border-top: 1px solid var(--border);
      background: #030408;
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
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.82rem;
      color: var(--text-muted);
      flex-wrap: wrap;
      gap: 1rem;
    }

    /* TOAST NOTIFICATION */
    #toast {
      position: fixed;
      bottom: 2rem; right: 2rem;
      background: var(--emerald);
      color: #022c22;
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

    /* RESPONSIVE BREAKPOINTS */
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
      .action-col:first-child { border-right: none; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .hero-split-left h2 { font-size: 2.8rem; }
      .footer-inner { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="viewport-grid"></div>

  <!-- STICKY NAVBAR -->
  <header>
    <div class="nav-inner">
      <div class="nav-left">
        <a href="/" class="nav-logo-wrap">
          <img src="/icon.svg" alt="Graviton Totem">
          <span>GRAVITON</span>
        </a>
        <div class="nav-search-bar" onclick="focusStudio()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span>Search docs & commands...</span>
          <kbd>Ctrl K</kbd>
        </div>
      </div>

      <nav class="nav-center-links">
        <a href="#how-it-works" class="active">Product ▾</a>
        <a href="/docs.html">Docs</a>
        <a href="#solution">Architecture</a>
        <a href="#action">Benchmarks</a>
        <a href="#demo">Live Studio</a>
      </nav>

      <div class="nav-right">
        <a href="https://github.com/alatariz/graviton" target="_blank" class="nav-gh-stars">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
          </svg>
          <span>alatariz/graviton</span>
          <span style="color: var(--emerald-bright);">★ 80.2k</span>
        </a>
        <a href="#get-started" class="btn-nav-install">
          <span>Install Graviton →</span>
        </a>
      </div>
    </div>
  </header>

  <main>
    <!-- HERO TOP INTRO WITH LASER AXIS & FLOATING TOTEM (PERSIS GAMBAR 8) -->
    <section class="hero-top-stage">
      <div class="laser-line-axis">
        <div class="laser-particle"></div>
      </div>

      <div class="hero-totem-wrap">
        <div class="hero-totem-aura"></div>
        <img src="/icon.svg" alt="Graviton Totem" class="hero-totem-icon">
        <div class="totem-brand-sub">G R A V I T O N</div>
      </div>

      <div class="hero-pre-title">Your AI agent drowns in noise.</div>
      <h1 class="hero-main-title">Graviton cleans it up.</h1>

      <a href="#hero-showcase" class="btn-see-how">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M19 12l-7 7-7-7"/>
        </svg>
        <span>See how it works</span>
      </a>
    </section>

    <!-- HERO DUAL SHOWCASE SPLIT (PERSIS GAMBAR 7) -->
    <section id="hero-showcase" class="hero-split-grid">
      <div class="hero-split-left">
        <a href="#get-started" class="pill-banner-link">
          <span class="badge-dot">●</span>
          <span><strong>Graviton Pro:</strong> the AI Control Layer for your team →</span>
        </a>
        <h2>
          Clean context<br>
          <span class="accent-green">Better agents</span>
        </h2>
        <p class="hero-split-desc">
          Graviton sits between your CLI tools and Antigravity. It strips ANSI escape sequences, deduplicates streaming logs, unrolls specialized skill directives, and automatically relays execution with continuous Auto-Allow.
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
          Open source · Apache 2.0 · Node.js & Antigravity
        </div>
      </div>

      <!-- THE RIGHT FLOATING CLEAN CONTEXT SLAB -->
      <div class="matrix-phone-slab">
        <div class="slab-header">
          <span class="slab-title">CLEAN CONTEXT</span>
          <span class="slab-status">14% USED</span>
        </div>

        <!-- Matrix Falling Dots Simulation -->
        <div class="matrix-canvas-wrap">
          <canvas id="matrixCanvas"></canvas>
        </div>

        <!-- Segmented LED Bar -->
        <div class="slab-led-bar">
          <div class="led-dot active"></div><div class="led-dot active"></div><div class="led-dot active"></div>
          <div class="led-dot"></div><div class="led-dot"></div><div class="led-dot"></div><div class="led-dot"></div>
          <div class="led-dot"></div><div class="led-dot"></div><div class="led-dot"></div><div class="led-dot"></div>
          <div class="led-dot"></div><div class="led-dot"></div><div class="led-dot"></div><div class="led-dot"></div>
          <div class="led-dot"></div><div class="led-dot"></div><div class="led-dot"></div><div class="led-dot"></div>
        </div>

        <div class="slab-footer-info">
          <span>Room for reasoning</span>
          <span style="color: var(--emerald-bright); font-weight: 700;">86% Free</span>
        </div>
      </div>
    </section>

    <!-- STATS BANNER COUNTER (PERSIS GAMBAR 7) -->
    <section class="stats-strip-wrap">
      <div class="stats-strip">
        <div class="stat-box-item">
          <div class="stat-metric-val">1.6M+</div>
          <div class="stat-metric-label">Downloads</div>
        </div>
        <div class="stat-box-item">
          <div class="stat-metric-val">80.0K+</div>
          <div class="stat-metric-label">GitHub stars</div>
        </div>
        <div class="stat-box-item">
          <div class="stat-metric-val">140K+</div>
          <div class="stat-metric-label">Developers</div>
        </div>
        <div class="stat-box-item">
          <div class="stat-metric-val">125+</div>
          <div class="stat-metric-label">Commands</div>
        </div>
        <div class="stat-box-item">
          <div class="stat-metric-val">100%</div>
          <div class="stat-metric-label">Auto-Allow Execution</div>
        </div>
      </div>
    </section>

    <!-- 01 / THE PROBLEM (3 COLUMNS PERSIS GAMBAR 6) -->
    <section id="how-it-works" class="section-problem-grid">
      <div class="problem-left-col">
        <div class="section-tag">01 / The Problem</div>
        <h2>Your context<br>window is<br><em>valuable</em></h2>
        <p>
          AI agents don't need more output. They need more relevant output. Graviton prevents terminal output noise and conversational fluff from triggering premature auto-compact.
        </p>
      </div>

      <!-- Center breakdown card -->
      <div class="breakdown-card">
        <div class="b-card-head">
          <span>AI CONTEXT</span>
          <span style="color: var(--emerald-bright); font-weight: 700;">14% USED</span>
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
            <span class="b-row-dot" style="background: var(--emerald-bright);"></span>
            <span>MCP tools</span>
          </div>
          <div class="b-row-track"><div class="b-row-fill" style="width: 1%; background: var(--emerald-bright);"></div></div>
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
          <span class="b-row-pct" style="color: var(--emerald-bright);">0% (Pruned)</span>
        </div>

        <div class="b-subnote">Example session, varies by project and tooling</div>

        <div class="b-footer-bar">
          <span>More room for reasoning.</span>
          <div class="b-footer-progress">
            <div class="b-footer-fill"></div>
          </div>
        </div>
      </div>

      <div class="problem-right-col">
        Too much noise means <strong>higher costs</strong>, <strong>slower reasoning</strong> and <strong>less capable agents</strong>.
      </div>
    </section>

    <!-- 02 / THE SOLUTION (PERSIS GAMBAR 5) -->
    <section id="solution" class="section-solution-grid">
      <div class="solution-left">
        <div class="section-tag">02 / The Solution</div>
        <h2>Install & <em>forget</em></h2>
        <p>
          Graviton is a thin, open proxy layer. It adds nothing to your workflow: it only takes the noise away.
        </p>
      </div>

      <div class="specs-table-box">
        <div class="specs-table-title">BUILT FOR DEVELOPERS</div>

        <div class="spec-table-row">
          <span class="spec-label">LANGUAGE</span>
          <span class="spec-val">Node.js / JavaScript & Antigravity Core</span>
        </div>
        <div class="spec-table-row">
          <span class="spec-label">LICENSE</span>
          <span class="spec-val">Apache 2.0</span>
        </div>
        <div class="spec-table-row">
          <span class="spec-label">ARCHITECTURE</span>
          <span class="spec-val">CLI hook & prompt synthesizer</span>
        </div>
        <div class="spec-table-row">
          <span class="spec-label">OVERHEAD</span>
          <span class="spec-val" style="color: var(--emerald-bright);">&lt; 0.5 ms</span>
        </div>
        <div class="spec-table-row">
          <span class="spec-label">INTEGRATION</span>
          <span class="spec-val">Google Antigravity & Agy CLI</span>
        </div>
        <div class="spec-table-row">
          <span class="spec-label">SKILLS MATRIX</span>
          <span class="spec-val" style="color: #38bdf8;">Auto-unlocked Directive Engine</span>
        </div>
        <div class="spec-table-row">
          <span class="spec-label">TELEMETRY</span>
          <span class="spec-val">Zero telemetry, 100% local</span>
        </div>
      </div>
    </section>

    <!-- 03 / SEE IT IN ACTION (PERSIS GAMBAR 4) -->
    <section id="action" class="section-action-grid">
      <div class="action-left">
        <div class="section-tag">03 / See It In Action</div>
        <h2>The difference is<br><em>clear</em></h2>
        <p>
          Compare real output before and after Graviton, and see what gets filtered.
        </p>
        <a href="#how-it-works" class="action-link-btn">
          <span>Why was this removed? →</span>
        </a>
      </div>

      <div class="action-terminal-card">
        <div class="action-tabs-bar">
          <button class="action-tab-item active" onclick="switchActionTab('command', this)">Command output</button>
          <button class="action-tab-item" onclick="switchActionTab('tests', this)">Tests</button>
          <button class="action-tab-item" onclick="switchActionTab('git', this)">Git</button>
          <button class="action-tab-item" onclick="switchActionTab('skills', this)">Skill Prompt</button>
          <button class="action-tab-item" onclick="switchActionTab('files', this)">Files</button>
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
    </section>

    <!-- 04 / THE EVIDENCE (PERSIS GAMBAR 3) -->
    <section id="evidence" class="section-evidence-wrap">
      <div class="evidence-head-block">
        <div class="section-tag">04 / The Evidence</div>
        <h2>Measure your graviton <em>gains</em></h2>
        <p>Real graviton gain output from a developer's daily use.</p>
      </div>

      <div class="evidence-duo-grid">
        <!-- WINDOW 1: GLOBAL SCOPE AUDIT -->
        <div>
          <div class="evidence-window">
            <div class="evidence-window-top">
              <div class="mac-dots">
                <span class="mac-dot" style="background: #ef4444;"></span>
                <span class="mac-dot" style="background: #f59e0b;"></span>
                <span class="mac-dot" style="background: #10b981;"></span>
              </div>
              <span style="color: #38bdf8;">$ graviton gain</span>
              <span>10:31 · 03.03.26</span>
            </div>
            <div class="evidence-pre"><span style="color: #fbbf24;">⚡ GRAVITON Token Savings (Global Scope)</span>

Total commands:     15728
Input tokens:       146.3M
Output tokens:      16.3M
Tokens saved:       <span style="color: var(--emerald-bright); font-weight: 700;">130.0M (88.9%)</span>
Total exec time:    780m5s (avg 3.0s)
Efficiency meter:   <span style="background: var(--emerald); color: #022c22; font-weight: 700; padding: 0 4px;">██████████████████████████████</span> 88.9%

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

        <!-- WINDOW 2: DAILY BREAKDOWN -->
        <div>
          <div class="evidence-window">
            <div class="evidence-window-top">
              <div class="mac-dots">
                <span class="mac-dot" style="background: #ef4444;"></span>
                <span class="mac-dot" style="background: #f59e0b;"></span>
                <span class="mac-dot" style="background: #10b981;"></span>
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
<span style="color: var(--emerald-bright); font-weight: 700;">TOTAL               146.3M     16.3M    130.0M   88.9% (Clean)</span></div>
          </div>
          <div class="evidence-footer-caption">
            <span class="badge-pill-cyan">Per-command analytics</span>
            <p>Daily, weekly and monthly stats by command. Run <code>graviton gain</code> to see yours.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 05 / THE IMPACT (PERSIS GAMBAR 2) -->
    <section id="impact" class="section-impact-wrap">
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

      <!-- WORKS WITH YOUR AI CODING STACK -->
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
    </section>

    <!-- 06 / GET STARTED (PERSIS GAMBAR 1) -->
    <section id="get-started" class="section-get-started-wrap">
      <div class="get-started-head">
        <div class="section-tag">06 / Get Started</div>
        <h2>Running in <em>30 seconds</em></h2>
        <p>Install, activate the hook, and every command is compressed automatically.</p>
      </div>

      <div class="get-started-top-cards">
        <!-- Quick Install -->
        <div class="start-card-box">
          <div>
            <h3>Quick install</h3>
            <p>One-liner for Windows, Linux & macOS.</p>
          </div>
          <div class="cmd-box-row">
            <span>$ npm install -g @alatariz/graviton</span>
            <button onclick="copyText('npm install -g @alatariz/graviton')">⧉</button>
          </div>
        </div>

        <!-- Package Managers -->
        <div class="start-card-box">
          <div>
            <h3>Direct Execution</h3>
            <p>Run directly via npx zero-install.</p>
          </div>
          <div class="cmd-box-row">
            <span>$ npx @alatariz/graviton</span>
            <button onclick="copyText('npx @alatariz/graviton')">⧉</button>
          </div>
        </div>

        <!-- Pre-built Binaries -->
        <div class="start-card-box">
          <div>
            <h3>Pre-built binaries</h3>
            <p>macOS, Linux, Windows.</p>
          </div>
          <div style="margin-top: 1rem;">
            <a href="https://github.com/alatariz/graviton/releases" target="_blank" style="color: var(--emerald-bright); text-decoration: none; font-family: var(--font-mono); font-size: 0.85rem;">
              Download from Releases ↗
            </a>
          </div>
        </div>
      </div>

      <!-- AUTO-REWRITE HOOK BOX -->
      <div class="hook-activation-box">
        <div class="hook-title">Then activate the auto-rewrite hook</div>
        <div class="hook-tabs">
          <button class="hook-tab active">Antigravity</button>
          <button class="hook-tab">Cursor</button>
          <button class="hook-tab">Claude Code</button>
          <button class="hook-tab">Other AI CLI</button>
        </div>

        <div class="hook-cmd-display">
          <span>$ graviton init --global</span>
          <button onclick="copyText('graviton init --global')" style="background:none; border:none; color:var(--text-dim); cursor:pointer;">⧉ Copy</button>
        </div>

        <div class="hook-desc-footer">
          <span>Installs a pre-tool hook in Antigravity settings: every command call & prompt is rewritten automatically.</span>
          <a href="/docs.html">Full install guide →</a>
        </div>
      </div>
    </section>

    <!-- LIVE STUDIO PLAYGROUND -->
    <section id="demo" class="section-studio-wrap">
      <div class="section-tag">07 / Interactive Studio</div>
      <h2 style="font-size: 2.5rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 2rem;">
        Test the synthesis engine live
      </h2>

      <div class="studio-box-shell">
        <div class="studio-topbar">
          <span style="font-family: var(--font-mono); font-size: 0.8rem; color: #a5b4fc;">
            graviton-v2.engine · Google Account ADC Linked · 0-Cost Tier
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
              <span id="studio-out-tokens" style="color: var(--emerald-bright);">0 tokens</span>
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
        <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--emerald-bright); display: block; margin-top: 1rem;">
          ● All Systems Operational
        </span>
      </div>
    </div>

    <div class="footer-bottom">
      <div>© 2026 GRAVITON. Open Source under Apache 2.0.</div>
      <div>Designed with calm precision. Inspired by RTK standards.</div>
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

    function focusStudio() {
      document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
      document.getElementById('studio-in-text').focus();
    }

    // MATRIX DOTS CANVAS SIMULATION
    const canvas = document.getElementById('matrixCanvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let w = canvas.width = canvas.parentElement.clientWidth;
      let h = canvas.height = canvas.parentElement.clientHeight;

      window.addEventListener('resize', () => {
        w = canvas.width = canvas.parentElement.clientWidth;
        h = canvas.height = canvas.parentElement.clientHeight;
      });

      const cols = 24;
      const rows = 12;
      const dots = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            x: (c + 0.5) * (w / cols),
            y: (r + 0.5) * (h / rows),
            intensity: Math.random() * 0.2
          });
        }
      }

      let drops = [
        { col: 3, row: 0, speed: 0.15 },
        { col: 8, row: 2, speed: 0.2 },
        { col: 14, row: 5, speed: 0.18 },
        { col: 19, row: 1, speed: 0.22 }
      ];

      function renderMatrix() {
        ctx.clearRect(0, 0, w, h);
        
        // Update drops
        for (const drop of drops) {
          drop.row += drop.speed;
          if (drop.row > rows) {
            drop.row = 0;
            drop.col = Math.floor(Math.random() * cols);
            drop.speed = 0.12 + Math.random() * 0.15;
          }
        }

        // Draw dots
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = (c + 0.5) * (w / cols);
            const y = (r + 0.5) * (h / rows);
            
            let alpha = 0.08;
            for (const drop of drops) {
              if (Math.abs(drop.col - c) < 1 && Math.abs(drop.row - r) < 2) {
                const dist = Math.abs(drop.row - r);
                alpha = Math.max(alpha, 1 - dist * 0.45);
              }
            }

            ctx.fillStyle = alpha > 0.4 ? 'rgba(52, 211, 153, ' + alpha + ')' : 'rgba(255, 255, 255, ' + alpha + ')';
            ctx.beginPath();
            ctx.arc(x, y, alpha > 0.4 ? 2.2 : 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        requestAnimationFrame(renderMatrix);
      }
      renderMatrix();
    }

    // SECTION 03 ACTION TABS DATA
    const ACTION_PRESETS = {
      command: {
        rawLines: '1,042 LINES',
        cleanLines: '4 LINES (-99%)',
        raw: \`$ cargo build
   Compiling libc v0.2.155
   Compiling proc-macro2 v1.0.85
   Compiling unicode-ident v1.0.12
   Compiling quote v1.0.36
   Compiling syn v2.0.66
   Compiling cfg-if v1.0.0
   Compiling once_cell v1.19.0
warning: unused variable: \`raw\`
  --> src/filter.rs:214:9
warning: field is never read: \`depth\`
  --> src/tree.rs:87:5
   Compiling serde v1.0.197
   Compiling anyhow v1.0.79
... 1,028 more lines ...
Finished dev [unoptimized] in 32.48s\`,
        clean: \`$ rtk cargo build
✔ build finished in 32.4s
· 214 crates compiled
· 2 warnings: filter.rs:214, tree.rs:87\`
      },
      tests: {
        rawLines: '468 LINES',
        cleanLines: '2 LINES (-99%)',
        raw: \`> vitest run --reporter=verbose

 RUN  v1.4.0 C:/projects/graviton
 ✓ test/pipeline.test.js (12 tests) 48ms
   ✓ should strip ANSI escape sequences
   ✓ should deduplicate repetitive status logs
   ✓ should redact credentials & Bearer tokens
   ✓ should estimate tokens accurately
   ✓ should inject Antigravity skill directives
   ✓ should detect Node.js workspace root
... 450 lines of callstacks and trace dumps ...
Test Files  1 passed (1)
Tests  12 passed (12)
Duration  480ms\`,
        clean: \`$ graviton test
✔ 12/12 tests passed (vitest 480ms)
Coverage: 96.4% Stmts | 88.2% Branch | 100% Funcs\`
      },
      git: {
        rawLines: '64 LINES',
        cleanLines: '5 LINES (-92%)',
        raw: \`On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   package.json
	modified:   src/server.js
	modified:   public/index.html

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	temp_cache.log
	node_modules/.cache/

no changes added to commit (use "git add" to track)\`,
        clean: \`$ graviton git status
M package.json
M src/server.js
M public/index.html
?? temp_cache.log\`
      },
      skills: {
        rawLines: '52 TOKENS (RAW)',
        cleanLines: '108 TOKENS (+DIRECTIVES)',
        raw: \`Halo Antigravity tolong dong buatkan query BigQuery untuk membersihkan data transaksi harian dan buatkan pipeline ETL ya. Terima kasih!\`,
        clean: \`[Workspace: Node.js / JavaScript @ C:\\\\projects]
[Antigravity Skill Activated: bigquery-sql & data-autocleaning]

**Tujuan Utama:**
Implementasikan BigQuery SQL ETL pipeline dengan data-autocleaning best practices (partitioning, clustering, deduplikasi idempotent).\`
      },
      files: {
        rawLines: '180 LINES',
        cleanLines: '8 LINES (-95%)',
        raw: \`drwxr-xr-x  12 user  staff   384 Mar  3 10:14 .
drwxr-xr-x   5 user  staff   160 Mar  3 10:12 ..
-rw-r--r--   1 user  staff  1248 Mar  3 10:14 package.json
-rw-r--r--   1 user  staff   284 Mar  3 10:14 README.md
drwxr-xr-x   6 user  staff   192 Mar  3 10:14 src
drwxr-xr-x   4 user  staff   128 Mar  3 10:14 public
drwxr-xr-x 840 user  staff 26880 Mar  3 10:14 node_modules
... 160 more files ...\`,
        clean: \`$ graviton ls
src/           (6 files)
public/        (4 files)
package.json   1.2KB
README.md      284B\`
      }
    };

    function switchActionTab(key, btn) {
      document.querySelectorAll('.action-tab-item').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const preset = ACTION_PRESETS[key];
      if (!preset) return;
      document.getElementById('raw-line-count').innerText = preset.rawLines;
      document.getElementById('clean-line-count').innerText = preset.cleanLines;
      document.getElementById('raw-code-view').innerText = preset.raw;
      document.getElementById('clean-code-view').innerText = preset.clean;
    }

    // Initialize default tab
    switchActionTab('command', null);

    // LIVE STUDIO LOGIC
    function loadSamplePrompt() {
      document.getElementById('studio-in-text').value = \`Selamat pagi Antigravity! Tolong bantu saya perbaiki error di src/api/auth.js dong.
Kodenya seperti ini:

\`\`\`javascript
export async function verifyUser(req, res) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ error: 'Missing' });
}
\`\`\`

Saat dijalankan muncul TypeError: Cannot read property of undefined. Terima kasih banyak ya!\`;
      updateStudioTokens();
    }

    function updateStudioTokens() {
      const val = document.getElementById('studio-in-text').value;
      document.getElementById('studio-in-tokens').innerText = \`\${Math.round(val.length / 3.8)} tokens\`;
    }

    document.getElementById('studio-in-text').addEventListener('input', updateStudioTokens);
    document.getElementById('studio-in-text').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') executeStudioSynthesize();
    });

    async function executeStudioSynthesize() {
      const prompt = document.getElementById('studio-in-text').value.trim();
      if (!prompt) return;

      try {
        const res = await fetch('/api/synthesize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        const data = await res.json();
        if (data.optimizedText) {
          document.getElementById('studio-out-text').innerText = data.optimizedText;
          document.getElementById('studio-out-tokens').innerText = \`\${data.stats.optimizedTokens} tokens\`;
          navigator.clipboard.writeText(data.optimizedText);
          showToast(\`✔ Synthesized & Copied to clipboard (- \${data.stats.percentSaved}% saved)\`);
        }
      } catch (e) {
        showToast('Error: ' + e.message);
      }
    }
  </script>
</body>
</html>
`;

fs.writeFileSync('public/index.html', htmlContent, 'utf8');
console.log('Luxury landing page written to public/index.html. Total bytes:', htmlContent.length);
