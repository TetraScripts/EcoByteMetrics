import { lazy, Suspense, useId, useMemo } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import type { DashboardMetric } from "../domain/dashboard";
import type { EvolutionPoint, EvolutionMode } from "../domain/evolution";
import { evolutionChartData } from "../domain/chartData";
import type { EvolutionChartPoint } from "../domain/chartData";
import { emissionScale, formatEmissions, formatNumber } from "@/shared/lib/format";

const RechartsEvolutionChart = lazy(() => import("./RechartsEvolutionChart").then(module => ({ default: module.RechartsEvolutionChart })));

export function HistoryChart({ points, chartData, metric, mode, intervalMs, loading = false, onEnergy }: {
  points: EvolutionPoint[]; metric: DashboardMetric; mode: EvolutionMode; intervalMs: number; loading?: boolean; onEnergy: () => void;
  chartData?: EvolutionChartPoint[];
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const data = useMemo(() => chartData ?? evolutionChartData(points, intervalMs), [points, intervalMs, chartData]);
  const scale = emissionScale(points.reduce((max, point) => Math.max(max, point.value ?? 0), 0));
  const unit = metric === "energy" ? "kWh" : scale.unit;
  const seriesLabel = metric === "energy" ? "Energia estimada" : "Emissões estimadas";
  const readingLabel = mode === "cumulative"
    ? metric === "energy" ? "Energia acumulada no período" : "CO₂e acumulado no período"
    : metric === "energy" ? "Energia no último intervalo registrado" : "CO₂e no último intervalo registrado";
  const color = metric === "energy" ? "#168998" : "#128361";
  if (!points.some(point => point.value !== null)) return <div className="evolution-chart-empty" role="status">
    <ChartNoAxesCombined size={34} strokeWidth={1.3} aria-hidden="true" />
    <h3>{loading && !points.length ? "Aguardando as primeiras coletas" : points.length ? "Ainda faltam dados de emissões" : "Nenhum registro neste período"}</h3>
    <p>{points.length ? "Não há leituras com informação suficiente para calcular carbono. Você pode consultar a energia estimada." : "Os registros aparecerão após uma coleta ou ao ajustar os filtros."}</p>
    {points.length > 0 && metric === "emissions" && <button className="monitoring-text-button" onClick={onEnergy}>Visualizar energia</button>}
  </div>;
  const latest = points.at(-1)!;
  const hasGaps = data.some(point => point.missing);
  const fullTime = (timestamp: number) => new Date(timestamp).toLocaleString("pt-BR");
  return <figure className="evolution-chart" aria-labelledby={id + "-caption"}>
    <figcaption id={id + "-caption"} className="evolution-chart-reading">
      <div><span>{readingLabel}</span><strong style={{ color }}>{metric === "energy" ? formatNumber(latest.value) : formatEmissions(latest.value, scale.divisor)} <small>{unit}</small></strong></div>
      <div className="evolution-chart-updated"><span>Última leitura registrada</span><time dateTime={new Date(latest.to ?? latest.timestamp).toISOString()}>{fullTime(latest.to ?? latest.timestamp)}</time></div>
    </figcaption>
    <div className="evolution-recharts" data-engine="recharts" data-chart-mode={mode} role="group" aria-label={seriesLabel + " ao longo do tempo"} aria-describedby={id + "-help"}>
      <Suspense fallback={<div className="evolution-chart-loading" role="status">Carregando gráfico…</div>}>
        <RechartsEvolutionChart data={data} metric={metric} mode={mode} intervalMs={intervalMs} helpId={id + "-help"} />
      </Suspense>
    </div>
    <p id={id + "-help"} className="sr-only">Use Tab para entrar no gráfico e as setas para consultar os valores. A seção Valores apresenta os mesmos dados em tabela.</p>
    <div className="evolution-chart-footnote"><span><i className={mode === "cumulative" ? "evolution-dot-key" : undefined} style={{ background: color }} />{mode === "cumulative" ? "Acumulado das leituras disponíveis" : "Total de cada intervalo"}</span>{hasGaps && <span><i className="evolution-gap-key" />Sem registros</span>}<span className="evolution-chart-interaction">Explore com mouse, toque ou teclado</span></div>
  </figure>;
}
