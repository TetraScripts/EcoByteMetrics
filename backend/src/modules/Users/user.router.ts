import {Router} from "express";
import {UserController}from "./user.controller";
import { authMiddleware } from "../Auth/auth.middleware";
import { userAccessMiddleware } from "../Auth/userAccess.middleware";
import { methodNotAllowed } from "../../app";

let userController = new UserController();
const userRouter = Router();

userRouter.post("/", userController.createUserController);
userRouter.get("/:id_user", authMiddleware, userAccessMiddleware, userController.getUserByIdController);
userRouter.put("/:id_user", authMiddleware, userAccessMiddleware, userController.updateUserController);
userRouter.delete("/:id_user", authMiddleware, userAccessMiddleware, userController.deleteUserController);

userRouter.all("/", methodNotAllowed(["POST", "OPTIONS"]));

userRouter.all("/:id_user", methodNotAllowed(["GET","HEAD","PUT","DELETE", "OPTIONS"]));

export default userRouter;
