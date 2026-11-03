import { test } from "node:test";
import assert from "node:assert/strict";
import { evolutionChartData } from "../src/features/monitoring/domain/chartData.ts";
import { evolutionData } from "../src/features/monitoring/domain/evolution.ts";

test("Recharts recebe uma interrupção explícita entre períodos sem amostras", () => {
  const source = [{ timestamp: 0, value: 1, gap: true }, { timestamp: 30_000, value: 2, gap: false }, { timestamp: 120_000, value: 3, gap: true }];
  const result = evolutionChartData(source, 30_000);
  assert.deepEqual(result.map(({ timestamp, value, missing }) => ({ timestamp, value, missing })), [
    { timestamp: 0, value: 1, missing: undefined }, { timestamp: 30_000, value: 2, missing: undefined },
    { timestamp: 75_000, value: null, missing: true }, { timestamp: 120_000, value: 3, missing: undefined },
  ]);
  assert.equal(result[2]!.from, 30_000);
  assert.equal(result[2]!.to, 120_000);
  assert.match(result[2]!.reason!, /Não há amostras registradas neste período/);
  assert.match(result[2]!.reason!, /pode acontecer.*programa responsável pelas coletas/);
  assert.match(result[2]!.reason!, /Fechar apenas a página não interrompe as coletas/);
  assert.equal(source.length, 3);
});

test("lacunas incluem somente o contexto observado dentro do trecho", () => {
  const at = (second: number) => new Date(second * 1000).toISOString();
  const source = [{ timestamp: 0, value: 1, gap: true }, { timestamp: 120_000, value: 2, gap: true }];
  const events = [
    { from: at(30), to: at(90), kind: "tab-hidden" as const },
    { from: at(150), to: at(160), kind: "request-failed" as const },
  ];
  assert.deepEqual(evolutionChartData(source, 30_000, events)[1]!.events, [events[0]]);
});

test("o adaptador não recria a lacuna falsa removida pelo agrupamento", () => {
  assert.equal(evolutionChartData([{ timestamp: 29_800, value: 1, gap: true }, { timestamp: 60_100, value: 2, gap: false }], 30_000).filter(point => point.missing).length, 0);
});

test("uma coleta sem estimativa preserva a explicação e não esconde uma lacuna temporal seguinte", () => {
  const data = evolutionChartData([{ timestamp: 0, value: null, gap: true, reason: "Fator ausente" }, { timestamp: 120_000, value: null, gap: true, reason: "Fator ausente" }], 30_000);
  assert.equal(data.length, 3);
  assert.equal(data[0]!.reason, "Fator ausente");
  assert.equal(data[1]!.missing, true);
});

test("a adaptação preserva zero e valores incompletos sem duplicar lacunas", () => {
  assert.deepEqual(evolutionChartData([{ timestamp: 0, value: 0, gap: true }, { timestamp: 30_000, value: null, gap: true }, { timestamp: 60_000, value: 2, gap: true }], 30_000), [{ timestamp: 0, value: 0 }, { timestamp: 30_000, value: null }, { timestamp: 60_000, value: 2 }]);
  assert.deepEqual(evolutionChartData([], 30_000), []);
});

test("pontos únicos e intervalos consecutivos não ganham valores artificiais", () => {
  const source = [{ timestamp: 1000, value: 0.00001, gap: true }, { timestamp: 31_000, value: 0.00002, gap: false }];
  assert.equal(evolutionChartData(source, 30_000).length, 2);
  assert.deepEqual(evolutionChartData(source.slice(0, 1), 30_000), [{ timestamp: 1000, value: 0.00001 }]);
});

test("falha parcial acompanha o intervalo correto nos dois modos, sem alterar somas nem contaminar intervalos seguintes", () => {
  const at = (second: number) => new Date(second * 1000).toISOString();
  const history = [["a",0],["b",0],["a",30],["a",60],["b",60]].map(([id,second]) => ({serviceId:String(id),collectedAt:at(Number(second)),energyKwh:.001,emissionsG:.1}));
  const event = {from:at(30),to:at(60),kind:"service-unavailable" as const,serviceIds:["b"]};
  for (const mode of ["intervals","cumulative"] as const) {
    const data = evolutionData(history,"emissions",mode);
    const result = evolutionChartData(data.points,data.intervalMs,[event]);
    assert.deepEqual(result.map(point => point.value), data.points.map(point => point.value));
    assert.deepEqual(result.map(point => point.events?.length ?? 0),[0,1,0]);
    assert.equal(result[1]!.events![0],event);
    assert.equal(result.filter(point => point.missing).length,0);
  }
});

test("diagnóstico permanece acessível quando nenhuma aplicação conseguiu enviar uma leitura", () => {
  const event = {from:"2026-10-31T12:00:00Z",to:"2026-10-31T12:00:00Z",kind:"metrics-missing" as const,serviceIds:["a"]};
  const result = evolutionChartData([],30_000,[event]);
  assert.equal(result.length,1);
  assert.equal(result[0]!.value,null);
  assert.deepEqual(result[0]!.events,[event]);
});

test("falha no fim de um bloco agregado permanece nesse bloco, sem repetir no acumulado seguinte", () => {
  const at = (second: number) => new Date(second*1000).toISOString();
  const history = [0,270,300].map(second => ({serviceId:"a",collectedAt:at(second),energyKwh:.001,emissionsG:.1,bucketSeconds:300}));
  const event = {from:at(290),to:at(320),kind:"metrics-missing" as const,serviceIds:["b"]};
  for (const mode of ["intervals","cumulative"] as const) {
    const data=evolutionData(history,"emissions",mode);
    const chart=evolutionChartData(data.points,data.intervalMs,[event]);
    assert.deepEqual(chart.map(point => point.events?.length??0),[1,0]);
    assert.equal(chart[0]!.value, .2);
  }
});
