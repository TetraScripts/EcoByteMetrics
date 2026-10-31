import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MonitoringContext } from "@/features/monitoring/contexts/MonitoringContext";
import { useSettings } from "@/shared/preferences/useSettings";
import { useLocation } from "react-router-dom";
import type { MonitoringSnapshot } from "@/features/monitoring/types";
import type { Period } from "@/shared/lib/period";
import { summarizeCollections } from "@/features/monitoring/domain/history";
import { isPeriod } from "@/shared/lib/period";
import { DiscoveryError } from "@/features/monitoring/api/discoveryError";
import { mergeMonitoringSnapshot, markStaleServices, isMonitoringPath, REFRESH_INTERVAL_MS } from "../domain/snapshot";
import { appendCollectionEvents, createCollectionPauseTracker } from "../domain/collectionEvents";
import { parseLocalDate } from "@/shared/lib/localDate";

export function MonitoringProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [selectedPeriod, setPeriod] = useState<Period>(settings.defaultPeriod);
  const [liveSnapshot, setLiveSnapshot] = useState<MonitoringSnapshot>({
    regions: [],
    services: [],
    history: [],
    totalEnergyKwh: null,
    totalEmissionsG: null,
    lastCollectionAt: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const trackPause = useRef(createCollectionPauseTracker());
  const { pathname, search } = useLocation();
  const queryPeriod = new URLSearchParams(search).get("periodo");
  const period = isPeriod(queryPeriod) ? queryPeriod : selectedPeriod;
  const filterParams = new URLSearchParams(search);
  const monitoringActive = isMonitoringPath(pathname) && filterParams.get("aba") !== "administracao";
  const includeHistory = historyOpen || (filterParams.has("servico") ? filterParams.get("detalhe") === "evolucao" : ["evolucao", "comparar"].includes(filterParams.get("aba") ?? ""));
  const dateFilter = filterParams.get("ate");
  const untilTimestamp = dateFilter ? parseLocalDate(dateFilter) : Date.parse(filterParams.get("instante") ?? "");
  const invalidCutoff = Boolean((dateFilter || filterParams.get("instante")) && !Number.isFinite(untilTimestamp));
  const until = Number.isFinite(untilTimestamp) && !invalidCutoff ? new Date(untilTimestamp).toISOString() : undefined;

  const refresh = useCallback(async () => {
    if (invalidCutoff || (until && Date.parse(until) > Date.now())) { setLoading(false); setError(null); return null; }
    if (pending.current) return null;
    const controller = new AbortController();
    const requestedAt = new Date().toISOString();
    pending.current = controller;
    setLoading(true);
    setError(null);
    try {
      const { getMonitoringSnapshot } = await import("@/features/monitoring/api/monitoring");
      controller.signal.throwIfAborted();
      const next = await getMonitoringSnapshot(controller.signal, { period, until, includeHistory });
      if (controller.signal.aborted) return null;
      const observedAt = new Date().toISOString();
      setLiveSnapshot(previous => mergeMonitoringSnapshot(previous, next, observedAt, requestedAt));
      return next;
    } catch (cause) {
      if (!controller.signal.aborted) {
        const discovery = cause instanceof DiscoveryError ? cause : null;
        const failedAt = new Date().toISOString();
        setLiveSnapshot((previous) => ({
          ...previous,
          regions: discovery?.regions ?? previous.regions,
          warning: discovery ? discovery.catalogWarning : previous.warning,
          services: markStaleServices(previous.services),
          collectionEvents: previous.source === "database" ? previous.collectionEvents : appendCollectionEvents(previous.collectionEvents, [{ from: requestedAt, to: failedAt, kind: "request-failed" }]),
        }));
        setError(
          "Não foi possível consultar o histórico no banco pelo backend. Os últimos dados recebidos foram preservados. Verifique a conexão e tente atualizar novamente. " +
            (cause instanceof Error ? cause.message : ""),
        );
      }
      return null;
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setLoading(false);
      }
    }
  }, [period, until, invalidCutoff, includeHistory]);

  useEffect(() => {
    const updateIfVisible = () => {
      const events = trackPause.current(!monitoringActive ? "monitoring-inactive" : document.hidden ? "tab-hidden" : null, new Date().toISOString());
      if (events.length) setLiveSnapshot(previous => previous.source === "database" ? previous : ({ ...previous, collectionEvents: appendCollectionEvents(previous.collectionEvents, events) }));
      if (monitoringActive && !document.hidden) void refresh();
    };
    const initial = window.setTimeout(updateIfVisible, 0);
    const timer = monitoringActive ? window.setInterval(updateIfVisible, REFRESH_INTERVAL_MS) : undefined;
    document.addEventListener("visibilitychange", updateIfVisible);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateIfVisible);
      pending.current?.abort();
      pending.current = null;
    };
  }, [monitoringActive, refresh]);

  const totals = useMemo(
    () => summarizeCollections(liveSnapshot.history),
    [liveSnapshot.history],
  );
  const snapshot = useMemo(() => {
    const history = liveSnapshot.history;
    return {
      ...liveSnapshot,
      history,
      totalEnergyKwh: totals.energyKwh,
      totalEmissionsG: totals.emissionsG,
    };
  }, [liveSnapshot, totals]);

  const monitoring = useMemo(
    () => ({ snapshot, period, setPeriod, refresh, loading, error, setHistoryOpen }),
    [snapshot, period, refresh, loading, error],
  );

  return (
    <MonitoringContext.Provider value={monitoring}>
      {children}
    </MonitoringContext.Provider>
  );
}
