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
  </p>

  <p align="center">
    <a href="#kisah-evolusi">Kisah Evolusi</a> &bull;
    <a href="#arsitektur-dan-cara-kerja">Cara Kerja</a> &bull;
    <a href="#panduan-instalasi-lengkap">Instalasi</a> &bull;
    <a href="#fitur-utama-dan-penggunaan">Fitur & Panduan</a> &bull;
    <a href="#referensi-perintah-cli">Tabel CLI</a> &bull;
    <a href="#benchmark-efisiensi-token">Benchmarks</a> &bull;
    <a href="#troubleshooting--faq">FAQ & Troubleshooting</a>
  </p>

</div>

---

> [!IMPORTANT]
> **Apa itu Graviton V2.0.0?**
> Graviton adalah akselerator terminal dan *Intelligent Context Engine* lokal untuk **Google Antigravity CLI (`agy`)**. 
> Berjalan **100% offline** di komputer Anda tanpa API key tambahan, Graviton memangkas sampah log terminal (-95% token), memblokir file minified berbahaya, mengarahkan fokus AI langsung ke file target (Smart Target Pinning), menyediakan riwayat chat ala Antigravity IDE (`grav --c`), dan mengeksekusi instruksi dalam **< 0.8 milidetik**.

---

<h2 id="kisah-evolusi">Evolusi & Kisah di Balik Graviton: Dari Token Saver Biasa ke Intelligent Engine</h2>

Graviton lahir dari kebutuhan nyata pengembang saat menggunakan Google Antigravity di proyek sehari-hari:

### 1. Masalah Awal: "Token Bleeding" pada Error Terminal & File Minified
Setiap kali pengembang mem-paste log error terminal (seperti build Webpack, Docker, atau Jest) ke dalam prompt, ribuan baris log sampah (ANSI escape codes, progress bar, warning minor) ikut terkirim. Akibatnya:
- **Konteks AI Cepat Penuh:** 5.000–10.000 token terbakar hanya untuk membaca log sampah.
- **Bom Konteks (Minified File):** Jika file bundle `.min.js` atau `package-lock.json` tanpa sengaja tersedot, context window langsung habis hingga 35.000+ token dalam satu kali kirim.
- **Solusi Awal Graviton:** Diciptakanlah *Noise Stripper*, *Terminal Pruner*, dan *The Minified Shield* untuk memangkas log menjadi ringkasan 10–15 baris esensial secara offline.

### 2. Tantangan Direktori: Menjaga Repositori Tetap Bersih
AI terkadang salah menaruh file baru di luar workspace (seperti di `~/.gemini` atau folder scratch) atau mengotori Git working tree dengan auto-stash.
- **Solusi:** Graviton memperkenalkan **Strict Workspace Confinement** (`[CWD]`) dan **Detached Shadow Backups** (`~/.graviton/backups/`) sehingga kode terlindungi tanpa mengotori commit Git.

### 3. Solusi Server: Background Daemons & Port Conflicts
Saat AI diminta menjalankan dev server (misal `npm run dev`), terminal seringkali macet (*hanging*) atau mengalami port conflict (misal port 3000/5173 sudah dipakai) dan memunculkan pop-up jendela PowerShell di Windows.
- **Solusi:** Diciptakanlah **Port Guard** dan **Silent Background Daemons** menggunakan Base64 `-EncodedCommand` dan `-WindowStyle Hidden` yang otomatis membebaskan port dan menjaga terminal tetap responsif tanpa pop-up mengganggu.

### 4. Lompatan V2.0.0: Context Scope & Smart Target Pinning
Kelemahan terbesar AI coding bukanlah saat menulis kode, melainkan saat **mencari file mana yang harus diedit**. 
Sebelum V2.0.0, saat Anda meminta *"perbaiki bug login"*, AI harus memanggil tool `list_dir`, `grep_search`, `view_file` berulang kali (memakan waktu 30+ detik dan 5.000–12.000 token).
- **Solusi V2.0.0:** Graviton kini memiliki **Smart Target Pinning**. Menggunakan fuzzy token matching lokal (< 5ms), Graviton langsung mencocokkan kata kunci prompt Anda dengan struktur folder aktif dan menyematkan:
  ```text
  [GRAVITON ACTIVE TARGET SCOPE]: src/api/auth.js
  Directive: Langsung buka dan modifikasi file target ini tanpa melakukan pencarian redundant.
  ```
  AI langsung tepat sasaran di giliran pertama. Waktu eksekusi turun dari **30 detik menjadi 3–5 detik**!

