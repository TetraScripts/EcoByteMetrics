import pool from "../../db/connection";
import { Carbon , CreateCarbonInput } from "../Carbons/carbon.repository";
import { createServiceInput, Service } from "../Services/service.repository";

//Criação do tipo Location, que representa uma localização geográfica com informações detalhadas, incluindo nome, país, cidade, região, latitude, longitude e referências a serviços e carbono associados.
export type Location = {
  id_location: number;
  name_location: string;
  country_location: string;
  city_location: string;
  region_location: string;
  latitude_location: number;
  longitude_location: number;
  service: Service |createServiceInput| null;
  carbon: Carbon | CreateCarbonInput |null;
};
/*Criação do tipo createLocationInput, que representa os dados necessários para criar uma nova localização,
 excluindo o identificador único da localização.
 */
export type createLocationInput = Omit<Location, "id_location">; 
export class LocationRepository{
    //Função assíncrona createLocationRepository que insere uma nova localização no banco de dados e retorna a localização criada.
    async createLocationRepository(loc: createLocationInput): Promise<Location> {
        const result = await pool.query(
            `INSERT INTO Locations (
                name_location,
                country_location,
                city_location,
                region_location,
                latitude_location,
                longitude_location
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *`,
            [
                loc.name_location,
                loc.country_location,
                loc.city_location,
                loc.region_location,
                loc.latitude_location,
                loc.longitude_location
            ]
        );
        return result.rows[0];
    }
    /*Função assíncrona getLocationByIdRepository que busca uma localização no banco de dados pelo seu identificador único e
    retorna a localização encontrada ou null se não existir.
    */
    async getLocationByIdRepository(id_location: number): Promise<Location | null> {
        const result = await pool.query("SELECT * FROM locations WHERE id_location = $1", [id_location]);
        return result.rows[0] || null;
    }

    //Verifica se existe no banco de dados
    async getLocationByExistRepository(longitude_location:number, latitude_location:number): Promise<Location | null> {
        const result = await pool.query("SELECT * FROM locations WHERE longitude_location = $1 and latitude_location =$2", [longitude_location, latitude_location]);
        return result.rows[0] || null;
    }
    /*Função assíncrona listLocationsRepository que busca todas as localizações no banco de dados e
    retorna uma lista de localizações encontradas ou uma lista vazia se não houver localizações.
    */
    async  listLocationsRepository(): Promise<Location[]> {
        const result = await pool.query("SELECT * FROM locations");
        return result.rows || [];
    }
}


