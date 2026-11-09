import type { Request, Response } from "express";
import {
    UserError,
    createUserService,
    deleteUserService,
    getUserByIdService,
    updateUserService} 
    from "./user.service";


function handleError(error: unknown, res: Response): void {
    if (error instanceof UserError) {
        res.status(error.statusCode).json({ erro: error.message });
        return;
    }
    console.error("Erro interno ao processar usuário.");
    res.status(500).json({ erro: "Não foi possível processar a solicitação." });
}

export async function createUserController(req: Request, res: Response): Promise<void> {
    try {
        const user = await createUserService(req.body);
        res.location(`${req.baseUrl}/${user.id_user}`).status(201).json(user);
    } catch (error) {
        handleError(error, res);
    }
}
export async function getUserByIdController(req: Request, res: Response): Promise<void> {
    try {
        const id = Number(req.params.id_user)
        const user = await getUserByIdService(id);
        res.status(200).json(user);
    } catch (error) {
        handleError(error, res);
    }
}

export async function updateUserController(req: Request, res: Response): Promise<void> {
    try {
        const body = req.body ?? {};

        const user = await updateUserService({
            id_user: Number(req.params.id_user),
            name_user: body.name_user,
            email_user: body.email_user,
            password_user: body.password_user
        });

        res.status(200).json(user);
    } catch (error) {
        handleError(error, res);
    }
}

export async function deleteUserController(req: Request, res: Response): Promise<void> {
    try {
        const user = await deleteUserService(Number(req.params.id_user));
        res.status(200).json(user);
    } catch (error) {
        handleError(error, res);
    }
}
