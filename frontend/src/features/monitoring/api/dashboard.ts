import type { Period } from "@/shared/lib/period";

export type DashboardRankingMetric = "kwh" | "co2e";

export interface DashboardSummary {
  totalServicos: number;
  servicosAtivos: number;
  servicosIndisponiveis: number;
  servicosSemMetricas: number;
  consumoTotalKwh: number;
  emissaoTotalCo2e: number | null;
  dataHoraUltimaAtualizacao: string | null;
}

export interface DashboardRankingEntry {
  posicao: number;
  id_servico: string;
  nome: string;
  consumoKwh: number;
  emissaoCo2e: number | null;
}

export interface DashboardRanking {
  periodo: Period;
  ordenadoPor: DashboardRankingMetric;
  ranking: DashboardRankingEntry[];
}

const BACKEND_API = (import.meta.env?.VITE_BACKEND_URL ?? "/backend").replace(
  /\/+$/,
  "",
);

async function request<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(BACKEND_API + path, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : `Backend respondeu HTTP ${response.status}.`;
    throw new Error(error);
  }
  return body as T;
}

export function getDashboardSummary(
  signal = new AbortController().signal,
): Promise<DashboardSummary> {
  return request("/api/dashboard/summary", signal);
}

export function getDashboardRanking(
  period: Period,
  orderBy: DashboardRankingMetric,
  signal = new AbortController().signal,
): Promise<DashboardRanking> {
  const params = new URLSearchParams({
    periodo: period,
    ordenarPor: orderBy,
  });
  return request(`/api/dashboard/ranking?${params}`, signal);
}
