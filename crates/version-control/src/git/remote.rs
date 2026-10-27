use crate::git::{GitCommand, GitRemote, IntoStringError, RepositoryHost};
use anyhow::{Context, Result, bail};
use git2::Repository;
use std::path::Path;

pub fn git_clone(repository_url: String, destination_path: String) -> Result<(), String> {
   _git_clone(repository_url, destination_path).into_string_error()
}

fn _git_clone(repository_url: String, destination_path: String) -> Result<()> {
   let repository_url = repository_url.trim();
   if repository_url.is_empty() {
      bail!("Repository URL cannot be empty");
   }
   if repository_url.starts_with('-') {
      bail!("Repository URL cannot start with an option prefix");
   }
   if repository_url
      .as_bytes()
      .get(..5)
      .is_some_and(|prefix| prefix.eq_ignore_ascii_case(b"ext::"))
   {
      bail!("The ext transport can execute local commands and is not allowed");
   }

   let destination = Path::new(&destination_path);
   if !destination.is_absolute() {
      bail!("Clone destination must be an absolute path");
   }
   if destination.exists() {
      bail!("Clone destination already exists");
   }

   let parent = destination
      .parent()
      .context("Clone destination must have a parent directory")?;
   if !parent.is_dir() {
      bail!("Clone destination parent does not exist");
   }

   let host = RepositoryHost::detect(&parent.to_string_lossy());
   let command = remote_git_command(&host);
   let destination_argument = command.argument_path(&destination_path);
   command
      .arg("clone")
      .arg(repository_url)
      .arg(destination_argument)
      .run("clone")?;

   Ok(())
}

pub fn git_push(repo_path: String, branch: Option<String>, remote: String) -> Result<(), String> {
   _git_push(repo_path, branch, remote).into_string_error()
}

/// A git command that never waits for interactive credential prompts.
fn remote_git_command(host: &RepositoryHost) -> GitCommand {
   host
      .git()
      .env("GIT_TERMINAL_PROMPT", "0")
      .env("GCM_INTERACTIVE", "never")
      .env("SSH_ASKPASS_REQUIRE", "never")
      .env("GIT_SSH_COMMAND", "ssh -oBatchMode=yes")
}

pub(crate) fn execute_remote_git_command(
   repo_path: &str,
   args: &[&str],
   operation: &str,
) -> Result<()> {
   remote_git_command(&RepositoryHost::detect(repo_path))
      .args(args)
      .run(operation)?;
   Ok(())
}

fn _git_push(repo_path: String, branch: Option<String>, remote: String) -> Result<()> {
   if branch.is_none()
      && let Some(branch) = current_branch_without_upstream(&repo_path)?
   {
      return execute_remote_git_command(
         &repo_path,
         &["push", "--set-upstream", &remote, &branch],
         "push",
      );
   }

   let mut args = vec!["push", &remote];
   let branch_str;
   if let Some(b) = branch {
      branch_str = b;
      args.push(&branch_str);
   }

   execute_remote_git_command(&repo_path, &args, "push")
}

fn current_branch_without_upstream(repo_path: &str) -> Result<Option<String>> {
   let host = RepositoryHost::detect(repo_path);
   let output = remote_git_command(&host)
      .args(["status", "--porcelain=v2", "--branch"])
      .run("status")?;
   let output = String::from_utf8_lossy(&output.stdout);
   let branch = output.lines().find_map(|line| {
      line
         .strip_prefix("# branch.head ")
         .filter(|name| *name != "(detached)")
         .map(str::to_string)
   });
   if output
      .lines()
      .any(|line| line == "# branch.head (detached)")
   {
      bail!("Cannot push from detached HEAD. Create or switch to a branch before pushing.");
   }
   let has_upstream = output
      .lines()
      .any(|line| line.starts_with("# branch.upstream "));

   Ok(if has_upstream { None } else { branch })
}

pub fn git_pull(repo_path: String, branch: Option<String>, remote: String) -> Result<(), String> {
   _git_pull(repo_path, branch, remote).into_string_error()
}

fn _git_pull(repo_path: String, branch: Option<String>, remote: String) -> Result<()> {
   let mut args = vec!["pull", &remote];
   let branch_str;
   if let Some(b) = branch {
      branch_str = b;
      args.push(&branch_str);
   }

   execute_remote_git_command(&repo_path, &args, "pull")
}

pub fn git_fetch(repo_path: String, remote: Option<String>) -> Result<(), String> {
   _git_fetch(repo_path, remote).into_string_error()
}

fn _git_fetch(repo_path: String, remote: Option<String>) -> Result<()> {
   let mut args = vec!["fetch"];
   let remote_str;
   if let Some(r) = remote {
      remote_str = r;
      args.push(&remote_str);
   }

   execute_remote_git_command(&repo_path, &args, "fetch")
}

