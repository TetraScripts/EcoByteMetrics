import pool from "../../db/connection";
import { fetchAvailableServices, fetchServiceMetrics, MetricsApiError } from "../../integrations/metrics-api";
import { CarbonAPISevice } from "../../integrations/carbon-api";
import { persistCollection, type Collection } from "./collection.repository";
import { getDiscoveredServices, publishCollection } from "../Services/services.service";

export const COLLECTION_INTERVAL_MS = 30_000;

export async function collectOnce(dependencies = {
  services: fetchAvailableServices,
  metrics: fetchServiceMetrics,
  regions: async () => (await new CarbonAPISevice().listCabons()).regions,
}) {
  // Preservar o último catálogo conhecido caso a descoberta esteja indisponível.
  // Esses serviços são registrados como indisponíveis e o restante do ciclo continua.
  let catalog = getDiscoveredServices();
  let discoveryFailed = false;
  try {
    const discovered = await dependencies.services();
    if (
      new Set(discovered.map(service => service.id)).size !== discovered.length ||
      discovered.some(service => !service.id || !service.name)
    ) {
      throw new Error("Catálogo de serviços inválido");
    }
    catalog = discovered;
  } catch (error) {
    if (catalog.length === 0) throw error;
    discoveryFailed = true;
    console.error("Falha na descoberta; mantendo o catálogo conhecido e sinalizando os serviços como indisponíveis.", error);
  }

  const cycle: Collection = {
    at: new Date().toISOString(),
    catalog,
    metrics: new Map(),
    errors: {},
    regions: null,
  };
  if (discoveryFailed) {
    for (const service of catalog) cycle.errors[service.id] = "service_unavailable";
  }

  try {
    cycle.regions = await dependencies.regions();
  } catch (error) {
    console.error("Fatores de carbono indisponíveis nesta coleta; emissões serão desconhecidas.", error);
  }

  if (!discoveryFailed) {
    for (let start = 0; start < catalog.length; start += 6) {
      await Promise.all(catalog.slice(start, start + 6).map(async service => {
        try {
          const sample = await dependencies.metrics(service.id);
          const values = [sample.metrics.memory_gb, sample.metrics.disk_gb, sample.metrics.network_gb];
          if (
            !Number.isFinite(sample.metrics.cpu_percent) || sample.metrics.cpu_percent < 0 || sample.metrics.cpu_percent > 100 ||
            values.some(value => !Number.isFinite(value) || value < 0) ||
            !Number.isSafeInteger(sample.collection_interval_seconds) || sample.collection_interval_seconds <= 0
          ) {
            throw new MetricsApiError("invalid_metrics");
          }
          cycle.metrics.set(service.id, sample);
        } catch (error) {
          cycle.errors[service.id] = error instanceof MetricsApiError ? error.code : "metrics_unavailable";
        }
      }));
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await persistCollection(client, cycle);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  // Publicar somente os dados confirmados para manter o endpoint legado e o SQL sincronizados.
  publishCollection(catalog, cycle.metrics, cycle.at);
  return cycle;
}

let running: Promise<Collection> | null = null;
export function collectMonitoring() {
  if (!running) running = collectOnce().finally(() => { running = null; });
  return running;
}
