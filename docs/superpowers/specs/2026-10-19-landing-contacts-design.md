# Landing and approximate building contacts

**Date:** 2026-10-19 (as-built prototype: 2026-10-19)
**Scope:** Ground/rooftop landing practice, approximate building impacts and manual recovery with the existing Cesium renderer.
**Status:** Original prototype snapshot; the bounded wall-contact trial below supersedes its sampling and retention contract. Full mesh collisions remain outside this approximation.

## Bounded wall-contact trial - 2026-10-19

Restore solid inferred side contacts for a playability trial; keep ground/roof
landings, damage and manual recovery. Do not add automatic side-impact recovery.
The landing-only section below records the preceding experiment, not current behavior.

Retain the strict two-new-query and 3 ms stop limits. Moving flight and retained
walls use refresh batches at most 20 Hz; alternate center-first and wall-first
priority so one slow center query cannot permanently starve wall discovery.
Project forward through the next wall-query scheduling interval and rotate center
and side lanes instead of scanning every 25 cm. Stationary airborne sampling stays
at most 10 Hz. Individual synchronous queries can still exceed 3 ms.

Retain a discovered wall independently of the reusable plane pool. Place it on
the clear side of its observation bracket, bounded by the current position for
late observations; an unknown midpoint may be inside the facade. Bisect coarse
brackets within the same query budget and update the contact as evidence improves.
Revalidate clear and solid observations even after motion stops;
expire it using the older observation time after 0.4 seconds. Release it on fresh
clear/unknown evidence, roof clearance, departure from the finite patch, or motion
away from the contact or turning toward a different heading. Ground support keeps
its separate short observation cache.

Resting support uses one coherent accepted plane, revalidated by fresh observations
and bounded by its finite patch. Partial footprint refreshes cannot alternate a
resting slope with flat patches. Missing geometry expires retention after 0.5 s.
The body contact solver distributes impulses across a support face with six fixed
iterations and a 5 mm contact margin, rather than pushing one switching corner.
The camera near plane scales with FOV and viewport aspect so all its corners
remain within 4 cm of the camera, inside the body's 5 cm minimum half-extent.

This is a sparse height-field trial, not restored dense-sweep coverage. Canopies
can again produce false side contacts; coarse brackets can stop the drone early
or late, and fast approaches or thin finite obstacles can be missed. These limits
must be assessed alongside foreground timing before judging playability.

## Landing-only revision — 2026-10-19

Keep ground/roof support, landing friction, impact damage and manual recovery.
Remove height-inferred vertical walls: a canopy and a solid building column can
return the same height, so those observations cannot establish a lateral impact.
Building sides and uncertain side obstacles are pass-through. Support sampling
still cannot describe the ground below an overhead canopy or roof.

Preparation makes at most two new height queries per render frame, stopping
further queries after 3 ms elapsed. One synchronous query may exceed that time;
this is a query-demand limit, not a hard frame-time guarantee. Airborne travel
samples the center only, with new observation batches at most every 100 ms.
Near support, batches run at most every 50 ms; cache and amortize footprint observations;
query the projected endpoint for fast movement without inventing support in the
unobserved gap. Reuse recent nearby finite support between batches without
extending it into unknown space. No dense corridor or side-lane sweep remains. Fast landings with
unavailable observations can miss support; uninterrupted flight takes priority.

The remaining sections document the original prototype and its historical checks.

## TL;DR

Keep Cesium, Google tiles and the custom 500 Hz flight model. Extend public height sampling to describe a small landing footprint and detect abrupt surface rises along the traveled path. Resolve supported contacts before penetration, preserving incoming velocity for impact classification instead of moving the drone onto a building roof. Gentle touchdowns permit resting and takeoff; hard contacts bounce, slide or tumble within the limits of the sampled surface model. Standard mode disables motors after a severe impact; God mode keeps the same contacts without damage. Space repairs and place the drone airborne near the impact using the existing recovery behavior with stronger validation. Tile-loading corrections never count as damaging impacts. Missing geometry does not pause flight or create a contact; a missing texture does not disable a contact when geometry is available. This is a height-field approximation: roofs have solid columns beneath them, so underpasses, overhangs and true facade geometry remain outside its contract.

## Architecture

