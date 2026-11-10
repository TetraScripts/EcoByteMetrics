import type { MonitoringSnapshot } from "@/features/monitoring/types";
import type { Period } from "@/shared/lib/period";
import { isPeriod } from "@/shared/lib/period";
import { matchesRegion } from "@/features/monitoring/domain/region";
import { collectionRange, summarizeCollections } from "@/features/monitoring/domain/history";
import { observationHistory } from "./observatory";
import { filterApplications } from "./dashboard";

import { parseLocalDate } from "@/shared/lib/localDate";
export { parseLocalDate } from "@/shared/lib/localDate";

export function analysisQuery(search: string) {
  const input = new URLSearchParams(search);
  const result = new URLSearchParams();
  for (const key of ["pais", "cidade", "regiao", "periodo", "ate", "instante", "busca", "estado"]) {
    const value = input.get(key);
    if (value && (key !== "periodo" || isPeriod(value))) result.set(key, value);
  }
  return result;
}

export function clearMonitoringFilters(search: string) {
  const params = new URLSearchParams(search);
  for (const key of ["busca", "estado", "pais", "cidade", "regiao", "ate", "instante"]) params.delete(key);
  return params;
}

export function analysisLink(path: string, search: string) {
  const params = analysisQuery(search);
  const input = new URLSearchParams(search);
  if (input.get("ordem")) params.set("ordem", input.get("ordem")!);
  if (["acumulado", "intervalos"].includes(input.get("serie") ?? "")) params.set("serie", input.get("serie")!);
  for (const id of new Set(input.getAll("app"))) if (id) params.append("app", id);
  if (input.get("comparacao") === "ultima") params.set("comparacao", "ultima");
  const query = params.toString();
  return path + (query ? "?" + query : "");
}

export function getAnalysis(
  snapshot: MonitoringSnapshot,
  period: Period,
  search: string,
  now = Date.now(),
) {
  const params = new URLSearchParams(search);
  const date = params.get("ate") ?? "";
  const instant = params.get("instante") ?? "";
  const requestedUntil = date ? parseLocalDate(date) : Date.parse(instant);
  const invalidDate = Boolean((date || instant) && (!Number.isFinite(requestedUntil) || requestedUntil > now));
  const dateCutoff = snapshot.source === "database" ? parseLocalDate(params.get("ate") ?? "") : NaN;
  const observedAt = invalidDate ? "" : instant || (Number.isFinite(dateCutoff) ? new Date(dateCutoff).toISOString() : "");
  const observations = snapshot.observations ?? [];
  const mismatchedQuery = snapshot.source === "database" && (snapshot.historyPeriod !== period ||
    (Number.isFinite(requestedUntil) ? Date.parse(snapshot.selectedAt ?? "") !== requestedUntil : Boolean(snapshot.selectedAt)));
  const observation = snapshot.source === "database" ? undefined : observations.find(entry => entry.observedAt === observedAt);
  const observationMissing = Boolean(observedAt && (snapshot.source === "database" ? !Number.isFinite(Date.parse(observedAt)) : !observation));
  const environmentServices = mismatchedQuery || invalidDate ? [] : observation?.services ?? (observationMissing ? [] : snapshot.services);
  const sourceHistory = mismatchedQuery || invalidDate ? [] : observation ? observationHistory(observations, observedAt) : observationMissing ? [] : snapshot.history;
  const regionCode = params.get("regiao") ?? "";
  const selectedRegion = snapshot.regions.find(
    (region) => region.code === regionCode,
  );
  const country = selectedRegion?.country ?? params.get("pais") ?? "";
  const city = selectedRegion?.city ?? params.get("cidade") ?? "";
  const regional = Boolean(regionCode || country || city);
  const regionalServices = environmentServices.filter((service) =>
    regionCode
      ? service.regionCode === regionCode
      : matchesRegion(service, country, city),
  );
  const services = filterApplications(regionalServices, params.get("busca") ?? "", params.get("estado") ?? "");
  const end = date
    ? parseLocalDate(date)
    : Date.parse((snapshot.source === "database" ? snapshot.historyUntil ?? snapshot.selectedAt : null) ?? observation?.observedAt ?? snapshot.lastCollectionAt ?? "");
  const serviceIds = new Set(services.map((service) => service.id));
  const days = period === "24h" ? 1 : 7;
  const start = end - days * 86400_000;
  const recordedHistory = sourceHistory.filter((point) => {
    if (!serviceIds.has(point.serviceId)) return false;
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
  const { first: availableSince, last: availableUntil } = collectionRange(history);
  const periodLabel = period === "24h" ? "Últimas 24 horas" : "Últimos 7 dias";
  const monitoredRegions = new Set(
    services
      .filter((service) => service.status !== "removed")
      .map((service) => service.regionCode),
  );
  const regions = snapshot.regions.filter((region) =>
    regionCode
      ? region.code === regionCode
      : regional
        ? matchesRegion(region, country, city)
        : monitoredRegions.has(region.code),
  );
  const totals = summarizeCollections(history);
  const collectionWarning = observation ? observation.warning : observationMissing ? undefined : snapshot.warning;
  const coverageWarning = totals.emissionCount < totals.count
    ? `CO₂ calculado com ${totals.emissionCount} de ${totals.count} amostras. ${totals.count - totals.emissionCount} amostras não têm fator de carbono registrado e não entram na soma.`
    : undefined;
  return {
    observedAt,
    observationMissing,
    environmentServices,
    warning: [collectionWarning, coverageWarning].filter(Boolean).join(" ") || undefined,
    services,
    history,
    collectionEvents: observationMissing ? [] : (snapshot.collectionEvents ?? []).filter(event =>
      (!event.serviceIds || event.serviceIds.some(id => serviceIds.has(id))) &&
      (!observedAt || Date.parse(event.to) <= Date.parse(observedAt))),
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
    availableUntil,
    shortHistory: availableSince !== null && availableSince > start,
    selection:
      [country, city].filter(Boolean).join(" — ") ||
      (regionCode ? "Região " + regionCode : ""),
    totals,
  };
}
