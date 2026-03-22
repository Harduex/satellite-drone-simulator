import type {
  DroneState,
  MotorCommands,
  PhysicsConfig,
  Quaternion,
  Vector3,
} from "./types";
import {
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
   */
  step(state: DroneState, motors: MotorCommands, dt: number): DroneState {
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

    // Translational drag (world frame)
    const drag = computeTranslationalDrag(state.velocity, this.config);

    // Net force
    const netForce = v3Add(v3Add(thrustWorldFrame, gravity), drag);

    // ── Compute net torque in body frame ──────────────────
    const d = this.motorArmOffset;

    // Roll torque: (right motors - left motors) * arm offset
    // Right = M2 + M3, Left = M1 + M4
    const rollTorque = (t2 + t3 - t1 - t4) * d;

    // Pitch torque: (front motors - back motors) * arm offset
    // Front = M1 + M2, Back = M3 + M4
    const pitchTorque = (t1 + t2 - t3 - t4) * d;

    // Yaw torque: reaction torques (CCW motors positive, CW negative)
    // M1(CCW) + M3(CCW) - M2(CW) - M4(CW)
    const q1 = reactionTorques[0]!;
    const q2 = reactionTorques[1]!;
    const q3 = reactionTorques[2]!;
    const q4 = reactionTorques[3]!;
    const yawTorque = q1 - q2 + q3 - q4;

    const motorTorque: Vector3 = vec3(rollTorque, pitchTorque, yawTorque);

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

    // Quaternion: q_dot = 0.5 * [0, omega] * q
    const omegaQuat: Quaternion = {
      w: 0,
      x: state.angularVelocity.x,
      y: state.angularVelocity.y,
      z: state.angularVelocity.z,
    };
    const qDot = quatMultiply(omegaQuat, state.quaternion);
    const newQuaternion = quatNormalize({
      w: state.quaternion.w + 0.5 * qDot.w * dt,
      x: state.quaternion.x + 0.5 * qDot.x * dt,
      y: state.quaternion.y + 0.5 * qDot.y * dt,
      z: state.quaternion.z + 0.5 * qDot.z * dt,
    });

    // ── Ground clamp (simple, terrain-aware version in Phase 5) ──
    let finalPosition = newPosition;
    let finalVelocity = newVelocity;
    let finalAngularVelocity = newAngularVelocity;
    if (newPosition.z < 0) {
      finalPosition = vec3(newPosition.x, newPosition.y, 0);
      finalVelocity = vec3(newVelocity.x, newVelocity.y, 0);
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
