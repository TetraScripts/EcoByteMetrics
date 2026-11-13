/* Roteador para gerenciar rotas relacionadas a localizações.
   Este módulo define as rotas para criar, buscar por ID e listar todas as localizações.
   Ele também lida com métodos HTTP não permitidos, enviando respostas apropriadas.
*/
import { Router, type Request, type Response } from "express";

import { LocationController } from "./location.controller";
import { authMiddleware } from "../Auth/auth.middleware";
import { adminMiddleware } from "../Auth/admin.middleware";

const locationRouter = Router();
const locationController = new LocationController();

// Tratamento de métodos HTTP não permitidos.
function methodNotAllowed(allowedMethods: string[]) {
  return (req: Request, res: Response): void => {
    res.set("Allow", allowedMethods.join(", "));

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    res.status(405).json({
      erro: "Método HTTP não permitido",
      metodo: req.method,
      metodosPermitidos: allowedMethods,
    });
  };
}

// Listar todas as localizações.
locationRouter.get(
  "/all",
  locationController.listLocationController
);

// Criar localização (somente administrador autenticado).
locationRouter.post(
  "/",
  authMiddleware,
  adminMiddleware,
  locationController.createLocationController
);

// Buscar localização por ID.
locationRouter.get(
  "/:id_location",
  locationController.getLocationByIdController
);

// Métodos HTTP não permitidos.
locationRouter.all(
  "/all",
  methodNotAllowed(["GET", "HEAD", "OPTIONS"])
);

locationRouter.all(
  "/",
  methodNotAllowed(["POST", "OPTIONS"])
);

locationRouter.all(
  "/:id_location",
  methodNotAllowed(["GET", "HEAD", "OPTIONS"])
);

export default locationRouter;
