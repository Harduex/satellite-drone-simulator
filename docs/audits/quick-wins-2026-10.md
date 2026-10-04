# Rendering ideas — quick-win assessment

Assessed 2026-10-04 against CesiumJS 1.139.1 / engine 23.0.1 and current source. Scope: analysis and documentation only. The [archived roadmap](../experiments/rendering-roadmap.md) preserves the six original proposals; this assessment supersedes its technical assumptions.

## Recommendation

Start with **Q1 color-grading comparisons**, then **Q2 anti-aliasing comparisons**. Both reuse the current renderer without a new map service or asset pipeline. Among the original six ideas, **R2 water** is a relatively small experiment, but its benefit is limited to visible globe terrain. **R3 OSM buildings** is the most useful fallback-world feature; it needs a deliberate map mode rather than unconditional layering over Google.

Effort S = a bounded change using an existing API/seam; M = additional integration and validation; L = a new data/asset pipeline. Impact ratings are hypotheses. No new visual A/B tests or GPU benchmarks were performed for this audit; source-confirmed behavior is distinguished from inferred visual/performance risks.

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

## Highest-leverage quick experiments

| ID | Proposal | Effort / impact | Worth it? / acceptance |
|---|---|---|---|
| Q1 | A/B the existing tile-grading uniforms; isolate B1 by setting its strength to zero. | S / medium potential | Yes, first. Compare identical camera poses and turns in several locations; preserve photographed detail and avoid excessive saturation/darkening. Use existing [CustomShader.setUniform](https://cesium.com/learn/cesiumjs/ref-doc/CustomShader.html#setUniform), without adding a permanent settings panel until a useful choice is demonstrated. |
| Q2 | Compare existing 4-sample MSAA with and without Cesium FXAA. | S / low–medium potential | Yes, as a test. Installed post-processing defaults FXAA off; actual MSAA depends on WebGL2 support. Check roof-edge shimmer during movement, texture softness, GPU frame time and lower-end devices. Do not enable it globally merely because the API is one line. See [FXAA](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageCollection.html#fxaa). |
| Q3 | Compare normals-enabled World Terrain with current fallback terrain in an isolated globe-visible scene. | S prototype / M adoption; medium fallback potential | Conditional. This unlocks supported relief lighting and provides a prerequisite for R2/R4. Compare heights, spawn/collision behavior, dataset access and loading before changing the production provider. See [terrain options](https://cesium.com/learn/cesiumjs/ref-doc/CesiumTerrainProvider.html). |

No tier-0 runtime bug is claimed. B1 is a source-confirmed frame inconsistency whose visible severity remains unmeasured. No verified dead-code deletion was identified within this scope.

## Assessment of the six archived ideas

| ID | Idea | Effort / impact | Verdict and reasoning |
|---|---|---|---|
| R1 | Procedural vegetation | L / medium potential | Defer. Requires vector decoding, placement, assets, density/LOD, local-up sprite alignment and lifecycle. Google already contains scanned vegetation; sampling may place new trees on canopy and duplicate it. Ordinary height sampling uses currently rendered geometry. Transparent overdraw and the claimed comfortable 10k count need measurement. Start only with a bounded fallback/custom-map experiment. [Billboards](https://cesium.com/learn/cesiumjs/ref-doc/Billboard.html), [sampleHeight](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#sampleHeight). |
| R2 | Water effects | S prototype / M adoption; low Google / medium coastal fallback | Conditional after Q3. Request World Terrain water masks; `showWaterEffect` already defaults true. This affects globe water, not water photographed into Google meshes. Provider changes need graceful failure and height validation; disabling globe hiding would reintroduce the competing terrain surface. [Water effect](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html#showWaterEffect). |
| R3 | OSM buildings | S prototype / M integration; medium fallback | Worth a later explicit fallback mode. The [supported helper](https://cesium.com/learn/cesiumjs/ref-doc/global.html#createOsmBuildingsAsync) is simple; coverage is OSM-derived, not guaranteed complete. Lifecycle, mode selection and collision heights are the real work. Overlaying on Google risks duplicate surfaces. It is an online dataset, not an offline pack by default. |
| R4 | Terrain splatting | M / low Google / uncertain fallback | Defer. C2 removes the imagined imagery-compositing blocker, but C3 remains. Requires normal-capable terrain, texture/projection tuning, distance fade and measured blending. A procedural texture cannot recover surveyed ground detail. |
| R5 | Detail normal maps | M–L / uncertain | Defer. Correct the material member and tangent-to-eye transform; establish stable coordinates across tiles, surface selection and distance fade. `positionMC.xz` is not a guaranteed ground projection. Normal changes need appropriate lit material/normals and may clash with baked photographs. Prefer authored materials on licensed local maps before altering all Google surfaces. |
| R6 | Hillshade imagery overlay | S prototype / M production; low | Skip for normal Google flight. Globe lighting already exists, and the globe is hidden nearby. The proposed Stamen Terrain layer is a colored cartographic basemap with roads/labels, not pure hillshade; even its background contains landcover coloring. Production authentication/attribution and extra requests are added surface area. See [Stamen Terrain layers](https://docs.stadiamaps.com/map-styles/stamen-terrain/) and [authentication](https://docs.stadiamaps.com/authentication/). |

The roadmap's OpenFreeMap no-key/no-request-limit service claim is supported by [OpenFreeMap](https://openfreemap.org/), and woodland classification by the [OpenMapTiles schema](https://openmaptiles.org/docs/schema/). Those facts establish neither placement accuracy nor a simulator performance budget. Provider availability and terms must be rechecked when implementation starts.

## Not quick wins

Automatic worldwide vegetation, automatic Google/OSM coverage switching, generic photogrammetry normal mapping, and production terrain splatting each require new integration beyond a small renderer toggle. Screen-space AO is available in Cesium, but adds a depth-dependent pass and may double-darken photographed shadows; keep it an optional later benchmark. Bloom and depth-of-field are lower priority because visibility and precise FPV control matter more than cinematic effects. Cesium documents the available [post-process stages](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageCollection.html).

Before adopting any candidate: capture identical views and a moving flight, test pause/reset and source teardown, inspect console errors, compare frame times and memory, and check that decoration does not alter the sampled collision floor. Renderer improvements remain deferred; this audit changes documentation only.
