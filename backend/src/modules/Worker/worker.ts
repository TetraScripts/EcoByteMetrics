import {CarbonApiError, CarbonAPISevice } from "../../integrations/carbon-api";
import {ServiceApiError, ServiceAPISevice}from"../../integrations/services-api"
import {WorkerService}  from "./worker.metric.service";
import { WorkerCarbons } from "./worker.carbon.service";

export async function runWorker() {
  //Objetos para verificar Api Metricas e Carbons
  const CarbonApiService = new CarbonAPISevice();
  const ServiceAPI = new ServiceAPISevice();
  //Objetos para cadastrar metricas e Carbons da Api
  const WorkerServiceAPI = new WorkerService();
  const WorkerCarbonsAPI = new WorkerCarbons();
  //try para verifica saúde das APIs
  try {
    const carbonHealth = await CarbonApiService.checkHealth();
    console.log(`Carbon API health: ${carbonHealth.status}`);
    const serviceHealth = await ServiceAPI.checkHealth();
    console.log(`Metric API health: ${serviceHealth.status}`);
  }catch(error:unknown){
    if(error instanceof CarbonApiError || error instanceof ServiceApiError){
      console.error(
        `${error.name}: ${error.message}\n` +
        `statusCode: ${error.statusCode}\n` );
    }else{
      console.log("Erro desconhecido");
    }
  }
  //try para verificar caso tenha erro de Carbons 
  try{
    const carbonRegions = await CarbonApiService.listCabons();
    await WorkerCarbonsAPI.listarCarbons(carbonRegions.regions);
  }catch(error:unknown){
    if(error instanceof CarbonApiError){
      console.error(
        `${error.name}: ${error.message}\n` +
        `statusCode: ${error.statusCode}\n` );
    }else{
      console.log("Erro desconhecido");
    }
  }
  //try para verificar caso tenha erro de metricas
  try{
    const servicesMetrics = await ServiceAPI.listServices();
    await WorkerServiceAPI.listarServices(servicesMetrics, ServiceAPI);
  }catch(error:unknown){
    if(error instanceof ServiceApiError){
      console.error(
        `${error.name}: ${error.message}\n` +
        `statusCode: ${error.statusCode}\n` );
    }else{
      console.log("Erro desconhecido");
    }
  }
}

