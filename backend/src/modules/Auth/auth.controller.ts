/* Recebe e-mail e senha, chama o serviço e monta a resposta HTTP. */
import type { Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { getUserByIdService, UserError } from "../Users/user.service";
import {
  AuthError,
  loginService,
} from "./auth.service";

export const SESSION_COOKIE = "ecobyte_session";
const cookieOptions = (req: Request) => ({httpOnly: true, sameSite: "strict" as const, secure: req.secure || process.env.NODE_ENV === "production", path: "/"});

export async function loginController(
  req: Request,
  res: Response
): Promise<void> {
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
    const result = await loginService({ email, password });
    const payload = jwt.decode(result.token) as JwtPayload;
    res.cookie(SESSION_COOKIE, result.token, {...cookieOptions(req), maxAge: Math.max(0, payload.exp! * 1000 - Date.now())});
    res.set("Cache-Control", "no-store").status(200).json(result);
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({
        message: error.message,
      });
      return;
    }

    console.error("Erro interno durante o login.");

    res.status(500).json({
      message: "Erro interno ao realizar login.",
    });
  }
}

export async function sessionController(req: Request, res: Response): Promise<void> {
  try {
    const payload = res.locals.auth as JwtPayload;
    const user = await getUserByIdService(Number(payload.sub));
    if (!user || user.email_user !== payload.email) {
      res.clearCookie(SESSION_COOKIE, cookieOptions(req)).status(401).json({message: "Entre novamente para continuar."});
      return;
    }
    res.set("Cache-Control", "no-store").json({token: req.header("authorization")!.slice(7), tokenType: "Bearer"});
  } catch (error) {
    if (error instanceof UserError && error.statusCode === 404) {
      res.clearCookie(SESSION_COOKIE, cookieOptions(req)).status(401).json({message: "Entre novamente para continuar."});
      return;
    }
    res.status(503).json({message: "Não foi possível verificar a sessão."});
  }
}

export function logoutController(req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, cookieOptions(req)).set("Cache-Control", "no-store").json({loggedOut: true});
}
