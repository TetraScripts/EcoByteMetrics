import {
  Activity,
  CalendarDays,
  Clock3,
  Database,
  Leaf,
  Server,
  Zap,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  EmptyState,
  MetricCard,
  PageHeading,
  Panel,
} from "../components/UI";
import { RegionMap } from "../components/RegionMap";
import { ServiceCollectionSummary } from "../components/ServiceCollectionSummary";
import { ServiceImpactRanking } from "../components/ServiceImpactRanking";
import { formatNumber } from "../utils/format";
import { analysisLink } from "../utils/analysis";
import { useMonitoring } from "../hooks/useMonitoring";
import { useAnalysis } from "../hooks/useAnalysis";

export function DashboardPage() {
  const { snapshot, error, loading } = useMonitoring();
  const [params, setParams] = useSearchParams();
  const {
    services,
    history,
    regions,
    country,
    city,
    date,
    invalidDate,
    regional,
    selection,
    totals: coverage,
  } = useAnalysis();
  const energy = coverage.energyKwh;
  const emissions = coverage.emissionsG;
  const setDate = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("ate", value);
    else next.delete("ate");
    setParams(next, { replace: true });
  };
  const lastCollection = history.reduce<string | null>(
    (latest, point) =>
      latest === null || Date.parse(point.collectedAt) > Date.parse(latest)
        ? point.collectedAt
        : latest,
    null,
  );
  const active = services.filter(
    (service) => service.status === "available",
  ).length;
  const metricFields = [
    "cpuPercent",
    "memoryGb",
    "diskGb",
    "networkGb",
  ] as const;
  const metricCount = services.reduce(
    (sum, service) =>
      sum + metricFields.filter((field) => service[field] !== null).length,
    0,
  );
  const renewables = regions.map((region) => region.renewablePercent);
  const renewable = renewables.length
    ? renewables.reduce((sum, value) => sum + value, 0) / renewables.length
    : null;
  const categories = [
    { label: "Disponíveis", count: active, color: "#087d62" },
    {
      label: "Sem métricas completas",
      count: services.filter((service) => service.status === "no-metrics")
        .length,
      color: "#408abc",
    },
    {
      label: "Indisponíveis",
      count: services.filter((service) => service.status === "unavailable")
        .length,
      color: "#8acdaf",
    },
    {
      label: "Removidos",
      count: services.filter((service) => service.status === "removed").length,
      color: "#acbaba",
    },
  ];
  let offset = 0;
  const stops = categories.map((category) => {
    const start = offset;
    offset += services.length ? (category.count / services.length) * 100 : 0;
    return `${category.color} ${start}% ${offset}%`;
  });
  return (
    <>
      <PageHeading
        title="Um olhar para o seu impacto."
        description={
          selection ||
          "Energia, emissões e serviços. Tudo conectado a um futuro mais consciente."
        }
      />
      <div className="history-toolbar">
        <span>
          <Database size={16} />
          {date
            ? "Exibindo coletas até a data selecionada"
            : "Histórico coletado nesta sessão · atualização a cada 30 s"}
        </span>
        <div>
          <button
            className="button button-outline button-small"
            disabled={!date}
            onClick={() => setDate("")}
          >
            Voltar para agora
          </button>
          <label className="date-selector">
            <CalendarDays size={16} />
            <span>Selecionar data e hora</span>
            <input
              aria-label="Selecionar data e hora"
              type="datetime-local"
              value={invalidDate ? "" : date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
      </div>
      {invalidDate && (
        <p className="form-message error-message" role="alert">
          Data inválida na URL. Use Voltar para agora para remover o filtro.
        </p>
      )}
      {regional && snapshot.lastCollectionAt && !services.length && (
        <EmptyState
          compact
          icon={Server}
          title="Sem serviços nesta seleção"
          description="Faça uma nova pesquisa para escolher outra região."
        />
      )}
      <div className="metrics-grid">
        <MetricCard
          label="Estimativas de emissões"
          value={formatNumber(emissions)}
          unit="gCO₂e"
          icon={Leaf}
          note={
            emissions === null
              ? "Nenhuma emissão calculada no período"
              : "Estimativas por coleta · " +
                coverage.emissionCount +
                "/" +
                coverage.count +
                " registros com emissão"
          }
        />
        <MetricCard
          label="Estimativas de energia"
          value={formatNumber(energy)}
          unit="kWh"
          icon={Zap}
          note={
            energy === null
              ? "Nenhuma coleta no período"
              : "Soma por coleta; intervalos podem se sobrepor"
          }
          tone="amber"
        />
        <MetricCard
          label="Serviços ativos"
          value={String(active)}
          icon={Server}
          note="Estado da última consulta"
          tone="blue"
        />
        <MetricCard
          label="Última coleta"
          value={
            lastCollection
              ? new Date(lastCollection).toLocaleTimeString("pt-BR")
              : "—"
          }
          icon={Clock3}
          note={
            lastCollection
              ? new Date(lastCollection).toLocaleDateString("pt-BR")
              : "Ainda não realizada"
          }
        />
      </div>
      <div className="dashboard-details">
        <Panel icon={Activity} title="Dados da métrica da API">
          <dl className="api-details">
            <div>
              <dt>Status</dt>
              <dd>
                <span className="status-tag">
                  {error
                    ? "Dados antigos"
                    : loading
                      ? "Atualizando"
                      : !snapshot.lastCollectionAt
                        ? "Aguardando conexão"
                        : !services.length
                          ? "Sem serviços na seleção"
                          : active === 0
                            ? metricCount > 0 ? "Métricas parciais" : "Nenhum serviço disponível"
                            : metricCount < services.length * 4
                              ? "Métricas parciais"
                              : "Dados disponíveis"}
                </span>
              </dd>
            </div>
            <div>
              <dt>Métricas recebidas</dt>
              <dd>
                {metricCount} / {services.length * 4}
              </dd>
            </div>
            <div>
              <dt>Fonte</dt>
              <dd>Agregador de métricas</dd>
            </div>
            <div>
              <dt>Referência</dt>
              <dd>Última consulta</dd>
            </div>
          </dl>
        </Panel>
        <Panel
          icon={Leaf}
          title="Dados de dióxido de carbono"
          className="carbon-panel"
        >
          <strong className="carbon-value">{formatNumber(emissions)}</strong>
          <span>gCO₂e · período selecionado</span>
          <p>{selection || "Todas as regiões"}</p>
        </Panel>
        <Panel icon={Zap} title="Participação de energia renovável">
          <div className="renewable-summary">
            <div
              className="data-donut small-donut"
              style={{
                background:
                  renewable === null
                    ? "#e2ece7"
                    : `conic-gradient(#408abc ${renewable}%, #e2ece7 0)`,
              }}
            >
              <span>
                {renewable === null ? "—" : `${formatNumber(renewable)}%`}
              </span>
            </div>
            <p>
              {regions.length === 1
                ? "Fator da região selecionada."
                : "Média das regiões monitoradas."}
              <small>Referência: última consulta à API de carbono.</small>
            </p>
          </div>
        </Panel>
      </div>
      <div className="dashboard-analysis">
        <Panel title="Gráfico percentual geral" eyebrow="ESTADO DOS SERVIÇOS">
          <div className="distribution-chart">
            <div
              className="data-donut"
              role="img"
              aria-label={
                services.length
                  ? categories
                      .map((category) => `${category.label}: ${category.count}`)
                      .join(", ")
                  : "Sem serviços para calcular percentuais"
              }
              style={{
                background: services.length
                  ? `conic-gradient(${stops.join(", ")})`
                  : "#e2ece7",
              }}
            >
              <span>{services.length ? "100%" : "—"}</span>
            </div>
            <ul>
              {categories.map((category) => (
                <li key={category.label}>
                  <span style={{ background: category.color }} />
                  {category.label}
                  <strong>
                    {services.length
                      ? `${formatNumber((category.count / services.length) * 100)}%`
                      : "—"}
                  </strong>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
        <ServiceImpactRanking history={history} services={snapshot.services} />
      </div>
      <ServiceCollectionSummary services={services} />
      <RegionMap
        readOnly
        services={services}
        regions={snapshot.regions}
        catalogUnavailable={Boolean(snapshot.warning)}
        country={country}
        city={city}
        date={lastCollection ?? undefined}
      />
      <div className="dashboard-footnote">
        <Link to={analysisLink("/pesquisa", params.toString())}>
          Pesquisar outra região
        </Link>
      </div>
    </>
  );
}
