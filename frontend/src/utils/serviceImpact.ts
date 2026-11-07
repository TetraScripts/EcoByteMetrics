import type { CollectionPoint, MonitoredService } from "../types/monitoring";
import { mergeCollectionHistory, summarizeCollections } from "./history";

export type ImpactMetric = "energy" | "emissions";

export function rankServiceImpact(
  points: CollectionPoint[],
  services: Pick<MonitoredService, "id" | "name">[],
  metric: ImpactMetric,
) {
  const names = new Map(services.map(service => [service.id, service.name]));
  const groups = new Map<string, CollectionPoint[]>();
  for (const point of mergeCollectionHistory([], points)) {
    const group = groups.get(point.serviceId);
    if (group) group.push(point);
    else groups.set(point.serviceId, [point]);
  }
  let omittedCount = 0;
  const entries = [...groups].flatMap(([id, samples]) => {
    const summary = summarizeCollections(samples);
    const value = metric === "energy"
      ? summary.energyKwh
      : summary.emissionCount === summary.count ? summary.emissionsG : null;
    if (value === null || !Number.isFinite(value) || value < 0) {
      omittedCount++;
      return [];
    }
    return [{ id, name: names.get(id) || id, value, count: summary.count, seconds: summary.seconds }];
  });
  entries.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR") || a.id.localeCompare(b.id));
  return { entries, omittedCount };
}
