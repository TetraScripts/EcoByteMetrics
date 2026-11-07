import { ApiError, Metric, ServiceMetrics } from "./api.types";

export class ServiceAPISevice {
    private readonly serviceApi = process.env.API_METRIC;
    //verifica se a api esta ativa
    async checkHealth(): Promise<{ service: string, status: string }> {
        ServiceApiError.apiNull(this.serviceApi);
        let response: Response;
        try {
            response = await fetch(`${this.serviceApi}/health`, {
                signal: AbortSignal.timeout(5000),
                headers: {
                    Accept: "application/json",
                },
            });
        } catch (error: unknown) {
            //Verefica se a api passou muito tentando buscar
            ServiceApiError.timeError(error);
            throw new ServiceApiError(
                "Não foi possível conectar à API externa.",
                503,
                "EXTERNAL_API_UNAVAILABLE"
            );
        }
        if (!response.ok) {
            throw new ServiceApiError(
                `A API externa respondeu com HTTP ${response.status}.`,
                502,
                "EXTERNAL_API_HTTP_ERROR"
            )
        }
        let data;
        try {
            data = await response.json();
        } catch {
            ServiceApiError.isNotlist(data);
            throw new ServiceApiError(
                "A API externa retornou um JSON inválido ou vazio.",
                502,
                "EXTERNAL_API_INVALID_JSON"
            );
        }
        return data as { service: string, status: string };
    }
    //pega todas os services na API
    async listServices(): Promise<ServiceMetrics[]> {
        ServiceApiError.apiNull(this.serviceApi);
        let response: Response;
        try {
            //Pesquisa todas as regiões
            response = await fetch(`${this.serviceApi}/services`, {
                signal: AbortSignal.timeout(5000),
                headers: {
                    Accept: "application/json",
                },
            });

        } catch (error: unknown) {
            //Verefica se a api passou muito tentando buscar
            ServiceApiError.timeError(error);
            throw new ServiceApiError(
                "Não foi possível conectar à API externa.",
                503,
                "EXTERNAL_API_UNAVAILABLE"
            );
        }
        ServiceApiError.httpError(response);

        let data: unknown;

        try {
            data = await response.json();
        } catch {
            ServiceApiError.isNotlist(data);
            throw new ServiceApiError(
                "A API externa retornou um JSON inválido ou vazio.",
                502,
                "EXTERNAL_API_INVALID_JSON"
            );
        }
        await ServiceApiError.validarEstruturaLista(data)
        return data as ServiceMetrics[];
    }
    //pega um service na API
    async getRegionDetails(serviceCode: string): Promise<ServiceMetrics> {
        ServiceApiError.apiNull(this.serviceApi);
        let response;
        try {
            response = await fetch(`${this.serviceApi}/services/${serviceCode}`, {
                signal: AbortSignal.timeout(5000),
                headers: {
                    Accept: "application/json",
                },
            });
        } catch (error: unknown) {
            ServiceApiError.timeError(error);
            throw new ServiceApiError(
                "Não foi possível conectar à API externa.",
                503,
                "EXTERNAL_API_UNAVAILABLE"
            );
        }
        ServiceApiError.httpError(response);
        let data: unknown;
        try {
            data = await response.json();
        } catch (error: unknown) {
            throw new ServiceApiError(
                "A API externa retornou um JSON inválido ou vazio.",
                502,
                "EXTERNAL_API_INVALID_JSON"
            );
        }
        await ServiceApiError.validarEstrutura(data)
        return data as ServiceMetrics;
    }
    async getMetricRegionDetails(serviceCode: string): Promise<Metric> {
        ServiceApiError.apiNull(this.serviceApi);
        let response;
        try {
            const code =  encodeURIComponent(serviceCode);
            response = await fetch(`${this.serviceApi}/metrics/${code}`, {
                signal: AbortSignal.timeout(5000),
                headers: {
                    Accept: "application/json",
                },
            });
        } catch (error: unknown) {
            ServiceApiError.timeError(error);
            throw new ServiceApiError(
                "Não foi possível conectar à API externa.",
                503,
                "EXTERNAL_API_UNAVAILABLE"
            );
        }
        ServiceApiError.httpError(response);
        let data: unknown;
        try {
            data = await response.json();
        } catch (error: unknown) {
            ServiceApiError.isNotlist(data);
            throw new ServiceApiError(
                "A API externa retornou um JSON inválido ou vazio.",
                502,
                "EXTERNAL_API_INVALID_JSON"
            );
        }
        ServiceApiError.validarMetric(data)

        return data as Metric;
    }
}

