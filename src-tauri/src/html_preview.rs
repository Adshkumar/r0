use serde::Serialize;
use std::{
    fs::File,
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Component, Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    thread,
    time::Duration,
};
use tauri::{AppHandle, Manager, State};

const MAX_REQUEST_BYTES: usize = 16 * 1024;
const MAX_HTML_BYTES: usize = 4 * 1024 * 1024;
const MAX_OPEN_CONNECTIONS: usize = 16;
const BLOCKED_DIRS: &[&str] = &[".git", ".ssh", "node_modules", "target", "vendor"];
const BLOCKED_FILES: &[&str] = &[
    ".env",
    ".env.local",
    ".env.development",
    ".env.production",
    ".npmrc",
    ".pypirc",
    "credentials",
    "secrets",
];

#[derive(Default)]
pub struct HtmlPreviewState {
    server: Mutex<Option<PreviewServer>>,
}

impl HtmlPreviewState {
    pub fn matches_session(&self, session_id: &str) -> Result<bool, String> {
        let active = self
            .server
            .lock()
            .map_err(|_| "Preview state is unavailable".to_string())?;
        Ok(active
            .as_ref()
            .is_some_and(|server| server.token == session_id))
    }
}

struct PreviewServer {
    address: SocketAddr,
    token: String,
    stop: Arc<AtomicBool>,
    html_override: Arc<Mutex<String>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HtmlPreviewInfo {
    url: String,
    session_id: String,
}

fn is_blocked_path(relative: &Path) -> bool {
    relative.components().any(|component| match component {
        Component::Normal(name) => {
            let name = name.to_string_lossy().to_ascii_lowercase();
            name.starts_with('.')
                || BLOCKED_DIRS.contains(&name.as_str())
                || BLOCKED_FILES.contains(&name.as_str())
                || name.starts_with(".env")
                || name.ends_with(".pem")
                || name.ends_with(".key")
                || name.ends_with(".p12")
                || name.ends_with(".pfx")
        }
        _ => false,
    })
}

fn content_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "json" | "map" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "ttf" => "font/ttf",
        "txt" => "text/plain; charset=utf-8",
        "xml" => "application/xml",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

fn write_response(stream: &mut TcpStream, status: &str, mime: &str, body: &[u8]) {
    let headers = format!(
        "HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nContent-Length: {}\r\n\
         Connection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n\
         Content-Security-Policy: default-src 'self' data: blob: https: http:; \
         script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:; \
         style-src 'self' 'unsafe-inline' https: http:; \
         img-src 'self' data: blob: https: http:; \
         connect-src 'self' https: http: ws: wss:; object-src 'none'; base-uri 'self'\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(headers.as_bytes());
    let _ = stream.write_all(body);
}

fn decode_path(path: &str) -> Option<String> {
    let bytes = path.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            let hex = std::str::from_utf8(bytes.get(index + 1..index + 3)?).ok()?;
            decoded.push(u8::from_str_radix(hex, 16).ok()?);
            index += 3;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(decoded).ok()
}

fn serve_request(
    mut stream: TcpStream,
    root: &Path,
    entry_relative: &Path,
    token: &str,
    html_override: &Mutex<String>,
) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(5)));

    let mut request = Vec::with_capacity(1024);
    let mut buffer = [0u8; 1024];
    while request.len() < MAX_REQUEST_BYTES {
        let read = match stream.read(&mut buffer) {
            Ok(0) | Err(_) => return,
            Ok(read) => read,
        };
        request.extend_from_slice(&buffer[..read]);
        if request.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
    }

    let first_line = match std::str::from_utf8(&request)
        .ok()
        .and_then(|request| request.lines().next())
    {
        Some(line) => line,
        None => return,
    };
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("");
    let target = parts.next().unwrap_or("");
    if method != "GET" && method != "HEAD" {
        write_response(
            &mut stream,
            "405 Method Not Allowed",
            "text/plain",
            b"Method not allowed",
        );
        return;
    }

    let path = target.split('?').next().unwrap_or("");
    let decoded = match decode_path(path) {
        Some(path) => path,
        None => {
            write_response(
                &mut stream,
                "400 Bad Request",
                "text/plain",
                b"Invalid path",
            );
            return;
        }
    };
    let prefix = format!("/{token}/");
    let relative_text = match decoded.strip_prefix(&prefix) {
        Some(path) if !path.is_empty() => path,
        _ => {
            write_response(&mut stream, "404 Not Found", "text/plain", b"Not found");
            return;
        }
    };
    let relative = Path::new(relative_text);
    if relative
        .components()
        .any(|part| !matches!(part, Component::Normal(_)))
        || is_blocked_path(relative)
    {
        write_response(&mut stream, "403 Forbidden", "text/plain", b"Access denied");
        return;
    }

    let requested = root.join(relative);
    let canonical = match requested.canonicalize() {
        Ok(path) if path.starts_with(root) && path.is_file() => path,
        _ => {
            write_response(&mut stream, "404 Not Found", "text/plain", b"Not found");
            return;
        }
    };
    if canonical
        .strip_prefix(root)
        .map(is_blocked_path)
        .unwrap_or(true)
    {
        write_response(&mut stream, "403 Forbidden", "text/plain", b"Access denied");
        return;
    }
    let mime = content_type(&canonical);
    if relative == entry_relative {
        let html = match html_override.lock() {
            Ok(content) => content.clone(),
            Err(_) => {
                write_response(
                    &mut stream,
                    "500 Internal Server Error",
                    "text/plain",
                    b"Preview unavailable",
                );
                return;
            }
        };
        let body = html.as_bytes();
        let headers = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {}\r\n\
             Connection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n\
             Content-Security-Policy: default-src 'self' data: blob: https: http:; \
             script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:; \
             style-src 'self' 'unsafe-inline' https: http:; \
             img-src 'self' data: blob: https: http:; \
             connect-src 'self' https: http: ws: wss:; object-src 'none'; base-uri 'self'\r\n\r\n",
            body.len()
        );
        let _ = stream.write_all(headers.as_bytes());
        if method == "GET" {
            let _ = stream.write_all(body);
        }
        return;
    }

    let metadata = match canonical.metadata() {
        Ok(metadata) => metadata,
        Err(_) => {
            write_response(&mut stream, "404 Not Found", "text/plain", b"Not found");
            return;
        }
    };
    if metadata.len() > 64 * 1024 * 1024 {
        write_response(
            &mut stream,
            "413 Content Too Large",
            "text/plain",
            b"File too large",
        );
        return;
    }
    let headers = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: {mime}\r\nContent-Length: {}\r\n\
         Connection: close\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\n\
         Content-Security-Policy: default-src 'self' data: blob: https: http:; \
         script-src 'self' 'unsafe-inline' 'unsafe-eval' https: http:; \
         style-src 'self' 'unsafe-inline' https: http:; \
         img-src 'self' data: blob: https: http:; \
         connect-src 'self' https: http: ws: wss:; object-src 'none'; base-uri 'self'\r\n\r\n",
        metadata.len()
    );
    if stream.write_all(headers.as_bytes()).is_err() || method == "HEAD" {
        return;
    }
    if let Ok(mut file) = File::open(canonical) {
        let _ = std::io::copy(&mut file, &mut stream);
    }
}

