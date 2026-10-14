mod ai;
mod dap;
mod extensions;
mod fs;
mod git;
mod html_preview;
mod keychain;
mod lsp;
mod search;
mod system;
mod terminal;
mod tree;

use dpi::{LogicalPosition, LogicalSize};
use tauri::{AppHandle, Manager, WebviewBuilder, WebviewUrl};

// IMPORTANT: these commands MUST be `async fn`.
//
// `Window::add_child` (Tauri 2.11.2) dispatches the webview build onto the main
// thread via `run_on_main_thread` and then *blocks* on `rx.recv()` waiting for
// the result. A synchronous `#[tauri::command]` runs on the main thread itself,
// so the command would dispatch work to the main thread and then block that same
// thread waiting for it — a self-deadlock. The spinner would spin forever.
//
// Declaring the command `async` makes Tauri run it on its async runtime thread
// pool instead of the main thread, so the dispatch-and-wait completes normally.
#[tauri::command]
async fn embed_ide_panel(
    app: AppHandle,
    panel_id: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let parsed_url = url::Url::parse(&url).map_err(|e| e.to_string())?;
    if panel_id == "html-preview-isolated" {
        let token = parsed_url
            .path_segments()
            .and_then(|mut segments| segments.next());
        let state = app.state::<html_preview::HtmlPreviewState>();
        if !token
            .map(|token| state.matches_session(token))
            .transpose()?
            .unwrap_or(false)
        {
            return Err("HTML preview session is no longer active".to_string());
        }
    }
    // Destroy any existing embedded webview with this label first
    if let Some(existing) = app.get_webview(&panel_id) {
        let _ = existing.close();
    }
    let host = app
        .get_webview_window("main")
        .ok_or_else(|| "Host window not found".to_string())?;
    let window = host.as_ref().window();
    let mut builder = WebviewBuilder::new(&panel_id, WebviewUrl::External(parsed_url.clone()));
    if panel_id == "html-preview-isolated" {
        let expected_port = parsed_url.port();
        builder = builder
            .on_navigation(move |target| {
                target.scheme() == "http"
                    && target.host_str() == Some("127.0.0.1")
                    && target.port() == expected_port
            })
            .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny);
    }
    window
        .add_child(
            builder,
            LogicalPosition::new(x, y),
            LogicalSize::new(width, height),
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn reload_ide_panel(
    app: AppHandle,
    state: tauri::State<'_, html_preview::HtmlPreviewState>,
    panel_id: String,
    session_id: String,
) -> Result<(), String> {
    if panel_id != "html-preview-isolated" {
        return Err("Reload is only available for the isolated HTML preview".to_string());
    }
    if !state.matches_session(&session_id)? {
        return Err("HTML preview session is no longer active".to_string());
    }
    if let Some(webview) = app.get_webview(&panel_id) {
        webview
            .eval("window.location.reload()")
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn resize_html_preview_panel(
    app: AppHandle,
    state: tauri::State<'_, html_preview::HtmlPreviewState>,
    session_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if !state.matches_session(&session_id)? {
        return Ok(());
    }
    if let Some(webview) = app.get_webview("html-preview-isolated") {
        webview
            .set_position(LogicalPosition::new(x, y))
            .map_err(|error| error.to_string())?;
        webview
            .set_size(LogicalSize::new(width, height))
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn resize_ide_panel(
    app: AppHandle,
    panel_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&panel_id) {
        webview
            .set_position(LogicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;
        webview
            .set_size(LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn destroy_ide_panel(
    app: AppHandle,
    panel_id: String,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&panel_id) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn get_ide_panel_url(app: AppHandle, panel_id: String) -> Result<String, String> {
    if let Some(webview) = app.get_webview(&panel_id) {
        webview.url().map(|u| u.to_string()).map_err(|e| e.to_string())
    } else {
        Err("panel not found".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(terminal::TerminalState::new())
        .manage(lsp::LspState::new())
        .manage(dap::DapState::new())
        .manage(html_preview::HtmlPreviewState::default())
        .invoke_handler(tauri::generate_handler![
            keychain::set_secret,
            keychain::get_secret,
            keychain::delete_secret,
            extensions::extension_list,
            extensions::extension_install,
            extensions::extension_read_theme,
            extensions::extension_set_enabled,
            extensions::extension_uninstall,
            html_preview::start_html_preview,
            html_preview::update_html_preview,
            html_preview::destroy_html_preview_panel,
            fs::read_dir,
            fs::read_file,
            fs::read_prettier_config,
            fs::read_file_bytes,
            fs::write_file,
            fs::rename_path,
            fs::delete_path,
            fs::create_dir_cmd,
            fs::reveal_in_explorer,
            fs::read_editor_keybindings,
            fs::detect_installed_editors,
            git::git_branch,
            git::git_remote_url,
            git::git_github_commit_author_avatar,
            git::git_changes,
            git::git_status_files,
            git::git_log_full,
            git::git_history,
            git::git_commit_details,
            git::git_file_diff,
            git::git_commit,
            git::git_commit_push,
            system::sys_memory,
            terminal::terminal_create,
            terminal::terminal_write,
            terminal::terminal_resize,
            terminal::terminal_close,
            search::search_in_files,
            search::search_symbols,
            search::list_workspace_files,
            tree::get_file_tree,
            tree::get_import_edges,
            ai::agent_bash_run,
            ai::ai_stream_proxy,
            ai::fetch_text,
            lsp::lsp_start,
            lsp::lsp_request,
            lsp::lsp_notify,
            lsp::lsp_stop,
            dap::dap_start,
            dap::dap_request,
            dap::dap_stop,
            embed_ide_panel,
            resize_ide_panel,
            destroy_ide_panel,
            get_ide_panel_url,
            reload_ide_panel,
            resize_html_preview_panel,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");
    app.run(|app_handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            html_preview::stop_on_exit(app_handle);
        }
    });
}
