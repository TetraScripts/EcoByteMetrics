
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
    console.warn(
      "API_METRIC não configurada; usando o endpoint público padrão."
    );
  }

  const baseUrl = aggregatorUrl.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/services`, {
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(
      `Erro ao consultar o Agregador: HTTP ${response.status}`
    );
  }

  const data: unknown = await response.json();

  if (!Array.isArray(data)) {
    throw new Error(
      "Resposta inválida do Agregador: era esperada uma lista."
    );
  }

  for (const [index, item] of data.entries()) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("id" in item) ||
      typeof item.id !== "string" ||
      !("name" in item) ||
      typeof item.name !== "string" ||
      !("location" in item) ||
      typeof item.location !== "object" ||
      item.location === null ||
      !("metrics_path" in item) ||
      typeof item.metrics_path !== "string"
    ) {
      throw new Error(
        `Dados inválidos no serviço da posição ${index}.`
      );
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
    }
}

export async function fetchServiceMetrics(
    serviceId: string
): Promise<ServiceMetrics> {
    const baseUrl = aggregatorUrl;
    const encodedServiceId = encodeURIComponent(serviceId);

    const response = await fetch(
        `${baseUrl}/metrics/${encodedServiceId}`,
        {
            headers: {
                Accept: "application/json",
            },
            signal: AbortSignal.timeout(10000),
        }
    );

    if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const code = body && typeof body === "object" && "error" in body && typeof body.error === "string" && body.error.trim()
            ? body.error.trim() : "metrics_unavailable";
        throw new MetricsApiError(code);
    }

    const data: unknown = await response.json().catch(() => { throw new MetricsApiError("invalid_metrics"); });

    if (
        typeof data !== "object" ||
        data === null ||
        !("collection_interval_seconds" in data) ||
        typeof data.collection_interval_seconds !== "number" ||
        !("metrics" in data) ||
        typeof data.metrics !== "object" ||
        data.metrics === null
    ) {
        throw new MetricsApiError("invalid_metrics");
    }

    const metrics = data.metrics;

    if (
        !("cpu_percent" in metrics) ||
        typeof metrics.cpu_percent !== "number" ||
        !("memory_gb" in metrics) ||
        typeof metrics.memory_gb !== "number" ||
        !("disk_gb" in metrics) ||
        typeof metrics.disk_gb !== "number" ||
        !("network_gb" in metrics) ||
        typeof metrics.network_gb !== "number"
    ) {
        throw new MetricsApiError("invalid_metrics");
    }

    return {
        collection_interval_seconds:
            data.collection_interval_seconds,
        metrics: {
            cpu_percent: metrics.cpu_percent,
            memory_gb: metrics.memory_gb,
            disk_gb: metrics.disk_gb,
            network_gb: metrics.network_gb,
        },
    };
}

