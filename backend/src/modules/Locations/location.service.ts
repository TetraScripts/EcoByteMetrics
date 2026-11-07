
//importação de tipos e funções do repositório de localização, incluindo Location, createLocationInput, createLocationRepository, getLocationByIdRepository e listLocationsRepository.
import {Location, createLocationInput, LocationRepository} from "./location.repository";

/**
 * Criação da classe LocationError que estende a classe Error e
 *  adiciona uma propriedade statusCode para representar o código de status HTTP associado ao erro.
 */
export class LocationError extends Error{
    constructor(message: string, public readonly statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.name = "LocationError";
    }
    /*Função validateLocationId que valida o identificador de localização,
    lançando um erro LocationError se o identificador não for um número inteiro seguro ou for menor ou igual a zero.
    */
    static validateLocationId(id:number):void{
        if(!Number.isSafeInteger(id) || id<=0){
            throw new LocationError("ID da localização invalido",400)
        }
    }

    static validadeLocationInput(localInput:createLocationInput): createLocationInput{
        if(!localInput.name_location || typeof(localInput.name_location) !=="string"||
            localInput.name_location.trim()===""){
            throw new LocationError("Nome da Localização Invalido",400);
        }
        if(!localInput.region_location  || typeof(localInput.region_location)!=="string"||
            localInput.region_location.trim()===""){
            throw new LocationError("Região da Localização Invalido",400);
        }
        if(!localInput.country_location || typeof(localInput.country_location)!=="string"||
            localInput.country_location.trim()===""){
            throw  new LocationError("Pais da Localização Invalido",400)       
        }
        if(!localInput.city_location || typeof(localInput.city_location!=="string") ||
            localInput.city_location.trim()===""){
            throw new LocationError("Cidade da Localização Invalido",400)
        }
        const latitude = localInput.latitude_location;
        const longitude = localInput.longitude_location;

        if (typeof latitude !== "number" ||!Number.isFinite(latitude) ||
            latitude < -90 ||latitude > 90) {
            throw new LocationError("Latitude inválida", 400);
        }

        if (typeof longitude !== "number" ||!Number.isFinite(longitude) ||
            longitude < -180 ||longitude > 180) {
            throw new LocationError("Longitude inválida", 400);
        }
        return localInput;
    }
    static handleRepositoryError(error: unknown): never {
        if (error instanceof LocationError) {
            throw error;
        }
        if (typeof error === "object" && error !== null &&"code" in error &&typeof error.code === "string") {
            switch (error.code) {
                case "23505":
                    throw new LocationError("Registro duplicado.", 409);

                case "23503":
                    throw new LocationError("Localização não encontrada.", 400);

                case "23502":
                    throw new LocationError("Campo obrigatório não informado.", 400);

                case "23514":
                    throw new LocationError("Valor fora das restrições permitidas.", 400);
            }
        }
        throw error;
    }
}
export class LocationService{
    private locationRepository = new LocationRepository();

    async createLocation(local:createLocationInput):Promise<Location> {
        const data = LocationError.validadeLocationInput(local)
        try{
            const location = await this.locationRepository.createLocationRepository(data);
            if(!location){
                throw new LocationError("Não foi possivel cadastrar Localização",500);
            }
            return location;
            
        }catch(error){
            LocationError.handleRepositoryError(error)
        }
    }

    async getLocationById(id_location:number):Promise<Location> {
        try{
            LocationError.validateLocationId(id_location)
            const location = await this.locationRepository.getLocationByIdRepository(id_location)
            if(!location){
                throw new LocationError("Localização não encotrado", 404)
            }
            return location;
        }catch(error){
            LocationError.handleRepositoryError(error);
        }
        
    }

    async getLocationByName(longitude_location:number, latitude_location:number):Promise<Location | null> {
        try{
            const location = await this.locationRepository.getLocationByExistRepository(longitude_location,latitude_location)
            
            return location;
        }catch(error){
            LocationError.handleRepositoryError(error);
        }   
    }

    async listLocationALl():Promise<Location[]> {
        const location = await this.locationRepository.listLocationsRepository();
        if(location.length===0){
            throw new LocationError("Não existe Localizações", 404)
        }
        return location;
    }
}



