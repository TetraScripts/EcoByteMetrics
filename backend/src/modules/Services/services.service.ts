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
    ServiceRepository,
    createServiceInput
} from "./service.repository.js";

export class ServicesError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.name = "ServiceError";
    }

    static validateLocationId(id_service: number): void {
        if (!id_service || !Number.isSafeInteger(id_service) || id_service <= 0) {
            throw new ServicesError("ID do Localização inválido", 400);
        }
    }

    static validateServiceId(id_location: number): void {
        if (!id_location ||!Number.isSafeInteger(id_location) || id_location <= 0) {
            throw new ServicesError("ID do serviço inválido", 400);
        }
    }

    static validadeServiceInput(serviceInput: createServiceInput): createServiceInput {
        this.validateLocationId(serviceInput.id_location);
        if ( typeof serviceInput.name_service !== "string" ||!serviceInput.name_service.trim()) {
            throw new ServicesError("Nome do serviço inválido", 400);
        }

        if (typeof serviceInput.path_metric !== "string" ||!serviceInput.path_metric.trim() ||!serviceInput.path_metric.startsWith("/")) {
            throw new ServicesError("Caminho da métrica inválido", 400);
        }

        if (typeof serviceInput.active_service !== "boolean") {
            throw new ServicesError("Estado do serviço inválido", 400);
        }
        return serviceInput;
    }
    static handleRepositoryError(error: unknown): never {
        if (error instanceof ServicesError) {
            throw error;
        }
        if (typeof error === "object" && error !== null &&"code" in error &&typeof error.code === "string") {
            switch (error.code) {
                case "23505":
                    throw new ServicesError("Registro duplicado.", 409);

                case "23503":
                    throw new ServicesError("Localização não encontrada.", 400);

                case "23502":
                    throw new ServicesError("Campo obrigatório não informado.", 400);

                case "23514":
                    throw new ServicesError("Valor fora das restrições permitidas.", 400);
            }
        }
        throw error;
    }
}
export class ServiceS{
    private serviceRepository = new ServiceRepository;

    async createService(service:createServiceInput):Promise<Service> {
        const data = ServicesError.validadeServiceInput(service)
        try{
            const service = await this.serviceRepository.createServiceRepository(data)
            if(!service){
                throw new ServicesError("Não foi possivel cadastrar Serviço",500);
            }
            return service;
        }catch(error){
            ServicesError.handleRepositoryError(error)
        }
    }

    async  updateServiceStatus(services_name:string[]): Promise<void> {
        await this.serviceRepository.updateServiceStatusRepository(services_name);
    }

    async getServiceById(id_service:number):Promise<Service> {
        ServicesError.validateServiceId(id_service)
        const service = await this.serviceRepository.getServiceByIdRepository(id_service);
        if(!service){
            throw new ServicesError("Serviço não encotrado", 404);
        }
        return service;
    }

    async getServiceByExist(name_service:string):Promise<Service|null> {
        const service = await this.serviceRepository.getServiceByExistRepository(name_service);
        return service||null;
    }

    async listServiceByLocation(id_location:number):Promise<Service[]> {
        ServicesError.validateLocationId(id_location);
        const service = await this.serviceRepository.listServicesByLocationIdRepository(id_location);
        if(!service || service.length===0){
            throw new ServicesError("Serviço não encotrado", 404);
        }
        return service;
    }
    async listServices():Promise<Service[]> {
        const service = await this.serviceRepository.listServicesRepository();
        if(service.length === 0){
            throw new ServicesError("Não existe serviço", 404);
        }
        return service;
    }
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
export function recordDiscoveredServices(services: DiscoveredService[], at = new Date().toISOString()): void {
    discoveredServices = services;
    lastUpdatedAt = at;
}

/** Publishes only samples that have already been persisted successfully. */
export function recordCollectedServiceMetrics(serviceId: string, sample: ApiMetric, at = new Date().toISOString()): void {
    collectedMetrics.set(serviceId, {
        serviceId,
        metrics: {
            collection_interval_seconds: sample.collection_interval_seconds,
            metrics: { ...sample.metrics },
        },
        updatedAt: at,
    });
}

export function publishCollection(catalog: AggregatorService[], metrics: Map<string, ServiceMetrics>, at: string) {
    recordDiscoveredServices(catalog, at);
    for (const [serviceId, sample] of metrics) recordCollectedServiceMetrics(serviceId, sample, at);
    const ids = new Set(catalog.map(service => service.id));
    for (const id of collectedMetrics.keys()) if (!ids.has(id)) collectedMetrics.delete(id);
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

