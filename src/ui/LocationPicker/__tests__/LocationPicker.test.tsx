// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { LocationPicker } from '../LocationPicker';
import urbanAreas from '../../../world/data/urban-areas.json?raw';
import { useStore } from '../../../store';

const mockLocateQuery = vi.fn();

vi.mock('../MapController', () => ({
  MapController: class {
    init = vi.fn().mockResolvedValue(true);
    setFlightMode = vi.fn();
    updateFlight = vi.fn();
    setMarker = vi.fn();
    flyTo = vi.fn();
    destroy = vi.fn();
    locateQuery = mockLocateQuery;
    onLocationSelect: ((loc: { lat: number; lng: number; name: string }) => void) | null = null;
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

it('locates pasted coordinates when Locate button is clicked', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
  const container = document.createElement('div');
  const root = createRoot(container);
  const onFlyHere = vi.fn().mockResolvedValue(undefined);

  mockLocateQuery.mockImplementation(async function (this: any, _query: string) {
    const loc = { lat: 48.8584, lng: 2.2945, name: '48.8584° N, 2.2945° E' };
    this.onLocationSelect?.(loc);
    return loc;
  });

  try {
    await act(async () => root.render(<LocationPicker compact={false} onFlyHere={onFlyHere} />));
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = '48.8584, 2.2945';

    const locateBtn = container.querySelector('button[title="Locate"]') as HTMLButtonElement;
    expect(locateBtn).not.toBeNull();

    await act(async () => {
      locateBtn.click();
    });

    expect(mockLocateQuery).toHaveBeenCalledWith('48.8584, 2.2945');
    const flyBtn = [...container.querySelectorAll('button')].find(b => b.textContent === 'Fly Here')!;
    expect(flyBtn.disabled).toBe(false);

    await act(async () => {
      flyBtn.click();
    });
    expect(onFlyHere).toHaveBeenCalledWith({
      lat: 48.8584,
      lon: 2.2945,
      name: '48.8584° N, 2.2945° E',
      random: undefined,
    });
  } finally {
    act(() => root.unmount());
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});

it('shows error when address or coordinates cannot be located', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
  const container = document.createElement('div');
  const root = createRoot(container);
  const onFlyHere = vi.fn().mockResolvedValue(undefined);

  mockLocateQuery.mockRejectedValue(new Error('Location not found'));

  try {
    await act(async () => root.render(<LocationPicker compact={false} onFlyHere={onFlyHere} />));
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = 'Unknown non-existent place';

    const locateBtn = container.querySelector('button[title="Locate"]') as HTMLButtonElement;
    expect(locateBtn).not.toBeNull();

    await act(async () => {
      locateBtn.click();
    });

    expect(mockLocateQuery).toHaveBeenCalledWith('Unknown non-existent place');
    const errorMsg = container.querySelector('[role="alert"].launchError, p[role="alert"]');
    expect(errorMsg).not.toBeNull();
    expect(errorMsg!.textContent).toMatch(/Location not found/i);
  } finally {
    act(() => root.unmount());
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});

it('locates address when Enter key submits the search form', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-key');
  const container = document.createElement('div');
  const root = createRoot(container);
  const onFlyHere = vi.fn().mockResolvedValue(undefined);

  mockLocateQuery.mockImplementation(async function (this: any, _query: string) {
    const loc = { lat: 37.7749, lng: -122.4194, name: 'San Francisco, CA, USA' };
    this.onLocationSelect?.(loc);
    return loc;
  });

  try {
    await act(async () => root.render(<LocationPicker compact={false} onFlyHere={onFlyHere} />));
    const input = container.querySelector('input') as HTMLInputElement;
    input.value = 'San Francisco';

    const form = container.querySelector('form') as HTMLFormElement;
    expect(form).not.toBeNull();

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(mockLocateQuery).toHaveBeenCalledWith('San Francisco');
    const flyBtn = [...container.querySelectorAll('button')].find(b => b.textContent === 'Fly Here')!;
    expect(flyBtn.disabled).toBe(false);

    await act(async () => {
      flyBtn.click();
    });
    expect(onFlyHere).toHaveBeenCalledWith({
      lat: 37.7749,
      lon: -122.4194,
      name: 'San Francisco, CA, USA',
      random: undefined,
    });
  } finally {
    act(() => root.unmount());
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});

