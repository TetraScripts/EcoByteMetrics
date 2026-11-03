# Plano do frontend — Dashboardsp2

Plano do frontend desenvolvido na `Dashboardsp2` e validado junto à develop na branch de integração. As funcionalidades que ainda exigem contratos ou integração de APIs permanecem indicadas na tabela. A validação com respostas controladas não substitui a integração real.

| Etapa | Entrega | Situação |
| --- | --- | --- |
| 1 | Comunicação HTTP, contratos e erros consistentes | Implementada e testada com respostas controladas |
| 2 | Atualização, cancelamento e preservação dos últimos dados válidos | Implementada; testes de transporte e transições de dados |
| 3 | Histórico persistido via API | Gravação e estatísticas do backend validadas; pendente de contrato de consulta de histórico para o frontend |
| 4 | Período, cobertura, totais, estados e última atualização | Implementada em resumo expansível e nas aplicações |
| 5 | Filtros e ranking coerentes | Implementada e testada: mesma seleção, remoções ao final, valores incompletos explícitos |
| 6 | Detalhes, localização e gráficos | Implementada e testada por domínio/renderização; revisão visual geral aprovada pelo usuário |
| 7 | Comparação de aplicações no mesmo intervalo | Implementada para amostras desta sessão; histórico persistido depende da etapa 3 |
| 8 | Login, expiração e sessão reais | Frontend conectado ao login, sessão em memória, saída e expiração testadas com respostas controladas; validação com conta e banco reais pendente |
| 9 | Configurações do sistema pela API | Pendente do backend atualizado |
| 10 | Navegação e rotas consistentes | Implementada: comparador, filtros preservados e rotas antigas redirecionadas |
| 11 | Responsividade e acessibilidade | Corrigidos fluxo mobile, filtros, tabelas, gráfico, áreas de toque e escala inicial do globo com zoom livre; conferência visual, teclado e zoom pendentes de navegador conectado |
| 12 | Desempenho e medição reproduzível | CPU, geometria e build medidos; CSS por página, gzip e compressão dos vídeos aplicados; FPS entre dispositivos pendente |
| 13 | Testes dos fluxos e das falhas | Suíte ampliada com HTTP, contratos, transições, comparação, navegação e renderização |
| 14 | Distribuição e documentação do frontend | Imagem do frontend, Nginx e proxy verificados; Compose completo pendente no ambiente de destino |

Não serão simulados login, persistência ou operações administrativas. O histórico observado no navegador será identificado como dados desta sessão.

## O que mudou e por quê

1. Transporte HTTP compartilhado e validação na entrada: distinguem indisponibilidade, demora, resposta inválida e cancelamento sem confiar no conteúdo recebido.
2. Recursos da última coleta válida são preservados nas falhas individuais e identificados como antigos. Cancelamento impede que consultas abandonadas alterem os dados; a finalização de uma consulta antiga não encerra o indicador de outra em andamento.
4. Resumo expansível mostra período solicitado, totais, cobertura, estados, consulta concluída e última coleta. Essas informações ajudam a interpretar os números sem transformar o dashboard em uma tela de cartões.
5. Busca e estado agora entram na análise compartilhada, mantendo gráfico, lista e totais coerentes. Navegar entre telas não descarta a seleção.
6. Detalhes continuam com o globo à esquerda; coordenadas ausentes têm aviso. Emissões incompletas não parecem completas, inclusive no gráfico acumulado.
7. A tabela de comparação mostra energia, emissões, quantidade, duração e datas das amostras no mesmo intervalo, sem concluir eficiência a partir de totais diferentes.
8. O formulário de login envia credenciais ao backend e distingue erros de senha, conexão e indisponibilidade, sem expor detalhes internos. A sessão fica apenas em memória, expira automaticamente e pode ser encerrada em Sair. Consultas autenticadas tratam 401 sem afetar uma sessão nova por respostas antigas. A administração exige login em desenvolvimento e produção; a seção separada de Acesso foi removida. Cadastro e configuração continuam desativados. A validação real será retomada com o PostgreSQL disponível.
10. O comparador ocupa uma aba ao lado de Evolução no dashboard. Endereços antigos levam à funcionalidade correspondente no dashboard, preservando os filtros e as seleções.
11. Regiões de tabela admitem foco e rolagem por teclado. Cabeçalho e seleção do comparador se reorganizam em telas estreitas; o conteúdo tem altura mínima para permanecer alcançável em janelas baixas.
    Em até 900 px, o dashboard usa rolagem do documento e empilha mapa e detalhes. Em celulares, filtros e valores se reorganizam, campos usam fonte de 16 px e o gráfico mantém uma altura legível. O espaço inicial do globo é quadrado até 680 px, com escala pela menor dimensão; o canvas ocupa a janela para permitir zoom além desse espaço sem cantos retangulares. Gestos precisam começar na área do mapa, e deslizar verticalmente continua rolando a página. Ao mudar entre desktop e mobile, a câmera reenquadra a visão geral sem animar uma escala antiga. A abertura e o rodapé da página inicial se adaptam à altura e à largura disponíveis. A escala, o zoom e os limites de interação têm testes de geometria; a aparência e os gestos em aparelho real ainda precisam de conferência.
12. A evolução usa Recharts carregado sob demanda, com barras por intervalo e pontos no acumulado. Períodos longos são agrupados em 5 minutos ou 1 hora; cálculos de totais preservam as amostras originais. Lacunas e estimativas incompletas têm explicações próprias, sem interpolar valores.
    A etapa sem alteração de assets retirou estilos legados do carregamento e adiou CSS por página. O código inicial da home diminuiu 13,0%; gzip no Nginx reduziu 70,6% da transferência dos arquivos JS/CSS/SVG testados, preservando seus bytes após descompressão. Após aprovação visual do primeiro teste, os oito vídeos ativos foram reencodificados sem alterar resolução, duração ou quantidade de quadros: 35,43 MB passaram a 20,29 MB. O build completo ficou em 24,16 MB. A geometria permanece intacta; a avaliação visual dos demais vídeos em aparelhos reais continua pendente. Evidências em [docs/BUILD-WEIGHT.md](docs/BUILD-WEIGHT.md).
13. Testes cobrem falhas e dados parciais, não apenas respostas ideais. Testes React no servidor não substituem teste visual ou WebGL.
14. README, ambiente e Docker descrevem o que funciona e o que depende do backend. O HTML da distribuição exige revalidação para reduzir a chance de servir uma versão antiga após atualização.

Procedimentos, evidências e pendências de integração: [docs/VALIDATION.md](docs/VALIDATION.md).
