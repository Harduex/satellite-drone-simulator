# AGENTS.md

## Rules
* This repository is public. Before every commit, inspect the complete staged diff, staged file list, and commit metadata for secrets, credentials, personal information, machine-local paths, and private conversation context. Run an available secret scanner with redacted output and verify its detection with a synthetic-secret self-test. Do not commit sensitive findings; resolve them first. Keep `.env`, local screenshots, logs, and session artifacts untracked. Record only project-relevant, public-safe instructions in this harness. Local commits are allowed when requested; pushing or publishing requires explicit approval.
* Use a verified public author identity and privacy-preserving commit email (such as GitHub's noreply address). Do not include personal contact details in commit metadata or messages.
* Commit each significant, verified change locally after the public-safety checks. Pushing or publishing still requires explicit approval.
* When reporting information to me, be extremely concise. Sacrifice grammar for the sake of concision and clarity.
* When your context hits over 75%, use your compact tool to compact the context.
* After the final implementation of the task, before ending the chat session, use your 'Ask Questions' tool to ask me: "Would you like me to apply any corrections, or should we conclude the session now?"

## Overview
* Browser FPV drone sim. Google 3D Tiles (CesiumJS), 500Hz custom physics, Web Gamepad API.

## Documentation Map
* [docs/ROADMAP.md](docs/ROADMAP.md) tracks outcomes, horizons, decision status and postponed ideas. Update it when an idea is deferred or its status changes; roadmap entries do not authorize implementation.
* Start with [docs/README.md](docs/README.md) for product references and experiment findings; follow [docs/AGENTS.md](docs/AGENTS.md) when editing documentation.
* Offline/custom-map evidence and deferred brainstorming: [docs/experiments/offline-maps.md](docs/experiments/offline-maps.md). Google remains the default; local probes do not constitute a shipped offline mode.

## Architecture & Constraints

* `core/`: Pure TS. Physics, PID, input. **ZERO** external deps.
* `world/`: CesiumJS only. Tiles, terrain, render.
* `camera/`: Physics → Cesium sync.
* `game/`: Integrator (500Hz sim, 60Hz render). Imports core/world/camera/store.
* `store/`: Zustand state. Imports core/types only.
* `ui/`: React + store. `theme.css` for CSS custom properties. `theme.ts` for JS-only tokens (`colors`, `gradients`). No core/Cesium imports.

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
* Managed via `dotagents`. `agents.toml` → `allow_all = true`.
* **Skills:** `dotagents` (manager), `grill-me` (stress-test), `improve-codebase-architecture` (refactoring), `frontend-design` (UI/UX), `debugger` (local, scientific debugging), `code-standards` (local, code quality).
* **MCP Servers:** `playwright` (E2E browser testing), `chrome-devtools` (DevTools debugging).

## Testing Protocol (Mandatory Agent Self-Test)
Chrome DevTools / Playwright testing on `http://localhost:5173` required after implementation:
1.  **Loads:** No fatal errors.
2.  **Search:** Autocomplete → "Fly Here" activates.
3.  **Sim:** HUD visible, no crash/promise rejections.
4.  **Keys:** Telemetry updates properly; smooth ramping verified (no instant max jumps).
5.  **Pause:** ESC toggles menu.
6.  **Console:** Zero `TypeError`, `ReferenceError`, or `Error` messages.
* **Gamepad specific:** Verify 500Hz polling, `RadioPresets.ts` matching (e.g., "betafpv"), clear cached mappers on reconnect.
