import { invoke } from '@tauri-apps/api/core';

export async function getBranch(path: string): Promise<string | null> {
  return invoke<string | null>('git_branch', { path });
}

export async function getGitRemoteUrl(path: string): Promise<string | null> {
  return invoke<string | null>('git_remote_url', { path });
}

export interface GitHubCommitAuthorAvatar {
  login: string;
  avatar_url: string;
}

interface GitHubAvatarCacheEntry {
  value: GitHubCommitAuthorAvatar | null;
  expiresAt: number;
}

const githubAvatarCache = new Map<string, GitHubAvatarCacheEntry>();
const githubAvatarRequests = new Map<string, Promise<GitHubCommitAuthorAvatar | null>>();

export function getGitHubCommitAuthorAvatar(
  remoteUrl: string,
  hash: string,
): Promise<GitHubCommitAuthorAvatar | null> {
  const key = `${remoteUrl}\u0000${hash}`;
  const cached = githubAvatarCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  if (cached) githubAvatarCache.delete(key);

  const pending = githubAvatarRequests.get(key);
  if (pending) return pending;

  const request = invoke<GitHubCommitAuthorAvatar | null>('git_github_commit_author_avatar', {
    remoteUrl,
    hash,
  }).then(value => {
    githubAvatarCache.set(key, {
      value,
      expiresAt: Date.now() + (value ? 12 * 60 * 60 * 1000 : 15 * 60 * 1000),
    });
    return value;
  }).finally(() => {
    if (githubAvatarRequests.get(key) === request) githubAvatarRequests.delete(key);
  });
  githubAvatarRequests.set(key, request);
  return request;
}

export interface CommitEntry { hash: string; msg: string; }
export interface GitChanges { files: number; commits_ahead: number; log: CommitEntry[]; }

export interface GitRepositoryChangedEvent {
  path: string;
  operation: 'commit' | 'commit-push' | 'filesystem-change';
}

const GIT_REPOSITORY_CHANGED = 'r0:git-repository-changed';

function notifyGitRepositoryChanged(detail: GitRepositoryChangedEvent): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<GitRepositoryChangedEvent>(GIT_REPOSITORY_CHANGED, { detail }));
  }
}

export function onGitRepositoryChanged(
  listener: (event: GitRepositoryChangedEvent) => void,
): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<GitRepositoryChangedEvent>).detail);
  window.addEventListener(GIT_REPOSITORY_CHANGED, handler);
  return () => window.removeEventListener(GIT_REPOSITORY_CHANGED, handler);
}

export function notifyGitFilesystemChanged(path: string): void {
  invalidateGitCache(path);
  notifyGitRepositoryChanged({ path, operation: 'filesystem-change' });
}

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
  hunks: GitDiffHunk[] | null;
}

export interface GitDiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  size: number;
}

const historyCache = new Map<string, CacheEntry<GitHistoryCommit[]>>();
const detailsCache = new Map<string, CacheEntry<GitCommitDetails>>();
const diffCache = new Map<string, CacheEntry<GitFileDiff>>();
const inFlight = new Map<string, Promise<unknown>>();
const repositoryVersions = new Map<string, number>();
let cachedDiffBytes = 0;
const MAX_CACHED_DIFF_BYTES = 16 * 1024 * 1024;

function readCache<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    if (cache === diffCache) cachedDiffBytes -= entry.size;
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.value;
}

function writeCache<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  maxEntries: number,
  size = 0,
): void {
  const previous = cache.get(key);
  if (previous) cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + 30_000, size });
  while (cache.size > maxEntries) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function getRepositoryVersion(path: string): number {
  return repositoryVersions.get(path) ?? 0;
}

