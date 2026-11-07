import type { MonitoringSnapshot, ResearchRegion } from "../types/monitoring";

export function getSelectableRegions(snapshot: Pick<MonitoringSnapshot, "regions" | "services">): ResearchRegion[] {
  // Adding a selectable location never supplies an emission factor.
  const regions = new Map<string, ResearchRegion>(snapshot.regions.map(region => [region.code, region]));
  for (const service of snapshot.services) {
    if (service.status === "removed" || !service.regionCode || !service.country || regions.has(service.regionCode)) continue;
    regions.set(service.regionCode, {
      code: service.regionCode,
      country: service.country,
      region: service.region || service.regionCode,
      city: service.city,
      latitude: service.latitude,
      longitude: service.longitude,
    });
  }
  return [...regions.values()];
}
