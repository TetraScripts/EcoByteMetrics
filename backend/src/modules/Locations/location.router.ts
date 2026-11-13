/* Roteador para gerenciar rotas relacionadas a localizações.
   Este módulo define as rotas para criar, buscar por ID e listar todas as localizações.
   Ele também lida com métodos HTTP não permitidos, enviando respostas apropriadas.
*/
import{Router} from "express";

import{LocationController}from "./location.controller";
import { methodNotAllowed } from "../../middlewares/methodNotAllowed.js";
import { authMiddleware } from "../Auth/auth.middleware";
import { adminMiddleware } from "../Auth/admin.middleware";
/* Criação do roteador de localizações usando o Router do Express.
   Define as rotas para criar, buscar por ID e listar todas as localizações.
   Também lida com métodos HTTP não permitidos, enviando respostas apropriadas.
*/
const locationRouter = Router();
let locationController = new LocationController()
// Rota para listar todas as localizações.
locationRouter.get("/all",  locationController.listLocationController);
locationRouter.post("/", authMiddleware, adminMiddleware, locationController.createLocationController);
locationRouter.get("/:id_location",  locationController.getLocationByIdController);

locationRouter.all("/all", methodNotAllowed(["GET", "HEAD", "OPTIONS"]));
locationRouter.all("/", methodNotAllowed(["POST", "OPTIONS"]))
locationRouter.all("/:id_location", methodNotAllowed(["GET", "HEAD", "OPTIONS"]))

export default locationRouter;