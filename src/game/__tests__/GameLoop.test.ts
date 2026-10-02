// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Cesium from "cesium";
import { GameLoop } from "../GameLoop";
import { DEFAULT_DRONE_CONFIG, DEFAULT_RATES } from "../../core/physics/droneConfig";
import type { TerrainSampler } from "../../world/TerrainSampler";
import { useStore } from "../../store";

describe("GameLoop wall-clock integration", () => {
  let clock = 0;
  let loop: GameLoop;
  let preUpdate: Cesium.Event;

  beforeEach(() => {
    useStore.setState({ godMode: false });
    clock = 0;
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
      getGroundHeight: () => 0,
    } as unknown as TerrainSampler;
    loop = new GameLoop({
      viewer,
      enuFrame: Cesium.Matrix4.IDENTITY,
      physicsConfig: { ...DEFAULT_DRONE_CONFIG, dragCoefficient: 0 },
      ratesConfig: DEFAULT_RATES,
      terrainSampler,
      initialPosition: { x: 0, y: 0, z: 100 },
    });
    loop.start();
  });

  afterEach(() => {
    useStore.setState({ godMode: false });
    loop.stop();
    Reflect.deleteProperty(navigator, "getGamepads");
    vi.restoreAllMocks();
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

  it.each([false, true])("preserves ground contact with god mode %s, and respawns only when disabled", (godMode) => {
    useStore.getState().setGodMode(godMode);
    const onCrash = vi.fn();
    loop.onCrash(onCrash);
    for (let frame = 1; frame <= 360; frame++) {
      clock = frame * 1000 / 60;
      preUpdate.raiseEvent();
    }
    if (!godMode) {
      expect(onCrash).toHaveBeenCalledOnce();
      expect(loop.getDroneState().position.z).toBeGreaterThan(50);
      return;
    }
    expect(onCrash).not.toHaveBeenCalled();
    expect(loop.getDroneState().position.z).toBe(0);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
    for (let frame = 1; frame <= 90; frame++) {
      clock = 6000 + frame * 1000 / 60;
      preUpdate.raiseEvent();
    }
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));
    expect(loop.getDroneState().position.z).toBeGreaterThan(2);
    expect(onCrash).not.toHaveBeenCalled();
  });

  it("restores crash respawns when God mode is disabled during a flight", () => {
    useStore.getState().setGodMode(true);
    const onCrash = vi.fn();
    loop.onCrash(onCrash);
    for (let frame = 1; frame <= 360; frame++) {
      clock = frame * 1000 / 60;
      preUpdate.raiseEvent();
    }
    expect(loop.getDroneState().position.z).toBe(0);
    useStore.getState().setGodMode(false);
    for (let frame = 1; frame <= 210; frame++) {
      clock = 6000 + frame * 1000 / 60;
      preUpdate.raiseEvent();
    }
    expect(onCrash).toHaveBeenCalledOnce();
    expect(loop.getDroneState().position.z).toBeGreaterThan(90);
  });
});
