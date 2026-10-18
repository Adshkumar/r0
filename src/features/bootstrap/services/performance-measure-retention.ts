const MAX_RETAINED_PERFORMANCE_MEASURES = 500;
const PERFORMANCE_MEASURE_CLEANUP_INTERVAL_MS = 15_000;

interface PerformanceMeasureStore {
  clearMeasures: () => void;
  getEntriesByType: (type: string) => PerformanceEntry[];
}

type PerformanceCleanupRegistry = typeof globalThis & {
  r0PerformanceMeasureCleanup?: () => void;
};

export function clearExcessPerformanceMeasures(
  measureStore: PerformanceMeasureStore = performance,
): boolean {
  if (measureStore.getEntriesByType("measure").length <= MAX_RETAINED_PERFORMANCE_MEASURES) {
    return false;
  }

  measureStore.clearMeasures();
  return true;
}

export function installDevelopmentPerformanceMeasureCleanup(): () => void {
  const registry = globalThis as PerformanceCleanupRegistry;
  registry.r0PerformanceMeasureCleanup?.();

  const clearExcessMeasures = () => clearExcessPerformanceMeasures();
  const clearWhenHidden = () => {
    if (document.visibilityState === "hidden") {
      performance.clearMeasures();
    }
  };
  const intervalId = window.setInterval(
    clearExcessMeasures,
    PERFORMANCE_MEASURE_CLEANUP_INTERVAL_MS,
  );

  document.addEventListener("visibilitychange", clearWhenHidden);

  const cleanup = () => {
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", clearWhenHidden);
    if (registry.r0PerformanceMeasureCleanup === cleanup) {
      delete registry.r0PerformanceMeasureCleanup;
    }
  };

  registry.r0PerformanceMeasureCleanup = cleanup;
  return cleanup;
}
