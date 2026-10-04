import type { StateCreator } from 'zustand';

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'finalizing' | 'ready' | 'error';
export type RecordingErrorCode = 'unsupported' | 'not_flying' | 'clip_pending' | 'capture_failed'
  | 'audio_unavailable' | 'encoding_failed' | 'empty_clip';
export interface RecordingSnapshot {
  status: RecordingStatus;
  elapsedSeconds: number;
  encodedBytes: number;
  filename: string | null;
  error: { code: RecordingErrorCode; message: string } | null;
  stopReason: 'user' | 'duration' | 'size' | 'session_exit' | 'encoding_error' | null;
}

export const INITIAL_RECORDING: RecordingSnapshot = {
  status: 'idle', elapsedSeconds: 0, encodedBytes: 0, filename: null, error: null, stopReason: null,
};

export interface RecordingSlice {
  recording: RecordingSnapshot;
  setRecording: (snapshot: RecordingSnapshot) => void;
}

export const createRecordingSlice: StateCreator<RecordingSlice> = set => ({
  recording: { ...INITIAL_RECORDING },
  setRecording: recording => set({ recording }),
});
