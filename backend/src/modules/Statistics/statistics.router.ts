import {StatisticController} from "./statistics.controller";
import {Router} from "express";

const router = Router();
const statistics = new StatisticController();

//http://localhost:3000/api/statistics/summary
router.get("/summary", statistics.summary);

//http://localhost:3000/api/statistics/ranking
//http://localhost:3000/api/statistics/ranking?periodo=24h&ordenarPor=kwh
//http://localhost:3000/api/statistics/ranking?periodo=7d&ordenarPor=co2e
router.get("/ranking", statistics.ranking);

//http://localhost:3000/api/statistics/total-global
//http://localhost:3000/api/statistics/total-global?periodo=1h
//http://localhost:3000/api/statistics/total-global?periodo=24h
//http://localhost:3000/api/statistics/total-global?periodo=7d
//http://localhost:3000/api/statistics/total-global?periodo=30d
router.get("/total-global", statistics.getGlobalStatistics);

export default router;
