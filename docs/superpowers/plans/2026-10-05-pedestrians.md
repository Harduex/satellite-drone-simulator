# Pedestrians implementation plan

> Execute natively under existing authorization using executing-plans; review the completed change independently. Local commits only.

**Goal:** Bounded nearby walkers with real mapped paths, local CC0 assets and verified combined cost.
**Architecture:** Reuse source/cache and surface algorithms with explicit options; independent path/simulation/renderer/controller modules. Session owns exclusion unions, daylight, settings and lifecycle.
**Tech Stack:** Existing TypeScript, Cesium, vector-tile/pbf, Zustand, React, Vitest; no new runtime dependency.
**Spec:** [Nearby pedestrians](../specs/2026-10-05-pedestrians-design.md).

## Global constraints

Spec budgets apply. No 500 Hz loop changes, no road-offset paths, no inferred crossings, no backend, no publishing. Keep private probes and screenshots ignored. Public-safety staged inspection, redacted scanner and synthetic detection test precede every commit.

## Review focus

RF1: Missing crossing metadata and nearby road/rail spans must not admit crossings. RF2: New-area coverage must replenish walkers while removing old-area people. RF3: Late asset/source loads must not survive pause/disposal. RF4: Both actor types and drone remain in the exclusion union. RF5: Animation pauses without catching up and matches current night exposure.

## T1 — Safe mapped paths and reusable seams

**Files:** `src/pedestrians/PedestrianSource.ts`, `PedestrianGraph.ts`, `PedestrianTypes.ts`, `PedestrianConfig.ts`; modify `RoadSource.ts`, `TrafficTypes.ts`, `RoadGraph.ts`, `TrafficSurface.ts` narrowly.
**Interfaces:** Generic bounded source decoder consumes tile bytes/key/projection. Path graph produces surface edges with geometry/topology; surface queue accepts explicit work/spacing/probe limits. Existing car defaults stay unchanged.
**Skills:** code-standards, test-driven-development. **Reuse:** existing source stream/command validation, clipRoadLine, poseOnEdge, TrafficSurface. **Mirror:** traffic sibling naming/tests. **Assumption:** samples lack crossing tags, therefore road/rail geometry exclusions are necessary.

- [ ] Write/run failing fixtures for safe footway/pedestrian/explicit-foot path admission; restrictions, unknown fields, indoor/grade separation, road proximity/crossing, bounds and duplicate spans.
- [ ] Implement source decoder and path graph; preserve car defaults. Run focused source/graph/surface tests.

## T2 — Bounded walking

**Files:** `src/pedestrians/PedestrianSimulation.ts`, focused tests.
**Interfaces:** `setGraph`, `setCenter`, `step`, `reset`, `getFrames`; poses include stable model/color choice and traveled distance for animation.
**Skills:** code-standards, test-driven-development. **Reuse:** geometry poses and seeded arithmetic convention. **Mirror:** TrafficSimulation. **Assumption:** simple paths need no traffic reservations.

- [ ] Fail cap/radius, deterministic motion, edge transition/dead-end, overlap clearance, moving replacement and stationary height fixtures.
- [ ] Implement 10 Hz walking, bounded spawn attempts and progressive population. Pass focused tests.

## T3 — Local animated assets and renderer

**Files:** `public/models/pedestrians/`, attribution; `src/world/pedestrians/PedestrianRenderer.ts`, tests.
**Interfaces:** Render frames/alpha, setPaused, setEnvironmentExposure, getExclusions, dispose.
**Skills:** asset research, code-standards, test-driven-development; modeling capability if adapting assets. **Reuse:** model promises, interpolation, scene credits, exposure shader. **Mirror:** TrafficRenderer. **Assumption:** native CC0 clips work with Cesium; verify rather than assume.

- [ ] Package three licensed variants/texture; document exact bounds, axes, triangles and clips.
- [ ] Fail async pause/dispose, clothing tint isolation, exposure, animation distance and exclusions tests; implement and pass.

## T4 — Controller, settings and ownership

**Files:** `src/game/PedestrianController.ts`; `SimSession.ts`; store persistence/settings/diagnostics; FlightSettings/PhysicsSettings; sibling tests.
**Interfaces:** Controller start/setEnabled/pause/resume/reset/dispose and exposure; independent diagnostics snapshot. Session merges both primitive sets with existing exclusions before updating GameLoop.
**Skills:** code-standards, test-driven-development. **Reuse:** traffic cadence helper, coordinate conversions, recording credit capture, store switch/default patterns. **Mirror:** TrafficController, SimSession.traffic tests. **Assumption:** model exclusions must be unioned rather than overwritten.

- [ ] Fail moving refresh, lifecycle, stale requests, pause animation, setting persistence and exclusion union regressions.
- [ ] Implement with preUpdate surface work, generation ownership and selected environment instant. Pass targeted tests/build.

## T5 — Delivery and public-safe commit

**Skills:** verify-before-done, debugger as needed, code-review, auditing-repo-for-leaks. **Reuse:** actual Chrome hardware and existing diagnostics. **Assumption:** warmed paired routes can hold viewport/quality comparable.

- [ ] Browser gates P2–P5, mandatory search/HUD/keys/ESC/console, actual primitive exclusions/recording credits, moving area and lifecycle.
- [ ] Run full tests/build; independent final review and fixes. Record only verified evidence in spec/research/index/roadmap.
- [ ] Inspect complete staged diff/list/identity; redacted secret scan and synthetic self-test; local commit. Never push.

## Execution record

Research confirmed actual path subclasses and missing crossing tags in three representative nine-tile samples. Kenney source/license/geometry inspection is independent and read-only. Explicit autonomy supersedes repeated skill approval defaults. Native implementation remains in the clean existing branch to continue its unpushed work.
