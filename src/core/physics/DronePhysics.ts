import type {
  DroneState,
  MotorCommands,
  PhysicsConfig,
  Quaternion,
  Vector3,
} from "./types";
import {
  MOTOR_LAYOUT,
  quatMultiplyInto,
  quatNormalizeInto,
  quatRotateVectorInto,
  v3AddInto,
  v3CrossInto,
  v3ScaleInto,
  v3Set,
} from "./types";
import { MotorModel } from "./MotorModel";
import { computeAngularDragInto, computeTranslationalDragInto } from "./DragModel";

const GRAVITY = 9.81; // m/s²

// ── Scratch objects for step() ─────────────────────────
// Reused every step to avoid GC pressure. Safe because step()
// is synchronous and single-threaded.
const _thrustBody: Vector3 = { x: 0, y: 0, z: 0 };
const _thrustWorld: Vector3 = { x: 0, y: 0, z: 0 };
const _gravity: Vector3 = { x: 0, y: 0, z: 0 };
const _drag: Vector3 = { x: 0, y: 0, z: 0 };
const _netForce: Vector3 = { x: 0, y: 0, z: 0 };
const _temp1: Vector3 = { x: 0, y: 0, z: 0 };
const _motorTorque: Vector3 = { x: 0, y: 0, z: 0 };
const _angDrag: Vector3 = { x: 0, y: 0, z: 0 };
const _Iomega: Vector3 = { x: 0, y: 0, z: 0 };
const _gyro: Vector3 = { x: 0, y: 0, z: 0 };
const _netTorque: Vector3 = { x: 0, y: 0, z: 0 };
const _angAccel: Vector3 = { x: 0, y: 0, z: 0 };
const _linAccel: Vector3 = { x: 0, y: 0, z: 0 };
const _newVel: Vector3 = { x: 0, y: 0, z: 0 };
const _newPos: Vector3 = { x: 0, y: 0, z: 0 };
const _newAngVel: Vector3 = { x: 0, y: 0, z: 0 };
const _omegaQuat: Quaternion = { w: 0, x: 0, y: 0, z: 0 };
const _qDot: Quaternion = { w: 0, x: 0, y: 0, z: 0 };
const _preNormQuat: Quaternion = { w: 0, x: 0, y: 0, z: 0 };
const _newQuat: Quaternion = { w: 0, x: 0, y: 0, z: 0 };

/**
 * Quadrotor physics engine.
 * Computes forces and torques from motor thrusts, integrates state using Euler method.
 * Coordinate convention: ENU (East-North-Up), Z is up.
 *
 * Motor layout (X config, PRD §6.2):
 *   M1(CCW) --- M2(CW)      front
 *      \       /
 *       \     /
 *   M4(CW) --- M3(CCW)      back
 *
 * Motor positions relative to CoM:
 *   M1: (-d, +d, 0)  front-left
 *   M2: (+d, +d, 0)  front-right
 *   M3: (+d, -d, 0)  back-right
 *   M4: (-d, -d, 0)  back-left
 * where d = armLength * cos(45°)
 */
export class DronePhysics {
  private config: PhysicsConfig;
  private motorModel: MotorModel;
  private motorArmOffset: number; // armLength * cos(45°)
  private throttleBuffer: number[] = [0, 0, 0, 0];

  constructor(config: PhysicsConfig) {
    this.config = config;
    this.motorModel = new MotorModel(config);
    this.motorArmOffset = config.armLength * Math.cos(Math.PI / 4);
  }

