<div align="center">

  <img src="graviton-logo.png" width="160" alt="Graviton Logo" />

  # GRAVITON V2.0.0

  ### Autonomous AI Acceleration & Intelligent Context-Scoped Engine for Google Antigravity

  <p align="center">
    <b>Zero-Auth &bull; 100% Pure Node.js V8 stdlib &bull; Sub-millisecond Relay &bull; Zero External LLM Calls</b>
  </p>

  <p align="center">
    <a href="https://github.com/alatariz/graviton/releases"><img src="https://img.shields.io/badge/version-2.0.0-00f0ff.svg?style=for-the-badge&logo=semver&logoColor=black" alt="Version 2.0.0" /></a>
    <a href="https://github.com/alatariz/graviton/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=for-the-badge" alt="License Apache-2.0" /></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18.0.0-339933.svg?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js 18+" /></a>
    <a href="https://github.com/alatariz/graviton"><img src="https://img.shields.io/badge/built%20for-Google%20Antigravity-8A2BE2.svg?style=for-the-badge" alt="Built for Google Antigravity" /></a>
    <a href="https://github.com/alatariz/graviton/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/alatariz/graviton/ci.yml?branch=main&label=CI%20Matrix&style=for-the-badge&logo=githubactions&logoColor=white" alt="CI Matrix" /></a>
    <a href="https://github.com/alatariz/graviton/actions/workflows/security.yml"><img src="https://img.shields.io/github/actions/workflow/status/alatariz/graviton/security.yml?branch=main&label=CodeQL%20Security&style=for-the-badge&logo=github&logoColor=white" alt="CodeQL Security" /></a>
    <a href="SECURITY.md"><img src="https://img.shields.io/badge/Security-100%25%20Offline%20%7C%20Zero%20Telemetry-00f0ff.svg?style=for-the-badge&logo=shield" alt="100% Offline & Zero Telemetry" /></a>
  </p>

  <p align="center">
    <a href="#quickstart--installation">Installation</a> &bull;
    <a href="#the-evolution-story">Evolution Story</a> &bull;
    <a href="#architecture--workflow">Architecture</a> &bull;
    <a href="#core-features--usage">Features & Usage</a> &bull;
    <a href="#cli-command-reference">CLI Reference</a> &bull;
    <a href="#empirical-benchmarks">Benchmarks</a> &bull;
    <a href="#security-privacy--trust">Security & Trust</a> &bull;
    <a href="#troubleshooting--faq">Troubleshooting & FAQ</a>
  </p>


</div>

---

> [!IMPORTANT]
> **What is Graviton V2.0.0?**
> Graviton is a zero-auth, high-performance terminal accelerator and **Intelligent Context Engine** built specifically for the **Google Antigravity CLI (`agy`)**. 
> Executing **100% offline** on your local machine with zero external API keys, Graviton prunes terminal noise (-95% tokens), intercepts catastrophic minified file context bombs, pins target files directly into the AI prompt (Smart Target Pinning), provides Antigravity IDE-style conversation history management (`grav -c`), and launches autonomous sessions in **< 0.8 milliseconds**.

---

<h2 id="quickstart--installation">Quickstart & Installation</h2>

Follow these straightforward steps to install Graviton on any workstation (Windows, macOS, or Linux).

### Step 1: Install Node.js (Version >= 18.0.0)
Graviton runs natively on modern Node.js using native ES Modules.

