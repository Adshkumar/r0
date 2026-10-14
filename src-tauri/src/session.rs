use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

static SESSION_WRITE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Deserialize)]
struct RevisionEnvelope {
    revision: u64,
}

fn storage_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("session");
    std::fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

fn read_revision(path: &Path) -> u64 {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|value| serde_json::from_str::<RevisionEnvelope>(&value).ok())
        .map(|envelope| envelope.revision)
        .unwrap_or(0)
}

fn write_versioned(path: &Path, value: &str) -> Result<(), String> {
    let envelope: RevisionEnvelope = serde_json::from_str(value)
        .map_err(|error| format!("Invalid session data: {error}"))?;
    let _guard = SESSION_WRITE_LOCK
        .lock()
        .map_err(|error| format!("Session storage lock failed: {error}"))?;
    if envelope.revision < read_revision(path) {
        return Ok(());
    }

    let parent = path
        .parent()
        .ok_or_else(|| "Session storage path has no parent directory".to_string())?;
    std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temporary = path.with_extension(format!("{}.tmp", std::process::id()));
    std::fs::write(&temporary, value).map_err(|error| error.to_string())?;
    if let Err(error) = std::fs::rename(&temporary, path) {
        let _ = std::fs::remove_file(&temporary);
        return Err(error.to_string());
    }
    Ok(())
}

fn recovery_path(directory: &Path, file_path: &str) -> PathBuf {
    let digest = Sha256::digest(file_path.as_bytes());
    let name = digest
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    directory.join("recovery").join(format!("{name}.json"))
}

#[tauri::command]
pub async fn session_load(app: AppHandle) -> Result<Option<String>, String> {
    tokio::task::spawn_blocking(move || {
        let path = storage_dir(&app)?.join("state.json");
        match std::fs::read_to_string(path) {
            Ok(value) => Ok(Some(value)),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error.to_string()),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn session_save(app: AppHandle, value: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let path = storage_dir(&app)?.join("state.json");
        write_versioned(&path, &value)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn session_recovery_list(app: AppHandle) -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(move || {
        let directory = storage_dir(&app)?.join("recovery");
        let entries = match std::fs::read_dir(directory) {
            Ok(entries) => entries,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
            Err(error) => return Err(error.to_string()),
        };
        entries
            .filter_map(|entry| match entry {
                Ok(entry) if entry.path().extension().is_some_and(|ext| ext == "json") => {
                    Some(std::fs::read_to_string(entry.path()).map_err(|error| error.to_string()))
                }
                Ok(_) => None,
                Err(error) => Some(Err(error.to_string())),
            })
            .collect()
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn session_recovery_save(app: AppHandle, file_path: String, value: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let directory = storage_dir(&app)?;
        let path = recovery_path(&directory, &file_path);
        write_versioned(&path, &value)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn session_recovery_delete(app: AppHandle, file_path: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let directory = storage_dir(&app)?;
        let path = recovery_path(&directory, &file_path);
        match std::fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn session_clear(app: AppHandle) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let path = storage_dir(&app)?.join("state.json");
        let _guard = SESSION_WRITE_LOCK
            .lock()
            .map_err(|error| format!("Session storage lock failed: {error}"))?;
        match std::fs::remove_file(path) {
            Ok(()) => Ok(()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error.to_string()),
        }
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::{recovery_path, write_versioned};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temporary_dir() -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("r0-session-test-{suffix}"));
        std::fs::create_dir_all(&path).expect("create test directory");
        path
    }

    #[test]
    fn recovery_names_are_stable_and_do_not_expose_paths() {
        let directory = temporary_dir();
        let first = recovery_path(&directory, r"C:\work\project\file.ts");
        let same = recovery_path(&directory, r"C:\work\project\file.ts");
        let other = recovery_path(&directory, r"C:\work\project\other.ts");
        assert_eq!(first, same);
        assert_ne!(first, other);
        assert!(!first.to_string_lossy().contains("file.ts"));
        std::fs::remove_dir_all(directory).expect("remove test directory");
    }

    #[test]
    fn atomic_session_writes_never_replace_a_newer_revision() {
        let directory = temporary_dir();
        let path = directory.join("state.json");
        write_versioned(&path, r#"{"revision":2,"data":"new"}"#).expect("write new state");
        write_versioned(&path, r#"{"revision":1,"data":"old"}"#).expect("ignore stale state");
        assert_eq!(
            std::fs::read_to_string(&path).expect("read persisted state"),
            r#"{"revision":2,"data":"new"}"#
        );
        std::fs::remove_dir_all(directory).expect("remove test directory");
    }
}
