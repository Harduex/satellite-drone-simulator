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
```

### Google Maps Platform
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable these APIs:
   - Maps JavaScript API
   - Places API
   - Map Tiles API
3. Create an API key and add it to `.env`

## How to Use

1. **Search** — Type a location in the search bar (or click the map)
2. **Fly Here** — Click the button to enter FPV view
3. **Fly** — Use keyboard controls or plug in a radio controller
4. **Pause** — Press ESC to pause, change location, or adjust settings

## Controls

### Keyboard

| Key | Action |
|-----|--------|
| W / S | Throttle up / down |
| A / D | Yaw left / right |
| Arrow Up / Down | Pitch forward / back |
| Arrow Left / Right | Roll left / right |
| ESC | Pause / Resume |

### Radio Controller (USB)

Plug in your FPV radio via USB-C in Joystick mode. Supported radios with auto-detected presets:
- RadioMaster (Boxer, TX16S, Pocket, Zorro)
- Jumper (T-Pro, T-Lite)
- TBS Tango 2
- BETAFPV LiteRadio 2 SE

Any radio with 4+ axes works — use the Controller Setup wizard to map custom axes.

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
├── camera/         FPV camera sync (configurable FOV, default 90°)
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
- Euler integration at 500Hz (decoupled from render)
- Quadratic angular drag (`-k * |omega| * omega`)
- Direction-dependent translational drag (3x vertical multiplier for downwash)
- Asymmetric motor spin-up/down (spin-down 2x slower)
- Motor spin-up lag (first-order filter, τ=50ms)
- PID rate controller (Betaflight-comparable defaults)
- Configurable FOV (60-140°, default 90°)

## License

ISC
