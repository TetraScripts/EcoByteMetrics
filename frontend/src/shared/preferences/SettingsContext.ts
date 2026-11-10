import { createContext } from "react";
import type { AppSettings } from "./settings";

export interface SettingsContextValue {
  settings: AppSettings;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);
