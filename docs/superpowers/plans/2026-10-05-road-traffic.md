# Road Traffic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects that method. Steps use checkbox syntax for tracking.

**Goal:** Believable nearby simulated cars on real roads, with bounded cost and no flight-physics changes.

**Architecture:** A Cesium-independent traffic module adapts public vector roads and advances a bounded fleet. World adapters validate surfaces and render cars; a session-owned controller coordinates requests, updates and teardown. Reuse the existing viewer, coordinates, settings, clock and diagnostics.

**Tech Stack:** TypeScript, CesiumJS, React, Zustand, Vitest; proposed additional dependencies `@mapbox/vector-tile` and `pbf` for MVT decoding.

**Spec:** [Approved road traffic V1 design](../specs/2026-10-05-road-traffic-design.md).

**Status:** Approved for native execution; implementation in progress. Source probes, model selection and benchmark results are not yet available.

## Global constraints

- D3/D10: active radius 1,000 m; preload target 1,500 m; refresh after 300 m with 300 ms debounce; z14; at most 16 tiles per refresh and four concurrent requests.
- At most 150 cars, 2,500 directed edges, 32 decoded tiles and 24 MiB accounted retained road data. Partial coverage is valid; no hidden batches to exceed the refresh budget.
- Traffic simulation runs at 10 Hz outside the 500 Hz loop; at most two traffic steps per rendered frame, discard excess stall time and retain only fractional remainder. Pause/resume never catches up paused time.
- Surface processing uses at most eight samples per frame and yields between calls at a 2 ms slice target; single synchronous Cesium calls cannot be preempted.
- Preserve 6 GiB Google cache, LOD/globe fixes, audio, flight controls, crash cadence and recording behavior.
- D11: 2–3 free redistribution-compatible local low-poly car models, seeded body colors, calibrated dimensions/origins, shared assets; no runtime asset-host requests.
- F1: following includes connected edges and downstream junction clearance. F2: demand uses displayed environment time and longitude; no timezone API.
- Default-on persisted Road Traffic switch; no backend, credentials, live congestion, aircraft, weather, SUMO or drone/vehicle collisions.
- Remote payloads are bounded/untrusted; source failures never prevent flying. Code uses existing TypeScript/test conventions without unrelated refactors.
- Every significant verified deliverable receives a local commit after complete staged-diff/file/metadata review, redacted secret scan and synthetic-secret self-test. Use verified public/noreply identity; no publishing without explicit approval.

## Review focus

- RF1: buffer duplicates, missing direction/access fields, layer-separated crossings and dense/polar coverage do not create false roads or exceed limits (T1/T2).
- RF2: continuous high-speed drone movement cannot starve coverage via repeated debounce; stale responses cannot replace a newer session (T2/T6).
- RF3: leaders on the next edge, blocked exits, merges and persistent contention cannot produce overlap or permanently occupied junction reservations (T3).
- RF4: cars under the drone, resumed drone entities, bridge-deck ambiguity and surface-sample failures preserve ground-height isolation (T4/T6/T8).
- RF5: pause/toggle/reset/automatic respawn/location changes during fetch or model loading cannot create ghost cars or duplicate callbacks; recording retains credits (T5/T6/T8).

## Files and interfaces

New modules follow existing PascalCase class/module and `__tests__/*.test.ts` conventions. Module names here are planned additions, not existing helpers.

| Area | Files | Responsibility |
| --- | --- | --- |
| Data/calculations | `src/traffic/TrafficTypes.ts`, `TrafficConfig.ts`, `RoadSource.ts`, `RoadGraph.ts`, `TrafficSimulation.ts` | Plain data contracts, limits, public-source adapter/cache, normalized topology and fleet behavior |
| World | `src/world/traffic/TrafficSurface.ts`, `TrafficRenderer.ts` | Bounded surface validation, shared model rendering, exclusions and credits |
| Game | `src/game/TrafficController.ts` | Session-owned coverage/lifecycle and render-frame scheduling |
| Existing integration | `src/game/SimSession.ts`, `GameLoop.ts`; `src/store/SettingsPersistence.ts`, `settingsSlice.ts`, `diagnosticsSlice.ts`; `src/ui/Settings/FlightSettings.tsx`; `src/world/TerrainSampler.ts` only if exclusion access requires it | Settings, reset signal, exclusions, store-only diagnostics and lifecycle wiring |
| Assets | `public/models/traffic/`, `public/models/traffic/ATTRIBUTION.md` | Selected local models and provenance; model filenames fixed after T5 selection |

