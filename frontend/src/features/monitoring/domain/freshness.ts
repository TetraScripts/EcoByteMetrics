export const STALE_METRICS_MESSAGE =
  "A última amostra está desatualizada. A disponibilidade atual do serviço não foi confirmada.";

export function isCollectionStale(
  collectedAt: string,
  intervalSeconds: number,
  now = Date.now(),
) {
  // Tolera três intervalos de coleta, com mínimo de três atualizações de 30 s.
  const staleAfter = Math.max(90_000, intervalSeconds * 3_000);
  return now - Date.parse(collectedAt) > staleAfter;
}
