import "dotenv/config";
import assert from "node:assert/strict";
import { after, test, type TestContext } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import pool from "../../src/db/connection";
import { persistCollection, type Collection } from "../../src/modules/Monitoring/collection.repository";
import { readMonitoring } from "../../src/modules/Monitoring/monitoring.repository";
import { StatisticRepository } from "../../src/modules/Statistics/statistics.repository";
import { migrateMonitoring } from "../../src/db/migrate";

after(() => pool.end());
async function isolated(t: TestContext, body: (client: Client) => Promise<void>) {
  assert(["127.0.0.1", "localhost", "::1"].includes(process.env.POSTGRES_HOST ?? ""));
  const client = new Client({host: process.env.POSTGRES_HOST, port: Number(process.env.POSTGRES_PORT),
    user: process.env.POSTGRES_USER, password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DATABASE, connectionTimeoutMillis: 5000});
  const schema = "history_test_" + randomUUID().replaceAll("-", "");
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query("SELECT set_config('search_path',$1,false)", [schema]);
    await client.query("SET TIME ZONE 'Pacific/Auckland'");
    t.mock.method(pool, "connect", async () => ({query: client.query.bind(client), release() {}}));
    t.mock.method(pool, "query", client.query.bind(client));
    await body(client);
  } finally {
    await client.query("ROLLBACK");
    // Only the unique schema created by this test can be removed; public tables are untouched.
    assert(/^history_test_[a-f0-9]{32}$/.test(schema));
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
}

test("migração preserva registros e interpreta timestamps legados como UTC, mesmo em outro fuso", async t => {
  await isolated(t, async client => {
    await client.query(`
      CREATE TABLE locations(id_location serial PRIMARY KEY,name_location varchar(50) UNIQUE,country_location text,region_location text,city_location text,latitude_location float8,longitude_location float8);
      CREATE TABLE services(id_service serial PRIMARY KEY,id_location int,name_service varchar(50) UNIQUE,path_metric varchar(50),active_service boolean,date_houry timestamp);
      CREATE TABLE metrics(id_metric bigserial PRIMARY KEY,id_service int,cpu_metric numeric,ram_metric numeric,hd_metric numeric,network_metric numeric,date_houry timestamp,colletion_interval_metric numeric,UNIQUE(id_service,date_houry));
      CREATE TABLE carbons(id_carbon serial PRIMARY KEY,id_location int,date_houry timestamp,intesity_co2e_kwh_carbon int,renewable_percent_carbon int,UNIQUE(id_location,date_houry));
      INSERT INTO locations VALUES(1,'br-sp','Brasil','SP','São Paulo',-23.55,-46.63);
      INSERT INTO services VALUES(1,1,'Legacy','/metrics/test-api',true,'2026-10-30 23:00:00');
      INSERT INTO metrics VALUES(1,1,10,1,2,3,'2026-10-30 23:00:00',30);
      INSERT INTO carbons VALUES(1,1,'2026-10-30 23:00:00',85,70);`);
    const migration = readFileSync(new URL("../../../database/migrations/001_persisted_monitoring.sql", import.meta.url), "utf8");
    await client.query(migration);
    await client.query(migration);
    const row = await client.query("SELECT m.date_houry,s.external_id,m.carbon_intensity FROM metrics m JOIN services s USING(id_service)");
    assert.equal(row.rowCount, 1);
    assert.equal(row.rows[0].date_houry.toISOString(), "2026-10-30T23:00:00.000Z");
    assert.equal(row.rows[0].external_id, "test-api");
    assert.equal(row.rows[0].carbon_intensity, null, "Não inferir fator para uma amostra legada de coletores independentes");
    const snapshot = await readMonitoring({period: "24h", until: "2026-10-30T23:00:01Z", serviceIds: []});
    assert.equal(snapshot.history.length, 1);
    assert.equal(snapshot.history[0].collectedAt, "2026-10-30T23:00:00.000Z");
    assert.equal(snapshot.history[0].emissionsG, null);
    assert.equal(snapshot.totalEmissionsG, null);
    const statistics = await new StatisticRepository().getStatisticsSummaryQuery();
    assert.equal(statistics.emissaoTotalCo2e, null);
    assert.equal(statistics.coveredEmissionSamples, 0);
  });
});

