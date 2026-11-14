/* Roteador para gerenciar rotas relacionadas a localizações.
   Este módulo define as rotas para criar, buscar por ID e listar todas as localizações.
   Ele também lida com métodos HTTP não permitidos, enviando respostas apropriadas.
*/
import { Router } from "express";

import{LocationController}from "./location.controller";
import { methodNotAllowed } from "../../middlewares/methodNotAllowed";
import { authMiddleware } from "../Auth/auth.middleware";
import { adminMiddleware } from "../Auth/admin.middleware";

const locationRouter = Router();
const locationController = new LocationController();

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
