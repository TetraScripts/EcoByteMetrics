create table Users(
	id_user int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	name_user varchar(50) not null,
	email_user varchar(254) not null unique,
	password_user varchar(255)not null
);
create table Locations(
	id_location int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	name_location varchar(50)not null unique,
	country_location varchar(50),
	region_location varchar(50),
	city_location varchar(50),
	latitude_location double precision not null
	CHECK (latitude_location BETWEEN -90 AND 90),
	longitude_location double precision not null
	CHECK (longitude_location BETWEEN -180 AND 180)
);

create table Services(
	id_service int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	id_location int ,
	name_service varchar(50)not null unique,
	path_metric varchar(50) not null,
	external_id text,
	location_metadata jsonb NOT NULL DEFAULT '{}',
	active_service BOOLEAN NOT NULL DEFAULT TRUE,
	date_houry TIMESTAMPTZ DEFAULT NOW(),
	constraint fk_service 
		foreign key (id_location)
		references locations(id_location)
);

create table Metrics (
	id_metric bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	id_service int,
	cpu_metric numeric not null
	CHECK (cpu_metric BETWEEN 0 AND 100),
	ram_metric numeric not null check(ram_metric>=0),
	hd_metric numeric not null check(hd_metric>=0),
	network_metric numeric not null check(hd_metric>=0),
	date_houry TIMESTAMPTZ NOT NULL,
	colletion_interval_metric numeric not null,
	carbon_intensity numeric,
	renewable_percent numeric,
	location_metadata jsonb,
	constraint fk_service
		foreign key (id_service)
		references services(id_service),
	CONSTRAINT uq_metrics_service_date
        UNIQUE (id_service, date_houry)
);

create table Carbons(
	id_carbon int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	id_location int,
	date_houry TIMESTAMPTZ not null,
	intesity_co2e_kwh_carbon numeric not null check(intesity_co2e_kwh_carbon>=0),
	renewable_percent_carbon numeric not null
	CHECK (renewable_percent_carbon BETWEEN 0 AND 100),
	constraint fk_service
		foreign key(id_location)
		references locations(id_location),
	CONSTRAINT uq_metrics_Carbon_date
        UNIQUE (id_location, date_houry)
);

CREATE TABLE monitoring_collections (
  collected_at timestamptz PRIMARY KEY,
  catalog jsonb NOT NULL,
  errors jsonb NOT NULL DEFAULT '{}',
  carbon_available boolean NOT NULL
);
CREATE INDEX metrics_collected_at_idx ON metrics(date_houry,id_service);


CREATE UNIQUE INDEX services_external_id_idx ON services(external_id);
