# Graviton - Autonomous AI Acceleration Layer

[![npm version](https://img.shields.io/badge/npm-v1.6.0-CB3837.svg?style=flat-square&logo=npm)](https://www.npmjs.com/package/graviton)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/badge/version-v1.6.0-orange.svg?style=flat-square)](package.json)
[![Zero-Token Architecture](https://img.shields.io/badge/architecture-Zero--Token-success.svg?style=flat-square)](#core-architecture)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg?style=flat-square&logo=node.js)](https://nodejs.org/)

> **Graviton** is an ultra-fast, zero-auth, zero-token context optimization and autonomous execution middleware for the Google Antigravity (`agy`) CLI. It acts as a ruthless, hyper-optimized layer that maximizes signal-to-noise ratio in developer prompts, mitigates token exhaustion, and accelerates autonomous coding workflows.

---

## ⚡ The Vision (Context & Purpose)

Modern AI development tooling frequently suffers from **context bloat, latency overhead, and token waste**. Intermediate cloud models, verbose conversational wrappers, and unfiltered terminal spew drain LLM context windows before actionable engineering even begins.

**Graviton rejects this paradigm by embodying the classic Unix Philosophy:**
- **Do One Thing and Do It Ruthlessly**: Graviton’s sole mission is to ingest raw developer instructions, isolate critical signal from noise, hydrate relevant source context, and dispatch execution directly to Antigravity without human or model friction.
- **Silence Is Golden**: No verbose greeting banners, no decorative progress bars, no intermediate AI chit-chat. Graviton executes silently in single-digit milliseconds, emitting output strictly when errors demand attention or execution concludes.
- **Zero-Auth, Zero-Token Overhead**: Graviton requires no external API keys, accounts, subscriptions, or secondary LLM calls. Prompt transformation is 100% deterministic, offline, and native. It serves as a hardened, performance-obsessed companion to the Antigravity IDE.

---

## 🛠️ Core Architecture (Deep-Dive Features)

Graviton's engine operates completely within local Node.js standard libraries, executing multi-stage heuristic pipelines before passing sanitized payloads to the Antigravity CLI.

```
┌─────────────────┐     ┌───────────────────────┐     ┌────────────────────────┐     ┌─────────────────────┐
│  Developer Raw  │ ──► │ Surgical Regex Pruner │ ──► │ Local Workspace & File │ ──► │ Autonomous Launch   │
│ Prompt / Pipe   │     │ & Minified Shield     │     │ Hydration Engine       │     │ (Antigravity 'agy') │
└─────────────────┘     └───────────────────────┘     └────────────────────────┘     └─────────────────────┘
                                                                  │
                                                                  ▼
                                                      ┌────────────────────────┐
                                                      │ Detached Shadow Backup │
                                                      │ (~/.graviton/backups/) │
                                                      └────────────────────────┘
```

### 1. Zero-Token File Hydration
- **Local AST & Dependency Traversal**: Ingests prompts and detects mentioned files via zero-cost regex matcher.
- **Shallow Dependency Scraping**: Detects local relative imports (`import` / `require`) up to 1 level deep, automatically resolving project path aliases (`@/` and `~/` parsed directly from `tsconfig.json` / `jsconfig.json`).
- **Bounded Ingestion**: Injects detected source files and their immediate dependencies into the super prompt wrapped in bounded blocks, strictly enforcing a 500-line truncation ceiling to prevent context explosion without incurring a single external token cost.
- **Path Traversal Jail**: Jails all import resolution strictly within `process.cwd()`, neutralizing potential path traversal vulnerabilities (`../`) at the boundary.

### 2. Smart Priority Sorting
- **Language-Agnostic Code-Density Evaluation**: Unlike naive tools that rely on hardcoded directory lists, Graviton evaluates directories based on functional code density.
- **Dynamic Context Hierarchy**: Folders containing primary code extensions (`.js`, `.ts`, `.py`, `.rs`, `.go`, `.cpp`) are dynamically weighted and pushed to the top of the workspace map. Static asset directories (`assets/`, `public/`, `dist/`, `docs/`) and binary blobs are deprioritized or suppressed, ensuring the LLM encounters core architecture first.

### 3. The Minified Shield
- **Token Bomb Neutralization**: Inadvertently hydrating a minified bundle or a minified vendor file can instantly incinerate tens of thousands of context tokens.
- **Automated Bundle Interception**: Files ending in `.min.js`, `.min.css`, or containing single lines exceeding 1,000 characters are intercepted immediately. Graviton substitutes their body with a lightweight token-safe descriptor:
  ```javascript
  // [MINIFIED FILE DETECTED: CONTENT OMITTED FOR TOKEN SAFETY]
  ```
- **Bounded JSON Whitelist**: Whitelists structural JSON payloads while blocking multi-megabyte serialized JSON dumps, preserving stack traces and valid config objects while incinerating log spam.

### 4. Shadow Backups
- **Zero-Collateral Git Safety**: Traditional auto-stash or auto-commit scripts frequently stage unintended sensitive files (`.env`, private keys, secrets) into Git working trees.
- **Isolated File Mirroring**: Graviton bypasses Git working trees entirely. Before dispatching prompts to Antigravity, every file flagged for hydration is copied to `~/.graviton/backups/` using timestamped mirrors (`[filename]_[timestamp].bak`).
- **Detached Garbage Collection**: Purging expired backups (> 7 days) is handed off to an independent OS child process spawned with `detached: true` and `child.unref()`. Graviton never blocks the terminal or delays prompt delivery for disk maintenance.

---

## 📋 Prerequisites

To run Graviton, ensure your environment satisfies the following:

1. **Node.js**: Version `>= 18.0.0` (ESM native runtime).
2. **Antigravity CLI (`agy`)**: An active, authenticated installation of the Google Antigravity CLI is **strictly required**.
   - The `agy` binary must be accessible in your system `PATH` or at `~/.gemini/bin/agy`.
   - You must be authenticated in Antigravity (`agy auth` / active session).
3. **Zero-Auth for Graviton**: Graviton itself requires **zero credentials**, zero configuration files, and zero API tokens. It works out-of-the-box on top of your existing Antigravity environment.

---

## 🚀 Installation & Usage

### Installation

Clone the repository and install globally via npm:

```bash
# Clone the repository
git clone https://github.com/alatariz/graviton.git
cd graviton

# Install globally (registers dual CLI binaries)
npm install -g .
```

Verify your installation:

```bash
graviton --version
# or
grav --version
```

### Dual-Command Usage

Graviton provides two interchangeable CLI binaries: `graviton` for standard workflows and `grav` for high-velocity keystroke efficiency.

#### 1. Direct Execution
Synthesize context, hydrate referenced files, and dispatch execution directly to Antigravity:

```bash
# Standard command
graviton "Fix the authentication error in src/auth.js"

# Ultra-fast alias
grav "Refactor calculateDensity in src/pipeline.js to handle empty dirs"
```

#### 2. Deep Architecture Mode
Pass complex refactoring prompts requiring comprehensive architectural review:

```bash
graviton --deep "Build a scalable webhook verification handler for Stripe"
```

#### 3. Piped Terminal Ingestion
Pipe noisy terminal logs, failing test suites, or Git diffs straight into Graviton. The surgical regex pruner will strip machine noise, retain stack traces, and formulate an executable prompt:

```bash
# Pipe failing tests directly into Antigravity
npm test | grav

# Pipe Git status for instant commit analysis
git status | graviton
```

#### 4. Silent Trip Odometer
Every prompt execution transparently calculates original versus pruned token metrics and records them locally in `~/.graviton/odometer.json` for personal optimization audits:

```bash
✔ Execution complete. (Session Est: 342 tokens | Total Saved: 148,290 tokens)
```

---

## 📄 License

Graviton is licensed under the **Apache License Version 2.0**. See the [LICENSE](LICENSE) file for full terms and conditions.
