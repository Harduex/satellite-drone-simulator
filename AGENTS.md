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
VITE_CESIUM_ION_TOKEN=your_token_here
```

- **Google Maps Platform**: Enable Maps JavaScript API, Places API, Map Tiles API at [console.cloud.google.com](https://console.cloud.google.com)
- **Cesium Ion**: Free tier at [cesium.com/ion](https://cesium.com/ion)

If keys are missing, the app shows a setup guide screen.

## Controls

| Key | Action |
|-----|--------|
| W / S | Throttle up / down (incremental ramp) |
| A / D | Yaw left / right |
| Arrow Up / Down | Pitch forward / back |
| Arrow Left / Right | Roll left / right |
| ESC | Pause / Resume |

Radio controllers (RadioMaster, Jumper, TBS Tango) are auto-detected via the Web Gamepad API with preset axis mappings. Custom mapping available in the Controller Setup wizard.

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

After the final implementation of the task, before ending the chat session, use your 'Ask Questions' tool to ask me: "Would you like me to apply any corrections, or should we conclude the session now?"
