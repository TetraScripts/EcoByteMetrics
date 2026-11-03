import express, { NextFunction, type Request, type Response } from "express";
import cors from "cors";

import userRouter from "./modules/Users/user.router.js";
import metricRouter from "./modules/Metrics/metric.router.js";
import carbonRouter from "./modules/Carbons/carbon.router.js";
import serviceRouter from "./modules/Services/service.router.js";
import locationRouter from "./modules/Locations/location.router.js";
import statisticRouter from "./modules/Statistics/statistics.router.js"
import authRouter from "./modules/Auth/auth.router";

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
// Rotas existentes da API.
// Verifica se o backend está respondendo.
app.use("/auth", authRouter);
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
//rota da statistica
app.use("/api/statistics", statisticRouter)
//Rota da Localização
app.use("/api/locations",locationRouter);
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
//rota inexistente
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    status: 404,
    erro: 'Não Encontrado',
    mensagem: `A rota não existe neste servidor.`
  });
});

export default app;
