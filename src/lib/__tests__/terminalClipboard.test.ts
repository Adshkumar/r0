import { describe, expect, it, vi } from 'vitest';
import { handleTerminalClipboardShortcut } from '../terminalClipboard';

function event(
  key: string,
  options: Partial<KeyboardEvent> = {},
): KeyboardEvent {
  return {
    type: 'keydown',
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...options,
  } as KeyboardEvent;
}

describe('terminal clipboard shortcuts', () => {
  it('copies selected output on Ctrl+C without interrupting the shell', () => {
    const copy = vi.fn();
    const paste = vi.fn();

    expect(handleTerminalClipboardShortcut(event('c', { ctrlKey: true }), true, { copy, paste })).toBe(false);
    expect(copy).toHaveBeenCalledOnce();
    expect(paste).not.toHaveBeenCalled();
  });

  it('passes Ctrl+C through to the PTY when there is no selection', () => {
    const copy = vi.fn();

    expect(handleTerminalClipboardShortcut(event('c', { ctrlKey: true }), false, { copy, paste: vi.fn() })).toBe(true);
    expect(copy).not.toHaveBeenCalled();
  });

  it.each([
    event('v', { ctrlKey: true }),
    event('v', { ctrlKey: true, shiftKey: true }),
    event('Insert', { shiftKey: true }),
  ])('intercepts paste shortcuts and prevents sending them to the PTY', shortcut => {
    const paste = vi.fn();

    expect(handleTerminalClipboardShortcut(shortcut, false, { copy: vi.fn(), paste })).toBe(false);
    expect(paste).toHaveBeenCalledOnce();
  });
});
