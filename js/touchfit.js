// Phones that ask for the desktop site (the "Desktop site" switch in Chrome, Brave or Safari) lay the page out about
// 980px wide and draw it tiny, so the phone layout, the joystick and readable text disappear. On a touch device whose
// layout is much wider than its screen, the UI layers are zoomed back up to the phone's real width (CSS zoom), the
// stylesheet's size breakpoints are scaled to match, and viewport units are re-expressed in that width, so the game
// looks and plays exactly as it does in normal mobile mode. UIZ.k is the zoom (1 everywhere else); code that places
// things by pointer or screen coordinates inside a zoomed layer divides by it.
export const UIZ = { k: 1, touch: false };
export const vw = () => innerWidth / UIZ.k;
export const vh = () => innerHeight / UIZ.k;

const root = document.documentElement;
let media = null, units = null;
const ruleList = () => {
  const out = [];
  const walk = (list) => { for (const r of list) { out.push(r); if (r.cssRules) walk(r.cssRules); } };
  for (const sh of document.styleSheets) { let list; try { list = sh.cssRules; } catch { continue; } walk(list); }
  return out;
};

export function fitTouch() {
  const touch = matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints || 0) > 0;
  const land = innerWidth > innerHeight, sw = Math.min(screen.width, screen.height), sh = Math.max(screen.width, screen.height);
  const real = land ? sh : sw;
  let k = touch && real > 0 ? innerWidth / real : 1;
  k = k < 1.2 ? 1 : Math.min(4, Math.round(k * 1000) / 1000);
  UIZ.touch = touch;
  root.classList.toggle('touch', touch);
  root.style.setProperty('--lw', innerWidth / k / 100 + 'px');
  root.style.setProperty('--lh', innerHeight / k / 100 + 'px');
  if (k === UIZ.k && media) return;
  UIZ.k = k;
  root.style.setProperty('--uiz', k);
  root.classList.toggle('uiz', k !== 1);
  if (!media) {
    // remember every breakpoint and every declaration that uses vw / vh, once
    media = []; units = [];
    for (const r of ruleList()) {
      if (r.media && /\d(px)/.test(r.media.mediaText)) media.push([r, r.media.mediaText]);
      if (r.style) for (const p of r.style) { const v = r.style.getPropertyValue(p); if (/\d(vw|vh)\b/.test(v)) units.push([r, p, v, r.style.getPropertyPriority(p)]); }
    }
  }
  for (const [r, txt] of media) r.media.mediaText = k === 1 ? txt : txt.replace(/(\d+(?:\.\d+)?)px/g, (_, n) => `${Math.round(n * k)}px`);
  for (const [r, p, v, pr] of units) r.style.setProperty(p, k === 1 ? v : v.replace(/(-?\d*\.?\d+)v(w|h)\b/g, (_, n, a) => `calc(${n} * var(--l${a}))`), pr);
}
