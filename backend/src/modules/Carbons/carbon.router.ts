
import { Router, Request, Response } from "express";
import { CarbonController } from "./carbon.controller";

const router = Router();
const carbonController = new CarbonController();

// Tratamento de métodos HTTP não permitidos
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
            metodosPermitidos: allowedMethods
        });
    };
}

// Criar registro de carbono
router.post("/", carbonController.createCarbon);

// Métodos não permitidos na raiz
router.all("/", methodNotAllowed(["POST", "OPTIONS"]));

// Listar todos os registros
router.get("/all", carbonController.listCarbons);

// Métodos não permitidos em /all
router.all("/all", methodNotAllowed(["GET", "HEAD", "OPTIONS"]));

// Listar registros por localização
router.get("/loc/:id_location", carbonController.listCarbonsByLocationId);

// Métodos não permitidos em /loc/:id_location
router.all(
    "/loc/:id_location",
    methodNotAllowed(["GET", "HEAD", "OPTIONS"])
);

// Buscar registro pelo ID
router.get("/:id_carbon", carbonController.getCarbonById);

// Métodos não permitidos em /:id_carbon
router.all(
    "/:id_carbon",
    methodNotAllowed(["GET", "HEAD", "OPTIONS"])
);

export default router;