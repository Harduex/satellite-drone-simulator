# Satellite Drone Simulator — Implementation Plan

## Context

Build a browser-based FPV drone simulator from scratch per `SATELLITE_DRONE_SIM_PRD.md`. The project is completely greenfield — no source code, no `package.json`, nothing exists yet beyond the PRD and dotagents config (`agents.toml`). The user picks any real-world location via Google Maps, then flies over it in FPV using a real radio controller via USB. Physics should feel like Liftoff — realistic motor thrust, drag, inertia, ground effect.

**Stack:** Vite + TypeScript + React (minimal UI) + CesiumJS + Zustand + Google Maps/3D Tiles
**Physics:** Custom quadrotor force model at 500Hz, Euler integrator (upgrade to RK4 later if needed)
**Input:** Web Gamepad API for real FPV radio controllers + keyboard fallback for dev
**Package manager:** npm
**Testing:** vitest from the start

### Resolved Decisions
| Decision | Choice |
|----------|--------|
| API keys | Not ready yet — build "Setup Required" screen |
| Development priority | Parallel — physics + world side by side |
| Integrator | Euler first, upgrade to RK4 if instability appears |
| PID tuning | Hardcode Betaflight-like defaults, add sliders in Phase 6 |
| Drone 3D model | Geometric placeholder (Cesium primitives) |
| Keyboard input | Add early alongside gamepad for testing |
| Testing | vitest from Phase 1, physics tests in Phase 2 |

---

## Phase 1: Scaffold
**Goal:** Working Vite dev server, CesiumJS loading, correct folder structure, all module stubs.

**Steps:**
1. `npm create vite@latest fpv-sim -- --template react-ts` (then move files to repo root)
2. Install deps: `cesium`, `vite-plugin-cesium`, `zustand`, `@googlemaps/js-api-loader`, `react`, `react-dom`
3. Install devDeps: `vite`, `@vitejs/plugin-react`, `vite-plugin-cesium`, `typescript`, `vitest`, `jsdom`
4. Configure `vite.config.ts` — cesium plugin, WASM headers, vitest with jsdom
5. Create `.env.example` with `VITE_GOOGLE_MAPS_API_KEY=` and `VITE_CESIUM_ION_TOKEN=`
6. Create `index.html` — `#cesium-container` div (always mounted, hidden until flying) + `#root` for React
7. Create full `src/` folder structure per PRD §5 with exported empty class/function stubs
8. Setup Zustand: single store with slice pattern (`sessionSlice`, `droneSlice`, `settingsSlice`)

**Key files:** `vite.config.ts`, `tsconfig.json`, `.env.example`, `index.html`, `src/main.tsx`, all stubs per PRD §5

**Verify:** `npm run dev` starts, `npm run build` succeeds, all imports resolve

---

## Phase 2: Physics Core
**Goal:** Fully functional headless drone physics with passing vitest tests.

**Files to implement:**

| File | What it does |
|------|-------------|
| `src/core/physics/types.ts` | Vector3/Quaternion as plain objects + standalone math fns, DroneState, MotorCommands, PhysicsConfig, DEFAULT_DRONE_CONFIG, DEFAULT_RATES from PRD §14 |
| `src/core/physics/MotorModel.ts` | throttle→RPM with first-order spin-up lag (τ=50ms), `T = kT * rpm²`, tracks 4 motor states |
| `src/core/physics/DragModel.ts` | Translational: `-0.5 * ρ * Cd * A * |v| * v`; Angular: `-kD * ω` |
| `src/core/physics/DronePhysics.ts` | Force/torque computation per PRD §6.3, Euler integrator at 500Hz, quaternion normalization, sub-step cap of 10 |
| `src/core/flight-controller/PIDController.ts` | Generic PID with anti-windup clamp, D-term low-pass filter |
| `src/core/flight-controller/FlightController.ts` | Acro mode: sticks→target rates→PID→motor mixing. Betaflight-like defaults hardcoded |
| `src/core/flight-controller/FlightModes.ts` | Enum ACRO/ANGLE, mode-specific rate computation |
| `src/core/physics/__tests__/DronePhysics.test.ts` | Drop test, hover test, spin test |
| `src/core/flight-controller/__tests__/PIDController.test.ts` | Step response, anti-windup |

**Motor mixing matrix** (must match PRD §6.2 X-config layout exactly):
```
m1 = throttle - roll + pitch + yaw   (front-left, CCW)
m2 = throttle + roll + pitch - yaw   (front-right, CW)
m3 = throttle + roll - pitch + yaw   (back-right, CCW)
m4 = throttle - roll - pitch - yaw   (back-left, CW)
```

**Verify:** `npm run test` passes — drone falls under gravity, hovers at ~50% throttle, PID converges

---

## Phase 3: World (CesiumJS + Google 3D Tiles)
**Goal:** CesiumJS displaying 3D tiles at a location, working coordinate conversions, FPV camera.

