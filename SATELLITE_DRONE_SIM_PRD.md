# Satellite Drone Simulator — PRD & Technical Document
**Version:** 1.0 (MVP)  
**Target:** Claude Code implementation start  
**Stack decision:** Final — see §4

---

## 1. Product Vision

A browser-based FPV drone simulator where the world IS the map. User picks any real-world location via satellite/photorealistic 3D tile search, then flies over it in first-person view using their real radio controller (RadioMaster, Jumper, TBS Tango, etc.) plugged in via USB-C. Physics feel like Liftoff — not casual, not floaty. Quad responds to stick inputs with realistic motor thrust, drag, inertia, and ground effect.

**Differentiator vs existing sims:** No artificial track/course. The whole Earth is the playground. Low friction to start: search → fly in <10 seconds.

---

## 2. MVP Scope (v0.1)

### In scope
- Location picker: search bar + map view (Google Maps JS API)
- One drone: 5" freestyle quad with sane defaults
- FPV camera: realistic FOV (120°), slight fisheye, no artificial post-processing
- Physics: thrust model, drag, gravity, angular inertia (no prop wash for MVP)
- Radio controller: Web Gamepad API, auto-detect, axis mapping UI
- World: Google Photorealistic 3D Tiles via CesiumJS streaming
- Collision: terrain height sampling (no full mesh collision for MVP — drone resets on ground contact)
- HUD: minimal — throttle bar, battery % (simulated drain), speed, altitude AGL

### Out of scope (v0.2+)
- Multiple drones
- Wind simulation
- Prop wash / turbulence
- Multiplayer
- DVR recording
- Custom drone builder
- Weather / time of day

---

## 3. User Stories

| # | Story |
|---|-------|
| U1 | User opens app, sees location search screen |
| U2 | User searches "Eiffel Tower" → map zooms, user confirms location |
| U3 | User plugs in radio controller via USB-C → app auto-detects as gamepad |
| U4 | User sees axis mapping screen, verifies stick directions, saves |
| U5 | User clicks "Fly Here" → enters FPV view at 10m AGL above selected coords |
| U6 | User flies: throttle up/down, roll, pitch, yaw respond with realistic inertia |
| U7 | Drone descends below terrain height → auto-reset to spawn point |
| U8 | User presses ESC → returns to location picker without losing location |
| U9 | User changes location mid-session → world reloads around new coords |

---

## 4. Technology Decisions

### 4.1 Renderer: CesiumJS
**Why:** Native support for Google Photorealistic 3D Tiles (OGC 3D Tiles spec). Built-in tile LOD streaming, attribution handling (required by Google ToS), terrain height query API (`sampleTerrainMostDetailed`). Zero Three.js integration complexity. The 3d-tiles-renderer for Three.js exists but is experimental; CesiumJS is production-grade for this exact use case.

**Concern:** CesiumJS controls are Earth-navigation focused, not game camera.  
**Mitigation:** Disable default camera controller, implement custom FPV camera by directly setting `viewer.camera` position/orientation each frame from physics state.

### 4.2 Physics: Custom quadrotor model (NOT Rapier)
**Why not Rapier:** Rapier is a rigid-body/collision engine. FPV drone simulation requires a *force model*, not just collision response. The authoritative physics is: per-motor thrust vectors → net force/torque on rigid body → integrate velocity/position. Rapier adds 1.5MB WASM overhead with no benefit for airborne simulation. We don't need mesh collisions for MVP.

**Implementation:** Pure JS physics loop at 500Hz (decoupled from render loop) using a simple Euler/RK4 integrator:
- State: `[pos(3), vel(3), quat(4), omega(3)]` = 13 floats
- Forces: gravity, 4x motor thrust (collinear, up in body frame)
- Torques: differential thrust (yaw), gyroscopic effect (simplified)
- Drag: velocity-proportional, uses projected area approximation

**Add Rapier in v0.2** if terrain mesh collision (trees, buildings) is needed.

### 4.3 Maps: Google Maps JS API + Map Tiles API
- **Location picker:** Google Maps JS API with Places Autocomplete
- **3D world:** Google Photorealistic 3D Tiles via CesiumJS (as officially supported renderer)
- **Terrain height:** CesiumJS `sampleTerrainMostDetailed` for ground collision
- **Fallback:** If no 3D tiles coverage (rural), use CesiumJS World Terrain + Bing imagery

