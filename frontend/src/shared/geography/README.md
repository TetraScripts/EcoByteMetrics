# Dados geográficos

`world.json` contém um extrato do Natural Earth v5.0.1, de domínio público:

- [Países, escala 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/v5.0.1/geojson/ne_110m_admin_0_countries.geojson): 177 feições geográficas, com nomes em português e inglês, códigos de país, posições aproximadas de câmera e contornos arredondados para três casas decimais.
- [Localidades, escala 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/v5.0.1/geojson/ne_110m_populated_places.geojson): 243 cidades, com nomes em português e inglês, códigos de país e coordenadas.
- [Termos de uso](https://www.naturalearthdata.com/about/terms-of-use/).

O arquivo fornece os contornos do globo e traduções dos nomes das cidades. A cobertura de países e municípios segue os conjuntos de origem e não é completa.

As posições de câmera usam a média esférica dos vértices do maior anel de contorno de cada país. O extrato inclui apenas a geometria e os campos necessários à seleção geográfica.

As cidades disponíveis na pesquisa e seus marcadores vêm da API de carbono (`GET /regions`). No dashboard, os marcadores usam as coordenadas dos serviços monitorados. Os fatores de emissão são consultados na API e não fazem parte de `world.json`.
