use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use zip::ZipArchive;

const MAX_PACKAGE_BYTES: usize = 100 * 1024 * 1024;
const MAX_MANIFEST_BYTES: u64 = 1024 * 1024;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionRecord {
    pub namespace: String,
    pub name: String,
    pub version: String,
    pub display_name: String,
    pub description: String,
    pub publisher: String,
    pub sha256: String,
    pub package_file: String,
    pub enabled: bool,
    pub installed_at: u64,
    pub contributions: Vec<String>,
    pub themes: Vec<ExtensionTheme>,
    pub dependencies: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtensionTheme {
    pub id: String,
    pub label: String,
    pub ui_theme: String,
    pub path: String,
}

fn valid_id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
}

fn valid_version(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-' | b'+'))
}

fn extension_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not locate r0 data directory: {error}"))?
        .join("extensions");
    fs::create_dir_all(&path)
        .map_err(|error| format!("Could not create extensions directory: {error}"))?;
    path.canonicalize()
        .map_err(|error| format!("Could not access extensions directory: {error}"))
}

fn read_records(path: &Path) -> Result<Vec<ExtensionRecord>, String> {
    let manifest_path = path.join("installed.json");
    let backup_path = path.join("installed.json.bak");
    let manifest_path = if !manifest_path.exists() && backup_path.exists() {
        backup_path
    } else {
        manifest_path
    };
    if !manifest_path.exists() {
        return Ok(Vec::new());
    }
    let bytes = fs::read(&manifest_path)
        .map_err(|error| format!("Could not read extension records: {error}"))?;
    serde_json::from_slice(&bytes)
        .map_err(|error| format!("Extension records are invalid: {error}"))
}

fn write_records(path: &Path, records: &[ExtensionRecord]) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|error| format!("Could not create extension records directory: {error}"))?;
    let data = serde_json::to_vec_pretty(records).map_err(|error| error.to_string())?;
    let temp = path.join("installed.json.tmp");
    fs::write(&temp, data)
        .map_err(|error| format!("Could not write extension records: {error}"))?;
    let manifest = path.join("installed.json");
    let backup = path.join("installed.json.bak");
    if manifest.exists() {
        if backup.exists() {
            fs::remove_file(&backup)
                .map_err(|error| format!("Could not rotate extension records: {error}"))?;
        }
        fs::rename(&manifest, &backup)
            .map_err(|error| format!("Could not back up extension records: {error}"))?;
    }
    if let Err(error) = fs::rename(&temp, &manifest) {
        if backup.exists() {
            let _ = fs::rename(&backup, &manifest);
        }
        let _ = fs::remove_file(&temp);
        return Err(format!("Could not update extension records: {error}"));
    }
    if backup.exists() {
        fs::remove_file(backup)
            .map_err(|error| format!("Could not clean up extension records: {error}"))?;
    }
    Ok(())
}

