import {Router} from "express";
import{ServiceController}from "./service.controller"
import { authMiddleware } from "../Auth/auth.middleware";
import { adminMiddleware } from "../Auth/admin.middleware";
import { methodNotAllowed } from "../../middlewares/methodNotAllowed";

const serviceRouter = Router();
let serviceController = new ServiceController()

serviceRouter.get("/all", serviceController.listServiceController);
serviceRouter.get("/loc/:id_location",   serviceController.listServiceByLocationIdController);
serviceRouter.post("/", authMiddleware, adminMiddleware, serviceController.createServiceController);
serviceRouter.get("/:id_service", serviceController.getServiceByIdController);

serviceRouter.all("/all", methodNotAllowed(["GET", "HEAD", "OPTIONS"]));
serviceRouter.all("/loc/:id_location", methodNotAllowed(["GET", "HEAD", "OPTIONS"]));
serviceRouter.all("/", methodNotAllowed(["POST", "OPTIONS"]));
serviceRouter.all("/:id_service", methodNotAllowed(["GET", "HEAD", "OPTIONS"]));

export default serviceRouter;