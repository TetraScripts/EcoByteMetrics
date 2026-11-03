-- Legacy samples referenced the service's saved region instead of capturing a factor.
-- Restore the last factor already recorded for that region at the sample timestamp.
-- Never borrow a future/current factor or fill a failed unified collection.
WITH historical_factors AS (
  SELECT m.id_metric, c.intesity_co2e_kwh_carbon AS intensity,
    c.renewable_percent_carbon AS renewable
  FROM metrics m
  JOIN services s USING (id_service)
  CROSS JOIN LATERAL (
    SELECT cb.intesity_co2e_kwh_carbon, cb.renewable_percent_carbon
    FROM carbons cb
    WHERE cb.id_location = s.id_location AND cb.date_houry <= m.date_houry
    ORDER BY cb.date_houry DESC LIMIT 1
  ) c
  WHERE m.carbon_intensity IS NULL AND m.location_metadata IS NULL
)
UPDATE metrics m SET carbon_intensity = h.intensity, renewable_percent = h.renewable
FROM historical_factors h WHERE m.id_metric = h.id_metric;
