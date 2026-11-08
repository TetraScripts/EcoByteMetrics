
import pool from "../../db/connection.js";

export interface GlobalStatistics {
  total_consumption_kwh: number;
  total_co2e_kg: number;
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
              (m.cpu_metric / 100 * 100) +
              (m.ram_metric * 0.375) +
              (m.hd_metric * 0.01) +
              (m.network_metric * 0.02)
            ) * m.colletion_interval_metric / 3600000
          ) AS consumption_kwh,

          COALESCE(carbon.intensity, 0) AS carbon_intensity

        FROM metrics m

        INNER JOIN services s
          ON s.id_service = m.id_service

        INNER JOIN locations l
          ON l.id_location = s.id_location

        LEFT JOIN LATERAL (
          SELECT
            cb.intesity_co2e_kwh_carbon AS intensity

          FROM carbons cb

          WHERE cb.id_location = l.id_location
            AND cb.date_houry <= m.date_houry

          ORDER BY cb.date_houry DESC

          LIMIT 1

        ) carbon ON TRUE

        WHERE s.active_service = TRUE
          AND m.date_houry >= NOW() - $1::interval
      )

      SELECT
        COALESCE(
          SUM(ic.consumption_kwh),
          0
        ) AS total_consumption_kwh,

        COALESCE(
          SUM(
            ic.consumption_kwh *
            ic.carbon_intensity / 1000
          ),
          0
        ) AS total_co2e_kg,

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
      total_co2e_kg: Number(row.total_co2e_kg),
      active_services: Number(row.active_services),
      unavailable_services: Number(row.unavailable_services),
      total_services: Number(row.total_services)
    };
  }


}
