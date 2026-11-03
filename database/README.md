> **Modelo atual de histórico:** o servidor executa `migrations/001_persisted_monitoring.sql` antes de iniciar. Serviços usam identificador externo; métricas guardam fator e localização da rodada; datas são `TIMESTAMPTZ`. O histórico é consultado em `/api/monitoring`. O DDL autoritativo está em [DDL.sql](DDL.sql), e a migração, a premissa UTC para dados legados e o contrato estão em [backend/docs/HISTORY.md](../backend/docs/HISTORY.md). Faça backup antes de migrar dados de outro ambiente.

# 🗄️ Camada de Persistência — PostgreSQL Nativo

Este repositório contém a modelagem de dados relacional, os scripts DDL de criação de tabelas e as orientações de gerenciamento do banco PostgreSQL da plataforma **EcoByteMetrics**.

---

### 📌 Diretrizes Técnicas e de Engenharia (RP03)
* **SQL Nativo Explícito:** A estrutura e as manipulações de dados são executadas estritamente por instruções SQL puras em DDL e DML.
* **Proibição de ORMs:** Veto total ao uso de frameworks como Prisma, TypeORM ou Sequelize.
* **Consultas Parametrizadas:** Toda comunicação dinâmica utiliza *placeholders* (`$1`, `$2`) para impedir vulnerabilidades de *SQL Injection*.

---

### 📂 Estrutura da Pasta

```bash
database/
├── README.md       # Orientações para restauração, DML e volume Docker        
└── DDL.sql         # Estrutura principal do banco
```


### 🛠️ Restaurando o Banco de Dados em um Ambiente Limpo

Para aplicar a estrutura oficial em um container PostgreSQL vazio, execute o comando abaixo no terminal:

```bash
docker exec -i greener_postgres psql -U greener_user -d greener_db < database/DDL.sql
```

---

### 🗃️ Modelo DDL Oficial (`database/schema.sql`)

O script `database/DDL.sql` define a estrutura física relacional do sistema:

```sql
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

```

---

### 🔍 Localização das Consultas DML na Aplicação

As operações DML de manipulação de dados ficam isoladas nos repositórios do backend (`backend/src/modules/`):

#### 1. Inserção na Tabela `Metrics` (`metrics.repository.ts`)
```sql
INSERT INTO Metrics (
  id_service, date_houry, path_metric, colletion_interval_metric,
  cpu_metric, ram_metric, hd_metric, network_metric
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
```

#### 2. Consulta de Histórico Temporal de Amostragens (`collections.repository.ts`)
```sql
SELECT id_metric, id_service, date_houry, cpu_metric, ram_metric, hd_metric, network_metric
FROM Metrics
WHERE id_service = $1
ORDER BY date_houry DESC
LIMIT $2;
```

---

### 📊 Consulta para Análise e Agregação de Resultados

Query SQL utilizada pelo backend para consolidar os rankings de consumo e emissão por período:

```sql
const sortColumn =
    orderBy === "kwh"
    ? '"consumoKwh"'
    : '"emissaoCo2e"';

	WITH sample_energy AS (
            SELECT
                m.id_service AS service_id,
                m.date_houry AS collected_at,
                m.colletion_interval_metric AS collection_interval_seconds,

                COALESCE(
                    c.intesity_co2e_kwh_carbon,
                    0
                ) AS carbon_intensity_gco2e_per_kwh,

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

            LEFT JOIN LATERAL (
                SELECT
                    cb.intesity_co2e_kwh_carbon
                FROM Carbons AS cb
                WHERE cb.id_location = s.id_location
                  AND cb.date_houry <= m.date_houry
                ORDER BY cb.date_houry DESC
                LIMIT 1
            ) AS c ON TRUE

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
        ),
		SELECT
            s.id_service AS id,
            s.name_service AS nome,

            COALESCE(
                SUM(i.consumption_kwh), 0
            )::float8 AS "consumoKwh",
            COALESCE(
                SUM(i.emissions_co2e), 0
            )::float8 AS "emissaoCo2e"

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
```

---

### 💾 Persistência de Dados em Container Docker

A preservação dos registros após a reinicialização dos containers é garantida pelo volume nomeado `pgdata` configurado no arquivo `compose.yaml`:

```yaml
postgres:
    build: ./database
    
    container_name: database_EcoByteMetrics
    restart: unless-stopped

    environment:
      POSTGRES_DB: ${POSTGRES_DATABASE}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

    ports:
      - "${POSTGRES_PORT_CONTEINER}:${POSTGRES_PORT}"

    volumes:
      - postgres_data:/var/lib/postgresql
      - ./database:/docker-entrypoint-initdb.d

    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$$POSTGRES_USER\" -d \"$$POSTGRES_DATABASE\""]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s
volumes:
  postgres_data:
```
