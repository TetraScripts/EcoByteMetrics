import assert from "node:assert/strict";
import test from "node:test";
import pool from "../src/db/connection";
import { collectOnce } from "../src/modules/Monitoring/collector";
import { getDiscoveredServices, publishCollection } from "../src/modules/Services/services.service";

const knownService = {
  id: "known-api",
  name: "Known API",
  metrics_path: "/metrics/known-api",
  location: {
    region_code: "br-sp",
    country: "Brasil",
    region: "SP",
    city: "São Paulo",
    latitude: -23.55,
    longitude: -46.63,
  },
};

test("falha de descoberta preserva o catálogo e sinaliza serviço indisponível sem interromper o ciclo", async t => {
  publishCollection([knownService], new Map(), "2026-11-05T00:00:00.000Z");
  const statements: { sql: string; values?: unknown[] }[] = [];
  let metricCalls = 0;
  const client = {
    async query(sql: string, values?: unknown[]) {
      statements.push({ sql, values });
      return { rowCount: 1, rows: [{ id_location: 1, id_service: 2 }] };
    },
    release() {},
  };
  t.mock.method(pool, "connect", async () => client);

  const cycle = await collectOnce({
    services: async () => { throw new Error("aggregator unavailable"); },
    metrics: async () => { metricCalls++; throw new Error("métricas não devem ser consultadas após falha na descoberta"); },
    regions: async () => [],
  });

  assert.deepEqual(cycle.catalog, [knownService]);
  assert.deepEqual(cycle.errors, { [knownService.id]: "service_unavailable" });
  assert.equal(metricCalls, 0);
  assert.deepEqual(getDiscoveredServices(), [knownService]);
  assert.equal(statements.some(({ sql }) => /INSERT INTO metrics\s*\(/i.test(sql)), false);
  const stored = statements.find(({ sql }) => /INSERT INTO monitoring_collections/i.test(sql));
  assert.ok(stored);
  assert.deepEqual(JSON.parse(stored.values?.[2] as string), cycle.errors);
  assert.ok(statements.some(({ sql }) => sql === "COMMIT"));
});
