import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import type { FlightNavigationSnapshot } from '../../store/droneSlice';
import { colors } from '../theme';

export class MapController {
  private map: google.maps.Map | null = null;
  private marker: google.maps.marker.AdvancedMarkerElement | null = null;
  private autocomplete: google.maps.places.Autocomplete | null = null;
  private flightMode = false;
  private destroyed = false;
  private droneMarker: google.maps.marker.AdvancedMarkerElement | null = null;
  private homeMarker: google.maps.marker.AdvancedMarkerElement | null = null;
  private trail: google.maps.Polyline | null = null;
  private droneArrow: HTMLElement | null = null;
  onLocationSelect:
    | ((location: { lat: number; lng: number; name: string }) => void)
    | null = null;

  async init(
    container: HTMLElement,
    apiKey: string,
    searchInput: HTMLInputElement,
    initialCenter?: { lat: number; lng: number },
    initialSelection?: { lat: number; lng: number; name: string },
  ): Promise<boolean> {
    setOptions({ key: apiKey, v: "weekly" });

    await importLibrary("maps");
    await Promise.all([
      importLibrary("places"),
      importLibrary("marker"),
      importLibrary("elevation"),
    ]);
    // React can dispose the picker while the Maps libraries are still loading.
    if (this.destroyed) return false;

    this.map = new google.maps.Map(container, {
      center: initialCenter ?? { lat: 48.8584, lng: 2.2945 }, // Eiffel Tower default
      zoom: 15,
      mapTypeId: "satellite",
      disableDefaultUI: true,
      zoomControl: true,
      mapId: "fpvsim-map",
      minZoom: 3,
      maxZoom: 21,
    });

    if (initialSelection) {
      this.setMarker(initialSelection.lat, initialSelection.lng);
      this.flyTo(initialSelection.lat, initialSelection.lng, 16);
      this.onLocationSelect?.(initialSelection);
    }

    // Click to select spawn point
    this.map!.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (this.flightMode) return;
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
    return true;
  }

  setFlightMode(enabled: boolean): void {
    this.flightMode = enabled;
    this.map?.setOptions({
      disableDefaultUI: true, zoomControl: !enabled, gestureHandling: enabled ? 'none' : 'auto',
      keyboardShortcuts: !enabled, clickableIcons: !enabled, heading: 0, tilt: 0,
    });
    if (this.marker) this.marker.map = enabled ? null : this.map;
    if (!enabled) {
      if (this.droneMarker) this.droneMarker.map = null;
      if (this.homeMarker) this.homeMarker.map = null;
      this.trail?.setMap(null);
    } else {
      this.map?.setZoom(17);
    }
  }

  updateFlight(navigation: FlightNavigationSnapshot): void {
    if (!this.map || !this.flightMode) return;
    if (!this.droneMarker) {
      this.droneArrow = document.createElement('div');
      // Advanced markers move content into Google's shadow root, outside app CSS.
      Object.assign(this.droneArrow.style, { width: '24px', height: '24px', transformOrigin: 'center' });
      this.droneArrow.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 21 21 12 17 3 21Z" fill="${colors.secondary}" stroke="${colors.surface}" stroke-width="2"/></svg>`;
      this.droneMarker = new google.maps.marker.AdvancedMarkerElement({
        content: this.droneArrow, title: 'Drone', zIndex: 2,
      });
      const home = document.createElement('div');
      Object.assign(home.style, { width: '22px', height: '22px', display: 'grid', placeItems: 'center',
        background: colors.surface, color: colors.primary, border: `2px solid ${colors.primary}`,
        borderRadius: '50%', font: '700 11px sans-serif' });
      home.textContent = 'H';
      this.homeMarker = new google.maps.marker.AdvancedMarkerElement({ content: home, title: 'Home' });
      this.trail = new google.maps.Polyline({ strokeColor: colors.secondary, strokeOpacity: 0.85,
        strokeWeight: 2, clickable: false });
    }
    this.droneMarker.map = this.map;
    this.droneMarker.position = navigation.position;
    this.droneArrow!.style.transform = `rotate(${navigation.heading}deg)`;
    this.homeMarker!.map = this.map;
    this.homeMarker!.position = navigation.home;
    this.trail!.setMap(this.map);
    this.trail!.setPath([...navigation.trail]);
    const bounds = this.map.getBounds();
    const center = this.map.getCenter();
    if (!bounds || !center) {
      this.map.setCenter(navigation.position);
      return;
    }
    const spanLat = bounds.getNorthEast().lat() - bounds.getSouthWest().lat();
    const spanLng = (bounds.getNorthEast().lng() - bounds.getSouthWest().lng() + 360) % 360;
    const deltaLng = ((navigation.position.lng - center.lng() + 540) % 360) - 180;
    if (Math.abs(navigation.position.lat - center.lat()) > spanLat * 0.3 || Math.abs(deltaLng) > spanLng * 0.3) {
      this.map.setCenter(navigation.position);
    }
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

  goToCurrentLocation(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          this.setMarker(lat, lng);
          this.flyTo(lat, lng, 16);
          this.onLocationSelect?.({
            lat,
            lng,
            name: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          });
          resolve({ lat, lng });
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.onLocationSelect = null;
    if (this.map) google.maps.event.clearInstanceListeners(this.map);
    if (this.autocomplete) google.maps.event.clearInstanceListeners(this.autocomplete);
    if (this.marker) this.marker.map = null;
    if (this.droneMarker) this.droneMarker.map = null;
    if (this.homeMarker) this.homeMarker.map = null;
    this.trail?.setMap(null);
    this.map = null;
    this.marker = null;
    this.autocomplete = null;
  }
}
