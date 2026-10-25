<div align="center">
  <img src="public/logo.png" alt="r0 logo" width="120">
  <h1>r0</h1>
  <p>A cross-platform code editor for building software with AI, Git, an integrated terminal, and a focused editing workflow.</p>
  <p>
    <a href="https://github.com/Adshkumar/r0/releases/latest">Download the latest release</a>
    ·
    <a href="https://r0-ide.vercel.app/docs">Documentation</a>
    ·
    <a href="https://r0-ide.vercel.app/releases">Changelog</a>
    ·
    <a href="https://github.com/Adshkumar/r0/issues">Report an issue</a>
  </p>
  <img src="public/screenshot.png" alt="Screenshot of the r0 editor" width="800">
</div>

## About r0

r0 is a desktop code editor built with Tauri, Rust, and React. It brings everyday development
tools together in one application: edit code, work with Git, use a terminal, inspect databases,
and collaborate with AI coding agents without leaving your project.

## What r0 can do

### Edit and navigate code

- Edit code with syntax highlighting, language-server features, code navigation, and Vim support.
- Work with multiple files, tabs, split panes, and workspace layouts.
- Browse project files, use the command palette and Quick Open, search the workspace, and navigate symbols and references.
- Review diagnostics and outlines, and use keyboard shortcuts to access common editor and workspace actions.
- Review local file history and work with Markdown, notebooks, and other supported document previews.
- Extend language and editor support with installable integrations.

### Work with AI

- Chat with supported AI providers and use agent integrations from the editor.
- Give agents project context and use supported file, terminal, and editor workflows.
- Use inline assistance and editing tools, and manage agent sessions from the workbench.
- Schedule continuous agents, use supported cloud or detached agent workflows, and inspect ACP traffic where available.
- Configure providers, models, permissions, and related behavior in Settings. Availability depends on provider credentials, installed integrations, and platform support.

### Build, run, and debug

- Use integrated terminal sessions and run project actions without leaving the workspace.
- Connect to supported language servers and debugging adapters.
- Browse and manage supported database connections and run queries with the database tools.
- Open browser surfaces and project previews when the relevant feature is available.

### Work with Git and GitHub

- Inspect repository status and diffs, manage branches, and use source-control workflows.
- Work with GitHub repositories, pull requests, issues, and Actions from the editor.

### Customize and collaborate

- Install extensions and language integrations; customize themes, file icons, keybindings, and editor settings.
- Use collaboration, sharing, remote-workspace, WSL, and Docker features where configured and supported.
- Organize work with project switching, workspace persistence, sidebars, panes, and notifications; managed deployments can apply policy controls.

Feature availability can depend on the operating system, installed extensions, external tools, provider configuration, and workspace type. See the [r0 documentation](https://r0-ide.vercel.app/docs) for setup and usage details.

## Performance and resource use

r0 uses Tauri and Rust for its desktop application and native integrations, with a React-based workbench. Startup is phased: the UI can render while settings and other bootstrap work continue, and several secondary surfaces are code-split and loaded when needed. Background work is scheduled rather than continuously performed where possible; for example, extension catalog update checks are delayed after startup, avoid overlapping checks, and pause while the window is hidden.

Resource use varies with the workspace, open documents, language servers, extensions, AI activity, and operating system. Windows Task Manager may list WebView and language-server processes separately from the main `r0` process, so the main process row alone is not the complete application footprint. Development builds also include development-only instrumentation and are not a reliable comparison with production builds.

The project does not promise a fixed RAM or CPU number. For a meaningful comparison, measure the full r0 process group in a production build in at least three states: idle, with a workspace fully loaded, and while performing a representative task. Record the OS, workspace size, enabled extensions, and whether indexing or language-server startup is still in progress.

## Download and install

Get the newest stable version from the
[GitHub Releases page](https://github.com/Adshkumar/r0/releases/latest). The release page lists
the available installers for each operating system and processor architecture. Releases include
Windows x64 and ARM64 installers, Linux x64 and ARM64 packages, and macOS Intel and Apple silicon
downloads.

### Windows

On the [latest release page](https://github.com/Adshkumar/r0/releases/latest), download
`R0_<version>_x64-setup.exe` for most PCs or `R0_<version>_arm64-setup.exe` for Windows on ARM,
then open the downloaded installer.

Alternatively, paste the command for your shell to download and start the latest matching
installer. The PowerShell script detects x64 versus ARM64, verifies the installer against the
release's SHA-256 checksums, and then opens the installer. Review the
[installer script](scripts/install/install-windows.ps1) before running it if you want to inspect
what it does.

PowerShell:

```powershell
irm https://raw.githubusercontent.com/Adshkumar/r0/main/scripts/install/install-windows.ps1 | iex
```

Command Prompt (`cmd.exe`):

```cmd
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-Expression (Invoke-WebRequest -UseBasicParsing 'https://raw.githubusercontent.com/Adshkumar/r0/main/scripts/install/install-windows.ps1').Content"
```

### Linux

Choose the package for your distribution and architecture from the
[latest release page](https://github.com/Adshkumar/r0/releases/latest):

| Package                                     | Install                                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Debian or Ubuntu (`.deb`)                   | `sudo apt install ./R0_<version>_amd64.deb` (or the `_arm64.deb` build)                                  |
| Fedora or another RPM distribution (`.rpm`) | `sudo dnf install ./R0-<version>-1.x86_64.rpm` (or the `.aarch64.rpm` build)                             |
| AppImage                                    | `chmod +x R0_<version>_amd64.AppImage && ./R0_<version>_amd64.AppImage`                                  |
| Portable archive (`.tar.gz`)                | Extract the matching `linux-x86_64` or `linux-aarch64` archive and run `r0` from the extracted directory |

The portable archive uses the system WebKitGTK 4.1 libraries. The release page also provides
SHA-256 checksums and updater signatures for supported assets.

### macOS

Download the `.dmg` matching your Mac from the
[latest release page](https://github.com/Adshkumar/r0/releases/latest): choose `aarch64` for
Apple silicon or `x64` for Intel. Open the disk image and move r0 into Applications.

## Updates

r0 checks for updates automatically after startup and periodically while it is running. To check
manually, open **Settings → General → Check for updates**. When a newer compatible release is
available, choose **View release notes** to review its new features before installing, or install
it directly. After updating, open **What's New** from the account menu to review the installed
release notes. The [online changelog](https://r0-ide.vercel.app/releases) lists published releases.
If no update is available, Settings shows **Up to date** and the manual check confirms that you're
on the latest version. If the check cannot reach the update service, r0 reports the check failure
instead of claiming that the app is current.

## Build from source

Install [Node.js 24](https://nodejs.org), [Bun 1.3.14](https://bun.sh), and
[Rust](https://rustup.rs), then clone the repository and start the development app:

```bash
git clone https://github.com/Adshkumar/r0.git
cd r0
bun setup
bun dev
```

`bun setup` installs the project dependencies and checks your platform's native requirements.
See the [project documentation](https://r0-ide.vercel.app/docs) for platform setup and usage.

## Contributing

Contributions and bug reports are welcome. Please open an
[issue](https://github.com/Adshkumar/r0/issues) or start a
[discussion](https://github.com/Adshkumar/r0/discussions).
