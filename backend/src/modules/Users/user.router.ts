
import { Router, type Request, type Response } from "express";
import { UserController } from "./user.controller";
import { authMiddleware } from "../Auth/auth.middleware";
import { userAccessMiddleware } from "../Auth/userAccess.middleware";

const userRouter = Router();
const userController = new UserController();

// Tratamento de métodos HTTP não permitidos.
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
      metodosPermitidos: allowedMethods,
    });
  };
}

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
