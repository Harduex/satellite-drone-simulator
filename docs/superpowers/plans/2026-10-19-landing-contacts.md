# Landing contacts implementation plan

> For agentic workers: execute task-by-task with the executing-plans skill. This prototype used native execution and an independent final review.

**Goal:** Deliver the approved Cesium landing/contact prototype, preserving uninterrupted flight through missing geometry.
**Spec:** [Landing contacts](../specs/2026-10-19-landing-contacts-design.md).
**Execution:** Native implementation in the existing clean checkout on `codex/landing-prototype`; no renderer or dependency changes.

## Constraints and review focus

- Preserve 500 Hz flight integration and zero-allocation contact steps; sample only outside substeps.
- Distinguish provider revisions, missing geometry and physical impacts; never teleport onto a roof.
- Preserve custom radio mappings and priority; recovery remains available with a radio.
- Recovery validates its destination, not a path out of the wreck; reset hooks run exactly once.
- Test off-camera samples, fast travel, persistent support, mode changes after damage and keyboard repeat/editable targets.

## Tasks

### 1. Pure contact response and bounded world observations

- [x] Write failing `SurfaceContact` tests for gentle support/takeoff, damaging impact, wall sliding/falling, footprint attitude and unknown geometry.
- [x] Add `core/physics/SurfaceContact.ts`: reusable finite contact planes and a resolver accepting previous/predicted `DroneState`, timestep and physical dimensions/mass/inertia; produce contact severity and supported state.
- [x] Extend `DronePhysics.stepInto()` with an optional ground-resolution switch; keep its existing default for callers/tests and let the game contact solver own runtime contacts.
- [x] Extend `TerrainSampler` with explicit point observations; add `world/ContactSampler.ts` to prepare bounded floor/wall observations with public queries, sample provenance and no unknown-space collisions.
- [x] Run affected core/world tests and typecheck/build; verify live sampling/query budget before expanding.

Reuse: `TerrainSampler` coordinate conversion, exclusion lists, `types.ts` math helpers, existing Vitest suites. No new tile loader.

### 2. Impact lifecycle and manual recovery

- [x] Replace low-AGL `CrashDetector` behavior with motion-impact classification and a latched disabled state; test severe/soft contact, God mode and mode changes.
- [x] Wire contact preparation/resolution into `GameLoop` at the existing boundaries; cut motor commands after disable and preserve gravity/contact dynamics.
- [x] Add explicit nearby `recover()` with destination validation, impact anchoring, heading preservation, cleared transients and one reset notification; retain home `reset()`.
- [x] Update GameLoop tests to assert landings and manual recovery instead of automatic respawns.

Reuse: `recoverNearHit`, `resetAtPosition`, `onReset`, motor spin-down, gamepad and keyboard input readers. Sampling gaps never pause flight.

### 3. Controls, feedback and verification

- [x] Add transient contact/damage state to `droneSlice`, session recovery entry point and guarded Space shortcut.
- [x] Reuse SimView/PauseMenu styling for `Space · Recover`, surface-overlap feedback and home restart; update God mode explanatory copy.
- [x] Test shortcut guards and store/UI lifecycle; run complete tests and `npm run build`.
- [x] Browser-check search/startup, controlled takeoff/travel/turn, landing/takeoff, severe impact, recovery, pause and console. Record observed blockers explicitly.
- [x] Request one independent code review, fix material findings, update design/roadmap with actual prototype limits, and commit verified changes after staged public-safety checks.

## Execution rulings

- Work in the existing clean checkout on a dedicated feature branch so the configured local provider environment remains available. No worktree or dependency setup is needed for isolation from unrelated edits.
- Numerical contact/damage thresholds are prototype tuning in named constants with units, not real-world damage calibration.
- If a listed assumption conflicts with source or browser evidence, revise the design/plan before expanding the implementation.
