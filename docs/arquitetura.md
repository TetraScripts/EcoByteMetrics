# Arquitetura, diagramas C4 e fluxos de dados — EcoByteMetrics

> **Objetivo:** documentar a arquitetura proposta do EcoByteMetrics com diagramas Mermaid, incluindo contexto C4, containers C4, arquitetura lógica e fluxo de dados.
>
> **Importante — estado da implementação:** os diagramas descrevem a arquitetura pretendida a partir da proposta do projeto, da estrutura dos repositórios e das configurações fornecidas. Eles **não afirmam que todas as integrações já funcionam**. O frontend informa que ainda não está conectado ao backend; os arquivos de integração das APIs e o módulo `coletas` estão vazios no snapshot analisado. Por isso, os fluxos de coleta e cálculo aparecem como fluxo-alvo/planejado.

## 1. Visão geral da arquitetura

O EcoByteMetrics é uma aplicação web para monitorar serviços, consultar métricas, estimar consumo energético e emissões de CO₂e e apresentar indicadores em um dashboard.

As principais partes são:

- **Frontend:** React + TypeScript; apresenta dashboard, serviços, energia, emissões e comparação. A camada `frontend/src/services/monitoring.ts` atualmente retorna uma estrutura vazia e indica que a chamada HTTP ainda será implementada.
- **Backend:** Node.js + TypeScript + Express; deve expor endpoints HTTP, coordenar as coletas, consultar APIs auxiliares, aplicar regras de cálculo e acessar o PostgreSQL. No código analisado, há rotas básicas de saúde e teste, mas o fluxo de coleta ainda não está implementado.
- **Banco de dados:** PostgreSQL; persiste serviços, localizações, métricas e informações de intensidade de carbono conforme o SQL fornecido. O nome do script SQL varia entre os ZIPs recebidos (`database/DDL.sql` e `database/schema.sql`); confirmem qual versão será mantida no repositório principal.
- **API auxiliar de métricas:** `https://metrics.unilaunch.org`; a proposta do projeto prevê descobrir serviços e consultar métricas, incluindo os caminhos conceituais `/services` e `/metrics/{id_servico}`. Confirmar o contrato exato na documentação da API antes de implementar.
- **API auxiliar de intensidade de carbono:** `https://carbon.unilaunch.org`; deve fornecer o fator de intensidade de carbono usado na estimativa de CO₂e. O endpoint, parâmetros e formato exatos da resposta devem ser conferidos na documentação da API.

## 2. Diagrama C4 — Contexto do sistema

Este diagrama mostra o EcoByteMetrics e as pessoas/sistemas externos com os quais se relaciona.

```mermaid
flowchart LR
    U(["Usuário<br/>Consulta o dashboard"])
    E["<b>EcoByteMetrics</b><br/>Sistema web para monitorar serviços,<br/>estimar energia e emissões de CO₂e"]
    M["API de Métricas<br/>Lista serviços e fornece métricas técnicas"]
    C["API de Intensidade de Carbono<br/>Fornece fatores de emissão por região"]

    U -->|Acessa pelo navegador| E
    E -->|Consulta serviços e métricas<br/>fluxo planejado| M
    E -->|Consulta fatores de carbono<br/>fluxo planejado| C

    classDef person fill:#dbeafe,stroke:#2563eb,color:#172554,stroke-width:1.5px;
    classDef system fill:#bfdbfe,stroke:#1d4ed8,color:#172554,stroke-width:2px;
    classDef external fill:#f3f4f6,stroke:#6b7280,color:#111827,stroke-width:1.5px;
    class U person;
    class E system;
    class M,C external;
```

## 3. Diagrama C4 — Containers

O diagrama detalha os principais containers previstos no `compose.yaml` e os sistemas externos. A disposição foi organizada para separar a comunicação do usuário, a comunicação entre frontend e backend, o acesso ao banco e as integrações externas. As integrações marcadas como pendentes ainda precisam ser implementadas e testadas.

