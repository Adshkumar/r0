import { invoke } from '@tauri-apps/api/core';

export async function getBranch(path: string): Promise<string | null> {
  return invoke<string | null>('git_branch', { path });
}

export interface CommitEntry { hash: string; msg: string; }
export interface GitChanges { files: number; commits_ahead: number; log: CommitEntry[]; }

export async function getGitChanges(path: string): Promise<GitChanges | null> {
  try {
    return await invoke<GitChanges | null>('git_changes', { path });
  } catch {
    return null;
  }
}

export interface StatusFile { status: string; path: string; old_path?: string | null; }
export interface FullCommitEntry { hash: string; subject: string; author: string; date: string; }

export interface GitHistoryCommit {
  hash: string;
  parents: string[];
  subject: string;
  author: string;
  author_email: string;
  author_time: number;
  committer_time: number;
  refs: string[];
  is_head: boolean;
}

export interface GitChangedFile {
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
  path: string;
  old_path: string | null;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
}

export interface GitCommitDetails {
  hash: string;
  parents: string[];
  comparison_parent: string | null;
  message: string;
  author: string;
  author_email: string;
  author_time: number;
  committer: string;
  committer_email: string;
  committer_time: number;
  refs: string[];
  files: GitChangedFile[];
}

export interface GitFileDiff {
  old_content: string;
  new_content: string;
}

export function getGitHistory(path: string, skip = 0, limit = 100): Promise<GitHistoryCommit[]> {
  return invoke<GitHistoryCommit[]>('git_history', { path, skip, limit });
}

export function getGitCommitDetails(path: string, hash: string, parent: string | null): Promise<GitCommitDetails> {
  return invoke<GitCommitDetails>('git_commit_details', { path, hash, parent });
}

export function getGitFileDiff(options: {
  path: string;
  oldRevision: string | null;
  newRevision: string | null;
  oldFilePath: string;
  newFilePath: string;
  oldIsEmpty: boolean;
  newIsEmpty: boolean;
  newIsWorkingTree: boolean;
}): Promise<GitFileDiff> {
  return invoke<GitFileDiff>('git_file_diff', {
    path: options.path,
    oldRevision: options.oldRevision,
    newRevision: options.newRevision,
    oldFilePath: options.oldFilePath,
    newFilePath: options.newFilePath,
    oldIsEmpty: options.oldIsEmpty,
    newIsEmpty: options.newIsEmpty,
    newIsWorkingTree: options.newIsWorkingTree,
  });
}

export async function getStatusFiles(path: string): Promise<StatusFile[]> {
  return invoke<StatusFile[]>('git_status_files', { path }).catch(() => []);
}

export async function getGitLogFull(path: string): Promise<FullCommitEntry[]> {
  return invoke<FullCommitEntry[]>('git_log_full', { path }).catch(() => []);
}

export async function gitCommit(path: string, title: string, description: string): Promise<void> {
  await invoke('git_commit', { path, title, description });
}

export async function gitCommitPush(path: string, title: string, description: string): Promise<void> {
  await invoke('git_commit_push', { path, title, description });
}
