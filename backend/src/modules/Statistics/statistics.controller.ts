
import { type Request, type Response } from "express";
import { StatisticService } from "./statistics.service.js";

export class StatisticController {
    private statisticService: StatisticService = new StatisticService();

    summary = async (_req: Request, res: Response): Promise<void> => {
        try {
            const summary =
                await this.statisticService.getStatisticsSummary();

            res.status(200).json(summary);
        } catch (error: unknown) {
            console.error(
                "Falha ao buscar indicadores consolidados:",
                error
            );

            res.status(500).json({
                error: "Erro ao calcular os indicadores consolidados."
            });
        }
    };

    ranking = async (
        req: Request,
        res: Response
    ): Promise<void> => {
        try {
            const requestedPeriod = req.query.periodo;
            const requestedOrder = req.query.ordenarPor;

            const ranking =
                await this.statisticService.getServicesRanking(
                    typeof requestedPeriod === "string"
                        ? requestedPeriod
                        : "24h",
                    typeof requestedOrder === "string"
                        ? requestedOrder
                        : "co2e"
                );

            res.status(200).json(ranking);
        } catch (error: unknown) {
            console.error(
                "Falha ao buscar ranking de serviços:",
                error
            );

            res.status(500).json({
                error: "Erro ao calcular o ranking de serviços."
            });
        }
    };
}
