import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Client } from "pg";
import pool from "../../src/db/connection";
import { WorkerCarbons } from "../../src/modules/Worker/worker.carbon.service";
import { WorkerService } from "../../src/modules/Worker/worker.metric.service";
import { ServiceAPISevice } from "../../src/integrations/services-api";
import type { CarbonRegion } from "../../src/integrations/api.types";

test("worker grava datas ISO, regiões iguais e coletas posteriores com SQL real", async t => {
  assert(["127.0.0.1", "localhost", "::1"].includes(process.env.POSTGRES_HOST ?? ""), "Use um PostgreSQL local de teste");
  const client = new Client({
    host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE, connectionTimeoutMillis: 5000,
  });
  const schema = "worker_test_" + randomUUID().replaceAll("-", "");
  const originalQuery = pool.query;
  const errors: unknown[][] = [];
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query("SELECT set_config('search_path', $1, true)", [schema]);
    await client.query(readFileSync(new URL("../../../database/DDL.sql", import.meta.url), "utf8"));
    // Route repository calls through one real transaction; all test tables are rolled back.
    pool.query = client.query.bind(client) as typeof pool.query;
    t.mock.method(console, "error", (...args: unknown[]) => { errors.push(args); });
    t.mock.method(console, "log", () => {});
    t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-10-30T23:45:56.789Z") });
    t.mock.method(Date.prototype, "toLocaleDateString", () => { throw new Error("Não use data regional na persistência"); });
    const regions: CarbonRegion[] = [{
      code: "test-A", country: "Brasil", region: "São Paulo", city: "São Paulo",
      latitude: -23.55, longitude: -46.63,
      carbon_intensity_gco2e_per_kwh: 85, renewable_share_percent: 70,
    }, {
      code: "test-B", country: "Canadá", region: "Ontario", city: "Toronto",
      latitude: 43.65, longitude: -79.38,
      carbon_intensity_gco2e_per_kwh: 85, renewable_share_percent: 70,
    }];
    const worker = new WorkerCarbons();
    await client.query("SET LOCAL DateStyle = 'ISO, MDY'");
    await worker.listarCarbons(regions);
    const first = await client.query("SELECT c.id_location, (c.date_houry AT TIME ZONE 'UTC')::text AS collected_at FROM carbons c ORDER BY c.id_location");
    assert.equal(first.rowCount, 2, "Cada região deve manter seu fator, mesmo com valores iguais");
    assert.notEqual(first.rows[0].id_location, first.rows[1].id_location);
    assert(first.rows.every(row => row.collected_at === "2026-10-30 23:45:56.789"));

    await worker.listarCarbons([{ ...regions[0], carbon_intensity_gco2e_per_kwh: 99 }, regions[1]]);
    const replay = await client.query("SELECT intesity_co2e_kwh_carbon::float8 AS intensity FROM carbons ORDER BY id_location");
    assert.equal(replay.rowCount, 2, "Repetir o mesmo instante não duplica a coleta");
    assert.deepEqual(replay.rows.map(row => row.intensity), [99, 85]);

    t.mock.timers.tick(60_000);
    await client.query("SET LOCAL DateStyle = 'ISO, DMY'");
    await worker.listarCarbons(regions);
    const later = await client.query("SELECT id_location, count(*)::int AS samples FROM carbons GROUP BY id_location");
    assert.equal(later.rowCount, 2);
    assert(later.rows.every(row => row.samples === 2), "Valores iguais em outro instante continuam no histórico");

    const api = new ServiceAPISevice();
    t.mock.method(api, "getMetricRegionDetails", async () => ({
      collection_interval_seconds: 30,
      metrics: { cpu_percent: 45, memory_gb: 2.5, disk_gb: 10, network_gb: 0.4 },
    }));
    await new WorkerService().listarServices([{
      id: "test-service", name: "Test Service", metrics_path: "/metrics/test-service",
      location: { ...regions[0], region_code: "test-A" },
    }], api);
    const joined = await client.query(`
      SELECT m.cpu_metric::float8 AS cpu, m.colletion_interval_metric::int AS seconds,
        c.intesity_co2e_kwh_carbon::float8 AS intensity
      FROM metrics m JOIN services s USING (id_service)
      JOIN carbons c ON c.id_location = s.id_location AND c.date_houry = m.date_houry`);
    assert.deepEqual(joined.rows, [{ cpu: 45, seconds: 30, intensity: 85 }]);
    assert.equal(errors.length, 0, "Nenhuma falha de persistência pode ser ignorada pelo worker");
  } finally {
    pool.query = originalQuery;
    try {
      await client.query("ROLLBACK");
      const remaining = await client.query("SELECT count(*)::int AS count FROM pg_namespace WHERE nspname = $1", [schema]);
      assert.equal(remaining.rows[0].count, 0);
    } finally {
      await client.end();
      await pool.end();
    }
  }
});
