import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { dashboardTransition } from "../domain/dashboardTransition";

const prepare = () => Promise.all([import("@/app/layouts/AppLayout"), import("@/features/monitoring/pages/DashboardPage")]);
function waitForPage() {
  return new Promise<void>(resolve => {
    const ready = () => document.querySelector(".monitoring-shell main h1, .page-load-error");
    if (ready()) { resolve(); return; }
    const finish = () => { observer.disconnect(); clearTimeout(timer); resolve(); };
    const observer = new MutationObserver(() => { if (ready()) finish(); });
    const timer = window.setTimeout(finish, 1800);
    observer.observe(document.getElementById("root") ?? document.body, { childList: true, subtree: true });
  });
}

export function DashboardLink({ children, className }: { children: ReactNode; className?: string }) {
  const navigate = useNavigate();
  const pending = useRef(false);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const preload = () => { void prepare().catch(() => {}); };
  return <Link to="/dashboard" className={className} aria-busy={loading} aria-disabled={loading || undefined} onPointerEnter={preload} onFocus={preload} onClick={event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    void (async () => {
      try { await prepare(); } catch { /* The route boundary handles a failed import. */ }
      if (!mounted.current) return;
      await dashboardTransition(document, matchMedia("(prefers-reduced-motion: reduce)").matches,
        entry => flushSync(() => navigate("/dashboard", { state: { homeEntry: entry } })), waitForPage);
      pending.current = false;
      if (mounted.current) setLoading(false);
    })();
  }}>{loading ? <span role="status">Abrindo monitoramento…</span> : children}</Link>;
}
