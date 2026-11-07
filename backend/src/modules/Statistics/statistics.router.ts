import { methodNotAllowed } from "../../app";
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

// GET - Cálculo energético geral
// http://localhost:3000/api/statistics/energy
router.get("/energy", statistics.calculationEnergy);

// GET - Cálculo energético individual
// http://localhost:3000/api/statistics/energy/billing-api
router.get("/energy/:nome_service", statistics.calculationEnergyByUnit);


router.all("/summary", methodNotAllowed(["GET", "HEAD", "OPTIONS"]));
router.all("/ranking", methodNotAllowed(["GET", "HEAD", "OPTIONS"]));
router.all("/energy", methodNotAllowed(["GET", "HEAD", "OPTIONS"]));
router.all("/energy/:nome_service", methodNotAllowed(["GET", "HEAD", "OPTIONS"]));

export default router;
