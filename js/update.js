// A newer version of the game is out: show an Update bar (the game saves, then the page reloads). The publish step writes
// version.json next to the page and loads every script with the version in its address, so a reload always gets the
// new one. Checked when the game opens, every few minutes, when you come back to the tab, and when another player on a
// newer version shows up (mp.js).
import { BUILD } from './build.js';

const EVERY = 3 * 60e3;
let shown = false, last = 0, saveGame = null;

export async function checkUpdate(force = false) {
  if (!BUILD || shown || (!force && Date.now() - last < 60e3)) return;
  last = Date.now();
  try {
    const r = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' }); if (!r.ok) return;
    const v = await r.json();
    if (+v.build > BUILD) showUpdate();
  } catch { /* offline: try again later */ }
}

function showUpdate() {
  if (shown) return;
  shown = true;
  const bar = document.createElement('div'); bar.id = 'update-bar'; bar.className = 'frame'; bar.setAttribute('role', 'status');
  bar.innerHTML = '<span>A new version of Hiraya Tales is ready</span><button class="btn small green">Update</button>';
  bar.querySelector('button').onclick = () => { try { saveGame && saveGame(); } catch { /* saving is best effort */ } location.reload(); };
  document.body.appendChild(bar);
}

export function watchUpdates(save) {
  saveGame = save;
  if (!BUILD) return;
  checkUpdate(true);
  setInterval(() => checkUpdate(), EVERY);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checkUpdate(); });
}
