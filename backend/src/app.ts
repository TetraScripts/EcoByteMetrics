import express, { NextFunction, type Request, type Response } from "express";
import cors from "cors";

import userRouter from "./modules/Users/user.router.js";
import metricRouter from "./modules/Metrics/metric.router.js";
import carbonRouter from "./modules/Carbons/carbon.router.js";
import serviceRouter from "./modules/Services/service.router.js";
import locationRouter from "./modules/Locations/location.router.js";
import statisticRouter from "./modules/Statistics/statistics.router.js";
import authRouter from "./modules/Auth/auth.router";
import monitoringRouter from "./modules/Monitoring/monitoring.router";
import { authMiddleware } from "./modules/Auth/auth.middleware";
import { COLLECTION_INTERVAL_MS } from "./modules/Monitoring/collector";

import {
  getDiscoveredServices,
  getServicesLastUpdatedAt,
  getCollectedServiceMetrics,
  getCollectedMetricsByServiceId,
} from "./modules/Services/services.service.js";

// Polling inicial e periódico é iniciado por server.ts.
const app = express();

app.use(cors());
app.use(express.json());
app.use("/auth", authRouter);
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get("/services", (_req: Request, res: Response) => {
  res.json({
    services: getDiscoveredServices(),
    lastUpdatedAt: getServicesLastUpdatedAt(),
  });
});

app.use("/api/users", userRouter);
app.use("/api/monitoring", monitoringRouter);
app.get("/api/monitoring-settings", authMiddleware, (_req, res) => {
  res.set("Cache-Control", "no-store").json({
    collectionIntervalSeconds: COLLECTION_INTERVAL_MS / 1000,
    discovery: "automatic",
    editable: false,
  });
});
app.use("/api/metrics", metricRouter);
app.use("/api/carbons", carbonRouter);
app.use("/api/services", serviceRouter);
app.use("/api/statistics", statisticRouter);
app.use("/api/locations", locationRouter);

app.get("/metrics", (_req: Request, res: Response) => {
  res.json({ metrics: getCollectedServiceMetrics() });
});

app.get("/metrics/:serviceId", (req: Request, res: Response) => {
  const serviceId = req.params.serviceId;
  if (typeof serviceId !== "string") {
    res.status(400).json({ error: "Identificador de serviço inválido." });
    return;
  }
  const serviceMetrics = getCollectedMetricsByServiceId(serviceId);
  if (!serviceMetrics) {
    res.status(404).json({
      error: "Métricas não encontradas para este serviço.",
      serviceId,
    });
    return;
  }
  res.json(serviceMetrics);
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    status: 404,
    erro: "Não Encontrado",
    mensagem: "A rota não existe neste servidor.",
  });
});

// Centralized fallback for uncaught route errors. If a route has already
// started streaming a response, delegate rather than attempting a second send.
app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  console.error("Erro interno na API.", error);
  if (res.headersSent) {
    next(error);
    return;
  }
  res.status(500).json({
    status: 500,
    erro: "Erro interno",
    mensagem: "Não foi possível concluir a solicitação.",
  });
});

export default app;
