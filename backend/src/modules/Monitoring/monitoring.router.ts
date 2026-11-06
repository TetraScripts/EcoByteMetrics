import { Router } from "express";
import { readMonitoring, type HistoryQuery } from "./monitoring.repository";
import { parseHistoryQuery } from "./collector";

const router = Router();
router.get("/", async (req, res) => {
  let query: HistoryQuery;
  try {
    query = parseHistoryQuery(req.query);
  } catch (error) {
    res.status(400).json({ message: (error as Error).message });
    return;
  }
  try {
    res.json(await readMonitoring(query));
  } catch (error) {
    if (error instanceof Error && error.message === "HISTORY_TOO_LARGE") {
      res
        .status(413)
        .json({
          message:
            "O histórico excede o limite desta consulta. Selecione menos aplicações.",
        });
      return;
    }
    res
      .status(503)
      .json({
        message:
          "Não foi possível consultar o histórico no banco. Tente novamente.",
      });
  }
});
export default router;
