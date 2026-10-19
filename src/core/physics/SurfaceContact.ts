import type { DroneState, PhysicsConfig, Vector3 } from './types';
import { quatRotateVectorInto } from './types';

const CONTACT_SOLVER_ITERATIONS = 6;
const CONTACT_MARGIN_METERS = 0.005;
const FACE_ALIGNMENT_TOLERANCE = 0.02;

export interface ContactPlane {
  point: Vector3;
  normal: Vector3;
  radius: number;
  minZ?: number;
  maxZ?: number;
}

export function createContactPlane(x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 1, radius = 0.5): ContactPlane {
  return { point: { x, y, z }, normal: { x: nx, y: ny, z: nz }, radius };
}

export interface ContactResult {
  touching: boolean;
  supported: boolean;
  impactSpeed: number;
  point: Vector3;
}

/** Finite plane contacts for the sampled height-field approximation. */
export class SurfaceContact {
  private readonly bodyNormal = { x: 0, y: 0, z: 0 };
  private readonly bodyOffset = { x: 0, y: 0, z: 0 };
  private readonly offset = { x: 0, y: 0, z: 0 };
  private readonly torque = { x: 0, y: 0, z: 0 };
  private readonly conjugate = { w: 1, x: 0, y: 0, z: 0 };
  private readonly result: ContactResult = {
    touching: false, supported: false, impactSpeed: 0, point: { x: 0, y: 0, z: 0 },
  };

  constructor(private config: PhysicsConfig) {}

  updateConfig(config: PhysicsConfig): void { this.config = config; }

