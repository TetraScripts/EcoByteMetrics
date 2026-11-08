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
    │   ├── api.types.ts      # Fica todos os tipos de interface usada no APIs auxiliares
    │   ├── metrics-api.ts    # Cliente do Agregador de Métricas
    │   ├── services-api.ts   # Cliente do Agregador de Services
    │   └── carbon-api.ts     # Cliente do Serviço de Intensidade de Carbono
    └── modules/              # Módulos organizados por recursos REST
        ├── Auth/             # Gerencia login de usuarios
        │   ├── Auth.routes.ts
        │   ├── Auth.controller.ts
        │   ├── Auth.service.ts
        │   ├── Auth.service.ts
        │   └── Auth.middlewere.ts
        │   └── userAccess.middleware.ts
        │
        ├── Services/         # Cadastra, atualiza e visualiza serviços
        │   ├── services.routes.ts
        │   ├── services.controller.ts
        │   ├── services.service.ts
        │   └── services.repository.ts
        ├── Metrics/          # Amostragem de recursos de hardware
        ├── Locations/        # Cadastra, atualiza e visualiza localização
        ├── Statistics/       # calcula o rank de dos serviços que emitiram CO2 e kwl e mostra o total somado de todos os serviços
        ├── Worker/           # Descoberta e monitoramento dinâmico de serviços e metricas
        ├── Carbon/           # Cadastra, atualiza e visualiza fatores ambientais de emissão regional
        └── Users/            # Autenticação e gestão de acessos com JWT
   
```

#### Atribuição das Camadas
* **Routes:** Mapeia as URLs baseadas em recursos (`/services`, `/collections`) e associa aos verbos HTTP correspondentes (`GET`, `POST`, `PUT`, `DELETE`).
* **Controllers:** Processa os dados da requisição HTTP (`params`, `query`, `body`), repassa ao serviço correspondente e devolve respostas JSON com códigos de status coerentes (`200`, `201`, `400`, `404`, `500`,`502`).
* **Services:** Executa as regras de negócio, os algoritmos de conversão energética e o orquestramento de chamadas.
* **Repositories:** Concentra as consultas DML diretamente no PostgreSQL utilizando SQL nativo e parametrizado (`$1`, `$2`), sem o uso de ORM.

---

### 🔌 Integração com APIs Auxiliares

O backend conecta-se a dois serviços externos para simular o ambiente corporativo e obter os fatores ambientais:

1. **Agregador de Métricas (`metrics-api.ts` e `services-api.ts`):**
   * `GET /services`: Realiza a descoberta dos microsserviços ativos no ambiente.
   * `GET /services/{id_servico}`: Realiza a descoberta do microsserviço especifico ativos no ambiente.
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
# Credenciais de conexão do PostgreSQL (não são a conta ADMIN da aplicação)
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=greener_user
POSTGRES_PASSWORD=greener_pass # exemplo local; defina um segredo próprio fora do repositório
POSTGRES_DATABASE=greener_db
POSTGRES_PORT_CONTEINER=5433

#Varieveis de ambiente do backend
PORT=3000
PORT_CONTEINER=3000
API_METRIC="https://metrics.unilaunch.org"
API_CARBON="https://carbon.unilaunch.org"
JWT_SECRET=sua_chave_secreta_jwt
JWT_EXPIRES_IN=1h

#Variaveis do ambiente do frontend
FRONT_PORT=8080
PGPORT=80
```

---

### Cadastro, login e proteção das contas

- `POST /api/users`: recebe `name_user`, `email_user` e `password_user`. Nome e e-mail são aparados; e-mail é convertido para minúsculas. A senha mantém os caracteres originais, deve ter pelo menos 8 caracteres e no máximo 72 bytes e é armazenada como hash bcrypt.
- `POST /auth/login`: recebe `email` e `password`; retorna `token`, `tokenType: "Bearer"` e `expiresIn`. Configure `JWT_SECRET` com um segredo próprio.
- `GET`, `PUT` e `DELETE /api/users/:id_user`: exigem `Authorization: Bearer <token>` e permitem acessar apenas a própria conta. O identificador vem da URL validada; um `id_user` enviado no corpo não muda a conta acessada. `PUT` recebe os mesmos três campos do cadastro.
- As respostas de usuários incluem somente `id_user`, `name_user` e `email_user`. Senhas e hashes não são retornados.
- Dados inválidos retornam `400`, token inválido ou expirado `401`, acesso a outra conta `403`, conta ausente `404` e e-mail duplicado `409`. Falhas inesperadas retornam `500` com mensagem genérica.

`npm run test:auth` verifica essas rotas com respostas SQL controladas, sem acessar PostgreSQL. `npm test` inclui essa suíte e a suíte de serviços, adaptada ao worker atual. O teste de persistência exercita os repositórios usados pelo worker, sem restaurar os hooks do modelo antigo. A gravação e a leitura reais são verificadas separadamente com PostgreSQL.

Com o backend e o PostgreSQL locais em execução, `npm run test:auth:postgres` testa cadastro, hash armazenado, login, e-mail duplicado, alteração de senha e bloqueio de acesso a outra conta usando SQL real. Esse comando cria contas temporárias com e-mails aleatórios e remove somente essas contas ao terminar. O endereço é obtido de `PORT` no `backend/.env`, podendo ser substituído por `AUTH_TEST_BASE_URL` para outro backend local.