fn validate_package(
    bytes: &[u8],
    namespace: &str,
    name: &str,
    version: &str,
) -> Result<(Vec<String>, Vec<ExtensionTheme>, Vec<String>), String> {
    let cursor = std::io::Cursor::new(bytes);
    let mut archive = ZipArchive::new(cursor)
        .map_err(|error| format!("Downloaded file is not a valid VSIX archive: {error}"))?;
    let manifest = archive
        .by_name("extension/package.json")
        .map_err(|_| "VSIX package is missing extension/package.json".to_string())?;
    if manifest.size() > MAX_MANIFEST_BYTES {
        return Err("Extension manifest is too large".to_string());
    }
    let mut contents = String::new();
    manifest
        .take(MAX_MANIFEST_BYTES + 1)
        .read_to_string(&mut contents)
        .map_err(|error| format!("Could not read extension manifest: {error}"))?;
    if contents.len() as u64 > MAX_MANIFEST_BYTES {
        return Err("Extension manifest is too large".to_string());
    }
    let manifest: serde_json::Value = serde_json::from_str(&contents)
        .map_err(|error| format!("Extension manifest is invalid JSON: {error}"))?;
    let publisher = manifest
        .get("publisher")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let manifest_name = manifest.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let manifest_version = manifest
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if !publisher.eq_ignore_ascii_case(namespace)
        || !manifest_name.eq_ignore_ascii_case(name)
        || manifest_version != version
    {
        return Err("Downloaded extension identity does not match Open VSX metadata".to_string());
    }
    let supported_contributions = [
        "themes",
        "languages",
        "grammars",
        "snippets",
        "configuration",
        "commands",
        "keybindings",
        "views",
        "viewsContainers",
        "menus",
        "problemMatchers",
        "taskDefinitions",
        "debuggers",
        "authentication",
    ];
    let contribution_manifest = manifest
        .get("contributes")
        .map(|value| {
            value
                .as_object()
                .ok_or_else(|| "Extension contributions must be an object".to_string())
        })
        .transpose()?;
    let contributions: Vec<String> = contribution_manifest
        .map(|object| {
            object
                .keys()
                .filter(|key| supported_contributions.contains(&key.as_str()))
                .cloned()
                .collect()
        })
        .unwrap_or_default();
    let themes = match contribution_manifest.and_then(|object| object.get("themes")) {
        Some(value) => {
            let entries = value
                .as_array()
                .ok_or_else(|| "Theme contributions must be an array".to_string())?;
            if entries.len() > 20 {
                return Err("Extension declares too many themes".to_string());
            }
            entries
                .iter()
                .map(|entry| {
                    let label = entry
                        .get("label")
                        .and_then(|value| value.as_str())
                        .ok_or_else(|| "Theme contribution is missing a label".to_string())?;
                    let path = entry
                        .get("path")
                        .and_then(|value| value.as_str())
                        .ok_or_else(|| "Theme contribution is missing a path".to_string())?;
                    let ui_theme = entry
                        .get("uiTheme")
                        .and_then(|value| value.as_str())
                        .unwrap_or("vs-dark");
                    let theme_path = Path::new(path);
                    if label.is_empty()
                        || label.len() > 128
                        || theme_path.is_absolute()
                        || theme_path
                            .components()
                            .any(|part| !matches!(part, std::path::Component::Normal(_)))
                        || !path.to_ascii_lowercase().ends_with(".json")
                    {
                        return Err(
                            "Theme contribution contains an invalid label or package path"
                                .to_string(),
                        );
                    }
                    Ok(ExtensionTheme {
                        id: format!("{}-{}", name, label),
                        label: label.to_string(),
                        ui_theme: ui_theme.to_string(),
                        path: path.to_string(),
                    })
                })
                .collect::<Result<Vec<_>, String>>()?
        }
        None => Vec::new(),
    };
    let dependencies = match manifest.get("extensionDependencies") {
        Some(value) => {
            let values = value
                .as_array()
                .ok_or_else(|| "Extension dependencies must be an array".to_string())?;
            if values.len() > 50 {
                return Err("Extension declares too many dependencies".to_string());
            }
            values
                .iter()
                .map(|value| {
                    let dependency = value
                        .as_str()
                        .ok_or_else(|| "Extension dependency ID is invalid".to_string())?;
                    if !valid_id(dependency) || !dependency.contains('.') {
                        return Err("Extension dependency ID is invalid".to_string());
                    }
                    Ok(dependency.to_string())
                })
                .collect::<Result<Vec<_>, String>>()?
        }
        None => Vec::new(),
    };
    Ok((contributions, themes, dependencies))
}

#[tauri::command]
pub async fn extension_list(app: AppHandle) -> Result<Vec<ExtensionRecord>, String> {
    let path = extension_dir(&app)?;
    let records = read_records(&path)?;
    for record in &records {
        if !valid_id(&record.namespace) || !valid_id(&record.name) {
            return Err("Extension records contain an invalid identifier".to_string());
        }
        let package_path = Path::new(&record.package_file);
        if package_path.components().count() != 1
            || package_path.extension().and_then(|ext| ext.to_str()) != Some("vsix")
            || record.package_file.contains("..")
        {
            return Err("Extension records contain an invalid package path".to_string());
        }
        if !path.join(&record.package_file).is_file() {
            return Err(format!(
                "Installed package is missing for {}.{}",
                record.namespace, record.name
            ));
        }
    }
    Ok(records)
}