```text
┌──────────────────────────────────────────────────────────┐
│ WORLD                                                    │
│ reused: Cesium + TileLoader + Google tiles               │
│ (NEW): TerrainSampler neighborhood/validity data         │
└─────────────────────────────┬────────────────────────────┘
                              │ supplies observations to
                              │ [TS]
                              ▼
┌──────────────────────────────────────────────────────────┐
│ CORE / GAME                                              │
│ reused: flight forces, PID, fixed 500 Hz loop            │
│ (NEW): pure SurfaceContact calculations                  │
│ (NEW): impact/support/damage in CrashDetector + GameLoop │
│ (NEW): SimSession.recover(); reused: reset() + hooks     │
└─────────────────────────────┬────────────────────────────┘
                              │ publishes status to
                              │ [Zustand]
                              ▼
┌──────────────────────────────────────────────────────────┐
│ STORE / UI                                               │
│ (NEW): transient contact/damage/coverage in droneSlice   │
│ (NEW): Space shortcut + passive status + home restart   │
│ reused: SimView, CrashFlash, PauseMenu, God mode setting │
└──────────────────────────────────────────────────────────┘
```

All world sampling stays in `world/`; contact calculations stay dependency-free in `core/`.

## The contract

**C1 — Surface observations.** Extend the existing `TerrainSampler` rather than introducing a second tile loader. Supply reusable buffers of ENU surface observations with queried position, height, observation time/version and validity. Missing, non-finite, implausible, stale and out-of-coverage samples are distinguishable from a valid low surface. Preserve exclusions for the drone, clouds, traffic and pedestrians. Roof samples and globe-only fallback have distinct provenance; a globe sample cannot certify that a building column is empty. Geometry validity is independent of texture readiness: loaded geometry remains collidable while its appearance is incomplete.

**C2 — Contact geometry.** Approximate the drone using its configured physical dimensions and a small set of support points. Smooth height changes describe sloped ground; confirmed abrupt rises describe approximate vertical boundaries. Sweep the body's horizontal extent along its traveled path, not just its center or endpoint. Track unobserved gaps explicitly; resolve contacts only where valid observations establish an obstacle. Continue flight through unknown regions without claiming they are physically empty. Surface preparation is outside the 500 Hz loop; substeps consume a bounded, cached region. Sample budget, spacing and validity duration are implementation choices to establish in a geometry prototype and document in the plan.

**C3 — Contact events.** `SurfaceContact` returns reusable contact data: approximate contact point, incoming normal speed, touching and supported flags. The sampled plane supplies the normal, and the resolved `DroneState` supplies attitude/angular velocity. Sampling rejects enclosing surface revisions before they become impact events. Capture incoming speed before clamping or damping. Separate persistent support from a new impact; resting contact does not repeatedly trigger damage or flashes. All feedback and confirmation durations use simulation seconds, independent of HUD publication and render FPS.

**C4 — Landing and motion.** An upright, slow touchdown on a supported surface settles with friction and no artificial bounce. Thrust exceeding support allows immediate takeoff. Other contacts remove inward velocity and permit bounded rebound, tangential motion and contact torque; gravity continues after a wall hit. Support uses the body's lower footprint rather than its center. The solver must handle multiple contacts without adding energy or pushing a wall hit onto the roof. Numerical coefficients and gentle/severe thresholds are builder-selected initial tuning, centralized with units and validated through tests and browser flight; they are simulation parameters, not real damage calibration.

**C5 — Modes and damage.** Standard mode has a healthy or flight-disabled state. A severe motion-caused impact latches flight-disabled and commands zero motor power; existing motor lag allows spin-down while gravity/contact motion continues. Minor contacts remain flyable and can show brief impact feedback. God mode preserves its name and persisted setting, retains solid contacts and bypasses damage. Switching modes changes future damage handling; it does not repair an already-disabled drone. Recovery repairs it. Individual motor failures, cumulative component wear and deformation are excluded.

**C6 — Recovery.** `SimSession.recover()` runs on Space while a flight is active; ignore key repeat, modifiers, editable targets and UI controls that consume Space. Radio input priority applies to flight sticks and does not disable this shortcut. Space remains available without a detected impact, including in God mode. Ordinary impacts and geometry overlap show no recovery popup or button. A disabled drone shows a passive motors-disabled message with a Space hint. `Restart from home` remains in the pause menu, backed by existing `reset()`.

**C7 — Placement.** Anchor recovery to the first flight-disabling impact, preserving that anchor while the wreck falls. For a healthy drone, use the current contact or current position. Reuse existing nearby safe-position tracking, level attitude, preserve heading, clear momentum and reset flight-controller/physics transients. Keep existing airborne clearance as an initial default; this does not hold a stationary hover or add automatic throttle. Recovery teleports: validate the destination footprint and clearance against the height-field approximation, not a path from the wreck. An enclosed wreck cannot veto a clear destination. Fall back to a verified nearby safe position, then a revalidated starting position. If none is clear, remain disarmed in recovery and show that geometry is unavailable; do not create an unchecked spawn. Both recovery and home restart invoke existing session reset hooks for population/recording integrations.

