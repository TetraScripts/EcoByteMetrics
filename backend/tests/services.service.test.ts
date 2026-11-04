import { ServiceAPISevice } from "../src/integrations/services-api";
import { WorkerService } from "../src/modules/Worker/worker.metric.service";
import { WorkerCarbons } from "../src/modules/Worker/worker.carbon.service";
import pool from "../src/db/connection";
import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import type {
    AggregatorService,
    ServiceMetrics,
} from "../src/integrations/metrics-api.js";

import {
    getDiscoveredServices,
    getServicesLastUpdatedAt,
    refreshDiscoveredServices,
    resetServicesFetcher,
    setServicesFetcherForTesting,
    getCollectedServiceMetrics,
    getCollectedMetricsByServiceId,
    refreshServiceMetrics,
    resetMetricsFetcher,
    setMetricsFetcherForTesting,
    resetCarbonRegionsFetcher,
    setCarbonRegionsFetcherForTesting,
} from "../src/modules/Services/services.service.js";

const billingService: AggregatorService = {
    id: "billing-api",
    name: "billing-api",
    location: {
        region_code: "SA-SP",
        country: "Brasil",
        region: "São Paulo",
        city: "São Paulo",
        latitude: -23.55,
        longitude: -46.63,
    },
    metrics_path: "/metrics/billing-api",
};
const checkoutService: AggregatorService = {
    id: "checkout-worker",
    name: "checkout-worker",
    location: {
        region_code: "SA-SP",
        country: "Brasil",
        region: "São Paulo",
        city: "São Paulo",
        latitude: -23.55,
        longitude: -46.63,
    },
    metrics_path: "/metrics/checkout-worker",
};
const billingMetrics: ServiceMetrics = {
    collection_interval_seconds: 30,
    metrics: {
        cpu_percent: 45,
        memory_gb: 2.5,
        disk_gb: 10,
        network_gb: 0.4,
    },
};
const updatedBillingMetrics: ServiceMetrics = {
    collection_interval_seconds: 30,
    metrics: {
        cpu_percent: 60,
        memory_gb: 3,
        disk_gb: 12,
        network_gb: 0.6,
    },
};
const checkoutMetrics: ServiceMetrics = {
    collection_interval_seconds: 30,
    metrics: {
        cpu_percent: 25,
        memory_gb: 1.5,
        disk_gb: 8,
        network_gb: 0.2,
    },
};

beforeEach(() => {
    setCarbonRegionsFetcherForTesting(async () => []);
});
afterEach(() => {
    resetServicesFetcher();
    resetMetricsFetcher();
    resetCarbonRegionsFetcher();
});

describe("Serviço de descoberta de serviços", () => {
    it("armazena os serviços após uma consulta bem-sucedida", async () => {
        setServicesFetcherForTesting(async () => [billingService]);
        await refreshDiscoveredServices();
        assert.deepEqual(getDiscoveredServices(), [billingService]);
        assert.notEqual(getServicesLastUpdatedAt(), null);
    });

    it("atualiza o cache quando um novo serviço aparece", async () => {
        setServicesFetcherForTesting(async () => [billingService]);
        await refreshDiscoveredServices();
        setServicesFetcherForTesting(async () => [billingService, checkoutService]);
        await refreshDiscoveredServices();
        assert.deepEqual(getDiscoveredServices(), [billingService, checkoutService]);
    });

    it("preserva o último cache válido quando a consulta falha", async () => {
        setServicesFetcherForTesting(async () => [billingService]);
        await refreshDiscoveredServices();
        const previousServices = getDiscoveredServices();
        const previousUpdatedAt = getServicesLastUpdatedAt();
        setServicesFetcherForTesting(async () => { throw new Error("Falha simulada"); });
        await refreshDiscoveredServices();
        assert.deepEqual(getDiscoveredServices(), previousServices);
        assert.equal(getServicesLastUpdatedAt(), previousUpdatedAt);
    });
});

describe("Serviço de coleta de métricas em memória", () => {
    it("atualiza o cache com valores variáveis de cada consulta", async () => {
        setServicesFetcherForTesting(async () => [billingService]);
        await refreshDiscoveredServices();
        setMetricsFetcherForTesting(async () => billingMetrics);
        await refreshServiceMetrics();
        setMetricsFetcherForTesting(async () => updatedBillingMetrics);
        await refreshServiceMetrics();
        assert.deepEqual(getCollectedMetricsByServiceId("billing-api")?.metrics, updatedBillingMetrics);
    });

    it("preserva a última amostra e continua com os outros serviços quando uma consulta falha", async () => {
        setServicesFetcherForTesting(async () => [billingService, checkoutService]);
        await refreshDiscoveredServices();
        setMetricsFetcherForTesting(async (serviceId) => serviceId === "billing-api" ? billingMetrics : checkoutMetrics);
        await refreshServiceMetrics();
        const previousBilling = getCollectedMetricsByServiceId("billing-api");
        assert.ok(previousBilling);
        setMetricsFetcherForTesting(async (serviceId) => {
            if (serviceId === "billing-api") throw new Error("Falha simulada");
            return updatedBillingMetrics;
        });
        await refreshServiceMetrics();
        assert.deepEqual(getCollectedMetricsByServiceId("billing-api")?.metrics, previousBilling.metrics);
        assert.deepEqual(getCollectedMetricsByServiceId("checkout-worker")?.metrics, updatedBillingMetrics);
        assert.ok(getCollectedServiceMetrics().length >= 2);
    });
});

describe("Persistência e publicação das métricas", () => {
    it("o worker grava a amostra e o fator de carbono vinculados à mesma localização", async t => {
        const inserts: { sql: string; values: unknown[] }[] = [];
        t.mock.method(pool, "query", async (sql: string, values: unknown[]) => {
            if (/SELECT \* FROM locations/i.test(sql)) return { rows: [{ id_location: 10 }] };
            if (/SELECT \* FROM services/i.test(sql)) return { rows: [{ id_service: 20, id_location: 10 }] };
            if (/INSERT INTO (carbons|Metrics)/i.test(sql)) {
                inserts.push({ sql, values });
                return { rows: [{ id_location: 10, id_service: 20 }] };
            }
            if (/UPDATE services/i.test(sql)) return { rows: [] };
            throw new Error("Consulta inesperada no teste de persistência");
        });
        const serviceAPI = new ServiceAPISevice();
        t.mock.method(serviceAPI, "getMetricRegionDetails", async () => billingMetrics);
        await new WorkerCarbons().listarCarbons([{
            code: "SA-SP", country: "Brasil", region: "São Paulo", city: "São Paulo",
            latitude: -23.55, longitude: -46.63,
            carbon_intensity_gco2e_per_kwh: 85, renewable_share_percent: 70,
        }]);
        await new WorkerService().listarServices([billingService], serviceAPI);
        const carbon = inserts.find(insert => /carbons/i.test(insert.sql))!;
        const metric = inserts.find(insert => /Metrics/i.test(insert.sql))!;
        assert.deepEqual(carbon.values.slice(0, 3), [10, 85, 70]);
        assert.deepEqual(metric.values.slice(0, 5), [20, 45, 2.5, 10, 0.4]);
        assert.equal(metric.values[6], 30);
        assert.deepEqual(getCollectedMetricsByServiceId("billing-api")?.metrics, billingMetrics);
        assert.match(carbon.values[3] as string, /^\d{4}-\d{2}-\d{2}T.*Z$/);
        assert.match(metric.values[5] as string, /^\d{4}-\d{2}-\d{2}T.*Z$/);
    });

});
