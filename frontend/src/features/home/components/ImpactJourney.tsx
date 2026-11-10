import { useState } from "react";
import { ArrowRight, Cpu, HardDrive, MemoryStick, Network, Sprout, Zap } from "lucide-react";

const resources = [
  { name: "CPU", icon: Cpu, title: "Cada tarefa exige processamento.", description: "Executar uma busca, processar um pedido ou analisar dados ocupa o processador. A atividade da CPU é uma das pistas para estimar a energia usada pelo software.", bars: [20, 32, 24, 51, 42, 72, 59, 84, 62, 48, 69, 43, 56, 35, 47, 26] },
  { name: "Memória", icon: MemoryStick, title: "Manter informações também usa recursos.", description: "Enquanto a aplicação funciona, dados e instruções ficam na memória. A quantidade utilizada ajuda a compor a estimativa de consumo do serviço.", bars: [30, 32, 33, 38, 42, 42, 49, 52, 52, 55, 54, 49, 47, 45, 44, 42] },
  { name: "Disco", icon: HardDrive, title: "Há energia por trás de cada arquivo.", description: "Guardar e acessar dados faz parte da atividade de uma aplicação. O uso de disco entra no modelo junto com os demais recursos disponíveis na coleta.", bars: [12, 15, 38, 18, 12, 13, 62, 21, 15, 14, 80, 37, 15, 12, 48, 18] },
  { name: "Rede", icon: Network, title: "Uma conexão também deixa sua marca.", description: "Enviar e receber dados movimenta a rede. Esse tráfego ajuda a entender a atividade do serviço e sua contribuição para a energia estimada.", bars: [15, 37, 66, 28, 16, 47, 83, 51, 19, 43, 68, 24, 16, 52, 75, 34] },
] as const;

export function ImpactJourney() {
  const [active, setActive] = useState(0);
  const resource = resources[active]!;
  return <section className="impact-journey" id="solucoes" aria-labelledby="journey-heading">
    <div className="journey-intro" data-reveal>
      <div><p className="chapter-label">Por trás de cada execução</p><h2 id="journey-heading">O digital também<br />faz parte do mundo real.</h2></div>
      <p>Uma aplicação pode parecer invisível, mas a infraestrutura que a sustenta consome recursos reais. A EcoByteMetrics usa métricas de processamento, memória, disco e rede para estimar o consumo de energia e as emissões associadas à eletricidade.</p>
    </div>
    <div className="resource-explorer" data-reveal>
      <div className="resource-tabs" role="tablist" aria-label="Recursos da aplicação">
        {resources.map(({ name, icon: Icon }, i) => <button key={name} id={`resource-tab-${i}`} role="tab" aria-selected={i === active} aria-controls="resource-panel" tabIndex={i === active ? 0 : -1} onClick={() => setActive(i)} onKeyDown={event => {
          const next = event.key === "ArrowRight" ? (i + 1) % resources.length : event.key === "ArrowLeft" ? (i + resources.length - 1) % resources.length : event.key === "Home" ? 0 : event.key === "End" ? resources.length - 1 : null;
          if (next !== null) { event.preventDefault(); setActive(next); document.getElementById(`resource-tab-${next}`)?.focus(); }
        }}><Icon size={20} strokeWidth={1.4} aria-hidden="true" /><span>{name}</span></button>)}
      </div>
      <div className="resource-panel" id="resource-panel" role="tabpanel" aria-labelledby={`resource-tab-${active}`} tabIndex={0}>
        <div className="resource-copy" key={resource.name}><h3>{resource.title}</h3><p>{resource.description}</p><span className="resource-caption">Selecione um recurso para entender sua relação com o consumo de energia.</span></div>
        <div className="resource-visual" aria-label={`Ilustração da atividade de ${resource.name}; não representa uma coleta real`} role="img">
          <div className="activity-bars" aria-hidden="true">{resource.bars.map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div>
          <div className="activity-caption"><span>{resource.name} em atividade</span><span>Ilustração</span></div>
        </div>
      </div>
    </div>
    <div className="impact-path" data-reveal aria-label="Recursos ajudam a estimar energia, que é relacionada às emissões de carbono">
      <span><Cpu size={22} strokeWidth={1.4} aria-hidden="true" />Atividade dos recursos</span><ArrowRight className="path-arrow" size={22} aria-hidden="true" /><span><Zap size={22} strokeWidth={1.4} aria-hidden="true" />Energia estimada</span><ArrowRight className="path-arrow" size={22} aria-hidden="true" /><span><Sprout size={22} strokeWidth={1.4} aria-hidden="true" />Emissões estimadas</span>
    </div>
  </section>;
}
