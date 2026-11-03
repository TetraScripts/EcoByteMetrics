import { CarbonRegionFactor, fetchCarbonRegions } from "../../integrations/carbon-api.js";
import type { Metric as ApiMetric, ServiceMetrics as DiscoveredService } from "../../integrations/api.types.js";
import {
    fetchAvailableServices,
    fetchServiceMetrics,
    type AggregatorService,
    type ServiceMetrics,
} from "../../integrations/metrics-api.js";

import {
    Service,
    createServiceInput,
    createServiceRepository,
    getServiceByExistRepository,
    getServiceByIdRepository,
    listServicesByLocationIdRepository,
    listServicesRepository,
    updateServiceStatusRepository
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
    if (!serviceInput.path_metric || serviceInput.path_metric.trim() === "") {
        throw new ServicesError("Caminho da métrica inválido", 400);
    }
    if (!serviceInput.path_metric.startsWith("/")) {
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

export async function createService(service:createServiceInput):Promise<Service> {
    const data = validadeServiceInput(service)
    try{
        const service = await createServiceRepository(data)
        return service;
    }catch(error){
        handleRepositoryError(error)
    }
}
export async function updateServiceStatus(services_name:string[]): Promise<void> {
  await updateServiceStatusRepository(services_name);
}
export async function getServiceById(id_service:number):Promise<Service> {
    validateServiceId(id_service)
    const service = await getServiceByIdRepository(id_service)
    if(!service){
        throw new ServicesError("Serviço não encotrado", 404)
    }
    return service;
}

export async function getServiceByExist(name_service:string):Promise<Service|null> {
    const service = await getServiceByExistRepository(name_service)
    return service||null;
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
// função de agregação para criar um novo serviço
type ServicesFetcher = () => Promise<AggregatorService[]>;

export interface CollectedServiceMetrics {
    serviceId: string;
    metrics: ServiceMetrics;
    updatedAt: string;
}

type MetricsFetcher = (
    serviceId: string
) => Promise<ServiceMetrics>;
type CarbonRegionsFetcher = () => Promise<CarbonRegionFactor[]>;

let fetchServices: ServicesFetcher = fetchAvailableServices;
let fetchMetrics: MetricsFetcher = fetchServiceMetrics;
let fetchCarbonFactors: CarbonRegionsFetcher = fetchCarbonRegions;

let discoveredServices: AggregatorService[] = [];
let lastUpdatedAt: string | null = null;

const collectedMetrics = new Map<string, CollectedServiceMetrics>();

/** Syncs aggregator discovery data into the dashboard cache. */
export function recordDiscoveredServices(services: DiscoveredService[]): void {
    discoveredServices = services;
    lastUpdatedAt = new Date().toISOString();
}

/** Publishes only samples that have already been persisted successfully. */
export function recordCollectedServiceMetrics(serviceId: string, sample: ApiMetric): void {
    collectedMetrics.set(serviceId, {
        serviceId,
        metrics: {
            collection_interval_seconds: sample.collection_interval_seconds,
            metrics: { ...sample.metrics },
        },
        updatedAt: new Date().toISOString(),
    });
}

export async function refreshDiscoveredServices(): Promise<void> {
    try {
        const services = await fetchServices();
        // Atualiza a lista somente após uma consulta bem-sucedida.
        recordDiscoveredServices(services);
    } catch (error: unknown) {
        console.error(
            "Falha ao consultar serviços descobertos.",
            error
        );
    }
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
    let carbonFactors = new Map<string, number>();
    try {
        carbonFactors = new Map(
            (await fetchCarbonFactors()).map((factor) => [
                factor.code,
                factor.carbonIntensity,
            ])
        );
    } catch (error: unknown) {
        console.error("Falha ao consultar fatores de carbono.", error);
    }

    for (const service of discoveredServices) {
        let metrics: ServiceMetrics;
        try {
            metrics = await fetchMetrics(service.id);
        } catch (error: unknown) {
            console.error(
                `Falha ao consultar métricas do serviço "${service.id}".`,
                error
            );
            continue;
        }

        const collectedAt = new Date();
        collectedMetrics.set(service.id, {
            serviceId: service.id,
            metrics,
            updatedAt: collectedAt.toISOString(),
        });
    }
}

export function getCollectedServiceMetrics(): CollectedServiceMetrics[] {
    return Array.from(collectedMetrics.values());
}

export function getCollectedMetricsByServiceId(serviceId: string): CollectedServiceMetrics | undefined {
    return collectedMetrics.get(serviceId);
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

export function setCarbonRegionsFetcherForTesting(
    fetcher: CarbonRegionsFetcher
): void {
    fetchCarbonFactors = fetcher;
}

export function resetCarbonRegionsFetcher(): void {
    fetchCarbonFactors = fetchCarbonRegions;
}

