/* Recebe e-mail e senha, chama o serviço e monta a resposta HTTP. */

import type { Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { UserError, UserService } from "../Users/user.service";
import { AuthError, AuthUserService } from "./auth.service";

export const SESSION_COOKIE = "ecobyte_session";

const cookieOptions = (req: Request) => ({
  httpOnly: true,
  sameSite: "strict" as const,
  secure:
    req.secure || process.env.NODE_ENV === "production",
  path: "/",
});

export class AuthUserController {
  private userService = new UserService();
  private authUserService = new AuthUserService();

  /**
   * Realiza o login do usuário.
   */
  loginController = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    const { email, password } = req.body ?? {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({
        message: "Informe o e-mail e a senha.",
      });
      return;
    }

    try {
      const result = await this.authUserService.loginService({
        email,
        password,
      });

      const payload = jwt.decode(result.token) as JwtPayload | null;

      if (!payload || typeof payload.exp !== "number") {
        throw new Error("Token de autenticação inválido.");
      }

      const maxAge = Math.max(
        0,
        payload.exp * 1000 - Date.now()
      );

      res.cookie(
        SESSION_COOKIE,
        result.token,
        {
          ...cookieOptions(req),
          maxAge,
        }
      );

      res
        .set("Cache-Control", "no-store")
        .status(200)
        .json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          message: error.message,
        });
        return;
      }

      console.error("Erro interno durante o login.", error);

      res.status(500).json({
        message: "Erro interno ao realizar login.",
      });
    }
  };

  /**
   * Verifica a sessão atual do usuário.
   */
  sessionController = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const payload = res.locals.auth as JwtPayload;

      const user = await this.userService.getUserByIdService(
        Number(payload.sub)
      );

      if (!user || user.email_user !== payload.email) {
        res
          .clearCookie(SESSION_COOKIE, cookieOptions(req))
          .status(401)
          .json({
            message: "Entre novamente para continuar.",
          });

        return;
      }

      const authorization = req.header("authorization");

      if (!authorization?.startsWith("Bearer ")) {
        res.status(401).json({
          message: "Sessão inválida.",
        });
        return;
      }

      res
        .set("Cache-Control", "no-store")
        .json({
          token: authorization.slice(7),
          tokenType: "Bearer",
        });
    } catch (error) {
      if (
        error instanceof UserError &&
        error.statusCode === 404
      ) {
        res
          .clearCookie(SESSION_COOKIE, cookieOptions(req))
          .status(401)
          .json({
            message: "Entre novamente para continuar.",
          });

        return;
      }

      console.error("Erro ao verificar sessão.", error);

      res.status(503).json({
        message: "Não foi possível verificar a sessão.",
      });
    }
  };

  /**
   * Encerra a sessão do usuário.
   */
  logoutController = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    res
      .clearCookie(SESSION_COOKIE, cookieOptions(req))
      .set("Cache-Control", "no-store")
      .json({
        loggedOut: true,
      });
  };
}
