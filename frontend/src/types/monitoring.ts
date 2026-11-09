export type ServiceStatus =
  | "available"
  | "unavailable"
  | "no-metrics"
  | "removed";
export const serviceStatusLabels: Record<ServiceStatus, string> = {
  available: "Disponível",
  unavailable: "Indisponível",
  "no-metrics": "Sem métricas",
  removed: "Removido",
};

export function isPeriod(value: unknown): value is Period {
  return value === "24h" || value === "7d";
}

export type Period = "24h" | "7d";

export interface RequestRecord {
  url: string;
  status: number | null;
  outcome: "response" | "timeout" | "cancelled" | "network-error";
  durationMs: number;
  completedAt: string;
}

export interface ResearchRegion {
  code: string;
  country: string;
  region: string;
  city: string | null;
  latitude?: number;
  longitude?: number;
}

export interface CarbonRegion extends ResearchRegion {
  carbonIntensity: number;
  renewablePercent: number;
}

export interface MonitoredService {
  id: string;
  name: string;
  status: ServiceStatus;
  country: string | null;
  region: string | null;
  regionCode?: string;
  city: string | null;
  cpuPercent: number | null;
  memoryGb: number | null;
  diskGb: number | null;
  networkGb: number | null;
  energyKwh: number | null;
  emissionsG: number | null;
  latitude?: number;
  longitude?: number;
  renewablePercent?: number | null;
  carbonIntensity?: number | null;
  collectionIntervalSeconds?: number | null;
  lastCollectionAt?: string | null;
  statusMessage?: string;
}

export interface CollectionPoint {
  serviceId: string;
  regionCode?: string;
  country?: string | null;
  city?: string | null;
  collectedAt: string;
  cycleAt?: string;
  cycleId?: string;
  energyKwh: number;
  emissionsG: number | null;
  intervalSeconds?: number;
}

export interface MonitoringSnapshot {
  regions: CarbonRegion[];
  services: MonitoredService[];
  history: CollectionPoint[];
  totalEnergyKwh: number | null;
  totalEmissionsG: number | null;
  lastCollectionAt: string | null;
  discoveryUpdatedAt?: string | null;
  discoveryComplete?: boolean;
  warning?: string;
}

export interface MonitoringSettings {
  parallaxEnabled: boolean;
  defaultPeriod: Period;
}
