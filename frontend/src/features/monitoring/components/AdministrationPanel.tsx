import { LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import "../styles/administration.css";

export function AdministrationPanel() {
  const { session, logout, pending, error } = useAuth();

  return <section className="administration-panel" aria-labelledby="administration-title">
    <header className="administration-heading">
      <h2 id="administration-title">Administração</h2>
      {session && <div className="administration-account"><span title={session.email}>{session.email}</span><button type="button" disabled={pending} onClick={() => void logout()}><LogOut size={16} aria-hidden="true" />{pending ? "Saindo…" : "Sair"}</button></div>}
    </header>
    {error && <p className="monitoring-notice" role="alert">{error}</p>}
  </section>;
}
