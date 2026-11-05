import assert from "node:assert/strict";
import test from "node:test";
import { fetchServiceMetrics, MetricsApiError } from "../src/integrations/metrics-api";

test("classifica ausência de métricas e indisponibilidade sem confundir mensagens HTTP com códigos", async t => {
  let nextResponse: Response | undefined;
  let networkError: Error | undefined;
  t.mock.method(globalThis, "fetch", async () => {
    if (networkError) throw networkError;
    if (!nextResponse) throw new Error("Resposta de teste não configurada");
    return nextResponse;
  });

  const expectCode = async (response: Response, expectedCode: string) => {
    nextResponse = response;
    networkError = undefined;
    await assert.rejects(
      fetchServiceMetrics("app"),
      error => error instanceof MetricsApiError && error.code === expectedCode,
    );
  };

  for (const code of ["metrics_missing", "invalid_metrics", "service_unavailable", "metrics_unavailable"]) {
    await expectCode(Response.json({ error: code }, { status: 500 }), code);
  }

  await expectCode(
    Response.json({ error: "Métricas não encontradas para este serviço." }, { status: 404 }),
    "metrics_missing",
  );
  await expectCode(
    Response.json({ error: "Serviço temporariamente indisponível." }, { status: 503 }),
    "service_unavailable",
  );
  await expectCode(new Response("indisponível", { status: 502 }), "service_unavailable");
  await expectCode(
    Response.json({ collection_interval_seconds: 30, metrics: { cpu_percent: 5 } }),
    "invalid_metrics",
  );

  networkError = new Error("falha de conexão");
  nextResponse = undefined;
  await assert.rejects(fetchServiceMetrics("app"), /falha de conexão/);
});
