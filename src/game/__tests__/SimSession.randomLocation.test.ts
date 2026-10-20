// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Cesium from 'cesium';
import { SimSession } from '../SimSession';
import { useStore } from '../../store';
import type { CesiumManager } from '../../world/CesiumManager';
import { getRandomLocation } from '../randomLocation';

const recording = vi.hoisted(() => ({
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => {}),
  pause: vi.fn(),
  resume: vi.fn(),
  download: vi.fn(),
  discard: vi.fn(),
  dispose: vi.fn(async () => {}),
}));
vi.mock('../FlightRecorder', () => ({ FlightRecorder: class { constructor() { return recording; } } }));
vi.mock('../randomLocation', () => ({ getRandomLocation: vi.fn(async () => ({ lat: 48, lng: 10, name: '48.0000°N, 10.0000°E', random: true })) }));
const coverage = vi.hoisted(() => ({ check: vi.fn(async () => true) }));
vi.mock('../../world/TileCoverage', () => ({ waitForDetailedTileCoverage: coverage.check }));

const loading = vi.hoisted(() => ({
  load: vi.fn(async () => ({})),
  prepare: vi.fn(),
  wait: vi.fn(async () => {}),
  hasTiles: vi.fn(() => true),
}));
vi.mock('../../world/TileLoader', () => ({
  TileLoader: class {
    setCacheOnlyPractice() {}
    loadPhotorealisticTiles = loading.load;
    prepareForNewLocation = loading.prepare;
    waitForViewRefinement = loading.wait;
    hasRenderableTilesInView = loading.hasTiles;
    setEnvironmentExposure = vi.fn();
  },
}));

const sessions: SimSession[] = [];

beforeEach(() => {
  coverage.check.mockReset().mockResolvedValue(true);
  Object.defineProperty(navigator, 'getGamepads', {
    configurable: true,
    value: () => [],
  });
});

afterEach(async () => {
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  Reflect.deleteProperty(navigator, 'getGamepads');
  vi.clearAllMocks();
  useStore.setState({ phase: 'PICKER' });
});

function createFixture() {
  const camera = { setView: vi.fn(), frustum: { aspectRatio: 1.77, near: 0.1, fov: 1 } };
  const globe = { getHeight: vi.fn(() => 10) };
  const scene = {
    globe,
    camera,
    requestRender: vi.fn(),
    sampleHeightSupported: true,
    sampleHeight: vi.fn(() => 25),
    preUpdate: new Cesium.Event(),
    primitives: { add: vi.fn(), remove: vi.fn() },
  };
  const viewer = {
    scene,
    camera,
    canvas: { clientWidth: 1920, clientHeight: 1080 },
    entities: new Cesium.EntityCollection(),
    clock: { currentTime: Cesium.JulianDate.now() },
    creditDisplay: { addStaticCredit: vi.fn(), removeStaticCredit: vi.fn() },
  };
  const world = {
    getViewer: vi.fn(() => viewer),
    teardownGlobeToggle: vi.fn(),
    hideContainer: vi.fn(),
    showContainer: vi.fn(),
    setupGlobeToggle: vi.fn(),
    getEnvironmentPrimitives: vi.fn(() => []),
    getCloudCollection: vi.fn(() => null),
    setEnvironmentOptions: vi.fn(),
    setEnvironmentPaused: vi.fn(),
    setEnvironmentExposureListener: vi.fn(),
    setEnvironmentAnchor: vi.fn(),
  };

  const session = new SimSession(world as unknown as CesiumManager);
  sessions.push(session);
  return { session, world, scene, viewer };
}

