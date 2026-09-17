# Security Policy

Graviton takes developer privacy, workstation safety, and supply-chain integrity with extreme seriousness. As an acceleration and context-management CLI proxy that runs commands and prepares prompts for AI coding agents, our highest design priority is maintaining **100% transparency, zero network telemetry, and zero remote data exposure**.

---

## Supported Versions

Only the latest major and minor release versions receive security patches and updates.

| Version | Supported          | Status                                 |
| :---    | :---:              | :---                                   |
| 3.0.x   | :white_check_mark: | Actively supported with security updates |
| < 3.0.0 | :x:                | End-of-life. Please upgrade to V3.0.0.  |

---

## Core Security & Privacy Guarantees

Graviton is engineered from the ground up to prevent malicious interception, credential exfiltration, and unexpected workspace modifications.

### 1. 100% Offline & Zero Network Telemetry
* **No Analytics or Telemetry**: Graviton contains **zero** tracking scripts, Google Analytics, telemetry pingbacks, or diagnostic beacons.
* **No External Servers**: Graviton does not transmit prompts, workspace files, code snippets, or system metrics to any remote server or third-party cloud.
* **Local V8 Execution**: All token estimation, AST indexing, intelligent context scoping, and terminal filtering are performed entirely in-memory using Node.js standard libraries.

### 2. Zero Runtime Dependencies (Zero Supply-Chain Risk)
* The core CLI engine in `bin/` and `src/` has **zero external npm dependencies**.
* It runs exclusively on Node.js built-in standard modules:
  * `node:fs` & `node:path`
  * `node:os` & `node:crypto`
  * `node:child_process` & `node:readline`
* This eliminates the primary attack vector in modern developer tooling: compromised transitive npm packages (supply-chain hijacking).

### 3. Transparent & Unobfuscated Source Code
* Graviton source code is **never minified, compressed, or obfuscated**.
* The code published to npm and GitHub is 100% human-readable ES module JavaScript. Any developer can inspect every line of execution directly on their workstation.

### 4. Automatic Secret & Credential Redaction
* Prompts and terminal outputs pass through Graviton's continuous credential sanitizer before entering the AI context.
* Common secret formats are automatically replaced with `[REDACTED_SECRET]`:
  * OpenAI, Anthropic, and Google AI API keys
  * GitHub Personal Access Tokens (`ghp_...`)
  * AWS Access Key IDs & Secret Access Keys
  * Slack, Discord, and Telegram webhook URLs
  * PEM private keys (`-----BEGIN RSA PRIVATE KEY-----`)
  * Generic Bearer tokens and JWT authorization headers

### 5. Pre-Session Safety Snapshots & Reversibility
* Before allowing modifying agents to alter code, Graviton creates pre-session snapshots in `~/.graviton/backups/`.
* If an agent produces corrupted code, broken syntax, or unintended deletions, developers can inspect changes with `grav diff` and revert the workspace instantly with `grav rb` (Rollback Guard).

### 6. Strict Workspace Confinement
* Child processes dispatched by Graviton to Google Antigravity (`agy`) are confined strictly to the active workspace directory. Path traversal attempts (`../../`) are blocked to prevent touching files outside the intended project.

---

## Independent Verification & Audit Guide

We encourage developers and security teams to independently audit and verify Graviton's behavior.

### A. Verify Source Code on Your Machine
You can inspect the exact code installed globally on your machine at any time:

**macOS / Linux:**
```bash
cat $(which grav)
# Inspect the core engine:
cat $(dirname $(which grav))/../src/pipeline.js
```

**Windows (PowerShell):**
```powershell
Get-Content (Get-Command grav).Source
# Inspect the core engine:
Get-Content (Join-Path (Split-Path (Get-Command grav).Source) "..\src\pipeline.js")
```

### B. Verify Zero Outbound Network Activity
You can run Graviton in an isolated shell and observe network connections.

**Inspect Network Connections (Linux / macOS):**
```bash
# In one terminal, monitor connections from Graviton:
netstat -an | grep -E 'ESTABLISHED|SYN_SENT'

# In another terminal, run a prompt synthesis:
grav "Analyze project architecture"
```
*Expected Result*: Zero outbound TCP/UDP connections to external IP addresses.

**Offline Verification (Air-Gapped Mode):**
Graviton works seamlessly with your Wi-Fi/Ethernet disabled:
```bash
# Disable network, then run:
grav doc
grav cmp
grav pin src/index.js
```
All commands execute without warning or failure, proving 100% offline capability.

---

## Reporting a Vulnerability

If you discover a security vulnerability or potential threat in Graviton, please report it responsibly:

1. **Do NOT open a public GitHub issue** for undisclosed security vulnerabilities.
2. Submit a report privately via **[GitHub Security Advisories](https://github.com/alatariz/graviton/security/advisories/new)** on the official repository.
3. Alternatively, contact the maintainer directly via email: **`alatariz@users.noreply.github.com`** with the subject `[SECURITY] Graviton Vulnerability Report`.

Please include:
* Description of the vulnerability and potential impact.
* Step-by-step reproduction instructions or proof-of-concept (PoC).
* Your affected OS and Node.js version.

We commit to acknowledging your report within **48 hours** and providing a fix or remediation plan within **7 days**.