#[tauri::command]
pub async fn extension_install(
    app: AppHandle,
    namespace: String,
    name: String,
    version: String,
    display_name: String,
    description: String,
    download_url: String,
    checksum_url: String,
) -> Result<ExtensionRecord, String> {
    if !valid_id(&namespace) || !valid_id(&name) || !valid_version(&version) {
        return Err("Extension metadata contains an invalid identifier or version".to_string());
    }
    if display_name.len() > 256 || description.len() > 2048 {
        return Err("Extension metadata exceeds the allowed size".to_string());
    }
    let url = url::Url::parse(&download_url)
        .map_err(|error| format!("Invalid extension download URL: {error}"))?;
    if url.scheme() != "https" || url.host_str() != Some("open-vsx.org") {
        return Err("Extension packages must be downloaded from Open VSX over HTTPS".to_string());
    }
    let checksum_url = url::Url::parse(&checksum_url)
        .map_err(|error| format!("Invalid extension checksum URL: {error}"))?;
    if checksum_url.scheme() != "https" || checksum_url.host_str() != Some("open-vsx.org") {
        return Err("Extension checksums must be downloaded from Open VSX over HTTPS".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|error| format!("Could not initialize package download: {error}"))?;
    let mut response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("Extension download failed: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Extension download failed: {error}"))?;
    if response
        .content_length()
        .is_some_and(|length| length > MAX_PACKAGE_BYTES as u64)
    {
        return Err("Extension package exceeds the 100 MiB limit".to_string());
    }
    let mut bytes = Vec::with_capacity(
        response
            .content_length()
            .unwrap_or(0)
            .min(MAX_PACKAGE_BYTES as u64) as usize,
    );
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|error| format!("Could not read extension package: {error}"))?
    {
        if bytes.len().saturating_add(chunk.len()) > MAX_PACKAGE_BYTES {
            return Err("Extension package exceeds the 100 MiB limit".to_string());
        }
        bytes.extend_from_slice(&chunk);
    }

    let (contributions, themes, dependencies) =
        validate_package(&bytes, &namespace, &name, &version)?;
    let digest = format!("{:x}", Sha256::digest(&bytes));
    let checksum_response = client
        .get(checksum_url)
        .send()
        .await
        .map_err(|error| format!("Could not download extension checksum: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Could not download extension checksum: {error}"))?;
    if checksum_response
        .content_length()
        .is_some_and(|length| length > 256)
    {
        return Err("Open VSX checksum response is too large".to_string());
    }
    let checksum_bytes = checksum_response
        .bytes()
        .await
        .map_err(|error| format!("Could not read extension checksum: {error}"))?;
    if checksum_bytes.len() > 256 {
        return Err("Open VSX checksum response is too large".to_string());
    }
    let checksum = std::str::from_utf8(&checksum_bytes)
        .map_err(|error| format!("Open VSX checksum is invalid: {error}"))?;
    let expected = checksum.split_whitespace().next().unwrap_or("");
    if expected.len() != 64
        || !expected.bytes().all(|byte| byte.is_ascii_hexdigit())
        || !expected.eq_ignore_ascii_case(&digest)
    {
        return Err("Extension package SHA-256 does not match the Open VSX checksum".to_string());
    }
    let directory = extension_dir(&app)?;
    let mut records = read_records(&directory)?;
    let index = records.iter().position(|record| {
        record.namespace.eq_ignore_ascii_case(&namespace) && record.name.eq_ignore_ascii_case(&name)
    });
    let package_id = format!(
        "{}.{}@{}",
        namespace.to_lowercase(),
        name.to_lowercase(),
        version
    );
    let package_file = format!("{:x}.vsix", Sha256::digest(package_id.as_bytes()));
    let destination = directory.join(&package_file);
    let temporary = directory.join(format!(".{package_file}.download"));
    fs::write(&temporary, &bytes)
        .map_err(|error| format!("Could not save extension package: {error}"))?;
    if destination.exists() {
        let previous = directory.join(format!(".{package_file}.backup"));
        if previous.exists() {
            fs::remove_file(&previous)
                .map_err(|error| format!("Could not rotate extension package: {error}"))?;
        }
        fs::rename(&destination, &previous)
            .map_err(|error| format!("Could not back up installed package: {error}"))?;
        if let Err(error) = fs::rename(&temporary, &destination) {
            let _ = fs::rename(&previous, &destination);
            let _ = fs::remove_file(&temporary);
            return Err(format!("Could not install extension package: {error}"));
        }
        fs::remove_file(previous)
            .map_err(|error| format!("Could not clean up previous extension package: {error}"))?;
    } else if let Err(error) = fs::rename(&temporary, &destination) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Could not install extension package: {error}"));
    }

    let record = ExtensionRecord {
        namespace: namespace.clone(),
        name,
        version,
        display_name,
        description,
        publisher: namespace,
        sha256: digest,
        package_file: package_file.clone(),
        enabled: false,
        installed_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        contributions,
        themes,
        dependencies,
    };
    if let Some(index) = index {
        let previous_file = records[index].package_file.clone();
        let enabled = records[index].enabled;
        records[index] = ExtensionRecord {
            enabled,
            ..record.clone()
        };
        if previous_file != package_file {
            let _ = fs::remove_file(directory.join(previous_file));
        }
    } else {
        records.push(record.clone());
    }
    write_records(&directory, &records)?;
    Ok(record)
}

