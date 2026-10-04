import { INITIAL_RECORDING, type RecordingErrorCode, type RecordingSnapshot } from '../store/recordingSlice';
import type { RecordingFrameSource } from '../world/RecordingFrameSource';
import type { RecordingAudioSource } from './DroneAudio';

const MAX_DURATION_MS = 300_000;
const MAX_ENCODED_BYTES = 256 * 1024 * 1024;
const FORMATS = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4',
  'video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];

export interface RecordingRuntime {
  isTypeSupported(type: string): boolean;
  createRecorder(stream: MediaStream, options: MediaRecorderOptions): MediaRecorder;
  createStream(tracks: MediaStreamTrack[]): MediaStream;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  download(url: string, filename: string): void;
  now(): number;
}

const browserRuntime: RecordingRuntime = {
  isTypeSupported: type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type),
  createRecorder: (stream, options) => new MediaRecorder(stream, options),
  createStream: tracks => new MediaStream(tracks),
  createObjectURL: blob => URL.createObjectURL(blob),
  revokeObjectURL: url => URL.revokeObjectURL(url),
  download: (url, filename) => {
    const link = document.createElement('a'); link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
  },
  now: () => performance.now(),
};

interface RecordingOptions {
  createFrameSource(): Promise<RecordingFrameSource>;
  createAudioSource(): RecordingAudioSource;
  publish(snapshot: RecordingSnapshot): void;
  runtime?: RecordingRuntime;
}

export class FlightRecorder {
  private snapshot: RecordingSnapshot = { ...INITIAL_RECORDING };
  private runtime: RecordingRuntime;
  private recorder: MediaRecorder | null = null;
  private frame: RecordingFrameSource | null = null;
  private audio: RecordingAudioSource | null = null;
  private videoTracks: MediaStreamTrack[] = [];
  private trackListeners: (() => void)[] = [];
  private chunks: Blob[] = [];
  private clip: Blob | null = null;
  private clipUrl: string | null = null;
  private activeSince: number | null = null;
  private accumulatedMs = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;
  private startPromise: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;
  private disposed = false;

  constructor(private options: RecordingOptions) {
    this.runtime = options.runtime ?? browserRuntime;
  }

  start(): Promise<void> {
    if (this.disposed || this.recorder || this.startPromise || this.stopPromise) return Promise.resolve();
    if (this.clip) { this.fail('clip_pending', 'Download or discard the current clip before recording again.'); return Promise.resolve(); }
    const mimeType = FORMATS.find(type => this.runtime.isTypeSupported(type));
    if (!mimeType) { this.fail('unsupported', 'Video recording is unavailable in this browser.'); return Promise.resolve(); }
    const generation = ++this.generation;
    this.snapshot = { ...INITIAL_RECORDING, status: 'finalizing' };
    this.publish();
    this.startPromise = this.startCapture(mimeType, generation).finally(() => { this.startPromise = null; });
    return this.startPromise;
  }

  private async startCapture(mimeType: string, generation: number): Promise<void> {
    let stage: RecordingErrorCode = 'capture_failed';
    try {
      const frame = await this.options.createFrameSource();
      if (generation !== this.generation || this.disposed) { frame.dispose(); return; }
      this.frame = frame;
      stage = 'audio_unavailable';
      this.audio = this.options.createAudioSource();
      stage = 'capture_failed';
      const video = frame.canvas.captureStream(60);
      this.videoTracks = video.getTracks();
      if (!video.getVideoTracks().length || !this.audio.stream.getAudioTracks().length) {
        throw new Error('Recording streams are unavailable.');
      }
      const tracks = [...this.videoTracks, ...this.audio.stream.getAudioTracks()];
      const recorder = this.runtime.createRecorder(this.runtime.createStream(tracks), {
        mimeType, videoBitsPerSecond: 8_000_000, audioBitsPerSecond: 128_000,
      });
      this.recorder = recorder;
      this.chunks = []; this.accumulatedMs = 0;
      recorder.ondataavailable = event => {
        if (!event.data.size) return;
        this.chunks.push(event.data);
        this.snapshot = { ...this.snapshot, encodedBytes: this.snapshot.encodedBytes + event.data.size };
        if (this.snapshot.encodedBytes >= MAX_ENCODED_BYTES) void this.stop('size');
      };
      recorder.onerror = () => this.encodingFailed();
      for (const track of tracks) {
        const ended = () => this.encodingFailed();
        track.addEventListener('ended', ended);
        this.trackListeners.push(() => track.removeEventListener('ended', ended));
      }
      recorder.start(1000);
      this.activeSince = this.runtime.now();
      this.snapshot = { ...INITIAL_RECORDING, status: 'recording' };
      this.timer = setInterval(() => this.tick(), 100);
      this.publish();
    } catch {
      this.cleanupCapture();
      if (generation === this.generation) this.fail(stage, stage === 'audio_unavailable'
        ? 'Drone sound is unavailable. Try resuming the flight first.'
        : 'The flight video could not start. Try again.');
    }
  }

