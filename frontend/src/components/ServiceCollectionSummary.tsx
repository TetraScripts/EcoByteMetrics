import { MapPin } from "lucide-react";
import type { MonitoredService } from "../types/monitoring";
import { serviceStatusLabels } from "../types/monitoring";
import { formatNumber } from "../utils/format";
import { Panel } from "./UI";

const measurement = (value: number | null, unit: string) => value === null ? "—" : `${formatNumber(value)} ${unit}`;

export function ServiceCollectionSummary({ services }: { services: MonitoredService[] }) {
  return (
    <Panel icon={MapPin} title="Localização e coleta" eyebrow="ÚLTIMA CONSULTA" className="service-collection-panel">
      {services.length ? (
        <div className="table-scroll" role="region" aria-label="Localização e coleta por serviço" tabIndex={0}>
          <table className="service-collection-table">
            <caption className="sr-only">Localização, recursos atuais, impacto da amostra, intervalo e última coleta válida de cada serviço na seleção atual.</caption>
            <thead>
              <tr>
                <th scope="col">Serviço</th>
                <th scope="col">Localização</th>
                <th scope="col">Recursos atuais</th>
                <th scope="col">Impacto da amostra</th>
                <th scope="col">Intervalo da amostra</th>
                <th scope="col">Última coleta válida</th>
              </tr>
            </thead>
            <tbody>
              {services.map(service => (
                <tr key={service.id}>
                  <th scope="row">
                    <strong>{service.name}</strong>
                    <span className={`service-status status-${service.status}`}>
                      {service.status === "no-metrics" &&
                        [service.cpuPercent, service.memoryGb, service.diskGb, service.networkGb].some(value => value !== null)
                        ? "Métricas parciais"
                        : serviceStatusLabels[service.status]}
                    </span>
                  </th>
                  <td data-label="Localização">
                    {service.country || "País não informado"} · {service.region || "Região não informada"}
                    <small>{service.city || "Cidade não informada"}</small>
                  </td>
                  <td data-label="Recursos atuais">
                    <dl className="service-sample-values">
                      <div><dt>CPU</dt><dd>{measurement(service.cpuPercent, "%")}</dd></div>
                      <div><dt>RAM</dt><dd>{measurement(service.memoryGb, "GB")}</dd></div>
                      <div><dt>Disco</dt><dd>{measurement(service.diskGb, "GB")}</dd></div>
                      <div><dt>Rede</dt><dd>{measurement(service.networkGb, "GB")}</dd></div>
                    </dl>
                  </td>
                  <td data-label="Impacto da amostra">
                    <dl className="service-sample-values">
                      <div><dt>Energia</dt><dd>{measurement(service.energyKwh, "kWh")}</dd></div>
                      <div><dt>CO₂e</dt><dd>{measurement(service.emissionsG, "gCO₂e")}</dd></div>
                    </dl>
                  </td>
                  <td data-label="Intervalo da amostra">
                    {service.collectionIntervalSeconds != null
                      ? `${formatNumber(service.collectionIntervalSeconds)} s`
                      : "Intervalo não informado"}
                  </td>
                  <td data-label="Última coleta válida">
                    {service.lastCollectionAt ? (
                      <time dateTime={service.lastCollectionAt}>
                        {new Date(service.lastCollectionAt).toLocaleString("pt-BR")}
                      </time>
                    ) : "Sem coleta válida"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="service-collection-note">Nenhum serviço nesta seleção.</p>
      )}
    </Panel>
  );
}
