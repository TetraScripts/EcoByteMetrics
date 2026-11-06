import pool from "../../db/connection.js";

export class StatisticRepository {
    private readonly sampleImpactQuery = `
        WITH sample_energy AS (
            SELECT
                m.id_service AS service_id,
                m.date_houry AS collected_at,
                m.colletion_interval_metric AS collection_interval_seconds,

                m.carbon_intensity AS carbon_intensity_gco2e_per_kwh,

                (
                    (m.cpu_metric / 100.0 * 100) +
                    (m.ram_metric * 0.375) +
                    (m.hd_metric * 0.01) +
                    (m.network_metric * 0.02)
                ) * m.colletion_interval_metric / 3600000.0
                    AS consumption_kwh

            FROM Metrics AS m

            INNER JOIN Services AS s
                ON s.id_service = m.id_service

            WHERE s.active_service = TRUE
        ),

        sample_impact AS (
            SELECT
                service_id,
                collected_at,
                consumption_kwh,
                consumption_kwh *
                    carbon_intensity_gco2e_per_kwh AS emissions_co2e
            FROM sample_energy
        )
    `;

    async getStatisticsSummaryQuery() {
        const result = await pool.query(`
            ${this.sampleImpactQuery}

            SELECT
                (
                    SELECT COUNT(*)::int
                    FROM Services
                    WHERE active_service = TRUE
                ) AS "totalServicos",

                COALESCE(
                    SUM(consumption_kwh), 0
                )::float8 AS "consumoTotalKwh",

                SUM(emissions_co2e)::float8 AS "emissaoTotalCo2e",
                COUNT(*)::int AS "sampleCount",
                COUNT(emissions_co2e)::int AS "coveredEmissionSamples",

                (
                    SELECT MAX(date_houry)
                    FROM Metrics
                ) AS "dataHoraUltimaAtualizacao"

            FROM sample_impact;
        `);

        return result.rows[0];
    }

    async getServicesRankingQuery(
        period: string,
        orderBy: "kwh" | "co2e"
    ) {
        const sortColumn =
            orderBy === "kwh"
                ? '"consumoKwh"'
                : '"emissaoCo2e"';

        const result = await pool.query(
            `
                ${this.sampleImpactQuery}

                SELECT
                    s.id_service AS id,
                    s.name_service AS nome,

                    COALESCE(
                        SUM(i.consumption_kwh), 0
                    )::float8 AS "consumoKwh",

                    SUM(i.emissions_co2e)::float8 AS "emissaoCo2e",
                    COUNT(i.collected_at)::int AS "sampleCount",
                    COUNT(i.emissions_co2e)::int AS "coveredEmissionSamples"

                FROM Services AS s

                LEFT JOIN sample_impact AS i
                    ON i.service_id = s.id_service
                    AND i.collected_at >=
                        NOW() - $1::interval

                WHERE s.active_service = TRUE

                GROUP BY
                    s.id_service,
                    s.name_service

                ORDER BY
                    ${sortColumn} DESC,
                    nome ASC;
            `,
            [period]
        );

        return result.rows;
    }

