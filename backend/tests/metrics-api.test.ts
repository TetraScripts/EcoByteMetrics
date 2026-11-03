import assert from "node:assert/strict";
import test from "node:test";
import { fetchServiceMetrics, MetricsApiError } from "../src/integrations/metrics-api";

test("consulta preserva os motivos estruturados e não confunde falhas genéricas com ausência de métricas", async t => {
  for (const code of ["metrics_missing", "invalid_metrics", "service_unavailable"]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({error: code}, {status: 500}));
    await assert.rejects(fetchServiceMetrics("app"), error => error instanceof MetricsApiError && error.code === code);
  }
  t.mock.method(globalThis, "fetch", async () => new Response("indisponível", {status: 502}));
  await assert.rejects(fetchServiceMetrics("app"), error => error instanceof MetricsApiError && error.code === "metrics_unavailable");
  t.mock.method(globalThis, "fetch", async () => Response.json({collection_interval_seconds: 30, metrics: {cpu_percent: 5}}));
  await assert.rejects(fetchServiceMetrics("app"), error => error instanceof MetricsApiError && error.code === "invalid_metrics");
  t.mock.method(globalThis, "fetch", async () => { throw new Error("falha de conexão"); });
  await assert.rejects(fetchServiceMetrics("app"), /falha de conexão/);
});
