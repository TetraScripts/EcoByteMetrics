import type { RequestHandler } from "express";
import type { JwtPayload } from "jsonwebtoken";

export const userAccessMiddleware: RequestHandler = (
  req,
  res,
  next
) => {
  const auth = res.locals.auth as JwtPayload | undefined;

  const authenticatedUserId = Number(auth?.sub);
  const requestedUserId = Number(req.params.id_user);

  if (
    !Number.isSafeInteger(authenticatedUserId) ||
    authenticatedUserId <= 0 ||
    authenticatedUserId !== requestedUserId
  ) {
    res.status(403).json({
      message: "Você não tem permissão para acessar este usuário.",
    });
    return;
  }

  next();
};
