# Especificação da API REST — EcoByteMetrics (GreenER)

Esta documentação especifica os contratos técnicos de todas as rotas HTTP expostas pelo backend Node.js com TypeScript `( RP02 )`, incluindo URLs, métodos HTTP, parâmetros de requisição, headers de autenticação JWT `( RP06 )`, códigos de retorno HTTP e estruturas completas de payloads JSON `( RNF05 )`.

---

## 📌 Informações Gerais
* **URL Base da API:** `http://localhost:3000/api`
* **Formato do Payload:** `application/json`
* **Autenticação:** Bearer Token JWT para rotas administrativas/configuração `( RP06 )`.

---

## 🔑 1. Autenticação & Acesso `( RP06 )`

### `POST /auth/login`
Autentica o usuário administrativo no backend e gera o Token JWT para acesso a recursos protegidos `( RP06 )`.

* **Método:** `POST`
* **URL:** `/api/auth/login`
* **Headers:**
  ```http
  Content-Type: application/json
  ```
* **Corpo da Requisição (Body):**
  ```json
  {
    "email": "admin@greener.com",
    "senha": "senhaSegura123"
  }
  ```
* **Códigos de Resposta:**
  * **`200 OK` — Autenticação realizada com sucesso:**
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBncmVlbmVyLmNvbSIsImlhdCI6MTY3MjUxODQwMCwiZXhwIjoxNjcyNjA0ODAwfQ...",
      "usuario": {
        "id": 1,
        "nome": "Administrador GreenER",
        "email": "admin@greener.com"
      }
    }
    ```
  * **`400 Bad Request` — Campos obrigatórios ausentes:**
    ```json
    {
      "error": "Os campos e-mail e senha são obrigatórios."
    }
    ```
  * **`401 Unauthorized` — Credenciais incorretas:**
    ```json
    {
      "error": "E-mail ou senha inválidos."
    }
    ```

---

## 🔍 2. Descoberta & Serviços `( RF01, RF02, RF05, RF06, RF12, RF13 )`

### `GET /services`
Retorna a lista de todos os microsserviços descobertos via integração com o Agregador de Métricas, indicando status atual, localização geográfica e atualização dinâmicas `( RF01, RF02, RF05, RF06, RF12, RF13 )`.

* **Método:** `GET`
* **URL:** `/api/services`
* **Parâmetros de Query (Opcionais):**
  * `status` (string): Filtra por estado do serviço (`ACTIVE`, `UNAVAILABLE`, `NO_METRICS`).
* **Códigos de Resposta:**
  * **`200 OK` — Requisição bem-sucedida:**
    ```json
    {
      "total": 3,
      "servicos": [
        {
          "id": "payment-service",
          "nome": "Serviço de Pagamentos",
          "status": "ACTIVE",
          "localizacao": {
            "pais": "Brasil",
            "regiao": "sp-saopaulo",
            "cidade": "São Paulo",
            "latitude": -23.550520,
            "longitude": -46.633308
          },
          "ultimaAtualizacao": "2026-10-13T11:00:00Z"
        },
        {
          "id": "auth-service",
          "nome": "Serviço de Autenticação",
          "status": "NO_METRICS",
          "localizacao": {
            "pais": "Estados Unidos",
            "regiao": "us-east-1",
            "cidade": "N. Virginia",
            "latitude": 38.0339,
            "longitude": -78.5079
          },
          "ultimaAtualizacao": "2026-10-13T10:58:00Z"
        },
        {
          "id": "shipping-service",
          "nome": "Serviço de Logística",
          "status": "UNAVAILABLE",
          "localizacao": {
            "pais": "Alemanha",
            "regiao": "eu-central-1",
            "cidade": "Frankfurt",
            "latitude": 50.1109,
            "longitude": 8.6821
          },
          "ultimaAtualizacao": "2026-10-13T10:50:00Z"
        }
      ]
    }
    ```
  * **`500 Internal Server Error` — Falha interna ao listar serviços:**
    ```json
    {
      "error": "Erro ao recuperar a lista de serviços do banco de dados."
    }
    ```

---

### `GET /services/:id`
Obtém o detalhamento de um serviço específico, incluindo seus dados geográficos e leitura mais recente de métricas e indicadores ambientais `( RF07, RF12 )`.

* **Método:** `GET`
* **URL:** `/api/services/:id`
* **Parâmetros de Path:**
  * `id` (string): Identificador único do serviço (ex: `payment-service`).
* **Códigos de Resposta:**
  * **`200 OK` — Serviço localizado:**
    ```json
    {
      "id": "payment-service",
      "nome": "Serviço de Pagamentos",
      "status": "ACTIVE",
      "localizacao": {
        "pais": "Brasil",
        "regiao": "sp-saopaulo",
        "cidade": "São Paulo",
        "latitude": -23.550520,
        "longitude": -46.633308
      },
      "metricasAtuais": {
        "cpuUsage": 45.2,
        "memoryUsage": 512.0,
        "consumoKwh": 0.1240,
        "emissaoCo2e": 12.8500
      },
      "ultimaLeitura": "2026-10-13T11:00:00Z"
    }
    ```
  * **`404 Not Found` — Serviço não cadastrado ou não encontrado:**
    ```json
    {
      "error": "O serviço informado não foi localizado."
    }
    ```

---

## 📊 3. Métricas, Histórico & Indicadores `( RF03, RF07, RF08, RF09, RF10 )`

### `GET /services/:id/metrics`
Consulta a série temporal histórica das coletas de hardware e cálculos de consumo energético (kWh) e carbono (CO₂e) de um determinado serviço `( RF03, RF07, RF10 )`.

* **Método:** `GET`
* **URL:** `/api/services/:id/metrics`
* **Parâmetros de Path:**
  * `id` (string): Identificador do serviço.
* **Parâmetros de Query (Opcionais):**
  * `inicio` (string ISO): Data/hora de início do filtro (ex: `2026-10-13T00:00:00Z`).
  * `fim` (string ISO): Data/hora de fim do filtro.
* **Códigos de Resposta:**
  * **`200 OK` — Histórico recuperado com sucesso:**
    ```json
    {
      "id_servico": "payment-service",
      "totalRegistros": 2,
      "historico": [
        {
          "dataHoraColeta": "2026-10-13T10:30:00Z",
          "cpuUsage": 40.0,
          "memoryUsage": 500.0,
          "consumoKwh": 0.1100,
          "emissaoCo2e": 11.4000
        },
        {
          "dataHoraColeta": "2026-10-13T11:00:00Z",
          "cpuUsage": 45.2,
          "memoryUsage": 512.0,
          "consumoKwh": 0.1240,
          "emissaoCo2e": 12.8500
        }
      ]
    }
    ```

---

### `GET /dashboard/summary`
Retorna a consolidação agregada dos indicadores operacionais e ambientais do ambiente monitorado `( RF08, RF09 )`.

> **Validação do dashboard (Issue #101):** o frontend consome `GET /services` e `GET /metrics/:serviceId`, ambos sem o prefixo `/api`, para o mapa, estados e histórico da sessão. O resumo global e o ranking por período são consultados em `/api/dashboard/summary` e `/api/dashboard/ranking`; os contratos têm testes em `backend/tests/dashboard.contract.test.ts` e `backend/tests/dashboard.routes.test.ts`.
> O ranking da API mantém até 7 dias de amostras coletadas desde a inicialização do processo. Serviços são considerados ativos quando possuem métrica válida coletada nos últimos 90 segundos; resultados sem atualização recente são indisponíveis. O resumo é global e não varia com os filtros regionais/de data do dashboard.
>
> **Evidências:** `cd backend && npm test` verifica payloads e timestamps das rotas consumidas pelo frontend, os cálculos de resumo com serviços ativos/indisponíveis/sem métricas, ordenação por kWh e CO₂e, períodos, valores padrão, parâmetros inválidos (400), ausência de fatores regionais e ranking vazio (200). Todos os 14 testes passaram no ambiente de desenvolvimento; frontend validado com `npm run typecheck`, `npm run lint` e `npm run build`.

* **Método:** `GET`
* **URL:** `/api/dashboard/summary`
* **Códigos de Resposta:**
  * **`200 OK` — Indicadores calculados com sucesso:**
    ```json
    {
      "totalServicos": 12,
      "servicosAtivos": 10,
      "servicosIndisponiveis": 1,
      "servicosSemMetricas": 1,
      "consumoTotalKwh": 145.2800,
      "emissaoTotalCo2e": 1420.5000,
      "dataHoraUltimaAtualizacao": "2026-10-13T11:00:00Z"
    }
    ```
  * `emissaoTotalCo2e` é `null` quando não há fator regional para todos os serviços ativos; o backend não estima emissões com fator ausente. `consumoTotalKwh` soma as amostras válidas dos serviços ativos. `dataHoraUltimaAtualizacao` pode ser `null` antes da primeira coleta.

---

## 🏆 4. Ranking & Comparador `( RF14, RF15 )`

### `GET /dashboard/ranking`
Obtém a lista ordenada de serviços por maior consumo energético ou emissão de CO₂e no período especificado `( RF14 )`.

* **Método:** `GET`
* **URL:** `/api/dashboard/ranking`
* **Parâmetros de Query:**
  * `ordenarPor` (string): Atributo de ordenação (`kwh` ou `co2e`, padrão: `co2e`).
  * `periodo` (string): Intervalo considerado (`1h`, `24h`, `7d`, padrão: `24h`).
* **Códigos de Resposta:**
  * **`200 OK` — Ranking gerado com sucesso:**
    ```json
    {
      "periodo": "24h",
      "ordenadoPor": "co2e",
      "ranking": [
        {
          "posicao": 1,
          "id_servico": "data-processing-service",
          "nome": "Serviço de Processamento de Dados",
          "consumoKwh": 45.1200,
          "emissaoCo2e": 480.2000
        },
        {
          "posicao": 2,
          "id_servico": "payment-service",
          "nome": "Serviço de Pagamentos",
          "consumoKwh": 12.8000,
          "emissaoCo2e": 132.5000
        }
      ]
    }
    ```
    Uma lista sem amostras válidas para o período ou critério é retornada como `"ranking": []`.
    No ranking por kWh, `emissaoCo2e` pode ser `null` se faltar fator regional; no ranking por CO₂e, serviços sem emissão completa são omitidos.
  * **`400 Bad Request` — Parâmetro `ordenarPor` ou `periodo` inválido:**
    ```json
    {
      "error": "O parâmetro periodo deve ser '1h', '24h' ou '7d'."
    }
    ```

---

### `GET /dashboard/compare`
Permite a comparação direta de métricas de uso e indicadores ambientais entre dois ou mais serviços no mesmo intervalo temporal `( RF15 )`.

* **Método:** `GET`
* **URL:** `/api/dashboard/compare`
* **Parâmetros de Query (Obrigatórios):**
  * `ids` (string): IDs dos serviços separados por vírgula (ex: `payment-service,auth-service`).
  * `periodo` (string): Intervalo de comparação (`1h`, `24h`, `7d`).
* **Códigos de Resposta:**
  * **`200 OK` — Dados comparativos consolidados:**
    ```json
    {
      "periodo": "24h",
      "comparacao": [
        {
          "id_servico": "payment-service",
          "consumoKwh": 12.8000,
          "emissaoCo2e": 132.5000,
          "mediaCpu": 48.5,
          "status": "ACTIVE"
        },
        {
          "id_servico": "auth-service",
          "consumoKwh": 2.1000,
          "emissaoCo2e": 21.8000,
          "mediaCpu": 12.2,
          "status": "NO_METRICS"
        }
      ]
    }
    ```
  * **`400 Bad Request` — Parâmetro `ids` ausente ou inválido:**
    ```json
    {
      "error": "É necessário informar ao menos dois IDs de serviços válidos para comparação."
    }
    ```

---

## ⚙️ 5. Configuração Administrativa `( RP02, RP06 )`

### `POST /admin/config/polling`
Atualiza a frequência e os parâmetros do serviço background de polling de métricas `( RP02, RP06 )`.

* **Método:** `POST`
* **URL:** `/api/admin/config/polling`
* **Headers:**
  ```http
  Authorization: Bearer <TOKEN_JWT>
  Content-Type: application/json
  ```
* **Corpo da Requisição (Body):**
  ```json
  {
    "intervaloSegundos": 30
  }
  ```
* **Códigos de Resposta:**
  * **`200 OK` — Configuração alterada:**
    ```json
    {
      "message": "Intervalo de amostragem atualizado para 30 segundos.",
      "novoIntervalo": 30
    }
    ```
  * **`401 Unauthorized` — Token ausente, expirado ou inválido:**
    ```json
    {
      "error": "Acesso não autorizado. Token JWT ausente ou expirado."
    }
    ```
```
