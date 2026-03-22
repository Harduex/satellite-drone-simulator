import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

export class MapController {
  private map: google.maps.Map | null = null;
  private marker: google.maps.marker.AdvancedMarkerElement | null = null;
  private autocomplete: google.maps.places.Autocomplete | null = null;
  onLocationSelect:
    | ((location: { lat: number; lng: number; name: string }) => void)
    | null = null;

  async init(
    container: HTMLElement,
    apiKey: string,
    searchInput: HTMLInputElement,
  ): Promise<void> {
    setOptions({ key: apiKey, v: "weekly" });

    await importLibrary("maps");
    await importLibrary("places");
    await importLibrary("marker");

    this.map = new google.maps.Map(container, {
      center: { lat: 48.8584, lng: 2.2945 }, // Eiffel Tower default
      zoom: 15,
      mapTypeId: "satellite",
      disableDefaultUI: true,
      zoomControl: true,
      mapId: "fpvsim-map",
    });

    // Click to select spawn point
    this.map!.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      this.setMarker(lat, lng);
      this.onLocationSelect?.({
        lat,
        lng,
        name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });
    });

    // Places Autocomplete
    this.autocomplete = new google.maps.places.Autocomplete(searchInput, {
      fields: ["geometry", "name", "formatted_address"],
    });
    this.autocomplete!.addListener("place_changed", () => {
      const place = this.autocomplete?.getPlace();
      if (!place?.geometry?.location) return;
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      this.setMarker(lat, lng);
      this.flyTo(lat, lng, 16);
      this.onLocationSelect?.({
        lat,
        lng,
        name: place.name ?? place.formatted_address ??
          `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      });
    });
  }

  setMarker(lat: number, lng: number): void {
    if (!this.map) return;
    if (this.marker) {
      this.marker.position = { lat, lng };
    } else {
      this.marker = new google.maps.marker.AdvancedMarkerElement({
        map: this.map,
        position: { lat, lng },
      });
    }
  }

  flyTo(lat: number, lng: number, zoom: number): void {
    this.map?.panTo({ lat, lng });
    this.map?.setZoom(zoom);
  }

  destroy(): void {
    this.map = null;
    this.marker = null;
    this.autocomplete = null;
  }
}
