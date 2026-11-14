# Runbook de Troubleshooting — EcoByteMetrics

## 1. Objetivo

Este documento reúne os procedimentos de diagnóstico e recuperação do EcoByteMetrics quando ocorrem:

- indisponibilidade de contêineres;
- falhas nas APIs externas;
- problemas de conexão ou persistência no PostgreSQL;
- falhas de inicialização, migração ou coleta de dados.

A ideia é orientar a equipe a identificar a causa raiz do problema, aplicar a ação mais segura e verificar a recuperação do sistema sem perder dados persistidos.

Os passos devem ser executados a partir da raiz do projeto, onde está localizado o arquivo `compose.yaml`.

## 2. Checklist rápido de triagem

Antes de qualquer correção, siga esta ordem:

1. Verifique o estado dos contêineres.
2. Leia os logs do serviço afetado.
3. Confirme se o backend responde em `/health`.
4. Valide a conectividade com PostgreSQL.
5. Verifique a disponibilidade das APIs externas.
6. Só então reinicie ou reconstrua serviços.

> Regra prática: não reinicie tudo primeiro. Em geral, o problema está isolado em um componente.

## 3. Arquitetura e dependências

O projeto usa três serviços principais com Docker Compose:

| Serviço | Responsabilidade | Porta externa | Porta interna |
| --- | --- | ---: | ---: |
| Frontend | Interface web em React + Nginx | 8080 | 80 |
| Backend | API REST em Node.js + Express | 3000 | 3000 |
| PostgreSQL | Persistência dos dados | 5433 | 5432 |

As portas mostradas correspondem aos valores esperados do arquivo `.env.example`. Se o projeto estiver usando outro `.env`, considere os valores locais do ambiente.

### 3.1. Dependências externas

O backend depende de duas integrações externas:

- `API_METRIC`: descoberta de serviços e coleta de métricas de CPU, memória, disco e rede.
- `API_CARBON`: consulta de fatores regionais de intensidade de carbono.

Essas URLs são configuradas em `.env` pelas variáveis `API_METRIC` e `API_CARBON`.

### 3.2. Dependências entre os contêineres

- O PostgreSQL usa healthcheck com `pg_isready`.
- O backend depende do PostgreSQL saudável para iniciar.
- O frontend depende do backend saudável.
- O healthcheck do backend faz uma requisição HTTP para `/health`, então ele valida apenas disponibilidade do processo HTTP, não a saúde do banco ou das APIs externas.
- O banco usa o volume persistente `postgres_data` para preservar dados entre reinicializações normais.

## 4. Diagnóstico inicial dos contêineres

### 4.1. Verificar o estado dos contêineres

```powershell
docker compose ps -a
```

Interpretação dos estados:

| Estado | Significado |
| --- | --- |
| Up | Contêiner em execução. |
| Up (healthy) | Contêiner em execução e healthcheck aprovado. |
| Unhealthy | Healthcheck falhou. |
| Exited | Contêiner encerrou a execução. |
| Restarting | Docker está reiniciando o contêiner. |
| Created | Contêiner criado, mas ainda não iniciou. |

O frontend não tem healthcheck próprio em `compose.yaml`; a melhor validação é abrir a interface no navegador e verificar se o dashboard carrega.

### 4.2. Consultar logs

```powershell
docker compose logs --tail 100 postgres
docker compose logs --tail 100 backend
docker compose logs --tail 100 frontend
```

Para acompanhar logs em tempo real:

```powershell
docker compose logs -f backend
```

Use `Ctrl + C` para sair da visualização contínua.

### 4.3. Validar a configuração do Docker Compose

Antes de partir para recuperação agressiva, confirme que a configuração do Compose está válida:

```powershell
docker compose config -q
```

Se houver erro, revise o `.env`, os nomes das variáveis e o arquivo `compose.yaml`.

Para subir ou reconstruir os serviços:

```powershell
docker compose up -d --build
```

## 5. Contingência das APIs Externas

