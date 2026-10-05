# Road traffic V1

**Date:** 2026-10-05
**Scope:** Optional nearby visual road traffic for FPV free flight.
**Status:** Approved; implemented and verified locally, including the five-model/daylight follow-up. Independent review and repeated hardware performance gates passed; see the [implementation record](../plans/2026-10-05-road-traffic.md).

## TL;DR

Simple 3D cars move along real mapped roads within a bounded neighborhood of the drone. Browser-side OpenFreeMap/OpenMapTiles data supplies geometry and direction; car positions and demand are simulated, with no live congestion claims. The feature reuses Cesium, session lifecycle, coordinate conversion, settings and diagnostics. Traffic runs at 10 Hz with render interpolation outside the 500 Hz flight physics. Initial limits are a 1 km active radius, 1.5 km road preload target and 150 cars, subject to explicit tile, graph and work budgets. Two or three locally packaged low-poly car models provide realistic dimensions and varied body colors. Demand follows the simulator's displayed time; pause freezes movement and resume does not catch up. A persisted default-on Road Traffic toggle controls the entire feature. No backend, paid traffic API, drone collisions, aircraft or live weather enters this scope. Road alignment, browser source access, asset licensing and measured performance are delivery gates.

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ UI / STORE                                                   │
│ Road Traffic toggle + persisted boolean (NEW)                │
│ FlightSettings / SettingsPersistence (reused)                │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ GAME / TRAFFIC                                               │
│ Source adapter, bounded road graph, 10 Hz fleet (NEW)        │
│ SimSession lifecycle / reset integration (reused)            │
│ RenderDiagnostics baseline + traffic counters (reused / NEW) │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ WORLD / ASSETS                                               │
│ Surface validator + car renderer (NEW)                       │
│ 2-3 licensed recolorable low-poly models (NEW)               │
│ Cesium viewer / CoordUtils / TerrainSampler (reused)         │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ PROVIDER - external                                          │
│ OpenFreeMap / OpenMapTiles road tiles (external)             │
│ Public hosted data / attribution (external)                  │
└──────────────────────────────────────────────────────────────┘
```

This adds a bounded visual traffic subsystem, not a second world renderer or a flight-physics dependency.

`src/traffic/` owns source adaptation, normalized roads, graph and simulation. Its calculations are independent of Cesium; network actions are separated from those calculations. `src/world/traffic/` owns Cesium placement and rendering. `src/game/` integrates lifecycle under `SimSession`. Store modules contain settings/status data without traffic or Cesium imports, preserving existing architecture constraints. This new subsystem is necessary because the repository has no semantic road-network pipeline; it does not expand the zero-dependency `core/`.

## Contract

### Settings and clock

`SettingsSlice` gains `roadTrafficEnabled: boolean` and `setRoadTrafficEnabled(enabled: boolean)`. `SettingsPersistence` follows the existing boolean-setting pattern. Missing or invalid persisted values resolve to `true`; Reset to Defaults restores `true`. `FlightSettings` presents one Road Traffic toggle with a short explanation that cars are simulated. There are no public density/radius controls in V1.

Off cancels traffic work, removes cars and stops traffic requests, simulation and callbacks. On during a flight initializes coverage at the current drone position. Turning Off releases the active graph/fleet; the bounded static road cache survives within that session. End/dispose releases the cache.

**F2 — Demand uses the same UTC instant as the displayed environment.** `CesiumManager` already selects the viewer clock using `realTimeOfDay` or pleasant solar noon. Traffic reads this selected instant through the existing viewer/session boundary; it does not create a second astronomical clock. UTC plus longitude estimates local solar hour, not civil timezone. Default noon produces daytime demand; real-time mode produces a gradual generic daily demand pattern. Seasonal/polar daylight fallback uses its displayed instant. Pause freezes traffic; resume updates the demand target gradually without advancing paused vehicles.

Demand is an explicit heuristic, not a calibrated count. Use multiplier 0.35 at solar hours 00–05, 0.75 at 06, 1.25 at 08, 1.0 at 12, 1.25 at 17, 0.85 at 20 and 0.35 at 24, with linear interpolation and a baseline of 1.0 at noon. Road class and accepted drivable length determine the base fleet; the implementation plan defines its initial calibration. Population never exceeds the car cap and grows/shrinks gradually.

### Spatial and work limits — D3/D10

| Budget | Initial limit | Enforcement |
| --- | --- | --- |
| Active cars | 150 | Hard cap; reduce if performance acceptance fails |
| Active radius | 1,000 m horizontal distance | Centered on current drone ENU position |
| Road preload target | 1,500 m | Best effort within tile limits |
| Coverage movement trigger | 300 m | From last requested coverage center |
| Coverage debounce | 300 ms | Avoid repeated refresh on small movement |
| Vector zoom | z14 | Respect provider/Web Mercator bounds |
| Tiles per coverage refresh | 16 | Nearest useful tiles first; no chain of extra batches to fill the radius |
| Concurrent requests | 4 | Includes retries; canceled/stale work cannot publish |
| Decoded cache | 32 tiles and 24 MiB accounted retained data | Evict when either limit is exceeded; independent of Google cache |
| Directed graph edges | 2,500 | Prioritize proximity, road class and accepted connectivity |
| Surface stations | 20–30 m spacing on long spans | Preserve important bends and original vertices |
| Surface work/frame | At most 8 samples; target at most 2 ms | Yield between calls; a single Cesium call cannot be preempted |
| Movement | 10 Hz | Interpolate rendering; limit stall catch-up rather than accumulate unbounded work |

The 1.5 km radius is not guaranteed complete coverage. Latitude and road density change the number of required tiles. Prioritize active-radius tiles, then preload; absent or rejected roads remain empty. Antimeridian tile indices wrap; unsupported polar coverage returns no traffic. No periodic road polling is added. Cache accounting is a retained-data budget, not a promise about exact browser heap usage; decoding also needs byte/feature/vertex admission limits established before implementation.

### Source boundary — D1/D2/D4

Use HTTPS browser fetches to a configured OpenFreeMap TileJSON endpoint and its validated z14 tile template. The exact endpoint/template, CORS behavior and representative payloads are verified during source validation before runtime integration. Read MVT with `@mapbox/vector-tile` and `pbf`, two additional decoding dependencies; no MapLibre or backend is introduced.

Only the `transportation` line geometry is adapted. The internal `RoadSegment` contract contains a stable normalized identity, ENU polyline, road class, permitted direction, bridge flag, access restriction and layer/topology information where available. Graph identity does not assume MVT feature IDs are globally unique. Duplicate buffered geometry is removed and tile-boundary continuity is preserved within a small meter-scale tolerance. Crossing geometry alone does not establish a junction; uncertain grade separation is rejected conservatively.

Allowed classes are motorway, trunk, primary, secondary, tertiary and minor. Construction, paths, tracks, ferries, pedestrian/cycle-only geometry, service/parking roads, tunnels, restricted access and non-line geometry are excluded. Explicit `oneway=1/-1` controls permitted directions. The adapter handles documented access restriction encodings, including `false`, as well as `no/private` when supplied; absent access does not establish unrestricted real-world permission. Unknown class/direction values do not silently create usable roads.

Remote geometry is untrusted. Validate response size, finite coordinates, geometry type, counts and supported attribute values before graph admission. Provider metadata cannot authorize requests to arbitrary hosts or introduce credentials. Parse/source errors affect traffic only, never flight launch. Numeric budgets and provider allowlisting belong in the implementation plan; they cannot be omitted as an implementation shortcut.

OpenFreeMap publicly describes free keyless hosted use, commercial use and required attribution. Show OpenMapTiles and OpenStreetMap attribution while traffic is displayed and retain required credits in recording. OpenFreeMap credit is also retained. The exact attribution integration and direct-browser suitability are source-validation gates. [Provider](https://openfreemap.org/), [schema](https://openmaptiles.org/docs/schema/).

### Lanes and movement — D5/D6/F1

One virtual lane serves each permitted direction. Two-way roads use about 1.6 m centerline offsets on the right of travel; one-way trajectories follow their mapped carriageway near its centerline. V1 uses right-hand traffic globally, a stated limitation in left-hand jurisdictions. There is no lane changing or overtaking.

Nominal speeds are estimates: motorway 25–27, trunk 20–22, primary 15–17, secondary 12–14, tertiary 9–11 and minor 6–8 m/s. Seeded small variation changes drivers reproducibly. Curvature and junction approaches constrain actual speed so class speed is not carried through sharp turns. Acceleration and braking remain bounded.

**F1 — Following spans road boundaries.** The nearest leader is found along the selected forward trajectory, including adjoining edges and junction exit space within a braking-aware lookahead. Gap is measured bumper-to-bumper using model length; its baseline is 4 m plus speed-dependent headway. Spawning, reservations and merge entry require available clearance. Checking only the current edge is insufficient.

Junction movement prefers straight routes, weights other turns by angle/class and excludes U-turns. Lower-class roads yield to higher-class roads. A bounded reservation/conflict mechanism prevents visibly conflicting entry and preserves fair progress for waiting cars. Turns use continuous trajectories rather than instantaneous heading changes. Dead ends retire cars; vehicles do not reverse or jump to another road. True signal phases are absent.

Population uses accepted road length/class weights and the clock multiplier. Overlap across coverage refreshes preserves existing cars and normalized identities. New cars preferentially enter near the outer active area with clear gaps. Coverage replacement and retirements avoid visible teleportation; unavailable continuation causes controlled stopping/retirement, not travel on invalid geometry.

### Surface placement — D7

Only validated lane trajectories receive cars. Sample loaded Cesium 3D surfaces gradually at important vertices and subdivided stations; interpolate height and road slope between validated stations. Terrain-only fallback cannot establish a bridge deck or justify placing cars through buildings. Heading follows the road tangent, pitch follows longitudinal slope and roll remains zero. Each model's ground-contact origin is calibrated; clearance is approximately 0.1–0.2 m.

Reject missing, discontinuous, implausibly steep or suspicious building/roof samples. Limited lateral probes resolve some suspect ordinary-road samples within the same work budget. Surface sampling cannot reliably classify all roofs; uncertain sections remain empty instead of claiming guaranteed road recognition. Bridges require a continuous plausible deck and compatible connections; unsupported bridges remain empty. Tunnels never place cars above their buried geometry. Junction connectivity is admitted only for compatible topology and validated heights.

Traffic rendering is excluded from both road-placement sampling and drone `TerrainSampler` sampling. Reuse `setExclusions`, and update exclusions when render objects change. Prove actual Cesium exclusion semantics for the chosen rendering approach; parent-collection exclusion is not assumed. No vehicle collision forces or crash changes are added.

### Models and rendering — D11

Package 2–3 low-poly car models locally: sedan, hatchback and SUV, with a small realistic color palette. Reuse geometry/material resources across vehicles and recolor body materials without tinting windows or tires. Vehicle choice and color are seeded. Models have realistic dimensions, approximately 4.3 m long, 1.8 m wide and 1.5 m high for a representative car, with per-model dimensions used for clearance/following.

Selected assets are three CC0 cars from Kenney Car Kit, packaged locally with [provenance and calibrated dimensions](../../../public/models/traffic/ATTRIBUTION.md). Asset budgets remain subject to the fleet performance gate. Models do not depend on runtime asset-host requests or proprietary GTA assets.

**Approved follow-up — LW1-A:** The fleet now also includes original CC0, stylized Audi A3 Sportback and Mazda CX-5 representations. Published body dimensions set their scale; the shapes are approximate. One manifest supplies renderer assets and simulation following lengths. All five variants receive the same environment exposure used by the map, in addition to ordinary Cesium material lighting. Off/reset and late model loads preserve the current exposure. This follow-up keeps the existing fleet and work ceilings.

Cars use ordinary Cesium depth occlusion and no dynamic vehicle shadows. Buildings and terrain hide them normally. Rendering interpolates position and orientation without bypassing the 150-car/radius limits. Detailed interiors, animated wheels and vehicle sounds are deferred.

## Resolution / flow

1. `SimSession.startSession` establishes the existing viewer, ENU frame and flight resources. Enabled traffic initializes independently; traffic failure never blocks flying.
2. Nearby coverage obtains bounded road tiles, validates/adapts geometry and assembles the graph. Session/coverage generation checks discard stale results before publication.
3. Gradual surface validation admits usable lanes and connections. Only admitted trajectories support population and movement.
4. The 10 Hz simulation updates following, reservations and routes. Render interpolation displays smooth movement without adding traffic to the 500 Hz steps.
5. Pause freezes the fleet, cancels pending fetches and stops new coverage/decode/surface work. Resume continues the frozen fleet, resets its elapsed-time accumulator and restarts needed coverage without fast-forward.
6. User reset and automatic respawn rebuild coverage/fleet around spawn using eligible cached roads. Integration covers `SimSession.reset` and the existing automatic `GameLoop.reset` path without moving ownership out of `SimSession`.
7. Location change/end/dispose aborts requests, invalidates generations, releases graphs/cache/models, removes callbacks and clears scene references. Off stops traffic immediately; stale responses cannot resurrect it.

## Key decisions

| ID | Decision | Why |
| --- | --- | --- |
| D1/D2 | Public road geometry; simulated cars; two decoding libraries | Real geometry improves place-specific flight without live-feed credentials, paid products or a backend. |
| D3/D10 | Fixed spatial/request/graph limits; 150-car ceiling | Bounded work protects flight responsiveness; partial coverage is preferable to raising budgets silently. |
| D5/D6 | Approximate lanes and reservations at 10 Hz | Believable low-altitude movement without full road engineering or SUMO deployment. |
| D7 | Reject uncertain surfaces | Missing traffic is less misleading than floating cars, rooftop routes or false bridge connections. |
| D8 | Session-owned lifecycle and generation checks | Pause/location changes cannot leave requests or vehicles attached to old scenes. |
| D9 | Default-on persisted toggle | World activity is available immediately; one control disables all traffic cost. |
| D11 | 2–3 reused models and body colors | Recognizable variation without a large asset library or duplicated geometry per car. |
| F1/F2 | Cross-edge following and shared displayed clock | Segment boundaries do not break spacing; pleasant noon does not carry nighttime demand. |

## Rejected alternatives

| Option | Why rejected |
| --- | --- |
| Live Google/TomTom congestion in V1 | Adds access, billing and request-policy concerns before basic placement is proven. |
| Import the complete God's Eye View app | Duplicates our renderer/lifecycle and imports infrastructure unrelated to flying. |
| MapLibre or an Overpass-based pipeline | A second renderer is unnecessary; vector tiles already provide the selected bounded road source. |
| SUMO or a new simulation backend | Introduces deployment and scenario complexity beyond visual V1 traffic. |
| Always-on-top dots or a fixed 3 m elevation offset | Useful overview effects do not meet close-up car placement and occlusion requirements. |
| FPS-driven fleet scaling | Adds runtime policy complexity; first tune the fixed cap against measured targets. |

## Failure modes

| When | Where | Result |
| --- | --- | --- |
| CORS, timeout or HTTP failure | Source boundary | Partial/no traffic; one bounded transient retry, then wait for a legitimate refresh or re-enable |
| Malformed, oversized or unsupported payload | Decode/admission | Reject affected tile/features without blocking flight or exceeding retained budgets |
| Tile cap cannot cover the radius | Coverage | Nearest eligible roads receive traffic; outer coverage remains partial |
| Missing/ambiguous topology or surface | Graph/placement | Reject affected sections; no fabricated intersection or floating car |
| Destination closes or disappears | Movement | Controlled stop/retirement, no teleport to unrelated routes |
| Junction contention | Reservations | Ordered fair access, no permanently held reservations after retirement/reset |
| Pause/Off/reset races with async work | Lifecycle | Cancel/invalidate pending work; frozen or rebuilt fleet follows the selected lifecycle state |
| Asset missing or unsupported | Renderer | Affected models/cars are unavailable; flight continues and diagnostics report the failure |
| Performance target fails | Delivery gate | Lower cap first, then optimize rendering; do not sacrifice physics or existing fixes |

Flight state survives traffic failures. Only valid current-session bounded traffic data survives recoverable failures.

## Analogous feature and parity

The daylight/environment feature is the closest lifecycle/settings analog, identified by repository searches for `realTimeOfDay`, `setEnvironmentPaused`, `setEnvironmentAnchor` and `reset`.

| Existing surface | In scope? | Reason |
| --- | --- | --- |
| `settingsSlice`, `SettingsPersistence`, `FlightSettings` | Yes | Boolean persistence, defaults and paused-flight settings |
| `SimSession` start/pause/resume/reset/end | Yes | Common lifecycle owner; automatic respawn also needs coverage |
| `CesiumManager` selected viewer clock | Yes | Shared time input; no duplicate daylight clock |
| `CoordUtils`, `TerrainSampler` exclusions | Yes | Existing geographic conversion and isolation |
| `RenderDiagnostics` | Yes | Baseline comparison; traffic counters remain separate from Google requests |
| Environment primitives/lighting | No | Existing sun, moon and exposure remain intact |
| `core` physics/PID and 6 GiB Google cache | No | No traffic forces or cache-budget change |

Development counters cover cars, edges, cached tiles/accounted bytes, pending/failed requests, coverage refreshes, update time and pending/rejected/sampled surfaces. No user-facing diagnostics panel is added by this spec.

## Delivery gates and acceptance

**U5 — Source:** Verify hosted direct-browser access, exact endpoint/template, actual attribute encodings, payload admission limits and attribution for display/recording. Published schema alone is not a payload test.

**U6 — Alignment:** Validate a dense urban grid, hilly roads and a bridge/tunnel location. Unsupported geometry stays empty. Photograph-baked cars/shadows remain a known scenery limitation.

**U7 — Performance:** Compare the same route with traffic Off/On after Google tile warm-up. Targets are median frame-time increase at most 2 ms, p95 increase at most 4 ms and 10 Hz simulation p95 at most 1 ms. Record hardware/browser, fleet count, route, sampling method and surface-preparation spikes. These are acceptance targets, not measured results. Reduce the 150-car ceiling if it fails; document the validated cap.

**U8 — Isolation/lifecycle:** A car directly below the drone does not change its sampled ground height. Verify exclusion using actual browser/Cesium rendering, plus pause, toggle, reset, automatic respawn, location changes, teardown and stale responses. Complete the repository's mandatory browser acceptance checks after implementation.

**U9 — Assets:** Select 2–3 models with compatible licenses, recolorable body materials, calibrated origins/dimensions and validated fleet render cost. Record licenses before packaging.

Visual acceptance requires correct one-way travel, separated opposing lanes, stable following across edges, plausible continuous turns, no persistent vehicle overlap, proper occlusion and road contact, no tunnel traffic on the surface, no ghost cars and no visible route teleportation. Generic demand, global right-hand driving, incomplete coverage and unsupported bridges are explicitly disclosed limitations.

## Out of scope

- Live congestion, Google Routes traffic and real individual car positions.
- SUMO, lane counts/changes, overtaking and real signal phases.
- Jurisdiction-specific driving side, pedestrians and public transport.
- Drone/vehicle collision, new aerodynamic effects or crash-timing changes.
- Detailed interiors, animated wheels, vehicle audio and dynamic car shadows.
- Aircraft and live weather; these remain later separate tasks.
- Backend services, paid feeds and automatic FPS-driven population scaling.

Broader source findings and deferred priorities remain in [living-world research](../../experiments/living-world-research.md).
