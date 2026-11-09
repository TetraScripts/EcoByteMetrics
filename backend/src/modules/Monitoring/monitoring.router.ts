import { Router, Request, Response, NextFunction } from "express";
import { readMonitoring, type HistoryQuery } from "./monitoring.repository";
import { authMiddleware } from "../Auth/auth.middleware";

const SESSION_COOKIE = "ecobyte_session";

function requireHistoryAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // A última coleta é pública.
  if (req.query.view === "latest") {
    next();
    return;
  }

  // As consultas utilizadas pela Evolução e Comparação são públicas.
  if (req.query.view === "analysis") {
    next();
    return;
  }

  // O histórico detalhado continua exigindo autenticação.
  const cookie = req.headers.cookie
    ?.split(";")
    .map(part => part.trim())
    .find(part => part.startsWith(`${SESSION_COOKIE}=`));

  // Recupera o JWT armazenado no cookie de sessão.
  if (!req.headers.authorization && cookie) {
    req.headers.authorization =
      `Bearer ${cookie.slice(SESSION_COOKIE.length + 1)}`;
  }

  authMiddleware(req, res, next);
}

export function parseHistoryQuery(
  input: Record<string, unknown>,
  now = Date.now()
): HistoryQuery {
  const period = input.period ?? "7d";

  if (period !== "24h" && period !== "7d") {
    throw new Error("Período inválido. Use 24h ou 7d.");
  }

  if (
    input.view !== undefined &&
    input.view !== "latest" &&
    input.view !== "analysis" &&
    input.view !== "history"
  ) {
    throw new Error("Visualização inválida.");
  }

  const until = input.until;

  if (until !== undefined) {
    const parts =
      typeof until === "string"
        ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(until)
        : null;

    const [year, month, day, hour, minute, second] =
      parts ? parts.slice(1).map(Number) : [];

    const days = [
      31,
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28,
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31
    ];

    if (
      !parts ||
      year < 1 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > days[month - 1] ||
      hour > 23 ||
      minute > 59 ||
      second > 59 ||
      !Number.isFinite(Date.parse(until as string))
    ) {
      throw new Error("Informe um horário válido com fuso.");
    }

    if (Date.parse(until as string) > now) {
      throw new Error("Escolha um horário até o momento atual.");
    }
  }

  const serviceIds =
    input.service === undefined
      ? []
      : Array.isArray(input.service)
        ? input.service
        : [input.service];

  if (
    serviceIds.length > 100 ||
    serviceIds.some(
      id =>
        typeof id !== "string" ||
        !id ||
        id.length > 255
    )
  ) {
    throw new Error("Seleção de aplicações inválida.");
  }

  return {
    period,
    until: until as string | undefined,
    serviceIds: [...new Set(serviceIds)] as string[],
    ...(input.view
      ? {
          view: input.view as "latest" | "analysis" | "history"
        }
      : {})
  };
}

const router = Router();

router.get("/", requireHistoryAuth, async (req, res) => {
  let query: HistoryQuery;

  try {
    query = parseHistoryQuery(req.query);
  } catch (error) {
    res.status(400).json({
      message: (error as Error).message
    });
    return;
  }

  try {
    res.json(await readMonitoring(query));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "HISTORY_TOO_LARGE"
    ) {
      res.status(413).json({
        message:
          "O histórico excede o limite desta consulta. Selecione menos aplicações."
      });
      return;
    }

    console.error("Falha ao consultar histórico persistido.");

    res.status(503).json({
      message:
        "Não foi possível consultar o histórico no banco. Tente novamente."
    });
  }
});

export default router;
