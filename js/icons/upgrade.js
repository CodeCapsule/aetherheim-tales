// Icon set #3 (SVG, 64x64): arcane gems, soulstones, enhancement stones, charms and the socket drill. Same ink-and-gloss
// style as extra.js; every gradient id is "z-<key>-<part>" so ids never collide with the other sets.
const C = '#24160f';
const INK = `stroke="${C}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const INK2 = `stroke="${C}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const stops = (c) => c.map((s, i) => `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${s}"/>`).join('');
const lg = (id, c) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops(c)}</linearGradient>`;
const rg = (id, c, cx = '40%', cy = '35%', r = '65%') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(c)}</radialGradient>`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>${body}</svg>`;
const spark = (x, y, s = 4, f = '#fff') => `<path d="M${x} ${y - s}Q${x + s * 0.2} ${y - s * 0.2} ${x + s} ${y}Q${x + s * 0.2} ${y + s * 0.2} ${x} ${y + s}Q${x - s * 0.2} ${y + s * 0.2} ${x - s} ${y}Q${x - s * 0.2} ${y - s * 0.2} ${x} ${y - s}Z" fill="${f}"/>`;
const glint = (x, y, r = 3) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.55}" fill="#fff" opacity=".85" transform="rotate(-35 ${x} ${y})"/>`;

// faceted gem shapes; c = [highlight, light, mid, dark]
function gemIcon(key, shape, c) {
  const id = (s) => `z-${key}-${s}`, u = (s) => `url(#${id(s)})`;
  if (shape === 'diamond') return svg(lg(id('a'), [c[1], c[2], c[3]]),
    `<path d="M10 23L21 9H43L54 23L32 57Z" fill="${u('a')}"/><path d="M21 9L26 23H38L43 9Z" fill="${c[0]}" opacity=".85"/>
<path d="M10 23H54L32 57Z" fill="${c[3]}" opacity=".35"/><path d="M26 23L32 57L38 23Z" fill="${c[1]}" opacity=".55"/>
<path d="M10 23H54M21 9L26 23L32 57L38 23L43 9M10 23L26 23M38 23L54 23" fill="none" stroke="${C}" stroke-width="1.4" opacity=".45"/>
<path d="M10 23L21 9H43L54 23L32 57Z" fill="none" ${INK}/>${glint(25, 15, 2.6)}${spark(50, 38, 4)}${spark(14, 44, 2.6)}`);
  if (shape === 'oval') return svg(rg(id('o'), [c[0], c[1], c[2], c[3]], '38%', '30%', '75%'),
    `<ellipse cx="32" cy="33" rx="20" ry="24" fill="${u('o')}"/><path d="M32 9A20 24 0 0 1 32 57A14 24 0 0 0 32 9Z" fill="${c[3]}" opacity=".3"/>
<ellipse cx="27" cy="22" rx="8" ry="5" fill="#fff" opacity=".45" transform="rotate(-25 27 22)"/>
<ellipse cx="32" cy="33" rx="20" ry="24" fill="none" ${INK}/>${glint(25, 19, 2.4)}${spark(49, 47, 3.6)}`);
  // hex prism
  return svg(lg(id('h'), [c[0], c[1], c[2]]),
    `<path d="M32 6L53 18V46L32 58L11 46V18Z" fill="${c[2]}"/><path d="M32 6L53 18L42 24L32 18Z" fill="${c[0]}"/><path d="M11 18L32 6V18L22 24Z" fill="${c[1]}"/>
<path d="M53 18V46L42 40V24Z" fill="${c[3]}" opacity=".7"/><path d="M11 18V46L22 40V24Z" fill="${c[1]}" opacity=".8"/><path d="M53 46L32 58L11 46L22 40L32 46L42 40Z" fill="${c[3]}"/>
<path d="M32 18L42 24V40L32 46L22 40V24Z" fill="${u('h')}"/>
<path d="M32 6V18M53 18L42 24M11 18L22 24M53 46L42 40M11 46L22 40M32 58V46M32 18L42 24V40L32 46L22 40V24Z" fill="none" stroke="${C}" stroke-width="1.4" opacity=".45"/>
<path d="M32 6L53 18V46L32 58L11 46V18Z" fill="none" ${INK}/>${glint(28, 26, 2.2)}${spark(50, 54, 3.4)}`);
}

