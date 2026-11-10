import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SettingsContext } from "./SettingsContext";
import { readSettings } from "./settings";

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings] = useState(readSettings);
  const value = useMemo(() => ({ settings }), [settings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
