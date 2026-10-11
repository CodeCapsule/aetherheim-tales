// Hand-authored SVG icon set, served as isolated data-URI images so every device renders them identically.
import { SKILL_ICONS } from './icons/skills.js';
import { UI_ICONS } from './icons/ui.js';
import { ITEM_ICONS } from './icons/items.js';
import { EXTRA_ICONS } from './icons/extra.js';
import { EXTRA2_ICONS } from './icons/extra2.js';
import { UPGRADE_ICONS } from './icons/upgrade.js';

const ALL = { ...UI_ICONS, ...ITEM_ICONS, ...SKILL_ICONS, ...EXTRA_ICONS, ...EXTRA2_ICONS, ...UPGRADE_ICONS };

// Neutral rune-stone shown if a key is ever missing, so nothing renders as a broken image.
const FALLBACK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><radialGradient id="fb-g" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#8ab0ff"/><stop offset="1" stop-color="#2a3a8a"/></radialGradient></defs><path d="M32 5 L56 20 L56 44 L32 59 L8 44 L8 20 Z" fill="url(#fb-g)" stroke="#1b1430" stroke-width="3" stroke-linejoin="round"/><path d="M32 18 L42 32 L32 46 L22 32 Z" fill="#e8f0ff" stroke="#1b1430" stroke-width="2.5" stroke-linejoin="round"/></svg>';

const urls = new Map();
export function hasIcon(key) { return Object.prototype.hasOwnProperty.call(ALL, key); }
export function iconUrl(key) {
  let u = urls.get(key);
  if (!u) {
    let svg = (hasIcon(key) ? ALL[key] : FALLBACK).trim();
    // give the image an intrinsic size so <img>, canvas and WebGL uploads all decode it
    if (!/^<svg[^>]*\swidth=/.test(svg)) svg = svg.replace('<svg', '<svg width="128" height="128"');
    u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    urls.set(key, u);
  }
  return u;
}
export function ico(key, cls = 'ico') { return `<img class="${cls}" src="${iconUrl(key)}" alt="" draggable="false">`; }

// Rasterized copy for use as a WebGL texture (loot sprites); resolves to a canvas.
const rasters = new Map();
export function iconCanvas(key, size = 128) {
  const k = key + '|' + size;
  if (!rasters.has(k)) {
    rasters.set(k, new Promise((resolve) => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const img = new Image();
      img.onload = () => { try { c.getContext('2d').drawImage(img, 0, 0, size, size); } catch { /* leave blank */ } resolve(c); };
      img.onerror = () => resolve(c);
      img.src = iconUrl(key);
    }));
  }
  return rasters.get(k);
}

// Add or override an icon at runtime (e.g. template-generated relic / seed / costume icons); drops any
// cached data URL and rasters for that key so the next lookup uses the new markup.
export function registerIcon(key, svg) {
  ALL[key] = svg;
  urls.delete(key);
  for (const k of [...rasters.keys()]) if (k.slice(0, k.lastIndexOf('|')) === key) rasters.delete(k);
}
