import assert from "node:assert/strict";
import test from "node:test";
import pool from "../src/db/connection";
import { MetricsApiError } from "../src/integrations/metrics-api";
import { collectOnce } from "../src/modules/Monitoring/collector";

const services = ["healthy", "http-error", "timeout"].map(id => ({
  id,
  name: id,
  metrics_path: `/metrics/${id}`,
  location: {
    region_code: "br-sp",
    country: "Brasil",
    region: "SP",
    city: "São Paulo",
    latitude: -23.55,
    longitude: -46.63,
  },
}));

const sample = {
  collection_interval_seconds: 30,
  metrics: { cpu_percent: 10, memory_gb: 1, disk_gb: 2, network_gb: 3 },
};

test("falhas HTTP e timeout são persistidos sem impedir a coleta dos outros serviços", async t => {
  const calls: string[] = [];
  const writes: { sql: string; values?: unknown[] }[] = [];
  t.mock.method(pool, "connect", async () => ({
    async query(sql: string, values?: unknown[]) {
      writes.push({ sql, values });
      return { rowCount: 1, rows: [{ id_location: 1, id_service: 1 }] };
    },
    release() {},
  }));

  const cycle = await collectOnce({
    services: async () => services,
    regions: async () => [],
    metrics: async id => {
      calls.push(id);
      if (id === "http-error") throw new MetricsApiError("service_unavailable");
      if (id === "timeout") throw new Error("request timed out");
      return sample;
    },
  });

  assert.deepEqual(calls.sort(), ["healthy", "http-error", "timeout"]);
  assert.deepEqual(cycle.errors, {
    "http-error": "service_unavailable",
    timeout: "metrics_unavailable",
  });
  assert.deepEqual([...cycle.metrics.keys()], ["healthy"]);

  const metricWrites = writes.filter(({ sql }) => /INSERT INTO metrics\s*\(/i.test(sql));
  assert.equal(metricWrites.length, 1);
  assert.deepEqual(metricWrites[0].values?.slice(1, 5), [10, 1, 2, 3]);

  const collectionWrite = writes.find(({ sql }) => /INSERT INTO monitoring_collections/i.test(sql));
  assert.ok(collectionWrite);
  assert.deepEqual(JSON.parse(collectionWrite.values?.[2] as string), cycle.errors);
  assert.ok(writes.some(({ sql }) => sql === "COMMIT"));
});
