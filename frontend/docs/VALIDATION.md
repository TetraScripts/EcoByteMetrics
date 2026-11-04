# Verificação do frontend

## Verificações automatizadas locais

Execute na pasta `frontend/`:

```powershell
npm test
npm run lint
npm run build
docker compose -f compose.yaml config --quiet
node --experimental-strip-types scripts/benchmark-globe.mjs
node --experimental-strip-types scripts/benchmark-monitoring.mjs
```

Os testes HTTP não acessam as APIs reais. Usam respostas controladas para conferir descoberta inicial, dados inválidos, catálogo indisponível, ausência de coordenadas, serviço incorreto, 404, intervalo inválido, limites de concorrência e cancelamento. Os testes de renderização verificam abas, posições relativas do conteúdo, avisos, filtros, cobertura e links. Eles não provam a aparência no navegador.

Resultado local desta revisão: **118 testes passaram**, sem falhas. Lint, build de produção (incluindo TypeScript), verificação de espaços do diff e configuração do Compose passaram. O build continua informando o tamanho elevado do chunk do globo, carregado separadamente; a biblioteca 3D ainda exige conferência em hardware real.

Os testes da evolução também cobrem variações de horário perto da virada de 30 segundos, lacunas reais, estimativas ausentes, pausas da interface, respostas repetidas e diagnósticos limitados à aplicação e ao instante selecionados. A renderização verifica a seção Lacunas com um trecho por página e tooltips que preservam valores zero. A API atual não permite reconstruir causas históricas que a interface não registrou.

### Integração com a develop — 24/10/2026

A branch `integration/frontend-develop-20261024` combina a `develop` em `6f212ad` com a `Dashboardsp2` em `7959c54`. O conflito em `DashboardPage.tsx` foi resolvido preservando o novo dashboard, que já apresenta o período selecionado no ranking e nas aplicações. O componente antigo de ranking recebeu automaticamente a atualização da develop; o backend e o banco permaneceram iguais aos da develop corrigida.

Na cópia isolada, a instalação limpa do frontend (`npm ci`) passou. Os 118 testes do frontend, o lint, os builds do frontend e do backend e os 7 testes do backend passaram. A checagem de contrato usou a aplicação compilada do backend, consultou as APIs públicas de métricas e carbono e executou o `getMonitoringSnapshot` real do frontend contra essa aplicação: 8 serviços, 8 amostras e 8 estimativas de emissões, todos disponíveis naquele instante.

Nessa checagem, a persistência foi substituída por funções sem gravação usando o ponto de teste existente no backend. Nenhuma escrita no banco foi executada. Isso verifica a comunicação e a interpretação das respostas; persistência real, autenticação completa, interface no navegador e desempenho gráfico continuam pendentes de validação. Esta branch de integração não publica o frontend na develop.

### Validação de banco e autenticação — 24/10/2026

Após iniciar o Docker Desktop, foi criado um PostgreSQL 18 isolado e descartável, inicializado com `database/DDL.sql` e `database/statistics.sql`. A aplicação compilada do backend foi exercitada contra esse banco, com credenciais e usuários exclusivos do teste. Foram aprovados cadastro com senha armazenada como hash, login válido, rejeição de credenciais incorretas e campos ausentes, leitura do próprio perfil, bloqueio de acesso a outro usuário, ausência de token, token inválido e token expirado.

A persistência real dos serviços e das métricas também foi aprovada: 8 serviços e 8 amostras recebidos das APIs públicas foram gravados no banco. As rotas de estatísticas e ranking responderam a partir desses registros; as ordenações por energia e emissões foram verificadas. Os dados e credenciais do ambiente do time não foram utilizados.

Esses resultados validam a API de autenticação. A tela de login do frontend continua explicitamente desativada; integrar sessão, expiração e saída permanece uma etapa do plano do frontend. Como a ferramenta retornou inventário vazio e não disponibilizou o navegador interno, a versão integrada foi disponibilizada localmente em `http://localhost:5174`, com backend de teste e banco isolado. Em 24/10/2026, o usuário confirmou a revisão manual da página inicial, do dashboard, dos filtros e da evolução com o resultado: “Conferi e está correto”.

### Servidores locais e cache de desenvolvimento

Na conferência em execução, o frontend em `localhost:5173`, o backend em `127.0.0.1:3000`, `/health`, a descoberta pelo proxy e as métricas das oito aplicações responderam com HTTP 200. Isso verifica disponibilidade e comunicação; não comprova banco, autenticação ou histórico persistido da `develop`.

Uma execução inicial do teste de integração havia compartilhado o cache padrão do Vite com o servidor ativo. Bibliotecas passaram a responder com HTTP 504, levando à tela de erro da interface. O teste agora usa `node_modules/.vite-tests`, com descoberta de dependências desativada. O frontend foi reiniciado com `npm run dev -- --force`; as bibliotecas voltaram a responder com HTTP 200. Uma aba que já entrou na tela de erro precisa ser recarregada.