describe('SimSession random location switching', () => {
  it('loads random location and updates phase to FLYING', async () => {
    const { session, world } = createFixture();

    await session.flyToRandomLocation();

    expect(session.getGameLoop()).not.toBeNull();
    expect(useStore.getState().location?.name).toMatch(/°[NS], .*°[EW]/);
    expect(world.showContainer).toHaveBeenCalled();
    expect(useStore.getState().phase).toBe('FLYING');
  });

  it('does not resume an empty session after a failed location load', async () => {
    const { session } = createFixture();
    useStore.setState({ phase: 'PAUSED' });
    loading.load.mockRejectedValueOnce(new Error('Tiles unavailable'));
    await expect(session.flyToRandomLocation()).rejects.toThrow('Tiles unavailable');
    session.resume();
    expect(useStore.getState().phase).toBe('PAUSED');
  });

  it('does not restart startup after cancellation while finalizing a recording', async () => {
    const { session } = createFixture();
    let release!: () => void;
    recording.stop.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    Object.assign(session, { gameLoop: { stop: vi.fn() } });
    const switching = session.flyToRandomLocation();
    await vi.waitFor(() => expect(recording.stop).toHaveBeenCalledOnce());
    await session.endSession();
    release();
    await switching;
    expect(useStore.getState().phase).toBe('PICKER');
    expect(loading.load).not.toHaveBeenCalled();
  });

  it('retries unsupported candidates before starting one covered flight', async () => {
    const { session, world } = createFixture();
    coverage.check.mockResolvedValueOnce(false).mockResolvedValueOnce(false);
    await session.flyToRandomLocation();
    expect(coverage.check).toHaveBeenCalledTimes(3);
    expect(world.setupGlobeToggle).toHaveBeenCalledOnce();
    expect(useStore.getState().phase).toBe('FLYING');
  });

  it('fails after three unsupported candidates without starting a flat-terrain flight', async () => {
    const { session } = createFixture();
    useStore.setState({ phase: 'PAUSED' });
    coverage.check.mockResolvedValue(false);
    await expect(session.flyToRandomLocation()).rejects.toThrow(/3D/);
    expect(coverage.check).toHaveBeenCalledTimes(3);
    expect(session.getGameLoop()).toBeNull();
    expect(useStore.getState().phase).toBe('PAUSED');
  });

  it('preserves terrain fallback for a manually selected location', async () => {
    const { session } = createFixture();
    coverage.check.mockResolvedValue(false);
    await session.startSession({ lon: 10, lat: 48, name: 'Manual location' });
    expect(coverage.check).not.toHaveBeenCalled();
    expect(useStore.getState().phase).toBe('FLYING');
  });

  it('does not retry after cancellation during a coverage check', async () => {
    const { session } = createFixture();
    let release!: (covered: boolean) => void;
    coverage.check.mockImplementationOnce(() => new Promise<boolean>(resolve => { release = resolve; }));
    const switching = session.flyToRandomLocation();
    await vi.waitFor(() => expect(coverage.check).toHaveBeenCalledOnce());
    await session.endSession();
    release(false);
    await switching;
    expect(coverage.check).toHaveBeenCalledOnce();
    expect(useStore.getState().phase).toBe('PICKER');
  });

  it('cancels pending urban-data selection without starting a new session', async () => {
    const { session } = createFixture();
    let release!: (location: Awaited<ReturnType<typeof getRandomLocation>>) => void;
    vi.mocked(getRandomLocation).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const switching = session.flyToRandomLocation();
    await session.flyToRandomLocation();
    expect(getRandomLocation).toHaveBeenCalledOnce();
    await session.endSession();
    release({ lat: 48, lng: 10, name: 'Urban candidate', random: true });
    await switching;
    expect(loading.load).not.toHaveBeenCalled();
    expect(useStore.getState().phase).toBe('PICKER');
  });

  it('cleans up existing gameLoop when switching to a random location', async () => {
    const { session } = createFixture();

    const loop = {
      start: vi.fn(),
      stop: vi.fn(),
      reset: vi.fn(),
      applyStoreSettings: vi.fn(),
      getDroneState: vi.fn(() => ({ position: { x: 0, y: 0, z: 10 } })),
      onCrash: vi.fn(),
      onReset: vi.fn(),
      setSceneExclusions: vi.fn(),
    };
    Object.assign(session, { gameLoop: loop });

    await session.flyToRandomLocation();

    expect(loop.stop).toHaveBeenCalled();
    expect(useStore.getState().phase).toBe('FLYING');
  });
});
