import { useContext } from "react";
import { SettingsContext } from "@/shared/preferences/SettingsContext";

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings requires AppProviders");
  return context;
}
