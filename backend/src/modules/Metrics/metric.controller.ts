import {NextFunction, Request, Response} from "express";
import {
    MetricError,
    MetricService
    } from "./metric.service";

function handleError(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof MetricError) {
        res.status(error.statusCode).json({ erro: error.message });
        return;
    }
    next(error);
}

export class MetricController{
    private metricService = new MetricService();

    createMetricController= async (req: Request, res: Response, next: NextFunction): Promise<void>=> {
        try {
            const metric = await this.metricService.createMetricService(req.body);
            if(!metric){
                throw new MetricError("Não foi possível criar o registro de metrica", 500);
            }
            res.location(`${req.baseUrl}/${metric.id_metric}`).status(201).json(metric);
        } catch (error) {
            handleError(error, res, next);
        }
    }

    getMetricByIdController= async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id_metric = Number(req.params.id_metric);
            const metric = await this.metricService.getMetricByIdService(id_metric);
            if(!metric){
                throw new MetricError("Registro de Metrica não encontrado",404)
            }
            res.status(200).json(metric);
        } catch (error) {
            handleError(error, res, next);
        }
    }
    listMetricsByServiceIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id_service = Number(req.params.id_service);
            const metrics = await this.metricService.listMetricsByServiceIdService(id_service);
            if(!metrics){
                throw new MetricError("Não existem registros de metrica para o serviço especificada", 404);
            }
            res.status(200).json(metrics);
        } catch (error) {
            handleError(error, res, next);
        }
    }

}