`TrafficTypes` defines `Point3` as finite ENU `{x,y,z}`, `GeoPoint` as `{longitude,latitude}`, `TileKey` as `{z,x,y}`, and `RoadSegment` with stable `id`, `points`, allowed `roadClass`, `oneway: -1|0|1`, `bridge`, normalized restriction and optional numeric `layer`. `RoadGraph` holds directed edges, compatible junctions and stable identities; each edge owns its lane trajectory and length. `VehicleFrame` contains id, model index, color index, previous/current ENU pose, speed and model dimensions. No Cesium or store type crosses into these calculations.

External contracts are narrow:

- `RoadSource.loadTiles(keys: readonly TileKey[], signal: AbortSignal): Promise<readonly RoadSegment[]>`; constructor consumes validated metadata, fetch adapter and `project(point: GeoPoint): Point3`. Source owns decoded cache; exposes `clear(): void` and scalar diagnostics.
- `buildRoadGraph(segments: readonly RoadSegment[], center: Point3): RoadGraph` enforces graph budget; `selectCoverageTiles(center: GeoPoint): readonly TileKey[]` returns at most 16 prioritized z14 keys.
- `TrafficSimulation.setGraph(graph: RoadGraph): void`, `setDemand(localSolarHour: number): void`, `step(dtSeconds: number): void`, `reset(center: Point3): void`, `getFrames(): readonly VehicleFrame[]`; constructor accepts seed and per-model dimensions. `demandMultiplier(hour: number): number` is a pure shared calculation.
- `TrafficSurface.prepare(graph: RoadGraph): void`, `processFrame(): void`, `getValidatedGraph(): RoadGraph`, `setExclusions(objects: readonly object[]): void`, `dispose(): void`.
- `TrafficRenderer.update(frames: readonly VehicleFrame[], alpha: number): void`, `getExclusions(): readonly object[]`, `dispose(): void`; async creation uses an abort signal/generation check and publishes exclusion changes only when objects change.
- `TrafficController` constructor consumes viewer, ENU frame, spawn, longitude, `readDronePosition(): Point3`, `readEnvironmentInstant(): Date`, an exclusion-change callback and scalar diagnostics callback. Methods: `start(): void`, `pause(): void`, `resume(): void`, `reset(): void`, `setEnabled(enabled: boolean): void`, `dispose(): void`.

Cache eviction never invalidates graph geometry still in use: graph ownership remains accounted and bounded; removed tiles/edges retire vehicles safely. These responsibilities cannot be bypassed by retaining unlimited geometry outside the source cache.

---

### T1 — Verify the source contract and bounded decoding

**Files:** Create `TrafficTypes.ts`, `TrafficConfig.ts`, `RoadSource.ts`, `src/traffic/__tests__/RoadSource.test.ts`; modify `package.json`/lockfile only after source validation. Add public-safe source evidence to the research document; keep browser/network captures untracked.

**Skills:** code-standards, deep-research for provider verification. **Reuse:** prior `rg` found no road adapter; reuse existing fetch/AbortController and Vitest patterns. **Mirror:** focused world/game tests. **Assumption:** hosted z14 tiles can be fetched in a browser without credentials; failure requires revising the source choice, not adding a backend silently.

- [ ] Check official hosted-use/attribution terms, discover the public TileJSON endpoint/template and validate browser CORS on representative urban/hill/bridge tiles. Record exact endpoint, encodings, missing fields, feature counts and payload sizes. Verify documented access normalization against actual samples.
- [ ] Establish initial admission limits: 4 MiB decoded response bytes per tile, 10,000 transportation features, 100,000 admitted geometry vertices per tile; reject larger payloads. Enforce the byte cap while reading the response, including missing/false Content-Length. Reject arbitrary metadata hosts/protocols; metadata comes only from the configured public provider. Validate representative tiles fit before adopting limits.
- [ ] Write failing tests for directions 1/-1/0 and omitted oneway, `access=false/no/private`, supported classes, polygons/tunnels/service exclusions, malformed MVT, non-finite geometry, oversized streaming responses and abort. Explicit unknown directions reject the feature; omitted documented defaults resolve to two-way.
- [ ] Run `npm test -- src/traffic/__tests__/RoadSource.test.ts`; require missing-behavior failures.
- [ ] Install only the two approved decoder libraries after compatibility/license inspection. Implement normalized data with bounded decoding; cache only admitted data and maintain 32-tile/24-MiB limits including buffers/coordinates/attributes. No full-tile GeoJSON retention or renderer dependency.
- [ ] Rerun focused tests and `npm run build`; require passes. Commit the verified source adapter and source evidence after public-safety checks.

### T2 — Bounded coverage and topology

