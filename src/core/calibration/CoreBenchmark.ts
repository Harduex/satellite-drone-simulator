import { DronePhysics } from '../physics/DronePhysics';
import { FlightController } from '../flight-controller/FlightController';
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from '../physics/droneConfig';
import { createDefaultDroneState, type RatesConfig } from '../physics/types';

/** Measures core update work only; excludes replay capture, scene queries and rendering. */
export function benchmarkCore(rates: RatesConfig = DEFAULT_RATES) {
  const timings = new Float64Array(100000);
  const sticks = { throttle: 0.21, roll: 0, pitch: 0, yaw: 0 };
  let totalMs = 0;
  for (let batch = 0; batch < 240; batch++) {
    const physics = new DronePhysics({ ...DEFAULT_DRONE_CONFIG });
    const controller = new FlightController(rates);
    let state = createDefaultDroneState(1000), next = createDefaultDroneState(1000);
    const motors = { m1: 0, m2: 0, m3: 0, m4: 0 };
    for (let i = 0; i < 500; i++) {
      sticks.roll = i >= 100 && i < 125 ? 0.1 : 0;
      sticks.pitch = i >= 200 && i < 225 ? 0.1 : 0;
      sticks.yaw = i >= 300 && i < 325 ? 0.1 : 0;
      const start = performance.now();
      controller.updateInto(sticks, state, 0.002, motors);
      physics.stepInto(state, motors, 0.002, -1e9, next, undefined, false);
      const elapsed = performance.now() - start;
      const previous = state; state = next; next = previous;
      if (batch >= 40) { timings[(batch - 40) * 500 + i] = elapsed; totalMs += elapsed; }
    }
  }
  timings.sort();
  return { method: 'Individual controller.updateInto + physics.stepInto wall milliseconds; timer overhead included',
    warmupSteps: 20000, measuredSteps: timings.length, resetEverySteps: 500,
    p50Ms: timings[49999]!, p95Ms: timings[94999]!, p99Ms: timings[98999]!, meanMs: totalMs / timings.length,
    limitations: 'Node/JIT/GC/timer noise; excludes browser render, tile/collision sampling, gamepad and telemetry. Not a browser FPS claim.' };
}
