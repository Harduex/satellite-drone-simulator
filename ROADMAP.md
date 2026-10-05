# Product roadmap

Updated 2026-10-05. This roadmap preserves direction and postponed ideas. Horizons express sequence, not delivery dates; neither a roadmap entry nor a suggested priority authorizes implementation.

## Outcomes and constraints

- **Living world:** convincing nearby activity without compromising FPV control or frame time.
- **Flight realism:** believable forces, time and atmosphere with pleasant defaults and unlimited free play.
- **World choice:** preserve Google as default; explore separately licensed fallback and custom maps.
- Reuse Cesium, session ownership, settings, diagnostics and current APIs. Prefer free public data, local assets and browser operation; new paid feeds or backend infrastructure require a separate decision.

## Status and priority

**In progress** = authorized work underway. **Selected next** = preferred direction awaiting its own researched scope. **Deferred** = explicitly postponed. **Proposed** = discussed, undecided. **Implemented locally** = code exists locally; not a deployment claim. **Not selected** = recorded assessment recommends against current adoption.

Only the selected aircraft → weather sequence has user-established priority. Other rows are grouped by outcome, without invented delivery commitments.

## Now — complete the bounded traffic experience

| ID | Outcome / scope | Decision status | Dependency / completion gate |
| --- | --- | --- | --- |
| LW1 | Nearby cars on mapped roads with bounded simulation/render work and color variation | Implemented locally; final verification in progress | [Traffic design](docs/superpowers/specs/2026-10-05-road-traffic-design.md), [execution and performance record](docs/superpowers/plans/2026-10-05-road-traffic.md) |
| LW1-A | Add lightweight Audi A3 and Mazda CX-5 representations; align car appearance with scene daylight/night exposure | In progress; approved | Existing traffic asset/shader pipeline; asset provenance, day/night comparison and performance verification |

## Next — aircraft, then optional weather

| ID | Outcome / scope | Decision status | Dependency / next decision |
| --- | --- | --- | --- |
| LW3 | Nearby simple aircraft driven by public flight-position reports | Selected next; scope pending | After traffic. Verify free access, product-use permission, browser integration, freshness/coverage, distance cap and stale-data behavior before implementation |
| LW4 / P6 | Optional weather-driven atmosphere and wind for experimentation | Selected after LW3; deferred implementation | Reuse wind/daylight controls. Verify free-use terms, forecast resolution, failure fallback and choice of moderated versus actual conditions |

Aircraft is the selected part of LW3; vessels and transit remain separate undecided proposals. Provider research and constraints: [living-world research](docs/experiments/living-world-research.md).

## Later — flight realism and practice

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| P3 | True 3D collisions and impact-based landing/crash detection | Deferred | Reliable geometry for walls, overhangs and collision surfaces; distinct from sampled ground height |
| P4 | Battery discharge, voltage sag and current limits | Deferred; optional only | Must never limit default free play |
| P5 | Self-level flight, practice gates, timed challenges and flight-state replay | Deferred | Separate scope per mode; existing video recording does not provide flight-state replay |
| R1 | Calibrate drag, rotor response and flight envelope against real-flight data | Proposed | Suitable reference measurements; numerical consistency alone does not establish calibration |
| R2 | Propwash and descent thrust loss | Proposed | Validate rotor/inflow behavior and bounded handling |
| R3 | Ground effect and wall/building aerodynamics | Proposed | Reliable clearance and geometry; do not infer building-scale airflow from regional weather |
| R4 | Controller profiles per device | Proposed | Mapping identity, persistence and reconnect behavior |
| R5 | Graphics quality and memory presets | Proposed | Measured budgets across hardware; intentional 6 GiB cache remains the baseline |
| F3 | Make crash grace/confirmation independent of render FPS | Proposed; reproduced, fix not approved | Elapsed simulation time independent of HUD publication; retain terrain-sample protection and god-mode separation |

Evidence and detailed limits: [simulator improvement proposals](docs/experiments/simulator-improvements.md).

## Later — richer living-world simulation

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| LW2 | Use live congestion to influence simulated speeds and spacing | Proposed | LW1; lawful/free provider access, region/request budget and simulated-data labeling |
| LW2-G | Evaluate Google traffic categories as the LW2 input | Proposed; provider undecided | Evaluate Routes coverage, billing and allowed reuse; no scraping TrafficLayer colors or assuming individual-car positions |
| LW5 | Richer junction/demand behavior with SUMO | Proposed; undecided | Consider a prepared district only if lightweight traffic is inadequate; separate runtime is new infrastructure |
| LW1-D | Detailed car interiors, animated wheels and vehicle sounds | Deferred | Independent visual/audio budgets and optional controls; [traffic design](docs/superpowers/specs/2026-10-05-road-traffic-design.md) |
| LW3-VT | Public-data vessels or transit | Proposed; outside selected aircraft task | Feed-specific permission, freshness, locality and infrastructure feasibility |

Detailed research: [living-world sources and constraints](docs/experiments/living-world-research.md).

## Later — map packs and fallback rendering

| ID | Outcome / scope | Decision status | Dependency / constraint |
| --- | --- | --- | --- |
| MAP-D2/D3 | Optional local/offline map source and supported real/fictional map packs | Deferred brainstorming | Define metadata, units, axes, bounds, spawns, credits/license and supported formats; probes are not a shipped offline mode |
| MAP-B2/B3 | Import/storage and clean map-source lifecycle | Deferred brainstorming | Pack contract; quotas, persistence, progress/removal, app-shell offline behavior, resource teardown and Google preservation |
| MAP-B4/B5 | Coverage boundaries, collision contracts and larger-world chunking/LOD | Deferred brainstorming | Separate visual-height sampling from collision geometry; measured texture/memory budgets |
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

Map evidence: [offline/custom maps](docs/experiments/offline-maps.md). Rendering IDs are namespaced because the historical audit also uses R1–R6: [current assessment](docs/audits/quick-wins-2026-10.md), [archived proposals](docs/experiments/rendering-roadmap.md). Historical API/quota claims are superseded by the assessment.

## Implemented foundation

| ID | Outcome | Evidence |
| --- | --- | --- |
| P1 | Wind presets/direction/gusts and subtle rotor airflow texture without independent wind hiss | [Wind/daylight design](docs/superpowers/specs/2026-10-05-wind-daylight-design.md), [verification](docs/superpowers/plans/2026-10-05-wind-daylight.md) |
| P2 | Real-time Sun/Moon and pleasant default daylight | Same design/verification; photographed Google shadows remain a limitation |
| Q4 | Corner minimap with heading, home guidance and bounded trail | [Rendering assessment](docs/audits/quick-wins-2026-10.md) |
| F4 | Cache documentation matches intentional 6 GiB plus view overflow | [README](README.md) |

## Maintaining this roadmap

Capture each explicitly postponed idea and each undecided proposal here at the decision boundary. Preserve stable IDs; deduplicate aliases such as P6/LW4. Record the outcome, horizon/relative priority, decision status, dependency and source link. Keep technical research/specs in their existing documents. Update status after an actual decision or verified implementation; do not silently promote a proposal to approval, assign dates or start deferred work. Keep this index public-safe and free of private conversation/session artifacts.
