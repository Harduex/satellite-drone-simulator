# AGENTS.md

## Rules
* This repository is public. Before every commit, inspect the complete staged diff, staged file list, and commit metadata for secrets, credentials, personal information, machine-local paths, and private conversation context. Run an available secret scanner with redacted output and verify its detection with a synthetic-secret self-test. Do not commit sensitive findings; resolve them first. Keep `.env`, local screenshots, logs, and session artifacts untracked. Record only project-relevant, public-safe instructions in this harness. Local commits are allowed when requested; pushing or publishing requires explicit approval.
* Use a verified public author identity and privacy-preserving commit email (such as GitHub's noreply address). Do not include personal contact details in commit metadata or messages.
* Commit each significant, verified change locally after the public-safety checks. Pushing or publishing still requires explicit approval.
* When reporting information to me, be extremely concise. Sacrifice grammar for the sake of concision and clarity.
* Use the environment's supported context compaction or handoff mechanism when needed; do not assume a manual compaction tool exists.

## Overview
* Browser FPV drone sim. Google 3D Tiles (CesiumJS), 500Hz custom physics, Web Gamepad API.

## Documentation Map
* [docs/ROADMAP.md](docs/ROADMAP.md) tracks outcomes, horizons, decision status and postponed ideas. Update it when an idea is deferred or its status changes; roadmap entries do not authorize implementation.
* Start with [docs/README.md](docs/README.md) for product references and experiment findings; follow [docs/AGENTS.md](docs/AGENTS.md) when editing documentation.
* Offline/custom-map evidence and deferred brainstorming: [docs/experiments/offline-maps.md](docs/experiments/offline-maps.md). Google remains the default; local probes do not constitute a shipped offline mode.

## Architecture & Constraints

* `core/`: Pure TS. Physics, PID, input. **ZERO** external deps.
* `world/`: CesiumJS rendering, tiles, terrain and scene environment.
* `camera/`: Physics → Cesium sync.
* `game/`: Session integration; 500Hz flight simulation, display-driven rendering, and 10Hz traffic/pedestrian updates. Coordinates core/world/camera/store and living-world modules.
* `traffic/`, `pedestrians/`: Mapped geometry, graph building and actor simulation. Vector-tile decoding uses `@mapbox/vector-tile` and `pbf`; Cesium actor rendering stays in `world/`.
* `store/`: Zustand state and preference persistence. May import core types, defaults and pure configuration helpers; no Cesium or rendering dependencies.
* `ui/`: React + store. `theme.css` for CSS custom properties. `theme.ts` for JS-only tokens (`colors`, `gradients`). Settings reuse core defaults and input helpers; `ServiceProvider.tsx` owns world-service wiring. Keep Cesium scene operations out of UI components.

## Tech Decisions & Physics Invariants

* **Physics:** Custom force model, Euler integrator @ 500Hz. Zero-alloc hot path: `stepInto()`/`updateInto()` write into pre-allocated buffers. GameLoop uses ping-pong double-buffer for DroneState.
* **Coords:** ENU (physics) → ECEF (render). Body: X=Right (Pitch), Y=Forward (Roll), Z=Up (Yaw).
* **PID:** Runs @ 500Hz. Simulation-tuned gains (not Betaflight GUI units); closed-loop test `FlightController.physics.test.ts` guards tracking/stop. Target rates negated (right-hand rule).
* **Motors:** Shared `MOTOR_LAYOUT` (`types.ts`). M1 = front-left CCW. Asymmetric spin-down (1.3x time constant). Default profile = representative 5" 6S (README calibration table): RPM = max·cmd^0.65, hover @ ~15% raw command. Axial-inflow thrust loss via `propellerPitch`. `Math.exp` alpha values cached by timestep and motor lag settings.
* **Drag:** Quadratic angular, direction-dependent translational (3x vertical downwash). Translational threshold uses `v3MagnitudeSq` (no sqrt).
* **Render:** CesiumJS. Globe hidden < 2km from spawn (separate `preRender` listener from cloud drift).
* **State:** Crash events flow via Zustand. `triggerCrashFlash` uses `clearTimeout` to prevent race conditions.
* **Camera:** FPVCamera pre-allocates `setView` options; exposes `getLastEcefPosition()` to avoid redundant `enuToEcef` calls.
* **Timing:** Fixed 500Hz input/controller/physics steps catch up across render frames. Catch-up limited to 100ms for stalls; fractional-step remainder retained. Radio hardware/browser sample delivery may be slower than polling.
* **View:** Horizontal FOV maintained across viewport aspect changes. Baseline 110° horizontal FOV, 25° camera tilt; saved overrides preserved until Reset to Defaults.

## Dev & Setup
* **Commands:** `npm run dev|build|test|test:watch|preview`
* **Env:** `.env` requires `VITE_GOOGLE_MAPS_API_KEY` (Maps JS, Places, Elevation) and `VITE_CESIUM_ION_ACCESS_TOKEN` (Google Photorealistic 3D Tiles, Cesium World Imagery).

## Controls
* **Keys:** W/S (Throttle), A/D (Yaw), Arrows (Pitch/Roll), ESC (Pause). Smooth stick ramping applied.
* **Gamepad:** Web Gamepad API auto-detects presets.

## Agents & Skills
* `agents.toml` is the `dotagents` dependency manifest; `agents.lock` is generated. Managed skills live in `.agents/skills`; `.claude/skills` links there. `code-standards` is a tracked local skill outside the manifest.
* **Skills:** `dotagents` (manager), `grill-me` (stress-test), `improve-codebase-architecture` (refactoring), `frontend-design` (UI/UX), `debugger` (local, scientific debugging), `code-standards` (local, code quality). Use the most specific applicable skill available in the session.
* **Browser tools:** `agents.toml` declares Playwright and Chrome DevTools; generated `.mcp.json` currently exposes Chrome DevTools. Configuration does not guarantee session availability. Inspect exposed tools and use an available supported browser API; do not improvise a replacement protocol.

## Testing Protocol
Run affected automated tests for code changes and `npm run build` for TypeScript/UI changes. Runtime changes also require browser checks on `http://localhost:5173` using an available supported browser tool:
1.  **Loads:** No fatal errors.
2.  **Search:** Autocomplete → "Fly Here" activates.
3.  **Sim:** HUD visible, no crash/promise rejections.
4.  **Keys:** Telemetry updates properly; smooth ramping verified (no instant max jumps).
5.  **Pause:** ESC toggles menu.
6.  **Console:** Zero `TypeError`, `ReferenceError`, or `Error` messages.
* **Gamepad specific:** Verify 500Hz polling, `RadioPresets.ts` matching (e.g., "betafpv"), clear cached mappers on reconnect.
* **Flight/population/performance changes:** Verify controlled takeoff, horizontal travel and a turn using HUD distance, altitude and heading. Startup, spinning and actor counters alone do not establish usable flight or visible placement. Check nearby actors visually and distinguish simulated/rendered counts from actors visible on screen.
* A connected radio takes priority over keyboard input. Preserve custom mappings; request disconnection if independent keyboard testing is needed. Use short inputs and counter-steer in Acro mode; released sticks do not level the drone. Pause while inspecting code. Measure performance in a foreground browser and distinguish active flight, tile loading and paused rendering.
* If a required browser check is blocked by unavailable tools, authentication or provider access, report the observed blocker and unverified checks explicitly; do not claim they passed.
* Documentation/harness-only edits require checking referenced files, commands and consistency; they do not require launching a flight.
