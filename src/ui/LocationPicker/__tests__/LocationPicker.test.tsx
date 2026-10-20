// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { LocationPicker } from '../LocationPicker';
import urbanAreas from '../../../world/data/urban-areas.json?raw';
import { useStore } from '../../../store';

vi.mock('../MapController', () => ({
  MapController: class {
    init = vi.fn().mockResolvedValue(true);
    setFlightMode = vi.fn();
    updateFlight = vi.fn();
    setMarker = vi.fn();
    flyTo = vi.fn();
    destroy = vi.fn();
  },
}));

it('preserves collapse and expansion when the minimap remounts', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
  localStorage.clear();
  const container = document.createElement('div');
  let root = createRoot(container);
  const onFlyHere = vi.fn().mockResolvedValue(undefined);
  try {
    await act(async () => root.render(<LocationPicker compact onFlyHere={onFlyHere} />));
    act(() => (container.querySelector('[aria-label="Hide minimap"]') as HTMLButtonElement).click());
    expect(localStorage.getItem('fpvsim_minimap_collapsed')).toBe('true');
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<LocationPicker compact onFlyHere={onFlyHere} />));
    expect(container.querySelector('[aria-label="Show minimap"]')).not.toBeNull();
    act(() => (container.querySelector('[aria-label="Show minimap"]') as HTMLButtonElement).click());
    expect(localStorage.getItem('fpvsim_minimap_collapsed')).toBe('false');
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<LocationPicker compact onFlyHere={onFlyHere} />));
    expect(container.querySelector('[aria-label="Hide minimap"]')).not.toBeNull();
  } finally {
    act(() => root.unmount());
    useStore.setState({ minimapCollapsed: false });
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});

it('selects a random location when the random button in search bar is clicked', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(urbanAreas)));
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
  const container = document.createElement('div');
  const root = createRoot(container);
  const onFlyHere = vi.fn().mockResolvedValue(undefined);
  try {
    await act(async () => root.render(<LocationPicker compact={false} onFlyHere={onFlyHere} />));
    const randomBtn = container.querySelector('button[title="Random location"]') as HTMLButtonElement;
    expect(randomBtn).not.toBeNull();
    await act(async () => {
      randomBtn.click();
      await vi.waitFor(() => expect((container.querySelector('input') as HTMLInputElement).value).toMatch(/°[NS], .*°[EW]/));
    });
    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toMatch(/°[NS], .*°[EW]/);
    const fly = [...container.querySelectorAll('button')].find(button => button.textContent === 'Fly Here')!;
    await act(async () => fly.click());
    expect(onFlyHere).toHaveBeenCalledWith(expect.objectContaining({ random: true }));
  } finally {
    act(() => root.unmount());
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});
