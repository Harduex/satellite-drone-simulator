# Physics calibration

P1 provides development measurements and optional Actual rates. It changes no default physical coefficient. Real-flight identification remains [R1](../ROADMAP.md).

## Run and compare

```sh
npm run calibrate -- --output=.local/calibration/before --verify
# Make a candidate change, then compare identical experiments:
npm run calibrate -- --output=.local/calibration/after --baseline=.local/calibration/before --verify
```

The equivalent direct command is `node scripts/calibrate-physics.mjs` with the same arguments.
Outputs must be Git-ignored. Preserve the baseline directory; output and baseline cannot be the same directory.
No network, provider credentials or optional datasets are needed. Existing Vite loads development TypeScript; no dependencies were added.

| Artifact | Contents |
| --- | --- |
| `report.json` | Source revision/dirty flag, machine/runtime, full configurations, parameter provenance, measured static errors, synthetic summaries, baseline differences, convergence, core timing, memory observations and verification status |
| `report.md` | Short generated interpretation and limits |
| `replays.json` | All raw samples and metadata for every scenario; input to subsequent baseline comparison |
| `<scenario>.csv` | Every step as decimal round-trip double precision; column names encode units |
| `tests.json`, `tests.log`, `build.log` | Actual verification output when `--verify` is supplied; without it, report explicitly says verification was not run |

The command returns failure for failed verification, nondeterministic runs, incompatible baselines or static errors outside the existing 6% RPM / 10% thrust limits. Timing variation and synthetic trajectory changes are reported, not interpreted as measured realism improvements. A failed build/test must not be described as passing based on another report.

## Replay contract

`src/core/calibration/FlightReplay.ts` exposes `replayFlight(ReplayOptions)` and `replayToCsv(report)`. Provide a complete `PhysicsConfig`, `RatesConfig`, `DroneState` and one input sample for each timestep. Input kind is explicitly `sticks` or `motors`. The default dt is 0.002s; alternative dt is for convergence experiments.

Use `--input=<scenario.json>` to append a custom `ReplayOptions` JSON scenario. For example, create it from the existing typed scenario definitions in `src/core/calibration/Scenarios.ts`; the generated `replays.json` contains complete effective settings and per-step input values. Custom-baseline comparisons require the same scenario set and identical inputs/initial conditions.

Each invocation constructs fresh motors at zero RPM, empty controller filters/integrators, reset propwash phase and seeded wind. Initial state means rigid-body position/velocity/orientation/rates, **not** a snapshot of warmed motor or filter state. To reproduce warmed operation, include its input history. This is a standalone numerical replay, not replay of Cesium collision geometry, browser USB delivery or the rounded browser blackbox.

Export contains initial state separately, then one sample after each completed step. Sample N has time `N * dt`; its input acted during the preceding dt. There is no decimation, Float32 conversion or ring-buffer truncation. JSON preserves ordinary finite JavaScript-number round-trip precision; CSV uses the same unrounded numbers. Sticks are absent (`null` / blank CSV fields) for direct motor experiments.

`effects` independently controls wind, flat-ground contact, ground cushion, propwash, inflow and load sag. Disabling inflow also disables its associated tandem-wake calculation. `requestedPhysicsConfig` records supplied values; `physicsConfig` records effective experiment values. Contact is the core flat-ground approximation, not the live world's sampled multi-plane surface system. Replay allocations occur in development capture only; the browser keeps its existing logger and ping-pong loop.

| Quantity | Convention |
| --- | --- |
| Position / velocity / wind | ENU meters / m/s; x east, y north, z up |
| Orientation | Unit quaternion `[w,x,y,z]`, body to world |
| Body angular velocity | rad/s, `[x pitch, y roll, z yaw]` |
| Positive sticks | roll → +body Y; forward pitch → −body X; right yaw → −body Z |
| Motors / RPM | M1 front-left CCW, M2 front-right CW, M3 back-right CCW, M4 back-left CW; modeled mechanical RPM |

Betaflight/Blackbox values require an explicit verified transform before import. This tool does not assume FRD/NED matches ENU, or that ESC command is measured RPM. Invalid/nonfinite inputs and non-unit initial quaternions are rejected.

## Evidence and provenance

`ParameterProvenance.ts` covers every configurable physics field and identifies fixed physical/model coefficients. Units, source, method, confidence and uncertainty are separate from parameter values. Hardware uncertainty remains unknown where no repeat measurements exist. Confidence labels are qualitative, not statistical confidence intervals.

