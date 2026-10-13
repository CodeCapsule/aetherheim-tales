// Icon set: the seven element crystals (Gorm's weapon infusion) and the Infuse tab. A crystal cluster in the element's
// colours with its sign on the big shard. Gradient ids are "el-<key>-<part>" so they never collide with other sets.
const C = '#24160f';
const INK = `stroke="${C}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const stops = (c) => c.map((s, i) => `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('');
const lg = (id, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops(c)}</linearGradient>`;
const rg = (id, c) => `<radialGradient id="${id}" cx="50%" cy="50%" r="50%">${stops(c)}</radialGradient>`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>${body}</svg>`;
const spark = (x, y, s = 4, f = '#fff') => `<path d="M${x} ${y - s}Q${x + s * 0.2} ${y - s * 0.2} ${x + s} ${y}Q${x + s * 0.2} ${y + s * 0.2} ${x} ${y + s}Q${x - s * 0.2} ${y + s * 0.2} ${x - s} ${y}Q${x - s * 0.2} ${y - s * 0.2} ${x} ${y - s}Z" fill="${f}"/>`;

// the sign of each element, drawn on the big shard (centre about 32,32)
const SIGN = {
  fire: '<path d="M32 22C36 28 39 31 38 36C37 41 34 43 32 43C28 43 25 40 26 35C27 31 30 31 30 27C33 29 33 31 34 32C35 29 34 25 32 22Z" fill="#fff6c0" stroke="#8a2a08" stroke-width="1.6" stroke-linejoin="round"/>',
  storm: '<path d="M35 20L26 34H32L28 45L39 30H33L35 20Z" fill="#ffffff" stroke="#1a3a8a" stroke-width="1.6" stroke-linejoin="round"/>',
  frost: '<g stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"><path d="M32 21V43M22.5 26.5L41.5 37.5M22.5 37.5L41.5 26.5"/><path d="M29 23.5L32 26L35 23.5M29 40.5L32 38L35 40.5" fill="none" stroke-width="1.8"/></g>',
  wind: '<g fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"><path d="M22 29H36A4 4 0 1 0 32 25"/><path d="M22 35H40A4 4 0 1 1 36 39"/><path d="M25 41H31"/></g>',
  earth: '<path d="M24 41L29 27L33 33L36 26L42 41Z" fill="#fff0c8" stroke="#5a3a10" stroke-width="1.6" stroke-linejoin="round"/>',
  light: `<circle cx="32" cy="32" r="5" fill="#ffffff"/><g stroke="#ffffff" stroke-width="2.2" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => { const r = (a * Math.PI) / 180; return `<path d="M${(32 + Math.cos(r) * 8).toFixed(1)} ${(32 + Math.sin(r) * 8).toFixed(1)}L${(32 + Math.cos(r) * 12).toFixed(1)} ${(32 + Math.sin(r) * 12).toFixed(1)}"/>`; }).join('')}</g>`,
  shadow: '<path d="M36 21A11 11 0 1 0 36 43A9 9 0 1 1 36 21Z" fill="#f0e0ff" stroke="#2a0a5a" stroke-width="1.6"/>',
};
// [highlight, light, mid, dark, glow]
const LOOK = {
  fire: ['#fff2c0', '#ffb04a', '#ff5a1a', '#8a1a08', '#ff8a3a'],
  storm: ['#f0f8ff', '#8ac8ff', '#3a7aff', '#14286a', '#8ab8ff'],
  frost: ['#ffffff', '#c8f4ff', '#6ad0ff', '#1a5a8a', '#b8f0ff'],
  wind: ['#f4fff8', '#a8ffd8', '#3ad89a', '#0a5a4a', '#a8ffd8'],
  earth: ['#fff0c8', '#e8b866', '#a8702a', '#4a2a10', '#ffd08a'],
  light: ['#ffffff', '#fff2a8', '#ffc83a', '#8a5a0a', '#fff0a0'],
  shadow: ['#f0e0ff', '#c08aff', '#7a3ad8', '#260a4a', '#c08aff'],
};
function crystalIcon(key, el) {
  const c = LOOK[el], id = (s) => `el-${key}-${s}`, u = (s) => `url(#${id(s)})`;
  return svg(lg(id('a'), [c[0], c[1], c[2], c[3]]) + rg(id('g'), [c[4], 'rgba(0,0,0,0)']),
    `<circle cx="32" cy="34" r="27" fill="${u('g')}" opacity=".55"/>
<path d="M12 50L17 30L23 46Z" fill="${c[2]}"/><path d="M17 30L23 46L20 50Z" fill="${c[3]}" opacity=".6"/><path d="M12 50L17 30L23 46Z" fill="none" ${INK}/>
<path d="M52 50L47 32L41 46Z" fill="${c[2]}"/><path d="M47 32L41 46L44 50Z" fill="${c[3]}" opacity=".6"/><path d="M52 50L47 32L41 46Z" fill="none" ${INK}/>
<path d="M32 6L44 22L41 52H23L20 22Z" fill="${u('a')}"/><path d="M32 6L44 22L32 26Z" fill="${c[0]}" opacity=".7"/><path d="M32 6L20 22L32 26Z" fill="${c[1]}" opacity=".6"/>
<path d="M44 22L41 52H32V26Z" fill="${c[3]}" opacity=".35"/>
<path d="M32 6L44 22L41 52H23L20 22Z" fill="none" ${INK}/>
<path d="M14 54H50" stroke="${C}" stroke-width="3" stroke-linecap="round"/>
${SIGN[el]}${spark(50, 14, 3.6)}${spark(13, 20, 2.6)}`);
}

const ICONS = {};
for (const el of Object.keys(LOOK)) ICONS['crys_' + el] = crystalIcon('crys_' + el, el);
// the Infuse tab: an anvil-lit sword with a swirl of the elements
ICONS.infuse = svg(lg('el-infuse-b', ['#ffffff', '#c8d4e8', '#6a7a9a']) + rg('el-infuse-g', ['#fff0a0', 'rgba(255,200,80,0)']),
  `<circle cx="32" cy="30" r="26" fill="url(#el-infuse-g)" opacity=".7"/>
<path d="M29 8H35L36 38H28Z" fill="url(#el-infuse-b)"/><path d="M29 8L32 3L35 8Z" fill="#ffffff"/><path d="M29 8H35L36 38H28Z" fill="none" ${INK}/>
<path d="M20 38H44V43H20Z" fill="#e8b866"/><path d="M20 38H44V43H20Z" fill="none" ${INK}/><path d="M29.5 43H34.5V56H29.5Z" fill="#6a4a2a"/><path d="M29.5 43H34.5V56H29.5Z" fill="none" ${INK}/>
<path d="M14 24C18 14 26 12 26 12" fill="none" stroke="#ff7a3a" stroke-width="3.4" stroke-linecap="round"/><path d="M50 24C46 14 38 12 38 12" fill="none" stroke="#5aa8ff" stroke-width="3.4" stroke-linecap="round"/>
<path d="M12 34C14 44 22 48 22 48" fill="none" stroke="#7affc0" stroke-width="3.4" stroke-linecap="round"/><path d="M52 34C50 44 42 48 42 48" fill="none" stroke="#c08aff" stroke-width="3.4" stroke-linecap="round"/>
${spark(48, 52, 3.6)}${spark(16, 52, 3)}`);

export const ELEMENT_ICONS = ICONS;