**Files:** Create `RoadGraph.ts`, `src/traffic/__tests__/RoadGraph.test.ts`; extend `RoadSource` coverage helpers/tests.

**Interfaces:** Produce T1/T2 graph and coverage contracts from the interface inventory. **Skills:** code-standards. **Reuse/Mirror:** `CoordUtils` for the projection adapter, pure calculation tests beside modules. **Assumption:** topology can be conservatively reconstructed from clipped geometry; unknown crossings remain disconnected.

- [ ] Write failing fixtures for adjacent tile fragments, duplicated buffers, opposite directions, layer-separated crossings, valid endpoint/interior-node junctions, antimeridian wrapping, polar bounds and more than 2,500 edges. Assert no duplicate lane, correct permitted direction, no bridge/ground intersection and at most 16 selected tiles.
- [ ] Run `npm test -- src/traffic/__tests__/RoadGraph.test.ts src/traffic/__tests__/RoadSource.test.ts`; confirm behavioral failures.
- [ ] Implement stable geometry-derived identities without assuming global MVT IDs, 1 m compatible-vertex snapping, 1.6 m right-hand offsets and topology-aware directed connections. Rank by distance/class/connectivity. Rejected/truncated geometry has no traversable dangling shortcut.
- [ ] Implement cache eviction and coverage with four concurrent requests, at most one transient retry per tile within the same refresh admission set, and no periodic polling. Movement debounce starts after the 300 m trigger; continuing motion updates the center without postponing forever. Newest coverage wins via generation checks.
- [ ] Verify coverage/fetch scheduling with fake time: a moving drone gets timely updates, a stationary drone makes no polling requests, and canceled/late results cannot publish. Rerun focused tests/build and commit after safety checks.

### T3 — Fleet behavior and shared-time demand

**Files:** Create `TrafficSimulation.ts`, `src/traffic/__tests__/TrafficSimulation.test.ts`.

**Interfaces:** Consume normalized graph, seed and model dimensions; produce simulation/frame/demand contracts. **Skills:** code-standards. **Reuse/Mirror:** existing seeded wind/reset testing patterns; do not import WindModel or physics internals. **Assumption:** class speeds are heuristic scenery values, not measured legal limits.

- [ ] Write failing tests for cap/seed/reset replay, length/class demand, noon/night multipliers, opposite lanes, acceleration/braking bounds, continuous turns, dead ends and preservation on overlapping graph refresh.
- [ ] Pin RF3: leader just beyond an edge boundary limits follower speed; occupied exit blocks junction entry; merging requires bumper clearance; competing equal-priority approaches eventually progress; retired cars release reservations. Assert no overlap after a multi-step queue scenario.
- [ ] Run `npm test -- src/traffic/__tests__/TrafficSimulation.test.ts`; confirm new behavioral failures.
- [ ] Implement 10 Hz calculations, graph-aware braking lookahead, class/angle route choice, curvature approach limits and bounded fair reservations. Initial acceleration 2 m/s², braking 5 m/s² and desired gap `4 m + 1.5 s * speed`; tune only against visual/following acceptance. Baseline density weights per directed km: motorway 14, trunk 12, primary 10, secondary 8, tertiary 6, minor 4. Apply specified time multiplier; add/retire at most five cars per simulation second using safe peripheral gaps.
- [ ] Implement `demandMultiplier` exactly as the spec's hour table; wrap 24 hours and reject non-finite inputs to noon default. Demand changes do not teleport existing cars. Frame poses include model-specific bumper dimensions.
- [ ] Verify identical results at 30/60/120 render schedules using fixed traffic steps and smooth alpha in [0,1]. Run focused tests/build and commit verified movement.

### T4 — Prove road placement and exclusions

**Files:** Create `TrafficSurface.ts`, `src/world/traffic/__tests__/TrafficSurface.test.ts`; extend `TerrainSampler` tests only if its public exclusion boundary changes. Use a local ignored browser probe before full feature integration.

**Interfaces:** Consume normalized graph and actual scene; produce validated trajectories and placement contract. **Skills:** code-standards; debugger if a reproducible sample discrepancy occurs. **Reuse:** `CoordUtils`, `TerrainSampler.setExclusions`, existing Cesium mocks. **Mirror:** world tests; no private Cesium APIs. **Assumption:** surface sampling can reject uncertain routes without reliably classifying every roof.

