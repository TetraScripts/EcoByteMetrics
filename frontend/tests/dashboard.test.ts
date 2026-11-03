import { test } from "node:test";
import assert from "node:assert/strict";
import { applicationImpacts, filterApplications, groupServiceLocations, serviceLocationPeers } from "../src/features/monitoring/domain/dashboard.ts";
import { latestCollections, mergeCollectionHistory } from "../src/features/monitoring/domain/history.ts";
import { evolutionData } from "../src/features/monitoring/domain/evolution.ts";
import type { CollectionPoint, MonitoredService } from "../src/features/monitoring/types.ts";

const service = (id: string, extra: Partial<MonitoredService> = {}): MonitoredService => ({
  id, name: id, status: "available", country: "Brazil", city: "São Paulo", region: "Sudeste",
  cpuPercent: null, memoryGb: null, diskGb: null, networkGb: null, energyKwh: null, emissionsG: null, ...extra,
});
const sample = (serviceId: string, second: number, emissionsG: number | null, energyKwh = 0.001): CollectionPoint => ({
  serviceId, collectedAt: new Date(Date.UTC(2026, 9, 21, 12, 0, second)).toISOString(),
  energyKwh, emissionsG, intervalSeconds: 30,
});

test("visão geral usa a última leitura individual, preservando zero, ausência e removidas ao final", () => {
  const at = "2026-10-30T23:40:00Z";
  const services = [
    service("current", { energyKwh: 0.001, emissionsG: 0.3, lastCollectionAt: at }),
    service("zero", { energyKwh: 0, emissionsG: 0, lastCollectionAt: at }),
    service("unknown", { energyKwh: 0.002, emissionsG: null, lastCollectionAt: at }),
    service("removed", { status: "removed", energyKwh: 1, emissionsG: 99, lastCollectionAt: "2026-10-29T12:00:00Z" }),
    service("uncollected"),
  ];
  const latest = latestCollections(services);
  assert.equal(latest.length, 4);
  const ranked = applicationImpacts(services, latest, "emissions", true);
  assert.deepEqual(ranked.map(row => [row.service.id, row.value]), [["current",0.3],["zero",0],["uncollected",null],["unknown",null],["removed",99]]);
  assert.equal(applicationImpacts(services, latest, "energy").find(row => row.service.id === "unknown")!.value, 0.002);
  assert.equal(latest.find(row => row.serviceId === "removed")!.collectedAt, "2026-10-29T12:00:00Z");
});

test("removed applications stay last for both metrics and return to ranking when available", () => {
  const services = [service("removed", { status: "removed" }), service("active"), service("missing"), service("removed-low", { status: "removed" })];
  const history = [sample("removed", 0, 100, 100), sample("active", 0, 1, 1), sample("removed-low", 0, 2, 2)];
  for (const metric of ["emissions", "energy"] as const) {
    assert.deepEqual(applicationImpacts(services, history, metric, true).map(entry => entry.service.id), ["active", "missing", "removed", "removed-low"]);
    const restored = services.map(entry => entry.id === "removed" ? { ...entry, status: "available" as const } : entry);
    assert.equal(applicationImpacts(restored, history, metric)[0]!.service.id, "removed");
  }
});

test("opening any application preserves all peers at its location", () => {
  const locations = [
    { country: "Canada", city: "Toronto", latitude: 43.6532, longitude: -79.3832 },
    { country: "United States", city: "Ashburn", latitude: 39.0438, longitude: -77.4874 },
    { country: "Brazil", city: "Sao Paulo", latitude: -23.5505, longitude: -46.6333 },
    { country: "Ireland", city: "Dublin", latitude: 53.3498, longitude: -6.2603 },
  ];
  const services = locations.flatMap((location, i) => [service(i + "a", location), service(i + "b", location)]);
  services.push(service("removed", { ...locations[0], status: "removed" }));
  for (const selected of services.filter(entry => entry.status !== "removed")) {
    const peers = serviceLocationPeers(services, selected);
    assert.equal(peers.length, 2);
    assert.ok(peers.some(peer => peer.id === selected.id));
    assert.ok(peers.every(peer => peer.city === selected.city));
    assert.equal(groupServiceLocations(peers)[0]!.count, 2);
  }
  const unknown = service("unknown");
  assert.deepEqual(serviceLocationPeers([unknown], unknown), [unknown]);
});

test("busca ignora acentos e permite combinar localização e estado", () => {
  const services = [service("billing"), service("audit", { status: "stale", country: "Ireland", city: "Dublin" })];
  assert.deepEqual(filterApplications(services, "sao paulo", "").map(value => value.id), ["billing"]);
  assert.deepEqual(filterApplications(services, "IRELAND", "stale").map(value => value.id), ["audit"]);
  assert.equal(filterApplications(services, "IRELAND", "available").length, 0);
});

