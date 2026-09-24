// Service worker: lets the installed app open with no signal. It never caches data.
//
// - /api/* is never touched: the app's own offline queue (src/lib/sync.ts) handles data.
// - Pages are network-first: online you always get the latest build, so this can never pin
//   old code. The cached copy is only a fallback when the network fails.
// - /_next/static/* files have content hashes in their names, so a cached copy is always right.
// Bump CACHE to drop everything cached by an older worker.
const CACHE = "water-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

async function put(req, res) {
  if (res.ok && res.type === "basic") {
    const cache = await caches.open(CACHE);
    await cache.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req, fallbackUrl) {
  try {
    return await put(req, await fetch(req));
  } catch (err) {
    const hit = (await caches.match(req, { ignoreSearch: true })) ?? (fallbackUrl && (await caches.match(fallbackUrl)));
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js" || url.searchParams.has("_rsc")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(req).then((hit) => hit ?? fetch(req).then((res) => put(req, res))));
  } else if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, "/"));
  } else {
    event.respondWith(networkFirst(req));
  }
});
