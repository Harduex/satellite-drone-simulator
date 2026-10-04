/** Synthesized propeller blade pulses and airflow, driven by the four physical motors. */
export class DroneAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private motors: { oscillator: OscillatorNode; gain: GainNode }[] = [];
  private airflow: GainNode | null = null;
  private airFilter: BiquadFilterNode | null = null;
  private active = false;
  private unavailable = false;

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
        const wave = context.createPeriodicWave(
          new Float32Array(6), new Float32Array([0, 1, 0.35, 0.16, 0.08, 0.04]),
        );
        for (let index = 0; index < 4; index++) {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          gain.gain.value = 0;
          oscillator.setPeriodicWave(wave);
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
        this.airFilter = context.createBiquadFilter();
        this.airFilter.type = "lowpass";
        this.airFilter.Q.value = 0.5;
        this.airflow = context.createGain();
        this.airflow.gain.value = 0;
        noise.connect(this.airFilter);
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

  update(rpms: readonly number[], volume: number): void {
    if (!this.context || !this.master || !this.active) return;
    const now = this.context.currentTime;
    const safeVolume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    this.master.gain.setTargetAtTime(safeVolume, now, 0.03);
    let airflow = 0;
    for (let index = 0; index < this.motors.length; index++) {
      const rpm = Number.isFinite(rpms[index]) ? Math.max(0, rpms[index]!) : 0;
      const level = Math.min(1, rpm / 24000);
      const motor = this.motors[index]!;
      // Two blades pass per revolution; native oscillators bandlimit the harmonics.
      motor.oscillator.frequency.setTargetAtTime(Math.max(20, Math.min(3000, rpm / 30)), now, 0.025);
      motor.gain.gain.setTargetAtTime(0.08 * Math.pow(level, 0.7), now, 0.025);
      airflow += level / 4;
    }
    this.airflow?.gain.setTargetAtTime(airflow * 0.1, now, 0.04);
    this.airFilter?.frequency.setTargetAtTime(1200 + airflow * 2200, now, 0.04);
  }

  pause(): void {
    this.active = false;
    if (!this.context || !this.master) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setValueAtTime(0, this.context.currentTime);
    void this.context.suspend().catch(error => console.warn("Drone audio could not suspend.", error));
  }

  dispose(): void {
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
