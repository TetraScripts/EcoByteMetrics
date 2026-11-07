import pool from "../../db/connection";

export type Metric = {  
    id_metric : number,
	id_service : number,
	date_houry : string,
	cpu_metric : number,
	ram_metric : number,
	hd_metric : number,
	network_metric : number, 
    colletion_interval_metric : number
};

export type CreateMetricInput = Omit<Metric, "id_metric">;

export class MetricRepository{
    async createMetricRepository(metric: CreateMetricInput): Promise<Metric> {
        const result = await pool.query(
            `INSERT INTO Metrics (
                id_service,
                cpu_metric,
                ram_metric,
                hd_metric,
                network_metric,
                date_houry,
                colletion_interval_metric
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id_service, date_houry)
                DO UPDATE SET
                cpu_metric = EXCLUDED.cpu_metric,
                ram_metric = EXCLUDED.ram_metric,
                hd_metric = EXCLUDED.hd_metric,
                network_metric = EXCLUDED.network_metric,
                colletion_interval_metric =
                    EXCLUDED.colletion_interval_metric
                RETURNING *;`,
            [
            metric.id_service,
            metric.cpu_metric,
            metric.ram_metric,
            metric.hd_metric,
            metric.network_metric,
            metric.date_houry,
            metric.colletion_interval_metric
            ]
        );
        return result.rows[0];
    }

    async getMetricByIdRepository(id_metric: number): Promise<Metric | null> {
        const result = await pool.query("SELECT * FROM metrics WHERE id_metric = $1", [id_metric]);
        return result.rows[0] || null;
    }

    async listMetricsByServiceIdRepository(id_service: number): Promise<Metric[]> {
        const result = await pool.query("SELECT * FROM metrics WHERE id_service = $1", [id_service]);
        return result.rows;
    }
}

