import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSelectors } from "@/utils/zustand-selectors";

interface PerformanceExperiments {
  showMonitor: boolean;
  actions: {
    toggleMonitor: () => void;
  };
}

export const usePerformanceExperiments = createSelectors(
  create<PerformanceExperiments>()(
    persist(
      (set) => ({
        showMonitor: false,
        actions: {
          toggleMonitor: () => set((state) => ({ showMonitor: !state.showMonitor })),
        },
      }),
      {
        name: "r0-performance-experiments",
        partialize: ({ showMonitor }) => ({ showMonitor }),
      },
    ),
  ),
);
