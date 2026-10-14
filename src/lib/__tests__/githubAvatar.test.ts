import { describe, expect, it } from 'vitest';
import { calculatePopoverPosition, getGitHubAvatarUrl, resolveGitHubLoginFromEmail } from '../githubAvatar';

describe('github avatar resolution', () => {
  it('resolves GitHub noreply emails to a profile URL', () => {
    expect(resolveGitHubLoginFromEmail('12345+octocat@users.noreply.github.com')).toBe('octocat');
    expect(getGitHubAvatarUrl('12345+octocat@users.noreply.github.com')).toBe('https://github.com/octocat.png?size=64');
  });

  it('falls back to null when the email is not a verified GitHub account', () => {
    expect(getGitHubAvatarUrl('someone@gmail.com')).toBeNull();
    expect(resolveGitHubLoginFromEmail('someone@gmail.com')).toBeNull();
  });
});

describe('popover positioning', () => {
  it('prefers the right side when it fits and stays inside the viewport', () => {
    const targetRect = { top: 100, left: 200, right: 260, bottom: 140, width: 60, height: 40 } as DOMRect;
    const position = calculatePopoverPosition({
      targetRect,
      cardWidth: 220,
      cardHeight: 150,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(position.left).toBeGreaterThan(targetRect.right + 15);
    expect(position.left).toBeLessThanOrEqual(800 - 12 - 220);
    expect(position.top).toBeGreaterThanOrEqual(12);
  });

  it('moves the card to the left when the right side is too close to the viewport edge', () => {
    const targetRect = { top: 100, left: 700, right: 760, bottom: 140, width: 60, height: 40 } as DOMRect;
    const position = calculatePopoverPosition({
      targetRect,
      cardWidth: 220,
      cardHeight: 150,
      viewportWidth: 800,
      viewportHeight: 600,
    });
    expect(position.left).toBeLessThan(targetRect.left);
    expect(position.left).toBeGreaterThanOrEqual(12);
    expect(position.top).toBeGreaterThanOrEqual(12);
    expect(position.top + 150).toBeLessThanOrEqual(600 - 12);
  });
});
