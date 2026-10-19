# Simulator improvement proposals

Assessed 2026-10-05. Statuses distinguish locally implemented features from deferred proposals.

## Current work

| ID | Scope | Status |
| --- | --- | --- |
| P1 | Wind presets, direction, bounded gusts, wind indication and rotor airflow texture | [Detailed design](../superpowers/specs/2026-10-05-wind-daylight-design.md) implemented locally; independent wind hiss removed; airspeed subtly modulates running rotor texture; verification in the [plan](../superpowers/plans/2026-10-05-wind-daylight.md) |
| P2 | Real-time Sun/Moon, time-dependent environment, pleasant default daylight | Same design implemented locally; verification in the [plan](../superpowers/plans/2026-10-05-wind-daylight.md) |
| F4 | Tile-cache documentation | README corrected to the configured 6 GiB, plus 0.5 GiB view overflow. This budget is intentional. |

## Roadmap

Decision status for P3–P6, proposed R1–R5 and F3 is maintained only in [the product roadmap](../ROADMAP.md). This document retains implementation, collision research and crash-timing evidence.

## P3: collision feasibility

Investigated 2026-10-19 with installed CesiumJS 1.139.1, before the contact prototype. This establishes limitations of the geometry interface; it does not establish working rigid-body landings. The [prototype design](../superpowers/specs/2026-10-19-landing-contacts-design.md) records the original height-field approximation and its landing-only revision. The landing-only experiment removed lateral walls inferred from height jumps because canopy observations can falsely block open air. A subsequent bounded wall-contact trial restores those inferred sides with sparse probes and retained contact evidence; it does not restore dense-sweep coverage. Ground/roof support remains; preparation permits at most two new queries per render frame and stops further queries after 3 ms, although an individual synchronous query can exceed that time.

**P3-V1 - Landing-only checks.** A synthetic canopy reproduced a damaging inferred wall; the revised sampler passes beneath it without impact. New observation batches run at most 10 Hz airborne or 20 Hz near support. All 466 tests and the production build passed. Foreground Paris checks exercised recovery, smooth throttle, travel, turning and pause with no console errors. Temporary 60-frame timing aggregates averaged roughly 1-3 ms preparation in active flight versus 5-8.5 ms earlier; differing paths/loading prevent a controlled FPS comparison. Individual queries still reached about 30 ms. Ground/roof landing and takeoff are covered by automated game-loop tests; live gentle touchdowns and canopy clearance remain incompletely verified.

**P3-V2 - Ground settling and bounded wall trial.** Zero motor commands on an unchanged flat plane reproduced about 1.3 rad/s angular rocking after ten seconds. Separately refreshed footprint samples on a static slope reproduced about 1.8 rad/s even with multi-point response. Multi-point impulse resolution plus a coherent, revalidated resting plane reduce both regression cases below 0.001 rad/s. Missing geometry still expires support; takeoff remains possible. Wall regressions cover slow queries, direct pressure, side probes, stopped contacts, corner/departure discovery, source changes and broad fast approaches. Foreground Paris checks observed a side-contact event, Space recovery, throttle ramping, takeoff, travel, heading changes and pause, with no console errors. Ordinary resting rotation settled around 0.00001 rad/s. Wall-enabled preparation averaged roughly 2-4 ms/frame in active flight and 2-3 ms in retained-wall windows; individual query stalls remained. Paths/loading differed from prior trials, so this is not a controlled FPS comparison. Ground/wall corners may retain residual jitter. Sparse finite-obstacle and canopy limitations remain. The full suite passed 481 tests and the production build.

**P3-V3 - Contact-view clipping.** A synthetic facade at 0.5 m reproduced camera penetration because the coarse clear/solid bracket midpoint lay inside the obstacle. Clear-side contact placement and budgeted bracket bisection prevent that regression; slow-query tests retain the existing one-expensive/two-cheap query limit and converge to the last clear grid cell. A separate camera test showed near-plane corners extending beyond the body's 5 cm minimum half-extent. Aspect/FOV-dependent near clipping now keeps those corners within 4 cm, including portrait viewports at 140 degrees. All 487 tests and the production build passed. Foreground Paris checks exercised recovery, smooth throttle, takeoff, 103 m travel, heading changes, roof contact and pause, with no console errors; the close roof remained visible. This does not establish complete facade alignment or below-map prevention. Exported blackbox AGL is clamped at zero and does not identify contact planes, so it cannot distinguish penetration from missing geometry by itself. Late or absent observations and canopy/overhang ambiguities remain limits; conservative contacts can stop uncertain approaches early.

**P3-F1 — Baseline surface model could not describe full contacts.** `TerrainSampler.sampleAtPosition()` supplied one cached height per render frame. Runtime `DronePhysics.stepInto()` clamped to it and cleared all velocity components. Baseline tests reproduced roof height selection even above the drone, ground stopping, automatic Standard resets and nearby God-mode recovery. The four baseline sampler, physics, detector and game-loop suites passed: 28 tests. These results describe the baseline, not the subsequent contact prototype.

