import { getCarbonIntensity } from "../../integrations/carbon-api.js";
import {
    getCollectedMetricsByServiceId,
    getCollectedMetricsHistory,
    getCollectionFailures,
    getDiscoveredServices,
    getServicesLastUpdatedAt,
    type CollectedServiceMetrics,
} from "../Services/services.service.js";

export type DashboardPeriod = "1h" | "24h" | "7d";
export type RankingMetric = "kwh" | "co2e";

const periodMilliseconds: Record<DashboardPeriod, number> = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
};
const ACTIVE_METRICS_MAX_AGE_MS = 90_000;

interface ImpactSample {
    energyKwh: number;
    emissionsCo2e: number | null;
}

function calculateImpact(
    collected: CollectedServiceMetrics,
    regionCode: string,
): ImpactSample | null {
    const { collection_interval_seconds: seconds, metrics } = collected.metrics;
    const values = [
        metrics.cpu_percent,
        metrics.memory_gb,
        metrics.disk_gb,
        metrics.network_gb,
        seconds,
    ];
    if (
        values.some((value) => !Number.isFinite(value) || value < 0) ||
        metrics.cpu_percent > 100 ||
        seconds <= 0
    ) {
        return null;
    }

    const estimatedPower =
        (metrics.cpu_percent / 100) * 100 +
        metrics.memory_gb * 0.375 +
        metrics.disk_gb * 0.01 +
        metrics.network_gb * 0.02;
    const energyKwh = (estimatedPower * (seconds / 3600)) / 1000;
    if (!Number.isFinite(energyKwh) || energyKwh < 0) return null;

    const intensity = getCarbonIntensity(regionCode);
    const emissionsCo2e =
        intensity === undefined ? null : energyKwh * intensity;
    return {
        energyKwh,
        emissionsCo2e:
            emissionsCo2e !== null && Number.isFinite(emissionsCo2e)
                ? emissionsCo2e
                : null,
    };
}

export function getDashboardSummary() {
    const services = getDiscoveredServices();
    const now = Date.now();
    let activeCount = 0;
    let unavailableCount = 0;
    let noMetricsCount = 0;
    let totalEnergyKwh = 0;
    let totalEmissionsCo2e = 0;
    let servicesWithEmissions = 0;
    let latestUpdateAt: string | null = null;

    for (const service of services) {
        const collected = getCollectedMetricsByServiceId(service.id);
        const age = collected ? now - Date.parse(collected.updatedAt) : null;
        if (collected && age !== null && age <= ACTIVE_METRICS_MAX_AGE_MS) {
            const impact = calculateImpact(collected, service.location.region_code);
            if (!impact) {
                noMetricsCount++;
            } else {
                activeCount++;
                totalEnergyKwh += impact.energyKwh;
                if (impact.emissionsCo2e !== null) {
                    totalEmissionsCo2e += impact.emissionsCo2e;
                    servicesWithEmissions++;
                }
            }
        } else if (collected || getCollectionFailures().get(service.id)?.reason === "unavailable") {
            unavailableCount++;
        } else {
            noMetricsCount++;
        }

        if (
            collected &&
            (!latestUpdateAt ||
                Date.parse(collected.updatedAt) > Date.parse(latestUpdateAt))
        ) {
            latestUpdateAt = collected.updatedAt;
        }
    }

    return {
        totalServicos: services.length,
        servicosAtivos: activeCount,
        servicosIndisponiveis: unavailableCount,
        servicosSemMetricas: noMetricsCount,
        consumoTotalKwh: totalEnergyKwh,
        emissaoTotalCo2e:
            servicesWithEmissions === activeCount
                ? totalEmissionsCo2e
                : null,
        dataHoraUltimaAtualizacao:
            latestUpdateAt ?? getServicesLastUpdatedAt(),
    };
}

export function getDashboardRanking(
    period: DashboardPeriod,
    orderBy: RankingMetric,
) {
    const now = Date.now();
    const currentServices = new Map(
        getDiscoveredServices().map((service) => [service.id, service]),
    );
    const minimumTimestamp = now - periodMilliseconds[period];
    const groups = new Map<
        string,
        { name: string; energyKwh: number; emissionsCo2e: number; completeEmissions: boolean }
    >();

    for (const sample of getCollectedMetricsHistory()) {
        const service = currentServices.get(sample.serviceId);
        const timestamp = Date.parse(sample.updatedAt);
        if (!service || timestamp < minimumTimestamp || timestamp > now) {
            continue;
        }

        const impact = calculateImpact(sample, service.location.region_code);
        if (!impact) continue;

        const entry = groups.get(service.id) ?? {
            name: service.name || service.id,
            energyKwh: 0,
            emissionsCo2e: 0,
            completeEmissions: true,
        };
        entry.energyKwh += impact.energyKwh;
        if (impact.emissionsCo2e === null) {
            entry.completeEmissions = false;
        } else {
            entry.emissionsCo2e += impact.emissionsCo2e;
        }
        groups.set(service.id, entry);
    }

    const entries = Array.from(groups, ([id, values]) => ({
        id_servico: id,
        nome: values.name,
        consumoKwh: values.energyKwh,
        emissaoCo2e: values.completeEmissions ? values.emissionsCo2e : null,
        value:
            orderBy === "kwh"
                ? values.energyKwh
                : values.completeEmissions
                  ? values.emissionsCo2e
                  : null,
    }))
        .filter(
            (entry): entry is typeof entry & { value: number } =>
                entry.value !== null,
        )
        .sort(
            (a, b) =>
                b.value - a.value ||
                a.nome.localeCompare(b.nome, "pt-BR") ||
                a.id_servico.localeCompare(b.id_servico),
        )
        .map(({ value: _value, ...entry }, index) => ({
            posicao: index + 1,
            ...entry,
        }));

    return {
        periodo: period,
        ordenadoPor: orderBy,
        ranking: entries,
    };
}
