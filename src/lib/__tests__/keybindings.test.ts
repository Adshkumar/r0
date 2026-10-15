import { describe, expect, it } from 'vitest';
import { COMMANDS, isAllowedInTextEntry, matchesEvent } from '../keybindings';

function keyEvent(key: string, options: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...options,
  } as KeyboardEvent;
}

describe('global shortcut defaults', () => {
  it('uses distinct command palette and quick-open shortcuts', () => {
    expect(COMMANDS.find(command => command.id === 'r0.togglePalette')?.defaultKey).toBe('ctrl+shift+p');
    expect(COMMANDS.find(command => command.id === 'r0.quickOpen')?.defaultKey).toBe('ctrl+p');
  });

  it('matches the VS Code-style navigation shortcuts', () => {
    expect(matchesEvent(keyEvent('p', { ctrlKey: true, shiftKey: true }), 'ctrl+shift+p')).toBe(true);
    expect(matchesEvent(keyEvent('p', { ctrlKey: true }), 'ctrl+p')).toBe(true);
    expect(matchesEvent(keyEvent('j', { ctrlKey: true }), 'ctrl+j')).toBe(true);
    expect(matchesEvent(keyEvent('e', { ctrlKey: true, shiftKey: true }), 'ctrl+shift+e')).toBe(true);
    expect(matchesEvent(keyEvent('g', { ctrlKey: true, shiftKey: true }), 'ctrl+shift+g')).toBe(true);
    expect(matchesEvent(keyEvent('x', { ctrlKey: true, shiftKey: true }), 'ctrl+shift+x')).toBe(true);
    expect(matchesEvent(keyEvent('f', { ctrlKey: true, shiftKey: true }), 'ctrl+shift+f')).toBe(true);
    expect(COMMANDS.find(command => command.id === 'r0.reloadWindow')?.defaultKey).toBe('ctrl+r');
    expect(matchesEvent(keyEvent('r', { ctrlKey: true }), 'ctrl+r')).toBe(true);
  });

  it('allows saving while focused in a text entry without enabling other shortcuts', () => {
    expect(isAllowedInTextEntry('r0.save')).toBe(true);
    expect(isAllowedInTextEntry('r0.togglePalette')).toBe(true);
    expect(isAllowedInTextEntry('r0.closeTab')).toBe(false);
  });
});
