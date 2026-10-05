# Rendering ideas — quick-win assessment

Assessed 2026-10-04 against CesiumJS 1.139.1 / engine 23.0.1 and current source. Original scope: analysis and documentation. Q4 has since been implemented; rendering experiments remain deferred. The original rendering proposal list has been consolidated into [the product roadmap](../ROADMAP.md); this assessment retains its technical corrections.

## Roadmap

All rendering candidates and their current decision status are consolidated under GFX IDs in [the product roadmap](../ROADMAP.md). This audit retains source-confirmed technical findings and minimap evidence. No rendering A/B test or GPU benchmark was performed for the original assessment.

## Current infrastructure

- [CesiumManager](../../src/world/CesiumManager.ts) already requires an ion token, creates daylight sky/clouds, enables terrain lighting and caps render density at 1.5. Its `setupGlobeToggle` hides the globe near spawn once Google tiles are ready: globe-only effects do not change those photogrammetric surfaces.
- [TileLoader](../../src/world/TileLoader.ts) already applies saturation, contrast, warmth and a normal-based occlusion term. Google tile shadows are disabled to avoid conflicting with photographed shadows.
- [TerrainProviderFactory](../../src/world/TerrainProviderFactory.ts) selects ArcGIS, then Terrarium. Installed providers report no water masks or vertex normals.
- [SimSession](../../src/game/SimSession.ts) passes decorative cloud exclusions into the flight loop. [TerrainSampler](../../src/world/TerrainSampler.ts) samples rendered geometry for the collision floor. New decoration and alternative buildings must respect those paths.

## Corrections and static concerns

| ID | Verified finding | Consequence |
|---|---|---|
| B1 | `TileLoader` computes hemisphere occlusion from `normalEC` dotted with fixed eye-space Z. That direction follows the camera, not geographic up. | Static coordinate inconsistency, not a reproduced visual regression. Occlusion is ignored by Cesium's unlit path; verify the loaded material before claiming a visible defect. Compare disabling this term first, then use a consistent geographic frame if retaining directional shading. |
| C1 | The ion token is already required. | Water and OSM proposals do not introduce a new credential type, but do introduce dataset access, usage and provider behavior to validate. Archived quotas are not current guidance. |
| C2 | Engine `GlobeFS.glsl` computes imagery color and then alpha-blends a Fabric material over it. | Materials do not inherently replace imagery. An opaque material covers it; partial alpha preserves it. No custom imagery-sampling workaround is needed for a simple overlay. |
| C3 | Globe slope/normal materials are gated on terrain vertex normals. Current providers report none. Fabric supplies `height`, `slope` and `aspect`; `str.p` is not the documented height input. | Provider capability is a prerequisite for slope-based blending and terrain-normal lighting. |
| C4 | `czm_modelMaterial` exposes `normalEC`, not `normal`. The archived normal-map snippet adds texture-space normals directly to a surface normal. | The snippet is invalid as written and lacks a coordinate-space transformation. It is not an implementation-ready quick win. |

Shader evidence: installed `Source/Shaders/GlobeFS.glsl`, `Source/Scene/Globe.js`, `Source/Shaders/Builtin/Structs/modelMaterial.glsl`, `Source/Shaders/Model/MaterialStageFS.glsl` and `LightingStageFS.glsl` under `node_modules/@cesium/engine`. These are version-specific findings. See the official [Globe material API](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html#material) and [CustomShader guide](https://github.com/CesiumGS/cesium/blob/main/Documentation/CustomShaderGuide/README.md).

## Candidate location

GFX-Q1–Q3 and GFX-R1–R6 in [the roadmap](../ROADMAP.md) replace the separate experiment/proposal lists.


## Q4 — game-style minimap and request cost

Recommended first version: a small north-up map, a rotating drone arrow, a home marker, fixed zoom, and a visibility toggle. Move the marker at a modest UI cadence (approximately 5–10 Hz), and recenter only near the edge. Keep flight input independent of map gestures and preserve map attribution.

The existing [MapController](../../src/ui/LocationPicker/MapController.ts) creates a satellite `google.maps.Map`. [App](../../src/ui/App.tsx) now keeps the picker mounted and switches its map into the compact flight panel, preserving the map instance. [SimSession](../../src/game/SimSession.ts) already converts drone ENU position to latitude/longitude when returning to the picker. [FlightNavigation](../../src/game/FlightNavigation.ts) performs that conversion in the game layer and publishes plain position/heading/home/trail data to the UI, independent of the 500 Hz physics loop. No geocoding, Places or Elevation requests are needed merely to locate the simulated drone.

Google's [Dynamic Maps billing definition](https://developers.google.com/maps/billing-and-pricing/sku-details#dynamic-maps) charges for successful map loads. Its [FAQ](https://developers.google.com/maps/faq) states that panning, zooming and marker additions do not generate additional map loads. A newly created minimap therefore adds a map load, not one billable load per position update. Preserving the picker instance can avoid that extra creation; verify actual load counts during implementation. Recreating it on pause/reset, component rerenders or visibility changes is the behavior to avoid.

Network requests are separate from that billing unit: following a drone into previously unseen regions can fetch imagery/tiles. Exact request count, bandwidth and GPU impact depend on viewport, zoom, movement and implementation; no measurements were made here. A small viewport and restrained recentering are sensible starting points, not a guaranteed cost reduction. A second top-down Cesium viewer could also fetch/refine more 3D content and consume more GPU resources; it is unnecessary for this first version. Direct Map Tiles API or repeated Static Maps requests have different billing units and should not be substituted without another cost assessment.

For offline/custom maps, a pack-provided overview image plus bounds/coordinate metadata can support the same arrow/home overlay with no external map API requests. It should depict the actual game world; a Google map at an artificial geographic anchor would not represent San Andreas. Overview-asset standardization is tracked as MAP-OVERVIEW in [the roadmap](../ROADMAP.md).

No tier-0 runtime bug is claimed. B1 is a source-confirmed frame inconsistency whose visible severity remains unmeasured. No verified dead-code deletion was identified within this scope.

## Provider and material limits

OpenFreeMap hosted access and woodland classification are documented by [OpenFreeMap](https://openfreemap.org/) and the [OpenMapTiles schema](https://openmaptiles.org/docs/schema/). These establish neither surface placement accuracy nor a simulator performance budget. World Terrain water effects apply to the globe, rather than water photographed into Google meshes; terrain-normal materials require a capable provider.

## Not quick wins

Automatic vegetation, source switching and generic photogrammetry material changes require substantial integration. Screen-space AO adds a depth-dependent pass and can double-darken photographed shadows; cinematic effects can compromise FPV visibility. Cesium documents the available [post-process stages](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageCollection.html).

Before adopting any candidate: capture identical views and a moving flight, test pause/reset and source teardown, inspect console errors, compare frame times and memory, and check that decoration does not alter the sampled collision floor. Renderer improvements remain deferred. Q4 validation: 278 unit tests and production build pass; browser checks cover search/launch, marker visibility, collapse/expand, pause and return to picker, with no console errors. The navigation trail is capped at 300 samples and clears on reset. No billing-dashboard or network-volume measurement was performed.
