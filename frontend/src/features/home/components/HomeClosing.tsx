import { ArrowDown, ArrowUpRight, Plus } from "lucide-react";
import { DashboardLink } from "./DashboardLink";
import { HomeBrand } from "./HomeBrand";
import { GithubIcon } from "@/shared/ui/GithubIcon";

const questions = [
  { title: "Preciso criar uma conta para explorar?", body: "Não. O monitoramento é público. Para acessar a Administração, é necessário entrar com uma conta." },
  { title: "Os números são medições diretas de energia?", body: "Não. O consumo de energia é estimado a partir das métricas coletadas. As emissões são estimadas usando esse consumo e um fator que representa as emissões da eletricidade na região da aplicação." },
  { title: "O que os pontos no globo representam?", body: "Eles mostram a localização informada para os serviços. Aplicações na mesma coordenada aparecem agrupadas, com a quantidade de serviços daquele ponto. Isso não significa que estejam no mesmo computador." },
  { title: "Por que uma aplicação pode aparecer sem estimativas?", body: "Uma coleta pode estar indisponível, desatualizada ou sem os dados necessários para completar o cálculo. O monitoramento sinaliza essas situações, sem tratar a ausência de dados como consumo zero." },
];

export function HomeClosing() {
  return <>
    <section className="home-purpose" id="projeto" aria-labelledby="purpose-heading">
      <div className="purpose-heading" data-reveal><p className="chapter-label">O propósito da EcoByteMetrics</p><h2 id="purpose-heading">Entender melhor.<br />Escolher com consciência.</h2></div>
      <div className="purpose-copy" data-reveal><p>O impacto do software começa muito antes de aparecer em um gráfico. Está no processamento, nos dados em movimento e na eletricidade que torna tudo isso possível.</p><p>Nosso papel é dar visibilidade a essa relação. Reunir serviços, recursos e estimativas em um lugar onde você possa acompanhar aplicações, comparar estimativas e identificar mudanças no consumo.</p><a href="#home-questions">Algumas respostas para começar<ArrowDown size={17} aria-hidden="true" /></a></div>
    </section>
    <section className="home-questions" id="home-questions" aria-labelledby="questions-heading">
      <div data-reveal><p className="chapter-label">Antes de explorar</p><h2 id="questions-heading">Clareza desde<br />o primeiro acesso.</h2></div>
      <div className="questions-list" data-reveal>{questions.map(({ title, body }) => <details key={title}><summary><span>{title}</span><Plus size={20} strokeWidth={1.3} aria-hidden="true" /></summary><p>{body}</p></details>)}</div>
    </section>
    <section className="home-invitation" aria-labelledby="invitation-heading">
      <div className="invitation-copy" data-reveal>
        <h2 id="invitation-heading">Explore os dados das<br />aplicações monitoradas.</h2>
        <DashboardLink className="hero-border-button hero-border-button--dark">
          <svg viewBox="0 0 290 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <rect x="1" y="1" width="288" height="58" rx="29" className="hero-border-button__base" vectorEffect="non-scaling-stroke" />
            <rect x="1" y="1" width="288" height="58" rx="29" className="hero-border-button__highlight" pathLength="100" vectorEffect="non-scaling-stroke" />
          </svg>
          <span>Explorar monitoramento</span>
        </DashboardLink>
      </div>
    </section>
    <footer className="home-footer">
      <div className="footer-top">
        <HomeBrand />
        <a className="footer-back" href="#inicio">
          <span>Voltar ao início</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
      <div className="footer-links">
        <nav aria-label="Navegação do rodapé">
          <DashboardLink>Monitoramento</DashboardLink>
          <a href="#solucoes">Como funciona</a>
          <a href="#projeto">O projeto</a>
        </nav>
        <a
          className="footer-github-link"
          href="https://github.com/pentascripts-organization/EcoByteMetrics"
          target="_blank"
          rel="noreferrer"
          title="Acessar repositório no GitHub"
        >
          <span className="footer-github-label">github:</span>
          <span className="footer-github-pill">
            <GithubIcon size={15} className="github-logo" />
            <span className="footer-github-text">pentascripts-organization/EcoByteMetrics</span>
            <ArrowUpRight size={13} className="github-arrow" aria-hidden="true" />
          </span>
        </a>
      </div>
    </footer>
  </>;
}
