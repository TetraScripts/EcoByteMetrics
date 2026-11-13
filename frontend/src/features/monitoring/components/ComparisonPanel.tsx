import { lazy, Suspense, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMonitoring } from "../hooks/useMonitoring";
import { useAnalysis } from "../hooks/useAnalysis";
import { compareApplications } from "../domain/comparison";
import { CountryFlag } from "@/shared/ui/CountryFlag";
import { formatNumber, formatRecordedPeriod } from "@/shared/lib/format";
import { collectionRange } from "../domain/history";
import { serviceStatusLabels } from "../types";

const ComparisonPairedChart = lazy(() =>
  import("./ComparisonPairedChart").then((m) => ({ default: m.ComparisonPairedChart })),
);

export function ComparisonPanel({ onOpenService }: { onOpenService: (id: string) => void }) {
  const analysis = useAnalysis();
  const { loading, snapshot, error, period } = useMonitoring();
  const [params, setParams] = useSearchParams();
  const [searchFilter, setSearchFilter] = useState("");
  const latest = params.get("comparacao") === "ultima";
  const awaitingHistory =
    !latest && (loading || (!error && snapshot.historyIncluded === false)) && !analysis.history.length;
  const ids = useMemo(() => [...new Set(params.getAll("app"))], [params]);
  const rows = useMemo(
    () =>
      compareApplications(
        analysis.services,
        analysis.history,
        params.getAll("app"),
        analysis.windowStart,
        analysis.windowEnd,
        latest,
      ),
    [analysis, params, latest],
  );
  const missing = ids.filter((id) => !analysis.services.some((service) => service.id === id));
  const range = collectionRange(analysis.history.filter((point) => ids.includes(point.serviceId)));

  const changeSelection = (id: string, checked: boolean) => {
    const next = new URLSearchParams(params);
    next.delete("app");
    for (const value of checked ? [...ids, id] : ids.filter((value) => value !== id)) {
      next.append("app", value);
    }
    setParams(next);
  };

  const removeSelection = (id: string) => {
    const next = new URLSearchParams(params);
    next.delete("app");
    for (const value of ids.filter((v) => v !== id)) {
      next.append("app", value);
    }
    setParams(next);
  };

  const clearAll = () => {
    const next = new URLSearchParams(params);
    next.delete("app");
    setParams(next);
  };

  const selectVisible = (visibleServices: typeof analysis.services) => {
    const next = new URLSearchParams(params);
    next.delete("app");
    const merged = [...new Set([...ids, ...visibleServices.map((s) => s.id)])];
    for (const id of merged) next.append("app", id);
    setParams(next);
  };

  const filteredServices = useMemo(() => {
    if (!searchFilter.trim()) return analysis.services;
    const q = searchFilter.toLowerCase();
    return analysis.services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.country && s.country.toLowerCase().includes(q)) ||
        (s.city && s.city.toLowerCase().includes(q)),
    );
  }, [analysis.services, searchFilter]);

  const selectedServices = useMemo(
    () => analysis.services.filter((s) => ids.includes(s.id)),
    [analysis.services, ids],
  );

  const formatDate = (value: number | null) =>
    value === null ? "—" : new Date(value).toLocaleString("pt-BR");

  return (
    <section className="comparison-content" aria-labelledby="comparison-selection">
      <div className="comparison-toolbar">
        <h2 id="comparison-selection">Comparar aplicações</h2>
        <div className="evolution-segmented" role="group" aria-label="Dados da comparação">
          <button
            type="button"
            aria-pressed={latest}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.set("comparacao", "ultima");
              setParams(next);
            }}
          >
            Última coleta
          </button>
          <button
            type="button"
            aria-pressed={!latest}
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("comparacao");
              setParams(next);
            }}
          >
            Total no período
          </button>
        </div>
        {!latest && (
          <label className="comparison-period">
            Período
            <select
              aria-label="Período da comparação"
              value={period}
              onChange={(event) => {
                const next = new URLSearchParams(params);
                next.set("periodo", event.target.value);
                setParams(next);
              }}
            >
              <option value="24h">Até 24 horas</option>
              <option value="7d">Até 7 dias</option>
            </select>
          </label>
        )}
      </div>

      <p className="monitoring-explanation">
        Selecione duas ou mais aplicações.{" "}
        {latest
          ? "Compare a última leitura disponível de cada aplicação. Os horários e as durações podem ser diferentes; os valores não são uma soma do período. A comparação mantém os filtros do monitoramento"
          : "Compare a soma da energia e das emissões das leituras gravadas no período. A comparação mantém os filtros do monitoramento"}
        {analysis.selection ? ": " + analysis.selection : ""}.
      </p>

      {/* Controles de Seleção e Busca (Issue #120) */}
      {analysis.services.length > 0 && (
        <div className="comparison-controls">
          <div className="comparison-search-row">
            <input
              type="search"
              className="comparison-search-input"
              placeholder="Buscar aplicação por nome, cidade ou país…"
              aria-label="Buscar aplicação para comparar"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            <div className="comparison-quick-actions">
              <span className="comparison-count-badge">
                {ids.length} de {analysis.services.length} selecionada(s)
              </span>
              {ids.length > 0 && (
                <button type="button" className="comparison-action-btn" onClick={clearAll}>
                  Limpar seleção
                </button>
              )}
              {filteredServices.length > 0 && filteredServices.some((s) => !ids.includes(s.id)) && (
                <button
                  type="button"
                  className="comparison-action-btn"
                  onClick={() => selectVisible(filteredServices)}
                >
                  Selecionar visíveis
                </button>
              )}
            </div>
          </div>

          {selectedServices.length > 0 && (
            <div className="comparison-chips-container" aria-label="Aplicações selecionadas">
              {selectedServices.map((service) => (
                <span key={`chip-${service.id}`} className="comparison-chip">
                  <CountryFlag country={service.country} />
                  <span>{service.name}</span>
                  <button
                    type="button"
                    onClick={() => removeSelection(service.id)}
                    aria-label={`Remover ${service.name} da comparação`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <fieldset className="comparison-selection">
        <legend className="sr-only">Aplicações para comparar</legend>
        {filteredServices.map((service) => (
          <label key={service.id}>
            <input
              type="checkbox"
              checked={ids.includes(service.id)}
              onChange={(event) => changeSelection(service.id, event.target.checked)}
            />
            <CountryFlag country={service.country} />
            <span>
              {service.name}
              <small>{serviceStatusLabels[service.status]}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {!analysis.services.length && (
        <p className="monitoring-empty">
          {loading
            ? "Consultando aplicações…"
            : "Nenhuma aplicação disponível nesta seleção. Ajuste os filtros no monitoramento."}
        </p>
      )}

      {missing.length > 0 && (
        <p className="monitoring-notice" role="status">
          {missing.length} seleção(ões) não está(ão) disponível(is) nos filtros atuais.{" "}
          <button
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("app");
              for (const id of ids.filter((id) => !missing.includes(id))) next.append("app", id);
              setParams(next);
            }}
          >
            Remover seleções indisponíveis
          </button>
        </p>
      )}

      {awaitingHistory ? (
        <p className="monitoring-empty" role="status">
          Consultando as leituras para comparação…
        </p>
      ) : rows.length < 2 ? null : (
        <>
          {!latest && (
            <p className="comparison-range">
              Mesmo intervalo de consulta: {formatDate(analysis.windowStart)} até{" "}
              {formatDate(analysis.windowEnd)}.
            </p>
          )}
          {!latest && (
            <p className="monitoring-explanation">
              {formatRecordedPeriod(range.first, range.last)}. Os totais somam as leituras
              disponíveis nesse intervalo.
            </p>
          )}

          {/* Gráficos Pareados (Issue #122) */}
          <Suspense fallback={null}>
            <ComparisonPairedChart rows={rows} latest={latest} />
          </Suspense>

          {/* Tabela Lado a Lado dos Indicadores (Issue #121) */}
          <div
            className="monitoring-table-scroll"
            role="region"
            aria-label="Comparação das aplicações"
            tabIndex={0}
          >
            <table className="comparison-table">
              <caption>
                {latest
                  ? "Última leitura disponível por aplicação"
                  : "Totais das leituras disponíveis · " + analysis.periodLabel}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Aplicação</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Energia (kWh)</th>
                  <th scope="col">Emissões (kg CO₂e)</th>
                  {latest && <th scope="col">Coletada em</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.service.id}
                    className="animated-list-item"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <th scope="row">
                      <button type="button" onClick={() => onOpenService(row.service.id)}>
                        {row.service.name}
                      </button>
                      <div className="comparison-infra-pills">
                        {row.service.cpuPercent != null && (
                          <span>CPU: {formatNumber(row.service.cpuPercent)}%</span>
                        )}
                        {row.service.memoryGb != null && (
                          <span>Mem: {formatNumber(row.service.memoryGb)} GB</span>
                        )}
                        {row.service.networkGb != null && (
                          <span>Rede: {formatNumber(row.service.networkGb)} GB</span>
                        )}
                      </div>
                    </th>
                    <td>{serviceStatusLabels[row.service.status]}</td>
                    <td>{formatNumber(row.energyKwh)}</td>
                    <td>
                      {formatNumber(row.emissionsG === null ? null : row.emissionsG / 1000)}
                    </td>
                    {latest && <td>{formatDate(row.last)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
