# Simulator improvement proposals

Assessed 2026-10-05. Statuses distinguish locally implemented features from deferred proposals.

## Current work

| ID | Scope | Status |
| --- | --- | --- |
| P1 | Wind presets, direction, bounded gusts, wind indication and rotor airflow texture | [Detailed design](../superpowers/specs/2026-10-05-wind-daylight-design.md) implemented locally; independent wind hiss removed; airspeed subtly modulates running rotor texture; verification in the [plan](../superpowers/plans/2026-10-05-wind-daylight.md) |
| P2 | Real-time Sun/Moon, time-dependent environment, pleasant default daylight | Same design implemented locally; verification in the [plan](../superpowers/plans/2026-10-05-wind-daylight.md) |
| F4 | Tile-cache documentation | README corrected to the configured 6 GiB, plus 0.5 GiB view overflow. This budget is intentional. |

## Deferred proposals

Every entry below requires a separate scope decision before implementation.

| ID | Proposal | Constraint |
| --- | --- | --- |
| P3 | True 3D collisions, impact-based landing/crash detection | Deferred. Current collision floor comes from height samples; walls and overhangs need richer geometry handling. |
| P4 | Battery discharge, voltage sag and current limits | Excluded from current work. Any future battery simulation is optional; default play remains unlimited. |
| P5 | Self-level mode, practice gates, timed challenges and flight-state replay | Deferred. Acro remains the current mode; video recording is already available. |
| P6 | Optional live weather | Deferred. Regional weather data cannot specify exact airflow around individual buildings. |
| R1 | Real-flight calibration of drag, rotor response and flight envelope | Proposed, undecided. Current drag and inertia coefficients include estimates; numerical consistency does not establish flight-data accuracy. |
| R2 | Propwash and descent thrust loss | Proposed, undecided. The current inflow model retains static thrust during descent. |
| R3 | Ground effect and wall/building aerodynamic effects | Proposed, undecided. Needs reliable surface clearance and geometry before adding proximity-dependent forces. |
| R4 | Controller profiles per device | Proposed, undecided. Current saved mapping uses one shared storage key. |
| R5 | Graphics quality and memory presets | Proposed, undecided. The current 6 GiB cache budget remains unchanged. |

## F3: frame-dependent crash timing

Status: reproduced; fix not approved.

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

Proposed correction: measure grace and contact confirmation in elapsed simulation time, independently of HUD publication.
Preserve the protection against transient terrain samples and keep god-mode recovery separate.

Evidence: [publisher](../../src/game/TelemetryPublisher.ts), [detector](../../src/game/CrashDetector.ts), [integration](../../src/game/GameLoop.ts).

## Research references

- [NASA drag equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/drag-equation/): drag coefficients require experimental calibration.
- [Linear rotor-drag research](https://arxiv.org/abs/1712.02402): experimentally validated model class, not calibration of this simulator's quad.
- [Atmospheric quadrotor simulation](https://arxiv.org/abs/1902.01465): wind-field and rotor-model fidelity affect predicted flight.
- [Ground-effect modeling](https://arxiv.org/abs/2506.19424) and [wall-proximity modeling](https://arxiv.org/abs/2509.21496): proximity changes forces and control response.
- [Open-Meteo documentation](https://open-meteo.com/en/docs): modeled current conditions, altitude-specific wind and gust statistics.
- [Open-Meteo licensing](https://open-meteo.com/en/pricing): commercial service access and data attribution requirements.
