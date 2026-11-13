import { memo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import type { MonitoredService } from "../types";
import { formatNumber } from "@/shared/lib/format";

export interface ComparisonRowData {
  service: MonitoredService;
  energyKwh: number | null;
  emissionsG: number | null;
}

export interface ComparisonPairedChartProps {
  rows: ComparisonRowData[];
  latest?: boolean;
}

const serviceColors = [
  "#087d62",
  "#0284c7",
  "#d97706",
  "#7c3aed",
  "#db2777",
  "#059669",
  "#4f46e5",
  "#ea580c",
];

export const ComparisonPairedChart = memo(function ComparisonPairedChart({
  rows,
  latest = false,
}: ComparisonPairedChartProps) {
  if (rows.length < 2) return null;

  const data = rows.map((r, index) => ({
    id: r.service.id,
    name: r.service.name,
    energyKwh: r.energyKwh ?? 0,
    emissionsKg: r.emissionsG !== null ? +(r.emissionsG / 1000).toFixed(4) : 0,
    emissionsG: r.emissionsG ?? 0,
    color: serviceColors[index % serviceColors.length],
  }));

  const maxEnergy = Math.max(...data.map((d) => d.energyKwh), 0.001);
  const maxEmissions = Math.max(...data.map((d) => d.emissionsKg), 0.001);

  return (
    <div className="comparison-paired-charts" aria-label="Gráficos pareados de consumo e carbono">
      <div className="comparison-chart-card">
        <div className="comparison-chart-header">
          <h3>Consumo de Energia</h3>
          <span className="comparison-chart-unit">kWh {latest ? "(última coleta)" : "(total)"}</span>
        </div>
        <div className="comparison-chart-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid vertical={false} stroke="#e9efeb" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#61776b", fontSize: 12 }}
                interval={0}
                tickMargin={10}
              />
              <YAxis
                domain={[0, Math.ceil(maxEnergy * 1.15 * 100) / 100]}
                tickFormatter={(val) => formatNumber(val)}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                tick={{ fill: "#61776b", fontSize: 11 }}
                width={50}
              />
              <Tooltip
                isAnimationActive={false}
                formatter={(val) => [
                  `${formatNumber(typeof val === "number" ? val : null)} kWh`,
                  "Energia",
                ]}
                labelStyle={{ fontWeight: 600, color: "#103a40" }}
                contentStyle={{
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #d0e1d9",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: 13,
                }}
              />
              <Bar dataKey="energyKwh" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {data.map((entry) => (
                  <Cell key={`energy-cell-${entry.id}`} fill={entry.color} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="comparison-chart-card">
        <div className="comparison-chart-header">
          <h3>Emissões de Carbono</h3>
          <span className="comparison-chart-unit">kg CO₂e {latest ? "(última coleta)" : "(total)"}</span>
        </div>
        <div className="comparison-chart-body">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid vertical={false} stroke="#e9efeb" strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#61776b", fontSize: 12 }}
                interval={0}
                tickMargin={10}
              />
              <YAxis
                domain={[0, Math.ceil(maxEmissions * 1.15 * 1000) / 1000]}
                tickFormatter={(val) => formatNumber(val)}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
                tick={{ fill: "#61776b", fontSize: 11 }}
                width={50}
              />
              <Tooltip
                isAnimationActive={false}
                formatter={(val) => [
                  `${formatNumber(typeof val === "number" ? val : null)} kg CO₂e`,
                  "Carbono",
                ]}
                labelStyle={{ fontWeight: 600, color: "#103a40" }}
                contentStyle={{
                  background: "#fff",
                  borderRadius: 8,
                  border: "1px solid #d0e1d9",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                  fontSize: 13,
                }}
              />
              <Bar dataKey="emissionsKg" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {data.map((entry) => (
                  <Cell key={`carbon-cell-${entry.id}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});
