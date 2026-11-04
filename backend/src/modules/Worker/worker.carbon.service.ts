import { CarbonRegion } from "../../integrations/api.types";
import { CarbonApiError } from "../../integrations/carbon-api";
import { CreateCarbonInput } from "../Carbons/carbon.repository";
import { CarbonError, createCarbonService } from "../Carbons/carbon.service";
import { createLocationInput } from "../Locations/location.repository";
import { createLocation, getLocationByName } from "../Locations/location.service";

export class WorkerCarbons{
    //metodo async que pegar uma lista de Carbons e cadastra a lista
    async listarCarbons(carbonsReg:CarbonRegion[]){
      try{
        let i=0;
        const agora = new Date();
        while(i<=carbonsReg.length-1){ 
          try{
            //preenche dos dados da api para as interfaces que representa o banco de dados
            let carbon : CreateCarbonInput ={
              id_location:0,
              date_houry: agora.toISOString(),
              renewable_percent_carbon:carbonsReg[i].renewable_share_percent,
              intesity_co2e_kwh_carbon:carbonsReg[i].carbon_intensity_gco2e_per_kwh
            }
            let local: createLocationInput={
              name_location:carbonsReg[i].code,
              country_location:carbonsReg[i].country,
              region_location:carbonsReg[i].region,
              city_location:carbonsReg[i].city,
              latitude_location:carbonsReg[i].latitude,
              longitude_location:carbonsReg[i].longitude,
              carbon:carbon,
              service:null
            }
            await this.cadastrarCarbonLocation(carbon,local);
          }catch(error:unknown){
            if(error instanceof CarbonApiError){
              console.error(
                `${error.name}: ${error.message}\n` +
                `statusCode: ${error.statusCode}\n` );
            }else{
                console.log("Erro desconhecido");
            }
          }
           i++; 
        }
      }catch(error){
        if(error instanceof CarbonError)
          console.error(
          `${error.name}: ${error.message}\n` +
          `statusCode: ${error.statusCode}\n`);
      }
    }
    //metodo asyc que cadastrar cada item da lista
    private async cadastrarCarbonLocation(carbon:CreateCarbonInput, local:createLocationInput){
        try{
        const Lugar= await getLocationByName(local.longitude_location, local.latitude_location)
        if(!Lugar){
          const l = await createLocation(local);
          carbon.id_location=l.id_location;
          console.log("Cadastrado Location");
          
        }else{
          carbon.id_location=Lugar.id_location
        }
        // Cada localização e instante têm sua própria amostra, mesmo com valores iguais.
        await createCarbonService(carbon);
        console.log("Cadastrado Carbon");
            
      }catch(error){
        if(error instanceof Error)
          console.error(error);
          console.error("Error não indenticado");
      }
    }
}
