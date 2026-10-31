import pool from "../../db/connection";
import type { AggregatorService } from "../../integrations/metrics-api";

export interface HistoryQuery { period: "24h" | "7d"; until?: string; serviceIds: string[]; view?: "latest" | "history" }
const energy = "((m.cpu_metric / 100.0 * 100) + m.ram_metric * 0.375 + m.hd_metric * 0.01 + m.network_metric * 0.02) * m.colletion_interval_metric / 3600000.0";
const iso = (date: Date | null) => date?.toISOString() ?? null;

export async function readMonitoring(query: HistoryQuery) {
  const client = await pool.connect();
  const end = new Date(query.until ?? Date.now());
  const start = new Date(end.getTime() - (query.period === "24h" ? 1 : 7) * 86400_000);
  const args = [start, end, query.serviceIds];
  const includeHistory = query.view !== "latest";
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const latest = await client.query("SELECT * FROM monitoring_collections WHERE collected_at <= $1 ORDER BY collected_at DESC LIMIT 1", [end]);
    const cycle = latest.rows[0];
    const catalog: AggregatorService[] = cycle?.catalog ?? [];
    const active = new Map(catalog.map(service => [service.id, service]));
    const extent = includeHistory ? await client.query(`SELECT min(m.date_houry) AS first, max(m.date_houry) AS last FROM metrics m JOIN services s USING(id_service)
      WHERE m.date_houry > $1 AND m.date_houry <= $2 AND s.external_id IS NOT NULL
      AND (cardinality($3::text[])=0 OR s.external_id=ANY($3::text[]))`, args) : {rows: [{first:null,last:null}]};
    const span = extent.rows[0].last ? extent.rows[0].last.getTime() - extent.rows[0].first.getTime() : 0;
    const bucketSeconds = span <= 3600_000 ? 30 : span <= 86400_000 ? 300 : 3600;
    const historyRows = includeHistory ? await client.query(`WITH samples AS (
      SELECT s.external_id, m.date_houry, jsonb_build_object(
        'region_code',COALESCE(m.location_metadata,s.location_metadata)->'region_code',
        'country',COALESCE(m.location_metadata,s.location_metadata)->'country',
        'city',COALESCE(m.location_metadata,s.location_metadata)->'city') AS place,
        m.colletion_interval_metric, m.carbon_intensity, ${energy} AS energy
      FROM metrics m JOIN services s USING(id_service)
      WHERE m.date_houry > $1 AND m.date_houry <= $2 AND s.external_id IS NOT NULL
      AND (cardinality($3::text[])=0 OR s.external_id=ANY($3::text[])))
      SELECT external_id, place, min(date_houry) AS first_collected_at, max(date_houry) AS collected_at, sum(energy)::float8 AS energy,
        sum(energy * carbon_intensity)::float8 AS emissions,
        sum(colletion_interval_metric)::float8 AS seconds, count(*)::int AS samples,
        count(carbon_intensity)::int AS covered
      FROM samples GROUP BY external_id,place,date_bin(($4::text || ' seconds')::interval,date_houry,'2000-01-01T00:00:00Z'::timestamptz)
      ORDER BY max(date_houry),external_id LIMIT 20001`, [...args, bucketSeconds]) : {rows: []};
    if (historyRows.rows.length > 20000) throw new Error("HISTORY_TOO_LARGE");
    const history = historyRows.rows.map(row => ({
      serviceId: row.external_id, regionCode: row.place.region_code,
      country: row.place.country ?? null, city: row.place.city ?? null,
      collectedAt: iso(row.collected_at), cycleAt: iso(row.collected_at), cycleId: iso(row.collected_at),
      firstCollectedAt: iso(row.first_collected_at),
      energyKwh: row.energy, emissionsG: row.emissions, intervalSeconds: row.seconds,
      sampleCount: row.samples, emissionCount: row.covered, bucketSeconds,
    }));
    const serviceRows = await client.query(`SELECT s.*, row_to_json(m) AS sample,
      m.date_houry AS collected_at, (${energy})::float8 AS energy
      FROM services s LEFT JOIN LATERAL (SELECT * FROM metrics WHERE id_service=s.id_service AND date_houry <= $1
        ORDER BY date_houry DESC LIMIT 1) m ON true
      WHERE s.external_id IS NOT NULL AND (s.external_id=ANY($2::text[]) OR m.id_metric IS NOT NULL)
      AND (cardinality($3::text[])=0 OR s.external_id=ANY($3::text[])) ORDER BY s.external_id`, [end, catalog.map(service => service.id), query.serviceIds]);
    const services = serviceRows.rows.map(row => {
      const sample = row.sample?.id_metric ? row.sample : null;
      const place = active.get(row.external_id)?.location ?? sample?.location_metadata ?? row.location_metadata;
      const factor = sample?.carbon_intensity == null ? null : Number(sample.carbon_intensity);
      const interval = sample ? Number(sample.colletion_interval_metric) : null;
      const stale = sample && end.getTime() - row.collected_at.getTime() > Math.max(90_000, interval! * 3000);
      const removed = cycle ? !active.has(row.external_id) : !row.active_service;
      const failed = cycle?.errors?.[row.external_id];
      const missingMetrics = failed === "metrics_missing" || failed === "invalid_metrics";
      return {
        id: row.external_id, name: active.get(row.external_id)?.name ?? row.name_service,
        ...place, regionCode: place.region_code,
        status: removed ? "removed" : missingMetrics ? "no-metrics" : failed ? "unavailable" : !sample ? "no-metrics" : stale ? "stale" : "available",
        cpuPercent: sample ? Number(sample.cpu_metric) : null, memoryGb: sample ? Number(sample.ram_metric) : null,
        diskGb: sample ? Number(sample.hd_metric) : null, networkGb: sample ? Number(sample.network_metric) : null,
        energyKwh: row.energy, emissionsG: factor === null || row.energy === null ? null : row.energy * factor,
        carbonIntensity: factor, renewablePercent: sample?.renewable_percent == null ? null : Number(sample.renewable_percent),
        collectionIntervalSeconds: interval, lastCollectionAt: iso(row.collected_at),
        ...(failed ? { statusMessage: (missingMetrics ? "A aplicação está listada, mas não forneceu métricas válidas nesta rodada. " : "Não foi possível consultar as métricas nesta rodada. ") + "Exibindo a última coleta gravada, quando disponível." }
          : stale ? { statusMessage: "A última coleta gravada está desatualizada." } : {}),
      };
    });
    const regionRows = await client.query(`SELECT DISTINCT ON (l.id_location) l.*,c.intesity_co2e_kwh_carbon AS intensity,
      c.renewable_percent_carbon AS renewable FROM locations l JOIN carbons c USING(id_location)
      WHERE c.date_houry <= $1 ORDER BY l.id_location,c.date_houry DESC`, [end]);
    const regions = regionRows.rows.map(row => ({code: row.name_location, country: row.country_location, region: row.region_location,
      city: row.city_location, latitude: row.latitude_location, longitude: row.longitude_location,
      carbonIntensity: Number(row.intensity), renewablePercent: Number(row.renewable)}));
    const instants = includeHistory ? await client.query(`SELECT max(collected_at) AS at, count(*)::int AS collection_count FROM monitoring_collections
      WHERE collected_at > $1 AND collected_at <= $2
      GROUP BY date_bin(($3::text || ' seconds')::interval,collected_at,'2000-01-01T00:00:00Z'::timestamptz)
      ORDER BY max(collected_at) LIMIT 20000`, [start, end, bucketSeconds]) : {rows: []};
    const failures = includeHistory ? await client.query("SELECT collected_at,errors FROM monitoring_collections WHERE collected_at > $1 AND collected_at <= $2 AND errors <> '{}'::jsonb ORDER BY collected_at DESC LIMIT 3000", [start, end]) : {rows: []};
    await client.query("COMMIT");
    const covered = history.reduce((count, point) => count + point.emissionCount, 0);
    const count = history.reduce((total, point) => total + point.sampleCount, 0);
    const collectionWarnings = [
      ...(!cycle ? ["Não há rodada unificada gravada até este horário. Amostras antigas preservam energia; fatores de carbono não são inferidos."] : []),
      ...(cycle && !cycle.carbon_available ? ["Não foi possível obter os fatores da API de carbono na última coleta deste recorte. As amostras dessa rodada não têm estimativa de CO₂."] : []),
      ...(cycle && Object.keys(cycle.errors).length ? ["Não foi possível obter métricas de algumas aplicações na última coleta deste recorte. As últimas amostras gravadas foram preservadas."] : []),
      ...(cycle && end.getTime() - cycle.collected_at.getTime() > 90_000 ? ["O coletor está desatualizado neste recorte; exibindo os últimos dados gravados."] : []),
    ];
    return { source: "database", services, regions, history, historyIncluded: includeHistory, historyPeriod: query.period, historyUntil: end.toISOString(), selectedAt: query.until ?? null, bucketSeconds,
      observations: instants.rows.map(row => ({ observedAt: iso(row.at), collectionCount: row.collection_count, services: [], samples: [] })),
      collectionEvents: failures.rows.flatMap(row => ["metrics-missing", "service-unavailable"].flatMap(kind => {
        const serviceIds = Object.entries(row.errors).filter(([, code]) =>
          (code === "metrics_missing" || code === "invalid_metrics") === (kind === "metrics-missing")).map(([id]) => id);
        return serviceIds.length ? [{from: iso(row.collected_at), to: new Date(Math.min(row.collected_at.getTime() + 30_000, end.getTime())).toISOString(), kind, serviceIds}] : [];
      })),
      discoveryUpdatedAt: iso(cycle?.collected_at ?? null), discoveryComplete: true,
      lastCollectionAt: iso(serviceRows.rows.reduce<Date | null>((last, row) => row.collected_at && (!last || row.collected_at > last) ? row.collected_at : last, null)),
      totalEnergyKwh: history.length ? history.reduce((sum, point) => sum + point.energyKwh, 0) : null,
      totalEmissionsG: covered ? history.reduce((sum, point) => sum + (point.emissionsG ?? 0), 0) : null,
      collectionWarning: collectionWarnings.join(" ") || null,
      warning: [...collectionWarnings, ...(covered < count ? [`CO₂ calculado com ${covered} de ${count} amostras. ${count - covered} amostras não têm fator de carbono registrado e não entram na soma.`] : [])].join(" ") || undefined };
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
