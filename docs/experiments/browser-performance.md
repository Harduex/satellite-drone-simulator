# Browser flight performance investigation

Assessed 2026-10-21 at commit `569ef10`, CesiumJS 1.139.1 / engine 23.0.1. Research only: no simulator implementation changes. Proposal status lives in [the roadmap](../ROADMAP.md#browser-flight-performance).

## Assessment

The strongest first target is synchronous surface preparation shared by flight contacts, cars and pedestrians. The population subsystems measurably reduce frame rate in a quiet, loaded view. Their surface queries also invoke offscreen rendering and synchronous GPU readback. Coordinate optional population work around flight before changing physics or replacing the renderer.

This establishes useful optimization targets, not a guaranteed FPS gain or regression-free implementation. There is no measured Liftoff comparison, hardware GPU trace, or complete controlled-flight benchmark in this investigation.

## Method and observations

Inspected the render lifecycle, fixed-step physics, input, contacts, terrain queries, tiles, population controllers/renderers, UI subscriptions, minimap, audio, recording and installed Cesium source. Cross-checked current primary documentation below and prior project measurements.

Browser observations used the supported in-app browser, a foreground 875 × 1004 CSS-pixel flight canvas with an 875 × 1004 backing buffer, Paris near the Eiffel Tower, minimap and stick overlay enabled, recording off. No physical-radio latency measurements were made. The existing diagnostic overlay reports roughly half-second averages and population snapshots about once per second. Numbers below are observations, not medians or percentiles from a trace.

| Observation | Reported frame rate / interval | Relevant context |
| --- | --- | --- |
| Development, paused | 60 FPS / 16.7 ms | Flight and population updates stopped; scene still renders |
| Development, population on | 35 FPS / 28.2 ms | Stationary after impact; 94 cars, 110 rendered people; 191 visible tiles; 662 MiB tile memory; no recent photoreal fetches, requests or processing |
| Development, population off | 59 FPS / 16.9 ms | Same resting camera, 191 visible tiles and 662 MiB; active flight loop; no recent photoreal fetches |
| Production, population on | 34 FPS / approximately 29.5 ms | Stationary after impact; 84 cars, 110 rendered people; 311 visible tiles; 589 MiB; no recent photoreal fetches |
| Production, population off | 57 FPS / 17.5 ms initially; later snapshots 58–60 FPS / 16.6–17.3 ms | Same resting camera after UI teardown; 596 MiB after additional refinement; no recent fetches in settled samples; not a paired route benchmark |

Development population-on observations bracketed the off run. Production used a separate origin and its own settings/cache, so development-versus-production numbers are not a build-mode comparison. The earlier development tab was closed before production observations. Disabling population tears down models, simulation and surface work together; these results cannot attribute the whole difference to any one component. Enabling it again also rebuilds surface admission, so that transition has preparation cost.

Development surface snapshots included traffic 3.40, 5.97, 7.16 and 6.69 ms, and pedestrian 3.33, 3.81, 4.74 and 3.16 ms. Several represent one query. Production samples also exceeded the 2 ms targets: traffic 2.27 ms and pedestrians 2.37 ms. These independently published snapshots must not be added as if they describe the same frame.

Search autocomplete, launch, HUD, short throttle ramp, recovery, horizontal displacement and heading changes were observed in development. The short flight reached 13.5 m AGL, about 6 m home distance and a changed heading, then ended in an impact. It does not establish sustained controlled flight, landing quality or a valid moving performance comparison. Nearby people were visually present; counters do not establish that all actors were visible. No error-level console entries were observed in the inspected development log.

A temporary Node 22.13.1 microbenchmark transpiled unchanged core modules with TypeScript. Each batch ran 500 PID, wind, physics, empty-plane contact and blackbox updates at 0.002 s, with fixed small stick inputs, resetting flight/controller state between batches. After 30 warm-up batches, 100 measured batches had median 0.281 ms and p95 0.334 ms per simulated second. Outputs remained finite. This excludes Cesium, real input, audio, store, collisions and browser scheduling; it supports measuring the core before rewriting it, not a browser frame-cost estimate. No benchmark infrastructure was added.

Baseline checks: 578 tests across 72 files pass; TypeScript and production build pass. The first sandboxed test attempt could not rename Vitest cache files; the ordinary suite passed outside that sandbox. Vite reports a bundle-size advisory, which does not establish an in-flight bottleneck.

## Findings

### PF1 — Independent surface budgets compete inside the frame

**Confidence: high for mechanism and population impact; incomplete attribution.**

[GameLoop](../../src/game/GameLoop.ts) advances contacts, input/controller/physics and camera in `scene.preUpdate`. [TrafficController](../../src/game/TrafficController.ts) and [PedestrianController](../../src/game/PedestrianController.ts) also run from `preUpdate`. Their 10 Hz simulation cadence does not limit surface preparation or model transforms to 10 Hz: both execute every render frame while enabled and active.

[ContactSampler](../../src/world/ContactSampler.ts) allows two new queries with a 3 ms admission target, with 10/20 Hz refresh scheduling and imminent-touchdown exceptions. [TrafficSurface](../../src/world/traffic/TrafficSurface.ts) independently admits up to eight traffic or sixteen pedestrian samples under each subsystem's 2 ms target. These are cooperative limits checked between synchronous calls. The nominal 3 + 2 + 2 ms targets are neither a shared budget nor a hard ceiling. One query can overrun them.

Installed engine `Source/Scene/Picking.js` traces `sampleHeight` → `pickFromRay` → `getRayIntersection`, which updates/executes scene commands in an offscreen view and reads the pick framebuffer/depth. `Source/Scene/PickDepth.js` calls `Context.readPixels`; `Source/Renderer/Context.js` invokes synchronous WebGL `readPixels`. Excluded hits can cause drill-pick retries. An exclusion list therefore does not imply free exclusion before rendering. MDN documents blocking readback costs in its [WebGL guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices).

Earlier evidence already recorded full traffic tick p95 of 9.44 ms and non-preemptible queries in the [traffic performance record](../superpowers/plans/2026-10-05-road-traffic.md). [Contact experiments](simulator-improvements.md#p3-collision-feasibility) recorded individual stalls around 30 ms. These historical measurements have different routes and conditions; they corroborate the mechanism rather than supply current percentiles.

### PF2 — Existing diagnostics hide the costs relevant to smoothness

**Confidence: high, source confirmed.**

[RenderDiagnostics](../../src/game/RenderDiagnostics.ts) publishes elapsed time divided by frame count. It has no frame-interval distribution, CPU phase breakdown, missed-refresh count or GPU duration. The controllers' `updateMs` wraps simulation steps only; it excludes surface queries, graph reconstruction, model transforms/loading and Cesium rendering. A displayed `0.00` therefore does not mean population costs nothing. Surface metrics are last-frame samples, not percentiles.

At 60 Hz the display interval is 16.67 ms; at 120 Hz it is 8.33 ms. Frame-time tails and time from input to displayed camera motion matter alongside average FPS. Chrome's [Performance reference](https://developer.chrome.com/docs/devtools/performance/reference) describes frame and main-thread inspection. A CPU timer around WebGL work can include waiting for earlier GPU work; it is not an isolated shader-cost measurement.

### PF3 — Rendering quality has substantial adjustable cost, but no measured gain yet

**Confidence: high for configuration; benefit unmeasured.**

[CesiumManager](../../src/world/CesiumManager.ts) sets render scale to `clamp(devicePixelRatio, 1, 1.5)` while browser-recommended resolution is enabled. At 1.5, pixel count is 2.25 times CSS resolution. The observed browser used scale 1, so supersampling does not explain this run's population difference. Installed Scene defaults to four MSAA samples when supported; the app does not override it. HDR defaults false in this engine: enabling an already-disabled HDR optimization would achieve nothing.

[TileLoader](../../src/world/TileLoader.ts) targets SSE 8, retains a 6 GiB tile cache with 512 MiB view overflow, enables foveation, disables sibling loading and LOD skipping, and disables tile shadows. Actor shadows are also disabled. Globally enabled shadows alone do not prove that a costly shadow pass exists in normal flight. Avoid promising a large gain from switching them off.

The observed 589–662 MiB tile usage was far below the cache allowance. Cache size is not an eager allocation, and lowering it can increase eviction/reloading. Cesium's [tileset API](https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html) explains quality/cache pressure; [widget resolution](https://cesium.com/learn/cesiumjs/ref-doc/CesiumWidget.html#resolutionScale) and [MSAA](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#msaaSamples) are supported controls. Quality changes need movement and collision-height checks because contact observations use loaded/rendered scene geometry.

### PF4 — Population allocation and graph reconstruction are real secondary targets

**Confidence: high for repeated work; timing impact unmeasured.**

Both renderers allocate desired-ID sets/arrays, interpolated pose objects and heading/pitch/roll objects each frame. Cars also allocate translation objects. `getExclusions()` constructs an array on every call; both surface controllers call it from sampling. The reference comparison used to cache merged exclusions consequently invalidates whenever a fresh renderer array is returned.

`TrafficSurface.getValidatedGraph()` rebuilds a map, pending-ID set, edge objects and filtered outgoing arrays. Controllers call it for actual graph updates and again just to read counts, including diagnostics. These are opportunities to preserve stable exclusions until membership changes, reuse render scratch buffers and expose cheap counts. Their source presence does not establish a GC bottleneck. Do not replace all models with new instancing infrastructure without a renderer profile and supported public API assessment.

Current caps are 300 cars and 110 people. The older repeated traffic gate exercised at most 149 cars, without the current combined pedestrian/contact scope. Its successful deltas do not certify today's full-cap flight workload.

### PF5 — Physics rate is separate from browser input/display latency

**Confidence: high for scheduling; perceived contribution unmeasured.**

The 500 Hz integration is fixed-step work executed in batches when Cesium updates. A 30 ms browser frame blocks new displayed motion even if approximately fifteen physics steps run afterward. Fifty-step/100 ms catch-up limits prevent unbounded stalls. Existing tests cover real-time gravity at multiple display rates, bounded catch-up, pause and radio polling.

[GamepadManager](../../src/core/input/GamepadManager.ts) reads the browser's available gamepad state during each substep. Five hundred reads do not guarantee five hundred fresh hardware samples or uniformly spaced real-time polls. The [Gamepad timestamp](https://developer.mozilla.org/en-US/docs/Web/API/Gamepad/timestamp) can help inspect delivery where supported. Preserve custom mappings and reconnect behavior.

[FPVCamera](../../src/camera/FPVCamera.ts) renders the latest completed physics state directly. Fixed-step quantization is below 2 ms; that is much smaller than the observed 17–30 ms display intervals. Interpolation could remove residual stepping after larger stalls are addressed, but conventional interpolation adds roughly one physics step of display latency. Never smooth the authoritative contact state or apply lagging camera filters by default.

### PF6 — UI and environmental work warrant bounded follow-up

**Confidence: high for mechanism; benefit unmeasured.**

[TelemetryPublisher](../../src/game/TelemetryPublisher.ts) publishes every sixth render frame, rather than every 100 ms: about 5 Hz at 30 FPS and 24 Hz at 144 FPS. Navigation publishes at 5 Hz. [MapController](../../src/ui/LocationPicker/MapController.ts) recenters the map and replaces the trail on each navigation update while expanded. Test collapsed versus expanded minimap before redesigning it; the existing map instance is already reused.

Environment updates recompute daylight and propagate exposure each render, even at fixed noon. Pedestrian exposure setters loop over models without the equality guard used by cars. These are plausible small reductions, not an explanation for the full observed gap. The aircraft preview already uses demand-driven rendering and is mounted in the paused view; it is not a continuously rotating flight renderer.

Recording introduces canvas composition and encoding only when started. It was off in these observations. Measure recording separately instead of blaming inactive capture.

## Recommended priority and limits

The undecided changes and their order are centralized under PERF IDs in [the roadmap](../ROADMAP.md#browser-flight-performance), alongside the existing R5 quality/memory proposal. These are research recommendations, not implementation approval.

The first implementation should retain the current physics/PID/input semantics and strict geometric admission. Prioritize contact queries; coordinate population preparation under a shared optional-work allowance, avoid running both queues indiscriminately, and defer scenery admission when flight consumes the frame. This may delay population appearance; it cannot guarantee a hard deadline while a single synchronous query remains non-preemptible. Test starvation/fairness and visible population as well as frame rate. Reuse validated surfaces with explicit coverage/lifetime invalidation, never extend cached contact patches into unobserved space.

Preserve Google/Cesium and the pure core initially. A physics worker or WASM conversion does not remove main-thread scene queries or GPU readback. Merely wrapping `sampleHeight` in a Promise does not make it asynchronous. `sampleHeightMostDetailed` changes refinement/waiting behavior; it is not evidence of a nonblocking replacement for continuous contacts. Increasing cache, enabling LOD skipping, reducing collision probes, disabling population permanently or lowering physics frequency are not justified first fixes.

## Verification requirements for a future change

Use the existing test suites and session lifecycle, not a new test framework. Before accepting an optimization, capture a production-build baseline and three paired runs of an identical route with identical settings, viewport, display refresh, hardware and population exposure. Separate cold loading, warmed stationary rendering, actual takeoff/travel/turns, landing/contact, pause, recording and a long travel/return run. Cover an urban view, hills and bridge surroundings. Keep raw local traces free of published credentials.

Collect frame-interval median/p95/p99, missed display intervals, long stalls, full contact/population phase durations, surface-call count/tails, actor load/transform time, tile processing, memory and eviction. State whether GPU timing is available. Existing traffic gates are relative checks, not a promise of smooth full flight. Prefer consistent 60 Hz on the measured reference setup first; a 120 Hz goal requires its own 8.33 ms budget and hardware validation.

Reject gains that change flight trajectories for the same fixed-step inputs, PID response, smooth keyboard ramping, radio mapping/reconnect, pause catch-up, ground/roof settling, wall retention/expiry, severe-impact disarm, God mode or recovery. Surface scheduling changes additionally need unknown/stale geometry, imminent touchdown, canopy and queue-starvation checks. Quality changes need turning/roof-edge shimmer, tile coverage, sampled support and recording dimensions. Actor changes need visible placement, counts, animation and exclusion correctness across reset, toggles and location changes. Settings must preserve saved preferences; restore temporary comparison toggles.

These are acceptance requirements, not a claim those future behaviors have passed. The current browser tool exposes UI/DOM/log inspection but no supported CPU/GPU trace capture or non-invasive subsystem switches. That limits causal isolation and percentile reporting. Full-cap performance, high-DPI behavior, physical-radio latency, repeatable sustained flight, recording overhead and other browsers remain unmeasured here. Production error-log inspection also returned no entries. Temporary population toggles were restored and the created flight tabs closed.
