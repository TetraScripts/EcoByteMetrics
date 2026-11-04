import type { CollectionPoint, MonitoredService } from "@/features/monitoring/types";

export function latestCollections(services: MonitoredService[]): CollectionPoint[] {
  return services.flatMap(service => service.energyKwh !== null && service.lastCollectionAt && Number.isFinite(Date.parse(service.lastCollectionAt)) ? [{
    serviceId: service.id, collectedAt: service.lastCollectionAt,
    energyKwh: service.energyKwh, emissionsG: service.emissionsG,
    intervalSeconds: service.collectionIntervalSeconds ?? undefined,
  }] : []);
}

interface HistoryIndex {
  positions: Map<string, number>;
  oldestTimestamp: number;
}

const emptyHistory: CollectionPoint[] = [];
const historyIndexes = new WeakMap<CollectionPoint[], HistoryIndex>();
historyIndexes.set(emptyHistory, {
  positions: new Map(),
  oldestTimestamp: Infinity,
});

export function mergeCollectionHistory(
  previous: CollectionPoint[],
  incoming: CollectionPoint[],
  minimumTimestamp = -Infinity,
): CollectionPoint[] {
  let indexed = historyIndexes.get(previous);
  if (!indexed) {
    previous = mergeCollectionHistory(emptyHistory, previous);
    indexed = historyIndexes.get(previous)!;
  }
  // A retenção só percorre a lista quando há registros vencidos.
  if (indexed.oldestTimestamp < minimumTimestamp) {
    previous = mergeCollectionHistory(
      emptyHistory,
      previous.filter((point) => Date.parse(point.collectedAt) >= minimumTimestamp),
    );
    indexed = historyIndexes.get(previous)!;
  }
  let history = previous;
  let positions = indexed.positions;
  let oldestTimestamp = indexed.oldestTimestamp;
  const copyHistory = () => {
    if (history === previous) {
      history = previous.slice();
      positions = new Map(positions);
    }
  };
  for (const point of incoming) {
    const timestamp = Date.parse(point.collectedAt);
    if (timestamp < minimumTimestamp) continue;
    // Identificação de amostras repetidas no cache do backend.
    const key = JSON.stringify([point.serviceId, timestamp]);
    const index = positions.get(key);
    if (index === undefined) {
      copyHistory();
      positions.set(key, history.length);
      history.push(point);
      oldestTimestamp = Math.min(oldestTimestamp, timestamp);
      continue;
    }
    const existing = history[index]!;
    // Um fator recuperado pode completar as emissões da mesma amostra.
    if (existing.emissionsG === null && point.emissionsG !== null &&
      existing.energyKwh === point.energyKwh &&
      existing.intervalSeconds === point.intervalSeconds &&
      existing.regionCode === point.regionCode) {
      copyHistory();
      history[index] = { ...existing, emissionsG: point.emissionsG };
    }
  }
  historyIndexes.set(history, { positions, oldestTimestamp });
  return history;
}

export function collectionRange(points: CollectionPoint[]) {
  let first: number | null = null, last: number | null = null;
  for (const point of points) {
    const from = Date.parse(point.firstCollectedAt ?? point.collectedAt), to = Date.parse(point.collectedAt);
    if (!Number.isFinite(from) || !Number.isFinite(to)) continue;
    first = first === null ? from : Math.min(first, from);
    last = last === null ? to : Math.max(last, to);
  }
  return { first, last };
}

export function summarizeCollections(points: CollectionPoint[]) {
  let energy = 0,
    emissions = 0,
    seconds = 0,
    count = 0,
    emissionCount = 0;
  for (const point of points) {
    energy += point.energyKwh;
    count += point.sampleCount ?? 1;
    seconds += point.intervalSeconds ?? 0;
    if (point.emissionsG !== null) {
      emissions += point.emissionsG;
      emissionCount += point.emissionCount ?? 1;
    }
  }
  const energyKwh = points.length && Number.isFinite(energy) ? energy : null;
  const emissionsG =
    emissionCount && Number.isFinite(emissions) ? emissions : null;
  return {
    energyKwh,
    emissionsG,
    count,
    emissionCount,
    seconds,
    energyPerHourKwh:
      seconds > 0 && energyKwh !== null ? (energyKwh * 3600) / seconds : null,
    emissionsPerHourG:
      seconds > 0 && emissionCount === count && emissionsG !== null
        ? (emissionsG * 3600) / seconds
        : null,
  };
}
