import { test } from "node:test";
import assert from "node:assert/strict";
import { RequestError, requestJson } from "../src/shared/lib/http.ts";
import { parseDiscovery, object, number } from "../src/features/monitoring/api/contracts.ts";

test("HTTP: retorna JSON, solicita JSON e impede cache de consultas", async t => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.Accept, "application/json");
    return Response.json({ value: 0 });
  });
  assert.deepEqual(await requestJson("/services"), { value: 0 });
});

test("HTTP: mantém status e corpo de erros para distinguir ausência de serviço e de métricas", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "service_not_found" }, { status: 404 }));
  await assert.rejects(requestJson("/metrics/a"), error => error instanceof RequestError && error.kind === "http" && error.status === 404 && (error.data as { error: string }).error === "service_not_found");
});

test("HTTP: diferencia HTML, JSON inválido e falha de conexão", async t => {
  for (const response of [new Response("<html />", { headers: { "content-type": "text/html" } }), new Response("{")]) {
    t.mock.method(globalThis, "fetch", async () => response);
    await assert.rejects(requestJson("/services"), error => error instanceof RequestError && error.kind === "format");
  }
  t.mock.method(globalThis, "fetch", async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(requestJson("/services"), error => error instanceof RequestError && error.kind === "network");
});

test("HTTP: cancelamento é preservado e tempo limite inclui a leitura da resposta", async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, "fetch", async () => {
    controller.abort();
    return Response.json({});
  });
  await assert.rejects(requestJson("/services", { signal: controller.signal }), { name: "AbortError" });
  t.mock.method(globalThis, "fetch", async () => {
    await new Promise(resolve => setTimeout(resolve, 15));
    return Response.json({});
  });
  await assert.rejects(requestJson("/services", { timeoutMs: 1 }), error => error instanceof RequestError && error.kind === "timeout");
});

test("contrato: descoberta vazia válida não é confundida com descoberta não concluída", () => {
  assert.deepEqual(parseDiscovery({ services: [], lastUpdatedAt: "2026-10-23T12:00:00Z" }).services, []);
  for (const data of [null, [], {}, { services: {} }, { services: [], lastUpdatedAt: null }, { services: [], lastUpdatedAt: "2026-10-23" }])
    assert.throws(() => parseDiscovery(data));
  assert.deepEqual(object([]), {});
  assert.equal(number(0), 0);
  for (const value of [NaN, Infinity, -1, "0", null]) assert.equal(number(value), null);
});
