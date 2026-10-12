// The game no longer installs as an app. Browsers that registered the old offline cache fetch this file on their
// next visit: it deletes that cache and unregisters itself, and the game loads straight from the website again.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.delete('aetherheim-v1').then(() => self.registration.unregister()));
});
