// Phones play in landscape. A page may only turn the screen while it is in full screen, so the first tap puts the game
// in full screen and locks it sideways (Android browsers: Chrome, Brave, Samsung Internet). Leaving full screen (the Back
// button) and tapping again goes back. Where the browser cannot do it (iPhones), a hint asks to turn the phone.
// Settings can turn it off; the choice is kept on this device.
import { UIZ } from './touchfit.js';

const KEY = 'hiraya_landscape';
let lockFailed = false, hintOff = false, busy = false;

export const isPhone = () => UIZ.touch && Math.min(screen.width, screen.height) <= 600;
export function landscapeOn() { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } }

// full screen and sideways (call it from a tap: browsers only allow full screen right after one)
export function goLandscape() {
  if (!isPhone() || !landscapeOn() || busy) return;
  const el = document.documentElement;
  if (!document.fullscreenElement && !el.requestFullscreen) { lockFailed = true; refreshHint(); return; }
  busy = true;
  const full = document.fullscreenElement ? Promise.resolve() : el.requestFullscreen({ navigationUI: 'hide' });
  full.then(() => (screen.orientation?.lock ? screen.orientation.lock('landscape') : Promise.reject(new Error('no lock'))))
    .then(() => { lockFailed = false; }, () => { lockFailed = true; })
    .finally(() => { busy = false; refreshHint(); });
}

export function setLandscape(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
  if (on) { hintOff = false; goLandscape(); }
  else {
    try { screen.orientation?.unlock?.(); } catch { /* not locked */ }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }
  refreshHint();
}

// held upright where the screen could not be turned: ask to turn the phone (or keep playing upright)
function refreshHint() {
  let el = document.getElementById('rotate-hint');
  const show = isPhone() && landscapeOn() && lockFailed && !hintOff && innerHeight > innerWidth;
  if (!show) { if (el) el.hidden = true; return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'rotate-hint'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Turn your phone sideways');
    el.innerHTML = `<div class="frame"><svg viewBox="0 0 64 64" aria-hidden="true"><rect x="22" y="8" width="20" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><rect x="12" y="34" width="36" height="20" rx="4" fill="currentColor" opacity=".35"/><path d="M50 18a14 14 0 0 1 2 16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M53 30l-1 5-5-2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <b>Turn your phone sideways</b><span>Hiraya Tales plays best in landscape.</span><button class="btn small gray">Play upright</button></div>`;
    el.querySelector('button').onclick = () => { hintOff = true; refreshHint(); };
    document.body.appendChild(el);
  }
  el.hidden = false;
}

export function initLandscape() {
  // a tap with a finger (not a mouse) while not in full screen: go full screen and sideways
  document.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse' && !document.fullscreenElement) goLandscape(); }, true);
  addEventListener('resize', refreshHint);
  document.addEventListener('fullscreenchange', refreshHint);
  if (isPhone() && !document.documentElement.requestFullscreen) { lockFailed = true; refreshHint(); } // it cannot turn: ask right away (not in the middle of a tap)
}
