import { describe, expect, it, vi } from "vitest";
import { DroneAudio } from "../DroneAudio";

function audioContext() {
  const parameter = () => ({ value: 0, setTargetAtTime: vi.fn(), cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn() });
  const gains: { gain: ReturnType<typeof parameter> }[] = [];
  const oscillators: { frequency: ReturnType<typeof parameter> }[] = [];
  const node = () => ({ connect: vi.fn(), start: vi.fn(), disconnect: vi.fn() });
  const context = {
    currentTime: 0, sampleRate: 48000, destination: {},
    resume: vi.fn(async () => {}), suspend: vi.fn(async () => {}), close: vi.fn(async () => {}),
    createGain: () => { const result = { ...node(), gain: parameter() }; gains.push(result); return result; },
    createOscillator: () => { const result = { ...node(), frequency: parameter(), setPeriodicWave: vi.fn() }; oscillators.push(result); return result; },
    createPeriodicWave: vi.fn(),
    createBuffer: () => ({ getChannelData: () => new Float32Array(48000) }),
    createBufferSource: () => ({ ...node(), buffer: null, loop: false }),
    createBiquadFilter: () => ({ ...node(), type: "", frequency: parameter(), Q: parameter() }),
  };
  return { context: context as unknown as AudioContext, gains, oscillators };
}

describe("drone audio lifecycle", () => {
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
