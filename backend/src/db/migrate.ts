import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pool from "./connection";

export async function migrateMonitoring() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ecobytemetrics_migrations'))");
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const version of ["001_persisted_monitoring", "002_recover_legacy_carbon"]) {
      const applied = await client.query("SELECT 1 FROM schema_migrations WHERE version = $1", [version]);
      if (!applied.rowCount) {
        await client.query(readFileSync(resolve(__dirname, `../../../database/migrations/${version}.sql`), "utf8"));
        await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [version]);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
