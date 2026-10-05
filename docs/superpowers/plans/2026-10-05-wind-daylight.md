# Wind and Daylight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement P1 configurable wind with perceptible cues and P2 location-correct real-time daylight with a pleasant default.

**Architecture:** Keep wind calculations dependency-free in core and sample them in the existing 500 Hz loop. Pass environment inputs explicitly from the session to Cesium; one renderer state drives sky, celestial visibility, lighting and exposure. Extend existing settings and telemetry rather than adding another state pipeline.

**Tech Stack:** TypeScript, React, Zustand, CesiumJS 1.139.1, Vitest, existing browser tooling. No new dependencies or services.

**Spec:** [Approved wind and daylight design](../specs/2026-10-05-wind-daylight-design.md).

## Global Constraints

- Light default: speed 1.5 m/s, gust strength 0.35 m/s, direction approximately 233 degrees; Calm 0/0; Breezy 4/1. Presets preserve direction.
- Speed 0–8 m/s; direction normalized to [0, 360), meteorological from-direction; gust strength 0–2 m/s. Horizontal perturbation magnitude bounded by gust strength; vertical variation bounded by 10% of it.
- Legacy `gentleWind=false` migrates to Calm; enabled/missing migrates to Light unless explicit valid wind fields exist. Invalid fields fall back; finite fields clamp.
- Fixed 500 Hz, zero-allocation wind hot path; seeded reset reproducibility. Preserve aerodynamic coefficients, PID and crash-detection cadence.
- `realTimeOfDay` defaults false. Enabled follows machine UTC at selected location, including pause. Disabled freezes corrected solar noon on current local solar date; below 15 degrees solar elevation use hemisphere summer-solstice noon.
- Cesium ephemerides and supported public APIs only. No weather calls, credentials, private Cesium field mutation, battery or new collision system.
- Preserve 6 GiB cache, `skipLevelOfDetail=false`, globe hiding during incomplete tile loads, and disabled Google tile self-shadows.
- Pause freezes physics, gusts and clouds; reset repeats wind without changing preferences; celestial resources/listeners are session-owned and cleaned up.
- Each significant verified deliverable gets a local commit: inspect full staged diff/list/metadata, run a redacted secret scan and synthetic-secret self-test, use verified public author/noreply. Publishing requires separate approval.

## Review Focus

- RF1: Partial legacy settings, non-finite fields, blocked localStorage: migration is deterministic and in-memory environment settings remain usable (T1).
- RF2: Settings changes while paused or reset after gusts: no cloud jump, stale wind cue or dependence on render FPS (T2/T3).
- RF3: UTC date boundaries, distant longitudes, poles and clock jumps: correct location time and pleasant fallback, never invalid light vectors (T4).
- RF4: Local sky at the 30 km FPV far plane: Sun/Moon visible above horizon, twilight continuous, photographed shadows not falsely claimed as relit (T5/T6).
- RF5: Repeated location changes, teardown, recording and pause: no duplicate callbacks, destroyed-viewer updates or lost video output (T5/T6).

---

### T1: Environment configuration and persistence

**Files:** Create `src/core/physics/WindConfig.ts`, `src/core/physics/__tests__/WindConfig.test.ts`; modify `src/core/physics/types.ts`, `src/core/physics/droneConfig.ts`, `src/store/SettingsPersistence.ts`, `src/store/settingsSlice.ts`; test `src/store/__tests__/SettingsPersistence.test.ts`, create `src/store/__tests__/settingsSlice.test.ts` using existing store/test patterns.

**Interfaces:** Produce `WindConfig` with required numeric `windSpeed`, `windDirection`, `windGustStrength`; optional matching fields in `PhysicsConfig` retain source compatibility. Produce `resolveWindConfig(input: Partial<PhysicsConfig>): WindConfig`, `WIND_PRESETS` keyed `calm | light | breezy`, and `meanWindInto(config: WindConfig, out: Vector3): Vector3`. Produce `SettingsPersistence.readRealTimeOfDay(): boolean`, `writeRealTimeOfDay(enabled: boolean): void`, and store `realTimeOfDay` / `setRealTimeOfDay(enabled: boolean): void`, `setWindPreset(preset: 'calm' | 'light' | 'breezy'): void`; the store owns preset application so UI needs no core runtime import.

