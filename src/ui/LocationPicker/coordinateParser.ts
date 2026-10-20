export interface ParsedCoordinates {
  lat: number;
  lng: number;
  formatted: string;
}

export function formatCoordinates(lat: number, lng: number): string {
  const latStr = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lngStr = `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lngStr}`;
}

function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// Google Maps URL pattern: /@lat,lng or ?q=lat,lng or &ll=lat,lng or /place/lat,lng
const GOOGLE_MAPS_URL_REGEX =
  /(?:@|[?&](?:q|ll)=|\/place\/)(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i;

// DMS / DDM / Directional pattern: e.g. 48°51'29.9"N 2°17'40.2"E or 40° 42′ 46″ N, 74° 00′ 22″ W or 48.8584° N, 2.2945° E
const DMS_COMPONENT_REGEX =
  /([NSEW]?)\s*(\d{1,3}(?:\.\d+)?)(?:[°\s]+(?:(\d+(?:\.\d+)?)['′\s]*(?:(\d+(?:\.\d+)?)["″\s]*)?)?)?\s*([NSEW]?)/i;

export function parseCoordinates(rawInput: string): ParsedCoordinates | null {
  if (!rawInput) return null;
  const input = rawInput.trim();
  if (!input) return null;

  // 1. Google Maps URL
  const urlMatch = input.match(GOOGLE_MAPS_URL_REGEX);
  if (urlMatch && urlMatch[1] && urlMatch[2]) {
    const lat = parseFloat(urlMatch[1]);
    const lng = parseFloat(urlMatch[2]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng, formatted: formatCoordinates(lat, lng) };
    }
    return null;
  }

  // Normalize quotes and primes
  const normalized = input
    .replace(/[′’]/g, "'")
    .replace(/[″”]/g, '"');

  // Check if it's DMS / DDM (contains degree symbol or minutes/seconds indicators with cardinal letters)
  const isDms = /[°'"]|[NSEW]/i.test(normalized) && /\d+.*[NSEW]/i.test(normalized);

  if (isDms) {
    // Split into two halves by comma, semicolon, slash, or between N/S and E/W
    const parts = splitCoordinateHalves(normalized);
    if (parts) {
      const lat = parseDmsOrDirectional(parts.first, true);
      const lng = parseDmsOrDirectional(parts.second, false);
      if (lat !== null && lng !== null && isValidCoordinate(lat, lng)) {
        return { lat, lng, formatted: formatCoordinates(lat, lng) };
      }
    }
  }

  // 2. Standard decimal degrees, possibly with directional letters:
  // e.g. "48.8584, 2.2945", "-33.8688, 151.2093", "48.8584 -122.3321", "48.8584° N, 2.2945° E"
  const ddRegex = /^\s*([NSEW]?)\s*([+-]?\d+(?:\.\d+)?)[°]?\s*([NSEW]?)\s*[,;\s/]+\s*([NSEW]?)\s*([+-]?\d+(?:\.\d+)?)[°]?\s*([NSEW]?)\s*$/i;
  const ddMatch = normalized.match(ddRegex);
  if (ddMatch && ddMatch[2] && ddMatch[5]) {
    const p1Dir = (ddMatch[1] || ddMatch[3] || '').toUpperCase();
    let val1 = parseFloat(ddMatch[2]);
    const p2Dir = (ddMatch[4] || ddMatch[6] || '').toUpperCase();
    let val2 = parseFloat(ddMatch[5]);

    let lat: number | null = null;
    let lng: number | null = null;

    if (p1Dir === 'S') val1 = -Math.abs(val1);
    if (p1Dir === 'W') val1 = -Math.abs(val1);
    if (p2Dir === 'S') val2 = -Math.abs(val2);
    if (p2Dir === 'W') val2 = -Math.abs(val2);

    if ((p1Dir === 'N' || p1Dir === 'S') && (p2Dir === 'E' || p2Dir === 'W')) {
      lat = val1;
      lng = val2;
    } else if ((p1Dir === 'E' || p1Dir === 'W') && (p2Dir === 'N' || p2Dir === 'S')) {
      lat = val2;
      lng = val1;
    } else if (!p1Dir && !p2Dir) {
      lat = val1;
      lng = val2;
    }

    if (lat !== null && lng !== null && isValidCoordinate(lat, lng)) {
      return { lat, lng, formatted: formatCoordinates(lat, lng) };
    }
  }

  return null;
}

function splitCoordinateHalves(text: string): { first: string; second: string } | null {
  // If comma, semicolon, or slash present, split on that
  const separatorMatch = text.match(/^(.+?)[,;/]\s*(.+)$/);
  if (separatorMatch && separatorMatch[1] && separatorMatch[2]) {
    return { first: separatorMatch[1].trim(), second: separatorMatch[2].trim() };
  }

  // Otherwise split after N or S (e.g. 48°51'29.9"N 2°17'40.2"E)
  const cardinalSplit = text.match(/^(.+?[NS])\s+([0-9EW].+)$/i);
  if (cardinalSplit && cardinalSplit[1] && cardinalSplit[2]) {
    return { first: cardinalSplit[1].trim(), second: cardinalSplit[2].trim() };
  }

  return null;
}

function parseDmsOrDirectional(str: string, expectLat: boolean): number | null {
  const match = str.match(DMS_COMPONENT_REGEX);
  if (!match || !match[2]) return null;

  const dir = (match[1] || match[5] || '').toUpperCase();
  const degrees = parseFloat(match[2]);
  const minutes = match[3] ? parseFloat(match[3]) : 0;
  const seconds = match[4] ? parseFloat(match[4]) : 0;

  if (isNaN(degrees) || isNaN(minutes) || isNaN(seconds)) return null;

  let decimal = degrees + minutes / 60 + seconds / 3600;

  if (dir === 'S' || dir === 'W') {
    decimal = -decimal;
  } else if (!dir && expectLat && degrees < 0) {
    // signed degrees
    decimal = -Math.abs(decimal);
  }

  return decimal;
}
