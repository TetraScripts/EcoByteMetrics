/* Define a rota POST /auth/login. */
import { Router } from "express";
import { AuthUserController, SESSION_COOKIE } from "./auth.controller";
import { authMiddleware } from "./auth.middleware";

const authRouter = Router();
authRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
let authUserController = new AuthUserController();
authRouter.post("/login", authUserController.loginController);
authRouter.get("/session", (req, _res, next) => {
  const cookie = req.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(SESSION_COOKIE + "="));
  req.headers.authorization = cookie ? "Bearer " + cookie.slice(SESSION_COOKIE.length + 1) : undefined;
  next();
}, authMiddleware, authUserController.sessionController);
authRouter.post("/logout", authUserController.logoutController);

export default authRouter;