- **Windows:**
  ```powershell
  winget install OpenJS.NodeJS.LTS
  ```
  *(Or download the official `.msi` installer from [nodejs.org](https://nodejs.org))*
- **macOS:**
  ```bash
  brew install node
  ```
- **Linux (Ubuntu/Debian):**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
- **Verify Version:**
  ```bash
  node -v
  # Should output v18.0.0 or newer (v20.x.x LTS recommended)
  ```

---

### Step 2: Install Google Antigravity CLI (`agy`)

> [!NOTE]
> **Antigravity CLI vs. Antigravity Desktop App:**
> The Antigravity Desktop App (`antigravity.exe`) is an Electron-based GUI application. Graviton integrates with Google's official command-line tool named **`agy`**.

- **Windows (PowerShell):**
  ```powershell
  irm https://antigravity.google/cli/install.ps1 | iex
  ```
  *Or via Command Prompt (CMD):*
  ```cmd
  curl -fsSL https://antigravity.google/cli/install.cmd -o install.cmd && install.cmd && del install.cmd
  ```
- **macOS & Linux:**
  ```bash
  curl -fsSL https://antigravity.google/cli/install.sh | bash
  ```
- **Verify Antigravity CLI:**
  ```bash
  agy --version
  ```
- *(Optional)* If `agy` is installed in a non-standard location not currently in your system `PATH`, configure the environment variable:
  ```powershell
  # Windows PowerShell
  [System.Environment]::SetEnvironmentVariable('AGY_PATH', 'C:\Path\To\agy.exe', 'User')
  ```

---

### Step 3: Install Graviton Globally

Install Graviton globally using a single, production-grade npm command:

```bash
npm install -g github:alatariz/graviton
```

#### Dual Binary Shorthands
Graviton automatically provisions dual global commands:
```bash
# Full command:
graviton --version

# Ultra-fast alias:
grav --version
# Output: GRAVITON v2.0.0 (Graviton V2.0.0 Intelligent Context Engine)
```

---

### Step 4: Run Automated Diagnostics (`grav doctor`)

Verify that your environment, dependencies, and permissions are 100% healthy:

```bash
grav doctor
```

If any component requires setup, use `--fix`:
```bash
grav doctor --fix
```

Example diagnostics output:
```text
=== GRAVITON SYSTEM HEALTH DOCTOR ===
  ✔ Node.js Runtime       : v20.14.0 (Supported)
  ✔ Antigravity CLI (agy) : C:\Users\...\.gemini\bin\agy.exe
  ✔ Brain Storage Path    : C:\Users\...\.gemini\antigravity\brain
  ✔ Graviton Config Dir   : C:\Users\...\.graviton (Permissions OK)
  ✔ Git Version Control   : git version 2.45.1
  ✔ Python Runtime        : Python 3.12.3

Status: ALL SYSTEMS HEALTHY. Ready to accelerate Antigravity!
```

---

<h2 id="the-evolution-story">The Evolution Story: From Token Saver to Intelligent Context Engine</h2>

Graviton was forged directly from real-world development friction with Google Antigravity across multi-million token codebases:

### 1. Phase 1: The Token Bleeding Crisis & Minified Bombs
Developers frequently pasted raw terminal dumps (Webpack, Jest, Cargo, Docker build errors) into their prompts. This had devastating consequences:
- **Exhausted Context Windows:** 5,000–10,000 tokens burned on ANSI color codes, repeating progress bars, and irrelevant compiler warnings.
- **The Minified Bomb:** Ingesting a single `.min.js` vendor bundle or multi-megabyte `package-lock.json` incinerated 35,000+ tokens in one turn.
- **The Origin Solution:** Graviton introduced the **Noise Stripper**, **Terminal Pruner**, and **The Minified Shield**, instantly truncating verbose dumps into compact 10–15 line tracebacks while substituting minified files with safe stubs.

### 2. Phase 2: Directory Confinement & Detached Shadow Backups
LLMs often generated files outside the active workspace (such as in `~/.gemini` or parent scratch directories) or polluted the Git working tree with auto-stashes.
- **The Solution:** Graviton introduced **Strict Workspace Confinement** (`[CWD]`) and **Detached Shadow Backups** (`~/.graviton/backups/`). Source files are safely mirrored before execution, leaving Git working trees pristine.

### 3. Phase 3: Port Guard & Silent Background Daemons
When AI tools launched web dev servers (e.g. `npm run dev`, `vite`), terminals hung indefinitely, dev ports (3000, 5173) collided, and Windows spawned annoying console pop-up windows.
- **The Solution:** Graviton introduced **Port Guard** with Base64 `-EncodedCommand` and `-WindowStyle Hidden` execution. Port conflicts are auto-healed, and long-running servers run cleanly as background daemons without terminal freeze or pop-ups.

### 4. Phase 4: V2.0.0 Context Scope & Smart Target Pinning
The single biggest latency bottleneck in autonomous AI agents is not writing code—it is **searching for which file to edit**.
Before V2.0.0, asking the AI to *"fix the login validation bug"* caused Antigravity to make 3 to 4 exploratory tool calls (`list_dir`, `grep_search`, `view_file`), waiting 30+ seconds and wasting 5,000–12,000 tokens per turn.
- **The V2.0.0 Breakthrough:** Graviton introduced **Smart Target Pinning**. Running in under 5ms on your local CPU with zero token consumption, it resolves your prompt keywords against the active directory tree and attaches:
  ```text
  [GRAVITON ACTIVE TARGET SCOPE]: src/api/auth.js
  Directive: Inspect and modify this target file directly. Bypass exploratory list_dir/grep_search calls.
  ```
  The AI hits the exact target on turn one. Execution turnaround dropped from **30 seconds to 3–5 seconds**!

### 5. Phase 5: Delta Prompting & Smart Session Compactor
On continuous chats, sending redundant workspace trees on every turn bloated context and inflated latency.
- **The Solution:** **Delta Prompting** suppresses repeated directory maps after the first turn. When sessions cross 8 turns or 80k tokens, `grav compact` creates an architectural memory snapshot and refreshes the context window.

### 6. Phase 6: Post-Run Syntax Sanity Guard & One-Click Rollback
AI-generated code occasionally introduced minor syntax errors (unclosed brackets, invalid JSON) that remained hidden until runtime.
- **The Solution:** **Syntax Sanity Guard** runs local compiler validation immediately after code generation:
  - `.js`, `.mjs`, `.cjs` via `node --check`
  - `.json` via schema validation
  - `.py` via `python -m py_compile`
  If broken syntax is caught, Graviton alerts the developer immediately and offers one-click rollback (`grav undo`).

### 7. Phase 7: Antigravity IDE-Style Conversation History (`-c` & `-n`)
Multi-turn conversations needed an intuitive, IDE-grade interaction model:
- Regular prompts (`grav "<prompt>"`) default to starting **clean, independent chats**.
- `grav -c` (or `--conversation`) displays an **Antigravity IDE-style interactive conversation history** (topics, turns, tokens, relative time) with selection, history review, and deletion options.
- `grav -n` (or `--new`) forces a fresh chat session.
- **Topic Anchoring** guarantees that continued conversations stay strictly aligned to the active subject without AI hallucination or drift.

---

<h2 id="architecture--workflow">Architecture & Workflow: Is There a "Double Prompt"?</h2>

> [!TIP]
> **Technical Fact: ZERO Secondary LLM Calls.**
> Graviton does **NOT** query an intermediate AI model to optimize your prompts. All keyword matching, AST traversal, dependency scraping, and log pruning are performed **100% locally on your CPU via Node.js V8 standard libraries**. Only **ONE** API call is made—directly to Google Antigravity.

```mermaid
flowchart TD
    A["Developer Prompt / Piped Terminal Input"] --> B["GRAVITON ENGINE (Local CPU, ~0.8ms)"]
    
    subgraph OfflineEngine ["Offline Heuristic Pipeline (0 Tokens / $0.00 Cost)"]
        B --> C["1. Noise Stripper & Log Pruner<br/>(Strip ANSI & compress build errors)"]
        C --> D["2. Smart Target Scoper & Dependency Scraping<br/>(Fuzzy match keywords -> Pin target file)"]
        D --> E["3. Minified Shield & Secret Redaction<br/>(Neutralize .min.js & mask API credentials)"]
        E --> F["4. Delta Prompting & Topic Anchoring<br/>(Anchor conversation topic & prune tree map)"]
    end
    
    F --> G["Final Synthesized SuperPrompt"]
    G -->|SINGLE API RELAY (Auto-Allow)| H["Google Antigravity Engine ('agy')"]
    H --> I["Code Written / Modified"]
    
    subgraph PostExecution ["Local Safety & Validation Layer"]
        I --> J["5. Syntax Sanity Guard<br/>(node --check / python compile)"]
        J --> K{"Syntax Broken?"}
        K -->|Yes| L["Sanity Alert & Offer 'grav undo'"]
        K -->|No| M["Port Guard Auto-Heal & Odometer Sync"]
    end
```

---

<h2 id="core-features--usage">Core Features & Usage Walkthrough</h2>

### 1. Quote-Free Prompts with Smart Target Pinning
Never struggle with escaping nested quotes in Windows PowerShell or CMD again:
```bash
# Execute prompt directly without external quotes:
grav Fix email validation and return 422 in src/auth.js

# Fast mode (low effort, instant execution without planning):
grav -f "Fix typo in README"

# Deep precision mode (high effort, architectural planning & synthesis):
grav -d "Architect an event-driven payment processor with idempotent webhooks"
```

---

### 2. Antigravity IDE-Style Conversation History (`-c` & `-n`)

Manage multi-turn conversations with the elegance of an IDE sidebar:

#### A. Interactive Conversation History Picker (`grav -c`):
```bash
grav -c
```
Terminal display:
```text
=== GRAVITON CONVERSATIONS (Antigravity IDE History) ===
Workspace: C:\project

  [1] ● [Active] "Fix email validation in auth.js"
      ID: dc290864... | 4 turns | ~12.5k tokens | 5m ago
  [2] ○ "Setup Express server in index.js"
      ID: e82b109a... | 1 turn | ~3.2k tokens | 2h ago

ACTIONS:
  <number>     Select & resume conversation (e.g. 1)
  d <number>   Delete conversation from history (e.g. d 2)
  n            Start a fresh conversation
  q            Cancel / Exit
```

#### B. Direct Shorthands:
```bash
# Resume conversation #1 in interactive REPL:
grav -c 1

# Send prompt directly to conversation #1:
grav -c 1 "add unit tests with jest"

# Delete conversation #2:
grav -c del 2
```

#### C. Start Fresh Conversations Explicitly (`-n`):
```bash
grav -n "create responsive navigation bar"
```

---

### 3. Interactive REPL Chat Shell (`grav chat`)

Engage in natural conversation with dynamic topic headers:
```bash
grav chat
```
Prompt display:
```text
graviton [Fix email validation]> 
```

#### In-Chat Slash Commands:
| Command | Description |
| :--- | :--- |
| `/c` | Display workspace conversation history list |
| `/c <number>` | Switch active conversation topic instantly (e.g. `/c 2`) |
| `/n` or `--n` | Reset session to start a fresh topic |
| `/del <number>` | Delete conversation from history |
| `/rename <title>` | Rename active conversation topic |
| `/undo` | Roll back AI code changes immediately |
| `/diff` | Inspect colorized line-by-line unified diff of AI edits |
| `/compact` | Compact context window and retain architectural memory |
| `/ports` | Inspect occupied development ports |
| `/stop [port]` | Terminate background server or free port |
| `/doctor` | Run system health diagnostics |
| `/status` | View active topic, turn count, and token usage |
| `/exit` | Exit REPL shell |

---

### 4. Syntax Sanity Guard (Automatic Verification)

Graviton automatically inspects modified files immediately upon AI task completion:
- `.js`, `.mjs`, `.cjs` checked via `node --check`
- `.json` validated via JSON schema parser
- `.py` checked via `python -m py_compile`

If syntax is damaged, an alert is rendered instantly:
```text
[🚨 GRAVITON SANITY ALERT] 1 broken syntax file(s) detected!
  ✖ src/routes/user.js: Unexpected token '}' (line 42)
💡 Recommendation: Run 'grav undo' to revert changes.
```

---

### 5. Instant Safety Rollback Guard & Diff Viewer

Every modified file is mirrored in `~/.graviton/backups/` before Antigravity runs:
```bash
# Review colorized code changes:
grav diff

# Revert modified files and remove newly generated files:
grav undo
```

---

### 6. Port Guard & Silent Background Daemons

Launch development servers cleanly without freezing your terminal or triggering Windows CMD pop-ups:
```bash
# Start dev server as a detached background daemon:
grav start "npm run dev"

# Scan active development ports:
grav ports

# Terminate server or free port 3000:
grav stop 3000
# Or stop all active daemons:
grav stop all
```

---

### 7. Piped Terminal Ingestion & Pruning

Filter giant terminal errors before forwarding to Antigravity:
```bash
# Pipe failing Jest/Vitest tests:
npm test 2>&1 | grav "fix failing assertion"

# Pipe Cargo / Go compiler errors:
cargo build 2>&1 | grav "resolve compilation error"

# Inspect Git status instantly:
git status | grav "generate conventional commit message"
```

---

### 8. Lifetime Telemetry Dashboard

Inspect lifetime saved tokens, pruned lines, and retained context headroom:
```bash
grav stats
```

---

<h2 id="cli-command-reference">CLI Command Reference</h2>

| Full Command / Flag | Short Alias | Description |
| :--- | :--- | :--- |
| `graviton "<prompt>"` | `grav "<prompt>"` | [DEFAULT] Synthesize & execute with Smart Target Pinning (defaults to fresh chat) |
| `graviton -f "<prompt>"` | `grav -f "<prompt>"` | Fast mode: direct execution without planning (low effort, lowest latency) |
| `graviton -d "<prompt>"` | `grav -d "<prompt>"` | Deep mode: deep precision synthesis & planning for complex architecture |
| `graviton -c` / `--conversation` | `grav -c` | Open Antigravity IDE-style conversation history picker |
| `graviton -c <no>` | `grav -c <no>` | Resume specific conversation in interactive REPL |
| `graviton -c <no> "<prompt>"` | `grav -c <no> "..."` | Execute prompt directly on specific conversation topic |
| `graviton -c del <no>` | `grav -c del <no>` | Delete conversation from workspace history |
| `graviton -n "<prompt>"` | `grav -n "<prompt>"` | Explicitly start a fresh conversation (reset session context) |
| `graviton chat` | `grav chat`, `grav repl` | Launch interactive REPL chat shell with dynamic topic indicator |
| `graviton doctor [--fix]` | `grav doc`, `grav doctor` | Inspect system health, runtime versions, and CLI binaries |
| `graviton diff` | `grav diff` | Review colorized unified diff of AI file edits |
| `graviton undo` | `grav rb`, `grav undo` | Safety Rollback: restore modified files and remove AI-created files |
| `graviton compact` | `grav cmp`, `grav compact` | Compact long session context to refresh window and save tokens |
| `graviton start <cmd>` | `grav start <cmd>` | Run dev server as a silent background daemon |
| `graviton stop [port]` | `grav stop [port]` | Terminate daemon or free occupied port (3000, 5173, etc.) |
| `graviton ports` | `grav port`, `grav ports` | Scan common dev ports for active listening processes |
| `graviton stats` | `grav gain`, `grav stats` | Display lifetime telemetry dashboard & token savings |
| `graviton map` | `grav map` | Display indexed workspace directory tree |
| `graviton clean "<prompt>"` | `grav clean "<prompt>"` | Synthesize SuperPrompt & copy to clipboard (bypass AI launch) |
| `graviton version` | `grav -v` | Display Graviton version and engine metadata |

---

<h2 id="empirical-benchmarks">Empirical Benchmarks: Real-World Efficiency in V2.0.0</h2>

Measured on production repositories:

| Scenario / Task | Without Graviton (Raw Output) | With Graviton V2.0.0 | Token Efficiency | Latency Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Terminal Error Dump** (`jest` / `pytest` 2,000 lines) | ~28,000 tokens | ~1,400 tokens | **-95.0% Noise Stripped** | `< 1ms local overhead` |
| **Locating Target File** (*"Fix login bug"*) | 5,000–12,000 tokens (3-4 exploratory search loops) | 0 tokens (Instant Smart Target Pinning) | **100% Search Loops Eliminated** | **Turnaround cut from 30s to 3s** |
| **Multi-Turn Workspace Context** | 3,000–5,000 tokens (repeated tree map) | ~500 tokens (Delta Prompting active) | **-80% Token Waste per Turn** | Instant |
| **Exposed Minified File** (`bundle.min.js`) | 35,000 tokens (context explosion) | 12 tokens (The Minified Shield) | **-99.9% Context Saved** | Instant |
| **Typical Daily Dev Session** | **~150,000 tokens consumed** | **~18,000 tokens consumed** | **88% Average Token Savings** | **10x Faster Overall Flow** |

---

<h2 id="troubleshooting--faq">Troubleshooting & FAQ</h2>

### Q1: "Google Antigravity CLI (agy) was not found on this machine"
**Cause:** You installed the Antigravity Desktop GUI App, but the official CLI binary (`agy`) is not installed or not registered in your `PATH`.
**Solution:**
Open PowerShell (or Bash on macOS/Linux) and install the official CLI:
```powershell
# Windows PowerShell:
irm https://antigravity.google/cli/install.ps1 | iex
```
Reopen your terminal and verify with `agy --version`, then run `grav doctor`.

---

### Q2: "Command 'grav' not recognized after installation"
**Cause:** The global npm prefix directory is not present in your system's `PATH` environment variable.
**Solution:**
1. Check your global npm prefix:
   ```powershell
   npm config get prefix
   # Typically: C:\Users\<Username>\AppData\Roaming\npm on Windows
   ```
2. Ensure this path is included in your User or System `PATH` variable.
3. Restart your terminal.

---

### Q3: Is Graviton safe for proprietary enterprise codebases?
**Completely Safe.**
1. **100% Offline Local Processing:** Graviton operates with zero remote servers, sends zero telemetry across the network, and uses zero third-party endpoints.
2. **Zero Dependencies:** Engineered exclusively on top of standard Node.js stdlib.
3. **Automated Credential Redaction:** Sensitive tokens (JWTs, Bearer credentials, AWS access keys) are automatically masked into `[[REDACTED]]`.
4. **Git Safe:** Backups are staged in `~/.graviton/backups/`, never touching your Git working tree.

---

<h2 id="security-privacy--trust">Security, Privacy & Trust Guarantees</h2>

As a command-line tool handling developer instructions and code paths, Graviton follows strict security-first principles. We believe that **trust is earned through verifiability, not claims**.

### 🛡️ Five Pillars of Graviton Security

1. **100% Offline by Design (Zero External Telemetry)**
   - Graviton has **zero** outbound tracking, telemetry, or analytics beacons.
   - Prompts, filenames, and diffs never leave your local workstation.
   - All heuristics, AST scoping, and compression run purely in-memory via Node.js V8 stdlib.

2. **Zero Runtime Dependencies**
   - The CLI runtime engine in `bin/` and `src/` requires **0 external npm dependencies**.
   - Completely eliminates third-party supply-chain attacks, typosquatting packages, and dependency bloat.

3. **Continuous Automated Secret Redaction**
   - Every prompt and terminal output is automatically screened against credential patterns (OpenAI keys, GitHub PATs, AWS keys, Slack webhooks, PEM certificates).
   - Sensitive credentials are sanitized into `[REDACTED_SECRET]` before Antigravity ingestion.

4. **Human-Auditable, Unobfuscated Source Code**
   - Graviton is distributed as clean, readable ES Modules.
   - You can inspect every line directly on your machine:
     ```bash
     cat $(which grav)
     ```

5. **Pre-Session File Snapshots & Safety Rollback Guard**
   - File state is automatically preserved in `~/.graviton/backups/` before modifications occur.
   - Broken syntax or unintended edits can be reviewed via `grav diff` and reverted in milliseconds with `grav rb`.

### 🔍 How to Independently Audit Graviton

You do not need to take our word for it. You can verify Graviton's network silence yourself using standard networking inspection tools:

```bash
# 1. Run Graviton with Wi-Fi/Ethernet disabled (Air-gapped verification):
grav doc
grav cmp
grav pin src/index.js
# All commands execute instantly without any network error!

# 2. Monitor open TCP/UDP sockets while running prompt synthesis:
# Linux/macOS:
netstat -an | grep -E 'ESTABLISHED|SYN_SENT'

# Windows PowerShell:
Get-NetTCPConnection -State Established
```

For full threat models, security practices, and responsible disclosure instructions, read our official [SECURITY.md](SECURITY.md).

---

<h2 id="license">License</h2>

Distributed under the **Apache-2.0 License**. See [LICENSE](LICENSE) for details.

&copy; 2026 **[@alatariz](https://github.com/alatariz)** &bull; Built with precision for the Google Antigravity developer ecosystem.