// soulstone: a glowing orb in a gold claw setting with a rune; c = [glow, core, deep]
function soulIcon(key, c, rune = 'star') {
  const id = (s) => `z-${key}-${s}`, u = (s) => `url(#${id(s)})`;
  const runes = {
    star: 'M32 22L34.6 29.4L42 32L34.6 34.6L32 42L29.4 34.6L22 32L29.4 29.4Z',
    swirl: 'M32 24C38 24 40 30 36 33C33 35 29 32 31 30M32 40C26 40 24 34 28 31',
    bolt: 'M34 21L26 33H31L29 43L38 30H33Z',
    leaf: 'M32 21C40 26 40 36 32 43C24 36 24 26 32 21ZM32 25V40',
    eye: 'M22 32C26 26 38 26 42 32C38 38 26 38 22 32ZM32 28.5A3.5 3.5 0 1 0 32 35.5A3.5 3.5 0 1 0 32 28.5Z',
  };
  return svg(rg(id('o'), ['#ffffff', c[0], c[1], c[2]], '42%', '36%', '70%') + rg(id('g'), [c[0], 'rgba(0,0,0,0)'], '50%', '50%', '50%') + lg(id('m'), ['#fff2b0', '#e8b030', '#9a5a10']),
    `<circle cx="32" cy="32" r="30" fill="${u('g')}" opacity=".7"/>
<path d="M32 4L37 13H27ZM60 32L51 37V27ZM32 60L27 51H37ZM4 32L13 27V37Z" fill="${u('m')}" ${INK2}/>
<circle cx="32" cy="32" r="19" fill="${u('m')}" ${INK}/><circle cx="32" cy="32" r="14.5" fill="${u('o')}" ${INK2}/>
<path d="${runes[rune] || runes.star}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>
${glint(26.5, 25.5, 2.6)}${spark(52, 12, 3.6)}${spark(12, 52, 2.6)}`);
}

// enhancement stone: rough rune stone; c = [light, mid, dark, rune]
function stoneIcon(key, c, stars) {
  const id = (s) => `z-${key}-${s}`, u = (s) => `url(#${id(s)})`;
  return svg(lg(id('s'), [c[0], c[1], c[2]]) + rg(id('r'), [c[3], 'rgba(0,0,0,0)'], '50%', '50%', '50%'),
    `<path d="M14 22L26 8L46 12L56 30L48 52L24 57L9 42Z" fill="${u('s')}"/><path d="M26 8L46 12L40 22L22 20Z" fill="#fff" opacity=".35"/>
<path d="M56 30L48 52L24 57L30 44L44 38Z" fill="${c[2]}" opacity=".55"/><circle cx="33" cy="33" r="14" fill="${u('r')}"/>
<path d="M28 24L38 24L33 32L38 42H28L33 32Z" fill="none" stroke="${c[3]}" stroke-width="2.6" stroke-linejoin="round"/>
<path d="M14 22L26 8L46 12L56 30L48 52L24 57L9 42Z" fill="none" ${INK}/>
${Array.from({ length: stars }, (_, i) => spark(32 + (i - (stars - 1) / 2) * 10, 58, 3.6, '#ffe27a')).join('')}${spark(50, 14, 3.4)}`);
}