Falhas nas integrações externas podem impedir a atualização das métricas e dos fatores de emissão de carbono. O coletor trata essas falhas de forma isolada para preservar dados já persistidos.

### 5.1. API de Métricas

A integração utiliza a variável `API_METRIC` e consulta os seguintes recursos:

- `GET /services`: descobre os serviços disponíveis.
- `GET /metrics/{id_servico}`: obtém as métricas individuais de cada serviço.

As requisições possuem timeout de 10 segundos.

A resposta de descoberta deve conter uma lista válida de serviços com identificadores, nomes, localização e caminho das métricas.

As respostas individuais devem conter o intervalo da coleta e os valores de CPU, memória, disco e rede.

#### Possíveis problemas

| Problema                       | Comportamento                                          |
| ------------------------------ | ------------------------------------------------------ |
| Timeout                        | A requisição é interrompida após o limite configurado. |
| HTTP 404 nas métricas          | Serviço identificado, mas sem métricas disponíveis.    |
| HTTP 5xx                       | Serviço externo apresentou falha.                      |
| JSON inválido                  | Resposta não corresponde ao formato esperado.          |
| Métricas ausentes ou inválidas | Coleta individual sinalizada como inválida.            |
| Falha em `/services`           | Catálogo conhecido é preservado, quando disponível.    |

#### Procedimento de recuperação

1. Verifique se a variável `API_METRIC` está correta no `.env`.
2. Confirme se a URL externa está acessível.
3. Consulte os logs do backend:

```powershell
docker compose logs --tail 100 backend
```

4. Teste a descoberta dos serviços:

```powershell
curl.exe -i https://metrics.unilaunch.org/services
```

Se o projeto usa outra URL, substitua pelo valor configurado.

5. Confira se a resposta HTTP foi bem-sucedida e se o conteúdo está no formato esperado.
6. Verifique novamente as métricas individuais dos serviços afetados.

Quando a descoberta falha, o coletor mantém o catálogo conhecido e marca os serviços como indisponíveis naquela rodada, sem novas consultas individuais. Se apenas uma coleta individual falha, o restante continua sendo processado. Após a recuperação da API, uma nova tentativa será feita no próximo ciclo do backend.

### 5.2. API de Carbono

A integração utiliza a variável `API_CARBON`.

O coletor principal consulta:

- `GET /regions`: obtém os fatores regionais de intensidade de carbono.

A requisição possui timeout de 5 segundos.

Existe também o endpoint `/health` na API externa, que pode ser utilizado durante o diagnóstico manual.

#### Possíveis problemas

| Problema           | Comportamento                                      |
| ------------------ | -------------------------------------------------- |
| Timeout            | A requisição é interrompida após 5 segundos.       |
| Erro de conexão    | A API externa não pode ser alcançada.              |
| HTTP 4xx ou 5xx    | A API retorna uma resposta de erro.                |
| JSON inválido      | A resposta não pode ser interpretada corretamente. |
| Estrutura inválida | Os dados não correspondem ao contrato esperado.    |

#### Procedimento de recuperação

1. Confira se `API_CARBON` está configurada no `.env`.
2. Verifique a disponibilidade da API:

```powershell
curl.exe -i https://carbon.unilaunch.org/health
```

3. Teste a consulta das regiões:

```powershell
curl.exe -i https://carbon.unilaunch.org/regions
```

4. Consulte os logs do backend:

```powershell
docker compose logs --tail 100 backend
```

5. Verifique se a API voltou a fornecer uma lista válida de regiões, com fatores de intensidade de carbono e percentuais de energia renovável.

Quando a API de carbono falha, o coletor registra o problema e continua o processamento das métricas, mas as amostras daquela rodada não recebem fator de carbono. Nesse caso, o cálculo de emissões de CO₂e fica indisponível para essas amostras. Não invente valores.

## 6. Contingência do PostgreSQL

O PostgreSQL é responsável pela persistência dos serviços, localizações, métricas, fatores de carbono e histórico das coletas.

A recuperação deve priorizar a preservação dos dados existentes.

### 6.1. Diagnóstico do banco de dados

