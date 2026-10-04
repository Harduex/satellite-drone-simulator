export interface MapPosition {
  lat: number;
  lng: number;
}

export interface FlightNavigationSnapshot {
  position: MapPosition;
  home: MapPosition;
  heading: number;
  homeDirection: number;
  homeDistance: number;
  trail: readonly MapPosition[];
}
