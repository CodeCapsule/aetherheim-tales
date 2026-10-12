// The installable app: the offline cache (sw.js) and the Install button. Chrome, Edge and Android browsers offer
// their own install prompt, which the button opens; iPhone and iPad install from Safari's Share menu, so there the
// button explains how. Nothing here runs inside the claude.ai page.
const framed = () => !!(window.claude && typeof window.claude.use === 'function');
let deferred = null; // the browser's install prompt, kept until the player asks for it
const listeners = new Set();
const changed = () => { for (const fn of listeners) fn(); };

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// the Install button shows when the browser can install the game, or on iOS where Safari's Share menu does it
export const canInstall = () => !framed() && !isStandalone() && (!!deferred || isIOS());
export function onInstallChange(fn) { listeners.add(fn); }

export function setupApp() {
  if (framed()) return;
  addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; changed(); });
  addEventListener('appinstalled', () => { deferred = null; changed(); });
  // the offline cache: on the public website (https), or on a local copy opened with ?sw to try it
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || new URLSearchParams(location.search).has('sw'))) {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
}

// ask the browser to install, or show the iOS steps; resolves true once installed
export async function installApp(modal) {
  if (deferred) {
    const e = deferred; deferred = null; changed();
    e.prompt();
    const r = await e.userChoice.catch(() => null);
    return r?.outcome === 'accepted';
  }
  if (isIOS()) modal('Install on iPhone or iPad', 'In Safari, tap the Share button (the square with an arrow), then “Add to Home Screen”. Aetherheim Tales then opens from its own icon, full screen.', [{ label: 'Got it' }]);
  return false;
}
