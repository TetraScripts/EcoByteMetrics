import {Router} from "express";
import {
    createMetricController,
    getMetricByIdController,
    listMetricsByServiceIdController,
} from "./metric.controller";
import { authMiddleware } from "../Auth/auth.middleware";

const router = Router();

router.get(
    "/list/:id_service",
    authMiddleware,
    listMetricsByServiceIdController
);

router.post(
    "/",
    authMiddleware,
    createMetricController
);

router.get(
    "/:id_metric",
    authMiddleware,
    getMetricByIdController
);


router.get("/", (req, res) => {
    res.set("Allow", "GET, HEAD, POST, OPTIONS").status(204).end();
});
router.post("/:id_metric", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS").status(204).end();
});
router.get("/list/:id_service", (req, res) => {
    res.set("Allow", "GET, HEAD, OPTIONS").status(204).end();
});


router.all("/:id_metric", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
});
router.all("/", (req, res) => {
    res.set("Allow", "GET, HEAD, POST, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
});
router.all("/list/:id_service", (req, res) => {
    res.set("Allow", "GET, HEAD, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
});


export default router;