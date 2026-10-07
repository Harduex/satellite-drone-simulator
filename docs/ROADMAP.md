# Product roadmap

Updated 2026-10-07. This roadmap preserves direction and postponed ideas. Horizons express sequence, not delivery dates; neither a roadmap entry nor a suggested priority authorizes implementation.

## Outcomes and constraints

- **Living world:** convincing nearby activity without compromising FPV control or frame time.
- **Flight realism:** believable forces, time and atmosphere with pleasant defaults and unlimited free play.
- **World choice:** preserve Google as default; explore separately licensed fallback and custom maps.
- Reuse Cesium, session ownership, settings, diagnostics and current APIs. Prefer free public data, local assets and browser operation; new paid feeds or backend infrastructure require a separate decision.

## Status and priority

**In progress** = authorized work underway. **Selected next** = preferred direction awaiting its own researched scope. **Deferred** = explicitly postponed. **Proposed** = discussed, undecided. **Implemented locally** = code exists locally; not a deployment claim. **Not selected** = recorded assessment recommends against current adoption.

Pedestrians and increased population density are implemented locally. Combined flight performance and visible placement remain the immediate verification gate before the selected aircraft → weather sequence. Other rows are grouped by outcome without invented delivery commitments.

## Now — verified bounded traffic milestone

| ID | Outcome / scope | Decision status | Dependency / completion gate |
| --- | --- | --- | --- |
| LW1 | Nearby cars on mapped roads with bounded simulation/render work and color variation | Implemented and verified locally | [Traffic design](superpowers/specs/2026-10-05-road-traffic-design.md), [execution and performance record](superpowers/plans/2026-10-05-road-traffic.md) |
| LW1-A | Lightweight Audi A3 and Mazda CX-5 representations; car appearance follows scene daylight/night exposure | Implemented and verified locally | [Asset provenance](../public/models/traffic/ATTRIBUTION.md); day/night, lifecycle and repeated performance gates passed |

## Next — nearby pedestrians, then aircraft and optional weather

