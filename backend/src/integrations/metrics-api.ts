
export interface ServiceLocation {
  region_code: string;
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
}

export interface AggregatorService {
  id: string;
  name: string;
  location: ServiceLocation;
  metrics_path: string;
}

const aggregatorUrl = (process.env.API_METRIC ?? "https://metrics.unilaunch.org").replace(/\/+$/, "");

export async function fetchAvailableServices(): Promise<AggregatorService[]> {
  if (!process.env.API_METRIC && process.env.NODE_ENV !== "test") {
    console.warn("API_METRIC não configurada; usando o endpoint público padrão.");
  }

  const response = await fetch(`${aggregatorUrl}/services`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Erro ao consultar o Agregador: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Resposta inválida do Agregador: era esperada uma lista.");
  }
  for (const [index, item] of data.entries()) {
    if (
      typeof item !== "object" || item === null ||
      !("id" in item) || typeof item.id !== "string" || !item.id.trim() ||
      !("name" in item) || typeof item.name !== "string" || !item.name.trim() ||
      !("location" in item) || typeof item.location !== "object" || item.location === null ||
      !("metrics_path" in item) || typeof item.metrics_path !== "string"
    ) {
      throw new Error(`Dados inválidos no serviço da posição ${index}.`);
    }
  }
  return data as AggregatorService[];
}

export interface ServiceMetrics {
  collection_interval_seconds: number;
  metrics: {
    cpu_percent: number;
    memory_gb: number;
    disk_gb: number;
    network_gb: number;
  };
}

export class MetricsApiError extends Error {
  constructor(public readonly code: string) {
    super("Não foi possível obter métricas válidas do serviço.");
    this.name = "MetricsApiError";
  }
}

const KNOWN_METRICS_ERRORS = new Set([
  "metrics_missing",
  "invalid_metrics",
  "service_unavailable",
  "metrics_unavailable",
]);

function responseErrorCode(data: unknown): string | null {
  if (typeof data !== "object" || data === null || !("error" in data) || typeof data.error !== "string") {
    return null;
  }
  const code = data.error.trim();
  return KNOWN_METRICS_ERRORS.has(code) ? code : null;
}

export async function fetchServiceMetrics(serviceId: string): Promise<ServiceMetrics> {
  const encodedServiceId = encodeURIComponent(serviceId);
  const response = await fetch(`${aggregatorUrl}/metrics/${encodedServiceId}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  // Parse opportunistically: error payloads may be returned with either an
  // error status or HTTP 200 by a proxy/API gateway.
  const data: unknown = await response.json().catch(() => null);
  const knownError = responseErrorCode(data);
  if (!response.ok) {
    throw new MetricsApiError(
      knownError ?? (response.status === 404 ? "metrics_missing" : "service_unavailable"),
    );
  }
  if (knownError) throw new MetricsApiError(knownError);
  if (data === null) throw new MetricsApiError("invalid_metrics");

  if (
    typeof data !== "object" ||
    !("collection_interval_seconds" in data) ||
    typeof data.collection_interval_seconds !== "number" ||
    !Number.isSafeInteger(data.collection_interval_seconds) || data.collection_interval_seconds <= 0 ||
    !("metrics" in data) || typeof data.metrics !== "object" || data.metrics === null
  ) {
    throw new MetricsApiError("invalid_metrics");
  }

  const metrics = data.metrics;
  if (
    !("cpu_percent" in metrics) || typeof metrics.cpu_percent !== "number" || !Number.isFinite(metrics.cpu_percent) ||
    !("memory_gb" in metrics) || typeof metrics.memory_gb !== "number" || !Number.isFinite(metrics.memory_gb) ||
    !("disk_gb" in metrics) || typeof metrics.disk_gb !== "number" || !Number.isFinite(metrics.disk_gb) ||
    !("network_gb" in metrics) || typeof metrics.network_gb !== "number" || !Number.isFinite(metrics.network_gb)
  ) {
    throw new MetricsApiError("invalid_metrics");
  }
  return {
    collection_interval_seconds: data.collection_interval_seconds,
    metrics: {
      cpu_percent: metrics.cpu_percent,
      memory_gb: metrics.memory_gb,
      disk_gb: metrics.disk_gb,
      network_gb: metrics.network_gb,
    },
  };
}
