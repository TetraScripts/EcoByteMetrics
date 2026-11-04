import {Router} from "express";
import {
    createUserController,
    deleteUserController,
    getUserByIdController,
    updateUserController}
    from "./user.controller";
import { authMiddleware } from "../Auth/auth.middleware";
import { userAccessMiddleware } from "../Auth/userAccess.middleware";

const userRouter = Router();

userRouter.post("/", createUserController);
userRouter.get("/:id_user", authMiddleware, userAccessMiddleware, getUserByIdController);
userRouter.put("/:id_user", authMiddleware, userAccessMiddleware, updateUserController);
userRouter.delete("/:id_user", authMiddleware, userAccessMiddleware, deleteUserController);

userRouter.get("/", (req, res) => {
    res.set("Allow", "GET, HEAD, POST, OPTIONS").status(204).end();
});

userRouter.post("/:id_user", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS").status(204).end();
});

userRouter.all("/:id_user", (req, res) => {
    res.set("Allow", "GET, HEAD, PUT, DELETE, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
})

userRouter.all("/", (req, res) => {
    res.set("Allow", "GET, HEAD, POST, OPTIONS")
    .status(405).json({ error: "Método não permitido" });
});

export default userRouter;
