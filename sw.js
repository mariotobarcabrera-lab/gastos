const CACHE = "app-v4"; // cambia el número al publicar una versión nueva
const BASE = ["./", "./index.html", "./app.js", "./i18n.js", "./core.js", "./config.js", "./manifest.webmanifest",
              "./icons/icon-192.png", "./icons/icon-512.png"];
self.addEventListener("install", e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
    e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))
        .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
    const u = new URL(e.request.url);
    if(e.request.method !== "GET") return;
    if(u.origin !== location.origin && u.hostname !== "www.gstatic.com") return; // Firebase API: sin caché
    e.respondWith(caches.open(CACHE).then(async c => {
        const hit = await c.match(e.request);
        const red = fetch(e.request).then(r => { if(r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
        return hit || red;
    }));
});
