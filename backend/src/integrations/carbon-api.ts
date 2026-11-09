import { Carbon } from "../modules/Carbons/carbon.repository";
import {ApiError, CarbonRegion, ListCarbon}from "./api.types"

//Classe para validar API
export class CarbonAPISevice{
    private readonly carbonApi = process.env.API_CARBON;
    //verifica se a api esta ativa
    async checkHealth(): Promise<{service:string, status:string}>{
        //Verifica variavel de ambiente de api não esta vazio
        CarbonApiError.apiNull(this.carbonApi);
        let response: Response;
        try{
        response = await fetch(`${this.carbonApi}/health`,{
            signal: AbortSignal.timeout(5000),
            headers: {
                Accept: "application/json",
            },
        });
        }catch(error: unknown){
            //Verefica se a api passou muito tentando buscar
            CarbonApiError.timeError(error);
            throw new CarbonApiError(
            "Não foi possível conectar à API externa.",
            503,
            "EXTERNAL_API_UNAVAILABLE"
            );
        }
        if(!response.ok){
           throw new CarbonApiError(
            `A API externa respondeu com HTTP ${response.status}.`,
            502,
            "EXTERNAL_API_HTTP_ERROR"
           )
        }
        CarbonApiError.httpError(response);
        let data;
        try{
            data = await response.json();
        }catch{
            CarbonApiError.isNotlist(data);
            throw new CarbonApiError(
            "A API externa retornou um JSON inválido ou vazio.",
            502,
            "EXTERNAL_API_INVALID_JSON"
            );
        }
        return data as {service:string, status:string};
    }
    //pega todas as regiões na API
    async listCabons():Promise<ListCarbon>{
        CarbonApiError.apiNull(this.carbonApi);
        let response: Response;
        try{
            //Pesquisa todas as regiões
            response = await fetch(`${this.carbonApi}/regions`, {
            signal: AbortSignal.timeout(5000),
            headers: {
                Accept: "application/json",
            },
            });
       
        }catch(error: unknown){
            //Verefica se a api passou muito tentando buscar
            CarbonApiError.timeError(error);
            throw new CarbonApiError(
            "Não foi possível conectar à API externa.",
            503,
            "EXTERNAL_API_UNAVAILABLE"
            );
        }
        // O fetch não lança exceção automaticamente para HTTP 4xx ou 5xx.
        CarbonApiError.httpError(response);

        let data: unknown;

        try {
            data = await response.json();
        } catch {
            CarbonApiError.isNotlist(data);
            throw new CarbonApiError(
            "A API externa retornou um JSON inválido ou vazio.",
            502,
            "EXTERNAL_API_INVALID_JSON"
            );
        }
        CarbonApiError.validarEstruturaLista(data)
        return data as ListCarbon;

    }
    //pega um região na API
    async getRegionDetails(regionCode: string): Promise<CarbonRegion> {
        CarbonApiError.apiNull(this.carbonApi);
        let response;
        try{
            response = await fetch(`${this.carbonApi}/regions/${regionCode}`, {
            signal: AbortSignal.timeout(5000),
            headers: {
                Accept: "application/json",
            },
            });
        }catch(error:unknown){
            CarbonApiError.timeError(error);
            throw new CarbonApiError(
            "Não foi possível conectar à API externa.",
            503,
            "EXTERNAL_API_UNAVAILABLE"
            );
        }
        // O fetch não lança exceção automaticamente para HTTP 4xx ou 5xx.
        CarbonApiError.httpError(response);

        let data:unknown;

        try{
            data= await response.json();
        }catch(error:unknown){
            CarbonApiError.isNotlist(data);
            throw new CarbonApiError(
            "A API externa retornou um JSON inválido ou vazio.",
            502,
            "EXTERNAL_API_INVALID_JSON"
            );
        }
        CarbonApiError.validarEstrutura(data)
        return data as CarbonRegion
        
    }
}
//Classe de Erro de Api
export class CarbonApiError extends Error implements ApiError {
    constructor(message: string, public readonly statusCode: number, public readonly code: string) {
        super(message);
        this.name = "CarbonApiError";
        this.statusCode=statusCode;
        this.code=code;
         //Object.setPrototypeOf(this, new.target.prototype);
    }
    //verifica se api esta errada
    static apiNull(Api:string | undefined):void{
         if(!Api){
            throw new CarbonApiError(
                "A URL Carbon da API externa não foi configurada.",
                500,
                "API_URL_MISSING"
            )
        }
    }
    //Verifica se tem erro de tempo
    static timeError(error: unknown){
        if(error instanceof  Error &&  error.name === "TimeoutError"){
                throw new CarbonApiError(
                    "A API externa demorou para responder.",
                    504,
                    "EXTERNAL_API_TIMEOUT"
                );
            }
    }
    //Erro do tipo Http
    static httpError(response:Response){
        if(!response.ok){
           throw new CarbonApiError(
            `A API externa respondeu com HTTP ${response.status}.`,
            502,
            "EXTERNAL_API_HTTP_ERROR"
           )
        }
    }
    //verifica se não é lista
    static isNotlist(data:unknown){
        if (!Array.isArray(data)) {
            throw new CarbonApiError(
            "O formato da resposta da API é inválido.",
            502,
            "EXTERNAL_API_INVALID_FORMAT"
            );
        }
    }
    //Validação da estrutura do carbono
    static validarEstrutura(item:unknown){
        if (
            typeof item !== "object" ||
            item === null ||
            !("code" in item) ||
            !("country" in item) ||
            !("region" in item) ||
            !("city" in item) ||
            !("latitude" in item) ||
            !("longitude" in item) ||
            !("carbon_intensity_gco2e_per_kwh" in item) ||
            !("renewable_share_percent" in item) ||

            typeof item.code !== "string" ||
            item.code.trim() === "" ||

            typeof item.country !== "string" ||
            item.country.trim() === "" ||

            typeof item.region !== "string" ||
            item.region.trim() === "" ||

            typeof item.city !== "string" ||
            item.city.trim() === "" ||

            typeof item.latitude !== "number" ||
            !Number.isFinite(item.latitude) ||
            item.latitude < -90 ||
            item.latitude > 90 ||

            typeof item.longitude !== "number" ||
            !Number.isFinite(item.longitude) ||
            item.longitude < -180 ||
            item.longitude > 180 ||

            typeof item.carbon_intensity_gco2e_per_kwh !== "number" ||
            !Number.isFinite(item.carbon_intensity_gco2e_per_kwh) ||
            item.carbon_intensity_gco2e_per_kwh < 0 ||

            typeof item.renewable_share_percent !== "number" ||
            !Number.isFinite(item.renewable_share_percent) ||
            item.renewable_share_percent < 0 ||
            item.renewable_share_percent > 100
            ) {
            throw new CarbonApiError(
                "A API retornou dados incompletos ou inválidos.",
                502,
                "EXTERNAL_API_INVALID_DATA"
            );
            }
    }
    //Validação da estrutura da lista
    static validarEstruturaLista(data:unknown){
        if (
            typeof data !== "object" ||
            data === null ||
            !("regions" in data) ||
            !("total" in data) ||
            !Array.isArray(data.regions) ||
            typeof data.total !== "number" ||
            !Number.isSafeInteger(data.total) ||
            data.total < 0
        ) {
            throw new CarbonApiError(
            "A API retornou uma estrutura de dados inválida.",
            502,
            "EXTERNAL_API_INVALID_DATA"
            );
        }
        for (const item of data.regions) {
            this.validarEstrutura(item);
        }
    } 
}

