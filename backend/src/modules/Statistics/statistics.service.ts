import {GlobalStatistics, StatisticRepository} from "./statistics.repository.js";


export class StatisticService{
    private periods: Record<string, string> = {
        "1h": "1 hour",
        "24h": "24 hours",
        "7d": "7 days",
        "30d": "30 days"
        };
    private statisticRepository:StatisticRepository = new StatisticRepository();

    async  getStatisticsSummary() {
        return await this.statisticRepository.getStatisticsSummaryQuery()
    }

    async getServicesRanking(requestedPeriod: string,requestedOrder: string) {
        const period = this.periods[requestedPeriod] ?? this.periods["24h"];
        const orderBy = requestedOrder === "kwh" ? "kwh" : "co2e";
        const ranking = await this.statisticRepository.getServicesRankingQuery(period, orderBy);

        return {
            periodo: requestedPeriod in this.periods ? requestedPeriod : "24h",
            ordenadoPor: orderBy,
            ranking
        };
    }
    async getGlobalStatistics(period: string): Promise<GlobalStatistics> {

    const selectedPeriod = this.periods[period];

    if (!selectedPeriod) {
      throw new Error("Período de consulta inválido.");
    }

    return await this.statisticRepository
      .getCalculationEmissionQuery(selectedPeriod);
  }

}