*Can be developed in parallel with Phase 2 since they share only types.ts.*

**Files to implement:**

| File | What it does |
|------|-------------|
| `src/world/CesiumManager.ts` | Create Viewer with all UI stripped, disable camera controls, perf tuning (tile parallelism, near=0.1m/far=5000m, no atmosphere/fog) |
| `src/world/TileLoader.ts` | `Cesium.createGooglePhotorealistic3DTileset()`, fallback to World Terrain + Bing for rural |
| `src/world/CoordUtils.ts` | ENU↔ECEF via `Transforms.eastNorthUpToFixedFrame`, body quat→ECEF orientation |
| `src/world/TerrainSampler.ts` | Pre-cache terrain grid around spawn, async `sampleTerrainMostDetailed`, AGL computation |
| `src/world/DroneRenderer.ts` | Point primitive initially (geometric model in Phase 7) |
| `src/camera/FPVCamera.ts` | Sync Cesium camera from DroneState each frame, 120° FOV, rolls with drone |
| `src/camera/CameraConfig.ts` | FOV=120, near=0.1, far=5000 constants |

**API key handling:** If `VITE_GOOGLE_MAPS_API_KEY` or `VITE_CESIUM_ION_TOKEN` is missing, show a "Setup Required" screen with step-by-step instructions + `.env` template. This is built here but the full UI comes in Phase 6.

**Verify:** CesiumJS renders 3D tiles at hardcoded location (Eiffel Tower), CoordUtils ENU→ECEF→ENU round-trips correctly

---

## Phase 4: Input
**Goal:** Read radio controller + keyboard, normalize, produce StickInputs.

| File | What it does |
|------|-------------|
| `src/core/input/GamepadManager.ts` | Poll `navigator.getGamepads()` in game loop tick, detect gamepad with ≥4 axes, connect/disconnect events |
| `src/core/input/AxisMapper.ts` | Map axis indices→flight axes, inversion, deadband ±0.05, expo curve, throttle [-1,1]→[0,1], localStorage persistence |
| `src/core/input/RadioPresets.ts` | Presets for RadioMaster/Jumper/TBS Tango/Generic, fuzzy-match `gamepad.id` |
| `src/core/input/KeyboardInput.ts` | **NEW (not in PRD)** — WASD+arrows→StickInputs for dev testing. W/S=throttle, A/D=yaw, arrows=roll/pitch |

**Keyboard mapping:**
- W/S: throttle up/down (incremental, not binary — ramp up/down)
- A/D: yaw left/right
- Arrow Up/Down: pitch forward/back
- Arrow Left/Right: roll left/right

---

## Phase 5: Game Loop
**Goal:** Full flight loop: input → flight controller → physics → camera → render at 500Hz/60Hz.

| File | What it does |
|------|-------------|
| `src/game/GameLoop.ts` | Hook into `viewer.scene.preRender`, fixed 500Hz accumulator (max 10 steps), wallDt clamped to 50ms, telemetry→store at 10Hz |
| `src/game/SimSession.ts` | Create ENU frame, sample terrain, spawn at terrain+10m AGL, reset logic |
| `src/game/BatteryModel.ts` | Drain ∝ throttle, voltage sag 16.8V→14V→12V, HUD display only |
| `src/store/droneSlice.ts` | Update with live telemetry: position, velocity, altitude AGL, speed, battery, motor RPMs |
| `src/store/sessionSlice.ts` | Update with phase, location, spawnOrigin |

**Verify:** Drone hovers at ~50% throttle over 3D tiles, sticks produce response, camera tracks smoothly, physics runs at 500Hz

---

## Phase 6: UI
**Goal:** Complete user flow: search location → fly → pause → settings.

| File | What it does |
|------|-------------|
| `src/ui/App.tsx` | Phase router PICKER/FLYING/PAUSED, ESC key, dark theme `#1a1a2e` bg |
| `src/ui/LocationPicker/LocationPicker.tsx` | Google Maps via `@googlemaps/js-api-loader`, Places Autocomplete, click-to-spawn, "Fly Here" button, controller badge |
| `src/ui/LocationPicker/MapController.ts` | Imperative Maps API wrapper |
| `src/ui/SimView/SimView.tsx` | Show Cesium container, start GameLoop |
| `src/ui/SimView/HUD.tsx` | Throttle bar (bottom-left), speed+altitude (bottom-center), battery (bottom-right), location (top-left). All `pointer-events: none` |
| `src/ui/SimView/PauseMenu.tsx` | Resume / Change Location / Controller Setup, 50% backdrop |
| `src/ui/Settings/ControllerSetup.tsx` | 4-step axis wizard, live visualizer, rates sliders (100-900 deg/s), expo (0-1), flight mode |
| `src/ui/Settings/PhysicsSettings.tsx` | Mass, drag, PID gain sliders (hardcoded defaults as starting point), reset-to-defaults |

