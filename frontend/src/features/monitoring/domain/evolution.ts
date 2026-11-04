import type { CollectionPoint } from "../types.ts";
import type { DashboardMetric } from "./dashboard.ts";
import { mergeCollectionHistory, summarizeCollections } from "./history.ts";

export type EvolutionMode = "intervals" | "cumulative";
export interface EvolutionPoint { timestamp: number; value: number | null; gap: boolean; reason?: string; from?: number; to?: number; intervalFrom?: number; intervalTo?: number }

export function evolutionData(history: CollectionPoint[], metric: DashboardMetric, mode: EvolutionMode) {
  const samples = mergeCollectionHistory([], history).filter(point => Number.isFinite(Date.parse(point.collectedAt)))
    .sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt));
  let first: number | null = null, last: number | null = null;
  const services = new Set<string>();
  for (const sample of samples) {
    const timestamp = Date.parse(sample.collectedAt);
    const sampleStart = Date.parse(sample.firstCollectedAt ?? sample.collectedAt);
    first = first === null ? sampleStart : Math.min(first, sampleStart);
    last = last === null ? timestamp : Math.max(last, timestamp);
    services.add(sample.serviceId);
  }
  const span = (last ?? 0) - (first ?? 0);
  const intervalMs = Math.max(span <= 3600_000 ? 30_000 : span <= 86400_000 ? 300_000 : 3600_000,
    ...samples.map(sample => (sample.bucketSeconds ?? 30) * 1000));
  const buckets = new Map<number, { timestamp: number; first: number; last: number; total: number; count: number; covered: number }>();
  let batchStart = -Infinity;
  for (const sample of samples) {
    const collectedAt = Date.parse(sample.collectedAt);
    // Agrupa aplicações próximas sem criar lacunas pela virada de um bloco no relógio.
    if (collectedAt - batchStart >= intervalMs / 2) batchStart = collectedAt;
    const key = intervalMs === 30_000 ? batchStart : Math.floor(collectedAt / intervalMs) * intervalMs;
    const bucket = buckets.get(key) ?? { timestamp: key, first: Date.parse(sample.firstCollectedAt ?? sample.collectedAt), last: collectedAt, total: 0, count: 0, covered: 0 };
    bucket.first = Math.min(bucket.first, Date.parse(sample.firstCollectedAt ?? sample.collectedAt));
    bucket.last = collectedAt;
    if (intervalMs === 30_000) bucket.timestamp = collectedAt;
    const value = metric === "energy" ? sample.energyKwh : sample.emissionsG;
    bucket.count += sample.sampleCount ?? 1;
    if (value !== null && Number.isFinite(value)) {
      bucket.total += value;
      bucket.covered += metric === "energy" ? sample.sampleCount ?? 1 : sample.emissionCount ?? 1;
    }
    buckets.set(key, bucket);
  }
  let total = 0, count = 0, covered = 0, previous: number | null = null;
  const points: EvolutionPoint[] = [...buckets.values()].map(bucket => {
    total += bucket.total;
    count += bucket.count;
    covered += bucket.covered;
    const included = mode === "cumulative" ? covered : bucket.covered;
    const available = mode === "cumulative" ? count : bucket.count;
    const value = included > 0 ? mode === "cumulative" ? total : bucket.total : null;
    const gap = previous === null || bucket.first - previous > intervalMs * 1.5;
    previous = bucket.last;
    const intervalFrom = intervalMs === 30_000 ? bucket.first : bucket.timestamp;
    return { timestamp: bucket.timestamp, value, gap, intervalFrom, intervalTo: intervalMs === 30_000 ? bucket.last + 1 : intervalFrom + intervalMs, from: mode === "cumulative" ? first ?? bucket.first : bucket.first, to: bucket.last, ...(included < available ? {
      reason: `Há amostras sem fator de carbono registrado. ${mode === "cumulative" ? "O acumulado" : "O intervalo"} considera ${included} de ${available} amostras; as demais não são tratadas como emissão zero.`,
    } : {}) };
  });
  return { points, intervalMs, first, last, serviceCount: services.size, summary: summarizeCollections(samples) };
}

export function nearestEvolutionPoint(points: EvolutionPoint[], timestamp: number) {
  let low = 0, high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (points[middle]!.timestamp < timestamp) low = middle + 1;
    else high = middle;
  }
  return low > 0 && timestamp - points[low - 1]!.timestamp < points[low]!.timestamp - timestamp ? low - 1 : low;
}
