import { useEffect, useState } from "react";
import { Leaf, Zap } from "lucide-react";
import type { Period } from "@/shared/lib/period";
import {
  getDashboardRanking,
  type DashboardRanking,
  type DashboardRankingMetric,
} from "@/features/monitoring/api/dashboard";
import { formatNumber } from "@/shared/lib/format";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";

export function ServiceImpactRanking({ period }: { period: Period }) {
  const [metric, setMetric] = useState<DashboardRankingMetric>("kwh");
  const [result, setResult] = useState<{
    key: string;
    ranking: DashboardRanking | null;
    error: string | null;
  }>({ key: "", ranking: null, error: null });
  const requestKey = `${period}:${metric}`;

  useEffect(() => {
    let pending: AbortController | null = null;
    const loadRanking = () => {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      void getDashboardRanking(period, metric, controller.signal)
        .then((result) => {
          if (result.periodo !== period || result.ordenadoPor !== metric ||
            !Array.isArray(result.ranking) ||
            result.ranking.some((entry, index) =>
              !Number.isSafeInteger(entry.posicao) ||
              entry.posicao !== index + 1 ||
              typeof entry.id_servico !== "string" ||
              !entry.id_servico ||
              typeof entry.nome !== "string" ||
              !Number.isFinite(entry.consumoKwh) ||
              entry.consumoKwh < 0 ||
              (entry.emissaoCo2e !== null &&
                (!Number.isFinite(entry.emissaoCo2e) || entry.emissaoCo2e < 0))
            )) {
            throw new Error("A resposta do ranking do backend está fora do contrato.");
          }
          if (!controller.signal.aborted)
            setResult({ key: requestKey, ranking: result, error: null });
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted) {
            setResult({
              key: requestKey,
              ranking: null,
              error: cause instanceof Error ? cause.message : "Falha ao carregar o ranking.",
            });
          }
        });
    };
    loadRanking();
    const timer = window.setInterval(loadRanking, 30_000);
    return () => {
      window.clearInterval(timer);
      pending?.abort();
    };
  }, [period, metric, requestKey]);

  const loading = result.key !== requestKey;
  const ranking = loading ? null : result.ranking;
  const error = loading ? null : result.error;
  const entries = ranking?.ranking ?? [];
  const visible = entries.slice(0, 5);
  const max = Math.max(visible[0]?.[metric === "kwh" ? "consumoKwh" : "emissaoCo2e"] ?? 0, 1);
  const unit = metric === "kwh" ? "kWh" : "gCO₂e";
  return (
    <Panel title="Impacto por serviço" eyebrow="PERÍODO SELECIONADO" className="service-impact-ranking">
      <div className="service-impact-controls">
        <p>Dados agregados pelo backend · {period}</p>
        <label>
          <span className="sr-only">Ordenar ranking por</span>
          <select value={metric} onChange={event => {
            if (event.target.value === "kwh" || event.target.value === "co2e") setMetric(event.target.value);
          }}>
            <option value="kwh">Energia estimada</option>
            <option value="co2e">Emissões estimadas</option>
          </select>
        </label>
      </div>
      {error && <p className="form-message error-message" role="alert">{error}</p>}
      {loading && <p className="globe-fallback" role="status">Carregando ranking…</p>}
      {visible.length ? (
        <ol className="collection-ranking service-impact-list">
          {visible.map((entry) => {
            const value = metric === "kwh" ? entry.consumoKwh : entry.emissaoCo2e;
            if (value === null) return null;
            return (
              <li key={entry.id_servico}>
                <span>{entry.posicao}</span>
                <div className="service-impact-label">
                  <strong>{entry.nome}</strong>
                  <small>{entry.id_servico}</small>
                </div>
                <meter
                  min={0}
                  max={max}
                  value={value}
                  aria-label={`${metric === "kwh" ? "Energia" : "Emissões"} de ${entry.nome}`}
                />
                <strong className="service-impact-value">
                  {formatNumber(value)} {unit}
                </strong>
              </li>
            );
          })}
        </ol>
      ) : !loading && !error ? (
        <EmptyState compact icon={metric === "kwh" ? Zap : Leaf}
          title={metric === "kwh" ? "Sem dados válidos neste período." : "Emissões indisponíveis neste período."}
          description="O ranking aparecerá após o backend acumular estimativas válidas para o período." />
      ) : null}
      {entries.length > 5 && <p className="service-impact-note">5 primeiros de {entries.length} serviços com estimativas.</p>}
    </Panel>
  );
}
