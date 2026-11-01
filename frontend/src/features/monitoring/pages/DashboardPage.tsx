import "../styles/map.css";
import "../styles/dashboard.css";
import "../styles/dashboard-clarity.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Clock3, ListFilter, Search, X } from "lucide-react";
import { FiltersDialog } from "../components/FiltersDialog";
import { InfoTooltip } from "@/shared/ui/InfoTooltip";
import { localDateTimeMax } from "@/shared/lib/localDate";
import { clearMonitoringFilters } from "../domain/analysis";
import { SortSelect } from "../components/SortSelect";
import { useSearchParams } from "react-router-dom";
import { RegionMap } from "../components/map/RegionMap";
import { MonitoringTabs } from "../components/MonitoringTabs";
import { EvolutionPanel } from "../components/EvolutionPanel";
import { ComparisonPanel } from "../components/ComparisonPanel";
import { AdministrationPanel } from "../components/AdministrationPanel";
import { ObservationTimeline } from "../components/ObservationTimeline";
import { MonitoringSummary } from "../components/MonitoringSummary";
import { MonitoringState } from "../components/MonitoringState";
import type { ImpactLens } from "../domain/observatory";
import { useMonitoring } from "../hooks/useMonitoring";
import { useAnalysis } from "../hooks/useAnalysis";
import { applicationImpacts, serviceLocationPeers, statusColors } from "../domain/dashboard";
import type { DashboardMetric } from "../domain/dashboard";
import { collectionRange, latestCollections } from "../domain/history";
import { serviceStatusLabels } from "../types";
import type { MonitoredService } from "../types";
import { formatDataPeriod, formatNumber, formatRecordedPeriod } from "@/shared/lib/format";
import { CountryFlag } from "@/shared/ui/CountryFlag";
import { TopographicSides } from "../components/TopographicSides";
import { AdministrationAccess } from "@/features/auth/AdministrationAccess";

const stamp = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "Ainda não realizada";

function ServiceStatus({ service }: { service: MonitoredService }) {
  return <span className="monitoring-status" title={service.statusMessage}><i style={{ background: statusColors[service.status] }} />{serviceStatusLabels[service.status]}</span>;
}

