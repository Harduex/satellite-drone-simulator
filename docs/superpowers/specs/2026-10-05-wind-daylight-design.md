# Wind and daylight

**Date:** 2026-10-05
**Scope:** P1/P2: configurable gentle weather and location-correct daylight for free-flight pilots.
**Status:** Approved design; implementation has not started.

## TL;DR

Wind gains Calm, Light and Breezy presets, direction controls and smoothly varying bounded gusts. Light remains the default; existing aerodynamic coefficients remain unchanged. A compact HUD indicator and airspeed-driven airflow sound make the environment perceptible. Real-time daylight uses the machine's UTC instant at the selected flight location. The default freezes at solar noon, with a bright seasonal fallback where noon is too dark for pleasant flying. Cesium supplies the astronomical positions; the environment uses one time source for sky, Sun, Moon and lighting. Google photogrammetry retains photographed shadows, so its day/night appearance remains an approximation. Settings remain local, require no new credentials, and make no weather-service requests. Battery, training features, collision changes and crash-timing changes are outside this implementation.

## Architecture

```text
┌──────────────────────────────────────────────────────┐
│ UI / STORE [React + Zustand]                         │
│ PhysicsSettings: presets + controls (NEW)            │
│ FlightSettings: real-time switch (NEW)               │
│ HUD: wind cue (NEW)                                  │
│ SettingsPersistence: migration + validation (reused) │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ FLIGHT [TypeScript]                                  │
│ PhysicsConfig: 3 wind fields (NEW)                   │
│ WindModel: seeded bounded gusts (reused)             │
│ GameLoop / SimSession: environment inputs (reused)   │
│ DroneAudio: relative-airflow sound (reused)          │
│ DronePhysics: air-relative forces (reused)           │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ WORLD [CesiumJS]                                     │
│ CesiumManager: clock / celestial lifecycle (reused)  │
│ DaylightSky: day / twilight / night (reused)         │
│ TileLoader: exposure uniforms (reused)               │
│ Cloud drift: mean wind + pause (reused)              │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ DEPENDENCIES [existing; no new service]              │
│ Cesium: clock, ephemerides, lights, shadows          │
│ Google tiles: photographed textures                  │
│ Machine UTC / localStorage: environment inputs       │
└──────────────────────────────────────────────────────┘
```

The design extends the existing flight and renderer paths; it adds no server or external weather integration.

## Contract

### P1: wind

`PhysicsConfig` gains numeric `windSpeed`, `windDirection` and `windGustStrength` fields. Values use m/s and meteorological degrees clockwise from north.
Direction describes where wind comes from; ENU velocity describes where air travels.

| Control | Value | Behavior |
| --- | --- | --- |
| Calm preset | Speed 0, gust strength 0 | Zero wind force; rotor/body drag still acts on drone airspeed |
| Light preset | Speed 1.5, gust strength 0.35 m/s | Default; preserves the current gentle scale |
| Breezy preset | Speed 4, gust strength 1 m/s | Optional, clearly stronger conditions |
| Speed | 0–8 m/s | Mean horizontal air velocity |
| Direction | 0–360 degrees | Normalized to [0, 360); preset selection preserves chosen direction |
| Gust strength | 0–2 m/s | Maximum horizontal perturbation magnitude; vertical variation stays within 10% of this value |

Default wind direction is approximately 233 degrees, preserving the current southwest-to-northeast breeze.
Legacy `gentleWind=false` migrates to Calm. Legacy enabled or missing settings migrate to Light unless explicit valid wind fields exist.
Invalid persisted fields use defaults; finite numeric fields are clamped to the stated ranges.
Reset to Defaults restores Light and the default direction.

`WindModel` generates seeded, smoothly filtered temporal variation at fixed simulation steps and writes into the existing output vector.
The generator uses bounded perturbations, resets reproducibly with flight reset, and stops advancing on pause.
This is a lightweight weather approximation, not a measured wind field or a full turbulence-spectrum model.
It applies no arbitrary angular kicks and adds no allocation to the physics hot path.

