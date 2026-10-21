# Product roadmap

Updated 2026-10-21. This roadmap preserves direction and postponed ideas. Horizons express sequence, not delivery dates; neither a roadmap entry nor a suggested priority authorizes implementation.

## Outcomes and constraints

- **Living world:** convincing nearby activity without compromising FPV control or frame time.
- **Flight realism:** believable forces, time and atmosphere with pleasant defaults and unlimited free play.
- **World choice:** preserve Google as default; explore separately licensed fallback and custom maps.
- **Simple access:** play in an ordinary browser tab without extensions, installation or user setup. Live aircraft remain deferred until a suitable direct-browser feed is verified.
- Reuse Cesium, session ownership, settings, diagnostics and current APIs. Prefer free public data, local assets and browser operation; new paid feeds or backend infrastructure require a separate decision.

## Status and priority

**In progress** = authorized work underway. **Selected next** = preferred direction awaiting its own researched scope. **Deferred** = explicitly postponed. **Proposed** = discussed, undecided. **Implemented locally** = code exists locally; not a deployment claim. **Not selected** = recorded assessment recommends against current adoption.

Pedestrians and increased population density are implemented locally, with manual flight verification accepted on 2026-10-18. Live aircraft are deferred because no suitable direct-browser feed is verified. Optional weather remains the next selected candidate, pending its own researched scope. Other rows are grouped by outcome without invented delivery commitments.

## Now — verified bounded traffic milestone

| ID | Outcome / scope | Decision status | Dependency / completion gate |
| --- | --- | --- | --- |
| LW1 | Nearby cars on mapped roads with bounded simulation/render work and color variation | Implemented and verified locally | [Traffic design](superpowers/specs/2026-10-05-road-traffic-design.md), [execution and performance record](superpowers/plans/2026-10-05-road-traffic.md) |
| LW1-A | Lightweight Audi A3 and Mazda CX-5 representations; car appearance follows scene daylight/night exposure | Implemented and verified locally | [Asset provenance](../public/models/traffic/ATTRIBUTION.md); day/night, lifecycle and repeated performance gates passed |

## Near-term — pedestrians, optional weather and deferred aircraft

