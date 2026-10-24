// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PlacesDialog } from '../PlacesDialog';
import { useStore } from '../../../store';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const place = { lat: 48.8584, lng: 2.2945, name: 'Tower' };
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
  localStorage.clear();
  useStore.setState({ favoritePlaces: [], recentPlaces: [], placesStorageError: null });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal'); Reflect.deleteProperty(HTMLDialogElement.prototype, 'close');
});
function button(label: string) { return [...host.querySelectorAll('button')].find(b => b.textContent === label || b.firstChild?.textContent?.trim() === label)!; }
function render(onLaunch = vi.fn(async () => true), onClose = vi.fn(), selection: typeof place | null = place) {
  act(() => root.render(<PlacesDialog selection={selection} onLaunch={onLaunch} onClose={onClose} onReturnToPicker={vi.fn(async () => {})} />));
  return { onLaunch, onClose };
}

it('bookmarks the selected place and launches it immediately from Favorites', async () => {
  const { onLaunch, onClose } = render();
  act(() => button('Save favorite').click());
  expect(useStore.getState().favoritePlaces).toEqual([place]);
  await act(async () => button('Tower').click());
  expect(onLaunch).toHaveBeenCalledWith(place);
  expect(onClose).toHaveBeenCalledOnce();
});

it('shows both empty lists and can launch or bookmark a recent place', async () => {
  render();
  expect(host.textContent).toContain('No favorites yet');
  act(() => button('Recent').click());
  expect(host.textContent).toContain('No recent flights');
  act(() => useStore.getState().recordRecentPlace(place));
  act(() => button('Save').click());
  expect(host.querySelector<HTMLInputElement>('input')?.value).toBe('Tower');
  act(() => button('Save favorite').click());
  expect(useStore.getState().favoritePlaces).toEqual([place]);
});

it('blocks repeated launches while loading and allows retry after failure', async () => {
  useStore.getState().addFavorite(place);
  let reject!: (error: Error) => void;
  const launch = vi.fn(() => new Promise<boolean>((_resolve, fail) => { reject = fail; }));
  const { onClose } = render(launch);
  act(() => button('Tower').click());
  expect(button('Loading…').disabled).toBe(true);
  act(() => button('Loading…').click());
  expect(launch).toHaveBeenCalledOnce();
  await act(async () => reject(new Error('load failed')));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Unable to load');
  expect(button('Retry')).toBeDefined();
  expect(button('Choose location')).toBeDefined();
  expect(onClose).not.toHaveBeenCalled();
  expect(useStore.getState().favoritePlaces).toHaveLength(1);
});

it('reports storage failure visibly while keeping the favorite in session', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  render();
  act(() => button('Save favorite').click());
  expect(host.querySelector('[role="status"]')?.textContent).toContain('session only');
  expect(useStore.getState().favoritePlaces).toHaveLength(1);
});

it('consumes Escape before resume and restores focus to its trigger', () => {
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
  const resume = vi.fn(); window.addEventListener('keydown', resume);
  try {
    const { onClose } = render();
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })));
    expect(onClose).toHaveBeenCalledOnce();
    expect(resume).not.toHaveBeenCalled();
    act(() => root.render(null));
    expect(document.activeElement).toBe(trigger);
  } finally { window.removeEventListener('keydown', resume); trigger.remove(); }
});

it('contains focus at both dialog boundaries', () => {
  render();
  const controls = host.querySelectorAll<HTMLElement>('button, input');
  const first = controls[0]!, last = controls[controls.length - 1]!;
  last.focus();
  act(() => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(first);
  first.focus();
  act(() => first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
  expect(document.activeElement).toBe(last);
});


it('renames and removes a favorite through the dialog without deleting recent history', () => {
  useStore.getState().addFavorite(place);
  useStore.getState().recordRecentPlace(place);
  render();
  act(() => button('Rename').click());
  const input = host.querySelector<HTMLInputElement>('input')!;
  input.value = 'My tower';
  act(() => button('Save name').click());
  expect(useStore.getState().favoritePlaces[0]?.name).toBe('My tower');
  act(() => button('Remove').click());
  expect(useStore.getState().favoritePlaces).toEqual([]);
  expect(useStore.getState().recentPlaces).toEqual([place]);
});

it('launches a recent place directly and clears history independently', async () => {
  useStore.getState().recordRecentPlace(place);
  useStore.getState().addFavorite(place);
  const { onLaunch } = render();
  act(() => button('Recent').click());
  await act(async () => button('Tower').click());
  expect(onLaunch).toHaveBeenCalledWith(place);
  act(() => button('Clear recent').click());
  expect(useStore.getState().recentPlaces).toEqual([]);
  expect(useStore.getState().favoritePlaces).toEqual([place]);
});

it('retries a failed launch and returns to the map on request', async () => {
  useStore.getState().addFavorite(place);
  const launch = vi.fn(async () => false);
  const close = vi.fn();
  const returnToPicker = vi.fn(async () => {});
  act(() => root.render(<PlacesDialog selection={null} onLaunch={launch} onClose={close} onReturnToPicker={returnToPicker} />));
  await act(async () => button('Tower').click());
  await act(async () => button('Retry').click());
  expect(launch).toHaveBeenCalledTimes(2);
  await act(async () => button('Choose location').click());
  expect(returnToPicker).toHaveBeenCalledOnce();
  expect(close).not.toHaveBeenCalled();
});