Verifique o estado do contêiner:

```powershell
docker compose ps -a postgres
```

Consulte os logs:

```powershell
docker compose logs --tail 100 postgres
```

Verifique se o banco está aceitando conexões:

```powershell
docker compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

A mensagem esperada é semelhante a:

```text
/var/run/postgresql:5432 - accepting connections
```

Se o contêiner estiver parado, use os logs para identificar a causa antes de tentar reiniciar o serviço.

### 6.2. PostgreSQL parado

Se o contêiner estiver encerrado, verifique os logs e tente iniciar apenas o serviço do banco:

```powershell
docker compose up -d postgres
```

Acompanhe a inicialização:

```powershell
docker compose logs -f postgres
```

Após a inicialização, confirme novamente:

```powershell
docker compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Se o serviço continuar indisponível, investigue problemas de configuração, permissões, armazenamento ou inicialização antes de repetir a operação.

### 6.3. Reinicialização do PostgreSQL

Quando o diagnóstico indicar que uma reinicialização é necessária, execute:

```powershell
docker compose restart postgres
```

Esse procedimento reinicia o contêiner sem remover o volume persistente.

Depois, confirme a disponibilidade:

```powershell
docker compose ps postgres
```

```powershell
docker compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

A reinicialização não resolve disco cheio, credenciais incorretas, falhas de configuração ou corrupção dos dados. Se o problema persistir, consulte os logs e encaminhe a investigação ao responsável pelo banco.

### 6.4. Falha de conexão entre backend e PostgreSQL

Se o banco estiver saudável, mas o backend não conseguir acessar os dados, confira as variáveis de conexão:

| Variável            | Valor padrão          |
| ------------------- | --------------------- |
| `POSTGRES_HOST`     | `postgres`            |
| `POSTGRES_PORT`     | `5432`                |
| `POSTGRES_DATABASE` | `greener_db`          |
| `POSTGRES_USER`     | `greener_user`        |
| `POSTGRES_PASSWORD` | Configurada no `.env` |

Dentro da rede Docker, o backend utiliza o nome do serviço `postgres` e a porta interna `5432`.

A porta externa `5433` é destinada ao acesso ao banco a partir do computador host.

Consulte os logs do backend:

```powershell
docker compose logs --tail 100 backend
```

Se o banco estiver saudável e as configurações estiverem corretas, mas o backend continuar com erros de conexão, reinicie o backend:

```powershell
docker compose restart backend
```

O backend executa migrações durante a inicialização.

### 6.5. Falhas durante as migrações

O arquivo `backend/src/server.ts` executa `migrateMonitoring()` antes de iniciar o servidor HTTP.

As migrações existentes são:

- `001_persisted_monitoring`
- `002_recover_legacy_carbon`
- `003_user_roles`

A execução utiliza transações SQL, com `COMMIT` em caso de sucesso e `ROLLBACK` quando ocorre uma falha.

Se o backend não iniciar devido a uma migração:

1. Consulte os logs do backend.
2. Verifique a disponibilidade do PostgreSQL.
3. Confira as permissões e configurações de conexão.
4. Identifique qual migração apresentou erro.
5. Não remova tabelas ou registros para tentar corrigir o problema.
6. Após corrigir a causa, reinicie o backend e confira novamente os logs.

As migrações são verificadas e aplicadas durante a inicialização da aplicação.

### 6.6. Backup e preservação dos dados

Antes de qualquer intervenção que possa afetar os dados, recomenda-se realizar um backup.

No PowerShell, na raiz do projeto:

```powershell
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > .\ecobytemetrics-backup.sql
```

Verifique se o arquivo foi criado:

```powershell
Get-Item .\ecobytemetrics-backup.sql
```

O backup deve ser armazenado em local seguro, fora do versionamento do projeto.

A restauração deve ser realizada somente após verificar a integridade do arquivo, testar o procedimento em ambiente isolado e obter autorização do responsável pela base de dados.

**Atenção:** não utilize o comando abaixo como procedimento comum de recuperação:

```powershell
docker compose down -v
```

A opção `-v` remove os volumes associados ao projeto, podendo apagar os dados persistidos do PostgreSQL.

O volume `postgres_data` deve ser preservado durante reinicializações e operações normais de manutenção.

## 7. Verificação Após a Recuperação

Após qualquer procedimento de contingência, verifique se os componentes voltaram a funcionar corretamente.

### 7.1. Verificar os contêineres

```powershell
docker compose ps
```

O PostgreSQL e o backend devem apresentar estado saudável. O frontend deve estar em execução.

### 7.2. Verificar o PostgreSQL

```powershell
docker compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

