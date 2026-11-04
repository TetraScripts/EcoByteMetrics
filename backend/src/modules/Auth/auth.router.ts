/* Define a rota POST /auth/login. */
import { Router } from "express";
import { loginController, logoutController, sessionController, SESSION_COOKIE } from "./auth.controller";
import { authMiddleware } from "./auth.middleware";

const authRouter = Router();
authRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

authRouter.post("/login", loginController);
authRouter.get("/session", (req, _res, next) => {
  const cookie = req.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(SESSION_COOKIE + "="));
  req.headers.authorization = cookie ? "Bearer " + cookie.slice(SESSION_COOKIE.length + 1) : undefined;
  next();
}, authMiddleware, sessionController);
authRouter.post("/logout", logoutController);

export default authRouter;
