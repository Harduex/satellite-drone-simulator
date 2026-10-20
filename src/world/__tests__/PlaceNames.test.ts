import { expect, it } from 'vitest';
import { createPlaceLookup, type PlaceNameData } from '../PlaceNames';

const data: PlaceNameData = {
  countries: [
    { code: 'AAA', name: 'Country A', polygons: [[[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]]] },
    { code: 'BBB', name: 'Country B', polygons: [[[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]]] },
  ],
  settlements: [
    { lat: 0.5, lng: 0.6, name: 'West Town', region: 'West Region', country: 'Country A', code: 'AAA' },
    { lat: 0.5, lng: 1.01, name: 'East Town', region: 'East Region', country: 'Country B', code: 'BBB' },
  ],
};

it('shows a nearby settlement, region and country as an approximation', () => {
  expect(createPlaceLookup(data)({ lat: 0.5, lng: 0.6 })).toBe('Near West Town, West Region, Country A');
});
it('changes country at a border and avoids naming a closer foreign settlement', () => {
  const lookup = createPlaceLookup(data);
  expect(lookup({ lat: 0.5, lng: 0.99 })).toContain('West Town');
  expect(lookup({ lat: 0.5, lng: 1.02 })).toBe('Near East Town, East Region, Country B');
});
it('shows only the country when no settlement is within 50 km', () => {
  expect(createPlaceLookup(data)({ lat: 0, lng: 0 })).toBe('Country A');
});
it('handles small islands and nearby settlements across the antimeridian', () => {
  const lookup = createPlaceLookup({ countries: [], settlements: [
    { lat: 0, lng: -179.9, name: 'Island Town', region: '', country: 'Island Country', code: 'ISL' },
  ] });
  expect(lookup({ lat: 0, lng: 179.9 })).toBe('Near Island Town, Island Country');
  expect(lookup({ lat: 0, lng: 0 })).toBeNull();
});
it('returns no label for invalid coordinates', () => {
  expect(createPlaceLookup(data)({ lat: NaN, lng: 0 })).toBeNull();
  expect(createPlaceLookup(data)({ lat: 91, lng: 0 })).toBeNull();
});