export function DashboardPage() {
  const { snapshot, loading, error, refresh, period, setHistoryOpen } = useMonitoring();
  const analysis = useAnalysis();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(() => params.get("painel") === "historico");
  useEffect(() => { setHistoryOpen?.(filtersOpen); return () => setHistoryOpen?.(false); }, [filtersOpen, setHistoryOpen]);
  const [applicationPage, setApplicationPage] = useState(0);
  const [hoveredServiceId, setHoveredServiceId] = useState("");
  const [focusedServiceId, setFocusedServiceId] = useState("");
  const [mapHighlightedIds, setMapHighlightedIds] = useState<string[]>([]);
  const [mobile, setMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 680px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 680px)");
    const change = (event: MediaQueryListEvent) => setMobile(event.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousSelection = useRef("");
  const restoringListFocus = useRef(false);
  const selectedId = params.get("servico") ?? "";
  const selectedCandidate = analysis.environmentServices.find(service => service.id === selectedId);
  const selected = analysis.services.find(service => service.id === selectedId);
  const selectedOutsideFilters = Boolean(selectedCandidate && !selected);
  const search = params.get("busca") ?? "";
  const status = params.get("estado") ?? "";
  const metric: DashboardMetric = params.get("ordem") === "energy" ? "energy" : "emissions";
  const lens: ImpactLens = params.get("lente") === "energy" ? "energy" : params.get("lente") === "emissions" ? "emissions" : "status";
  const tab = params.get("aba") === "administracao" ? "administracao" : params.get("aba") === "comparar" ? "comparar" : params.get("aba") === "evolucao" ? "evolucao" : params.get("aba") === "mapa" && mobile ? "mapa" : "geral";
  const administration = !selectedId && tab === "administracao";
  const detailTab = ["recursos", "evolucao"].includes(params.get("detalhe") ?? "") ? params.get("detalhe")! : "resumo";
  const historicalView = selectedId ? detailTab === "evolucao" : tab === "evolucao" || tab === "comparar";
  const evolutionMode = params.get("serie") === "intervalos" ? "intervals" : "cumulative";
  const filtered = Boolean(search || status || analysis.regional || analysis.date || params.has("periodo"));
  const update = useCallback((values: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value); else next.delete(key);
    }
    if (["busca", "estado", "pais", "regiao", "ordem", "periodo"].some(key => key in values)) setApplicationPage(0);
    setParams(next, { replace });
  }, [params, setParams]);
  const services = analysis.services;
  const mapServices = useMemo(() => selected ? serviceLocationPeers(analysis.environmentServices, selected) : services, [selected, services, analysis.environmentServices]);
  const history = analysis.history;
  const impacts = useMemo(() => applicationImpacts(services, history, metric), [services, history, metric]);
  const latestHistory = useMemo(() => latestCollections(services), [services]);
  const latestImpacts = useMemo(() => applicationImpacts(services, latestHistory, metric, true), [services, latestHistory, metric]);
  const latestOverview = !selectedId && (tab === "geral" || tab === "mapa");
  const lastPage = Math.max(0, Math.ceil(latestImpacts.length / 5) - 1);
  const page = Math.min(applicationPage, lastPage);
  const visibleImpacts = latestImpacts.slice(page * 5, page * 5 + 5);
  const focusServiceId = focusedServiceId || hoveredServiceId;
  const highlightedIds = focusServiceId ? [focusServiceId] : mapHighlightedIds;
  const selectedHistory = useMemo(() => analysis.history.filter(point => point.serviceId === selectedId), [analysis.history, selectedId]);
  const selectedRange = useMemo(() => collectionRange(selectedHistory), [selectedHistory]);
  const comparedIds = params.getAll("app");
  const summaryServices = tab === "comparar" ? services.filter(service => comparedIds.includes(service.id)) : services;
  const summaryHistory = tab === "comparar" ? history.filter(point => comparedIds.includes(point.serviceId)) : latestOverview ? latestHistory : history;
  const shownRange = selected ? selectedRange : tab === "comparar" || latestOverview ? collectionRange(summaryHistory) : { first: analysis.availableSince, last: analysis.availableUntil };
  const countries = [...new Set(analysis.environmentServices.map(service => service.country).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const regionOptions = [...new Map(analysis.environmentServices.filter(service => service.regionCode && (!analysis.country || service.country === analysis.country)).map(service => [service.regionCode!, service])).values()];
  useEffect(() => {
    if (selectedId) {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    } else if (previousSelection.current) {
      restoringListFocus.current = true;
      document.getElementById("application-" + previousSelection.current)?.focus({ preventScroll: true });
      restoringListFocus.current = false;
    }
    previousSelection.current = selectedId;
  }, [selectedId]);
  const openService = useCallback((id: string) => {
    setHoveredServiceId(""); setFocusedServiceId(""); setMapHighlightedIds([]);
    update({ servico: id, detalhe: "" });
  }, [update]);
  const back = () => update({ servico: "", detalhe: "" });
  const clearFilters = () => { setApplicationPage(0); setParams(clearMonitoringFilters(params.toString())); };
  const goLive = () => update({ instante: "", ate: "" });
  const discovering = snapshot.source !== "database" && !snapshot.observations?.length && !snapshot.discoveryUpdatedAt && !error;
  const filterButton = <button className="monitoring-filter-button" aria-expanded={filtersOpen} aria-controls="monitoring-filters" aria-haspopup="dialog" onClick={() => setFiltersOpen(!filtersOpen)}><ListFilter size={22} />Filtrar{(filtered || analysis.observedAt) && <span className="filter-indicator" aria-label="Filtros ativos" />}</button>;
  const dataContext = (<section className="monitoring-data-context" aria-label="Período dos dados">
      <div><strong title={formatRecordedPeriod(shownRange.first, shownRange.last)}>{((loading || (!error && snapshot.historyIncluded === false)) && !summaryHistory.length) || discovering ? "Consultando os registros da seleção…" : tab === "comparar" && !summaryServices.length ? "Selecione aplicações para comparar" : formatDataPeriod(shownRange.first, shownRange.last)}</strong><p>Estimativas de energia e carbono dos registros disponíveis.<InfoTooltip label="estimativas ambientais">Os valores são estimativas calculadas a partir do uso das aplicações, e não medições diretas de eletricidade ou CO₂ na atmosfera. CO₂e significa dióxido de carbono equivalente.</InfoTooltip></p></div>
      <span>Filtro: {period === "7d" ? "até 7 dias" : "até 24 horas"}{analysis.observedAt && " anteriores ao horário escolhido"}</span>
    </section>);
  return <>
    <TopographicSides key="topography" />
    {selectedId ? <div className="monitoring-heading detail-heading">
      <div className="monitoring-detail-toolbar"><button className="monitoring-back" onClick={back}><ArrowLeft size={18} />Voltar à lista</button>{!historicalView && filterButton}</div>
      <h1 ref={heading} tabIndex={-1}>{selectedCandidate?.name ?? "Aplicação não encontrada"}</h1>
      {selected && <p><CountryFlag country={selected.country} />{[selected.city, selected.region, selected.country].filter(Boolean).join(" · ") || "Localização não informada"} <span className="heading-separator">·</span> <ServiceStatus service={selected} /></p>}
    </div> : <div className="monitoring-heading">
      <div><h1>Monitoramento</h1></div>
      {!administration && !historicalView && <div className="monitoring-tools">
        <label className="monitoring-search"><Search size={21} aria-hidden="true" /><input type="search" aria-label="Buscar aplicação" placeholder="Buscar aplicação..." value={search} onChange={event => update({ busca: event.target.value }, true)} /></label>
        {filterButton}
      </div>}
    </div>}
    {!administration && !historicalView && filtersOpen && <FiltersDialog onClose={() => setFiltersOpen(false)}><div className="monitoring-filters">
      <label>País<select value={params.get("pais") ?? ""} onChange={event => update({ pais: event.target.value, cidade: "", regiao: "" })}><option value="">Todos os países</option>{countries.map(country => <option key={country}>{country}</option>)}</select></label>
      <label>Região<select value={params.get("regiao") ?? ""} onChange={event => update({ regiao: event.target.value, cidade: "" })}><option value="">Todas as regiões</option>{regionOptions.map(service => <option key={service.regionCode} value={service.regionCode}>{[service.city, service.region].filter(Boolean).join(" · ") || service.regionCode}</option>)}</select></label>
      <label>Situação da aplicação<select value={status} onChange={event => update({ estado: event.target.value })}><option value="">Todas as situações</option>{Object.entries(serviceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {historicalView && <label>Período<select value={period} onChange={event => update({ periodo: event.target.value })}><option value="24h">Até 24 horas</option><option value="7d">Até 7 dias</option></select></label>}
      <label>Consultar o passado até<input aria-label="Consultar o passado até" type="datetime-local" max={localDateTimeMax()} value={analysis.invalidDate ? "" : analysis.date} onChange={event => update({ ate: event.target.value })} /></label>
      <button className="monitoring-text-button" onClick={clearFilters}><X size={16} />Limpar filtros</button>
      <div className="monitoring-filter-history"><h3>Escolher um horário anterior</h3><ObservationTimeline loading={loading || (!error && snapshot.historyIncluded === false)} observations={snapshot.observations ?? []} selected={analysis.observedAt} onSelect={value => update({ instante: value, ate: "" }, true)} onLive={goLive} onExplore={!selectedId && tab === "evolucao" ? () => { update({ aba: mobile ? "mapa" : "" }); setFiltersOpen(false); } : undefined} /></div>
    </div><p className="monitoring-filter-note">Limpar filtros mantém o período escolhido.</p></FiltersDialog>}
    {!administration && <>
    {analysis.invalidDate && <p className="monitoring-notice" role="alert">Escolha uma data válida até o momento atual. <button onClick={goLive}>Voltar para agora</button></p>}
    {analysis.observationMissing && <p className="monitoring-notice" role="alert">Este instante não está disponível no histórico consultado. <button onClick={goLive}>Voltar para agora</button></p>}
    {error && <div className="monitoring-notice" role="alert"><p>{snapshot.services.length ? "A atualização falhou. Exibindo os últimos dados recebidos." : "Não foi possível consultar as aplicações."}</p><button onClick={() => void refresh()} disabled={loading}>{loading ? "Atualizando…" : "Tentar novamente"}</button><details><summary>Detalhes da conexão</summary><p>{error}</p></details></div>}
    {selectedId && historicalView && dataContext}
    {analysis.observedAt && <div className="monitoring-past-banner" role="status"><Clock3 size={18} aria-hidden="true" /><span>Você está consultando o passado: <strong>{stamp(analysis.observedAt)}</strong></span><button type="button" onClick={goLive}>Voltar para agora</button></div>}
    {snapshot.warning && <details className="monitoring-notice"><summary>Parte dos dados não pôde ser atualizada</summary>
      <p>{snapshot.warning}</p>
    </details>}
    </>}
    {selectedId ? selected && <MonitoringTabs label="Informações da aplicação" value={detailTab} tabs={[{ value: "resumo", label: "Resumo" }, { value: "recursos", label: "Recursos" }, { value: "evolucao", label: "Evolução" }]} onChange={value => update({ detalhe: value })} /> : <MonitoringTabs label="Visualização do monitoramento" value={tab} tabs={[{ value: "geral", label: "Visão geral", mobileLabel: "Serviços" }, { value: "mapa", label: "Mapa", className: "mobile-map-tab" }, { value: "evolucao", label: "Evolução" }, { value: "comparar", label: "Comparar" }, { value: "administracao", label: "Administração", restricted: true }]} onChange={value => update({ aba: value === "geral" ? "" : value })} />}
    {!selectedId && !administration && <MonitoringSummary context={latestOverview ? undefined : dataContext} latest={latestOverview} services={summaryServices} history={summaryHistory} comparison={tab === "comparar"} loading={loading} onRefresh={() => void refresh()} />}
    <section key="monitoring-content" className="monitoring-view" id="monitoring-content" role="tabpanel" aria-label={selectedId ? "Detalhes da aplicação" : administration ? "Administração do ambiente" : tab === "comparar" ? "Comparação de aplicações" : tab === "evolucao" ? "Evolução do ambiente" : "Visão geral do ambiente"}>
      <div className={"monitoring-overview" + (selected ? " service-overview" : "")} data-view={tab} hidden={selectedId ? !selected : tab === "evolucao" || tab === "comparar" || administration}>
        <section className="monitoring-location" aria-label="Localização dos serviços">
          {selected && <h2>Localização do serviço</h2>}
          {selected && (selected.latitude === undefined || selected.longitude === undefined) && <p className="monitoring-explanation">Sem coordenadas para marcar esta aplicação no globo. Os recursos e as estimativas continuam disponíveis ao lado.</p>}
          <RegionMap key="world" services={mapServices} selectedServiceId={selected?.id} onSelectService={openService} history={selected ? analysis.history : history} lens={lens} highlightedServiceIds={highlightedIds} focusServiceId={selected ? undefined : focusServiceId} onHighlightServices={setMapHighlightedIds} />
        </section>
        {selected ? <section className="monitoring-service-summary">
          {detailTab === "resumo" ? <><h2>Impacto estimado na última coleta</h2><dl className="monitoring-facts">
            <div><dt>Energia na última coleta</dt><dd>{formatNumber(selected.energyKwh)} <small>kWh</small></dd></div>
            <div><dt>CO₂e na última coleta</dt><dd>{formatNumber(selected.emissionsG)} <small>g CO₂e</small></dd></div>
            <div><dt>Última coleta válida</dt><dd className="fact-text">{stamp(selected.lastCollectionAt)}</dd></div>
            <div><dt>Intensidade de carbono da última coleta</dt><dd className="fact-text">{formatNumber(selected.carbonIntensity ?? null)} g CO₂e/kWh</dd></div>
          </dl><button className="monitoring-text-button" onClick={() => update({ detalhe: "evolucao" })}>Ver totais e histórico</button>{selected.statusMessage && <p className="service-message">{selected.statusMessage}</p>}</> : detailTab === "recursos" ? <section className="monitoring-resources"><div className="monitoring-section-heading"><h2>Recursos da última coleta</h2><span>{stamp(selected.lastCollectionAt)}</span></div>
          <dl className="monitoring-resource-list">{[
            ["CPU", selected.cpuPercent, "%"], ["Memória", selected.memoryGb, "GB"], ["Disco", selected.diskGb, "GB"], ["Rede", selected.networkGb, "GB"], ["Tempo representado pela leitura", selected.collectionIntervalSeconds ?? null, "s"],
          ].map(([label, value, unit]) => <div key={String(label)}><dt>{label}</dt><dd>{formatNumber(value as number | null)} <span>{unit}</span></dd></div>)}</dl>{selected.statusMessage && <p className="service-message">{selected.statusMessage}</p>}<p className="monitoring-explanation">Valores ausentes são exibidos como “—”. Métricas antigas preservam o estado de desatualização da aplicação.</p>
        </section> : detailTab === "evolucao" ? <EvolutionPanel collectionEvents={analysis.collectionEvents} history={selectedHistory} services={[selected]} metric={metric} onMetric={value => update({ ordem: value })} period={period} onPeriod={value => update({ periodo: value })} mode={evolutionMode} onMode={value => update({ serie: value === "intervals" ? "intervalos" : "" })} compact loading={loading || (!error && snapshot.historyIncluded === false)} observedAt={analysis.observedAt} onOpenService={openService} /> : null}
        </section> : <section className="monitoring-applications"><div className="monitoring-section-heading"><div><h2>Aplicações</h2></div><SortSelect value={metric} onChange={nextMetric => update({ ordem: nextMetric })} /></div>
            <div className="monitoring-table-scroll" tabIndex={0} role="region" aria-label="Lista de aplicações">
              <table className="monitoring-app-table"><caption className="sr-only">Aplicações na seleção e estimativas da última coleta de cada aplicação.</caption><thead><tr><th scope="col">Aplicação</th><th scope="col">{analysis.observedAt ? "Situação naquele horário" : "Situação atual"}</th><th scope="col">{metric === "energy" ? "Energia" : "CO₂e"} na última coleta</th></tr></thead>
                <tbody>{visibleImpacts.map(({ service, value }) => <tr key={service.id} data-highlighted={highlightedIds.includes(service.id)} onMouseEnter={() => setHoveredServiceId(service.id)} onMouseLeave={() => setHoveredServiceId("")}><td><button id={"application-" + service.id} onFocus={() => { if (!restoringListFocus.current) setFocusedServiceId(service.id); }} onBlur={() => setFocusedServiceId("")} onClick={() => openService(service.id)}><span className="monitoring-application-name"><CountryFlag country={service.country} /><span>{service.name}</span></span><ArrowUpRight size={15} aria-hidden="true" /></button></td><td><ServiceStatus service={service} /></td><td title={"Última coleta: " + stamp(service.lastCollectionAt)}><span key={service.lastCollectionAt ?? service.id} className="monitoring-sample-value">{formatNumber(value)}{value !== null && (metric === "energy" ? " kWh" : " g")}</span></td></tr>)}</tbody>
              </table>
            </div>
            {services.length > 0 && <><nav className="monitoring-list-pagination" aria-label="Páginas das aplicações"><span>{page * 5 + 1}–{Math.min(page * 5 + 5, latestImpacts.length)} de {latestImpacts.length} aplicações</span><div><button type="button" aria-label="Aplicações anteriores" disabled={page === 0} onClick={() => setApplicationPage(page - 1)}><ChevronLeft size={17} /></button><button type="button" aria-label="Próximas aplicações" disabled={page === lastPage} onClick={() => setApplicationPage(page + 1)}><ChevronRight size={17} /></button></div></nav></>}
            {!services.length && <MonitoringState kind={loading || discovering ? "loading" : error && !snapshot.services.length ? "offline" : filtered || analysis.environmentServices.length ? "filtered" : "empty"} onReset={clearFilters} />}
          </section>}
      </div>
      {selectedId ? !selected ? <p className="monitoring-empty" role="status">{selectedOutsideFilters ? <>Esta aplicação está fora dos filtros atuais. <button className="monitoring-text-button" onClick={clearFilters}>Limpar filtros</button> </> : "Esta aplicação não está no ambiente recebido. "}<button className="monitoring-text-button" onClick={back}>Voltar à lista</button></p> : null : tab === "evolucao" && <EvolutionPanel collectionEvents={analysis.collectionEvents} history={history} services={services} metric={metric} onMetric={value => update({ ordem: value })} period={period} onPeriod={value => update({ periodo: value })} mode={evolutionMode} onMode={value => update({ serie: value === "intervals" ? "intervalos" : "" })} loading={loading || (!error && snapshot.historyIncluded === false)} observedAt={analysis.observedAt} impacts={impacts} onOpenService={openService} />}
      {!selectedId && tab === "comparar" && <ComparisonPanel onOpenService={openService} />}
      {administration && <AdministrationAccess><AdministrationPanel /></AdministrationAccess>}
    </section>
  </>;
}
