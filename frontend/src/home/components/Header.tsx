import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "./Brand";

export function Header() {
  return (
    <header className="site-header" aria-label="Cabeçalho principal">
      <Brand />
      <div className="header-actions">
        <Link className="platform-link" to="/login">
          <span>Login / Cadastro</span>
          <ArrowUpRight size={19} strokeWidth={1.7} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
