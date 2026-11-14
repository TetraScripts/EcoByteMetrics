import { Component, lazy, Suspense, useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { CollectionPoint, MonitoredService } from "../../types";
import { impactLocations } from "../../domain/observatory";
import type { ImpactLens } from "../../domain/observatory";
import { findCountry } from "@/shared/geography/geography";
import { formatNumber } from "@/shared/lib/format";
import { StatusBadge } from "../StatusBadge";

const WorldGlobe = lazy(() => import("./WorldGlobe"));
const emptyHistory: CollectionPoint[] = [];

class GlobeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <p className="globe-fallback" role="status">O globo 3D está indisponível. Continue pela lista de aplicações.</p> : this.props.children;
  }
}

export function RegionMap({ services, allServices, selectedServiceId, onSelectService, history = emptyHistory, lens = "status", highlightedServiceIds = [], focusServiceId, onHighlightServices, rotationPaused = false }: {
  services: MonitoredService[];
  allServices?: MonitoredService[];
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
  const countryCodes = useMemo(() => [...new Set((allServices ?? services).map(service => findCountry(service.country ?? "")?.properties.code).filter(Boolean))].sort().join(","), [allServices, services]);
  const supportedCountries = useMemo(() => new Set(countryCodes.split(",").filter(Boolean)), [countryCodes]);
  const selected = groups.find(group => group.services.some(service => service.id === selectedServiceId));
  const choosing = groups.find(group => group.id === groupId);
  const highlightedCityId = groups.find(group => group.services.some(service => highlightedServiceIds.includes(service.id)))?.id;
  const focusCity = groups.find(group => group.services.some(service => service.id === focusServiceId));
  const selectPoint = useCallback((id: string) => {
    const group = groups.find(entry => entry.id === id);
    if (!group) return;
    setGroupId(id);
    if (group.services.length === 1) onSelectService(group.services[0]!.id);
  }, [groups, onSelectService]);
  const highlightPoint = useCallback((id: string, active: boolean) => {
    const group = groups.find(entry => entry.id === id);
    onHighlightServices?.(active && group ? group.services.map(service => service.id) : []);
  }, [groups, onHighlightServices]);
  return <div className="monitoring-map">
    <GlobeBoundary><Suspense fallback={<p className="globe-fallback" role="status">Carregando o globo 3D…</p>}>
      <WorldGlobe services={allServices ?? services} supportedCountries={supportedCountries} cities={groups} city={selected} selectedServiceId={selectedServiceId}
        onPointSelect={selectPoint} onPointHover={highlightPoint} highlightedCityId={highlightedCityId} focusCity={focusCity} rotationPaused={rotationPaused} />
    </Suspense></GlobeBoundary>
    {choosing && (
      <div className="map-popup-card" role="dialog" aria-label={"Aplicações em " + choosing.name}>
        <div className="map-popup-header">
          <strong className="map-popup-title">{choosing.name} · {choosing.count} {choosing.count === 1 ? "aplicação" : "aplicações"}</strong>
          <button type="button" className="map-popup-close" onClick={() => setGroupId("")} aria-label="Fechar popup de aplicações">✕</button>
        </div>
        <div className="map-popup-content">
          {choosing.services.map(service => (
            <div key={service.id} className="map-popup-item">
              <div className="map-popup-item-header">
                <span className="map-popup-service-name">{service.name}</span>
                <StatusBadge status={service.status} />
              </div>
              <div className="map-popup-metrics">
                <div className="map-popup-metric">
                  <span className="map-popup-metric-label">Energia</span>
                  <span className="map-popup-metric-value">{service.energyKwh != null ? `${formatNumber(service.energyKwh)} kWh` : "—"}</span>
                </div>
                <div className="map-popup-metric">
                  <span className="map-popup-metric-label">Carbono</span>
                  <span className="map-popup-metric-value">{service.emissionsG != null ? `${formatNumber(service.emissionsG)} g CO₂e` : "—"}</span>
                </div>
              </div>
              <button type="button" className="map-popup-action" onClick={() => onSelectService(service.id)}>
                Ver detalhes
              </button>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>;
}
