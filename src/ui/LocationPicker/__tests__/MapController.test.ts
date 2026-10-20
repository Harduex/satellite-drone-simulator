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

it('locates coordinates directly without calling geocoder', async () => {
  const panTo = vi.fn();
  const setZoom = vi.fn();
  const createMap = vi.fn(function () {
    return { addListener: vi.fn(), panTo, setZoom };
  });
  const AdvancedMarkerElement = vi.fn(function () {
    return { position: null, map: null };
  });
  const Geocoder = vi.fn();
  vi.stubGlobal('google', {
    maps: {
      Map: createMap,
      places: { Autocomplete: vi.fn(function () { return { addListener: vi.fn() }; }) },
      marker: { AdvancedMarkerElement },
      Geocoder,
    },
  });

  const controller = new MapController();
  const onSelect = vi.fn();
  controller.onLocationSelect = onSelect;
  await controller.init(document.createElement('div'), 'test-key', document.createElement('input'));

  const result = await controller.locateQuery('48.8584, 2.2945');
  expect(result.lat).toBeCloseTo(48.8584);
  expect(result.lng).toBeCloseTo(2.2945);
  expect(panTo).toHaveBeenCalledWith(expect.objectContaining({ lat: expect.closeTo(48.8584), lng: expect.closeTo(2.2945) }));
  expect(setZoom).toHaveBeenCalledWith(16);
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ lat: expect.closeTo(48.8584), lng: expect.closeTo(2.2945) }));
  expect(Geocoder).not.toHaveBeenCalled();
});

it('geocodes address when input is not coordinates', async () => {
  const panTo = vi.fn();
  const setZoom = vi.fn();
  const createMap = vi.fn(function () {
    return { addListener: vi.fn(), panTo, setZoom };
  });
  const AdvancedMarkerElement = vi.fn(function () {
    return { position: null, map: null };
  });
  const geocode = vi.fn((_req, callback) => {
    callback(
      [
        {
          formatted_address: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
          geometry: {
            location: {
              lat: () => 37.422,
              lng: () => -122.084,
            },
          },
        },
      ],
      'OK',
    );
  });
  const Geocoder = vi.fn(function () {
    return { geocode };
  });

  vi.stubGlobal('google', {
    maps: {
      Map: createMap,
      places: { Autocomplete: vi.fn(function () { return { addListener: vi.fn() }; }) },
      marker: { AdvancedMarkerElement },
      Geocoder,
    },
  });

  const controller = new MapController();
  const onSelect = vi.fn();
  controller.onLocationSelect = onSelect;
  await controller.init(document.createElement('div'), 'test-key', document.createElement('input'));

  const result = await controller.locateQuery('1600 Amphitheatre Pkwy');
  expect(result.lat).toBe(37.422);
  expect(result.lng).toBe(-122.084);
  expect(result.name).toBe('1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA');
  expect(geocode).toHaveBeenCalledWith({ address: '1600 Amphitheatre Pkwy' }, expect.any(Function));
  expect(panTo).toHaveBeenCalledWith({ lat: 37.422, lng: -122.084 });
  expect(onSelect).toHaveBeenCalledWith({
    lat: 37.422,
    lng: -122.084,
    name: '1600 Amphitheatre Pkwy, Mountain View, CA 94043, USA',
  });
});

it('throws an error when geocoder finds no results', async () => {
  const geocode = vi.fn((_req, callback) => {
    callback([], 'ZERO_RESULTS');
  });
  vi.stubGlobal('google', {
    maps: {
      Map: vi.fn(function () { return { addListener: vi.fn() }; }),
      places: { Autocomplete: vi.fn(function () { return { addListener: vi.fn() }; }) },
      Geocoder: vi.fn(function () { return { geocode }; }),
    },
  });

  const controller = new MapController();
  await controller.init(document.createElement('div'), 'test-key', document.createElement('input'));

  await expect(controller.locateQuery('Unknown non-existent location 123456789')).rejects.toThrow(
    'Location not found',
  );
});
