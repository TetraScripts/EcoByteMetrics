import type { PoolClient } from "pg";
import type { AggregatorService, ServiceMetrics } from "../../integrations/metrics-api";
import type { CarbonRegion } from "../../integrations/api.types";

export interface Collection {
  at: string;
  catalog: AggregatorService[];
  metrics: Map<string, ServiceMetrics>;
  errors: Record<string, string>;
  regions: CarbonRegion[] | null;
}

export async function persistCollection(client: Pick<PoolClient, "query">, cycle: Collection) { 

  await client.query(`INSERT INTO monitoring_collections(collected_at,catalog,errors,carbon_available) VALUES($1,$2,$3,$4)
    ON CONFLICT(collected_at) DO UPDATE SET catalog=EXCLUDED.catalog,errors=EXCLUDED.errors,
    carbon_available=EXCLUDED.carbon_available`, [cycle.at, JSON.stringify(cycle.catalog), JSON.stringify(cycle.errors), cycle.regions !== null]);
}
