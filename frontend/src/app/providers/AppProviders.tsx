import type { ReactNode } from "react";
import { MonitoringProvider } from "@/features/monitoring/providers/MonitoringProvider";
import { SettingsProvider } from "@/shared/preferences/SettingsProvider";
import { AuthProvider } from "@/features/auth/AuthProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <AuthProvider><MonitoringProvider>{children}</MonitoringProvider></AuthProvider>
    </SettingsProvider>
  );
}
