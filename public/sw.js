/* VORTEX GAMING service worker — offline asset caching for the PWA shell. */
"use strict";

var CACHE = "vortex-v3.0.1";

/* Core shell + all game assets to keep the arcade fully playable offline. */
var PRECACHE = [
  "/index.html",
  "/offline.html",
  "/manifest.json",
  "/css/vortex.css",
  "/js/device-scanner.js",
  "/js/db.js",
  "/js/vortex-engine.js",
  "/js/vortex-fx.js",
  "/js/neon-snake.js",
  "/js/games-action.js",
  "/js/games-puzzle.js",
  "/js/games-retro.js",
  "/js/games-racing.js",
  "/js/vortex-gamification.js",
  "/js/vortex-interactions.js",
  "/js/vortex-telemetry.js",
  "/js/vortex-receipt.js",
  "/js/pwa.js",
  "/vendor/dexie.min.js",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(PRECACHE); }).then(function () {
      return self.skipWaiting();
    }).catch(function () { /* tolerate a partial precache in spotty networks */ })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);

  /* never intercept the API — telemetry must reach the network to queue/sync */
  if (url.pathname.indexOf("/api/") === 0) return;
  /* skip cross-origin (fonts/CDN libs) for clean handling */
  if (url.origin !== self.location.origin) return;

  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request).catch(function () {
        return caches.match("/index.html");
      })
    );
    return;
  }

  /* cache-first for static assets, with background refresh */
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fetching = fetch(e.request).then(function (res) {
        if (res.ok) {
          var clone = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || fetching;
    })
  );
});
