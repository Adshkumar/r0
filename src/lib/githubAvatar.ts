const loginCache = new Map<string, { value: string | null; expiresAt: number }>();
const avatarCache = new Map<string, { value: string | null; expiresAt: number }>();

function cachedLookup<T>(cache: Map<string, { value: T; expiresAt: number }>, key: string, produce: () => T): T {
  const existing = cache.get(key);
  const now = Date.now();
  if (existing && existing.expiresAt > now) return existing.value;
  const value = produce();
  cache.set(key, { value, expiresAt: now + 24 * 60 * 60 * 1000 });
  return value;
}

export function resolveGitHubLoginFromEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  return cachedLookup(loginCache, normalized, () => {
    const match = normalized.match(/^(?:\d+\+)?([a-z0-9-]+)@users\.noreply\.github\.com$/i);
    if (!match) return null;
    const login = match[1];
    return login && login !== 'noreply' ? login : null;
  });
}

export function getGitHubAvatarUrl(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  return cachedLookup(avatarCache, normalized, () => {
    const login = resolveGitHubLoginFromEmail(normalized);
    if (!login) return null;
    return `https://github.com/${login}.png?size=64`;
  });
}

export function calculatePopoverPosition({
  targetRect,
  cardWidth,
  cardHeight,
  gap = 16,
  padding = 12,
  viewportWidth,
  viewportHeight,
}: {
  targetRect: DOMRect;
  cardWidth: number;
  cardHeight: number;
  gap?: number;
  padding?: number;
  viewportWidth: number;
  viewportHeight: number;
}): { left: number; top: number } {
  const safeCardWidth = Math.max(0, cardWidth || 0);
  const safeCardHeight = Math.max(0, cardHeight || 0);
  const maxLeft = Math.max(padding, viewportWidth - padding - safeCardWidth);
  const maxTop = Math.max(padding, viewportHeight - padding - safeCardHeight);

  const spaceOnRight = viewportWidth - targetRect.right - padding;
  const spaceOnLeft = targetRect.left - padding;
  const preferRight = spaceOnRight >= safeCardWidth + gap || spaceOnLeft < safeCardWidth + gap;

  const left = preferRight
    ? Math.min(targetRect.right + gap, maxLeft)
    : Math.max(targetRect.left - safeCardWidth - gap, padding);

  const top = Math.min(
    Math.max(targetRect.top + (targetRect.height - safeCardHeight) / 2, padding),
    maxTop,
  );

  return {
    left: Math.min(Math.max(left, padding), Math.max(padding, maxLeft)),
    top: Math.min(Math.max(top, padding), Math.max(padding, maxTop)),
  };
}