### 4.4 Controller Input: Web Gamepad API
Modern FPV radios (RadioMaster Boxer/TX16S, Jumper T-Pro, TBS Tango 2 on OpenTX/EdgeTX) enumerate as standard HID joysticks when plugged in via USB-C in "Joystick mode". Browser Gamepad API reads them at ~60Hz with no drivers.

**Axis mapping:** Cannot hardcode — axis order varies by radio model and firmware. Ship with presets for common radios + manual mapping UI.

### 4.5 Frontend: Vite + TypeScript + React (minimal)
- React only for UI overlays (location picker, HUD, settings)
- CesiumJS owns the canvas (not a React component)
- Zustand for global state (avoids prop drilling between physics/renderer/UI)
- No CSS framework — custom minimal dark theme

### 4.6 Build: Vite
Handles CesiumJS's worker/WASM requirements via `vite-plugin-cesium`.

---

## 5. Architecture

```
src/
├── main.tsx                    # App entry, mounts React + boots CesiumViewer
│
├── core/                       # Pure logic, no UI, no Cesium imports
│   ├── physics/
│   │   ├── DronePhysics.ts     # Quadrotor force model, state integrator
│   │   ├── MotorModel.ts       # RPM → thrust curve (simplified Liftoff-style)
│   │   ├── DragModel.ts        # Velocity drag, angular drag
│   │   └── types.ts            # DroneState, MotorCommands, PhysicsConfig
│   │
│   ├── flight-controller/
│   │   ├── FlightController.ts # PID loop: stick inputs → motor commands
│   │   ├── PIDController.ts    # Reusable PID implementation
│   │   └── FlightModes.ts      # Acro, Angle, Horizon mode logic
│   │
│   └── input/
│       ├── GamepadManager.ts   # Polls Gamepad API, normalizes axes [-1,1]
│       ├── AxisMapper.ts       # User-defined axis assignments + inversion
│       └── RadioPresets.ts     # Axis presets for known radio models
│
├── world/                      # Geospatial + rendering bridge
│   ├── CesiumManager.ts        # Creates/destroys Viewer, manages lifecycle
│   ├── TileLoader.ts           # Google 3D Tiles tileset setup + attribution
│   ├── TerrainSampler.ts       # sampleTerrainMostDetailed wrapper, caches results
│   ├── CoordUtils.ts           # WGS84 ↔ local ENU ↔ ECEF conversions
│   └── DroneRenderer.ts        # Places/updates drone 3D model entity in Cesium
│
├── camera/
│   ├── FPVCamera.ts            # Sets Cesium camera from drone state each frame
│   └── CameraConfig.ts         # FOV, lens distortion params (future)
│
├── game/
│   ├── GameLoop.ts             # Master loop: input → physics → render sync
│   ├── SimSession.ts           # Session state: location, spawn, reset logic
│   └── BatteryModel.ts         # Simulated voltage sag / capacity drain
│
├── store/
│   ├── index.ts                # Zustand store root
│   ├── sessionSlice.ts         # Current location, sim phase (PICKER/FLYING/PAUSED)
│   ├── droneSlice.ts           # Live drone telemetry (pos, vel, battery, motors)
│   └── settingsSlice.ts        # Axis mapping, physics params, graphics
│
└── ui/
    ├── App.tsx                 # Phase router (LocationPicker | SimView)
    ├── LocationPicker/
    │   ├── LocationPicker.tsx  # Google Maps embed + search
    │   └── MapController.ts    # Imperative map API calls
    ├── SimView/
    │   ├── SimView.tsx         # CesiumJS canvas + HUD overlay
    │   ├── HUD.tsx             # Throttle, speed, altitude, battery
    │   └── PauseMenu.tsx       # ESC overlay: resume / change location / settings
    └── Settings/
        ├── ControllerSetup.tsx # Gamepad detect + axis mapping wizard
        └── PhysicsSettings.tsx # Rates, expo, physics multipliers
```

### Module Dependency Rules
- `core/` has ZERO external deps (no Cesium, no React). Pure TS.
- `world/` imports Cesium only.
- `ui/` imports React + store only — never physics or Cesium directly.
- `game/` is the integration layer — imports `core/`, `world/`, `camera/`, `store/`.
- `store/` imports `core/types` only (for type shapes).

