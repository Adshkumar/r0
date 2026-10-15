import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import {
  getGitFileDiff,
  getGitHistory,
  gitCommit,
  gitCommitPush,
  invalidateGitCache,
  notifyGitFilesystemChanged,
  onGitRepositoryChanged,
  type GitHistoryCommit,
} from '../git';

const history: GitHistoryCommit[] = [{
  hash: 'a'.repeat(40),
  parents: [],
  subject: 'root',
  author: 'Test',
  author_email: 'test@example.invalid',
  author_time: 1,
  committer_time: 1,
  refs: [],
  is_head: true,
}];

describe('Git immutable-data cache', () => {
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    invalidateGitCache('C:\\repo');
  });

  it('deduplicates history requests and invalidates them on repository refresh', async () => {
    vi.mocked(invoke).mockImplementation(async <T,>() => history as T);

    const first = await getGitHistory('C:\\repo', 0, 100);
    const cached = await getGitHistory('C:\\repo', 0, 100);
    expect(first).toEqual(history);
    expect(cached).toBe(first);
    expect(invoke).toHaveBeenCalledTimes(1);

    invalidateGitCache('C:\\repo');
    await getGitHistory('C:\\repo', 0, 100);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('does not cache mutable working-tree diffs', async () => {
    vi.mocked(invoke).mockImplementation(async <T,>() => ({
      old_content: 'before\n',
      new_content: 'after\n',
    }) as T);

    const options = {
      path: 'C:\\repo',
      oldRevision: 'HEAD',
      newRevision: null,
      oldFilePath: 'file.txt',
      newFilePath: 'file.txt',
      oldIsEmpty: false,
      newIsEmpty: false,
      newIsWorkingTree: true,
    };
    await getGitFileDiff(options);
    await getGitFileDiff(options);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it('notifies subscribers after a successful commit', async () => {
    const eventTarget = new EventTarget();
    vi.stubGlobal('window', eventTarget);
    vi.mocked(invoke).mockResolvedValue(undefined);
    const listener = vi.fn();
    const unsubscribe = onGitRepositoryChanged(listener);

    await gitCommit('C:\\repo', 'message', '');

    expect(listener).toHaveBeenCalledWith({ path: 'C:\\repo', operation: 'commit' });
    unsubscribe();
  });

  it('invalidates and notifies after commit-and-push even when the push reports failure', async () => {
    const eventTarget = new EventTarget();
    vi.stubGlobal('window', eventTarget);
    vi.mocked(invoke).mockRejectedValue(new Error('push failed'));
    const listener = vi.fn();
    const unsubscribe = onGitRepositoryChanged(listener);

    await expect(gitCommitPush('C:\\repo', 'message', '')).rejects.toThrow('push failed');

    expect(listener).toHaveBeenCalledWith({ path: 'C:\\repo', operation: 'commit-push' });
    unsubscribe();
  });

  it('invalidates repository state and notifies subscribers for filesystem changes', () => {
    const eventTarget = new EventTarget();
    vi.stubGlobal('window', eventTarget);
    const listener = vi.fn();
    const unsubscribe = onGitRepositoryChanged(listener);

    notifyGitFilesystemChanged('C:\\repo');

    expect(listener).toHaveBeenCalledWith({ path: 'C:\\repo', operation: 'filesystem-change' });
    unsubscribe();
  });
});