  pause(): void {
    if (this.snapshot.status !== 'recording' || !this.recorder) return;
    try {
      this.recorder.pause(); this.accumulateTime();
      this.snapshot = { ...this.snapshot, status: 'paused' }; this.publish();
    } catch { this.encodingFailed(); }
  }

  resume(): void {
    if (this.snapshot.status !== 'paused' || !this.recorder) return;
    try {
      this.recorder.resume(); this.activeSince = this.runtime.now();
      this.snapshot = { ...this.snapshot, status: 'recording' }; this.publish();
    } catch { this.encodingFailed(); }
  }

  stop(reason: RecordingSnapshot['stopReason'] = 'user'): Promise<void> {
    if (this.stopPromise) return this.stopPromise;
    if (this.startPromise && !this.recorder) {
      ++this.generation;
      this.stopPromise = this.startPromise.then(() => {
        this.snapshot = { ...INITIAL_RECORDING }; this.publish();
      }).finally(() => { this.stopPromise = null; });
      return this.stopPromise;
    }
    const recorder = this.recorder;
    if (!recorder) return Promise.resolve();
    this.accumulateTime();
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.snapshot = { ...this.snapshot, status: 'finalizing', stopReason: reason };
    this.publish();
    this.stopPromise = new Promise<void>(resolve => {
      recorder.onstop = () => {
        const mimeType = recorder.mimeType;
        const clip = new Blob(this.chunks, { type: mimeType });
        this.cleanupCapture();
        if (clip.size) {
          this.clip = clip;
          const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
          this.snapshot = { ...this.snapshot, status: 'ready', filename: `flight-${stamp}.${mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'}` };
          this.publish();
        } else this.fail('empty_clip', 'No video frames were recorded. Try a longer clip.');
        resolve();
      };
      try {
        // An encoder error may mark it inactive before its final stop event arrives.
        if (recorder.state !== 'inactive') recorder.stop();
      } catch {
        this.cleanupCapture(); this.fail('encoding_failed', 'The video could not finish. Please try again.'); resolve();
      }
    }).finally(() => { this.stopPromise = null; });
    return this.stopPromise;
  }

  download(): void {
    if (!this.clip || !this.snapshot.filename) return;
    try {
      this.clipUrl ??= this.runtime.createObjectURL(this.clip);
      this.runtime.download(this.clipUrl, this.snapshot.filename);
    } catch { this.fail('capture_failed', 'The download could not start. Try downloading again.'); }
  }

  discard(): void {
    if (this.recorder || this.startPromise || this.stopPromise) return;
    if (this.clipUrl) this.runtime.revokeObjectURL(this.clipUrl);
    this.clipUrl = null; this.clip = null;
    this.snapshot = { ...INITIAL_RECORDING }; this.publish();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.stop('session_exit');
    this.discard();
  }

  private tick(): void {
    if (this.frame?.error) { this.encodingFailed(); return; }
    if (this.snapshot.status !== 'recording') return;
    const elapsed = this.elapsedMs();
    this.snapshot = { ...this.snapshot, elapsedSeconds: Math.min(300, elapsed / 1000) };
    if (elapsed >= MAX_DURATION_MS) void this.stop('duration');
    else this.publish();
  }

  private elapsedMs(): number {
    return this.accumulatedMs + (this.activeSince === null ? 0 : this.runtime.now() - this.activeSince);
  }

  private accumulateTime(): void {
    this.accumulatedMs = this.elapsedMs(); this.activeSince = null;
    this.snapshot = { ...this.snapshot, elapsedSeconds: Math.min(300, this.accumulatedMs / 1000) };
  }

  private encodingFailed(): void {
    this.snapshot = { ...this.snapshot, error: { code: 'encoding_failed', message: 'Recording was interrupted. The available footage may be incomplete.' } };
    void this.stop('encoding_error');
  }

  private cleanupCapture(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null; this.activeSince = null;
    this.trackListeners.forEach(remove => remove()); this.trackListeners = [];
    if (this.recorder) {
      this.recorder.ondataavailable = null; this.recorder.onerror = null; this.recorder.onstop = null;
    }
    this.videoTracks.forEach(track => track.stop()); this.videoTracks = [];
    this.audio?.dispose(); this.audio = null;
    this.frame?.dispose(); this.frame = null;
    this.recorder = null; this.chunks = [];
  }

  private fail(code: RecordingErrorCode, message: string): void {
    this.snapshot = { ...this.snapshot, status: this.clip ? 'ready' : 'error', error: { code, message } };
    this.publish();
  }

  private publish(): void { this.options.publish({ ...this.snapshot }); }
}
