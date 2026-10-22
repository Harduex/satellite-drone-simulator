# Bird encounters implementation plan

> Execute inline with test-first changes and one independent final review.

**Goal:** Continuous nearby bird encounters, solo flyers, swallows and visible drone avoidance.
**Architecture:** Keep flight behavior and population maintenance in pure TypeScript. The controller supplies a camera visibility predicate. The renderer owns assets, animation and exposure.
**Tech stack:** TypeScript, CesiumJS, Vitest, packaged animated glTF.
**Spec:** [Bird encounters](../specs/2026-10-22-bird-encounters-design.md).

## Execution state

Status: implementation and verification complete. Work stays on `master` in local commits; publishing requires separate approval.

## T1 — Bird population and flight behavior

Files: `src/birds/BirdTypes.ts`, `BirdConfig.ts`, `BirdSimulation.ts` and tests.

Interfaces: retain `spawnFlocks(center)` and `step(dt, dronePosition?)`;
add `maintainPopulation(center, isVisible)` with pure `Point3` values.
Birds carry independent encounter origins, solo membership and alarm state.

- [x] Write failing tests for 30 birds including swallows and three independent solo birds, distributed bearings, bounded population maintenance and visible target retention.
- [x] Replace bulk resets with bounded group turnover; retain nearby/visible groups and interpolate new birds from their own initial poses.
- [x] Write failing tests for graded avoidance, propagating alarms, solo isolation, recovery and bounded turns.
- [x] Implement species flight tuning, smooth avoidance and pause-independent pure steps. Verify affected simulation tests.

## T2 — Swallow asset and presentation

Files: swallow generator, `public/models/birds/swallow.glb`, attribution,
`src/world/birds/BirdRenderer.ts` and tests.

- [x] Retain and validate the original animated swallow and its reproducible generator. Optional replacement with a free, already animated web asset is tracked under BIRDS-ASSET in the roadmap.
- [x] Write failing renderer tests for swallow loading, flap/glide state, exposure and late-load disposal.
- [x] Drive animation from per-bird flight state; preserve daylight independence and pause behavior.

## T3 — Moving coverage and verification

Files: `src/game/BirdController.ts`, controller tests, design and documentation.

- [x] Write failing controller tests for gradual turnover across repeated travel and visible target retention.
- [x] Supply a conservative actual-camera visibility predicate and remove whole-population travel resets.
- [x] Run full tests and production build. Exercise foreground flight, turns, pause, visible birds and credits; verify sustained pursuit, species loading and avoidance automatically. Record runtime and performance limitations.
- [x] Run independent review, resolve confirmed defects and reconcile the design with implementation.
- [x] Inspect staged files/diffs/metadata and scan with a self-tested redacted scanner before each significant local commit.

## T4 — Public-release safety

- [x] Refresh the remote tracking ref read-only and enumerate all commits ahead of `origin/master`.
- [x] Scan unpushed history for secrets; inspect commit identities/messages, local paths, private context and every added asset's embedded metadata/license.
- [x] Report exact audited range, scanner self-test and limitations; do not push.

## Acceptance commands

| ID | Check |
| --- | --- |
| C1 | `node node_modules/vitest/vitest.mjs run --maxWorkers 4` exits 0 |
| C2 | `npm run build` exits 0 |
| C3 | `git diff --check` exits 0 |
| C4 | Self-tested Gitleaks scan of the unpushed range exits 0; manual metadata and asset inspection has no unresolved disclosure |

Browser observations are recorded here after execution; test counts alone do
not establish visibility, chase behavior or frame performance.

## Verification and disposition

- Simulation, controller and renderer changes are complete. The original animated swallow and generator remain. Optional web-model replacement is tracked under BIRDS-ASSET; it is not a release gate for the current implementation.
- Full suite: 81 files, 654 tests passed. Production build and whitespace checks passed. Windows sandbox temporary-file rename restrictions required verification outside the sandbox.
- Sustained pursuit test follows a solo bird for two minutes and more than 1.5 km, retaining its identity, escape state and the 30-bird population. Another regression verifies solo alarm isolation. Repeated travel tests cover 10 km of moving coverage and a 2 km climb. Camera tests use real tilted ECEF frusta at four headings.
- Browser checks exercised search, takeoff, 97 m horizontal travel, heading changes, pause and recovery. Earlier checks visually observed a flock and a solo bird; model admission confirmed all 30 loaded. Final runtime confirmed asset credits and no console errors. Species close-ups and a sustained manual chase were not performed; pursuit and species behavior are covered automatically.
- One foreground active-flight sample recorded frame median/p95/p99 of 16.2/24.4/29.0 ms over 600 intervals, with two above 33.3 ms and none above 50 ms. Bird CPU update mean/p95/max was 0.05/0.08/0.32 ms. Tile streaming was active. These are observations, not a controlled before/after benchmark or GPU measurements.
- Elevation requests returned provider denial; fallback terrain remained active. This limits location-height verification. Spawn recovery was needed where loaded surfaces disagreed with the fallback. No flight physics or spawn-height changes were made in this task.
- Independent final review found no confirmed correctness issues. Bird model attribution was absent on screen; the regression was reproduced, fixed through native Cesium model credits, and observed in the browser.
- Remote tracking was refreshed read-only. The audit base is `839e5772aca94d0e4843f8d9b71cffd94f558b82`. The ten existing outgoing commits use verified public noreply identities. All 304 unique historical blobs in those commit trees were inspected for local paths/private keys; the only path-pattern match already exists in the base documentation. Bird GLBs contain no external asset URIs or machine-local metadata. Asset sources and licenses are recorded with the models.
- Full-history Gitleaks scan: 130 commits, no leaks. A randomized synthetic token self-test produced the expected detection with redacted output. Staged content and commit metadata are checked again before committing; the completed outgoing range is rescanned afterward. Nothing is pushed.

## Review focus

Frustum margins; group retention while chasing; no per-frame loading churn;
turn-rate limits; no shared solo alarms; pause/resume phase continuity;
teleport coverage; packaged asset bounds, animation and attribution.
