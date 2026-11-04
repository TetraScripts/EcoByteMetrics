import { useId, useMemo, useState } from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight, Clock3, Leaf, Zap } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import type { CollectionEvent, CollectionPoint, MonitoredService } from "../types";
import type { DashboardMetric, applicationImpacts } from "../domain/dashboard";
import { evolutionData } from "../domain/evolution";
import type { EvolutionMode } from "../domain/evolution";
import { HistoryChart } from "./HistoryChart";
import { evolutionChartData } from "../domain/chartData";
import { EvolutionSamples } from "./EvolutionSamples";
import { MonitoringTabs } from "./MonitoringTabs";
import { emissionScale, formatEmissions, formatNumber, formatRecordedPeriod } from "@/shared/lib/format";
import "../styles/evolution.css";

export function EvolutionPanel({ history, services, collectionEvents, metric, onMetric, period, onPeriod, mode, onMode, compact = false, loading, observedAt, impacts = [], onOpenService }: {
  history: CollectionPoint[]; services: MonitoredService[]; metric: DashboardMetric; onMetric: (metric: string) => void;
  period: string; onPeriod: (period: string) => void; mode: EvolutionMode; onMode: (mode: EvolutionMode) => void;
  compact?: boolean; loading: boolean; observedAt: string;
  impacts?: ReturnType<typeof applicationImpacts>; onOpenService: (id: string) => void;
  collectionEvents?: CollectionEvent[];
}) {
  const data = useMemo(() => evolutionData(history, metric, mode), [history, metric, mode]);
  const chartData = useMemo(() => {
    const ids = new Set(services.map(service => service.id));
    return evolutionChartData(data.points, data.intervalMs, collectionEvents?.filter(event => !event.serviceIds || event.serviceIds.some(id => ids.has(id))));
  }, [data, services, collectionEvents]);
  const { summary } = data;
  const complete = summary.count > 0 && summary.emissionCount === summary.count;
  const interval = data.intervalMs === 30_000 ? "30 segundos" : data.intervalMs === 300_000 ? "5 minutos" : "1 hora";
  const stamp = (timestamp: number | null) => timestamp === null ? "Aguardando coleta" : new Date(timestamp).toLocaleString("pt-BR");
  const contributors = impacts.filter(entry => entry.summary.count > 0);
  const scale = emissionScale(summary.emissionsG);
  const unit = metric === "energy" ? "kWh" : scale.unit;
  const chartUnit = metric === "energy" ? "kWh" : emissionScale(data.points.reduce((max, point) => Math.max(max, point.value ?? 0), 0)).unit;
  const [params, setParams] = useSearchParams();
  const panelId = useId();
  const sections = [
    { value: "grafico", label: "Gráfico" },
    ...(!compact ? [{ value: "aplicacoes", label: "Aplicações" }] : []),
    { value: "coletas", label: "Valores" },
    { value: "detalhes", label: "Sobre os dados" },
  ];
  const section = sections.find(entry => entry.value === params.get("painel"))?.value ?? "grafico";
  const [applicationPage, setApplicationPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(contributors.length / 5) - 1);
  const page = Math.min(applicationPage, lastPage);
  return <section className={"monitoring-evolution evolution-panel" + (compact ? " evolution-panel--compact" : "")}>
    <div className="evolution-heading">
      <div><h2>Evolução {compact ? "da aplicação" : "do ambiente"}</h2><span className="evolution-session-label">{observedAt && "Instante em revisão · "}{formatRecordedPeriod(data.first, data.last)}</span></div>
      <div className="evolution-toolbar">
        <div className="evolution-segmented" role="group" aria-label="Métrica da evolução"><button type="button" aria-pressed={metric === "emissions"} onClick={() => onMetric("emissions")}><Leaf size={15} aria-hidden="true" />Emissões</button><button type="button" aria-pressed={metric === "energy"} onClick={() => onMetric("energy")}><Zap size={15} aria-hidden="true" />Energia</button></div>
        <label className="evolution-period"><Clock3 size={16} aria-hidden="true" /><select aria-label="Período da evolução" value={period} onChange={event => onPeriod(event.target.value)}><option value="24h">Até 24 horas</option><option value="7d">Até 7 dias</option></select></label>
      </div>
    </div>

    <MonitoringTabs className="evolution-sections" label="Seções da evolução" panelId={panelId} tabs={sections} value={section} onChange={value => {
      const next = new URLSearchParams(params);
      if (value === "grafico") next.delete("painel"); else next.set("painel", value);
      setParams(next);
    }} />

    <div className="evolution-section" id={panelId} role="tabpanel" aria-label={sections.find(entry => entry.value === section)!.label}>
      {section === "grafico" && <section className="evolution-chart-panel" aria-label="Série de estimativas">
        <div className="evolution-chart-heading"><div><h3>{metric === "energy" ? "Consumo de energia" : "Emissões de carbono"}</h3><span>Intervalos de {interval} · {chartUnit}</span></div><div className="evolution-segmented evolution-mode" role="group" aria-label="Modo do gráfico"><button type="button" aria-pressed={mode === "intervals"} onClick={() => onMode("intervals")}>Por intervalo</button><button type="button" aria-pressed={mode === "cumulative"} onClick={() => onMode("cumulative")}>Acumulado</button></div></div>
        <HistoryChart points={data.points} chartData={chartData} metric={metric} mode={mode} intervalMs={data.intervalMs} loading={loading} onEnergy={() => onMetric("energy")} />
      </section>}

      {section === "aplicacoes" && <section className="evolution-contributors">
        <div className="evolution-subheading"><h3>Impacto por aplicação</h3><span>{metric === "energy" ? "Energia" : "Emissões"} no período</span></div>
        {contributors.length ? <><ol>{contributors.slice(page * 5, (page + 1) * 5).map(({ service, value }) => {
          return <li key={service.id}><button onClick={() => onOpenService(service.id)}><span>{service.name}</span><ArrowUpRight size={15} aria-hidden="true" /></button><div><strong>{metric === "energy" ? formatNumber(value) : formatEmissions(value, scale.divisor)} <small>{unit}</small></strong></div></li>;
        })}</ol><div className="evolution-pagination"><span aria-live="polite">{page * 5 + 1}–{Math.min((page + 1) * 5, contributors.length)} de {contributors.length} aplicações</span><div><button aria-label="Página anterior de aplicações" disabled={page === 0} onClick={() => setApplicationPage(page - 1)}><ChevronLeft size={18} /></button><button aria-label="Próxima página de aplicações" disabled={page === lastPage} onClick={() => setApplicationPage(page + 1)}><ChevronRight size={18} /></button></div></div></> : <p className="evolution-section-empty">A participação aparecerá quando houver coletas.</p>}
      </section>}

      {section === "coletas" && <EvolutionSamples points={data.points} metric={metric} mode={mode} />}

      {section === "detalhes" && <section className="evolution-details">
        <h3>Entenda os dados desta seleção</h3>
        <dl className="evolution-details-grid">
          <div><dt>Energia total no período</dt><dd>{formatNumber(summary.energyKwh)} kWh<small>Soma da energia estimada nas leituras disponíveis, em quilowatts-hora (kWh). Não é o consumo de uma única coleta.</small></dd></div>
          <div><dt>CO₂e calculado no período</dt><dd>{formatEmissions(summary.emissionsG)} {scale.unit}<small>{complete || !summary.count ? "Soma das emissões estimadas nas leituras disponíveis." : "Soma das emissões que foi possível calcular. Algumas leituras ficaram fora por falta de dados; não contam como emissão zero."}</small></dd></div>
          <div><dt>Leituras salvas</dt><dd>{summary.count.toLocaleString("pt-BR")}<small>Cada leitura registra uma aplicação em um momento. Uma rodada pode gerar leituras de várias aplicações.</small></dd></div>
          <div><dt>Aplicações com registros</dt><dd>{data.serviceCount} de {services.length}<small>Aplicações com pelo menos uma leitura no período, entre as incluídas nos filtros. Não indica quantas estão disponíveis agora.</small></dd></div>
          <div><dt>Início dos registros disponíveis</dt><dd>{stamp(data.first)}<small>Horário da primeira leitura encontrada nesta seleção, no fuso deste dispositivo.</small></dd></div>
          <div><dt>Fim dos registros disponíveis</dt><dd>{stamp(data.last)}<small>Horário da última leitura encontrada nesta seleção, no fuso deste dispositivo.</small></dd></div>
        </dl>
        <details className="evolution-data-explanation">
          <summary>Como interpretar o período e as estimativas</summary>
          <p>O período escolhido é um limite de busca. Selecionar até 7 dias não garante sete dias completos de registros: as datas acima mostram o que realmente foi encontrado.</p>
          <p>A energia é estimada com base nos recursos usados e na duração de cada leitura. O CO₂e representa as emissões equivalentes de gases de efeito estufa, estimadas a partir dessa energia e do fator de carbono da eletricidade na região.</p>
          <p>Trechos sem leituras ficam sem valores: não são preenchidos como consumo zero. Um total menor pode resultar de menos registros ou menos tempo de atividade e, sozinho, não indica maior eficiência.</p>
        </details>
      </section>}
    </div>
  </section>;
}
