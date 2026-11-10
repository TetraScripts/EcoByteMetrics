import type {
  MonitoringSnapshot,
  MonitoredService,
  CollectionPoint,
  CarbonRegion
} from "../types";

import {
  findCountry,
  localizeCity
} from "@/shared/geography/geography";

import {
  summarizeCollections
} from "../domain/history";

import {
  requestJson,
  RequestError
} from "@/shared/lib/http";

import {
  object,
  number,
  text
} from "./contracts";

const backend = (
  import.meta.env?.VITE_BACKEND_URL ?? "/backend"
).replace(/\/+$/, "");

const timestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

const invalid = () =>
  new RequestError(
    "format",
    "O backend retornou um histórico inválido. Os últimos dados foram preservados."
  );

function place(data: Record<string, unknown>) {
  const raw = text(data.country);

  return {
    country: (findCountry(raw)?.properties.name ?? raw) || null,
    region: text(data.region) || null,
    city: localizeCity(raw, text(data.city) || null),

    latitude:
      typeof data.latitude === "number" &&
      Number.isFinite(data.latitude) &&
      Math.abs(data.latitude) <= 90
        ? data.latitude
        : undefined,

    longitude:
      typeof data.longitude === "number" &&
      Number.isFinite(data.longitude) &&
      Math.abs(data.longitude) <= 180
        ? data.longitude
        : undefined
  };
}

