// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RecoveryPrompt } from '../RecoveryPrompt';
import { useStore } from '../../../store';

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  useStore.setState({ flightCondition: 'flying', recoveryUnavailable: false });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

it('shows no status message or prompt for gentle landings', () => {
  useStore.setState({ flightCondition: 'landed' });
  act(() => root.render(<RecoveryPrompt />));
  expect(container.textContent).toBe('');
  expect(container.querySelector('button')).toBeNull();
});

it.each(['impact', 'geometry'] as const)('shows no recovery message for %s', flightCondition => {
  useStore.setState({ flightCondition });
  act(() => root.render(<RecoveryPrompt />));
  expect(container.textContent).toBe('');
});

it('shows a passive Space hint only when the drone is disabled', () => {
  useStore.setState({ flightCondition: 'disabled' });
  act(() => root.render(<RecoveryPrompt />));
  expect(container.textContent).toContain('motors disabled');
  expect(container.textContent).toContain('Space');
  expect(container.querySelector('button')).toBeNull();
});