- [ ] Write migration/boundary tests; representative assertions:
  ```ts
  expect(resolveWindConfig({ gentleWind: false }).windSpeed).toBe(0);
  expect(resolveWindConfig({ windSpeed: 99, windDirection: 360, windGustStrength: -1 }))
    .toMatchObject({ windSpeed: 8, windDirection: 0, windGustStrength: 0 });
  expect(resolveWindConfig({ windSpeed: NaN }).windSpeed).toBe(1.5);
  expect(meanWindInto({ windSpeed: 4, windDirection: 0, windGustStrength: 0 }, out).y)
    .toBeCloseTo(-4);
  ```
  Also cover valid explicit fields with legacy false, negative direction wrap, missing/malformed saved data, boolean reload and unavailable storage (RF1).
- [ ] Run `npm test -- src/core/physics/__tests__/WindConfig.test.ts src/store/__tests__/SettingsPersistence.test.ts src/store/__tests__/settingsSlice.test.ts`; confirm failures are missing behavior, not broken fixtures.
- [ ] Implement the interfaces and validated settings read/write boundaries. Resolve legacy data before merging default numeric wind fields. Guard persistence failure for environment updates so state can still update; do not refactor unrelated persistence paths.
- [ ] Run the same tests and `npm run build`; require all pass.
- [ ] Perform public-safety checks and commit `feat: add validated environment settings`.

### T2: Fixed-step bounded wind

**Files:** Modify `src/core/physics/WindModel.ts`, `src/game/GameLoop.ts`; test `src/core/physics/__tests__/WindModel.test.ts`, `src/game/__tests__/GameLoop.test.ts` and existing physics/controller suites.

**Interfaces:** Consume T1 `WindConfig`, `resolveWindConfig`, `meanWindInto`. Extend `WindModel` with `constructor(config?: WindConfig, seed?: number)`, `setConfig(config: WindConfig): void`; preserve `updateInto(dt: number, out: Vector3): Vector3` and `reset(): void`. GameLoop samples once per fixed step and retains its last vector for T3 consumers.

- [ ] Write tests for Calm zero output, output identity, seed/reset replay and 120 seconds of bounded output:
  ```ts
  expect(model.updateInto(0.002, out)).toBe(out);
  expect(Math.hypot(out.x - mean.x, out.y - mean.y)).toBeLessThanOrEqual(1 + 1e-9);
  expect(Math.abs(out.z)).toBeLessThanOrEqual(0.1 + 1e-9);
  ```
  Compare identical fixed-step samples grouped into 30/60/120 FPS render frames; pause does not consume samples; reset repeats samples and preserves config. Calm retains existing air-relative drag. Pin RF2 here.
- [ ] Run `npm test -- src/core/physics/__tests__/WindModel.test.ts src/game/__tests__/GameLoop.test.ts`; require new behavioral failures.
- [ ] Implement seeded bounded targets with exponential smoothing and preallocated vectors. Configuration updates recalculate the mean; resets restore generator/filter state. Apply validated settings on launch/resume; remove runtime dependence on the obsolete boolean.
- [ ] Run focused tests plus `npm test -- src/core/physics src/core/flight-controller`; require passes and no calibrated-force changes.
- [ ] Perform public-safety checks and commit `feat: simulate configurable bounded wind`.

### T3: Wind controls, HUD and airflow sound

**Files:** Modify `src/ui/Settings/PhysicsSettings.tsx`, `src/ui/Settings/PhysicsSettings.module.css`, `src/ui/SimView/HUD.tsx`, `src/ui/SimView/HUD.module.css`, `src/store/droneSlice.ts`, `src/game/TelemetryPublisher.ts`, `src/game/GameLoop.ts`, `src/game/DroneAudio.ts`; test existing publisher/store/audio suites and `src/game/__tests__/GameLoop.test.ts`.

**Interfaces:** Consume T1 presets/config and T2 last wind sample. Extend `TelemetryData` with `windSpeed: number`, `windTravelHeading: number`; extend `maybePublish(state: DroneState, throttle: number, groundHeight: number, wind?: Vector3): boolean` with calm-compatible fallback. Extend `DroneAudio.update(rpms: readonly number[], volume: number, maxRpm?: number, airspeed?: number): void`; add airspeed last to preserve existing callers. Store telemetry remains scalar data; UI imports no core runtime or Cesium.

