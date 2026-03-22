// Service Worker for caching Google Maps and 3D Tile requests.
// Intercepts fetch requests to tile.googleapis.com and maps.googleapis.com,
// caching responses with configurable TTL and LRU eviction.

const CACHE_NAME = "tile-cache-v1";
const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Domains to cache
const CACHEABLE_HOSTS = [
  "tile.googleapis.com",
  "maps.googleapis.com",
  "khms0.googleapis.com",
  "khms1.googleapis.com",
  "khms2.googleapis.com",
  "khms3.googleapis.com",
];

// Metadata store for TTL tracking (URL -> timestamp)
const META_CACHE_NAME = "tile-cache-meta-v1";

// Read config from registration message
let indefiniteCache = false;

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CONFIG") {
    indefiniteCache = Boolean(event.data.indefiniteCache);
  }
});

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only intercept cacheable hosts
  if (!CACHEABLE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith("." + h))) {
    return;
  }

  // Only cache GET requests
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(handleCacheableRequest(event.request));
});

async function handleCacheableRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const metaCache = await caches.open(META_CACHE_NAME);

  // Check if we have a cached response
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    // Check TTL (unless indefinite caching is enabled)
    if (!indefiniteCache) {
      const metaResponse = await metaCache.match(request);
      if (metaResponse) {
        const meta = await metaResponse.json();
        const age = Date.now() - meta.timestamp;
        if (age > DEFAULT_TTL_MS) {
          // Expired — fetch fresh in background and serve stale
          fetchAndCache(request, cache, metaCache).catch(() => {});
        }
      }
    }
    return cachedResponse;
  }

  // Not cached — fetch from network
  return fetchAndCache(request, cache, metaCache);
}

async function fetchAndCache(request, cache, metaCache) {
  const response = await fetch(request);

  // Only cache successful responses
  if (response.ok) {
    const responseClone = response.clone();

    // Store the response
    cache.put(request, responseClone).catch(() => {});

    // Store metadata with timestamp
    const metaBody = JSON.stringify({ timestamp: Date.now() });
    const metaResponse = new Response(metaBody, {
      headers: { "Content-Type": "application/json" },
    });
    metaCache.put(request, metaResponse).catch(() => {});

    // Periodic eviction check (don't block the response)
    evictIfNeeded(cache, metaCache).catch(() => {});
  }

  return response;
}

async function evictIfNeeded(cache, metaCache) {
  // Only run eviction ~5% of the time to avoid overhead
  if (Math.random() > 0.05) return;

  const keys = await cache.keys();

  // Estimate total size (rough — use response headers if available)
  let totalSize = 0;
  const entries = [];
  for (const req of keys) {
    const metaResp = await metaCache.match(req);
    let timestamp = 0;
    if (metaResp) {
      const meta = await metaResp.json();
      timestamp = meta.timestamp || 0;
    }
    entries.push({ request: req, timestamp });
    // Rough size estimate: 50KB per tile on average
    totalSize += 50 * 1024;
  }

  if (totalSize <= MAX_CACHE_SIZE_BYTES) return;

  // Sort by oldest first (LRU eviction)
  entries.sort((a, b) => a.timestamp - b.timestamp);

  // Evict oldest 20% of entries
  const evictCount = Math.ceil(entries.length * 0.2);
  for (let i = 0; i < evictCount; i++) {
    await cache.delete(entries[i].request);
    await metaCache.delete(entries[i].request);
  }
}
