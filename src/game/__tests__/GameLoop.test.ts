// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Cesium from "cesium";
import { GameLoop } from "../GameLoop";
import { PerformanceTimings } from '../PerformanceTimings';
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from "../../core/physics/droneConfig";
import type { TerrainSampler } from "../../world/TerrainSampler";
import { useStore } from "../../store";

describe("GameLoop wall-clock integration", () => {
  let clock = 0;
  let loop: GameLoop;
  let preUpdate: Cesium.Event;
  let groundHeight = 0;
  let timings: PerformanceTimings;

  beforeEach(() => {
    useStore.setState({ godMode: false });
    clock = 0;
    groundHeight = 0;
    timings = new PerformanceTimings();
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [],
    });
    preUpdate = new Cesium.Event();
    const viewer = {
      scene: { preUpdate },
      camera: {
        frustum: new Cesium.PerspectiveFrustum({ aspectRatio: 16 / 9 }),
        setView: () => {},
      },
      entities: new Cesium.EntityCollection(),
    } as unknown as Cesium.Viewer;
    const terrainSampler = {
      setExclusions: () => {},
      sampleAtPosition: () => {},
      getGroundHeight: () => groundHeight,
      sampleSurfaceInto: (_position: unknown, out: { height: number; source: string }) => {
        out.height = groundHeight;
        out.source = 'tiles';
      },
    } as unknown as TerrainSampler;
    loop = new GameLoop({
      viewer,
      enuFrame: Cesium.Matrix4.IDENTITY,
      physicsConfig: { ...DEFAULT_DRONE_CONFIG, dragCoefficient: 0 },
      ratesConfig: DEFAULT_RATES,
      terrainSampler,
      initialPosition: { x: 0, y: 0, z: 100 },
      timings,
    });
    loop.start();
  });

  afterEach(() => {
    useStore.setState({ godMode: false });
    loop.stop();
    Reflect.deleteProperty(navigator, "getGamepads");
    vi.restoreAllMocks();
  });

  it('records one flight and substep batch per rendered update while diagnostics are enabled', () => {
    timings.setEnabled(true);
    clock = 20;
    preUpdate.raiseEvent();
    const snapshot = timings.snapshot();
    expect(snapshot.stages.flight.count).toBe(1);
    expect(snapshot.stages.contacts.count).toBe(1);
    expect(snapshot.stages.physics.count).toBe(1);
    expect(loop.getDroneState().velocity.z).toBeCloseTo(-0.1962, 3);
    timings.setEnabled(false);
    clock = 40;
    preUpdate.raiseEvent();
    expect(timings.snapshot().stages.flight.count).toBe(0);
    expect(loop.getDroneState().velocity.z).toBeCloseTo(-0.3924, 3);
  });

  it("notifies spawn reset once so session-owned traffic can rebuild", () => {
    let resets=0;loop.onReset(()=>resets++);loop.reset();expect(resets).toBe(1);
    expect(loop.getDroneState().position).toEqual({x:0,y:0,z:100});
  });

  it("applies gentle weather and honors Calm on resume", () => {
    const originalConfig = useStore.getState().physicsConfig;
    useStore.setState({ physicsConfig: { ...DEFAULT_DRONE_CONFIG, gentleWind: true } });
    loop.applyStoreSettings();
    clock = 20;
    preUpdate.raiseEvent();
    expect(loop.getDroneState().velocity.x).toBeGreaterThan(0);
    loop.stop();
    useStore.setState({ physicsConfig: { ...DEFAULT_DRONE_CONFIG, windSpeed: 0, windGustStrength: 0 } });
    loop.applyStoreSettings();
    loop.reset();
    loop.start();
    clock = 40;
    preUpdate.raiseEvent();
    expect(loop.getDroneState().velocity.x).toBe(0);
    expect(loop.getDroneState().velocity.y).toBe(0);
    useStore.setState({ physicsConfig: originalConfig });
  });

  it.each([15, 30, 60, 144])("falls at real-time gravity at %i render FPS", (fps) => {
    for (let frame = 1; frame <= fps; frame++) {
      clock = frame * 1000 / fps;
      preUpdate.raiseEvent();
    }
    const state = loop.getDroneState();
    // One second of free fall: v = -g*t, s = -g*t²/2.
    expect(state.velocity.z).toBeCloseTo(-9.81, 1);
    expect(state.position.z).toBeCloseTo(95.095, 1);
  });

  it("bounds catch-up after a multi-second render stall", () => {
    clock = 5000;
    preUpdate.raiseEvent();
    expect(loop.getDroneState().velocity.z).toBeGreaterThanOrEqual(-0.982);
    expect(loop.getDroneState().velocity.z).toBeLessThan(-0.95);
    clock += 20;
    preUpdate.raiseEvent();
    expect(loop.getDroneState().velocity.z).toBeGreaterThan(-1.2);
  });

  it("does not integrate time spent paused", () => {
    loop.stop();
    clock = 5000;
    loop.start();
    clock += 20;
    preUpdate.raiseEvent();
    expect(loop.getDroneState().velocity.z).toBeCloseTo(-0.1962, 2);
  });

  it("ramps keyboard throttle at 80% per real second", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    for (let frame = 1; frame <= 60; frame++) {
      clock = frame * 1000 / 60;
      preUpdate.raiseEvent();
      if (frame === 6) expect(useStore.getState().throttle).toBeCloseTo(0.08, 2);
    }
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
    expect(useStore.getState().throttle).toBeCloseTo(0.8, 2);
  });

  it("polls the connected radio at the 500Hz simulation rate", () => {
    loop.stop();
    let polls = 0;
    const radio: Gamepad = {
      id: "BETAFPV LiteRadio", index: 0, connected: true, mapping: "",
      axes: [0, 1, 0, 0], buttons: [], timestamp: 0,
      vibrationActuator: {
        playEffect: async () => "complete", reset: async () => "complete",
      },
    };
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => { polls++; return [radio]; },
    });
    loop.start();
    polls = 0;
    for (let frame = 1; frame <= 30; frame++) {
      clock = frame * 1000 / 30;
      preUpdate.raiseEvent();
    }
    expect(polls).toBeGreaterThanOrEqual(499);
    expect(polls).toBeLessThanOrEqual(500);
    expect(loop.getDroneState().velocity.z).toBeCloseTo(-9.81, 1);
  });

  it("publishes live sticks on render frames and clears them on pause", () => {
    useStore.setState({ showStickOverlay: true });
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD" }));
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "ArrowRight" }));
    clock = 20;
    preUpdate.raiseEvent();
    expect(useStore.getState().liveSticks.yaw).toBeGreaterThan(0);
    expect(useStore.getState().liveSticks.roll).toBeGreaterThan(0);
    loop.stop();
    expect(useStore.getState().liveSticks).toEqual({ throttle: 0, yaw: 0, roll: 0, pitch: 0 });
  });

  it("leaves a severe standard crash at the contact until manual recovery", () => {
    const onCrash = vi.fn();
    loop.onCrash(onCrash);
    for (let frame = 1; frame <= 360; frame++) {
      clock = frame * 1000 / 60;
      preUpdate.raiseEvent();
    }
    expect(onCrash).toHaveBeenCalled();
    expect(useStore.getState().flightCondition).toBe('disabled');
    expect(loop.getDroneState().position.z).toBeLessThan(2);
    const reset = vi.fn(); loop.onReset(reset);
    expect(loop.recover()).toBe(true);
    expect(reset).toHaveBeenCalledOnce();
    expect(loop.getDroneState().position.z).toBeGreaterThanOrEqual(5);
    expect(loop.getDroneState().velocity).toEqual({ x: 0, y: 0, z: 0 });
    expect(useStore.getState().flightCondition).toBe('flying');
  });

  it.each([0, 20])('lands and takes off again from a surface at %s meters', height => {
    groundHeight = height;
    Object.assign(loop.getDroneState().position, { x: 0, y: 0, z: height + 0.06 });
    loop.getDroneState().velocity.z = -0.2;
    for (let frame = 1; frame <= 180; frame++) {
      clock = frame * 1000 / 60;
      preUpdate.raiseEvent();
    }
    expect(useStore.getState().flightCondition).toBe('landed');
    expect(loop.getDroneState().position.z).toBeCloseTo(height + 0.05, 2);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    for (let frame = 181; frame <= 205; frame++) {
      clock = frame * 1000 / 60;
      preUpdate.raiseEvent();
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    for (let frame = 206; frame <= 265; frame++) {
      clock = frame * 1000 / 60;
      preUpdate.raiseEvent();
    }
    expect(useStore.getState().flightCondition).toBe('flying');
    expect(loop.getDroneState().position.z).toBeGreaterThan(height + 1);
  });

  it('keeps God mode at the impact without disabling it or teleporting', () => {
    useStore.getState().setGodMode(true);
    Object.assign(loop.getDroneState().position, { x: 300, y: 120, z: 1 });
    loop.getDroneState().velocity.z = -10;
    for (let frame = 1; frame <= 120; frame++) {
      clock = frame * 1000 / 60;
      preUpdate.raiseEvent();
    }
    expect(useStore.getState().flightCondition).not.toBe('disabled');
    expect(loop.getDroneState().position.z).toBeLessThan(1);
    expect(loop.getDroneState().position.x).toBeGreaterThan(299);
  });

  it('recovers with Space, ignores repeat and clears keyboard throttle', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    clock = 100; preUpdate.raiseEvent();
    const reset = vi.fn(); loop.onReset(reset);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', repeat: true }));
    expect(reset).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true }));
    expect(reset).toHaveBeenCalledOnce();
    clock = 120; preUpdate.raiseEvent();
    expect(loop.getDroneState().velocity.z).toBeLessThan(0);
  });
});
