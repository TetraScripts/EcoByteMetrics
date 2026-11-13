
import type { RequestHandler } from "express";
import type { JwtPayload } from "jsonwebtoken";

/**
 * Restringe operações administrativas a tokens emitidos para ADMIN.
 */
export const adminMiddleware: RequestHandler = (
  _req,
  res,
  next
) => {
  const auth = res.locals.auth as
    | (JwtPayload & { role?: string })
    | undefined;

  if (auth?.role !== "ADMIN") {
    res.status(403).json({
      message: "Acesso permitido somente para administradores.",
    });
    return;
  }

  next();
};
