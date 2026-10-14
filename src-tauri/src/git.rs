pub(crate) fn git_cmd() -> std::process::Command {
    #[allow(unused_mut)]
    let mut cmd = std::process::Command::new("git");
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    cmd
}

#[tauri::command]
pub fn git_branch(path: String) -> Option<String> {
    let out = git_cmd()
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(&path)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }
    let branch = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if branch.is_empty() {
        return None;
    }
    if branch == "HEAD" {
        let hash = git_cmd()
            .args(["rev-parse", "--short", "HEAD"])
            .current_dir(&path)
            .output()
            .ok()?;
        if hash.status.success() {
            return Some(format!(
                "HEAD:{}",
                String::from_utf8_lossy(&hash.stdout).trim()
            ));
        }
        return Some("HEAD".to_string());
    }
    Some(branch)
}

#[derive(serde::Serialize)]
pub struct CommitEntry {
    hash: String,
    msg: String,
}

#[derive(serde::Serialize)]
pub struct GitChanges {
    files: usize,
    commits_ahead: usize,
    log: Vec<CommitEntry>,
}

fn parse_status_summary(output: &str) -> (usize, usize) {
    let mut files = 0;
    let mut commits_ahead = 0;
    for line in output.lines() {
        if let Some(counts) = line.strip_prefix("# branch.ab ") {
            commits_ahead = counts
                .split_whitespace()
                .next()
                .and_then(|ahead| ahead.strip_prefix('+'))
                .and_then(|ahead| ahead.parse().ok())
                .unwrap_or(0);
        } else if !line.is_empty() && !line.starts_with('#') {
            files += 1;
        }
    }
    (files, commits_ahead)
}

#[tauri::command]
pub async fn git_changes(path: String) -> Option<GitChanges> {
    tokio::task::spawn_blocking(move || {
        let status = git_cmd()
            .args(["status", "--porcelain=v2", "--branch"])
            .current_dir(&path)
            .output()
            .ok()?;
        if !status.status.success() {
            return None;
        }
        let status_output = String::from_utf8_lossy(&status.stdout);
        let (files, commits_ahead) = parse_status_summary(&status_output);

        let log = git_cmd()
            .args(["log", "--max-count=5", "--pretty=format:%h\x01%s"])
            .current_dir(&path)
            .output()
            .ok()
            .map(|o| String::from_utf8_lossy(&o.stdout).into_owned())
            .unwrap_or_default()
            .lines()
            .filter(|l| !l.is_empty())
            .map(|l| {
                let mut p = l.splitn(2, '\x01');
                CommitEntry {
                    hash: p.next().unwrap_or("").to_string(),
                    msg: p.next().unwrap_or("").to_string(),
                }
            })
            .collect();

        Some(GitChanges {
            files,
            commits_ahead,
            log,
        })
    })
    .await
    .ok()?
}

#[derive(serde::Serialize)]
pub struct StatusFile {
    status: String,
    path: String,
    old_path: Option<String>,
}

#[derive(serde::Serialize)]
pub struct FullCommitEntry {
    hash: String,
    subject: String,
    author: String,
    date: String,
}

#[derive(serde::Serialize)]
pub struct GitHistoryCommit {
    hash: String,
    parents: Vec<String>,
    subject: String,
    author: String,
    author_email: String,
    author_time: i64,
    committer_time: i64,
    refs: Vec<String>,
    is_head: bool,
}

#[derive(serde::Serialize)]
pub struct GitChangedFile {
    status: String,
    path: String,
    old_path: Option<String>,
    additions: Option<u64>,
    deletions: Option<u64>,
    binary: bool,
}

#[derive(serde::Serialize)]
pub struct GitCommitDetails {
    hash: String,
    parents: Vec<String>,
    comparison_parent: Option<String>,
    message: String,
    author: String,
    author_email: String,
    author_time: i64,
    committer: String,
    committer_email: String,
    committer_time: i64,
    refs: Vec<String>,
    files: Vec<GitChangedFile>,
}

#[derive(serde::Serialize)]
pub struct GitDiffHunk {
    old_start: usize,
    old_lines: usize,
    new_start: usize,
    new_lines: usize,
}

#[derive(serde::Serialize)]
pub struct GitFileDiff {
    old_content: String,
    new_content: String,
    hunks: Option<Vec<GitDiffHunk>>,
}

#[tauri::command]
pub fn git_remote_url(path: String) -> Option<String> {
    let candidates = vec!["origin", "upstream", "github"];
    for name in candidates {
        let out = git_cmd()
            .args(["remote", "get-url", name])
            .current_dir(&path)
            .output()
            .ok()?;
        if out.status.success() {
            let url = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !url.is_empty() {
                return Some(url);
            }
        }
    }

    let out = git_cmd()
        .args(["remote", "-v"])
        .current_dir(&path)
        .output()
        .ok()?;
    if !out.status.success() {
        return None;
    }

    String::from_utf8_lossy(&out.stdout)
        .lines()
        .find_map(|line| {
            let mut parts = line.split_whitespace();
            let url = parts.nth(1)?;
            if url.is_empty() {
                None
            } else {
                Some(url.to_string())
            }
        })
}

fn github_repository_from_remote(remote_url: &str) -> Option<(String, String)> {
    let path = if let Some(path) = remote_url.strip_prefix("https://github.com/") {
        path
    } else if let Some(path) = remote_url.strip_prefix("git@github.com:") {
        path
    } else {
        return None;
    };

    let mut parts = path.trim_end_matches('/').split('/');
    let owner = parts.next()?;
    let repository = parts.next()?;
    if parts.next().is_some() {
        return None;
    }
    let repository = repository.strip_suffix(".git").unwrap_or(repository);
    let valid_segment = |value: &str| {
        !value.is_empty()
            && value != "."
            && value != ".."
            && value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    };
    if !valid_segment(owner) || !valid_segment(repository) {
        return None;
    }

    Some((owner.to_string(), repository.to_string()))
}