## Desempenho: medição de 23/10/2026

O script de monitoramento gera 201.600 amostras, equivalentes a dez aplicações, sete dias e intervalo de 30 s. Na primeira execução local, a construção da série levou aproximadamente 1.045 ms. Após evitar a conversão de datas a cada comparação da ordenação, levou aproximadamente 410 ms. O ranking levou aproximadamente 322 ms e a simplificação do desenho cerca de 4 ms. Os 20.160 pontos do acumulado foram reduzidos a 180 elementos desenhados, mantendo o valor final.

São medições isoladas de CPU com dados sintéticos. Tempos e memória variam entre execuções e computadores; não equivalem a FPS ou a uma comparação controlada entre dispositivos. O volume pode bloquear a interface em máquinas mais lentas; a integração com histórico paginado/agregado deverá ser reavaliada na etapa 3.

O script geométrico confirmou duas partes de desenho para países e contornos, contra 576 no modelo anterior, mantendo 10.342 triângulos. A construção local levou cerca de 247 ms; atualizar as cores, cerca de 0,28 ms. Isso conta apenas os objetos dos países; a cena completa inclui outros elementos e seus próprios custos.

O globo já limita a resolução ao orçamento de pixels e reduz a resolução durante a interação. Vídeos inativos usam `preload="none"`; o vídeo ativo pausa fora da seção ou com a aba oculta. O globo pausa com a aba oculta e com seu espaço oculto. As preferências de movimento reduzido continuam respeitadas.

## Conferência visual e testes em dispositivos

O usuário aprovou a revisão visual geral da versão integrada em 24/10/2026. Nenhum navegador estava conectado às ferramentas, portanto não foram automatizadas capturas nem interações. A matriz específica de tamanhos, zoom, teclado, movimento reduzido e FPS abaixo continua como verificação complementar em `npm run dev` ou `npm run preview`:

1. Desktop em 1920×1080, 1366×768 e janela baixa: lista alcançável por rolagem, filtros abertos sem cortar o conteúdo, globo ancorado à esquerda.
2. Celular em 320, 390 e 680 px: cabeçalho e campos sem rolagem horizontal da página, alternância Serviços/Mapa e detalhes legíveis.
3. Zoom do navegador a 200%: controles e texto acessíveis, sem impedir o acesso às linhas finais.
4. Teclado: navegação principal, busca, filtros, abas por setas/Home/End, aplicações, retorno do foco à linha, comparação e regiões roláveis.
5. Preferência de movimento reduzido: sem animações de entrada, rotação automática ou vídeos em reprodução.
6. FPS: registrar 15 s parado e 15 s arrastando/zoom em pelo menos uma máquina com GPU integrada e um celular, usando o mesmo build e viewport. Conferir tarefas longas, memória e recuperação de contexto WebGL.
7. Rede lenta e falhas: preservar dados válidos, aviso visível, retomada automática e nenhuma falsa emissão zero.
8. Home, 404 e navegação de ida/volta: título atualizado, links corretos e transição sem bloquear o acesso.

Não é possível garantir uma taxa de FPS para todos os computadores apenas com os testes de código.

## Enquadramento do mapa mobile — 29/10/2026

Após feedback visual sobre globo pequeno e cantos retangulares no zoom, a área inicial do mapa ficou quadrada em até 680 px e a escala foi ampliada. O canvas ocupa novamente a janela, com projeção centrada no mapa e sem recorte retangular; o zoom pode ultrapassar o espaço inicial. Pointerdown e wheel fora da área do mapa não iniciam interação com o globo. A projeção acompanha a rolagem e mudar entre desktop e mobile aplica novamente o enquadramento geral. O enquadramento de desktop permanece igual.

Os testes com a câmera PerspectiveCamera verificam centro, ocupação inicial de mais de 90% da menor dimensão, zoom ultrapassando a área inicial e limites de início de interação em viewports de 320, 390, 680 e 844 px, incluindo paisagem. Os testes de projeção e zoom desktop também passam. A ferramenta retornou inventário sem navegadores conectados; aparência, toque e WebGL no aparelho do usuário continuam por conferir.

Após esse ajuste, a suíte completa passou com **137 testes**, e lint e build de produção foram aprovados.

## Docker

O Docker Desktop foi iniciado na validação de 24/10/2026. A imagem foi construída a partir de `frontend/Dockerfile`, com instalação limpa e build de produção, e executada com Nginx em uma rede Docker isolada. Foram aprovados HTTP 200 para a página inicial, dashboard, comparador, login, fallback de rota e proxy `/backend/health` e `/backend/services`; revalidação do HTML com `Cache-Control: no-cache`; cache público dos assets; e HTTP 404 para `/assets/inexistente.js`. Isso valida o frontend em container com o backend compilado no host; a execução completa do Compose do time ainda precisa ser conferida no ambiente de destino.

