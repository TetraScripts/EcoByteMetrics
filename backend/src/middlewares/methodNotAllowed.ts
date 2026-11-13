import type { Request, Response } from "express";

// Tratamento de métodos HTTP não permitidos
export function methodNotAllowed(allowedMethods: string[]) {
    return (req: Request, res: Response): void => {
        res.set("Allow", allowedMethods.join(", "));

        if (req.method === "OPTIONS") {
            res.status(204).end();
            return;
        }

        res.status(405).json({
            erro: "Método HTTP não permitido",
            metodo: req.method,
            metodosPermitidos: allowedMethods
        });
    };
}
