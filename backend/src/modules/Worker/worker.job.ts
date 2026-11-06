import { CarbonApiError } from "../../integrations/carbon-api";
import { ServiceApiError } from "../../integrations/services-api";
import {refreshDiscoveredServices,refreshServiceMetrics} from "../Services/services.service";
import { runWorker} from './worker';
import cron from 'node-cron';

// Configura para rodar a cada 30 segundos
export function start() {
    // Intervalo de atualização em milissegundos (30 segundos)
    const REFRESH_INTERVAL = 30_000;
    // Inicializa a primeira execução imediatamente
    void refreshAllData()
    .then(() => {
      console.log("Serviços e métricas carregados com sucesso.");
    })
    .catch((error: unknown) => {
      if(error instanceof ServiceApiError || error instanceof CarbonApiError){
              console.error(
                `${error.name}: ${error.message}\n` +
                `statusCode: ${error.statusCode}\n` );
      }else{
         console.error("Erro desconhecido ",error);
       }
    });

  // Atualiza a lista e as métricas a cada 30 segundos.
  setInterval(() => {
    void refreshAllData()
      .then(() => {
        console.log("Lista de serviços e métricas atualizada.");
      })
      .catch((error: unknown) => {
        if(error instanceof ServiceApiError || error instanceof CarbonApiError){
              console.error(
                `${error.name}: ${error.message}\n` +
                `statusCode: ${error.statusCode}\n` );
        }else{
            console.error("Erro desconhecido ",error);
        }
      });
  }, REFRESH_INTERVAL);
    // Configura o cron job para rodar a cada 30 segundos
    return cron.schedule('*/30 * * * * *', () => {
    runWorker();
  });
}
async function refreshAllData(): Promise<void> {
  // Primeiro atualiza a lista de serviços.
  await refreshDiscoveredServices();

  // Depois consulta as métricas da lista atualizada.
  await refreshServiceMetrics();
}