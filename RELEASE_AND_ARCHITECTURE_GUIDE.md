# R0 IDE: Architecture, Release Workflow & Troubleshooting Guide

This guide provides a comprehensive reference for the architecture of **R0 IDE**, its terminal subsystem and error highlighting, the end-to-end release lifecycle (version bumping, commit rules, tagging, CI gating, and in-app updates), and common troubleshooting steps.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             R0 Desktop Frontend                             │
│       React 18 + TypeScript + Vite + Zustand Stores + xterm.js UI          │
│                                                                             │
│  • src/features/terminal/    (Terminal Container, Tabs, Shell Stores)       │
│  • src/features/settings/    (Terminal & App Preferences, In-App Updater)   │
│  • src/bindings/             (Auto-generated TypeScript IPC from Specta)    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Tauri IPC Commands & Events
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                            Tauri Rust Core Backend                          │
│                                                                             │
│  • src-tauri/src/main.rs     (App startup, plugins: updater, store, etc.)   │
│  • src-tauri/src/terminal.rs (Exposes list_shells, open, write, resize)    │
│  • crates/terminal/          (Portable PTY, Windows/Linux/macOS shells)     │
│  • crates/project/           (Workspace file tree & file watcher)           │
│  • crates/ai/                (Claude/OpenAI/Codex ACP integration)          │
│  • crates/lsp/               (Language Server Protocol manager)             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Spawns & Streams
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                             Host System Shells                              │
│                                                                             │
│  Windows:  Windows PowerShell (`powershell.exe`), PowerShell 7 (`pwsh.exe`) │
│            Command Prompt (`cmd.exe`), Git Bash (`bash.exe`), WSL           │
│  Linux:    `/bin/bash`, `/bin/zsh`, `/bin/fish`, Nushell                    │
│  macOS:    `/bin/zsh`, `/bin/bash`                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Terminal Subsystem & Error Highlighting

### Why Command Prompt vs. PowerShell behaves differently

- **Command Prompt (`cmd.exe`)**: An MS-DOS legacy shell that writes unformatted raw text to stdout/stderr. It does not emit ANSI color escape sequences when a command fails (e.g. `'foo' is not recognized as an internal or external command...`).
- **Windows PowerShell (`powershell.exe`) & PowerShell Core (`pwsh.exe`)**: Modern command line environments powered by PSReadLine and PowerShell formatting engines. When an error occurs, PowerShell formats exception records using **red ANSI escape codes** (`\x1b[91m...`), identical to VS Code's terminal output.

### Shell Discovery and Priority

