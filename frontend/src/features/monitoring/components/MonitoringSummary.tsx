import type { CollectionPoint, MonitoredService } from "../types";
import { RotateCw } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { collectionRange, summarizeCollections } from "../domain/history";
import { emissionScale, formatEmissions, formatNumber } from "@/shared/lib/format";
import { createRefreshAnimation } from "../domain/refreshAnimation";
import { InfoTooltip } from "@/shared/ui/InfoTooltip";
import { serviceStatusLabels } from "../types";

export function MonitoringSummary({ services, history, loading, onRefresh, comparison = false, latest = false, context, totals: providedTotals }: {
  services: MonitoredService[]; history: CollectionPoint[];
  loading: boolean; onRefresh: () => void;
  comparison?: boolean; latest?: boolean; context?: ReactNode;
  totals?: ReturnType<typeof summarizeCollections>;
}) {
  const refreshIcon = useRef<SVGSVGElement>(null);
  const animation = useRef<ReturnType<typeof createRefreshAnimation> | null>(null);
  useEffect(() => {
    if (!refreshIcon.current) return;
    const controller = createRefreshAnimation(refreshIcon.current);
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => controller.setReducedMotion(preference.matches);
    animation.current = controller;
    updateMotion();
    preference.addEventListener("change", updateMotion);
    return () => { preference.removeEventListener("change", updateMotion); controller.dispose(); animation.current = null; };
  }, [comparison]);
  useEffect(() => { animation.current?.setLoading(loading); }, [loading, comparison]);
  const totals = providedTotals ?? summarizeCollections(history);
  const { last } = collectionRange(history);
  const formatDate = (value: string | number) => new Date(value).toLocaleString("pt-BR");
  const refreshHelp = "A página consulta os dados salvos a cada 30 segundos enquanto está visível. Esta seta antecipa a consulta; não inicia uma nova coleta no servidor.";
  return <section className="monitoring-summary" aria-label="Totais da seleção">
    <div className="monitoring-visible-totals">
      <div><span>{latest ? "CO₂e das últimas coletas" : "CO₂e calculado na seleção"}<InfoTooltip label="total de carbono">{latest ? "Soma das estimativas da última leitura disponível de cada aplicação filtrada. As leituras podem ter horários e durações diferentes. Leituras sem fator de carbono não entram na soma." : "Soma das estimativas de carbono disponíveis no período e nas aplicações selecionadas. Leituras sem fator de carbono não são consideradas emissão zero."}</InfoTooltip></span><strong>{formatEmissions(totals.emissionsG)} <small>{emissionScale(totals.emissionsG).unit}</small></strong></div>
      <div><span>{latest ? "Energia das últimas coletas" : "Energia estimada na seleção"}<InfoTooltip label="total de energia">{latest ? "Soma da energia estimada nas últimas leituras disponíveis. Não representa uma medição simultânea do ambiente; aplicações sem novas leituras podem conservar dados antigos." : "Soma da energia estimada nas leituras registradas no período e nas aplicações selecionadas. Intervalos sem leituras não são preenchidos."}</InfoTooltip></span><strong>{formatNumber(totals.energyKwh)} <small>kWh</small></strong></div>
      <span className="monitoring-total-scope">Totais das {services.length} aplicações {comparison ? "marcadas para comparação." : "filtradas, incluindo todas as páginas da lista."}</span>
      <ul className="monitoring-operational-counts" aria-label="Situação das aplicações na seleção">{Object.entries(serviceStatusLabels).map(([status,label]) => {
        const count = services.filter(service => service.status === status).length;
        return count || status === "available" || status === "unavailable" ? <li key={status}>{label}: <strong>{count}</strong></li> : null;
      })}</ul>
    </div>
    {context}
    {!comparison && <div className="monitoring-update"><span role="status">{last !== null ? "Dados coletados até " + formatDate(last) : loading ? "Consultando registros…" : "Ainda sem leituras nesta seleção"}</span><button type="button" className="monitoring-refresh" aria-label={loading ? "Consultando dados salvos" : "Consultar dados salvos"} title={refreshHelp} aria-description={refreshHelp} aria-busy={loading} disabled={loading} onClick={onRefresh}><RotateCw ref={refreshIcon} size={21} aria-hidden="true" className="monitoring-refresh-icon" /></button></div>}
  </section>;
}