**Setup Required screen:** if API keys missing → instructions + links to Google Cloud Console / Cesium Ion dashboard

**Styling:** minimal dark theme, monospace HUD, no CSS framework, no external component library

---

## Phase 7: Polish
**Goal:** Refined FPV feel, crash handling, final experience.

- FPV camera tilt offset (25-35° configurable) — real FPV cameras are angled up
- Geometric drone model: box body + 4 arms + motor discs via Cesium primitives (not visible in FPV, for future 3rd-person)
- **Crash handling:** AGL < 0.5m → red flash (200ms) → 1s freeze → respawn at spawn
- ESC pause: freeze physics, keep Cesium rendering
- Debug FPS + physics-Hz counter (F3 toggle)
- localStorage persistence: last location, controller config, physics settings
- Loading spinner while tiles stream
- Polish keyboard input feel (smoothing, ramp rates)

---

## Phase 8: AGENTS.md + Final Documentation

Create `AGENTS.md` at project root:

```markdown
# AGENTS.md

## Project Overview
Browser-based FPV drone simulator. Fly any real-world location using Google Photorealistic 3D Tiles
via CesiumJS, with a custom 500Hz quadrotor physics engine and real radio controller input via the
Web Gamepad API.

## Architecture
- `src/core/` — Pure logic, zero external deps. Physics, flight controller, input processing.
- `src/world/` — CesiumJS integration. Tile loading, coordinates, terrain, drone rendering.
- `src/camera/` — FPV camera sync from physics state to Cesium camera.
- `src/game/` — Integration layer. Game loop, session management, battery model.
- `src/store/` — Zustand state. Session, drone telemetry, settings.
- `src/ui/` — React UI. Location picker, HUD, settings, pause menu.

Module rules: core/ has zero external deps | world/ imports Cesium only | ui/ imports React+store only | game/ is the integration layer

## Key Technical Decisions
- Custom physics (not Rapier) — need force model, not collision engine
- CesiumJS (not Three.js) — native Google 3D Tiles support, production-grade
- ENU coordinates for physics, ECEF for rendering — avoids floating-point jitter

## Development
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run test` — Run vitest

## Environment Setup
Create a `.env` file with:
- `VITE_GOOGLE_MAPS_API_KEY` — Google Maps Platform (enable Maps JS, Places, Map Tiles APIs)
- `VITE_CESIUM_ION_TOKEN` — Free tier at cesium.com/ion

## The .agents Folder
This project uses [dotagents](https://github.com/getsentry/dotagents) to manage agent skills
declared in `agents.toml`. Skills are resolved from GitHub, installed to `.agents/skills/`, and
symlinked into agent-specific config directories (`.claude/skills/`, `.cursor/skills/`, etc.).

### Currently Installed Skills
- **dotagents** (`getsentry/dotagents`) — Manages skill dependencies
- **grill-me** (`mattpocock/skills`) — Interview-based plan stress-testing

### Progressive Disclosure of Skills
Skills are discovered progressively by each agent tool. dotagents handles resolution, version
locking (`agents.lock`), and symlinking so each agent sees skills in its native format. Add
new skills: `npx @sentry/dotagents add <source> <skill-name>`. List installed:
`npx @sentry/dotagents list`.

### Trust Configuration
`agents.toml` has `[trust] allow_all = true` — all skill sources are trusted. Restrict with
explicit `allow` lists per the dotagents docs.

---

After the final implementation of the task, before ending the chat session, use your 'Ask Questions' tool to ask me: "Would you like me to apply any corrections, or should we conclude the session now?"
```

---

## Verification Plan (End-to-End)

1. **Phase 2:** `npm run test` — drop test (drone falls), hover test (~50% stable), PID convergence
2. **Phase 3:** Dev server shows CesiumJS 3D tiles at Eiffel Tower coords
3. **Phase 5:** Fly with keyboard input, verify 500Hz physics via console timer
4. **Phase 6:** Full flow: open → search "Eiffel Tower" → Fly Here → fly → ESC → change location
5. **Phase 7:** Crash → red flash → respawn, FPV camera 120° FOV feels right, no jitter
6. **Final:** `npm run build` succeeds with no errors, all tests pass

---

## Critical Files (highest implementation risk)

| File | Risk | Why |
|------|------|-----|
| `src/core/physics/DronePhysics.ts` | High | Quaternion integration, force model math, sign conventions |
| `src/world/CoordUtils.ts` | High | ENU↔ECEF transforms — wrong = drone in wrong place or camera facing wrong way |
| `src/game/GameLoop.ts` | High | Timing precision, fixed-step accumulator, subsystem orchestration |
| `src/world/CesiumManager.ts` | Medium | CesiumJS Viewer config, disabling defaults, perf tuning |
| `src/core/flight-controller/FlightController.ts` | Medium | Motor mixing signs must match layout, PID gain scaling |


