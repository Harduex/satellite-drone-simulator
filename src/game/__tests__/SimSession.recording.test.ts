import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimSession } from '../SimSession';
import { useStore } from '../../store';
import { INITIAL_RECORDING } from '../../store/recordingSlice';
import type { CesiumManager } from '../../world/CesiumManager';

const recording = vi.hoisted(() => ({ start: vi.fn(async () => {}), stop: vi.fn(async () => {}),
  pause: vi.fn(), resume: vi.fn(), download: vi.fn(), discard: vi.fn(), dispose: vi.fn(async () => {}) }));
vi.mock('../FlightRecorder', () => ({ FlightRecorder: class { constructor() { return recording; } } }));
const loading = vi.hoisted(() => ({ load: vi.fn(async () => {}) }));
vi.mock('../../world/TileLoader', () => ({ TileLoader: class { setCacheOnlyPractice() {} loadPhotorealisticTiles = loading.load; } }));

afterEach(() => { vi.clearAllMocks(); useStore.setState({ phase: 'PICKER', recording: { ...INITIAL_RECORDING } }); });

function fixture() {
  const world = { getViewer: vi.fn(() => ({})), teardownGlobeToggle: vi.fn(), hideContainer: vi.fn(), showContainer: vi.fn(),
    setEnvironmentOptions: vi.fn(), setEnvironmentPaused: vi.fn(), setEnvironmentExposureListener: vi.fn() };
  const session = new SimSession(world as unknown as CesiumManager);
  const loop = { start: vi.fn(), stop: vi.fn(), reset: vi.fn(), applyStoreSettings: vi.fn() };
  const audio = { dispose: vi.fn(), unlock: vi.fn() };
  Object.assign(session, { gameLoop: loop, droneAudio: audio });
  return { session, world, loop, audio };
}

describe('session recording lifecycle', () => {
  it('cancels pending flight startup on application disposal', async () => {
    const f = fixture(); let release!: () => void;
    loading.load.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    const start = f.session.startSession({ lon: 0, lat: 0, name: 'Test location' });
    await f.session.dispose(); release();
    await expect(start).resolves.toBeUndefined();
    expect(f.world.showContainer).not.toHaveBeenCalled(); expect(f.loop.start).not.toHaveBeenCalled();
    expect(useStore.getState().phase).toBe('PICKER');
    await f.session.startSession({ lon: 0, lat: 0, name: 'Test location' });
    expect(loading.load).toHaveBeenCalledOnce();
  });
  it('starts only in flight, pauses before stopping the loop, and retains reset footage', async () => {
    const f = fixture(); await f.session.startRecording(); expect(recording.start).not.toHaveBeenCalled();
    expect(useStore.getState().recording.error?.code).toBe('not_flying');
    useStore.getState().setPhase('FLYING'); await f.session.startRecording();
    expect(recording.start).toHaveBeenCalledOnce();
    f.session.pause(); expect(recording.pause).toHaveBeenCalledOnce();
    expect(recording.pause.mock.invocationCallOrder[0]).toBeLessThan(f.loop.stop.mock.invocationCallOrder[0]!);
    f.session.resume(); expect(f.loop.start.mock.invocationCallOrder[0]).toBeLessThan(recording.resume.mock.invocationCallOrder[0]!);
    expect(f.world.setEnvironmentPaused).toHaveBeenCalledWith(true);
    expect(f.world.setEnvironmentPaused).toHaveBeenCalledWith(false);
    expect(f.world.setEnvironmentOptions).toHaveBeenCalled();
    f.session.reset(); expect(recording.discard).not.toHaveBeenCalled();
    await f.session.stopRecording(); f.session.downloadRecording(); f.session.discardRecording();
    expect(recording.download).toHaveBeenCalledOnce(); expect(recording.discard).toHaveBeenCalledOnce();
  });

  it('waits for one finalization before audio disposal and preserves the ready clip', async () => {
    const f = fixture(); let release!: () => void;
    recording.stop.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
    useStore.setState({ phase: 'PAUSED', recording: { ...INITIAL_RECORDING, status: 'ready', filename: 'flight.webm' } });
    const first = f.session.endSession(); const second = f.session.endSession();
    expect(recording.stop).toHaveBeenCalledOnce(); expect(f.audio.dispose).not.toHaveBeenCalled();
    release(); await Promise.all([first, second]);
    expect(f.audio.dispose).toHaveBeenCalledOnce(); expect(f.world.hideContainer).toHaveBeenCalledOnce();
    expect(useStore.getState().recording.status).toBe('ready'); expect(useStore.getState().phase).toBe('PICKER');
    await f.session.dispose(); expect(recording.dispose).toHaveBeenCalledOnce();
  });
  it('copies a Maps link for the current location and reports clipboard failure', async () => {
    const f = fixture(); expect(await f.session.copyLocationLink()).toBe(false);
    Object.assign(f.session, { spawnOrigin: { latitude: 10, longitude: 20, name: 'x' } });
    const writeText = vi.fn(async () => {}); vi.stubGlobal('navigator', { clipboard: { writeText } });
    expect(await f.session.copyLocationLink()).toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://www.google.com/maps/search/?api=1&query=10.000000%2C20.000000');
    writeText.mockRejectedValueOnce(new Error('denied')); expect(await f.session.copyLocationLink()).toBe(false);
    vi.unstubAllGlobals();
  });
});