```mermaid
flowchart TB
    U(["Usuário\nPessoa que acessa pelo navegador"])

    subgraph SYSTEM["EcoByteMetrics — Docker Compose"]
        direction TB
        FE["Frontend Web\nReact + TypeScript + Vite/Nginx\nInterface e dashboard"]
        BE["Backend API\nNode.js + TypeScript + Express\nEndpoints HTTP e regras de negócio"]
        DB[("Banco de dados\nPostgreSQL\nServiços, localizações, métricas e histórico")]
        FE -->|"Solicita dados do dashboard · HTTP/JSON · pendente"| BE
        BE -->|"Consulta e grava dados · SQL parametrizado previsto"| DB
    end

    M["API de Métricas\nDescoberta de serviços e métricas técnicas"]
    C["API de Intensidade de Carbono\nFatores de intensidade de carbono"]

    U -->|"Acessa pelo navegador · HTTP/HTTPS"| FE
    BE -->|"Consulta serviços e métricas · integração pendente"| M
    BE -->|"Consulta fator de carbono · integração pendente"| C

    classDef person fill:#dbeafe,stroke:#2563eb,color:#172554,stroke-width:1.5px;
    classDef app fill:#bfdbfe,stroke:#1d4ed8,color:#172554,stroke-width:1.5px;
    classDef database fill:#dbeafe,stroke:#2563eb,color:#172554,stroke-width:1.5px;
    classDef external fill:#f3f4f6,stroke:#6b7280,color:#111827,stroke-width:1.5px;
    class U person;
    class FE,BE app;
    class DB database;
    class M,C external;
    style SYSTEM fill:#ffffff,stroke:#6b7280,stroke-width:1.5px,stroke-dasharray: 5 5,color:#111827;
```

## 4. Arquitetura lógica do backend

O backend está organizado com pontos de entrada, integração com banco, integrações externas e módulo de coletas. As responsabilidades abaixo representam o papel esperado desses componentes; arquivos vazios ou incompletos não devem ser considerados funcionalidades prontas.

```mermaid
flowchart TB
    FE["Frontend React<br/>+ TypeScript"]

    subgraph BE["Backend — Node.js + TypeScript + Express"]
        direction TB
        APP["app.ts<br/>Configuração do Express, CORS e JSON"]
        ROUTES["index.ts<br/>Rotas HTTP"]
        CTRL["coletas.controller.ts<br/>Recebe requisições e responde"]
        SERVICE["coletas.service.ts<br/>Coordena coletas e regras de negócio"]
        subgraph INTEGRATIONS["Integrações externas"]
            direction TB
            METRICS["metrics-api.ts<br/>Cliente da API de métricas"]
            CARBON["carbon-api.ts<br/>Cliente da API de carbono"]
        end
        subgraph PERSISTENCE["Persistência"]
            direction TB
            REPO["coletas.repository.ts<br/>Consultas SQL parametrizadas"]
            DB["db/connection.ts<br/>Pool do PostgreSQL"]
        end
        APP --> ROUTES --> CTRL --> SERVICE
        SERVICE --> METRICS
        SERVICE --> CARBON
        SERVICE --> REPO --> DB
    end

    PG[("PostgreSQL")]
    MAPI["API de Métricas"]
    CAPI["API de Intensidade de Carbono"]

    FE -->|"HTTP/JSON — integração pendente"| APP
    DB --> PG
    METRICS -->|"HTTPS/JSON"| MAPI
    CARBON -->|"HTTPS/JSON"| CAPI

    classDef frontend fill:#dbeafe,stroke:#2563eb,color:#111827
    classDef backend fill:#e0f2fe,stroke:#0284c7,color:#111827
    classDef external fill:#f3f4f6,stroke:#6b7280,color:#111827
    class FE frontend
    class APP,ROUTES,CTRL,SERVICE,METRICS,CARBON,REPO,DB backend
    class PG,MAPI,CAPI external
```

## 5. Fluxo de dados — coleta e persistência (fluxo-alvo)

Este é o fluxo previsto para a coleta periódica. A proposta exige descoberta de serviços, tratamento de indisponibilidade e ausência de métricas, cálculo por serviço e histórico de coletas. A implementação deve confirmar o intervalo de coleta e o tratamento de falhas.

```mermaid
flowchart TB
    START(["Início da coleta agendada"]) --> DISCOVER["Backend solicita a lista de serviços"]
    DISCOVER --> SERVICES["API de Métricas<br/>Lista de serviços — contrato a validar"]
    SERVICES --> ANY{"Há serviços disponíveis?"}
    ANY -- "Não" --> END(["Coleta finalizada"])
    ANY -- "Sim" --> METRIC["Consultar métricas do serviço<br/>/metrics/{id_servico}"]
    METRIC --> VALID{"Resposta contém métricas válidas?"}

    VALID -- "Não respondeu" --> DOWN["Registrar serviço indisponível"]
    VALID -- "Sem métricas" --> EMPTY["Registrar ausência de métricas"]
    VALID -- "Sim" --> CARBON["Consultar API de intensidade de carbono"]
    CARBON --> CALC["Calcular energia estimada e CO₂e<br/>conforme docs/calculos.md"]
    CALC --> SAVE["Salvar serviço, horário, métricas<br/>e resultados no PostgreSQL"]

    DOWN --> NEXT{"Há outro serviço para processar?"}
    EMPTY --> NEXT
    SAVE --> NEXT
    NEXT -- "Sim" --> METRIC
    NEXT -- "Não" --> END

    classDef startEnd fill:#123c5a,stroke:#3aa6d6,color:#ffffff,stroke-width:2px
    classDef process fill:#102536,stroke:#3aa6d6,color:#ffffff,stroke-width:1.5px
    classDef decision fill:#1c2e40,stroke:#3aa6d6,color:#ffffff,stroke-width:1.5px
    class START,END startEnd
    class DISCOVER,SERVICES,METRIC,DOWN,EMPTY,CARBON,CALC,SAVE process
    class ANY,VALID,NEXT decision
```

