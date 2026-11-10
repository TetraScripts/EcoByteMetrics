import { ArrowUpRight } from "lucide-react";
import { DashboardLink } from "./DashboardLink";
import { HomeBrand } from "@/features/home/components/HomeBrand";

export function HomeHeader() {
  return (
    <header className="site-header" aria-label="Cabeçalho principal">
      <HomeBrand />
      <nav className="home-navigation" aria-label="Navegação principal">
        <a href="#inicio" aria-current="location">Início</a>
        <a href="#solucoes">Como funciona</a>
        <a href="#projeto">O projeto</a>
      </nav>
      <div className="header-actions">
        <DashboardLink className="platform-link">
          <span>Monitoramento</span>
          <ArrowUpRight size={19} strokeWidth={1.7} aria-hidden="true" />
        </DashboardLink>
      </div>
    </header>
  );
}
