# Nearby pedestrians

**Date:** 2026-10-05
**Scope:** Simulated nearby walkers for FPV scenery alongside road traffic.
**Status:** Implementation authorized; delivery gates pending.

## TL;DR

Nearby people walk on mapped outdoor pedestrian lines, with local CC0 human models and looping walking animation. A separate 10 Hz simulation interpolates rendering and never enters flight physics. Initial ceilings are 80 people, 400 m active radius, 700 m preload and 800 directed edges. Existing source validation/cache machinery, geometry poses, surface preparation, daylight exposure, session lifecycle, settings and recording credits are reused. Missing crossing tags require conservative exclusion of path spans within 4 m of mapped roads or rails; coverage is deliberately incomplete. Independent caches and request limits bound pedestrian work when cars are enabled. No backend, paid feed, measured density, road-offset sidewalks, car interaction or real-person tracking is added. Actual browser placement, animation, lifecycle and combined hardware performance are delivery gates.

## Architecture

The flight session owns both scenery controllers. Source/cache code, surface validation and pose interpolation are shared; walkers retain independent populations and budgets. The footprint diagram is generated during implementation planning.

## Contract

`pedestriansEnabled` and `setPedestriansEnabled(boolean)` follow Road Traffic settings; persisted key `fpvsim_pedestrians`, default On, Reset to Defaults On. The switch reads **Pedestrians** with **Simulated walkers on mapped footpaths.** Off cancels work and releases models/paths; static cache remains session-bounded. Pause freezes simulation, animation and surface/source work; resume resets elapsed time. Reset rebuilds coverage; exit releases listeners, requests, cache, models and credits after recording finalization.

Admit only line features `class=path`, `subclass=footway|pedestrian`, or `subclass=path` with explicit `foot=yes|designated|permissive`. Exclude restricted/unknown access or foot values, construction, indoor, nonzero/unknown layer or level, bridges, tunnels, fords, steps, cycleways, corridors and platforms. Vehicle `oneway` is ignored for walkers. Missing access establishes a simulator candidate, not legal access permission. Polygon plazas are unsupported.

Reject an entire vertex-to-vertex span when it approaches any surface road/service/rail line within 4 m. Crossings are not inferred from the missing `footway=crossing` property. Pure geometry cannot guarantee all unmapped crossings or detect every roof; unsupported/uncertain sections stay empty. No connections are invented across path interiors. Paths use their mapped centerlines and both directions. Endpoint connections require compatible validated heights. Dead ends retire walkers; no visible reversal or teleportation.

| Budget | Initial limit |
| --- | --- |
| People / active radius / preload | 80 / 400 m / 700 m |
| Refresh movement / debounce | 150 m / 300 ms |
| Zoom / tiles per refresh / requests | 14 / 9 / 2 concurrent pedestrian requests |
| Cache | 16 tiles / 12 MiB accounted data |
| Payload / features / vertices | Existing 4 MiB / 10,000 / 100,000 admission limits |
| Graph | 800 directed edges; at most 10,000 nearby candidate spans |
| Surface work | Four samples/frame, cooperative 1 ms target; 8 m stations, 0.75 m lateral probes |
| Movement | 10 Hz; at most two steps/frame; 1.0–1.6 m/s |
| Animation | Walk clip driven by traveled distance; paused with the session |
| Models | Three local CC0 variants; at most 1,500 triangles each; shared small palette texture |

The shared source validates HTTPS provider host, bytes and commands before native geometry allocation. Pedestrians use a separate source instance and cache; both populations therefore permit at most six simultaneous tile requests. No raw third-party assets execute code. Native models use calibrated height/origin/heading, ordinary depth occlusion, disabled dynamic shadows and the current environment exposure. Clothing variation preserves skin/hair. Actual model primitives join the exclusion union for both scenery and drone height sampling.

Population is a seeded heuristic based on usable path length, capped at 80, with gradual replenishment and retirement. It is unrelated to measured pedestrian density. New-area paths replace old coverage; out-of-radius people render no longer. Diagnostics publish people, paths, cache/request counters, refreshes, simulation cost and surface work independently of cars.