test("histórico SQL preserva zero, ausência de fator, identidade, corte temporal e totais agregados", async t => {
  await isolated(t, async client => {
    await client.query(readFileSync(new URL("../../../database/DDL.sql", import.meta.url), "utf8"));
    const location = {region_code: "br-sp", country: "Brasil", region: "SP", city: "São Paulo", latitude: 0, longitude: 0};
    const app = {id: "test-api", name: "Billing API", metrics_path: "/metrics/test-api", location};
    const factor = {code: "br-sp", ...location, carbon_intensity_gco2e_per_kwh: 0, renewable_share_percent: 100};
    const cycle = (at: string, cpu: number, carbon: number | null): Collection => ({at, catalog: [app],
      metrics: new Map([[app.id, {collection_interval_seconds: 30, metrics: {cpu_percent: cpu, memory_gb: 0, disk_gb: 0, network_gb: 0}}]]),
      errors: {}, regions: carbon === null ? null : [{...factor, carbon_intensity_gco2e_per_kwh: carbon}]});
    await persistCollection(client, cycle("2026-10-30T23:00:00Z", 0, 0));
    await persistCollection(client, cycle("2026-10-30T23:00:30Z", 20, null));
    const failed = cycle("2026-10-30T23:01:00Z", 0, null);
    failed.metrics.clear(); failed.errors[app.id] = "metrics_unavailable";
    await persistCollection(client, failed);
    const selection = {period: "24h" as const, until: "2026-10-30T23:01:00Z", serviceIds: []};
    const snapshot = await readMonitoring(selection);
    const latest = await readMonitoring({...selection, view: "latest"});
    assert.equal(latest.historyIncluded, false);
    assert.deepEqual(latest.history, []);
    assert.deepEqual(latest.services, snapshot.services);
    assert.deepEqual(latest.regions, snapshot.regions);
    assert.deepEqual(latest.observations, []);
    assert.equal(snapshot.historyIncluded, true);
    assert.equal(snapshot.history.length, 2);
    assert.equal(snapshot.history[0].emissionsG, 0);
    assert.equal(snapshot.history[1].emissionsG, null);
    assert.equal(snapshot.history.reduce((sum, point) => sum + point.emissionCount, 0), 1);
    assert.equal(snapshot.services[0].status, "unavailable");
    assert.equal(snapshot.collectionEvents.length, 1);
    assert.equal(snapshot.services[0].id, app.id);
    assert.match(snapshot.warning!, /1 de 2 amostras/);
    assert.match(snapshot.collectionWarning!, /API de carbono/);
    assert.match(snapshot.collectionWarning!, /obter métricas/);

    const rename = cycle("2026-10-30T23:01:30Z", 30, 85);
    rename.catalog = [{...app, name: "Renamed App"}];
    await persistCollection(client, rename);
    await persistCollection(client, rename);
    const old = await readMonitoring({...selection, until: "2026-10-30T23:00:00Z"});
    assert.equal(old.services[0].name, "Billing API");
    assert.equal(old.history.length, 1);
    assert.equal(old.collectionWarning, null);
    assert.equal(old.warning, undefined);
    assert.equal((await client.query("SELECT count(*)::int AS count FROM services")).rows[0].count, 1);
    const removed = cycle("2026-10-30T23:02:00Z", 0, null);
    removed.catalog = []; removed.metrics.clear();
    await persistCollection(client, removed);
    assert.equal((await readMonitoring({...selection, until: removed.at})).services[0].status, "removed");
    await persistCollection(client, cycle("2026-10-30T23:02:30Z", 40, 85));
    const later = cycle("2026-10-31T01:00:00Z", 50, 85);
    await persistCollection(client, later);
    const grouped = await readMonitoring({...selection, until: later.at});
    assert.equal(grouped.services[0].status, "available");
    assert.equal(grouped.bucketSeconds, 300);
    assert.equal(grouped.history.reduce((sum, point) => sum + point.sampleCount, 0), 5);
    assert.equal(grouped.history.reduce((sum, point) => sum + point.emissionCount, 0), 4);
    assert(grouped.history.length < 5);
    assert.equal(grouped.observations.reduce((sum, observation) => sum + observation.collectionCount, 0), 7);
    assert.equal(grouped.observations.length, 2, "Sete rodadas não são confundidas com os dois pontos agrupados da linha do tempo");
    const total = await client.query("SELECT sum(cpu_metric*colletion_interval_metric/3600000.0)::float8 AS energy FROM metrics");
    assert(Math.abs(grouped.totalEnergyKwh! - total.rows[0].energy) < 1e-12);
    const filtered = await readMonitoring({...selection, until: later.at, serviceIds: ["does-not-exist"]});
    assert.equal(filtered.history.length, 0);
    assert.equal(filtered.services.length, 0);
  });
});

