import { describe, expect, it, vi } from "vitest";
import { DroneAudio } from "../DroneAudio";

function audioContext() {
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn() });
  const gains: (ReturnType<typeof node> & { gain: ReturnType<typeof parameter> })[] = [];
  const oscillators: { frequency: ReturnType<typeof parameter> }[] = [];
  const node = () => ({ connect: vi.fn(), start: vi.fn(), disconnect: vi.fn() });
  const track = { stop: vi.fn() };
  const recordingDestination = { ...node(), stream: { getTracks: () => [track] } };
  const context = {
    currentTime: 0, sampleRate: 48000, destination: {},
    resume: vi.fn(async () => {}), suspend: vi.fn(async () => {}), close: vi.fn(async () => {}),
    createGain: () => { const result = { ...node(), gain: parameter() }; gains.push(result); return result; },
    createOscillator: () => { const result = { ...node(), frequency: parameter(), detune: parameter(), setPeriodicWave: vi.fn() }; oscillators.push(result); return result; },
    createPeriodicWave: vi.fn(),
    createMediaStreamDestination: () => recordingDestination,
    createBuffer: () => ({ getChannelData: () => new Float32Array(48000) }),
    createBufferSource: () => ({ ...node(), buffer: null, loop: false }),
    createBiquadFilter: () => ({ ...node(), type: "", frequency: parameter(), Q: parameter() }),
  };
  return { context: context as unknown as AudioContext, gains, oscillators, recordingDestination, track };
}

describe("drone audio lifecycle", () => {
  it("increases airflow with relative airspeed without changing motor pitch", () => {
    const { context, gains, oscillators } = audioContext();
    const audio = new DroneAudio(() => context);
    audio.play();
    audio.update([8400, 8400, 8400, 8400], 1, 24000, 0);
    const quiet = gains[5]!.gain.setTargetAtTime.mock.calls.at(-1)?.[0];
    audio.update([8400, 8400, 8400, 8400], 1, 24000, 20);
    expect(gains[5]!.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBeGreaterThan(quiet);
    expect(oscillators[0]!.frequency.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(420);
    audio.update([8400, 8400, 8400, 8400], 0, 24000, 20);
    expect(gains[0]!.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(0);
    audio.dispose();
  });
  it('disposes only the recording branch and permits recording again', () => {
    const { context, gains, recordingDestination, track } = audioContext();
    const audio = new DroneAudio(() => context);
    expect(() => audio.createRecordingSource()).toThrow();
    audio.play();
    const source = audio.createRecordingSource();
    expect(source.stream).toBe(recordingDestination.stream);
    expect(gains[0]!.connect).toHaveBeenCalledWith(context.destination);
    expect(gains[0]!.connect).toHaveBeenCalledWith(recordingDestination);
    source.dispose(); source.dispose();
    expect(gains[0]!.disconnect).toHaveBeenCalledExactlyOnceWith(recordingDestination);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(context.close).not.toHaveBeenCalled();
    audio.createRecordingSource().dispose();
    audio.dispose();
  });
  it("uses three-blade passage pitch and keeps invalid or stopped motors silent", () => {
    const { context, gains, oscillators } = audioContext();
    const audio = new DroneAudio(() => context);
    audio.play();
    audio.update([8400, 24000, Number.NaN, -100], 1);
    expect(oscillators[0]!.frequency.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(420);
    expect(oscillators[1]!.frequency.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(1200);
    audio.update([30000, 30000, 30000, 30000], 1, 30000);
    expect(oscillators[0]!.frequency.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(1500);
    audio.update([8400, 24000, Number.NaN, -100], 1);
    expect(gains[3]!.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(0);
    expect(gains[4]!.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(0);
    audio.update([0, 0, 0, 0], 1);
    for (const gain of gains.slice(1)) {
      expect(gain.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(0);
    }
    audio.dispose();
  });

  it("tracks individual motor pitch, mutes at zero volume, and silences pause", () => {
    const { context, gains, oscillators } = audioContext();
    const audio = new DroneAudio(() => context);
    audio.unlock();
    audio.play();
    audio.update([3000, 6000, 9000, 12000], 0.4);
    const pitches = oscillators.map(node => node.frequency.setTargetAtTime.mock.calls.at(-1)?.[0]);
    expect(pitches[0]).toBeLessThan(pitches[1]);
    expect(pitches[1]).toBeLessThan(pitches[2]);
    expect(gains[0]!.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(0.4);
    audio.update([12000, 12000, 12000, 12000], 0);
    expect(gains[0]!.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(0);
    audio.pause();
    expect(gains[0]!.gain.setValueAtTime).toHaveBeenLastCalledWith(0, 0);
    audio.update([12000, 12000, 12000, 12000], 0.4);
    expect(gains[0]!.gain.setTargetAtTime.mock.calls.at(-1)?.[0]).toBe(0);
    expect(context.suspend).toHaveBeenCalledOnce();
  });

  it("reuses its context across pause/resume and closes it when leaving a flight", () => {
    const { context } = audioContext();
    const factory = vi.fn(() => context);
    const audio = new DroneAudio(factory);
    audio.unlock(); audio.play(); audio.pause(); audio.play();
    expect(factory).toHaveBeenCalledOnce();
    audio.dispose();
    expect(context.close).toHaveBeenCalledOnce();
    audio.unlock();
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
