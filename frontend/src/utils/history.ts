import type { CollectionPoint } from "../types/monitoring";

export function mergeCollectionHistory(
  previous: CollectionPoint[],
  incoming: CollectionPoint[],
) {
  const seen = new Map<string, number>();
  const history: CollectionPoint[] = [];
  for (const point of [...previous, ...incoming]) {
    // Polling the backend cache again does not represent a new measurement.
    const key = JSON.stringify([point.serviceId, Date.parse(point.collectedAt)]);
    const index = seen.get(key);
    if (index === undefined) {
      seen.set(key, history.length);
      history.push(point);
      continue;
    }
    const existing = history[index]!;
    // A recovered factor may complete this same sample, keeping its energy and cycle.
    if (existing.emissionsG === null && point.emissionsG !== null &&
      existing.energyKwh === point.energyKwh &&
      existing.intervalSeconds === point.intervalSeconds &&
      existing.regionCode === point.regionCode)
      history[index] = { ...existing, emissionsG: point.emissionsG };
  }
  return history;
}

export function summarizeCollections(points: CollectionPoint[]) {
  let energy = 0,
    emissions = 0,
    seconds = 0,
    emissionCount = 0;
  for (const point of points) {
    energy += point.energyKwh;
    seconds += point.intervalSeconds ?? 0;
    if (point.emissionsG !== null) {
      emissions += point.emissionsG;
      emissionCount++;
    }
  }
  const energyKwh = points.length && Number.isFinite(energy) ? energy : null;
  const emissionsG =
    emissionCount && Number.isFinite(emissions) ? emissions : null;
  return {
    energyKwh,
    emissionsG,
    count: points.length,
    emissionCount,
    seconds,
    energyPerHourKwh:
      seconds > 0 && energyKwh !== null ? (energyKwh * 3600) / seconds : null,
    emissionsPerHourG:
      seconds > 0 && emissionCount === points.length && emissionsG !== null
        ? (emissionsG * 3600) / seconds
        : null,
  };
}

const cycleKey = (point: CollectionPoint) =>
  point.cycleId ?? point.cycleAt ?? point.collectedAt;

export function aggregateCollections(
  points: CollectionPoint[],
  metric: "energy" | "emissions",
) {
  const cycles = new Map<
    string,
    { id: string; collectedAt: string; value: number }
  >();
  for (const point of points) {
    const value = metric === "energy" ? point.energyKwh : point.emissionsG;
    if (value === null) continue;
    const id = cycleKey(point);
    const cycle = cycles.get(id);
    if (!cycle) cycles.set(id, { id, collectedAt: point.collectedAt, value });
    else {
      cycle.value += value;
      if (Date.parse(point.collectedAt) > Date.parse(cycle.collectedAt))
        cycle.collectedAt = point.collectedAt;
    }
  }
  return [...cycles.values()];
}

export function commonCollectionPoints(
  points: CollectionPoint[],
  serviceIds: string[],
) {
  const selected = new Set(serviceIds);
  if (!selected.size) return [];
  const cycles = new Map<string, Set<string>>();
  for (const point of points) {
    if (!selected.has(point.serviceId)) continue;
    const key = cycleKey(point);
    const ids = cycles.get(key) ?? new Set<string>();
    ids.add(point.serviceId);
    cycles.set(key, ids);
  }
  return points.filter(
    (point) =>
      selected.has(point.serviceId) &&
      cycles.get(cycleKey(point))?.size === selected.size,
  );
}
