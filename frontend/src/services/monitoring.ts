import type {
  CarbonRegion,
  MonitoringSnapshot,
  MonitoredService,
  RequestRecord,
} from "../types/monitoring";
import { findCountry, localizeCity } from "../data/geography";
import { summarizeCollections } from "../utils/history";
import { DiscoveryError } from "./discoveryError";

const BACKEND_API = (import.meta.env?.VITE_BACKEND_URL ?? "/backend").replace(
  /\/+$/,
  "",
);
const CARBON_API = "https://carbon.unilaunch.org";
const object = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
const number = (value: unknown, max = Infinity): number | null =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= max
    ? value
    : null;
const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

async function request(
  url: string,
  signal: AbortSignal,
  onRequest?: (record: RequestRecord) => void,
) {
  const started = performance.now();
  let status: number | null = null;
  let outcome: RequestRecord["outcome"] = "network-error";
  try {
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      cache: "no-store",
    });
    status = response.status;
    outcome = "response";
    return response;
  } catch (cause) {
    if (signal.aborted) outcome = "cancelled";
    else if (cause instanceof Error && cause.name === "TimeoutError")
      outcome = "timeout";
    throw cause;
  } finally {
    onRequest?.({
      url,
      status,
      outcome,
      durationMs: Math.round(performance.now() - started),
      completedAt: new Date().toISOString(),
    });
  }
}

function location(value: unknown) {
  const data = object(value);
  const country = text(data.country);
  const latitude =
    typeof data.latitude === "number" &&
    Number.isFinite(data.latitude) &&
    Math.abs(data.latitude) <= 90
      ? data.latitude
      : undefined;
  const longitude =
    typeof data.longitude === "number" &&
    Number.isFinite(data.longitude) &&
    Math.abs(data.longitude) <= 180
      ? data.longitude
      : undefined;
  const positioned = latitude !== undefined && longitude !== undefined;
  return {
    country: (findCountry(country)?.properties.name ?? country) || null,
    region: text(data.region) || null,
    city: localizeCity(country, text(data.city) || null),
    latitude: positioned ? latitude : undefined,
    longitude: positioned ? longitude : undefined,
  };
}

function parseRegions(value: unknown) {
  const data = object(value);
  if (!Array.isArray(data.regions))
    throw new Error("Catálogo de regiões inválido.");
  const regions: CarbonRegion[] = [];
  let invalidCount = 0;
  for (const entry of data.regions) {
    try {
      const region = object(entry);
      const carbonIntensity = number(region.carbon_intensity_gco2e_per_kwh);
      const renewablePercent = number(region.renewable_share_percent, 100);
      const code = text(region.code);
      const place = location(region);
      if (
        !code ||
        !place.country ||
        !place.region ||
        carbonIntensity === null ||
        renewablePercent === null ||
        regions.some((item) => item.code === code)
      )
        throw new Error("Fator de carbono inválido.");
      regions.push({
        code,
        ...place,
        country: place.country,
        region: place.region,
        carbonIntensity,
        renewablePercent,
      });
    } catch {
      invalidCount++;
    }
  }
  return { regions, invalidCount };
}

// Coefficients required by the challenge's simplified model, in W and W/GB.
export function estimateEnergy(
  cpu: number,
  memory: number,
  disk: number,
  network: number,
  seconds: number,
) {
  return (
    (((cpu / 100) * 100 + memory * 0.375 + disk * 0.01 + network * 0.02) *
      (seconds / 3600)) /
    1000
  );
}

