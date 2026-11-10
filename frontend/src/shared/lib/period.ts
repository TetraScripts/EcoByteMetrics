export type Period = "24h" | "7d";

export function isPeriod(value: unknown): value is Period {
  return value === "24h" || value === "7d";
}