- [ ] Write failing tests for 20–30 m subdivisions, preserved sharp vertices, station interpolation, missing surfaces, abrupt vertical jumps, bridge/ground layer separation, lateral-probe budget, eight-sample cap and 2 ms yielding. Invalid sections do not create a connection across the rejection.
- [ ] Run `npm test -- src/world/traffic/__tests__/TrafficSurface.test.ts`; require behavioral failures.
- [ ] Implement validation using loaded 3D surfaces; no terrain-only bridge fallback. Initial rejection limits are grade greater than 25% or adjacent station grade change greater than 20 percentage points; treat these as conservative heuristic filters. Suspicious ordinary-road samples get at most two lateral probes within the shared budget. Leave uncertain sections empty.
- [ ] Run the browser probe on urban, hill and bridge/tunnel examples; verify the lane offset stays on visible roads, deck continuity and occlusion. Confirm the chosen exclusion objects actually remove sampled traffic geometry, rather than relying on mock/parent-collection behavior. Record public-safe findings; no sample files/keys in commits.
- [ ] If alignment is inadequate, stop expansion and revise the placement approach/spec with concrete evidence. If acceptable, run focused tests/build and commit validated placement.

### T5 — Select, package and render car variety

**Files:** Create `TrafficRenderer.ts`, `src/world/traffic/__tests__/TrafficRenderer.test.ts`, selected models and `public/models/traffic/ATTRIBUTION.md`.

**Interfaces:** Consume frame poses and model indices; produce renderer/exclusion contract and a manifest with local URL, body material names, dimensions, origin correction, license/source and model index. **Skills:** code-standards; research primary asset/license sources. **Reuse/Mirror:** existing Cesium resource lifecycle, promise/generation tests and recording credit mechanism. **Assumption:** chosen assets support permitted recoloring and local redistribution.

- [ ] Find 2–3 simple sedan/hatchback/SUV assets with clear license and modification/redistribution rights. Prefer CC0. Review actual geometry/materials: initial limits per model 5,000 triangles, four materials and one texture at most 512×512; prefer texture-free models. Package provenance/license before model import. If suitable assets cannot be found, report the asset issue rather than substitute GTA/proprietary files.
- [ ] Write failing tests for stable model/color choices, per-model dimensions, body-only recoloring, interpolation through heading wrap, correct exclusions, normal depth test, disabled shadows, async load cancellation and dispose twice. Assert disposed loads cannot add primitives.
- [ ] Run `npm test -- src/world/traffic/__tests__/TrafficRenderer.test.ts`; confirm behavioral failures.
- [ ] Implement ordinary Cesium model primitives with shared asset/material resources where supported, calibrated contact height and local assets. Add/remove exclusions only on resource changes. Preserve actual source credits in scene/recording without introducing a second capture pipeline.
- [ ] Browser-check the three variants at FPV distance, recoloring, road contact/pitch, building occlusion and credits in downloaded recording. Verify model sharing behavior rather than assuming one model URL means one draw call. Run focused tests/build and commit assets/renderer after license and public-safety checks.

### T6 — Session controller, reset and exclusion integration

**Files:** Create `TrafficController.ts`, `src/game/__tests__/TrafficController.test.ts`, `src/game/__tests__/SimSession.traffic.test.ts`; modify `SimSession.ts`, `GameLoop.ts`, existing GameLoop tests.

**Interfaces:** Consume T1–T5 contracts; produce controller lifecycle. Add `GameLoop.onReset(callback: () => void): void` notification for public spawn reset/automatic respawn, and `setSceneExclusions(objects: readonly object[]): void` to rebuild the sampler's union with the current drone entity. Nearby god-mode recovery is not a spawn reset. Preserve one reset notification per event.

**Skills:** code-standards. **Reuse:** existing SimSession generation/exit ownership, GameLoop getters, preUpdate/preRender events and recording mocks. **Mirror:** `SimSession.recording.test.ts`; avoid broad session refactoring. **Assumption:** environment clock is updated before the controller reads it; verify callback ordering in the real viewer.

- [ ] Write failing RF2/RF4/RF5 tests: delayed fetch/model completion after exit, pause cancellation, resume without catch-up, two enable/disable cycles, explicit reset and auto-respawn, nearby god-mode recovery, location change, cache reuse and callback disposal. Assert current drone and environment exclusions survive fleet changes and every resume.
- [ ] Run `npm test -- src/game/__tests__/TrafficController.test.ts src/game/__tests__/SimSession.traffic.test.ts src/game/__tests__/GameLoop.test.ts`; confirm missing behavior.
- [ ] Implement the controller owned by SimSession, one frame callback outside physics, bounded step accumulation and time input from the existing selected viewer clock. Convert current drone position through existing coordinate utilities for coverage. Freeze all traffic work on pause; stale decode/surface/model results cannot publish after cancellation.
- [ ] Wire settings, reset notifications, exclusions, start/end/location paths and source-independent flight launch. No unhandled promise rejection, duplicate listener or traffic failure blocking `FLYING`. Ensure deferred traffic startup cannot survive a failed/canceled flight start.
- [ ] Rerun focused tests/build, browser-check car-under-drone isolation and repeated pause/resume/reset, then commit verified integration.

