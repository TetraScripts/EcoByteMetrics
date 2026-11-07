import { useMemo, useState } from "react";
import { CollectionTable } from "./CollectionTable";
import { aggregateCollections } from "../utils/history";
import {
  ArrowUpRight,
  CalendarDays,
  CircleDashed,
  RefreshCw,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useMonitoring } from "../hooks/useMonitoring";
import type { CollectionPoint } from "../types/monitoring";
import { useAnalysis } from "../hooks/useAnalysis";
import { analysisLink, isPeriod } from "../utils/analysis";

export function IconTile({
  icon: Icon,
  tone = "green",
}: {
  icon: LucideIcon;
  tone?: "green" | "blue" | "amber";
}) {
  return (
    <span className={`icon-tile icon-tile-${tone}`}>
      <Icon size={21} strokeWidth={1.65} />
    </span>
  );
}

export function EmptyState({
  icon: Icon = CircleDashed,
  title,
  description,
  compact = false,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  compact?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className={`empty-state${compact ? " empty-state-compact" : ""}`}>
      <span className="empty-state-icon">
        <Icon size={28} strokeWidth={1.3} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Panel({
  title,
  eyebrow,
  icon: Icon,
  link,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  icon?: LucideIcon;
  link?: { to: string; label: string };
  children: ReactNode;
  className?: string;
}) {
  const { search } = useLocation();
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div className="panel-title-group">
          {Icon && <IconTile icon={Icon} />}
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
        </div>
        {link && (
          <Link className="text-link" to={analysisLink(link.to, search)}>
            {link.label}
            <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function PeriodSelect() {
  const { period, setPeriod, refresh } = useMonitoring();
  const [, setParams] = useSearchParams();
  return (
    <label className="period-select">
      <CalendarDays size={17} />
      <span className="sr-only">Período de análise</span>
      <select
        value={period}
        onChange={(event) => {
          const next = new URLSearchParams(window.location.search);
          const value = event.target.value;
          if (!isPeriod(value)) return;
          next.set("periodo", value);
          setPeriod(value);
          setParams(next, { replace: true });
          if (value !== period) void refresh();
        }}
      >
        <option value="24h">Últimas 24 horas</option>
        <option value="7d">Últimos 7 dias</option>
      </select>
    </label>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-actions">
        <PeriodSelect />
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  icon,
  note,
  tone = "green",
}: {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  note: string;
  tone?: "green" | "blue" | "amber";
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <IconTile icon={icon} tone={tone} />
      </div>
      <div className="metric-value">
        {value}
        {unit && <span>{unit}</span>}
      </div>
      <div className="metric-note">
        <span className="neutral-dot" />
        {note}
      </div>
    </article>
  );
}

export function TrendChart({
  metric = "emissions",
  points: selectedPoints,
}: {
  metric?: "emissions" | "energy";
  points?: CollectionPoint[];
}) {
  const analysis = useAnalysis();
  const [tableOpen, setTableOpen] = useState(false);
  const points = useMemo(
    () =>
      aggregateCollections(selectedPoints ?? analysis.history, metric).sort(
        (a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt),
      ),
    [selectedPoints, analysis.history, metric],
  );
  const values = points.map((point) => point.value);
  const max = values.reduce((max, value) => Math.max(max, value), 0) || 1;
  const firstTime = Date.parse(points[0]?.collectedAt ?? "") || 0;
  const lastTime = Date.parse(points.at(-1)?.collectedAt ?? "") || firstTime;
  const coordinates = points
    .map(
      ({ collectedAt: time, value }) =>
        `${45 + ((Date.parse(time) - firstTime) / Math.max(lastTime - firstTime, 1)) * 650},${180 - (value / max) * 150}`,
    )
    .join(" ");
  return (
    <div
      className={`trend-chart${points.length ? " trend-chart-populated" : ""}`}
    >
      <div className="chart-unit">
        {metric === "emissions" ? "gCO₂e" : "kWh"}
      </div>
      <div className="chart-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="chart-grid-line" />
        ))}
      </div>
      {points.length ? (
        <svg
          viewBox="0 0 740 210"
          role="img"
          aria-label={`Evolução de ${metric === "emissions" ? "emissões" : "energia"} no período selecionado`}
        >
          <polyline
            points={coordinates}
            fill="none"
            stroke="#169c7c"
            strokeWidth="3"
          />
          {values.length === 1 && (
            <circle
              cx="45"
              cy={180 - ((values[0] ?? 0) / max) * 150}
              r="4"
              fill="#169c7c"
            />
          )}
        </svg>
      ) : (
        <EmptyState
          icon={metric === "emissions" ? CircleDashed : RefreshCw}
          compact
          title="Seu histórico começa aqui"
          description="As primeiras coletas darão vida a este gráfico."
        />
      )}
      <div className="chart-axis">
        <span>
          {points.length
            ? new Date(firstTime).toLocaleString("pt-BR")
            : "Início do período"}
        </span>
        <span>
          {points.length
            ? new Date(lastTime).toLocaleString("pt-BR")
            : "Fim do período"}
        </span>
      </div>
      {points.length > 0 && (
        <details
          className="chart-data"
          onToggle={(event) => setTableOpen(event.currentTarget.open)}
        >
          <summary>Ver valores e horários das coletas</summary>
          {tableOpen && (
            <CollectionTable
              points={points}
              unit={metric === "emissions" ? "gCO₂e" : "kWh"}
            />
          )}
        </details>
      )}
    </div>
  );
}