**P3-F2 — Supported height sampling is view-dependent.** The installed `Scene.sampleHeight()` documentation states that input height is ignored and sampling uses currently rendered globe/3D tiles. This cannot distinguish flying below a roof from flying above it. `sampleHeightMostDetailed()` remains a height query; it does not provide wall or underside contact geometry. See [Scene documentation](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html).

**P3-F3 — Live refinement changes support heights.** An isolated, untracked browser probe reused `TileLoader.loadPhotorealisticTiles()` over San Francisco's Ferry Building. The camera was fixed at longitude -122.3941, latitude 37.7953, ellipsoid height 320 m, looking straight down. At each of maximum screen-space errors 64 and 8, sample three fixed coordinates every 250 ms for 40 iterations, with paired input heights 0 and 1000 m. These are candidate locations, not surveyed geometry labels.

| Candidate | Longitude / latitude | Last height at SSE 64 / 8, m | Range during SSE 8 phase |
| --- | --- | --- | --- |
| Roof | -122.3937 / 37.7955 | -16.093 / -15.921 | 0.006 m |
| Plaza | -122.3946 / 37.7951 | -29.831 / -30.116 | 0.148 m |
| Edge vicinity | -122.3939 / 37.7954 | -30.241 / -30.098 | 0.059 m |

Heights use the ellipsoid datum, not height above ground. There were 240 primary samples with no undefined results; paired input-altitude differences stayed below 8 mm. Cold loading initially returned values around -85.8 km, outside the existing sampler's 10 km acceptance range. Tile-load events totaled 117 after the coarse phase and 984 after the detailed phase; no unload events occurred. Both phases ended with `tilesLoaded` true. This single stationary view is not a performance or geographic-coverage guarantee, and does not test a resting body, tile eviction or camera turns.

**P3-F4 — The installed arbitrary-ray interfaces are private.** `Scene.pickFromRay()`, its most-detailed variant, `Cesium3DTileset.pick()` and `Model3DTileContent.pick()` are marked `@private` in the installed source. The public tile-content interface exposes triangle counts, not vertex/index buffers. The documented `enableCollision` option supports camera collision/picking; it does not create a drone contact solver. No internal mesh extraction or private query workaround was adopted. See [tile-content API](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileContent.html) and [tileset API](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html).

**P3-F5 — Geometry access remains the gate.** A production design needs supported, bounded geometry queries or mesh access independent of the FPV view, then contact response and protection against support changes during refinement. Wall impacts, underside contacts, continuous collision detection and resting-body stability remain unverified. A physics engine alone does not supply the missing world geometry. Before adopting extracted or derived Google collision meshes, verify provider permission for that particular use; the [overlay policy](https://developers.google.com/maps/documentation/tile/policies#geodata-overlays-with-photorealistic-3d-tiles) restricts objects derived from the tiles and does not by itself settle transient collision processing.

## F3: frame-dependent crash timing

Reproduced timing evidence; decision status and correction scope: [F3 in the roadmap](../ROADMAP.md).

`TelemetryPublisher.maybePublish()` publishes every sixth render frame. `GameLoop.tick()` calls `CrashDetector.check()` only on those frames.
`CrashDetector` counts 30 checks for spawn grace, then three consecutive low-clearance checks before respawn.

For a drone that remains grounded from spawn:

| Render rate | Crash checks/second | Spawn grace | First crash/respawn |
| --- | --- | --- | --- |
| 10 FPS | 1.67 | 18 seconds | 19.8 seconds |
| 30 FPS | 5 | 6 seconds | 6.6 seconds |
| 60 FPS | 10 | 3 seconds | 3.3 seconds |
| 120 FPS | 20 | 1.5 seconds | 1.65 seconds |

Method: feed a grounded `createDefaultDroneState(0)` through the actual publisher and detector once per simulated render frame.
The first crash occurs on render frame 198. These values exclude loading and pause time.
Ground contact still executes in the 500 Hz physics loop; the discrepancy concerns crash declaration, flash and automatic respawn.
After grace expires, confirmation takes three checks: approximately 1.8 seconds at 10 FPS versus 0.3 seconds at 60 FPS.

Evidence: [publisher](../../src/game/TelemetryPublisher.ts), [detector](../../src/game/CrashDetector.ts), [integration](../../src/game/GameLoop.ts).

## Research references

- [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/): drag coefficients require experimental calibration.
- [Linear rotor-drag research](https://arxiv.org/abs/1712.02402): experimentally validated model class, not calibration of this simulator's quad.
- [Atmospheric quadrotor simulation](https://arxiv.org/abs/1902.01465): wind-field and rotor-model fidelity affect predicted flight.
- [Ground-effect modeling](https://arxiv.org/abs/2506.19424) and [wall-proximity modeling](https://arxiv.org/abs/2509.21496): proximity changes forces and control response.
- [Open-Meteo documentation](https://open-meteo.com/en/docs): modeled current conditions, altitude-specific wind and gust statistics.
- [Open-Meteo licensing](https://open-meteo.com/en/pricing): commercial service access and data attribution requirements.