## 6. Fluxo de dados — consulta do dashboard

O frontend deve pedir ao backend os dados para o período selecionado. O backend deve combinar dados persistidos e indicadores calculados e devolver uma resposta JSON. **No snapshot analisado, esse contrato HTTP ainda não está conectado ao frontend**: `frontend/src/services/monitoring.ts` retorna listas vazias e valores nulos.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário
    participant FE as Frontend React
    participant BE as Backend Express
    participant DB as PostgreSQL

    U->>FE: Abre o dashboard e seleciona um período
    FE->>BE: Solicita snapshot do monitoramento (HTTP/JSON — a implementar)
    BE->>DB: Consulta serviços, métricas e histórico
    DB-->>BE: Retorna registros persistidos
    BE->>BE: Consolida indicadores do período
    BE-->>FE: Retorna dados do dashboard em JSON (contrato a definir)
    FE-->>U: Exibe serviços, energia, CO₂e e histórico
```

## 7. Mapeamento entre componentes e dados

| Componente | Responsabilidade prevista | Dados que entram/saem |
|---|---|---|
| Frontend React | Filtros, páginas e apresentação dos indicadores | Recebe JSON do backend; não deve consultar diretamente o PostgreSQL |
| Backend Express | API HTTP, coordenação das consultas e regras de negócio | Recebe requisições do frontend; consulta APIs auxiliares e banco |
| API de Métricas | Descoberta de serviços e entrega de métricas técnicas | Lista de serviços e dados de métricas; contrato exato a validar |
| API de Intensidade de Carbono | Fornecer o fator de carbono aplicável | Fator de intensidade e demais campos definidos pela documentação externa |
| PostgreSQL | Armazenar histórico e dados usados nas análises | Serviços, localizações, métricas e registros relacionados a carbono |
| Módulo `coletas` | Coordenar coletas e persistência | Deve conectar controller, service, integrações e repository; implementação incompleta no ZIP analisado |

## 8. Situação verificada no código enviado

| Item | Situação observada |
|---|---|
| Frontend React + TypeScript | Existe e contém páginas para dashboard, serviços, energia, emissões e comparação |
| Adaptador do frontend para monitoramento | Ainda retorna arrays vazios e valores `null`; a chamada HTTP está pendente |
| Backend Express | Existe; inclui CORS, JSON, rota `/health` e rotas básicas |
| Endpoint do backend para dashboard/coletas | Não foi identificado como implementado no snapshot analisado |
| Integração com API de métricas | Arquivo `backend/src/integrations/metrics-api.ts` está vazio |
| Integração com API de carbono | Arquivo `backend/src/integrations/carbon-api.ts` está vazio |
| Módulo `coletas` | Arquivos de rota/controller/service/repository estão vazios no ZIP `develop` analisado |
| PostgreSQL e Docker Compose | Configurados no `compose.yaml` |
| SQL do banco | Há diferenças entre os ZIPs enviados; conferir o script que será a fonte oficial |
| Autenticação JWT | Citada nas diretrizes do projeto, mas não comprovada como implementada no código analisado |

## 9. Documentação de referência

- [README principal](../README.md)
- [Documentação da API de métricas](https://metrics.unilaunch.org/docs)
- [Documentação da API de intensidade de carbono](https://carbon.unilaunch.org/docs#/Operacao/getCarbonIntensityHealth)

### Pendências para validar com a equipe

1. Confirmar qual ZIP/branch representa a versão oficial a ser entregue.
2. Validar os endpoints, parâmetros e formatos reais das duas APIs auxiliares.
3. Definir o contrato dos endpoints do backend consumidos pelo frontend.
4. Implementar a coleta, persistência, tratamento de falhas e cálculos antes de marcar os fluxos planejados como concluídos.
5. Conferir o nome e o conteúdo oficial do script SQL do banco.
