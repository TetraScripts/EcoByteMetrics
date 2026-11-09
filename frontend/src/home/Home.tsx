import { ProjectOverview } from "./components/ProjectOverview";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Solutions } from "./components/Solutions";
import { content } from "./data/content";
import "./hero.css";
import "./styles.css";

export function Home() {
  const copy = content.pt;

  return (
    <div className="ecobyte-home site-shell">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" tabIndex={-1}>
        <Hero copy={copy.hero} />
        <Solutions copy={copy.solutions} />
        <ProjectOverview />
      </main>
    </div>
  );
}
