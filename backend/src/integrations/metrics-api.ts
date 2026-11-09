//import dotenv from "dotenv";

//dotenv.config({ path: "../.env" });

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

const aggregatorUrl =
  process.env.API_METRIC ?? process.env.METRICS_AGGREGATOR_URL;

export async function fetchAvailableServices(): Promise<AggregatorService[]> {
  if (!aggregatorUrl) {
    throw new Error(
      "A variável API_METRIC não foi configurada no ambiente."
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

export async function fetchServiceMetrics(
    serviceId: string
): Promise<ServiceMetrics> {
    if (!aggregatorUrl) {
        throw new Error(
            "A variável API_METRIC não foi configurada no ambiente."
        );
    }

    const baseUrl = aggregatorUrl.replace(/\/+$/, "");
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
        throw new Error(
            `Erro ao consultar métricas do serviço "${serviceId}": HTTP ${response.status}`
        );
    }

    const data: unknown = await response.json();

    if (
        typeof data !== "object" ||
        data === null ||
        !("collection_interval_seconds" in data) ||
        typeof data.collection_interval_seconds !== "number" ||
        !("metrics" in data) ||
        typeof data.metrics !== "object" ||
        data.metrics === null
    ) {
        throw new Error(
            `Resposta inválida ao consultar métricas do serviço "${serviceId}".`
        );
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
        throw new Error(
            `Métricas incompletas para o serviço "${serviceId}".`
        );
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
