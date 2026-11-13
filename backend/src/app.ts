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
  getCollectionFailure,
} from "./modules/Services/services.service.js";
import {
  getDashboardRanking,
  getDashboardSummary,
  type DashboardPeriod,
  type RankingMetric,
} from "./modules/Dashboard/dashboard.service.js";

function isRankingMetric(value: unknown): value is RankingMetric {
  return value === "kwh" || value === "co2e";
}

function isDashboardPeriod(value: unknown): value is DashboardPeriod {
  return value === "1h" || value === "24h" || value === "7d";
}

//Cria Um thead paralela para fazer a percistencia


// Polling inicial e periódico é iniciado por server.ts.
const app = express();

app.use(cors());
app.use(express.json());

// Rotas existentes da API.
// Verifica se o backend está respondendo.
app.use("/auth", authRouter);
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});


// Retorna os serviços descobertos com suas coordenadas geográficas.
app.get("/services", (_req: Request, res: Response) => {
  const services = getDiscoveredServices().map((service) => ({
    ...service,
    latitude_location: service.location.latitude,
    longitude_location: service.location.longitude,
  }));

  res.json({
    services,
    lastUpdatedAt: getServicesLastUpdatedAt(),
  });
});

// Retorna as métricas coletadas com as coordenadas de cada serviço.
app.get("/metrics", (_req: Request, res: Response) => {
  const discoveredServices = getDiscoveredServices();

  const metrics = getCollectedServiceMetrics().map((collected) => {
    const service = discoveredServices.find(
      (item) => item.id === collected.serviceId
    );

    return {
      ...collected,
      latitude_location: service?.location.latitude ?? null,
      longitude_location: service?.location.longitude ?? null,
    };
  });

  res.json({ metrics });
});

// Retorna as métricas individuais com as coordenadas do serviço.
app.get("/metrics/:serviceId", (req: Request, res: Response) => {
  const serviceId = req.params.serviceId;

  if (typeof serviceId !== "string") {
    res.status(400).json({
      error: "Identificador de serviço inválido.",
    });
    return;
  }

  const serviceMetrics = getCollectedMetricsByServiceId(serviceId);
  const failure = getCollectionFailure(serviceId);

  if (failure?.reason === "missing") {
    res.status(404).json({
      error: "metrics_missing",
      message: failure.message,
      serviceId,
    });
    return;
  }

  if (failure?.reason === "unavailable") {
    res.status(503).json({
      error: "metrics_unavailable",
      message: failure.message,
      serviceId,
    });
    return;
  }

  if (!serviceMetrics) {
    res.status(404).json({
      error: "metrics_missing",
      message: "O serviço ainda não forneceu métricas válidas.",
      serviceId,
    });
    return;
  }

  const service = getDiscoveredServices().find(
    (item) => item.id === serviceId
  );

  res.json({
    ...serviceMetrics,
    latitude_location: service?.location.latitude ?? null,
    longitude_location: service?.location.longitude ?? null,
  });
});


app.use("/api/users", userRouter);
//Rota do monitor
app.use("/api/monitoring", monitoringRouter);
app.get("/api/monitoring-settings", authMiddleware, (_req, res) => {
  res.set("Cache-Control", "no-store").json({
    collectionIntervalSeconds: COLLECTION_INTERVAL_MS / 1000,
    discovery: "automatic",
    editable: false,
  });
});
// Rotas do módulo de métricas.
app.use("/api/metrics", metricRouter);
app.use("/api/carbons", carbonRouter);
app.use("/api/services", serviceRouter);
app.use("/api/statistics", statisticRouter);
app.use("/api/locations", locationRouter);

app.get("/api/dashboard/summary", (_req: Request, res: Response) => {
  res.status(200).json(getDashboardSummary());
});

app.get("/api/dashboard/ranking", (req: Request, res: Response) => {
  const rawOrderBy = req.query.ordenarPor ?? "co2e";
  const rawPeriod = req.query.periodo ?? "24h";
  if (!isRankingMetric(rawOrderBy)) {
    res.status(400).json({
      error: "O parâmetro ordenarPor deve ser 'kwh' ou 'co2e'.",
    });
    return;
  }
  if (!isDashboardPeriod(rawPeriod)) {
    res.status(400).json({
      error: "O parâmetro periodo deve ser '1h', '24h' ou '7d'.",
    });
    return;
  }
  res.status(200).json(getDashboardRanking(rawPeriod, rawOrderBy));
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
