// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DronePreview } from '../DronePreview';

const renderer = vi.hoisted(() => ({ load: vi.fn(), destroy: vi.fn(), setPointer: vi.fn(), setReducedMotion: vi.fn() }));
vi.mock('../../../world/DronePreviewRenderer', () => ({ DronePreviewRenderer: class {
  load = renderer.load; destroy = renderer.destroy; setPointer = renderer.setPointer; setReducedMotion = renderer.setReducedMotion;
} }));
let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.clearAllMocks();
  renderer.load.mockResolvedValue(undefined); renderer.destroy.mockClear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it('loads the real preview and disposes its renderer when leaving pause', async () => {
  act(() => root.render(<DronePreview />));
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(renderer.load).toHaveBeenCalled();
  expect(host.querySelector('[role="status"]')).toBeNull();
  act(() => root.render(null)); expect(renderer.destroy).toHaveBeenCalledOnce();
});
it('keeps an explicit fallback on model failure and permits retry', async () => {
  renderer.load.mockRejectedValueOnce(new Error('Model unavailable'));
  act(() => root.render(<DronePreview />));
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.textContent).toContain('Preview unavailable');
  expect(host.querySelector('button')?.textContent).toBe('Retry preview');
  expect(renderer.destroy).toHaveBeenCalled();
});
