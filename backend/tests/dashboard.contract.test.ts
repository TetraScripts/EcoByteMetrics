import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import app from "../src/app.js";

import {
    refreshDiscoveredServices,
    refreshServiceMetrics,
    resetMetricsFetcher,
    resetServicesFetcher,
    setMetricsFetcherForTesting,
    setServicesFetcherForTesting,
} from "../src/modules/Services/services.service.js";

import type {
    AggregatorService,
    ServiceMetrics,
} from "../src/integrations/metrics-api.js";

// Tipo de serviço com as novas coordenadas exigidas pela Task #113.
type ServiceWithCoordinates = AggregatorService & {
    latitude_location: number;
    longitude_location: number;
};

// Serviço fictício utilizado nos testes.
const service: AggregatorService = {
    id: "dashboard-contract-service",
    name: "Dashboard contract service",
    location: {
        region_code: "SA-SP",
        country: "Brasil",
        region: "São Paulo",
        city: "São Paulo",
        latitude: -23.55,
        longitude: -46.63,
    },
    metrics_path: "/metrics/dashboard-contract-service",
};

// Métricas fictícias utilizadas nos testes.
const metrics: ServiceMetrics = {
    collection_interval_seconds: 30,
    metrics: {
        cpu_percent: 45,
        memory_gb: 2.5,
        disk_gb: 10,
        network_gb: 0.4,
    },
};

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

// Preparação dos dados e inicialização do servidor.
before(async () => {
    setServicesFetcherForTesting(async () => [service]);
    setMetricsFetcherForTesting(async () => metrics);

    await refreshDiscoveredServices();
    await refreshServiceMetrics();

    server = app.listen(0, "127.0.0.1");

    await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    const address = server.address();

    assert.ok(address && typeof address !== "string");

    baseUrl = `http://127.0.0.1:${address.port}`;
});

// Encerramento do servidor e restauração dos fetchers.
after(async () => {
    if (server) {
        await new Promise<void>((resolve, reject) => {
            server.close((error) =>
                error ? reject(error) : resolve()
            );
        });
    }

    resetServicesFetcher();
    resetMetricsFetcher();
});

describe("contrato das rotas consumidas pelo dashboard", () => {

    // Teste 1: catálogo de serviços e coordenadas geográficas.
    it("GET /services retorna o catálogo, coordenadas e timestamp ISO de descoberta", async () => {
        const response = await fetch(`${baseUrl}/services`);

        const body = await response.json() as {
            services: ServiceWithCoordinates[];
            lastUpdatedAt: string | null;
        };

        assert.equal(response.status, 200);

        assert.match(
            response.headers.get("content-type") ?? "",
            /application\/json/
        );

        assert.equal(body.services.length, 1);

        assert.equal(
            body.services[0].id,
            service.id
        );

        assert.equal(
            body.services[0].latitude_location,
            service.location.latitude
        );

        assert.equal(
            body.services[0].longitude_location,
            service.location.longitude
        );

        // Garante que a estrutura original de localização foi preservada.
        assert.deepEqual(
            body.services[0].location,
            service.location
        );

        assert.ok(body.lastUpdatedAt);

        assert.match(
            body.lastUpdatedAt,
            /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/
        );

        assert.ok(
            Number.isFinite(Date.parse(body.lastUpdatedAt))
        );
    });

    // Teste 2: métricas de todos os serviços e suas coordenadas.
    it("GET /metrics retorna as métricas coletadas com as coordenadas de cada serviço", async () => {
        const response = await fetch(`${baseUrl}/metrics`);

        const body = await response.json() as {
            metrics: Array<{
                serviceId: string;
                metrics: ServiceMetrics;
                updatedAt: string;
                latitude_location: number | null;
                longitude_location: number | null;
            }>;
        };

        assert.equal(response.status, 200);

        assert.match(
            response.headers.get("content-type") ?? "",
            /application\/json/
        );

        assert.equal(body.metrics.length, 1);

        const collected = body.metrics.find(
            (item) => item.serviceId === service.id
        );

        assert.ok(collected);

        assert.deepEqual(
            collected.metrics,
            metrics
        );

        assert.equal(
            collected.latitude_location,
            service.location.latitude
        );

        assert.equal(
            collected.longitude_location,
            service.location.longitude
        );

        assert.match(
            collected.updatedAt,
            /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/
        );

        assert.ok(
            Number.isFinite(Date.parse(collected.updatedAt))
        );
    });

    // Teste 3: métricas individuais e coordenadas do serviço.
    it("GET /metrics/:serviceId retorna o cache com métricas, coordenadas e horário de coleta", async () => {
        const response = await fetch(
            `${baseUrl}/metrics/${encodeURIComponent(service.id)}`
        );

        const body = await response.json() as {
            serviceId: string;
            metrics: ServiceMetrics;
            updatedAt: string;
            latitude_location: number | null;
            longitude_location: number | null;
        };

        assert.equal(response.status, 200);

        assert.match(
            response.headers.get("content-type") ?? "",
            /application\/json/
        );

        assert.equal(body.serviceId, service.id);

        assert.deepEqual(
            body.metrics,
            metrics
        );

        assert.equal(
            body.latitude_location,
            service.location.latitude
        );

        assert.equal(
            body.longitude_location,
            service.location.longitude
        );

        assert.match(
            body.updatedAt,
            /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/
        );

        assert.ok(
            Number.isFinite(Date.parse(body.updatedAt))
        );
    });

    // Teste 4: resposta 404 para serviços sem métricas.
    it("GET /metrics/:serviceId retorna 404 com identificador para serviço sem métricas", async () => {
        const missingServiceId = "service-without-metrics";

        const response = await fetch(
            `${baseUrl}/metrics/${encodeURIComponent(missingServiceId)}`
        );

        const body = await response.json() as {
            error: string;
            message: string;
            serviceId: string;
        };

        assert.equal(response.status, 404);

        assert.match(
            response.headers.get("content-type") ?? "",
            /application\/json/
        );

        assert.equal(
            body.error,
            "metrics_missing"
        );

        assert.equal(
            body.message,
            "O serviço ainda não forneceu métricas válidas."
        );

        assert.equal(
            body.serviceId,
            missingServiceId
        );
    });

});