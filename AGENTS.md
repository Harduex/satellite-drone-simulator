# AGENTS.md

## Project Overview

Browser-based FPV drone simulator. Fly any real-world location using Google Photorealistic 3D Tiles via CesiumJS, with a custom 500Hz quadrotor physics engine and real radio controller input via the Web Gamepad API. Search for a location, click "Fly Here", and fly in first-person view with realistic inertia, drag, and motor response.

## Architecture

```
src/
├── core/           Pure logic, zero external deps
│   ├── physics/    Quadrotor force model, Euler integrator, motor/drag models
│   ├── flight-controller/  PID rate controller, motor mixing, flight modes
│   └── input/      Gamepad polling, axis mapping, keyboard fallback
├── world/          CesiumJS integration
│   ├── CesiumManager.ts    Viewer lifecycle, perf tuning
│   ├── TileLoader.ts       Google 3D Tiles + fallback terrain
│   ├── CoordUtils.ts       ENU ↔ ECEF coordinate transforms
│   ├── TerrainSampler.ts   Terrain height caching + AGL
│   └── DroneRenderer.ts    Drone visual entity
├── camera/         FPV camera sync from physics → Cesium camera
├── game/           Integration layer
│   ├── GameLoop.ts          500Hz physics / 60Hz render orchestrator
│   ├── SimSession.ts        Session lifecycle, spawn management
│   └── BatteryModel.ts      Simulated battery drain
├── store/          Zustand state (session, drone telemetry, settings)
└── ui/             React UI (location picker, HUD, pause menu, settings)
```

### Module Dependency Rules

- `core/` has **zero** external deps (no Cesium, no React) — pure TypeScript
- `world/` imports Cesium only
- `ui/` imports React + store only — never physics or Cesium directly
- `game/` is the integration layer — imports core/, world/, camera/, store/
- `store/` imports core/types only (for type shapes)

## Key Technical Decisions

- **Custom physics** (not Rapier) — need a force model (thrust vectors → net force/torque → integration), not a collision engine
- **CesiumJS** (not Three.js) — native Google 3D Tiles support, production-grade tile streaming, terrain height API
- **ENU coordinates for physics, ECEF for rendering** — avoids floating-point jitter at world-scale positions
- **Euler integrator at 500Hz** — simple and stable enough for MVP; upgrade to RK4 if instability at high angular rates
- **Betaflight-comparable PID defaults** — hardcoded gains, tuning UI available in settings
- **PID runs at physics rate (500Hz), not frame rate** — consistent timestep prevents integral windup from variable frame timing

## Development

```bash
npm run dev      # Start Vite dev server
npm run build    # Production build
npm run test     # Run vitest (physics + PID tests)
npm run preview  # Preview production build
```

## Environment Setup

Create a `.env` file in the project root:

```
VITE_GOOGLE_MAPS_API_KEY=your_key_here
```

