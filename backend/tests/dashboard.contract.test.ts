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

after(async () => {
    if (server) {
        await new Promise<void>((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
        });
    }
    resetServicesFetcher();
    resetMetricsFetcher();
});

describe("contrato das rotas consumidas pelo dashboard", () => {
    it("GET /services retorna o catálogo e um timestamp ISO de descoberta", async () => {
        const response = await fetch(`${baseUrl}/services`);
        const body = await response.json() as {
            services: AggregatorService[];
            lastUpdatedAt: string | null;
        };

        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
        assert.deepEqual(body.services, [service]);
        assert.ok(body.lastUpdatedAt);
        assert.match(body.lastUpdatedAt, /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/);
        assert.ok(Number.isFinite(Date.parse(body.lastUpdatedAt)));
    });

    it("GET /metrics/:serviceId retorna o cache com métricas e horário de coleta", async () => {
        const response = await fetch(
            `${baseUrl}/metrics/${encodeURIComponent(service.id)}`,
        );
        const body = await response.json() as {
            serviceId: string;
            metrics: ServiceMetrics;
            updatedAt: string;
        };

        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
        assert.equal(body.serviceId, service.id);
        assert.deepEqual(body.metrics, metrics);
        assert.match(body.updatedAt, /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/);
        assert.ok(Number.isFinite(Date.parse(body.updatedAt)));
    });

    it("GET /metrics/:serviceId retorna 404 com identificador para serviço sem métricas", async () => {
        const missingServiceId = "service-without-metrics";
        const response = await fetch(
            `${baseUrl}/metrics/${encodeURIComponent(missingServiceId)}`,
        );
        const body = await response.json() as {
            error: string;
            serviceId: string;
        };

        assert.equal(response.status, 404);
        assert.match(response.headers.get("content-type") ?? "", /application\/json/);
        assert.equal(body.error, "metrics_missing");
        assert.equal(body.message, "O serviço ainda não forneceu métricas válidas.");
        assert.equal(body.serviceId, missingServiceId);
    });
});
