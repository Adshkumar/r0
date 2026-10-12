import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import {
  getGitFileDiff,
  getGitHistory,
  invalidateGitCache,
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
});
