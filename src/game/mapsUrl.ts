/** Google Maps URLs API link for a coordinate (https://developers.google.com/maps/documentation/urls/get-started). */
export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)}%2C${lng.toFixed(6)}`;
}