The HUD displays wind speed and its direction relative to drone heading. It labels the arrow as airflow travel direction.
Airflow audio follows relative airspeed, while motor tones continue following RPM and the existing volume/mute controls.
Cloud drift follows the configured mean wind through an explicit renderer input; it does not read physics internals.
Cloud position advances incrementally and freezes on pause, avoiding jumps when changing settings or resuming.

### P2: daylight

`SettingsSlice` gains persisted boolean `realTimeOfDay`, default `false`. Flight Settings exposes a switch labeled "Real time of day".
Reset to Defaults restores pleasant daylight. Existing camera, audio and wind preferences retain their established reset behavior.

| Mode | Time and environment |
| --- | --- |
| Real time enabled | Current machine UTC instant; selected location determines the visible sky. Daylight continues tracking wall time while flight physics is paused. |
| Real time disabled | Selected location's solar noon on its current local solar date, frozen. If solar elevation is below 15 degrees, use hemisphere summer-solstice noon. |

Solar noon includes the equation-of-time correction, rather than selecting 12:00 civil time or retaining the current 13:30 approximation.
Cesium's Sun/Moon ephemerides and supported coordinate transformations supply positions in the selected location's sky.
The Moon receives sunlight with correct relative geometry; it is not placed opposite the Sun by assumption.
Night lighting uses a weak Moon-directed light whose intensity varies with lunar illumination and horizon visibility.

The sky responds to solar elevation with daylight, twilight and night colors. Sun/Moon visibility respects the horizon.
Cloud brightness, fog brightness and scene exposure use the same environment state.
The local panorama must remain compatible with the FPV camera's 30 km far plane and must not obscure celestial rendering.
Sky/exposure transitions are continuous; local panorama textures are not regenerated every render frame.

Supported lit geometry uses the scene's directional light and shadow map. Google tile exposure follows the environment through the existing color-grading shader.
Google tile self-shadows remain disabled because photographed shadows cannot be removed from the textures.
The feature does not promise physically correct moving building shadows or generated city lights on Google photogrammetry.
Lighting/shadow behavior on a representative Google scene is a required visual acceptance check, not an assumption from API availability.

## Resolution and flow

1. `SettingsPersistence` reads and validates settings, migrates the legacy breeze flag, and preserves valid saved overrides.
2. Settings controls update Zustand. Launch and resume apply the validated configuration through `SimSession` and `GameLoop`.
3. Each 500 Hz step samples wind once, then passes that vector into `DronePhysics`; thrust inflow and drag share relative air velocity.
4. Render updates publish wind indication at a bounded cadence and supply relative airspeed to `DroneAudio`.
5. `CesiumManager` owns daylight state and renderer cleanup. `SimSession` supplies location, time mode and mean cloud wind.
6. Pause freezes flight/wind/cloud motion. Real-time astronomy remains tied to machine time; resume does not replay paused physics time.
7. Reset restores flight and seeded wind state without changing the chosen environment settings or real-time instant.

## Key decisions

| ID | Decision | Why |
| --- | --- | --- |
| D1 | Preserve drag coefficients | Larger drag changes the calibrated flight envelope; stronger optional weather and better cues address weak perception directly. |
| D2 | Keep the Light preset near 1.5 m/s | Retains the deliberately gentle default while the 4 m/s Breezy preset provides an obvious comparison. |
| D3 | Separate wall-clock daylight from simulation wind | Real-time mode means current time even during pause; wind remains reproducible at 500 Hz. |
| D4 | Use Cesium astronomy | Existing dependency supplies Sun/Moon positions without an additional package, API credential or network request. |
| D5 | Retain the local sky strategy | Planet-scale atmosphere and celestial geometry need validation against the existing 30 km FPV frustum. |
| D6 | Preserve the 6 GiB tile-cache budget | Environmental settings do not change the intentional streaming-memory configuration. |

