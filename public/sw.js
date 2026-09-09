/* Generado por scripts/gen-sw.mjs — no editar a mano. Edita scripts/sw-template.js. */
const CACHE = "etude-e7350cbe2e69";
const OFFLINE = "/offline";

/** Rutas que se descargan al instalar para que la app arranque sin conexión. */
const PRECACHE = [
  "/",
  "/theory",
  "/practice",
  "/metronome",
  "/scores",
  "/glossary",
  "/settings",
  "/more",
  "/account",
  "/guide",
  "/symbols",
  "/faq",
  OFFLINE,
  "/manifest.webmanifest",
  "/fonts/bravura/Bravura.woff2",
  "/fonts/bravura/BravuraText.woff2",
  "/fonts/bravura/Academico.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Una URL que falle no debe impedir la instalación del resto.
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => {})));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // El propio service worker se pide siempre a la red: si no, no habría forma de actualizarlo.
  if (url.pathname === "/sw.js") return;
  // La API es dinámica (cuentas, progreso): siempre a la red.
  if (url.pathname.startsWith("/api/")) return;

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);

      // Revalidación en segundo plano: se sirve lo cacheado y se refresca para la próxima vez.
      const network = fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (cached) return cached;

      const fresh = await network;
      if (fresh) return fresh;

      // Sin red y sin caché: la página de offline solo tiene sentido al navegar.
      if (req.mode === "navigate") {
        const fallback = await cache.match(OFFLINE);
        if (fallback) return fallback;
      }
      return Response.error();
    })(),
  );
});
