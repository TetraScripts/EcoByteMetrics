import { HomeClosing } from "./components/HomeClosing";
import { HomeHeader } from "@/features/home/components/HomeHeader";
import { Hero } from "@/features/home/components/Hero";
import { ImpactJourney } from "./components/ImpactJourney";
import { MonitoringOverview } from "./components/MonitoringOverview";
import { HomeSound } from "./components/HomeSound";
import { useHomeReveal } from "./hooks/useHomeReveal";
import { content } from "@/features/home/data/content";
import "@/features/home/styles/hero.css";
import "@/features/home/styles/first-fold.css";
import "./styles/impact-story.css";
import "./styles/closing.css";

export function HomePage() {
  const copy = content.pt;
  const ref = useHomeReveal();

  return (
    <div ref={ref} className="ecobyte-home site-shell">
      <a className="skip-link" href="#conteudo">
        Pular para o conteúdo
      </a>
      <HomeHeader />
      <main id="conteudo" tabIndex={-1}>
        <Hero copy={copy.hero} />
        <ImpactJourney />
        <MonitoringOverview />
        <HomeClosing />
      </main>
      <HomeSound />
    </div>
  );
}
