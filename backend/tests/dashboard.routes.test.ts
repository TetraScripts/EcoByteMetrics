import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import app from "../src/app.js";
import {
    refreshCarbonRegionFactors,
    resetCarbonFactorsForTesting,
    setCarbonFactorsFetcherForTesting,
} from "../src/integrations/carbon-api.js";
import type {
    AggregatorService,
    ServiceMetrics,
} from "../src/integrations/metrics-api.js";
import {
    refreshDiscoveredServices,
    refreshServiceMetrics,
    resetCollectedMetricsForTesting,
    resetMetricsFetcher,
    resetServicesFetcher,
    setMetricsFetcherForTesting,
    setServicesFetcherForTesting,
} from "../src/modules/Services/services.service.js";

const serviceA: AggregatorService = {
    id: "service-a",
    name: "Serviço A",
    location: {
        region_code: "REGION-A",
        country: "Brasil",
        region: "São Paulo",
        city: "São Paulo",
        latitude: -23.55,
        longitude: -46.63,
    },
    metrics_path: "/metrics/service-a",
};

const serviceB: AggregatorService = {
    ...serviceA,
    id: "service-b",
    name: "Serviço B",
    location: { ...serviceA.location, region_code: "REGION-B" },
};

const serviceWithoutMetrics: AggregatorService = {
    ...serviceA,
    id: "service-without-metrics",
    name: "Sem métricas",
};

const unavailableService: AggregatorService = {
    ...serviceA,
    id: "unavailable-service",
    name: "Indisponível",
};

const metricsById: Record<string, ServiceMetrics> = {
    "service-a": {
        collection_interval_seconds: 30,
        metrics: {
            cpu_percent: 60,
            memory_gb: 2,
            disk_gb: 8,
            network_gb: 0.4,
        },
    },
    "service-b": {
        collection_interval_seconds: 30,
        metrics: {
            cpu_percent: 20,
            memory_gb: 1,
            disk_gb: 4,
            network_gb: 0.2,
        },
    },
};

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
    resetCollectedMetricsForTesting();
    setServicesFetcherForTesting(async () => [
        serviceA,
        serviceB,
        serviceWithoutMetrics,
        unavailableService,
    ]);
    setMetricsFetcherForTesting(async (serviceId) => {
        if (serviceId === serviceWithoutMetrics.id) {
            throw new Error("Agregador respondeu HTTP 404");
        }
        if (serviceId === unavailableService.id) {
            throw new Error("Agregador respondeu HTTP 503");
        }
        return metricsById[serviceId]!;
    });
    setCarbonFactorsFetcherForTesting(async () => [
        { code: "REGION-A", carbonIntensity: 100 },
        { code: "REGION-B", carbonIntensity: 500 },
    ]);
    await refreshDiscoveredServices();
    await refreshServiceMetrics();
    await refreshCarbonRegionFactors();

    server = app.listen(0, "127.0.0.1");
    await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    if (server) {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
    resetServicesFetcher();
    resetMetricsFetcher();
    resetCollectedMetricsForTesting();
    resetCarbonFactorsForTesting();
});