#[derive(serde::Deserialize)]
struct GitHubCommitResponse {
    author: Option<GitHubCommitAuthor>,
}

#[derive(serde::Deserialize, serde::Serialize)]
pub struct GitHubCommitAuthor {
    login: String,
    avatar_url: String,
}

#[tauri::command]
pub async fn git_github_commit_author_avatar(
    remote_url: String,
    hash: String,
) -> Result<Option<GitHubCommitAuthor>, String> {
    if !(7..=40).contains(&hash.len()) || !hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Invalid commit hash for GitHub author lookup.".to_string());
    }
    let Some((owner, repository)) = github_repository_from_remote(&remote_url) else {
        return Ok(None);
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|error| format!("Could not initialize GitHub lookup: {error}"))?;
    let response = client
        .get(format!(
            "https://api.github.com/repos/{owner}/{repository}/commits/{hash}"
        ))
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header(reqwest::header::USER_AGENT, "r0-ide")
        .send()
        .await
        .map_err(|error| format!("GitHub author lookup failed: {error}"))?;

    if response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!(
            "GitHub author lookup returned HTTP {}.",
            response.status()
        ));
    }

    let commit = response
        .json::<GitHubCommitResponse>()
        .await
        .map_err(|error| format!("Could not read GitHub author response: {error}"))?;
    let Some(author) = commit.author else {
        return Ok(None);
    };

    let avatar_url = url::Url::parse(&author.avatar_url)
        .map_err(|_| "GitHub returned an invalid profile image URL.".to_string())?;
    if avatar_url.scheme() != "https"
        || !matches!(
            avatar_url.host_str(),
            Some("avatars.githubusercontent.com" | "github.com")
        )
        || author.login.is_empty()
    {
        return Ok(None);
    }

    Ok(Some(author))
}

fn git_error(out: &std::process::Output) -> String {
    let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();
    if stderr.is_empty() {
        format!("Git exited with status {}", out.status)
    } else {
        stderr
    }
}

fn output(path: &str, args: &[&str]) -> Result<std::process::Output, String> {
    git_cmd()
        .args(args)
        .current_dir(path)
        .output()
        .map_err(|e| format!("Could not start Git: {e}"))
}

fn output_ok(path: &str, args: &[&str]) -> Result<std::process::Output, String> {
    let out = output(path, args)?;
    if out.status.success() {
        Ok(out)
    } else {
        Err(git_error(&out))
    }
}

fn split_refs(refs: &str) -> Vec<String> {
    refs.split(", ")
        .filter(|r| !r.is_empty())
        .map(|r| r.trim_start_matches("HEAD -> ").to_string())
        .collect()
}

fn history(path: &str, skip: usize, limit: usize) -> Result<Vec<GitHistoryCommit>, String> {
    let skip = skip.min(100_000).to_string();
    let limit = limit.clamp(1, 200).to_string();
    let out = output_ok(
        path,
        &[
            "log",
            "--all",
            "--topo-order",
            "--decorate=short",
            "--date-order",
            &format!("--skip={skip}"),
            &format!("--max-count={limit}"),
            "--format=%H%x1f%P%x1f%s%x1f%an%x1f%ae%x1f%at%x1f%ct%x1f%D",
        ],
    )?;
    let history = String::from_utf8_lossy(&out.stdout);
    history
        .lines()
        .filter(|line| !line.is_empty())
        .map(|line| {
            let fields: Vec<_> = line.splitn(8, '\x1f').collect();
            if fields.len() != 8 {
                return Err("Git returned malformed history data".to_string());
            }
            let refs = split_refs(fields[7]);
            let is_head = fields[7]
                .split(", ")
                .any(|reference| reference == "HEAD" || reference.starts_with("HEAD -> "));
            Ok(GitHistoryCommit {
                hash: fields[0].to_string(),
                parents: fields[1].split_whitespace().map(str::to_string).collect(),
                subject: fields[2].to_string(),
                author: fields[3].to_string(),
                author_email: fields[4].to_string(),
                author_time: fields[5]
                    .parse()
                    .map_err(|_| "Invalid author timestamp".to_string())?,
                committer_time: fields[6]
                    .parse()
                    .map_err(|_| "Invalid commit timestamp".to_string())?,
                refs,
                is_head,
            })
        })
        .collect()
}

#[tauri::command]
pub async fn git_history(
    path: String,
    skip: usize,
    limit: usize,
) -> Result<Vec<GitHistoryCommit>, String> {
    tokio::task::spawn_blocking(move || history(&path, skip, limit))
        .await
        .map_err(|e| format!("Git history task failed: {e}"))?
}

fn valid_revision(revision: &str) -> bool {
    !revision.is_empty() && revision.len() <= 64 && revision.bytes().all(|b| b.is_ascii_hexdigit())
}

fn validate_relative_path(file_path: &str) -> Result<(), String> {
    let normalized_path = file_path.replace('\\', "/");
    let path = std::path::Path::new(&normalized_path);
    let windows_drive_prefix = normalized_path.as_bytes().get(1) == Some(&b':')
        && normalized_path
            .as_bytes()
            .first()
            .is_some_and(u8::is_ascii_alphabetic);
    if file_path.is_empty()
        || file_path.contains('\r')
        || file_path.contains('\n')
        || windows_drive_prefix
        || path.is_absolute()
        || path.components().any(|part| {
            matches!(
                part,
                std::path::Component::ParentDir
                    | std::path::Component::RootDir
                    | std::path::Component::Prefix(_)
            )
        })
    {
        return Err("Invalid repository-relative file path".to_string());
    }
    Ok(())
}

