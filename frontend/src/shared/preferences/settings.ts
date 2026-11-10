import { isPeriod } from "@/shared/lib/period";
import type { Period } from "@/shared/lib/period";

export interface AppSettings {
  parallaxEnabled: boolean;
  defaultPeriod: Period;
}

const SETTINGS_KEY = "ecobytemetrics.preferences.v1";
const DEFAULT_SETTINGS: AppSettings = {
  parallaxEnabled: true,
  defaultPeriod: "7d",
};

export function readSettings(): AppSettings {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(SETTINGS_KEY) ?? "null",
    );
    if (
      typeof stored === "object" &&
      stored !== null &&
      "parallaxEnabled" in stored &&
      typeof stored.parallaxEnabled === "boolean" &&
      "defaultPeriod" in stored
    ) {
      return {
        parallaxEnabled: stored.parallaxEnabled,
        defaultPeriod: isPeriod(stored.defaultPeriod)
          ? stored.defaultPeriod
          : DEFAULT_SETTINGS.defaultPeriod,
      };
    }
  } catch {
    /* Armazenamento indisponível ou preferências inválidas. */
  }
  return DEFAULT_SETTINGS;
}
