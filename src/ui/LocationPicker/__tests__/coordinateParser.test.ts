import { describe, expect, it } from 'vitest';
import { parseCoordinates } from '../coordinateParser';

describe('parseCoordinates', () => {
  it('parses basic decimal degrees (lat, lng)', () => {
    const result = parseCoordinates('48.8584, 2.2945');
    expect(result).not.toBeNull();
    expect(result!.lat).toBeCloseTo(48.8584);
    expect(result!.lng).toBeCloseTo(2.2945);
    expect(result!.formatted).toBe('48.8584° N, 2.2945° E');
  });

  it('parses negative decimal degrees with space or comma separation', () => {
    const res1 = parseCoordinates('-33.8688, 151.2093');
    expect(res1).not.toBeNull();
    expect(res1!.lat).toBeCloseTo(-33.8688);
    expect(res1!.lng).toBeCloseTo(151.2093);
    expect(res1!.formatted).toBe('33.8688° S, 151.2093° E');

    const res2 = parseCoordinates('48.8584 -122.3321');
    expect(res2).not.toBeNull();
    expect(res2!.lat).toBeCloseTo(48.8584);
    expect(res2!.lng).toBeCloseTo(-122.3321);
    expect(res2!.formatted).toBe('48.8584° N, 122.3321° W');
  });

  it('parses directional decimal degrees with N/S/E/W suffix or prefix', () => {
    const res1 = parseCoordinates('48.8584° N, 2.2945° E');
    expect(res1).not.toBeNull();
    expect(res1!.lat).toBeCloseTo(48.8584);
    expect(res1!.lng).toBeCloseTo(2.2945);

    const res2 = parseCoordinates('37.7749 S, 122.4194 W');
    expect(res2).not.toBeNull();
    expect(res2!.lat).toBeCloseTo(-37.7749);
    expect(res2!.lng).toBeCloseTo(-122.4194);

    const res3 = parseCoordinates('N 48.8584, E 2.2945');
    expect(res3).not.toBeNull();
    expect(res3!.lat).toBeCloseTo(48.8584);
    expect(res3!.lng).toBeCloseTo(2.2945);
  });

  it('parses degrees, minutes, seconds (DMS) format', () => {
    const res = parseCoordinates('48°51\'29.9"N 2°17\'40.2"E');
    expect(res).not.toBeNull();
    expect(res!.lat).toBeCloseTo(48.858305, 4);
    expect(res!.lng).toBeCloseTo(2.2945, 4);
  });

  it('parses DMS with unicode prime symbols', () => {
    const res = parseCoordinates('40° 42′ 46″ N, 74° 00′ 22″ W');
    expect(res).not.toBeNull();
    expect(res!.lat).toBeCloseTo(40.712778, 4);
    expect(res!.lng).toBeCloseTo(-74.006111, 4);
  });

  it('parses degrees and decimal minutes (DDM) format', () => {
    const res = parseCoordinates("48° 51.498' N, 2° 17.670' E");
    expect(res).not.toBeNull();
    expect(res!.lat).toBeCloseTo(48.8583, 3);
    expect(res!.lng).toBeCloseTo(2.2945, 3);
  });

  it('extracts coordinates from Google Maps URLs', () => {
    const url1 = parseCoordinates('https://www.google.com/maps/@48.8584,2.2945,15z');
    expect(url1).not.toBeNull();
    expect(url1!.lat).toBeCloseTo(48.8584);
    expect(url1!.lng).toBeCloseTo(2.2945);

    const url2 = parseCoordinates('https://maps.google.com/?q=37.7749,-122.4194');
    expect(url2).not.toBeNull();
    expect(url2!.lat).toBeCloseTo(37.7749);
    expect(url2!.lng).toBeCloseTo(-122.4194);
  });

  it('parses degrees and minutes without seconds', () => {
    const res = parseCoordinates("48°51'N 2°17'E");
    expect(res).not.toBeNull();
    expect(res!.lat).toBeCloseTo(48.85, 2);
    expect(res!.lng).toBeCloseTo(2.283, 2);
  });

  it('parses degrees with no spaces between value and cardinal direction', () => {
    const res = parseCoordinates('48.8584°N, 2.2945°E');
    expect(res).not.toBeNull();
    expect(res!.lat).toBeCloseTo(48.8584);
    expect(res!.lng).toBeCloseTo(2.2945);
  });

  it('returns null for non-coordinate text or out-of-range coordinates', () => {
    expect(parseCoordinates('Eiffel Tower, Paris')).toBeNull();
    expect(parseCoordinates('1600 Amphitheatre Pkwy, Mountain View, CA')).toBeNull();
    expect(parseCoordinates('95.0, 20.0')).toBeNull(); // lat > 90
    expect(parseCoordinates('-91.0, 20.0')).toBeNull(); // lat < -90
    expect(parseCoordinates('20.0, 185.0')).toBeNull(); // lng > 180
    expect(parseCoordinates('20.0, -185.0')).toBeNull(); // lng < -180
    expect(parseCoordinates('')).toBeNull();
    expect(parseCoordinates('abc 123')).toBeNull();
  });
});
