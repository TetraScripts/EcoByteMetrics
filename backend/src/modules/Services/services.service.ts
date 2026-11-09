import {
    fetchAvailableServices,
    fetchServiceMetrics,
    type AggregatorService,
    type ServiceMetrics,
} from "../../integrations/metrics-api.js";

import {
    Service,
    createServiceRepository,
    getServiceByIdRepository,
    listServicesByLocationIdRepository,
    listServicesRepository
} from "./service.repository.js";

export class ServicesError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.name = "ServicesError";
    }
}

function validateServiceId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ServicesError("ID do serviço inválido", 400);
    }
}
function validateLocationId(id: number): void {
    if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ServicesError("ID do Localização inválido", 400);
    }
}

function validadeServiceInput(serviceInput: Omit<Service, "id_service">): Omit<Service, "id_service"> {
    if (!serviceInput.id_location || !Number.isSafeInteger(serviceInput.id_location) || serviceInput.id_location <= 0) {
        throw new ServicesError("ID da localização inválido", 400);
    }
    if (!serviceInput.name_service || serviceInput.name_service.trim() === "") {
        throw new ServicesError("Nome do serviço inválido", 400);
    }
    if (!serviceInput.MatricPath_service || serviceInput.MatricPath_service.trim() === "") {
        throw new ServicesError("Caminho da métrica inválido", 400);
    }
    if (!serviceInput.MatricPath_service.startsWith("/")) {
        throw new ServicesError("Caminho da métrica deve começar com '/'", 400);
    }
    return serviceInput;
}

function handleRepositoryError(error: unknown): never {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        throw new ServicesError("Já existe um serviço com esse nome.", 409);
    }
    throw error; 
}

export async function createService(service:Service):Promise<Service> {
    const data = validadeServiceInput(service)
    try{
        const service = await createServiceRepository(data)
        return service;
    }catch(error){
        handleRepositoryError(error)
    }
}

export async function getServiceById(id_service:number):Promise<Service> {
    validateServiceId(id_service)
    const service = await getServiceByIdRepository(id_service)
    if(!service){
        throw new ServicesError("Serviço não encotrado", 404)
    }
    return service;
}

export async function listServiceByLocation(id_location:number):Promise<Service> {
    validateLocationId(id_location);
    const service = await listServicesByLocationIdRepository(id_location)
    if(!service){
        throw new ServicesError("Serviço não encotrado", 404)
    }
    return service;
}

export async function listServices():Promise<Service[]> {
    const service = await listServicesRepository()
    if(service.length === 0){
        throw new ServicesError("Não existe serviço", 404)
    }
    return service;
}

// função de agregação para criar um novo serviço
type ServicesFetcher = () => Promise<AggregatorService[]>;

export interface CollectedServiceMetrics {
    serviceId: string;
    metrics: ServiceMetrics;
    updatedAt: string;
}

export interface CollectionFailure {
    reason: "missing" | "unavailable";
}

type MetricsFetcher = (
    serviceId: string
) => Promise<ServiceMetrics>;

let fetchServices: ServicesFetcher = fetchAvailableServices;
let fetchMetrics: MetricsFetcher = fetchServiceMetrics;

let discoveredServices: AggregatorService[] = [];
let lastUpdatedAt: string | null = null;

const collectedMetrics = new Map<string, CollectedServiceMetrics>();
const collectedMetricsHistory = new Map<string, CollectedServiceMetrics[]>();
const collectionFailures = new Map<string, CollectionFailure>();
const METRICS_HISTORY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export async function refreshDiscoveredServices(): Promise<void> {
    const services = await fetchServices();

    // Atualiza a lista somente após uma consulta bem-sucedida.
    discoveredServices = services;
    lastUpdatedAt = new Date().toISOString();
}

export function getDiscoveredServices(): AggregatorService[] {
    return discoveredServices;
}

export function getServicesLastUpdatedAt(): string | null {
    return lastUpdatedAt;
}

// Consulta as métricas de todos os serviços descobertos.
// Uma falha individual não interrompe as consultas seguintes.
export async function refreshServiceMetrics(): Promise<void> {
    for (const service of discoveredServices) {
        try {
            const metrics = await fetchMetrics(service.id);
            const collected = {
                serviceId: service.id,
                metrics,
                updatedAt: new Date().toISOString(),
            };
            collectedMetrics.set(service.id, collected);
            collectionFailures.delete(service.id);

            const history = collectedMetricsHistory.get(service.id) ?? [];
            history.push(collected);
            collectedMetricsHistory.set(service.id, history);
        } catch (error: unknown) {
            collectionFailures.set(service.id, {
                reason:
                    error instanceof Error && /HTTP 404\b/.test(error.message)
                        ? "missing"
                        : "unavailable",
            });
            console.error(
                `Falha ao consultar métricas do serviço "${service.id}".`,
                error
            );
            // Mantém as últimas métricas válidas desse serviço.
        }
    }

    const minimumTimestamp = Date.now() - METRICS_HISTORY_RETENTION_MS;
    for (const [serviceId, history] of collectedMetricsHistory) {
        const retained = history.filter(
            (sample) => Date.parse(sample.updatedAt) >= minimumTimestamp,
        );
        if (retained.length) {
            collectedMetricsHistory.set(serviceId, retained);
        } else {
            collectedMetricsHistory.delete(serviceId);
        }
    }
}

export function getCollectedServiceMetrics(): CollectedServiceMetrics[] {
    return Array.from(collectedMetrics.values());
}

export function getCollectedMetricsByServiceId(serviceId: string): CollectedServiceMetrics | undefined {
    return collectedMetrics.get(serviceId);
}

export function getCollectedMetricsHistory(): CollectedServiceMetrics[] {
    return Array.from(collectedMetricsHistory.values()).flat();
}

export function getCollectionFailures(): ReadonlyMap<string, CollectionFailure> {
    return collectionFailures;
}

export function resetCollectedMetricsForTesting(): void {
    collectedMetrics.clear();
    collectedMetricsHistory.clear();
    collectionFailures.clear();
}

// Permite substituir a consulta de serviços durante testes.
export function setServicesFetcherForTesting(fetcher: ServicesFetcher): void {
    fetchServices = fetcher;
}

export function resetServicesFetcher(): void {
    fetchServices = fetchAvailableServices;
}

// Permite substituir a consulta de métricas durante testes.
export function setMetricsFetcherForTesting(fetcher: MetricsFetcher
): void {
    fetchMetrics = fetcher;
}

export function resetMetricsFetcher(): void {
    fetchMetrics = fetchServiceMetrics;
}
