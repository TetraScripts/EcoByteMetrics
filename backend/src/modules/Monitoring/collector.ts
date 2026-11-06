import pool from "../../db/connection";
import { AggregatorService, fetchAvailableServices, fetchServiceMetrics, MetricsApiError, ServiceMetrics } from "../../integrations/metrics-api";
import { CarbonAPISevice } from "../../integrations/carbon-api";
import { publishCollection } from "../Services/services.service";
import { CarbonRegion } from "../../integrations/api.types";
import { HistoryQuery } from "./monitoring.repository";

export interface Collection {
  at: string;
  catalog: AggregatorService[];
  metrics: Map<string, ServiceMetrics>;
  errors: Record<string, string>;
  regions: CarbonRegion[] | null;
}

export const COLLECTION_INTERVAL_MS = 30_000;
export async function collectOnce(dependencies = {
  services: fetchAvailableServices,
  metrics: fetchServiceMetrics,
  regions: async () => (await new CarbonAPISevice().listCabons()).regions,
}) {
  const catalog = await dependencies.services();
  if (new Set(catalog.map(service => service.id)).size !== catalog.length || catalog.some(service => !service.id || !service.name)) throw new Error("Catálogo de serviços inválido");
  const cycle: Collection = { at: new Date().toISOString(), catalog, metrics: new Map(), errors: {}, regions: null };
  try { cycle.regions = await dependencies.regions(); }
  catch { console.error("Fatores de carbono indisponíveis nesta coleta; emissões serão desconhecidas."); }
  for (let start = 0; start < catalog.length; start += 6) {
    await Promise.all(catalog.slice(start, start + 6).map(async service => {
      try {
        const sample = await dependencies.metrics(service.id);
        const values = [sample.metrics.memory_gb, sample.metrics.disk_gb, sample.metrics.network_gb];
        if (!Number.isFinite(sample.metrics.cpu_percent) || sample.metrics.cpu_percent < 0 || sample.metrics.cpu_percent > 100 ||
          values.some(value => !Number.isFinite(value) || value < 0) ||
          !Number.isSafeInteger(sample.collection_interval_seconds) || sample.collection_interval_seconds <= 0) throw new MetricsApiError("invalid_metrics");
        cycle.metrics.set(service.id, sample);
      } catch (error) { cycle.errors[service.id] = error instanceof MetricsApiError ? error.code : "metrics_unavailable"; }
    }));
  }
  // Publish only committed samples. Legacy endpoints and SQL now share one collection.
  publishCollection(catalog, cycle.metrics, cycle.at);
  return cycle;
}

export function parseHistoryQuery(
  input: Record<string, unknown>,
  now = Date.now(),
): HistoryQuery {
  const period = input.period ?? "7d";
  if (period !== "24h" && period !== "7d")
    throw new Error("Período inválido. Use 24h ou 7d.");
  if (
    input.view !== undefined &&
    input.view !== "latest" &&
    input.view !== "history"
  )
    throw new Error("Visualização inválida.");
  const until = input.until;
  if (until !== undefined) {
    const parts =
      typeof until === "string"
        ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(
          until,
        )
        : null;
    const [year, month, day, hour, minute, second] = parts
      ? parts.slice(1).map(Number)
      : [];
    const days = [
      31,
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];
    if (
      !parts ||
      year < 1 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > days[month - 1] ||
      hour > 23 ||
      minute > 59 ||
      second > 59 ||
      !Number.isFinite(Date.parse(until as string))
    )
      throw new Error("Informe um horário válido com fuso.");
    if (Date.parse(until as string) > now)
      throw new Error("Escolha um horário até o momento atual.");
  }
  const serviceIds =
    input.service === undefined
      ? []
      : Array.isArray(input.service)
        ? input.service
        : [input.service];
  if (
    serviceIds.length > 100 ||
    serviceIds.some((id) => typeof id !== "string" || !id || id.length > 255)
  )
    throw new Error("Seleção de aplicações inválida.");
  return {
    period,
    until: until as string | undefined,
    serviceIds: [...new Set(serviceIds)] as string[],
    ...(input.view ? { view: input.view as "latest" | "history" } : {}),
  };
}

let running: Promise<Collection> | null = null;
export function collectMonitoring() {
  if (!running) running = collectOnce().finally(() => { running = null; });
  return running;
}
