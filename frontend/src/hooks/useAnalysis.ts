import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useMonitoring } from "./useMonitoring";
import { getAnalysis } from "../utils/analysis";

export function useAnalysis() {
  const { snapshot, period } = useMonitoring();
  const { search } = useLocation();
  return useMemo(
    () => getAnalysis(snapshot, period, search),
    [snapshot, period, search],
  );
}
