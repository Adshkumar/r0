const USAGE_KEY = "r0_ai_usage";

export interface ModelUsage {
  modelId:          string;
  modelName:        string;
  providerId:       string;
  inputTokens:      number;
  outputTokens:     number;
  cacheReadTokens?: number;
  cost:             number;
  color:            string;
}

export type UsageStore = Record<string, ModelUsage>;

const usageListeners = new Set<(usage: UsageStore) => void>();

export function readUsage(): UsageStore {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    return raw ? (JSON.parse(raw) as UsageStore) : {};
  } catch {
    return {};
  }
}

function notifyUsageChanged(): void {
  const usage = readUsage();
  for (const listener of usageListeners) listener(usage);
}

export function subscribeUsageChanges(listener: (usage: UsageStore) => void): () => void {
  usageListeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === USAGE_KEY || event.key === null) listener(readUsage());
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    usageListeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

export function recordUsage(
  modelId:          string,
  modelName:        string,
  providerId:       string,
  inputTokens:      number,
  outputTokens:     number,
  cost:             number,
  color:            string,
  cacheReadTokens?: number,
): void {
  const store = readUsage();
  const existing = store[modelId];
  store[modelId] = {
    modelId,
    modelName,
    providerId,
    inputTokens:      (existing?.inputTokens      ?? 0) + inputTokens,
    outputTokens:     (existing?.outputTokens     ?? 0) + outputTokens,
    cacheReadTokens:  (existing?.cacheReadTokens  ?? 0) + (cacheReadTokens ?? 0),
    cost:             (existing?.cost             ?? 0) + cost,
    color,
  };
  try {
    localStorage.setItem(USAGE_KEY, JSON.stringify(store));
  } catch {
    return; // Storage may be full.
  }
  notifyUsageChanged();
}

export function resetUsage(): void {
  localStorage.removeItem(USAGE_KEY);
  notifyUsageChanged();
}

export function getTotalCost(): number {
  return Object.values(readUsage()).reduce((sum, m) => sum + m.cost, 0);
}
