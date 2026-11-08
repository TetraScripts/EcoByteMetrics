import { lazy, Suspense, useEffect, useRef } from "react";
import {
  Route,
  Routes,
  useLocation,
  useNavigationType,
} from "react-router-dom";
import { PageBoundary } from "./components/PageBoundary";
import { deferredPages } from "./data/deferredPages";
import { UnderConstructionPage } from "./pages/UnderConstructionPage";

const AppLayout = lazy(() =>
  import("./components/AppLayout").then((module) => ({
    default: module.AppLayout,
  })),
);
const HomePage = lazy(() =>
  import("./pages/HomePage").then((module) => ({ default: module.HomePage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);
const ResearchPage = lazy(() =>
  import("./pages/ResearchPage").then((module) => ({
    default: module.ResearchPage,
  })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);

const titles: Record<string, string> = {
  "/": "Entendendo o hoje",
  "/dashboard": "Visão geral",
  "/servicos": "Serviços",
  "/emissoes": "Emissões",
  "/energia": "Energia",
  "/comparar": "Comparar",
  "/login": "Entrar",
  "/cadastro": "Criar conta",
  "/pesquisa": "Pesquisa por região",
  "/gerenciamento": "Gerenciamento do sistema",
};

export function App() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const focusedRoute = useRef("");
  useEffect(() => {
    document.title = `${titles[pathname] ?? (pathname.startsWith("/servicos/") ? "Detalhes do serviço" : "Página não encontrada")} · EcoByteMetrics`;
    const route = pathname + hash;
    if (focusedRoute.current === route) return;
    const focusPage = () => {
      if (hash) {
        const target = document.getElementById(hash.slice(1));
        if (!target) return false;
        target.scrollIntoView();
        focusedRoute.current = route;
        return true;
      }
      const heading = document.querySelector<HTMLElement>("main h1");
      if (!heading || !heading.getClientRects().length) return false;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      if (navigationType !== "POP")
        window.scrollTo({ top: 0, behavior: "instant" });
      focusedRoute.current = route;
      return true;
    };
    if (focusPage()) return;
    const observer = new MutationObserver(() => {
      if (focusPage()) observer.disconnect();
    });
    observer.observe(document.getElementById("root")!, {
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [pathname, hash, navigationType]);
  return (
    <PageBoundary key={pathname}>
      <Suspense
        fallback={
          <p className="globe-fallback" role="status">
            Carregando a página…
          </p>
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/cadastro" element={<LoginPage register />} />
          <Route element={<AppLayout />}>
            <Route path="/pesquisa" element={<ResearchPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            {deferredPages.map(({ path, title }) => (
              <Route key={path} path={path} element={<UnderConstructionPage title={title} />} />
            ))}
            <Route path="/servicos/:id" element={<UnderConstructionPage title="Serviços" />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </PageBoundary>
  );
}