test("SQL mantém o motivo da falha, a última leitura válida e diagnósticos sem ultrapassar o corte histórico", async t => {
  await isolated(t, async client => {
    await client.query(readFileSync(new URL("../../../database/DDL.sql", import.meta.url), "utf8"));
    const location = {region_code:"br-sp",country:"Brasil",region:"SP",city:"São Paulo",latitude:0,longitude:0};
    const catalog = ["a","b"].map(id => ({id,name:id,metrics_path:"/metrics/"+id,location}));
    const sample = {collection_interval_seconds:30,metrics:{cpu_percent:10,memory_gb:0,disk_gb:0,network_gb:0}};
    const make = (at: string): Collection => ({at,catalog,metrics:new Map(catalog.map(app => [app.id,sample])),errors:{},regions:[]});
    await persistCollection(client,make("2026-10-30T12:00:00Z"));
    for (const [index,code] of ["metrics_missing","invalid_metrics","service_unavailable","metrics_unavailable"].entries()) {
      const cycle = make(new Date(Date.parse("2026-10-30T12:00:00Z")+(index+1)*30_000).toISOString());
      cycle.metrics.delete("b"); cycle.errors.b=code;
      await persistCollection(client,cycle);
      const result = await readMonitoring({period:"24h",until:cycle.at,serviceIds:[]});
      assert.equal(result.services.find(app => app.id === "a")!.status,"available");
      const b = result.services.find(app => app.id === "b")!;
      assert.equal(b.status,index<2 ? "no-metrics" : "unavailable");
      assert.equal(b.lastCollectionAt,"2026-10-30T12:00:00.000Z");
      const diagnostic = result.collectionEvents.find(event => event.from === cycle.at)!;
      assert.equal(diagnostic.kind,index<2 ? "metrics-missing" : "service-unavailable");
      assert.deepEqual(diagnostic.serviceIds,["b"]);
      assert.equal(diagnostic.to,cycle.at);
      assert(result.collectionEvents.every(event => event.to <= cycle.at));
    }
    const recovered=make("2026-10-30T12:02:30Z");
    await persistCollection(client,recovered);
    const result=await readMonitoring({period:"24h",until:recovered.at,serviceIds:[]});
    assert.equal(result.services.find(app => app.id === "b")!.status,"available");
    assert.equal(result.collectionEvents.length,4);
  });
});

