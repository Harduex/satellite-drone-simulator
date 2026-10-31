# Physics calibration P1 implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Execution is inline on master under repository instructions.

**Goal:** Make physics experiments reproducible and measurable, and offer Actual rates without changing existing handling.

**Architecture:** Development-only replay uses the existing controller, seeded wind and ping-pong physics buffers. The browser retains its existing telemetry and fixed-step loop. Actual rates extend rate configuration through an explicit opt-in, with separate axis settings.

**Tech stack:** TypeScript, Vitest, React, Node; existing Vite runtime loads development TypeScript for the calibration CLI. No new dependencies.

**Spec:** P1 contract below. This records the approved scope; it does not authorize coefficient tuning without measurement.

## P1 contract

- Replaying identical initial state, settings, per-step inputs and seed produces identical states. Runs start with fresh motor, controller, wind and propwash state.
- Export every completed physics step at 500Hz using JavaScript double precision and JSON round-trip precision. Include initial state, timing, units, axis order, effective config, seed, input and motor output; do not use the rounded Float32 browser logger.
- Identification can disable wind, ground contacts, ground effect, propwash, inflow and load sag through replay settings. Export effective settings. Replay is a development tool; it does not add browser-loop allocations.
- Validate independent force/sign invariants, numerical convergence and the actual GameLoop catch-up at 10/30/60/120 FPS, fractional frames, pauses and stalls.
- Every configurable physics parameter and fixed physical coefficient has units, source, calibration method, confidence and uncertainty notes. Distinguish manufacturer measurements, derived values and estimates.
- Actual rates have independent per-axis center sensitivity, maximum rate and expo. Missing model means the existing polynomial model. Switching models preserves both configurations; old saves retain their values and behavior.
- Produce a machine-readable report and raw replay JSON/CSV, with static measured-point errors, baseline deltas, deterministic replay, convergence and core timing. Label synthetic results and unavailable real-flight holdouts/browser measurements explicitly.
- Preserve 500Hz, 644g mass, 225mm diagonal geometry and current physical coefficients. No external dataset downloads, new dependencies or world changes.

## Review focus

- TC1: Reject NaN, non-unit quaternions, ambiguous input frames and invalid timing rather than silently exporting nulls/zeroes.
- TC2: Inputs, configs and emitted state snapshots must not alias mutable simulation buffers.
- TC3: Preserve legacy saved rates and malformed-storage fallback; round-trip Actual settings and model switching.
- TC4: Sample timestamps describe post-step state; one initial state plus N completed-step samples, no hidden decimation.
- TC5: Compare like-for-like synthetic runs; no real-flight fit, browser FPS or per-step tail-latency claim from aggregate timings.

## Tasks

### Task 1: Deterministic replay and physics validation

Files: `src/core/calibration/FlightReplay.ts`, replay tests, existing GameLoop tests.

Interface: `replayFlight(options)` accepts explicit per-step sticks or motors, initial state/config/rates/seed/effect controls and dt; returns metadata and full-precision snapshots. `replayToCsv(report)` exports all numerical sample fields.

- [x] Write failing tests: identical seeded runs, seed sensitivity, reset independence, precision round-trip, input validation, snapshot ownership, no-effects ballistic oracle and timestep convergence.
- [x] Implement using existing core APIs; no production physics changes.
- [x] Extend actual GameLoop FPS/stall tests and run affected suites.
- [x] Capture baseline replay before adding Actual rates.

### Task 2: Optional Actual rates

Files: rate types/default helpers, FlightModes/FlightController, persistence, existing controller settings, focused tests.

Interface: optional `RatesConfig.model` and `RatesConfig.actual` with roll/pitch/yaw center/max/expo; pure axis-rate evaluator returns deg/s before existing signs/smoothing.

- [x] Write failing tests for official curve reference values, center slope, endpoints, symmetry/monotonicity, default controller parity, axes and persistence compatibility.
- [x] Implement scalar curve evaluation and reuse existing settings controls. Add an explicit model selector and independent Actual sliders.
- [x] Run core/store/UI tests and build. Browser rate switching and Actual-rate flight verified; original Polynomial rates restored.

### Task 3: Provenance and automatic comparison report

Files: calibration data/provenance, `scripts/calibrate-physics.mjs`, package command, report tests, documentation index, README and R1 roadmap evidence.

Interface: `npm run calibrate -- --output=<ignored-directory> [--baseline=<baseline-directory>]`; JSON/CSV exports and report include config, source revision and machine/runtime context without secrets.

- [x] Test provenance coverage and comparison compatibility; reject mismatched experiment metadata.
- [x] Generate measured-point errors, synthetic maneuver summaries, baseline deltas, repeatability, convergence, timing percentiles and memory observations with limitations.
- [x] Correct README inertia to match code; document commands, axis mapping, report limits and remaining measurement requirements.
- [x] Run automatic report before/after; coefficients stay unchanged unless reliable holdouts prove improvement.

### Task 4: Review and verification

- [x] Run full tests/build, replay/report checks and live browser checks. Autocomplete/launch, keyboard ascent/travel/turn, pause/resume, Actual-rate flight and foreground diagnostics verified. Observed approximately 60 FPS; no pre-change browser comparison is available. Nonfatal Google provider warnings are recorded in the experiment document.
- [x] Independent final review of numerical, persistence and report contracts; address verified findings. Effective wind metadata and timestep-aligned convergence inputs are covered by regressions; imported baseline null/missing values are rejected.
- [x] Inspect staged diff/list/metadata, run redacted secret scanner plus synthetic detection self-test, then commit verified work locally on master. Never push.
