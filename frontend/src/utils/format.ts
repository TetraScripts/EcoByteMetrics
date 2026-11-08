const regular = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const small = new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 4 });

export function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return (
    Math.abs(value) > 0 && Math.abs(value) < 0.01 ? small : regular
  ).format(value);
}