## Resolution / flow

1. `SimSession` starts walkers independently of flight success and owns exposure, settings and reset callbacks.
2. Bounded transportation tiles yield safe candidate spans; stale/canceled generations cannot publish.
3. Cooperative `preUpdate` surface validation admits continuous plausible heights; moving models are excluded.
4. Fixed steps move people on admitted paths; interpolated poses and distance-driven animation display walking.
5. Pause/toggle/reset/exit preserve ownership and recording credits; late loads never resurrect objects.

## Key decisions

| ID | Decision | Why |
| --- | --- | --- |
| D1 | Separate 400 m / 80-person budget | Human detail matters nearby; this bounds model/animation cost alongside 150 cars. |
| D2 | Exclude road-adjacent/intersecting spans | Actual samples omit crossing tags; a 4 m buffer avoids inventing unsupported car interaction at the cost of some sidewalks. |
| D3 | Reuse bounded source and surface seams | Existing validation, cancellation and height checks avoid another provider or rendering framework. |
| D4 | Local Kenney Mini Characters | Verified CC0 source, seven-joint walk clips and sub-1,500-triangle candidates; stylized proportions accepted for scenery. |

## Rejected alternatives

| Option | Why rejected |
| --- | --- |
| Offset car roads into sidewalks | Invents geometry in buildings/traffic with no mapped evidence. |
| All `path` subclasses | Includes stairs, rail platforms, cycleways and indoor corridors. |
| Live tracking / new backend | Adds privacy/provider/service requirements unrelated to simulated scenery. |
| Full crowd engine | Adds dependencies and interactions beyond bounded path walking. |

## Failure modes

| When | Where | Result |
| --- | --- | --- |
| Source unavailable/malformed | Source controller | Warn, leave area empty; flight continues. |
| Missing/steep/suspicious surface | Surface queue | Retry boundedly, then reject; no terrain-only placement. |
| Paths disappear during refresh | Simulation | Retire affected walkers; preserve stable overlapping paths. |
| Load resolves after pause/off/reset/exit | Renderer generation | Destroy detached resource; no ghost model. |
| Storage denied | Settings | Session switch works; default applies next session. |
| Asset unavailable | Renderer | Bound failed-model retries; others continue. |

## Analogous feature & parity

`Road Traffic` search identifies source/cache, simulation, surface, renderer, controller, settings/defaults, diagnostics, exclusions and session recording credits. All are in scope for pedestrians with independent limits. Lane following/reservations, car demand and car materials remain car-specific. Wind, flight input/physics, map cache and aircraft remain unchanged.

## Delivery gates

P1: Actual source samples from Paris, London and San Francisco; classify usable fields and exclusions. P2: Watch scale, contact, animation, colors, occlusion and night exposure in the real browser. P3: Moving coverage, stale loads, toggle/pause/reset/exit, primitive exclusion and recorded attribution. P4: Run mandatory search/HUD/keyboard/ESC/console checks, focused regressions, full tests and build. P5: Paired warmed hardware routes with cars enabled; pedestrian addition targets median frame delta ≤2 ms, p95 delta ≤4 ms, simulation p95 ≤1 ms. Report preparation spikes separately. Reduce limits if gates fail; do not call unmeasured targets results.

## Out of scope

Crossings and car interactions remain LW6-X in [the roadmap](../../ROADMAP.md). No pedestrian collision forces, sound, live density, area wandering, automatic FPS scaling, stairs/bridge support or real tracking.

Source evidence: [OpenMapTiles schema](https://github.com/openmaptiles/openmaptiles/blob/master/layers/transportation/transportation.yaml), [provider](https://openfreemap.org/), [Kenney Mini Characters](https://kenney.nl/assets/mini-characters). Live z14 nine-tile samples centered on Paris Eiffel Tower, central London and central San Francisco contain 489/753/309 footway lines and 129/174/32 pedestrian lines respectively, before restrictions and road/surface exclusion. Samples expose foot/access/indoor/level/layer/brunnel but no crossing subtype. These counts describe the sampled tiles, not city coverage or accepted populations.
