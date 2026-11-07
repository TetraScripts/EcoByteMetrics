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
  const factors = new Map(cycle.regions?.map(region => [region.code, region]) ?? []);
  const locations = new Map<string, number>();
  async function location(code: string, place: AggregatorService["location"]) {
    if (locations.has(code)) return locations.get(code)!;
    if (!code || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude) || Math.abs(place.latitude) > 90 || Math.abs(place.longitude) > 180) return null;
    const result = await client.query(`INSERT INTO locations(name_location,country_location,region_location,city_location,latitude_location,longitude_location)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(name_location) DO UPDATE SET
      country_location=EXCLUDED.country_location,region_location=EXCLUDED.region_location,city_location=EXCLUDED.city_location,
      latitude_location=EXCLUDED.latitude_location,longitude_location=EXCLUDED.longitude_location RETURNING id_location`,
    [code, place.country, place.region, place.city, place.latitude, place.longitude]);
    const id = result.rows[0].id_location as number;
    locations.set(code, id);
    return id;
  }
  for (const region of cycle.regions ?? []) {
    const id = await location(region.code, { ...region, region_code: region.code });
    if (id !== null) await client.query(`INSERT INTO carbons(id_location,date_houry,intesity_co2e_kwh_carbon,renewable_percent_carbon)
      VALUES($1,$2,$3,$4) ON CONFLICT(id_location,date_houry) DO UPDATE SET
      intesity_co2e_kwh_carbon=EXCLUDED.intesity_co2e_kwh_carbon,renewable_percent_carbon=EXCLUDED.renewable_percent_carbon`,
    [id, cycle.at, region.carbon_intensity_gco2e_per_kwh, region.renewable_share_percent]);
  }
  for (const service of cycle.catalog) {
    const idLocation = await location(service.location.region_code, service.location);
    // Stable external ID survives a display-name change; legacy rows are matched once by name.
    let stored = await client.query(`UPDATE services SET name_service=$2,path_metric=$3,id_location=$4,
      location_metadata=$5,active_service=true,date_houry=$6 WHERE external_id=$1 RETURNING id_service`,
    [service.id, service.name, service.metrics_path, idLocation, service.location, cycle.at]);
    if (!stored.rowCount) stored = await client.query(`INSERT INTO services(external_id,name_service,path_metric,id_location,location_metadata,active_service,date_houry)
      VALUES($1,$2,$3,$4,$5,true,$6) ON CONFLICT(name_service) DO UPDATE SET external_id=EXCLUDED.external_id,
      path_metric=EXCLUDED.path_metric,id_location=EXCLUDED.id_location,location_metadata=EXCLUDED.location_metadata,
      active_service=true,date_houry=EXCLUDED.date_houry RETURNING id_service`,
    [service.id, service.name, service.metrics_path, idLocation, service.location, cycle.at]);
    const sample = cycle.metrics.get(service.id);
    if (!sample) continue;
    const factor = factors.get(service.location.region_code);
    await client.query(`INSERT INTO metrics(id_service,cpu_metric,ram_metric,hd_metric,network_metric,date_houry,
      colletion_interval_metric,carbon_intensity,renewable_percent,location_metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id_service,date_houry) DO UPDATE SET
      cpu_metric=EXCLUDED.cpu_metric,ram_metric=EXCLUDED.ram_metric,hd_metric=EXCLUDED.hd_metric,
      network_metric=EXCLUDED.network_metric,colletion_interval_metric=EXCLUDED.colletion_interval_metric,
      carbon_intensity=EXCLUDED.carbon_intensity,renewable_percent=EXCLUDED.renewable_percent,location_metadata=EXCLUDED.location_metadata`,
    [stored.rows[0].id_service, sample.metrics.cpu_percent, sample.metrics.memory_gb, sample.metrics.disk_gb,
      sample.metrics.network_gb, cycle.at, sample.collection_interval_seconds,
      factor?.carbon_intensity_gco2e_per_kwh ?? null, factor?.renewable_share_percent ?? null, service.location]);
  }
  await client.query("UPDATE services SET active_service=false,date_houry=$2 WHERE external_id IS NOT NULL AND NOT(external_id=ANY($1::text[]))", [cycle.catalog.map(service => service.id), cycle.at]);
  await client.query(`INSERT INTO monitoring_collections(collected_at,catalog,errors,carbon_available) VALUES($1,$2,$3,$4)
    ON CONFLICT(collected_at) DO UPDATE SET catalog=EXCLUDED.catalog,errors=EXCLUDED.errors,
    carbon_available=EXCLUDED.carbon_available`, [cycle.at, JSON.stringify(cycle.catalog), JSON.stringify(cycle.errors), cycle.regions !== null]);
}
