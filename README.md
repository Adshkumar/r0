<div align="center">

<img src="media/wordmark.svg" width="320" alt="r0" />

### A desktop IDE for AI-assisted software development

r0 brings a code editor, AI coding tools, source control, and an integrated terminal together in a Rust-powered desktop application.

[![Latest release](https://img.shields.io/github/v/release/Adshkumar/r0?label=release)](https://github.com/Adshkumar/r0/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/Adshkumar/r0/total)](https://github.com/Adshkumar/r0/releases)
[![CI](https://github.com/Adshkumar/r0/actions/workflows/ci.yml/badge.svg)](https://github.com/Adshkumar/r0/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Adshkumar/r0)](LICENSE)

[Install for Windows](#installation) · [Features](#features) · [Build from source](#build-from-source)

</div>

---

## Contents

- [About](#about)
- [Features](#features)
- [Screenshots](#screenshots)
- [Installation](#installation)
- [Quick start](#quick-start)
- [AI providers](#ai-providers)
- [Technology stack](#technology-stack)
- [Project structure](#project-structure)
- [Development and testing](#development-and-testing)
- [Roadmap and release status](#roadmap-and-release-status)
- [Contributing](#contributing)
- [License and acknowledgments](#license-and-acknowledgments)
- [Links](#links)

## About

r0 is an open-source desktop IDE for developers who want AI assistance alongside their regular editing workflow. The AI can answer questions about a workspace, inspect files, propose a plan, and help make code changes from the editor.

The app is built with Tauri 2, React, TypeScript, and Rust. AI access is configured by the user: connect a supported provider in Settings, or use a compatible local inference service. AI requests are sent to the selected provider; API keys for cloud providers are stored using the operating system's credential store.

This README describes features present in the source and the latest published release. Features still being developed locally are not represented as available release functionality.

## Features

### Editor and workspace

- CodeMirror 6 editor with syntax support for JavaScript, TypeScript, JSX/TSX, Rust, Python, CSS, SCSS/Sass, HTML, JSON, Markdown, YAML, TOML, SQL, shell scripts, and PowerShell.
- Editor tabs, dirty-file indicators, find and replace, formatting, diagnostics, and configurable themes.
- File explorer, workspace search, command palette, recent projects, and multi-file context for AI conversations.
- Image previews and a local HTML preview panel.

### AI assistance

- **Ask** for codebase questions, **Plan** to explore and propose a structured approach, and **Agent** for multi-step coding tasks.
- Built-in tools for reading and searching workspace files; file writes, edits, and shell commands require user approval.
- AI-powered inline completion can be enabled and configured in Settings.
- Select a provider and model in the AI panel. See [AI providers](#ai-providers) for the supported integrations.

### Terminal and source control

- Integrated terminal powered by xterm.js and Rust `portable-pty`, with multiple terminal tabs.
- Git status, commit and push actions, branch operations, commit history, and historical file diffs.

### Themes and extensions

- Includes Dark Modern, Dark+, Light Modern, Light+, Dracula, GitHub Dark, One Dark Pro, and high-contrast dark and light themes. Editor, UI, and terminal typography can be configured separately in Appearance settings.
- The Extensions panel searches Open VSX, installs extensions, and supports contributed themes. This is not a general-purpose VS Code extension host; extension features outside the supported theme workflow may not work.

## Screenshots

<p align="center">
  <img src="media/r0-1-ss.png" alt="r0 welcome screen and AI panel" width="900" />
</p>

<details>
<summary>More screenshots</summary>

<p align="center">
  <img src="media/r0-2-ss.png" alt="r0 code editor and terminal" width="900" />
  <br />
  <em>Editor with syntax highlighting and integrated terminal</em>
</p>

<p align="center">
  <img src="media/r0-3-ss.png" alt="r0 command palette" width="900" />
  <br />
  <em>Command palette and file navigation</em>
</p>
</details>

## Installation

### Windows

The latest published release provides Windows x64 installers:

- [Download the latest NSIS setup installer](https://github.com/Adshkumar/r0/releases/latest/download/r0-latest-setup.exe)
- [View all releases and artifacts](https://github.com/Adshkumar/r0/releases)

An MSI installer is also available in the **Assets** section of the [latest release](https://github.com/Adshkumar/r0/releases/latest). After downloading it, install from PowerShell with:

```powershell
msiexec.exe /i "<path-to-downloaded-msi>"
```

### macOS and Linux

The current GitHub Release workflow publishes Windows installers only. macOS and Linux users can build from source if they have the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for their platform.

## Quick start

1. Install r0 using the Windows installer, or [build it from source](#build-from-source).
2. Open a project folder or create a file.
3. To use AI features, open **Settings → AI Providers**, choose a provider, and configure its API key if required.
4. Choose a model in the AI panel and start with Ask, Plan, or Agent mode.

Cloud model access may require a provider account and may incur charges. Local providers require their inference service to be installed and running on the configured local endpoint.

## AI providers

The current provider list in r0 includes:

| Provider   | Connection                       |
| ---------- | -------------------------------- |
| Anthropic  | Cloud API                        |
| OpenAI     | Cloud API                        |
| Gemini     | Cloud API                        |
| OpenRouter | Cloud API                        |
| DeepSeek   | Cloud API                        |
| Mistral    | Cloud API                        |
| Groq       | Cloud API                        |
| Cohere     | Cloud API                        |
| xAI        | Cloud API                        |
| Ollama     | Local OpenAI-compatible endpoint |
| LM Studio  | Local OpenAI-compatible endpoint |
| vLLM       | OpenAI-compatible endpoint       |

Configure cloud credentials in **Settings → AI Providers**. r0 uses the operating system's credential store for API keys. Ollama, LM Studio, and vLLM connect to their configured local endpoints; select a model supported by that service.

Provider model availability and names can change independently of r0. Refer to each provider's documentation for current model access and pricing.

## Technology stack

| Area                             | Technology                                                       |
| -------------------------------- | ---------------------------------------------------------------- |
| Desktop shell and native backend | Tauri 2, Rust                                                    |
| Frontend                         | React 19, TypeScript, Vite                                       |
| Code editor                      | CodeMirror 6                                                     |
| AI integration                   | Vercel AI SDK with provider SDKs and OpenAI-compatible endpoints |
| Terminal                         | xterm.js, Rust `portable-pty`                                    |
| Persistence                      | Tauri Store, SQLite                                              |
| Credentials                      | Rust `keyring` crate and native OS credential stores             |
| Extensions                       | Open VSX discovery and installation                              |

## Project structure

```text
.
├── media/                 # README logo and screenshots
├── src/
│   ├── components/        # React UI, editor, AI, terminal, and panels
│   ├── context/           # Shared workspace and debug state
│   ├── hooks/             # Frontend state and interaction hooks
│   ├── lib/               # AI, Git, filesystem, terminal, and utilities
│   └── themes/            # Built-in theme definitions and theme handling
├── src-tauri/
│   ├── capabilities/      # Tauri permissions
│   └── src/               # Rust commands and desktop backend
├── docs/                  # Project documentation
├── package.json           # Frontend scripts and dependencies
└── README.md
```

## Build from source

### Prerequisites

- Node.js 20 or newer and npm.
- Rust stable via [rustup](https://rustup.rs/).
- Platform-specific [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). On Windows, install the Microsoft C++ build tools and ensure WebView2 is available.
- Git.

### Run the development app

```sh
git clone https://github.com/Adshkumar/r0.git
cd r0
npm ci
npm run dev
```

`npm run dev` starts the Vite development server and launches the Tauri desktop application.

### Build

```sh
npm run build:frontend  # Type-check and build the frontend assets
npm run build           # Build the Tauri application and platform bundles
```

Tauri bundle outputs are placed under `src-tauri/target/release/bundle/`. Available bundle formats depend on the build host and its installed platform prerequisites.

## Development and testing

Run the repository's available checks from the project root:

```sh
npm run lint
npm run typecheck
npm test
```

Run the Rust backend tests from `src-tauri`:

```sh
cd src-tauri
cargo test
```

The GitHub Actions CI workflow runs frontend linting, type checking, and tests. It also checks and tests the Rust backend; that CI job is currently marked `continue-on-error` in the workflow.

## Roadmap and release status

There is no published, committed feature roadmap. Proposed work and bug reports can be discussed in the [issue tracker](https://github.com/Adshkumar/r0/issues). Check the [releases page](https://github.com/Adshkumar/r0/releases) for shipped versions and platform artifacts.

## Contributing

Bug reports, feature proposals, and pull requests are welcome. Please review [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), then:

1. Open an issue for a bug or a larger proposed change.
2. Create a focused branch and make the change.
3. Run the relevant checks listed in [Development and testing](#development-and-testing).
4. Open a pull request with a clear description and testing notes.

## License and acknowledgments

r0 is distributed under the [Apache License 2.0](LICENSE).

r0 is built with [Tauri](https://tauri.app/), [React](https://react.dev/), [CodeMirror](https://codemirror.net/), [Rust](https://www.rust-lang.org/), [Vercel AI SDK](https://ai-sdk.dev/), and [xterm.js](https://xtermjs.org/). Extension discovery uses [Open VSX](https://open-vsx.org/).

## Links

- [Repository](https://github.com/Adshkumar/r0)
- [Issues](https://github.com/Adshkumar/r0/issues)
- [Releases](https://github.com/Adshkumar/r0/releases)
- [Latest release](https://github.com/Adshkumar/r0/releases/latest)
- [Contributing guide](CONTRIBUTING.md)
- [License](LICENSE)
