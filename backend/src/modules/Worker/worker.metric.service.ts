
import { ServiceMetrics } from "../../integrations/api.types.js";
import { CarbonApiError } from "../../integrations/carbon-api.js";
import {ServiceApiError,ServiceAPISevice} from "../../integrations/services-api.js";
import { createLocationInput } from "../Locations/location.repository.js";
import {createLocation,getLocationByName} from "../Locations/location.service.js";
import { CreateMetricInput } from "../Metrics/metric.repository.js";
import { createMetricService } from "../Metrics/metric.service.js";
import { createServiceInput } from "../Services/service.repository.js";
import {createService, getServiceByExist, updateServiceStatus, recordCollectedServiceMetrics} from "../Services/services.service.js";

export class WorkerService {

  async listarServices(
    servicesMetric: ServiceMetrics[],
    serviceAPI: ServiceAPISevice
  ): Promise<void> {
    const servs:string[]=[]
    for (const serv of servicesMetric) {
      try {
        // Buscar e validar os dados da métrica na API.
        const m = await serviceAPI.getMetricRegionDetails(serv.id);

        const metric: CreateMetricInput = {
          id_service: 0,
          cpu_metric: m.metrics.cpu_percent,
          ram_metric: m.metrics.memory_gb,
          hd_metric: m.metrics.disk_gb,
          network_metric: m.metrics.network_gb,
          colletion_interval_metric:
            m.collection_interval_seconds,
          date_houry: new Date().toISOString()
        };

        const service: createServiceInput = {
          id_location: 0,
          name_service: serv.name,
          path_metric: serv.metrics_path,
          active_service:true,
          metric: null
        };

        const local: createLocationInput = {
          name_location: serv.id,
          country_location: serv.location.country,
          region_location: serv.location.region,
          city_location: serv.location.city,
          latitude_location: serv.location.latitude,
          longitude_location: serv.location.longitude,
          carbon: null,
          service:service
        };
        servs.push(service.name_service);
        await this.cadastrarServiceLocation(service,local,metric,serv.id);

      } catch (error: unknown) {
        if (error instanceof ServiceApiError ||error instanceof CarbonApiError) {
          console.error(
            `[Serviço: ${serv.name}]\n` +
            `${error.name}: ${error.message}\n` +
            `statusCode: ${error.statusCode}\n` +
            `code: ${error.code}`
          );
        } else if (error instanceof Error) {
          console.error(
            `[Serviço: ${serv.name}]\n` +
            `${error.name}: ${error.message}`
          );
        } else {
          console.error(
            `[Serviço: ${serv.name}] Erro desconhecido:`,
            error
          );
        }
        // Continua para o próximo serviço.
        continue;
      }
    }
    try {
      await this.atualizarService(servs);
    } catch (error: unknown) {
      console.error("Falha ao atualizar o estado dos serviços após a coleta:", error);
    }
  }

  private async atualizarService(service_names: string[]){
    await updateServiceStatus(service_names);
  }

  private async cadastrarServiceLocation(service: createServiceInput,local: createLocationInput, metric: CreateMetricInput, externalServiceId: string
  ): Promise<void> {
    
    let lugar = await getLocationByName(
      local.longitude_location,
      local.latitude_location
    );

    if (!lugar) {
      lugar = await createLocation(local);
      console.log("Location cadastrada");
    }

    service.id_location = lugar.id_location;

    let servico = await getServiceByExist(service.name_service);

    if (!servico) {
      servico = await createService(service);
      console.log("Service cadastrado");
    }

    metric.id_service = servico.id_service;

    await createMetricService(metric);
    recordCollectedServiceMetrics(externalServiceId, {
      collection_interval_seconds: metric.colletion_interval_metric,
      metrics: {
        cpu_percent: metric.cpu_metric,
        memory_gb: metric.ram_metric,
        disk_gb: metric.hd_metric,
        network_gb: metric.network_metric,
      },
    });
    console.log("Metric cadastrada");
  }
}
