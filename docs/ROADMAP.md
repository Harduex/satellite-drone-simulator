# Product roadmap

Updated 2026-10-24. This roadmap preserves direction and postponed ideas. Horizons express sequence, not delivery dates; neither a roadmap entry nor a suggested priority authorizes implementation.

## Outcomes and constraints

- **Living world:** convincing nearby activity without compromising FPV control or frame time.
- **Flight realism:** believable forces, time and atmosphere with pleasant defaults and unlimited free play.
- **World choice:** preserve Google as default; explore separately licensed fallback and custom maps.
- **Simple access:** play in an ordinary browser tab without extensions, installation or user setup. Live aircraft remain deferred until a suitable direct-browser feed is verified.
- Reuse Cesium, session ownership, settings, diagnostics and current APIs. Prefer free public data, local assets and browser operation; new paid feeds or backend infrastructure require a separate decision.

## Status and priority

**In progress** = authorized work underway. **Selected next** = preferred direction awaiting its own researched scope. **Deferred** = explicitly postponed. **Proposed** = discussed, undecided. **Implemented locally** = code exists locally; not a deployment claim. **Not selected** = recorded assessment recommends against current adoption.

Implemented features are consolidated under [Completed locally](#completed-locally). Remaining validation has separate follow-up rows.
Optional weather remains the next selected candidate, pending researched scope. Live aircraft remain deferred until a suitable direct-browser feed is verified.

## Next — optional weather and deferred aircraft

| ID | Outcome / scope | Decision status | Dependency / next decision |
| --- | --- | --- | --- |
| LW3 | Nearby simple aircraft driven by public flight-position reports worldwide | Deferred 2026-10-18 | Resume only when a suitable free worldwide feed supports direct access from an ordinary browser tab without extensions, user setup or a relay. [Source checks](experiments/living-world-research.md#aircraft-source-checks--2026-10-07) and [2026-10-18 recheck](experiments/living-world-research.md#aircraft-feasibility-recheck--2026-10-18) found no provider meeting all requirements. No operator contact is planned. Verify freshness, real altitude, distance cap, coverage gaps, stale-data behavior and combined performance before adoption |
| BIRDS-ASSET | Optionally replace the original swallow with a downloaded model | Later; optional improvement, current original model accepted | Must be free, already animated and licensed for redistribution in this public repository. Keep the original animated model unless a suitable replacement is verified. |
| LW4 / P6 | Optional weather-driven atmosphere and wind for experimentation | Selected next; researched scope pending | Reuse wind/daylight controls. Verify free-use terms, forecast resolution, failure fallback and choice of moderated versus actual conditions |

LW3 covers deferred aircraft; vessels and transit remain separate undecided proposals. Provider research and constraints: [living-world research](experiments/living-world-research.md).

## Later — flight realism and practice

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| P3 | Ground/roof landing practice and bounded side-contact trial; true 3D collisions deferred | [Prototype implemented locally](superpowers/specs/2026-10-19-landing-contacts-design.md); flight-feel feedback and wider coverage checks pending | Cesium/custom flight physics retained. Ground/roof support and restored inferred sides under strict query budgets; sparse coverage and canopy artifacts remain trial limits; true 3D contacts require supported geometry; Standard severe-impact disarming, God mode without damage, Space/UI nearby airborne recovery. Missing geometry does not pause flight and can cause clipping. Underpasses/overhangs remain unsupported. Renderer migration rejected for this scope; [geometry research](experiments/simulator-improvements.md#p3-collision-feasibility) |
| P3-H | Ground/roof landings with nearby automatic recovery on side impacts | Proposed alternative; not selected for the current solid-wall trial | Compare the bounded wall-contact trial first; preserve a clear distinction between physical contact and automatic recovery |
| P4 | Optional battery discharge and current limits | Deferred | Transient voltage sag is implemented under P4-SAG. Preserve unlimited free play by default |
| P5 | Self-level flight, practice gates, timed challenges and flight-state replay | Deferred; selected challenge subset tracked under GAME1–GAME3 | Separate scope per mode; GAME4 retains deferred ghost racing; existing video recording does not provide flight-state replay |
| R1 | Calibrate drag, rotor response and flight envelope against real-flight data | Real-flight calibration pending reference measurements | [Baseline validation](../README.md#calibration-sources) covers static bench points, torque mechanics, rotor precession, transient rate bounds and Acro maneuvers. Recorded stick/gyro/RPM/voltage and flight-speed data from a known 5-inch 6S build are still needed; numerical consistency alone does not establish calibration |
| R3 | Wall/building aerodynamics | Deferred | Requires 3D proximity geometry. Ground effect is implemented under R3-GROUND |
| R4 | Controller profiles per device | Proposed | Current mapping uses one shared storage key; validate device identity, persistence and reconnect behavior |
| R5 | Graphics quality and memory presets | Proposed | Measured budgets across hardware; intentional 6 GiB cache remains the baseline |
| R6 | Stick endpoint and travel range calibration for controllers | Proposed; implementation not authorized | Record physical min/max travel per axis alongside center offset; scale sub-ranges (e.g. 1000–2000µs / non-unitary USB throws) so full physical stick deflection reaches 100% (-1.0 to +1.0) on all channels |
| F3 | Make crash grace/confirmation independent of render FPS | Proposed; reproduced, fix not approved | Elapsed simulation time independent of HUD publication; retain terrain-sample protection and god-mode separation |

Evidence and detailed limits: [simulator improvement proposals](experiments/simulator-improvements.md).

## Later — optional game mode and real-world challenges

Selected direction for a future trial; implementation is not authorized. Keep the main free-flight mode unchanged. Initial scope combines collectible signals, landing targets and car following; ghost racing remains deferred.

| ID | Outcome / scope | Decision status | Dependency / next decision |
| --- | --- | --- | --- |
| GAME-MODES | Two top-level modes: **Free Flight** (current simulator, default) and **Arcade** (all scored challenges: GAME1–GAME3, bird chase scoring) | Proposed 2026-10-21; naming accepted direction | Replaces the separate "Signal Run" selector from the GAME1 prototype. Arcade hosts challenge selection; Free Flight stays challenge-free |
| GAME1 | Collect signals placed on rooftops and at ground-level locations by flying through them; predefined exploration routes connect interesting places and provide progress and rewards | Prototype implemented locally, uncommitted (2026-10-21): six 100-point signals, any order, sampled once at launch on loaded surface heights; swept collection; pause/recovery/restart rules; 614 tests pass. First play feedback: rejected as-is | Feedback: signals cluster too tightly and are too small. Next iteration → GAME1-GEMS. Reuse prototype controller, placement sampling, swept collection and HUD |
| GAME1-GEMS | Replace signals with large 3D gem/diamond shapes floating in the sky, spread over a wide area, rotating/glowing so they read at distance | Proposed 2026-10-21; deferred until after BIRDS | Define min spacing (hundreds of metres), sky altitude band above sampled surface, size visible from ~500 m, distance/direction cue (HUD arrow or minimap marker), Arcade-mode integration. Reuse GAME1 prototype code |
| GAME2 | Landing pads act as another signal type: earn points by landing successfully without damaging the drone, rather than by flying through the target | Selected for initial trial; scope pending | GAME1 collection/progress and [P3 landing contacts](superpowers/specs/2026-10-19-landing-contacts-design.md). Define valid touchdown, damage checks, stable contact and repeat scoring; account for incomplete ground/roof coverage |
| GAME3 | Follow a sports car through real-world streets as a flight challenge | Selected for initial trial; scope pending | LW1-SPORT traffic variants; define target selection, following/scoring rules and behavior when the target leaves available road coverage or despawns |
| GAME4 | Race against a ghost of a previous flight | Deferred | P5 flight-state recording/replay and a separately defined race route; outside the initial GAME1–GAME3 trial |

Sports cars belong to ordinary traffic under LW1-SPORT and can appear outside the game mode. Challenge scoring and rewards remain part of the optional game mode. Foundation references: [traffic design](superpowers/specs/2026-10-05-road-traffic-design.md), [landing contacts](superpowers/specs/2026-10-19-landing-contacts-design.md).

## Browser flight performance

Research completed 2026-10-21. PERF1 and PERF2 are implemented locally; remaining optimization proposals are undecided. Recommended order below; [evidence and limits](experiments/browser-performance.md). Preserve 500 Hz physics, contact correctness and current Google/Cesium integration. Population on/off observations isolate combined population cost, not individual subsystem cost or a sustained flight gain.

| ID | Outcome / scope | Horizon / decision status | Dependency / completion gate |
| --- | --- | --- | --- |
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

## Later — saved locations and navigation

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| UI-FAVORITES | Flight history and saved favorite places with a selection menu to bookmark and jump directly to locations | Proposed follow-up | Store in local storage/Zustand; define storage quotas, custom naming, coordinate validation and quick-spawn action |
| UI-NAV | Pin a destination on the map by geographic coordinates and show the destination and a plotted route on the in-flight minimap, providing GPS-style guidance toward the selected location | Proposed follow-up; scope pending | Reuse Q4 minimap and map selection; define destination replacement/removal and arrival behavior. Decide whether the route is a direct flight line or a navigable path; obstacle-aware routing and altitude guidance require separate feasibility checks. Related UI-FAVORITES covers saved places; GAME1 covers predefined exploration routes |

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

## Remaining validation and regression checks

Implementation status does not close these checks. No sustained performance gain or worldwide coverage claim follows from local implementation.

| ID | Outcome / scope | Decision status | Dependency / completion gate |
| --- | --- | --- | --- |
| P7-CHECK | Assess random urban spawn coverage | Pending validation | P7/P7-A: measure worldwide success rate. Urban polygons are dated; coastline/water masks are approximate. Each start still requires detailed textured Google tiles |
| LW1-SPORT-CHECK | Verify nearby street appearance of every sports-car variant | Pending validation | LW1-SPORT: fleet tests and all nine model/color combinations render in Cesium. Population counts alone do not establish nearby visibility |
| PERF2-CHECK | Validate surface scheduling across controlled routes and population loads | Pending validation | PERF2: compare matched production routes; check full-cap performance, touchdown and stale coverage. Earlier static comparisons used different car counts. Synchronous queries can overrun the cooperative budget |
| UI-FIXES-CHECK | Reproduce remaining modal/dock regressions individually | Proposed follow-up | UI-FIXES preview is implemented. Establish a concrete reproduction before selecting another fix |

## Completed locally

These entries record implemented scope, not deployment. Evidence links retain detailed implementation and verification limits.
Further validation remains above; future extensions remain in their outcome sections.

| ID | Implemented outcome | Evidence / limits |
| --- | --- | --- |
| LW1 | Bounded nearby road traffic with color variation | Implemented and verified locally. [Design](superpowers/specs/2026-10-05-road-traffic-design.md), [execution and performance](superpowers/plans/2026-10-05-road-traffic.md) |
| LW1-A | Audi A3 and Mazda CX-5 models with daylight/night exposure | Day/night, lifecycle and repeated performance gates passed. [Asset provenance](../public/models/traffic/ATTRIBUTION.md) |
| LW6 | Animated pedestrians on verified paths; increased population density | Manual flight/performance and street-visibility acceptance recorded 2026-10-18. Caps: 300 cars, 110 people. [Placement rules](../README.md#road-traffic). Full-cap performance across hardware and visibility beneath scanned vegetation remain unestablished; crossings remain LW6-X |
| BIRDS | Nearby flocks, solo flyers, continuous encounters and drone avoidance; Settings toggle | [Encounter design](superpowers/specs/2026-10-22-bird-encounters-design.md). Original animated swallow retained; 30-bird budget. Habitat classification and obstacle avoidance remain outside implemented scope; scoring remains under GAME-MODES |
| P4-SAG | Transient battery load voltage sag | Internal-resistance load sag reduces RPM by approximately 2.5% at full four-motor load. Unlimited free play retained; discharge/current limits remain P4. [Physics baseline](../README.md#calibration-sources) |
| P7 / P7-A | Random urban spawning with geographic eligibility and rendered-detail checks | [Dataset provenance and heuristic](../src/world/data/ATTRIBUTION.md). At most three candidates; random starts have no flat-terrain fallback. Wider coverage remains P7-CHECK |
| P8 | Approximate offline country and nearby settlement labels | Refresh after 100 m travel, at most once per second. Region labels use settlement metadata, not region boundaries. [Provenance and limits](../src/world/data/ATTRIBUTION.md#offline-flight-labels) |
| R2 | First-order propwash/descent thrust loss and bounded pitch/roll shimmer | Up to 16% thrust loss. Empirical tuning remains R1. [Physics baseline](../README.md#calibration-sources) |
| R3-GROUND | Ground cushion near sampled surfaces | Up to 15% lift boost within 2.5 rotor diameters during upright flight. Wall airflow remains R3. [Physics baseline](../README.md#calibration-sources) |
| PERF1 | Frame interval distributions and CPU subsystem diagnostics | [Usage and measurement limits](../README.md#performance-diagnostics). Median/p95/p99/max and long intervals included; GPU timing unavailable. Diagnostics do not establish optimization gains |
| PERF2 | Shared bounded admission for road/path surface preparation | [Evidence and limits](experiments/browser-performance.md). Cooperative 2 ms/two-query budget; defer after 6 ms of preceding updates, alternate queue priority. Automated and browser checks recorded; extended comparison remains PERF2-CHECK |
| LW1-SPORT | Three original sports-car variants with vivid paint and faster bounded driving | [Implementation and checks](superpowers/plans/2026-10-21-sports-traffic.md), [provenance](../public/models/traffic/ATTRIBUTION.md). Target cruise 1.6× normal speed; traffic/turn constraints retained. Nearby variant visibility remains LW1-SPORT-CHECK |
| UI-COPY | Simplified picker, pause/settings labels and responsive launch dock | Autocomplete, launch, throttle ramping, pause/settings and responsive layouts verified locally. [Interface design](superpowers/specs/2026-10-20-interface-redesign.md), [design system](../DESIGN.md) |
| UI-FIXES | Textured 3D drone preview with studio lighting, drag/keyboard rotation and reset | First draw gates loading; orientation retained. Normal/reduced-motion and disposal coverage recorded. [Interface design](superpowers/specs/2026-10-20-interface-redesign.md). Other regressions require UI-FIXES-CHECK |
| P1 | Wind presets, direction/gusts and rotor airflow texture | [Design](superpowers/specs/2026-10-05-wind-daylight-design.md), [verification](superpowers/plans/2026-10-05-wind-daylight.md) |
| P2 | Real-time Sun/Moon and pleasant default daylight | [Design and limits](superpowers/specs/2026-10-05-wind-daylight-design.md). Photographed Google shadows remain |
| Q4 | Corner minimap with heading, home guidance and trail | [Rendering assessment](audits/quick-wins-2026-10.md) |
| REC-VIDEO | Local flight video recording with provider credits | [Design](superpowers/specs/2026-10-04-flight-recording-design.md), [verification](superpowers/plans/2026-10-04-flight-recording.md). Provider-use permission remains a release caveat |
| F4 | Documentation of intentional 6 GiB cache plus view overflow | [README](../README.md) |

## Maintaining this roadmap

Capture each explicitly postponed idea and each undecided proposal here at the decision boundary. Preserve stable IDs; deduplicate aliases such as P6/LW4. Record the outcome, horizon/relative priority, decision status, dependency and source link. Keep technical research/specs in their existing documents. Update status after an actual decision or verified implementation; do not silently promote a proposal to approval, assign dates or start deferred work. Keep this index public-safe and free of private conversation/session artifacts.
