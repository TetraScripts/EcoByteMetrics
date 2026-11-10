import type { EvolutionChartPoint } from "./chartData.ts";

export function evolutionValueTicks(maximum: number) {
  if (!(maximum > 0) || !Number.isFinite(maximum)) return [0, .25, .5, .75, 1];
  const target = maximum / 3;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 2.5, 5, 10].find(value => value * magnitude >= target)! * magnitude;
  const count = Math.ceil(maximum / step);
  return Array.from({length: count + 1}, (_, index) => Number((index * step).toPrecision(12)));
}

export function evolutionTimeTicks(first: number, last: number) {
  if (first >= last) return [first];
  const target = (last - first) / 4;
  const step = [30_000, 60_000, 300_000, 900_000, 1800_000, 3600_000, 10800_000, 21600_000, 43200_000, 86400_000]
    .find(value => value >= target) ?? Math.ceil(target / 86400_000) * 86400_000;
  const ticks = [first];
  for (let time = Math.ceil(first / step) * step; time < last; time += step) {
    if (time - first >= step / 2 && last - time >= step / 2) ticks.push(time);
  }
  return [...ticks, last];
}

export function evolutionGapRanges(data: EvolutionChartPoint[], intervalMs: number) {
  return data.filter(point => point.missing && point.from !== undefined && point.to !== undefined)
    .map(point => ({from: point.from! + intervalMs / 2, to: point.to! - intervalMs / 2}))
    .filter(gap => gap.to > gap.from);
}
