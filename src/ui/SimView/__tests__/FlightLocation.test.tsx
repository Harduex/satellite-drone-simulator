// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FlightLocation } from '../FlightLocation';
import { useStore } from '../../../store';
import placeNames from '../../../world/data/place-names.json?raw';
import type { MapPosition } from '../../../core/navigation/types';

let root: Root;
let container: HTMLDivElement;
let clock = 0;
const paris = { lat: 48.8566, lng: 2.3522 };
const berlin = { lat: 52.52, lng: 13.405 };
function move(position: MapPosition | null) {
  useStore.getState().updateNavigation(position ? {
    position, home: paris, heading: 0, homeDirection: 0, homeDistance: 0, trail: [],
  } : null);
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(placeNames)));
  clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  container = document.createElement('div');
  root = createRoot(container);
  move(paris);
});
afterEach(() => {
  act(() => root.unmount());
  move(null);
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules();
});

it('uses current coordinates while local data loads, then shows city and country', async () => {
  let release!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { release = resolve; })));
  act(() => root.render(<FlightLocation fallbackName="Old launch label" />));
  await act(async () => {
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  });
  expect(container.textContent).toBe('48.8566, 2.3522');
  await act(async () => { release(new Response(placeNames)); });
  expect(container.textContent).toContain('Near Paris');
  expect(container.textContent).toContain('France');
});

it('updates the city and country after travel and clears the previous session label', async () => {
  act(() => root.render(<FlightLocation fallbackName="Launch" />));
  await act(async () => {
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  });
  expect(container.textContent).toContain('Paris');
  clock = 1001;
  act(() => move(berlin));
  expect(container.textContent).toContain('Near Berlin');
  expect(container.textContent).toContain('Germany');
  act(() => move(null));
  expect(container.textContent).toBe('Launch');
  act(() => move(paris));
  expect(container.textContent).toContain('Paris');
});

it('falls back to live coordinates when the local name asset cannot load', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
  act(() => root.render(<FlightLocation fallbackName="Old launch label" />));
  await act(async () => {
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
  });
  expect(container.textContent).toBe('48.8566, 2.3522');
  act(() => move(berlin));
  expect(container.textContent).toBe('52.5200, 13.4050');
});
