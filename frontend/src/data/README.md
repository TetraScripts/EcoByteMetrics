# Geographic data

`world.json` contains a compact extract of Natural Earth v5.0.1, in the public domain:

- [Countries, 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/v5.0.1/geojson/ne_110m_admin_0_countries.geojson): 177 geographic features, Portuguese and English names, country codes, approximate camera positions and boundaries rounded to three decimal places.
- [Populated places, 1:110m](https://github.com/nvkelso/natural-earth-vector/blob/v5.0.1/geojson/ne_110m_populated_places.geojson): 243 major cities, Portuguese/English names, country codes and coordinates, used to localize API city names.
- [Terms of use](https://www.naturalearthdata.com/about/terms-of-use/).

These datasets are geographic reference data, not carbon measurements. They do not include every country boundary or every municipality. Research cities and reference markers come from the carbon API (`GET /regions`); dashboard markers use monitored services' coordinates. The static city catalogue supplies translated names only. Geographic boundaries follow the source dataset.

The extract retains geometry and selection fields only. Camera positions use the spherical average of vertices of each country's longest boundary ring. Country boundaries are local; the registered region catalogue is fetched from the challenge API.