| ID | Outcome / scope | Decision status | Dependency / next decision |
| --- | --- | --- | --- |
| LW6 | Nearby people walking on verified footpaths and pedestrian streets, with varied clothing and simple animation | Implemented locally; combined flight-performance gate pending | [Current placement rules](../README.md#road-traffic). Caps are 300 cars and 160 people. Missing 3D surfaces retry without discarding completed probes; geometric rejection remains strict. Automated checks and bounded local browser flights do not establish full-cap GPU performance or visibility beneath scanned vegetation. Crossings and car interaction remain separate follow-ups |
| LW3 | Nearby simple aircraft driven by public flight-position reports | Selected after LW6 performance gate; scope pending | Verify free access, product-use permission, browser integration, freshness/coverage, distance cap and stale-data behavior before implementation |
| LW4 / P6 | Optional weather-driven atmosphere and wind for experimentation | Selected after LW3; deferred implementation | Reuse wind/daylight controls. Verify free-use terms, forecast resolution, failure fallback and choice of moderated versus actual conditions |

Aircraft is the selected part of LW3; vessels and transit remain separate undecided proposals. Provider research and constraints: [living-world research](experiments/living-world-research.md).

## Later — flight realism and practice

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| P3 | True 3D collisions and impact-based landing/crash detection | Deferred | Reliable geometry for walls, overhangs and collision surfaces; distinct from sampled ground height |
| P4 | Battery discharge, voltage sag and current limits | Deferred; optional only | Must never limit default free play |
| P5 | Self-level flight, practice gates, timed challenges and flight-state replay | Deferred | Separate scope per mode; existing video recording does not provide flight-state replay |
| R1 | Calibrate drag, rotor response and flight envelope against real-flight data | Proposed | Suitable reference measurements; numerical consistency alone does not establish calibration |
| R2 | Propwash and descent thrust loss | Proposed | Current inflow retains static thrust during descent; validate rotor/inflow behavior and bounded handling |
| R3 | Ground effect and wall/building aerodynamics | Proposed | Reliable clearance and geometry; do not infer building-scale airflow from regional weather |
| R4 | Controller profiles per device | Proposed | Current mapping uses one shared storage key; validate device identity, persistence and reconnect behavior |
| R5 | Graphics quality and memory presets | Proposed | Measured budgets across hardware; intentional 6 GiB cache remains the baseline |
| F3 | Make crash grace/confirmation independent of render FPS | Proposed; reproduced, fix not approved | Elapsed simulation time independent of HUD publication; retain terrain-sample protection and god-mode separation |

Evidence and detailed limits: [simulator improvement proposals](experiments/simulator-improvements.md).

## Later — richer living-world simulation

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| LW2 | Use live congestion to influence simulated speeds and spacing | Proposed | LW1; lawful/free provider access, region/request budget and simulated-data labeling |
| LW2-G | Evaluate Google traffic categories as the LW2 input | Proposed; provider undecided | Evaluate Routes coverage, billing and allowed reuse; no scraping TrafficLayer colors or assuming individual-car positions |
| LW5 | Richer junction/demand behavior with SUMO | Proposed; undecided | Consider a prepared district only if lightweight traffic is inadequate; separate runtime is new infrastructure |
| LW1-D | Detailed car interiors, animated wheels and vehicle sounds | Deferred | Independent visual/audio budgets and optional controls; [traffic design](superpowers/specs/2026-10-05-road-traffic-design.md) |
| LW6-X | Pedestrian crossings and interaction with cars | Proposed follow-up | Verified pedestrian placement, mapped crossing topology and bounded interaction; keep simple path walking independent |
| LW1-L | Richer lanes, overtaking, signals and jurisdiction-specific driving side | Proposed; outside traffic V1 | Reliable lane/direction/signal data; conservative topology and placement, then combined performance validation |
| LW1-S | Dynamic vehicle shadows and adaptive population scaling | Proposed; outside traffic V1 | Avoid conflict with photographed shadows; preserve explicit caps and measured frame-time gates |
| LW3-VT | Public-data vessels or transit | Proposed; outside selected aircraft task | Feed-specific permission, freshness, locality and infrastructure feasibility |

Detailed research: [living-world sources and constraints](experiments/living-world-research.md).

## Later — map packs and fallback rendering

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| MAP-D2/D3 | Optional local/offline map source and supported real/fictional map packs | Deferred brainstorming | Includes MAP-B1: versioned entry point, units, axes, bounds, spawn points, credits/license and supported formats; start with prepared 3D Tiles/GLB, evaluate other conversion separately; probes are not a shipped offline mode |
| MAP-B2/B3 | Import/storage and clean map-source lifecycle | Deferred brainstorming | Pack contract; folder/archive versus downloaded packs, quotas, persistence, progress/removal, app-shell offline behavior, coordinate/spawn reset, no remote dependencies in offline mode and resource teardown; preserve Google |
| MAP-B4/B5 | Coverage boundaries, collision contracts and larger-world chunking/LOD | Deferred brainstorming | Warn before leaving coverage; separate visual-height sampling from collision geometry; spatial chunks/LOD and measured texture/memory budgets |
| MAP-D4/B6 | Browsable, licensed map catalog | Proposed; not selected | Start with an openly licensed sample, compatibility checks and source/license metadata |
| MAP-OVERVIEW | Pack-provided overview for minimap navigation | Deferred with map packs | Actual-world image, bounds and coordinate metadata; avoid unrelated Google geography |
| MAP-AI | Reconstruct maps from images/video | Separate research proposal | Existing probes demonstrate conventional meshes, not AI-generated world reconstruction |
| GFX-Q1 | Compare existing tile grading and camera-dependent occlusion | Deferred experiment | Identical views/motion; establish visible defect before a correction |
| GFX-Q2 | Compare MSAA and optional FXAA | Deferred experiment | Roof shimmer, softness and GPU cost across hardware |
| GFX-Q3 | Evaluate normal-capable World Terrain in globe-visible scenes | Deferred experiment | Dataset access, provider failure, collision heights; prerequisite for GFX-R2/R4 |
| GFX-R1 | Procedural vegetation | Deferred | Bounded fallback/custom-map trial; assets, placement, lifecycle and overdraw; avoid duplicating scanned canopy |
| GFX-R2 | Animated globe water | Deferred conditional experiment | GFX-Q3/water masks; does not animate water baked into Google meshes |
| GFX-R3 | OSM buildings in explicit fallback mode | Deferred | Coverage, lifecycle and sampled collision heights; avoid layering duplicate surfaces over Google |
| GFX-R4 | Terrain texture blending | Deferred | Normal-capable terrain, projection/fade and measured imagery blending |
| GFX-R5 | Detail normal maps | Deferred | Correct coordinate transforms, stable tile coordinates and suitable lit materials; prefer authored licensed local maps |
| GFX-R6 | Hillshade overlay | Not selected for normal Google flight | Limited benefit while globe is hidden nearby; provider access, attribution and requests remain costs |
| GFX-POST | Optional AO, bloom or depth-of-field experiments | Deferred; lower priority | AO can double-darken photographed shadows; visibility and FPV control take priority over cinematic effects |

Map evidence: [offline/custom maps](experiments/offline-maps.md). Rendering IDs are namespaced because historical lists also used R1–R6. The [current assessment](audits/quick-wins-2026-10.md) supersedes their API/quota assumptions. The original proposal-only document is retired; earlier revisions remain in Git history.

## Later — original product and recording candidates

These candidates were recovered from the original PRD/plan or explicit exclusions in shipped specs. They are historical proposals, not approved releases; the old v0.2–v1.0 schedule is retired.

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| DRONE-BUILDER | Multiple drone profiles and a builder using frame, motor KV, propeller and optional battery configuration | Proposed; historical PRD | Calibrated profiles and parameter validation; default unlimited play remains; source: [original PRD](../SATELLITE_DRONE_SIM_PRD.md) |
| NET-MULTIPLAYER | WebRTC peer positions without shared physics | Proposed; historical PRD | Session/network ownership, privacy and synchronization; infrastructure needs separate evaluation |
| CAM-XR | FPV goggles through WebXR | Proposed; historical PRD | Device/browser support, input compatibility and rendering budget |
| CAM-VIEWS | Third-person/alternate cameras and optional lens distortion | Proposed; historical PRD/plan | Preserve FPV defaults, camera sync and visibility; [original plan](../PLAN.md) |
| PHY-INTEGRATOR | Evaluate RK4 integration or a more detailed wind/turbulence model | Proposed; historical PRD/plan | Prove a measurable accuracy/handling need first; retain zero-allocation 500 Hz budget. Existing wind is implemented; Dryden is an unselected model candidate, not current behavior |
| REC-LIBRARY | Longer/full-session recording, persistent libraries and automatic recording | Proposed; historical recording exclusions | Provider-use permission, storage/resource limits and user controls |
| REC-EDIT | HUD inclusion, alternate capture views, video editing/quality/transcoding and sharing/upload integrations | Proposed; historical recording exclusions | Capture/render budget, attribution and optional external infrastructure; never publish automatically |
| REC-AUDIO | Microphone/system audio and browser screen capture | Proposed; historical recording exclusions | Explicit user controls, browser permission/support and track cleanup |

Recording boundaries and provider-use caveats remain in [the recording design](superpowers/specs/2026-10-04-flight-recording-design.md). P5 includes ghost/flight-state replay and Acro/Angle/Horizon practice scope; P3 includes collision-engine evaluation with no Rapier commitment. Recording aliases O1/O2/O3 remain historical scope labels: REC-LIBRARY covers O1, REC-EDIT covers O2, and REC-AUDIO covers the audio/capture part of O3; physics/provider changes remain independent decisions.

## Rendering candidate detail

The separate rendering proposal lists are removed. Corrected technical notes retain acceptance criteria and source links here. B1/C2/C3 refer to findings in [the rendering audit](audits/quick-wins-2026-10.md). Effort S means a bounded existing-API change, M means additional integration/validation, and L means a new data/asset pipeline. Impact and rendering order are recommendations, not measured outcomes or delivery commitments.

| ID | Proposal | Effort / impact | Worth it? / acceptance |
|---|---|---|---|
| GFX-Q1 | A/B the existing tile-grading uniforms; isolate B1 by setting its strength to zero. | S / medium potential | Yes, first. Compare identical camera poses and turns in several locations; preserve photographed detail and avoid excessive saturation/darkening. Use existing [CustomShader.setUniform](https://cesium.com/learn/cesiumjs/ref-doc/CustomShader.html#setUniform), without adding a permanent settings panel until a useful choice is demonstrated. |
| GFX-Q2 | Compare existing 4-sample MSAA with and without Cesium FXAA. | S / low–medium potential | Yes, as a test. Installed post-processing defaults FXAA off; actual MSAA depends on WebGL2 support. Check roof-edge shimmer during movement, texture softness, GPU frame time and lower-end devices. Do not enable it globally merely because the API is one line. See [FXAA](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStageCollection.html#fxaa). |
| GFX-Q3 | Compare normals-enabled World Terrain with current fallback terrain in an isolated globe-visible scene. | S prototype / M adoption; medium fallback potential | Conditional. This unlocks supported relief lighting and provides a prerequisite for GFX-R2/GFX-R4. Compare heights, spawn/collision behavior, dataset access and loading before changing the production provider. See [terrain options](https://cesium.com/learn/cesiumjs/ref-doc/CesiumTerrainProvider.html). |

| ID | Idea | Effort / impact | Verdict and reasoning |
|---|---|---|---|
| GFX-R1 | Procedural vegetation | L / medium potential | Defer. Requires vector decoding, placement, assets, density/LOD, local-up sprite alignment and lifecycle. Google already contains scanned vegetation; sampling may place new trees on canopy and duplicate it. Ordinary height sampling uses currently rendered geometry. Transparent overdraw and the claimed comfortable 10k count need measurement. Start only with a bounded fallback/custom-map experiment. [Billboards](https://cesium.com/learn/cesiumjs/ref-doc/Billboard.html), [sampleHeight](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#sampleHeight). |
| GFX-R2 | Water effects | S prototype / M adoption; low Google / medium coastal fallback | Conditional after GFX-Q3. Request World Terrain water masks; `showWaterEffect` already defaults true. This affects globe water, not water photographed into Google meshes. Provider changes need graceful failure and height validation; disabling globe hiding would reintroduce the competing terrain surface. [Water effect](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html#showWaterEffect). |
| GFX-R3 | OSM buildings | S prototype / M integration; medium fallback | Worth a later explicit fallback mode. The [supported helper](https://cesium.com/learn/cesiumjs/ref-doc/global.html#createOsmBuildingsAsync) is simple; coverage is OSM-derived, not guaranteed complete. Lifecycle, mode selection and collision heights are the real work. Overlaying on Google risks duplicate surfaces. It is an online dataset, not an offline pack by default. |
| GFX-R4 | Terrain splatting | M / low Google / uncertain fallback | Defer. C2 removes the imagined imagery-compositing blocker, but C3 remains. Requires normal-capable terrain, texture/projection tuning, distance fade and measured blending. A procedural texture cannot recover surveyed ground detail. |
| GFX-R5 | Detail normal maps | M–L / uncertain | Defer. Correct the material member and tangent-to-eye transform; establish stable coordinates across tiles, surface selection and distance fade. `positionMC.xz` is not a guaranteed ground projection. Normal changes need appropriate lit material/normals and may clash with baked photographs. Prefer authored materials on licensed local maps before altering all Google surfaces. |
| GFX-R6 | Hillshade imagery overlay | S prototype / M production; low | Skip for normal Google flight. Globe lighting already exists, and the globe is hidden nearby. The proposed Stamen Terrain layer is a colored cartographic basemap with roads/labels, not pure hillshade; even its background contains landcover coloring. Production authentication/attribution and extra requests are added surface area. See [Stamen Terrain layers](https://docs.stadiamaps.com/map-styles/stamen-terrain/) and [authentication](https://docs.stadiamaps.com/authentication/). |

## Implemented foundation

| ID | Outcome | Evidence |
| --- | --- | --- |
| P1 | Wind presets/direction/gusts and subtle rotor airflow texture without independent wind hiss | [Wind/daylight design](superpowers/specs/2026-10-05-wind-daylight-design.md), [verification](superpowers/plans/2026-10-05-wind-daylight.md) |
| P2 | Real-time Sun/Moon and pleasant default daylight | Same design/verification; photographed Google shadows remain a limitation |
| Q4 | Corner minimap with heading, home guidance and bounded trail | [Rendering assessment](audits/quick-wins-2026-10.md) |
| REC-VIDEO | In-flight local video recording with scene/provider credits | [Recording design](superpowers/specs/2026-10-04-flight-recording-design.md), [implementation record](superpowers/plans/2026-10-04-flight-recording.md); provider-use permission remains a release caveat |
| F4 | Cache documentation matches intentional 6 GiB plus view overflow | [README](../README.md) |

## Maintaining this roadmap

Capture each explicitly postponed idea and each undecided proposal here at the decision boundary. Preserve stable IDs; deduplicate aliases such as P6/LW4. Record the outcome, horizon/relative priority, decision status, dependency and source link. Keep technical research/specs in their existing documents. Update status after an actual decision or verified implementation; do not silently promote a proposal to approval, assign dates or start deferred work. Keep this index public-safe and free of private conversation/session artifacts.
