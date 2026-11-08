import { createContext } from "react";
import type { MonitoringSnapshot, Period } from "../types/monitoring";

export interface MonitoringContextValue {
  snapshot: MonitoringSnapshot;
  period: Period;
  setPeriod: (period: Period) => void;
  refresh: () => Promise<MonitoringSnapshot | null>;
  loading: boolean;
  error: string | null;
}

export const MonitoringContext = createContext<MonitoringContextValue | null>(
  null,
);
