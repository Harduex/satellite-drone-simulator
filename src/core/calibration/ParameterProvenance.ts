import type { PhysicsConfig } from '../physics/types';

export const MOTOR_BENCH_SOURCE = 'https://www.ligpower.com/product/f60prov-fpv-motor.html';
export const MOTOR_BENCH = [
  { command: 0.2, voltageV: 25.2, currentA: 2.1, rpm: 11132, thrustG: 227, powerW: 53.6 },
  { command: 0.4, voltageV: 25.2, currentA: 6.6, rpm: 16928, thrustG: 558.6, powerW: 165.2 },
  { command: 0.6, voltageV: 25.1, currentA: 13.7, rpm: 21409, thrustG: 910.7, powerW: 342.4 },
  { command: 0.8, voltageV: 25, currentA: 24.3, rpm: 26122, thrustG: 1403.4, powerW: 606.9 },
  { command: 1, voltageV: 24.8, currentA: 40.5, rpm: 30527, thrustG: 1882.5, powerW: 1002.8 },
] as const;

export interface ParameterEvidence {
  kind: 'measured' | 'derived' | 'estimate' | 'operational';
  units: string;
  source: string;
  method: string;
  confidence: 'high' | 'medium' | 'low';
  uncertainty: string;
}
const estimate = (units: string, method: string): ParameterEvidence => ({
  kind: 'estimate', units, source: 'src/core/physics/droneConfig.ts', method, confidence: 'low',
  uncertainty: 'No matched-airframe measurement or statistical confidence interval; not fitted to real-flight holdouts.',
});
const operational = (units: string, method: string): ParameterEvidence => ({
  kind: 'operational', units, source: 'src/core/physics/droneConfig.ts', method, confidence: 'high',
  uncertainty: 'Simulation preference; not a physical measurement.',
});

/** Confidence concerns hardware validity, not the number of passing synthetic tests. */
export const PHYSICS_PROVENANCE: Record<keyof PhysicsConfig, ParameterEvidence> = {
  mass: estimate('kg', 'Chosen representative 644g all-up 5-inch 6S profile; no measured specimen supplied.'),
  armLength: { ...estimate('m', 'Half the chosen 225mm diagonal wheelbase; X/Y motor offset is radius/sqrt(2).'), kind: 'derived' },
  inertia: estimate('kg m²; diagonal xx,yy,zz in body axes', 'Component-mass estimate; requires CAD mass distribution or pendulum measurement.'),
  kT: { ...estimate('N/RPM²', 'Static RPM-squared thrust fit to five 20–100% T5147-3/1750KV bench points.'),
    kind: 'derived', source: MOTOR_BENCH_SOURCE, confidence: 'medium',
    uncertainty: 'Five static points only, voltage 24.8–25.2V; bench throttle/ESC command equivalence and below-20% behavior unmeasured.' },
  kQ: estimate('N m/RPM²', 'Estimated shaft/electrical power consistency; no shaft-torque measurement.'),
  motorTimeConstant: estimate('s', 'First-order spin-up estimate; needs ESC RPM step recording.'),
  motorSpinDownFactor: estimate('dimensionless', 'Estimated asymmetry; down tau = up tau times factor.'),
  maxThrottleRpm: { kind: 'measured', units: 'RPM', source: MOTOR_BENCH_SOURCE,
    method: 'Published 1750KV/T5147-3 100% static point at 24.8V.', confidence: 'medium',
    uncertainty: 'Single manufacturer endpoint; no repeats, RPM sensor uncertainty or in-flight voltage compensation.' },
  motorResponseExponent: { ...estimate('dimensionless', 'Power-law approximation anchored at the published full-throttle RPM.'),
    kind: 'derived', source: MOTOR_BENCH_SOURCE, confidence: 'medium' },
  propellerPitch: { ...estimate('m/revolution', '4.7 inch nominal geometric pitch times 0.0254 m/inch; inflow use is heuristic.'),
    kind: 'derived', source: MOTOR_BENCH_SOURCE },
  dragCoefficient: estimate('dimensionless', 'Flight-envelope estimate; only Cd times area is observable from simple coast data.'),
  referenceArea: estimate('m²', 'Effective CdA estimate; advertised speed is not multiregime validation.'),
  verticalDragMultiplier: estimate('dimensionless', 'Estimated vertical/lateral CdA ratio.'),
  rotorDragCoefficient: { ...estimate('N/(m/s) at hover RPM', 'Separate linear lateral rotor-drag approximation, not a fit to this quad.'),
    source: 'src/core/physics/droneConfig.ts; https://arxiv.org/abs/1712.02402' },
  gentleWind: operational('boolean', 'Calm/breeze preference; WindConfig resolves speed and gusts.'),
  windSpeed: operational('m/s', 'Chosen mean breeze, not a weather observation.'),
  windDirection: operational('degrees clockwise from north; meteorological FROM', 'Chosen direction, not measured weather.'),
  windGustStrength: operational('m/s', 'Bounded seeded gust amplitude; not measured atmospheric turbulence.'),
  spawnAltitude: operational('m AGL', 'Initial spawn preference.'),
  thrustLinearization: operational('boolean', 'Optional sqrt-command mapping; false uses fitted power curve.'),
  loadVoltageSag: estimate('fractional RPM loss', 'Filtered load-based RPM reduction; no measured voltage, current or discharge model.'),
  loadSagTimeConstant: estimate('s', 'Estimated load filter transient; not measured pack dynamics.'),
  propwashThrustLoss: estimate('fraction of thrust', 'Bounded phenomenological descent loss; no paired thrust/acceleration observations.'),
  propwashTurbulence: estimate('N m', 'Bounded deterministic oscillatory torque, not measured stochastic turbulence.'),
  groundEffectStrength: estimate('fractional thrust boost', 'Bounded near-ground cushion; requires controlled height/thrust measurements.'),
  rotorDiameter: { ...estimate('m', 'Nominal 5.1 inch T5147-3 diameter times 0.0254 m/inch.'), kind: 'derived', source: MOTOR_BENCH_SOURCE },
  rotorInertia: estimate('kg m² per rotor', 'Propeller and motor-bell mass/distribution estimate; not vehicle diagonal inertia.'),
};

export const FIXED_PHYSICS_PROVENANCE = {
  gravity: { value: 9.81, units: 'm/s²', source: 'src/core/physics/DronePhysics.ts', method: 'Uniform local-gravity approximation', confidence: 'high' },
  airDensity: { value: 1.225, units: 'kg/m³', source: 'src/core/physics/DragModel.ts', method: 'Sea-level reference atmosphere, no altitude/temperature correction', confidence: 'medium' },
  angularDrag: { value: 0.00006, units: 'N m/(rad/s)²', source: 'src/core/physics/DragModel.ts', method: 'Estimated quadratic damping; unmeasured', confidence: 'low' },
  aeroShape: { source: 'src/core/physics/DronePhysics.ts: applyAeroThrustEffects', units: 'mixed SI and dimensionless; inline expressions',
    method: 'Inflow clamps, descent bells, wake frequencies, tandem wake and ground-cushion shapes are phenomenological; no fitted uncertainty bounds', confidence: 'low' },
  controller: { source: 'src/core/flight-controller/FlightController.ts; PIDController.ts', units: 'rad/s errors and normalized motor commands; seconds for smoothing',
    method: 'Simulation-tuned gains/filters/TPA, not Betaflight GUI parameters or a matched-controller identification', confidence: 'low' },
} as const;
