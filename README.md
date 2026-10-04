# Satellite Drone Simulator

A browser-based FPV drone simulator where the **world is the map**. Search any real-world location, then fly over it in first-person view using a real radio controller or keyboard. Physics feel like Liftoff — realistic motor thrust, drag, inertia, and inflow thrust loss.

## Quick Start

```bash
# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env and add your API keys (see below)

# Start dev server
npm run dev
```

Open `http://localhost:5173` in your browser.

## API Keys

Create a `.env` file with:

```
VITE_GOOGLE_MAPS_API_KEY=your_key_here
VITE_CESIUM_ION_ACCESS_TOKEN=your_token_here
```

### Google Maps Platform

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Elevation API
3. Create an API key and add it to `.env`

The Google key is used for the location picker, flight minimap, Places search, and Elevation.
Google Map Tiles API is not required.

### Cesium ion

1. Sign in to [Cesium ion](https://ion.cesium.com/).
2. Add **Google Photorealistic 3D Tiles** from the Asset Depot to **My Assets**.
3. Create an access token with access to that asset and **Cesium World Imagery**
   (the globe's default base imagery). Add it as `VITE_CESIUM_ION_ACCESS_TOKEN`.
4. Restart the dev server after changing `.env`.

The 3D world loads through Cesium ion using `createGooglePhotorealistic3DTileset`.
Never commit real keys or tokens.

## How to Use

1. **Search** — Type a location in the search bar (or click the map)
2. **Fly Here** — Click the button to enter FPV view
3. **Fly** — Use keyboard controls or plug in a radio controller
4. **Pause** — Press ESC to pause, change location, or adjust settings

The bottom-right satellite minimap shows the drone's heading, launch point (H),
and recent flight trail. Its footer shows horizontal distance and direction home.
Use −/+ to collapse or expand it. Navigation updates at 5 Hz; the trail retains
up to 300 points, sampled after at least 2 m of horizontal travel, and clears on reset.
The picker and minimap share one Google Maps instance across flight and pause.
Moving into new areas can still fetch map imagery; navigation itself needs no
Places or Elevation queries. Offline/custom-map support remains experimental.

## Controls

### Keyboard

| Key                | Action               |
| ------------------ | -------------------- |
| W / S              | Throttle up / down   |
| A / D              | Yaw left / right     |
| Arrow Up / Down    | Pitch forward / back |
| Arrow Left / Right | Roll left / right    |
| ESC                | Pause / Resume       |

### Radio Controller (USB)

Plug in your FPV radio via USB-C in Joystick mode. Supported radios with auto-detected presets:

- RadioMaster (Boxer, TX16S, Pocket, Zorro)
- Jumper (T-Pro, T-Lite)
- TBS Tango 2
- BETAFPV LiteRadio 2 SE

Any radio with 4+ axes works — use the Controller Setup wizard to map custom axes.

## Rendering

Rendering follows display density up to 1.5 pixels per CSS pixel, limiting
high-DPI rendering to 2.25 times the baseline pixel count. Cesium's default 4×
MSAA remains in use where supported. Tile-detail settings are unchanged.

## Tile reuse during practice

Keep the app tab open between flights. Resetting, pausing, and changing locations
reuse the same Google tileset and its loaded tiles. The tileset retains up to
1.5 GiB of tile content, with another 0.5 GiB available for the current view.
Cesium may evict older tiles when this budget fills. Unseen sibling tiles are
not speculatively downloaded; turning toward a new area can require streaming.

Browser HTTP caching follows the server's expiry and revalidation headers.
There is no permanent/offline download cache. See the
[Google tile caching policy](https://developers.google.com/maps/documentation/tile/policies).
Cesium ion Community currently includes
[1,000 Google root-tile requests per month](https://cesium.com/platform/cesium-ion/pricing/);
these are distinct from individual content-tile requests. Reloading the app
discards its in-memory tileset and can require another root request.

## Commands

Project knowledge is indexed in [Documentation](docs/README.md), including
[offline maps experiment notes](docs/experiments/offline-maps.md). The Google map mode remains the default.

```bash
npm run dev       # Start development server
npm run build     # Production build
npm run preview   # Preview production build
npm run test      # Run physics + PID tests
npm run test:watch # Watch mode tests
```

## Architecture

```
src/
├── core/           Pure physics + input logic (zero external deps)
│   ├── physics/    500Hz quadrotor force model, Euler integrator
│   ├── flight-controller/  PID rate controller + motor mixing
│   └── input/      Gamepad API, axis mapping, keyboard fallback
├── world/          CesiumJS: 3D tiles, coordinates, terrain
├── camera/         FPV camera sync (horizontal FOV, default 110°)
├── game/           Game loop, crash detector, telemetry publisher, motor audio
├── store/          Zustand state management
└── ui/             React UI overlays + theme.ts design token system
```

## Tech Stack

- **Renderer**: CesiumJS with Google Photorealistic 3D Tiles
- **Physics**: Custom quadrotor force model at 500Hz
- **Input**: Web Gamepad API + keyboard fallback
- **UI**: React 19 + Zustand (minimal overlays)
- **Build**: Vite + TypeScript

## Physics Model

- 5" 6S freestyle quad, representative build: 644g AUW, 225mm wheelbase, symmetric X
- 4-motor X config with shared `MOTOR_LAYOUT` constant
- Euler integration at 500Hz; render frames catch up at 10 FPS or above
- Catch-up limited to 100ms after a render stall or inactive tab
- Radio sampled for each physics step (browser device updates may be slower)
- Loaded RPM curve (`RPM = maxRPM * command^0.65`), thrust `kT * RPM²`; hover near 15% raw command, ~11:1 static thrust-to-weight
- Axial-inflow thrust loss: thrust falls linearly to zero at prop pitch speed (climb/forward flight)
- Quadratic angular drag (`-k * |omega| * omega`)
- Direction-dependent translational drag (3x vertical multiplier for downwash)
- Frame drag and propeller inflow use air-relative velocity (drone velocity minus wind).
- Lateral rotor drag scales with loaded motor RPM; conservative hover coefficient 0.025 N/(m/s).
- Gentle breeze defaults to 1.5 m/s with smooth horizontal variation below 0.4 m/s and vertical variation below 0.05 m/s. Physics Settings → Gentle breeze off selects calm air.
- Wind advances with simulation time, freezes on pause, and resets with the flight. The bounded wind model and rotor-drag coefficient are flight-feel approximations, not measured weather or flight-data calibration.

- Asymmetric motor spin-up/down (spin-down 1.3x slower)
- Motor spin-up lag (first-order filter, τ=18ms)
- PID rate controller (simulation-tuned gains; not Betaflight GUI units)
- Configurable horizontal FOV (60-140°, default 110°), camera tilt default 25°

Aerodynamic basis: [NASA's drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/) and [experimentally validated linear rotor drag](https://arxiv.org/abs/1712.02402). Frame drag and rotor drag are separate effects; the existing frame-drag calibration remains within the reference flight-envelope test after adding rotor drag.

Potential realism extensions: [ground effect](https://arxiv.org/abs/2506.19424) can add lift and attitude-dependent forces near a surface; [wall proximity](https://arxiv.org/abs/2509.21496) can alter aerodynamic forces close to buildings. These need reliable local clearance and surface geometry before implementation. The current model does not simulate building wakes, ground effect, or descent propwash.

### Calibration sources

| Parameter | Value | Basis |
|---|---|---|
| Mass, wheelbase | 644g, 225mm | Published: [iFlight Nazgul Evoque F5 V2](https://shop.iflight.com/Nazgul-Evoque-F5-V2-6S-Pro1954) (with 6S 1400mAh) |
| Max RPM, `kT`, RPM curve | 30527, 1.94e-8 N/RPM², exp 0.65 | Fit to [T-Motor F60 Pro V 1750KV + T5147-3 bench](https://www.ligpower.com/cn/product/f60prov-fpv-motor.html) (RPM within 6%, thrust within 10% at 20–100%) |
| Prop pitch | 4.7in | T5147-3 geometry |
| `kQ` | 2.5e-10 | Estimate: implied shaft power ≈ 67–77% of bench electrical power |
| Inertia | 0.00165 / 0.00125 / 0.0027 kg·m² | Estimate: point-mass motors, arms, central battery/body |
| Cd·A | 0.007 m² lateral (3x vertical) | Estimate: tuned so level top speed ≈ the advertised 190 km/h |
| Motor lag | 18ms | Estimate |
| FOV | 110° horizontal | Approximation of [DJI O3](https://www.dji.com/o3-air-unit/video) 12.7mm-equivalent lens (155° is diagonal); not a calibrated live-feed FOV |

Not modeled: battery voltage sag/discharge, current limits, motor heating,
edgewise-flow/propwash effects, vortex ring state, ground effect, and lens distortion.
Bench power figures inform estimates only; there is no power-consumption simulation.
Hover below 20% command is extrapolated from the bench curve.

Saved custom settings are preserved. Physics Settings → Reset to Defaults applies
the baseline physics and camera setup. These defaults are a representative
starting point, not a calibration against recorded real-world flight data.

Physics Settings → God mode disables automatic crash respawns and crash flashes.
Ground contact remains active, allowing takeoff after impact. The choice is saved
locally; Reset to Defaults restores normal crash respawns.

## License

ISC
