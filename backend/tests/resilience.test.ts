import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import app from "../src/app.js";
import type {
    AggregatorService,
    ServiceMetrics,
} from "../src/integrations/metrics-api.js";
import {
    getCollectionFailure,
    getCollectedMetricsByServiceId,
    refreshDiscoveredServices,
    refreshServiceMetrics,
    resetCollectedMetricsForTesting,
    resetMetricsFetcher,
    resetServicesFetcher,
    setMetricsFetcherForTesting,
    setServicesFetcherForTesting,
} from "../src/modules/Services/services.service.js";
import { getDashboardSummary } from "../src/modules/Dashboard/dashboard.service.js";

const serviceIds = ["timeout", "timeout-http-error", "missing-metrics", "healthy"];
const services: AggregatorService[] = serviceIds.map((id) => ({
    id,
    name: id,
    location: {
        region_code: "SA-SP",
        country: "Brasil",
        region: "São Paulo",
        city: "São Paulo",
        latitude: -23.55,
        longitude: -46.63,
    },
    metrics_path: `/metrics/${id}`,
}));
const recoveredMetrics: ServiceMetrics = {
    collection_interval_seconds: 30,
    metrics: {
        cpu_percent: 35,
        memory_gb: 1.5,
        disk_gb: 5,
        network_gb: 0.2,
    },
};

let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
    resetCollectedMetricsForTesting();
    setServicesFetcherForTesting(async () => services);
    await refreshDiscoveredServices();
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
});

describe("resiliência, estados e recuperação da coleta", () => {
    it("isola timeout/HTTP/ausência, sinaliza estados distintos e recupera na coleta seguinte", async () => {
        const requested: string[] = [];
        setMetricsFetcherForTesting(async (serviceId) => {
            requested.push(serviceId);
            return recoveredMetrics;
        });
        await refreshServiceMetrics();
        requested.length = 0;

        setMetricsFetcherForTesting(async (serviceId) => {
            requested.push(serviceId);
            if (serviceId === "timeout") {
                throw new Error("TimeoutError: upstream request timed out");
            }
            if (serviceId === "timeout-http-error") {
                throw new Error("Erro ao consultar métricas: HTTP 503");
            }
            if (serviceId === "missing-metrics") {
                throw new Error("Erro ao consultar métricas: HTTP 404");
            }
            return recoveredMetrics;
        });

        await refreshServiceMetrics();

        assert.deepEqual(requested, serviceIds);
        assert.equal(getCollectionFailure("timeout")?.reason, "unavailable");
        assert.equal(
            getCollectionFailure("timeout")?.message,
            "Tempo limite excedido ao consultar o serviço.",
        );
        assert.equal(getCollectionFailure("timeout-http-error")?.reason, "unavailable");
        assert.equal(getCollectionFailure("missing-metrics")?.reason, "missing");
        assert.ok(getCollectedMetricsByServiceId("healthy"));
        assert.ok(getCollectedMetricsByServiceId("timeout"));
        assert.ok(getCollectedMetricsByServiceId("timeout-http-error"));
        assert.ok(getCollectedMetricsByServiceId("missing-metrics"));
        const failedSummary = getDashboardSummary();
        assert.equal(failedSummary.totalServicos, 4);
        assert.equal(failedSummary.servicosAtivos, 1);
        assert.equal(failedSummary.servicosIndisponiveis, 2);
        assert.equal(failedSummary.servicosSemMetricas, 1);

        const [timeoutResponse, httpErrorResponse, missingResponse, healthyResponse] =
            await Promise.all(serviceIds.map((id) => fetch(`${baseUrl}/metrics/${id}`)));
        const timeoutBody = await timeoutResponse.json() as { error: string; message: string };
        const httpErrorBody = await httpErrorResponse.json() as { error: string; message: string };
        const missingBody = await missingResponse.json() as { error: string; message: string };
        const healthyBody = await healthyResponse.json() as { serviceId: string; metrics: ServiceMetrics };

        assert.equal(timeoutResponse.status, 503);
        assert.equal(timeoutBody.error, "metrics_unavailable");
        assert.equal(timeoutBody.message, "Tempo limite excedido ao consultar o serviço.");
        assert.equal(httpErrorResponse.status, 503);
        assert.equal(httpErrorBody.error, "metrics_unavailable");
        assert.equal(
            httpErrorBody.message,
            "Não foi possível consultar o serviço de métricas.",
        );
        assert.equal(missingResponse.status, 404);
        assert.equal(missingBody.error, "metrics_missing");
        assert.equal(missingBody.message, "O serviço respondeu, mas não forneceu métricas.");
        assert.equal(healthyResponse.status, 200);
        assert.equal(healthyBody.serviceId, "healthy");
        assert.deepEqual(healthyBody.metrics, recoveredMetrics);

        setMetricsFetcherForTesting(async () => recoveredMetrics);
        await refreshServiceMetrics();

        for (const id of serviceIds) {
            assert.equal(getCollectionFailure(id), undefined);
            const response = await fetch(`${baseUrl}/metrics/${id}`);
            const body = await response.json() as { serviceId: string };
            assert.equal(response.status, 200);
            assert.equal(body.serviceId, id);
        }
        const recoveredSummary = getDashboardSummary();
        assert.equal(recoveredSummary.servicosAtivos, 4);
        assert.equal(recoveredSummary.servicosIndisponiveis, 0);
        assert.equal(recoveredSummary.servicosSemMetricas, 0);
    });
});
