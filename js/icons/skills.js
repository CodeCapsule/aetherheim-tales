// Hand-authored SVG skill icons (cel-shaded game-icon style), one per skill id in data.js SKILLS.
// Each value is a standalone, well-formed SVG string (viewBox 0 0 64 64, no text/filters/external refs)
// meant to be shown as an isolated <img src="data:image/svg+xml,..."> inside a rounded skill slot.
// The small helpers below only assemble strings at module load; every exported value is plain markup.

const f = (n) => Math.round(n * 10) / 10;
const pt = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return [f(cx + r * Math.cos(a)), f(cy + r * Math.sin(a))];
};
const stops = (list) => list.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a == null ? '' : ` stop-opacity="${a}"`}/>`).join('');
// linear gradient (objectBoundingBox), default top -> bottom
const lin = (id, list, x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
const rad = (id, list, cx = 0.5, cy = 0.5, r = 0.5) =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;

// n-point star polygon points
const star = (cx, cy, R, r, n = 5, rot = -90) => {
  const out = [];
  for (let i = 0; i < n * 2; i++) out.push(pt(cx, cy, i % 2 ? r : R, rot + (i * 180) / n).join(' '));
  return out.join(' ');
};
// concave 4-point sparkle (glint); no outline
const spark = (x, y, r, fill = '#fff') =>
  `<path d="M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z" fill="${fill}" stroke="none"/>`;
// teardrop, point up, round bottom centred at (x, y + .3s)
const drop = (x, y, s) =>
  `M${f(x)} ${f(y - 1.7 * s)}Q${f(x + 1.1 * s)} ${f(y - 0.3 * s)} ${f(x + s)} ${f(y + 0.3 * s)}A${f(s)} ${f(s)} 0 1 1 ${f(x - s)} ${f(y + 0.3 * s)}Q${f(x - 1.1 * s)} ${f(y - 0.3 * s)} ${f(x)} ${f(y - 1.7 * s)}Z`;
// tapered crescent swoosh along a circle of radius r (centre cx,cy) from a0 to a1 degrees (clockwise)
const swoosh = (cx, cy, r, a0, a1, flat = 2) => {
  const [x0, y0] = pt(cx, cy, r, a0);
  const [x1, y1] = pt(cx, cy, r, a1);
  return `M${x0} ${y0}A${r} ${r} 0 0 1 ${x1} ${y1}A${f(r * flat)} ${f(r * flat)} 0 0 0 ${x0} ${y0}Z`;
};

// class themes: backdrop glow (light, deep) + ink colour
const KN = ['#ffeaa0', '#f27a12', '#24160f'];
const AS = ['#b0ffe8', '#10b29a', '#1b1430'];
const MG = ['#fff2a8', '#ff4a1a', '#24160f'];
const PR = ['#d8fdff', '#2a8cff', '#1b1430'];

const icon = (k, [c1, c2, ink], defs, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${rad(`${k}-bg`, [[0, c1, 1], [0.45, c2, 0.85], [0.8, c2, 0.3], [1, c2, 0]])}${defs}</defs>` +
  `<circle cx="32" cy="32" r="30" fill="url(#${k}-bg)"/>` +
  `<g stroke="${ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;

// shared palettes (cel: hard tone steps)
const STEEL = [[0, '#ffffff'], [0.5, '#dfe7f5'], [0.5, '#a3b3d3'], [1, '#7d8fb8']];
const SILVER = [[0, '#ffffff'], [0.5, '#e6eef8'], [0.5, '#aebdd6'], [1, '#8a9cbd']];
const GOLD = [[0, '#fff4a8'], [0.5, '#ffc93a'], [1, '#d9850f']];
const WOOD = [[0, '#c98446'], [0.5, '#a0592a'], [0.5, '#7e4220'], [1, '#68351a']];
const ROCK = [[0, '#f2b874'], [0.5, '#d48a46'], [0.5, '#a65d2c'], [1, '#7c4220']];
const VIO = [[0, '#c3a2ff'], [0.5, '#7e4fe0'], [1, '#43238f']];
const JADE = [[0, '#c4fff0'], [0.5, '#4fe3b8'], [1, '#14998a']];
const FLAME = [[0, '#ff3d2e'], [0.55, '#ff7a1a'], [1, '#ffb22e']];
const FIRE_IN = [[0, '#ffb22e'], [1, '#ffe46a']];
const WATER = [[0, '#e6ffff'], [0.45, '#6ad8ff'], [1, '#1d63d6']];

// local-frame dagger (tip up at y=3, pommel at y~61) used by several assassin icons
const dagger = (k, blade = `url(#${k}-s)`) =>
  `<path d="M32 3L38 15L36 38H28L26 15Z" fill="${blade}"/>` +
  `<path d="M19 38H45L42 44H22Z" fill="url(#${k}-t)"/>` +
  `<rect x="29" y="44" width="6" height="10" fill="url(#${k}-v)"/>` +
  `<path d="M32 53L36.5 57.5L32 62L27.5 57.5Z" fill="url(#${k}-t)"/>`;
const daggerDefs = (k) => lin(`${k}-s`, SILVER, 0, 0, 1, 0) + lin(`${k}-t`, JADE) + lin(`${k}-v`, VIO, 0, 0, 1, 0);

const HEX = [-90, -30, 30, 90, 150, 210];

// ring of pinwheel flame tongues with a hole (blazing ring)
const flameRing = (cx, cy, rv, rt, n, hole) => {
  const step = 360 / n;
  let d = `M${pt(cx, cy, rv, 0).join(' ')}`;
  for (let i = 0; i < n; i++) {
    const a = i * step;
    d += `Q${pt(cx, cy, rv + 5, a + step * 0.15).join(' ')} ${pt(cx, cy, rt, a + step * 0.8).join(' ')}`;
    d += `Q${pt(cx, cy, rv + 3, a + step * 0.75).join(' ')} ${pt(cx, cy, rv, a + step).join(' ')}`;
  }
  return `${d}ZM${cx - hole} ${cy}A${hole} ${hole} 0 1 0 ${cx + hole} ${cy}A${hole} ${hole} 0 1 0 ${cx - hole} ${cy}Z`;
};

export const SKILL_ICONS = {
  // ───────────── Knight · Earth ─────────────
  // Slash: simple sword with a bright crescent slash
  k0: icon('k0', KN,
    lin('k0-s', STEEL, 0, 0, 1, 0) + lin('k0-g', GOLD) + lin('k0-b', WOOD, 0, 0, 1, 0) + lin('k0-w', [[0, '#fff3a8'], [0.5, '#ffd84a'], [1, '#fffbe6']], 1, 0, 0, 1),
    `<path d="M56 6Q13 4 6 50Q20 18 56 6Z" fill="url(#k0-w)" stroke-width="2.5"/>` +
    `<g transform="rotate(45 32 32)"><path d="M32 4L37.5 12V40H26.5V12Z" fill="url(#k0-s)"/>` +
    `<rect x="18" y="39" width="28" height="6" rx="3" fill="url(#k0-g)"/><rect x="29" y="45" width="6" height="9" fill="url(#k0-b)"/>` +
    `<circle cx="32" cy="57" r="4" fill="url(#k0-g)"/></g>` + spark(49, 15, 6)),

  // Heavy Strike: big axe chopping into an impact burst
  k1: icon('k1', KN,
    lin('k1-s', STEEL, 0, 0, 1, 0) + lin('k1-g', GOLD) + lin('k1-w', WOOD, 0, 0, 1, 0) + rad('k1-i', [[0, '#ffffff'], [0.35, '#fff07a'], [1, '#ff8a1a']]),
    `<polygon points="${star(16, 47, 16, 7, 8, -70)}" fill="url(#k1-i)" stroke-width="2.5"/>` +
    `<path d="${swoosh(30, 34, 28, -80, 0, 1.5)}" fill="#fff3b0" stroke="none"/>` +
    `<g transform="translate(5 0) rotate(-35 32 32)"><rect x="29" y="8" width="6" height="53" rx="3" fill="url(#k1-w)"/>` +
    `<path d="M36 14H24L16 5Q3 24 12 43L24 32H36Z" fill="url(#k1-s)"/>` +
    `<path d="M16.5 9Q8 24 13 39" fill="none" stroke="#fff" stroke-width="2.5"/>` +
    `<path d="M36 17L47 22.5L36 29Z" fill="url(#k1-g)"/><rect x="27" y="12" width="10" height="22" rx="2" fill="url(#k1-g)"/></g>`),

  // Whirlwind: three spinning blades around a golden hub
  k2: icon('k2', KN,
    lin('k2-s', STEEL, 0, 0, 1, 0) + lin('k2-g', GOLD),
    [0, 120, 240].map((a) => `<path d="${swoosh(32, 32, 28.5, a - 10, a + 62, 1.3)}" fill="#ffd94a" stroke="none"/>`).join('') +
    [0, 120, 240].map((a) => `<path transform="rotate(${a} 32 32)" d="M28.5 28Q24 12 45 4Q33 15 35.5 28Z" fill="url(#k2-s)"/>`).join('') +
    `<circle cx="32" cy="32" r="7.5" fill="url(#k2-g)"/><circle cx="32" cy="32" r="2.5" fill="#7e4220" stroke="none"/>` + spark(46, 8, 5)),

  // Shield Bash: heater shield with stun stars
  k3: icon('k3', KN,
    lin('k3-g', GOLD) + lin('k3-s', STEEL, 0, 0, 1, 0) + lin('k3-e', ROCK, 0, 0, 1, 0),
    `<g transform="rotate(-8 32 38)"><path d="M13 19Q32 11 51 19V35Q51 51 32 60Q13 51 13 35Z" fill="url(#k3-g)"/>` +
    `<path d="M19 23Q32 17.5 45 23V35Q45 47 32 53.5Q19 47 19 35Z" fill="url(#k3-s)" stroke-width="2.5"/>` +
    `<path d="M32 25L40 36L32 47L24 36Z" fill="url(#k3-e)" stroke-width="2.5"/></g>` +
    `<polygon points="${star(11, 13, 7, 3, 5, -80)}" fill="#ffe14a" stroke-width="2.5"/>` +
    `<polygon points="${star(53, 10, 6, 2.6, 5, -100)}" fill="#ffe14a" stroke-width="2.5"/>` +
    `<polygon points="${star(32, 7, 4.5, 2, 5)}" fill="#fff6b0" stroke-width="2.5"/>` + spark(25, 28, 4)),

  // Earthshatter: cracked ground with rocks erupting
  k4: icon('k4', KN,
    lin('k4-r', ROCK, 0, 0, 1, 0) + lin('k4-d', [[0, '#9a5a2e'], [1, '#4e2a14']]),
    `<path d="M4 51L14 43H50L60 51L54 59H10Z" fill="url(#k4-d)"/>` +
    `<path d="M14 52L22 49L27 55L34 49L40 55L48 51" fill="none" stroke="#ffd24a" stroke-width="2.5"/>` +
    `<path d="M8 48L11 31L19 25L24 48Z" fill="url(#k4-r)"/><path d="M41 48L44 27L54 31L57 48Z" fill="url(#k4-r)"/>` +
    `<path d="M22 47L26 18L33 6L41 19L43 47Z" fill="url(#k4-r)"/>` +
    `<path d="M12 17L16 12L21 15L19 20H14Z" fill="url(#k4-r)" stroke-width="2.5"/><path d="M47 12L52 9L56 13L52 17Z" fill="url(#k4-r)" stroke-width="2.5"/>` +
    spark(30, 16, 4.5)),

  // Iron Bastion: steel keep inside a golden shield aura (+ heal)
  k5: icon('k5', KN,
    lin('k5-s', STEEL, 0, 0, 1, 0) + lin('k5-a', [[0, '#fff6c0', 0.75], [1, '#ffb52e', 0.35]]),
    `<path d="M8 11Q32 2 56 11V32Q56 51 32 61Q8 51 8 32Z" fill="url(#k5-a)" stroke="#fff0a0" stroke-width="3.5"/>` +
    `<path d="M17 28V16H23.5V20H28.5V16H35.5V20H40.5V16H47V28L44 30V54H20V30Z" fill="url(#k5-s)"/>` +
    `<path d="M20 30H44" fill="none"/><path d="M27.5 54V45Q32 38 36.5 45V54Z" fill="#6a3418"/>` +
    `<path d="M48 41H53V46H58V51H53V56H48V51H43V46H48Z" fill="#6ff07a" stroke-width="2.5"/>` + spark(22, 21, 3.5)),

  // Titan's Wrath: golden fist bursting up on a pillar of earth
  k6: icon('k6', KN,
    lin('k6-g', GOLD) + lin('k6-r', ROCK, 0, 0, 1, 0) + rad('k6-x', [[0, '#ffffff', 0.95], [0.5, '#fff07a', 0.9], [1, '#ff9a1a', 0.5]]),
    `<polygon points="${star(32, 28, 30, 12, 12, -90)}" fill="url(#k6-x)" stroke="none"/>` +
    `<path d="M14 61L18 47L24 41H40L46 47L50 61Z" fill="url(#k6-r)"/>` +
    `<rect x="20" y="33" width="24" height="9" rx="2" fill="#a65d2c"/>` +
    `<rect x="17" y="14" width="30" height="21" rx="7" fill="url(#k6-g)"/>` +
    `<rect x="17" y="8" width="8" height="13" rx="4" fill="url(#k6-g)"/><rect x="25" y="7" width="8" height="14" rx="4" fill="url(#k6-g)"/>` +
    `<rect x="33" y="7" width="8" height="14" rx="4" fill="url(#k6-g)"/><rect x="41" y="9" width="7" height="12" rx="3.5" fill="url(#k6-g)"/>` +
    `<path d="M17 25Q17 21 22 21H37Q41 23 37 28H24Q18 30 17 25Z" fill="#ffe37a"/>` + spark(28, 12, 3.5)),

  // ───────────── Assassin · Wind ─────────────
  // Stab: a single dagger thrust with speed lines
  a0: icon('a0', AS, daggerDefs('a0'),
    `<g transform="rotate(45 32 32)"><path d="M17 26V46M47 24V40M22 52V60" fill="none" stroke="#eafff8" stroke-width="3"/>${dagger('a0')}</g>` + spark(51, 13, 6)),

  // Shadow Strike: dash under a violet moon with shadow streaks
  a1: icon('a1', AS,
    daggerDefs('a1') + lin('a1-m', VIO, 0, 0, 1, 1) + lin('a1-d', [[0, '#2a1070', 0.1], [0.45, '#4a22a8', 0.95], [1, '#6a3fd8']], 0, 0, 1, 0),
    `<path d="M51.1 24.5A10 10 0 1 0 38.5 11.9A9 9 0 0 1 51.1 24.5Z" fill="url(#a1-m)"/>` +
    `<path d="M34 22Q20 9 3 10Q13 15 14 19Q7 21 2 27Q13 28 16 31Q10 36 7 43Q18 40 26 42Z" fill="url(#a1-d)" stroke="none"/>` +
    `<g transform="translate(2 2) rotate(115 32 32) translate(32 32) scale(.84) translate(-32 -32)">${dagger('a1')}</g>` + spark(54, 54, 4.5)),

  // Twin Fangs: two crossed fang blades
  a2: icon('a2', AS,
    lin('a2-s', SILVER, 0, 0, 1, 0) + lin('a2-t', JADE) + lin('a2-v', VIO, 0, 0, 1, 0),
    ['rotate(-36 32 32)', 'translate(64 0) scale(-1 1) rotate(-36 32 32)'].map((t) =>
      `<g transform="${t}"><path d="M32 3Q46 17 37.5 40H26.5Q34 22 32 3Z" fill="url(#a2-s)"/>` +
      `<path d="M20 40H44L41 45.5H23Z" fill="url(#a2-v)"/><rect x="29" y="45.5" width="6" height="9" fill="url(#a2-t)"/>` +
      `<circle cx="32" cy="58" r="3.5" fill="url(#a2-v)"/></g>`).join('') +
    spark(32, 30, 7) + spark(13, 9, 4)),

  // Venom Edge: dagger coated in dripping poison
  a3: icon('a3', AS,
    lin('a3-s', [[0, '#ffffff'], [0.3, '#d8e2ee'], [0.38, '#b4ff6a'], [1, '#2aa83c']]) + lin('a3-t', JADE) + lin('a3-v', VIO, 0, 0, 1, 0) + lin('a3-p', [[0, '#d8ff8a'], [1, '#36b83e']]),
    `<g transform="rotate(35 32 32)">${dagger('a3')}</g>` +
    `<path d="${drop(46, 47, 4.5)}" fill="url(#a3-p)" stroke-width="2.5"/><path d="${drop(54, 55, 3)}" fill="url(#a3-p)" stroke-width="2.5"/>` +
    `<circle cx="13" cy="15" r="4" fill="#b4ff6a" stroke-width="2.5"/><circle cx="20" cy="8" r="2.5" fill="#d8ff8a" stroke-width="2"/>` +
    spark(46, 12, 5)),

  // Gale Fan: open jade war-fan hurling wind blades
  a4: icon('a4', AS,
    lin('a4-f', JADE) + lin('a4-w', WOOD, 0, 0, 1, 0),
    `<path d="M4 27Q11 5 37 4Q17 13 4 27Z" fill="#effffa" stroke-width="2.2"/><path d="M31 16Q46 0 61 13Q45 8 31 16Z" fill="#effffa" stroke-width="2.2"/>` +
    `<path d="M32 51L${pt(32, 51, 30, -148).join(' ')}A30 30 0 0 1 ${pt(32, 51, 30, -32).join(' ')}Z" fill="url(#a4-f)"/>` +
    `<path d="${[-126, -104, -82, -60].map((a) => `M${pt(32, 51, 12, a).join(' ')}L${pt(32, 51, 29, a).join(' ')}`).join('')}" fill="none" stroke-width="2"/>` +
    `<path d="M32 51L${pt(32, 51, 12, -148).join(' ')}A12 12 0 0 1 ${pt(32, 51, 12, -32).join(' ')}Z" fill="url(#a4-w)"/>` +
    `<path d="M32 54V60" fill="none" stroke="#7e4fe0" stroke-width="3"/><circle cx="32" cy="51" r="3.5" fill="#ffd23a"/>` +
    spark(20, 30, 4)),

  // Phantom Veil: hooded shadow with glowing eyes and an afterimage
  a5: icon('a5', AS,
    lin('a5-h', VIO),
    `<path transform="translate(-7 2)" d="M32 5Q49 7 50 28L55 57Q32 62 9 57L14 28Q15 7 32 5Z" fill="#8a5cf0" opacity=".45" stroke="none"/>` +
    `<path d="M32 5Q49 7 50 28L55 57Q32 62 9 57L14 28Q15 7 32 5Z" fill="url(#a5-h)"/>` +
    `<path d="M32 16Q44 18 44 31Q32 42 20 31Q20 18 32 16Z" fill="#140a2a"/>` +
    `<path d="M23 28L30 31L24 33ZM41 28L34 31L40 33Z" fill="#7affd8" stroke="none"/>` +
    `<path d="M32 41L36 46L32 51L28 46Z" fill="#7affd8" stroke-width="2.5"/>` + spark(52, 12, 6)),

  // Tempest Dance: jade tornado with orbiting blades
  a6: icon('a6', AS,
    lin('a6-t', [[0, '#e0fff6'], [0.5, '#6aeccb'], [0.5, '#2bbfa2'], [1, '#14877a']], 0, 0, 1, 0) + lin('a6-s', SILVER, 0, 0, 1, 0),
    `<path d="M7 12Q32 3 57 12Q50 26 42 35Q35 46 31 59Q25 50 25 42Q14 30 7 12Z" fill="url(#a6-t)"/>` +
    `<path d="M12 19Q32 27 52 17M18 30Q34 36 46 28M26 41Q33 45 39 39" fill="none" stroke="#f0fffb" stroke-width="2.5"/>` +
    `<path d="M3 46Q5 29 21 31Q9 36 3 46Z" fill="url(#a6-s)" stroke-width="2.5"/><path d="M61 20Q60 39 44 38Q56 32 61 20Z" fill="url(#a6-s)" stroke-width="2.5"/>` +
    spark(19, 10, 4)),

  // ───────────── Mage · Fire ─────────────
  // Firebolt: classic flame
  m0: icon('m0', MG,
    lin('m0-o', FLAME) + lin('m0-i', FIRE_IN),
    `<path d="M32 3Q38 14 46 19Q57 29 51 45Q45 59 32 59Q18 59 13 46Q9 33 19 23Q19 31 25 32Q21 17 32 3Z" fill="url(#m0-o)"/>` +
    `<path d="M33 20Q43 31 43 44Q41 54 32 54Q22 54 22 44Q22 36 28 30Q29 38 34 38Q36 29 33 20Z" fill="url(#m0-i)" stroke-width="2.5"/>` +
    `<ellipse cx="32" cy="47" rx="5.5" ry="6" fill="#fffbe0" stroke="none"/>` + spark(46, 10, 4.5)),

  // Fireball: blazing sphere with a comet tail
  m1: icon('m1', MG,
    lin('m1-t', [[0, '#ffe46a'], [0.5, '#ff6a1a'], [1, '#d81e3a']], 1, 0, 0, 1) + rad('m1-b', [[0, '#fffbe0'], [0.4, '#ffe46a'], [0.8, '#ff7a1a'], [1, '#e8262f']], 0.4, 0.35, 0.65),
    `<path d="M31 15Q22 22 21 29L14 29Q13 44 6 58Q20 51 27 53L30 46Q42 43 49 33Z" fill="url(#m1-t)"/>` +
    `<path d="M34 22Q26 32 17 47Q30 40 42 32Z" fill="#ffe46a" stroke="none"/>` +
    `<circle cx="40" cy="24" r="13.5" fill="url(#m1-b)"/>` + `<ellipse cx="35" cy="18" rx="3.5" ry="2.2" transform="rotate(-35 35 18)" fill="#fff" stroke="none"/>`),

  // Flame Pillar: column of fire rising from a magic circle
  m2: icon('m2', MG,
    lin('m2-o', FLAME) + lin('m2-i', FIRE_IN),
    `<ellipse cx="32" cy="52" rx="27" ry="8" fill="#ffb22e" fill-opacity=".55"/>` +
    `<ellipse cx="32" cy="52" rx="19" ry="5" fill="none" stroke="#fff3a0" stroke-width="2"/>` +
    `<path d="M19 52Q15 38 21 26Q23 16 29 3Q32 14 36 9Q38 18 43 13Q49 30 45 52Z" fill="url(#m2-o)"/>` +
    `<path d="M25 52Q23 40 27 30Q29 22 32 16Q35 24 37 22Q41 34 39 52Z" fill="url(#m2-i)" stroke-width="2.5"/>` +
    `<path d="M29.5 52Q29.5 41 32 33Q34.5 41 34.5 52Z" fill="#fffbe0" stroke="none"/>` +
    `<path d="M10 34L13 30L16 34L13 38ZM50 26L53 22L56 26L53 30Z" fill="#ffd23a" stroke-width="2"/>` + spark(23, 14, 4)),

  // Blazing Ring: pinwheel ring of fire bursting outward
  m3: icon('m3', MG,
    rad('m3-r', [[0.38, '#fffbe0'], [0.55, '#ffe46a'], [0.75, '#ff7a1a'], [1, '#e0262f']]),
    `<circle cx="32" cy="32" r="12" fill="#fff3b0" stroke="none"/><path d="${flameRing(32, 32, 19, 29, 9, 11)}" fill="url(#m3-r)" fill-rule="evenodd"/>` +
    `<circle cx="32" cy="32" r="15" fill="none" stroke="#fff7c0" stroke-width="2"/>` + spark(32, 32, 6.5) + spark(12, 52, 3.5)),

  // Meteor: burning rock with lava cracks plunging down
  m4: icon('m4', MG,
    lin('m4-t', [[0, '#d81e3a', 0.85], [0.6, '#ff7a1a'], [1, '#ffe46a']], 0, 0, 1, 1) + rad('m4-r', [[0, '#b0623e'], [0.6, '#73301f'], [1, '#3e1810']], 0.35, 0.3, 0.7),
    `<path d="M51 30Q40 18 30 14L32 10Q18 6 5 5Q10 16 16 26L12 30Q20 44 30 51Z" fill="url(#m4-t)"/>` +
    `<path d="M46 32Q30 20 14 13Q22 28 32 46Z" fill="#ffd23a" stroke="none"/>` +
    `<path d="M27 38L32 28L42 25L52 30L56 42L49 54L37 56L29 49Z" fill="url(#m4-r)"/>` +
    `<path d="M34 36L40 40L38 47M43 30L46 38L52 41M41 50L45 45" fill="none" stroke="#ffb22e" stroke-width="2.5"/>` +
    `<path d="M33 30L40 27" fill="none" stroke="#fff" stroke-width="2.5"/>` + `<circle cx="56" cy="12" r="2.5" fill="#ffd23a" stroke-width="2"/>`),

  // Arcane Barrier: violet hex ward with a bright rune core
  m5: icon('m5', MG,
    rad('m5-h', [[0, '#fbeaff', 0.35], [0.6, '#c58aff', 0.6], [1, '#8a3aec', 0.95]]) + rad('m5-c', [[0, '#ffffff'], [0.5, '#ffc6f4'], [1, '#c062ff']]),
    `<polygon points="${HEX.map((a) => pt(32, 32, 27.5, a).join(' ')).join(' ')}" fill="url(#m5-h)"/>` +
    `<polygon points="${HEX.map((a) => pt(32, 32, 18, a).join(' ')).join(' ')}" fill="none" stroke="#ffe0ff" stroke-width="2"/>` +
    `<path d="M32 19Q34 30 45 32Q34 34 32 45Q30 34 19 32Q30 30 32 19Z" fill="url(#m5-c)" stroke-width="2.5"/>` +
    `<path d="M13 21Q18 12 27 9" fill="none" stroke="#fff" stroke-width="3"/>` +
    [-30, 90, 210].map((a) => `<circle cx="${pt(32, 32, 18, a)[0]}" cy="${pt(32, 32, 18, a)[1]}" r="2.5" fill="#ffd23a" stroke-width="2"/>`).join('')),

  // Inferno: erupting volcano raining fire
  m6: icon('m6', MG,
    lin('m6-o', FLAME) + lin('m6-i', FIRE_IN) + lin('m6-c', [[0, '#8e3b26'], [0.5, '#5e2418'], [1, '#3a1610']]),
    `<path d="M22 32Q11 21 19 8Q25 16 29 12Q31 2 37 9Q42 15 45 7Q54 21 42 32Z" fill="url(#m6-o)"/>` +
    `<path d="M27 32Q22 24 26 18Q29 22 32 18Q35 22 38 19Q41 26 37 32Z" fill="url(#m6-i)" stroke-width="2.5"/>` +
    `<path d="M4 59L21 31Q32 27 43 31L60 59Z" fill="url(#m6-c)"/>` +
    `<ellipse cx="32" cy="31" rx="11" ry="3" fill="#ffe46a" stroke-width="2.5"/>` +
    `<path d="M26 34L23 43L25 50M38 34L42 45" fill="none" stroke="#ff8a1f" stroke-width="3"/>` +
    `<path d="${drop(9, 25, 3.5)}${drop(55, 21, 3.5)}${drop(52, 42, 2.6)}${drop(12, 44, 2.6)}" fill="#ffb22e" stroke-width="2.5"/>` + spark(36, 16, 3.5)),

  // ───────────── Priest · Water / Holy ─────────────
  // Water Bolt: a single gleaming drop
  p0: icon('p0', PR,
    lin('p0-w', WATER),
    `<path d="${drop(32, 36, 17.5)}" fill="url(#p0-w)"/>` +
    `<path d="M40 38Q42 48 34 52" fill="none" stroke="#e6ffff" stroke-width="3"/>` +
    `<path d="${drop(11, 20, 3.2)}${drop(54, 16, 2.6)}" fill="#8fe6ff" stroke-width="2.2"/>` +
    `<ellipse cx="25" cy="34" rx="3.5" ry="6" transform="rotate(25 25 34)" fill="#fff" stroke="none"/>`),

  // Aqua Orb: pressurised water sphere with an orbiting current
  p1: icon('p1', PR,
    rad('p1-o', [[0, '#e6ffff'], [0.35, '#6ad8ff'], [0.8, '#1d63d6'], [1, '#143a9a']], 0.38, 0.32, 0.65),
    `<circle cx="32" cy="32" r="17.5" fill="url(#p1-o)"/>` +
    `<path d="M16 36Q24 30.5 32 35.5T48 35" fill="none" stroke="#a6f2ff" stroke-width="2.5"/>` +
    `<path d="${swoosh(32, 32, 27, -175, -55, 1.35)}${swoosh(32, 32, 27, 5, 125, 1.35)}" fill="#bff6ff" stroke-width="2.5"/>` +
    `<circle cx="55" cy="14" r="3" fill="#bff6ff" stroke-width="2"/><circle cx="9" cy="50" r="3" fill="#bff6ff" stroke-width="2"/>` +
    `<ellipse cx="26" cy="24" rx="4.5" ry="3" transform="rotate(-35 26 24)" fill="#fff" stroke="none"/>`),

  // Healing Light: green cross in a burst of holy light
  p2: icon('p2', PR,
    lin('p2-c', [[0, '#d4ffa8'], [0.5, '#5ee070'], [1, '#1f9a48']]) + rad('p2-r', [[0, '#ffffff'], [0.5, '#fff6b8'], [1, '#ffd84a', 0.6]]),
    `<polygon points="${star(32, 32, 30, 14, 12, -90)}" fill="url(#p2-r)" stroke="none"/>` +
    `<path d="M26 10H38V26H54V38H38V54H26V38H10V26H26Z" fill="url(#p2-c)"/>` +
    `<path d="M29.5 14V24" fill="none" stroke="#fff" stroke-width="3"/>` + spark(52, 52, 5) + spark(11, 12, 4)),

  // Tidal Wave: curling wave with foam crest
  p3: icon('p3', PR,
    lin('p3-w', [[0, '#8eeaff'], [0.5, '#2a9af0'], [1, '#173ca0']], 0, 0, 1, 1),
    `<path d="M4 59C4 36 17 12 40 8C53 6 61 15 58 25C56 33 46 35 42 29C40 25 43 21 47 23C43 17 34 20 33 29C31 41 42 52 60 59Z" fill="url(#p3-w)"/>` +
    `<path d="M12 40C16 24 28 14 42 12C51 11 56 17 54 22" fill="none" stroke="#e6ffff" stroke-width="3.5"/>` +
    `<circle cx="50" cy="14" r="3" fill="#fff" stroke-width="2"/><circle cx="57" cy="34" r="2.5" fill="#fff" stroke-width="2"/>` +
    `<path d="M4 59Q32 52 60 59" fill="none" stroke="#d4fdff" stroke-width="3"/>` + spark(24, 30, 4)),

  // Aqua Prison: monster trapped in a bubble
  p4: icon('p4', PR,
    rad('p4-b', [[0, '#e6ffff', 0.2], [0.75, '#8fe8ff', 0.45], [1, '#3fb4ff', 0.9]]) + lin('p4-j', [[0, '#c2a8ff'], [1, '#6a48d8']]),
    `<circle cx="31" cy="34" r="25" fill="url(#p4-b)"/>` +
    `<path d="M19 47Q19 31 31 30Q43 31 43 47Q37 50 31 48Q25 50 19 47Z" fill="url(#p4-j)" stroke-width="2.5"/>` +
    `<path d="M24.5 37.5l4 4m0-4l-4 4M33.5 37.5l4 4m0-4l-4 4" fill="none" stroke-width="2"/>` +
    `<polygon points="${star(31, 22, 4.5, 2, 5)}" fill="#ffe14a" stroke-width="2"/>` +
    `<path d="M13 26Q17 15 28 12" fill="none" stroke="#fff" stroke-width="3.5"/>` +
    `<circle cx="54" cy="11" r="4" fill="#cdf6ff" stroke-width="2.5"/><circle cx="58" cy="22" r="2.2" fill="#cdf6ff" stroke-width="2"/>`),

  // Divine Blessing: angel wings with a golden halo
  p5: icon('p5', PR,
    lin('p5-w', [[0, '#ffffff'], [0.6, '#e6f6ff'], [1, '#9fd2ff']]) + rad('p5-o', [[0, '#fffbe0'], [0.5, '#ffe37a'], [1, '#f0a020']]),
    ['', ' transform="matrix(-1 0 0 1 64 0)"'].map((t) =>
      `<g${t}><path d="M29 40Q22 15 4 12Q7 19 7 24Q11 26 9 31Q15 33 13 38Q19 40 19 45Q26 45 29 40Z" fill="url(#p5-w)"/>` +
      `<path d="M11 19Q19 25 24 36M11 28Q17 32 21 40" fill="none" stroke="#8cc8f5" stroke-width="2"/></g>`).join('') +
    `<ellipse cx="32" cy="11" rx="11" ry="4" fill="none" stroke-width="7"/><ellipse cx="32" cy="11" rx="11" ry="4" fill="none" stroke="#ffd84a" stroke-width="3"/>` +
    `<circle cx="32" cy="40" r="8.5" fill="url(#p5-o)"/>` + spark(32, 40, 5) + spark(52, 52, 4)),

  // Sanctuary: holy fountain over a glowing ward circle
  p6: icon('p6', PR,
    lin('p6-s', [[0, '#ffffff'], [0.5, '#dfe9ff'], [0.5, '#a9bde6'], [1, '#8099cc']], 0, 0, 1, 0),
    `<ellipse cx="32" cy="54" rx="28" ry="7" fill="#ffe37a" fill-opacity=".8" stroke="#fff3b0" stroke-width="2.5"/>` +
    `<path d="M32 26C32 6 17 8 13 26M32 26C32 6 47 8 51 26" fill="none" stroke-width="7"/>` +
    `<path d="M32 26C32 6 17 8 13 26M32 26C32 6 47 8 51 26" fill="none" stroke="#a6f2ff" stroke-width="3"/>` +
    `<path d="M8 41Q32 47 56 41L50 53Q32 58 14 53Z" fill="url(#p6-s)"/>` +
    `<ellipse cx="32" cy="41.5" rx="23" ry="3.5" fill="#6ad8ff" stroke-width="2.5"/>` +
    `<rect x="28" y="28" width="8" height="13" fill="url(#p6-s)"/>` +
    `<path d="M19 24Q32 28 45 24L41 31Q32 34 23 31Z" fill="url(#p6-s)"/>` +
    `<ellipse cx="32" cy="24.5" rx="12.5" ry="2.5" fill="#6ad8ff" stroke-width="2.5"/>` + spark(32, 8, 5)),
};
