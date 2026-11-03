const regular = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });
const small = new Intl.NumberFormat("pt-BR", { maximumSignificantDigits: 4 });
const compact = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "—";
  return (
    Math.abs(value) > 0 && Math.abs(value) < 0.01 ? small : regular
  ).format(value);
}

export function emissionScale(grams: number | null) {
  return grams !== null && Number.isFinite(grams) && Math.abs(grams) >= 100
    ? { divisor: 1000, unit: "kg CO₂e" } : { divisor: 1, unit: "g CO₂e" };
}

export function formatEmissions(grams: number | null, divisor = emissionScale(grams).divisor) {
  if (grams === null || !Number.isFinite(grams)) return "—";
  const value = grams / divisor;
  return divisor === 1000 && Math.abs(value) >= .01 ? compact.format(value) : formatNumber(value);
}

export function formatRecordedPeriod(first: number | null, last: number | null) {
  if (first === null || last === null) return "Sem registros neste período";
  const start = new Date(first), end = new Date(last);
  const endLabel = start.toDateString() === end.toDateString() ? end.toLocaleTimeString("pt-BR") : end.toLocaleString("pt-BR");
  return `Registros de ${start.toLocaleString("pt-BR")} a ${endLabel}`;
}

export function formatDataPeriod(first: number | null, last: number | null, now = Date.now()) {
  if (first === null || last === null) return "Ainda não há registros nesta seleção";
  const start = new Date(first), end = new Date(last);
  const time = (date: Date) => date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (start.toDateString() === end.toDateString()) {
    const day = start.toDateString() === new Date(now).toDateString() ? "hoje" : start.toLocaleDateString("pt-BR");
    return `Dados de ${day}, das ${time(start)} às ${time(end)}`;
  }
  const date = (value: Date) => value.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return `Dados de ${date(start)} a ${date(end)}`;
}
