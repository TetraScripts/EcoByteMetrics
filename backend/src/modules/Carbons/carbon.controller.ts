import {NextFunction, Request, Response} from "express";
import {
    CarbonError,
    CarbonService
    } from "./carbon.service";
import { Carbon } from "./carbon.repository";

function handleError(error: unknown, res: Response, next: NextFunction): void {
    if (error instanceof CarbonError) {
        res.status(error.statusCode).json({ erro: error.message });
        return;
    }
    next(error);
}

export class CarbonController {
    private carbonService: CarbonService = new CarbonService();
    //função para criar um novo registro de carbono
    createCarbon= async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        let carbon: Carbon | null = null;
        try {
            carbon = await this.carbonService.createCarbon(req.body);
            if (!carbon) {
                throw new CarbonError("Não foi possível criar o registro de carbono", 500);
            }
            res.location(`${req.baseUrl}/${carbon.id_carbon}`).status(201).json(carbon);
        } catch (error) {
            handleError(error, res, next);
        }
    }
    //função para obter um registro de carbono pelo ID
    getCarbonById= async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        let carbon: Carbon | null = null;
        try {
            const id_carbon = Number(req.params.id_carbon);
            if (isNaN(id_carbon) || id_carbon <= 0) {
                throw new CarbonError("ID de carbono inválido", 404);
            }
            carbon = await this.carbonService.getCarbonById(id_carbon);
            if (!carbon) {
                throw new CarbonError("Registro de carbono não encontrado", 404);
            }
            res.status(200).json(carbon);
        } catch (error) {
            handleError(error, res, next);
        }
    }
    //função para listar todos os registros de carbono por ID de localização
    listCarbonsByLocationId= async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        let carbons: Location | null = null;
        try {
            const id_location = Number(req.params.id_location);
            if (isNaN(id_location)|| id_location <= 0) {
                throw new CarbonError("ID de localização inválido", 404);
            }
            carbons = await this.carbonService.listCarbonsByLocationId(id_location);
            if (!carbons) {
                throw new CarbonError("Não existem registros de carbono para a localização especificada", 404);
            }
            res.status(200).json(carbons);
        } catch (error) {
            handleError(error, res, next);
        }
    }
    //função para listar todos os registros de carbono
    listCarbons= async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        let carbons: Location[] | null = null;
        try {
            carbons = await this.carbonService.listCarbons();
            if (!carbons || carbons.length === 0) {
                throw new CarbonError("Não existem registros de carbono", 404);
            }
            res.status(200).json(carbons);
        } catch (error) {
            handleError(error, res, next);
        }
    }   
}
