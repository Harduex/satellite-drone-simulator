# Simulator improvement proposals

Assessed 2026-10-05. Statuses distinguish locally implemented features from deferred proposals.

## Current work

| ID | Scope | Status |
| --- | --- | --- |
| P1 | Wind presets, direction, bounded gusts, wind indication and rotor airflow texture | [Detailed design](../superpowers/specs/2026-10-05-wind-daylight-design.md) implemented locally; independent wind hiss removed; airspeed subtly modulates running rotor texture; verification in the [plan](../superpowers/plans/2026-10-05-wind-daylight.md) |
| P2 | Real-time Sun/Moon, time-dependent environment, pleasant default daylight | Same design implemented locally; verification in the [plan](../superpowers/plans/2026-10-05-wind-daylight.md) |
| F4 | Tile-cache documentation | README corrected to the configured 6 GiB, plus 0.5 GiB view overflow. This budget is intentional. |

## Roadmap

Deferred P3–P6, proposed R1–R5 and F3 are maintained only in [the product roadmap](../ROADMAP.md). This document retains implementation and crash-timing evidence.

## F3: frame-dependent crash timing

Reproduced timing evidence; decision status and correction scope: [F3 in the roadmap](../ROADMAP.md).

`TelemetryPublisher.maybePublish()` publishes every sixth render frame. `GameLoop.tick()` calls `CrashDetector.check()` only on those frames.
`CrashDetector` counts 30 checks for spawn grace, then three consecutive low-clearance checks before respawn.

For a drone that remains grounded from spawn:

| Render rate | Crash checks/second | Spawn grace | First crash/respawn |
| --- | --- | --- | --- |
| 10 FPS | 1.67 | 18 seconds | 19.8 seconds |
| 30 FPS | 5 | 6 seconds | 6.6 seconds |
| 60 FPS | 10 | 3 seconds | 3.3 seconds |
| 120 FPS | 20 | 1.5 seconds | 1.65 seconds |

Method: feed a grounded `createDefaultDroneState(0)` through the actual publisher and detector once per simulated render frame.
The first crash occurs on render frame 198. These values exclude loading and pause time.
Ground contact still executes in the 500 Hz physics loop; the discrepancy concerns crash declaration, flash and automatic respawn.
After grace expires, confirmation takes three checks: approximately 1.8 seconds at 10 FPS versus 0.3 seconds at 60 FPS.

Evidence: [publisher](../../src/game/TelemetryPublisher.ts), [detector](../../src/game/CrashDetector.ts), [integration](../../src/game/GameLoop.ts).

## Research references

- [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/): drag coefficients require experimental calibration.
- [Linear rotor-drag research](https://arxiv.org/abs/1712.02402): experimentally validated model class, not calibration of this simulator's quad.
- [Atmospheric quadrotor simulation](https://arxiv.org/abs/1902.01465): wind-field and rotor-model fidelity affect predicted flight.
- [Ground-effect modeling](https://arxiv.org/abs/2506.19424) and [wall-proximity modeling](https://arxiv.org/abs/2509.21496): proximity changes forces and control response.
- [Open-Meteo documentation](https://open-meteo.com/en/docs): modeled current conditions, altitude-specific wind and gust statistics.
- [Open-Meteo licensing](https://open-meteo.com/en/pricing): commercial service access and data attribution requirements.
