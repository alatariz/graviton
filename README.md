# Graviton - Autonomous AI Acceleration Layer for Antigravity

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Zero-Token](https://img.shields.io/badge/Zero--Token-100%25%20Local-purple.svg)](#philosophy)
[![Release](https://img.shields.io/badge/Release-v1.6.0-orange.svg)](package.json)

**Graviton** is an ultra-fast, zero-token context optimization and autonomous execution middleware for the Google Antigravity (`agy`) CLI. It maximizes the signal-to-noise ratio of development prompts through language-agnostic workspace mapping, surgical regex noise pruning, smart file hydration, and detached background shadow backups.

---

## ⚡ Philosophy: The Zero-Token Approach

Traditional AI developer tooling often wastes significant context tokens and introduces API latency by routing prompt optimization through cloud LLMs. **Graviton operates on a strict Zero-Token Philosophy**:

1. **100% Offline & Zero External API Calls**: Graviton never invokes an intermediate LLM. All transformations run locally on your machine in single-digit milliseconds using pure Node.js standard libraries.
2. **Surgical Noise Pruning**: Aggressive, start-of-line regex filters eliminate noisy terminal logs (`npm WARN`, `pip`, `cargo`, `go`, info headers) and large base64/array blobs while whitelisting stack traces, error causes, and JSON object literals under 200 characters.
3. **Smart File Hydration & Code-Density Sorting**: Automatically parses file references in your prompt, resolves path aliases (`@/` and `~/` via `tsconfig.json` / `jsconfig.json`), and injects bounded 500-line snippets while blocking minified bundles (`.min.js`, `.min.css`, single-line 1000+ char files). Workspace directories are sorted dynamically by code-extension density rather than hardcoded directory names.
4. **Non-Destructive Shadow Backups**: Before forwarding prompts to Antigravity, detected hydrated files are copied safely to `~/.graviton/backups/` with timestamped backups (`[filename]_[timestamp].bak`). Collateral secret staging (e.g. `.env`) is completely eliminated, and old backups (> 7 days) are purged asynchronously via detached OS processes.

---

## 📋 Prerequisites

Before using Graviton, verify that your environment satisfies:

* **Node.js**: `>= 18.0.0` (ES Modules and modern standard library required).
* **Antigravity CLI (`agy`)**: An authenticated installation of Google Antigravity CLI is **strictly required**.
  * Ensure `agy` is accessible in your `PATH` or located at `~/.gemini/bin/agy`.
  * You must already be logged into your Antigravity account before invoking Graviton.

---

## 📦 Installation

Clone the repository and install globally using npm:

```bash
# 1. Clone repository
git clone https://github.com/alatariz/graviton.git
cd graviton

# 2. Install globally (registers dual binaries: graviton & grav)
npm install -g .

# Or link directly for local development:
npm link
```

Verify installation:

```bash
graviton --version
# or
grav --version
```

---

## 🚀 Usage

Graviton supports both the full command `graviton` and the convenient shorthand `grav`.

### 1. Direct Prompt Execution

```bash
# Synthesize context, hydrate files, and execute via Antigravity:
graviton "Fix the authentication error in src/auth.js"

# Using the shorthand:
grav "Refactor calculateDensity in src/pipeline.js to handle empty dirs"
```

### 2. Deep Architecture Mode

For complex full-stack changes and multi-step refactors, activate deep architecture synthesis:

```bash
graviton --deep "Build a scalable webhook verification handler for Stripe"
```

### 3. Session Resumption

Resume previous Antigravity sessions seamlessly with context hydration:

```bash
graviton -c "Now add unit tests for the functions we just created"
```

### 4. Piped Terminal Output

Pipe raw logs or git status directly into Graviton to prune noise and formulate bug-fix prompts:

```bash
git status | graviton
npm test | grav
```

---

## 🛡️ Built-in Safeguards

* **Rate Limit Interceptor**: Traps HTTP `429`, `Too Many Requests`, and `Quota Exceeded` errors immediately, alerting the developer and halting execution before wasting resources.
* **Unauthenticated Interceptor**: Detects missing or unauthenticated Antigravity CLI environments, halting with clear instructions.
* **Path Traversal Jail**: Jails all relative dependency resolution within `process.cwd()`, preventing traversal attacks through `../` imports.
* **Minified Bundle Protection**: Automatically intercepts `.min.js`, `.min.css`, or long single-line files (>1000 chars), replacing them with token-safe placeholders.

---

## 📄 License

Graviton is distributed under the **Apache License Version 2.0**. See [LICENSE](LICENSE) for details.
