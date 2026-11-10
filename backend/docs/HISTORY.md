# Coleta e histórico persistido

O servidor executa uma coleta ao iniciar e a cada 30 segundos. Rodadas não se sobrepõem. Cada aplicação é consultada uma vez por rodada, com até seis consultas simultâneas; o catálogo de carbono é consultado uma vez. Métricas, fatores, catálogo e falhas são gravados na mesma transação. O cache dos endpoints antigos só é publicado após o commit.

A interface consulta `GET /api/monitoring`; não consulta mais as APIs externas diretamente nem acumula amostras capturadas pelo navegador. Falha do banco retorna HTTP 503 e preserva a última resposta na interface, sem criar amostras. Recarregar a página consulta o banco novamente. A coleta exige o servidor ativo, mas independe de o navegador estar aberto.

## Consulta pública

`GET /api/monitoring?period=7d&until=2026-10-30T23:00:00Z`

- `view`: `latest` ou `history` (padrão). `latest` evita as consultas de histórico, rodadas e falhas do período; mantém as mesmas últimas leituras e regiões. Retorna `historyIncluded: false`, listas históricas vazias e totais do período nulos. A interface usa esse modo na visão geral e carrega o histórico ao abrir uma área que precisa dele.
- `period`: `24h` ou `7d`; padrão `7d`.
- `until`: opcional, ISO com fuso, usado como limite superior inclusivo. Horários inválidos ou futuros recebem 400.
- `service`: identificador externo opcional, repetível até 100 aplicações. O identificador não é o número interno da tabela.
- A janela começa um período antes do limite superior. O catálogo e os diagnósticos correspondem à última rodada gravada até esse limite.
- Sem corte, a resposta usa o instante da consulta. UTC é usado no transporte e no banco; a interface formata no fuso do dispositivo.

A resposta inclui `source: "database"`, `services`, `regions`, `history`, `observations` (horários de rodadas gravadas), `collectionEvents`, `historyPeriod`, `historyUntil` e `selectedAt`. Cada posição de `observations` traz `collectionCount`, a quantidade real de rodadas que ela representa. A interface soma essa contagem e informa separadamente quantos pontos agrupados há na barra de revisão. As leituras usam uma transação consistente para não misturar duas rodadas.

Cada ponto de histórico contém `serviceId`, localização capturada, `firstCollectedAt`, `collectedAt`, `energyKwh`, `emissionsG`, `intervalSeconds`, `sampleCount`, `emissionCount` e `bucketSeconds`. O agrupamento é de 30 segundos para até uma hora de dados, 5 minutos para até um dia e 1 hora para períodos maiores. Somas, durações e contagens originais são preservadas. Há um limite explícito de 20.000 pontos agrupados por consulta; excedê-lo retorna 413, sem truncar silenciosamente os totais.

## Identidade e dados incompletos

`Services.external_id` mantém a identidade do agregador quando o nome muda. Falha de métricas não remove uma aplicação do catálogo. Ausência em uma descoberta bem-sucedida marca remoção; retorno reativa a aplicação. Falha da descoberta não substitui o catálogo por uma lista vazia.

O coletor preserva o código estruturado de erro da API. `metrics_missing` e `invalid_metrics` geram o estado `no-metrics` e diagnósticos `metrics-missing`; falhas de consulta geram `unavailable` e `service-unavailable`. A última leitura válida é conservada. Registros antigos com motivo genérico continuam genéricos, sem inferir uma causa. Os diagnósticos nunca ultrapassam o corte solicitado e são exibidos também quando outras aplicações continuam coletando.

Cada métrica guarda o fator e a localização recebidos na mesma rodada. Fator ausente é `null`; zero recebido é zero válido. Um catálogo de carbono indisponível não reutiliza silenciosamente um fator antigo para a nova amostra. Agregados parciais informam quantas amostras têm estimativa; gráficos de emissões incompletas não apresentam um total completo inventado.

As fórmulas continuam sendo estimativas: CPU de 120 W a 100%, RAM de 0,375 W/GB, disco de 0,01 W/GB e rede de 0,02 W/GB, multiplicados pela duração da amostra. Emissões são energia × fator em g CO₂e/kWh.

