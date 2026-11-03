import { test } from "node:test";
import assert from "node:assert/strict";
import { evolutionData, nearestEvolutionPoint } from "../src/features/monitoring/domain/evolution.ts";
import type { CollectionPoint } from "../src/features/monitoring/types.ts";
const at = (second: number) => Date.UTC(2026, 9, 23, 12, 0, second);
const sample = (id: string, second: number, emissionsG: number | null = 1): CollectionPoint => ({ serviceId: id, collectedAt: new Date(at(second)).toISOString(), energyKwh: .001, emissionsG, intervalSeconds: 30 });

test("a evolução agrupa aplicações do mesmo intervalo sem duplicar amostras de cache", () => {
  const a = sample("a", 1), b = sample("b", 2, 3);
  const result = evolutionData([a, a, b, sample("a", 31, 2)], "emissions", "intervals");
  assert.deepEqual(result.points.map(point => point.value), [4, 2]);
  assert.equal(result.summary.count, 3);
  assert.equal(result.summary.energyKwh, .003);
  assert.equal(result.serviceCount, 2);
  assert.equal(result.first, at(1));
  assert.equal(result.last, at(31));
});

test("zero válido, intervalos vazios e fatores ausentes permanecem distinguíveis", () => {
  const result = evolutionData([sample("a", 1, 0), sample("a", 31, null), sample("a", 120, 2)], "emissions", "intervals");
  assert.deepEqual(result.points.map(point => point.value), [0, null, 2]);
  assert.equal(result.points[2]!.gap, true);
  assert.equal(result.summary.emissionCount, 2);
  assert.equal(result.summary.count, 3);
});

test("intervalos e acumulado somam emissões conhecidas e explicam a cobertura incompleta", () => {
  const history = [sample("a", 1, 2), sample("b", 2, null), sample("a", 31, 3)];
  assert.deepEqual(evolutionData(history, "emissions", "intervals").points.map(point => point.value), [2, 3]);
  assert.deepEqual(evolutionData(history, "emissions", "cumulative").points.map(point => point.value), [2, 5]);
  assert.match(evolutionData(history, "emissions", "cumulative").points[1]!.reason!, /2 de 3 amostras/);
  assert.deepEqual(evolutionData(history, "energy", "cumulative").points.map(point => point.value), [.002, .003]);
});

test("períodos longos usam intervalos maiores sem inventar coletas", () => {
  const daily = evolutionData([sample("a", 0), sample("a", 7200)], "energy", "intervals");
  assert.equal(daily.intervalMs, 300_000);
  assert.equal(daily.points.length, 2);
  assert.equal(daily.points[1]!.gap, true);
  assert.equal(evolutionData([sample("a", 0), sample("a", 172800)], "energy", "intervals").intervalMs, 3600_000);
});

test("seleção do gráfico encontra o ponto mais próximo e respeita os limites", () => {
  const { points } = evolutionData([sample("a", 0), sample("a", 30), sample("a", 60)], "energy", "intervals");
  assert.equal(nearestEvolutionPoint(points, at(-10)), 0);
  assert.equal(nearestEvolutionPoint(points, at(34)), 1);
  assert.equal(nearestEvolutionPoint(points, at(999)), 2);
});

test("período sem amostras não gera totais, datas nem pontos fictícios", () => {
  const result = evolutionData([], "energy", "cumulative");
  assert.equal(result.summary.energyKwh, null);
  assert.equal(result.summary.emissionsG, null);
  assert.equal(result.first, null);
  assert.equal(result.last, null);
  assert.equal(result.points.length, 0);
  assert.equal(result.serviceCount, 0);
});

test("variação de milissegundos na virada de 30 segundos não cria lacuna falsa", () => {
  const first = { ...sample("a", 0), collectedAt: new Date(at(0) + 29_800).toISOString() };
  const second = { ...sample("a", 0), collectedAt: new Date(at(0) + 60_100).toISOString() };
  const data = evolutionData([second, first], "energy", "cumulative");
  assert.equal(data.points.length, 2);
  assert.equal(data.points[1]!.gap, false);
  assert.deepEqual(data.points.map(point => point.timestamp), [at(0) + 29_800, at(0) + 60_100]);
  assert.deepEqual(data.points.map(point => point.value), [.001, .002]);
});

test("ausência de uma rodada completa cria lacuna sem interpolar valores", () => {
  const data = evolutionData([sample("a", 0), sample("a", 60)], "energy", "intervals");
  assert.equal(data.points[1]!.gap, true);
  assert.equal(data.points.length, 2);
});

test("uma emissão antiga ausente não impede que o acumulado mostre as coletas seguintes", () => {
  const data = evolutionData([sample("a", 0, null), sample("a", 30, 1)], "emissions", "cumulative");
  assert.match(data.points[0]!.reason!, /Há amostras/);
  assert.equal(data.points[0]!.value, null);
  assert.equal(data.points[1]!.value, 1);
  assert.match(data.points[1]!.reason!, /1 de 2 amostras/);
  assert.equal(data.points[1]!.gap, false);
});

test("acumulado sem nenhuma emissão calculável permanece desconhecido; zero recebido é válido", () => {
  assert.deepEqual(evolutionData([sample("a",0,null),sample("a",30,null)],"emissions","cumulative").points.map(point=>point.value),[null,null]);
  const data=evolutionData([sample("a",0,0),sample("a",30,null)],"emissions","cumulative");
  assert.deepEqual(data.points.map(point=>point.value),[0,0]);
  assert.match(data.points[1]!.reason!,/1 de 2 amostras/);
});
