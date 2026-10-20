# Geographic spawn masks

`ne_110m_land.geojson` is Natural Earth 1:110m land, from the
[v5.1.2 source release](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_land.geojson).
Natural Earth data is [public domain](https://www.naturalearthdata.com/about/terms-of-use/).

Used only to reject sea/ocean candidates. Coastlines are generalized and small
islands may be absent. Inland water and Google 3D tile coverage are not certified.

## Urban areas

`urban-areas.json` derives from Natural Earth's public-domain
[v5.1.2 urban polygons](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_10m_urban_areas.geojson).
Source SHA256: `5136ffd816a9b28c0f295e6797b4c03eaa421be80d78b90f542db4a932dd4497`.

The [source description](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-urban-area/)
identifies 2002–2003 MODIS observations. These polygons estimate built-up areas;
they do not identify Google coverage or current population. Random selection is
weighted by spherical area, rather than by polygon count or a city catalog.

Preparation preserves polygon topology at a 0.001-degree simplification tolerance,
rounds coordinates to four decimals, and removes unused properties. The resulting
11,878 polygons load on demand. Regenerate with Shapely 2.1.2:

```sh
uv run --no-project --with shapely==2.1.2 python scripts/prepare-urban-areas.py ne_10m_urban_areas.geojson src/world/data/urban-areas.json
```

Random startups try at most three candidates. Each must show nearby rendered Google
tiles with geometric error at most 5 m, bounding radius at most 2 km, at least 100
triangles and texture content. A 1.5-second observation window follows view refinement.
This is a local detail heuristic, not certification of a whole flight area; slow
loading can reject covered places. Manually selected locations retain terrain fallback.
