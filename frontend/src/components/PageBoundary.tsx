import { Component } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export class PageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="page-load-error">
        <h1>Não foi possível abrir esta página.</h1>
        <p>Verifique a conexão e tente carregar novamente.</p>
        <button
          className="button button-dark"
          onClick={() => window.location.reload()}
        >
          Recarregar página
        </button>
        <Link className="button button-outline" to="/">
          Voltar ao início
        </Link>
      </main>
    ) : (
      this.props.children
    );
  }
}
