export type GeographicPolygon = [number, number][][];

function insideRing(lng: number, lat: number, ring: GeographicPolygon[number]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function insidePolygon(lng: number, lat: number, rings: GeographicPolygon): boolean {
  return insideRing(lng, lat, rings[0]!) && !rings.slice(1).some(ring => insideRing(lng, lat, ring));
}
