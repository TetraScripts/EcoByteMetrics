import { Clock3, LogOut, Radar } from "lucide-react";
import { useEffect, useState } from "react";
import { InfoTooltip } from "@/shared/ui/InfoTooltip";
import { useAuth } from "@/features/auth/useAuth";
import { getMonitoringSettings } from "../api/settings";
import "../styles/administration.css";

export function AdministrationPanel() {
  const { session, logout, pending, error, request } = useAuth();
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getMonitoringSettings>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getMonitoringSettings(request, controller.signal).then(value => {
      if (!controller.signal.aborted) { setSettings(value); setFailed(false); }
    }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [request, retry]);

  return <section className="administration-panel" aria-labelledby="administration-title">
    <header className="administration-heading">
      <div><h2 id="administration-title">Administração</h2><p>Configurações do ambiente de monitoramento.</p></div>
      {session && <div className="administration-account"><span title={session.email}>{session.email}</span><button type="button" disabled={pending} onClick={() => void logout()}><LogOut size={16} aria-hidden="true" />{pending ? "Saindo…" : "Sair"}</button></div>}
    </header>
    {error && <p className="monitoring-notice" role="alert">{error}</p>}
    {failed && <p className="monitoring-notice" role="alert">Não foi possível consultar a configuração do servidor. <button className="monitoring-text-button" onClick={() => { setFailed(false); setSettings(null); setRetry(value => value + 1); }}>Tentar novamente</button></p>}

    <div className="administration-workspace">
      <aside className="administration-navigation" aria-label="Configurações do ambiente">
        <p>Configurações</p>
        <div className="administration-current">
          <Clock3 size={19} aria-hidden="true" /><span>Coleta de métricas<small>Frequência das consultas</small></span>
        </div>
      </aside>

      <section className="administration-settings" id="administration-settings" aria-labelledby="administration-section-title">
        <header className="administration-section-heading">
          <h3 id="administration-section-title">Configuração atual da coleta</h3>
          <p role="status">{settings ? `O servidor consulta as aplicações automaticamente a cada ${settings.collectionIntervalSeconds} segundos.` : failed ? "Configuração indisponível." : "Consultando a configuração do servidor…"}</p>
        </header>

        <div className="administration-settings-body">
          <div className="administration-setting-group">
            <div className="administration-setting-row">
              <div>
                <div className="administration-setting-label"><span id="administration-interval-label">Intervalo entre consultas</span><InfoTooltip label="intervalo entre consultas">Define quanto tempo o nosso servidor espera entre consultas. O período representado por cada amostra é informado pela API e pode ser diferente.</InfoTooltip></div>
                <p id="administration-interval-help">Tempo de espera entre uma consulta e a próxima.</p>
              </div>
              <div className="administration-interval"><output id="administration-interval" aria-labelledby="administration-interval-label" aria-describedby="administration-interval-help">{settings?.collectionIntervalSeconds ?? "—"}</output><span>segundos</span></div>
            </div>
            <div className="administration-setting-row">
              <div><h4>Descoberta das aplicações</h4><p>As aplicações são identificadas pelo agregador de métricas.</p></div>
              <span className="administration-readonly"><Radar size={15} aria-hidden="true" />Automática</span>
            </div>
          </div>
          <p className="administration-field-note">O intervalo de consulta não altera o tempo representado por cada leitura.</p>
          <p className="administration-field-note">Esta configuração é somente para consulta. A alteração do intervalo ainda não está disponível.</p>
        </div>
      </section>
    </div>
  </section>;
}
