import express, { type Request, type Response } from "express";
import cors from "cors";
import userRouter from "./modules/Users/user.router.js";
import metricRouter from "./modules/Metrics/metric.router.js";
import carbonRouter from "./modules/Carbons/carbon.router.js";
import serviceRouter from "./modules/Services/service.router.js";
import locationRouter from "./modules/Locations/location.router.js";

import {
  getDiscoveredServices,
  getServicesLastUpdatedAt,
  getCollectedServiceMetrics,
  getCollectedMetricsByServiceId,
} from "./modules/Services/services.service.js";
import {
  getDashboardRanking,
  getDashboardSummary,
  type DashboardPeriod,
  type RankingMetric,
} from "./modules/Dashboard/dashboard.service.js";

const app = express();

function isRankingMetric(value: unknown): value is RankingMetric {
  return value === "kwh" || value === "co2e";
}

function isDashboardPeriod(value: unknown): value is DashboardPeriod {
  return value === "1h" || value === "24h" || value === "7d";
}

app.use(cors());
app.use(express.json());
// Rotas existentes da API.
// Verifica se o backend está respondendo.
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Lista os serviços descobertos pelo Agregador de Métricas.
app.get("/services", (_req: Request, res: Response) => {
  res.json({
    services: getDiscoveredServices(),
    lastUpdatedAt: getServicesLastUpdatedAt(),
  });
});

// Rotas do módulo de usuários.
app.use("/api/users", userRouter);
// Rotas do módulo de métricas.
app.use("/api/metrics", metricRouter);
//Rota do Carbon
app.use("/api/carbons",carbonRouter);
//Rota do service
app.use("/api/services", serviceRouter);
//Rota da Localização
app.use("/api/locations",locationRouter);

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

  res.status(200).json(
    getDashboardRanking(rawPeriod, rawOrderBy),
  );
});

// Retorna as métricas coletadas de todos os serviços.
app.get("/metrics", (_req: Request, res: Response) => {
  res.json({
    metrics: getCollectedServiceMetrics(),
  });
});

// Retorna as métricas coletadas de um serviço específico.
app.get("/metrics/:serviceId", (req: Request, res: Response) => {
    const serviceId = req.params.serviceId;
    if (typeof serviceId !== "string") {
      res.status(400).json({
        error: "Identificador de serviço inválido.",
      });
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
  }
);


export default app;
