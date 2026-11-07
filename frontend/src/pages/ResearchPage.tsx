import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RegionMap } from "../components/RegionMap";
import { RegionAlertDialog } from "../components/RegionAlertDialog";
import { useMonitoring } from "../hooks/useMonitoring";
import {
  getRegionAlert,
  getRegionIssues,
  matchesRegion,
} from "../utils/region";
import type { RegionAlert } from "../utils/region";
import { countries, findCountry, getCities } from "../data/geography";
import { formatNumber } from "../utils/format";
import { analysisQuery } from "../utils/analysis";
import { getSelectableRegions } from "../utils/researchRegions";

export function ResearchPage() {
  const { snapshot, loading, refresh } = useMonitoring();
  const [params, setParams] = useSearchParams();
  const regionCode = params.get("regiao") ?? "";
  const researchRegions = getSelectableRegions(snapshot);
  const registeredRegion = researchRegions.find(
    (entry) => entry.code === regionCode,
  );
  const country = params.get("pais") ?? registeredRegion?.country ?? "";
  const city =
    params.get("cidade") ??
    registeredRegion?.city ??
    registeredRegion?.region ??
    "";
  const [alert, setAlert] = useState<RegionAlert | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const countryInput = useRef<HTMLInputElement>(null);
  const searchToken = useRef(0);
  const selectionKey = JSON.stringify([country, city, regionCode]);
  useEffect(
    () => () => {
      searchToken.current++;
    },
    [selectionKey],
  );
  const closeAlert = () => {
    searchToken.current++;
    setAlert(null);
  };
  const navigate = useNavigate();
  const selectedCountry = findCountry(country);
  const cities = selectedCountry
    ? getCities(selectedCountry.properties.code, researchRegions)
    : [];
  const registeredCountries = new Set(
    researchRegions.map(
      (region) => findCountry(region.country)?.properties.code,
    ),
  );
  const availableCountries = countries.filter((feature) =>
    registeredCountries.has(feature.properties.code),
  );
  const matches =
    selectedCountry && city.trim()
      ? researchRegions.filter((entry) =>
          matchesRegion(
            { ...entry, city: entry.city ?? entry.region },
            selectedCountry.properties.name,
            city,
          ),
        )
      : [];
  const region =
    researchRegions.find((entry) => entry.code === regionCode && matchesRegion(entry, country, "")) ??
    (matches.length === 1 ? matches[0] : undefined);
  const factor = snapshot.regions.find(entry => entry.code === region?.code);
  function chooseCountry(name: string) {
    searchToken.current++;
    const next = new URLSearchParams(params);
    next.set("pais", name);
    for (const key of ["cidade", "regiao", "ate"]) next.delete(key);
    setParams(next, { replace: true });
    setAlert(null);
    setIssues([]);
    setStatus("");
  }
  function chooseCity(name: string, selectedCode = "") {
    searchToken.current++;
    const next = new URLSearchParams(params);
    next.set("pais", selectedCountry?.properties.name ?? country);
    next.set("cidade", name);
    if (selectedCode) next.set("regiao", selectedCode);
    else next.delete("regiao");
    next.delete("ate");
    setParams(next, { replace: true });
    setAlert(null);
    setIssues([]);
    setStatus("");
  }
  function regionalDashboard(
    code: string,
    selectedCountry: string,
    selectedCity: string | null,
  ) {
    const query = analysisQuery(params.toString());
    query.set("pais", selectedCountry);
    query.set("cidade", selectedCity ?? "");
    query.set("regiao", code);
    query.delete("ate");
    return "/dashboard?" + query.toString();
  }
  const dashboardUrl = region
    ? regionalDashboard(region.code, region.country, region.city)
    : "/dashboard";
  async function search(event?: FormEvent) {
    event?.preventDefault();
    setIssues([]);
    if (!selectedCountry) {
      setStatus("Selecione um país válido.");
      return;
    }
    if (cities.length && !region) {
      setStatus("Selecione uma cidade cadastrada.");
      return;
    }
    if (researchRegions.length && !region) {
      setAlert("unknown");
      setStatus("Região não cadastrada na API");
      return;
    }
    const token = ++searchToken.current;
    const selectedCode = region?.code;
    setStatus("Consultando os serviços da região…");
    const latest = await refresh();
    if (token !== searchToken.current) return;
    if (!latest) {
      setStatus(
        "Consulta indisponível. Tente atualizar a conexão e buscar novamente.",
      );
      return;
    }
    const latestRegions = getSelectableRegions(latest);
    const candidates = latestRegions.filter((entry) =>
      matchesRegion(
        { ...entry, city: entry.city ?? entry.region },
        selectedCountry.properties.name,
        city,
      ),
    );
    const latestRegion =
      latestRegions.find((entry) => entry.code === selectedCode && matchesRegion(entry, selectedCountry.properties.name, "")) ??
      (candidates.length === 1 ? candidates[0] : undefined);
    if (!latestRegion) {
      setAlert("unknown");
      setStatus("A região não está disponível no catálogo atual.");
      return;
    }
    const selection = latest.services.filter(
      (service) => service.regionCode === latestRegion.code,
    );
    if (!selection.some((service) => service.status !== "removed")) {
      setStatus("Região cadastrada, mas sem serviços monitorados no momento.");
      return;
    }
    const kind = getRegionAlert(selection);
    setIssues(getRegionIssues(selection));
    setAlert(kind);
    setStatus(
      kind === "unavailable"
        ? "Serviço indisponível"
        : kind === "incomplete"
          ? "Dados parciais disponíveis"
          : "Consulta concluída",
    );
    if (!kind)
      navigate(
        regionalDashboard(
          latestRegion.code,
          latestRegion.country,
          latestRegion.city,
        ),
      );
  }
  return (
    <div className="research-grid">
      <section className="panel research-form">
        <span className="eyebrow">UM IMPACTO QUE TEM LUGAR</span>
        <h1>Verificar CO₂ por região</h1>
        <p>
          Selecione um país no globo, escolha uma cidade e consulte as emissões.
        </p>
        <form onSubmit={(event) => void search(event)} autoComplete="off">
          <label htmlFor="research-country">País</label>
          <input
            ref={countryInput}
            id="research-country"
            list="research-countries"
            placeholder="Escolha no globo ou digite"
            value={country}
            onChange={(event) => chooseCountry(event.target.value)}
            required
            autoComplete="off"
          />
          <datalist id="research-countries">
            {availableCountries.map((feature) => (
              <option
                key={feature.properties.code}
                value={feature.properties.name}
              />
            ))}
          </datalist>
          <label htmlFor="research-city">Cidade</label>
          <select
            id="research-city"
            value={region?.code ?? ""}
            onChange={(event) =>
              chooseCity(
                cities.find((entry) => entry.id === event.target.value)?.name ??
                  "",
                event.target.value,
              )
            }
            required
            disabled={!selectedCountry || !cities.length}
            aria-describedby="research-city-help"
          >
            <option value="">
              {!selectedCountry
                ? "Selecione primeiro o país"
                : loading
                  ? "Carregando cidades…"
                  : !cities.length
                    ? "Nenhuma cidade cadastrada"
                    : "Selecione uma cidade"}
            </option>
            {cities.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
                {cities.filter((candidate) => candidate.name === entry.name)
                  .length > 1
                  ? " · " + entry.id
                  : ""}
              </option>
            ))}
          </select>
          <p id="research-city-help" className="city-catalog-note">
            {selectedCountry && cities.length
              ? "Cidades ou regiões informadas pelas APIs para este país."
              : selectedCountry
                ? "As cidades aparecerão quando houver regiões disponíveis para este país."
                : "Escolha um país para ver as cidades disponíveis."}
          </p>
          <button
            className="button button-dark"
            type="submit"
            disabled={loading}
          >
            <Search size={17} />
            {loading ? "Consultando APIs…" : "Buscar"}
            <ArrowRight size={17} />
          </button>
        </form>
        {status && <p className="form-message" role="status">{status}</p>}
        {region && (
          <dl className="api-details region-facts">
            <div>
              <dt>Região elétrica</dt>
              <dd>
                {region.region} · {region.code}
              </dd>
            </div>
            <div>
              <dt>Intensidade de carbono</dt>
              <dd>{factor ? `${formatNumber(factor.carbonIntensity)} gCO₂e/kWh` : "Indisponível"}</dd>
            </div>
            <div>
              <dt>Energia renovável</dt>
              <dd>{factor ? `${formatNumber(factor.renewablePercent)}%` : "Indisponível"}</dd>
            </div>
          </dl>
        )}
      </section>
      <RegionMap
        regionCode={region?.code}
        onRegionSelect={(code, name) => chooseCity(name, code)}
        regions={researchRegions}
        catalogUnavailable={Boolean(snapshot.warning)}
        country={country}
        city={city}
        onCountrySelect={chooseCountry}
        onCitySelect={chooseCity}
      />
      <RegionAlertDialog
        kind={alert}
        issues={issues}
        busy={loading}
        onClose={closeAlert}
        onRetry={() => {
          setAlert(null);
          void search();
        }}
        onAction={() => {
          if (alert === "incomplete") navigate(dashboardUrl);
          else if (alert === "unavailable") void search();
          else {
            setAlert(null);
            countryInput.current?.focus();
          }
        }}
      />
    </div>
  );
}
