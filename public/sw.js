// Service Worker NITIDO — minimal si SIGUR.
// Reguli de siguranta (site cu plati):
//  - NU atinge niciodata cererile /api/, POST, sau cross-origin -> mereu retea.
//  - Navigari (pagini): network-first -> daca esti offline, arata /offline.html.
//  - Doar fisierele statice imutabile (_next/static, iconite, fonturi, imagini)
//    sunt cache-uite (cache-first). Astea au hash in nume, deci nu raman vechi.
const VERSION = "nitido-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/design-v2/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|ico|gif)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Doar GET, doar same-origin. Restul (API, POST, plati, alt domeniu) -> retea directa.
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Navigari (pagini HTML): network-first, offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Fisiere statice imutabile: cache-first, apoi retea (si le salveaza).
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return resp;
        })
      )
    );
  }
});
