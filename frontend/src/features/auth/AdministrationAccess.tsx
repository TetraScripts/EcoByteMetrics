import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";
import { loginLocation, publicReturnPath } from "./api";

export function AdministrationAccess({ children }: { children: ReactNode }) {
  const { session, notice, restoring } = useAuth();
  const { pathname, search } = useLocation();
  if (restoring) return <p className="monitoring-empty" role="status">Verificando sua sessão…</p>;
  if (!session && notice === "signed-out") return <Navigate to={publicReturnPath(pathname + search)} replace />;
  if (!session)
    return <Navigate to={loginLocation(pathname + search, notice === "expired")} replace />;
  return children;
}
