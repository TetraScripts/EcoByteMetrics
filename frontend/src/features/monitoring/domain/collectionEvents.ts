import type { CollectionEvent, MonitoringSnapshot } from "../types.ts";

export const collectionEventLabels: Record<CollectionEvent["kind"], string> = {
  "tab-hidden": "As consultas automáticas ficaram pausadas enquanto esta aba estava oculta.",
  "monitoring-inactive": "As consultas automáticas ficaram pausadas enquanto você estava fora do monitoramento.",
  "request-failed": "Uma consulta ao backend falhou; a interface preservou os últimos dados recebidos.",
  "no-new-samples": "O backend respondeu com a mesma coleta ou uma coleta anterior para uma ou mais aplicações desta seleção.",
  "service-unavailable": "Não foi possível consultar as métricas de uma ou mais aplicações.",
  "metrics-missing": "Uma aplicação estava listada, mas não forneceu métricas válidas.",
};

export function appendCollectionEvents(previous: CollectionEvent[] = [], incoming: CollectionEvent[] = []) {
  return [...previous, ...incoming].slice(-3000);
}

export function responseCollectionEvents(previous: MonitoringSnapshot, incoming: MonitoringSnapshot, from: string, to: string): CollectionEvent[] {
  const previousServices = new Map(previous.services.map(service => [service.id, service]));
  const unchanged: string[] = [], unavailable: string[] = [];
  for (const service of incoming.services) {
    if (service.status === "unavailable" || service.status === "no-metrics") unavailable.push(service.id);
    else if (service.status !== "removed" && service.lastCollectionAt && previousServices.get(service.id)?.lastCollectionAt &&
      Date.parse(service.lastCollectionAt) <= Date.parse(previousServices.get(service.id)!.lastCollectionAt!)) unchanged.push(service.id);
  }
  return [
    ...(unchanged.length ? [{ from, to, kind: "no-new-samples" as const, serviceIds: unchanged }] : []),
    ...(unavailable.length ? [{ from, to, kind: "service-unavailable" as const, serviceIds: unavailable }] : []),
  ];
}

export function createCollectionPauseTracker() {
  let pause: { from: string; kind: "tab-hidden" | "monitoring-inactive" } | null = null;
  return (kind: "tab-hidden" | "monitoring-inactive" | null, now: string): CollectionEvent[] => {
    if (pause?.kind === kind) return [];
    const events: CollectionEvent[] = pause && Date.parse(now) > Date.parse(pause.from) ? [{ ...pause, to: now }] : [];
    pause = kind ? { kind, from: now } : null;
    return events;
  };
}
