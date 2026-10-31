import { Clock3, Radio } from "lucide-react";
import type { MonitoringObservation } from "../types";

export function ObservationTimeline({ observations, selected, onSelect, onLive, onExplore, loading = false }: {
  observations: MonitoringObservation[]; selected: string; onSelect: (value: string) => void; onLive: () => void; onExplore?: () => void;
  loading?: boolean;
}) {
  const index = selected ? observations.reduce((closest, observation, i) => Date.parse(observation.observedAt) <= Date.parse(selected) ? i : closest, -1) : -1;
  const latest = observations.at(-1);
  const current = selected ? observations[index] : latest;
  const collectionCount = observations.reduce((sum, observation) => sum + (observation.collectionCount ?? 1), 0);
  const format = (date: string) => new Date(date).toLocaleString("pt-BR");
  return <section className="observation-timeline" aria-label="Linha do tempo do ambiente">
    <div className="timeline-heading">
      <div className="timeline-heading-main">
        <span className="timeline-heading-status">
          <Clock3 size={18} />
          <strong>{selected ? "Horário escolhido" : "Dados mais recentes"}</strong>
        </span>
        {current && (
          <label htmlFor="observation-range" className="timeline-observed-label">
            {selected ? "Instante em revisão" : "Última rodada registrada"}: <strong>{format(current.observedAt)}</strong>
          </label>
        )}
      </div>
      <button className="monitoring-text-button" disabled={!selected} onClick={onLive}><Radio size={16} />Voltar para agora</button>
    </div>
    {current ? <>
      <input id="observation-range" type="range" min="0" max={Math.max(0, observations.length - 1)} step="1" value={index < 0 ? observations.length - 1 : index} disabled={observations.length < 2}
        aria-valuetext={format(current.observedAt)} onChange={event => { const observation = observations[Number(event.target.value)]; if (observation) onSelect(observation.observedAt); }} />
      <div className="timeline-range"><span>{format(observations[0]!.observedAt)}</span><span>{format(latest!.observedAt)}</span></div>
      <p>Arraste a barra para escolher um horário. Isso muda a consulta, sem interromper a coleta.</p>
      <details><summary>Como funciona o histórico</summary><p>{collectionCount} {collectionCount === 1 ? "rodada de coleta gravada" : "rodadas de coleta gravadas"} neste período.{collectionCount > observations.length && ` A barra reúne essas rodadas em ${observations.length} pontos de revisão.`} <span>Uma rodada consulta várias aplicações. Os horários seguem o fuso deste dispositivo. Com o servidor ativo, a coleta continua mesmo com o navegador fechado.</span></p></details>
      {selected && onExplore && <button className="monitoring-text-button" onClick={onExplore}>Explorar este instante no mapa e na lista →</button>}
    </> : <p role="status">{loading ? "Consultando o histórico de coletas…" : selected ? "Não há coleta gravada neste instante." : "A linha do tempo aparecerá após a primeira coleta gravada."}</p>}
  </section>;
}
