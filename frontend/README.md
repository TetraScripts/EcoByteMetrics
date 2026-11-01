# Frontend EcoByteMetrics

Interface em React e TypeScript, compilada com Vite. Esta branch mantém o frontend separado da `develop` até a conclusão das melhorias e da integração com o backend atualizado.

## Executar

Use Node.js 24 e npm. Na pasta `frontend/`:

```powershell
npm ci
npm run dev
```

Se precisar configurar a conexão, crie `.env.local` a partir de `.env.example`, somente se ele ainda não existir. Não substitua configurações locais já existentes. O Vite usa a porta 5173; confira o endereço informado no terminal.

| Variável | Padrão | Uso |
| --- | --- | --- |
| `VITE_BACKEND_URL` | `/backend` | Endereço público da API no navegador |
| `BACKEND_PROXY_TARGET` | `http://127.0.0.1:3000` | Destino do proxy do Vite |

O proxy remove `/backend` antes de encaminhar a consulta. Reinicie o Vite após mudar o ambiente. Variáveis `VITE_` são públicas e incorporadas no build; não use senhas ou tokens nelas.

A home, a página 404 e as telas de acesso podem ser abertas sem o backend. Monitoramento e comparação precisam de respostas da API para mostrar aplicações reais; não existe modo de demonstração automático.

A aba Administração exige sessão em desenvolvimento e produção. Uma visita sem sessão vai ao login, preservando o destino e os filtros; a tela de login também oferece o caminho para cadastro. A administração contém a configuração de coleta, sem uma seção separada de Acesso. O intervalo é consultado em `GET /backend/api/monitoring-settings`, protegido por Bearer, usando a mesma constante do coletor. A tela é somente leitura e trata carregamento, falha e nova tentativa. Referências do layout em [ADMINISTRATION-DESIGN.md](src/features/monitoring/ADMINISTRATION-DESIGN.md).

## Login e sessão

O formulário de entrada envia `{ email, password }` para `POST /backend/auth/login`, usando o mesmo proxy do monitoramento. Espera a resposta `{ token, tokenType: "Bearer", expiresIn }`; o JWT precisa trazer `email` e um `exp` futuro. O payload é usado apenas para apresentar a conta e controlar o prazo na interface; assinatura e autorização das operações são responsabilidades do backend.

- Campos e botão ficam desativados durante a consulta; envios duplicados são ignorados. E-mail é normalizado, a senha é enviada sem alterações e é apagada do formulário após a tentativa.
- Credenciais incorretas, serviço indisponível, falha de conexão, tempo limite e resposta inválida têm mensagens próprias. Detalhes internos da API não são exibidos.
- O token usado pelas operações fica em memória, sem `localStorage` ou `sessionStorage`. O backend também emite cookie HttpOnly, SameSite=Strict, limitado ao vencimento original. Ao abrir ou recarregar a página, `GET /backend/auth/session` verifica assinatura, validade e existência da conta antes de restaurar a sessão; não renova o prazo. `POST /backend/auth/logout` remove o cookie. Falha ao confirmar a saída mantém a conta visível e permite tentar novamente. Em produção, o cookie exige HTTPS.
- A sessão termina no prazo informado no JWT, inclusive após suspensão da aba. Consultas feitas por `useAuth().request` enviam Bearer; HTTP 401 encerra a sessão, enquanto 403 mantém a conta conectada. Respostas de uma sessão encerrada não são aplicadas a uma sessão nova.
- Ao entrar, a interface retorna ao dashboard solicitado; voltar sem entrar também preserva filtros e instante, removendo a aba restrita; destinos externos são descartados. A administração mostra a conta e permite sair. O dashboard permanece público; somente a aba Administração exige sessão, inclusive em desenvolvimento.
- Cadastro envia nome, e-mail e senha para `POST /backend/api/users`. Valida nome, e-mail e senha conforme os limites do backend, bloqueia envio duplicado e distingue e-mail já cadastrado de falhas do serviço. Nome e e-mail são normalizados; a senha é enviada sem alterações.
- Após confirmar a criação, volta ao login com o e-mail preenchido, a senha vazia e o destino original preservado. Cadastro não inicia sessão automaticamente. A confirmação e o e-mail ficam apenas em memória. Se a conexão cair sem confirmar o resultado do POST, a mensagem orienta tentar entrar antes de cadastrar novamente.
- Sem PostgreSQL disponível, as telas informam indisponibilidade e não criam sessão. Não há credenciais de demonstração nem autenticação simulada no aplicativo.

A implementação foi testada com respostas controladas e com o backend e PostgreSQL reais pelo proxy do Vite, usando contas temporárias removidas ao terminar. A revisão visual do fluxo no navegador e a autorização das futuras operações administrativas continuam pendentes. Nesta configuração local, `BACKEND_PROXY_TARGET` aponta para `http://127.0.0.1:3001` para evitar colisão com containers antigos na porta 3000.

## Medir o peso

Para medir o tamanho do build, execute `npm run measure:build`. O relatório distingue arquivos publicados, código inicial e estimativa de gzip. Medições, validação HTTP e próximos candidatos de otimização estão em [docs/BUILD-WEIGHT.md](docs/BUILD-WEIGHT.md).

## Rotas

