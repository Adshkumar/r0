import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mockInvoke }));

import { getGitHubCommitAuthorAvatar } from '../git';

describe('GitHub commit author avatars', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('deduplicates concurrent lookups and reuses the resolved avatar', async () => {
    const avatar = {
      login: 'octocat',
      avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
    };
    mockInvoke.mockResolvedValue(avatar);

    const remote = `https://github.com/r0-avatar-cache-test/${Date.now()}.git`;
    const [first, concurrent] = await Promise.all([
      getGitHubCommitAuthorAvatar(remote, 'f'.repeat(40)),
      getGitHubCommitAuthorAvatar(remote, 'f'.repeat(40)),
    ]);
    const cached = await getGitHubCommitAuthorAvatar(remote, 'f'.repeat(40));

    expect(first).toEqual(avatar);
    expect(concurrent).toEqual(avatar);
    expect(cached).toEqual(avatar);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('git_github_commit_author_avatar', {
      remoteUrl: remote,
      hash: 'f'.repeat(40),
    });
  });

  it('caches unresolved authors to avoid repeating negative lookups', async () => {
    mockInvoke.mockResolvedValue(null);
    const remote = `https://github.com/r0-avatar-miss-test/${Date.now()}.git`;

    await expect(getGitHubCommitAuthorAvatar(remote, 'e'.repeat(40))).resolves.toBeNull();
    await expect(getGitHubCommitAuthorAvatar(remote, 'e'.repeat(40))).resolves.toBeNull();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
