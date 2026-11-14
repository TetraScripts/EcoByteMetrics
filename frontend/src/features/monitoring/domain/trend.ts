import type { CollectionPoint } from "../types.ts";
import type { DashboardMetric } from "./dashboard.ts";
import type { Period } from "@/shared/lib/period.ts";

export type TrendDirection = "down" | "up" | "neutral";

export interface ServiceTrend {
  percentage: number | null;
  formattedPercentage: string;
  direction: TrendDirection;
  arrow: string;
  color: string;
  strokeColor: string;
  periodLabel: string;
  sparklinePath: string;
  sparklineArea: string;
  hasEnoughData: boolean;
}

export function generateSparklinePaths(
  values: number[],
  width = 96,
  height = 26,
  paddingX = 2,
  paddingY = 4,
): { path: string; area: string } {
  if (values.length === 0) {
    const y = height / 2;
    return {
      path: `M ${paddingX},${y} L ${width - paddingX},${y}`,
      area: `M ${paddingX},${y} L ${width - paddingX},${y} L ${width - paddingX},${height} L ${paddingX},${height} Z`,
    };
  }

  if (values.length === 1) {
    const y = height / 2;
    return {
      path: `M ${paddingX},${y} L ${width - paddingX},${y}`,
      area: `M ${paddingX},${y} L ${width - paddingX},${y} L ${width - paddingX},${height} L ${paddingX},${height} Z`,
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const usableW = width - paddingX * 2;
  const usableH = height - paddingY * 2;

  const coords = values.map((val, idx) => {
    const x = paddingX + (idx / (values.length - 1)) * usableW;
    const y =
      range === 0
        ? height / 2
        : paddingY + usableH - ((val - min) / range) * usableH;
    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
    };
  });

  // Constrói uma curva suave Bézier quadrática através dos pontos
  let path = `M ${coords[0]!.x},${coords[0]!.y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const current = coords[i]!;
    const next = coords[i + 1]!;
    const midX = Number(((current.x + next.x) / 2).toFixed(1));
    const midY = Number(((current.y + next.y) / 2).toFixed(1));
    path += ` Q ${current.x},${current.y} ${midX},${midY}`;
  }
  const last = coords[coords.length - 1]!;
  path += ` T ${last.x},${last.y}`;

  const area = `${path} L ${last.x},${height} L ${coords[0]!.x},${height} Z`;

  return { path, area };
}

export function formatTrendPercent(percentage: number | null): string {
  if (percentage === null || !Number.isFinite(percentage)) {
    return "—";
  }
  if (Math.abs(percentage) < 0.05) {
    return "0,0%";
  }
  const sign = percentage < 0 ? "-" : "+";
  const formatted = Math.abs(percentage).toFixed(1).replace(".", ",");
  return `${sign}${formatted}%`;
}

export function calculateTrend(
  points: CollectionPoint[],
  metric: DashboardMetric,
  period: Period = "24h",
  fallbackValue?: number | null,
): ServiceTrend {
  const periodLabel = period === "7d" ? "(últimos 7 d)" : "(últimas 24 h)";

  // Filtra e ordena pontos com valor numérico válido para a métrica escolhida
  const validPoints = points
    .filter((point) => {
      const val = metric === "energy" ? point.energyKwh : point.emissionsG;
      return val !== null && Number.isFinite(val) && Number.isFinite(Date.parse(point.collectedAt));
    })
    .sort((a, b) => Date.parse(a.collectedAt) - Date.parse(b.collectedAt));

  const values = validPoints.map((p) =>
    metric === "energy" ? p.energyKwh : p.emissionsG!,
  );

  // Se houver valor fallback e nenhum ponto no histórico
  if (values.length === 0 && fallbackValue !== null && fallbackValue !== undefined && Number.isFinite(fallbackValue)) {
    values.push(fallbackValue);
  }

  if (values.length < 2) {
    const { path, area } = generateSparklinePaths(values);
    return {
      percentage: null,
      formattedPercentage: "Estável",
      direction: "neutral",
      arrow: "→",
      color: "var(--monitoring-muted, #526b78)",
      strokeColor: "#8fa3b0",
      periodLabel,
      sparklinePath: path,
      sparklineArea: area,
      hasEnoughData: false,
    };
  }

  // Com 2 ou mais pontos, calculamos a tendência comparando o início com o final da janela
  const N = values.length;
  // Se houver muitos pontos, suavizamos usando a média das amostras da borda (até 15% ou máx 3 pontos)
  const windowSize = Math.max(1, Math.min(3, Math.floor(N * 0.15)));

  const baselineSlice = values.slice(0, windowSize);
  const latestSlice = values.slice(N - windowSize);

  const baseline = baselineSlice.reduce((sum, v) => sum + v, 0) / baselineSlice.length;
  const latest = latestSlice.reduce((sum, v) => sum + v, 0) / latestSlice.length;

  let percentage: number;
  if (baseline === 0) {
    percentage = latest === 0 ? 0 : 100;
  } else {
    percentage = ((latest - baseline) / baseline) * 100;
  }

  let direction: TrendDirection = "neutral";
  let arrow = "→";
  let color = "var(--monitoring-muted, #526b78)";
  let strokeColor = "#8fa3b0";

  if (percentage < -0.05) {
    direction = "down";
    arrow = "↓";
    color = "#009955";
    strokeColor = "#00b96b";
  } else if (percentage > 0.05) {
    direction = "up";
    arrow = "↑";
    color = "#d9383a";
    strokeColor = "#f43e48";
  }

  const formattedPercentage = formatTrendPercent(percentage);
  const { path, area } = generateSparklinePaths(values);

  return {
    percentage,
    formattedPercentage,
    direction,
    arrow,
    color,
    strokeColor,
    periodLabel,
    sparklinePath: path,
    sparklineArea: area,
    hasEnoughData: true,
  };
}