fn parse_name_status(bytes: &[u8]) -> Result<Vec<(String, String, Option<String>)>, String> {
    let parts: Vec<_> = bytes
        .split(|b| *b == 0)
        .filter(|part| !part.is_empty())
        .collect();
    let mut files = Vec::new();
    let mut i = 0;
    while i < parts.len() {
        let status = std::str::from_utf8(parts[i])
            .map_err(|_| "Git returned a non-UTF8 file status".to_string())?;
        i += 1;
        let first = parts
            .get(i)
            .ok_or_else(|| "Git returned incomplete file status".to_string())?;
        let first = String::from_utf8_lossy(first).into_owned();
        i += 1;
        let (kind, old_path, file_path) = if status.starts_with('R') || status.starts_with('C') {
            let second = parts
                .get(i)
                .ok_or_else(|| "Git returned incomplete rename status".to_string())?;
            let second = String::from_utf8_lossy(second).into_owned();
            i += 1;
            (
                if status.starts_with('R') {
                    "renamed"
                } else {
                    "copied"
                },
                Some(first),
                second,
            )
        } else {
            let kind = match status.chars().next().unwrap_or('?') {
                'A' => "added",
                'D' => "deleted",
                'M' | 'T' => "modified",
                _ => "modified",
            };
            (kind, None, first)
        };
        files.push((kind.to_string(), file_path, old_path));
    }
    Ok(files)
}

fn parse_status_files(bytes: &[u8]) -> Vec<StatusFile> {
    let parts: Vec<_> = bytes
        .split(|b| *b == 0)
        .filter(|part| !part.is_empty())
        .collect();
    let mut files = Vec::new();
    let mut i = 0;
    while i < parts.len() {
        let record = parts[i];
        i += 1;
        if record.len() < 4 || record[2] != b' ' {
            continue;
        }
        let status = String::from_utf8_lossy(&record[..2]).trim().to_string();
        let path = String::from_utf8_lossy(&record[3..]).into_owned();
        let renamed = status.contains('R') || status.contains('C');
        let old_path = if renamed && i < parts.len() {
            let old = String::from_utf8_lossy(parts[i]).into_owned();
            i += 1;
            Some(old)
        } else {
            None
        };
        files.push(StatusFile {
            status,
            path,
            old_path,
        });
    }
    files
}

fn parse_numstat(bytes: &[u8]) -> Vec<(String, Option<u64>, Option<u64>, bool)> {
    let parts: Vec<_> = bytes.split(|b| *b == 0).collect();
    let mut results = Vec::new();
    let mut i = 0;
    while i < parts.len() {
        if parts[i].is_empty() {
            i += 1;
            continue;
        }
        let fields: Vec<_> = parts[i].splitn(3, |b| *b == b'\t').collect();
        if fields.len() != 3 {
            i += 1;
            continue;
        }
        let additions = std::str::from_utf8(fields[0])
            .ok()
            .and_then(|v| v.parse().ok());
        let deletions = std::str::from_utf8(fields[1])
            .ok()
            .and_then(|v| v.parse().ok());
        let binary = fields[0] == b"-" || fields[1] == b"-";
        let path = if fields[2].is_empty() {
            if i + 2 >= parts.len() {
                break;
            }
            i += 2;
            String::from_utf8_lossy(parts[i]).into_owned()
        } else {
            String::from_utf8_lossy(fields[2]).into_owned()
        };
        results.push((path, additions, deletions, binary));
        i += 1;
    }
    results
}

fn commit_details(
    path: &str,
    hash: &str,
    selected_parent: Option<String>,
) -> Result<GitCommitDetails, String> {
    if !valid_revision(hash) {
        return Err("Invalid commit hash".to_string());
    }
    if let Some(parent) = &selected_parent {
        if !valid_revision(parent) {
            return Err("Invalid parent commit hash".to_string());
        }
    }

    let meta = output_ok(
        path,
        &[
            "show",
            "-s",
            "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%D%x1f%B",
            hash,
        ],
    )?;
    let metadata = String::from_utf8_lossy(&meta.stdout);
    let fields: Vec<_> = metadata.splitn(10, '\x1f').collect();
    if fields.len() != 10 {
        return Err("Git returned malformed commit data".to_string());
    }
    let parents: Vec<String> = fields[1].split_whitespace().map(str::to_string).collect();
    let comparison_parent = selected_parent.or_else(|| parents.first().cloned());
    if let Some(parent) = &comparison_parent {
        if !parents.contains(parent) {
            return Err("Selected comparison is not a parent of this commit".to_string());
        }
    }
    let root = comparison_parent.is_none();
    let (name_status, numstat) = if let Some(parent) = &comparison_parent {
        (
            output_ok(
                path,
                &[
                    "diff-tree",
                    "--no-commit-id",
                    "-r",
                    "--name-status",
                    "--find-renames",
                    "-z",
                    parent,
                    hash,
                ],
            )?,
            output_ok(
                path,
                &[
                    "diff-tree",
                    "--no-commit-id",
                    "-r",
                    "--numstat",
                    "--find-renames",
                    "-z",
                    parent,
                    hash,
                ],
            )?,
        )
    } else {
        (
            output_ok(
                path,
                &[
                    "diff-tree",
                    "--root",
                    "--no-commit-id",
                    "-r",
                    "--name-status",
                    "--find-renames",
                    "-z",
                    hash,
                ],
            )?,
            output_ok(
                path,
                &[
                    "diff-tree",
                    "--root",
                    "--no-commit-id",
                    "-r",
                    "--numstat",
                    "--find-renames",
                    "-z",
                    hash,
                ],
            )?,
        )
    };
    let stats: std::collections::HashMap<_, _> = parse_numstat(&numstat.stdout)
        .into_iter()
        .map(|(file, adds, deletes, binary)| (file, (adds, deletes, binary)))
        .collect();
    let files = parse_name_status(&name_status.stdout)?
        .into_iter()
        .map(|(status, file, old_file)| {
            let (additions, deletions, binary) = stats
                .get(&file)
                .map(|(a, d, b)| (*a, *d, *b))
                .unwrap_or((None, None, false));
            GitChangedFile {
                status: if root && status == "modified" {
                    "added".to_string()
                } else {
                    status
                },
                path: file,
                old_path: old_file,
                additions,
                deletions,
                binary,
            }
        })
        .collect();
    let message = fields[9]
        .trim_end_matches(|c| c == '\r' || c == '\n')
        .to_string();
    Ok(GitCommitDetails {
        hash: fields[0].to_string(),
        parents,
        comparison_parent,
        message,
        author: fields[2].to_string(),
        author_email: fields[3].to_string(),
        author_time: fields[4]
            .parse()
            .map_err(|_| "Invalid author timestamp".to_string())?,
        committer: fields[5].to_string(),
        committer_email: fields[6].to_string(),
        committer_time: fields[7]
            .parse()
            .map_err(|_| "Invalid commit timestamp".to_string())?,
        refs: split_refs(fields[8]),
        files,
    })
}

