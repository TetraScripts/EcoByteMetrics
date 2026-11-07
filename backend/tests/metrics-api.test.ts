import assert from "node:assert/strict";
import test from "node:test";
import { fetchServiceMetrics, MetricsApiError } from "../src/integrations/metrics-api";

test("classifica ausência de métricas indicada no corpo mesmo quando a API responde HTTP 200", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: "metrics_missing" }), { status: 200 }));
  await assert.rejects(fetchServiceMetrics("active-api"), error =>
    error instanceof MetricsApiError && error.code === "metrics_missing",
  );
});

test("classifica 404 como ausência de métricas e preserva códigos conhecidos", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({ error: "invalid_metrics" }), { status: 404 }));
  await assert.rejects(fetchServiceMetrics("active-api"), error =>
    error instanceof MetricsApiError && error.code === "invalid_metrics",
  );
});

test("classifica JSON malformado em resposta de sucesso como métrica inválida", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("not-json", { status: 200 }));
  await assert.rejects(fetchServiceMetrics("active-api"), error =>
    error instanceof MetricsApiError && error.code === "invalid_metrics",
  );
});
