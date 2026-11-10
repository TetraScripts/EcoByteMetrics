import assert from "node:assert/strict";
import test from "node:test";
import pool from "../src/db/connection";
import { CarbonAPISevice } from "../src/integrations/carbon-api";
import { refreshAllData, start } from "../src/modules/Worker/worker.job";
import { getCollectedMetricsByServiceId } from "../src/modules/Services/services.service";

// The merged scheduler must publish one committed sample, never two concurrent cycles.
test("polling integrado não sobrepõe ciclos, publica após persistir e mantém 30 segundos", async t => {
  const service = {id:"merge-test",name:"Merge",metrics_path:"/metrics/merge-test",location:{region_code:"br-sp",country:"Brasil",region:"SP",city:"São Paulo",latitude:-23.55,longitude:-46.63}};
  const sample = {collection_interval_seconds:30,metrics:{cpu_percent:12,memory_gb:1,disk_gb:2,network_gb:0}};
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release=resolve;});
  let discoveries=0, commits=0;
  t.mock.method(globalThis,"fetch",async (url: string) => {
    if(String(url).endsWith("/services")) {discoveries++;await gate;return Response.json([service]);}
    assert.match(String(url),/metrics\/merge-test$/);
    return Response.json(sample);
  });
  t.mock.method(CarbonAPISevice.prototype,"listCabons",async()=>({regions:[],total:0}));
  t.mock.method(pool,"connect",async()=>({async query(sql:string){if(sql==="COMMIT")commits++;return {rowCount:1,rows:[{id_location:1,id_service:1}]};},release(){}}));
  const first=refreshAllData();
  await refreshAllData();
  assert.equal(discoveries,1);
  release();
  await first;
  assert.equal(commits,1);
  assert.deepEqual(getCollectedMetricsByServiceId(service.id)?.metrics,sample);
  await refreshAllData();
  assert.equal(discoveries,2);
  assert.equal(commits,2);
  const timer={};
  t.mock.method(globalThis,"setInterval",((_callback:unknown,ms:number)=>{assert.equal(ms,30000);return timer;}) as unknown as typeof setInterval);
  assert.equal(start(),timer);
});