#[tauri::command]
pub async fn git_commit_details(
    path: String,
    hash: String,
    parent: Option<String>,
) -> Result<GitCommitDetails, String> {
    tokio::task::spawn_blocking(move || commit_details(&path, &hash, parent))
        .await
        .map_err(|e| format!("Git commit-details task failed: {e}"))?
}

fn bytes_to_text(bytes: &[u8]) -> Result<String, String> {
    const MAX_TEXT_DIFF_BYTES: usize = 8 * 1024 * 1024;
    if bytes.len() > MAX_TEXT_DIFF_BYTES {
        return Err("This file exceeds the 8 MiB text diff limit.".to_string());
    }
    if bytes.contains(&0) {
        return Err("This file is binary and cannot be displayed as text.".to_string());
    }
    String::from_utf8(bytes.to_vec())
        .map_err(|_| "This file is not valid UTF-8 text and cannot be displayed.".to_string())
}

fn stop_git_child(child: &mut std::process::Child, message: String) -> String {
    let _ = child.kill();
    let _ = child.wait();
    message
}

fn read_revision_files(path: &str, specs: &[String]) -> Result<Vec<String>, String> {
    use std::io::{BufRead, BufReader, Read, Write};
    const MAX_TEXT_DIFF_BYTES: u64 = 8 * 1024 * 1024;

    if specs.is_empty() {
        return Ok(Vec::new());
    }

    let mut child = git_cmd()
        .args(["cat-file", "--batch"])
        .current_dir(path)
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Could not start Git: {e}"))?;
    let write_result = {
        let Some(mut stdin) = child.stdin.take() else {
            return Err(stop_git_child(
                &mut child,
                "Git did not provide an input stream".to_string(),
            ));
        };
        specs.iter().try_for_each(|spec| writeln!(stdin, "{spec}"))
    };
    if let Err(error) = write_result {
        return Err(stop_git_child(
            &mut child,
            format!("Could not request Git file contents: {error}"),
        ));
    }

    let Some(stdout) = child.stdout.take() else {
        return Err(stop_git_child(
            &mut child,
            "Git did not provide an output stream".to_string(),
        ));
    };
    let mut stdout = BufReader::new(stdout);
    let mut contents = Vec::with_capacity(specs.len());
    for _ in specs {
        let mut header = Vec::with_capacity(128);
        if let Err(error) = stdout.read_until(b'\n', &mut header) {
            return Err(stop_git_child(
                &mut child,
                format!("Could not read Git object header: {error}"),
            ));
        }
        let header = match std::str::from_utf8(&header) {
            Ok(header) => header.trim_end(),
            Err(_) => {
                return Err(stop_git_child(
                    &mut child,
                    "Git returned an invalid object header".to_string(),
                ));
            }
        };
        let fields: Vec<_> = header.split_whitespace().collect();
        if fields.len() != 3 || fields[1] != "blob" {
            return Err(stop_git_child(
                &mut child,
                format!("Git could not read historical file: {header}"),
            ));
        }
        let size: u64 = match fields[2].parse() {
            Ok(size) => size,
            Err(_) => {
                return Err(stop_git_child(
                    &mut child,
                    "Git returned an invalid object size".to_string(),
                ));
            }
        };
        if size > MAX_TEXT_DIFF_BYTES {
            return Err(stop_git_child(
                &mut child,
                "This file exceeds the 8 MiB text diff limit.".to_string(),
            ));
        }
        let mut bytes = Vec::new();
        if bytes.try_reserve_exact(size as usize).is_err() {
            return Err(stop_git_child(
                &mut child,
                "Not enough memory to read this historical file.".to_string(),
            ));
        }
        let read_result = (&mut stdout)
            .take(size)
            .read_to_end(&mut bytes)
            .map_err(|e| format!("Could not read Git object contents: {e}"));
        if let Err(error) = read_result {
            return Err(stop_git_child(&mut child, error));
        }
        if bytes.len() as u64 != size {
            return Err(stop_git_child(
                &mut child,
                "Git returned incomplete historical file contents".to_string(),
            ));
        }
        let mut delimiter = [0];
        if let Err(error) = stdout.read_exact(&mut delimiter) {
            return Err(stop_git_child(
                &mut child,
                format!("Could not finish reading Git object: {error}"),
            ));
        }
        if delimiter[0] != b'\n' {
            return Err(stop_git_child(
                &mut child,
                "Git returned an invalid object delimiter".to_string(),
            ));
        }
        match bytes_to_text(&bytes) {
            Ok(text) => contents.push(text),
            Err(error) => return Err(stop_git_child(&mut child, error)),
        }
    }
    drop(stdout);
    let status = child
        .wait()
        .map_err(|e| format!("Could not wait for Git: {e}"))?;
    if !status.success() {
        let mut stderr = String::new();
        if let Some(mut pipe) = child.stderr.take() {
            let _ = pipe.read_to_string(&mut stderr);
        }
        return Err(if stderr.trim().is_empty() {
            format!("Git exited with status {status}")
        } else {
            stderr.trim().to_string()
        });
    }
    Ok(contents)
}

