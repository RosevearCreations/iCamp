const CACHE_NAME = "icamp-shell-v2";
const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/offline-maintenance.html",
  "/offline-maintenance.css",
  "/offline-maintenance.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || event.request.mode !== "navigate") {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(() => {
      const url = new URL(event.request.url);
      if (url.pathname === "/workspaces/maintenance/offline") {
        return caches.match("/offline-maintenance.html");
      }
      return caches.match(event.request).then(
        (cached) => cached || caches.match("/"),
      );
    }),
  );
});
