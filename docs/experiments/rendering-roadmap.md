# Archived rendering roadmap

Recovered from the March 29 stash. Historical proposals, not current implementation guidance. API, provider and performance claims below require the corrections in [the rendering assessment](../audits/quick-wins-2026-10.md).

---

# Rendering Roadmap — Future Improvements

## 1. Procedural Vegetation

**Approach**: `BillboardCollection` with tree sprites, placed within forest polygons.

**Data source**: OpenFreeMap vector tiles (free, no API key, no rate limits). Uses OpenMapTiles schema — `landcover` layer with `class=wood` provides forest polygon geometry. Alternative: Overpass API for individual `natural=tree` nodes (urban areas have dense individual tree data).

**Placement**: Scatter points within forest polygons via jittered grid or Poisson disk. Sample heights once at placement time with `scene.sampleHeight()`, store absolute ECEF positions with `HeightReference.NONE` to avoid per-frame clamping cost.

**Rendering budget**:
- ~300m visibility radius = ~280,000 sq meters
- At 1 tree per 80 sq m in forested areas = ~3,500 trees max
- Forested area typically 30-60% of view = 1,000-2,000 visible billboards
- Well within `BillboardCollection` comfort zone (10k+ static billboards is fine)

**LOD**: Use `distanceDisplayCondition` (0-300m), `scaleByDistance`, and `translucencyByDistance` for smooth fade. Beyond 300m, Google 3D Tiles cover the canopy visual.

**Billboard config**: `sizeInMeters = true`, `blendOption = TRANSLUCENT`, 2-4 tree sprite variants in shared texture atlas. Side-view sprites (not top-down) since FPV camera looks forward at 15-degree tilt.

**Integration**: Must add `BillboardCollection` to `TerrainSampler.setExclusions()` to prevent `sampleHeight()` picking up billboard depth pixels (same pattern as `CloudCollection`).

## 2. Water Effects

**Requires**: Cesium Ion token with Cesium World Terrain (`requestWaterMask: true`).

**What it enables**:
- `globe.showWaterEffect = true` — animated water on coastlines and lakes
- `globe.oceanNormalMapUrl` — specular wave highlights
- Water mask data is baked into Cesium World Terrain's quantized-mesh tiles

**Why not implemented**: ArcGIS terrain (current provider) does not include water mask data. Would need to add Ion token dependency.

## 3. OSM Buildings

**Approach**: `Cesium.createOsmBuildingsAsync()` via Cesium Ion (asset ID 96188).

**What it adds**: 3D building outlines worldwide from OpenStreetMap data. Fills the gap between photogrammetry cities (Google 3D Tiles) and empty flat terrain.

**Requires**: Cesium Ion token (free tier: 5GB storage, 15GB streaming/mo).

## 4. Terrain Splatting (Globe Material)

**Approach**: Custom Fabric material on `globe.material` with slope-based texture blending.

**GLSL inputs**: `czm_materialInput` provides `normalEC` (surface normal for slope), `str.p` (height for elevation), `positionToEyeEC` (distance for LOD).

**Limitation**: Globe `material` REPLACES imagery layers — cannot have both satellite photos AND procedural terrain textures simultaneously. Only viable if a compositing workaround is found (e.g., sampling imagery as a custom texture uniform and blending in the shader).

**Built-in alternatives**: `SlopeRamp` and `ElevationRamp` materials exist but produce flat color bands, not realistic textures. `ElevationBand` is designed for overview scales, not drone altitude.

## 5. Detail Normal Maps on 3D Tiles

**Approach**: Add a `SAMPLER_2D` uniform to the existing `CustomShader` with a tiled normal map for close-range surface roughness (gravel, grass micro-detail).

```glsl
// In fragmentMain:
vec2 detailUV = fsInput.attributes.positionMC.xz * u_detailScale;
vec3 detailN = texture(u_detailNormal, detailUV).rgb * 2.0 - 1.0;
material.normal = normalize(material.normal + detailN * 0.3);
```

**Risk**: Google 3D Tiles have baked photo textures — a tiled normal map may look repetitive or conflict at certain scales. Needs careful tuning of `u_detailScale`.

## 6. Hillshade Overlay

**Approach**: Semi-transparent hillshade tile layer overlaid on satellite imagery.

**Providers**:
- Stadia Maps / Stamen terrain tiles: `https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}.png`
- Use `UrlTemplateImageryProvider` with alpha 0.2-0.3

**Benefit**: Adds terrain relief visualization to the 2D globe fallback without requiring vertex normals from the terrain provider.