- [ ] Write cue tests: a north-to-south 4 m/s sample publishes travel heading 180 degrees; calm arrow is suppressed; existing heading wrap yields correct relative arrow at 359/1 degrees. Verify airflow increases with relative airspeed at unchanged RPM; motor frequency unchanged and volume 0 silences all output. Verify cue reset (RF2).
- [ ] Run `npm test -- src/game/__tests__/TelemetryPublisher.test.ts src/game/__tests__/DroneAudio.test.ts src/store/__tests__/droneSlice.test.ts src/game/__tests__/GameLoop.test.ts`; confirm new assertions fail.
- [ ] Replace the gentle-breeze checkbox with Calm/Light/Breezy and labeled speed/direction/gust controls using existing settings components. Reset restores Light/default direction. Add compact speed/airflow-travel indicator; use existing navigation heading. Feed magnitude of `velocity - wind` to audio; preserve RPM tone path and mute. Leave telemetry publication and crash cadence unchanged.
- [ ] Run focused tests and `npm run build`; require passes. Check accessible labels, keyboard input and narrow HUD visually in T6.
- [ ] Perform public-safety checks and commit `feat: expose wind controls and flight cues`.

### T4: Location-correct environment calculations

**Files:** Create `src/world/DaylightEnvironment.ts`, `src/world/__tests__/DaylightEnvironment.test.ts`.

**Interfaces:** Produce `selectPleasantDay(now: Date, longitude: number, latitude: number): Date`; `createDaylightState(): DaylightState`; `updateDaylightInto(time: Cesium.JulianDate, longitude: number, latitude: number, out: DaylightState): DaylightState`. `DaylightState` owns preallocated ECEF `sunDirection` / `moonDirection`, numeric `sunElevation`, `moonElevation` in radians, `moonIllumination`, `daylight`, `twilight`, `exposure`, `cloudBrightness`, `moonLightIntensity`. Direction vectors point from observer toward each body. Dimensionless weights/intensities are finite and bounded; phase derived from Sun/Moon geometry.

- [ ] Write known-date tests: equinox noon Sun high at equator and midnight below horizon; longitude 180/-180 and UTC rollover select the correct solar date; northern/southern winter poles fall back to summer noon with elevation at least 15 degrees. Solar transit must fall within five minutes of the selected noon. Compare against NOAA reference calculations, not an identical helper.
- [ ] Add phase/horizon tests: illumination bounded [0,1], Moon below horizon gives zero moonlight, full Moon stronger than new Moon, continuous twilight weights near the horizon. Advancing/jumping UTC produces finite normalized directions (RF3).
- [ ] Run `npm test -- src/world/__tests__/DaylightEnvironment.test.ts`; require failures from absent behavior.
- [ ] Implement corrected noon using NOAA equation-of-time selection, refine transit with Cesium elevation if necessary, then seasonal fallback. Use Cesium Simon1994 positions and public inertial-to-fixed transforms; use selected surface origin for topocentric elevation. Calculate smooth solar-elevation weights and conservative moonlight in this single state module.
- [ ] Run focused tests and `npm run build`; require passes.
- [ ] Perform public-safety checks and commit `feat: calculate location-correct daylight`.

### T5: Renderer, clouds and time controls

**Files:** Modify `src/world/CesiumManager.ts`, `src/world/DaylightSky.ts`, `src/world/TileLoader.ts`, `src/game/SimSession.ts`, `src/ui/Settings/FlightSettings.tsx`, `src/ui/Settings/PhysicsSettings.tsx`; test `src/world/__tests__/CesiumManager.test.ts`, `src/world/__tests__/TileLoader.test.ts`, `src/game/__tests__/SimSession.recording.test.ts`; create `src/world/__tests__/DaylightSky.test.ts` if new material/primitive logic needs direct tests.

**Interfaces:** Consume T1 mean wind/time preference and T4 state. Produce `CesiumManager.setEnvironmentOptions(realTimeOfDay: boolean, windEast: number, windNorth: number): void`, `setEnvironmentPaused(paused: boolean): void`; retain `setEnvironmentAnchor(longitude, latitude, groundHeight)` and teardown. Produce `TileLoader.setEnvironmentExposure(exposure: number): void` using the existing shader's public uniform API. DaylightSky owns its primitives/materials behind `createEnvironmentSky(longitude: number, latitude: number): EnvironmentSky`; `EnvironmentSky.update(state: DaylightState, cameraPosition: Cesium.Cartesian3): void`, `destroy(): void` and `primitives: readonly Cesium.Primitive[]`.

