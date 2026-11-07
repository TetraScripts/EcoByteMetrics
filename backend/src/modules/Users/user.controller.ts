import type { Request, Response, NextFunction, } from "express";
import {UserError,UserService} from "./user.service";


function handleError(error: unknown, res: Response, next:NextFunction): void {
    if (error instanceof UserError) {
        res.status(error.statusCode).json({ erro: error.message });
        return;
    }
    res.status(500).json({ erro: "Não foi possível processar a solicitação." });
    next(error);
}

export class UserController{
    private userService = new UserService();

    createUserController =async (req: Request, res: Response, next:NextFunction): Promise<void> => {
        try {
            const user = await this.userService.createUserService(req.body);
            res.location(`${req.baseUrl}/${user.id_user}`).status(201).json(user);
        } catch (error) {
            handleError(error, res, next);
        }
    }

    async getUserByIdController(req: Request, res: Response, next:NextFunction): Promise<void> {
        try {
            const id = Number(req.params.id_user)
            const user = await this.userService.getUserByIdService(id);
            res.status(200).json(user);
        } catch (error) {
            handleError(error, res, next);
        }
    }
    async updateUserController(req: Request, res: Response, next:NextFunction): Promise<void> {
        try {
            const idUser=Number(req.params.id_user)
            const user = await this.userService.updateUserService(idUser, req.body);
            res.status(200).json(user);
        } catch (error) {
            handleError(error, res,next);
        }
    }

    async deleteUserController(req: Request, res: Response, next:NextFunction): Promise<void> {
        try {
            const user = await this.userService.deleteUserService(Number(req.params.id_user));
            res.status(200).json(user);
        } catch (error) {
            handleError(error, res, next);
        }
    }
}