import type { EvolutionPoint } from "./evolution.ts";
import type { CollectionEvent } from "../types.ts";

export interface EvolutionChartPoint {
  timestamp: number; value: number | null; missing?: boolean;
  from?: number; to?: number; reason?: string; events?: CollectionEvent[];
}

export function evolutionChartData(points: EvolutionPoint[], intervalMs: number, events: CollectionEvent[] = []): EvolutionChartPoint[] {
  const result: EvolutionChartPoint[] = [];
  const represented = new Set<CollectionEvent>();
  for (let index = 0; index < points.length; index++) {
    const point = points[index]!, previous = points[index - 1];
    if (previous && point.gap && point.timestamp - previous.timestamp > intervalMs * 1.5) {
      const context = events.filter(event => !represented.has(event) && Date.parse(event.to) > previous.timestamp && Date.parse(event.from) < point.timestamp);
      context.forEach(event => represented.add(event));
      result.push({
        timestamp: previous.timestamp + (point.timestamp - previous.timestamp) / 2, value: null, missing: true,
        from: previous.timestamp, to: point.timestamp,
        reason: "Não há amostras registradas neste período. Isso pode acontecer se o programa responsável pelas coletas não estava rodando, se o computador que o executa estava desligado ou se houve uma falha de conexão. Fechar apenas a página não interrompe as coletas.",
        events: context,
      });
    }
    const from = point.intervalFrom ?? point.timestamp, to = point.intervalTo ?? point.timestamp + intervalMs;
    const context = events.filter(event => ["service-unavailable", "metrics-missing"].includes(event.kind) && Date.parse(event.from) >= from && Date.parse(event.from) < to);
    context.forEach(event => represented.add(event));
    result.push({ timestamp: point.timestamp, value: point.value,
      ...(point.from !== undefined ? { from: point.from } : {}), ...(point.to !== undefined ? { to: point.to } : {}),
      ...(point.reason ? { reason: point.reason } : {}), ...(context.length ? { events: context } : {}) });
  }
  const missing = new Map<number, EvolutionChartPoint>();
  for (const event of events) {
    if (represented.has(event) || !["service-unavailable", "metrics-missing"].includes(event.kind)) continue;
    const from = Date.parse(event.from), to = Date.parse(event.to);
    const point = missing.get(from) ?? { timestamp: from, value: null, missing: true, from, to,
      reason: "Nenhuma leitura válida foi recebida neste horário. Consulte o diagnóstico da coleta.", events: [] };
    point.events!.push(event);
    point.to = Math.max(point.to!, to);
    missing.set(from, point);
  }
  return [...result, ...missing.values()].sort((a, b) => a.timestamp - b.timestamp);
}
