import { test } from "node:test";
import assert from "node:assert/strict";
import { compareApplications } from "../src/features/monitoring/domain/comparison.ts";
import type { CollectionPoint, MonitoredService } from "../src/features/monitoring/types.ts";
const at = (second: number) => Date.UTC(2026, 9, 23, 12, 0, second);
const service = (id: string): MonitoredService => ({ id, name: id, status: "available", country: null, region: null, city: null, cpuPercent: null, memoryGb: null, diskGb: null, networkGb: null, energyKwh: null, emissionsG: null });
const sample = (serviceId: string, second: number, emissionsG: number | null): CollectionPoint => ({ serviceId, collectedAt: new Date(at(second)).toISOString(), energyKwh: 0.001, emissionsG, intervalSeconds: 30 });

test("comparação usa o mesmo intervalo e expõe cobertura diferente sem duplicar cache ou seleção", () => {
  const first = sample("a", 0, 1);
  const rows = compareApplications([service("a"), service("b"), service("c")], [first, first, sample("a", 30, 2), sample("b", 30, null), sample("a", 90, 5)], ["a", "a", "b"], at(-1), at(60));
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.count, 2);
  assert.equal(rows[0]!.energyKwh, 0.002);
  assert.equal(rows[0]!.emissionsG, 3);
  assert.equal(rows[1]!.count, 1);
  assert.equal(rows[1]!.emissionsG, null);
  assert.equal(rows[1]!.seconds, 30);
});

test("comparação distingue zero, ausência de coleta e emissões incompletas", () => {
  const rows = compareApplications([service("a"), service("b"), service("c")], [sample("a", 0, 0), sample("b", 0, 2), sample("b", 30, null)], ["a", "b", "c"], at(-1), at(60));
  assert.equal(rows[0]!.emissionsG, 0);
  assert.equal(rows[1]!.emissionsG, 2);
  assert.equal(rows[1]!.emissionCount, 1);
  assert.equal(rows[2]!.energyKwh, null);
  assert.equal(rows[2]!.first, null);
  assert.equal(compareApplications([service("a")], [sample("a", 0, 2)], ["a"], null, null)[0]!.count, 0);
});


test("recursos históricos usam duração e filtros, sem duplicar leituras nem usar recursos atuais", () => {
  const resourcePoint = (second: number, cpu: number, seconds: number): CollectionPoint => ({
    ...sample("a", second, null), intervalSeconds: seconds,
    resources: {cpuPercent: cpu, memoryGb: cpu / 10, diskGb: cpu, networkGb: cpu / 20, durationSeconds: seconds},
  });
  const first = resourcePoint(0, 0, 30), second = resourcePoint(30, 80, 90);
  const history = [resourcePoint(-30, 100, 600), first, first, second, resourcePoint(90, 100, 600)];
  const a = {...service("a"), cpuPercent: 99, memoryGb: 99, diskGb: 99, networkGb: 99};
  const b = {...service("b"), cpuPercent: 99};
  const rows = compareApplications([a,b], [...history, sample("b", 30, 0)], ["a","b"], at(-1), at(60));
  assert.deepEqual(rows[0]!.resources, {cpuPercent: 60, memoryGb: 6, diskGb: 60, networkGb: 3, durationSeconds: 120});
  assert.equal(rows[1]!.resources, null, "Última CPU não substitui o histórico ausente");
  const zero = compareApplications([a], [first], ["a"], at(-1), at(60))[0]!;
  assert.equal(zero.resources!.cpuPercent, 0);
});

test("agrupar leituras em blocos não muda a média ponderada dos recursos", () => {
  const point = (second: number, cpuPercent: number, durationSeconds: number): CollectionPoint => ({...sample("a",second,1),
    intervalSeconds: durationSeconds, resources: {cpuPercent,memoryGb:0,diskGb:0,networkGb:0,durationSeconds}});
  const original = [point(0,0,30),point(30,80,90),point(60,20,60)];
  const grouped = [point(30,60,120),point(60,20,60)];
  const compare = (history: CollectionPoint[]) => compareApplications([service("a")],history,["a"],at(-1),at(90))[0]!.resources;
  assert.deepEqual(compare(original),compare(grouped));
  assert.equal(compare(original)!.cpuPercent, 140 / 3);
});