| ID | Outcome / scope | Decision status | Dependency / next decision |
| --- | --- | --- | --- |
| LW6 | Nearby people walking on verified footpaths and pedestrian streets, with varied clothing and simple animation | Implemented locally; manual flight verification accepted 2026-10-18 | [Current placement rules](../README.md#road-traffic). Caps are 300 cars and 110 people. Pending surface probes survive overlapping refreshes and prioritize nearby surfaces. Cars replenish sooner, weighted by road length and class. Geometric rejection remains strict. Manual acceptance closes the combined flight-performance and street-visibility gate; it does not establish full-cap GPU performance across hardware or visibility beneath scanned vegetation. Surface queries remain a measured flight cost. Crossings and car interaction remain separate follow-ups |
| LW3 | Nearby simple aircraft driven by public flight-position reports worldwide | Deferred 2026-10-18 | Resume only when a suitable free worldwide feed supports direct access from an ordinary browser tab without extensions, user setup or a relay. [Source checks](experiments/living-world-research.md#aircraft-source-checks--2026-10-07) and [2026-10-18 recheck](experiments/living-world-research.md#aircraft-feasibility-recheck--2026-10-18) found no provider meeting all requirements. No operator contact is planned. Verify freshness, real altitude, distance cap, coverage gaps, stale-data behavior and combined performance before adoption |
| LW4 / P6 | Optional weather-driven atmosphere and wind for experimentation | Selected next; researched scope pending | Reuse wind/daylight controls. Verify free-use terms, forecast resolution, failure fallback and choice of moderated versus actual conditions |

LW3 covers deferred aircraft; vessels and transit remain separate undecided proposals. Provider research and constraints: [living-world research](experiments/living-world-research.md).

## Later — flight realism and practice

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| P3 | Ground/roof landing practice and bounded side-contact trial; true 3D collisions deferred | [Prototype implemented locally](superpowers/specs/2026-10-19-landing-contacts-design.md); flight-feel feedback and wider coverage checks pending | Cesium/custom flight physics retained. Ground/roof support and restored inferred sides under strict query budgets; sparse coverage and canopy artifacts remain trial limits; true 3D contacts require supported geometry; Standard severe-impact disarming, God mode without damage, Space/UI nearby airborne recovery. Missing geometry does not pause flight and can cause clipping. Underpasses/overhangs remain unsupported. Renderer migration rejected for this scope; [geometry research](experiments/simulator-improvements.md#p3-collision-feasibility) |
| P3-H | Ground/roof landings with nearby automatic recovery on side impacts | Proposed alternative; not selected for the current solid-wall trial | Compare the bounded wall-contact trial first; preserve a clear distinction between physical contact and automatic recovery |
| P4 | Battery discharge, voltage sag and current limits | Transient load voltage sag implemented locally; pack discharge deferred | Automatic internal-resistance load sag (~2.5% RPM at full 4-motor load) preserves unlimited free play; battery depletion remains optional-only and deferred |
| P5 | Self-level flight, practice gates, timed challenges and flight-state replay | Deferred | Separate scope per mode; existing video recording does not provide flight-state replay |
| P7 | Spawn at a random urban location from the picker or pause menu | Implemented locally; wider coverage assessment pending | Equal-area sampling within Natural Earth urban polygons, filtered by the land mask; at most three candidates, each requiring nearby rendered detailed textured Google tiles. No flat-terrain fallback for random starts; manual selection retains it. Coastlines and inland water remain approximate. [Dataset provenance and detail heuristic](../src/world/data/ATTRIBUTION.md) |
| P7-A | Estimate suitable built-up areas without maintaining a city catalog | Implemented locally as the P7 eligibility heuristic | On-demand geographic polygons replace whole-land sampling. Urban extent is dated and does not guarantee Google coverage; runtime validation gates random starts. Measured worldwide success rate remains pending |
| P8 | Show current country and nearby settlement during flight | Implemented locally; approximate offline labels | Bundled Natural Earth country polygons and settlement points; refresh after 100 m travel, at most once per second. Nearby region labels come from settlement metadata, not region-boundary tests. [Provenance and limits](../src/world/data/ATTRIBUTION.md#offline-flight-labels) |
| R1 | Calibrate drag, rotor response and flight envelope against real-flight data | Real-flight calibration pending reference measurements | [Baseline validation](../README.md#calibration-sources) covers static bench points, torque mechanics, rotor precession, transient rate bounds and Acro maneuvers. Recorded stick/gyro/RPM/voltage and flight-speed data from a known 5-inch 6S build are still needed; numerical consistency alone does not establish calibration |
| R2 | Propwash and descent thrust loss | Implemented locally (first-order wake model) | Descent into own slipstream reduces thrust up to 16% and adds bounded pitch/roll shimmer; empirical blackbox tuning remains under R1 |
| R3 | Ground effect and wall/building aerodynamics | Ground cushion implemented locally; wall aerodynamics deferred | Upright flight within 2.5 rotor diameters of sampled ground boosts lift up to 15%; wall/building airflow still requires 3D proximity geometry |
| R4 | Controller profiles per device | Proposed | Current mapping uses one shared storage key; validate device identity, persistence and reconnect behavior |
| R5 | Graphics quality and memory presets | Proposed | Measured budgets across hardware; intentional 6 GiB cache remains the baseline |
| R6 | Stick endpoint and travel range calibration for controllers | Proposed; implementation not authorized | Record physical min/max travel per axis alongside center offset; scale sub-ranges (e.g. 1000–2000µs / non-unitary USB throws) so full physical stick deflection reaches 100% (-1.0 to +1.0) on all channels |
| F3 | Make crash grace/confirmation independent of render FPS | Proposed; reproduced, fix not approved | Elapsed simulation time independent of HUD publication; retain terrain-sample protection and god-mode separation |

Evidence and detailed limits: [simulator improvement proposals](experiments/simulator-improvements.md).

## Browser flight performance

Research completed 2026-10-21; PERF1 and PERF2 authorized, remaining proposals undecided. Recommended order below; [evidence and limits](experiments/browser-performance.md). Preserve 500 Hz physics, contact correctness and current Google/Cesium integration. Population on/off observations isolate combined population cost, not individual subsystem cost or a sustained flight gain.

| ID | Outcome / scope | Horizon / decision status | Dependency / completion gate |
| --- | --- | --- | --- |
| PERF1 | Explain frame-time spikes with interval distributions and subsystem timings | Implemented locally | Existing overlay now includes bounded frame median/p95/p99/max, long intervals and CPU phase statistics; GPU timing remains unavailable. [Usage and measurement limits](../README.md#performance-diagnostics). Controlled production route comparison remains required for optimization claims |
| PERF2 | Prioritize flight over optional road/path surface preparation | In progress | PF1 evidence; shared admission scheduling with contact priority and population fairness; a synchronous query can still exceed the allowance; preserve strict geometry admission and verify visible population, touchdown, stale coverage and lifecycle |
| PERF3 | Reduce repeated actor allocations, exclusion rebuilding and graph copies | After PERF1 / proposed | PF4 evidence; stable membership-based exclusion lists, scratch pose buffers and cheap counts; measure GC/full tick cost; preserve animation, exclusion correctness and model lifecycle |
| PERF4 / R5 | Offer measured render-resolution, MSAA, detail and memory choices | After surface baseline / proposed | Existing R5 remains undecided; PF3 evidence; same-route quality A/B, edge shimmer and support-height checks; retain 6 GiB baseline until cache pressure/eviction measurements justify a change |
| PERF5 | Bound ancillary UI, map and fixed-time environment work | Later / proposed | PF6 evidence; compare minimap expanded/collapsed, time-based telemetry and unchanged exposure guards; measure before redesigning UI |
| PERF6 | Evaluate residual pose stepping and input-to-display latency | Later / proposed | PF5 evidence; larger frame stalls addressed first; measure physical-radio delivery and camera latency; interpolation may add one 2 ms physics step; no authoritative-state smoothing |

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

## Later — flight deck interface, saved locations and visual polish

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| UI-COPY | Simplify picker, pause and settings UI with functional labels and a centered launch dock | Implemented and verified locally | Removed promotional captions and redundant labels. Picker uses search/discovery above selected location/coordinates and launch; controls stack on mobile. Shared geometry tokens and [design system](../DESIGN.md) match Flight deck framing. Autocomplete, launch, keyboard throttle ramping, pause/settings and responsive layouts checked; [interface design](superpowers/specs/2026-10-20-interface-redesign.md) |
| UI-FAVORITES | Flight history and saved favorite places with a selection menu to bookmark and jump directly to locations | Proposed follow-up | Store in local storage/Zustand; define storage quotas, custom naming, coordinate validation and quick-spawn action |
| UI-FIXES | Complete first-open 3D drone preview and direct rotation controls; investigate related modal/dock regressions | Preview textures, studio lighting and drag rotation implemented locally; other regressions require individual reproduction | Model-owned neutral lighting avoids deferred atmospheric shading; loading remains visible until the framed model is drawn. Mouse/touch drag retains orientation, with keyboard rotation and Reset view. Regression coverage includes normal/reduced motion and disposal; other modal/dock bugs remain proposed follow-ups |

## Later — original product and recording candidates

These candidates were recovered from the original PRD/plan or explicit exclusions in shipped specs. They are historical proposals, not approved releases; the old v0.2–v1.0 schedule is retired.

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| DRONE-BUILDER | Multiple drone profiles and a builder using frame, motor KV, propeller and optional battery configuration | Proposed; historical PRD | Calibrated profiles and parameter validation; default unlimited play remains; source: [original PRD](../SATELLITE_DRONE_SIM_PRD.md) |
| SPAWN1 | Choose starting height on the location/start screen before pressing Fly Here | Proposed; implementation deferred | Reuse the existing spawn-altitude setting. Define height relative to the sampled surface, safe limits, persistence and reset behavior; horizontal spawn position is unchanged |
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