async function cachedRequest<T>(
  key: string,
  cache: Map<string, CacheEntry<T>>,
  load: () => Promise<T>,
  maxEntries: number,
  sizeOf?: (value: T) => number,
  shouldCache = true,
): Promise<T> {
  const existing = readCache(cache, key);
  if (existing !== null) return existing;
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const versionKey = key.slice(0, key.indexOf('\u0000'));
  const version = getRepositoryVersion(versionKey);
  const request = load();
  inFlight.set(key, request);
  try {
    const value = await request;
    if (shouldCache && getRepositoryVersion(versionKey) === version) {
      const size = sizeOf?.(value) ?? 0;
      if (cache !== diffCache || size <= MAX_CACHED_DIFF_BYTES) {
        if (cache === diffCache) {
          const previous = diffCache.get(key);
          if (previous) cachedDiffBytes -= previous.size;
          while (cachedDiffBytes + size > MAX_CACHED_DIFF_BYTES && diffCache.size) {
            const oldest = diffCache.keys().next().value as string | undefined;
            if (oldest === undefined) break;
            const entry = diffCache.get(oldest);
            if (entry) cachedDiffBytes -= entry.size;
            diffCache.delete(oldest);
          }
          cachedDiffBytes += size;
        }
        writeCache(cache, key, value, maxEntries, size);
      }
    }
    return value;
  } finally {
    if (inFlight.get(key) === request) inFlight.delete(key);
  }
}

export function invalidateGitCache(path: string): void {
  repositoryVersions.set(path, getRepositoryVersion(path) + 1);
  const prefix = `${path}\u0000`;
  for (const key of historyCache.keys()) {
    if (key.startsWith(prefix)) historyCache.delete(key);
  }
  for (const key of detailsCache.keys()) {
    if (key.startsWith(prefix)) detailsCache.delete(key);
  }
  for (const [key, entry] of diffCache) {
    if (key.startsWith(prefix)) {
      cachedDiffBytes -= entry.size;
      diffCache.delete(key);
    }
  }
  for (const key of inFlight.keys()) {
    if (key.startsWith(prefix)) inFlight.delete(key);
  }
}

export function getGitHistory(path: string, skip = 0, limit = 100): Promise<GitHistoryCommit[]> {
  const key = `${path}\u0000history:${skip}:${limit}`;
  return cachedRequest(
    key,
    historyCache,
    () => invoke<GitHistoryCommit[]>('git_history', { path, skip, limit }),
    12,
  );
}

export function getGitCommitDetails(path: string, hash: string, parent: string | null): Promise<GitCommitDetails> {
  const key = `${path}\u0000details:${hash}:${parent ?? ''}`;
  return cachedRequest(
    key,
    detailsCache,
    () => invoke<GitCommitDetails>('git_commit_details', { path, hash, parent }),
    100,
  );
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
  const request = {
    path: options.path,
    oldRevision: options.oldRevision,
    newRevision: options.newRevision,
    oldFilePath: options.oldFilePath,
    newFilePath: options.newFilePath,
    oldIsEmpty: options.oldIsEmpty,
    newIsEmpty: options.newIsEmpty,
    newIsWorkingTree: options.newIsWorkingTree,
  };
  const key = `${options.path}\u0000diff:${JSON.stringify(request)}`;
  const immutable = !options.newIsWorkingTree
    && options.oldRevision !== 'HEAD'
    && options.newRevision !== 'HEAD';
  return cachedRequest(
    key,
    diffCache,
    () => invoke<GitFileDiff>('git_file_diff', request),
    Number.MAX_SAFE_INTEGER,
    value => (value.old_content.length + value.new_content.length) * 2,
    immutable,
  );
}

export async function getStatusFiles(path: string): Promise<StatusFile[]> {
  return invoke<StatusFile[]>('git_status_files', { path });
}

export async function getGitLogFull(path: string): Promise<FullCommitEntry[]> {
  return invoke<FullCommitEntry[]>('git_log_full', { path }).catch(() => []);
}

export async function gitCommit(path: string, title: string, description: string): Promise<void> {
  await invoke('git_commit', { path, title, description });
  invalidateGitCache(path);
  notifyGitRepositoryChanged({ path, operation: 'commit' });
}

export async function gitCommitPush(path: string, title: string, description: string): Promise<void> {
  try {
    await invoke('git_commit_push', { path, title, description });
  } finally {
    invalidateGitCache(path);
    notifyGitRepositoryChanged({ path, operation: 'commit-push' });
  }
}
