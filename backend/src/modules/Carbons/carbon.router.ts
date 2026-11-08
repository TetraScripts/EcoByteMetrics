import { CarbonController } from "./carbon.controller";
import{Router} from "express";
const router = Router();
const carbonController = new CarbonController();

// Criar registro de carbono
router.post("/",  carbonController.createCarbon);

// Listar todos os registros
router.get("/all", carbonController.listCarbons);

// Listar registros por localização
router.get("/loc/:id_location", carbonController.listCarbonsByLocationId);

// Buscar registro pelo ID
router.get("/:id_carbon",  carbonController.getCarbonById);


export default router;
