// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isRecoveryShortcut } from '../recoveryShortcut';

describe('recovery shortcut', () => {
  it('accepts one unmodified Space press', () => {
    expect(isRecoveryShortcut(new KeyboardEvent('keydown', { code: 'Space' }))).toBe(true);
    expect(isRecoveryShortcut(new KeyboardEvent('keydown', { code: 'Space', repeat: true }))).toBe(false);
    expect(isRecoveryShortcut(new KeyboardEvent('keydown', { code: 'Space', ctrlKey: true }))).toBe(false);
  });
  it.each(['input', 'textarea', 'select', 'button'])('preserves Space on %s controls', tag => {
    const element = document.createElement(tag);
    const event = new KeyboardEvent('keydown', { code: 'Space', bubbles: true });
    let recover = false;
    element.addEventListener('keydown', e => { recover = isRecoveryShortcut(e as KeyboardEvent); });
    element.dispatchEvent(event);
    expect(recover).toBe(false);
  });
});