## Rejected alternatives

| Option | Why rejected |
| --- | --- |
| Increase drag globally to make wind noticeable | Changes calm-air coasting and top speed; it does not introduce weather variation. |
| Add arbitrary gust-induced rotation | Introduces unsupported torque without rotor/surface aerodynamic data. |
| Apply machine local clock hours at the flying location | Gives incorrect sunlight when the machine and selected location are in different time zones. |
| Treat the Moon as a Sun-opposite sprite | Gives incorrect position and illumination geometry. |
| Enable all Google tile shadows unconditionally | Photographed shadows remain; current code documents self-shadow striping. |

## Failure modes

| When | Where | Result |
| --- | --- | --- |
| Invalid or obsolete saved values | `SettingsPersistence` | Migration or bounded defaults; non-finite values never reach physics/render math |
| Storage unavailable | Settings boundary | In-memory operation remains usable; persistence failure follows the existing settings policy |
| Machine time changes or tab resumes | Daylight renderer | Re-synchronize to the new UTC instant; prevent invalid values and stale light directions |
| Solar noon is dark or very low | Pleasant-day selection | Use the defined seasonal fallback; real-time mode preserves the actual conditions |
| Scene/session ends during an update | Renderer lifecycle | Remove listeners and owned primitives; no updates target a destroyed viewer |
| Google imagery retains daylight shadows at night | Tile color grading | Approximate night exposure; documented dataset limitation |

Settings survive session teardown; runtime wind, clouds and celestial resources do not outlive their owning session/viewer.

## Analogous feature and parity

The existing `gentleWind` setting establishes the integration surfaces below.

| Surface | In scope? | Reason |
| --- | --- | --- |
| `PhysicsConfig`, defaults and saved settings | Yes | Wind configuration and legacy migration |
| `PhysicsSettings` and Reset to Defaults | Yes | Presets, direction and gust controls |
| `GameLoop` launch/resume/reset | Yes | Fixed-step wind and configuration updates |
| `FlightSettings`, HUD and `DroneAudio` | Yes | Time toggle and environmental cues |
| `CesiumManager`, `DaylightSky`, `TileLoader` | Yes | Time-dependent sky, clouds and exposure |
| `DronePhysics` force coefficients and collision floor | No | Existing air-relative integration is retained |

## Acceptance checks

- Calm gives zero wind; relative-air drag still works. Light/Breezy remain bounded, seeded and reproducible across render cadences.
- Pause/reset/settings migration preserve their contracts. Cloud motion freezes without a resume jump.
- Airflow sound responds to relative speed without changing motor RPM pitch or bypassing mute.
- Real-time mode matches the machine UTC instant at distant longitudes; default selects corrected solar noon and polar fallback.
- Sun/Moon positions, twilight, night exposure and transitions are checked in-browser at known dates and locations.
- Search/launch, HUD/input ramping, ESC pause, location switching and recording still work. Console has no fatal errors.
- Existing tests and build pass; meaningful tests cover migration, wind bounds, clock behavior and lifecycle cleanup.

## Out of scope

Deferred proposals and F3 crash timing are tracked in [simulator improvements](../../experiments/simulator-improvements.md).
Real-flight calibration, propwash, ground/wall effects, live weather, battery limits, new collision geometry, training and controller/graphics profiles remain separate work.

## References

- [Cesium Clock](https://cesium.com/learn/cesiumjs/ref-doc/Clock.html): system-clock mode and property interactions.
- [Cesium Sun/Moon positions](https://cesium.com/learn/cesiumjs/ref-doc/Simon1994PlanetaryPositions.html): astronomical position calculations.
- [NOAA solar calculations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF): equation of time and solar noon.
- [Cesium custom shader](https://cesium.com/learn/cesiumjs/ref-doc/CustomShader.html): supported material controls.