test("serviços na mesma coordenada são agrupados e exibem o estado mais urgente", () => {
  const groups = groupServiceLocations([
    service("billing", { latitude: -23.55, longitude: -46.63 }),
    service("fraud", { latitude: -23.55, longitude: -46.63, status: "unavailable" }),
    service("removed", { latitude: -23.55, longitude: -46.63, status: "removed" }),
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.count, 2);
  assert.equal(groups[0]!.color, "#f43e48");
  assert.deepEqual(groups[0]!.services.map(value => value.id), ["billing", "fraud"]);
});

test("coordenadas ausentes ou inválidas não geram pontos; a busca mantém os serviços", () => {
  const services = [
    service("missing"), service("invalid", { latitude: NaN, longitude: 0 }),
    service("outside", { latitude: 100, longitude: 0 }),
    service("origin", { latitude: 0, longitude: 0 }),
  ];
  assert.deepEqual(groupServiceLocations(services).map(value => value.services[0]!.id), ["origin"]);
  assert.equal(filterApplications(services, "", "").length, 4);
});

test("ordenação soma amostras únicas e mantém zero válido antes de valores ausentes", () => {
  const point = sample("high", 0, 2);
  const ranked = applicationImpacts([service("missing"), service("zero"), service("high")],
    [point, point, sample("high", 30, 3), sample("zero", 0, 0)], "emissions");
  assert.deepEqual(ranked.map(value => [value.service.id, value.value]), [["high", 5], ["zero", 0], ["missing", null]]);
});

test("emissões somam as amostras disponíveis mesmo quando há registros incompletos", () => {
  const points = [sample("partial", 0, 1), sample("partial", 30, null)];
  const ranked = applicationImpacts([service("partial")], points, "emissions");
  assert.equal(ranked[0]!.value, 1);
  assert.equal(ranked[0]!.summary.emissionCount, 1);
  assert.equal(applicationImpacts([service("partial")], points, "energy")[0]!.value, 0.002);
});

test("recuperar o fator completa a amostra sem duplicar energia", () => {
  const incomplete = sample("a", 0, null);
  const history = mergeCollectionHistory([incomplete], [{ ...incomplete, emissionsG: 2 }]);
  assert.equal(history.length, 1);
  assert.equal(history[0]!.emissionsG, 2);
  assert.equal(applicationImpacts([service("a")], history, "energy")[0]!.value, 0.001);
});

test("lista, soma das barras e último acumulado usam as mesmas estimativas em todas as resoluções", () => {
  for (const step of [30,7200,172800]) {
    const partial = {...sample("a",step*2,0),sampleCount:4,emissionCount:2};
    const history=[sample("a",0,null),sample("a",step,2),sample("b",step,3),partial,partial,
      sample("b",step*3,null),sample("a",step*4,5),sample("b",step*5,null)];
    for (const metric of ["energy","emissions"] as const) {
      const rows=applicationImpacts([service("a"),service("b")],history,metric);
      const expected=rows.reduce((sum,row)=>sum+(row.value??0),0);
      const intervals=evolutionData(history,metric,"intervals");
      const cumulative=evolutionData(history,metric,"cumulative");
      assert(Math.abs(intervals.points.reduce((sum,point)=>sum+(point.value??0),0)-expected)<1e-12);
      assert(Math.abs(cumulative.points.at(-1)!.value!-expected)<1e-12);
      assert.equal(intervals.summary.count,10);
      if (metric==="emissions") {
        assert.equal(intervals.summary.emissionCount,5);
        assert.match(cumulative.points.at(-1)!.reason!,/5 de 10 amostras/);
      }
    }
  }
});

test("soma conhecida preserva zero parcial, contagens agregadas e ausência sem estimativa", () => {
  const points=[{...sample("partial",0,0),sampleCount:4,emissionCount:2},sample("missing",0,null)];
  const rows=applicationImpacts([service("partial"),service("missing")],points,"emissions");
  assert.equal(rows[0]!.value,0);
  assert.equal(rows[0]!.summary.emissionCount,2);
  assert.equal(rows[1]!.value,null);
});

test("ranking histórico ordena pelo impacto, preservando removidas ao final apenas na visão geral", () => {
  const services = [service("active"), service("removed", {status: "removed"})];
  const history = [sample("active", 0, 1, 1), sample("removed", 0, 10, 10)];
  for (const metric of ["energy", "emissions"] as const) {
    assert.deepEqual(applicationImpacts(services, history, metric).map(row => row.service.id), ["removed", "active"]);
    assert.deepEqual(applicationImpacts(services, history, metric, true).map(row => row.service.id), ["active", "removed"]);
  }
});