This means: physics can be unit-tested without a browser. UI can be built with mocked store. World module can be swapped (e.g., replace CesiumJS with Three.js + 3d-tiles-renderer) without touching core.

---

## 6. Physics Model (Detail)

### 6.1 State Vector
```typescript
interface DroneState {
  position: Vector3;    // meters, local ENU from spawn origin
  velocity: Vector3;    // m/s, world frame
  quaternion: Quaternion; // body orientation
  angularVelocity: Vector3; // rad/s, body frame
}
```

### 6.2 Motor Layout (standard X config)
```
  M1(CCW) --- M2(CW)
     \       /
      \     /
  M4(CW) --- M3(CCW)
```
Motor positions offset from CoM: `±arm_length * cos(45°)` in body X and Y.

### 6.3 Force/Torque Model
```
// Per motor: thrust = kT * omega^2 (simplified, omega from throttle cmd)
// Net force (body frame): F_b = [0, 0, T1+T2+T3+T4]
// Net force (world frame): F_w = R * F_b + [0, 0, -m*g]
// Net torque (body frame):
//   roll  = (T3+T4 - T1-T2) * arm_length * cos(45°)
//   pitch = (T1+T3 - T2-T4) * arm_length * cos(45°)  
//   yaw   = kQ/kT * (-T1+T2+T3-T4)   // reaction torque

// Angular acceleration: alpha = I_inv * (tau - omega × (I * omega))
// Integration: RK4 at 500Hz, render sync at rAF
```

### 6.4 Flight Controller (Acro Mode)
```
// Stick → target angular rate (deg/s), multiplied by rates config
// PID error = target_rate - actual_rate (from angularVelocity)
// PID output → differential motor commands
// Throttle passthrough (collective thrust)
```

### 6.5 Motor Model (simplified Liftoff-style)
- Static thrust: `T = kT * throttle^2 * air_density_factor`
- Motor spin-up lag: first-order filter τ ≈ 50ms (realistic for 2306 motors)
- No voltage sag in v0.1 (battery affects only HUD display)

