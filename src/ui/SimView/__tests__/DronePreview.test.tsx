// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DronePreview } from '../DronePreview';

const renderer = vi.hoisted(() => ({ load: vi.fn(), destroy: vi.fn(), setReducedMotion: vi.fn(), rotateBy: vi.fn(), resetView: vi.fn() }));
vi.mock('../../../world/DronePreviewRenderer', () => ({ DronePreviewRenderer: class {
  load = renderer.load; destroy = renderer.destroy; setReducedMotion = renderer.setReducedMotion;
  rotateBy = renderer.rotateBy; resetView = renderer.resetView;
} }));
let host: HTMLDivElement; let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.clearAllMocks();
  renderer.load.mockResolvedValue(undefined); renderer.destroy.mockClear();
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});

it.each(['mouse', 'touch'])('rotates only while dragging and keeps the released view (%s)', async pointerType => {
  act(() => root.render(<DronePreview />));
  await act(async () => { await vi.dynamicImportSettled(); });
  const stage = host.querySelector('[aria-label="Rotate aircraft preview"]') as HTMLDivElement;
  expect(stage).not.toBeNull();
  stage.setPointerCapture = vi.fn(); stage.releasePointerCapture = vi.fn(); stage.hasPointerCapture = () => true;
  vi.spyOn(stage, 'getBoundingClientRect').mockReturnValue({ width: 300, height: 300 } as DOMRect);
  const pointer = (type: string, x: number, y: number) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 });
    Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: pointerType }, isPrimary: { value: true } });
    act(() => stage.dispatchEvent(event));
  };
  pointer('pointermove', 50, 50);
  expect(renderer.rotateBy).not.toHaveBeenCalled();
  pointer('pointerdown', 50, 50);
  pointer('pointermove', 125, 80);
  expect(stage.setPointerCapture).toHaveBeenCalledWith(1);
  expect(renderer.rotateBy).toHaveBeenCalledWith(-Math.PI / 2, Math.PI / 10);
  pointer('pointerup', 125, 80);
  pointer('pointermove', 200, 100);
  expect(renderer.rotateBy).toHaveBeenCalledOnce();
  expect(renderer.resetView).not.toHaveBeenCalled();
  expect(stage.releasePointerCapture).toHaveBeenCalledWith(1);
});

it('supports keyboard orbit and an explicit reset', async () => {
  act(() => root.render(<DronePreview />));
  await act(async () => { await vi.dynamicImportSettled(); });
  const stage = host.querySelector('[aria-label="Rotate aircraft preview"]') as HTMLDivElement;
  expect(stage).not.toBeNull();
  act(() => stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })));
  expect(renderer.rotateBy).toHaveBeenCalledWith(Math.PI / 12, 0);
  act(() => stage.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })));
  expect(renderer.resetView).toHaveBeenCalledOnce();
  act(() => [...host.querySelectorAll('button')].find(button => button.textContent === 'Reset view')!.click());
  expect(renderer.resetView).toHaveBeenCalledTimes(2);
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

it('shows loading and disables orbit until the renderer completes its first frame', async () => {
  let finish!: () => void;
  renderer.load.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
  act(() => root.render(<DronePreview />));
  await act(async () => { await vi.dynamicImportSettled(); });
  expect(host.querySelector('[role="status"]')).not.toBeNull();
  expect(host.querySelector('[aria-label="Rotate aircraft preview"]')?.getAttribute('aria-disabled')).toBe('true');
  const reset = [...host.querySelectorAll('button')].find(button => button.textContent === 'Reset view')!;
  expect(reset.disabled).toBe(true);
  await act(async () => finish());
  expect(host.querySelector('[role="status"]')).toBeNull();
  expect(reset.disabled).toBe(false);
});
