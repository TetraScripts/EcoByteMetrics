import type {
  CollectionPoint,
  MonitoringSnapshot,
  Period,
} from "../types/monitoring";
import { isPeriod } from "../types/monitoring";
export { isPeriod } from "../types/monitoring";
import { matchesRegion } from "./region";
import { summarizeCollections } from "./history";

export function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) return NaN;
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  const date = new Date(value);
  return date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second
    ? date.getTime()
    : NaN;
}

export function analysisQuery(search: string) {
  const input = new URLSearchParams(search);
  const result = new URLSearchParams();
  for (const key of ["pais", "cidade", "regiao", "periodo", "ate"]) {
    const value = input.get(key);
    if (value && (key !== "periodo" || isPeriod(value))) result.set(key, value);
  }
  return result;
}

export function analysisLink(path: string, search: string) {
  const params = analysisQuery(search);
  if (path.startsWith("/servicos")) {
    const input = new URLSearchParams(search);
    for (const key of ["busca", "estado", "ordem"]) {
      const value = input.get(key);
      if (value) params.set(key, value);
    }
  }
  const query = params.toString();
  return path + (query ? "?" + query : "");
}

export function getAnalysis(
  snapshot: MonitoringSnapshot,
  period: Period,
  search: string,
) {
  const params = new URLSearchParams(search);
  const regionCode = params.get("regiao") ?? "";
  const selectedRegion = snapshot.regions.find(
    (region) => region.code === regionCode,
  );
  const country = selectedRegion?.country ?? params.get("pais") ?? "";
  const city = selectedRegion?.city ?? params.get("cidade") ?? "";
  const date = params.get("ate") ?? "";
  const regional = Boolean(regionCode || country || city);
  const services = snapshot.services.filter((service) =>
    regionCode
      ? service.regionCode === regionCode
      : matchesRegion(service, country, city),
  );
  const end = date
    ? parseLocalDate(date)
    : Date.parse(snapshot.lastCollectionAt ?? "");
  const invalidDate = Boolean(date && !Number.isFinite(end));
  const serviceIds = new Set(services.map((service) => service.id));
  const days = period === "24h" ? 1 : 7;
  const start = end - days * 86400_000;
  const recordedHistory = snapshot.history.filter((point) => {
    if (!regional) return true;
    if (regionCode)
      return point.regionCode
        ? point.regionCode === regionCode
        : serviceIds.has(point.serviceId);
    return point.country
      ? matchesRegion(
          { country: point.country, city: point.city ?? null },
          country,
          city,
        )
      : serviceIds.has(point.serviceId);
  });
  const history = recordedHistory.filter((point) => {
    const timestamp = Date.parse(point.collectedAt);
    return (
      !invalidDate &&
      Number.isFinite(end) &&
      timestamp > start &&
      timestamp <= end
    );
  });
  const availableSince = recordedHistory.reduce<number | null>(
    (first, point) => {
      const timestamp = Date.parse(point.collectedAt);
      return Number.isFinite(timestamp) &&
        timestamp <= end &&
        (first === null || timestamp < first)
        ? timestamp
        : first;
    },
    null,
  );
  const periodLabel = period === "24h" ? "Últimas 24 horas" : "Últimos 7 dias";
  const monitoredRegions = new Set(
    services
      .filter((service) => service.status !== "removed")
      .map((service) => service.regionCode),
  );
  const historyByService = new Map<string, CollectionPoint[]>();
  for (const point of history) {
    const records = historyByService.get(point.serviceId);
    if (records) records.push(point);
    else historyByService.set(point.serviceId, [point]);
  }
  const regions = snapshot.regions.filter((region) =>
    regionCode
      ? region.code === regionCode
      : regional
        ? matchesRegion(region, country, city)
        : monitoredRegions.has(region.code),
  );
  return {
    services,
    history,
    historyByService,
    regions,
    country,
    city,
    regionCode,
    date,
    regional,
    invalidDate,
    periodLabel,
    windowStart: Number.isFinite(start) && !invalidDate ? start : null,
    windowEnd: Number.isFinite(end) && !invalidDate ? end : null,
    availableSince,
    shortHistory: availableSince !== null && availableSince > start,
    selection:
      [country, city].filter(Boolean).join(" — ") ||
      (regionCode ? "Região " + regionCode : ""),
    totals: summarizeCollections(history),
  };
}
