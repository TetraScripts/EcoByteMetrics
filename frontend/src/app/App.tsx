import { lazy, Suspense, useEffect, useRef } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigationType,
  useParams,
} from "react-router-dom";
import { PageBoundary } from "@/shared/ui/PageBoundary";
import { deferredPages } from "@/app/routes/deferredPages";
import { UnderConstructionPage } from "@/app/pages/UnderConstructionPage";
import { dashboardLocation } from "@/app/routes/dashboardLocation";

const AppLayout = lazy(() =>
  import("@/app/layouts/AppLayout").then((module) => ({
    default: module.AppLayout,
  })),
);
const HomePage = lazy(() =>
  import("@/features/home/HomePage").then((module) => ({ default: module.HomePage })),
);
const LoginPage = lazy(() =>
  import("@/features/auth/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const NotFoundPage = lazy(() =>
  import("@/app/pages/NotFoundPage").then((module) => ({
    default: module.NotFoundPage,
  })),
);
const DashboardPage = lazy(() =>
  import("@/features/monitoring/pages/DashboardPage").then((module) => ({
    default: module.DashboardPage,
  })),
);

const titles: Record<string, string> = {
  "/": "Entendendo o hoje",
  "/dashboard": "Monitoramento",
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
          <Route path="/login" element={<LoginPage key="login" />} />
          <Route path="/cadastro" element={<LoginPage key="register" register />} />
          <Route element={<AppLayout />}>
            <Route path="/pesquisa" element={<LegacyDashboardRedirect />} />
            <Route path="/servicos" element={<LegacyDashboardRedirect />} />
            <Route path="/energia" element={<LegacyDashboardRedirect metric="energy" />} />
            <Route path="/emissoes" element={<LegacyDashboardRedirect metric="emissions" />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/comparar" element={<LegacyDashboardRedirect comparison />} />
            {deferredPages.map(({ path, title }) => (
              <Route key={path} path={path} element={<UnderConstructionPage title={title} />} />
            ))}
            <Route path="/servicos/:id" element={<LegacyServiceRedirect />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </PageBoundary>
  );
}

function LegacyDashboardRedirect({ metric, comparison }: { metric?: "energy" | "emissions"; comparison?: boolean }) {
  const { search } = useLocation();
  return <Navigate to={dashboardLocation(search, { metric, comparison })} replace />;
}

function LegacyServiceRedirect() {
  const { id } = useParams();
  const { search } = useLocation();
  return <Navigate to={dashboardLocation(search, { serviceId: id })} replace />;
}
