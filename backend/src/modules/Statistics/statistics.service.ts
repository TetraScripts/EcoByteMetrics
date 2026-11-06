import {StatisticRepository} from "./statistics.repository.js";


export class StatisticService{
    private Periods: Record<string, string> = {
        "1h": "1 hour",
        "24h": "24 hours",
        "7d": "7 days"
        };
    private statisticRepository:StatisticRepository = new StatisticRepository();

    async  getStatisticsSummary() {
        return await this.statisticRepository.getStatisticsSummaryQuery()
    }

    async getServicesRanking(requestedPeriod: string,requestedOrder: string) {
        const period = this.Periods[requestedPeriod] ?? this.Periods["24h"];
        const orderBy = requestedOrder === "kwh" ? "kwh" : "co2e";
        const ranking = await this.statisticRepository.getServicesRankingQuery(period, orderBy);

        return {
            periodo: requestedPeriod in this.Periods ? requestedPeriod : "24h",
            ordenadoPor: orderBy,
            ranking
        };
    }

    async getEnergyCalculationUnitService(nome_service:string){
        if(nome_service){
            return await this.statisticRepository.getEnergyCalculationUnitService(nome_service);
        }
        return {"mesagem":"Nome esta invalido"};
        
    }

    async getEnergyCalculationService(){
        const result= await this.statisticRepository.getEnergyCalculation();
        return result;
        
    }

}
