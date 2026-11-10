import { performance } from "node:perf_hooks";
import process from "node:process";
import assert from "node:assert/strict";
import { applicationImpacts, chartSeries, collectionSeries } from "../src/features/monitoring/domain/dashboard.ts";

const services = Array.from({ length: 10 }, (_, index) => ({ id: String(index), name: "App " + index, status: "available" }));
const start = Date.UTC(2026, 9, 1);
const history = services.flatMap(service => Array.from({ length: 20_160 }, (_, index) => ({
  serviceId: service.id, collectedAt: new Date(start + index * 30_000).toISOString(),
  energyKwh: 0.001, emissionsG: 0.085, intervalSeconds: 30,
})));
const measure = callback => {
  const start = performance.now();
  const value = callback();
  return { value, ms: Number((performance.now() - start).toFixed(1)) };
};
const ranking = measure(() => applicationImpacts(services, history, "emissions"));
const series = measure(() => collectionSeries(history, "emissions", true));
const plot = measure(() => chartSeries(series.value));
assert.equal(ranking.value.length, 10);
assert.ok(plot.value.length <= 360);
assert.equal(plot.value.at(-1).value, series.value.at(-1).value);
process.stdout.write(JSON.stringify({
  scope: "CPU de dados sintéticos; não mede rede, navegador, GPU ou FPS",
  services: services.length, samples: history.length,
  rankingMs: ranking.ms, seriesMs: series.ms, simplifyMs: plot.ms,
  chartPoints: { full: series.value.length, plotted: plot.value.length },
  memoryHeapMiB: Number((process.memoryUsage().heapUsed / 1024 ** 2).toFixed(1)),
}, null, 2) + "\n");