export interface CarbonRegionFactor {
  code: string;
  carbonIntensity: number;
}

type CarbonFactorFetcher = () => Promise<CarbonRegionFactor[]>;

const carbonApiUrl = process.env.API_CARBON;

export async function fetchCarbonRegions(): Promise<CarbonRegionFactor[]> {
  if (!carbonApiUrl) {
    throw new Error("A variável API_CARBON não foi configurada no ambiente.");
  }

  const baseUrl = carbonApiUrl.replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/regions`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Erro ao consultar regiões de carbono: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  if (
    typeof data !== "object" ||
    data === null ||
    !("regions" in data) ||
    !Array.isArray(data.regions)
  ) {
    throw new Error("Resposta inválida ao consultar regiões de carbono.");
  }

  return data.regions.flatMap((value): CarbonRegionFactor[] => {
    if (typeof value !== "object" || value === null) return [];
    if (
      !("code" in value) || typeof value.code !== "string" ||
      !("carbon_intensity_gco2e_per_kwh" in value) ||
      typeof value.carbon_intensity_gco2e_per_kwh !== "number" ||
      !Number.isFinite(value.carbon_intensity_gco2e_per_kwh) ||
      value.carbon_intensity_gco2e_per_kwh < 0
    ) {
      return [];
    }

    return [{
      code: value.code,
      carbonIntensity: value.carbon_intensity_gco2e_per_kwh,
    }];
  });
}

let carbonFactors = new Map<string, number>();
let fetchFactors: CarbonFactorFetcher = fetchCarbonRegions;

export async function refreshCarbonRegionFactors(): Promise<void> {
  setCarbonRegionFactors(await fetchFactors());
}

export function setCarbonRegionFactors(factors: CarbonRegionFactor[]): void {
  carbonFactors = new Map(
    factors.map((factor) => [factor.code, factor.carbonIntensity]),
  );
}

export function getCarbonIntensity(regionCode: string): number | undefined {
  return carbonFactors.get(regionCode);
}

export function setCarbonFactorsFetcherForTesting(
  fetcher: CarbonFactorFetcher,
): void {
  fetchFactors = fetcher;
}

export function resetCarbonFactorsForTesting(): void {
  fetchFactors = fetchCarbonRegions;
  carbonFactors.clear();
}