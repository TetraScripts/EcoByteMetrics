import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createServer } from "vite";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import type { MonitoringSnapshot, MonitoredService } from "../src/features/monitoring/types.ts";

test("integração do frontend: contratos HTTP, análise, telas e navegação", async t => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const vite = await createServer({ root, cacheDir: "node_modules/.vite-tests", optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom" });
  try {
    const { getMonitoringSnapshot } = await vite.ssrLoadModule("/src/features/monitoring/api/monitoring.ts");
    const { getAnalysis, analysisLink, clearMonitoringFilters } = await vite.ssrLoadModule("/src/features/monitoring/domain/analysis.ts");
    const at = new Date().toISOString();
    const dbService = (id: string, changes = {}) => ({ id, name: "App " + id, country: "Brazil", region: "Sudeste", city: "São Paulo", regionCode: "br-sp", status: "available", cpuPercent: 10, memoryGb: 1, diskGb: 2, networkGb: 3, energyKwh: 0.001, emissionsG: 0.085, carbonIntensity: 85, renewablePercent: 70, collectionIntervalSeconds: 30, lastCollectionAt: at, ...changes });
    const dbPoint = (changes = {}) => ({ serviceId: "a", regionCode: "br-sp", country: "Brazil", city: "São Paulo", collectedAt: at, energyKwh: 0.001, emissionsG: 0.085, intervalSeconds: 30, sampleCount: 1, emissionCount: 1, bucketSeconds: 30, ...changes });
    const persisted = (changes = {}) => ({ source: "database", services: [dbService("a")], regions: [], history: [dbPoint()], observations: [{ observedAt: at }], historyPeriod: "7d", historyUntil: at, selectedAt: null, lastCollectionAt: at, discoveryUpdatedAt: at, ...changes });

    await t.test("histórico do banco mantém métricas sem coordenadas e usa o fator gravado", async child => {
      child.mock.method(globalThis, "fetch", async (url: string) => {
        assert.ok(url.startsWith("/backend/api/monitoring?"));
        return Response.json(persisted());
      });
      const result = await getMonitoringSnapshot();
      assert.equal(result.source, "database");
      assert.equal(result.services[0].latitude, undefined);
      assert.equal(result.services[0].emissionsG, 0.085);
      assert.equal(result.history.length, 1);
      assert.equal(result.history[0].sampleCount, 1);
    });

    await t.test("carbono ausente permanece desconhecido; falha de métricas não implica remoção", async child => {
      child.mock.method(globalThis, "fetch", async () => Response.json(persisted({
        services: [dbService("a", { carbonIntensity: null, emissionsG: null }), dbService("b", { status: "no-metrics" }), dbService("c", { status: "removed" })],
        history: [dbPoint({ emissionsG: null, emissionCount: 0 })], warning: "Emissões parciais: fator ausente na coleta.",
      })));
      const result = await getMonitoringSnapshot();
      assert.deepEqual(result.services.map((service: MonitoredService) => service.status), ["available", "no-metrics", "removed"]);
      assert.equal(result.history[0].emissionsG, null);
      assert.equal(result.totalEmissionsG, null);
      assert.match(result.warning, /Emissões parciais/);
    });

    await t.test("contrato inválido ou histórico de navegador não substitui o histórico persistido", async child => {
      for (const data of [persisted({ source: "browser" }), persisted({ services: [dbService("a", { cpuPercent: -1 })] }),
        persisted({ history: [dbPoint({ serviceId: "wrong" })] }), persisted({ history: [dbPoint({ collectedAt: "2026-10-30 12:00" })] })]) {
        child.mock.method(globalThis, "fetch", async () => Response.json(data));
        await assert.rejects(getMonitoringSnapshot(), /histórico inválido/);
      }
    });

    await t.test("uma consulta obtém o período e o corte completos; cancelamento não dispara novas consultas", async child => {
      let calls = 0;
      child.mock.method(globalThis, "fetch", async (url: string) => {
        calls++;
        const params = new URL(url, "http://local.invalid").searchParams;
        assert.equal(params.get("period"), "24h");
        assert.equal(params.get("until"), at);
        return Response.json(persisted({ historyPeriod: "24h", selectedAt: at, services: Array.from({ length: 14 }, (_, index) => dbService(String(index))), history: [] }));
      });
      assert.equal((await getMonitoringSnapshot(undefined, { period: "24h", until: at })).services.length, 14);
      assert.equal(calls, 1);
      const controller = new AbortController(); controller.abort();
      await assert.rejects(getMonitoringSnapshot(controller.signal), { name: "AbortError" });
      assert.equal(calls, 1);
    });

    await t.test("visão geral solicita últimas leituras; histórico só é solicitado quando necessário", async child => {
      child.mock.method(globalThis, "fetch", async (url: string) => {
        const view = new URL(url, "https://local.invalid").searchParams.get("view");

        if (view === "latest") {
          return Response.json(persisted({
            historyIncluded: false,
            history: [],
            observations: []
          }));
        }

        assert.equal(view, "analysis");

        return Response.json(persisted({
          historyIncluded: true
        }));
      });

      const latest = await getMonitoringSnapshot(undefined, {
        includeHistory: false
      });

      assert.equal(latest.historyIncluded, false);
      assert.deepEqual(latest.history, []);
      assert.equal(latest.services[0].emissionsG, 0.085);

      const analysis = await getMonitoringSnapshot(undefined, {
        includeHistory: true
      });

      assert.equal(analysis.history.length, 1);
    });

    await t.test("recursos históricos aceitam zero e ausência, mas rejeitam valores inválidos", async child => {
      const resources = {cpuPercent:0,memoryGb:0,diskGb:0,networkGb:0,durationSeconds:30};
      child.mock.method(globalThis,"fetch",async()=>Response.json(persisted({history:[dbPoint({resources})]})));
      assert.deepEqual((await getMonitoringSnapshot()).history[0].resources,resources);
      for (const value of [null,undefined]) {
        child.mock.method(globalThis,"fetch",async()=>Response.json(persisted({history:[dbPoint({resources:value})]})));
        assert.equal((await getMonitoringSnapshot()).history[0].resources,null);
      }
      for (const changes of [{cpuPercent:101},{memoryGb:-1},{networkGb:"4"},{durationSeconds:0},{durationSeconds:31}]) {
        child.mock.method(globalThis,"fetch",async()=>Response.json(persisted({history:[dbPoint({resources:{...resources,...changes}})]})));
        await assert.rejects(getMonitoringSnapshot(),/histórico inválido/);
      }
    });

    const service: MonitoredService = { id: "a", name: "Billing API", status: "available", country: "Brazil", region: "Sudeste", city: "São Paulo", cpuPercent: 10, memoryGb: 1, diskGb: 2, networkGb: 3, energyKwh: 0.001, emissionsG: 0.085, lastCollectionAt: at };
    const snapshot: MonitoringSnapshot = { services: [service, { ...service, id: "b", name: "Audit", status: "removed" }], regions: [], history: ["a", "b"].map(id => ({ serviceId: id, collectedAt: at, energyKwh: 0.001, emissionsG: 0.085 })), totalEnergyKwh: 0.002, totalEmissionsG: 0.17, lastCollectionAt: at, discoveryUpdatedAt: at, refreshedAt: at };

    await t.test("trocar período ou instante não apresenta dados de outra consulta como se fossem o resultado novo", () => {
      const database = {...snapshot, source: "database", historyPeriod: "24h", selectedAt: null};
      assert.equal(getAnalysis(database, "24h", "").history.length, 2);
      assert.equal(getAnalysis(database, "7d", "").history.length, 0);
      const selection = "?instante=" + encodeURIComponent(at);
      assert.equal(getAnalysis(database, "24h", selection).history.length, 0);
      const ready = getAnalysis({...database, selectedAt: at}, "24h", selection);
      assert.equal(ready.history.length, 2);
      assert.equal(ready.observationMissing, false);
    });

    await t.test("filtros aplicam a mesma seleção a tabela, totais e histórico; links retêm filtros", () => {
      const analysis = getAnalysis(snapshot, "24h", "?busca=billing&estado=available");
      assert.deepEqual(analysis.services.map((entry: MonitoredService) => entry.id), ["a"]);
      assert.equal(analysis.history.length, 1);
      assert.equal(analysis.totals.energyKwh, 0.001);
      const link = analysisLink("/comparar", "?pais=Brazil&estado=available&busca=billing&periodo=7d&ordem=energy&servico=a&app=a&app=b&app=a");
      const params = new URL(link, "http://localhost").searchParams;
      assert.deepEqual(params.getAll("app"), ["a", "b"]);
      assert.equal(params.get("busca"), "billing");
      assert.equal(params.get("servico"), null);
      assert.equal(getAnalysis(snapshot, "24h", "?ate=2026-02-30T12:00").invalidDate, true);
    });

    const { MemoryRouter } = createRequire(root + "/package.json")("react-router-dom");
    const { MonitoringContext } = await vite.ssrLoadModule("/src/features/monitoring/contexts/MonitoringContext.ts");
    const { AnalysisProvider } = await vite.ssrLoadModule("/src/features/monitoring/providers/AnalysisProvider.tsx");
    const { DashboardPage } = await vite.ssrLoadModule("/src/features/monitoring/pages/DashboardPage.tsx");
    const { HistoryChart } = await vite.ssrLoadModule("/src/features/monitoring/components/HistoryChart.tsx");
    const { RechartsEvolutionChart, EvolutionTooltip } = await vite.ssrLoadModule("/src/features/monitoring/components/RechartsEvolutionChart.tsx");
    const { AppLayout } = await vite.ssrLoadModule("/src/app/layouts/AppLayout.tsx");
    const { LoginPage } = await vite.ssrLoadModule("/src/features/auth/LoginPage.tsx");
    const { AuthProvider } = await vite.ssrLoadModule("/src/features/auth/AuthProvider.tsx");
    const { AuthContext } = await vite.ssrLoadModule("/src/features/auth/AuthContext.ts");
    const { createAuthStore } = await vite.ssrLoadModule("/src/features/auth/session.ts");
    const { AdministrationAccess } = await vite.ssrLoadModule("/src/features/auth/AdministrationAccess.tsx");
    const render = (path: string, page = DashboardPage, changes = {}) => renderToString(h(MemoryRouter, { initialEntries: [path] }, h(AuthProvider, null, h(MonitoringContext.Provider, { value: { snapshot, period: "24h", loading: false, error: null, refresh: async () => null, ...changes } }, h(AnalysisProvider, null, h(page))))));

    await t.test("limpar filtros preserva período, indicador, modo do gráfico e aplicações comparadas", () => {
      const clear = clearMonitoringFilters("?aba=comparar&periodo=7d&serie=intervalos&ordem=energy&app=a&app=b&pais=Brasil&regiao=br-sp&estado=available&busca=API&ate=2026-10-30T22:00&instante=" + at);
      for (const key of ["pais","regiao","estado","busca","ate","instante"]) assert.equal(clear.get(key),null);
      assert.equal(clear.get("periodo"),"7d");
      assert.equal(clear.get("serie"),"intervalos");
      assert.equal(clear.get("ordem"),"energy");
      assert.equal(clear.get("aba"),"comparar");
      assert.deepEqual(clear.getAll("app"),["a","b"]);
      assert.match(analysisLink("/dashboard", "?serie=intervalos&periodo=7d"),/serie=intervalos/);
    });

    await t.test("lista mostra cinco aplicações por página e o total visível inclui toda a seleção", () => {
      const services = Array.from({length:8},(_,index)=>({...service,id:String(index),name:"Aplicação "+index,emissionsG:index+1}));
      const history = services.map((entry,index)=>({serviceId:entry.id,collectedAt:at,energyKwh:1,emissionsG:index+1}));
      const markup = render("/dashboard",DashboardPage,{snapshot:{...snapshot,services,history}}).replace(/<!--.*?-->/g,"");
      const table = markup.split('class="monitoring-app-table"')[1]!.split('</tbody>')[0]!.split('<tbody>')[1]!;
      assert.equal((table.match(/<tr\b/g)??[]).length,5);
      assert.ok(!table.includes("Aplicação 0"));
      assert.match(markup,/1–5 de 8 aplicações/);
      assert.match(markup,/Totais das 8 aplicações filtradas/);
      assert.match(markup,/<strong>36 <small>g CO₂e/);
      assert.match(markup,/Indicador:/);
      assert.match(markup,/CO₂e na última coleta/);
      assert.match(markup,/CO₂e das últimas coletas/);
      assert.ok(!markup.includes('class="monitoring-data-context"'));
      assert.ok(!markup.includes("Valores do maior para o menor; removidas ao final"));
      assert.ok(!markup.includes('aria-label="Filtros ativos"'));
    });

    await t.test("comparação alterna última coleta e total com resumo coerente e horários por aplicação", () => {
      const services = [{...service, energyKwh: .004, emissionsG: 2, lastCollectionAt: at}, {...service,id:"b",name:"Audit",energyKwh:.006,emissionsG:3,lastCollectionAt:at}];
      const data = {...snapshot,services,history:[{serviceId:"a",collectedAt:at,energyKwh:1,emissionsG:100},{serviceId:"b",collectedAt:at,energyKwh:2,emissionsG:200}]};
      const latest = render("/dashboard?aba=comparar&comparacao=ultima&app=a&app=b", DashboardPage, {snapshot:data}).replace(/<!--.*?-->/g, "");
      assert.match(latest,/CO₂e das últimas coletas/);
      assert.match(latest,/0,01 <small>kWh/);
      assert.match(latest,/5 <small>g CO₂e/);
      assert.match(latest,/Última leitura disponível por aplicação/);
      assert.match(latest,/Coletada em/);
      assert.match(latest,/0,002/);
      assert.doesNotMatch(latest,/Mesmo intervalo de consulta|Período da comparação/);
      const total = render("/dashboard?aba=comparar&app=a&app=b",DashboardPage,{snapshot:data}).replace(/<!--.*?-->/g, "");
      assert.match(total,/3 <small>kWh/);
      assert.match(total,/0,3 <small>kg CO₂e/);
      assert.match(total,/Período da comparação/);
      assert.match(total,/Mesmo intervalo de consulta/);
      assert.doesNotMatch(total,/Coletada em/);
      const pending = render("/dashboard?aba=comparar&comparacao=ultima&app=a&app=b",DashboardPage,{snapshot:{...data,history:[],historyIncluded:false}});
      assert.doesNotMatch(pending,/Consultando as leituras para comparação/);
      assert.match(pending,/Última leitura disponível por aplicação/);
      assert.equal(new URL("http://local"+analysisLink("/comparar","?comparacao=ultima&app=a&app=b")).searchParams.get("comparacao"),"ultima");
    });

    await t.test("total acumulado é o padrão e comparação mantém dados técnicos nos detalhes", () => {
      assert.match(render("/dashboard?aba=evolucao"),/aria-pressed="true">Acumulado<\/button>/);
      assert.match(render("/dashboard?aba=evolucao&serie=intervalos"),/aria-pressed="true">Por intervalo<\/button>/);
      const markup=render("/dashboard?aba=comparar&app=a&app=b");
      const table=markup.split('class="comparison-table"')[1]!.split('</table>')[0]!;
      assert.equal((table.match(/scope="col"/g)??[]).length,4);
      assert.ok(!table.includes("Tempo somado"));
      assert.doesNotMatch(markup,/comparison-reading-details/);
      assert.doesNotMatch(markup,/Tempo somado das leituras/);
      assert.match(markup.replace(/<!--.*?-->/g,""),/Totais das 2 aplicações marcadas para comparação/);
      const extraService={...service,id:"unselected",name:"Fora da comparação"};
      const extraSnapshot={...snapshot,services:[...snapshot.services,extraService],history:[...snapshot.history,{...snapshot.history[0]!,serviceId:extraService.id,emissionsG:99}]};
      const selected=render("/dashboard?aba=comparar&app=a&app=b",DashboardPage,{snapshot:extraSnapshot}).replace(/<!--.*?-->/g,"");
      const totals=selected.split('class="monitoring-visible-totals"')[1]!.split('class="monitoring-update"')[0]!;
      assert.match(totals,/0,17/);
      assert.ok(!totals.includes("99,17"));
      assert.match(totals,/Totais das 2 aplicações/);
    });

    await t.test("CO₂ disponível aparece sem marcadores e o aviso acompanha a cobertura dos filtros", () => {
      const mixed = {...snapshot, history: [
        {...snapshot.history[0]!, sampleCount:4, emissionCount:2, emissionsG:1.25}, snapshot.history[1]!,
      ]};
      const analysis = getAnalysis(mixed,"24h","");
      assert.match(analysis.warning,/3 de 5 amostras/);
      assert.equal(getAnalysis(mixed,"24h","?busca=Audit").warning,undefined);
      for (const path of ["/dashboard","/dashboard?aba=comparar&app=a&app=b","/dashboard?aba=evolucao&painel=aplicacoes"]) {
        const markup = render(path,DashboardPage,{snapshot:mixed}).replace(/<!--.*?-->/g,"");
        assert.match(markup,path === "/dashboard" ? /0,085/ : path.includes("comparar") ? /0,00125/ : /1,25/);
        assert.ok(!markup.includes("CO₂ calculado em 3 de 5 leituras"));
        assert.ok(!markup.includes("Algumas emissões não puderam ser calculadas"));
        assert.ok(!markup.includes('class="monitoring-partial"'));
        assert.ok(!markup.includes("Há informações indisponíveis nesta consulta"));
      }
    });

    await t.test("avisos de carbono histórico não são confundidos com uma falha atual do coletor", async child => {
      child.mock.method(globalThis,"fetch",async()=>Response.json(persisted({
        history:[dbPoint({sampleCount:4,emissionCount:2,emissionsG:1.25})],
        collectionWarning:null, warning:"CO₂ calculado com 2 de 4 amostras.",
      })));
      const data=await getMonitoringSnapshot();
      assert.equal(data.warning,undefined);
      assert.match(getAnalysis(data,"7d","").warning,/2 de 4 amostras/);
      child.mock.method(globalThis,"fetch",async()=>Response.json(persisted({collectionWarning:"O coletor está desatualizado."})));
      assert.match((await getMonitoringSnapshot()).warning,/desatualizado/);
    });

    await t.test("datas visíveis usam o primeiro registro do agregado e distinguem total do período e última coleta", () => {
      const first=new Date(Date.parse(at)-240_000).toISOString();
      const mixed={...snapshot,history:[{...snapshot.history[0]!,firstCollectedAt:first,sampleCount:4,emissionCount:2,emissionsG:1.25}]};
      const analysis=getAnalysis(mixed,"24h","");
      assert.equal(analysis.availableSince,Date.parse(first));
      assert.equal(analysis.availableUntil,Date.parse(at));
      for(const path of ["/dashboard?servico=a&detalhe=evolucao","/dashboard?aba=evolucao"]) {
        const markup=render(path,DashboardPage,{snapshot:mixed}).replace(/<!--.*?-->/g,"");
        assert.ok(markup.includes('Registros de '+new Date(first).toLocaleString('pt-BR')));
      }
      const detail=render("/dashboard?servico=a",DashboardPage,{snapshot:mixed}).replace(/<!--.*?-->/g,"");
      assert.match(detail,/CO₂e na última coleta/);
      assert.match(detail,/0,085/);
      assert.ok(!detail.includes("1,25"));
      assert.match(detail,/Ver totais e histórico/);
      assert.match(detail,/Última coleta válida/);
      assert.match(render("/dashboard?aba=evolucao&serie=acumulado",DashboardPage,{snapshot:mixed}).replace(/<!--.*?-->/g,""),/CO₂e acumulado no período/);
      assert.match(render("/dashboard?aba=evolucao&serie=intervalos",DashboardPage,{snapshot:mixed}).replace(/<!--.*?-->/g,""),/CO₂e no último intervalo/);
    });

    await t.test("visão geral mostra a última coleta, evolução mantém o histórico e o passado usa a leitura daquele corte", () => {
      const old = new Date(Date.parse(at)-300_000).toISOString();
      const data = {...snapshot, services:[{...service,emissionsG:0.3}], history:[
        {serviceId:"a",collectedAt:old,energyKwh:1,emissionsG:96},
        {serviceId:"a",collectedAt:at,energyKwh:0.001,emissionsG:0.3},
      ]};
      const overview=render("/dashboard",DashboardPage,{snapshot:data}).replace(/<!--.*?-->/g,"");
      assert.ok(!overview.includes("Última coleta de cada aplicação"));
      const table=overview.split('class="monitoring-app-table"')[1]!.split('</table>')[0]!;
      assert.match(table,/0,3 g/);
      assert.ok(!table.includes("96,3"));
      assert.match(overview,/<strong>0,3 <small>g CO₂e/);
      const evolution=render("/dashboard?aba=evolucao",DashboardPage,{snapshot:data}).replace(/<!--.*?-->/g,"");
      assert.match(evolution,/<strong>96,3 <small>g CO₂e/);
      const selectedAt=old;
      const historical={...data,source:"database",historyPeriod:"24h",historyUntil:old,selectedAt,services:[{...service,emissionsG:0.1,lastCollectionAt:old}],history:[]};
      const past=render("/dashboard?instante="+encodeURIComponent(old),DashboardPage,{snapshot:historical}).replace(/<!--.*?-->/g,"");
      assert.match(past,/Você está consultando o passado/);
      assert.match(past.split('class="monitoring-app-table"')[1]!.split('</table>')[0]!,/0,1 g/);
      assert.ok(!past.includes("0,3 g"));
    });

    await t.test("resumo individual mantém a última leitura mesmo quando o histórico soma muito mais", () => {
      const data={...snapshot,services:[{...service,emissionsG:.3}],history:[{serviceId:"a",collectedAt:at,energyKwh:5,emissionsG:96}]};
      const detail=render("/dashboard?servico=a",DashboardPage,{snapshot:data}).replace(/<!--.*?-->/g,"");
      assert.match(detail,/Impacto estimado na última coleta/);
      assert.match(detail,/<dd>0,3 <small>g CO₂e/);
      assert.ok(!detail.includes("96 <small>g CO₂e"));
      const evolution=render("/dashboard?servico=a&detalhe=evolucao",DashboardPage,{snapshot:data}).replace(/<!--.*?-->/g,"");
      assert.match(evolution,/96/);
    });

    await t.test("filtros respeitam o escopo da tela, bloqueiam futuro e explicam aplicação excluída", () => {
      const overview=render("/dashboard?painel=historico");
      assert.ok(!overview.includes("<label>Período<select"));
      assert.doesNotMatch(render("/dashboard?aba=evolucao&painel=historico"),/class="monitoring-(tools|filter-button|filter-dialog)"/);
      assert.doesNotMatch(render("/dashboard?aba=comparar&painel=historico"),/class="monitoring-(tools|filter-button|filter-dialog)"/);
      assert.match(overview,/type="datetime-local" max="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}"/);
      const future=new Date(Date.now()+86400_000).toISOString();
      const invalid=getAnalysis(snapshot,"24h","?instante="+encodeURIComponent(future));
      assert.equal(invalid.invalidDate,true);
      assert.equal(invalid.services.length,0);
      assert.equal(invalid.history.length,0);
      const futurePage=render("/dashboard?instante="+encodeURIComponent(future));
      assert.match(futurePage,/Escolha uma data válida até o momento atual/);
      const data={...snapshot,services:[service,{...service,id:"b",country:"Ireland",city:"Dublin"}]};
      const excluded=render("/dashboard?servico=a&pais=Ireland",DashboardPage,{snapshot:data});
      assert.match(excluded,/Esta aplicação está fora dos filtros atuais/);
      assert.match(excluded,/Limpar filtros/);
      assert.ok(!excluded.includes("Impacto estimado na última coleta"));
    });

    await t.test("contrato preserva diagnóstico de métricas ausentes enviado pelo backend", async child => {
      child.mock.method(globalThis,"fetch",async()=>Response.json(persisted({collectionEvents:[{from:at,to:at,kind:"metrics-missing",serviceIds:["a"]}]})));
      assert.equal((await getMonitoringSnapshot()).collectionEvents[0].kind,"metrics-missing");
    });

    await t.test("linha do tempo conta rodadas reais e identifica seus pontos agrupados", () => {
      const observed={...snapshot,observations:[
        {observedAt:new Date(Date.parse(at)-300_000).toISOString(),collectionCount:10,services:[],samples:[]},
        {observedAt:at,collectionCount:2,services:[],samples:[]},
      ]};
      const markup=render("/dashboard?painel=historico",DashboardPage,{snapshot:observed}).replace(/<!--.*?-->/g,"");
      assert.match(markup,/12 rodadas de coleta gravadas/);
      assert.match(markup,/2 pontos de revisão/);
      assert.match(markup,/Última rodada registrada/);
    });

    await t.test("contrato da linha do tempo preserva contagens e rejeita quantidades inválidas", async child => {
      child.mock.method(globalThis,"fetch",async()=>Response.json(persisted({observations:[{observedAt:at,collectionCount:12}]})));
      assert.equal((await getMonitoringSnapshot()).observations[0].collectionCount,12);
      for (const collectionCount of [0,-1,1.5,"12"]) {
        child.mock.method(globalThis,"fetch",async()=>Response.json(persisted({observations:[{observedAt:at,collectionCount}]})));
        await assert.rejects(getMonitoringSnapshot(),/histórico inválido/);
      }
    });

    await t.test("login e cadastro habilitam seus formulários e preservam o monitoramento público", () => {
      for (const register of [false, true]) {
        const markup = renderToString(h(MemoryRouter, null, h(AuthProvider, null, h(LoginPage, { register }))));
        const inputs = markup.match(/<input\b[^>]*>/g) ?? [];
        assert.equal(inputs.length, register ? 3 : 2);
        assert.ok(inputs.every(input => !input.includes('disabled=""')));
        assert.match(markup, /class="login-submit"[^>]*type="submit"/);
        assert.ok(!/<button disabled="" class="login-submit"/.test(markup));
        assert.ok(markup.includes('href="/dashboard"'));
        assert.ok(markup.includes('href="' + (register ? "/login" : "/cadastro") + '"'));
        const currentLinks = markup.match(/<a\b[^>]*aria-current="page"[^>]*>/g) ?? [];
        assert.equal(currentLinks.length, 1);
        assert.ok(currentLinks[0].includes('href="' + (register ? "/cadastro" : "/login") + '"'));
        assert.equal((markup.match(/<h1\b/g) ?? []).length, 1);
        assert.ok(!markup.includes("login-availability"));
        assert.ok(!markup.includes("Prévia visual"));
      }
    });

    await t.test("cadastro bloqueia os campos durante o envio e prepara login com confirmação e destino preservado", async child => {
      const store = createAuthStore();
      child.after(store.dispose);
      let resolve!: (value: Response) => void;
      child.mock.method(globalThis, "fetch", () => new Promise<Response>(done => { resolve = done; }));
      const pending = store.signUp({ name: "Review", email: "review@example.invalid", password: "secret-fixture" });
      const route = "/cadastro?retorno=" + encodeURIComponent("/dashboard?aba=administracao&pais=Brasil");
      const markup = renderToString(h(MemoryRouter, { initialEntries: [route] }, h(AuthContext.Provider, { value: store }, h(LoginPage, { register: true }))));
      assert.match(markup, /aria-busy="true"/);
      assert.ok((markup.match(/<input\b[^>]*>/g) ?? []).every(input => input.includes('disabled=""')));
      assert.match(markup, /Criando conta…/);
      assert.match(markup, /href="\/login\?retorno=/);
      assert.ok(markup.includes("Brasil"));
      resolve(Response.json({ id_user: 1, name_user: "Review", email_user: "review@example.invalid" }, { status: 201 }));
      assert.equal(await pending, true);
      const login = renderToString(h(MemoryRouter, { initialEntries: ["/login?motivo=expirada"] }, h(AuthContext.Provider, { value: store }, h(LoginPage))));
      assert.match(login, /Conta criada com sucesso/);
      assert.match(login, /id="email"[^>]*value="review@example.invalid"/);
      assert.ok(!login.includes("Sua sessão expirou"));
      assert.ok(!login.includes("secret-fixture"));
      assert.equal(store.getSnapshot().session, null);
    });

    await t.test("cadastro identifica campos inválidos e e-mail duplicado com mensagens acessíveis", async child => {
      const store = createAuthStore();
      child.after(store.dispose);
      const renderForm = () => renderToString(h(MemoryRouter, null, h(AuthContext.Provider, { value: store }, h(LoginPage, { register: true }))));
      await store.signUp({ name: "", email: "invalid", password: "short" });
      const invalid = renderForm();
      for (const field of ["name", "email", "password"]) {
        assert.match(invalid, new RegExp(`id="${field}"[^>]*aria-invalid="true"`));
        assert.ok(invalid.includes(`id="${field}-error"`));
      }
      assert.match(invalid, /id="login-error" role="alert"/);
      child.mock.method(globalThis, "fetch", async () => Response.json({ erro: "SQL password internal" }, { status: 409 }));
      await store.signUp({ name: "Review", email: "review@example.invalid", password: "secret-fixture" });
      const duplicate = renderForm();
      assert.match(duplicate, /id="email"[^>]*aria-invalid="true"[^>]*aria-describedby="login-error"/);
      assert.match(duplicate, /Já existe uma conta/);
      assert.ok(!duplicate.includes("SQL password internal"));
      assert.ok(!duplicate.includes("secret-fixture"));
    });

    await t.test("login apresenta expiração e erros sem preencher a senha ou expor detalhes da API", async child => {
      const store = createAuthStore();
      child.after(store.dispose);
      child.mock.method(globalThis, "fetch", async () => Response.json({ message: "SQL password internal" }, { status: 500 }));
      await store.signIn({ email: "review@example.invalid", password: "secret-fixture" });
      const markup = renderToString(h(MemoryRouter, { initialEntries: ["/login?motivo=expirada"] }, h(AuthContext.Provider, { value: store }, h(LoginPage))));
      assert.match(markup, /Sua sessão expirou/);
      assert.match(markup, /id="login-error" role="alert"/);
      assert.match(markup, /indisponível no momento/);
      assert.match(markup, /aria-describedby="login-error"/);
      assert.ok(!markup.includes("SQL password internal"));
      assert.ok(!markup.includes("secret-fixture"));
      assert.ok(!markup.includes('aria-invalid="true"'));
    });

    await t.test("administração sempre exige sessão; uma sessão confirmada libera a tela vazia e a saída", async child => {
      const store = createAuthStore();
      child.after(store.dispose);
      const panel = () => renderToString(h(MemoryRouter, { initialEntries: ["/dashboard?aba=administracao"] }, h(AuthContext.Provider, { value: store }, h(AdministrationAccess, null, h("p", null, "Protected panel")))));
      assert.equal(panel(), "");
      const token = "header." + Buffer.from(JSON.stringify({ email: "review@example.invalid", exp: Math.floor(Date.now() / 1000) + 60 })).toString("base64url") + ".signature";
      child.mock.method(globalThis, "fetch", async () => Response.json({ token, tokenType: "Bearer", expiresIn: "1m" }));
      assert.equal(await store.signIn({ email: "review@example.invalid", password: "fixture" }), true);
      assert.match(panel(), /Protected panel/);
      const { AdministrationPanel } = await vite.ssrLoadModule("/src/features/monitoring/components/AdministrationPanel.tsx");
      const markup = renderToString(h(MemoryRouter, { initialEntries: ["/dashboard?aba=administracao&configuracao=acesso"] }, h(AuthContext.Provider, { value: store }, h(AdministrationPanel))));
      assert.match(markup, /review@example.invalid/);
      assert.doesNotMatch(markup, /administration-workspace|administration-interval|Configuração atual da coleta|Configurações do ambiente de monitoramento/);
      assert.match(markup, /id="administration-title">Administração/);
      assert.ok(!markup.includes("Salvar alterações"));
      assert.match(markup, /Sair/);
      assert.ok(!markup.includes("Acesso livre"));
      assert.ok(!markup.includes("Entrada na administração"));
      assert.ok(!markup.includes("Acesso à administração"));
      child.mock.method(globalThis, "fetch", async () => Response.json({}, { status: 401 }));
      await assert.rejects(store.request("/api/users/1"));
      assert.equal(panel(), "");
      store.logout();
      assert.equal(panel(), "");
    });

    await t.test("detalhes mantêm globo à esquerda e conteúdo das três abas à direita", () => {
      for (const [tab, text] of [["resumo", "Impacto estimado na última coleta"], ["recursos", "Recursos da última coleta"], ["evolucao", "Evolução da aplicação"]]) {
        const markup = render("/dashboard?servico=a&detalhe=" + tab).replace(/<!--.*?-->/g, "");
        const panel = markup.indexOf('class="monitoring-service-summary"');
        assert.ok(panel > markup.indexOf('class="monitoring-map"'));
        assert.ok(markup.indexOf(text!) > panel);
        assert.equal((markup.match(/class="monitoring-map"/g) ?? []).length, 1);
        assert.match(markup, /Sem coordenadas/);
      }
      assert.match(render("/dashboard?busca=unknown"), /Nenhuma aplicação nesta seleção/);
      assert.match(render("/dashboard?servico=missing"), /Aplicação não encontrada/);
      assert.match(render("/dashboard", DashboardPage, { error: "Sem conexão" }), /Tentar novamente/);
    });

    await t.test("atualização preserva o texto da consulta anterior até a resposta chegar", () => {
      const status = (markup: string) => markup.match(/<span role="status">(.*?)<\/span>/)?.[1];
      const previous = status(render("/dashboard"));
      assert.match(previous!, /Dados coletados até/);
      assert.equal(status(render("/dashboard", DashboardPage, { loading: true })), previous);
      const firstLoad = render("/dashboard", DashboardPage, { loading: true, snapshot: { ...snapshot, services: [], history: [], refreshedAt: undefined } });
      assert.match(status(firstLoad)!, /Consultando registros/);
    });

    await t.test("resumo e contexto explicam unidades e estimativas sem abrir popups inicialmente", () => {
      const markup = render("/dashboard");
      assert.equal((markup.match(/class="info-tooltip-trigger"/g) ?? []).length, 2);
      assert.match(markup, /Situação das aplicações na seleção/);
      assert.ok(render("/dashboard?aba=evolucao").includes('aria-label="Sobre estimativas ambientais"'));
      assert.ok(!markup.includes("Entender os números"));
      assert.ok(!markup.includes("monitoring-summary-facts"));
      assert.ok(!markup.includes('role="tooltip"'));
      for (const text of ["A situação indica se a aplicação respondeu", "Os números indicam aplicações no mesmo local", "Leituras usadas no CO₂", "Página consultada em"]) assert.ok(!markup.includes(text));
    });

    await t.test("ranking do período mantém impacto maior primeiro e comparador exibe somente a tabela principal", () => {
      const resources = {cpuPercent:0,memoryGb:2,diskGb:3,networkGb:4,durationSeconds:30};
      const history = snapshot.history.map(point => ({...point,resources,emissionsG:point.serviceId === "b" ? 10 : 1}));
      const data = {...snapshot,history};
      const ranked = render("/dashboard?aba=evolucao&painel=aplicacoes",DashboardPage,{snapshot:data});
      const list = ranked.split('class="evolution-contributors"')[1]!.split('</ol>')[0]!;
      assert.ok(list.indexOf("Audit") < list.indexOf("Billing API"));
      const markup = render("/dashboard?aba=comparar&app=a&app=b",DashboardPage,{snapshot:data}).replace(/<!--.*?-->/g, "");
      assert.match(markup, /class="comparison-table"/);
      const table = markup.split('class="comparison-table"')[1]!.split('</table>')[0]!;
      assert.match(table, /Emissões \(kg CO₂e\)/);
      assert.match(table, /<td>0,01<\/td>/);
      assert.match(table, /<td>0,001<\/td>/);
      assert.doesNotMatch(markup, /comparison-resource-table|comparison-reading-details|Ver recursos médios|Ver leituras e qualidade|Um total menor não indica/);
    });

    await t.test("carregamento tardio do histórico não afirma ausência de dados nem fica preso após falha", () => {
      const partial = {...snapshot, source: "database", historyPeriod: "7d", historyIncluded: false, history: []};
      const pending = render("/dashboard?aba=comparar&app=a&app=b", DashboardPage, {snapshot:partial});
      assert.match(pending, /Consultando as leituras para comparação/);
      const failed = render("/dashboard?aba=evolucao", DashboardPage, {snapshot:partial, error:"Sem conexão"});
      assert.doesNotMatch(failed, /Consultando os registros da seleção/);
    });

    await t.test("evolution reveals only the selected section and keeps optional information out of the chart", () => {
      const markup = render("/dashboard?aba=evolucao").replace(/<!--.*?-->/g, "");
      assert.ok(markup.includes('aria-label="Se\u00e7\u00f5es da evolu\u00e7\u00e3o"'));
      assert.ok(markup.includes('data-engine="recharts"'));
      assert.ok(markup.includes('aria-label="Emiss\u00f5es estimadas ao longo do tempo"'));
      for (const text of ["evolution-details-grid", "evolution-contributors", "evolution-samples", "observation-range"]) assert.ok(!markup.includes(text), text);
      const details = render("/dashboard?aba=evolucao&painel=detalhes");
      assert.match(details, /evolution-details-grid/);
      assert.ok(!details.includes('class="evolution-chart-panel"'));
      const legacyHistory = render("/dashboard?aba=evolucao&painel=historico");
      assert.doesNotMatch(legacyHistory, /monitoring-filter-history/);
      assert.match(legacyHistory, /evolution-chart-panel/);
      assert.doesNotMatch(markup, />Histórico<\/button>/);
      assert.match(render("/dashboard?aba=evolucao&painel=aplicacoes"), /evolution-contributors/);
      assert.match(render("/dashboard?aba=evolucao&serie=acumulado"), /aria-pressed="true">Acumulado<\/button>/);
      assert.match(render("/dashboard?aba=evolucao&ordem=energy"), /kWh/);
      const empty = render("/dashboard?aba=evolucao", DashboardPage, { snapshot: { ...snapshot, history: [] } });
      assert.match(empty, /Nenhum registro neste per\u00edodo/);
      const incomplete = render("/dashboard?aba=evolucao", DashboardPage, { snapshot: { ...snapshot, history: snapshot.history.map(point => ({ ...point, emissionsG: null })) } });
      assert.match(incomplete, /Ainda faltam dados de emiss\u00f5es/);
      assert.match(incomplete, /Visualizar energia/);
      assert.ok(!incomplete.includes("NaN"));
      assert.match(render("/dashboard?servico=a&detalhe=evolucao&painel=aplicacoes"), /evolution-chart-panel/);
    });

    await t.test("filtros usam painel separado e o passado continua identificado com o painel fechado", () => {
      const observed = {...snapshot,observations:[{observedAt:at,services:snapshot.services,samples:snapshot.history}]};
      for(const path of ["/dashboard?aba=evolucao","/dashboard?servico=a&detalhe=evolucao","/dashboard?servico=a&detalhe=resumo"]) {
        const past=render(path+"&instante="+encodeURIComponent(at),DashboardPage,{snapshot:observed}).replace(/<!--.*?-->/g,"");
        assert.match(past,/Você está consultando o passado/);
        assert.match(past,/Voltar para agora/);
        assert.ok(!past.includes('class="observation-timeline"'));
        const open=render(path+"&painel=historico",DashboardPage,{snapshot:observed});
        if(path.includes("evolucao")) {
          assert.doesNotMatch(open,/class="monitoring-(tools|filter-button|filter-dialog)"/);
          continue;
        }
        assert.match(open,/<dialog[^>]*aria-labelledby="filter-dialog-title"/);
        assert.match(open,/Fechar filtros/);
        assert.equal((open.match(/class="observation-timeline"/g)??[]).length,1);
        assert.match(open,/Situação da aplicação/);
        assert.ok(!open.includes('Todos os estados'));
        assert.ok(!open.includes('class="evolution-history"'));
      }
    });

    await t.test("Recharts substitui o gráfico manual nos dois modos e preserva zero e unidades", () => {
      const points = [{ timestamp: Date.parse(at), value: 0, gap: true }];
      for (const mode of ["intervals", "cumulative"]) {
        const markup = renderToString(h(HistoryChart, { points, metric: "energy", mode, intervalMs: 30_000, onEnergy: () => {} }));
        const plot = renderToString(h(RechartsEvolutionChart, { data: points, metric: "energy", mode, intervalMs: 30_000, helpId: "chart-help" }));
        assert.match(plot, /recharts-responsive-container/);
        assert.match(plot, /recharts-wrapper/);
        assert.ok(markup.includes('data-chart-mode="' + mode + '"'));
        assert.match(markup, /kWh/);
        assert.ok(!markup.includes("NaN"));
        assert.ok(!markup.includes("evolution-chart-scrubber"));
      }
    });

    await t.test("long lists show five entries per page instead of growing the evolution panel", () => {
      const points = Array.from({ length: 11 }, (_, index) => ({ serviceId: "a", collectedAt: new Date(Date.parse(at) - 600_000 + index * 30_000).toISOString(), energyKwh: .001, emissionsG: .085 }));
      const samples = render("/dashboard?aba=evolucao&painel=coletas", DashboardPage, { snapshot: { ...snapshot, history: points } }).split('class="evolution-samples"')[1]!;
      const body = samples.match(/<tbody>(.*?)<\/tbody>/)?.[1] ?? "";
      assert.equal((body.match(/<tr>/g) ?? []).length, 5);
      assert.match(samples, /de <!-- -->11<!-- --> intervalos/);
      assert.match(samples, /aria-label="Pr\u00f3xima p\u00e1gina de coletas"/);
      const services = Array.from({ length: 8 }, (_, index) => ({ ...service, id: String(index), name: "App " + index }));
      const history = services.map(entry => ({ ...points[0]!, serviceId: entry.id }));
      const apps = render("/dashboard?aba=evolucao&painel=aplicacoes", DashboardPage, { snapshot: { ...snapshot, services, history } }).split('class="evolution-contributors"')[1]!;
      assert.equal((apps.match(/<li>/g) ?? []).length, 5);
      assert.match(apps, /de <!-- -->8<!-- --> aplica/);
    });

    await t.test("aba removida de dados incompletos retorna ao gráfico no ambiente e na aplicação", () => {
      for (const url of ["/dashboard?aba=evolucao&painel=lacunas", "/dashboard?servico=a&detalhe=evolucao&painel=lacunas"]) {
        const markup = render(url);
        assert.match(markup, /class="evolution-chart-panel"/);
        assert.ok(!markup.includes("Dados incompletos"));
        assert.ok(!markup.includes("evolution-gap-detail"));
        assert.ok(!markup.includes("Alguns dados estão incompletos"));
      }
    });

    await t.test("revisar um instante não usa diagnósticos recebidos no futuro", () => {
      const stamp = (seconds: number) => new Date(Date.parse(at) + seconds * 1000).toISOString();
      const past = { ...snapshot, observations: [{ observedAt: at, services: snapshot.services, samples: snapshot.history }], collectionEvents: [
        { from: stamp(-60), to: stamp(-30), kind: "request-failed" as const },
        { from: stamp(-20), to: stamp(30), kind: "tab-hidden" as const },
      ] };
      const analysis = getAnalysis(past, "24h", "?instante=" + encodeURIComponent(at));
      assert.equal(analysis.collectionEvents.length, 1);
      assert.equal(analysis.collectionEvents[0].kind, "request-failed");
    });

    await t.test("acumulado usa kg no resumo, gráfico, tabela e popup, preservando os valores originais", () => {
      const history=Array.from({length:10},(_,index)=>({serviceId:"a",collectedAt:new Date(Date.parse(at)-(9-index)*300_000).toISOString(),energyKwh:.001,emissionsG:index===0?39.9287:50,bucketSeconds:300}));
      const original=JSON.stringify(history);
      const data={...snapshot,services:[service],history};
      const cumulative=render("/dashboard?aba=evolucao",DashboardPage,{snapshot:data}).replace(/<!--.*?-->/g,"");
      assert.match(cumulative,/0,49 <small>kg CO₂e/);
      assert.match(cumulative,/5 minutos · kg CO₂e/);
      assert.ok(!cumulative.includes("489,9287"));
      const samples=render("/dashboard?aba=evolucao&painel=coletas",DashboardPage,{snapshot:data}).replace(/<!--.*?-->/g,"");
      assert.match(samples,/Total acumulado no período \(kg CO₂e\)/);
      assert.match(samples,/<td[^>]*>0,49<\/td>/);
      const intervals=render("/dashboard?aba=evolucao&serie=intervalos",DashboardPage,{snapshot:data}).replace(/<!--.*?-->/g,"");
      assert.match(intervals,/5 minutos · g CO₂e/);
      const energy=render("/dashboard?aba=evolucao&ordem=energy",DashboardPage,{snapshot:data}).replace(/<!--.*?-->/g,"");
      assert.match(energy,/5 minutos · kWh/);
      const tooltip=renderToString(h(EvolutionTooltip,{active:true,payload:[{payload:{timestamp:Date.parse(at),value:489.9287}}],seriesLabel:"Emissões estimadas",unit:"kg CO₂e",divisor:1000})).replace(/<!--.*?-->/g,"");
      assert.match(tooltip,/0,49 kg CO₂e/);
      assert.equal(JSON.stringify(history),original);
    });

    await t.test("tooltips distinguem uma lacuna real de estimativa ausente e mantêm zero válido", () => {
      const tooltip = (point: object) => renderToString(h(EvolutionTooltip, { active: true, payload: [{ payload: point }], seriesLabel: "Energia estimada", unit: "kWh" })).replace(/<!--.*?-->/g, "");
      const missing = tooltip({ timestamp: Date.parse(at), value: null, missing: true, from: Date.parse(at) - 60_000, to: Date.parse(at), reason: "Motivo desconhecido", events: [{ from: at, to: at, kind: "request-failed" }] });
      assert.match(missing, /Trecho sem registros/);
      assert.match(missing, /Motivo desconhecido/);
      assert.match(missing, /consulta ao backend falhou/);
      assert.match(tooltip({ timestamp: Date.parse(at), value: null, reason: "Fator de carbono ausente" }), /Fator de carbono ausente/);
      assert.match(tooltip({ timestamp: Date.parse(at), value: 0 }), /0 kWh/);
      const partial = tooltip({ timestamp: Date.parse(at), from:Date.parse(at)-30_000,to:Date.parse(at),value:1,reason:"O intervalo considera 1 de 2 amostras" });
      assert.match(partial,/Total do intervalo/);
      assert.match(partial,/1 kWh/);
      assert.doesNotMatch(partial,/1 de 2 amostras/);
    });

    await t.test("administração anônima não exibe configurações, inclusive por URL antiga e sem conexão com métricas", () => {
      const markup = render("/dashboard?aba=administracao&painel=historico", DashboardPage, { error: "Sem conexão" });
      assert.match(markup, /role="tab"[^>]*aria-selected="true"[^>]*>Administração<svg/);
      assert.ok(markup.indexOf('>Comparar</button>') < markup.indexOf('>Administração<svg'));
      assert.ok(!markup.includes('class="monitoring-tab-access"'));
      assert.ok(markup.includes('data-view="administracao" hidden=""'));
      assert.ok(markup.includes('aria-label="Administração do ambiente"'));
      assert.ok(!markup.includes("Prévia visual"));
      assert.ok(!markup.includes('class="administration-panel"'));
      assert.ok(!markup.includes('id="administration-interval"'));
      const access = render("/dashboard?aba=administracao&configuracao=acesso");
      assert.ok(!access.includes('class="administration-panel"'));
      assert.ok(!access.includes('id="administration-interval"'));
      assert.ok(!markup.includes('role="alert"'));
      assert.ok(!markup.includes('class="monitoring-summary"'));
      assert.ok(!markup.includes('class="monitoring-filters"'));
      assert.ok(!markup.includes('class="monitoring-tools"'));
      assert.ok(!render("/dashboard").includes('class="administration-panel"'));
      assert.ok(!render("/dashboard?servico=a&aba=administracao").includes('class="administration-panel"'));
    });

    await t.test("comparador exige duas seleções e mostra unidades, período, cobertura e limitação da sessão", () => {
      assert.doesNotMatch(render("/dashboard?aba=comparar"), /Selecione pelo menos duas|class="monitoring-update"/);
      const markup = render("/dashboard?aba=comparar&app=a&app=b");
      for (const text of ["comparison-table", "Mesmo intervalo de consulta", "Energia (kWh)", "Emissões (kg CO₂e)"])
        assert.ok(markup.includes(text));
      assert.match(render("/dashboard?aba=comparar&app=a&app=missing"), /seleção\(ões\) não está/);
      const layout = render("/dashboard?aba=comparar&pais=Brazil", AppLayout);
      assert.ok(layout.includes('class="monitoring-home"'));
      assert.ok(!layout.includes('aria-label="Navegação principal"'));
      assert.ok(!layout.includes('href="/comparar'));
      assert.equal((markup.match(/<h1/g) ?? []).length, 1);
      assert.ok(!markup.includes("Voltar ao monitoramento"));
      assert.ok(markup.includes('data-view="comparar" hidden=""'));
      assert.ok(markup.includes('aria-label="Comparação de aplicações"'));
      assert.ok(!markup.includes('class="evolution-chart-panel"'));
      assert.match(markup, /role="tab"[^>]*aria-selected="true"[^>]*>Comparar<\/button>/);
      assert.ok(markup.indexOf('>Evolução</button>') < markup.indexOf('>Comparar</button>'));
      assert.ok(!render("/dashboard").includes('class="comparison-content"'));
      assert.ok(!render("/dashboard?aba=evolucao").includes('class="comparison-content"'));
    });
  } finally {
    await vite.close();
  }
});
