import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateTrend,
  formatTrendPercent,
  generateSparklinePaths,
} from "../src/features/monitoring/domain/trend.ts";
import type { CollectionPoint } from "../src/features/monitoring/types.ts";

const sample = (
  serviceId: string,
  minute: number,
  emissionsG: number | null,
  energyKwh = 0.001,
): CollectionPoint => ({
  serviceId,
  collectedAt: new Date(Date.UTC(2026, 9, 21, 12, minute, 0)).toISOString(),
  energyKwh,
  emissionsG,
  intervalSeconds: 60,
});

test("formatTrendPercent formata percentuais com vírgula e sinal em pt-BR", () => {
  assert.equal(formatTrendPercent(-5.234), "-5,2%");
  assert.equal(formatTrendPercent(10.567), "+10,6%");
  assert.equal(formatTrendPercent(0.02), "0,0%");
  assert.equal(formatTrendPercent(-0.01), "0,0%");
  assert.equal(formatTrendPercent(null), "—");
  assert.equal(formatTrendPercent(NaN), "—");
});

test("calculateTrend identifica redução de emissões (tendência de queda, seta ↓ e cor verde)", () => {
  // Amostras com queda de 100g para 50g (-50%)
  const points = [
    sample("app-1", 0, 100, 0.05),
    sample("app-1", 10, 80, 0.04),
    sample("app-1", 20, 50, 0.025),
  ];

  const trend = calculateTrend(points, "emissions", "24h");
  assert.equal(trend.direction, "down");
  assert.equal(trend.arrow, "↓");
  assert.equal(trend.strokeColor, "#00b96b");
  assert.equal(trend.hasEnoughData, true);
  assert.ok(trend.percentage !== null && trend.percentage < 0);
  assert.match(trend.formattedPercentage, /^-50,0%/);
  assert.equal(trend.periodLabel, "(últimas 24 h)");
  assert.ok(trend.sparklinePath.startsWith("M 2,"));
  assert.ok(trend.sparklineArea.includes("Z"));
});

test("calculateTrend identifica aumento de emissões (tendência de alta, seta ↑ e cor vermelha)", () => {
  // Amostras com aumento de 20g para 30g (+50%)
  const points = [
    sample("app-1", 0, 20, 0.01),
    sample("app-1", 10, 25, 0.012),
    sample("app-1", 20, 30, 0.015),
  ];

  const trend = calculateTrend(points, "emissions", "7d");
  assert.equal(trend.direction, "up");
  assert.equal(trend.arrow, "↑");
  assert.equal(trend.strokeColor, "#f43e48");
  assert.equal(trend.hasEnoughData, true);
  assert.ok(trend.percentage !== null && trend.percentage > 0);
  assert.match(trend.formattedPercentage, /^\+50,0%/);
  assert.equal(trend.periodLabel, "(últimos 7 d)");
});

test("calculateTrend identifica estabilidade quando os valores não variam", () => {
  const points = [
    sample("app-1", 0, 10, 0.01),
    sample("app-1", 10, 10, 0.01),
  ];

  const trend = calculateTrend(points, "emissions", "24h");
  assert.equal(trend.direction, "neutral");
  assert.equal(trend.arrow, "→");
  assert.equal(trend.formattedPercentage, "0,0%");
  assert.equal(trend.percentage, 0);
});

test("calculateTrend trata dados insuficientes com fallback seguro", () => {
  // Sem pontos
  const emptyTrend = calculateTrend([], "emissions", "24h", null);
  assert.equal(emptyTrend.hasEnoughData, false);
  assert.equal(emptyTrend.direction, "neutral");
  assert.equal(emptyTrend.formattedPercentage, "Estável");
  assert.equal(emptyTrend.arrow, "→");

  // Apenas 1 ponto
  const singleTrend = calculateTrend([sample("app-1", 0, 15, 0.01)], "emissions", "24h");
  assert.equal(singleTrend.hasEnoughData, false);
  assert.equal(singleTrend.direction, "neutral");
  assert.equal(singleTrend.formattedPercentage, "Estável");
});

test("calculateTrend alterna corretamente entre métrica de energia e emissão", () => {
  // Energia cai pela metade (0.04 -> 0.02), mas emissão sobe por variação no fator (10 -> 20)
  const points = [
    sample("app-1", 0, 10, 0.04),
    sample("app-1", 10, 20, 0.02),
  ];

  const energyTrend = calculateTrend(points, "energy", "24h");
  assert.equal(energyTrend.direction, "down");
  assert.ok(energyTrend.percentage! < 0);

  const emissionsTrend = calculateTrend(points, "emissions", "24h");
  assert.equal(emissionsTrend.direction, "up");
  assert.ok(emissionsTrend.percentage! > 0);
});

test("generateSparklinePaths cria curvas SVG válidas e áreas fechadas", () => {
  const { path: emptyPath, area: emptyArea } = generateSparklinePaths([]);
  assert.ok(emptyPath.startsWith("M 2,13"));
  assert.ok(emptyArea.endsWith("Z"));

  const { path: singlePath } = generateSparklinePaths([42]);
  assert.ok(singlePath.startsWith("M 2,13"));

  const { path, area } = generateSparklinePaths([10, 5, 20, 15, 8]);
  assert.ok(path.startsWith("M 2,"));
  assert.ok(path.includes("Q"));
  assert.ok(path.includes("T 94,"));
  assert.ok(area.includes("L 94,26 L 2,26 Z"));
});
