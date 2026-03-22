/**
 * Registers the tile caching Service Worker.
 * Call once on app startup.
 */
export async function registerTileCacheSW(): Promise<void> {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service Workers not supported — tile caching disabled");
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(
      "/tile-cache-sw.js",
      { scope: "/" },
    );

    // Send config to the SW once it's active
    const sw = registration.active || registration.installing || registration.waiting;
    if (sw) {
      sendConfig(sw);
    }

    // Also send config when a new SW activates
    registration.addEventListener("updatefound", () => {
      const newSW = registration.installing;
      if (newSW) {
        newSW.addEventListener("statechange", () => {
          if (newSW.state === "activated") {
            sendConfig(newSW);
          }
        });
      }
    });

    console.log("Tile cache Service Worker registered");
  } catch (e) {
    console.warn("Failed to register tile cache SW:", e);
  }
}

function sendConfig(sw: ServiceWorker): void {
  const indefiniteCache =
    import.meta.env.VITE_TILE_CACHE_INDEFINITE === "true";
  const maxCacheSizeMB =
    parseInt(import.meta.env.VITE_TILE_CACHE_MAX_MB || "0", 10) || 0;
  sw.postMessage({
    type: "CONFIG",
    indefiniteCache,
    maxCacheSizeMB,
  });
}