pub fn git_get_remotes(repo_path: String) -> Result<Vec<GitRemote>, String> {
   _git_get_remotes(repo_path).into_string_error()
}

fn _git_get_remotes(repo_path: String) -> Result<Vec<GitRemote>> {
   let repo = Repository::open(&repo_path).context("Failed to open repository")?;
   let remote_names = repo.remotes().context("Failed to get remote names")?;

   let mut remotes = Vec::new();
   for name in remote_names.iter().flatten() {
      let remote = repo.find_remote(name).context("Failed to find remote")?;
      if let Some(url) = remote.url() {
         remotes.push(GitRemote {
            name: name.to_string(),
            url: url.to_string(),
         });
      }
   }

   Ok(remotes)
}

pub fn git_add_remote(repo_path: String, name: String, url: String) -> Result<(), String> {
   _git_add_remote(repo_path, name, url).into_string_error()
}

fn _git_add_remote(repo_path: String, name: String, url: String) -> Result<()> {
   let host = RepositoryHost::detect(&repo_path);
   if host.uses_distro_git() {
      host
         .git()
         .args(["remote", "add", &name, &url])
         .run("remote add")?;
      return Ok(());
   }

   let repo = Repository::open(&repo_path).context("Failed to open repository")?;
   repo.remote(&name, &url).context("Failed to add remote")?;
   Ok(())
}

pub fn git_remove_remote(repo_path: String, name: String) -> Result<(), String> {
   _git_remove_remote(repo_path, name).into_string_error()
}

fn _git_remove_remote(repo_path: String, name: String) -> Result<()> {
   let host = RepositoryHost::detect(&repo_path);
   if host.uses_distro_git() {
      host
         .git()
         .args(["remote", "remove", &name])
         .run("remote remove")?;
      return Ok(());
   }

   let repo = Repository::open(&repo_path).context("Failed to open repository")?;
   repo
      .remote_delete(&name)
      .context("Failed to remove remote")?;
   Ok(())
}

#[cfg(test)]
mod tests {
   use super::*;
   use git2::{BranchType, Signature};
   use std::fs;

   #[test]
   fn first_push_sets_upstream_for_current_branch() {
      let temp_dir = tempfile::tempdir().unwrap();
      let repo_path = temp_dir.path().join("repo");
      let remote_path = temp_dir.path().join("remote.git");
      fs::create_dir(&repo_path).unwrap();
      Repository::init_bare(&remote_path).unwrap();

      let repo = Repository::init(&repo_path).unwrap();
      let signature = Signature::now("Test User", "test@example.com").unwrap();
      fs::write(repo_path.join("README.md"), "test").unwrap();
      let mut index = repo.index().unwrap();
      index.add_path(Path::new("README.md")).unwrap();
      let tree_id = index.write_tree().unwrap();
      let tree = repo.find_tree(tree_id).unwrap();
      let commit_id = repo
         .commit(
            Some("refs/heads/main"),
            &signature,
            &signature,
            "Initial commit",
            &tree,
            &[],
         )
         .unwrap();
      repo.set_head("refs/heads/main").unwrap();
      repo
         .config()
         .unwrap()
         .set_str("push.default", "simple")
         .unwrap();
      repo
         .remote("origin", remote_path.to_str().unwrap())
         .unwrap();

      _git_push(
         repo_path.to_string_lossy().into_owned(),
         None,
         "origin".to_string(),
      )
      .unwrap();

      let branch = repo.find_branch("main", BranchType::Local).unwrap();
      let upstream = branch.upstream().unwrap();
      assert_eq!(upstream.name().unwrap(), Some("origin/main"));
      assert_eq!(upstream.get().target(), Some(commit_id));

      _git_push(
         repo_path.to_string_lossy().into_owned(),
         None,
         "origin".to_string(),
      )
      .unwrap();
   }

   #[test]
   fn clone_rejects_empty_repository_urls() {
      let result = _git_clone(" ".to_string(), "/tmp/r0-clone-target".to_string());
      assert!(result.is_err());
   }

   #[test]
   fn clone_requires_an_absolute_destination() {
      let result = _git_clone(
         "https://github.com/Adshkumar/r0.git".to_string(),
         "r0-clone-target".to_string(),
      );
      assert!(result.is_err());
   }

   #[test]
   fn clone_rejects_ext_transport_urls() {
      let result = _git_clone(
         "ext::sh -c cp".to_string(),
         "/tmp/r0-clone-target".to_string(),
      );
      assert!(result.unwrap_err().to_string().contains("ext transport"));
      let result = _git_clone(
         "EXT::sh -c cp".to_string(),
         "/tmp/r0-clone-target".to_string(),
      );
      assert!(result.unwrap_err().to_string().contains("ext transport"));
   }
}
