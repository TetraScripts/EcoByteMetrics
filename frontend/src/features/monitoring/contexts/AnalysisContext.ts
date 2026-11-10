import { createContext } from "react";
import type { getAnalysis } from "@/features/monitoring/domain/analysis";

export const AnalysisContext = createContext<ReturnType<typeof getAnalysis> | null>(null);
