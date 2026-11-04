import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/shared/ui/Brand";
import { AnalysisProvider } from "@/features/monitoring/providers/AnalysisProvider";

export function AppLayout() {
  const { state } = useLocation();
  const [entry] = useState(() => state?.homeEntry === "crossfade" ? "crossfade" : state?.homeEntry === "fade" ? "fade" : undefined);
  return <AnalysisProvider>
    <div className="monitoring-shell" data-entry={entry}>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <header className="monitoring-header">
        <Brand />
        <Link className="monitoring-home" to="/" aria-label="Voltar ao início"><ArrowLeft size={20} aria-hidden="true" /> <span>Voltar ao início</span></Link>
      </header>
      <main tabIndex={-1} id="main-content" className="monitoring-main"><Outlet /></main>
    </div>
  </AnalysisProvider>;
}
