// Offline cache for the installed app. The game's own files come from the network whenever it answers, so every
// update arrives right away, and from the cache when it does not (the game then plays solo). Libraries pinned to a
// version on the CDN never change, so they come from the cache first. Multiplayer (Supabase) always goes to the network.
const CACHE = 'aetherheim-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './img/icon-192.png', './img/icon-512.png'];
const PINNED = /^https:\/\/cdn\.jsdelivr\.net\/npm\/(@[^/]+\/)?[^/@]+@\d/;
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req, url));
  else if (PINNED.test(req.url)) e.respondWith(cacheFirst(req));
  else if (FONTS.test(req.url)) e.respondWith(cacheFirst(req, true));
});

const keep = (res) => res && (res.ok || res.type === 'opaque');
async function networkFirst(req, url) {
  const cache = await caches.open(CACHE);
  // pages are stored without their query (?join=...), so an invite link still opens offline
  const key = req.mode === 'navigate' ? url.origin + url.pathname : req;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (hit) return hit;
    throw err;
  }
}
// refresh: also fetch a newer copy in the background for next time (fonts)
async function cacheFirst(req, refresh = false) {
  const cache = await caches.open(CACHE), hit = await cache.match(req);
  if (hit && !refresh) return hit;
  const fresh = fetch(req).then((res) => { if (keep(res)) cache.put(req, res.clone()); return res; });
  if (hit) { fresh.catch(() => {}); return hit; }
  return fresh;
}
