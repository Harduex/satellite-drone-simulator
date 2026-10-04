import { describe, expect, it } from 'vitest';
import { buildGoogleMapsUrl } from '../mapsUrl';

describe('buildGoogleMapsUrl', () => {
  it('builds a Maps URLs API search link with encoded lat,lng', () => {
    expect(buildGoogleMapsUrl(37.422, -122.0841)).toBe(
      'https://www.google.com/maps/search/?api=1&query=37.422000%2C-122.084100',
    );
  });
});