### 5. Penyempurnaan Alur: IDE-Style Conversation History (`--c` & `--n`)
Pada percakapan multi-turn, pengguna membutuhkan alur yang jelas:
- Default prompt biasa (`grav "..."`) otomatis memulai **chat baru** yang segar.
- Flag `grav --c` menampilkan **daftar riwayat percakapan mirip Antigravity IDE** lengkap dengan judul topik, turn, token, dan waktu, serta opsi hapus atau lanjutkan.
- Flag `grav -n` memulai chat baru secara eksplisit.
- **Topic Anchoring** menjaga agar AI tetap fokus pada benang merah topik yang sedang dibahas.

---

<h2 id="arsitektur-dan-cara-kerja">Arsitektur & Cara Kerja: Apakah Ada "2x Prompt"?</h2>

> [!TIP]
> **Fakta Teknis: TIDAK ADA 2x Prompt ke AI.**
> Graviton **BUKAN** wrapper yang memanggil LLM perantara untuk mereprompt. Seluruh pra-pemrosesan dilakukan **100% di CPU lokal Anda (Node.js)** menggunakan string parsing, regex, dan file system inspection. Panggilan ke AI tetap **HANYA 1 KALI** langsung ke Google Antigravity.

```mermaid
flowchart TD
    A["Developer Prompt / Piped Terminal Input"] --> B["GRAVITON ENGINE (Lokal CPU, ~0.8ms)"]
    
    subgraph OfflineEngine ["Pra-Pemrosesan Offline (Zero Token / Zero Cost)"]
        B --> C["1. Noise Stripper & Log Pruner<br/>(Pangkas sampah ANSI & progress noise)"]
        C --> D["2. Smart Target Scoping & AST Scraper<br/>(Cocokkan kata kunci -> Pin target file)"]
        D --> E["3. Minified Shield & Secret Redaction<br/>(Cegah bom token .min.js & sensor API keys)"]
        E --> F["4. Delta Prompting & Topic Anchoring<br/>(Kunci topik obrolan & pangkas tree map duplikat)"]
    end
    
    F --> G["Final SuperPrompt"]
    G -->|HANYA 1X PANGGILAN API (Auto-Allow)| H["Google Antigravity Engine ('agy')"]
    H --> I["Kode Ditulis / Diperbaiki"]
    
    subgraph PostExecution ["Pasca-Eksekusi (Lokal Safety Guard)"]
        I --> J["5. Syntax Sanity Guard<br/>(node --check / python compile)"]
        J --> K{"Syntax Rusak?"}
        K -->|Ya| L["Peringatkan & Tawarkan 'grav undo'"]
        K -->|Aman| M["Port Guard Auto-Heal & Odometer Sync"]
    end
```

---

<h2 id="panduan-instalasi-lengkap">Panduan Instalasi Lengkap (Step-by-Step Multi-OS)</h2>

Ikuti panduan di bawah ini untuk memasang Graviton di laptop atau device baru Anda:

### Langkah 1: Pasang Node.js (Versi >= 18.0.0)
Graviton membutuhkan runtime Node.js modern dengan dukungan Native ES Modules.

