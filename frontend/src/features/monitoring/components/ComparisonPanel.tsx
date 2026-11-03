import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useMonitoring } from "../hooks/useMonitoring";
import { useAnalysis } from "../hooks/useAnalysis";
import { compareApplications } from "../domain/comparison";
import { CountryFlag } from "@/shared/ui/CountryFlag";
import { formatNumber, formatRecordedPeriod } from "@/shared/lib/format";
import { collectionRange } from "../domain/history";
import { serviceStatusLabels } from "../types";

export function ComparisonPanel({ onOpenService }: { onOpenService: (id: string) => void }) {
  const analysis = useAnalysis();
  const { loading, snapshot, error, period } = useMonitoring();
  const [params, setParams] = useSearchParams();
  const latest = params.get("comparacao") === "ultima";
  const awaitingHistory = !latest && (loading || (!error && snapshot.historyIncluded === false)) && !analysis.history.length;
  const ids = [...new Set(params.getAll("app"))];
  const rows = useMemo(() => compareApplications(analysis.services, analysis.history, params.getAll("app"), analysis.windowStart, analysis.windowEnd, latest), [analysis, params, latest]);
  const missing = ids.filter(id => !analysis.services.some(service => service.id === id));
  const range = collectionRange(analysis.history.filter(point => ids.includes(point.serviceId)));
  const changeSelection = (id: string, checked: boolean) => {
    const next = new URLSearchParams(params);
    next.delete("app");
    for (const value of checked ? [...ids, id] : ids.filter(value => value !== id)) next.append("app", value);
    setParams(next);
  };
  const formatDate = (value: number | null) => value === null ? "—" : new Date(value).toLocaleString("pt-BR");
  return <section className="comparison-content" aria-labelledby="comparison-selection">
      <div className="comparison-toolbar">
        <h2 id="comparison-selection">Comparar aplicações</h2>
        <div className="evolution-segmented" role="group" aria-label="Dados da comparação">
          <button type="button" aria-pressed={latest} onClick={() => { const next = new URLSearchParams(params); next.set("comparacao", "ultima"); setParams(next); }}>Última coleta</button>
          <button type="button" aria-pressed={!latest} onClick={() => { const next = new URLSearchParams(params); next.delete("comparacao"); setParams(next); }}>Total no período</button>
        </div>
        {!latest && <label className="comparison-period">Período<select aria-label="Período da comparação" value={period} onChange={event => { const next = new URLSearchParams(params); next.set("periodo", event.target.value); setParams(next); }}><option value="24h">Até 24 horas</option><option value="7d">Até 7 dias</option></select></label>}
      </div>
      <p className="monitoring-explanation">Selecione duas ou mais aplicações. {latest ? "Compare a última leitura disponível de cada aplicação. Os horários e as durações podem ser diferentes; os valores não são uma soma do período. A comparação mantém os filtros do monitoramento" : "Compare a soma da energia e das emissões das leituras gravadas no período. A comparação mantém os filtros do monitoramento"}{analysis.selection ? ": " + analysis.selection : ""}.</p>
      <fieldset className="comparison-selection"><legend className="sr-only">Aplicações para comparar</legend>
        {analysis.services.map(service => <label key={service.id}><input type="checkbox" checked={ids.includes(service.id)} onChange={event => changeSelection(service.id, event.target.checked)} /><CountryFlag country={service.country} /><span>{service.name}<small>{serviceStatusLabels[service.status]}</small></span></label>)}
      </fieldset>
      {!analysis.services.length && <p className="monitoring-empty">{loading ? "Consultando aplicações…" : "Nenhuma aplicação disponível nesta seleção. Ajuste os filtros no monitoramento."}</p>}
      {missing.length > 0 && <p className="monitoring-notice" role="status">{missing.length} seleção(ões) não está(ão) disponível(is) nos filtros atuais. <button onClick={() => { const next = new URLSearchParams(params); next.delete("app"); for (const id of ids.filter(id => !missing.includes(id))) next.append("app", id); setParams(next); }}>Remover seleções indisponíveis</button></p>}
      {awaitingHistory ? <p className="monitoring-empty" role="status">Consultando as leituras para comparação…</p> : rows.length < 2 ? null : <>
        {!latest && <p className="comparison-range">Mesmo intervalo de consulta: {formatDate(analysis.windowStart)} até {formatDate(analysis.windowEnd)}.</p>}
        {!latest && <p className="monitoring-explanation">{formatRecordedPeriod(range.first, range.last)}. Os totais somam as leituras disponíveis nesse intervalo.</p>}
        <div className="monitoring-table-scroll" role="region" aria-label="Comparação das aplicações" tabIndex={0}>
          <table className="comparison-table"><caption>{latest ? "Última leitura disponível por aplicação" : "Totais das leituras disponíveis · " + analysis.periodLabel}</caption>
            <thead><tr><th scope="col">Aplicação</th><th scope="col">Situação</th><th scope="col">Energia (kWh)</th><th scope="col">Emissões (kg CO₂e)</th>{latest && <th scope="col">Coletada em</th>}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.service.id}><th scope="row"><button type="button" onClick={() => onOpenService(row.service.id)}>{row.service.name}</button></th><td>{serviceStatusLabels[row.service.status]}</td><td>{formatNumber(row.energyKwh)}</td><td>{formatNumber(row.emissionsG === null ? null : row.emissionsG / 1000)}</td>{latest && <td>{formatDate(row.last)}</td>}</tr>)}</tbody>
          </table>
        </div>
      </>}
    </section>;
}
