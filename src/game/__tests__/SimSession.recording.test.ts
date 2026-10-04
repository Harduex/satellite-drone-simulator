import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimSession } from '../SimSession';
import { useStore } from '../../store';
import { INITIAL_RECORDING } from '../../store/recordingSlice';
import type { CesiumManager } from '../../world/CesiumManager';

const recording = vi.hoisted(() => ({ start: vi.fn(async () => {}), stop: vi.fn(async () => {}),
  pause: vi.fn(), resume: vi.fn(), download: vi.fn(), discard: vi.fn(), dispose: vi.fn(async () => {}) }));
vi.mock('../FlightRecorder', () => ({ FlightRecorder: class { constructor() { return recording; } } }));

afterEach(() => { vi.clearAllMocks(); useStore.setState({ phase: 'PICKER', recording: { ...INITIAL_RECORDING } }); });

function fixture() {
  const world = { getViewer: vi.fn(), teardownGlobeToggle: vi.fn(), hideContainer: vi.fn() };
  const session = new SimSession(world as unknown as CesiumManager);
  const loop = { start: vi.fn(), stop: vi.fn(), reset: vi.fn(), applyStoreSettings: vi.fn() };
  const audio = { dispose: vi.fn() };
  Object.assign(session, { gameLoop: loop, droneAudio: audio });
  return { session, world, loop, audio };
}

describe('session recording lifecycle', () => {
  it('starts only in flight, pauses before stopping the loop, and retains reset footage', async () => {
    const f = fixture(); await f.session.startRecording(); expect(recording.start).not.toHaveBeenCalled();
    expect(useStore.getState().recording.error?.code).toBe('not_flying');
    useStore.getState().setPhase('FLYING'); await f.session.startRecording();
    expect(recording.start).toHaveBeenCalledOnce();
    f.session.pause(); expect(recording.pause).toHaveBeenCalledOnce();
    expect(recording.pause.mock.invocationCallOrder[0]).toBeLessThan(f.loop.stop.mock.invocationCallOrder[0]!);
    f.session.resume(); expect(f.loop.start.mock.invocationCallOrder[0]).toBeLessThan(recording.resume.mock.invocationCallOrder[0]!);
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
});
