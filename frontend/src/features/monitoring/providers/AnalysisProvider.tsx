import { useMemo } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AnalysisContext } from "@/features/monitoring/contexts/AnalysisContext";
import { useMonitoring } from "@/features/monitoring/hooks/useMonitoring";
import { analysisQuery, getAnalysis } from "@/features/monitoring/domain/analysis";

export function AnalysisProvider({ children }: { children: ReactNode }) {
  const { snapshot, period } = useMonitoring();
  const { search } = useLocation();
  const query = analysisQuery(search).toString();
  const analysis = useMemo(
    () => getAnalysis(snapshot, period, query),
    [snapshot, period, query],
  );

  return (
    <AnalysisContext.Provider value={analysis}>
      {children}
    </AnalysisContext.Provider>
  );
}
