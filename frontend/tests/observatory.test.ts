import { test } from "node:test";
import assert from "node:assert/strict";
import { appendObservation, impactLocations, observationHistory } from "../src/features/monitoring/domain/observatory.ts";
import { applicationImpacts } from "../src/features/monitoring/domain/dashboard.ts";
import type { CollectionPoint, MonitoredService, MonitoringObservation } from "../src/features/monitoring/types.ts";

const at = (second: number) => new Date(Date.UTC(2026, 9, 22, 12, 0, second)).toISOString();
const service = (id: string, extra: Partial<MonitoredService> = {}): MonitoredService => ({
  id, name: id, status: "available", country: "Brazil", city: "São Paulo", region: "Sudeste", latitude: -23.55, longitude: -46.63,
  cpuPercent: null, memoryGb: null, diskGb: null, networkGb: null, energyKwh: null, emissionsG: null, ...extra,
});
const sample = (serviceId: string, second: number, emissionsG: number | null, energyKwh = 0.001): CollectionPoint => ({
  serviceId, collectedAt: at(second), emissionsG, energyKwh, intervalSeconds: 30,
});

test("observações preservam o estado e os valores vistos antes das próximas consultas", () => {
  const services = [service("a")], samples = [sample("a", 0, 1)];
  const first = appendObservation([], at(1), services, samples);
  services[0]!.status = "unavailable";
  samples[0]!.emissionsG = 5;
  assert.equal(first[0]!.services[0]!.status, "available");
  assert.equal(first[0]!.samples[0]!.emissionsG, 1);
  const second = appendObservation(first, at(31), services, samples);
  assert.equal(second[0]!.services[0]!.status, "available");
  assert.equal(second[1]!.services[0]!.status, "unavailable");
});

test("a retenção é limitada e a mesma observação não é duplicada", () => {
  const previous: MonitoringObservation[] = Array.from({ length: 3000 }, (_, index) => ({ observedAt: at(index), services: [], samples: [] }));
  const next = appendObservation(previous, at(3000), [], []);
  assert.equal(next.length, 3000);
  assert.equal(next[0]!.observedAt, at(1));
  assert.equal(appendObservation(next, at(3000), [service("a")], []).length, 3000);
});

test("a revisão do passado não incorpora amostras nem fatores recuperados no futuro", () => {
  const observations = appendObservation([], at(1), [service("a")], [sample("a", 0, null)]);
  const updated = appendObservation(observations, at(31), [service("a")], [sample("a", 0, 2), sample("a", 30, 3)]);
  const past = observationHistory(updated, at(1));
  assert.equal(past.length, 1);
  assert.equal(past[0]!.emissionsG, null);
  assert.deepEqual(observationHistory(updated, at(31)).map(point => point.emissionsG), [2, 3]);
});

test("a lente soma serviços do mesmo local e dimensiona pelo impacto agregado", () => {
  const services = [service("a"), service("b"), service("c", { latitude: 40, longitude: -74 })];
  const groups = impactLocations(services, [sample("a", 0, 2), sample("b", 0, 3), sample("c", 0, 1)], "emissions");
  assert.equal(groups.length, 2);
  assert.equal(groups[0]!.value, 5);
  assert.ok(groups[0]!.size > groups[1]!.size);
  assert.equal(groups[0]!.count, 2);
});

test("zero e estimativa incompleta são distinguíveis na lente", () => {
  const groups = impactLocations([service("zero"), service("missing", { latitude: 40, longitude: -74 })], [sample("zero", 0, 0), sample("missing", 0, null)], "emissions");
  assert.equal(groups[0]!.value, 0);
  assert.equal(groups[0]!.missingImpact, false);
  assert.equal(groups[1]!.value, null);
  assert.equal(groups[1]!.missingImpact, true);
  assert.equal(groups[1]!.color, groups[0]!.color);
});

test("uma amostra incompleta impede que o grupo aparente ter impacto baixo", () => {
  const history = [sample("a", 0, 2), sample("b", 0, null)];
  const services = [service("a"), service("b")];
  assert.equal(impactLocations(services, history, "emissions")[0]!.missingImpact, true);
  assert.equal(impactLocations(services, history, "energy")[0]!.value, 0.002);
  assert.equal(impactLocations(services, history, "status")[0]!.size, 27);
});

test("somas conhecidas da tabela não geram participações ou tamanhos completos quando faltam fatores", () => {
  const services=[service("a"),service("b")];
  const history=[sample("a",0,2),sample("a",30,null),sample("b",0,1)];
  assert.equal(applicationImpacts(services,history,"emissions")[0]!.value,2);
  assert.equal(impactLocations(services,history,"emissions")[0]!.missingImpact,true);
});

test("a lente de estado preserva os pontos sem depender das estimativas", () => {
  const services = [service("a"), service("b", { status: "unavailable" }), service("c", { latitude: 40, longitude: -74 })];
  const without = impactLocations(services, [], "status");
  const withHistory = impactLocations(services, [sample("a", 0, 200), sample("b", 30, null)], "status");
  assert.deepEqual(withHistory, without);
  assert.equal(without[0]!.color, "#f43e48");
  assert.equal(without[0]!.count, 2);
  assert.equal(without[0]!.size, 27);
  assert.equal(without[1]!.size, 17);
  assert.equal(without[0]!.missingImpact, false);
});
