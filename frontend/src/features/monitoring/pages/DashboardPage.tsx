import "../styles/map.css";
import "../styles/dashboard.css";
import "../styles/dashboard-clarity.css";
import "@/shared/ui/AnimatedList.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cpu,
  Gauge,
  Globe2,
  HardDrive,
  Leaf,
  ListFilter,
  MapPin,
  Search,
  TrendingDown,
  Wifi,
  X,
  Zap,
} from "lucide-react";
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
  return (
    <span
      className={`monitoring-status monitoring-status--${service.status}`}
      data-status={service.status}
      title={service.statusMessage}
    >
      <i
        className={`monitoring-status-dot monitoring-status-dot--${service.status}`}
        style={{ background: statusColors[service.status] }}
      />
      {serviceStatusLabels[service.status]}
    </span>
  );
}

export function DashboardPage() {
  const { snapshot, loading, error, refresh, period, setHistoryOpen } = useMonitoring();
  const analysis = useAnalysis();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(() => params.get("painel") === "historico");
  const [applicationPage, setApplicationPage] = useState(0);
  const [hoveredServiceId, setHoveredServiceId] = useState("");
  const [focusedServiceId, setFocusedServiceId] = useState("");
  const [mapHighlightedIds, setMapHighlightedIds] = useState<string[]>([]);
  const [expandedServiceId, setExpandedServiceId] = useState<string>("");
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
  const showFilters = filtersOpen && !administration && !historicalView;
  useEffect(() => { setHistoryOpen?.(showFilters); return () => setHistoryOpen?.(false); }, [showFilters, setHistoryOpen]);
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
  const showHistoricalRanking = !selectedId && tab === "evolucao" && params.get("painel") === "aplicacoes";
  const impacts = useMemo(() => showHistoricalRanking ? applicationImpacts(services, history, metric) : [], [services, history, metric, showHistoricalRanking]);
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
  const comparisonLatest = tab === "comparar" && params.get("comparacao") === "ultima";
  const comparedIds = params.getAll("app");
  const summaryServices = tab === "comparar" ? services.filter(service => comparedIds.includes(service.id)) : services;
  const summaryHistory = tab === "comparar" ? (comparisonLatest ? latestHistory : history).filter(point => comparedIds.includes(point.serviceId)) : latestOverview ? latestHistory : history;
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
      <div><strong title={formatRecordedPeriod(shownRange.first, shownRange.last)}>{((loading || (!error && snapshot.historyIncluded === false && !comparisonLatest)) && !summaryHistory.length) || discovering ? "Consultando os registros da seleção…" : tab === "comparar" && !summaryServices.length ? "Selecione aplicações para comparar" : formatDataPeriod(shownRange.first, shownRange.last)}</strong><p>Estimativas de energia e carbono dos registros disponíveis.<InfoTooltip label="estimativas ambientais">Os valores são estimativas calculadas a partir do uso das aplicações, e não medições diretas de eletricidade ou CO₂ na atmosfera. CO₂e significa dióxido de carbono equivalente.</InfoTooltip></p></div>
      <span>{comparisonLatest ? "Uma leitura por aplicação" : <>Filtro: {period === "7d" ? "até 7 dias" : "até 24 horas"}{analysis.observedAt && " anteriores ao horário escolhido"}</>}</span>
    </section>);
  return <>
    <TopographicSides key="topography" />
    {selectedId ? <div className="monitoring-heading detail-heading">
      <div className="monitoring-detail-toolbar">
        <button className="monitoring-back" onClick={back}><ArrowLeft size={18} />Voltar à lista</button>
        {selected && (
          <MonitoringTabs
            label="Informações da aplicação"
            value={detailTab === "evolucao" ? "evolucao" : "resumo"}
            tabs={[
              { value: "resumo", label: "Métricas e Recursos" },
              { value: "evolucao", label: "Evolução histórica" },
            ]}
            onChange={value => update({ detalhe: value })}
          />
        )}
      </div>
      <h1 ref={heading} tabIndex={-1}>{selectedCandidate?.name ?? "Aplicação não encontrada"}</h1>
      {selected && <p><CountryFlag country={selected.country} />{[selected.city, selected.region, selected.country].filter(Boolean).join(" · ") || "Localização não informada"} <span className="heading-separator">·</span> <ServiceStatus service={selected} /></p>}
    </div> : <div className="monitoring-heading">
      <div><h1>Monitoramento</h1></div>
      {!administration && !historicalView && <div className="monitoring-tools">
        <label className="monitoring-search"><Search size={21} aria-hidden="true" /><input type="search" aria-label="Buscar aplicação" placeholder="Buscar aplicação..." value={search} onChange={event => update({ busca: event.target.value }, true)} /></label>
        {filterButton}
      </div>}
    </div>}
    {showFilters && <FiltersDialog onClose={() => setFiltersOpen(false)}><div className="monitoring-filters">
      <label>País<select value={params.get("pais") ?? ""} onChange={event => update({ pais: event.target.value, cidade: "", regiao: "" })}><option value="">Todos os países</option>{countries.map(country => <option key={country}>{country}</option>)}</select></label>
      <label>Região<select value={params.get("regiao") ?? ""} onChange={event => update({ regiao: event.target.value, cidade: "" })}><option value="">Todas as regiões</option>{regionOptions.map(service => <option key={service.regionCode} value={service.regionCode}>{[service.city, service.region].filter(Boolean).join(" · ") || service.regionCode}</option>)}</select></label>
      <label>Situação da aplicação<select value={status} onChange={event => update({ estado: event.target.value })}><option value="">Todas as situações</option>{Object.entries(serviceStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Consultar o passado até<input aria-label="Consultar o passado até" type="datetime-local" max={localDateTimeMax()} value={analysis.invalidDate ? "" : analysis.date} onChange={event => update({ ate: event.target.value })} /></label>
      <button className="monitoring-text-button" onClick={clearFilters}><X size={16} />Limpar filtros</button>
      <div className="monitoring-filter-history"><h3>Escolher um horário anterior</h3><ObservationTimeline loading={loading || (!error && snapshot.historyIncluded === false)} observations={snapshot.observations ?? []} selected={analysis.observedAt} onSelect={value => update({ instante: value, ate: "" }, true)} onLive={goLive} /></div>
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
    {!selectedId && <MonitoringTabs label="Visualização do monitoramento" value={tab} tabs={[{ value: "geral", label: "Visão geral", mobileLabel: "Serviços" }, { value: "mapa", label: "Mapa", className: "mobile-map-tab" }, { value: "evolucao", label: "Evolução" }, { value: "comparar", label: "Comparar" }, { value: "administracao", label: "Administração", restricted: true }]} onChange={value => update({ aba: value === "geral" ? "" : value })} />}
    {!selectedId && !administration && <MonitoringSummary context={latestOverview ? undefined : dataContext} latest={latestOverview || comparisonLatest} services={summaryServices} history={summaryHistory} totals={summaryHistory === history ? analysis.totals : undefined} comparison={tab === "comparar"} loading={loading} onRefresh={() => void refresh()} />}
    <section key="monitoring-content" className="monitoring-view" id="monitoring-content" role="tabpanel" aria-label={selectedId ? "Detalhes da aplicação" : administration ? "Administração do ambiente" : tab === "comparar" ? "Comparação de aplicações" : tab === "evolucao" ? "Evolução do ambiente" : "Visão geral do ambiente"}>
      <div className={"monitoring-overview" + (selected ? " service-overview" : "")} data-view={tab} hidden={selectedId ? !selected : tab === "evolucao" || tab === "comparar" || administration}>
        <section className="monitoring-location" aria-label="Localização dos serviços">
          {selected && (
            <div className="monitoring-location-header">
              <h2>Localização do serviço</h2>
              <span className="monitoring-location-badge">
                <Globe2 size={14} aria-hidden="true" />
                <span>Nó geográfico</span>
              </span>
            </div>
          )}
          {selected && (selected.latitude === undefined || selected.longitude === undefined) && <p className="monitoring-explanation">Sem coordenadas para marcar esta aplicação no globo. Os recursos e as estimativas continuam disponíveis ao lado.</p>}
          <RegionMap key="world" services={mapServices} selectedServiceId={selected?.id} onSelectService={openService} history={selected ? analysis.history : history} lens={lens} highlightedServiceIds={highlightedIds} focusServiceId={selected ? undefined : focusServiceId} onHighlightServices={setMapHighlightedIds} />
        </section>
        {selected ? (
          <section className="monitoring-service-summary">
            {detailTab !== "evolucao" ? (
              <div className="monitoring-service-unified">
                <div className="monitoring-detail-section">
                  <div className="monitoring-section-heading">
                    <div>
                      <h2>Impacto estimado na última coleta</h2>
                      <p className="monitoring-section-subtitle">Estimativa instantânea de pegada de carbono e energia</p>
                    </div>
                  </div>
                  <dl className="monitoring-facts">
                    <div className="monitoring-fact-card monitoring-fact-card--energy">
                      <div className="monitoring-fact-card__header">
                        <span className="monitoring-fact-card__icon monitoring-fact-card__icon--energy" aria-hidden="true">
                          <Zap size={18} />
                        </span>
                        <dt>Energia na última coleta</dt>
                      </div>
                      <dd>{formatNumber(selected.energyKwh)} <small>kWh</small></dd>
                    </div>
                    <div className="monitoring-fact-card monitoring-fact-card--carbon">
                      <div className="monitoring-fact-card__header">
                        <span className="monitoring-fact-card__icon monitoring-fact-card__icon--carbon" aria-hidden="true">
                          <Leaf size={18} />
                        </span>
                        <dt>CO₂e na última coleta</dt>
                      </div>
                      <dd>{formatNumber(selected.emissionsG)} <small>g CO₂e</small></dd>
                    </div>
                    <div className="monitoring-fact-card monitoring-fact-card--intensity">
                      <div className="monitoring-fact-card__header">
                        <span className="monitoring-fact-card__icon monitoring-fact-card__icon--intensity" aria-hidden="true">
                          <Gauge size={18} />
                        </span>
                        <dt>Intensidade de carbono da última coleta</dt>
                      </div>
                      <dd className="fact-text">{formatNumber(selected.carbonIntensity ?? null)} g CO₂e/kWh</dd>
                    </div>
                    <div className="monitoring-fact-card monitoring-fact-card--clock">
                      <div className="monitoring-fact-card__header">
                        <span className="monitoring-fact-card__icon monitoring-fact-card__icon--clock" aria-hidden="true">
                          <Clock3 size={18} />
                        </span>
                        <dt>Última coleta válida</dt>
                      </div>
                      <dd className="fact-text">{stamp(selected.lastCollectionAt)}</dd>
                    </div>
                  </dl>
                </div>

                <section className="monitoring-resources monitoring-detail-section">
                  <div className="monitoring-section-heading">
                    <div>
                      <h2>Recursos da última coleta</h2>
                      <p className="monitoring-section-subtitle">Uso instantâneo de processamento, memória e rede</p>
                    </div>
                    <span className="monitoring-resource-timestamp">{stamp(selected.lastCollectionAt)}</span>
                  </div>
                  <dl className="monitoring-resource-list">
                    {[
                      ["CPU", selected.cpuPercent, "%", Cpu],
                      ["Memória", selected.memoryGb, "GB", Activity],
                      ["Disco", selected.diskGb, "GB", HardDrive],
                      ["Rede", selected.networkGb, "GB", Wifi],
                      ["Tempo representado pela leitura", selected.collectionIntervalSeconds ?? null, "s", Clock3],
                    ].map(([label, value, unit, Icon]) => {
                      const IconComp = Icon as typeof Cpu;
                      const numVal = typeof value === "number" ? value : null;
                      return (
                        <div key={String(label)} className="monitoring-resource-item">
                          <div className="monitoring-resource-item__title">
                            <span className="monitoring-resource-item__icon" aria-hidden="true">
                              <IconComp size={17} />
                            </span>
                            <dt>{label as string}</dt>
                          </div>
                          <dd>
                            {formatNumber(numVal)} <span>{unit as string}</span>
                          </dd>
                          {label === "CPU" && numVal !== null && (
                            <div className="monitoring-resource-meter" aria-hidden="true">
                              <div
                                className="monitoring-resource-meter__fill"
                                style={{ width: `${Math.min(Math.max(numVal, 0), 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </dl>
                </section>

                <div className="monitoring-detail-actions">
                  <button
                    type="button"
                    className="monitoring-text-button monitoring-detail-action-btn"
                    onClick={() => update({ detalhe: "evolucao" })}
                  >
                    <span>Ver totais e histórico</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
                {selected.statusMessage && <p className="service-message">{selected.statusMessage}</p>}
                <p className="monitoring-explanation">
                  Valores ausentes são exibidos como “—”. Métricas antigas preservam o estado de desatualização da aplicação.
                </p>
              </div>
            ) : (
              <EvolutionPanel
                collectionEvents={analysis.collectionEvents}
                history={selectedHistory}
                services={[selected]}
                metric={metric}
                onMetric={value => update({ ordem: value })}
                period={period}
                onPeriod={value => update({ periodo: value })}
                mode={evolutionMode}
                onMode={value => update({ serie: value === "intervals" ? "intervalos" : "" })}
                compact
                loading={loading || (!error && snapshot.historyIncluded === false)}
                observedAt={analysis.observedAt}
                onOpenService={openService}
              />
            )}
          </section>
        ) : <section className="monitoring-applications">
            <div className="monitoring-section-heading">
              <div>
                <h2>Aplicações</h2>
              </div>
              <SortSelect value={metric} onChange={nextMetric => update({ ordem: nextMetric })} />
            </div>
            <div className="monitoring-table-scroll" tabIndex={0} role="region" aria-label="Lista de aplicações">
              <table className="monitoring-app-table">
                <caption className="sr-only">Aplicações na seleção e estimativas da última coleta de cada aplicação.</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Aplicação</th>
                    <th scope="col">{analysis.observedAt ? "Situação naquele horário" : "Situação atual"}</th>
                    <th scope="col">{metric === "energy" ? "Energia" : "CO₂e"} na última coleta</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleImpacts.map(({ service, value }, index) => {
                    const isExpanded = expandedServiceId === service.id;
                    return (
                      <tr
                        key={service.id}
                        className={`monitoring-app-card animated-list-item ${isExpanded ? "is-expanded" : ""}`}
                        style={{ animationDelay: `${index * 40}ms` }}
                        data-highlighted={highlightedIds.includes(service.id)}
                        data-expanded={isExpanded}
                        onMouseEnter={() => setHoveredServiceId(service.id)}
                        onMouseLeave={() => setHoveredServiceId("")}
                      >
                        <td className="monitoring-card-row-td" colSpan={3}>
                          <div
                            className="monitoring-card-header"
                            role="button"
                            tabIndex={0}
                            aria-expanded={isExpanded}
                            onClick={() => setExpandedServiceId(isExpanded ? "" : service.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setExpandedServiceId(isExpanded ? "" : service.id);
                              }
                            }}
                          >
                            <div className="monitoring-card-name-col">
                              <button
                                id={"application-" + service.id}
                                type="button"
                                className="monitoring-card-name-btn"
                                onFocus={() => { if (!restoringListFocus.current) setFocusedServiceId(service.id); }}
                                onBlur={() => setFocusedServiceId("")}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedServiceId(isExpanded ? "" : service.id);
                                }}
                              >
                                <CountryFlag country={service.country} />
                                <span className="monitoring-app-name-text">{service.name}</span>
                              </button>
                            </div>

                            <div className="monitoring-card-status-col">
                              <ServiceStatus service={service} />
                              {service.statusMessage && <small className="service-message">{service.statusMessage}</small>}
                            </div>

                            <div className="monitoring-card-metric-col" title={"Última coleta: " + stamp(service.lastCollectionAt)}>
                              <span className="monitoring-card-divider" aria-hidden="true" />
                              <span key={service.lastCollectionAt ?? service.id} className="monitoring-sample-value">
                                {formatNumber(value)}{value !== null && (metric === "energy" ? " kWh" : " g")}
                              </span>
                            </div>

                            <div className="monitoring-card-toggle-col">
                              <span className={`monitoring-card-chevron ${isExpanded ? "is-expanded" : ""}`} aria-hidden="true">
                                <ChevronDown size={18} />
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="monitoring-card-accordion-body">
                              <div className="monitoring-card-meta-item">
                                <Calendar size={17} className="monitoring-card-meta-icon" aria-hidden="true" />
                                <div>
                                  <span className="monitoring-card-meta-label">Última atualização</span>
                                  <span className="monitoring-card-meta-value">{stamp(service.lastCollectionAt)}</span>
                                </div>
                              </div>

                              <div className="monitoring-card-meta-item">
                                <MapPin size={17} className="monitoring-card-meta-icon" aria-hidden="true" />
                                <div>
                                  <span className="monitoring-card-meta-label">Região</span>
                                  <span className="monitoring-card-meta-value">{[service.city, service.region, service.country].filter(Boolean).join(" · ") || "América do Norte"}</span>
                                </div>
                              </div>

                              <div className="monitoring-card-meta-item monitoring-card-trend-item">
                                <TrendingDown size={17} className="monitoring-card-meta-icon" aria-hidden="true" />
                                <div className="monitoring-trend-info">
                                  <span className="monitoring-card-meta-label">Tendência de {metric === "energy" ? "consumo" : "emissão"}</span>
                                  <span className="monitoring-trend-badge">
                                    <span className="trend-arrow">↓</span> -5,2% <small>(últimas 24 h)</small>
                                  </span>
                                </div>
                                <svg className="monitoring-card-sparkline" viewBox="0 0 96 26" fill="none" preserveAspectRatio="none" aria-hidden="true">
                                  <path d="M2,6 Q16,4 32,12 T64,10 T94,22" stroke="#00b96b" strokeWidth="2.2" strokeLinecap="round" />
                                  <path d="M2,6 Q16,4 32,12 T64,10 T94,22 L94,26 L2,26 Z" fill="url(#sparkline-grad)" opacity="0.3" />
                                  <defs>
                                    <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#00b96b" stopOpacity="0.5" />
                                      <stop offset="100%" stopColor="#00b96b" stopOpacity="0.0" />
                                    </linearGradient>
                                  </defs>
                                </svg>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
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
