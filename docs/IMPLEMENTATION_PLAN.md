# r0 Implementation Plan

This plan upgrades r0 in small stages while keeping its React, TypeScript,
Rust, Tauri 2, and CodeMirror 6 architecture. VS Code is a feature and
interaction reference; this plan does not target VS Code Marketplace
compatibility.

## Stages

| Stage | Scope | Status |
| --- | --- | --- |
| 1. Audit and LSP isolation | Record the evidence-based gap analysis; route each LSP workspace to its own backend process and notification channel; add focused regression tests. | Complete |
| 2. Editor correctness and LSP | Add regression coverage and then implement high-value protocol features such as code actions, formatting, references/rename, signature help, and diagnostics navigation. Prioritize available real servers and make unsupported capability explicit. | Planned |
| 3. Navigation, workspace, and Git | Git history slice complete: paginated real commit graph, local-date grouping, commit details, and revision-accurate diffs. Remaining: command/file/symbol search, Problems navigation, recent workspaces, workspace-specific settings, granular staging, arbitrary commit comparison, and eventually multi-root behavior. | Partial |
| 4. Debugging | Verify and complete one real DAP adapter path end to end, including adapter-to-client requests, launch/attach where supported, breakpoints, variables, call stack, and console. Expand only after tests demonstrate support. | Planned |
| 5. Tasks and testing | Add configurable tasks/run profiles, process cancellation and exit reporting, real test discovery/execution, and formatter/linter integrations. | Planned |
| 6. Remote and extensions | First design trust boundaries and stable interfaces. Evaluate SSH/dev containers and an isolated, permissioned extension runtime separately; do not claim support until it is implemented and tested. | Planned |
| 7. AI workflows | Preserve providers and current workflows; improve consistent workspace-scoped context, multi-file review/revert, checkpoints/cancellation, progress, usage visibility, and policy enforcement. | Planned |
| 8. Regression and release | Run frontend and Rust suites, lint/typecheck/build, Tauri checks, and Windows NSIS/MSI/updater validation. Make Rust CI blocking when its external path dependency is fixed. | Planned |

## Stage 1 acceptance criteria

- Rust LSP process lookup uses both language and workspace root.
- Start, requests, notifications, stop, and emitted notifications all identify
  the same workspace.
- Concurrent workspaces using the same language cannot reuse each other's
  process or notification stream.
- Frontend transport/client registries and Rust IPC arguments use the same
  workspace identity.
- Regression tests cover distinct workspace keys and workspace-specific
  command routing where practical.
- Existing AI, terminal, Git, settings, and Windows release configuration stay
  unchanged.

## Completed Git history slice

1. Extend the existing Git IPC layer with bounded history pages, commit
   metadata/change statistics, and historical or working-tree file contents.
2. Reuse the Source Control panel for graph/date navigation and the existing
   tab/editor architecture for commit details and read-only split diffs.
3. Verify real root and non-root commit comparisons, status/rename parsing,
   path/revision validation, the frontend suite, and production frontend build.

The current history page size is 100 commits; older pages can be requested from
the panel. Date filtering covers loaded history. Destructive checkout, branch
creation, and arbitrary commit-to-commit comparisons remain planned work.

## Implementation notes

- A language server is a real external process, not a simulated service.
- Keep feature work behind the existing Tauri command and CodeMirror LSP
  boundaries.
- Do not add remote command execution or third-party extension loading until
  authentication, path confinement, least privilege, and process isolation are
  designed and tested.
- Surface failures rather than silently substituting a server from another
  workspace.

The detailed current-state findings and baseline validation are in
[`FEATURE_GAP_ANALYSIS.md`](./FEATURE_GAP_ANALYSIS.md).