#[tauri::command]
pub async fn extension_read_theme(
    app: AppHandle,
    namespace: String,
    name: String,
    theme_path: String,
) -> Result<String, String> {
    if !valid_id(&namespace) || !valid_id(&name) {
        return Err("Invalid extension identifier".to_string());
    }
    let theme_path = Path::new(&theme_path);
    if theme_path.is_absolute()
        || theme_path
            .components()
            .any(|part| !matches!(part, std::path::Component::Normal(_)))
        || !theme_path
            .to_string_lossy()
            .to_ascii_lowercase()
            .ends_with(".json")
    {
        return Err("Invalid extension theme path".to_string());
    }
    let directory = extension_dir(&app)?;
    let records = read_records(&directory)?;
    let record = records
        .iter()
        .find(|record| {
            record.namespace.eq_ignore_ascii_case(&namespace)
                && record.name.eq_ignore_ascii_case(&name)
        })
        .ok_or_else(|| "Extension is not installed".to_string())?;
    if !record.enabled {
        return Err("Enable the extension before using its theme".to_string());
    }
    if !record
        .themes
        .iter()
        .any(|theme| theme.path == theme_path.to_string_lossy())
    {
        return Err("Theme is not declared in the extension manifest".to_string());
    }
    let package = directory.join(&record.package_file);
    let bytes = fs::read(package)
        .map_err(|error| format!("Could not read installed extension: {error}"))?;
    let mut archive = ZipArchive::new(std::io::Cursor::new(bytes))
        .map_err(|error| format!("Installed extension archive is invalid: {error}"))?;
    let internal_path = format!(
        "extension/{}",
        theme_path.to_string_lossy().replace('\\', "/")
    );
    let entry = archive
        .by_name(&internal_path)
        .map_err(|_| "Theme file is missing from the extension package".to_string())?;
    if entry.size() > MAX_MANIFEST_BYTES {
        return Err("Theme file is too large".to_string());
    }
    let mut content = String::new();
    entry
        .take(MAX_MANIFEST_BYTES + 1)
        .read_to_string(&mut content)
        .map_err(|error| format!("Could not read extension theme: {error}"))?;
    if content.len() as u64 > MAX_MANIFEST_BYTES {
        return Err("Theme file is too large".to_string());
    }
    let _: serde_json::Value = serde_json::from_str(&content)
        .map_err(|error| format!("Extension theme JSON is invalid: {error}"))?;
    Ok(content)
}

#[tauri::command]
pub async fn extension_set_enabled(
    app: AppHandle,
    namespace: String,
    name: String,
    enabled: bool,
) -> Result<Vec<ExtensionRecord>, String> {
    let directory = extension_dir(&app)?;
    let mut records = read_records(&directory)?;
    let record = records
        .iter_mut()
        .find(|record| {
            record.namespace.eq_ignore_ascii_case(&namespace)
                && record.name.eq_ignore_ascii_case(&name)
        })
        .ok_or_else(|| "Extension is not installed".to_string())?;
    record.enabled = enabled;
    write_records(&directory, &records)?;
    Ok(records)
}