    async getEnergyCalculationUnitService(nome_service:string){
        const query=`SELECT DISTINCT ON (s.id_service)
                    s.id_service,
                    s.name_service,
                    s.active_service,
                    m.id_metric,
                    m.date_houry,

                    -- Potência da CPU (W)
                    (m.cpu_metric / 100.0) * 100 AS cpu_power_w,

                    -- Potência da memória (W)
                    m.ram_metric * 0.375 AS ram_power_w,

                    -- Potência do disco (W)
                    m.hd_metric * 0.01 AS disk_power_w,

                    -- Potência da rede (W)
                    m.network_metric * 0.02 AS network_power_w,

                    -- Potência total (W)
                    (
                        (m.cpu_metric / 100.0) * 100 +
                        (m.ram_metric * 0.375) +
                        (m.hd_metric * 0.01) +
                        (m.network_metric * 0.02)
                    ) AS total_power_w,

                    -- Consumo energético (kWh)
                    (
                        (
                            (m.cpu_metric / 100.0) * 100 +
                            (m.ram_metric * 0.375) +
                            (m.hd_metric * 0.01) +
                            (m.network_metric * 0.02)
                        ) * m.colletion_interval_metric
                    ) / 3600000.0 AS consumption_kwh,

                    -- Intensidade de carbono
                    c.intesity_co2e_kwh_carbon,

                    -- Emissão de CO2e (kg)
                    (
                        (
                            (
                                (m.cpu_metric / 100.0) * 100 +
                                (m.ram_metric * 0.375) +
                                (m.hd_metric * 0.01) +
                                (m.network_metric * 0.02)
                            ) * m.colletion_interval_metric
                        ) / 3600000.0
                        * c.intesity_co2e_kwh_carbon
                    ) / 1000.0 AS co2e_kg

                FROM Services s

                INNER JOIN Metrics m
                    ON s.id_service = m.id_service

                INNER JOIN LATERAL (
                    SELECT cb.intesity_co2e_kwh_carbon
                    FROM Carbons cb
                    WHERE cb.id_location = s.id_location
                    AND cb.date_houry <= m.date_houry
                    ORDER BY cb.date_houry DESC
                    LIMIT 1
                ) c ON TRUE

                WHERE s.name_service=$1

                ORDER BY
                    s.id_service,
                    m.date_houry DESC,
                    m.id_metric DESC;`;

        const result = await pool.query(query, [nome_service]);

        return result.rows[0]
    }

    async getEnergyCalculation(){
        const result = await pool.query(`SELECT DISTINCT ON (s.id_service)
                    s.id_service,
                    s.name_service,
                    s.active_service,
                    m.id_metric,
                    m.date_houry,

                    -- Potência da CPU (W)
                    (m.cpu_metric / 100.0) * 100 AS cpu_power_w,

                    -- Potência da memória (W)
                    m.ram_metric * 0.375 AS ram_power_w,

                    -- Potência do disco (W)
                    m.hd_metric * 0.01 AS disk_power_w,

                    -- Potência da rede (W)
                    m.network_metric * 0.02 AS network_power_w,

                    -- Potência total (W)
                    (
                        (m.cpu_metric / 100.0) * 100 +
                        (m.ram_metric * 0.375) +
                        (m.hd_metric * 0.01) +
                        (m.network_metric * 0.02)
                    ) AS total_power_w,

                    -- Consumo energético (kWh)
                    (
                        (
                            (m.cpu_metric / 100.0) * 100 +
                            (m.ram_metric * 0.375) +
                            (m.hd_metric * 0.01) +
                            (m.network_metric * 0.02)
                        ) * m.colletion_interval_metric
                    ) / 3600000.0 AS consumption_kwh,

                    -- Intensidade de carbono
                    c.intesity_co2e_kwh_carbon,

                    -- Emissão de CO2e (kg)
                    (
                        (
                            (
                                (m.cpu_metric / 100.0) * 100 +
                                (m.ram_metric * 0.375) +
                                (m.hd_metric * 0.01) +
                                (m.network_metric * 0.02)
                            ) * m.colletion_interval_metric
                        ) / 3600000.0
                        * c.intesity_co2e_kwh_carbon
                    ) / 1000.0 AS co2e_kg

                FROM Services s

                INNER JOIN Metrics m
                    ON s.id_service = m.id_service

                INNER JOIN LATERAL (
                    SELECT cb.intesity_co2e_kwh_carbon
                    FROM Carbons cb
                    WHERE cb.id_location = s.id_location
                    AND cb.date_houry <= m.date_houry
                    ORDER BY cb.date_houry DESC
                    LIMIT 1
                ) c ON TRUE

                ORDER BY
                    s.id_service,
                    m.date_houry DESC,
                    m.id_metric DESC;`);
        return result.rows;
    }
}
