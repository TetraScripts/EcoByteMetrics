import { ServicesError } from "../Services/services.service";
import {
    Metric,
    createMetricRepository,
    getMetricByIdRepository,
    listMetricsByServiceIdRepository,
    CreateMetricInput,
} from "./metric.repository";

export class MetricError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.name = "MetricError";
    }
}

function validateMetricId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new MetricError("ID da métrica inválido", 400);
    }
}

function validateServiceId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ServicesError("ID do serviço inválido", 400);
    }
}

function validateMetricInput(metricInput: CreateMetricInput): CreateMetricInput {
    validateServiceId(metricInput.id_service);

    const cpu = metricInput.cpu_metric;
    if (!Number.isFinite(cpu) || cpu < 0 || cpu > 100) {
        throw new MetricError("Valor de CPU inválido (esperado entre 0 e 100)", 400);
    }

    const otherMetrics = [metricInput.ram_metric, metricInput.hd_metric, metricInput.network_metric];
    if (otherMetrics.some((value) => !Number.isFinite(value) || value < 0)) {
        throw new MetricError("Memória, disco e rede devem ser finitos e não negativos", 400);
    }

    if (!Number.isFinite(metricInput.colletion_interval_metric) || metricInput.colletion_interval_metric <= 0) {
        throw new MetricError("Intervalo de coleta inválido", 400);
    }
    if (!metricInput.date_houry || Number.isNaN(new Date(metricInput.date_houry).getTime())) {
        throw new MetricError("Timestamp inválido", 400);
    }
    return metricInput;
}

function handleRepositoryError(error: unknown): never {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new MetricError("A amostra de métrica já existe para esse instante.", 409);
    }
    throw error;
}

export async function createMetricService(metricInput: CreateMetricInput): Promise<Metric> {
    const data = validateMetricInput(metricInput);
    try {
        return await createMetricRepository(data);
    } catch (error: unknown) {
        handleRepositoryError(error);
    }
}

export async function getMetricByIdService(id_metric: number): Promise<Metric | null> {
    validateMetricId(id_metric);
    const metric = await getMetricByIdRepository(id_metric);
    if (!metric) {
        throw new MetricError("Métrica não encontrada", 404);
    }
    return metric;
}

export async function listMetricsByServiceIdService(id_service: number): Promise<Metric[]> {
    validateServiceId(id_service);
    const metrics = await listMetricsByServiceIdRepository(id_service);
    if (metrics.length === 0) {
        throw new ServicesError("Nenhuma métrica encontrada para o serviço especificado", 404);
    }
    return metrics;
}
