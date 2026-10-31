import { RequestError } from "@/shared/lib/http";

export async function getMonitoringSettings(request: (path: string, options: {signal: AbortSignal}) => Promise<unknown>, signal: AbortSignal) {
  const data = await request("/api/monitoring-settings", {signal});
  if (!data || typeof data !== "object" || !("collectionIntervalSeconds" in data) ||
    typeof data.collectionIntervalSeconds !== "number" || !Number.isSafeInteger(data.collectionIntervalSeconds) || data.collectionIntervalSeconds <= 0 ||
    !("discovery" in data) || data.discovery !== "automatic" || !("editable" in data) || data.editable !== false)
    throw new RequestError("format", "A configuração recebida é inválida.");
  return {collectionIntervalSeconds: data.collectionIntervalSeconds};
}
