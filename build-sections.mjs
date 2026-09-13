// build-sections.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, 'public', 'index.html');

let html = fs.readFileSync(indexPath, 'utf8');

// Check if sections already added
if (html.includes('02 / The Solution')) {
  console.log('Sections already present in index.html');
  process.exit(0);
}

// 1. Extra CSS needed for tabs and buttons
const extraCSS = `
    /* ACTION TABS & SECTIONS */
    .tab-btn {
      background: transparent;
      border: none;
      color: var(--text-dim);
      padding: 0.4rem 0.9rem;
      border-radius: 6px;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .tab-btn:hover { color: #fff; }
    .tab-btn.active {
      background: rgba(16, 185, 129, 0.15);
      color: var(--emerald);
      font-weight: 600;
    }
    .evidence-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }
    @media (max-width: 900px) {
      .evidence-grid { grid-template-columns: 1fr; }
      .action-grid { grid-template-columns: 1fr !important; }
      .specs-table-wrap { overflow-x: auto; }
      .impact-grid { grid-template-columns: 1fr !important; }
      .get-started-grid { grid-template-columns: 1fr !important; }
    }
  </style>`;

html = html.replace('</style>', extraCSS);

// 2. Sections 02 to 06 HTML
const fullSections = `
    <!-- 02 / THE SOLUTION: ARCHITECTURE & SPECS -->
    <section id="solution" class="specs-section" style="max-width: 1400px; margin: 6rem auto; padding: 0 2rem;">
      <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--emerald); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 0.8rem;">
        02 / The Solution
      </div>
      <h2 style="font-size: 2.2rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 1.5rem;">
        A deterministic proxy filter that lives in your terminal
      </h2>
      <p style="color: var(--text-dim); max-width: 720px; line-height: 1.6; margin-bottom: 3rem; font-size: 1rem;">
        Graviton sits between your CLI tools, raw thoughts, and Antigravity. It strips ANSI sequences, deduplicates streaming logs, redacts local credentials, unrolls specialized Antigravity skill directives, and automatically relays execution with continuous Auto-Allow.
      </p>

      <div class="specs-table-wrap" style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-family: var(--font-mono); font-size: 0.85rem; text-align: left;">
          <thead>
            <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border); color: var(--text-dim);">
              <th style="padding: 1rem 1.5rem;">COMPONENT</th>
              <th style="padding: 1rem 1.5rem;">BEHAVIOR</th>
              <th style="padding: 1rem 1.5rem;">PERFORMANCE</th>
              <th style="padding: 1rem 1.5rem;">STATUS</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
              <td style="padding: 1.2rem 1.5rem; color: #fff; font-weight: 600;">CLI Filter Engine</td>
              <td style="padding: 1.2rem 1.5rem; color: var(--text-dim);">Deterministic stripping of ANSI, progress spinners, repetitive status lines</td>
              <td style="padding: 1.2rem 1.5rem; color: #34d399;">&lt; 0.5 ms latency</td>
              <td style="padding: 1.2rem 1.5rem;"><span style="background: rgba(16,185,129,0.1); color: #34d399; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem;">ACTIVE</span></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
              <td style="padding: 1.2rem 1.5rem; color: #fff; font-weight: 600;">Skill Matrix Unlocker</td>
              <td style="padding: 1.2rem 1.5rem; color: var(--text-dim);">Detects intent and prepends installed Antigravity capabilities</td>
              <td style="padding: 1.2rem 1.5rem; color: #38bdf8;">0 ms (Local Regex)</td>
              <td style="padding: 1.2rem 1.5rem;"><span style="background: rgba(56,189,248,0.1); color: #38bdf8; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem;">UNLOCKED</span></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
              <td style="padding: 1.2rem 1.5rem; color: #fff; font-weight: 600;">Auto-Allow Relay</td>
              <td style="padding: 1.2rem 1.5rem; color: var(--text-dim);">Suppresses interactive prompt spam via --dangerously-skip-permissions</td>
              <td style="padding: 1.2rem 1.5rem; color: #a78bfa;">100% Unattended</td>
              <td style="padding: 1.2rem 1.5rem;"><span style="background: rgba(167,139,250,0.1); color: #a78bfa; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem;">ENABLED</span></td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
              <td style="padding: 1.2rem 1.5rem; color: #fff; font-weight: 600;">Credential Redactor</td>
              <td style="padding: 1.2rem 1.5rem; color: var(--text-dim);">Zero leaks: hides API keys, Bearer tokens, and sensitive env passwords</td>
              <td style="padding: 1.2rem 1.5rem; color: #34d399;">Zero Memory Trace</td>
              <td style="padding: 1.2rem 1.5rem;"><span style="background: rgba(16,185,129,0.1); color: #34d399; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem;">ACTIVE</span></td>
            </tr>
            <tr>
              <td style="padding: 1.2rem 1.5rem; color: #fff; font-weight: 600;">Synthesizer AI Tier</td>
              <td style="padding: 1.2rem 1.5rem; color: var(--text-dim);">Shared Google Account auth + Gemini 2.5 Flash Free Tier (1,500 req/day)</td>
              <td style="padding: 1.2rem 1.5rem; color: #fbbf24;">Free / No Key Barrier</td>
              <td style="padding: 1.2rem 1.5rem;"><span style="background: rgba(251,191,36,0.1); color: #fbbf24; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem;">STANDBY</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 03 / SEE IT IN ACTION: INTERACTIVE CODE COMPARISON -->
    <section id="action" class="action-section" style="max-width: 1400px; margin: 6rem auto; padding: 0 2rem;">
      <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--emerald); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 0.8rem;">
        03 / See It In Action
      </div>
      <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem; margin-bottom: 2rem;">
        <div>
          <h2 style="font-size: 2.2rem; font-weight: 700; letter-spacing: -0.03em;">
            Compare Raw CLI output vs. Graviton
          </h2>
          <p style="color: var(--text-dim); margin-top: 0.5rem;">
            Select a common workflow below to inspect token savings in real time.
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; background: #070a12; padding: 0.35rem; border-radius: 8px; border: 1px solid var(--border);">
          <button class="tab-btn active" onclick="switchTab('git', this)">Git Status</button>
          <button class="tab-btn" onclick="switchTab('test', this)">Unit Tests</button>
          <button class="tab-btn" onclick="switchTab('prompt', this)">Skill Prompt</button>
          <button class="tab-btn" onclick="switchTab('cargo', this)">Build Logs</button>
        </div>
      </div>

      <div class="action-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; background: #04060c; border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem;">
        <div>
          <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.75rem; color: #f87171; margin-bottom: 0.8rem;">
            <span>WITHOUT GRAVITON (RAW)</span>
            <span id="raw-tokens-badge">842 tokens</span>
          </div>
          <pre id="raw-preview" style="background: #020307; border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 1.2rem; font-family: var(--font-mono); font-size: 0.8rem; color: #94a3b8; line-height: 1.5; height: 320px; overflow: auto; white-space: pre;"></pre>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 0.75rem; color: #34d399; margin-bottom: 0.8rem;">
            <span>WITH GRAVITON (PRUNED)</span>
            <span id="clean-tokens-badge">58 tokens (-93%)</span>
          </div>
          <pre id="clean-preview" style="background: #020307; border: 1px solid rgba(16,185,129,0.2); border-radius: 8px; padding: 1.2rem; font-family: var(--font-mono); font-size: 0.8rem; color: #38bdf8; line-height: 1.5; height: 320px; overflow: auto; white-space: pre;"></pre>
        </div>
      </div>
    </section>

    <!-- 04 / THE EVIDENCE: DUAL TERMINAL GAIN AUDITS -->
    <section id="evidence" class="evidence-section" style="max-width: 1400px; margin: 6rem auto; padding: 0 2rem;">
      <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--emerald); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 0.8rem;">
        04 / The Evidence
      </div>
      <h2 style="font-size: 2.2rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 2rem;">
        Every token accounted for. In your terminal.
      </h2>

      <div class="evidence-grid">
        <!-- Terminal 1: Global Cumulative -->
        <div style="background: #020408; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <div style="background: #070b14; padding: 0.75rem 1.2rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></span>
            </div>
            <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);">$ graviton gain</span>
          </div>
          <pre style="padding: 1.5rem; font-family: var(--font-mono); font-size: 0.82rem; color: #cbd5e1; line-height: 1.7; margin: 0;"><span style="color: #a855f7; font-weight: 700;">=== GRAVITON EFFICIENCY GAINS ===</span>
  <span style="color: #38bdf8;">Commands Processed    :</span> 154
  <span style="color: #38bdf8;">Prompts Synthesized   :</span> 62
  <span style="color: #34d399; font-weight: 700;">Estimated Tokens Saved: 231,400 tokens</span>
  <span style="color: #34d399; font-weight: 700;">Lines Filtered Out    : 5,410 lines</span>
  <span style="color: #64748b;">Context Compaction Avoided : 18 times</span>
<span style="color: #64748b;">Keep your AI context clean and focused.</span></pre>
        </div>

        <!-- Terminal 2: Daily Breakdown -->
        <div style="background: #020408; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <div style="background: #070b14; padding: 0.75rem 1.2rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b;"></span>
              <span style="width: 10px; height: 10px; border-radius: 50%; background: #10b981;"></span>
            </div>
            <span style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-dim);">$ graviton gain --daily</span>
          </div>
          <pre style="padding: 1.5rem; font-family: var(--font-mono); font-size: 0.82rem; color: #cbd5e1; line-height: 1.7; margin: 0;"><span style="color: #38bdf8;">DATE         COMMANDS   SAVED TOKENS   AVG EFFICIENCY</span>
2026-09-13   48         86,210         -91.4%
2026-09-12   52         78,400         -89.2%
2026-09-11   34         42,120         -92.0%
2026-09-10   20         24,670         -88.5%
<span style="color: #10b981;">-----------------------------------------------------</span>
<span style="color: #34d399; font-weight: 700;">TOTAL                   231,400 tokens (Clean Context)</span></pre>
        </div>
      </div>
    </section>

    <!-- 05 / THE IMPACT: THREE CORE PILLARS -->
    <section id="impact" class="impact-section" style="max-width: 1400px; margin: 6rem auto; padding: 0 2rem;">
      <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--emerald); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 0.8rem;">
        05 / The Impact
      </div>
      <h2 style="font-size: 2.2rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 2.5rem;">
        Designed specifically for Antigravity power developers
      </h2>

      <div class="impact-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
        <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 2rem;">
          <div style="width: 42px; height: 42px; border-radius: 8px; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; color: #34d399; font-size: 1.2rem;">
            ⚡
          </div>
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.8rem;">Never Hit Prompt Limits</h3>
          <p style="font-size: 0.9rem; color: var(--text-dim); line-height: 1.6;">
            Stop burning through your high-tier Gemini Pro quotas with noisy stack traces. Graviton keeps the window 86% empty so complex multi-file refactors finish in a single turn.
          </p>
        </div>

        <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 2rem;">
          <div style="width: 42px; height: 42px; border-radius: 8px; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; color: #38bdf8; font-size: 1.2rem;">
            🗝️
          </div>
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.8rem;">Deep Skill Matrix Unlocker</h3>
          <p style="font-size: 0.9rem; color: var(--text-dim); line-height: 1.6;">
            Automatically pairs vague instructions with installed Antigravity capabilities (Modern Web Standards, Flutter Layered Best Practices, BigQuery Optimization, and Stitch UI).
          </p>
        </div>

        <div style="background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 2rem;">
          <div style="width: 42px; height: 42px; border-radius: 8px; background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 1.5rem; color: #a78bfa; font-size: 1.2rem;">
            🛡️
          </div>
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.8rem;">Continuous Auto-Allow</h3>
          <p style="font-size: 0.9rem; color: var(--text-dim); line-height: 1.6;">
            Say goodbye to endless permission confirmation loops. Graviton passes verified safe flags into Antigravity so you can relax while autonomous tasks complete.
          </p>
        </div>
      </div>
    </section>

    <!-- 06 / GET STARTED: INSTALLATION -->
    <section id="get-started" class="get-started-section" style="max-width: 1400px; margin: 6rem auto; padding: 0 2rem;">
      <div style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--emerald); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 0.8rem;">
        06 / Get Started
      </div>
      <h2 style="font-size: 2.2rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 2.5rem;">
        Install in seconds. Zero configuration required.
      </h2>

      <div class="get-started-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 2.5rem;">
        <div>
          <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.8rem;">Install Globally via NPM</h3>
          <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 1.5rem;">
            Works natively with Antigravity CLI (agy), VSCode extensions, and Git terminals.
          </p>
          <div style="background: #020306; border: 1px solid var(--border); border-radius: 8px; padding: 1rem; font-family: var(--font-mono); font-size: 0.85rem; color: #34d399; display: flex; justify-content: space-between; align-items: center;">
            <span>npm install -g @alatariz/graviton</span>
            <button onclick="copyCmd('npm install -g @alatariz/graviton')" style="background: none; border: 1px solid var(--border); color: #fff; border-radius: 4px; padding: 0.3rem 0.6rem; cursor: pointer;">Copy</button>
          </div>
        </div>

        <div>
          <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 0.8rem;">1-Shot Auto-Allow Command</h3>
          <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 1.5rem;">
            Synthesizes your prompt, unlocks skills, and launches Antigravity without confirmation hurdles.
          </p>
          <div style="background: #020306; border: 1px solid var(--border); border-radius: 8px; padding: 1rem; font-family: var(--font-mono); font-size: 0.85rem; color: #38bdf8; display: flex; justify-content: space-between; align-items: center;">
            <span>graviton "buatkan responsive landing page"</span>
            <button onclick="copyCmd('graviton \\\"buatkan responsive landing page\\\"')" style="background: none; border: 1px solid var(--border); color: #fff; border-radius: 4px; padding: 0.3rem 0.6rem; cursor: pointer;">Copy</button>
          </div>
        </div>
      </div>
    </section>
`;