export class ServiceApiError extends Error implements ApiError {
    constructor(message: string, public readonly statusCode: number, public readonly code: string) {
        super(message);
        this.name = "ServiceApiError";
        this.statusCode = statusCode;
        this.code = code;
        //Object.setPrototypeOf(this, new.target.prototype);
    }
    static apiNull(Api: string | undefined): void {
        if (!Api) {
            throw new ServiceApiError(
                "A URL Metric da API externa não foi configurada.",
                500,
                "API_URL_MISSING"
            )
        }
    }
    static timeError(error: unknown): void {
        if (error instanceof Error && error.name === "TimeoutError") {
            throw new ServiceApiError(
                "A API externa demorou para responder.",
                504,
                "EXTERNAL_API_TIMEOUT"
            );
        }
    }
    static httpError(response: Response): void {
        if (!response.ok) {
            throw new ServiceApiError(
                `A API externa respondeu com HTTP ${response.status}.`,
                502,
                "EXTERNAL_API_HTTP_ERROR"
            )
        }
    }
    static isNotlist(data: unknown): void {
        if (!Array.isArray(data) || data.length == 0) {
            throw new ServiceApiError(
                "A API retornou uma lista inválidada ou vazia .",
                502,
                "EXTERNAL_API_INVALID_FORMAT"
            );
        }
    }
    static async validarEstrutura(item: unknown): Promise<void> {
        if (
            typeof item !== "object" ||
            item === null ||
            !("region_code" in item) ||
            !("country" in item) ||
            !("region" in item) ||
            !("city" in item) ||
            !("latitude" in item) ||
            !("longitude" in item) ||
            typeof item.region_code !== "string" ||
            item.region_code.trim() === "" ||
            typeof item.country !== "string" ||
            item.country.trim() === "" ||
            typeof item.region !== "string" ||
            item.region.trim() === "" ||
            typeof item.city !== "string" ||
            item.city.trim() === "" ||
            typeof item.latitude !== "number" ||
            !Number.isFinite(item.latitude) ||
            item.latitude < -90 ||
            item.latitude > 90 ||
            typeof item.longitude !== "number" ||
            !Number.isFinite(item.longitude) ||
            item.longitude < -180 ||
            item.longitude > 180
        ) {
            throw new ServiceApiError(
                "A API retornou dados de localização inválidos.",
                502,
                "EXTERNAL_API_INVALID_DATA"
            );
        }

    }
    static async validarEstruturaLista(data: unknown): Promise<void> {
        if (!Array.isArray(data) || data.length == 0) {
            throw new ServiceApiError(
                "A API retornou uma lista inválida ou vazia",
                502,
                "EXTERNAL_API_INVALID_DATA"
            );
        }
        for (const item of data) {
            if (
                typeof item !== "object" ||
                item === null ||
                !("id" in item) ||
                !("name" in item) ||
                !("location" in item) ||
                !("metrics_path" in item) ||
                typeof item.id !== "string" ||
                item.id.trim() === "" ||
                typeof item.name !== "string" ||
                item.name.trim() === "" ||
                typeof item.metrics_path !== "string" ||
                item.metrics_path.trim() === "" ||
                typeof item.location !== "object" ||
                item.location === null ||
                Array.isArray(item.location)
            ) {
                throw new ServiceApiError(
                    "A API retornou dados incompletos ou inválidos.",
                    502,
                    "EXTERNAL_API_INVALID_DATA"
                );


            }
            await this.validarEstrutura(item.location);
        }

    }
    static validarMetric(data: unknown): void {
        if (
            typeof data !== "object" ||
            data === null ||
            !("collection_interval_seconds" in data) ||
            !("metrics" in data) ||
            typeof data.collection_interval_seconds !== "number" ||
            !Number.isFinite(data.collection_interval_seconds) ||
            data.collection_interval_seconds <= 0 ||
            typeof data.metrics !== "object" ||
            data.metrics === null
        ) {
            throw new ServiceApiError(
                "A API retornou dados de métricas inválidos.",
                502,
                "EXTERNAL_API_INVALID_DATA"
            );
        }

        const metrics = data.metrics;

        if (
            typeof metrics !== "object" ||
            metrics === null ||
            !("cpu_percent" in metrics) ||
            !("memory_gb" in metrics) ||
            !("disk_gb" in metrics) ||
            !("network_gb" in metrics) ||
            typeof metrics.cpu_percent !== "number" ||
            !Number.isFinite(metrics.cpu_percent) ||
            metrics.cpu_percent < 0 ||
            metrics.cpu_percent > 100 ||

            typeof metrics.memory_gb !== "number" ||
            !Number.isFinite(metrics.memory_gb) ||
            metrics.memory_gb < 0 ||
            typeof metrics.disk_gb !== "number" ||
            !Number.isFinite(metrics.disk_gb) ||
            metrics.disk_gb < 0 ||
            typeof metrics.disk_gb !== "number" ||
            !Number.isFinite(metrics.disk_gb) ||
            metrics.disk_gb < 0 ||
            typeof metrics.network_gb !== "number" ||
            !Number.isFinite(metrics.network_gb) ||
            metrics.network_gb < 0) {
            throw new ServiceApiError(
                "A API retornou dados incompletos ou inválidos.",
                502,
                "EXTERNAL_API_INVALID_DATA"
            );
        }
    }

}