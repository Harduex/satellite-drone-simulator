// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingControls } from '../RecordingControls';
import { useStore } from '../../../store';
import { INITIAL_RECORDING } from '../../../store/recordingSlice';
import type { SimSession } from '../../../game/SimSession';

let root: Root;
let container: HTMLDivElement;
const session = { startRecording: vi.fn(async () => {}), stopRecording: vi.fn(async () => {}),
  downloadRecording: vi.fn(), discardRecording: vi.fn(), pause: vi.fn() };

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('MediaRecorder', { isTypeSupported: () => true });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  useStore.setState({ phase: 'FLYING', recording: { ...INITIAL_RECORDING } });
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function render() { act(() => root.render(<RecordingControls session={session as unknown as SimSession} />)); }
function button(label: string) { return [...container.querySelectorAll('button')].find(button => button.textContent?.includes(label))!; }

describe('recording controls', () => {
  it('records, shows paused elapsed time, and keeps completed downloads in the picker', async () => {
    render(); await act(async () => button('Record').click()); expect(session.startRecording).toHaveBeenCalledOnce();
    act(() => useStore.setState({ phase: 'PAUSED', recording: { ...INITIAL_RECORDING, status: 'paused', elapsedSeconds: 65 } }));
    expect(container.textContent).toContain('01:05'); expect(container.textContent).toContain('Paused');
    await act(async () => button('Stop').click()); expect(session.stopRecording).toHaveBeenCalledOnce();
    act(() => useStore.setState({ phase: 'PICKER', recording: { ...INITIAL_RECORDING, status: 'ready', filename: 'flight.webm' } }));
    act(() => button('Download').click()); act(() => button('Discard').click());
    expect(session.downloadRecording).toHaveBeenCalledOnce(); expect(session.discardRecording).toHaveBeenCalledOnce();
  });

  it('ignores repeat, modified, and editable R shortcuts; pauses only an active recorded flight when hidden', async () => {
    render();
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })); });
    expect(session.startRecording).toHaveBeenCalledOnce();
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', repeat: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', ctrlKey: true }));
    const input = document.createElement('input'); container.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR', bubbles: true }));
    expect(session.startRecording).toHaveBeenCalledOnce();
    act(() => useStore.setState({ recording: { ...INITIAL_RECORDING, status: 'recording' } }));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange'))); expect(session.pause).toHaveBeenCalledOnce();
    act(() => useStore.setState({ phase: 'PAUSED' }));
    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyR' })));
    expect(session.stopRecording).toHaveBeenCalledOnce();
  });

  it('disables finalizing and unsupported states and never starts in picker or pause', () => {
    render(); act(() => useStore.setState({ recording: { ...INITIAL_RECORDING, status: 'finalizing' } }));
    expect(container.querySelector('button')?.disabled).toBe(true);
    act(() => useStore.setState({ phase: 'PAUSED', recording: { ...INITIAL_RECORDING } }));
    expect(button('Record').disabled).toBe(true);
    act(() => useStore.setState({ phase: 'FLYING', recording: { ...INITIAL_RECORDING, status: 'error', error: { code: 'unsupported', message: 'Video unavailable.' } } }));
    expect(container.textContent).toContain('Video unavailable.'); expect(button('Record').disabled).toBe(true);
    act(() => useStore.setState({ phase: 'PICKER', recording: { ...INITIAL_RECORDING } }));
    expect(container.textContent).toBe('');
  });
});
