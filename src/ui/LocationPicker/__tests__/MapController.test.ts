// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { MapController } from '../MapController';

const loader = vi.hoisted(() => ({ wait: Promise.resolve() as Promise<void> }));
vi.mock('@googlemaps/js-api-loader', () => ({ setOptions: vi.fn(), importLibrary: () => loader.wait }));
afterEach(() => vi.unstubAllGlobals());

it('does not create a billable map after pending initialization is destroyed', async () => {
  let release!: () => void;
  loader.wait = new Promise(resolve => { release = resolve; });
  const createMap = vi.fn(function () { return { addListener: vi.fn() }; });
  const autocomplete = vi.fn(function () { return { addListener: vi.fn() }; });
  vi.stubGlobal('google', { maps: { Map: createMap, places: { Autocomplete: autocomplete } } });
  const controller = new MapController();
  const pending = controller.init(document.createElement('div'), 'test-key', document.createElement('input'));
  controller.destroy();
  release();
  await pending;
  expect(createMap).not.toHaveBeenCalled();
  loader.wait = Promise.resolve();
});
