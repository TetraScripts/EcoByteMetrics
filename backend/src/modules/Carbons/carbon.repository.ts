import pool from "../../db/connection";

export type Carbon = {
    id_carbon:number,
	id_location:number,
	date_houry: string,
	intesity_co2e_kwh_carbon:number,
	renewable_percent_carbon:number 
};

export type CreateCarbonInput = Omit<Carbon, "id_carbon">;

export class CarbonRepository {
    /** cria um novo registro de carbono no banco de dados */
    async createCarbon(carbon: CreateCarbonInput): Promise<Carbon> {
        const result = await pool.query(
            `INSERT INTO carbons (id_location, intesity_co2e_kwh_carbon, renewable_percent_carbon, date_houry)
               VALUES ($1, $2, $3, $4) RETURNING *`,  
            [
                carbon.id_location,
                carbon.intesity_co2e_kwh_carbon,
                carbon.renewable_percent_carbon,
                carbon.date_houry
            ]
        );
        return result.rows[0];
    }
    async updateCarbon(carbon: CreateCarbonInput): Promise<Carbon> {
        const result = await pool.query(
            `UPDATE carbons
             SET intesity_co2e_kwh_carbon = $1, renewable_percent_carbon = $2, date_houry = $3
             WHERE id_location = $4
             RETURNING *`,
            [
                carbon.intesity_co2e_kwh_carbon,
                carbon.renewable_percent_carbon,
                carbon.date_houry,
                carbon.id_location
            ]
        );
        return result.rows[0];
    }
    /**  busca um registro de carbono pelo id */
    async getCarbonById(id_carbon: number): Promise<Carbon | null> {
        const result = await pool.query("SELECT * FROM carbons WHERE id_carbon = $1", [id_carbon]);
        return result.rows[0] ?? null;
    }
    /** busca um registro de carbono pelo id_location */
    async getCarbonByLocationId(id_location: number): Promise<Location | null> {
        const query = `select * from locations as l inner join carbons as c on l.id_location=c.id_location where l.id_location=$1;`;
        const result = await pool.query(query, [id_location]);
        return result.rows[0] || null;
    }
    /** busca um registro de carbono por existência */  
    async getCarbonByExist(id_location: number, renewable_percent_carbon: number, intesity_co2e_kwh_carbon: number): Promise<Carbon | null> {
        const result = await pool.query("SELECT * FROM carbons WHERE id_location = $1 AND renewable_percent_carbon = $2 AND intesity_co2e_kwh_carbon = $3", 
            [id_location, renewable_percent_carbon, intesity_co2e_kwh_carbon]);
        return result.rows[0] ?? null;
    }
    /** lista todos os registros de carbono */   
    async listCarbons(): Promise<Location[]> {
        
        const result = await pool.query("select * from locations as l inner join carbons as c on l.id_location=c.id_location");
        return result.rows;
    }
}
