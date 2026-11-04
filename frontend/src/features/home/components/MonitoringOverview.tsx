import { ChartNoAxesCombined, Globe2, ScanLine } from "lucide-react";
import { DashboardLink } from "./DashboardLink";

export function MonitoringOverview() {
  return <section className="impact-lab" id="dados" aria-labelledby="monitoring-heading">
    <div className="monitoring-preview">
      <div className="monitoring-preview__copy" data-reveal>
        <p className="chapter-label">Seu software em perspectiva</p>
        <h2 id="monitoring-heading">Localize aplicações.<br /><span>Acompanhe sua evolução.</span></h2>
        <p>Do lugar onde sua aplicação roda aos recursos que ela utiliza. Conecte os pontos e descubra o que os dados revelam sobre o seu impacto.</p>
        <DashboardLink className="hero-border-button">
          <svg viewBox="0 0 290 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <rect x="1" y="1" width="288" height="58" rx="29" className="hero-border-button__base" vectorEffect="non-scaling-stroke" />
            <rect x="1" y="1" width="288" height="58" rx="29" className="hero-border-button__highlight" pathLength="100" vectorEffect="non-scaling-stroke" />
          </svg>
          <span>Explorar monitoramento</span>
        </DashboardLink>
        <span className="monitoring-preview__caption">Explore o mundo. Entenda cada serviço.</span>
      </div>
      <ol className="monitoring-preview__steps" aria-label="O que explorar no monitoramento">
        <li data-reveal>
          <span className="monitoring-preview__number" aria-hidden="true">01</span>
          <div><Globe2 size={25} strokeWidth={1.2} aria-hidden="true" /><h3>Encontre no mundo.</h3><p>Navegue pelo globo e veja onde os serviços estão localizados. Selecione um ponto para consultar as aplicações daquela localização.</p></div>
        </li>
        <li data-reveal>
          <span className="monitoring-preview__number" aria-hidden="true">02</span>
          <div><ScanLine size={25} strokeWidth={1.2} aria-hidden="true" /><h3>Olhe mais de perto.</h3><p>Explore os recursos de cada aplicação e suas estimativas de energia e emissões, com o contexto da região.</p></div>
        </li>
        <li data-reveal>
          <span className="monitoring-preview__number" aria-hidden="true">03</span>
          <div><ChartNoAxesCombined size={25} strokeWidth={1.2} aria-hidden="true" /><h3>Perceba o que muda.</h3><p>Consulte o histórico de energia e emissões e compare os valores ao longo do tempo.</p></div>
        </li>
      </ol>
    </div>
  </section>;
}
