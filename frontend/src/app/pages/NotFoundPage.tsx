import { Link } from "react-router-dom";
import { Brand } from "@/shared/ui/Brand";
import "../styles/not-found.css";

export function NotFoundPage() {
  return (
    <div className="not-found-page">
      <a className="skip-link" href="#not-found-content">Pular para o conteúdo</a>
      <header className="not-found-header">
        <Brand />
      </header>
      <main className="not-found-content" id="not-found-content" aria-labelledby="not-found-heading">
        <div className="not-found-copy">
          <h1 id="not-found-heading">Este endereço não está disponível.</h1>
          <p className="not-found-description">Acesse a página inicial.</p>
          <div className="not-found-actions">
            <Link className="not-found-home" to="/">
              <svg viewBox="0 0 290 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <rect x="1" y="1" width="288" height="58" rx="29" className="not-found-home__base" vectorEffect="non-scaling-stroke" />
                <rect x="1" y="1" width="288" height="58" rx="29" className="not-found-home__highlight" pathLength="100" vectorEffect="non-scaling-stroke" />
              </svg>
              <span>Voltar ao início</span>
            </Link>
          </div>
        </div>
        <div className="not-found-art" aria-hidden="true">
          <svg className="not-found-route" viewBox="0 0 560 480" fill="none">
            <circle className="not-found-orbit" cx="280" cy="240" r="204" />
            <circle className="not-found-orbit" cx="280" cy="240" r="175" />
            <path className="not-found-trail" d="M38 378C110 386 73 300 153 292S219 365 294 329 278 171 356 157 431 203 505 91" />
            <circle className="not-found-origin" cx="38" cy="378" r="5" />
            <circle className="not-found-destination" cx="505" cy="91" r="17" />
            <circle className="not-found-origin" cx="505" cy="91" r="5" />
            <path className="not-found-crosshair" d="M280 21v14m0 410v14M61 240h14m410 0h14" />
          </svg>
          <span className="not-found-number">404</span>
        </div>
      </main>
      <footer className="not-found-footer"><span>EcoByteMetrics</span></footer>
    </div>
  );
}
