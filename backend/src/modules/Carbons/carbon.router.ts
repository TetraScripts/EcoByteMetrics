import { Router, Request, Response } from "express";
import { CarbonController } from "./carbon.controller";
import { methodNotAllowed } from "../../app";
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
router.get("/:id_carbon",  carbonController.getCarbonById);

// Métodos não permitidos em /:id_carbon
router.all(
    "/:id_carbon",
    methodNotAllowed(["GET", "HEAD", "OPTIONS"])
);

// define rotas para lidar com os métodos permitidos
router.get("/all", listCarbonsController);
router.get("/loc/:id_location", listCarbonsByLocationIdController);
router.post("/", authMiddleware, createCarbonController);
router.get("/:id_carbon", getCarbonByIdController);

// define rotas para lidar com métodos não permitidos
router.get("/all/", (req, res) => {
    res.set("Allow", "GET, HEAD, OPTIONS").status(204)
    .json({ Mensagem: "Não existe um registro." }).end();
});
router.get("/", (req, res) => {
    res.set("Allow", "GET, HEAD, POST, OPTIONS").status(204).end();
});
router.post("/:id", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS").status(204)
    .json({ Mensagem: "Não existe um registro." }).end();
}); 

router.get("/loc/:id", (req, res) => {
    res.set("Allow", "GET, HEAD, OPTIONS").status(204)
    .json({ Mensagem: "Não existe um registro." }).end();
});


// define rotas para lidar com métodos não permitidos
router.all("/", (req, res) => {
    res.set("Allow", "GET, HEAD, POST, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
});
router.all("/:id", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
}); 
router.all("/loc/:id", (req, res) => {
    res.set("Allow", "GET, HEAD, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
});
router.all("/all/", (req, res) => {
    res.set("Allow", "GET, HEAD, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
}); 

export default router;