## Migração

`src/db/migrate.ts` executa as migrações `001_persisted_monitoring` e `002_recover_legacy_carbon` nessa ordem antes de abrir o servidor. Cada versão é registrada em `schema_migrations` e protegida por lock transacional. O Docker inclui os arquivos SQL na imagem.

Faça backup antes de migrar ambientes com dados. A migração conserva os registros e converte os antigos `TIMESTAMP` de métricas, carbono e serviços para `TIMESTAMPTZ`, interpretando o relógio legado como UTC, conforme os workers deste projeto. Bancos provenientes de outra origem ou gravados em horário local precisam de revisão dessa premissa antes da migração.

IDs externos legados são recuperados de `/metrics/<id>`. Duplicidades que impeçam o índice único fazem a migração falhar e reverter; não há exclusão automática de dados.

A migração 002 recupera o fator de amostras legadas usando a região cadastrada no serviço e o último fator dessa região já gravado até o instante da métrica. Essa é a associação temporal utilizada pelo modelo legado: ele não registrava mudanças históricas de localização. Se um ambiente legado moveu serviços entre regiões, é necessário conferir essa localização antes da migração. Não são usados fatores futuros, de outras regiões ou obtidos agora da API. Amostras anteriores ao primeiro fator da região permanecem desconhecidas. As falhas de carbono em coletas unificadas não são preenchidas com fatores antigos, e valores já gravados não são sobrescritos.

A lista, a comparação e os gráficos exibem a soma das emissões disponíveis. A soma das barras e o último acumulado correspondem ao total da lista para os mesmos filtros e período. Uma amostra ausente não interrompe os valores seguintes do acumulado; se não houver nenhuma estimativa calculável, o resultado permanece desconhecido. O aviso existente informa a cobertura dos filtros selecionados, e os tooltips explicam intervalos incompletos. Nenhuma amostra desconhecida vira zero; lacunas reais de tempo não são interpoladas. Percentuais de participação e lentes de impacto continuam exigindo cobertura completa.

Os rótulos distinguem última coleta, total no período e total do intervalo do gráfico. Lista, detalhes, evolução e comparação também exibem a primeira e a última amostra efetivamente disponíveis, incluindo `firstCollectedAt` dos agregados: selecionar sete dias não significa ter sete dias completos de registros.

## Verificação

- `npm test`: inclui igualdade entre amostra gravada e publicada, rollback e filtros de consulta.
- `npm run test:history:postgres`: verifica migração, UTC em outro fuso, corte temporal, identidade, remoção/retorno, zero, fator ausente e totais agregados em esquemas isolados de um PostgreSQL local.
- `npm run test:worker:postgres`: cobre compatibilidade dos workers anteriores e datas ISO.
- `npm run test:auth:postgres`: verifica cadastro e login com o banco real.

Os testes criam e removem somente seus próprios esquemas ou contas temporários. Não reinicializam o banco do projeto nem removem volumes.

## Recursos técnicos no histórico

Cada ponto pode incluir `resources: {cpuPercent, memoryGb, diskGb, networkGb, durationSeconds}`. Os quatro recursos são médias ponderadas pela duração das leituras do agrupamento; `durationSeconds` informa a soma dos pesos utilizados. A comparação combina os grupos usando esses pesos, preservando o resultado ao alternar o tamanho dos agrupamentos. Zero é válido; sem recursos completos, `resources` é `null`. Respostas anteriores sem esse campo continuam aceitas pelo frontend como recursos desconhecidos, sem aproveitar a última leitura atual.

Os recursos usam exatamente os mesmos filtros de serviço, período, horário e localização dos indicadores ambientais. Falta de fator de carbono não remove recursos técnicos válidos. A duração somada pode conter intervalos sobrepostos e não deve ser interpretada como tempo cronológico coberto. A consulta `view=latest` continua sem carregar esses agrupamentos. Não foi necessária migração: os recursos já estão gravados nas métricas.
