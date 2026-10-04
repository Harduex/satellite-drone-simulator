import { describe, expect, it } from 'vitest';
import { Matrix4 } from 'cesium';
import { FlightNavigation } from '../FlightNavigation';
import { createENUFrame } from '../../world/CoordUtils';
import { createDefaultDroneState, quatFromEuler } from '../../core/physics/types';

describe('flight navigation', () => {
  const frame = createENUFrame(24, 60, 0);
  const home = { x: 90, y: -40, z: 30 };

  it('uses the actual spawn for horizontal home distance and relative direction', () => {
    const navigation = new FlightNavigation(frame, home);
    const drone = createDefaultDroneState({ x: 190, y: -40, z: 150 });
    drone.quaternion = quatFromEuler(0, 0, -Math.PI / 2);
    const snapshot = navigation.update(drone, 0)!;
    expect(snapshot.homeDistance).toBeCloseTo(100);
    expect(snapshot.heading).toBeCloseTo(90);
    expect(snapshot.homeDirection).toBeCloseTo(-180);
    expect(snapshot.home.lat).not.toBe(snapshot.position.lat);
  });

  it('publishes at five Hz and freezes between updates', () => {
    const navigation = new FlightNavigation(frame, home);
    const drone = createDefaultDroneState(home);
    expect(navigation.update(drone, 0)).not.toBeNull();
    expect(navigation.update(drone, 100)).toBeNull();
    expect(navigation.update(drone, 200)).not.toBeNull();
  });

  it('bounds the trail, ignores stationary samples, and clears it on reset', () => {
    const navigation = new FlightNavigation(frame, home);
    const drone = createDefaultDroneState(home);
    expect(navigation.update(drone, 0)!.trail).toHaveLength(1);
    expect(navigation.update(drone, 200)!.trail).toHaveLength(1);
    let snapshot;
    for (let i = 1; i <= 400; i++) {
      drone.position.x = home.x + i * 3;
      snapshot = navigation.update(drone, 200 + i * 200)!;
    }
    expect(snapshot!.trail).toHaveLength(300);
    const retained = snapshot!.trail;
    navigation.reset();
    drone.position = { ...home };
    expect(navigation.update(drone, 0)!.trail).toHaveLength(1);
    expect(retained).toHaveLength(300);
  });

  it('keeps the last heading while the forward vector points vertically', () => {
    const navigation = new FlightNavigation(frame, home);
    const drone = createDefaultDroneState(home);
    drone.quaternion = quatFromEuler(0, 0, -Math.PI / 2);
    expect(navigation.update(drone, 0)!.heading).toBeCloseTo(90);
    drone.quaternion = quatFromEuler(Math.PI / 2, 0, 0);
    expect(navigation.update(drone, 200)!.heading).toBeCloseTo(90);
  });

  it('rejects positions that cannot be mapped instead of interrupting flight', () => {
    const navigation = new FlightNavigation(Matrix4.IDENTITY, { x: 0, y: 0, z: 100 });
    expect(navigation.update(createDefaultDroneState(0), 0)).toBeNull();
    const invalid = createDefaultDroneState(home);
    invalid.position.x = NaN;
    expect(navigation.update(invalid, 200)).toBeNull();
  });
});
