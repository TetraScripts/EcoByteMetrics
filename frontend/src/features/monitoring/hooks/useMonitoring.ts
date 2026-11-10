import { useContext } from "react";
import { MonitoringContext } from "@/features/monitoring/contexts/MonitoringContext";

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (!context) throw new Error("useMonitoring requires AppProviders");
  return context;
}
