# AGENTS.md

## Rules
* When reporting information to me, be extremely concise. Sacrifice grammar for the sake of concision and clarity.
* When your context hits over 75%, use your compact tool to compact the context.
* After the final implementation of the task, before ending the chat session, use your 'Ask Questions' tool to ask me: "Would you like me to apply any corrections, or should we conclude the session now?"

## Overview
* Browser FPV drone sim. Google 3D Tiles (CesiumJS), 500Hz custom physics, Web Gamepad API.

## Architecture & Constraints

* `core/`: Pure TS. Physics, PID, input. **ZERO** external deps.
* `world/`: CesiumJS only. Tiles, terrain, render.
* `camera/`: Physics → Cesium sync.
* `game/`: Integrator (500Hz sim, 60Hz render). Imports core/world/camera/store.
* `store/`: Zustand state. Imports core/types only.
* `ui/`: React + store. `theme.ts` for design tokens. No core/Cesium imports.

## Tech Decisions & Physics Invariants

* **Physics:** Custom force model, Euler integrator @ 500Hz.
* **Coords:** ENU (physics) → ECEF (render). Body: X=Right (Pitch), Y=Forward (Roll), Z=Up (Yaw).
* **PID:** Runs @ 500Hz. Betaflight-like defaults. Target rates negated (right-hand rule).
* **Motors:** Shared `MOTOR_LAYOUT` (`types.ts`). M1 = front-left CCW. Asymmetric spin-down (2x inertia). Hover @ ~35% throttle.
* **Drag:** Quadratic angular, direction-dependent translational (3x vertical downwash).
* **Render:** CesiumJS. Globe hidden < 2km from spawn.
* **State:** Crash events flow via Zustand.

## Dev & Setup
* **Commands:** `npm run dev|build|test|preview`
* **Env:** `.env` requires `VITE_GOOGLE_MAPS_API_KEY` (Maps JS, Places, Map Tiles).

## Controls
* **Keys:** W/S (Throttle), A/D (Yaw), Arrows (Pitch/Roll), ESC (Pause). Smooth stick ramping applied.
* **Gamepad:** Web Gamepad API auto-detects presets.

## Agents & Skills
* Managed via `dotagents`. `agents.toml` → `allow_all = true`.
* **Installed:** `dotagents` (manager), `grill-me` (stress-test), `playwright` (MCP server for E2E).

## Testing Protocol (Mandatory Agent Self-Test)
Playwright testing on `http://localhost:5173` required after implementation:
1.  **Loads:** No fatal errors.
2.  **Search:** Autocomplete → "Fly Here" activates.
3.  **Sim:** HUD visible, no crash/promise rejections.
4.  **Keys:** Telemetry updates properly; smooth ramping verified (no instant max jumps).
5.  **Pause:** ESC toggles menu.
6.  **Console:** Zero `TypeError`, `ReferenceError`, or `Error` messages.
* **Gamepad specific:** Verify 500Hz polling, `RadioPresets.ts` matching (e.g., "betafpv"), clear cached mappers on reconnect.