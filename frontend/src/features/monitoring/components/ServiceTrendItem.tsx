import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import type { MonitoredService, CollectionPoint } from "../types";
import type { DashboardMetric } from "../domain/dashboard";
import type { Period } from "@/shared/lib/period";
import { useServiceTrend } from "../hooks/useServiceTrend";

export function ServiceTrendItem({
  service,
  metric,
  period = "24h",
  preloadedHistory = [],
  isExpanded = true,
}: {
  service: MonitoredService;
  metric: DashboardMetric;
  period?: Period;
  preloadedHistory?: CollectionPoint[];
  isExpanded?: boolean;
}) {
  const { trend, loading } = useServiceTrend({
    service,
    metric,
    period,
    preloadedHistory,
    isExpanded,
  });

  const Icon =
    trend.direction === "down"
      ? TrendingDown
      : trend.direction === "up"
      ? TrendingUp
      : Minus;

  const gradientId = `sparkline-grad-${service.id.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  return (
    <div
      className="monitoring-card-meta-item monitoring-card-trend-item"
      data-direction={trend.direction}
      data-loading={loading ? "true" : undefined}
    >
      <Icon size={17} className="monitoring-card-meta-icon" aria-hidden="true" />
      <div className="monitoring-trend-info">
        <span className="monitoring-card-meta-label">
          Tendência de {metric === "energy" ? "consumo" : "emissão"}
        </span>
        <span
          className={`monitoring-trend-badge monitoring-trend-badge--${trend.direction}`}
          style={{ color: trend.color }}
          title={`Tendência de ${metric === "energy" ? "consumo" : "emissão"} ${trend.periodLabel}`}
        >
          <span className="trend-arrow">{trend.arrow}</span>{" "}
          {trend.formattedPercentage}{" "}
          <small>{trend.periodLabel}</small>
        </span>
      </div>
      <svg
        className="monitoring-card-sparkline"
        viewBox="0 0 96 26"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d={trend.sparklinePath}
          stroke={trend.strokeColor}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d={trend.sparklineArea}
          fill={`url(#${gradientId})`}
          opacity="0.3"
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trend.strokeColor} stopOpacity="0.5" />
            <stop offset="100%" stopColor={trend.strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
