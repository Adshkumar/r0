import { describe, expect, it } from 'vitest';
import { lspNotificationEventName } from '../lsp';

describe('LSP workspace routing', () => {
  it('uses a stable UTF-8 workspace key for notification event names', () => {
    expect(lspNotificationEventName('typescript', 'C:\\work\\rø')).toBe(
      'lsp-notification-typescript-433a5c776f726b5c72c3b8',
    );
  });

  it('keeps notification channels separate across workspaces and languages', () => {
    const firstWorkspace = lspNotificationEventName('typescript', 'C:\\work\\one');
    expect(lspNotificationEventName('typescript', 'C:\\work\\two')).not.toBe(firstWorkspace);
    expect(lspNotificationEventName('rust', 'C:\\work\\one')).not.toBe(firstWorkspace);
    expect(lspNotificationEventName('typescript', 'C:\\work\\one')).toBe(firstWorkspace);
  });
});
