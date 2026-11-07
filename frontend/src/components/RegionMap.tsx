import {
  Component,
  lazy,
  Suspense,
  useMemo,
  useRef,
  useEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import type { ResearchRegion, MonitoredService } from "../types/monitoring";
import { findCountry, getCities, localizeCity } from "../data/geography";

const WorldGlobe = lazy(() => import("./WorldGlobe"));

class GlobeBoundary extends Component<
  { children: ReactNode; readOnly: boolean },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p className="globe-fallback" role="status">
        {this.props.readOnly
          ? "A visualização 3D não está disponível neste navegador."
          : "A visualização 3D não está disponível neste navegador. Continue pelos campos de país e cidade."}
      </p>
    ) : (
      this.props.children
    );
  }
}

interface RegionMapBaseProps {
  regions: ResearchRegion[];
  services?: MonitoredService[];
  regionCode?: string;
  catalogUnavailable?: boolean;
  country?: string;
  city?: string;
  date?: string;
}

type RegionMapProps = RegionMapBaseProps & (
  | {
      readOnly: true;
      onCountrySelect?: never;
      onCitySelect?: never;
      onRegionSelect?: never;
      onServiceSelect?: never;
    }
  | {
      readOnly?: false;
      onCountrySelect: (country: string) => void;
      onCitySelect: (city: string) => void;
      onRegionSelect?: (code: string, city: string) => void;
      onServiceSelect?: (id: string) => void;
    }
);

export function RegionMap({
  regions,
  services,
  regionCode,
  catalogUnavailable = false,
  country = "",
  city = "",
  date,
  readOnly = false,
  onCountrySelect,
  onCitySelect,
  onRegionSelect,
  onServiceSelect,
}: RegionMapProps) {
  const host = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    if (host.current) observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  const selectedCountry = findCountry(country);
  const cities = useMemo(
    () =>
      services
        ? services
            .filter(
              (service) =>
                service.status !== "removed" &&
                service.latitude !== undefined &&
                service.longitude !== undefined &&
                (!selectedCountry ||
                  findCountry(service.country ?? "")?.properties.code ===
                    selectedCountry.properties.code),
            )
            .map((service) => ({
              id: service.id,
              countryCode:
                findCountry(service.country ?? "")?.properties.code ?? "",
              name: service.name,
              latitude: service.latitude!,
              longitude: service.longitude!,
            }))
        : selectedCountry
          ? getCities(selectedCountry.properties.code, regions)
          : [],
    [selectedCountry, regions, services],
  );
  const supportedCountries = useMemo(
    () =>
      new Set(
        (services ?? regions).map(
          (place) => findCountry(place.country ?? "")?.properties.code ?? "",
        ),
      ),
    [regions, services],
  );
  const selectedCity = cities.find((entry) =>
    regionCode
      ? entry.id === regionCode
      : entry.name.localeCompare(
          localizeCity(country, city)?.trim() ?? "",
          "pt-BR",
          { sensitivity: "base" },
        ) === 0,
  );
  const selectPoint = (id: string, name: string) => {
    if (readOnly) return;
    if (services) {
      const service = services.find((entry) => entry.id === id);
      if (service) {
        if (onServiceSelect) onServiceSelect(id);
        else onCountrySelect?.(service.country ?? "");
      }
    } else if (onRegionSelect) onRegionSelect(id, name);
    else onCitySelect?.(name);
  };
  return (
    <section
      ref={host}
      className="region-map globe-map"
      aria-label="Mapa-múndi 3D"
      data-country={selectedCountry?.properties.code ?? ""}
      data-city={city}
      data-read-only={readOnly}
    >
      {!readOnly && (
        <div className="globe-heading">
          <button
            className="button button-outline button-icon"
            type="button"
            aria-label="Voltar ao mundo"
            title="Voltar ao mundo"
            onClick={() => onCountrySelect?.("")}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      <p className="globe-instruction">
        {services
          ? "Localização dos serviços monitorados"
          : selectedCountry
            ? `2. Escolha uma cidade · ${selectedCountry.properties.name}`
            : "1. Clique em um país para começar"}
        <span>
          Arraste para girar. Use o scroll ou dois dedos para aproximar.
        </span>
      </p>
      {visible ? (
        <GlobeBoundary readOnly={readOnly}>
          <Suspense
            fallback={
              <p className="globe-fallback" role="status">
                Carregando o globo 3D…
              </p>
            }
          >
            <WorldGlobe
              readOnly={readOnly}
              supportedCountries={supportedCountries}
              country={selectedCountry}
              city={selectedCity}
              cities={cities}
              onCountrySelect={readOnly ? undefined : onCountrySelect}
              onCitySelect={readOnly ? undefined : onCitySelect}
              onPointSelect={readOnly ? undefined : selectPoint}
            />
          </Suspense>
        </GlobeBoundary>
      ) : (
        <div className="globe-stage globe-fallback" role="status">
          Carregando o mapa…
        </div>
      )}
      {!readOnly && (selectedCountry || services) && (
        <div
          className="globe-cities"
          aria-label={
            services ? "Serviços no mapa" : "Cidades do país selecionado"
          }
        >
          {cities.length ? (
            cities.map((entry) => (
              <button
                key={entry.id}
                className={entry.id === selectedCity?.id ? "active" : ""}
                aria-pressed={entry.id === selectedCity?.id}
                onClick={() => selectPoint(entry.id, entry.name)}
              >
                {entry.name}
                {!services &&
                cities.filter((candidate) => candidate.name === entry.name)
                  .length > 1
                  ? " · " + entry.id
                  : ""}
              </button>
            ))
          ) : (
            <p>
              {services
                ? "Nenhum serviço com coordenadas disponíveis."
                : catalogUnavailable
                  ? "Catálogo de regiões temporariamente indisponível. Tente atualizar."
                  : "Nenhuma região cadastrada para este país na consulta atual."}
            </p>
          )}
        </div>
      )}
      <div className="globe-selection">
        <span>
          REGIÃO SELECIONADA
          <strong>
            {[selectedCountry?.properties.name, selectedCity?.name ?? city]
              .filter(Boolean)
              .join(" — ") || "Escolha um país"}
          </strong>
        </span>
        {date && (
          <span>
            COLETA<strong>{new Date(date).toLocaleString("pt-BR")}</strong>
          </span>
        )}
      </div>
    </section>
  );
}