export async function getMonitoringSnapshot(
  signal = new AbortController().signal,
  options: {
    period?: "24h" | "7d";
    until?: string;
    includeHistory?: boolean;
    protectedHistory?: boolean;
  } = {}
): Promise<MonitoringSnapshot> {

  const params = new URLSearchParams({
    period: options.period ?? "7d"
  });

  if (options.until) {
    params.set("until", options.until);
  }

  // Define explicitamente o tipo de consulta.
  if (options.includeHistory === false) {
    params.set("view", "latest");
  } else if (options.protectedHistory === true) {
    params.set("view", "history");
  } else {
    params.set("view", "analysis");
  }

  const raw = object(
    await requestJson(
      backend + "/api/monitoring?" + params,
      { signal }
    )
  );

  if (
    raw.source !== "database" ||
    !Array.isArray(raw.services) ||
    !Array.isArray(raw.history) ||
    !Array.isArray(raw.regions) ||
    !Array.isArray(raw.observations) ||
    raw.history.length > 20000 ||
    !["24h", "7d"].includes(text(raw.historyPeriod))
  ) {
    throw invalid();
  }

  const seen = new Set<string>();

  const services: MonitoredService[] = raw.services.map(value => {
    const data = object(value);
    const id = text(data.id);

    if (
      !id ||
      seen.has(id) ||
      ![
        "available",
        "stale",
        "unavailable",
        "no-metrics",
        "removed"
      ].includes(text(data.status))
    ) {
      throw invalid();
    }

    seen.add(id);

    const numeric = (key: string, max = Infinity) => {
      if (data[key] === null) return null;

      const result = number(data[key], max);

      if (result === null) throw invalid();

      return result;
    };

    if (
      data.lastCollectionAt !== null &&
      !timestamp(data.lastCollectionAt)
    ) {
      throw invalid();
    }

    return {
      id,
      name: text(data.name) || id,
      ...place(data),
      status: data.status as MonitoredService["status"],
      regionCode: text(data.regionCode),

      cpuPercent: numeric("cpuPercent", 100),
      memoryGb: numeric("memoryGb"),
      diskGb: numeric("diskGb"),
      networkGb: numeric("networkGb"),

      energyKwh: numeric("energyKwh"),
      emissionsG: numeric("emissionsG"),

      carbonIntensity: numeric("carbonIntensity"),
      renewablePercent: numeric("renewablePercent", 100),

      collectionIntervalSeconds:
        numeric("collectionIntervalSeconds"),

      lastCollectionAt: data.lastCollectionAt,
      statusMessage: text(data.statusMessage) || undefined
    };
  });

  const sampleKeys = new Set<string>();

  const history: CollectionPoint[] = raw.history.map(value => {
    const data = object(value);

    const energy = number(data.energyKwh);

    const emissions =
      data.emissionsG === null
        ? null
        : number(data.emissionsG);

    const sampleCount = number(data.sampleCount);
    const emissionCount = number(data.emissionCount);
    const seconds = number(data.intervalSeconds);
    const bucketSeconds = number(data.bucketSeconds);

    if (
      !seen.has(text(data.serviceId)) ||
      !timestamp(data.collectedAt) ||
      energy === null ||
      (data.emissionsG !== null && emissions === null) ||
      !sampleCount ||
      !Number.isSafeInteger(sampleCount) ||
      emissionCount === null ||
      !Number.isSafeInteger(emissionCount) ||
      emissionCount > sampleCount ||
      (emissionCount === 0 ? emissions !== null : emissions === null) ||
      !seconds ||
      !bucketSeconds
    ) {
      throw invalid();
    }

    let resources: CollectionPoint["resources"] = null;

    if (data.resources !== undefined && data.resources !== null) {
      const rawResources = object(data.resources);

      const cpuPercent = number(rawResources.cpuPercent, 100);
      const memoryGb = number(rawResources.memoryGb);
      const diskGb = number(rawResources.diskGb);
      const networkGb = number(rawResources.networkGb);

      const durationSeconds = number(
        rawResources.durationSeconds,
        seconds
      );

      if (
        cpuPercent === null ||
        memoryGb === null ||
        diskGb === null ||
        networkGb === null ||
        !durationSeconds
      ) {
        throw invalid();
      }

      resources = {
        cpuPercent,
        memoryGb,
        diskGb,
        networkGb,
        durationSeconds
      };
    }

    const key = JSON.stringify([
      data.serviceId,
      data.collectedAt
    ]);

    if (sampleKeys.has(key)) {
      throw invalid();
    }

    sampleKeys.add(key);

    return {
      serviceId: text(data.serviceId),
      ...place(data),
      regionCode: text(data.regionCode),

      collectedAt: data.collectedAt,
      cycleAt: data.collectedAt,
      cycleId: data.collectedAt,

      firstCollectedAt:
        timestamp(data.firstCollectedAt)
          ? data.firstCollectedAt
          : data.collectedAt,

      energyKwh: energy,
      emissionsG: emissions,

      intervalSeconds: seconds,
      sampleCount,
      emissionCount,
      bucketSeconds,
      resources
    };
  });

  const regions: CarbonRegion[] = raw.regions.map(value => {
    const data = object(value);
    const located = place(data);

    const intensity = number(data.carbonIntensity);
    const renewable = number(data.renewablePercent, 100);

    if (
      !text(data.code) ||
      !located.country ||
      !located.region ||
      intensity === null ||
      renewable === null
    ) {
      throw invalid();
    }

    return {
      code: text(data.code),
      ...located,
      country: located.country,
      region: located.region,
      carbonIntensity: intensity,
      renewablePercent: renewable
    };
  });

  if (
    raw.lastCollectionAt !== null &&
    !timestamp(raw.lastCollectionAt)
  ) {
    throw invalid();
  }

  if (
    raw.discoveryUpdatedAt !== null &&
    !timestamp(raw.discoveryUpdatedAt)
  ) {
    throw invalid();
  }

  if (!timestamp(raw.historyUntil)) {
    throw invalid();
  }

  const observations = raw.observations.map(value => {
    const data = object(value);

    const collectionCount =
      data.collectionCount === undefined
        ? 1
        : number(data.collectionCount);

    if (
      !timestamp(data.observedAt) ||
      !collectionCount ||
      !Number.isSafeInteger(collectionCount)
    ) {
      throw invalid();
    }

    return {
      observedAt: data.observedAt,
      collectionCount,
      services: [],
      samples: []
    };
  });

  const totals = summarizeCollections(history);

  if (
    raw.collectionWarning !== undefined &&
    raw.collectionWarning !== null &&
    typeof raw.collectionWarning !== "string"
  ) {
    throw invalid();
  }

  const collectionEvents = Array.isArray(raw.collectionEvents)
    ? raw.collectionEvents.map(value => {
        const data = object(value);

        if (
          ![
            "service-unavailable",
            "metrics-missing"
          ].includes(text(data.kind)) ||
          !timestamp(data.from) ||
          !timestamp(data.to) ||
          !Array.isArray(data.serviceIds) ||
          data.serviceIds.some(id => typeof id !== "string")
        ) {
          throw invalid();
        }

        return {
          from: data.from,
          to: data.to,
          kind: data.kind as
            | "service-unavailable"
            | "metrics-missing",
          serviceIds: data.serviceIds as string[]
        };
      })
    : [];

  if (
    raw.historyIncluded !== undefined &&
    typeof raw.historyIncluded !== "boolean"
  ) {
    throw invalid();
  }

  return {
    source: "database",
    services,
    history,
    regions,
    observations,
    collectionEvents,

    historyIncluded: raw.historyIncluded !== false,

    historyPeriod: raw.historyPeriod as "24h" | "7d",
    selectedAt:
      typeof raw.selectedAt === "string"
        ? raw.selectedAt
        : null,

    historyUntil: raw.historyUntil,

    lastCollectionAt: raw.lastCollectionAt as string | null,
    discoveryUpdatedAt: raw.discoveryUpdatedAt as string | null,

    discoveryComplete: true,

    totalEnergyKwh: totals.energyKwh,
    totalEmissionsG: totals.emissionsG,

    warning:
      text(
        raw.collectionWarning === undefined
          ? raw.warning
          : raw.collectionWarning
      ) || undefined
  };
}
