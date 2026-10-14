import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readUsage, recordUsage, resetUsage, subscribeUsageChanges } from '../usage';

describe('usage change subscriptions', () => {
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => { values.delete(key); },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('publishes same-window usage changes immediately and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUsageChanges(listener);

    recordUsage('test-model', 'Test model', 'test-provider', 10, 5, 0.02, '#fff');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(readUsage());
    expect(listener.mock.lastCall?.[0]['test-model'].cost).toBe(0.02);

    unsubscribe();
    recordUsage('test-model', 'Test model', 'test-provider', 1, 1, 0.01, '#fff');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('publishes reset changes immediately', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeUsageChanges(listener);
    recordUsage('test-model', 'Test model', 'test-provider', 10, 5, 0.02, '#fff');
    listener.mockClear();

    resetUsage();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({});
    unsubscribe();
  });
});