O banco deve informar que está aceitando conexões.

### 7.3. Verificar o backend

```powershell
curl.exe -i http://localhost:3000/health
```

A resposta esperada é HTTP 200:

```json
{
  "status": "ok"
}
```

Essa verificação confirma apenas a disponibilidade HTTP do backend.

Para verificar também a consulta ao banco, execute:

```powershell
curl.exe -i "http://localhost:3000/api/monitoring?period=24h&view=latest"
```

A resposta esperada é HTTP 200, com os dados da última coleta persistida.

### 7.4. Verificar o frontend

Acesse:

```text
http://localhost:8080
```

Verifique se o dashboard está acessível, se os dados são apresentados e se não existem avisos persistentes de falha na atualização.

### 7.5. Verificar a retomada das coletas

O coletor executa uma primeira coleta durante a inicialização do backend e agenda novas execuções a cada 30 segundos.

Após a recuperação das integrações externas, verifique se:

- Os serviços voltaram a receber métricas.
- Os estados de indisponibilidade foram atualizados.
- Os fatores de carbono voltaram a ser obtidos.
- As novas coletas foram persistidas.
- O dashboard apresenta dados atualizados.

A ausência de dados novos deve ser investigada nos logs, mesmo quando os contêineres estão saudáveis.

## 8. Orientações de Segurança e Prevenção

- Não compartilhar o arquivo `.env`, credenciais, tokens ou backups.
- Não remover o volume `postgres_data` como tentativa de recuperação.
- Não apagar tabelas ou registros para corrigir falhas de conexão.
- Consultar os logs antes de reiniciar serviços.
- Preservar os últimos dados válidos durante falhas nas integrações.
- Evitar reinicializar todos os contêineres quando o problema estiver isolado em um único serviço.
- Realizar backups antes de intervenções que possam afetar a persistência.
- Não restaurar backups sobre a base original sem autorização.
- Registrar os procedimentos executados e os resultados obtidos.

## 9. Registro de Incidentes

Quando um problema não puder ser resolvido pelos procedimentos deste manual, registre as seguintes informações para facilitar a investigação:

| Informação               | Descrição                                     |
| ------------------------ | --------------------------------------------- |
| Data e horário           | Momento em que a falha foi identificada.      |
| Serviço afetado          | PostgreSQL, backend, frontend ou API externa. |
| Sintoma                  | Comportamento observado.                      |
| Mensagem de erro         | Erros relevantes encontrados nos logs.        |
| Procedimentos realizados | Comandos e tentativas de recuperação.         |
| Resultado                | Se o serviço voltou a funcionar.              |
| Responsável              | Pessoa que realizou o diagnóstico.            |

As evidências devem ser registradas sem expor credenciais, tokens ou informações sensíveis.

---

**Referências técnicas do projeto:**

- `compose.yaml`
- `.env.example`
- `backend/src/server.ts`
- `backend/src/app.ts`
- `backend/src/db/connection.ts`
- `backend/src/db/migrate.ts`
- `backend/src/integrations/metrics-api.ts`
- `backend/src/integrations/carbon-api.ts`
- `backend/src/modules/Monitoring/collector.ts`
- `backend/src/modules/Monitoring/collection.repository.ts`
- `backend/src/modules/Worker/worker.job.ts`
- `backend/src/modules/Monitoring/monitoring.router.ts`
- `frontend/nginx.conf`
- `frontend/src/features/monitoring/pages/DashboardPage.tsx`
