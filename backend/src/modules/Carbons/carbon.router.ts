import { Router, Request, Response } from "express";
import { CarbonController } from "./carbon.controller";
import { methodNotAllowed } from "../../middlewares/methodNotAllowed.js";
import { authMiddleware } from "../Auth/auth.middleware";
import { adminMiddleware } from "../Auth/admin.middleware";

const router = Router();
const carbonController = new CarbonController();

// Criar registro de carbono
router.post("/", authMiddleware, adminMiddleware, carbonController.createCarbon);

// Métodos não permitidos na raiz
router.all("/", methodNotAllowed(["POST", "OPTIONS"]));

// Listar todos os registros
router.get("/all", carbonController.listCarbons);

// Listar registros por localização
router.get("/loc/:id_location", carbonController.listCarbonsByLocationId);

// Buscar registro pelo ID
router.get("/:id_carbon",  carbonController.getCarbonById);

// Métodos não permitidos em /:id_carbon
router.all(
    "/:id_carbon",
    methodNotAllowed(["GET", "HEAD", "OPTIONS"])
);

export default router;
