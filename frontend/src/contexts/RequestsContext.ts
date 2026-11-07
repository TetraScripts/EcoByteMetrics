import { createContext } from "react";
import type { RequestRecord } from "../types/monitoring";

export const RequestsContext = createContext<{
  requests: RequestRecord[];
  clearRequests: () => void;
} | null>(null);