describe("contrato das rotas de resumo e ranking do dashboard", () => {
    it("GET /api/dashboard/summary agrega dados, status e cobertura de emissões", async () => {
        const response = await fetch(`${baseUrl}/api/dashboard/summary`);
        const body = await response.json() as {
            totalServicos: number;
            servicosAtivos: number;
            servicosIndisponiveis: number;
            servicosSemMetricas: number;
            consumoTotalKwh: number;
            emissaoTotalCo2e: number | null;
            dataHoraUltimaAtualizacao: string | null;
        };
        const serviceAEnergy =
            (60 + 2 * 0.375 + 8 * 0.01 + 0.4 * 0.02) * 30 / 3_600_000;
        const serviceBEnergy =
            (20 + 1 * 0.375 + 4 * 0.01 + 0.2 * 0.02) * 30 / 3_600_000;
        const expectedEnergy = serviceAEnergy + serviceBEnergy;

        assert.equal(response.status, 200);
        assert.equal(body.totalServicos, 4);
        assert.equal(body.servicosAtivos, 2);
        assert.equal(body.servicosIndisponiveis, 1);
        assert.equal(body.servicosSemMetricas, 1);
        assert.ok(Math.abs(body.consumoTotalKwh - expectedEnergy) < 1e-12);
        assert.ok(
            Math.abs(body.emissaoTotalCo2e! - (serviceAEnergy * 100 + serviceBEnergy * 500)) < 1e-12,
        );
        assert.ok(body.dataHoraUltimaAtualizacao);
        assert.match(body.dataHoraUltimaAtualizacao, /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/);
        assert.ok(Number.isFinite(Date.parse(body.dataHoraUltimaAtualizacao)));
    });

    it("GET /api/dashboard/ranking ordena energia e emissões no período pedido", async () => {
        const [energyResponse, emissionsResponse] = await Promise.all([
            fetch(`${baseUrl}/api/dashboard/ranking?ordenarPor=kwh&periodo=1h`),
            fetch(`${baseUrl}/api/dashboard/ranking?ordenarPor=co2e&periodo=7d`),
        ]);
        const energyBody = await energyResponse.json() as {
            periodo: string;
            ordenadoPor: string;
            ranking: Array<{ posicao: number; id_servico: string; consumoKwh: number; emissaoCo2e: number }>;
        };
        const emissionsBody = await emissionsResponse.json() as typeof energyBody;

        assert.equal(energyResponse.status, 200);
        assert.equal(energyBody.periodo, "1h");
        assert.equal(energyBody.ordenadoPor, "kwh");
        assert.deepEqual(
            energyBody.ranking.map(({ posicao, id_servico }) => [posicao, id_servico]),
            [[1, "service-a"], [2, "service-b"]],
        );
        assert.equal(emissionsResponse.status, 200);
        assert.equal(emissionsBody.periodo, "7d");
        assert.equal(emissionsBody.ordenadoPor, "co2e");
        assert.deepEqual(
            emissionsBody.ranking.map(({ posicao, id_servico }) => [posicao, id_servico]),
            [[1, "service-b"], [2, "service-a"]],
        );
        assert.ok(energyBody.ranking.every((entry) =>
            Number.isFinite(entry.consumoKwh) && Number.isFinite(entry.emissaoCo2e),
        ));
    });

    it("usa os padrões documentados e rejeita filtros inválidos com 400", async () => {
        const [defaultResponse, badOrderResponse, badPeriodResponse] =
            await Promise.all([
                fetch(`${baseUrl}/api/dashboard/ranking`),
                fetch(`${baseUrl}/api/dashboard/ranking?ordenarPor=cpu`),
                fetch(`${baseUrl}/api/dashboard/ranking?periodo=30d`),
            ]);
        const defaultBody = await defaultResponse.json() as {
            periodo: string;
            ordenadoPor: string;
            ranking: unknown[];
        };
        const badOrderBody = await badOrderResponse.json() as { error: string };
        const badPeriodBody = await badPeriodResponse.json() as { error: string };

        assert.equal(defaultResponse.status, 200);
        assert.equal(defaultBody.periodo, "24h");
        assert.equal(defaultBody.ordenadoPor, "co2e");
        assert.equal(badOrderResponse.status, 400);
        assert.match(badOrderBody.error, /ordenarPor/);
        assert.equal(badPeriodResponse.status, 400);
        assert.match(badPeriodBody.error, /periodo/);
    });

    it("não inventa emissões quando o fator regional não está disponível", async () => {
        setCarbonFactorsFetcherForTesting(async () => []);
        await refreshCarbonRegionFactors();
        const [summaryResponse, rankingResponse] = await Promise.all([
            fetch(`${baseUrl}/api/dashboard/summary`),
            fetch(`${baseUrl}/api/dashboard/ranking?ordenarPor=co2e`),
        ]);
        const summaryBody = await summaryResponse.json() as {
            emissaoTotalCo2e: number | null;
        };
        const rankingBody = await rankingResponse.json() as {
            ranking: unknown[];
        };

        assert.equal(summaryResponse.status, 200);
        assert.equal(summaryBody.emissaoTotalCo2e, null);
        assert.equal(rankingResponse.status, 200);
        assert.deepEqual(rankingBody.ranking, []);
    });

    it("responde ranking vazio quando não há serviços ou amostras no escopo", async () => {
        setServicesFetcherForTesting(async () => []);
        await refreshDiscoveredServices();
        const response = await fetch(`${baseUrl}/api/dashboard/ranking`);
        const body = await response.json() as {
            periodo: string;
            ordenadoPor: string;
            ranking: unknown[];
        };

        assert.equal(response.status, 200);
        assert.equal(body.periodo, "24h");
        assert.equal(body.ordenadoPor, "co2e");
        assert.deepEqual(body.ranking, []);
    });
});
