import pool from "../../db/connection";
import { CreateMetricInput, Metric } from "../Metrics/metric.repository";

export type Service = {
    id_service :number, 
    id_location :number,
	name_service :string,
	path_metric :string,
    active_service:boolean
    metric: Metric[] | CreateMetricInput | null;
};
export type createServiceInput = Omit<Service, "id_service">;

export class ServiceRepository{

    async createServiceRepository(serv: createServiceInput): Promise<Service> {
        const result = await pool.query(
            `INSERT INTO Services (
                    id_location,
                    name_service,
                    path_metric,
                    active_service
                )
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (name_service)
                DO UPDATE SET
                    id_location=EXCLUDED.id_location,
                    path_metric = EXCLUDED.path_metric,
                    active_service = EXCLUDED.active_service
                RETURNING *;`,
            [serv.id_location, serv.name_service, serv.path_metric, serv.active_service]
        );
        return result.rows[0] || null;
    }
    async updateServiceStatusRepository(service_names:string[]): Promise<void> {
    
        const client = await pool.connect();

        try {
            await client.query("BEGIN");

            // 1. Reativar serviços que voltaram a aparecer na API
            const activated = await client.query(
                `UPDATE services
                SET active_service = TRUE,
                    date_houry = NOW()
                WHERE active_service = FALSE
                AND name_service = ANY($1::text[])
                RETURNING *`,
                [service_names]
            );

            // 2. Desativar serviços que não aparecem mais na API
            const deactivated = await client.query(
                `UPDATE services
                SET active_service = FALSE,
                    date_houry = NOW()
                WHERE active_service = TRUE
                AND NOT (
                    name_service = ANY($1::text[])
                )
                RETURNING *`,
                [service_names]
            );

            await client.query("COMMIT");
            console.log(`Serviços atualizados: ${activated.rowCount} ativados, ${deactivated.rowCount} desativados.`);

        } catch (error) {
            await client.query("ROLLBACK");
            throw error;

        } finally {
            client.release();
        }
    }
    async getServiceByIdRepository(id_service: number): Promise<Service | null> {
        const result = await pool.query("SELECT * FROM services WHERE id_service = $1", [id_service]);
        return result.rows[0] || null;
    }

    async getServiceByExistRepository(name_service:string): Promise<Service | null> {
        const result = await pool.query("SELECT * FROM services WHERE name_service = $1", [name_service]);
        return result.rows[0] || null;
    }

    async listServicesByLocationIdRepository(id_location: number): Promise<Service[]> {
        const result = await pool.query("SELECT * FROM services WHERE id_location = $1", [id_location]);
        return result.rows || [];
    }

    async listServicesRepository(): Promise<Service[]> {
        const result = await pool.query("SELECT * FROM services");
        return result.rows;
    }
    
}