Com o ambiente do time devidamente configurado, a execução completa pode ser conferida com:

```powershell
docker compose -f compose.yaml up --build -d
curl.exe -I http://localhost:5173/dashboard
curl.exe -I http://localhost:5173/comparar
curl.exe -I http://localhost:5173/index.html
curl.exe -I http://localhost:5173/assets/inexistente.js
```

Os dois primeiros acessos devem entregar a SPA, o HTML deve exigir revalidação, e o asset inexistente deve retornar 404. Conferir também `/backend/services` com o backend real iniciado.

## Login preparado sem banco — 29/10/2026

O formulário de login foi conectado a `POST /backend/auth/login`, com validação da resposta, sessão em memória, expiração, saída, cancelamento e retorno ao dashboard. Administração exige sessão tanto em desenvolvimento quanto em produção, sem uma seção separada de Acesso. Cadastro, alteração de intervalo e salvamento de configurações continuam desativados.

Nesta revisão, **135 testes passaram**, com lint e build de produção aprovados. Os testes novos usam respostas controladas para validar POST e preservação da senha, normalização do e-mail, dados de sessão inválidos/expirados, indisponibilidade, envio duplicado, cancelamento, expiração automática, retomada após suspensão, saída, Bearer, HTTP 401/403, resposta de sessão anterior e rejeição de destinos externos. Os testes de renderização verificam formulário habilitado, cadastro desativado, mensagens acessíveis, ausência de senha/detalhes internos, bloqueio da administração sem sessão e painel de conta/saída sem a seção Acesso, inclusive com URL antiga.

Esses resultados não comprovam credenciais reais nem persistência. A sessão em memória é intencional: recarregar a página exige entrar novamente. O payload do JWT orienta prazo e identificação na interface, sem substituir verificação da assinatura e autorização no backend. Não foram criados usuários, banco, credenciais de demonstração ou novas dependências.

Também foi feita uma tentativa com credenciais fictícias pelo proxy do Vite ativo (`/backend/auth/login`) contra o backend local. Sem banco disponível, a interface apresentou a mensagem de serviço indisponível, sem criar sessão nem indicar que os campos eram inválidos. Essa consulta não criou usuário nem gravou dados.

Para a validação com banco, iniciar PostgreSQL com o esquema e ambiente corretos da versão escolhida do backend, disponibilizar uma conta de teste com senha armazenada como hash e conferir no navegador: entrada válida/incorreta, retorno à administração, expiração, Sair, acesso sem token e falha/recuperação da conexão. A branch de persistência revisada em 28/10 ainda precisa preservar a proteção das rotas e o hash de senha existentes na develop antes de ser usada nessa integração.

## Cadastro conectado ao PostgreSQL — 30/10/2026

O formulário de cadastro foi habilitado e conectado a `POST /backend/api/users`. O estado compartilhado bloqueia envios duplicados, valida os campos, cancela requisições ao sair e ignora respostas tardias. Cadastro confirmado volta ao login com e-mail preenchido e mensagem de sucesso, mantendo o destino seguro e sem iniciar sessão automaticamente. Senha não é armazenada no estado compartilhado nem persistida no navegador.

Uma verificação com o código real de autenticação do frontend utilizou o proxy do Vite, o backend local na porta 3001 e PostgreSQL 18. Foram aprovados criação de conta, hash armazenado, e-mail duplicado, senha incorreta, login, perfil próprio e saída. A renderização do login confirmou mensagem, e-mail preenchido, senha ausente e filtros preservados. A conta temporária foi removida ao terminar. Isso valida o transporte, o estado e a renderização; não substitui a revisão visual e de interação no navegador, indisponível nesta sessão.

## Histórico persistido — 30/10/2026

A fonte do monitoramento passou a ser `GET /backend/api/monitoring`, com período e corte temporal. A API lê PostgreSQL; a interface substitui a resposta anterior, sem acumular amostras observadas no navegador. A linha do tempo usa rodadas gravadas, e pausas do navegador não são apresentadas como causas de lacunas no coletor.

O servidor coleta e grava numa única rodada de 30 segundos, publicando o cache após commit. Os testes verificam preservação de UTC na migração, corte temporal, identificação externa, remoção/retorno, emissões desconhecidas, zero real, agregação com contagens e ausência de publicação após rollback. A migração e o contrato estão em `backend/docs/HISTORY.md`. A revisão visual e de interação no navegador continua pendente.

## Pendências de integração

- Revisar navegação, filtros e linha do tempo no navegador, inclusive mobile e acessibilidade.
- Conectar somente as operações de configuração que tiverem endpoints e autorização definidos no backend.
- Executar a revisão final para integração com `develop`; nenhuma publicação ou merge é realizado automaticamente por esta etapa.
