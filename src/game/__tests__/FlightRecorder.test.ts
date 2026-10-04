import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlightRecorder, type RecordingRuntime } from '../FlightRecorder';
import type { RecordingSnapshot } from '../../store/recordingSlice';

class FakeRecorder {
  state: RecordingState = 'inactive';
  mimeType = 'video/mp4';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  start = vi.fn(() => { this.state = 'recording'; });
  pause = vi.fn(() => { this.state = 'paused'; });
  resume = vi.fn(() => { this.state = 'recording'; });
  stop = vi.fn(() => {
    this.state = 'inactive';
    queueMicrotask(() => { this.emit(new Blob(['video'])); this.onstop?.(); });
  });
  emit(data: Blob) { this.ondataavailable?.({ data }); }
}

function fixture() {
  const recorder = new FakeRecorder();
  const videoTrack = new EventTarget() as MediaStreamTrack; videoTrack.stop = vi.fn();
  const audioTrack = new EventTarget() as MediaStreamTrack; audioTrack.stop = vi.fn();
  const videoStream = { getTracks: () => [videoTrack], getVideoTracks: () => [videoTrack] } as unknown as MediaStream;
  const audioStream = { getTracks: () => [audioTrack], getAudioTracks: () => [audioTrack] } as unknown as MediaStream;
  const frame = { canvas: { captureStream: vi.fn(() => videoStream) } as unknown as HTMLCanvasElement, dispose: vi.fn(), error: null as string | null };
  const audio = { stream: audioStream, dispose: vi.fn(() => audioTrack.stop()) };
  const snapshots: RecordingSnapshot[] = [];
  const runtime: RecordingRuntime = {
    isTypeSupported: vi.fn(() => true),
    createRecorder: vi.fn((_stream, options) => { recorder.mimeType = options.mimeType!; return recorder as unknown as MediaRecorder; }),
    createStream: vi.fn(() => videoStream),
    createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn(), download: vi.fn(),
    now: () => performance.now(),
  };
  const createFrameSource = vi.fn(async () => frame);
  const createAudioSource = vi.fn(() => audio);
  const owner = new FlightRecorder({ createFrameSource, createAudioSource, publish: snapshot => snapshots.push(snapshot), runtime });
  return { owner, recorder, frame, audio, videoTrack, audioTrack, runtime, snapshots, createFrameSource, createAudioSource };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('flight recorder', () => {
  it('finalizes once, retains a real clip, supports retry download, and discards URLs', async () => {
    const f = fixture(); await f.owner.start(); await f.owner.start();
    expect(f.recorder.start).toHaveBeenCalledOnce();
    expect(f.frame.canvas.captureStream).toHaveBeenCalledWith(60);
    await Promise.all([f.owner.stop(), f.owner.stop()]);
    expect(f.recorder.stop).toHaveBeenCalledOnce();
    expect(f.snapshots.at(-1)?.status).toBe('ready');
    expect(f.snapshots.at(-1)?.encodedBytes).toBe(5);
    expect(f.snapshots.at(-1)?.filename).toMatch(/\.mp4$/);
    expect(f.videoTrack.stop).toHaveBeenCalledOnce(); expect(f.audio.dispose).toHaveBeenCalledOnce();
    f.owner.download(); f.owner.download(); expect(f.runtime.download).toHaveBeenCalledTimes(2);
    await f.owner.start(); expect(f.snapshots.at(-1)?.error?.code).toBe('clip_pending');
    f.owner.discard(); f.owner.discard(); expect(f.runtime.revokeObjectURL).toHaveBeenCalledOnce();
    expect(f.snapshots.at(-1)?.status).toBe('idle');
  });

  it('uses supported WebM and cleans up constructor failure for retry', async () => {
    const f = fixture(); vi.mocked(f.runtime.isTypeSupported).mockImplementation(type => type.startsWith('video/webm'));
    vi.mocked(f.runtime.createRecorder).mockImplementationOnce(() => { throw new Error('encoder unavailable'); });
    await f.owner.start(); expect(f.snapshots.at(-1)?.error?.code).toBe('capture_failed');
    expect(f.frame.dispose).toHaveBeenCalledOnce(); expect(f.audio.dispose).toHaveBeenCalledOnce();
    await f.owner.start(); await f.owner.stop(); expect(f.snapshots.at(-1)?.filename).toMatch(/\.webm$/);
  });

  it('excludes paused time and stops at 300 recorded seconds', async () => {
    const f = fixture(); await f.owner.start(); await vi.advanceTimersByTimeAsync(1000);
    f.owner.pause(); await vi.advanceTimersByTimeAsync(200000); expect(f.snapshots.at(-1)?.elapsedSeconds).toBe(1);
    f.owner.resume(); await vi.advanceTimersByTimeAsync(299000);
    expect(f.snapshots.at(-1)?.status).toBe('ready'); expect(f.snapshots.at(-1)?.stopReason).toBe('duration');
    expect(f.snapshots.at(-1)?.elapsedSeconds).toBe(300);
  });

  it('stops at the byte threshold and retains partial footage after an encoder error', async () => {
    const f = fixture(); await f.owner.start();
    f.recorder.emit({ size: 256 * 1024 * 1024 } as Blob);
    await f.owner.stop(); expect(f.snapshots.at(-1)?.stopReason).toBe('size');
    f.owner.discard(); await f.owner.start(); f.recorder.emit(new Blob(['partial'])); f.recorder.onerror?.();
    await f.owner.stop(); expect(f.snapshots.at(-1)?.status).toBe('ready');
    expect(f.snapshots.at(-1)?.error?.code).toBe('encoding_failed');
  });

  it('cancels pending setup without leaking a source or starting after exit', async () => {
    const f = fixture(); let release!: (value: typeof f.frame) => void;
    f.createFrameSource.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const start = f.owner.start(); const stop = f.owner.stop('session_exit'); release(f.frame);
    await Promise.all([start, stop]); expect(f.frame.dispose).toHaveBeenCalledOnce();
    expect(f.recorder.start).not.toHaveBeenCalled(); expect(f.snapshots.at(-1)?.status).toBe('idle');
  });

  it('handles unsupported recording, audio failure, ended tracks, and frame failures', async () => {
    const f = fixture(); vi.mocked(f.runtime.isTypeSupported).mockReturnValue(false);
    await f.owner.start(); expect(f.snapshots.at(-1)?.error?.code).toBe('unsupported');
    expect(f.createFrameSource).not.toHaveBeenCalled();
    vi.mocked(f.runtime.isTypeSupported).mockReturnValue(true);
    f.createAudioSource.mockImplementationOnce(() => { throw new Error('audio unavailable'); });
    await f.owner.start(); expect(f.snapshots.at(-1)?.error?.code).toBe('audio_unavailable');
    await f.owner.start(); f.videoTrack.dispatchEvent(new Event('ended')); await f.owner.stop();
    expect(f.snapshots.at(-1)?.error?.code).toBe('encoding_failed');
    f.owner.discard(); await f.owner.start(); f.frame.error = 'attribution failed';
    await vi.advanceTimersByTimeAsync(100); expect(f.snapshots.at(-1)?.status).toBe('ready');
    await f.owner.dispose(); expect(f.snapshots.at(-1)?.status).toBe('idle');
  });
});