  /**
   * Advance physics by dt seconds.
   * Uses Euler integration (upgrade to RK4 later if needed).
   * All intermediate math uses pre-allocated scratch objects — the only
   * allocation is the returned DroneState.
   * @param groundHeight Dynamic ground floor in ENU Z coords (from terrain sampler)
   */
  step(state: DroneState, motors: MotorCommands, dt: number, groundHeight: number = 0): DroneState {
    return this.stepInto(state, motors, dt, groundHeight, {
      position: { x: 0, y: 0, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      quaternion: { w: 1, x: 0, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0, z: 0 },
    });
  }

  stepInto(state: DroneState, motors: MotorCommands, dt: number, groundHeight: number, out: DroneState): DroneState {
    this.throttleBuffer[0] = motors.m1;
    this.throttleBuffer[1] = motors.m2;
    this.throttleBuffer[2] = motors.m3;
    this.throttleBuffer[3] = motors.m4;
    const thrusts = this.motorModel.update(this.throttleBuffer, dt);
    const reactionTorques = this.motorModel.getReactionTorques();

    // ── Compute net force in body frame ───────────────────
    const t1 = thrusts[0]!;
    const t2 = thrusts[1]!;
    const t3 = thrusts[2]!;
    const t4 = thrusts[3]!;

    // Total thrust along body Z axis (up)
    const totalThrust = t1 + t2 + t3 + t4;
    v3Set(_thrustBody, 0, 0, totalThrust);

    // Rotate thrust to world frame
    quatRotateVectorInto(state.quaternion, _thrustBody, _thrustWorld);

    // Gravity (world frame, Z is up in ENU)
    v3Set(_gravity, 0, 0, -this.config.mass * GRAVITY);

    // Translational drag (direction-dependent, body-frame aware)
    computeTranslationalDragInto(state.velocity, state.quaternion, this.config, _drag);

    // Net force = thrust + gravity + drag
    v3AddInto(_thrustWorld, _gravity, _temp1);
    v3AddInto(_temp1, _drag, _netForce);

    // ── Compute net torque in body frame (via MOTOR_LAYOUT) ──
    const d = this.motorArmOffset;
    let rollTorque = 0;
    let pitchTorque = 0;
    let yawTorque = 0;

    for (let i = 0; i < 4; i++) {
      const motor = MOTOR_LAYOUT[i]!;
      const thrust = thrusts[i]!;
      const reaction = reactionTorques[i]!;

      // Roll torque: thrust * posX * d (right motors → positive roll around Y)
      rollTorque += thrust * motor.posX * d;
      // Pitch torque: thrust * posY * d (front motors → positive pitch around X)
      pitchTorque += thrust * motor.posY * d;
      // Yaw torque: reaction torque * spin direction
      yawTorque += reaction * motor.spin;
    }

    // Body frame: X=right(pitch axis), Y=forward(roll axis), Z=up(yaw axis)
    v3Set(_motorTorque, pitchTorque, rollTorque, yawTorque);

    // Angular drag
    computeAngularDragInto(state.angularVelocity, _angDrag);

    // Gyroscopic effect: omega × (I * omega)
    const { xx, yy, zz } = this.config.inertia;
    const omega = state.angularVelocity;
    v3Set(_Iomega, xx * omega.x, yy * omega.y, zz * omega.z);
    v3CrossInto(omega, _Iomega, _gyro);

    // Net torque = motor torques + angular drag - gyroscopic
    v3AddInto(_motorTorque, _angDrag, _temp1);
    v3ScaleInto(_gyro, -1, _gyro);
    v3AddInto(_temp1, _gyro, _netTorque);

    // ── Angular acceleration ──────────────────────────────
    // alpha = I_inv * netTorque (diagonal inertia tensor)
    v3Set(_angAccel, _netTorque.x / xx, _netTorque.y / yy, _netTorque.z / zz);

    // ── Linear acceleration ───────────────────────────────
    v3ScaleInto(_netForce, 1 / this.config.mass, _linAccel);

    // ── Euler integration ─────────────────────────────────
    // Velocity
    v3ScaleInto(_linAccel, dt, _temp1);
    v3AddInto(state.velocity, _temp1, _newVel);

    // Position
    v3ScaleInto(state.velocity, dt, _temp1);
    v3AddInto(state.position, _temp1, _newPos);

    // Angular velocity (body frame)
    v3ScaleInto(_angAccel, dt, _temp1);
    v3AddInto(state.angularVelocity, _temp1, _newAngVel);

    // Quaternion kinematics: q_dot = 0.5 * q * [0, omega_body]
    // q rotates body→world, so omega_body is applied on the right.
    _omegaQuat.w = 0;
    _omegaQuat.x = state.angularVelocity.x;
    _omegaQuat.y = state.angularVelocity.y;
    _omegaQuat.z = state.angularVelocity.z;
    quatMultiplyInto(state.quaternion, _omegaQuat, _qDot);

    _preNormQuat.w = state.quaternion.w + 0.5 * _qDot.w * dt;
    _preNormQuat.x = state.quaternion.x + 0.5 * _qDot.x * dt;
    _preNormQuat.y = state.quaternion.y + 0.5 * _qDot.y * dt;
    _preNormQuat.z = state.quaternion.z + 0.5 * _qDot.z * dt;
    quatNormalizeInto(_preNormQuat, _newQuat);

    // ── Hard altitude floor at dynamic ground height (terrain + buildings) ──
    let fpX = _newPos.x, fpY = _newPos.y, fpZ = _newPos.z;
    let fvX = _newVel.x, fvY = _newVel.y, fvZ = _newVel.z;
    let favX = _newAngVel.x, favY = _newAngVel.y, favZ = _newAngVel.z;

    // Pre-integration check: if on ground with downward velocity, kill immediately
    if ((state.position.z <= groundHeight && _newVel.z < 0) || _newPos.z < groundHeight) {
      fpZ = groundHeight;
      fvX = 0; fvY = 0; fvZ = 0;
      favX = 0; favY = 0; favZ = 0;
    }

    // Write final values into pre-allocated output — zero allocation
    out.position.x = fpX; out.position.y = fpY; out.position.z = fpZ;
    out.velocity.x = fvX; out.velocity.y = fvY; out.velocity.z = fvZ;
    out.quaternion.w = _newQuat.w; out.quaternion.x = _newQuat.x;
    out.quaternion.y = _newQuat.y; out.quaternion.z = _newQuat.z;
    out.angularVelocity.x = favX; out.angularVelocity.y = favY; out.angularVelocity.z = favZ;
    return out;
  }

  getMotorModel(): MotorModel {
    return this.motorModel;
  }

  updateConfig(partial: Partial<PhysicsConfig>): void {
    Object.assign(this.config, partial);
  }

  reset(): void {
    this.motorModel.reset();
  }
}