- **Google Maps Platform**: Enable Maps JavaScript API, Places API, Map Tiles API at [console.cloud.google.com](https://console.cloud.google.com)

If the key is missing, the app shows a setup guide screen.

## Controls

| Key | Action |
|-----|--------|
| W / S | Throttle up / down (incremental ramp) |
| A / D | Yaw left / right |
| Arrow Up / Down | Pitch forward / back |
| Arrow Left / Right | Roll left / right |
| ESC | Pause / Resume |

All keyboard stick axes (roll, pitch, yaw) use smooth ramping — they accelerate toward max deflection while held and decay to center on release. This prevents instant full-rate flips that make the drone seem uncontrollable.

Radio controllers (RadioMaster, Jumper, TBS Tango, BETAFPV LiteRadio 2 SE) are auto-detected via the Web Gamepad API with preset axis mappings. Custom mapping available in the Controller Setup wizard.

## The .agents Folder

This project uses [dotagents](https://github.com/getsentry/dotagents) to manage agent skills declared in `agents.toml`. Skills are resolved from GitHub, installed to `.agents/skills/`, and symlinked into agent-specific config directories (`.claude/skills/`, `.cursor/skills/`, etc.) so each agent tool discovers them natively.

### Currently Installed Skills

- **dotagents** (`getsentry/dotagents`) — Manages skill dependencies, installation, and symlinking
- **grill-me** (`mattpocock/skills`) — Interview-based plan stress-testing: interrogates every aspect of a design until reaching shared understanding

### Progressive Disclosure of Skills

Skills are discovered progressively by each agent tool. dotagents handles:
1. **Resolution** — GitHub shorthand (`owner/repo`) → full URL
2. **Version locking** — `agents.lock` pins resolved URLs
3. **Installation** — Downloads to `.agents/skills/`
4. **Symlinking** — Creates links in `.claude/skills/`, `.cursor/skills/`, etc.

Each agent sees skills in its native format without knowing about the shared infrastructure.

### Currently Installed MCP Servers

- **playwright** (`@playwright/mcp@latest`) — Browser automation via Playwright. Used for end-to-end testing of the simulator (UI interactions, console log inspection, screenshots, keyboard/gamepad input simulation).

### Managing Skills

```bash
npx @sentry/dotagents add <source> <skill-name>   # Add a skill
npx @sentry/dotagents remove <name>                # Remove a skill
npx @sentry/dotagents list                         # List installed skills
npx @sentry/dotagents sync                         # Reconcile state
```

### Trust Configuration

`agents.toml` has `[trust] allow_all = true` — all skill sources are trusted. Restrict with explicit `allow` lists per the dotagents documentation.

---

## Testing Protocol (Agent Requirement)

Before marking any feature or bug-fix as complete, agents **must** self-test using the Playwright MCP server. The dev server must be running (`npm run dev`) and accessible at `http://localhost:5173` (or next available port if 5173 is busy).

### Mandatory Test Checklist

Run the following checks with Playwright after every feature implementation:

1. **App loads** — Navigate to `http://localhost:5173`. Assert no fatal console errors. Assert the location search input is visible.
2. **Search works** — Type a location (e.g. "Eiffel Tower, Paris") into the search box. Assert autocomplete suggestions appear. Select a suggestion and assert the "Fly Here" button becomes active.
3. **Sim launches** — Click "Fly Here". Assert the simulator view loads (HUD visible, no crash screen). Assert no unhandled promise rejections in the console.
4. **Keyboard controls** — With the sim active, send key events (`W`, `S`, `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`, `A`, `D`). Assert the drone telemetry values in the HUD change (throttle, roll, pitch, yaw). Verify smooth ramping — stick axes must NOT jump instantly to maximum.
5. **ESC pause** — Press `Escape`. Assert the pause menu appears. Press `Escape` again. Assert the sim resumes.
6. **No console errors** — After the full flow, assert there are no uncaught `TypeError`, `ReferenceError`, or `Error` messages in the browser console.

### Gamepad / Radio Controller Testing

The Web Gamepad API cannot be synthesized via Playwright in a standard browser context. For BETAFPV LiteRadio 2 SE (and similar) controller issues:

- Verify that `GamepadManager.ts` polls `navigator.getGamepads()` each physics tick (not via event-only).
- Verify that `RadioPresets.ts` includes a preset matching the BETAFPV LiteRadio 2 SE USB HID descriptor (VID/PID or name string match). The current preset matches on `"betafpv"`, `"literadio"`, or `"lite radio"` in the `gamepad.id` string.
- Verify the BETAFPV axis mapping (Mode 2): throttle on axis 1 (inverted), yaw on axis 0, pitch on axis 2 (inverted), roll on axis 3.
- Verify that `GamepadManager` clears its cached axis mapper on new gamepad connection so stale mappings don't override auto-detection.
- Verify that the Controller Setup wizard surfaces unrecognised controllers for manual mapping.
- To manually test with a physical controller: open DevTools → Application → Gamepad and confirm the controller is detected before flying.

### Physics / Flight Controller Invariants

When fixing or implementing physics-related features, verify the following:

- **Body frame convention** — X=right (East initially), Y=forward (North initially), Z=up. Roll = rotation around Y (forward axis), Pitch = rotation around X (right axis), Yaw = rotation around Z (up axis).
- **Torque axis assignment** — In `DronePhysics.ts`, `motorTorque = vec3(pitchTorque, rollTorque, yawTorque)` — pitch torque (front/back differential) maps to X axis, roll torque (left/right differential) maps to Y axis.
- **Flight controller axis mapping** — Roll PID reads `angularVelocity.y`, Pitch PID reads `angularVelocity.x`, Yaw PID reads `angularVelocity.z`.
- **Sign negation** — All target rates are negated in `FlightController.update()` to match right-hand rule: stick-right → negative omega.y (roll right), stick-forward → negative omega.x (pitch down/fly forward), stick-yaw-right → negative omega.z (yaw clockwise from above).
- **PID runs at physics rate** — `FlightController.update()` must be called inside the 500Hz substep loop in `GameLoop.tick()` with `PHYSICS_DT`, never with variable `wallDt`.
- **Motor mixing signs match layout** — M1(front-left CCW) = `throttle - roll + pitch + yaw`, M2(front-right CW) = `throttle + roll + pitch - yaw`, M3(back-right CCW) = `throttle + roll - pitch + yaw`, M4(back-left CW) = `throttle - roll - pitch - yaw`.
- **Keyboard inputs ramp smoothly** — all stick axes use `rampAxis()` with configurable acceleration/decay rates, not binary on/off values.
- **Hover at ~35% throttle** — with `DEFAULT_DRONE_CONFIG`, the drone should hold altitude at approximately 35% throttle. If hover drifts significantly, check kT, mass, and maxRPM.

### Running Tests

```bash
# Unit tests (physics + PID)
npm run test

# Start the dev server first (keep running in another terminal)
npm run dev

# Then use Playwright MCP tools in the agent session to:
# - browser_navigate to http://localhost:5173
# - browser_snapshot / browser_screenshot to inspect state
# - browser_type / browser_click to interact with UI
# - browser_console_messages to check for errors
# - browser_press_key to test keyboard controls
```

---

After the final implementation of the task, before ending the chat session, use your 'Ask Questions' tool to ask me: "Would you like me to apply any corrections, or should we conclude the session now?"
