
import pool from "../../db/connection.js";

export interface GlobalStatistics {
  total_consumption_kwh: number;
  total_co2e_g: number | null;
  active_services: number;
  unavailable_services: number;
  total_services: number;
}

export class StatisticRepository {
  private readonly sampleImpactQuery = `
        WITH sample_energy AS (
            SELECT
                m.id_service AS service_id,
                m.date_houry AS collected_at,
                m.colletion_interval_metric AS collection_interval_seconds,

                m.carbon_intensity AS carbon_intensity_gco2e_per_kwh,

                (
                    (m.cpu_metric / 100.0 * 120) +
                    (m.ram_metric * 0.375) +
                    (m.hd_metric * 0.01) +
                    (m.network_metric * 0.02)
                ) * m.colletion_interval_metric / 3600000.0
                    AS consumption_kwh

            FROM Metrics AS m

            -- INNER JOIN is only for referential integrity (a metric must belong to a service).
            -- Carbon coverage is independent: m.carbon_intensity may be NULL and the sample remains.
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
                    carbon_intensity_gco2e_per_kwh AS emissions_co2e_g
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

                SUM(emissions_co2e_g)::float8 AS "emissaoTotalCo2eG",
                COUNT(*)::int AS "sampleCount",
                COUNT(emissions_co2e_g)::int AS "coveredEmissionSamples",

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
        : '"emissaoCo2eG"';

    const result = await pool.query(
      `
                ${this.sampleImpactQuery}

                SELECT
                    s.id_service AS id,
                    s.name_service AS nome,

                    COALESCE(
                        SUM(i.consumption_kwh), 0
                    )::float8 AS "consumoKwh",

                    SUM(i.emissions_co2e_g)::float8 AS "emissaoCo2eG",
                    COUNT(i.collected_at)::int AS "sampleCount",
                    COUNT(i.emissions_co2e_g)::int AS "coveredEmissionSamples"

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
                    ${sortColumn} DESC NULLS LAST,
                    nome ASC;
            `,
      [period]
    );

    return result.rows;
  }

  async getCalculationEmissionQuery(period: string): Promise<GlobalStatistics> {
    const query = `
      WITH service_status AS (
        SELECT
          COUNT(*) FILTER (
            WHERE active_service = TRUE
          ) AS active_services,

          COUNT(*) FILTER (
            WHERE active_service = FALSE
          ) AS unavailable_services,

          COUNT(*) AS total_services

        FROM services
      ),

      individual_consumption AS (
        SELECT
          m.id_service,
          m.date_houry,

          (
            (
              (m.cpu_metric / 100.0 * 120) +
              (m.ram_metric * 0.375) +
              (m.hd_metric * 0.01) +
              (m.network_metric * 0.02)
            ) * m.colletion_interval_metric / 3600000
          ) AS consumption_kwh,

          m.carbon_intensity AS carbon_intensity

        FROM metrics m

        -- INNER JOIN validates the metric owner only. The factor is the historical
        -- snapshot stored on this metric and may legitimately be NULL.
        INNER JOIN services s
          ON s.id_service = m.id_service

        WHERE s.active_service = TRUE
          AND m.date_houry >= NOW() - $1::interval
      )

      SELECT
        COALESCE(
          SUM(ic.consumption_kwh),
          0
        ) AS total_consumption_kwh,

        -- kWh * gCO2e/kWh = gCO2e; do not divide by 1000.
        SUM(
          ic.consumption_kwh * ic.carbon_intensity
        ) AS total_co2e_g,

        ss.active_services,
        ss.unavailable_services,
        ss.total_services

      FROM service_status ss

      LEFT JOIN individual_consumption ic
        ON TRUE

      GROUP BY
        ss.active_services,
        ss.unavailable_services,
        ss.total_services;
    `;

    const result = await pool.query(query, [period]);

    const row = result.rows[0];

    return {
      total_consumption_kwh: Number(row.total_consumption_kwh),
      total_co2e_g: row.total_co2e_g == null ? null : Number(row.total_co2e_g),
      active_services: Number(row.active_services),
      unavailable_services: Number(row.unavailable_services),
      total_services: Number(row.total_services)
    };
  
 }

    async getEnergyCalculationUnitService(nome_service:string){
        const query=`SELECT DISTINCT ON (s.id_service)
                    s.id_service,
                    s.name_service,
                    s.active_service,
                    m.id_metric,
                    m.date_houry,

                    -- Potência da CPU (W)
                    (m.cpu_metric / 100.0) * 120 AS cpu_power_w,

                    -- Potência da memória (W)
                    m.ram_metric * 0.375 AS ram_power_w,

                    -- Potência do disco (W)
                    m.hd_metric * 0.01 AS disk_power_w,

                    -- Potência da rede (W)
                    m.network_metric * 0.02 AS network_power_w,

                    -- Potência total (W)
                    (
                        (m.cpu_metric / 100.0) * 120 +
                        (m.ram_metric * 0.375) +
                        (m.hd_metric * 0.01) +
                        (m.network_metric * 0.02)
                    ) AS total_power_w,

                    -- Consumo energético (kWh)
                    (
                        (
                            (m.cpu_metric / 100.0) * 120 +
                            (m.ram_metric * 0.375) +
                            (m.hd_metric * 0.01) +
                            (m.network_metric * 0.02)
                        ) * m.colletion_interval_metric
                    ) / 3600000.0 AS consumption_kwh,

                    -- Intensidade de carbono
                    m.carbon_intensity,

                    -- Emissão de CO2e (g)
                    (
                        (
                            (
                                (m.cpu_metric / 100.0) * 120 +
                                (m.ram_metric * 0.375) +
                                (m.hd_metric * 0.01) +
                                (m.network_metric * 0.02)
                            ) * m.colletion_interval_metric
                        ) / 3600000.0
                        * m.carbon_intensity
                    ) AS co2e_g

                FROM Services s

                INNER JOIN Metrics m
                    ON s.id_service = m.id_service


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
                    (m.cpu_metric / 100.0) * 120 AS cpu_power_w,

                    -- Potência da memória (W)
                    m.ram_metric * 0.375 AS ram_power_w,

                    -- Potência do disco (W)
                    m.hd_metric * 0.01 AS disk_power_w,

                    -- Potência da rede (W)
                    m.network_metric * 0.02 AS network_power_w,

                    -- Potência total (W)
                    (
                        (m.cpu_metric / 100.0) * 120 +
                        (m.ram_metric * 0.375) +
                        (m.hd_metric * 0.01) +
                        (m.network_metric * 0.02)
                    ) AS total_power_w,

                    -- Consumo energético (kWh)
                    (
                        (
                            (m.cpu_metric / 100.0) * 120 +
                            (m.ram_metric * 0.375) +
                            (m.hd_metric * 0.01) +
                            (m.network_metric * 0.02)
                        ) * m.colletion_interval_metric
                    ) / 3600000.0 AS consumption_kwh,

                    -- Intensidade de carbono
                    m.carbon_intensity,

                    -- Emissão de CO2e (g)
                    (
                        (
                            (
                                (m.cpu_metric / 100.0) * 120 +
                                (m.ram_metric * 0.375) +
                                (m.hd_metric * 0.01) +
                                (m.network_metric * 0.02)
                            ) * m.colletion_interval_metric
                        ) / 3600000.0
                        * m.carbon_intensity
                    ) AS co2e_g

                FROM Services s

                INNER JOIN Metrics m
                    ON s.id_service = m.id_service


                ORDER BY
                    s.id_service,
                    m.date_houry DESC,
                    m.id_metric DESC;`);
        return result.rows;
    }
}
