# r0 Feature Gap Analysis

This audit compares the current r0 implementation with relevant VS Code IDE
capabilities. It describes the code that exists, not feature claims inferred
from the README. VS Code's extension ecosystem and breadth are reference points,
not a requirement to reproduce its architecture.

## Classification

| Area | Status | Evidence and gap |
| --- | --- | --- |
| Editor and language support | Partial | CodeMirror 6 has syntax support for JavaScript/TypeScript, Python, Rust, JSON, HTML, CSS, and Markdown, plus search, tabs, AI diffs, keybindings, and LSP integration. It is not a Monaco/VS Code extension host. Rich language services depend on external language-server binaries. |
| LSP and diagnostics | Partial; workspace isolation broken | LSP transport, completion, diagnostics, lint gutter, and definition navigation are wired through Rust-spawned TypeScript, Rust, and Python servers. The frontend creates clients per language and workspace, but backend processes and notification channels are keyed only by language. Requests from a second workspace can therefore use the first workspace's root. Rename, references, code actions, formatting, signature help, and broader language-server coverage are absent or incomplete. |
| Debugging | Partial | A real DAP transport and UI exist for CodeLLDB and debugpy, including launch, breakpoints, stepping, stack, scopes, variables, and output. Users must install adapters separately. The backend responds with `null` to adapter-to-client requests, so adapters that require client capabilities such as `runInTerminal` may not work. |
| AI providers and agent | Present; partial | Multiple cloud and local provider integrations, streaming, tool-use, plan/ask/agent workflows, session history, and reviewable edits are present. Sensitive writes, edits, and shell execution use approvals. API keys are stored in the OS keychain. Tool/path policy is not uniformly applied to every AI read/search/edit path; harden before expanding agent authority. |
| Filesystem and workspace | Partial | Local folder open, file operations, lazy tree, tabs, bounded file/text/symbol search, and workspace restoration are present. The product is single-root; multi-root workspaces, per-workspace settings, recent-project management, tasks, and a Problems panel are missing or incomplete. |
| Navigation and command palette | Partial | File/text search, command actions, global keybindings, and LSP definition navigation are available. Workspace-wide symbol navigation, references, rename, outline, breadcrumbs, and diagnostic navigation are not at VS Code-level completeness. |
| Git and diffs | Partial; history and revision diffs implemented | The Source Control panel now loads bounded, paginated commit history across local/remote refs, draws parent-linked commit lanes, groups commits by local author date, and opens commit details. Details include metadata, refs, parent selection for merge commits, changed files, and numstat. Selecting a historical or working-tree file opens a read-only side-by-side CodeMirror diff loaded from the selected Git revisions. Granular staging, arbitrary two-commit comparison, and checkout/create-branch actions are still missing; commit continues to stage all changes. |
| Terminal and run/test tools | Present; partial | xterm.js and `portable-pty` provide real local terminal sessions, tabs, resizing, and close behavior. Configurable run/tasks, test discovery/execution, split terminals, process exit reporting, and language-aware formatter/linter workflows are not established. |
| Settings, themes, persistence | Present; partial | Built-in and imported themes, keychain secrets, app settings, SQLite AI sessions, and restored UI/workspace state are present. State is split between the Tauri store, SQLite, and browser storage; profiles and synchronized settings are not provided. |
| Extensions and remote work | Missing | The Extensions sidebar is a placeholder. There is no extension host, compatibility contract, or SSH/dev-container workspace implementation. Third-party extensions and remote execution require explicit security design and isolation. |
| Application security and permissions | Partial | Tauri capabilities and OS keychain are used. The Tauri CSP is unset (`null`); review it with embedded-webview behavior. Filesystem access and AI tool path checks are not uniformly canonicalized/enforced, including symlink considerations. Do not claim Marketplace compatibility or a hardened extension sandbox. |
| CI and Windows release | Present; partial | CI runs frontend lint, typecheck, and tests. Rust CI checks/tests are configured `continue-on-error`. Windows NSIS/MSI packaging, updater artifacts, and installer workflow exist and should be preserved. |

## Recommended order

1. Fix and test LSP process/client isolation per workspace before adding more
   protocol capabilities.
2. Expand LSP capabilities and supported language servers; add reliable
   Problems navigation and code actions.
3. Improve workspace navigation, settings, and Git diff/staging workflows.
4. Complete one real debugger workflow and adapter/client requests before
   claiming broader DAP support.
5. Add tasks, run configurations, and test discovery with real subprocess
   results.
6. Apply consistent AI/filesystem trust-boundary checks and improve the
   approval/cancellation/review workflow.
7. Design remote work and a permissioned extension API as isolated projects.
   Neither should be enabled by an unsafe local-process or plugin shortcut.
8. Make Rust CI blocking after its external path dependency is resolved, and
   retain Windows NSIS/MSI/updater validation.

   ## Git history implementation slice

   Completed on the feature branch:

   - Added async Tauri commands for bounded history pages, commit details, and
     revision-backed file contents. Git arguments are passed separately, commit
     IDs and repository-relative paths are validated, and working-tree reads are
     confined to the selected repository.
   - Extended the existing Source Control panel with commit graph lanes, branch
     and tag decorations, local-time date groups, refresh, and load-older paging.
   - Added commit-detail and Git-diff tabs. Merge commits default to their first
     parent and allow selecting another parent. Added, deleted, renamed, root,
     binary, and non-UTF-8 file cases are represented or reported explicitly.
   - Made working-tree change paths open HEAD-versus-working-tree diffs, including
     untracked, deleted, and renamed paths.

   The graph is currently bounded to 100 commits per request. Date filtering
   applies to loaded commits, so older dates require loading older pages first.
   Checkout, branch creation, and comparison between arbitrary commit pairs are
   not yet implemented.

## Baseline checks

On the feature branch, before implementation:

- `npm test`: passed, 79 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with three existing warnings.
- `npm run build:frontend`: passed with existing dependency-comment and bundle
  size warnings.
- `cargo test --manifest-path src-tauri\\Cargo.toml`: passed, 29 tests.
- `cargo fmt --manifest-path src-tauri\\Cargo.toml --all -- --check`: failed
  because existing Rust files are not rustfmt-clean.

No full Tauri/installer build was run as part of this baseline.

The initial checkout was version 0.1.11. The feature branch was subsequently
fast-forwarded to `origin/main` at v0.1.12 (a release/version-only commit)
before final validation; no dependency or feature changes were introduced by
that update.
