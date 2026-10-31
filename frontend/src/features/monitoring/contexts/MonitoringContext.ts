import { createContext } from "react";
import type { MonitoringSnapshot } from "@/features/monitoring/types";
import type { Period } from "@/shared/lib/period";

export interface MonitoringContextValue {
  snapshot: MonitoringSnapshot;
  period: Period;
  setPeriod: (period: Period) => void;
  refresh: () => Promise<MonitoringSnapshot | null>;
  loading: boolean;
  error: string | null;
  setHistoryOpen: (open: boolean) => void;
}

export const MonitoringContext = createContext<MonitoringContextValue | null>(
  null,
);
