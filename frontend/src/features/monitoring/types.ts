import type { ResearchRegion } from "@/shared/geography/types";

export type ServiceStatus =
  | "available"
  | "stale"
  | "unavailable"
  | "no-metrics"
  | "removed";
export const serviceStatusLabels: Record<ServiceStatus, string> = {
  available: "Disponível",
  stale: "Dados desatualizados",
  unavailable: "Indisponível",
  "no-metrics": "Sem métricas",
  removed: "Removido",
};

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
  sampleCount?: number;
  emissionCount?: number;
  bucketSeconds?: number;
  firstCollectedAt?: string;
}

export interface MonitoringSnapshot {
  historyIncluded?: boolean;
  source?: "database";
  historyPeriod?: "24h" | "7d";
  historyUntil?: string;
  selectedAt?: string | null;
  refreshedAt?: string;
  observations?: MonitoringObservation[];
  collectionEvents?: CollectionEvent[];
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

export interface CollectionEvent {
  from: string;
  to: string;
  kind: "tab-hidden" | "monitoring-inactive" | "request-failed" | "no-new-samples" | "service-unavailable" | "metrics-missing";
  serviceIds?: string[];
}

export interface MonitoringObservation {
  observedAt: string;
  collectionCount?: number;
  services: MonitoredService[];
  samples: CollectionPoint[];
  warning?: string;
}
