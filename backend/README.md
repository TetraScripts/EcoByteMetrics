# ⚙️ Backend — EcoByteMetrics (GreenER)

O backend do **EcoByteMetrics** é uma API REST desenvolvida em **Node.js com TypeScript**, estruturada modularmente para realizar a descoberta automática de serviços, a coleta periódica de telemetria, o processamento de indicadores ambientais (kWh e CO₂e) e a persistência relacional no PostgreSQL.

---

### 🏗️ Arquitetura e Organização Modular

A aplicação adota uma divisão modular por recursos e domínios de negócio, separando as responsabilidades em **Routes**, **Controller**, **Service** e **Repository**:

```bash
backend/
├── README.md                 # Guia técnico do backend
├── Dockerfile                # Dockerfile para containerização do backend
├── package.json              # Dependências e scripts do projeto Node.js
└── src/
    ├── app.ts                # Configuração do Express e middlewares
    ├── server.ts             # Boot e inicialização do servidor HTTP
    ├── db/
    │   └── connection.ts     # Configuração da conexão com o PostgreSQL via driver nativo 'pg'
    ├── integrations/         # Clientes de consumo das APIs auxiliares
    │   ├── metrics-api.ts    # Cliente do Agregador de Métricas
    │   └── carbon-api.ts     # Cliente do Serviço de Intensidade de Carbono
    └── modules/              # Módulos organizados por recursos REST
        ├── collections/      # Gerenciamento de histórico de coletas e amostragens
        │   ├── collections.routes.ts
        │   ├── collections.controller.ts
        │   ├── collections.service.ts
        │   └── collections.repository.ts
        ├── services/         # Descoberta e monitoramento dinâmico de serviços
        │   ├── services.routes.ts
        │   ├── services.controller.ts
        │   ├── services.service.ts
        │   └── services.repository.ts
        ├── metrics/          # Amostragem de recursos de hardware
        ├── locations/        # Mapeamento geográfico de servidores
        ├── carbon/           # Fatores ambientais de emissão regional
        └── users/            # Autenticação e gestão de acessos com JWT
```

#### Atribuição das Camadas
* **Routes:** Mapeia as URLs baseadas em recursos (`/services`, `/collections`) e associa aos verbos HTTP correspondentes (`GET`, `POST`, `PUT`, `DELETE`).
* **Controllers:** Processa os dados da requisição HTTP (`params`, `query`, `body`), repassa ao serviço correspondente e devolve respostas JSON com códigos de status coerentes (`200`, `201`, `400`, `404`, `500`).
* **Services:** Executa as regras de negócio, os algoritmos de conversão energética e o orquestramento de chamadas.
* **Repositories:** Concentra as consultas DML diretamente no PostgreSQL utilizando SQL nativo e parametrizado (`$1`, `$2`), sem o uso de ORM.

---

### 🔌 Integração com APIs Auxiliares

O backend conecta-se a dois serviços externos para simular o ambiente corporativo e obter os fatores ambientais:

1. **Agregador de Métricas (`metrics-api.ts`):**
   * `GET /services`: Realiza a descoberta dos microsserviços ativos no ambiente.
   * `GET /metrics/{id_servico}`: Coleta amostras de consumo de CPU, memória, disco e rede (`cpu_metric`, `ram_metric`, `hd_metric`, `network_metric`).
2. **Serviço de Intensidade de Carbono (`carbon-api.ts`):**
   * `GET /carbon-intensity/{code}`: Obtém a intensidade de carbono em gCO₂e/kWh e a porcentagem de energia renovável da região.

---

### 🗄️ Conexão e Persistência no PostgreSQL (Sem ORM)

A comunicação com o banco PostgreSQL é mantida pelo driver nativo `pg`. Todas as inserções e seleções utilizam *placeholders* para prevenir vulnerabilidades de *SQL Injection*:

```typescript
// Exemplo em src/modules/metrics/metrics.repository.ts
import { dbClient } from '../../db/connection';

export class MetricsRepository {
  async insertMetric(
    serviceId: number,
    path: string,
    interval: number,
    cpu: number,
    ram: number,
    hd: number,
    network: number
  ): Promise<void> {
    const query = `
      INSERT INTO Metrics (
        id_service, date_houry, path_metric, colletion_interval_metric,
        cpu_metric, ram_metric, hd_metric, network_metric
      )
      VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7);
    `;
    await dbClient.query(query, [serviceId, path, interval, cpu, ram, hd, network]);
  }
}
```

---

### ⚙️ Variáveis de Ambiente (`.env`)

```env
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_USER=greener_user
DB_PASSWORD=greener_pass
DB_NAME=greener_db
METRICS_AGGREGATOR_URL=http://agregador-metricas.local:8080
CARBON_INTENSITY_URL=http://carbon-intensity.local:8081
JWT_SECRET=sua_chave_secreta_jwt
```

O backend consulta `GET {CARBON_INTENSITY_URL}/regions`; a resposta deve conter `regions` com `code` e `carbon_intensity_gco2e_per_kwh`. A ausência de fator mantém consumo e ranking por kWh disponíveis, mas emissões ficam `null`/fora do ranking por CO₂e. O ranking da API mantém amostras em memória por até 7 dias e começa a acumular dados após a inicialização.

Para o agregador de métricas, `METRICS_AGGREGATOR_URL` é o nome documentado; `API_METRIC` permanece aceito por compatibilidade.

---

### 🚀 Instruções de Execução

#### Modo Desenvolvimento Local (npm)
```bash
npm install
npm run dev
```

#### Modo Containerizado (Docker Compose)
```bash
docker compose up backend --build -d
```