  resolve(previous: DroneState, next: DroneState, planes: readonly ContactPlane[], dt: number): ContactResult {
    const result = this.result;
    result.touching = false; result.supported = false; result.impactSpeed = 0;
    const q = next.quaternion;
    this.conjugate.w = q.w; this.conjugate.x = -q.x; this.conjugate.y = -q.y; this.conjugate.z = -q.z;
    const halfWidth = this.config.armLength + (this.config.rotorDiameter ?? 0.13) / 2;
    for (let iteration = 0; iteration < CONTACT_SOLVER_ITERATIONS; iteration++) {
      for (let index = 0; index < planes.length; index++) {
        const plane = planes[index]!;
        const n = plane.normal;
        quatRotateVectorInto(this.conjugate, n, this.bodyNormal);
        const bn = this.bodyNormal;
        const isWall = Math.abs(n.z) < 0.5;
        const faceX = Math.abs(bn.x) > Math.abs(bn.y) && Math.abs(bn.x) > Math.abs(bn.z);
        const faceY = !faceX && Math.abs(bn.y) > Math.abs(bn.z);
        const aligned = !isWall && (faceX ? Math.abs(bn.y) < FACE_ALIGNMENT_TOLERANCE && Math.abs(bn.z) < FACE_ALIGNMENT_TOLERANCE
          : faceY ? Math.abs(bn.x) < FACE_ALIGNMENT_TOLERANCE && Math.abs(bn.z) < FACE_ALIGNMENT_TOLERANCE
          : Math.abs(bn.x) < FACE_ALIGNMENT_TOLERANCE && Math.abs(bn.y) < FACE_ALIGNMENT_TOLERANCE);
        // A support face distributes the impulse; a single corner keeps switching as the body rocks.
        for (let corner = 0; corner < 5; corner++) {
          if (corner === 0 && !aligned) continue;
          const u = corner === 0 ? 0 : (corner - 1) & 1 ? 1 : -1;
          const v = corner === 0 ? 0 : (corner - 1) & 2 ? 1 : -1;
          this.bodyOffset.x = faceX ? -Math.sign(bn.x) * halfWidth : u * halfWidth;
          this.bodyOffset.y = faceY ? -Math.sign(bn.y) * halfWidth : (faceX ? u : v) * halfWidth;
          this.bodyOffset.z = !faceX && !faceY ? -Math.sign(bn.z) * 0.05 : v * 0.05;
          quatRotateVectorInto(q, this.bodyOffset, this.offset);
          const r = this.offset;
          const extent = -(r.x * n.x + r.y * n.y + r.z * n.z);
          const oldDistance = (previous.position.x - plane.point.x) * n.x
            + (previous.position.y - plane.point.y) * n.y + (previous.position.z - plane.point.z) * n.z - extent;
          // A surface appearing around an already enclosed body is a geometry revision, not an impact.
          if (oldDistance < -0.35) continue;
          const dx = next.position.x + r.x - plane.point.x;
          const dy = next.position.y + r.y - plane.point.y;
          const dz = next.position.z + r.z - plane.point.z;
          const distance = dx * n.x + dy * n.y + dz * n.z;
          if (distance > CONTACT_MARGIN_METERS) continue;
          if (n.z === 0 && plane.minZ !== undefined && plane.maxZ !== undefined) {
            const tangent = dx * n.y - dy * n.x;
            const height = next.position.z + r.z;
            if (Math.abs(tangent) > plane.radius || height < plane.minZ - CONTACT_MARGIN_METERS
              || height > plane.maxZ + CONTACT_MARGIN_METERS) continue;
          } else if (dx * dx + dy * dy + dz * dz - distance * distance > plane.radius * plane.radius) continue;
          const rb = this.bodyOffset, w = next.angularVelocity;
          this.torque.x = w.y * rb.z - w.z * rb.y;
          this.torque.y = w.z * rb.x - w.x * rb.z;
          this.torque.z = w.x * rb.y - w.y * rb.x;
          quatRotateVectorInto(q, this.torque, this.torque);
          const incoming = (next.velocity.x + this.torque.x) * n.x
            + (next.velocity.y + this.torque.y) * n.y + (next.velocity.z + this.torque.z) * n.z;
          if (distance >= 0 && incoming >= 0) continue;
          result.touching = true;
          result.supported ||= n.z > 0.5;
          if (-incoming > result.impactSpeed) {
            result.impactSpeed = -incoming;
            result.point.x = next.position.x + r.x;
            result.point.y = next.position.y + r.y;
            result.point.z = next.position.z + r.z;
          }
          const correction = Math.max(0, -distance);
          next.position.x += n.x * correction; next.position.y += n.y * correction; next.position.z += n.z * correction;
          let normalImpulsePerMass = 0;
          if (incoming < 0) {
            const tx = rb.y * bn.z - rb.z * bn.y;
            const ty = rb.z * bn.x - rb.x * bn.z;
            const tz = rb.x * bn.y - rb.y * bn.x;
            const { mass, inertia } = this.config;
            const inverseMass = 1 / mass + tx * tx / inertia.xx + ty * ty / inertia.yy + tz * tz / inertia.zz;
            const restitution = incoming < -1.5 ? (isWall ? 0.25 : 0.12) : 0;
            const impulse = -(1 + restitution) * incoming / inverseMass;
            normalImpulsePerMass = impulse / mass;
            next.velocity.x += n.x * normalImpulsePerMass;
            next.velocity.y += n.y * normalImpulsePerMass;
            next.velocity.z += n.z * normalImpulsePerMass;
            w.x += tx * impulse / inertia.xx;
            w.y += ty * impulse / inertia.yy;
            w.z += tz * impulse / inertia.zz;
            if (isWall) {
              const wMag = Math.hypot(w.x, w.y, w.z);
              if (wMag > 10) {
                const scale = 10 / wMag;
                w.x *= scale; w.y *= scale; w.z *= scale;
              }
            }
          }
          const normalSpeed = next.velocity.x * n.x + next.velocity.y * n.y + next.velocity.z * n.z;
          const tangentSpeed = Math.hypot(next.velocity.x - normalSpeed * n.x,
            next.velocity.y - normalSpeed * n.y, next.velocity.z - normalSpeed * n.z);
          const frictionCoefficient = n.z > 0.5 ? 0.7 : 0.1;
          const frictionBudget = frictionCoefficient * normalImpulsePerMass;
          const friction = tangentSpeed > 0 ? Math.max(0, 1 - frictionBudget / tangentSpeed) : 0;
          next.velocity.x = normalSpeed * n.x + (next.velocity.x - normalSpeed * n.x) * friction;
          next.velocity.y = normalSpeed * n.y + (next.velocity.y - normalSpeed * n.y) * friction;
          next.velocity.z = normalSpeed * n.z + (next.velocity.z - normalSpeed * n.z) * friction;
        }
      }
    }
    if (result.touching) {
      const angularDamping = Math.max(0, 1 - 12 * dt);
      next.angularVelocity.x *= angularDamping;
      next.angularVelocity.y *= angularDamping;
      next.angularVelocity.z *= angularDamping;
    }
    return result;
  }
}