### T7 — Settings and separate traffic diagnostics

**Files:** Modify `SettingsPersistence.ts`, `settingsSlice.ts`, `diagnosticsSlice.ts`, `FlightSettings.tsx`, existing settings tests; create/extend UI tests using existing React DOM/jsdom patterns. Modify the existing Reset to Defaults handler located by searching `reset` and `DEFAULT_` in settings UI before editing. No new test framework.

**Interfaces:** Produce spec settings APIs and `SettingsPersistence.readRoadTrafficEnabled(): boolean` / `writeRoadTrafficEnabled(enabled: boolean): void`; key `fpvsim_road_traffic`. Store diagnostics are scalar-only data with no traffic/Cesium imports. Existing Google tile counters are unchanged.

**Skills:** code-standards. **Reuse/Mirror:** real-time boolean persistence and existing FlightSettings switch styling. **Assumption:** paused-flight settings are applied immediately to traffic, unlike physical configuration applied only on resume.

- [ ] Write failing tests: missing/malformed/blocked storage defaults On, false persists/reloads, Reset to Defaults restores On, toggle Off stops traffic immediately while paused and re-enable does not advance paused vehicles. Assert accessible label `Road Traffic` and copy `Simulated cars on real roads.`
- [ ] Run targeted settings/controller tests; confirm behavioral failures.
- [ ] Implement settings using existing patterns; storage failure preserves session state. Wire a session-scoped subscription and clean it up. Publish spec traffic counters at bounded diagnostics cadence only when diagnostics are enabled; do not pollute Google tile request counts.
- [ ] Verify keyboard/screen-reader switch behavior, paused menu stacking, reload/default reset and diagnostics disable/cleanup. Run focused tests/build and commit verified controls.

### T8 — Browser acceptance and performance delivery gate

**Files:** Update `README.md`, research evidence, this plan's checked steps and the design's status only after verified delivery. Keep recordings, screenshots, logs and benchmark artifacts untracked; document aggregate reproducible findings only.

**Skills:** verify-before-done and relevant browser/debugging tools. **Reuse:** existing RenderDiagnostics and available Playwright/DevTools; use existing browser test facilities, not new framework infrastructure. **Assumption:** comparison can hold route, viewport and warmed tile state comparable.

- [ ] Run `npm test` and `npm run build`; require all pass and investigate any actual regression. These commands do not replace real browser evidence.
- [ ] Complete repository mandatory checks at `http://localhost:5173`: load without fatal errors, autocomplete/Fly Here, HUD/telemetry, smooth keyboard ramp, ESC pause/menu and zero TypeError/ReferenceError/Error messages. If gamepad code is touched, verify polling/preset/reconnect requirements; otherwise preserve that code.
- [ ] Compare three repeated Off/On runs of the same 60-second warmed route per urban, hilly and bridge/tunnel scene with equal viewport/quality/hardware. Capture frame intervals and traffic update/surface slices; report median and p95 deltas, counts and outliers. Exclude initial Google loading consistently, but report traffic preparation spikes separately rather than hide them.
- [ ] Require median frame-time delta ≤2 ms, p95 delta ≤4 ms and simulation p95 ≤1 ms, with all spatial/cache/request/sample limits intact. Reduce car cap first if needed and record actual validated cap; adjust render sharing/LOD next without changing flight behavior. Performance failure remains an incomplete delivery gate.
- [ ] Visually verify following across edges, merges/intersections, one-way direction, opposing separation, model variety/scale, occlusion, surface contact, empty unsupported bridges/tunnels and no teleportation/ghosts. Verify recorded output and car-under-drone ground-height isolation in the actual Cesium scene.
- [ ] Verify startup while source is unavailable, malformed tile handling, repeated toggle/pause/reset/respawn/location cycles, finite counters and no stale request/resource leaks. Confirm no traffic work appears in 500 Hz steps.
- [ ] Self-review complete diff against the approved spec, reconcile only measured delivery changes and mark completed steps. Perform required public-safety checks; commit verification/documentation locally. Report limitations and obtain publishing approval separately if requested.

## Execution handoff

Recommend native execution: tasks depend closely on source/graph/placement interfaces, and T1/T4 feasibility gates must inform later work. Use one focused independent final review where accuracy warrants it; no routine agent fan-out. The alternative is subagent-driven implementation/review per task if selected by the user. Native execution is authorized; local commits only, no pushing.
