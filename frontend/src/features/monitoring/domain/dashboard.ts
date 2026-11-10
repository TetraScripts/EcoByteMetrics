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
