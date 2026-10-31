const CACHE_NAME = "pp-deflicker-shell-v2";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./vendor/ffmpeg/esm/index.js",
  "./vendor/ffmpeg/esm/classes.js",
  "./vendor/ffmpeg/esm/const.js",
  "./vendor/ffmpeg/esm/errors.js",
  "./vendor/ffmpeg/esm/utils.js",
  "./vendor/ffmpeg/esm/worker.js",
  "./vendor/util/esm/index.js",
  "./vendor/util/esm/const.js",
  "./vendor/util/esm/errors.js",
  "./vendor/util/esm/types.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith("pp-deflicker-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Leave cross-origin requests to the browser; FFmpeg dependencies are bundled locally.
  if (url.origin !== self.location.origin || request.method !== "GET") return;

  // Navigation: try the network first, then use the cached app shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Same-origin app assets: prefer the cache, then populate it from network.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
