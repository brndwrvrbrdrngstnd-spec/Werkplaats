/* Service worker: houdt de app-bestanden beschikbaar zonder verbinding.
   Gegevens uit SharePoint worden nooit gecachet; die gaan altijd rechtstreeks naar Microsoft. */
var CACHE = "voertuigenlogboek-v1";
var SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "graph.js",
  "config.js",
  "manifest.webmanifest",
  "vendor/msal-browser.min.js",
  "vendor/xlsx.full.min.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// Eerst het netwerk (zodat updates meteen zichtbaar zijn), bij geen verbinding de opgeslagen kopie.
self.addEventListener("fetch", function (e) {
  var req = e.request;
  var url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match("index.html"); });
    })
  );
});