In [`crates/terminal/src/shell.rs`](file:///c:/Users/adars/OneDrive/Desktop/r-0/r0/crates/terminal/src/shell.rs), shells are registered via `Shell::get_shell_list()`:

```rust
if cfg!(windows) {
    let mut shells = vec![
        Shell {
            id: "powershell".into(),
            name: "Windows PowerShell".into(),
            exec_win: shell_exe_in_path("powershell.exe"),
            exec_unix: None,
            kind: Some("windows".into()),
            wsl_distribution: None,
        },
        Shell {
            id: "pwsh".into(),
            name: "PowerShell Core".into(),
            exec_win: shell_exe_in_path("pwsh.exe"),
            exec_unix: None,
            kind: Some("windows".into()),
            wsl_distribution: None,
        },
        Shell {
            id: "cmd".into(),
            name: "Command Prompt".into(),
            exec_win: shell_exe_in_path("cmd.exe"),
            exec_unix: None,
            kind: Some("windows".into()),
            wsl_distribution: None,
        },
        // nu, wsl, git bash...
    ];
}
```

**Key Takeaways:**

1. Keeping `powershell` and `pwsh` ahead of `cmd` ensures new default terminal tabs automatically start with PowerShell and display red error highlighting.
2. In R0 Settings -> Terminal Settings, users can configure their default shell profile or switch between installed shells at any time.

---

## 3. End-to-End Release Lifecycle

### Step 1: Version Bumping

A version bump must be synchronized across **4 files**:

1. [`package.json`](file:///c:/Users/adars/OneDrive/Desktop/r-0/r0/package.json) (`"version": "0.18.1"`)
2. [`src-tauri/tauri.conf.json`](file:///c:/Users/adars/OneDrive/Desktop/r-0/r0/src-tauri/tauri.conf.json) (`"version": "0.18.1"`)
3. [`src-tauri/Cargo.toml`](file:///c:/Users/adars/OneDrive/Desktop/r-0/r0/src-tauri/Cargo.toml) (`version = "0.18.1"`)
4. [`Cargo.lock`](file:///c:/Users/adars/OneDrive/Desktop/r-0/r0/Cargo.lock) (synchronized via `cargo check`)

You can run the built-in release bump script:

```bash
bun scripts/release/bump-version.ts <new-version>
# Example:
bun scripts/release/bump-version.ts 0.18.2
cargo check
```

---

### Step 2: Commitlint Rules (Strict!)

The repository enforces strict commit validation using `.vite-hooks/commit-msg` and `commitlint.config.cjs`.

#### The 3 Rules:

1. **Sentence Case Header**: The header MUST start with an uppercase letter and MUST NOT use conventional commit prefixes like `feat:`, `fix:`, or `fix(terminal):`.
   - ❌ Wrong: `fix(terminal): update default shell`
   - ❌ Wrong: `fix: update default shell`
   - ❌ Wrong: `update default shell`
   - ✅ Correct: `Prioritize PowerShell on Windows and unblock CI audit`
2. **Mandatory Non-Empty Body**: A commit must have at least one descriptive body paragraph.
3. **Line Length Limit**: No line in the body can exceed 100 characters.

#### How to commit correctly via CLI:

```bash
git add .
git commit -m "Add new terminal color theme and settings option" -m "Introduce customizable error and syntax highlighting themes for the terminal emulator."
```

---

### Step 3: Push to `main`

Always push your changes to `origin/main` first so that GitHub Actions triggers CI:

```bash
git push origin main
```

---

### Step 4: Tagging the Release

The release tag must match the semantic version pattern `^v[0-9]+\.[0-9]+\.[0-9]+(-beta\.[1-9][0-9]*)?$`.

```bash
# Create or update tag:
git tag -f v0.18.1

# Push tag to GitHub:
git push -f origin v0.18.1
```

---

### Step 5: How CI Gating & Release Workflows Run

When the tag is pushed, `.github/workflows/release.yml` triggers the release pipeline:

```
[Tag Push: v0.18.1]
        │
        ▼
   verify-ci (Job)
        │
        ├─► Validates tag regex: ^v[0-9]+\.[0-9]+\.[0-9]+...
        ├─► Verifies: git rev-parse "refs/tags/v0.18.1" == GITHUB_SHA
        └─► Runs: bun scripts/release/ci-gate.ts "$tag_sha"
                 │
                 ▼
        Waits for CI (ci.yml) to complete on that commit:
        • Bun — typecheck, frontend check (Required)
        • Rust — fmt, check, clippy, test (Required)
        • Audit — cargo audit, bun audit
                 │
        ┌────────┴────────┐
        │                 │
     CI Fails          CI Passes
        │                 │
  Release Aborted         ▼
                 release-metadata (Job)
                 • Generates release notes
                          │
                          ▼
                 Parallel Build Matrix:
                 • Build Windows (x64, arm64: .exe, .msi)
                 • Build Linux (x64, arm64: .AppImage, .deb, .rpm)
                 • Build macOS (x64, aarch64: .dmg)
                          │
                          ▼
                 Upload Release Assets
                 • Binaries + .sig signatures
                 • SHA256SUMS.txt
                 • latest.json (for Tauri In-App Updater)
```

---

### Step 6: Publishing Draft Releases

By default, the workflow produces a **draft release** on GitHub so the maintainer can review assets.
To make it public immediately from your terminal:

```bash
gh release edit v0.18.1 --draft=false
```

_(Or set GitHub Repository Variable `AUTO_PUBLISH_RELEASE=true` in GitHub repo settings to publish automatically)._

---

### Step 7: In-App Updates in R0 IDE

In [`src-tauri/tauri.conf.json`](file:///c:/Users/adars/OneDrive/Desktop/r-0/r0/src-tauri/tauri.conf.json):

```json
"updater": {
  "active": true,
  "endpoints": ["https://github.com/Adshkumar/r0/releases/latest/download/latest.json"],
  "dialog": false,
  "pubkey": "..."
}
```

When a user in R0 IDE clicks **"Check for updates"** (in Settings):

1. `tauri-plugin-updater` downloads `latest.json` from the latest GitHub release.
2. If `latest.json.version` is higher than the currently running app version, R0 displays the update banner/dialog.
3. The user clicks **"Update Now"**, and R0 downloads the signed installer for their OS, applies the update, and restarts.

---

## 4. Troubleshooting Guide

| Issue                                                                             | Cause                                                                               | Solution                                                                                                                                    |
| :-------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| **Commitlint: `header must be sentence-case without a conventional type prefix`** | Header starts with `fix:` or `feat:`.                                               | Use plain sentence case like `Fix terminal error highlighting` with a second `-m` body.                                                     |
| **Commitlint: `body's lines must not be longer than 100 characters`**             | Long unbroken string or URL in commit message body.                                 | Wrap lines in the commit message body to < 100 chars.                                                                                       |
| **`Release blocked: CI failure for <sha>`**                                       | An audit or check job failed on the release commit.                                 | Check `gh run view <run_id> --log-failed`. For advisory npm audit warnings, ensure `continue-on-error: true` is on `bun audit` in `ci.yml`. |
| **`test "$tag_sha" = "$GITHUB_SHA"` fails in release**                            | The tag was pointed to an older commit instead of the current HEAD.                 | Run `git tag -f vX.Y.Z` on the latest commit and `git push -f origin vX.Y.Z`.                                                               |
| **Terminal error output has no red color**                                        | The active shell is `cmd.exe` (Command Prompt).                                     | Switch shell to PowerShell (`powershell.exe` or `pwsh.exe`) in Settings or open a new PowerShell tab.                                       |
| **E2E test times out on Windows during submenu hover**                            | Hovering mouse over native flyout menus is timing-sensitive on headless CI runners. | Use keyboard navigation (e.g. `sendKeys("\uE014")` - right arrow) as implemented in `e2e/support/app.ts`.                                   |

---

## 5. Automated Agent Execution Checklist (For AI Agents / CLI)

When an AI agent (or automated pipeline) is asked to **"release and tag a new version"**, it should execute the following exact commands in sequence:

### Agent Step-by-Step Protocol:

```bash
# 1. Ensure working directory is clean
git status

# 2. Bump version across all 4 files (e.g. to 0.18.2)
bun scripts/release/bump-version.ts 0.18.2

# 3. Synchronize Cargo.lock
cargo check

# 4. Stage all changes
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml Cargo.lock

# 5. Commit with strict commitlint compliance (Sentence-case, NO "fix:" prefix, non-empty body)
git commit -m "Prepare release v0.18.2" -m "Update version files across package.json, tauri.conf.json, and Cargo.toml."

# 6. Push to origin main
git push origin main

# 7. Create and push the release tag matching ^v[0-9]+\.[0-9]+\.[0-9]+...
git tag -f v0.18.2
git push -f origin v0.18.2

# 8. Monitor the Release and CI workflows
gh run list -L 3

# 9. Once GitHub Actions finishes building, publish the draft release live:
gh release edit v0.18.2 --draft=false

# 10. Verify release and in-app updater assets:
gh release view v0.18.2
```

### Absolute Constraints for Agents:

- **NEVER** use conventional commit prefixes (`feat:`, `fix:`, `chore:`, etc.) in commit headers. Always use sentence-case (e.g. `Prepare release v0.18.2`).
- **NEVER** create a commit without a `-m "..."` body paragraph.
- **NEVER** push a tag before pushing the commit to `main`, because `release.yml`'s `verify-ci` step queries CI runs on `main` for that exact commit SHA.
- **NEVER** leave the release in draft status if you want users' IDEs to find it immediately via **"Check for updates"**. Always execute `gh release edit <tag> --draft=false`.