- [ ] Write tests with existing Cesium/event mocks: real-time clock refreshes through pause and clock jumps; pleasant mode stays frozen; mean cloud wind changes affect only future displacement; pause/resume adds no paused displacement. Session launch/resume applies options and end removes all owned listeners/primitives; repeat location switches without accumulating resources (RF2/RF3/RF5).
- [ ] Add exposure tests asserting shader uniform updates without shader rebuild and preserving cache/LOD/shadow constants. Sky-state tests assert continuous palette updates and no per-frame texture reconstruction (RF4).
- [ ] Run `npm test -- src/world/__tests__/CesiumManager.test.ts src/world/__tests__/TileLoader.test.ts src/game/__tests__/SimSession.recording.test.ts`; require new behavioral failures.
- [ ] Wire one preRender environment update to machine UTC or frozen pleasant instant, leaving physics timing separate. Use scene directional lighting: Sun in daytime, weak phase/horizon-weighted Moon at night. Update fog/cloud brightness and tile exposure from T4. Keep cloud displacement incremental, transforming ENU mean wind to ECEF and resetting the time baseline on pause/resume.
- [ ] Replace the fixed panorama with a camera-centered local sky using supported Cesium geometry/material/appearance APIs and uniform palette blending. Validate native Sun/Moon rendering against the local sky and 30 km frustum first; if clipped or occluded, use local celestial geometry with T4 directions and phase illumination through supported primitives/materials. Preserve correct angular size and horizon visibility; remove redundant native bodies when local geometry supplies them. Do not patch Cesium internals. Verify this rendering path early in-browser before completing integration.
- [ ] Add the persisted "Real time of day" switch in Flight Settings; Reset to Defaults restores false. Launch/resume applies state, pause freezes clouds, reset keeps preferences, end cleans owned resources while reused tile settings remain valid.
- [ ] Run focused tests, full `npm test` and `npm run build`; require passes.
- [ ] Perform public-safety checks and commit `feat: render synchronized daylight and wind-driven clouds`.

### T6: Browser acceptance, review and documentation

**Files:** Update `README.md`, this plan, the approved spec status, `docs/README.md`, `docs/experiments/simulator-improvements.md` only to reflect verified shipped behavior and limits. Product fixes remain in their owning files from T1–T5.

**Interfaces:** Consume the complete P1/P2 behavior; produce an accurate acceptance record with each check passed or blocked and the reason. No new public API.

- [ ] Run full tests/build, then start or reuse `npm run dev` at `http://localhost:5173`. Use available Playwright/Chrome/browser tools directly. Keep screenshots/videos/logs untracked.
- [ ] Verify load, autocomplete search → Fly Here, HUD, smooth key ramp/telemetry, ESC pause/resume and zero fatal console errors. Test Calm/Light/Breezy and custom direction; airflow sound/mute; persistence/reload and both reset behaviors. Compare coasting in calm with wind without changing drag. Verify keyboard controls and small viewport labels.
- [ ] With a controlled browser clock verify day, twilight, night and polar fallback at two distant longitudes; compare celestial directions to T4 expectations. Inspect Sun/Moon above/below horizon, lunar phase, sky occlusion, clouds, exposure and actual shadow behavior in a representative Google scene (RF4). Record photogrammetry limitations honestly; do not claim moving building shadows unless observed.
- [ ] Change settings while paused, resume after elapsed wall time, switch locations twice and verify no terrain/LOD glitch or listener accumulation. Record/play back a short flight; canvas includes environment and attribution with no recording regression (RF5).
- [ ] Request one independent whole-change review under the code-review skill; reproduce actionable findings, fix within scope, rerun affected checks. If browser/credentials prevent a check, report the exact limitation rather than marking it passed.
- [ ] Update product documentation and statuses with verified controls/units/daylight behavior, photographed-shadow limitations and remaining deferred IDs. Mark tasks complete only with evidence; keep F3/P3–P6 deferred.
- [ ] Inspect staged diff/list/metadata, run redacted scan plus synthetic self-test and commit the final verified fixes/docs. Report concise P1/P2 results and ask whether corrections are wanted or the session should conclude.

## Coverage and execution notes

Tests cover deterministic numerical behavior, saved-settings boundaries, observable cues and session lifecycle. Browser checks cover actual Cesium lighting, input, UI accessibility, streaming and video output; mocked renderer tests cannot establish visual correctness. Authentication/security role matrices and external weather failures are out of scope because these features add no service, account or network integration.

Recommended execution: native in the current session, followed by one independent review. T1–T5 share settings, session and renderer interfaces; sequential implementation keeps those contracts aligned. This plan awaits review before implementation.