test("recuperação legada usa a região e o último fator anterior sem preencher falhas novas ou usar fatores futuros", async t => {
  await isolated(t, async client => {
    await client.query(readFileSync(new URL("../../../database/DDL.sql", import.meta.url), "utf8"));
    await client.query(`
      INSERT INTO locations(id_location,name_location,country_location,region_location,city_location,latitude_location,longitude_location)
        OVERRIDING SYSTEM VALUE VALUES(1,'region-a','Brasil','SP','São Paulo',0,0),(2,'region-b','Japão','Tokyo','Tokyo',1,1);
      INSERT INTO services(id_service,id_location,external_id,name_service,path_metric,active_service,date_houry)
        OVERRIDING SYSTEM VALUE VALUES(1,1,'legacy','Legacy','/metrics/legacy',true,'2026-10-30T23:00:00Z'),
          (2,2,'other','Other','/metrics/other',true,'2026-10-30T23:00:00Z');
      INSERT INTO carbons(id_location,date_houry,intesity_co2e_kwh_carbon,renewable_percent_carbon)
        VALUES(1,'2026-10-30T22:59:00Z',85,70),(1,'2026-10-30T23:01:00Z',0,100),
          (1,'2026-10-30T23:10:00Z',900,1),(2,'2026-10-30T23:10:00Z',465,20);
      INSERT INTO metrics(id_service,cpu_metric,ram_metric,hd_metric,network_metric,date_houry,colletion_interval_metric,carbon_intensity,location_metadata)
        VALUES(1,10,0,0,0,'2026-10-30T22:58:00Z',30,null,null),
          (1,10,0,0,0,'2026-10-30T23:00:00Z',30,null,null),
          (1,10,0,0,0,'2026-10-30T23:01:00Z',30,null,null),
          (1,10,0,0,0,'2026-10-30T23:02:00Z',30,null,'{"region_code":"region-a"}'),
          (1,10,0,0,0,'2026-10-30T23:03:00Z',30,123,'{"region_code":"region-a"}'),
          (2,10,0,0,0,'2026-10-30T23:00:00Z',30,null,null);`);
    await migrateMonitoring();
    await migrateMonitoring();
    const rows = await client.query("SELECT carbon_intensity::float8 AS factor FROM metrics ORDER BY id_metric");
    assert.deepEqual(rows.rows.map(row => row.factor), [null,85,0,null,123,null]);
    const versions = await client.query("SELECT version FROM schema_migrations ORDER BY version");
    assert.deepEqual(versions.rows.map(row => row.version), ["001_persisted_monitoring","002_recover_legacy_carbon"]);
    const snapshot = await readMonitoring({period:"24h",until:"2026-10-30T23:03:00Z",serviceIds:[]});
    assert.equal(snapshot.history.reduce((sum, point) => sum + point.sampleCount,0),6);
    assert.equal(snapshot.history.reduce((sum, point) => sum + point.emissionCount,0),3);
    assert(snapshot.totalEmissionsG! > 0);
    assert.match(snapshot.warning!,/3 de 6 amostras/);
    const zero = await readMonitoring({period:"24h",until:"2026-10-30T23:01:00Z",serviceIds:["legacy"]});
    assert.equal(zero.services[0].carbonIntensity,0);
  });
});


test("recursos históricos preservam médias ponderadas, zero, agrupamentos e cortes de consulta", async t => {
  await isolated(t, async client => {
    await client.query(readFileSync(new URL("../../../database/DDL.sql", import.meta.url),"utf8"));
    const location = {region_code:"br-sp",country:"Brasil",region:"SP",city:"São Paulo",latitude:0,longitude:0};
    const catalog = ["a","b"].map(id=>({id,name:id,metrics_path:"/metrics/"+id,location}));
    const collect = (at:string,id:string,cpu:number,seconds:number): Collection => ({at,catalog,errors:{},regions:[],
      metrics:new Map([[id,{collection_interval_seconds:seconds,metrics:{cpu_percent:cpu,memory_gb:cpu/10,disk_gb:cpu,network_gb:cpu/20}}]])});
    await persistCollection(client,collect("2026-10-30T12:00:00Z","a",0,30));
    await persistCollection(client,collect("2026-10-30T12:00:30Z","a",80,90));
    await persistCollection(client,collect("2026-10-30T12:05:00Z","a",20,60));
    await persistCollection(client,collect("2026-10-30T13:01:00Z","b",100,30));
    const query = {period:"24h" as const,until:"2026-10-30T13:01:00Z",serviceIds:[]};
    const result = await readMonitoring(query);
    assert.equal(result.bucketSeconds,300);
    const a = result.history.filter(row=>row.serviceId === "a");
    assert.equal(a.length,2);
    assert.deepEqual(a[0].resources,{cpuPercent:60,memoryGb:6,diskGb:60,networkGb:3,durationSeconds:120});
    assert.equal(a[0].emissionsG,null,"Fator de carbono ausente não impede comparar recursos");
    const seconds = a.reduce((sum,row)=>sum+row.resources!.durationSeconds,0);
    assert.equal(seconds,180);
    assert.equal(a.reduce((sum,row)=>sum+row.resources!.cpuPercent*row.resources!.durationSeconds,0)/seconds,140/3);
    const cut = await readMonitoring({...query,until:"2026-10-30T12:00:00Z",serviceIds:["a"]});
    assert.equal(cut.history.length,1);
    assert.deepEqual(cut.history[0].resources,{cpuPercent:0,memoryGb:0,diskGb:0,networkGb:0,durationSeconds:30});
    const b = await readMonitoring({...query,serviceIds:["b"]});
    assert.equal(b.history.length,1);
    assert.equal(b.history[0].resources!.cpuPercent,100);
    assert.deepEqual((await readMonitoring({...query,view:"latest"})).history,[]);
  });
});
