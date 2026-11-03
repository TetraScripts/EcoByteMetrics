# Peso do frontend — 28/10/2026

Primeira etapa: reduzir carregamento e transferência preservando a aparência. A referência anterior já inclui os ajustes mobile e a nova logo desta branch. Nenhum vídeo, imagem, fonte, coordenada, material ou animação foi alterado nesta etapa.

## Mudanças aplicadas

- Retiradas do CSS global as folhas antigas de layout, folhas decorativas e monitoramento. O rastreamento dos imports a partir de `src/main.tsx`, incluindo páginas adiadas, não encontrou componentes ativos que utilizem esses layouts. Os arquivos de origem foram mantidos.
- Estilos do dashboard e do mapa passam a acompanhar `DashboardPage`; estilos de acesso acompanham `LoginPage`. O CSS da 404 foi movido sem alterar declarações para `not-found.css`, importado pela página correspondente. O tratamento global de erro de carregamento permanece disponível.
- A home deixou de importar `overview.css`, pertencente às seções substituídas pelo conteúdo atual.
- O Nginx comprime os assets de texto em gzip, nível 5, quando o cliente aceita o formato. A configuração se limita a `/assets/`; vídeos, PNG, JPEG e WOFF2 continuam sendo enviados em seus formatos originais. Referência: [módulo gzip do Nginx](https://nginx.org/en/docs/http/ngx_http_gzip_module.html).
- `npm run measure:build` gera um build com manifesto e relata tamanho por formato, código inicial da home e os maiores arquivos. O teste do medidor cobre dependências compartilhadas, ciclos, deduplicação de CSS e exclusão de vídeos/imports dinâmicos da conta inicial.

## Medições

Valores em bytes decimais; KB = 1.000 bytes e MB = 1.000.000 bytes.

| Medida | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| JS + CSS necessários para abrir a home | 423.124 B | 368.218 B | 13,0% |
| Mesma conta com gzip nível 5 calculado localmente | 125.739 B | 115.300 B | 8,3% |
| CSS de todas as páginas no build | 136.374 B | 117.247 B | 14,0% |
| Total de arquivos publicados, sem manifesto de diagnóstico | 39.314.846 B | 39.295.792 B | 19.054 B |

A conta inicial inclui o entrypoint, a home e seus imports estáticos, sem duplicação. Exclui mídia, fontes, globo, gráfico e outros imports dinâmicos. Não é uma medição do tráfego completo de uma visita nem de tempo de carregamento.

Como o Docker Desktop estava desligado, o arquivo `nginx.conf` foi verificado com o binário oficial Nginx 1.30.6 para Windows, em uma instância temporária restrita a `127.0.0.1:5188`. Somente raiz, endereço de escuta e destino do backend foram adaptados ao ambiente de teste.

Na mesma versão final dos arquivos, o teste HTTP verificou 28 arquivos JS/CSS/SVG: **2.926.362 B originais → 858.905 B transferidos**, redução de **70,6%** com gzip. O pacote do globo passou de 1.758.240 B para 496.118 B na transferência. Os corpos recebidos foram descomprimidos e comparados byte a byte com o build. A economia depende de servir esta configuração Nginx; não representa uma redução equivalente em disco ou nos vídeos, nem uma medição no servidor hospedado do time.

Também passaram: `nginx -t`, páginas inicial/dashboard/login/cadastro/fallback, proxy `/backend/health`, resposta 404 para asset inexistente, revalidação de HTML e solicitações parciais de PNG/MP4 sem alteração dos bytes. A instância temporária foi encerrada; os servidores de desenvolvimento nas portas 5173 e 3000 foram mantidos.

Validação de código: **123 testes, lint e build aprovados**. A comparação visual no navegador e o FPS em aparelhos reais continuam pendentes; os testes de código e HTTP não substituem essas verificações.

## O que já estava otimizado

- Páginas, API de monitoramento, globo e Recharts já usam imports dinâmicos. A home não carrega a geometria dos países ou o motor 3D como dependências estáticas.
- Há uma única instalação de Three.js, versão 0.180.0, compartilhada pelas bibliotecas do globo.
- Vídeos inativos usam `preload="none"`; o vídeo ativo pausa fora da seção e com a aba oculta. Os MP4 atuais já têm somente trilha de vídeo, sem áudio descartável.
- As imagens e vídeos antigos sem import não entram automaticamente no build. Apagá-los do repositório reduziria o checkout, mas não o download atual dos visitantes.

## Próxima etapa: mudanças com possível efeito visual

**Planejamento registrado antes dos testes de vídeo.** Naquela medição, os oito arquivos de vídeo publicados somavam **35.425.228 B**, cerca de **90,2% do build**. São quatro versões de desktop em 1920×1080 e quatro de celular em 1280×720; cada dispositivo utiliza a versão correspondente, não ambas simultaneamente. A primeira proposta foi executada após a aprovação do usuário; os resultados estão abaixo. As demais continuam como possibilidades.

1. **Reencodar e comparar os vídeos.** Testar bitrate, codec e resolução, começando pelos maiores arquivos. A resolução e o bitrate menores podem perder detalhes ou criar artefatos; novos codecs exigem compatibilidade e fallback. A comparação visual deve preceder a substituição.
2. **Testar vídeos mais curtos ou menos quadros por segundo.** Pode diminuir o peso e o trabalho de decodificação, com risco de cortes perceptíveis e movimento menos suave.
3. **Avaliar um globo com menos dependências.** O pacote atual inclui recursos da biblioteca além dos usados pela tela. Substituir o motor ou sua integração pode reduzir JS, mas exige conferir materiais, iluminação, contornos, marcadores, câmera e gestos. Não foi usado um alias que simula módulos WebGPU ou uma alteração em `node_modules` para esconder esse custo.
4. **Comparar níveis de detalhe e efeitos do globo.** Contornos, atmosfera e densidade geométrica podem ser simplificados para economizar GPU, com possível mudança de aparência. Essa medida trata principalmente fluidez e memória; não equivale automaticamente a reduzir o download.

A orientação inicial foi começar pelos vídeos, sem prometer reduções de MB, tempo ou FPS antes dos testes.

## Compressão dos vídeos aprovada e aplicada

Após testar duas variantes do quarto vídeo, o usuário aprovou a versão mais leve no próprio site e pediu o mesmo tratamento nos demais. Foram reencodificados os oito MP4 ativos, usando H.264/libx264, preset `slow`, CRF 31 e `faststart`. A versão de desktop do quarto vídeo, já aplicada no teste, foi reutilizada sem nova compressão.

| Arquivo | Antes | Depois | Redução |
| --- | ---: | ---: | ---: |
| `mountain-dawn.mp4` | 1.954.309 B | 1.557.595 B | 20,3% |
| `mountain-dawn-mobile.mp4` | 925.402 B | 682.086 B | 26,3% |
| `green-mountain.mp4` | 7.114.393 B | 3.989.631 B | 43,9% |
| `green-mountain-mobile.mp4` | 3.543.103 B | 1.972.467 B | 44,3% |
| `landscape-12258848.mp4` | 8.159.423 B | 3.882.414 B | 52,4% |
| `landscape-12258848-mobile.mp4` | 2.242.470 B | 1.632.912 B | 27,2% |
| `landscape-12097119.mp4` | 8.933.019 B | 4.637.154 B | 48,1% |
| `landscape-12097119-mobile.mp4` | 2.553.109 B | 1.936.494 B | 24,2% |
| **Total** | **35.425.228 B** | **20.290.753 B** | **42,7%** |

O build completo passou de **39.295.792 B para 24.161.317 B**, redução de **38,5%**, sem gzip. O caminho estático inicial de JS/CSS da home permaneceu em 368.218 B. Esses totais incluem os arquivos das duas categorias de dispositivo; o navegador seleciona a versão correspondente.

Resolução, duração, quantidade de quadros e cadência de 24 quadros/s foram preservadas em cada arquivo. Não houve cortes, mudança da ordem da rotação, troca dos posters ou mudanças no carregamento dos vídeos. Os dois arquivos antigos `lake-dusk`, sem uso na home, ficaram fora desta alteração. Os originais foram preservados fora do repositório durante os testes e também permanecem recuperáveis no commit `9a666de`.

Validação: metadados e hashes dos oito arquivos, decodificação completa nas comparações SSIM, respostas HTTP e leitura parcial dos oito vídeos pelo Vite, build e 123 testes aprovados. Foram inspecionados quadros do teste inicial e dos cenários de montanha. A compressão é com perdas: os índices SSIM médios dos sete novos arquivos variaram de 0,963337 a 0,987652, indicando maior suavização no vídeo de montanha para celular. Esses índices não são percentuais de qualidade visual. A reprodução dos demais vídeos em navegadores e aparelhos reais ainda precisa de conferência visual.