export async function getMonitoringSnapshot(
  signal = new AbortController().signal,
  onRequest?: (record: RequestRecord) => void,
): Promise<MonitoringSnapshot> {
  const [servicesResult, regionsResult] = await Promise.allSettled([
    request(BACKEND_API + "/services", signal, onRequest),
    request(CARBON_API + "/regions", signal, onRequest),
  ]);
  signal.throwIfAborted();
  const warnings: string[] = [];
  let regions: CarbonRegion[] = [];
  let catalogLoaded = false;
  try {
    const regionsResponse =
      regionsResult.status === "fulfilled" ? regionsResult.value : null;
    if (!regionsResponse?.ok) throw new Error("API de carbono indisponível.");
    const parsed = parseRegions(await regionsResponse.json());
    regions = parsed.regions;
    catalogLoaded = true;
    if (parsed.invalidCount)
      warnings.push(
        parsed.invalidCount +
          " região(ões) inválida(s) ignorada(s). Os fatores válidos foram preservados.",
      );
  } catch {
    warnings.push(
      "Não foi possível obter os fatores de carbono. As métricas disponíveis continuam visíveis; emissões sem fator são exibidas como —.",
    );
  }

  let discovery: Record<string, unknown>;
  let discoveryUpdatedAt: string;
  try {
    if (servicesResult.status === "rejected")
      throw new Error(
        "O serviço de monitoramento não respondeu. Verifique se o backend está em execução.",
      );
    const servicesResponse = servicesResult.value;
    if (!servicesResponse.ok)
      throw new Error(
        "Backend indisponível (HTTP " + servicesResponse.status + ").",
      );
    const contentType = servicesResponse.headers.get("content-type") ?? "";
    if (contentType.includes("text/html"))
      throw new Error(
        "O endereço do backend respondeu com HTML em vez de dados. Confira o proxy /backend.",
      );
    discovery = object(await servicesResponse.json());
    if (!Array.isArray(discovery.services))
      throw new Error(
        "Resposta inválida do backend: esperados services e lastUpdatedAt.",
      );
    if (discovery.lastUpdatedAt === null)
      throw new Error(
        "O backend ainda não concluiu a descoberta de serviços. Aguarde a atualização automática; se persistir, confira a configuração API_METRIC do processo.",
      );
    if (
      typeof discovery.lastUpdatedAt !== "string" ||
      !Number.isFinite(Date.parse(discovery.lastUpdatedAt))
    )
      throw new Error("Data de descoberta inválida no backend.");
    discoveryUpdatedAt = discovery.lastUpdatedAt;
  } catch (cause) {
    throw new DiscoveryError(
      cause instanceof Error
        ? cause.message
        : "Falha na descoberta de serviços.",
      catalogLoaded ? regions : null,
      warnings.join(" ") || undefined,
    );
  }
  const summaries = discovery.services as unknown[];
  if (Date.now() - Date.parse(discoveryUpdatedAt) > 90_000)
    warnings.push(
      "A descoberta do backend está desatualizada. A lista pode não refletir mudanças recentes.",
    );

  let discoveryComplete = true;
  const seenIds = new Set<string>();
  const services: MonitoredService[] = [];
  const valid: MonitoredService[] = [];
  let incompleteLocations = 0;
  for (const entry of summaries) {
    const summary = object(entry),
      place = object(summary.location);
    const id = text(summary.id);
    if (!id || seenIds.has(id)) {
      discoveryComplete = false;
      warnings.push(
        "Cadastro de serviço sem identificador válido ou duplicado ignorado. Remoções não serão inferidas nesta consulta.",
      );
      continue;
    }
    seenIds.add(id);
    const factor = regions.find(
      (region) => region.code === text(place.region_code),
    );
    const service: MonitoredService = {
      id,
      name: text(summary.name) || id,
      country: null,
      region: null,
      city: null,
      regionCode: text(place.region_code),
      status: "no-metrics",
      cpuPercent: null,
      memoryGb: null,
      diskGb: null,
      networkGb: null,
      energyKwh: null,
      emissionsG: null,
      collectionIntervalSeconds: null,
      carbonIntensity: factor?.carbonIntensity ?? null,
      renewablePercent: factor?.renewablePercent ?? null,
    };
    services.push(service);
    Object.assign(service, location(place));
    valid.push(service);
    if (!service.country || !service.region || !service.regionCode ||
      service.latitude === undefined || service.longitude === undefined)
      incompleteLocations++;
  }
  if (incompleteLocations)
    warnings.push(`Localização incompleta em ${incompleteLocations} serviço(s). As métricas válidas continuam disponíveis; pontos sem coordenadas não aparecem no mapa.`);

  async function collect(service: MonitoredService) {
    service.status = "unavailable";
    try {
      const response = await request(
        BACKEND_API + "/metrics/" + encodeURIComponent(service.id),
        signal,
        onRequest,
      );
      const data = object(await response.json().catch(() => null));
      if (!response.ok) {
        service.status =
          response.status === 404
            ? text(data.error) === "service_not_found"
              ? "removed"
              : "no-metrics"
            : ["metrics_missing", "invalid_metrics"].includes(text(data.error))
              ? "no-metrics"
              : "unavailable";
        service.statusMessage =
          (text(data.message) || text(data.error) || "Falha ao consultar métricas") +
          " (HTTP " +
          response.status +
          ").";
        return;
      }
      // develop wraps the aggregator sample in a per-service cache envelope.
      // Keep the former flat response compatible while integration is in progress.
      const cached = "serviceId" in data || "updatedAt" in data;
      if (cached && text(data.serviceId) !== service.id) {
        service.status = "no-metrics";
        service.statusMessage = "As métricas recebidas pertencem a outro serviço ou não têm identificador válido.";
        return;
      }
      const sample = cached ? object(data.metrics) : data;
      const collectedAt = text(cached ? data.updatedAt : data.collectedAt);
      if (
        !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(collectedAt) ||
        !Number.isFinite(Date.parse(collectedAt))
      ) {
        service.status = "no-metrics";
        service.statusMessage =
          "O backend não informou um horário de coleta válido.";
        return;
      }
      const metrics = object(sample.metrics);
      service.cpuPercent = number(metrics.cpu_percent, 100);
      service.memoryGb = number(metrics.memory_gb);
      service.diskGb = number(metrics.disk_gb);
      service.networkGb = number(metrics.network_gb);
      const interval = number(sample.collection_interval_seconds);
      service.collectionIntervalSeconds =
        interval !== null && Number.isSafeInteger(interval) ? interval : null;
      if (
        [
          service.cpuPercent,
          service.memoryGb,
          service.diskGb,
          service.networkGb,
          service.collectionIntervalSeconds,
        ].some((value) => value === null)
      ) {
        service.status = "no-metrics";
        const missing = [
          ["CPU", service.cpuPercent],
          ["memória RAM", service.memoryGb],
          ["disco", service.diskGb],
          ["rede", service.networkGb],
          ["intervalo de coleta", service.collectionIntervalSeconds],
        ]
          .filter(([, value]) => value === null)
          .map(([label]) => label);
        service.statusMessage =
          "Métricas ausentes ou inválidas: " + missing.join(", ") + ".";
        return;
      }
      service.energyKwh = number(
        estimateEnergy(
          service.cpuPercent!,
          service.memoryGb!,
          service.diskGb!,
          service.networkGb!,
          service.collectionIntervalSeconds!,
        ),
      );
      service.emissionsG =
        service.energyKwh !== null && service.carbonIntensity != null
          ? number(service.energyKwh * service.carbonIntensity)
          : null;
      service.status = service.energyKwh === null ? "no-metrics" : "available";
      if (service.energyKwh === null)
        service.statusMessage = "Resultado energético inválido.";
      else service.lastCollectionAt = collectedAt;
      if (service.energyKwh !== null && service.emissionsG === null)
        service.statusMessage =
          "Fator de carbono ou resultado de emissão não disponível para " +
          (service.regionCode || "este serviço") +
          ".";
    } catch {
      if (signal.aborted)
        throw new DOMException("Coleta cancelada", "AbortError");
      service.statusMessage =
        "Não foi possível consultar as métricas deste serviço.";
    }
  }
  for (let start = 0; start < valid.length; start += 6) {
    signal.throwIfAborted();
    await Promise.all(valid.slice(start, start + 6).map(collect));
  }
  signal.throwIfAborted();
  const collectedAt = services.reduce<string | null>(
    (latest, service) =>
      service.lastCollectionAt &&
      (!latest || Date.parse(service.lastCollectionAt) > Date.parse(latest))
        ? service.lastCollectionAt
        : latest,
    null,
  );
  const cycleId = crypto.getRandomValues(new Uint32Array(4)).join("-");
  const history = services.flatMap((service) =>
    service.energyKwh !== null
      ? [
          {
            serviceId: service.id,
            regionCode: service.regionCode,
            country: service.country,
            city: service.city,
            collectedAt: service.lastCollectionAt!,
            cycleAt: collectedAt!,
            cycleId,
            energyKwh: service.energyKwh,
            emissionsG: service.emissionsG,
            intervalSeconds: service.collectionIntervalSeconds ?? 0,
          },
        ]
      : [],
  );
  if (valid.length && !collectedAt)
    warnings.push(
      "Nenhuma métrica válida foi recebida nesta consulta. O horário da última coleta válida foi preservado.",
    );
  const totals = summarizeCollections(history);
  const covered = services.filter(
    (service) => service.status !== "removed" && service.emissionsG !== null,
  ).length;
  const expected = services.filter(
    (service) => service.status !== "removed",
  ).length;
  if (expected && covered < expected)
    warnings.push(
      "Emissões parciais: calculadas para " +
        covered +
        " de " +
        expected +
        " serviços nesta consulta.",
    );
  return {
    regions,
    services,
    history,
    totalEnergyKwh: totals.energyKwh,
    totalEmissionsG: totals.emissionsG,
    lastCollectionAt: collectedAt,
    discoveryUpdatedAt,
    discoveryComplete,
    warning: warnings.length ? warnings.join(" ") : undefined,
  };
}