fn create_token() -> String {
    use sha2::{Digest, Sha256};
    use std::sync::atomic::AtomicU64;
    static SEQUENCE: AtomicU64 = AtomicU64::new(0);
    let seed = format!(
        "{}:{}:{}",
        std::process::id(),
        SEQUENCE.fetch_add(1, Ordering::Relaxed),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default()
    );
    format!("{:x}", Sha256::digest(seed.as_bytes()))
}

fn stop_server(server: PreviewServer) {
    server.stop.store(true, Ordering::Release);
    let _ = TcpStream::connect(server.address);
}

#[tauri::command]
pub fn start_html_preview(
    state: State<'_, HtmlPreviewState>,
    root_path: String,
    html_path: String,
    html_content: String,
) -> Result<HtmlPreviewInfo, String> {
    if html_content.len() > MAX_HTML_BYTES {
        return Err("HTML preview source exceeds the 4 MiB limit".to_string());
    }
    let root = PathBuf::from(root_path)
        .canonicalize()
        .map_err(|error| format!("Could not open workspace: {error}"))?;
    let file = PathBuf::from(html_path)
        .canonicalize()
        .map_err(|error| format!("Could not open HTML file: {error}"))?;
    if !file.starts_with(&root) || !file.is_file() {
        return Err("HTML preview file must be inside the open workspace".to_string());
    }
    let entry_relative = file
        .strip_prefix(&root)
        .map_err(|_| "HTML preview file must be inside the open workspace".to_string())?
        .to_path_buf();
    if !matches!(
        file.extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "html" | "htm"
    ) {
        return Err("Live Preview supports HTML files only".to_string());
    }
    if is_blocked_path(&entry_relative) {
        return Err("This HTML file is in a protected directory".to_string());
    }

    let mut active = state
        .server
        .lock()
        .map_err(|_| "Preview state is unavailable".to_string())?;
    if let Some(existing) = active.take() {
        stop_server(existing);
    }

    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|error| format!("Could not start the HTML preview server: {error}"))?;
    let address = listener.local_addr().map_err(|error| error.to_string())?;
    let token = create_token();
    let stop = Arc::new(AtomicBool::new(false));
    let html_override = Arc::new(Mutex::new(html_content));
    let server_root = root.clone();
    let server_entry = entry_relative.clone();
    let server_token = token.clone();
    let server_stop = Arc::clone(&stop);
    let server_override = Arc::clone(&html_override);
    let active_connections = Arc::new(AtomicUsize::new(0));

    thread::Builder::new()
        .name("r0-html-preview".to_string())
        .spawn(move || {
            while !server_stop.load(Ordering::Acquire) {
                let (stream, _) = match listener.accept() {
                    Ok(connection) => connection,
                    Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                    Err(_) => break,
                };
                if server_stop.load(Ordering::Acquire) {
                    break;
                }
                let current = active_connections.load(Ordering::Relaxed);
                if current >= MAX_OPEN_CONNECTIONS {
                    let mut stream = stream;
                    write_response(
                        &mut stream,
                        "503 Service Unavailable",
                        "text/plain",
                        b"Busy",
                    );
                    continue;
                }
                active_connections.fetch_add(1, Ordering::AcqRel);
                let root = server_root.clone();
                let entry = server_entry.clone();
                let token = server_token.clone();
                let html_override = Arc::clone(&server_override);
                let active_connections = Arc::clone(&active_connections);
                let _ = thread::Builder::new()
                    .name("r0-html-preview-request".to_string())
                    .spawn(move || {
                        serve_request(stream, &root, &entry, &token, &html_override);
                        active_connections.fetch_sub(1, Ordering::AcqRel);
                    });
            }
        })
        .map_err(|error| format!("Could not start the HTML preview server: {error}"))?;

    let mut url = url::Url::parse(&format!("http://{address}/{token}/"))
        .map_err(|error| error.to_string())?;
    {
        let mut segments = url
            .path_segments_mut()
            .map_err(|_| "Could not create preview URL".to_string())?;
        segments.pop_if_empty();
        segments.extend(
            entry_relative
                .components()
                .filter_map(|component| match component {
                    Component::Normal(value) => value.to_str(),
                    _ => None,
                }),
        );
    }

    *active = Some(PreviewServer {
        address,
        token: token.clone(),
        stop,
        html_override,
    });
    Ok(HtmlPreviewInfo {
        url: url.to_string(),
        session_id: token,
    })
}