// Insert fullSections right before </main>
html = html.replace('</main>', fullSections + '\n  </main>');

// 3. Tab logic and interactive snippet scripts
const scriptLogic = `
    // INTERACTIVE TABS DATA
    const TAB_DATA = {
      git: {
        raw: \`On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   package.json
	modified:   src/server.js
	modified:   public/index.html
	modified:   public/docs.html

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	temp_cache.log
	node_modules/.cache/
	dist/bundle.js.map

no changes added to commit (use "git add" to track)\`,
        clean: \`M package.json
M src/server.js
M public/index.html
M public/docs.html
?? temp_cache.log
?? dist/bundle.js.map\`,
        rawTokens: '342 tokens',
        cleanTokens: '28 tokens (-91%)'
      },
      test: {
        raw: \`> test
> vitest run --reporter=verbose

 RUN  v1.4.0 C:/projects/graviton

 ✓ test/pipeline.test.js (12 tests) 48ms
   ✓ should strip ANSI sequences
   ✓ should deduplicate streaming logs
   ✓ should redact credentials in string
   ✓ should estimate tokens accurately
   ✓ should inject Antigravity skill directives
   ✓ should detect Node.js workspace root
   ✓ should format code cleanly
   ✓ should support empty prompt fallback
   ✓ should resolve modern-web-guidance
   ✓ should resolve flutter guidelines
   ✓ should resolve bigquery optimization
   ✓ should format terminal gains

 Test Files  1 passed (1)
      Tests  12 passed (12)
   Start at  13:14:02
   Duration  480ms (transform 21ms, setup 0ms, collect 42ms, tests 48ms)

=============================== Coverage summary ===============================
Statements   : 96.4% ( 161/167 )
Branches     : 88.2% ( 45/51 )
Functions    : 100% ( 18/18 )
Lines        : 96.4% ( 161/167 )
================================================================================\`,
        clean: \`✔ 12/12 passed (vitest 480ms)
Coverage: 96.4% Stmts | 88.2% Branch | 100% Funcs\`,
        rawTokens: '520 tokens',
        cleanTokens: '34 tokens (-93%)'
      },
      prompt: {
        raw: \`Halo Antigravity tolong dong buatkan halaman landing page modern web ada modal dialog dan animasinya ya, responsive juga untuk mobile dan tablet. Makasih banyak ya!\`,
        clean: \`[Workspace: Node.js / JavaScript @ C:\\\\projects\\\\landing]
[Antigravity Skill Activated: modern-web-guidance]

**Tujuan Utama:**
Implementasikan landing page modern responsive dengan modal dialog dan animasi CSS performa tinggi (view transitions, container queries, :has selectors).\`,
        rawTokens: '46 tokens',
        cleanTokens: '68 tokens (+Directives)'
      },
      cargo: {
        raw: \`   Compiling proc-macro2 v1.0.86
   Compiling unicode-ident v1.0.12
   Compiling quote v1.0.36
   Compiling syn v2.0.72
   Compiling cfg-if v1.0.0
   Compiling libc v0.2.155
   Compiling serde v1.0.204
   Compiling graviton-core v0.1.0 (C:\\\\rust\\\\graviton-core)
    Finished \`dev\` profile [unoptimized + debuginfo] target(s) in 2.14s\`,
        clean: \`✔ Compiled graviton-core v0.1.0 in 2.14s (8 crates)\`,
        rawTokens: '184 tokens',
        cleanTokens: '18 tokens (-90%)'
      }
    };

    function switchTab(key, btn) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const data = TAB_DATA[key];
      if (!data) return;
      document.getElementById('raw-preview').textContent = data.raw;
      document.getElementById('clean-preview').textContent = data.clean;
      document.getElementById('raw-tokens-badge').textContent = data.rawTokens;
      document.getElementById('clean-tokens-badge').textContent = data.cleanTokens;
    }

    function copyCmd(cmd) {
      navigator.clipboard.writeText(cmd);
      showToast('✔ Command copied to clipboard!');
    }

    // Initialize default tab
    switchTab('git', null);
  </script>`;

html = html.replace('</script>', scriptLogic);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Successfully injected sections 02-06 into public/index.html');
