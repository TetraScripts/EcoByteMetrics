import type { MonitoredService, MonitoringSnapshot } from "../types.ts";
import { mergeCollectionHistory, summarizeCollections } from "./history.ts";
import { appendObservation } from "./observatory.ts";
import { isCollectionStale, STALE_METRICS_MESSAGE } from "./freshness.ts";
import { appendCollectionEvents, responseCollectionEvents } from "./collectionEvents.ts";

export const REFRESH_INTERVAL_MS = 30_000;

export function isMonitoringPath(pathname: string) {
  return ["/dashboard", "/comparar"].includes(pathname.replace(/\/+$/, ""));
}

export function needsMonitoringHistory(params: URLSearchParams, historyOpen = false) {
  if (historyOpen) return true;
  if (params.has("servico")) return params.get("detalhe") === "evolucao";
  return params.get("aba") === "evolucao" || params.get("aba") === "comparar" && params.get("comparacao") !== "ultima";
}

const metricKeys = ["cpuPercent", "memoryGb", "diskGb", "networkGb", "energyKwh", "emissionsG", "collectionIntervalSeconds", "carbonIntensity", "renewablePercent", "lastCollectionAt"] as const;

function preserveSample(previous: MonitoredService | undefined, incoming: MonitoredService): MonitoredService {
  if (!previous) return incoming;
  if (incoming.status === "removed") return { ...incoming, lastCollectionAt: incoming.lastCollectionAt ?? previous.lastCollectionAt };
  const older = incoming.lastCollectionAt && previous.lastCollectionAt && Date.parse(incoming.lastCollectionAt) < Date.parse(previous.lastCollectionAt);
  if (incoming.energyKwh !== null && !older) return incoming;
  if (previous.energyKwh === null) return { ...incoming, lastCollectionAt: incoming.lastCollectionAt ?? previous.lastCollectionAt };
  const retained = Object.fromEntries(metricKeys.map(key => [key, previous[key]]));
  return {
    ...incoming, ...retained,
    status: older ? "stale" : incoming.status,
    statusMessage: [older ? "O backend retornou uma coleta anterior à última recebida." : incoming.statusMessage,
      "Exibindo os recursos da última coleta válida; eles não representam uma nova amostra."].filter(Boolean).join(" "),
  };
}

export function mergeMonitoringSnapshot(previous: MonitoringSnapshot, incoming: MonitoringSnapshot, observedAt: string, requestedAt = observedAt): MonitoringSnapshot {
  if (incoming.source === "database") return {
    ...incoming, refreshedAt: observedAt,
    observations: incoming.selectedAt && previous.source === "database" && previous.historyPeriod === incoming.historyPeriod && previous.observations?.length
      ? previous.observations : incoming.observations,
  };
  const byId = new Map(previous.services.map(service => [service.id, service]));
  const ids = new Set(incoming.services.map(service => service.id));
  const services: MonitoredService[] = [
    ...incoming.services.map(service => preserveSample(byId.get(service.id), service)),
    ...previous.services.filter(service => !ids.has(service.id)).map(service => incoming.discoveryComplete === false ? service : {
      ...service, status: "removed" as const,
      cpuPercent: null, memoryGb: null, diskGb: null, networkGb: null,
      energyKwh: null, emissionsG: null, collectionIntervalSeconds: null, carbonIntensity: null, renewablePercent: null,
      statusMessage: "Serviço ausente do registro atual.",
    }),
  ];
  const lastCollectionAt = incoming.lastCollectionAt && (!previous.lastCollectionAt || Date.parse(incoming.lastCollectionAt) > Date.parse(previous.lastCollectionAt))
    ? incoming.lastCollectionAt : previous.lastCollectionAt;
  const history = mergeCollectionHistory(previous.history, incoming.history, Date.parse(lastCollectionAt ?? incoming.discoveryUpdatedAt ?? observedAt) - 30 * 86400_000);
  const totals = summarizeCollections(history);
  return {
    ...incoming, services, lastCollectionAt, refreshedAt: observedAt,
    totalEnergyKwh: totals.energyKwh, totalEmissionsG: totals.emissionsG,
    collectionEvents: appendCollectionEvents(previous.collectionEvents, responseCollectionEvents(previous, incoming, requestedAt, observedAt)),
    observations: appendObservation(previous.observations ?? [], observedAt, services, incoming.history, incoming.warning),
    history,
  };
}

export function markStaleServices(services: MonitoredService[], now = Date.now()): MonitoredService[] {
  return services.map(service => service.status === "available" && service.lastCollectionAt && isCollectionStale(service.lastCollectionAt, service.collectionIntervalSeconds ?? 0, now)
    ? { ...service, status: "stale", statusMessage: [STALE_METRICS_MESSAGE, service.statusMessage].filter(Boolean).join(" ") }
    : service);
}
