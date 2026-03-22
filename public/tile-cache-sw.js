// Service Worker for caching Google Maps and 3D Tile requests.
// Intercepts fetch requests to tile.googleapis.com and maps.googleapis.com,
// caching responses with configurable TTL and LRU eviction.

const CACHE_NAME = "tile-cache-v1";
const META_CACHE_NAME = "tile-cache-meta-v1";
const MAX_CACHE_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
const EVICTION_TARGET_RATIO = 0.8; // evict down to 80% capacity
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const EVICTION_BATCH_SIZE = 20;
const DEFAULT_TILE_SIZE = 50 * 1024; // 50KB fallback when Content-Length missing

// Domains to cache
const CACHEABLE_HOSTS = [
  "tile.googleapis.com",
  "maps.googleapis.com",
  "khms0.googleapis.com",
  "khms1.googleapis.com",
  "khms2.googleapis.com",
  "khms3.googleapis.com",
];

// Read config from registration message
let indefiniteCache = false;

// Running byte counter — avoids full cache enumeration on every eviction check.
// Lazily initialized from the actual cache on first eviction threshold check.
let estimatedTotalBytes = 0;
let bytesInitialized = false;
let evictionInProgress = false;

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
    const contentLength = parseInt(response.headers.get("Content-Length") || "0", 10);
    const size = contentLength > 0 ? contentLength : DEFAULT_TILE_SIZE;

    // Store the response
    cache.put(request, responseClone).catch(() => {});

    // Store metadata with timestamp and size for LRU eviction
    const metaBody = JSON.stringify({ timestamp: Date.now(), size });
    const metaResponse = new Response(metaBody, {
      headers: { "Content-Type": "application/json" },
    });
    metaCache.put(request, metaResponse).catch(() => {});

    // Track running byte counter
    estimatedTotalBytes += size;

    // Threshold-based eviction (not probabilistic)
    if (estimatedTotalBytes > MAX_CACHE_SIZE_BYTES) {
      evictIfNeeded(cache, metaCache).catch(() => {});
    }
  }

  return response;
}

/**
 * Lazy-initialize the byte counter from the actual cache contents.
 * Runs once, then the running counter takes over.
 */
async function initBytesFromCache(metaCache) {
  if (bytesInitialized) return;
  bytesInitialized = true;

  try {
    const keys = await metaCache.keys();
    let total = 0;
    for (const req of keys) {
      const metaResp = await metaCache.match(req);
      if (metaResp) {
        try {
          const meta = await metaResp.json();
          total += meta.size || DEFAULT_TILE_SIZE;
        } catch {
          total += DEFAULT_TILE_SIZE;
        }
      } else {
        total += DEFAULT_TILE_SIZE;
      }
    }
    estimatedTotalBytes = total;
  } catch {
    // If enumeration fails, keep the running estimate
  }
}

async function evictIfNeeded(cache, metaCache) {
  // Re-entrancy guard — only one eviction at a time
  if (evictionInProgress) return;
  evictionInProgress = true;

  try {
    // Lazy-init byte counter from actual cache on first eviction
    await initBytesFromCache(metaCache);

    // Re-check after initialization
    if (estimatedTotalBytes <= MAX_CACHE_SIZE_BYTES) return;

    const keys = await cache.keys();
    const entries = [];
    for (const req of keys) {
      const metaResp = await metaCache.match(req);
      let timestamp = 0;
      let size = DEFAULT_TILE_SIZE;
      if (metaResp) {
        try {
          const meta = await metaResp.json();
          timestamp = meta.timestamp || 0;
          size = meta.size || DEFAULT_TILE_SIZE;
        } catch {
          // corrupt meta — use defaults
        }
      }
      entries.push({ request: req, timestamp, size });
    }

    // Sort oldest first for LRU eviction
    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Evict until we're at target capacity
    const targetBytes = MAX_CACHE_SIZE_BYTES * EVICTION_TARGET_RATIO;
    let bytesFreed = 0;
    const toEvict = [];
    for (const entry of entries) {
      if (estimatedTotalBytes - bytesFreed <= targetBytes) break;
      toEvict.push(entry);
      bytesFreed += entry.size;
    }

    // Batch deletes with yielding to avoid blocking
    for (let i = 0; i < toEvict.length; i += EVICTION_BATCH_SIZE) {
      const batch = toEvict.slice(i, i + EVICTION_BATCH_SIZE);
      await Promise.all(
        batch.map((e) =>
          Promise.all([cache.delete(e.request), metaCache.delete(e.request)])
        )
      );
      // Yield to allow other SW tasks to proceed
      if (i + EVICTION_BATCH_SIZE < toEvict.length) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    estimatedTotalBytes -= bytesFreed;
  } finally {
    evictionInProgress = false;
  }
}
