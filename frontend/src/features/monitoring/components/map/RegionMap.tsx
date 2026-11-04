import { Component, lazy, Suspense, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CollectionPoint, MonitoredService } from "../../types";
import { statusColors } from "../../domain/dashboard";
import { impactLocations } from "../../domain/observatory";
import type { ImpactLens } from "../../domain/observatory";
import { findCountry } from "@/shared/geography/geography";
import { serviceStatusLabels } from "../../types";

const WorldGlobe = lazy(() => import("./WorldGlobe"));
const emptyHistory: CollectionPoint[] = [];

class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p className="globe-fallback" role="status">O globo 3D está indisponível. Continue pela lista de aplicações.</p> : this.props.children;
  }
}

export function RegionMap({ services, selectedServiceId, onSelectService, history = emptyHistory, lens = "status", highlightedServiceIds = [], focusServiceId, onHighlightServices, rotationPaused = false }: {
  services: MonitoredService[];
  selectedServiceId?: string;
  onSelectService: (id: string) => void;
  history?: CollectionPoint[];
  lens?: ImpactLens;
  highlightedServiceIds?: string[];
  focusServiceId?: string;
  onHighlightServices?: (ids: string[]) => void;
  rotationPaused?: boolean;
}) {
  const [groupId, setGroupId] = useState("");
  const groups = useMemo(() => impactLocations(services, history, lens), [services, history, lens]);
  const countryCodes = useMemo(() => [...new Set(services.map(service => findCountry(service.country ?? "")?.properties.code).filter(Boolean))].sort().join(","), [services]);
  const supportedCountries = useMemo(() => new Set(countryCodes.split(",").filter(Boolean)), [countryCodes]);
  const selected = groups.find(group => group.services.some(service => service.id === selectedServiceId));
  const choosing = groups.find(group => group.id === groupId);
  const highlightedCityId = groups.find(group => group.services.some(service => highlightedServiceIds.includes(service.id)))?.id;
  const focusCity = groups.find(group => group.services.some(service => service.id === focusServiceId));
  const selectPoint = useCallback((id: string) => {
    const group = groups.find(entry => entry.id === id);
    if (!group) return;
    if (group.services.length === 1) onSelectService(group.services[0]!.id);
    else setGroupId(id);
  }, [groups, onSelectService]);
  const highlightPoint = useCallback((id: string, active: boolean) => {
    const group = groups.find(entry => entry.id === id);
    onHighlightServices?.(active && group ? group.services.map(service => service.id) : []);
  }, [groups, onHighlightServices]);
  return <div className="monitoring-map">
    <GlobeBoundary><Suspense fallback={<p className="globe-fallback" role="status">Carregando o globo 3D…</p>}>
      <WorldGlobe supportedCountries={supportedCountries} cities={groups} city={selected} selectedServiceId={selectedServiceId}
        onPointSelect={selectPoint} onPointHover={highlightPoint} highlightedCityId={highlightedCityId} focusCity={focusCity} rotationPaused={rotationPaused} />
    </Suspense></GlobeBoundary>
    {choosing && <div className="map-choices" aria-label={"Aplicações em " + choosing.name}>
      <div><strong>{choosing.name} · {choosing.count} aplicações</strong><button onClick={() => setGroupId("")} aria-label="Fechar seleção de aplicações">Fechar</button></div>
      {choosing.services.map(service => <button key={service.id} onClick={() => onSelectService(service.id)}><span>{service.name}</span><span className="monitoring-status"><i style={{ background: statusColors[service.status] }} />{serviceStatusLabels[service.status]}</span></button>)}
    </div>}
  </div>;
}
