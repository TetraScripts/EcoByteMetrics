import {NextFunction, Request, Response} from "express";

import{ServicesError, ServiceS }from"./services.service"

function handleError(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof ServicesError) {
        res.status(error.statusCode).json({ erro: error.message });
        return;
    }
    next(error);
}

export class ServiceController{
    private serviceS = new ServiceS();
    
    createServiceController= async (req: Request, res: Response, next: NextFunction): Promise<void> =>{
        try {
            const service = await this.serviceS.createService(req.body);
            res.location(`${req.baseUrl}/${service.id_service}`).status(201).json(service);
        } catch (error) {
            handleError(error, res, next);
        }
    }
    getServiceByIdController=async (req: Request, res: Response, next: NextFunction): Promise<void>=>{
        try {
            const id_service = Number(req.params.id_service)
            const service = await this.serviceS.getServiceById(id_service);
            res.status(200).json(service);
        } catch (error) {
            handleError(error, res, next);
        }
    }

    listServiceByLocationIdController= async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id_location=Number(req.params.id_location);
            const service = await this.serviceS.listServiceByLocation(id_location);
            res.status(200).json(service);
        } catch (error) {
            handleError(error, res, next);
        }
    }

    listServiceController= async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const service = await this.serviceS.listServices();
            res.status(200).json(service);
        } catch (error) {
            handleError(error, res, next);
        }
    }
}
