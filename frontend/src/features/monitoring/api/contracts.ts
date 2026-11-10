export const object = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};

export const number = (value: unknown, max = Infinity): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max
    ? value : null;

export const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";

export function parseDiscovery(value: unknown): { services: unknown[]; lastUpdatedAt: string } {
  const data = object(value);
  if (!Array.isArray(data.services))
    throw new Error("Resposta inválida do backend: esperados services e lastUpdatedAt.");
  if (data.lastUpdatedAt === null)
    throw new Error("O backend ainda não concluiu a descoberta de serviços. Aguarde a atualização automática.");
  if (typeof data.lastUpdatedAt !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(data.lastUpdatedAt) || !Number.isFinite(Date.parse(data.lastUpdatedAt)))
    throw new Error("Data de descoberta inválida no backend.");
  return { services: data.services, lastUpdatedAt: data.lastUpdatedAt };
}