fn parse_diff_hunks(output: &[u8]) -> Result<Vec<GitDiffHunk>, String> {
    let output = String::from_utf8_lossy(output);
    output
        .lines()
        .filter(|line| line.starts_with("@@ "))
        .map(|line| {
            let fields: Vec<_> = line.split_whitespace().collect();
            let parse_range = |value: &str, prefix: char| -> Result<(usize, usize), String> {
                let range = value
                    .strip_prefix(prefix)
                    .ok_or_else(|| "Git returned a malformed diff hunk".to_string())?;
                let mut parts = range.splitn(2, ',');
                let start = parts
                    .next()
                    .and_then(|part| part.parse().ok())
                    .ok_or_else(|| "Git returned a malformed diff hunk".to_string())?;
                let lines = parts
                    .next()
                    .map(|part| part.parse())
                    .transpose()
                    .map_err(|_| "Git returned a malformed diff hunk".to_string())?
                    .unwrap_or(1);
                Ok((start, lines))
            };
            if fields.len() < 4 {
                return Err("Git returned a malformed diff hunk".to_string());
            }
            let (old_start, old_lines) = parse_range(fields[1], '-')?;
            let (new_start, new_lines) = parse_range(fields[2], '+')?;
            Ok(GitDiffHunk {
                old_start,
                old_lines,
                new_start,
                new_lines,
            })
        })
        .collect()
}

fn historical_diff_hunks(
    path: &str,
    old_revision: Option<&str>,
    new_revision: &str,
    old_file_path: &str,
    new_file_path: &str,
) -> Result<Vec<GitDiffHunk>, String> {
    let mut paths = vec![old_file_path, new_file_path];
    paths.sort_unstable();
    paths.dedup();
    let mut args = if let Some(old_revision) = old_revision {
        vec![
            "diff".to_string(),
            "--no-ext-diff".to_string(),
            "--no-textconv".to_string(),
            "--no-color".to_string(),
            "--unified=0".to_string(),
            "--find-renames".to_string(),
            old_revision.to_string(),
            new_revision.to_string(),
        ]
    } else {
        vec![
            "diff-tree".to_string(),
            "--root".to_string(),
            "--no-commit-id".to_string(),
            "-r".to_string(),
            "--no-ext-diff".to_string(),
            "--no-textconv".to_string(),
            "--no-color".to_string(),
            "--unified=0".to_string(),
            "--find-renames".to_string(),
            new_revision.to_string(),
        ]
    };
    args.push("--".to_string());
    args.extend(
        paths
            .into_iter()
            .map(|file_path| format!(":(literal){file_path}")),
    );
    let arg_refs: Vec<_> = args.iter().map(String::as_str).collect();
    let out = output_ok(path, &arg_refs)?;
    parse_diff_hunks(&out.stdout)
}

fn file_diff(
    path: String,
    old_revision: Option<String>,
    new_revision: Option<String>,
    old_file_path: String,
    new_file_path: String,
    old_is_empty: bool,
    new_is_empty: bool,
    new_is_working_tree: bool,
) -> Result<GitFileDiff, String> {
    validate_relative_path(&old_file_path)?;
    validate_relative_path(&new_file_path)?;
    if let Some(revision) = &old_revision {
        if revision != "HEAD" && !valid_revision(revision) {
            return Err("Invalid old file revision".to_string());
        }
    }
    if let Some(revision) = &new_revision {
        if !valid_revision(revision) {
            return Err("Invalid new file revision".to_string());
        }
    }
    let old_spec = if old_is_empty {
        None
    } else {
        let revision = old_revision.as_deref().ok_or("Old revision is missing")?;
        if revision != "HEAD" && !valid_revision(revision) {
            return Err("Invalid old file revision".to_string());
        }
        Some(format!("{revision}:{old_file_path}"))
    };
    let new_spec = if new_is_empty || new_is_working_tree {
        None
    } else {
        let revision = new_revision.as_deref().ok_or("New revision is missing")?;
        Some(format!("{revision}:{new_file_path}"))
    };
    if let Some(revision) = &new_revision {
        if !valid_revision(revision) {
            return Err("Invalid new file revision".to_string());
        }
    }
    let mut blob_specs = Vec::with_capacity(2);
    if let Some(spec) = &old_spec {
        blob_specs.push(spec.clone());
    }
    if let Some(spec) = &new_spec {
        blob_specs.push(spec.clone());
    }
    let mut blobs = read_revision_files(&path, &blob_specs)?.into_iter();
    let old_content = if old_spec.is_some() {
        blobs.next().ok_or("Git did not return the old file")?
    } else {
        String::new()
    };
    let new_content = if new_is_empty {
        String::new()
    } else if new_is_working_tree {
        let root = std::fs::canonicalize(&path)
            .map_err(|e| format!("Could not resolve repository path: {e}"))?;
        let work_path = root.join(&new_file_path);
        let resolved = std::fs::canonicalize(work_path)
            .map_err(|e| format!("Could not resolve working file: {e}"))?;
        if !resolved.starts_with(&root) {
            return Err("Working file resolves outside the repository".to_string());
        }
        let bytes =
            std::fs::read(resolved).map_err(|e| format!("Could not read working file: {e}"))?;
        bytes_to_text(&bytes)?
    } else {
        blobs.next().ok_or("Git did not return the new file")?
    };
    let hunks = if new_is_working_tree {
        None
    } else {
        Some(historical_diff_hunks(
            &path,
            old_revision.as_deref(),
            new_revision.as_deref().ok_or("New revision is missing")?,
            &old_file_path,
            &new_file_path,
        )?)
    };
    Ok(GitFileDiff {
        old_content,
        new_content,
        hunks,
    })
}