const ICONS = {};
const add = (k, s) => { ICONS[k] = s; };
add('gem_amethyst', gemIcon('gem_amethyst', 'diamond', ['#f0d8ff', '#c88aff', '#8a3ad8', '#4a1a8a']));
add('gem_onyx', gemIcon('gem_onyx', 'oval', ['#a8a0c0', '#5a5470', '#2a2638', '#0a0810']));
add('gem_opal', gemIcon('gem_opal', 'oval', ['#ffffff', '#d8f4ff', '#ffc8f0', '#a8b8ff']));
add('gem_aquamarine', gemIcon('gem_aquamarine', 'hex', ['#e8fffc', '#8af0e8', '#3ac8c0', '#1a7a80']));
add('gem_garnet', gemIcon('gem_garnet', 'hex', ['#ffb0b8', '#e83a50', '#a0102a', '#5a0818']));
add('gem_jade', gemIcon('gem_jade', 'oval', ['#e0ffe8', '#7ae8a0', '#2a9a5a', '#0a5a30']));
add('gem_moonstone', gemIcon('gem_moonstone', 'oval', ['#ffffff', '#e8f0ff', '#a8c0ff', '#6a7ad8']));
add('gem_citrine', gemIcon('gem_citrine', 'diamond', ['#fff8d0', '#ffd860', '#ff9a1a', '#b85a08']));
add('enh_stone', stoneIcon('enh_stone', ['#c8d4e8', '#8a9ab8', '#4a5a7a', '#7ae0ff'], 1));
add('enh_stone2', stoneIcon('enh_stone2', ['#e8d0ff', '#a07ad8', '#5a3a8a', '#ff9aff'], 2));
add('enh_stone3', stoneIcon('enh_stone3', ['#fff0c0', '#f0b040', '#a05a10', '#ff4a3a'], 3));
add('enh_protect', svg(lg('z-enh_protect-s', ['#e8f4ff', '#7ab0ff', '#2a5ad8']) + lg('z-enh_protect-m', ['#fff2b0', '#e8b030', '#9a5a10']),
  `<path d="M32 5L54 13V30C54 44 44 54 32 59C20 54 10 44 10 30V13Z" fill="url(#z-enh_protect-m)" ${INK}/>
<path d="M32 11L48 17V30C48 41 41 49 32 53C23 49 16 41 16 30V17Z" fill="url(#z-enh_protect-s)" ${INK2}/>
<path d="M32 20V44M22 30H42" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M32 20V44M22 30H42" stroke="#ffe27a" stroke-width="2.2" stroke-linecap="round"/>
${glint(24, 20, 2.4)}${spark(52, 50, 3.6)}`));
add('enh_luck', svg(rg('z-enh_luck-c', ['#fff8d0', '#ffd84a', '#c88a10']),
  `<circle cx="32" cy="32" r="24" fill="url(#z-enh_luck-c)" ${INK}/><circle cx="32" cy="32" r="18" fill="none" stroke="#b8700a" stroke-width="2" opacity=".6"/>
${[0, 90, 180, 270].map((a) => `<ellipse cx="32" cy="23.5" rx="6.2" ry="8" fill="#4ad06a" ${INK2} transform="rotate(${a} 32 32)"/>`).join('')}
<circle cx="32" cy="32" r="3" fill="#2a8a3a" ${INK2}/><path d="M33 35Q36 44 42 46" fill="none" stroke="#2a7a3a" stroke-width="2.6" stroke-linecap="round"/>
${glint(23, 19, 2.6)}${spark(52, 12, 3.6)}`));
add('socket_drill', svg(lg('z-socket_drill-b', ['#f4f8ff', '#a8b4c8', '#5a6478']) + lg('z-socket_drill-h', ['#e8a060', '#a0602a', '#5a3010']),
  `<path d="M8 56L30 34L36 40L14 62Z" fill="url(#z-socket_drill-h)" ${INK}/>
<path d="M30 34L46 18L52 24L36 40Z" fill="url(#z-socket_drill-b)" ${INK}/><path d="M46 18L58 6L52 24Z" fill="#dfe6f2" ${INK}/>
<path d="M34 32L40 38M38 28L44 34M42 24L48 30" stroke="${C}" stroke-width="1.6" opacity=".6"/>
<circle cx="18" cy="20" r="8" fill="#7ad8ff" ${INK2}/><circle cx="18" cy="20" r="3.5" fill="#fff" opacity=".7"/>${spark(30, 12, 3.4)}${spark(54, 44, 3)}`));
add('soul_cache', svg(lg('z-soul_cache-w', ['#c08a5a', '#8a5a30', '#5a3418']) + rg('z-soul_cache-g', ['#ffffff', '#e8a0ff', 'rgba(160,60,255,0)'], '50%', '40%', '55%'),
  `<circle cx="32" cy="24" r="22" fill="url(#z-soul_cache-g)"/><path d="M10 30H54V54H10Z" fill="url(#z-soul_cache-w)" ${INK}/>
<path d="M10 30C10 18 18 14 32 14C46 14 54 18 54 30Z" fill="#9a62d8" ${INK}/><path d="M10 30H54" ${INK}/>
<rect x="27" y="27" width="10" height="11" rx="2" fill="#ffd84a" ${INK2}/><path d="M10 42H54" stroke="${C}" stroke-width="2" opacity=".5"/>
${spark(32, 8, 4.4)}${spark(48, 10, 2.8)}${spark(16, 12, 2.6)}`));
add('enhance', svg(lg('z-enhance-h', ['#f4f8ff', '#a8b4c8', '#5a6478']) + lg('z-enhance-w', ['#e8a060', '#a0602a', '#5a3010']),
  `<path d="M14 54L34 34L39 39L19 59Z" fill="url(#z-enhance-w)" ${INK}/><path d="M26 22L42 6L58 22L42 38Z" fill="url(#z-enhance-h)" ${INK}/>
<path d="M10 12V28M2 20H18" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M10 12V28M2 20H18" stroke="#ffcb3a" stroke-width="3" stroke-linecap="round"/>
${spark(52, 46, 4)}${spark(44, 56, 2.6)}`));

// soulstones: one per named power
export const SOUL_LOOK = {
  crit_heal: [['#ff9ab8', '#ff3a6a', '#7a0a2a'], 'leaf'], chain: [['#c8f0ff', '#3ab8ff', '#0a3a8a'], 'bolt'], stun_chance: [['#ffe0a0', '#c8862a', '#5a3008'], 'star'],
  thorn_aura: [['#c8ffb0', '#4ac83a', '#0a5a1a'], 'leaf'], swift: [['#d8fff4', '#4ae8c0', '#0a6a5a'], 'swirl'], mana_font: [['#c8d8ff', '#4a7aff', '#101a7a'], 'swirl'],
  meteor_proc: [['#ffc8a0', '#ff5a1a', '#7a1a00'], 'star'], phoenix: [['#fff0a0', '#ff9a1a', '#8a2a00'], 'leaf'], frenzy: [['#ffb0a0', '#ff2a2a', '#6a0000'], 'eye'],
  holy_nova: [['#ffffe0', '#ffe060', '#a07a10'], 'star'], starfall: [['#f0e0ff', '#a07aff', '#3a1a8a'], 'star'], worldtree: [['#e0ffd0', '#6ae84a', '#1a6a1a'], 'leaf'],
  double_strike: [['#fff0f0', '#ff7aa8', '#7a1a4a'], 'bolt'], executioner: [['#ffd0d0', '#c8202a', '#3a0008'], 'eye'], giant_slayer: [['#fff4d0', '#e8a83a', '#6a3a08'], 'bolt'],
};
for (const [fx, [c, rune]] of Object.entries(SOUL_LOOK)) add('soul_' + fx, soulIcon('soul_' + fx, c, rune));

export const UPGRADE_ICONS = ICONS;