## Resolution / flow

1. Sample and validate a bounded neighborhood through public Cesium APIs. Record revisions separately from drone motion so newly loaded roofs cannot create impact damage.
2. At each fixed substep, predict motion from the existing flight model and sweep the body against valid observations in the prepared surface region. Continue normal integration through unknown coverage; missing observations cannot invent a collision or a forced pause.
3. Resolve the earliest supported contact and retain its incoming motion for classification. Continue tangential/gravity motion and solve support contacts so wall hits do not teleport onto roofs.
4. Classify a new impact once per contact episode. Standard severe impacts latch motor disable; God mode receives physical response without damage. Publish UI state separately from physics timing.
5. While resting, retain the accepted support surface through small refinements and brief sample dropouts. Reconcile safe revisions gradually. Bound support retention and revalidate after movement or leaving the footprint. A large revision that encloses the drone does not generate damage or move it onto a roof; suppress that overlapping column until the drone exits it, keep flight active and make manual recovery discoverable.
6. For missing geometry, continue physics, motor/PID updates and flight timers. Resolve contacts with other valid surfaces where available; do not reset momentum, require a throttle change or pause the drone. Clipping through an unavailable obstacle is an explicit prototype limitation. Measure it rather than silently substituting a stale height from another location.
7. On manual recovery, verify placement, repair and reset transients, then return control airborne. Clear impact/support/coverage state on location changes and session disposal.

## Key decisions

Prototype tuning: 0.25 m sampling cells and a 0.2 s observation cache. Support preparation uses an 18-query/3 ms budget. Collision preparation checks the immediate leading edge first and sweeps up to 96 intervals and 40 reusable planes within the 3 ms frame time budget (allowing at most 4 queries when individual picks exceed the budget so slow Cesium offscreen picks cannot trigger a catch-up spiral). Outer footprint slope queries and high-altitude side-lane sweeps are skipped when airborne well clear of the ground. Lookahead covers the frame's horizontal travel plus the body margin, without a three-metre cutoff. All three sweep lanes retain fine spacing across the covered travel corridor near ground or during catch-up; a clear endpoint alone cannot certify that no finite building lies in between. Tile-backed stationary support survives a source dropout for at most 0.5 s. The collision body uses the configured arm/propeller extent and a fixed 0.05 m half-height. Rebound is 0.12 above 1.5 m/s incoming speed; support/wall friction coefficients are 0.7/0.1. Feedback begins at 2.5 m/s. Standard mode disables at 6 m/s, or at feedback-level impact with body tilt beyond 60 degrees. These values are prototype tuning.

Known limits: wall normals follow the sampled approach direction; corners and thin obstacles remain approximate. Bounded queries can miss coverage during fast travel or view changes, and missing coverage permits clipping. Recovery requires tile-backed observations across its destination footprint; unavailable geometry produces an explicit retry prompt. Shortcuts are owned by the game loop's input lifecycle alongside keyboard/radio polling, with `SimSession.recover()` as the UI entry point.

| ID | Decision | Why |
| --- | --- | --- |
| D1 | Keep Cesium and the custom flight model | Renderer migration affects camera, environment and population rendering; it is disproportionate to landing practice. No new runtime dependency is required for this approximation. |
| D2 | Prepare surface data per render frame; resolve motion at 500 Hz | Cesium queries do not belong in each 2 ms physics step. Explicit coverage prevents reusing one stale floor across unchecked movement. |
| D3 | Use simple healthy/disabled damage | This delivers severe-impact consequences without inventing uncalibrated per-component damage. Impact thresholds remain tunable. |
| D4 | Keep God mode and use manual nearby recovery | Both modes support landing practice; ordinary contact no longer forces a home or nearby teleport. |
| D5 | Treat geometry changes as a separate cause | The live probe observed centimeter-scale refinement and invalid cold-loading heights. Provider revisions do not establish pilot-caused impact energy. |
| D6 | Keep flying through missing geometry | A loading pause interrupts control and practice. Unknown geometry produces no new contact; available geometry stays collidable even if textures are missing. The prototype exposes possible clipping for flight feedback. |

## Rejected alternatives

| ID | Option | Why rejected |
| --- | --- | --- |
| A1 | Replace Cesium with Three.js and a different tile renderer | Requires a broad rendering migration before delivering landing practice. |
| A2 | Call private Cesium ray methods or extract internal mesh buffers | Couples collision correctness to unsupported engine internals. |
| A3 | Keep the current near-ground crash trigger and only remove respawn | A stationary gentle landing still qualifies as a crash; the altitude clamp destroys incoming impact motion and can move a drone onto a roof. |
| A4 | Add Rapier before resolving geometry | A contact engine does not provide the missing wall geometry and adds an integration boundary before the approximation is proven. |

