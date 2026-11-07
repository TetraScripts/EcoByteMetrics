import {Router} from "express";
import {MetricController} from "./metric.controller";
import { methodNotAllowed } from "../../app";
import { authMiddleware } from "../Auth/auth.middleware";

const router = Router();
let metricController = new MetricController();

router.get("/list/:id_service",  metricController.listMetricsByServiceIdController);
router.post("/", metricController.createMetricController);
router.get("/:id_metric", metricController.getMetricByIdController);

router.all("/:id_metric",  methodNotAllowed(["GET", "HEAD", "OPTIONS"]));
router.all("/", methodNotAllowed(["POST", "OPTIONS"]));
router.all("/list/:id_service",  methodNotAllowed(["GET", "HEAD", "OPTIONS"]));



export default router;