#[tauri::command]
pub fn update_html_preview(
    state: State<'_, HtmlPreviewState>,
    session_id: String,
    html_content: String,
) -> Result<(), String> {
    if html_content.len() > MAX_HTML_BYTES {
        return Err("HTML preview source exceeds the 4 MiB limit".to_string());
    }
    let active = state
        .server
        .lock()
        .map_err(|_| "Preview state is unavailable".to_string())?;
    let server = active
        .as_ref()
        .ok_or_else(|| "HTML preview is not running".to_string())?;
    if server.token != session_id {
        return Err("HTML preview session is no longer active".to_string());
    }
    *server
        .html_override
        .lock()
        .map_err(|_| "Preview content is unavailable".to_string())? = html_content;
    Ok(())
}

#[tauri::command]
pub async fn destroy_html_preview_panel(
    app: AppHandle,
    state: State<'_, HtmlPreviewState>,
    session_id: String,
) -> Result<(), String> {
    let mut active = state
        .server
        .lock()
        .map_err(|_| "Preview state is unavailable".to_string())?;
    if !active
        .as_ref()
        .is_some_and(|server| server.token == session_id)
    {
        return Ok(());
    }
    if let Some(server) = active.take() {
        stop_server(server);
    }
    drop(active);
    if let Some(webview) = app.get_webview("html-preview-isolated") {
        webview.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn stop_on_exit(app: &AppHandle) {
    if let Some(state) = app.try_state::<HtmlPreviewState>() {
        if let Ok(mut active) = state.server.lock() {
            if let Some(server) = active.take() {
                stop_server(server);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{decode_path, is_blocked_path};
    use std::path::Path;

    #[test]
    fn decodes_percent_encoded_paths_before_validation() {
        assert_eq!(
            decode_path("/images/logo%20mark.png").as_deref(),
            Some("/images/logo mark.png")
        );
        assert_eq!(decode_path("/%2e%2e/.env").as_deref(), Some("/../.env"));
        assert_eq!(decode_path("/bad%XX"), None);
    }

    #[test]
    fn blocks_private_and_dependency_paths() {
        for path in [
            ".env.production.local",
            ".git/config",
            "node_modules/pkg/index.js",
            "private/key.pem",
        ] {
            assert!(is_blocked_path(Path::new(path)), "{path}");
        }
        assert!(!is_blocked_path(Path::new("images/logo.png")));
    }
}
