import { ServicesError } from "../Services/services.service";
import {Metric, CreateMetricInput, MetricRepository} from "./metric.repository";

export class MetricError extends Error {
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.name = "MetricError";
    }
    static validateMetricId(id_metric: number): void {
        if (!Number.isSafeInteger(id_metric) || id_metric <= 0) {
            throw new MetricError("ID da métrica inválido", 400);
        }
    }

    static validateServiceId(id_service: number): void {
        if (!Number.isSafeInteger(id_service) || id_service <= 0) {
            throw new MetricError("ID do serviço inválido", 400);
        }
    }
    static validateMetricInput(metricInput: CreateMetricInput): CreateMetricInput {
        this.validateServiceId(metricInput.id_service);
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
    static handleRepositoryError(error: unknown): Promise<never> {
        if (error instanceof MetricError) {
            throw error;
        }
        if (typeof error === "object" && error !== null &&"code" in error &&typeof error.code === "string") {
            switch (error.code) {
                case "23505":
                    throw new MetricError("Registro duplicado.", 409);

                case "23503":
                    throw new MetricError("Localização não encontrada.", 400);

                case "23502":
                    throw new MetricError("Campo obrigatório não informado.", 400);

                case "23514":
                    throw new MetricError("Valor fora das restrições permitidas.", 400);
            }
        }
        throw error;
    }
}
export class MetricService{
    private metricRepository= new MetricRepository();

    async createMetricService(metricInput: CreateMetricInput): Promise<Metric | null> {
        const data = MetricError.validateMetricInput(metricInput);
        let metric: Metric | null = null
        try {
            metric= await this.metricRepository.createMetricRepository(data);
            if(!metric){
                throw new MetricError("Não foi possivel cadastrado",500)
            }  
        } catch (error: unknown) {
            MetricError.handleRepositoryError(error);
        }
        return metric;
    }
    async getMetricByIdService(id_metric: number): Promise<Metric | null> {
        MetricError.validateMetricId(id_metric);
        let metric:Metric| null = null
        try{
            metric = await this.metricRepository.getMetricByIdRepository(id_metric);
            if (!metric) {
                throw new MetricError("Métrica não encontrada", 404);
            }
        }catch(error){
            MetricError.handleRepositoryError(error);
        }
        return metric;
    }

    async listMetricsByServiceIdService(id_service: number): Promise<Metric[]> {
        MetricError.validateServiceId(id_service);
        let metrics:Metric[]=[]
        try{
            metrics = await this.metricRepository.listMetricsByServiceIdRepository(id_service);
            if (metrics.length === 0) {
                throw new ServicesError("Nenhuma métrica encontrada para o serviço especificado", 404);
            }
        }catch(error){
            MetricError.handleRepositoryError(error);
        }
        return metrics;
    }
}