- **Windows:**
  - Buka PowerShell dan jalankan:
    ```powershell
    winget install OpenJS.NodeJS.LTS
    ```
  - Atau unduh installer `.msi` dari situs resmi [nodejs.org](https://nodejs.org).
- **macOS (via Homebrew):**
  ```bash
  brew install node
  ```
- **Linux (Ubuntu/Debian via NodeSource):**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
- **Verifikasi Versi Node.js:**
  ```bash
  node -v
  # Harus menampilkan v18.0.0 atau lebih baru (misal v20.x.x)
  ```

---

### Langkah 2: Pasang Google Antigravity CLI (`agy`)

> [!NOTE]
> **Perbedaan Antigravity Desktop App vs Antigravity CLI:**
> Antigravity Desktop App (`antigravity.exe`) adalah aplikasi GUI Electron. Graviton membutuhkan binary CLI resmi Google Antigravity bernama **`agy`**.

- **Windows:**
  Buka PowerShell (Run as Administrator jika perlu) dan jalankan:
  ```powershell
  irm https://antigravity.google/cli/install.ps1 | iex
  ```
  *Atau via Command Prompt (CMD):*
  ```cmd
  curl -fsSL https://antigravity.google/cli/install.cmd -o install.cmd && install.cmd && del install.cmd
  ```
- **macOS & Linux:**
  ```bash
  curl -fsSL https://antigravity.google/cli/install.sh | bash
  ```
- **Verifikasi Instalasi Antigravity CLI:**
  ```bash
  agy --version
  ```
- *(Opsional)* Jika `agy` terpasang di direktori khusus yang belum masuk ke `PATH`, Anda bisa mengatur environment variable:
  ```powershell
  # Windows PowerShell
  [System.Environment]::SetEnvironmentVariable('AGY_PATH', 'C:\Path\To\agy.exe', 'User')
  ```

---

### Langkah 3: Pasang Git (Opsional namun Direkomendasikan)
- **Windows:** `winget install Git.Git` atau unduh dari [git-scm.com](https://git-scm.com).
- **macOS:** `xcode-select --install` atau `brew install git`.
- **Linux:** `sudo apt install git`.

---

### Langkah 4: Pasang Graviton di Komputer Anda

Pilih salah satu dari 2 metode di bawah ini:

#### Metode A: Clone dari Repository GitHub (Direkomendasikan)
```bash
# 1. Clone repository
git clone https://github.com/alatariz/graviton.git

# 2. Masuk ke folder proyek
cd graviton

# 3. Hubungkan binary secara global ke sistem
npm link
```

#### Metode B: Install Global via npm
```bash
npm install -g github:alatariz/graviton
```

#### Verifikasi Pemasangan Binary Ganda:
Kini Anda memiliki 2 perintah global yang siap dipakai:
```bash
graviton --version
# atau shorthand cepat:
grav --version
# Output: GRAVITON v2.0.0 (Graviton V2.0.0 Intelligent Context Engine)
```

---

### Langkah 5: Jalankan Diagnosa Otomatis (`grav doctor`)
Untuk memastikan komputer baru Anda 100% siap menjalankan Graviton, jalankan:
```bash
grav doctor
```
Jika ada komponen yang belum terkonfigurasi, jalankan:
```bash
grav doctor --fix
```

Contoh output diagnosa:
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

<h2 id="fitur-utama-dan-penggunaan">Fitur Utama & Panduan Penggunaan Lengkap</h2>

### 1. Smart Target Scoping & Eksekusi Bebas Tanda Petik
Anda tidak perlu lagi mengetik tanda petik luar yang merepotkan di terminal Windows:
```bash
# Langsung ketik instruksi Anda
grav Perbaiki validasi email dan status code di src/auth.js

# Mode perencanaan arsitektur berdaya tinggi (effort: high, plan mode)
grav --deep Rancang arsitektur microservices untuk payment gateway
```
Graviton akan:
1. Memindai kata kunci file dalam prompt.
2. Membaca dependensi lokal 1 level.
3. Menyematkan *Target Scope* agar Antigravity langsung membuka file tersebut tanpa membuang waktu dan token untuk mencari file.

---

### 2. Antigravity IDE-Style Conversation History (`--c` & `--n`)
Graviton V2.0.0 mengelola sesi obrolan persis seperti antarmuka Antigravity IDE:

#### A. Melihat Riwayat & Memilih Obrolan Interaktif (`grav --c`)
```bash
grav --c
```
Tampilan terminal:
```text
=== GRAVITON CONVERSATIONS (Antigravity IDE History) ===
Workspace: C:\my-project

  [1] ● [Aktif] "Perbaiki validasi email di auth.js"
      ID: dc290864... | 4 turns | ~12.5k tokens | 5m lalu
  [2] ○ "Setup Express server di index.js"
      ID: e82b109a... | 1 turn | ~3.2k tokens | 2j lalu

PILIHAN AKSI:
  <nomor>      Pilih & lanjutkan percakapan (contoh: 1)
  d <nomor>    Hapus percakapan dari riwayat (contoh: d 2)
  n            Mulai percakapan baru (fresh chat)
  q            Batal / Keluar
```

#### B. Shorthand Cepat Melanjutkan Percakapan:
```bash
# Lanjutkan percakapan #1 di mode interactive REPL
grav --c 1

# Langsung kirim instruksi ke percakapan #1
grav --c 1 "tambahkan tes unit dengan jest"

# Hapus percakapan #2 dari riwayat
grav --c del 2
```

#### C. Mulai Chat Baru Secara Eksplisit (`--n`):
```bash
# Mulai chat baru tanpa membawa riwayat sesi sebelumnya
grav -n "buatkan komponen navbar responsive"
```

---

### 3. Interactive REPL Chat Shell (`grav chat`)
Masuk ke sesi obrolan interaktif yang nyaman:
```bash
grav chat
```
Header prompt secara dinamis menampilkan topik yang sedang aktif:
```text
graviton [Perbaiki validasi email]> 
```

#### Perintah Khusus di Dalam REPL (Slash Commands):
| Perintah | Deskripsi |
| :--- | :--- |
| `/c` | Menampilkan daftar riwayat percakapan di workspace |
| `/c <no>` | Beralih topik percakapan secara instan (misal `/c 2`) |
| `/n` atau `--n` | Mereset sesi untuk membuat obrolan baru |
| `/del <no>` | Menghapus percakapan dari riwayat |
| `/rename <judul>` | Mengubah judul topik percakapan aktif |
| `/undo` | Membatalkan perubahan kode terakhir (Rollback) |
| `/diff` | Melihat perbedaan baris kode berwarna yang baru saja diedit AI |
| `/compact` | Meringkas konteks sesi panjang agar hemat token |
| `/ports` | Cek port dev yang sedang aktif (3000, 5173, dll) |
| `/stop [port]` | Matikan server background atau bebaskan port |
| `/status` | Cek turns dan token aktif |
| `/doctor` | Cek kesehatan sistem |
| `/exit` | Keluar dari REPL |

---

### 4. Syntax Sanity Guard (Pengecekan Error Sintaksis Otomatis)
Setelah Antigravity selesai menulis kode, Graviton secara otomatis menjalankan compiler check lokal:
- File `.js`, `.mjs`, `.cjs` divalidasi dengan `node --check`.
- File `.json` divalidasi strukturnya.
- File `.py` divalidasi dengan `python -m py_compile`.

Jika AI membuat typo syntax, Graviton langsung menampilkan peringatan merah sebelum kode tersebut sempat merusak aplikasi Anda:
```text
[🚨 GRAVITON SANITY ALERT] 1 broken syntax file(s) detected!
  ✖ src/routes/user.js: Unexpected token '}' (line 42)
💡 Rekomendasi: Jalankan 'grav undo' untuk membatalkan perubahan.
```

---

### 5. Instant Safety Rollback Guard & Diff Viewer
Graviton membuat shadow backup otomatis di `~/.graviton/backups/` sebelum file diedit.
```bash
# Tinjau perubahan kode baris demi baris:
grav diff

# Batalkan perubahan dan kembalikan ke kondisi sebelum sesi AI:
grav undo
```

---

### 6. Port Guard & Silent Background Daemons
Jalankan dev server tanpa membuat terminal macet dan tanpa jendela CMD pop-up:
```bash
# Jalankan server sebagai background daemon:
grav start "npm run dev"

# Cek port dev yang aktif:
grav ports

# Bebaskan port tertentu yang macet:
grav stop 3000
# atau matikan semua daemon:
grav stop all
```

---

### 7. Terminal Log Pruner (Piped Ingestion)
Pangkas log terminal raksasa sebelum dikirim ke AI:
```bash
# Pangkas error test Jest/Vitest:
npm test 2>&1 | grav "perbaiki error test ini"

# Pangkas error compiler Cargo / Go:
cargo build 2>&1 | grav "perbaiki compile error ini"

# Analisis Git status secara instan:
git status | grav "buatkan commit message conventional"
```

---

### 8. Lifetime Telemetry Dashboard
Lihat statistik token yang berhasil Anda hemat:
```bash
grav stats
```

---

<h2 id="referensi-perintah-cli">Tabel Referensi Lengkap Perintah CLI</h2>

| Perintah Lengkap | Alias Shorthand | Fungsi / Kegunaan |
| :--- | :--- | :--- |
| `graviton "<prompt>"` | `grav "<prompt>"` | [DEFAULT] Eksekusi instruksi AI dengan Smart Target Pinning & Auto-Allow (chat baru otomatis) |
| `graviton --c` | `grav --c` | Buka riwayat percakapan (Antigravity IDE History), pilih topik, atau hapus |
| `graviton --c <no>` | `grav --c <no>` | Lanjutkan topik percakapan nomor tertentu di interactive chat |
| `graviton --c <no> "<prompt>"` | `grav --c <no> "..."`| Jalankan instruksi langsung pada percakapan nomor tertentu |
| `graviton --c del <no>` | `grav --c del <no>` | Hapus topik percakapan dari riwayat workspace |
| `graviton -n "<prompt>"` | `grav -n "<prompt>"` | Mulai obrolan baru secara eksplisit di workspace ini (reset konteks) |
| `graviton chat` | `grav chat` | Masuk ke mode interactive REPL chat shell |
| `graviton doctor [--fix]` | `grav doctor [--fix]`| Diagnosa kesehatan runtime Node.js, binary `agy`, Git, Python, dan path sistem |
| `graviton diff` | `grav diff` | Tinjau perbedaan kode (diff line-by-line) hasil modifikasi AI |
| `graviton undo` | `grav undo` | Safety Rollback: pulihkan file yang diubah dan hapus file baru yang dibuat AI |
| `graviton compact` | `grav compact` | Ringkas sesi panjang untuk me-refresh context window & menghemat token |
| `graviton start <cmd>` | `grav start <cmd>` | Jalankan server dev sebagai daemon background tanpa macet |
| `graviton stop [port]` | `grav stop [port]` | Hentikan daemon background atau bebaskan port (misal 3000, 5173) |
| `graviton ports` | `grav ports` | Scan port dev yang sedang aktif |
| `graviton stats` | `grav stats` | Tampilkan dashboard penghematan token kumulatif |
| `graviton map` | `grav map` | Tampilkan struktur folder workspace terindeks |
| `graviton clean "<prompt>"` | `grav clean "<prompt>"` | Hanya rapikan prompt dan salin ke clipboard (tanpa panggil AI) |
| `graviton version` | `grav -v` | Tampilkan versi Graviton CLI |

---

<h2 id="benchmark-efisiensi-token">Empirical Benchmarks: Uji Efisiensi Token Nyata</h2>

Pengukuran riil penghematan token di berbagai skenario kerja harian:

| Skenario Penggunaan | Tanpa Graviton (Raw Output) | Dengan Graviton V2.0.0 | Efisiensi Token | Efisiensi Waktu (Latensi) |
| :--- | :--- | :--- | :--- | :--- |
| **Error Log Terminal** (`pytest` / `jest` 2.000 baris) | ~28.000 tokens | ~1.400 tokens | **Hemat -95.0%** | `< 1 ms lokal` |
| **Mencari File Target** (*"Fix login bug"*) | 5.000–12.000 tokens (3-4x tool calls `list_dir`/`grep`) | 0 tokens (Smart Target Pinning instan) | **Hemat 100% search calls** | **Turun dari 30s ke 3s** |
| **Konteks Obrolan Berulang** (Multi-turn chat) | 3.000–5.000 tokens (tree map dikirim ulang) | ~500 tokens (Delta Prompting aktif) | **Hemat -80% per turn** | Instant |
| **File Minified Terpapar** (`bundle.min.js`) | 35.000 tokens (bom konteks) | 12 tokens (The Minified Shield) | **Hemat -99.9%** | Instant |
| **Total Sesi Development Rata-rata** | **~150.000 tokens** | **~18.000 tokens** | **Hemat Rata-rata 88%** | **Performa 10x lebih gesit** |

---

<h2 id="troubleshooting--faq">Troubleshooting & FAQ (Solusi Masalah di Device Lain)</h2>

### Q1: Muncul error `Google Antigravity CLI (agy) belum terpasang di laptop ini!`
**Penyebab:** Anda baru memasang Antigravity Desktop App (GUI), tetapi binary CLI resmi `agy` belum terpasang di sistem PATH.
**Solusi:**
Buka PowerShell dan jalankan perintah instalasi resmi:
```powershell
irm https://antigravity.google/cli/install.ps1 | iex
```
Tutup dan buka kembali PowerShell, lalu ketik `agy --version`. Jika sudah muncul versinya, jalankan kembali `grav doctor`.

---

### Q2: Perintah `grav` atau `graviton` tidak dikenali setelah `npm link`
**Penyebab:** Direktori global npm belum masuk ke variable `PATH` lingkungan Windows.
**Solusi:**
1. Pastikan folder npm prefix terdaftar di PATH:
   ```powershell
   npm config get prefix
   # Biasanya: C:\Users\<NamaUser>\AppData\Roaming\npm
   ```
2. Pastikan path tersebut sudah ada di System/User Environment Variables `PATH`.
3. Buka terminal baru setelah memperbarui PATH.

---

### Q3: Apakah Graviton aman digunakan pada proyek privat / rahasia?
**Sangat Aman.**
1. **100% Offline Lokal:** Graviton tidak memiliki server backend, tidak mengirim data analitik ke luar, dan tidak memanggil API pihak ketiga.
2. **Zero Dependencies:** Berjalan murni di atas runtime standar Node.js V8 stdlib.
3. **Secret Redaction:** Token otentikasi (JWT, Bearer, AWS keys) secara otomatis disensor menjadi `[[REDACTED]]`.
4. **Git Safe:** Shadow backup disimpan di direktori `~/.graviton/backups/`, tidak akan pernah mengotori branch Git Anda.

---

<h2 id="license">Lisensi</h2>

Didistribusikan di bawah lisensi resmi **Apache-2.0 License**. Lihat file [LICENSE](LICENSE) untuk informasi lebih lanjut.

&copy; 2026 **[@alatariz](https://github.com/alatariz)** &bull; Dibuat dengan presisi tinggi untuk ekosistem pengembang Google Antigravity.
