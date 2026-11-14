import { Router } from "express";
import { UserController } from "./user.controller";
import { authMiddleware } from "../Auth/auth.middleware";
import { userAccessMiddleware } from "../Auth/userAccess.middleware";
import { methodNotAllowed } from "../../middlewares/methodNotAllowed";

const userRouter = Router();
const userController = new UserController();

// Cadastrar usuário.
userRouter.post("/", userController.createUserController);

// Consultar usuário.
userRouter.get(
  "/:id_user",
  authMiddleware,
  userAccessMiddleware,
  userController.getUserByIdController
);

// Atualizar usuário.
userRouter.put(
  "/:id_user",
  authMiddleware,
  userAccessMiddleware,
  userController.updateUserController
);

// Excluir usuário.
userRouter.delete(
  "/:id_user",
  authMiddleware,
  userAccessMiddleware,
  userController.deleteUserController
);

// Métodos HTTP não permitidos.
userRouter.all("/", methodNotAllowed(["POST", "OPTIONS"]));

userRouter.all(
  "/:id_user",
  methodNotAllowed(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"])
);

export default userRouter;
