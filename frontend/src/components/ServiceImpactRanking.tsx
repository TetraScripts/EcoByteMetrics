import { useState } from "react";
import { Leaf, Zap } from "lucide-react";
import type { CollectionPoint, MonitoredService } from "../types/monitoring";
import { rankServiceImpact } from "../utils/serviceImpact";
import type { ImpactMetric } from "../utils/serviceImpact";
import { formatNumber } from "../utils/format";
import { EmptyState, Panel } from "./UI";

export function ServiceImpactRanking({ history, services }: {
  history: CollectionPoint[];
  services: MonitoredService[];
}) {
  const [metric, setMetric] = useState<ImpactMetric>("energy");
  const { entries, omittedCount } = rankServiceImpact(history, services, metric);
  const visible = entries.slice(0, 5);
  const max = visible[0]?.value || 1;
  const unit = metric === "energy" ? "kWh" : "gCO₂e";
  return (
    <Panel title="Impacto por serviço" eyebrow="PERÍODO SELECIONADO" className="service-impact-ranking">
      <div className="service-impact-controls">
        <p>Coletas disponíveis nesta sessão</p>
        <label>
          <span className="sr-only">Ordenar ranking por</span>
          <select value={metric} onChange={event => {
            if (event.target.value === "energy" || event.target.value === "emissions") setMetric(event.target.value);
          }}>
            <option value="energy">Energia estimada</option>
            <option value="emissions">Emissões estimadas</option>
          </select>
        </label>
      </div>
      {visible.length ? (
        <ol className="collection-ranking service-impact-list">
          {visible.map((entry, index) => (
            <li key={entry.id}>
              <span>{index + 1}</span>
              <div className="service-impact-label">
                <strong>{entry.name}</strong>
                <small>
                  {entries.some(other => other.id !== entry.id && other.name === entry.name) && `${entry.id} · `}
                  {entry.count} {entry.count === 1 ? "coleta" : "coletas"} · {formatNumber(entry.seconds)} s de amostras
                </small>
              </div>
              <meter min={0} max={max} value={entry.value}
                aria-label={`${metric === "energy" ? "Energia" : "Emissões"} de ${entry.name}`} />
              <strong className="service-impact-value">{formatNumber(entry.value)} {unit}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState compact icon={metric === "energy" ? Zap : Leaf}
          title={metric === "energy" ? "Sem coletas válidas neste período." : "Emissões indisponíveis neste período."}
          description="O ranking aparecerá quando houver estimativas disponíveis nas coletas selecionadas." />
      )}
      {entries.length > 5 && <p className="service-impact-note">5 primeiros de {entries.length} serviços com estimativas.</p>}
      {omittedCount > 0 && <p className="service-impact-note">
        {omittedCount} {omittedCount === 1 ? "serviço sem" : "serviços sem"} {metric === "emissions" ? "emissões completas" : "energia válida"} nas coletas do período.
      </p>}
    </Panel>
  );
}
