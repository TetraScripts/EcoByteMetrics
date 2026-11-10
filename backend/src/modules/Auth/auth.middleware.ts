/* Verifica o JWT recebido em rotas protegidas. */
import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";

export const authMiddleware: RequestHandler = (req, res, next) => {

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({
      message: "Configuração de autenticação indisponível.",
    });
    return;
  }

  const authorization = req.header("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];

  if (scheme !== "Bearer" || !token) {
    res.status(401).json({
      message: "Token de autenticação ausente ou inválido.",
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === "string" || typeof payload.sub !== "string" ||
        !Number.isSafeInteger(Number(payload.sub)) || Number(payload.sub) <= 0 ||
        (payload.role !== "ADMIN" && payload.role !== "USER")) {
      res.status(401).json({ message: "Token inválido ou sem perfil de acesso." });
      return;
    }

    res.locals.auth = payload;
    next();
  } catch {
    res.status(401).json({
      message: "Token inválido ou expirado.",
    });
  }
};