import { useEffect } from 'react';
import type { SimSession } from '../../game/SimSession';
import { useStore } from '../../store';
import css from './RecordingControls.module.css';

export function RecordingControls({ session }: { session: SimSession }) {
  const recording = useStore(state => state.recording);
  const phase = useStore(state => state.phase);
  const active = recording.status === 'recording' || recording.status === 'paused';
  const busy = recording.status === 'finalizing';
  const supported = typeof MediaRecorder !== 'undefined';

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.code !== 'KeyR' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
      const state = useStore.getState();
      if (state.recording.status === 'recording' || state.recording.status === 'paused') {
        event.preventDefault(); void session.stopRecording();
      } else if (state.phase === 'FLYING' && state.recording.status !== 'ready' && state.recording.status !== 'finalizing') {
        event.preventDefault(); void session.startRecording();
      }
    };
    const visibility = () => {
      const state = useStore.getState();
      if (document.hidden && state.phase === 'FLYING' && (state.recording.status === 'recording'
        || (state.recording.status === 'finalizing' && state.recording.stopReason === null))) session.pause();
    };
    window.addEventListener('keydown', keydown);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', keydown);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [session]);

  if (phase === 'PICKER' && recording.status !== 'ready' && !busy) return null;
  const seconds = Math.floor(recording.elapsedSeconds);
  const elapsed = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
  const limit = recording.stopReason === 'duration' ? '5-minute limit reached'
    : recording.stopReason === 'size' ? 'Clip size limit reached' : null;

  return (
    <section className={css.panel} aria-label="Flight recording">
      <div className={css.row}>
        {recording.status === 'ready' ? (
          <>
            <span className={css.label}>Clip ready <time>{elapsed}</time></span>
            <button className={css.primary} onClick={() => session.downloadRecording()}>Download</button>
            <button onClick={() => session.discardRecording()}>Discard</button>
          </>
        ) : (
          <>
            <button className={active ? css.stop : css.primary}
              disabled={busy || (!active && (phase !== 'FLYING' || !supported || recording.error?.code === 'unsupported'))}
              onClick={() => { if (active) void session.stopRecording(); else void session.startRecording(); }}
              aria-keyshortcuts="R">
              <span className={css.light} aria-hidden="true" />
              {busy ? (recording.stopReason ? 'Saving…' : 'Starting…') : active ? 'Stop' : 'Record'}
            </button>
            <span className={css.label}>{active ? (recording.status === 'paused' ? 'Paused' : 'REC') : 'R'}
              {active && <time>{elapsed}</time>}</span>
          </>
        )}
      </div>
      {limit && <p className={css.note}>{limit}</p>}
      {!supported && <p className={css.note}>Video recording is unavailable in this browser.</p>}
      {recording.error && <p className={css.error} role="alert">{recording.error.message}</p>}
    </section>
  );
}
