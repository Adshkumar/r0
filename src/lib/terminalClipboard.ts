export interface TerminalClipboardActions {
  copy: () => void;
  paste: () => void;
}

export function handleTerminalClipboardShortcut(
  event: Pick<KeyboardEvent, 'type' | 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
  hasSelection: boolean,
  actions: TerminalClipboardActions,
): boolean {
  if (event.type !== 'keydown') {
    if ((event.ctrlKey || event.metaKey) && ['c', 'v'].includes(event.key.toLowerCase())) return false;
    if (event.shiftKey && event.key === 'Insert') return false;
    return true;
  }

  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;
  if (modifier && key === 'c') {
    if (hasSelection) actions.copy();
    if (event.metaKey && !event.ctrlKey) return false;
    return !event.shiftKey && !hasSelection;
  }
  if ((modifier && key === 'v') || (event.shiftKey && event.key === 'Insert')) {
    actions.paste();
    return false;
  }
  return true;
}
