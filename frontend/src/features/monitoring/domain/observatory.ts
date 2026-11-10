import type { CollectionPoint, MonitoredService, MonitoringObservation } from "../types.ts";
import { applicationImpacts, groupServiceLocations } from "./dashboard.ts";
import type { DashboardMetric } from "./dashboard.ts";
import { mergeCollectionHistory } from "./history.ts";

export type ImpactLens = "status" | DashboardMetric;

export function appendObservation(previous: MonitoringObservation[], observedAt: string, services: MonitoredService[], samples: CollectionPoint[], warning?: string) {
  const observation = { observedAt, services: services.map(service => ({ ...service })), samples: samples.map(sample => ({ ...sample })), warning };
  const retained = previous.at(-1)?.observedAt === observedAt ? previous.slice(0, -1) : previous;
  // Limita a memória sem prometer histórico que não foi observado nesta sessão.
  return [...retained.slice(-2999), observation];
}

export function observationHistory(observations: MonitoringObservation[], observedAt: string) {
  return mergeCollectionHistory([], observations.filter(observation => observation.observedAt <= observedAt).flatMap(observation => observation.samples));
}

export function impactLocations(services: MonitoredService[], history: CollectionPoint[], lens: ImpactLens) {
  if (lens === "status") return groupServiceLocations(services).map(group => ({
    ...group, value: null, size: group.count > 1 ? 27 : 17, missingImpact: false, valueLabel: "",
  }));
  const values = new Map(applicationImpacts(services, history, lens).map(entry => [entry.service.id,
    lens === "emissions" && entry.summary.emissionCount < entry.summary.count ? null : entry.value]));
  const groups = groupServiceLocations(services).map(group => {
    const entries = group.services.map(service => values.get(service.id) ?? null);
    const value = entries.some(entry => entry === null) ? null : entries.reduce<number>((sum, entry) => sum + entry!, 0);
    return { ...group, value };
  });
  const maximum = groups.reduce((max, group) => Math.max(max, group.value ?? 0), 0);
  return groups.map(group => ({
    ...group,
    size: group.value === null ? 20 : 17 + (maximum > 0 ? 20 * Math.sqrt(group.value / maximum) : 0),
    missingImpact: group.value === null,
    valueLabel: group.value === null ? "Estimativa incompleta" : group.value.toLocaleString("pt-BR", { maximumSignificantDigits: 4 }) + (lens === "energy" ? " kWh" : " g CO₂e"),
  }));
}