The five [manufacturer measurements](https://www.ligpower.com/product/f60prov-fpv-motor.html) are F60 Pro V 1750KV + T5147-3 at 24.8–25.2V, 20/40/60/80/100% bench throttle. The report settles the actual MotorModel for two seconds with load sag disabled, isolating the static prop/motor curve. Baseline maximum errors are approximately 3.67% RPM and 4.17% thrust. Bench throttle equivalence to internal ESC command is an assumption; hover below 20% is extrapolated. These points do not measure lag, drag, vehicle inertia, torque, controller transients or propwash.

Synthetic scenarios cover hover command, motor step up/down, climb, coast, wind, propwash, near-ground and inverted flight, plus positive/negative axis pulses at 10/21/50% throttle. Before/after differences compare identical input sequences and metadata. They are regression errors against a simulation, not prediction errors against real flights. Position, velocity and attitude differences are reported at 0.1/0.25/0.5/1/2s when the run covers them. Quaternion error treats q and −q as the same orientation.

Gravity, motor `r × F`, yaw reaction and inverted thrust reuse the existing rigid-body tests. Replay adds precision, isolation, validation and ballistic Euler convergence tests. The actual GameLoop suite exercises 10/30/60/120 FPS, fractional steps, pause and 200ms/long stalls. The report also compares a common synthetic control pulse at 250/500/1000Hz to 2000Hz. This is a numerical diagnostic, not authority to replace the integrator.

Core p50/p95/p99 measure individual controller+physics steps after warmup. Timer/JIT/GC overhead is included. Scene queries, input devices, logging and rendering are excluded. Heap deltas are observations, not allocation-per-tick estimates or proof of no leak. Browser frame performance requires separate foreground flight measurements; the generated report explicitly leaves it unmeasured.

## Optional Actual rates

Settings → Controller → Flight rates is available without a connected radio. Original polynomial rates and saved `rollRate`/`pitchRate`/`yawRate`/`expo` keep their semantics. Actual settings live separately per axis; model switching retains both sets. The opt-in starting values are preferences, not identified hardware parameters.

For normalized stick x, center sensitivity c, maximum m and expo e, the curve is `c*x + max(0,m-c)*abs(x)*x*((1-e)+e*x^4)`, in deg/s. This independently expresses the [documented Actual rate model](https://betaflight.com/docs/wiki/guides/current/Rate-Calculator), cross-checked against [Betaflight's reference calculation](https://github.com/betaflight/betaflight/blob/master/src/main/fc/rc.c). Tests pin center slope, endpoints, symmetry, monotonicity and per-axis control signs. Existing RC smoothing, PID gains and output limits remain in effect; this does not claim Betaflight firmware/filter parity.

## Remaining validation

F1: No matched real-flight train/holdout recordings were supplied. The report leaves their errors and confidence intervals null. Obtain time-aligned sticks, setpoints, gyro, mechanical RPM, voltage/current, known airframe geometry/mass and independent velocity/position before fitting dynamic coefficients.

F2: Live browser checks passed on localhost in the foreground in-app browser: location autocomplete and launch, bounded keyboard throttle ramp, powered ascent, horizontal travel, yaw turn, Escape pause/resume and optional Actual-rate flight. The observed route reached 195m from home, 24.5m AGL and heading 23°. Original Polynomial rates and diagnostics visibility were restored, and the flight was left paused.

F3: Active-flight diagnostics showed approximately 60 FPS with traffic/pedestrians off. One 600-render Polynomial window reported median/p95/p99 16.8/23.8/24.3ms; a 319-render Actual window reported 16.7/23.2/24.9ms with recent tile requests. These observations establish usable flight for this scene; no paired pre-change browser baseline exists, so they do not prove zero FPS regression across devices or scenes. Screenshots and detailed measurements remain ignored local artifacts.

F4: No error-level console messages were captured. Nonfatal Google warnings remain: duplicate loader options, legacy autocomplete guidance and an elevation-service permission denial. The scene and flight continued despite that denial. Provider permissions are separate from physics calibration.

Rollback: select Polynomial to restore original rates; remove the optional rates configuration only when intentionally resetting it. Physical defaults are unchanged. Development reports and raw telemetry stay ignored.
