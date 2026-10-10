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