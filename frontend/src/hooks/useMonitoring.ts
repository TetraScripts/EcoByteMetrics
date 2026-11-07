import { useContext } from "react";
import { MonitoringContext } from "../contexts/MonitoringContext";

export function useMonitoring() {
  const context = useContext(MonitoringContext);
  if (!context) throw new Error("useMonitoring requires AppProviders");
  return context;
}
