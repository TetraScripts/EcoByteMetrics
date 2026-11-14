import { useEffect, useMemo, useState } from "react";
import type { CollectionPoint, MonitoredService } from "../types";
import type { DashboardMetric } from "../domain/dashboard";
import type { Period } from "@/shared/lib/period";
import { calculateTrend, type ServiceTrend } from "../domain/trend";
import { getMonitoringSnapshot } from "../api/monitoring";

const trendHistoryCache = new Map<string, { points: CollectionPoint[]; timestamp: number }>();
const CACHE_TTL_MS = 60_000; // 1 minuto de cache em memória

export function clearServiceTrendCache() {
  trendHistoryCache.clear();
}

export function useServiceTrend({
  service,
  metric,
  period = "24h",
  preloadedHistory = [],
  isExpanded = false,
}: {
  service: MonitoredService;
  metric: DashboardMetric;
  period?: Period;
  preloadedHistory?: CollectionPoint[];
  isExpanded?: boolean;
}): { trend: ServiceTrend; loading: boolean } {
  const serviceId = service.id;
  const cacheKey = `${serviceId}:${period}`;

  // Filtra histórico pré-carregado que já pertença a este serviço
  const preloadedServicePoints = useMemo(
    () => preloadedHistory.filter((p) => p.serviceId === serviceId),
    [preloadedHistory, serviceId],
  );

  const [fetchedPoints, setFetchedPoints] = useState<CollectionPoint[]>(() => {
    const cached = trendHistoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.points;
    }
    return [];
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Se o card não está expandido ou já temos histórico suficiente pré-carregado, não busca
    if (!isExpanded || preloadedServicePoints.length >= 2) {
      return;
    }

    const cached = trendHistoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      setFetchedPoints(cached.points);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    getMonitoringSnapshot(controller.signal, {
      period,
      serviceIds: [serviceId],
      includeHistory: true,
    })
      .then((snapshot) => {
        if (!controller.signal.aborted) {
          const points = snapshot.history.filter((p) => p.serviceId === serviceId);
          trendHistoryCache.set(cacheKey, { points, timestamp: Date.now() });
          setFetchedPoints(points);
        }
      })
      .catch(() => {
        // Falha de rede preserva pontos vazios e não quebra a interface
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [isExpanded, serviceId, period, preloadedServicePoints.length, cacheKey]);

  const effectivePoints = useMemo(() => {
    if (preloadedServicePoints.length >= 2) {
      return preloadedServicePoints;
    }
    if (fetchedPoints.length > 0) {
      return fetchedPoints;
    }
    return preloadedServicePoints;
  }, [preloadedServicePoints, fetchedPoints]);

  const fallbackValue = metric === "energy" ? service.energyKwh : service.emissionsG;

  const trend = useMemo(
    () => calculateTrend(effectivePoints, metric, period, fallbackValue),
    [effectivePoints, metric, period, fallbackValue],
  );

  return { trend, loading };
}
