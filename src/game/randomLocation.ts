import { isLandLocation } from '../world/LandMask';

export interface RandomLocationResult {
  name: string;
  lat: number;
  lng: number;
  random: true;
}

export interface RandomLocationOptions {
  randomFn?: () => number;
}

/**
 * Urban-area proposals retain equal-area randomness; the land mask rejects coarse ocean overlap.
 */
export async function getRandomLocation(options: RandomLocationOptions = {}): Promise<RandomLocationResult> {
  const rand = options.randomFn ?? Math.random;
  const { sampleUrbanLocation } = await import('../world/UrbanAreas');

  for (let attempt = 0; attempt < 100; attempt++) {
    const { lat, lng } = await sampleUrbanLocation(rand);
    if (!isLandLocation(lat, lng)) continue;

    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    const name = `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;

    return { name, lat, lng, random: true };
  }
  throw new Error('Unable to select a random land location. Try again.');
}