O esquema atual de `Users` já comporta os hashes; esta restauração não exige alterar as tabelas de histórico. Contas eventualmente gravadas com senha em texto durante a regressão precisam de redefinição de senha por um processo autorizado; o login não aceita senha armazenada em texto. O JWT inclui o perfil `role_user` (`ADMIN` ou `USER`). Rotas de escrita administrativa exigem autenticação e perfil `ADMIN`; cadastros públicos recebem exclusivamente `USER`. O primeiro administrador deve ser provisionado pelo procedimento seguro descrito em `database/README.md`, sem credenciais fixas no DML.

**Sobre as senhas:** `POSTGRES_PASSWORD` é somente a senha de conexão do banco. Ela não é usada no endpoint de login da aplicação. A senha do primeiro ADMIN é definida pelo operador no provisionamento, armazenada apenas como hash bcrypt e utilizada em `POST /auth/login`. Os testes unitários usam a fixture `Review-fixture-123`; o teste PostgreSQL gera senhas aleatórias a cada execução. Nenhuma dessas senhas de teste é uma senha padrão de ADMIN. Consulte `database/README.md` para o procedimento completo de provisionamento.

No Compose, o backend usa `POSTGRES_HOST=postgres` e a porta interna `5432`. Ao executar o backend fora do Docker com o banco do Compose, use `127.0.0.1` e a porta publicada (`5433` no exemplo).

Para executar fora do Docker, copie `backend/.env.example` para `backend/.env` e configure as credenciais do banco. Rode `npm run dev` dentro de `backend`; o servidor carrega esse `.env` com dotenv. Arquivos `.env` locais são ignorados pelo Git. O frontend deve apontar `BACKEND_PROXY_TARGET` em `frontend/.env.local` para a porta escolhida (por exemplo, `http://127.0.0.1:3001`).

Na configuração local da `Dashboardsp2`, um banco separado foi iniciado com `docker compose -p ecobytemetrics-dashboardsp2 up -d --build postgres`: container `ecobytemetrics-dashboardsp2-postgres`, volume `ecobytemetrics-dashboardsp2_postgres_data` e porta `127.0.0.1:5434`. O banco antigo e seu volume foram preservados. Use o mesmo nome de projeto ao gerenciar esse banco; não remova volumes para corrigir problemas de conexão. O backend local usa a porta `3001` para evitar colisão com containers antigos na `3000`.

O worker de carbono envia datas ISO (`toISOString`) para não depender do formato regional do sistema. Cada par de localização e instante tem uma amostra própria; valores iguais em regiões ou instantes diferentes não são descartados. Repetir a mesma localização e instante atualiza a amostra com `ON CONFLICT`, usando a restrição de unicidade existente.

`npm run test:worker:postgres` exercita os workers e os repositórios com SQL real em um esquema temporário dentro de uma transação. Inicializa o DDL atual nesse esquema, verifica datas sob `DateStyle` MDY e DMY, regiões com fatores iguais, repetição da coleta, coletas posteriores e a associação entre métrica e fator da localização. Um `ROLLBACK` remove todo o esquema de teste sem alterar as tabelas do projeto.

O servidor agora executa uma única coleta a cada 30 segundos, grava a rodada em transação e publica o cache após o commit. O frontend consulta o histórico persistido em `GET /api/monitoring`. Horários usam `TIMESTAMPTZ` e ISO UTC; fator ausente permanece desconhecido. A migração preserva dados legados e não infere fatores de carbono. Consulte o contrato, os limites e os cuidados de migração em [docs/HISTORY.md](docs/HISTORY.md).

---

### 🚀 Instruções de Execução

#### Comfiguração .env
   *Copie o arquivo .env acima e coloque ele na area que esta o arquivo de exemplo do .env.example

#### Modo Containerizado (Docker Compose)
  *No modo de Containerizão o usuario precisa ter instalado na maquina o Dorker.
  Para build de todos do conteiner use o comando abaixo:
  
```bash
docker compose up backend --build -d
```
  *O paramentro -d é para execultar dos conteiners em segundo plano, sendo assim não mostrar os logs dos conteiners no terminal.

  *Para executar somente um conteiner o codigo é este:
```bash
docker compose up -d nome_do_servico
```
  *Caso queira parar e deletar os conteiners user este comando:
```bash
docker compose down 
```
  *O paramentro -v representa o volume do compose, sendo para, deleta, e exclui o volume do conteiner.
```bash
docker compose down -v
```

### Restauração de sessão e configuração de consulta

O login mantém a resposta Bearer e emite cookie `ecobyte_session` HttpOnly, SameSite=Strict, com o mesmo vencimento do JWT. `GET /auth/session` aceita esse cookie somente para restaurar o token após F5, verificando também a conta no banco. Não há renovação automática. `POST /auth/logout` remove o cookie; o JWT já emitido mantém seu prazo original, sem lista de revogação. Em produção, use HTTPS: cookies são Secure quando `NODE_ENV=production`. A configuração de proxy/TLS deve ser definida pelo ambiente.

`GET /api/monitoring-settings` exige Bearer e retorna `{collectionIntervalSeconds, discovery: "automatic", editable: false}`. O intervalo vem da mesma constante usada pelo coletor. Não existe operação de edição integrada. O Nginx do frontend comprime respostas JSON e arquivos estáticos aceitos pelo cliente.
