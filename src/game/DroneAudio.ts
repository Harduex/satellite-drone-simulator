import { DEFAULT_DRONE_CONFIG } from "../core/physics/droneConfig";

const PROPELLER_BLADES = 3;

export interface RecordingAudioSource {
  stream: MediaStream;
  dispose(): void;
}

/** Synthesized propeller blade pulses and airflow, driven by the four physical motors. */
export class DroneAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private motors: { oscillator: OscillatorNode; gain: GainNode }[] = [];
  private airflow: GainNode | null = null;
  private airFilter: BiquadFilterNode | null = null;
  private active = false;
  private unavailable = false;
  private recordingSources = new Set<RecordingAudioSource>();

  constructor(private createContext: () => AudioContext = () => new AudioContext()) {}

  /** Call synchronously from the launch gesture, before terrain/network awaits. */
  unlock(): void {
    if (this.unavailable) return;
    if (!this.context) {
      try {
        const context = this.createContext();
        this.context = context;
        this.master = context.createGain();
        this.master.gain.value = 0;
        this.master.connect(context.destination);
        // Acoustic reference: 5-inch, three-blade racing props. Harmonic weights
        // are a designed timbre, rather than a calibrated recording of this quad.
        const harmonics = new Float32Array([0, 0.55, 1, 0.8, 0.5, 0.3, 0.18, 0.12, 0.08, 0.05, 0.03]);
        const wave = context.createPeriodicWave(new Float32Array(harmonics.length), harmonics);
        for (let index = 0; index < 4; index++) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          gain.gain.value = 0;
          oscillator.setPeriodicWave(wave);
          // Slight rotor variation avoids phase-locked tones at equal commanded RPM.
          oscillator.detune.value = (index - 1.5) * 2;
          oscillator.connect(gain);
          gain.connect(this.master);
          oscillator.start();
          this.motors.push({ oscillator, gain });
        }
        const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
        const samples = buffer.getChannelData(0);
        let seed = 1729;
        for (let index = 0; index < samples.length; index++) {
          seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
          samples[index] = (seed >>> 0) / 2147483648 - 1;
        }
        const noise = context.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const airHighPass = context.createBiquadFilter();
        airHighPass.type = "highpass";
        airHighPass.frequency.value = 180;
        airHighPass.Q.value = 0.5;
        this.airFilter = context.createBiquadFilter();
        this.airFilter.type = "lowpass";
        this.airFilter.Q.value = 0.5;
        this.airflow = context.createGain();
        this.airflow.gain.value = 0;
        noise.connect(airHighPass);
        airHighPass.connect(this.airFilter);
        this.airFilter.connect(this.airflow);
        this.airflow.connect(this.master);
        noise.start();
      } catch (error) {
        this.dispose();
        this.unavailable = true;
        console.warn("Drone audio is unavailable in this browser.", error);
        return;
      }
    }
    void this.context.resume().catch(error => console.warn("Drone audio could not resume.", error));
  }

  play(): void {
    this.active = true;
    this.unlock();
  }

  update(rpms: readonly number[], volume: number, maxRpm = DEFAULT_DRONE_CONFIG.maxThrottleRpm, airspeed = 0): void {
    if (!this.context || !this.master || !this.active) return;
    const now = this.context.currentTime;
    const safeVolume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    this.master.gain.setTargetAtTime(safeVolume, now, 0.03);
    const rpmLimit = Number.isFinite(maxRpm) && maxRpm > 0 ? maxRpm : DEFAULT_DRONE_CONFIG.maxThrottleRpm;
    let airflow = 0;
    for (let index = 0; index < this.motors.length; index++) {
      const rpm = Number.isFinite(rpms[index]) ? Math.max(0, Math.min(rpmLimit, rpms[index]!)) : 0;
      const level = rpm / rpmLimit;
      const motor = this.motors[index]!;
      // Native oscillators bandlimit the blade-passage harmonics.
      const bladeFrequency = Math.min(this.context.sampleRate / 4, Math.max(20, rpm * PROPELLER_BLADES / 60));
      motor.oscillator.frequency.setTargetAtTime(bladeFrequency, now, 0.012);
      motor.gain.gain.setTargetAtTime(0.065 * Math.pow(level, 1.1), now, 0.02);
      airflow += Math.pow(level, 1.8) / 4;
    }
    const relativeFlow = Number.isFinite(airspeed) ? Math.min(1, Math.max(0, airspeed) / 30) : 0;
    this.airflow?.gain.setTargetAtTime(airflow * 0.055 + relativeFlow * 0.09, now, 0.025);
    this.airFilter?.frequency.setTargetAtTime(1800 + airflow * 1800 + relativeFlow * 2400, now, 0.025);
  }

  pause(): void {
    this.active = false;
    if (!this.context || !this.master) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setValueAtTime(0, this.context.currentTime);
    void this.context.suspend().catch(error => console.warn("Drone audio could not suspend.", error));
  }

  createRecordingSource(): RecordingAudioSource {
    if (!this.context || !this.master) throw new Error('Drone audio is unavailable.');
    const master = this.master;
    const destination = this.context.createMediaStreamDestination();
    master.connect(destination);
    let disposed = false;
    const source: RecordingAudioSource = {
      stream: destination.stream,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        master.disconnect(destination);
        destination.disconnect();
        destination.stream.getTracks().forEach(track => track.stop());
        this.recordingSources.delete(source);
      },
    };
    this.recordingSources.add(source);
    return source;
  }

  dispose(): void {
    for (const source of this.recordingSources) source.dispose();
    this.active = false;
    if (this.context) void this.context.close().catch(error => console.warn("Drone audio could not close.", error));
    this.context = null;
    this.master = null;
    this.motors.length = 0;
    this.airflow = null;
    this.airFilter = null;
    this.unavailable = false;
  }
}
