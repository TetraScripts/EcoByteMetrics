-- Legacy metric/carbon workers wrote UTC ISO strings into TIMESTAMP columns.
-- Preserve those clock values as UTC instants; never reinterpret them as local time.
DO $$
DECLARE target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['services','metrics','carbons'] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = target
        AND column_name = 'date_houry' AND data_type = 'timestamp without time zone') THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN date_houry TYPE timestamptz USING date_houry AT TIME ZONE ''UTC''', target);
    END IF;
  END LOOP;
END $$;

ALTER TABLE services ADD COLUMN IF NOT EXISTS external_id text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS location_metadata jsonb NOT NULL DEFAULT '{}';
UPDATE services SET external_id = substring(path_metric FROM '^/metrics/(.+)$') WHERE external_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS services_external_id_idx ON services(external_id);
UPDATE services s SET location_metadata = jsonb_build_object(
  'region_code', l.name_location, 'country', l.country_location, 'region', l.region_location,
  'city', l.city_location, 'latitude', l.latitude_location, 'longitude', l.longitude_location)
FROM locations l WHERE s.id_location = l.id_location AND s.location_metadata = '{}';

ALTER TABLE metrics ADD COLUMN IF NOT EXISTS carbon_intensity numeric;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS renewable_percent numeric;
ALTER TABLE metrics ADD COLUMN IF NOT EXISTS location_metadata jsonb;
-- Do not invent a factor for legacy samples collected by independent workers.
CREATE INDEX IF NOT EXISTS metrics_collected_at_idx ON metrics(date_houry, id_service);
CREATE TABLE IF NOT EXISTS monitoring_collections (
  collected_at timestamptz PRIMARY KEY,
  catalog jsonb NOT NULL,
  errors jsonb NOT NULL DEFAULT '{}',
  carbon_available boolean NOT NULL
);
ALTER TABLE carbons DROP CONSTRAINT IF EXISTS carbons_intesity_co2e_kwh_carbon_check;
ALTER TABLE carbons ALTER COLUMN intesity_co2e_kwh_carbon TYPE numeric;
ALTER TABLE carbons ALTER COLUMN renewable_percent_carbon TYPE numeric;
ALTER TABLE carbons ADD CONSTRAINT carbons_intesity_co2e_kwh_carbon_check CHECK (intesity_co2e_kwh_carbon >= 0);
