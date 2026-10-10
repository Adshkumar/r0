<div align="center">

<img src="media/wordmark.svg" width="340" alt="r0 IDE" />

### A fast, agentic code editor built for AI-first development.

**Bring your own keys. Run everything locally. No telemetry. No lock-in.**

<br/>

[![Version](https://img.shields.io/github/v/release/Adshkumar/r0?style=for-the-badge&color=7c3aed&labelColor=1a1a2e)](https://github.com/Adshkumar/r0/releases)
[![Downloads](https://img.shields.io/github/downloads/Adshkumar/r0/total?style=for-the-badge&color=2ea043&labelColor=1a1a2e)](https://github.com/Adshkumar/r0/releases)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue?style=for-the-badge&labelColor=1a1a2e)](LICENSE)

[![Windows](https://img.shields.io/badge/Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#-installation)
[![Tauri](https://img.shields.io/badge/Tauri_2-24C8DB?style=for-the-badge&logo=tauri&logoColor=white)](https://tauri.app)
[![React](https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev)
[![Rust](https://img.shields.io/badge/Rust-000000?style=for-the-badge&logo=rust&logoColor=white)](https://www.rust-lang.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

<br/>

**[Install](#-installation)** · **[Features](#-features)** · **[Screenshots](#-screenshots)** · **[AI Providers](#-ai-providers)** · **[Build from source](#-building-from-source)** · **[Privacy](#-privacy--security)**

</div>

---

## 📸 Screenshots

<div align="center">
  <img src="media/r0-1-ss.png" alt="r0 IDE — Welcome screen with AI panel" width="100%" />
  <br/>
  <em>Welcome screen with integrated AI panel</em>
</div>

<br/>

<details>
<summary><b>▸ Click to see more screenshots</b></summary>
<br/>

<div align="center">
  <img src="media/r0-2-ss.png" alt="r0 IDE — Code editor" width="100%" />
  <br/>
  <em>Code editor with syntax highlighting and integrated terminal</em>
  <br/><br/>
  <img src="media/r0-3-ss.png" alt="r0 IDE — Command palette" width="100%" />
  <br/>
  <em>Command palette with fuzzy file search</em>
</div>

</details>

---

## 💡 What is r0?

**r0** is a native desktop IDE built on **Tauri 2** and **React**. It merges a full code editor, a real terminal, and a deeply integrated AI panel into one lightweight app.

> **No subscriptions. No telemetry. No cloud lock-in.**
> You bring your API keys; r0 does the rest.

The AI is **not** a sidebar afterthought. It has full agentic capabilities — it can read files, write code, run shell commands, and propose structured multi-step plans, all with **your approval** before anything touches disk.

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 📝 Editor
- **CodeMirror 6** with a fully custom, CSS-variable-driven theme
- Syntax highlighting for **TS, JS, Rust, Python, CSS, HTML, JSON, Markdown**
- Find & replace (`Ctrl+F` / `Ctrl+H`)
- Per-tab cursor memory + dirty indicators
- Inline AI diff view with **Accept / Reject**
- Full menu-bar file operations

### 🤖 AI Panel
- **17+ providers** — Anthropic, OpenAI, Gemini, OpenRouter, DeepSeek, Mistral, Groq, xAI, Cohere, Ollama, LM Studio, vLLM…
- **Bring Your Own Key** — stored in OS keychain
- **Agent mode** — up to 24 tool-use steps per run
  - Auto-execute: `read_file`, `list_directory`, `grep`, `glob`
  - Approval-gated: `write_file`, `edit`, `bash_run`
- **Plan mode** — AI explores with read-only tools, proposes a plan, executes on approval
- **Ask mode** — plain chat, no tools
- SEARCH/REPLACE engine for precise multi-region edits
- `@` file mention & `+` multi-file attach
- SQLite session persistence + crash recovery

</td>
<td width="50%" valign="top">

### 💻 Terminal
- Real PTY via `portable-pty` (Windows ConPTY)
- Multiple tabs, inline rename
- Persistent history across tab switches
- Instant theme sync

### 🏝 Status Island
- Persistent pill in the title bar
- **Current Task** — set / complete / clear
- **What Changed** — live git status
- **Memory** — real-time RAM usage
- **AI Spend** — token cost donut chart

### 🌿 Source Control
- File status (M / A / D / U)
- Commit & Commit + Push
- Git history (up to 100 commits)

### 🔍 Shell & Workspace
- Command palette (`Ctrl+P`)
- Fuzzy search, `@` file mode, `%` full-text
- Lazy-loading file tree + right-click menu
- Settings panel (`Ctrl+,`)
- Multi-window support

</td>
</tr>
</table>

---

## 📥 Installation

### 🪟 Windows — One-line install *(recommended)*

Open **PowerShell** and run:

```powershell
irm https://raw.githubusercontent.com/Adshkumar/r0/main/install.ps1 | iex
```

Downloads the latest release and launches the installer. r0 appears in your Start Menu when it finishes.

### ⚡ Windows — Direct terminal install

Prefer a raw command? These stable URLs always point to the newest release.

**NSIS installer** (setup wizard):

```powershell
$u='https://github.com/Adshkumar/r0/releases/latest/download/r0-latest-setup.exe'
$m="$env:TEMP\r0-setup.exe"
iwr $u -OutFile $m
& $m
```

**MSI installer** (silent, good for scripts):

```powershell
$u='https://github.com/Adshkumar/r0/releases/latest/download/r0-latest.msi'
$m="$env:TEMP\r0.msi"
iwr $u -OutFile $m
msiexec /i $m /qb
```

**Versioned MSI** (pin a specific release):

```powershell
$v="0.1.5"
$u="https://github.com/Adshkumar/r0/releases/download/v$v/r0-$v.msi"
$m="$env:TEMP\r0-$v.msi"
iwr $u -OutFile $m
msiexec /i $m /qb
```

> 💡 `msiexec /i <file>.msi /qb` shows a small progress bar; use `/qn` for fully silent.

### 📦 Windows — Manual download

Grab an installer from the **[latest release →](https://github.com/Adshkumar/r0/releases/latest)**

| Artifact | Description |
|----------|-------------|
| `r0-latest-setup.exe` | **NSIS installer** — stable link, always newest version |
| `r0-latest.msi` | **MSI installer** — stable link, for enterprise / group policy |
| `r0-0.1.5-setup.exe` | Versioned NSIS installer |
| `r0-0.1.5.msi` | Versioned MSI installer |
| `r0_0.1.5_x64-setup.exe` | Tauri-generated NSIS installer |
| `r0_0.1.5_x64_en-US.msi` | Tauri-generated MSI installer |
| `r0.exe` | Portable binary — requires WebView2 (pre-installed on Win 10/11) |

### 🍎 macOS & 🐧 Linux

Prebuilt `.dmg` / `.deb` / `.AppImage` packages are **not yet published**.

👉 In the meantime, please [**build from source**](#-building-from-source).

---

## 🚀 Quick Start

1. **Launch r0**
2. On the welcome screen, click **Configure AI Keys** — or press `Ctrl+,` anytime
3. Add your provider API key (Anthropic, OpenAI, Gemini, Ollama, Groq, …)
4. Open a folder or create a new file
5. Open the **AI panel** and start coding

> **First time?** Try **Ask mode** for a simple chat, then switch to **Agent mode** once you trust it.

---

## 🧠 AI Providers

r0 speaks **OpenAI-compatible SSE**, so any provider that follows that protocol works. Add your key in **Settings** (`Ctrl+,`) → **AI Providers**. Keys are stored in your OS keychain.

| Provider | Type | Notable Models |
|----------|------|----------------|
| **Anthropic** | ☁️ Cloud | Claude 3.5 Sonnet, Claude 3 Opus |
| **OpenAI** | ☁️ Cloud | GPT-4o, GPT-4 Turbo, o1 |
| **Google Gemini** | ☁️ Cloud | Gemini 1.5 Pro, Gemini Flash |
| **OpenRouter** | ☁️ Cloud | 100+ models via unified API |
| **DeepSeek** | ☁️ Cloud | DeepSeek V3, DeepSeek R1 |
| **Mistral** | ☁️ Cloud | Mistral Large, Codestral |
| **Groq** | ☁️ Cloud | Llama 3, Mixtral (fast inference) |
| **xAI** | ☁️ Cloud | Grok-2, Grok Beta |
| **Cohere** | ☁️ Cloud | Command R, Command R+ |
| **Ollama** | 🏠 Local | Any model pulled locally |
| **LM Studio** | 🏠 Local | Any GGUF model |
| **vLLM** | 🏠 Local | Self-hosted inference server |

---

## 🛠 Building from Source

> **Prerequisites:** [Rust](https://rustup.rs) · [Node.js 20+](https://nodejs.org) · [Tauri prerequisites](https://tauri.app/start/prerequisites/)

```bash
git clone https://github.com/Adshkumar/r0.git
cd r0
npm install

npm run tauri dev       # dev mode (hot reload)
npm run tauri build     # production build + installers
```

Installers land in `src-tauri/target/release/bundle/`:

| Platform | Output |
|----------|--------|
| **Windows** | `bundle/msi/*.msi` · `bundle/nsis/*-setup.exe` |
| **macOS** | `bundle/dmg/*.dmg` |
| **Linux** | `bundle/deb/*.deb` · `bundle/appimage/*.AppImage` |

---

## 🧩 Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Shell** | Tauri 2.x | Native app window, IPC, filesystem, OS APIs |
| **Frontend** | React 19 + TypeScript + Vite 7 | UI, editor, terminal, panels |
| **Styling** | Tailwind CSS v4 | All theming via CSS variables |
| **Fonts** | Geist Sans + Geist Mono | Bundled — no network requests |
| **Editor** | CodeMirror 6 | Syntax highlighting, inline diffs |
| **Terminal** | `portable-pty` + xterm.js | Native terminal (ConPTY on Windows) |
| **AI Runtime** | Vercel AI SDK v6 | Streaming, tool calls, agent loop |
| **HTTP Proxy** | Rust `reqwest` | Bypasses WebView2 CORS restrictions |
| **Persistence** | `tauri-plugin-store` + SQLite | Settings, session history, crash recovery |
| **Secrets** | `keyring` crate | OS-native keychain storage |

---

## 🔒 Privacy & Security

- ✅ **No telemetry** — zero data leaves your machine except AI requests *you* trigger
- ✅ **Local AI proxy** — every request routes through Rust, no third-party relay
- ✅ **OS keychain** — API keys stored in macOS Keychain / Windows Credential Manager / Linux Secret Service
- ✅ **Approval-gated tools** — file writes and shell commands require explicit confirmation
- ✅ **Local storage only** — chat history in SQLite at `AppData\Roaming\com.r0ide.ide\`
- ❌ No accounts · ❌ No analytics · ❌ No cloud sync

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) first.

```bash
git checkout -b feature/amazing-idea
# make your changes
git commit -m "feat: amazing idea"
git push origin feature/amazing-idea
# open a Pull Request
```

Found a bug? [Open an issue →](https://github.com/Adshkumar/r0/issues)

---

## 📄 License

Released under the **Apache 2.0 License** — see [LICENSE](LICENSE) for the full text.

---

## ⭐ Star History

<div align="center">

<a href="https://www.star-history.com/?repos=Adshkumar%2Fr0&type=date&legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=Adshkumar/r0&type=date&theme=dark&legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=Adshkumar/r0&type=date&legend=top-left" />
    <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=Adshkumar/r0&type=date&legend=top-left" />
  </picture>
</a>

<br/><br/>

**If r0 is useful to you, please consider ⭐ starring the repo — it really helps!**

</div>
