import {NextFunction, Request, Response} from "express";
import{ LocationError,LocationService}from "./location.service";
export {type Location} from "./location.repository"
function handleError(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof LocationError) {
        res.status(error.statusCode).json({ erro: error.message });
        return;
    }
    next(error);
}
export class LocationController{
    private locationService = new LocationService();
    createLocationController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      
        try {
            let location = await this.locationService.createLocation(req.body);
            if(!location){
                throw new LocationError("Não foi possível criar o registro de Location", 500);
            }
            res.location(`${req.baseUrl}/${location.id_location}`).status(201).json(location);
        } catch (error) {
            handleError(error, res, next);
        }
    }
    getLocationByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const id_location = Number(req.params.id_location)
            if(isNaN(id_location) || id_location<=0){
                throw new LocationError("ID da localização inválido", 404);
            }
            const location = await this.locationService.getLocationById(id_location);
            res.status(200).json(location);
        } catch (error) {
            handleError(error, res, next);
        }
    }
    listLocationController = async (req: Request, res: Response, next: NextFunction): Promise<void>=> {
        try {
            const location = await this.locationService.listLocationALl();
            if(!location || location.length===0){
                throw new LocationError("Não existe localização cadastrada", 404);
            }
            res.status(200).json(location);
        } catch (error) {
            handleError(error, res, next);
        }
    }
}

