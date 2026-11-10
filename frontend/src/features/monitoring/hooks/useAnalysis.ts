import { useContext } from "react";
import { AnalysisContext } from "@/features/monitoring/contexts/AnalysisContext";

export function useAnalysis() {
  const analysis = useContext(AnalysisContext);
  if (!analysis) throw new Error("useAnalysis precisa de AnalysisProvider.");
  return analysis;
}
