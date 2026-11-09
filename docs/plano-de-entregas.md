# 📅 Plano de Entregas e Matriz de Rastreabilidade

**Projeto:** EcoByteMetrics (GreenER)  
**Organização:** Pentascripts  
**Repositório Oficial:** [https://github.com/pentascripts-organization/EcoByteMetrics](https://github.com/pentascripts-organization/EcoByteMetrics)  

---

## 🎯 1. Escopo Geral do Projeto & Objetivos por Sprint

### 💡 Objetivo Geral do Produto
Desenvolver a plataforma web containerizada **GreenER** para monitoramento contínuo de microsserviços, estimativa de consumo energético em quilowatt-hora (kWh) e cálculo aproximado da pegada de carbono em dióxido de carbono equivalente (gCO₂e), utilizando PostgreSQL nativo sem ORM e orquestração Docker.

### 🗓️ Objetivos Específicos das Sprints
* **Sprint 1 (Fundação, Polling e Interface Base):** Estabelecer a infraestrutura containerizada via Docker Compose, criar o esquema nativo em SQL (`DDL.sql`), estruturar a interface responsiva em React + TS com suporte à localização e desenvolver o backend em Node.js + TS com o serviço de polling para descoberta (`/services`) e coleta de métricas (`/metrics`).
* **Sprint 2 (Motor Ambiental, Dashboard e Segurança):** Implementar o motor de cálculo ambiental (kWh e gCO₂e), persistência temporal em DML, Dashboard operacional com ordenação por ranking de impacto, tratamento de resiliência a falhas e autenticação JWT.
* **Sprint 3 (Geolocalização em Mapa, Comparador e MVP Final):** Desenvolver a visualização geográfica dos microsserviços em mapa interativo, o módulo comparador de eficiência ambiental entre aplicações e a consolidação do MVP containerizado final.

---

### 👥 2. Matriz de Participação e Contribuição Individual (Sprint 2)

A tabela a seguir apresenta a matriz atualizada contendo **todas as tarefas da Sprint 2** por seus respectivos responsáveis:

| Integrante | Papel Scrum / Frente | Tarefas Concluídas na Sprint 2 |
| :--- | :--- | :--- |
| **Alef** | Dev Team (Frontend / State) | • **#26** Painel Operacional em React com Métrica e Estado<br>• **#99** Validação do dashboard e do ranking<br>• **#100** Validação da atualização e dos estados da tela |
| **Cauã** | Product Owner / Dev Backend | • **#38** Rota de Login e Emissão de Token JWT<br>• **#39** Middleware de Proteção JWT no Backend<br>• **#40** Tratamento de Segurança e Criptografia de Credenciais<br>• **#80** Módulo de Autenticação e Geração de Token JWT no Backend |
| **Enzo** | Dev Team (Frontend) | • **#27** API de Indicadores Consolidados e Ranking<br>• **#28** Ordenação e Ranking de Serviços por Maior Impacto<br>• **#101** Validação do contrato das rotas do dashboard<br>• **#102** Validação de falhas e recuperação das APIs auxiliares |
| **Thiago** | Dev Team (Backend / DB) | • **#29** Integração com o Serviço de Intensidade de Carbono<br>• **#30** Lógica de Cálculo de Consumo Energético e (CO_2e)<br>• **#31** Consolidação de Indicadores Agregados<br>• **#32** Persistência do Histórico de Coletas (DML PostgreSQL)<br>• **#37** Modelagem e Tabela de Usuários no PostgreSQL (DDL/DML) |
| **Vinicius** | Scrum Master / Dev Infra | • **Doc** Documentação reformulação após sprint-1<br>• **#33** Tratamento da Variação de Métricas a Cada Requisição<br>• **#34** Detecção de Indisponibilidade de Serviços<br>• **#35** Detecção de Ausência de Métricas em Serviços Ativos<br>• **#36** Middleware e Resiliência contra Quedas de APIs Auxiliares |

---

### 📊 3. Matriz de Rastreabilidade e Avaliação dos Critérios da Rubrica

Tabela oficial de acompanhamento de todos os critérios da **Rubrica de Avaliação das Sprints**:

| Código | Requisito Relacionado | Entrega Concreta | Como Verificar | Responsáveis | Evidência no GitHub | Situação (Sprint 2) |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **ES01** | Escopo GreenER | Product Backlog priorizado e organizado em User Stories e sub-issues | Consultar a aba de Issues e o quadro de projetos do GitHub | Equipe | [Issues develop](https://github.com/pentascripts-organization/EcoByteMetrics/issues) | **Concluído (Sprint 1 e 2)** |
| **ES02** | Planejamento | Sprint Backlog registrado com metas, pontos e tarefas das Sprints 1 e 2 | Consultar os relatórios oficiais de Sprint Review | Equipe | [docs/sprints/](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/docs/sprints) | **Concluído (Sprint 1 e 2)** |
| **ES03** | Critérios de Aceite | Definição explícita de DoR e DoD em cada sub-issue catalogada | Acessar o detalhamento das sub-issues na aba de Issues | Equipe | [Issues develop](https://github.com/pentascripts-organization/EcoByteMetrics/issues) | **Concluído (Sprint 1 e 2)** |
| **ES04** | Rastreabilidade | Vinculação entre requisitos `(RF/RNF/RP)`, commits e Pull Requests | Verificar os IDs das sub-issues nas mensagens de commit | Equipe | [Histórico de Commits](https://github.com/pentascripts-organization/EcoByteMetrics/commits/develop) | **Concluído (Sprint 1 e 2)** |
| **ES05** | Evolução Incremental | Histórico contínuo e bem distribuído de commits ao longo da Sprint 2 | Consultar o histórico de contribuições da branch develop | Equipe | [Histórico de Commits](https://github.com/pentascripts-organization/EcoByteMetrics/commits/develop) | **Concluído (Sprint 1 e 2)** |
| **ES06** | Sprint Review | Registro das entregas, pendências, autoavaliação e decisões da Review 2 | Ler os relatórios em `docs/sprints/` | Equipe | [Sprint Review 2](https://github.com/pentascripts-organization/EcoByteMetrics/blob/develop/docs/sprints/sprint-2/sprint-2.md) | **Concluído (Sprint 1 e 2)** |
| **ES07** | Definition of Done | Definição objetiva de DoD e validação dos artefatos entregues | Conferir as validações no relatório da Sprint Review 2 | Equipe | [Sprint Review 2](https://github.com/pentascripts-organization/EcoByteMetrics/blob/develop/docs/sprints/sprint-2/sprint-2.md) | **Concluído (Sprint 1 e 2)** |
| **ES08** | Documentação | Manual principal `README.md` com guia Docker, ER, arquitetura e Dailies | Consultar o `README.md` na raiz do repositório | Equipe | [README.md](https://github.com/pentascripts-organization/EcoByteMetrics/blob/develop/README.md) | **Concluído (Sprint 1 e 2)** |
| **ES09** | Participação | Contribuição individual verificável de todos os membros nas Sprints | Consultar a Matriz de Participação e os gráficos no GitHub | Todos | [Painel de Contribuidores](https://github.com/pentascripts-organization/EcoByteMetrics/graphs/contributors) | **Concluído (Sprint 1 e 2)** |
| **DW01** | Tecnologias | React + TS no Frontend; Node.js + TS no Backend; arquitetura modular | Conferir a separação das pastas `frontend/` e `backend/` | Equipe | [Frontend](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/frontend) \| [Backend](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/backend) | **Concluído (Sprint 1)** |
| **DW02** | RF01, RF03 | Polling integrado com Agregador de Métricas e Serviço de Carbono | Verificar as chamadas Axios na camada de integrações | Dev Backend | [backend/src/integrations/](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/backend/src/integrations) | **Concluído (Sprint 1 e 2)** |
| **DW03** | RNF05, RP02 | API REST modular em Node.js (Routes, Controllers, Services, Repositories) | Consultar a especificação técnica dos endpoints | Dev Backend | [docs/api.md](https://github.com/pentascripts-organization/EcoByteMetrics/blob/develop/docs/api.md) | **Concluído (Sprint 1 e 2)** |
| **DW04** | RF11, RNF01 | Interface React organizada em componentes, páginas, hooks e serviços | Verificar a estrutura de código-fonte no frontend | Dev Frontend | [frontend/src/](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/frontend/src) | **Concluído (Sprint 1 e 2)** |
| **DW05** | RF09, RF14 | Dashboard Operacional, Ranking de Impacto e Polling sem reload | Testar o painel visual com ordenação por kWh e gCO₂e | Dev Frontend | [frontend/src/pages/](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/frontend/src/pages) | **Concluído (Sprint 2)** |
| **DW06** | RP06 | Autenticação JWT e proteção de rotas restritas no backend | Testar a emissão de tokens e o middleware de autenticação | Dev Backend | [backend/src/modules/users/](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/backend/src/modules/users) | **Concluído (Sprint 2)** |
| **DW07** | RP04 | Execução 100% containerizada da aplicação via Docker Compose | Executar `docker compose up` e validar a sobriedade | Dev Infra | [compose.yaml](https://github.com/pentascripts-organization/EcoByteMetrics/blob/develop/compose.yaml) | **Concluído (Sprint 1)** |
| **BD01** | RP03 | Tabelas em SQL explícito sem ORM no arquivo `database/DDL.sql` | Consultar o script DDL com as definições e constraints | Dev Database | [database/DDL.sql](https://github.com/pentascripts-organization/EcoByteMetrics/blob/develop/database/DDL.sql) | **Concluído (Sprint 1)** |
| **BD02** | RP03, RF10 | Operações DML com SQL parametrizado (`$1`, `$2`) nos Repositories | Verificar as instruções de INSERT e SELECT parametrizadas | Dev Database | [backend/src/modules/](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/backend/src/modules) | **Concluído (Sprint 1 e 2)** |
| **BD03** | RP03, RP04 | Conexão backend-banco e volume de dados persistente (`pgdata`) | Testar a preservação do histórico ao reiniciar containers | Dev Infra / DB | [compose.yaml](https://github.com/pentascripts-organization/EcoByteMetrics/blob/develop/compose.yaml) | **Concluído (Sprint 1)** |
| **BD04** | RF14, RF15 | Consultas SQL de análise com agregação, JOIN, ordenação e histórico | Verificar as queries de ranking e consolidação no repositório | Dev Database | [backend/src/modules/metrics/](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/backend/src/modules/metrics) | **Concluído (Sprint 2)** |
| **TP01** | RP02 | Modelagem orientada a objetos com encapsulamento no backend | Verificar as classes dos Services e Repositories | Dev Backend | [backend/src/](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/backend/src) | **Concluído (Sprint 1 e 2)** |
| **TP02** | RP01, RP02 | Tipagem forte em TypeScript com interfaces/tipos sem uso de `any` | Conferir os arquivos `*.types.ts` e contratos no projeto | Equipe | [backend/src/](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/backend/src) | **Concluído (Sprint 1 e 2)** |
| **TP03** | RNF04 | Tratamento de exceções via `try/catch` e Middleware global (#36) | Testar o comportamento da API diante da queda de integrações | Dev Backend | [backend/src/middlewares/](https://github.com/pentascripts-organization/EcoByteMetrics/tree/develop/backend/src/middlewares) | **Concluído (Sprint 2)** |