#[tauri::command]
pub async fn git_file_diff(
    path: String,
    old_revision: Option<String>,
    new_revision: Option<String>,
    old_file_path: String,
    new_file_path: String,
    old_is_empty: bool,
    new_is_empty: bool,
    new_is_working_tree: bool,
) -> Result<GitFileDiff, String> {
    tokio::task::spawn_blocking(move || {
        file_diff(
            path,
            old_revision,
            new_revision,
            old_file_path,
            new_file_path,
            old_is_empty,
            new_is_empty,
            new_is_working_tree,
        )
    })
    .await
    .map_err(|e| format!("Git diff task failed: {e}"))?
}

#[tauri::command]
pub fn git_status_files(path: String) -> Vec<StatusFile> {
    let Ok(out) = git_cmd()
        .args(["status", "--porcelain=v1", "-z", "--untracked-files=all"])
        .current_dir(&path)
        .output()
    else {
        return vec![];
    };
    if !out.status.success() {
        return vec![];
    }
    parse_status_files(&out.stdout)
}

#[tauri::command]
pub fn git_log_full(path: String) -> Vec<FullCommitEntry> {
    let Ok(out) = git_cmd()
        .args([
            "log",
            "--max-count=100",
            "--pretty=format:%h\x01%s\x01%an\x01%ar",
        ])
        .current_dir(&path)
        .output()
    else {
        return vec![];
    };
    if !out.status.success() {
        return vec![];
    }
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| {
            let mut p = l.splitn(4, '\x01');
            FullCommitEntry {
                hash: p.next().unwrap_or("").to_string(),
                subject: p.next().unwrap_or("").to_string(),
                author: p.next().unwrap_or("").to_string(),
                date: p.next().unwrap_or("").to_string(),
            }
        })
        .collect()
}

