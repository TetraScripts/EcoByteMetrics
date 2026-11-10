import { useId } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { EvolutionChartPoint } from "../domain/chartData";
import { collectionEventLabels } from "../domain/collectionEvents";
import { evolutionGapRanges, evolutionTimeTicks, evolutionValueTicks } from "../domain/chartPresentation";
import type { DashboardMetric } from "../domain/dashboard";
import type { EvolutionMode } from "../domain/evolution";
import { emissionScale, formatEmissions } from "@/shared/lib/format";

export function RechartsEvolutionChart({ data, metric, mode, intervalMs, helpId }: {
  data: EvolutionChartPoint[]; metric: DashboardMetric; mode: EvolutionMode; intervalMs: number; helpId: string;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const first = data[0]!, latest = data.at(-1)!;
  const maximum = data.reduce((max, point) => Math.max(max, point.value ?? 0), 0);
  const scale = emissionScale(maximum);
  const unit = metric === "energy" ? "kWh" : scale.unit;
  const seriesLabel = metric === "energy" ? "Energia estimada" : "Emissões estimadas";
  const color = metric === "energy" ? "#168998" : "#128361";
  const ticks = evolutionValueTicks(maximum);
  const gaps = evolutionGapRanges(data, intervalMs);
  const axisFormat = new Intl.NumberFormat("pt-BR", {maximumSignificantDigits: 3});
  const multipleDays = new Date(first.timestamp).toDateString() !== new Date(latest.timestamp).toDateString();
  const time = (timestamp: number) => new Date(timestamp).toLocaleString("pt-BR", { ...(multipleDays ? { day: "2-digit", month: "2-digit" } : {}), hour: "2-digit", minute: "2-digit", ...(intervalMs < 60_000 ? { second: "2-digit" } : {}) });
  return <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 900, height: 260 }} debounce={50}>
    <ComposedChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 6 }} accessibilityLayer
      title={seriesLabel + (mode === "cumulative" ? metric === "energy" ? " acumulada no período" : " acumuladas no período" : " por intervalo")}
      aria-label="Explorar valores do gráfico" aria-describedby={helpId} maxBarSize={36} barCategoryGap="24%">
      <defs>
        <linearGradient id={id + "-area"} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.2} /><stop offset="100%" stopColor={color} stopOpacity={.015} /></linearGradient>
        <linearGradient id={id + "-bar"} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={.95} /><stop offset="100%" stopColor={color} stopOpacity={.55} /></linearGradient>
        <pattern id={id + "-gap"} width="8" height="8" patternUnits="userSpaceOnUse"><path d="M-2 2L2-2M0 8L8 0M6 10L10 6" stroke="#82968c" strokeWidth="1" strokeOpacity={.12} /></pattern>
      </defs>
      <CartesianGrid vertical={false} stroke="#e9efeb" strokeDasharray="3 5" />
      <XAxis type="number" dataKey="timestamp" scale="time" domain={[first.timestamp - intervalMs / 2, latest.timestamp + intervalMs / 2]} ticks={evolutionTimeTicks(first.timestamp, latest.timestamp)} tickFormatter={time} minTickGap={40} axisLine={false} tickLine={false} tickMargin={14} height={36} tick={{ fill: "#61776b", fontSize: 11 }} />
      <YAxis width={64} domain={[0, ticks.at(-1)!]} ticks={ticks} tickFormatter={value => axisFormat.format(value / (metric === "energy" ? 1 : scale.divisor))} axisLine={false} tickLine={false} tickMargin={12} tick={{ fill: "#61776b", fontSize: 11 }} />
      {gaps.map(gap => <ReferenceArea key={gap.from} x1={gap.from} x2={gap.to} fill={"url(#" + id + "-gap)"} strokeOpacity={0}
        label={gap.to - gap.from > (latest.timestamp - first.timestamp) * .16 ? {value: "Sem registros", position: "insideTop", fill: "#7b8d82", fontSize: 11, offset: 12} : undefined} />)}
      <Tooltip isAnimationActive={false} filterNull={false} offset={18}
        cursor={mode === "intervals" ? { fill: color, fillOpacity: .045, radius: 6 } : { stroke: color, strokeOpacity: .25, strokeDasharray: "3 4" }}
        content={props => <EvolutionTooltip {...props} seriesLabel={seriesLabel} unit={unit} mode={mode} divisor={metric === "energy" ? 1 : scale.divisor} />} />
      {mode === "intervals"
        ? <Bar dataKey="value" name={seriesLabel} fill={"url(#" + id + "-bar)"} radius={[6, 6, 0, 0]} isAnimationActive={false} activeBar={{ fill: color }} />
        : <Area dataKey="value" name={seriesLabel} type="stepAfter" stroke={color} strokeWidth={2.5} fill={"url(#" + id + "-area)"} connectNulls={false} isAnimationActive={false}
            dot={props => {
              if (typeof props.cx !== "number" || typeof props.cy !== "number" || data[props.index]?.value === null) return <g key={props.index} />;
              const isolated = (data[props.index - 1]?.value ?? null) === null && (data[props.index + 1]?.value ?? null) === null;
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={isolated ? 3.5 : data.length < 24 ? 2.5 : 0} fill={color} stroke="#fff" strokeWidth={1.5} />;
            }} activeDot={{ r: 5, fill: color, stroke: "#fff", strokeWidth: 2.5 }} />}
    </ComposedChart>
  </ResponsiveContainer>;
}

export function EvolutionTooltip({ active, payload, seriesLabel, unit, mode = "intervals", divisor = 1 }: Pick<TooltipContentProps, "active" | "payload"> & { seriesLabel: string; unit: string; mode?: EvolutionMode; divisor?: number }) {
  const point = payload?.[0]?.payload as EvolutionChartPoint | undefined;
  if (!active || !point) return null;
  const stamp = (timestamp: number) => new Date(timestamp).toLocaleString("pt-BR");
  const contexts = [...new Set(point.events?.map(event => collectionEventLabels[event.kind]) ?? [])];
  return <div className="evolution-tooltip" role="status">
    <strong className="evolution-tooltip-title">{point.missing ? "Trecho sem registros" : mode === "cumulative" ? "Acumulado no período" : "Total do intervalo"}</strong>
    {!point.missing && <small>{point.from !== undefined && point.to !== undefined ? stamp(point.from) + " → " + stamp(point.to) : stamp(point.timestamp)}</small>}
    {point.missing && <small>{stamp(point.from!)} → {stamp(point.to!)}</small>}
    {point.value === null ? <p>{point.reason ?? "Estimativa indisponível para esta amostra."}</p> : <p className="evolution-tooltip-value"><span>{seriesLabel}</span><b>{formatEmissions(point.value, divisor)} {unit}</b></p>}
    {contexts.length > 0 && <><small>Informação registrada durante a coleta</small>{contexts.map(text => <p key={text}>{text}</p>)}</>}
  </div>;
}
