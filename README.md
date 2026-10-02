# Satellite Drone Simulator

A browser-based FPV drone simulator where the **world is the map**. Search any real-world location, then fly over it in first-person view using a real radio controller or keyboard. Physics feel like Liftoff — realistic motor thrust, drag, inertia, and ground effect.

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

The Google key is used for the location picker, Places search, and Elevation.
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
├── game/           Game loop, crash detector, telemetry publisher, battery
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

- 5" freestyle quad (550g AUW)
- 4-motor X config with shared `MOTOR_LAYOUT` constant
- Euler integration at 500Hz; render frames catch up at 10 FPS or above
- Catch-up limited to 100ms after a render stall or inactive tab
- Radio sampled for each physics step (browser device updates may be slower)
- Quadratic throttle-to-thrust mapping; steady hover near 35% throttle
- Quadratic angular drag (`-k * |omega| * omega`)
- Direction-dependent translational drag (3x vertical multiplier for downwash)
- Asymmetric motor spin-up/down (spin-down 1.3x slower)
- Motor spin-up lag (first-order filter, τ=18ms)
- PID rate controller (Betaflight-comparable defaults)
- Configurable horizontal FOV (60-140°, default 110°), camera tilt default 25°

Saved custom settings are preserved. Physics Settings → Reset to Defaults applies
the baseline physics and camera setup. These defaults are a representative
starting point, not a calibration against recorded real-world flight data.

Physics Settings → God mode disables automatic crash respawns and crash flashes.
Ground contact remains active, allowing takeoff after impact. The choice is saved
locally; Reset to Defaults restores normal crash respawns.

## License

ISC
