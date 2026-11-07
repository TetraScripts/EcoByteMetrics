import { createContext } from "react";
import type { MonitoringSettings } from "../types/monitoring";

export interface SettingsContextValue {
  settings: MonitoringSettings;
  saveSettings: (settings: MonitoringSettings) => boolean;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);
