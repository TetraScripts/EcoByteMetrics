import pool from "../../db/connection";

export type Carbon = {
    id_carbon:number | 0,
	id_location:number,
	date_houry: string,
	intesity_co2e_kwh_carbon:number,
	renewable_percent_carbon:number 
};

export type CreateCarbonInput = Omit<Carbon, "id_carbon">;

export async function createCarbonRepository(carbon: CreateCarbonInput): Promise<Carbon> {
    const result = await pool.query(
        `INSERT INTO carbons (id_location, intesity_co2e_kwh_carbon, renewable_percent_carbon, date_houry)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id_location, date_houry)
         DO UPDATE SET
           intesity_co2e_kwh_carbon = EXCLUDED.intesity_co2e_kwh_carbon,
           renewable_percent_carbon = EXCLUDED.renewable_percent_carbon
         RETURNING *`,
        [
            carbon.id_location,
            carbon.intesity_co2e_kwh_carbon,
            carbon.renewable_percent_carbon,
            carbon.date_houry
        ]
    );
    return result.rows[0];
}

export async function getCarbonByIdRepository(id_carbon: number): Promise<Carbon | null> {
    const result = await pool.query("SELECT * FROM carbons WHERE id_carbon = $1", [id_carbon]);
    return result.rows[0] || null;
}

export async function getCarbonByExistRepository(renewable_percent_carbon:number, intesity_co2e_kwh_carbon:number): Promise<Carbon | null> {
    const result = await pool.query("SELECT * FROM carbons WHERE renewable_percent_carbon = $1 and intesity_co2e_kwh_carbon = $2", 
        [renewable_percent_carbon, intesity_co2e_kwh_carbon]);
    return result.rows[0] || null;
}

export async function listCarbonsByLocationIdRepository(id_location: number): Promise<Carbon[]> {
    const result = await pool.query("SELECT * FROM carbons WHERE id_location = $1", [id_location]);
    return result.rows;
} 

export async function listCarbonsRepository(): Promise<Carbon[]> {
    const result = await pool.query("SELECT * FROM carbons");
    return result.rows || [];
}


