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
  const { loading, snapshot, error } = useMonitoring();
  const awaitingHistory = (loading || (!error && snapshot.historyIncluded === false)) && !analysis.history.length;
  const [params, setParams] = useSearchParams();
  const ids = [...new Set(params.getAll("app"))];
  const rows = useMemo(() => compareApplications(analysis.services, analysis.history, params.getAll("app"), analysis.windowStart, analysis.windowEnd), [analysis, params]);
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
      <h2 id="comparison-selection">Comparar aplicações</h2>
      <p className="monitoring-explanation">Selecione duas ou mais aplicações. A comparação usa as leituras gravadas no banco e mantém os filtros do monitoramento{analysis.selection ? ": " + analysis.selection : "."}.</p>
      <fieldset className="comparison-selection"><legend className="sr-only">Aplicações para comparar</legend>
        {analysis.services.map(service => <label key={service.id}><input type="checkbox" checked={ids.includes(service.id)} onChange={event => changeSelection(service.id, event.target.checked)} /><CountryFlag country={service.country} /><span>{service.name}<small>{serviceStatusLabels[service.status]}</small></span></label>)}
      </fieldset>
      {!analysis.services.length && <p className="monitoring-empty">{loading ? "Consultando aplicações…" : "Nenhuma aplicação disponível nesta seleção. Ajuste os filtros no monitoramento."}</p>}
      {missing.length > 0 && <p className="monitoring-notice" role="status">{missing.length} seleção(ões) não está(ão) disponível(is) nos filtros atuais. <button onClick={() => { const next = new URLSearchParams(params); next.delete("app"); for (const id of ids.filter(id => !missing.includes(id))) next.append("app", id); setParams(next); }}>Remover seleções indisponíveis</button></p>}
      {awaitingHistory ? <p className="monitoring-empty" role="status">Consultando as leituras para comparação…</p> : rows.length < 2 ? <p className="monitoring-empty">Selecione pelo menos duas aplicações para consultar a tabela.</p> : <>
        <p className="comparison-range">Mesmo intervalo de consulta: {formatDate(analysis.windowStart)} até {formatDate(analysis.windowEnd)}.</p>
        <p className="monitoring-explanation">{formatRecordedPeriod(range.first, range.last)}. Os totais somam as leituras disponíveis nesse intervalo.</p>
        <div className="monitoring-table-scroll" role="region" aria-label="Comparação das aplicações" tabIndex={0}>
          <table className="comparison-table"><caption>Estimativas das leituras disponíveis · {analysis.periodLabel}</caption>
            <thead><tr><th scope="col">Aplicação</th><th scope="col">Situação</th><th scope="col">Energia (kWh)</th><th scope="col">Emissões (g CO₂e)</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.service.id}><th scope="row"><button type="button" onClick={() => onOpenService(row.service.id)}>{row.service.name}</button></th><td>{serviceStatusLabels[row.service.status]}</td><td>{formatNumber(row.energyKwh)}</td><td>{formatNumber(row.emissionsG)}</td></tr>)}</tbody>
          </table>
        </div>
        <details className="comparison-reading-details"><summary>Ver leituras e qualidade dos dados</summary>
          <div className="monitoring-table-scroll" tabIndex={0} role="region" aria-label="Detalhes das leituras comparadas"><table className="comparison-details-table"><thead><tr><th scope="col">Aplicação</th><th scope="col">Leituras usadas no CO₂</th><th scope="col">Tempo somado das leituras (s)</th><th scope="col">Primeira / última leitura</th></tr></thead><tbody>{rows.map(row => <tr key={row.service.id}><th scope="row">{row.service.name}</th><td>{row.emissionCount} de {row.count}</td><td>{formatNumber(row.seconds)}</td><td>{formatDate(row.first)}<br />{formatDate(row.last)}</td></tr>)}</tbody></table></div>
          <p className="monitoring-explanation">O tempo somado corresponde às leituras registradas, e não necessariamente a todo o período escolhido. Leituras sem informação suficiente ficam fora do cálculo de CO₂.</p>
        </details>
        <p className="monitoring-explanation">As aplicações podem ter quantidades e durações de leituras diferentes. Um total menor não indica maior eficiência. As emissões somam somente as leituras com fator de carbono registrado; confira os detalhes das leituras acima. “—” indica que não há estimativa disponível.</p>
      </>}
    </section>;
}
