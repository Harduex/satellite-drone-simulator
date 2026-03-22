import type {
  DroneState,
  MotorCommands,
  PhysicsConfig,
  Quaternion,
  Vector3,
} from "./types";
import {
  MOTOR_LAYOUT,
  quatMultiply,
  quatNormalize,
  quatRotateVector,
  V3_ZERO,
  v3Add,
  v3Cross,
  v3Scale,
  vec3,
} from "./types";
import { MotorModel } from "./MotorModel";
import { computeAngularDrag, computeTranslationalDrag } from "./DragModel";

const GRAVITY = 9.81; // m/s²

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

  constructor(config: PhysicsConfig) {
    this.config = config;
    this.motorModel = new MotorModel(config);
    this.motorArmOffset = config.armLength * Math.cos(Math.PI / 4);
  }

  /**
   * Advance physics by dt seconds.
   * Uses Euler integration (upgrade to RK4 later if needed).
   * @param groundHeight Dynamic ground floor in ENU Z coords (from terrain sampler)
   */
  step(state: DroneState, motors: MotorCommands, dt: number, groundHeight: number = 0): DroneState {
    const throttles = [motors.m1, motors.m2, motors.m3, motors.m4];
    const thrusts = this.motorModel.update(throttles, dt);
    const reactionTorques = this.motorModel.getReactionTorques();

    // ── Compute net force in body frame ───────────────────
    const t1 = thrusts[0]!;
    const t2 = thrusts[1]!;
    const t3 = thrusts[2]!;
    const t4 = thrusts[3]!;

    // Total thrust along body Z axis (up)
    const totalThrust = t1 + t2 + t3 + t4;
    const thrustBodyFrame: Vector3 = vec3(0, 0, totalThrust);

    // Rotate thrust to world frame
    const thrustWorldFrame = quatRotateVector(
      state.quaternion,
      thrustBodyFrame,
    );

    // Gravity (world frame, Z is up in ENU)
    const gravity: Vector3 = vec3(0, 0, -this.config.mass * GRAVITY);

    // Translational drag (direction-dependent, body-frame aware)
    const drag = computeTranslationalDrag(state.velocity, state.quaternion, this.config);

    // Net force
    const netForce = v3Add(v3Add(thrustWorldFrame, gravity), drag);

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
    const motorTorque: Vector3 = vec3(pitchTorque, rollTorque, yawTorque);

    // Angular drag
    const angularDrag = computeAngularDrag(state.angularVelocity);

    // Gyroscopic effect: omega × (I * omega)
    const { xx, yy, zz } = this.config.inertia;
    const omega = state.angularVelocity;
    const Iomega: Vector3 = vec3(xx * omega.x, yy * omega.y, zz * omega.z);
    const gyro = v3Cross(omega, Iomega);

    // Net torque = motor torques + angular drag - gyroscopic
    const netTorque = v3Add(v3Add(motorTorque, angularDrag), v3Scale(gyro, -1));

    // ── Angular acceleration ──────────────────────────────
    // alpha = I_inv * netTorque (diagonal inertia tensor)
    const angularAccel: Vector3 = vec3(
      netTorque.x / xx,
      netTorque.y / yy,
      netTorque.z / zz,
    );

    // ── Linear acceleration ───────────────────────────────
    const linearAccel = v3Scale(netForce, 1 / this.config.mass);

    // ── Euler integration ─────────────────────────────────
    // Velocity
    const newVelocity = v3Add(state.velocity, v3Scale(linearAccel, dt));

    // Position
    const newPosition = v3Add(state.position, v3Scale(state.velocity, dt));

    // Angular velocity (body frame)
    const newAngularVelocity = v3Add(
      state.angularVelocity,
      v3Scale(angularAccel, dt),
    );

    // Quaternion kinematics: q_dot = 0.5 * q * [0, omega_body]
    // q rotates body→world, so omega_body is applied on the right.
    const omegaQuat: Quaternion = {
      w: 0,
      x: state.angularVelocity.x,
      y: state.angularVelocity.y,
      z: state.angularVelocity.z,
    };
    const qDot = quatMultiply(state.quaternion, omegaQuat);
    const newQuaternion = quatNormalize({
      w: state.quaternion.w + 0.5 * qDot.w * dt,
      x: state.quaternion.x + 0.5 * qDot.x * dt,
      y: state.quaternion.y + 0.5 * qDot.y * dt,
      z: state.quaternion.z + 0.5 * qDot.z * dt,
    });

    // ── Hard altitude floor at dynamic ground height (terrain + buildings) ──
    let finalPosition = newPosition;
    let finalVelocity = newVelocity;
    let finalAngularVelocity = newAngularVelocity;

    // Pre-integration check: if on ground with downward velocity, kill immediately
    if (state.position.z <= groundHeight && newVelocity.z < 0) {
      finalPosition = vec3(newPosition.x, newPosition.y, groundHeight);
      finalVelocity = V3_ZERO;
      finalAngularVelocity = V3_ZERO;
    } else if (newPosition.z < groundHeight) {
      // Post-integration: clamp position and zero ALL motion (hard stop)
      finalPosition = vec3(newPosition.x, newPosition.y, groundHeight);
      finalVelocity = V3_ZERO;
      finalAngularVelocity = V3_ZERO;
    }

    return {
      position: finalPosition,
      velocity: finalVelocity,
      quaternion: newQuaternion,
      angularVelocity: finalAngularVelocity,
    };
  }

  getMotorModel(): MotorModel {
    return this.motorModel;
  }

  reset(): void {
    this.motorModel.reset();
  }
}
