use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    collections::{HashMap, HashSet},
    path::PathBuf,
    sync::Mutex,
};
use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub struct WorkspaceWatchState {
    watchers: Mutex<HashMap<PathBuf, RecommendedWatcher>>,
}

#[tauri::command]
pub fn watch_workspace_roots(
    app: AppHandle,
    state: tauri::State<'_, WorkspaceWatchState>,
    roots: Vec<String>,
) -> Result<(), String> {
    let roots = roots
        .into_iter()
        .map(|root| {
            std::fs::canonicalize(&root)
                .map_err(|error| format!("Could not access workspace root {root}: {error}"))
        })
        .collect::<Result<HashSet<_>, _>>()?;
    let mut watchers = state
        .watchers
        .lock()
        .map_err(|_| "Workspace watcher state is unavailable".to_string())?;
    watchers.retain(|root, _| roots.contains(root));

    for root in roots {
        if watchers.contains_key(&root) {
            continue;
        }
        let app_handle = app.clone();
        let mut watcher = RecommendedWatcher::new(
            move |result: notify::Result<Event>| match result {
                Ok(event)
                    if matches!(
                        &event.kind,
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
                    ) =>
                {
                    let paths = event
                        .paths
                        .into_iter()
                        .filter(|path| !path.components().any(|part| part.as_os_str() == ".git"))
                        .map(|path| path.to_string_lossy().into_owned())
                        .collect::<Vec<_>>();
                    if !paths.is_empty() {
                        if let Err(error) = app_handle.emit("workspace-fs-changed", paths) {
                            eprintln!("Could not publish workspace filesystem change: {error}");
                        }
                    }
                }
                Ok(_) => {}
                Err(error) => eprintln!("Workspace filesystem watcher error: {error}"),
            },
            Config::default(),
        )
        .map_err(|error| format!("Could not create workspace watcher: {error}"))?;
        watcher
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|error| format!("Could not watch workspace {}: {error}", root.display()))?;
        watchers.insert(root, watcher);
    }
    Ok(())
}