### 6.6 Drag
- Translational: `F_drag = -0.5 * rho * Cd * A * |v| * v`
- `A` (projected area): simplified constant for MVP (~0.04 m² for 5" quad)
- Angular drag: `tau_drag = -kD_angular * omega`

---

## 7. World / Cesium Integration

### 7.1 Coordinate System
CesiumJS works in ECEF (Earth-Centered Earth-Fixed). Physics works in local ENU (East-North-Up) centered on spawn point. Every frame:
```
drone_ecef = spawn_ecef + ENU_to_ECEF_rotation * drone_enu_position
```
`CoordUtils.ts` owns all conversions using Cesium's `Transforms.eastNorthUpToFixedFrame`.

### 7.2 FPV Camera
CesiumJS default camera is a globe-navigation camera. For FPV:
```typescript
// Each frame in GameLoop:
const ecefPos = CoordUtils.enuToEcef(droneState.position, spawnOrigin);
const ecefOrientation = CoordUtils.bodyQuatToEcef(droneState.quaternion, spawnOrigin);
viewer.camera.setView({
  destination: ecefPos,
  orientation: { direction: ecefOrientation.forward, up: ecefOrientation.up }
});
```
Camera FOV set to 120° to match FPV feel. No gimbal — camera is rigidly attached to body (FPV, not cinematic).

### 7.3 Terrain Collision (MVP)
```typescript
// Check AGL every 100ms (not every frame — sampleTerrainMostDetailed is async)
// If drone_altitude_AGL < 0.5m → trigger crash → reset to spawn
// Cache terrain height grid around spawn on session start
```

### 7.4 Tile Streaming Performance
```javascript
// Increase parallel tile requests for low-latency loading:
Cesium.RequestScheduler.requestsByServer["tile.googleapis.com:443"] = 18;
// Disable atmosphere/fog that obscures close geometry
viewer.scene.skyAtmosphere.show = false;
viewer.scene.fog.enabled = false;
// Set near/far clip for drone-scale flying (0.1m to 5000m)
viewer.camera.frustum.near = 0.1;
viewer.camera.frustum.far = 5000;
```

---

## 8. Input System

### 8.1 Gamepad Detection
```typescript
// Poll navigator.getGamepads() every 16ms
// Filter: axes.length >= 4 (need roll/pitch/yaw/throttle)
// Auto-suggest preset if gamepad.id matches known radio fingerprints
```

### 8.2 Axis Presets
```typescript
const RADIO_PRESETS = {
  "RadioMaster": { throttle: 1, yaw: 3, pitch: 2, roll: 0, throttle_inverted: false },
  "Jumper":      { throttle: 1, yaw: 3, pitch: 2, roll: 0, throttle_inverted: true },
  "TBS Tango":   { throttle: 1, yaw: 0, pitch: 3, roll: 2, throttle_inverted: false },
  "Generic":     { /* manual mapping */ }
}
```

### 8.3 Axis Mapping Wizard
1. "Move your throttle up" → record axis index + direction
2. Repeat for yaw, pitch, roll
3. Show live preview: virtual quad responds to stick movements
4. Save to localStorage

### 8.4 Input Processing
```typescript
// Raw gamepad axis [-1, 1]
// → deadband (±0.05)
// → expo curve: output = input * (expo_factor * input^2 + (1 - expo_factor))
// → scale to rate (deg/s for angle, raw for throttle)
```

---

## 9. Game Loop

```typescript
// GameLoop.ts — master orchestrator
class GameLoop {
  private physicsAccumulator = 0;
  private readonly PHYSICS_DT = 1 / 500; // 500Hz

  tick(wallDt: number) {
    // 1. Read input (at render rate ~60Hz)
    const stickInputs = gamepadManager.read();
    const motorCmds = flightController.update(stickInputs, droneState, wallDt);

    // 2. Physics sub-steps (fixed 500Hz, catch up if frame dropped)
    this.physicsAccumulator += wallDt;
    while (this.physicsAccumulator >= this.PHYSICS_DT) {
      droneState = dronePhysics.step(droneState, motorCmds, this.PHYSICS_DT);
      this.physicsAccumulator -= this.PHYSICS_DT;
    }

    // 3. Sync camera to physics state
    fpvCamera.sync(droneState);

    // 4. Check terrain collision (async, debounced)
    terrainSampler.checkCollision(droneState.position);

    // 5. Update HUD store (throttled to 10Hz to avoid React re-render spam)
    droneStore.updateTelemetry(droneState);
  }
}

// Started with: requestAnimationFrame(loop) — Cesium renders its own rAF,
// hook into viewer.scene.preRender event for synchronization
```

---

## 10. UI Screens

### 10.1 Location Picker
- Full-screen Google Maps (satellite view by default)
- Top: search bar with Places Autocomplete
- Bottom: "Fly Here" CTA + controller status badge
- Map click sets spawn point (marker pin)
- No 3D at this stage — standard 2D satellite for simplicity + performance

### 10.2 FPV View
- CesiumJS canvas = 100vw × 100vh (behind React root)
- React HUD overlay (pointer-events: none):
  - Bottom-left: throttle bar (vertical)
  - Bottom-center: speed (m/s) + altitude AGL (m)
  - Bottom-right: battery % + simulated voltage
  - Top-left: location name (from Places result)
- ESC key → PauseMenu overlay (50% opacity backdrop)

### 10.3 Controller Setup (modal, launched from ESC menu)
- Gamepad connected indicator (green dot + device name)
- 4-step axis wizard with live axis visualizer
- Rates config: max roll/pitch rate (100–900 deg/s), expo (0–1)
- Mode select: Acro / Angle (Horizon in v0.2)
- Save → localStorage `fpvsim_controller_config`

---

## 11. File: Implementation Kickstart Checklist

Claude Code should implement in this order:

### Phase 1: Scaffold
- [ ] `npm create vite@latest fpv-sim -- --template react-ts`
- [ ] Install deps: `cesium`, `vite-plugin-cesium`, `zustand`, `@types/cesium`
- [ ] Configure `vite.config.ts` with cesium plugin + WASM headers
- [ ] Create folder structure exactly as §5
- [ ] Stub all module files with exported empty classes/functions

### Phase 2: Physics Core
- [ ] Implement `DronePhysics.ts`: state vector, RK4 integrator, force model
- [ ] Implement `MotorModel.ts`: throttle → thrust lookup
- [ ] Implement `FlightController.ts`: Acro mode PID
- [ ] Unit test: drop test (drone falls under gravity only), hover test (50% throttle ≈ stable)

### Phase 3: World
- [ ] Implement `CesiumManager.ts`: init viewer, disable default controls
- [ ] Implement `TileLoader.ts`: load Google 3D Tiles with API key from env
- [ ] Implement `CoordUtils.ts`: ENU↔ECEF conversions
- [ ] Implement `FPVCamera.ts`: sync Cesium camera from ENU position + quaternion
- [ ] Test: can fly a hardcoded path over NYC in dev

### Phase 4: Input
- [ ] Implement `GamepadManager.ts`: poll + normalize
- [ ] Implement `AxisMapper.ts`: load/save config from localStorage
- [ ] Implement `RadioPresets.ts`: 3+ common radio configs
- [ ] Wire input → FlightController in GameLoop

### Phase 5: Game Loop
- [ ] Implement `GameLoop.ts`: fixed-step physics + rAF render sync
- [ ] Hook into `viewer.scene.preRender`
- [ ] Implement `TerrainSampler.ts`: async height check + crash/reset

### Phase 6: UI
- [ ] `LocationPicker`: Google Maps + Places Autocomplete → coords → store
- [ ] `SimView`: mount Cesium, start GameLoop on enter
- [ ] `HUD`: read from Zustand store telemetry slice
- [ ] `ControllerSetup`: axis wizard modal
- [ ] `App.tsx`: phase router PICKER → FLYING

### Phase 7: Polish
- [ ] FPV camera FOV, near/far clip, no roll-horizon line
- [ ] Drone model (simple GLTF 5" quad, or a geometric placeholder)
- [ ] ESC pause + resume (freeze physics loop)
- [ ] Battery drain simulation
- [ ] Crash effect: brief screen flash + auto-respawn at spawn point

---

## 12. Environment Variables
```env
VITE_GOOGLE_MAPS_API_KEY=...    # For Maps JS + Places + Tiles
VITE_CESIUM_ION_TOKEN=...       # Free tier, needed for Cesium asset loading
```
Both required. App shows API key setup guide if missing.

---

## 13. Key Dependencies

```json
{
  "dependencies": {
    "cesium": "^1.122.0",
    "zustand": "^4.5.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vite-plugin-cesium": "^1.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

---

## 14. Physics Constants (Default 5" Freestyle Quad)

```typescript
export const DEFAULT_DRONE_CONFIG = {
  mass: 0.550,             // kg (550g AUW)
  arm_length: 0.11,        // m (110mm, 5" quad)
  inertia: {
    xx: 0.003,             // kg⋅m²
    yy: 0.003,
    zz: 0.005
  },
  kT: 8.5e-6,              // Thrust coefficient (N per RPM²)
  kQ: 1.1e-7,              // Torque coefficient
  motor_time_constant: 0.05, // s (motor spin-up lag)
  max_throttle_rpm: 24000,
  drag_coefficient: 0.3,
  reference_area: 0.04,    // m²
  spawn_altitude: 10.0     // m AGL above terrain
};

export const DEFAULT_RATES = {
  roll_rate:  700,   // deg/s at full stick
  pitch_rate: 700,
  yaw_rate:   400,
  expo:       0.65   // Liftoff-comparable feel
};
```

---

## 15. Known Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Google 3D Tiles TOS — game use | Medium | Review ToS; personal/dev use OK; add required attribution |
| Radio not detected as gamepad | Medium | Manual axis mapping wizard as fallback |
| 3D Tiles no coverage (rural) | High | Fallback to CesiumJS terrain + satellite imagery (2D textured mesh) |
| CesiumJS camera jitter at low altitude | Medium | Set near clip to 0.1m; disable fog; fly > 1m AGL |
| Physics instability at high rates | Low | Clamp motor RPM, use RK4 not Euler, validate with hover test |
| Google Maps API cost | Low | 100K free tile calls/month is ample for dev; add cost warning in README |

---

## 16. Future Roadmap (Post-MVP)

- **v0.2:** Wind system (Dryden turbulence model), prop wash, Rapier mesh collision for buildings
- **v0.3:** Drone builder (motor KV, frame, battery config → physics params)
- **v0.4:** Ghost replay (record + replay FPV run)
- **v0.5:** Multiplayer (WebRTC peer positions, no shared physics)
- **v1.0:** FPV goggle mode (WebXR), DVR recording (MediaRecorder API)

---

*End of PRD v1.0*