#[tauri::command]
pub fn git_commit(path: String, title: String, description: String) -> Result<String, String> {
    let stage = git_cmd()
        .args(["add", "-A"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;
    if !stage.status.success() {
        return Err(String::from_utf8_lossy(&stage.stderr).into_owned());
    }
    let mut cmd = git_cmd();
    cmd.args(["commit", "-m", &title]).current_dir(&path);
    if !description.is_empty() {
        cmd.args(["-m", &description]);
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(String::from_utf8_lossy(&out.stderr).into_owned());
    }
    Ok(String::from_utf8_lossy(&out.stdout).into_owned())
}

#[tauri::command]
pub fn git_commit_push(path: String, title: String, description: String) -> Result<String, String> {
    git_commit(path.clone(), title, description)?;
    let push = git_cmd()
        .args(["push"])
        .current_dir(&path)
        .output()
        .map_err(|e| e.to_string())?;
    if !push.status.success() {
        return Err(String::from_utf8_lossy(&push.stderr).into_owned());
    }
    Ok(String::from_utf8_lossy(&push.stdout).into_owned())
}

#[cfg(test)]
mod tests {
    use super::{
        commit_details, file_diff, git_cmd, github_repository_from_remote, history,
        parse_name_status, parse_numstat, parse_status_files, parse_status_summary, valid_revision,
        validate_relative_path,
    };
    use std::path::{Path, PathBuf};

    struct TestRepo(PathBuf);

    impl Drop for TestRepo {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }

    fn run_git(repo: &Path, args: &[&str]) -> std::process::Output {
        let out = git_cmd()
            .args(args)
            .current_dir(repo)
            .output()
            .expect("Git must be installed for repository integration tests");
        assert!(
            out.status.success(),
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&out.stderr)
        );
        out
    }

    fn new_test_repo() -> TestRepo {
        let id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let root =
            std::env::temp_dir().join(format!("r0-git-history-test-{}-{id}", std::process::id()));
        std::fs::create_dir(&root).expect("create unique temporary repository");
        run_git(&root, &["init", "--quiet"]);
        run_git(&root, &["config", "user.name", "r0 test"]);
        run_git(&root, &["config", "user.email", "r0-test@example.invalid"]);
        run_git(&root, &["config", "commit.gpgsign", "false"]);
        TestRepo(root)
    }

    fn commit_hash(repo: &Path) -> String {
        String::from_utf8_lossy(&run_git(repo, &["rev-parse", "HEAD"]).stdout)
            .trim()
            .to_string()
    }

    #[test]
    fn github_remote_parser_accepts_standard_github_remotes_only() {
        assert_eq!(
            github_repository_from_remote("https://github.com/Adshkumar/r0.git"),
            Some(("Adshkumar".to_string(), "r0".to_string()))
        );
        assert_eq!(
            github_repository_from_remote("git@github.com:Adshkumar/r0.git"),
            Some(("Adshkumar".to_string(), "r0".to_string()))
        );
        assert_eq!(
            github_repository_from_remote("https://example.com/Adshkumar/r0.git"),
            None
        );
        assert_eq!(
            github_repository_from_remote("https://github.com/owner/repo/extra"),
            None
        );
    }

    #[test]
    fn parses_porcelain_v2_status_and_ahead_count_from_one_result() {
        let output = concat!(
            "# branch.oid 0123456789abcdef\n",
            "# branch.head main\n",
            "# branch.upstream origin/main\n",
            "# branch.ab +3 -1\n",
            "1 .M N... 100644 100644 100644 abc def modified file.rs\n",
            "2 R. N... 100644 100644 100644 abc def R100 new name.rs\told name.rs\n",
            "? untracked file.rs\n",
        );
        assert_eq!(parse_status_summary(output), (3, 3));
        assert_eq!(
            parse_status_summary("# branch.oid (initial)\n# branch.head main\n? new file\n"),
            (1, 0)
        );
    }

    #[test]
    fn parses_porcelain_status_with_spaces_and_renames() {
        let files =
            parse_status_files(b"M  file name.rs\0R  new name.rs\0old name.rs\0?? untracked.txt\0");
        assert_eq!(files[0].path, "file name.rs");
        assert_eq!(files[0].status, "M");
        assert_eq!(files[1].path, "new name.rs");
        assert_eq!(files[1].old_path.as_deref(), Some("old name.rs"));
        assert_eq!(files[2].path, "untracked.txt");
        assert_eq!(files[2].status, "??");
    }

    #[test]
    fn parses_changed_and_renamed_paths_from_nul_delimited_git_output() {
        let files =
            parse_name_status(b"A\0new file.txt\0R100\0old.txt\0renamed.txt\0D\0gone.txt\0")
                .expect("valid Git name-status output");
        assert_eq!(
            files[0],
            ("added".to_string(), "new file.txt".to_string(), None)
        );
        assert_eq!(
            files[1],
            (
                "renamed".to_string(),
                "renamed.txt".to_string(),
                Some("old.txt".to_string())
            )
        );
        assert_eq!(
            files[2],
            ("deleted".to_string(), "gone.txt".to_string(), None)
        );
    }

    #[test]
    fn parses_numstat_for_tabs_renames_and_binary_files() {
        let stats = parse_numstat(b"2\t1\tfile\twith-tab.txt\0-\t-\timage.png\0");
        assert_eq!(
            stats,
            vec![
                ("file\twith-tab.txt".to_string(), Some(2), Some(1), false),
                ("image.png".to_string(), None, None, true)
            ]
        );

        let renamed = parse_numstat(b"4\t2\t\0old.txt\0new.txt\0");
        assert_eq!(renamed[0], ("new.txt".to_string(), Some(4), Some(2), false));
    }

    #[test]
    fn validates_revision_ids_and_repository_relative_paths() {
        assert!(valid_revision("a1b2c3"));
        assert!(!valid_revision("HEAD; rm -rf"));
        assert!(validate_relative_path("src/main.rs").is_ok());
        assert!(validate_relative_path("../outside.txt").is_err());
        assert!(validate_relative_path("C:\\outside.txt").is_err());
        assert!(validate_relative_path("..\\outside.txt").is_err());
        assert!(validate_relative_path("src\\..\\outside.txt").is_err());
        assert!(validate_relative_path("src\\main.rs").is_ok());
    }

    #[test]
    fn commit_details_and_file_diffs_use_the_selected_git_revisions() {
        let repo = new_test_repo();
        assert!(
            history(repo.0.to_str().expect("temporary path is UTF-8"), 0, 1)
                .expect("empty repository history")
                .is_empty()
        );
        let file = repo.0.join("file with spaces.txt");
        std::fs::write(&file, "first line\n").expect("write first revision");
        run_git(&repo.0, &["add", "--", "file with spaces.txt"]);
        run_git(&repo.0, &["commit", "--quiet", "-m", "root commit"]);
        let root_hash = commit_hash(&repo.0);
        let root_history = history(repo.0.to_str().expect("temporary path is UTF-8"), 0, 10)
            .expect("load real Git history");
        assert_eq!(root_history.len(), 1);
        assert_eq!(root_history[0].hash, root_hash);
        assert!(root_history[0].parents.is_empty());
        assert!(root_history[0].is_head);

        let root_details = commit_details(
            repo.0.to_str().expect("temporary path is UTF-8"),
            &root_hash,
            None,
        )
        .expect("load root commit details");
        assert!(root_details.parents.is_empty());
        assert_eq!(root_details.files[0].status, "added");
        assert_eq!(root_details.files[0].additions, Some(1));
        let root_diff = file_diff(
            repo.0
                .to_str()
                .expect("temporary path is UTF-8")
                .to_string(),
            None,
            Some(root_hash.clone()),
            "file with spaces.txt".to_string(),
            "file with spaces.txt".to_string(),
            true,
            false,
            false,
        )
        .expect("read the root commit against its empty tree");
        assert!(root_diff.old_content.is_empty());
        assert_eq!(root_diff.new_content, "first line\n");
        assert_eq!(
            root_diff.hunks.as_ref().map(|hunks| (
                hunks[0].old_start,
                hunks[0].old_lines,
                hunks[0].new_start,
                hunks[0].new_lines,
            )),
            Some((0, 0, 1, 1))
        );

        std::fs::write(&file, "first line\nsecond line\n").expect("write next revision");
        run_git(&repo.0, &["add", "--", "file with spaces.txt"]);
        run_git(&repo.0, &["commit", "--quiet", "-m", "second commit"]);
        let second_hash = commit_hash(&repo.0);
        let unreferenced_root = commit_details(
            repo.0.to_str().expect("temporary path is UTF-8"),
            &root_hash,
            None,
        )
        .expect("load unreferenced root commit");
        assert!(unreferenced_root.refs.is_empty());
        let details = commit_details(
            repo.0.to_str().expect("temporary path is UTF-8"),
            &second_hash,
            Some(root_hash.clone()),
        )
        .expect("load second commit details");
        assert_eq!(
            details.comparison_parent.as_deref(),
            Some(root_hash.as_str())
        );
        assert_eq!(details.files[0].additions, Some(1));
        assert_eq!(details.files[0].deletions, Some(0));

        std::fs::write(&file, "uncommitted working-tree content\n")
            .expect("change working tree without committing");
        let diff = file_diff(
            repo.0
                .to_str()
                .expect("temporary path is UTF-8")
                .to_string(),
            Some(root_hash.clone()),
            Some(second_hash.clone()),
            "file with spaces.txt".to_string(),
            "file with spaces.txt".to_string(),
            false,
            false,
            false,
        )
        .expect("read exact historical contents");
        assert_eq!(diff.old_content, "first line\n");
        assert_eq!(diff.new_content, "first line\nsecond line\n");
        assert_eq!(
            diff.hunks.as_ref().map(|hunks| (
                hunks[0].old_start,
                hunks[0].old_lines,
                hunks[0].new_start,
                hunks[0].new_lines,
            )),
            Some((1, 0, 2, 1))
        );

        let reverse_diff = file_diff(
            repo.0
                .to_str()
                .expect("temporary path is UTF-8")
                .to_string(),
            Some(second_hash.clone()),
            Some(root_hash.clone()),
            "file with spaces.txt".to_string(),
            "file with spaces.txt".to_string(),
            false,
            false,
            false,
        )
        .expect("preserve requested revision comparison order");
        assert_eq!(reverse_diff.old_content, "first line\nsecond line\n");
        assert_eq!(reverse_diff.new_content, "first line\n");
        assert_eq!(
            reverse_diff.hunks.as_ref().map(|hunks| (
                hunks[0].old_start,
                hunks[0].old_lines,
                hunks[0].new_start,
                hunks[0].new_lines,
            )),
            Some((2, 1, 1, 0))
        );

        let identical_diff = file_diff(
            repo.0
                .to_str()
                .expect("temporary path is UTF-8")
                .to_string(),
            Some(second_hash.clone()),
            Some(second_hash.clone()),
            "file with spaces.txt".to_string(),
            "file with spaces.txt".to_string(),
            false,
            false,
            false,
        )
        .expect("compare a revision with itself");
        assert!(identical_diff.hunks.as_ref().is_some_and(Vec::is_empty));

        std::fs::write(&file, "first line\nchanged line\n")
            .expect("write changed historical content");
        run_git(&repo.0, &["add", "--", "file with spaces.txt"]);
        run_git(&repo.0, &["commit", "--quiet", "-m", "replace second line"]);
        let third_hash = commit_hash(&repo.0);
        let modified_diff = file_diff(
            repo.0
                .to_str()
                .expect("temporary path is UTF-8")
                .to_string(),
            Some(second_hash.clone()),
            Some(third_hash.clone()),
            "file with spaces.txt".to_string(),
            "file with spaces.txt".to_string(),
            false,
            false,
            false,
        )
        .expect("read modified-line hunks");
        assert_eq!(modified_diff.old_content, "first line\nsecond line\n");
        assert_eq!(modified_diff.new_content, "first line\nchanged line\n");
        assert_eq!(
            modified_diff.hunks.as_ref().map(|hunks| (
                hunks[0].old_start,
                hunks[0].old_lines,
                hunks[0].new_start,
                hunks[0].new_lines,
            )),
            Some((2, 1, 2, 1))
        );

        let renamed_file = repo.0.join("renamed file.txt");
        std::fs::rename(&file, &renamed_file).expect("rename historical file");
        run_git(&repo.0, &["add", "-A"]);
        run_git(&repo.0, &["commit", "--quiet", "-m", "rename file"]);
        let fourth_hash = commit_hash(&repo.0);
        let renamed_diff = file_diff(
            repo.0
                .to_str()
                .expect("temporary path is UTF-8")
                .to_string(),
            Some(third_hash.clone()),
            Some(fourth_hash.clone()),
            "file with spaces.txt".to_string(),
            "renamed file.txt".to_string(),
            false,
            false,
            false,
        )
        .expect("read both sides of a historical rename");
        assert_eq!(renamed_diff.old_content, "first line\nchanged line\n");
        assert_eq!(renamed_diff.new_content, renamed_diff.old_content);
        assert!(renamed_diff.hunks.as_ref().is_some_and(Vec::is_empty));

        std::fs::remove_file(&renamed_file).expect("delete historical file");
        run_git(&repo.0, &["add", "-A"]);
        run_git(&repo.0, &["commit", "--quiet", "-m", "delete file"]);
        let fifth_hash = commit_hash(&repo.0);
        let deleted_diff = file_diff(
            repo.0
                .to_str()
                .expect("temporary path is UTF-8")
                .to_string(),
            Some(fourth_hash),
            Some(fifth_hash),
            "renamed file.txt".to_string(),
            "renamed file.txt".to_string(),
            false,
            true,
            false,
        )
        .expect("read historical deletion hunks");
        assert_eq!(deleted_diff.old_content, "first line\nchanged line\n");
        assert!(deleted_diff.new_content.is_empty());
        assert_eq!(
            deleted_diff.hunks.as_ref().map(|hunks| (
                hunks[0].old_start,
                hunks[0].old_lines,
                hunks[0].new_start,
                hunks[0].new_lines,
            )),
            Some((1, 2, 0, 0))
        );
    }

    #[test]
    fn historical_diff_hunks_include_only_changed_lines() {
        let repo = new_test_repo();
        let path = repo.0.join("sample.rs");
        let old_lines: Vec<_> = (1..=10).map(|line| format!("line {line}")).collect();
        std::fs::write(&path, old_lines.join("\n") + "\n").expect("write original version");
        run_git(&repo.0, &["add", "--", "sample.rs"]);
        run_git(&repo.0, &["commit", "--quiet", "-m", "original"]);
        let old_hash = commit_hash(&repo.0);

        let mut new_lines = old_lines.clone();
        new_lines[4] = "changed line 5".to_string();
        new_lines[8] = "changed line 9".to_string();
        std::fs::write(&path, new_lines.join("\n") + "\n").expect("write changed version");
        run_git(&repo.0, &["add", "--", "sample.rs"]);
        run_git(&repo.0, &["commit", "--quiet", "-m", "change two lines"]);
        let new_hash = commit_hash(&repo.0);

        let diff = file_diff(
            repo.0
                .to_str()
                .expect("temporary path is UTF-8")
                .to_string(),
            Some(old_hash),
            Some(new_hash),
            "sample.rs".to_string(),
            "sample.rs".to_string(),
            false,
            false,
            false,
        )
        .expect("load exact historical contents and Git hunks");

        let hunks = diff.hunks.expect("historical comparison has Git hunks");
        assert_eq!(hunks.len(), 2);
        assert_eq!(
            hunks
                .iter()
                .map(|hunk| (hunk.old_start, hunk.old_lines, hunk.new_start, hunk.new_lines))
                .collect::<Vec<_>>(),
            vec![(5, 1, 5, 1), (9, 1, 9, 1)]
        );
        assert_eq!(diff.old_content, old_lines.join("\n") + "\n");
        assert_eq!(diff.new_content, new_lines.join("\n") + "\n");
    }
}
