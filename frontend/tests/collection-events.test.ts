import { test } from "node:test";
import assert from "node:assert/strict";
import { appendCollectionEvents, createCollectionPauseTracker, responseCollectionEvents } from "../src/features/monitoring/domain/collectionEvents.ts";
import type { MonitoredService, MonitoringSnapshot } from "../src/features/monitoring/types.ts";

const at = (seconds: number) => new Date(seconds * 1000).toISOString();
const service = (id: string, seconds: number, status: MonitoredService["status"] = "available"): MonitoredService => ({
  id, name: id, status, country: null, region: null, city: null, cpuPercent: 1, memoryGb: 1, diskGb: 1, networkGb: 1,
  energyKwh: .001, emissionsG: 1, lastCollectionAt: at(seconds),
});
const snapshot = (services: MonitoredService[]): MonitoringSnapshot => ({ services, regions: [], history: [], totalEnergyKwh: null, totalEmissionsG: null, lastCollectionAt: null });

test("pausas registram seus limites reais, sem duplicar eventos nem atribuir falhas ao coletor", () => {
  const track = createCollectionPauseTracker();
  assert.deepEqual(track(null, at(0)), []);
  assert.deepEqual(track("tab-hidden", at(10)), []);
  assert.deepEqual(track("tab-hidden", at(40)), []);
  assert.deepEqual(track("monitoring-inactive", at(60)), [{ kind: "tab-hidden", from: at(10), to: at(60) }]);
  assert.deepEqual(track(null, at(90)), [{ kind: "monitoring-inactive", from: at(60), to: at(90) }]);
  assert.deepEqual(track(null, at(100)), []);
});

test("respostas repetidas e serviços sem métricas mantêm aplicação e horário da consulta", () => {
  const previous = snapshot([service("a", 30), service("b", 30), service("c", 30)]);
  const incoming = snapshot([service("a", 30), service("b", 60), service("c", 0, "unavailable"), service("d", 0, "removed")]);
  assert.deepEqual(responseCollectionEvents(previous, incoming, at(60), at(61)), [
    { kind: "no-new-samples", from: at(60), to: at(61), serviceIds: ["a"] },
    { kind: "service-unavailable", from: at(60), to: at(61), serviceIds: ["c"] },
  ]);
  assert.deepEqual(responseCollectionEvents(snapshot([]), snapshot([service("a", 0)]), at(0), at(1)), []);
});

test("o registro da sessão tem retenção limitada e não modifica registros anteriores", () => {
  const event = { kind: "request-failed" as const, from: at(0), to: at(1) };
  const previous = [event];
  const events = appendCollectionEvents(previous, Array.from({ length: 3001 }, () => ({ ...event, from: at(30) })));
  assert.equal(events.length, 3000);
  assert.equal(previous.length, 1);
  assert.equal(events[0]!.from, at(30));
});
