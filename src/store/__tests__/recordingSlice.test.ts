import { describe, expect, it } from 'vitest';
import { useStore } from '..';

describe('recording state', () => {
  it('starts idle and survives resetting the flight session', () => {
    expect(useStore.getState().recording.status).toBe('idle');
    const snapshot = { ...useStore.getState().recording, status: 'ready' as const, filename: 'flight.webm' };
    useStore.getState().setRecording(snapshot);
    useStore.getState().resetSession();
    expect(useStore.getState().recording).toEqual(snapshot);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});