#[tauri::command]
pub async fn extension_uninstall(
    app: AppHandle,
    namespace: String,
    name: String,
) -> Result<Vec<ExtensionRecord>, String> {
    let directory = extension_dir(&app)?;
    let mut records = read_records(&directory)?;
    let index = records
        .iter()
        .position(|record| {
            record.namespace.eq_ignore_ascii_case(&namespace)
                && record.name.eq_ignore_ascii_case(&name)
        })
        .ok_or_else(|| "Extension is not installed".to_string())?;
    let package_file = records[index].package_file.clone();
    if Path::new(&package_file).components().count() != 1 || package_file.contains("..") {
        return Err("Extension record contains an invalid package path".to_string());
    }
    let path = directory.join(package_file);
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|error| format!("Could not remove extension package: {error}"))?;
    }
    records.remove(index);
    write_records(&directory, &records)?;
    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::{read_records, valid_id, validate_package, write_records, ExtensionRecord};
    use std::io::Write;
    use std::{fs, time::SystemTime};
    use zip::{write::SimpleFileOptions, ZipWriter};

    fn test_package(publisher: &str, name: &str, version: &str, theme_path: &str) -> Vec<u8> {
        let cursor = std::io::Cursor::new(Vec::new());
        let mut writer = ZipWriter::new(cursor);
        writer
            .start_file("extension/package.json", SimpleFileOptions::default())
            .expect("write package manifest");
        write!(
            writer,
            r#"{{"publisher":"{publisher}","name":"{name}","version":"{version}","contributes":{{"themes":[{{"label":"Test Theme","uiTheme":"vs-dark","path":"{theme_path}"}}],"commands":[{{"command":"x"}}],"unknown":[{{}}]}}}}"#
        )
        .expect("write package json");
        writer
            .finish()
            .expect("finish package archive")
            .into_inner()
    }

    #[test]
    fn extension_identifiers_reject_paths_and_empty_values() {
        assert!(valid_id("publisher.name-1"));
        assert!(!valid_id("../outside"));
        assert!(!valid_id(""));
    }

    #[test]
    fn validates_vsix_identity_and_records_safe_theme_contributions() {
        let package = test_package("publisher", "sample", "1.0.0", "themes/test.json");
        let (contributions, themes, dependencies) =
            validate_package(&package, "publisher", "sample", "1.0.0").expect("valid VSIX");
        assert!(contributions.contains(&"themes".to_string()));
        assert!(contributions.contains(&"commands".to_string()));
        assert_eq!(themes.len(), 1);
        assert_eq!(themes[0].path, "themes/test.json");
        assert!(dependencies.is_empty());
        assert!(validate_package(&package, "different", "sample", "1.0.0").is_err());
    }

    #[test]
    fn rejects_theme_paths_that_escape_package_root() {
        let package = test_package("publisher", "sample", "1.0.0", "../evil.json");
        assert!(validate_package(&package, "publisher", "sample", "1.0.0").is_err());
    }

    #[test]
    fn creates_extension_record_directory_and_round_trips_records() {
        let directory = std::env::temp_dir().join(format!(
            "r0-extension-records-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(SystemTime::UNIX_EPOCH)
                .expect("system time")
                .as_nanos()
        ));
        let record = ExtensionRecord {
            namespace: "publisher".to_string(),
            name: "sample".to_string(),
            version: "1.0.0".to_string(),
            display_name: "Sample".to_string(),
            description: String::new(),
            publisher: "Publisher".to_string(),
            sha256: "0".repeat(64),
            package_file: "sample.vsix".to_string(),
            enabled: false,
            installed_at: 1,
            contributions: Vec::new(),
            themes: Vec::new(),
            dependencies: Vec::new(),
        };

        write_records(&directory, &[record.clone()]).expect("write extension records");
        let loaded = read_records(&directory).expect("read extension records");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].name, "sample");

        fs::remove_file(directory.join("installed.json")).expect("remove test records");
        fs::remove_dir(directory).expect("remove test directory");
    }
}
