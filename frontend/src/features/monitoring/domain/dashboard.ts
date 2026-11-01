import type { CollectionPoint, MonitoredService } from "../types.ts";
import { mergeCollectionHistory, summarizeCollections } from "./history.ts";

export type DashboardMetric = "emissions" | "energy";
export const statusColors = {
  available: "#00b96b", stale: "#f2ad26", "no-metrics": "#99a7b3",
  unavailable: "#f43e48", removed: "#77828b",
};

export function filterApplications(services: MonitoredService[], search: string, status: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const query = normalize(search.trim());
  return services.filter(service =>
    (!status || service.status === status) &&
    (!query || normalize([service.name, service.id, service.country, service.region, service.city].filter(Boolean).join(" ")).includes(query)),
  );
}

export function applicationImpacts(services: MonitoredService[], history: CollectionPoint[], metric: DashboardMetric, removedLast = false) {
  const samples = new Map<string, CollectionPoint[]>();
  for (const point of mergeCollectionHistory([], history)) {
    const group = samples.get(point.serviceId);
    if (group) group.push(point);
    else samples.set(point.serviceId, [point]);
  }
  return services.map(service => {
    const summary = summarizeCollections(samples.get(service.id) ?? []);
    return { service, summary, value: metric === "energy" ? summary.energyKwh : summary.emissionsG };
  }).sort((a, b) =>
    (removedLast ? Number(a.service.status === "removed") - Number(b.service.status === "removed") : 0) ||
    (a.value === null ? b.value === null ? a.service.name.localeCompare(b.service.name, "pt-BR") : 1
      : b.value === null ? -1 : b.value - a.value || a.service.name.localeCompare(b.service.name, "pt-BR")),
  );
}

export function groupServiceLocations(services: MonitoredService[]) {
  const groups = new Map<string, { id: string; name: string; latitude: number; longitude: number; countryCode: string; services: MonitoredService[]; color: string; count: number }>();
  const priority = ["available", "no-metrics", "stale", "unavailable"];
  for (const service of services) {
    const { latitude, longitude } = service;
    if (service.status === "removed" || latitude === undefined || longitude === undefined ||
      !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    const id = latitude.toFixed(4) + "," + longitude.toFixed(4);
    let group = groups.get(id);
    if (!group) {
      group = { id, name: service.city || service.region || service.name, latitude, longitude, countryCode: "", services: [], color: statusColors[service.status], count: 0 };
      groups.set(id, group);
    }
    group.services.push(service);
    group.count++;
    const mostUrgent = group.services.reduce((current, entry) => priority.indexOf(entry.status) > priority.indexOf(current.status) ? entry : current);
    group.color = statusColors[mostUrgent.status];
  }
  return [...groups.values()];
}

export function serviceLocationPeers(services: MonitoredService[], selected: MonitoredService) {
  return groupServiceLocations(services).find(group => group.services.some(service => service.id === selected.id))?.services ?? [selected];
}

export function collectionSeries(history: CollectionPoint[], metric: DashboardMetric, cumulative = false) {
  const ordered = mergeCollectionHistory([], history).map(sample => ({ sample, timestamp: Date.parse(sample.collectedAt) }))
    .filter(entry => Number.isFinite(entry.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
  const points: { timestamp: number; value: number | null; gap: boolean }[] = [];
  let total = 0;
  let complete = true;
  let previousTime: number | null = null;
  for (const { sample, timestamp } of ordered) {
    const value = metric === "energy" ? sample.energyKwh : sample.emissionsG;
    if (value === null || !Number.isFinite(value)) {
      complete = false;
      const last = points.at(-1);
      if (cumulative && last?.timestamp === timestamp) last.value = null;
      else points.push({ timestamp, value: null, gap: true });
      previousTime = null;
      continue;
    }
    total += value;
    const gap = !cumulative && (previousTime === null || timestamp - previousTime > Math.max(90_000, (sample.intervalSeconds ?? 30) * 3000));
    const last = points.at(-1);
    if (cumulative && last?.timestamp === timestamp) last.value = complete ? total : null;
    else points.push({ timestamp, value: cumulative ? complete ? total : null : value, gap });
    previousTime = timestamp;
  }
  return points;
}

// Preserve extremos e interrupções, limitando apenas os elementos do SVG.
export function chartSeries(points: ReturnType<typeof collectionSeries>, limit = 360) {
  if (points.length <= limit) return points;
  const result: typeof points = [];
  const bucketSize = Math.ceil(points.length / Math.max(1, Math.floor(limit / 4)));
  for (let start = 0; start < points.length; start += bucketSize) {
    const bucket = points.slice(start, start + bucketSize);
    let min = 0, max = 0;
    for (let index = 1; index < bucket.length; index++) {
      if (bucket[index]!.value !== null && (bucket[min]!.value === null || bucket[index]!.value! < bucket[min]!.value!)) min = index;
      if (bucket[index]!.value !== null && (bucket[max]!.value === null || bucket[index]!.value! > bucket[max]!.value!)) max = index;
    }
    const discontinuous = bucket.some(point => point.value === null || point.gap);
    const indices = [...new Set([0, min, max, bucket.length - 1])].sort((a, b) => a - b);
    for (const index of indices) result.push({ ...bucket[index]!, gap: discontinuous || bucket[index]!.gap });
  }
  return result;
}