| Rota | Comportamento |
| --- | --- |
| `/` | Landing page com quatro vídeos, seções explicativas e acesso ao dashboard |
| `/dashboard` | Lista, filtros, estados, globo, resumo e evolução das amostras |
| `/dashboard?servico=ID` | Resumo e recursos da última coleta; totais por período na Evolução; globo permanece à esquerda no desktop |
| `/comparar` | Seleção de duas ou mais aplicações, tabela com o mesmo intervalo e cobertura por aplicação |
| `/login` | Formulário conectado ao backend, sessão restaurada pelo servidor, retorno seguro e tratamento de erros |
| `/cadastro` | Criação de conta pela API, validação e retorno ao login com confirmação e e-mail preenchido |
| `/gerenciamento` | Funcionalidade pendente do backend |
| `/pesquisa`, `/servicos` | Redirecionam ao dashboard preservando a consulta |
| `/servicos/:id` | Redireciona ao detalhe da aplicação |
| `/energia`, `/emissoes` | Redirecionam à evolução com a métrica correspondente |
| Outras | Página 404 |

Busca, estado, país, região, cidade, período e data são mantidos na URL. A navegação entre monitoramento e comparação preserva esses filtros e as seleções de comparação. O backend reconstrói o catálogo e os estados até o corte escolhido. Datas futuras são rejeitadas. Quando a aplicação aberta fica fora dos filtros, a interface informa isso e oferece limpar os filtros ou voltar à lista.

## Dados, cálculos e limites

O adaptador `src/features/monitoring/api/monitoring.ts` consulta `GET /backend/api/monitoring?period=24h|7d`, com `until` ISO opcional para revisão de coletas. A resposta vem do PostgreSQL. A visão geral usa `view=latest`, com catálogo e últimas leituras; Evolução, Comparar e a linha do tempo carregam o histórico quando abertos. `historyIncluded` distingue uma consulta leve de um histórico realmente vazio. A interface não consulta diretamente as APIs externas nem monta o histórico a partir das visitas ao navegador.

A visão geral e o resumo individual mostram a última leitura disponível de cada aplicação. Evolução e Comparar apresentam os totais do período; o seletor de período aparece somente nessas análises.

O backend coleta e grava a cada 30 segundos, mesmo com o navegador fechado, enquanto estiver ativo. Recarregar a página consulta novamente os dados gravados. Selecionar período ou data consulta o banco novamente; a interface não mostra uma resposta de outro recorte como se fosse o resultado novo. Em falha de rede, a última resposta permanece em memória, sem gerar amostras adicionais.

Horários chegam em ISO UTC e são apresentados no fuso do dispositivo. Períodos extensos são agrupados no banco, preservando energia, emissões disponíveis, duração, quantidade de amostras e cobertura. Emissão desconhecida permanece `null`, distinta de zero. As amostras antigas que não tinham fator capturado conservam energia, com emissão desconhecida.

O transporte compartilhado em `src/shared/lib/http.ts` solicita JSON, não usa cache de consultas, aceita cancelamento e limita cada requisição a 10 segundos. O contrato do histórico, a migração e os limites de volume estão em [backend/docs/HISTORY.md](../backend/docs/HISTORY.md).

## Verificar

```powershell
npm test
npm run lint
npm run build
npm run preview
```

Os testes cobrem contratos HTTP com respostas controladas, erros, cancelamento, preservação de dados, agrupamento geográfico, filtros, ranking, comparação, gráficos, câmera, rotação, transição e reprodução de vídeos. Os testes de telas usam renderização React no servidor; não executam o navegador ou o WebGL.

Procedimentos e limites das verificações estão em [docs/VALIDATION.md](docs/VALIDATION.md). O andamento e as dependências estão em [FRONTEND-PLAN.md](FRONTEND-PLAN.md).

## Distribuir somente o frontend

```powershell
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up --build -d
```

Este Compose inicia apenas o frontend na porta 5173 e encaminha `/backend/` para `http://host.docker.internal:3000`. Configure `BACKEND_PROXY_TARGET` no ambiente do Compose se o backend estiver em outro endereço. O backend precisa executar separadamente; esse arquivo não instala banco, migrações ou serviços do backend.

`VITE_BACKEND_URL` é um argumento de build; mudanças exigem reconstruir a imagem. `BACKEND_PROXY_TARGET` é aplicado ao iniciar o Nginx. O fallback de rotas entrega `index.html` nos acessos diretos à SPA. O HTML exige revalidação de cache; arquivos de `/assets/` ausentes retornam 404.

## Organização

`app/` compõe rotas, layouts e providers. `features/home`, `features/auth` e `features/monitoring` contêm as funcionalidades. `shared/` reúne componentes, HTTP, preferências, estilos e geografia independentes das funcionalidades. O alias `@/` aponta para `src/`.

Não coloque credenciais no frontend nem implemente histórico fictício para contornar a ausência de endpoints. Validação de permissões e operações administrativas pertence ao servidor.

## Ranking histórico e comparação de recursos

A visão geral mantém aplicações removidas ao final. Em Evolução → Aplicações, o ranking ordena somente pelo impacto no período, incluindo serviços removidos quando pertencem à seleção.

A API fornece recursos históricos médios ponderados pela duração de cada leitura. Os blocos adicionais de recursos e qualidade das leituras foram retirados da interface por decisão visual; a tabela principal do comparador apresenta energia e emissões no mesmo intervalo.