## Failure modes

| ID | When | Where | Result |
| --- | --- | --- | --- |
| F1 | Height is absent, invalid or belongs to another location | Surface observation boundary | Mark unknown; continue flight without a new contact. Do not reuse an unrelated floor or claim verified clearance. |
| F2 | Surface jumps around a stationary drone | Revision/support reconciliation | Suppress damage and roof snapping; retain bounded valid support or suppress a newly overlapping column while permitting flight and manual recovery. |
| F3 | High speed or a long frame exceeds prepared coverage | Fixed-step integration | Sweep valid coverage and continue through unknown gaps within the existing catch-up limit. Record missed coverage; clipping is a prototype limitation. |
| F4 | A slope resembles a boundary or a wall normal is ambiguous | Contact classification | Use conservative blocking and manual recovery; never invent a precise facade or strong bounce from an unreliable normal. |
| F5 | An inverted body or edge contact cannot settle | Contact resolution | Continue bounded gravity/contact motion; preserve manual recovery and prevent non-finite state from advancing. |
| F6 | Recovery destination is unavailable or occupied | Session recovery | Try the ordered verified fallbacks; if all fail, remain in recovery with a visible reason. |
| F7 | Space is held, pressed in a text field or activates a button | UI shortcut boundary | Perform at most one intended action; do not steal text input or double-trigger button activation. |
| F8 | Pause, mode change or location change occurs during an impact | Session lifecycle | Pause freezes simulation timers; mode changes preserve latched damage; location change disposes old contact and recovery state. |

Verified position and the original impact anchor survive temporary geometry failures. A full session reset clears both.

## Analogous feature and parity

Existing analog: `GameLoop.recoverNearHit()` and `resetAtPosition()`, reached through `godMode`; `SimSession.reset()` delegates home restart. Search scope: `godMode`, `recoverNearHit`, `resetAtPosition`, `onReset` and session `reset()` across `src/`.

| Surface | In scope? | Reason |
| --- | --- | --- |
| `core/physics/DronePhysics.ts` and proposed `SurfaceContact.ts` | Yes | Preserve flight forces; replace hard-floor stopping with pure contact response. |
| `world/TerrainSampler.ts` | Yes | Reuse public sampling/exclusions and expose validity, provenance and neighborhood coverage. |
| `game/CrashDetector.ts` and `GameLoop.ts` | Yes | Replace low-clearance respawns with fixed-step impact classification, support, damage and nearby recovery. |
| `game/SimSession.ts` | Yes | Own shortcut lifecycle and service-level recovery/home restart; preserve reset integrations. |
| `store/droneSlice.ts` | Yes | Publish transient damage/contact/coverage status; never persist a crashed session. |
| `ui/SimView/SimView.tsx`, `CrashFlash.tsx`, `PauseMenu.tsx` and recovery prompt | Yes | Show relevant feedback and invoke session methods without Cesium operations in UI. |
| `ui/Settings/PhysicsSettings.tsx` | Yes | Keep God mode name and update its explanatory copy. |
| `SettingsPersistence` and radio presets/mappings | Reused | Preserve the existing God mode preference and custom controller mappings. |
| Recording and population reset listeners | Reused | Recovery/home restart must retain lifecycle parity with existing reset integration. |

## Out of scope

- True 3D mesh collisions, interiors, underpasses, overhangs and facade openings; see P3 in the [roadmap](../../ROADMAP.md).
- Renderer migration, private Cesium APIs, provider mesh extraction and new physics libraries.
- Survey-grade contact geometry, real-world damage calibration and individual component failures.
- Automatic hover, turtle mode and physical collision with traffic or pedestrians.

The geometry prototype must establish useful coverage and foreground performance before implementation expands to all modes and UI. Coverage checks include forward, sideways and backward travel with fixed FPV heading, turning away from the previous path and a landing footprint outside the visible camera image. Report sampling gaps and resulting clipping separately from working contacts. Ordinary flight never automatically pauses because of missing geometry. Repeated missed contacts in a fully loaded local area require revising the sampling approach before implementation expands; missing geometry is not relabeled clear to pass this gate. Report sampling cost and foreground flight performance against the same scene without the extra sampling, with a fixed query budget established in the plan.

Behavior acceptance includes controlled ground and roof landing/takeoff, horizontal travel and a turn, approximate wall contact without a roof teleport, severe-impact motor disable with continued falling, Space recovery, tile-refinement/load failures and radio-priority behavior. A height sample or actor counter alone does not prove these behaviors.
