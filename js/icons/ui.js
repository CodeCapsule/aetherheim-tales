// Alfheim Tales — UI icon set (menu, activities, classes, elements, HUD buttons, rewards).
// Hand-authored SVG strings: no emoji, no fonts, no external refs, so they render the same on
// every device. Use as <img src="data:image/svg+xml,${encodeURIComponent(UI_ICONS.bag)}">.
// The small helpers below only assemble markup at module load; every value is a plain string.

const INK = '#24160f';
const S = (w = 3) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;
const f = (n) => +n.toFixed(1);
const stops = (c) => c.map((s, i) => {
  const [col, op] = s.split('/');
  return `<stop offset="${f(i / (c.length - 1))}" stop-color="${col}"${op ? ` stop-opacity="${op}"` : ''}/>`;
}).join('');
const lg = (id, c, x1 = 0, y1 = 0, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(c)}</linearGradient>`;
const rg = (id, c, cx = 0.38, cy = 0.32, r = 0.75) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(c)}</radialGradient>`;
const svg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
// outlined stroke (ink underlay + colored line)
const ln = (d, col, w = 4) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 4.5}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const glint = (x, y, rx, ry, rot = -30, op = 0.9) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity="${op}"/>`;
// 4-point twinkle
const spark = (x, y, r, fill = '#fff', op = 1) => {
  const k = r * 0.2;
  return `<path d="M${x} ${f(y - r)}Q${f(x + k)} ${f(y - k)} ${f(x + r)} ${y}Q${f(x + k)} ${f(y + k)} ${x} ${f(y + r)}Q${f(x - k)} ${f(y + k)} ${f(x - r)} ${y}Q${f(x - k)} ${f(y - k)} ${x} ${f(y - r)}Z" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ''}/>`;
};
const starD = (cx, cy, R, r, n = 5) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n, rad = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rad) + ' ' + f(cy + Math.sin(a) * rad);
  }
  return d + 'Z';
};
const mirror = (m) => m + `<g transform="matrix(-1 0 0 1 64 0)">${m}</g>`;
const circleD = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;

// palettes (light -> mid -> dark)
const GOLD = ['#fff7b8', '#ffcc33', '#d9800f'];
const SILVER = ['#ffffff', '#cfdcef', '#7d8fb3'];
const BLUE = ['#c8f4ff', '#4cb4ff', '#2251d1'];
const RED = ['#ffb9a8', '#ff4b3e', '#b3172f'];
const PINK = ['#ffe3f1', '#ff8cc6', '#d9418e'];
const PURPLE = ['#ecc8ff', '#a362f2', '#5527b3'];
const PARCH = ['#fffbe6', '#f6dc9a', '#d19c55'];
const WOOD = ['#eaa868', '#b0642c', '#6e3414'];

// ---- shared pieces --------------------------------------------------------------------------
const pawShapes = (fill, sw = 3) =>
  `<path d="M32 33C40 33 48 41 48 48C48 55 42 57 37 55C34 54 30 54 27 55C22 57 16 55 16 48C16 41 24 33 32 33Z" fill="${fill}" ${S(sw)}/>` +
  [[13.5, 30, -25], [23.5, 16.5, -10], [40.5, 16.5, 10], [50.5, 30, 25]]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="5.6" ry="7.2" transform="rotate(${r} ${x} ${y})" fill="${fill}" ${S(sw)}/>`).join('');

// vertical sword, tip up; k = scale applied by transform (keeps ink weight constant)
const sword = (p, tf, k = 1, lite = false) =>
  `<g transform="${tf}"><path d="M32 3L36.5 9V40H27.5V9Z" fill="url(#${p}-sw)" ${S(3 / k)}/>` +
  (lite ? '' : `<path d="M32 10V37" stroke="#8b9cc0" stroke-width="${f(2.2 / k)}" stroke-linecap="round"/>`) +
  `<rect x="19" y="39" width="26" height="5.5" rx="2.7" fill="url(#${p}-g)" ${S(3 / k)}/>` +
  `<rect x="29.3" y="44.5" width="5.4" height="9" fill="#8a4520" ${S(2.6 / k)}/>` +
  `<circle cx="32" cy="56.5" r="3.6" fill="url(#${p}-g)" ${S(2.6 / k)}/></g>`;

// faceted diamond; base design spans x10..54, y10..56, remapped to (cx, top, w, h)
const diamond = (p, cx = 32, top = 10, w = 44, h = 46) => {
  const P = (pts) => pts.map(([x, y], i) => (i ? 'L' : 'M') + f(cx + (x - 32) * w / 44) + ' ' + f(top + (y - 10) * h / 46)).join('') + 'Z';
  const face = (pts, col) => `<path d="${P(pts)}" fill="${col}"/>`;
  return face([[10, 24], [20, 10], [26, 10], [22, 24]], '#a8ecff') +
    face([[22, 24], [26, 10], [38, 10], [42, 24]], '#e8fcff') +
    face([[42, 24], [38, 10], [44, 10], [54, 24]], '#6cc8ff') +
    face([[10, 24], [22, 24], [32, 56]], '#4aaeff') +
    face([[22, 24], [42, 24], [32, 56]], `url(#${p}-d)`) +
    face([[42, 24], [54, 24], [32, 56]], '#1f4fc8') +
    `<path d="${P([[10, 24], [54, 24]]).slice(0, -1)}" stroke="${INK}" stroke-width="2"/>` +
    `<path d="${P([[10, 24], [20, 10], [44, 10], [54, 24], [32, 56]])}" fill="none" ${S()}/>`;
};

const speaker = (p) =>
  `<path d="M7 25H18L31 13V51L18 39H7Z" fill="url(#${p}-a)" ${S()}/><path d="M18 25V39" stroke="${INK}" stroke-width="2.5"/>` +
  glint(23, 22, 1.6, 4, 40);

const gearD = (cx, cy, R, r, n, hole) => {
  const st = Math.PI * 2 / n, p = (a, rad) => `${f(cx + Math.cos(a) * rad)} ${f(cy + Math.sin(a) * rad)}`;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = i * st - Math.PI / 2;
    d += (i ? 'L' : 'M') + p(a - st * 0.25, r) + 'L' + p(a - st * 0.16, R) + 'L' + p(a + st * 0.16, R) + 'L' + p(a + st * 0.25, r) + `A${r} ${r} 0 0 1 ` + p(a + st * 0.75, r);
  }
  return d + 'Z' + circleD(cx, cy, hole);
};

// flame: base-centered at (cx, by), height h
const flameD = (cx, by, h, w) => {
  const X = (x) => f(cx + x * w), Y = (y) => f(by - y * h);
  return `M${X(0)} ${Y(1)}C${X(0.35)} ${Y(0.72)} ${X(1)} ${Y(0.55)} ${X(1)} ${Y(0.28)}C${X(1)} ${Y(0.1)} ${X(0.55)} ${Y(0)} ${X(0)} ${Y(0)}C${X(-0.55)} ${Y(0)} ${X(-1)} ${Y(0.1)} ${X(-1)} ${Y(0.3)}C${X(-1)} ${Y(0.5)} ${X(-0.7)} ${Y(0.62)} ${X(-0.55)} ${Y(0.78)}C${X(-0.4)} ${Y(0.66)} ${X(-0.25)} ${Y(0.6)} ${X(-0.15)} ${Y(0.56)}C${X(-0.25)} ${Y(0.75)} ${X(-0.1)} ${Y(0.9)} ${X(0)} ${Y(1)}Z`;
};

// ---- icons ----------------------------------------------------------------------------------
export const UI_ICONS = {
  // ===== menu buttons =====
  char: svg(
    lg('char-h', SILVER, 0, 0, 1, 1) + lg('char-b', BLUE) + lg('char-p', RED) + lg('char-s', ['#fff3e6', '#ffd0a8']),
    `<path d="M27 13C25 4 38 0 51 6C46 7 44 11 43 16Z" fill="url(#char-p)" ${S()}/>` +
    `<path d="M6 60C6 48 17 42 32 42C47 42 58 48 58 60Z" fill="url(#char-b)" ${S()}/>` +
    `<path d="M21 43C25 48 39 48 43 43L42 49C37 53 27 53 22 49Z" fill="#ffcc33" ${S(2.5)}/>` +
    `<ellipse cx="32" cy="32" rx="12" ry="12.5" fill="url(#char-s)" ${S()}/>` +
    `<path d="M16 40C13 22 21 9 32 9C43 9 51 22 48 40L42 40V31C42 26 38 22 32 22C26 22 22 26 22 31V40Z" fill="url(#char-h)" ${S()}/>` +
    `<path d="M22 31C23 25 41 25 42 31" fill="none" stroke="#ffcc33" stroke-width="2.5"/>` +
    `<ellipse cx="27.3" cy="34" rx="2.1" ry="3" fill="${INK}"/><ellipse cx="36.7" cy="34" rx="2.1" ry="3" fill="${INK}"/>` +
    `<circle cx="28" cy="33" r=".9" fill="#fff"/><circle cx="37.4" cy="33" r=".9" fill="#fff"/>` +
    `<ellipse cx="25" cy="39" rx="2.2" ry="1.2" fill="#ff8a9a" opacity=".7"/><ellipse cx="39" cy="39" rx="2.2" ry="1.2" fill="#ff8a9a" opacity=".7"/>` +
    glint(23, 17, 2.5, 5, 35)),

  bag: svg(
    lg('bag-a', WOOD) + lg('bag-b', ['#ffd29c', '#d98c4a', '#a0521f']) + lg('bag-g', GOLD),
    ln('M24 17C24 7 40 7 40 17', '#b0642c', 4) +
    `<rect x="11" y="16" width="42" height="43" rx="10" fill="url(#bag-a)" ${S()}/>` +
    `<rect x="18" y="41" width="28" height="14" rx="5" fill="#8a4520" ${S(2.6)}/>` +
    `<path d="M11 27C11 20 16 15 23 15H41C48 15 53 20 53 27V31C53 37 45 39 32 39C19 39 11 37 11 31Z" fill="url(#bag-b)" ${S()}/>` +
    `<rect x="28.5" y="31" width="7" height="16" rx="2" fill="#6e3414" ${S(2.5)}/>` +
    `<rect x="26.5" y="35" width="11" height="8.5" rx="2" fill="url(#bag-g)" ${S(2.5)}/>` +
    `<rect x="30" y="37.7" width="4" height="3" rx="1" fill="#6e3414"/>` +
    glint(19, 21, 3.5, 2, -25)),

  skills: svg(
    rg('skills-l', ['#e6ffff/.95', '#5fe3ff/.55', '#2a7bff/0'], 0.5, 0.5, 0.5) + lg('skills-a', PURPLE, 0, 0, 1, 1) + lg('skills-p', PARCH) + lg('skills-g', GOLD),
    `<circle cx="32" cy="32" r="31" fill="url(#skills-l)"/>` +
    `<g transform="rotate(-12 32 34)">` +
    `<rect x="18" y="13" width="32" height="43" rx="3" fill="url(#skills-p)" ${S()}/>` +
    `<rect x="13" y="9" width="33" height="43" rx="4" fill="url(#skills-a)" ${S()}/>` +
    `<rect x="15" y="10.6" width="5" height="39.8" rx="1.5" fill="#3e1a8c"/>` +
    `<path d="M37 9H42C44 9 46 11 46 13V18Z" fill="url(#skills-g)" ${S(2.5)}/><path d="M37 52H42C44 52 46 50 46 48V43Z" fill="url(#skills-g)" ${S(2.5)}/>` +
    `<path d="M32 19Q33.4 28.6 43 30Q33.4 31.4 32 41Q30.6 31.4 21 30Q30.6 28.6 32 19Z" fill="#bff8ff" ${S(2.5)}/>` +
    `<circle cx="32" cy="30" r="2.6" fill="#fff"/></g>` +
    spark(53, 11, 5.5) + spark(9, 49, 4.5, '#bff8ff') + spark(56, 47, 3.5)),

  pets: svg(
    rg('pets-a', PINK),
    pawShapes('url(#pets-a)') +
    glint(28, 40, 3.5, 2, -20) + glint(22, 13.5, 1.4, 2.4, -10) + glint(38.5, 13.5, 1.4, 2.4, 10) + glint(11.5, 27, 1.3, 2.2, -25) + glint(48.5, 27, 1.3, 2.2, 25)),

  mounts: svg(
    lg('mounts-a', ['#ffe2bf', '#e39a55', '#a8561f'], 0, 0, 1, 1) + lg('mounts-m', ['#7a3a1c', '#4a1e0c']) + lg('mounts-g', GOLD),
    `<path d="M45 9C56 14 61 28 59 42C61 48 60 55 58 60H49C52 44 50 28 42 17Z" fill="url(#mounts-m)" ${S()}/>` +
    `<path d="M35 15L39 2L45 13Z" fill="url(#mounts-a)" ${S()}/>` +
    `<path d="M41 6C45 9 47 13 48 17C54 26 56 42 56 60H32C32 54 30 50 26 47C21 50 16 52 12 50C7 48 6 42 9 38C14 30 20 22 29 14C33 10 37 7 41 6Z" fill="url(#mounts-a)" ${S()}/>` +
    `<path d="M41 10C35 12 31 17 32 23C35 19 39 18 44 18Z" fill="url(#mounts-m)" ${S(2.5)}/>` +
    ln('M42 20L25 43', '#d8323a', 3) + ln('M15 32L24 45', '#d8323a', 3) +
    `<circle cx="24.5" cy="43.5" r="3.4" fill="url(#mounts-g)" ${S(2.4)}/>` +
    `<ellipse cx="33.5" cy="25" rx="2.6" ry="3.2" fill="${INK}"/><circle cx="34.3" cy="24" r="1" fill="#fff"/>` +
    `<ellipse cx="11.5" cy="42" rx="1.8" ry="2.6" transform="rotate(20 11.5 42)" fill="#5a2810"/>` +
    glint(47, 32, 2, 7, -10, 0.55)),

  quests: svg(
    lg('quests-a', PARCH) + lg('quests-b', ['#fff2c8', '#e6bd72', '#b07a3a']) + rg('quests-r', RED),
    `<path d="M15 12H49V52H15Z" fill="url(#quests-a)" ${S()}/>` +
    `<path d="M21 23H43M21 30H43M21 37H34" stroke="#c99a5c" stroke-width="3" stroke-linecap="round"/>` +
    `<rect x="9" y="6" width="46" height="10" rx="5" fill="url(#quests-b)" ${S()}/>` +
    `<rect x="9" y="48" width="46" height="10" rx="5" fill="url(#quests-b)" ${S()}/>` +
    glint(16, 9.5, 3, 1.4, 0) +
    `<path d="M38 47L35 60L39.5 57.5L42.5 61L45 49Z" fill="#c21a32" ${S(2.4)}/><path d="M47 49L50 61L52.5 57.5L57 59.5L53 47Z" fill="#c21a32" ${S(2.4)}/>` +
    `<circle cx="45.5" cy="44" r="9.5" fill="url(#quests-r)" ${S()}/>` +
    `<path d="${starD(45.5, 44.5, 5.2, 2.4)}" fill="#ffd0c4" opacity=".75"/>` +
    glint(42, 39.5, 2.2, 1.3, -30)),

  map: svg(
    lg('map-a', PARCH) + lg('map-b', ['#f2d290', '#d6a45c', '#ad7536']),
    `<path d="M6 14L24 8V52L6 58Z" fill="url(#map-a)" ${S()}/>` +
    `<path d="M24 8L40 14V58L24 52Z" fill="url(#map-b)" ${S()}/>` +
    `<path d="M40 14L58 8V52L40 58Z" fill="url(#map-a)" ${S()}/>` +
    `<path d="M10 23C13 18 21 18 21.5 24C22 30 16 34 12 32C9 30 9 26 10 23Z" fill="#5fd94a" stroke="#2c8a3a" stroke-width="2"/>` +
    `<path d="M44 42C47 40 49 44 52 42S55 44 56 43" fill="none" stroke="#4cb4ff" stroke-width="2.5" stroke-linecap="round"/>` +
    `<path d="M13 48C20 46 26 41 30 35C34 29 39 30 45 28" fill="none" stroke="#d8323a" stroke-width="3" stroke-linecap="round" stroke-dasharray="3.5 4"/>` +
    ln('M45 21L53 29M53 21L45 29', '#ff4b3e', 3.5)),

  settings: svg(
    rg('settings-a', GOLD, 0.4, 0.35, 0.7),
    `<path d="${gearD(32, 32, 28, 21.5, 8, 7.5)}" fill="url(#settings-a)" fill-rule="evenodd" ${S()}/>` +
    `<circle cx="32" cy="32" r="14" fill="none" stroke="#c87a12" stroke-width="3"/>` +
    `<path d="M22.5 21.5A14 14 0 0 1 36 18.6" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>` +
    glint(17, 17, 2, 3.5, 45)),

  // ===== activity icons =====
  signin: svg(
    lg('signin-a', ['#ffffff', '#dfe8fb']) + lg('signin-h', RED) + lg('signin-g', GOLD),
    `<rect x="9" y="12" width="46" height="46" rx="7" fill="url(#signin-a)" ${S()}/>` +
    `<path d="M9 19C9 15 12 12 16 12H48C52 12 55 15 55 19V25H9Z" fill="url(#signin-h)" ${S()}/>` +
    `<rect x="18" y="6" width="6" height="12" rx="3" fill="url(#signin-g)" ${S(2.5)}/><rect x="40" y="6" width="6" height="12" rx="3" fill="url(#signin-g)" ${S(2.5)}/>` +
    [15, 24, 33, 42].map((x) => `<rect x="${x}" y="30" width="7" height="6" rx="1.5" fill="#c3d2f2"/>`).join('') +
    [15, 24].map((x) => `<rect x="${x}" y="40" width="7" height="6" rx="1.5" fill="#c3d2f2"/>`).join('') +
    ln('M20 40L29 49L47 28', '#4fd23c', 6) +
    `<path d="M21 39L28 46" stroke="#c8ffb0" stroke-width="2" stroke-linecap="round"/>`),

  gift: svg(
    lg('gift-a', RED) + lg('gift-c', ['#ffd0c4', '#ff6a56', '#d02a36']) + lg('gift-g', GOLD),
    `<rect x="11" y="31" width="42" height="27" rx="3" fill="url(#gift-a)" ${S()}/>` +
    `<rect x="7" y="22" width="50" height="11" rx="3" fill="url(#gift-c)" ${S()}/>` +
    `<path d="M28 22H36V58H28Z" fill="url(#gift-g)" ${S(2.5)}/>` +
    `<path d="M32 22C24 9 11 11 15 20C17 24 26 23 32 22Z" fill="url(#gift-g)" ${S()}/>` +
    `<path d="M32 22C40 9 53 11 49 20C47 24 38 23 32 22Z" fill="url(#gift-g)" ${S()}/>` +
    `<circle cx="32" cy="22" r="4.2" fill="#ffcc33" ${S(2.6)}/>` +
    glint(13, 26.5, 2.6, 1.3, 0) + glint(30.3, 40, 0.9, 6, 0, 0.75)),

  mall: svg(
    lg('mall-d', ['#7fd0ff', '#2e86f0']),
    [6, 19, 32, 45].map((x, i) => `<path d="M${x} 5H${x + 13}V14A6.5 6.5 0 0 1 ${x} 14Z" fill="${i % 2 ? '#fff' : '#ff4b3e'}"/>`).join('') +
    `<path d="M6 5H58V14A6.5 6.5 0 0 1 45 14A6.5 6.5 0 0 1 32 14A6.5 6.5 0 0 1 19 14A6.5 6.5 0 0 1 6 14Z" fill="none" ${S()}/>` +
    diamond('mall', 32, 24, 38, 35) +
    spark(36, 30, 4) + spark(8, 34, 5) + spark(56, 34, 4.5) + spark(52, 54, 3.2, '#bff8ff')),

  rank: svg(
    lg('rank-g', GOLD, 0, 0, 1, 1) + lg('rank-c', ['#ffe066', '#ffb020', '#c86a08'], 0, 0, 1, 0) + lg('rank-w', ['#b04a2a', '#6a2414']),
    ln('M17 15C6 14 6 29 19 31', '#ffcc33', 4) + ln('M47 15C58 14 58 29 45 31', '#ffcc33', 4) +
    `<path d="M28 39H36L35.5 47H28.5Z" fill="#d9800f" ${S(2.5)}/>` +
    `<path d="M15 8H49V20C49 32 41 40 32 40C23 40 15 32 15 20Z" fill="url(#rank-c)" ${S()}/>` +
    `<ellipse cx="32" cy="9" rx="15" ry="2.6" fill="#c86a08"/>` +
    `<rect x="21" y="46" width="22" height="5" rx="2" fill="url(#rank-g)" ${S(2.5)}/>` +
    `<rect x="15" y="50" width="34" height="9" rx="3" fill="url(#rank-w)" ${S()}/>` +
    `<rect x="26" y="53" width="12" height="3" rx="1.2" fill="#ffcc33"/>` +
    `<path d="${starD(32, 23, 8, 3.6)}" fill="#fff7b8" stroke="#c86a08" stroke-width="2" stroke-linejoin="round"/>` +
    glint(20, 20, 1.6, 6, 0)),

  bounty: svg(
    lg('bounty-a', PARCH) + lg('bounty-s', SILVER, 0, 0, 1, 0) + lg('bounty-g', GOLD) + rg('bounty-c', GOLD),
    `<path d="M6 15L45 11L49 56L10 60Z" fill="url(#bounty-a)" ${S()}/>` +
    `<path d="M12 20.5L38 18L40 42L14.5 44.5Z" fill="#e8c88a" stroke="#b07a3a" stroke-width="2"/>` +
    `<circle cx="26" cy="28" r="5.8" fill="#7a4220"/><path d="M15.5 43C16 35 35 33 38.5 41Z" fill="#7a4220"/>` +
    `<path d="M16 51.5L39 49.5" stroke="#b07a3a" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="49" cy="52" r="7.5" fill="url(#bounty-c)" ${S()}/><path d="${starD(49, 52.4, 3.8, 1.7)}" fill="#c86a08"/>` +
    `<g transform="translate(42 18) rotate(45)"><path d="M0 9L-4 -4H4Z" fill="url(#bounty-s)" ${S()}/>` +
    `<rect x="-8.5" y="-7.5" width="17" height="4.5" rx="2.2" fill="url(#bounty-g)" ${S()}/>` +
    `<rect x="-2.6" y="-14.5" width="5.2" height="7" fill="#b3172f" ${S(2.6)}/><circle cx="0" cy="-17" r="2.9" fill="url(#bounty-g)" ${S(2.6)}/></g>`),

  teleport: svg(
    rg('teleport-a', ['#f2fdff', '#6fd6ff', '#6a4ae6', '#2a1a8a'], 0.5, 0.5, 0.5),
    `<circle cx="32" cy="32" r="27" fill="url(#teleport-a)" ${S()}/>` +
    [0, 120, 240].map((a) => `<path d="M33 31C31 21 39 11 53 14C43 16 38 22 37.5 31Z" fill="#fff" opacity=".9" transform="rotate(${a} 32 32)"/>`).join('') +
    `<circle cx="32" cy="32" r="5" fill="#fff"/>` +
    `<circle cx="32" cy="32" r="22" fill="none" stroke="#b6f0ff" stroke-width="1.6" opacity=".6"/>` +
    spark(54, 9, 5) + spark(9, 54, 4.5, '#bff8ff') + spark(57, 50, 3)),

  dungeon: svg(
    lg('dungeon-a', ['#e6e2f2', '#a29cbc', '#625c80']) + rg('dungeon-d', ['#6a2a8a', '#2a1238', '#120818'], 0.5, 0.7, 0.7) + lg('dungeon-b', ['#ffffff', '#ddd6ec']),
    `<path d="M7 59V30C7 15 18 5 32 5C46 5 57 15 57 30V59Z" fill="url(#dungeon-a)" ${S()}/>` +
    `<path d="M18 59V32C18 23 24 16 32 16C40 16 46 23 46 32V59Z" fill="url(#dungeon-d)" ${S()}/>` +
    `<path d="M7 33H18M46 33H57M7 46H18M46 46H57M20.5 23L10.5 16.5M43.5 23L53.5 16.5M28 16.5L27 5.5M36 16.5L37 5.5" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` +
    glint(13, 24, 1.5, 4, 35, 0.7) +
    `<path d="M32 30C37.5 30 41 34 41 38.5C41 41.5 39.5 43 38 44V48.5H26V44C24.5 43 23 41.5 23 38.5C23 34 26.5 30 32 30Z" fill="url(#dungeon-b)" ${S(2.6)}/>` +
    `<circle cx="28.3" cy="38.5" r="2.8" fill="#2a1238"/><circle cx="35.7" cy="38.5" r="2.8" fill="#2a1238"/>` +
    `<circle cx="28.3" cy="38.5" r="1.4" fill="#ff4b3e"/><circle cx="35.7" cy="38.5" r="1.4" fill="#ff4b3e"/>` +
    `<path d="M30 45.5V48.5M34 45.5V48.5" stroke="${INK}" stroke-width="1.8"/>` +
    `<path d="M4 59H60" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`),

  // ===== class emblems =====
  cls_knight: svg(
    lg('cls_knight-a', BLUE, 0, 0, 1, 1) + lg('cls_knight-sw', SILVER, 0, 0, 1, 0) + lg('cls_knight-g', GOLD),
    `<path d="M32 6L53 12C53 34 47 48 32 59C17 48 11 34 11 12Z" fill="url(#cls_knight-a)" ${S()}/>` +
    `<path d="M32 11.5L48 16C47.5 33 42.5 44 32 52.5C21.5 44 16.5 33 16 16Z" fill="none" stroke="#ffcc33" stroke-width="2.8" stroke-linejoin="round"/>` +
    glint(20, 22, 2, 5, 15, 0.7) +
    sword('cls_knight', 'rotate(45 32 32)')),

  cls_assassin: svg(
    lg('cls_assassin-b', ['#ffffff', '#b9f2d8', '#2f9a74'], 0, 0, 1, 0) + lg('cls_assassin-g', GOLD),
    [-42, 42].map((a) => `<g transform="translate(0 7) rotate(${a} 32 18)">` +
      `<path d="M32 1C36 8 38.5 18 37 32H27C25.5 18 28 8 32 1Z" fill="url(#cls_assassin-b)" ${S()}/>` +
      `<path d="M32 7V30" stroke="#24705a" stroke-width="2.2" stroke-linecap="round"/>` +
      `<path d="M20 32H44L41 37.5H23Z" fill="url(#cls_assassin-g)" ${S()}/>` +
      `<rect x="28.8" y="37.5" width="6.4" height="10" fill="#5a2a6a" ${S()}/>` +
      `<circle cx="32" cy="51" r="3.8" fill="#ff4b6a" ${S()}/></g>`).join('')),

  cls_mage: svg(
    lg('cls_mage-a', PURPLE, 0, 0, 1, 1) + lg('cls_mage-b', ['#8a52e0', '#3e1a8c']) + lg('cls_mage-g', GOLD) + rg('cls_mage-f', ['#fff4a0', '#ff8a1e', '#e0281e'], 0.5, 0.8, 0.9),
    `<ellipse cx="32" cy="50" rx="28" ry="9" fill="url(#cls_mage-b)" ${S()}/>` +
    `<path d="M13 49C19 38 22 26 28 15C32 8 40 4 50 8C43 9 39 13 38 20C38 31 43 41 51 49C42 53 22 53 13 49Z" fill="url(#cls_mage-a)" ${S()}/>` +
    `<path d="M15.5 44C24 48 41 48 48.5 44L50.5 49C41 53 23 53 13.5 49Z" fill="url(#cls_mage-g)" ${S(2.6)}/>` +
    `<path d="${flameD(32, 42, 20, 7.5)}" fill="url(#cls_mage-f)" ${S(2.6)}/>` +
    `<path d="${flameD(32, 41, 10, 3.6)}" fill="#fff6b0"/>` +
    glint(26, 24, 1.5, 5, 25, 0.75) +
    spark(55, 18, 4.5, '#ffe9a0') + spark(9, 33, 3.5, '#ffe9a0')),

  cls_priest: svg(
    lg('cls_priest-w', ['#ffffff', '#9fd0ff']) + lg('cls_priest-g', GOLD, 0, 0, 1, 0) + rg('cls_priest-j', BLUE),
    mirror(`<path d="M27 20C20 10 9 8 3 13C7 14.5 9 16.5 9.5 19C5 20 3.5 24 4.5 27.5C8.5 26.5 11.5 27.5 13 29.5C10.5 32 10 35.5 11.5 39C16 37 19 38.5 19.5 41C23.5 37 26.5 32 27.5 27Z" fill="url(#cls_priest-w)" ${S()}/>` +
    `<path d="M9.5 19C15 19 20 20.5 24 23.5M13 29.5C17 28 21 27 25 26.5M19.5 41C21.5 37 23.5 33 25.5 30" fill="none" stroke="#6aaef0" stroke-width="2" stroke-linecap="round"/>`) +
    ln('M32 3V14M27.5 7.5H36.5', '#ffcc33', 3) +
    `<rect x="28.6" y="29" width="6.8" height="27" rx="3" fill="url(#cls_priest-g)" ${S()}/>` +
    `<circle cx="32" cy="57.5" r="3" fill="#ffcc33" ${S(2.6)}/>` +
    `<circle cx="32" cy="23" r="9" fill="url(#cls_priest-g)" ${S()}/>` +
    `<circle cx="32" cy="23" r="5" fill="url(#cls_priest-j)" ${S(2.2)}/>` + glint(30.5, 21.2, 1.4, 1, 0)),

  // ===== elements =====
  el_fire: svg(
    rg('el_fire-a', ['#ffd04a', '#ff7a1a', '#d61f2a'], 0.5, 0.85, 0.85) + rg('el_fire-b', ['#ffffff', '#fff07a', '#ffb81a'], 0.5, 0.8, 0.8),
    `<path d="${flameD(32, 59, 55, 20)}" fill="url(#el_fire-a)" ${S()}/>` +
    `<path d="${flameD(32, 56, 28, 10)}" fill="url(#el_fire-b)" stroke="#ff8a1e" stroke-width="1.5"/>` +
    glint(21, 36, 1.8, 5, 20, 0.6)),

  el_water: svg(
    rg('el_water-a', ['#e6fbff', '#5cc4ff', '#1f4fc8'], 0.4, 0.55, 0.7),
    `<path d="M32 4C40 18 52 28 52 40C52 51 43 59 32 59C21 59 12 51 12 40C12 28 24 18 32 4Z" fill="url(#el_water-a)" ${S()}/>` +
    `<path d="M18 42C19 49 24 53 30 54" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".85"/>` +
    `<path d="M22 44C27 40 31 46 36 43C40 41 43 42 46 44" fill="none" stroke="#1f4fc8" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>` +
    glint(25, 26, 2.4, 5.5, 30)),

  el_wind: svg(
    lg('el_wind-a', ['#e8fff4', '#59e0a4', '#1f9a6a'], 0, 0, 1, 0),
    ln('M6 25H37C44 25 48 20 47 14C46 8 38 7 35 12C33 15 35 19 39 19', 'url(#el_wind-a)', 4.5) +
    ln('M10 36H48C55 36 59 42 57 47C55 52 47 53 45 48C44 45 46 42 50 42', 'url(#el_wind-a)', 4.5) +
    ln('M8 47H27C33 47 35 53 32 57', 'url(#el_wind-a)', 4.5) +
    spark(54, 10, 4.5, '#e8fff4') + spark(12, 14, 3.2, '#e8fff4')),

  el_earth: svg(
    lg('el_earth-a', ['#e0a458', '#a8601f']) + lg('el_earth-l', ['#d8ff8a', '#3cbf3c'], 0, 0, 1, 1),
    `<path d="M14 54L18 32L32 21L48 25L58 43L51 58H22Z" fill="url(#el_earth-a)" ${S()}/>` +
    `<path d="M18 32L32 21L48 25L38 35Z" fill="#ffd27e"/><path d="M38 35L48 25L58 43L51 58Z" fill="#7a3e14"/>` +
    `<path d="M14 54L18 32L32 21L48 25L58 43L51 58H22ZM18 32L38 35L48 25M38 35L51 58" fill="none" ${S(2.6)}/>` +
    `<path d="M5 57L8 47L16 44L22 50L20 58Z" fill="#c47a35" ${S()}/><path d="M8 47L16 44L22 50L14 51Z" fill="#ffd27e" ${S(2)}/>` +
    ln('M33 23C33 18 33 15 32 12', '#3cbf3c', 2.6) +
    `<path d="M32 13C26 14 20 10 19 4C25 3 31 7 32 13ZM32 13C36 7 42 4 48 6C46 12 39 15 32 13Z" fill="url(#el_earth-l)" ${S(2.6)}/>` +
    glint(28, 27, 1.5, 3.5, 60, 0.85)),

  // ===== buttons =====
  auto: (() => {
    const c = 32, R = 24, a0 = -62 * Math.PI / 180, a1 = 228 * Math.PI / 180;
    const P = (a) => [c + Math.cos(a) * R, c + Math.sin(a) * R];
    const [sx, sy] = P(a0), [ex, ey] = P(a1), dx = -Math.sin(a1), dy = Math.cos(a1), nx = Math.cos(a1), ny = Math.sin(a1);
    const tip = `${f(ex + dx * 8)} ${f(ey + dy * 8)}`, b1 = `${f(ex - dx * 2 + nx * 7)} ${f(ey - dy * 2 + ny * 7)}`, b2 = `${f(ex - dx * 2 - nx * 7)} ${f(ey - dy * 2 - ny * 7)}`;
    const k = 0.7;
    return svg(
      lg('auto-r', ['#b8ffe6', '#1aa88a'], 0, 0, 1, 1) + lg('auto-sw', SILVER, 0, 0, 1, 0) + lg('auto-g', GOLD),
      ln(`M${f(sx)} ${f(sy)}A${R} ${R} 0 1 1 ${f(ex)} ${f(ey)}`, 'url(#auto-r)', 5) +
      `<path d="M${tip}L${b1}L${b2}Z" fill="#4fe0b0" ${S()}/>` +
      sword('auto', `translate(32 32) rotate(45) scale(${k}) translate(-32 -32)`, k, true) +
      sword('auto', `translate(32 32) rotate(-45) scale(${k}) translate(-32 -32)`, k, true));
  })(),

  mount: svg(
    lg('mount-a', GOLD, 0, 0, 1, 1),
    ln('M16 54C9 38 11 14 32 12.5C53 14 55 38 48 54', 'url(#mount-a)', 11) +
    `<path d="M14.5 40C13.5 28 18 18 28 15.5" fill="none" stroke="#fff7b8" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>` +
    [[14.2, 47], [13.6, 34], [19, 22], [45, 22], [50.4, 34], [49.8, 47]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.6" ry="2.4" fill="#8a4a10"/>`).join('') +
    `<path d="M10 55H22M42 55H54" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`),

  sound_on: svg(
    lg('sound_on-a', GOLD, 0, 0, 1, 1),
    speaker('sound_on') +
    ln('M38 24C42 28 42 36 38 40', '#7fe0ff', 3.5) + ln('M45 16C53 24 53 40 45 48', '#7fe0ff', 3.5)),

  sound_off: svg(
    lg('sound_off-a', GOLD, 0, 0, 1, 1),
    speaker('sound_off') +
    ln('M40 24L54 38M54 24L40 38', '#ff4b3e', 4.5)),

  chat: svg(
    lg('chat-a', ['#ffffff', '#e2ecff', '#a9c2f2']),
    `<path d="M32 7C46 7 58 15.5 58 27.5C58 39.5 46 48 32 48C29.5 48 27 47.8 24.5 47.2L12 56.5L14.5 44.5C9.5 40.5 6 34.5 6 27.5C6 15.5 18 7 32 7Z" fill="url(#chat-a)" ${S()}/>` +
    [20, 32, 44].map((x) => `<circle cx="${x}" cy="28" r="4" fill="#3a5ad0"/>`).join('') +
    glint(15, 18, 2, 4.5, 45)),

  dice: svg(
    '',
    `<path d="M32 6L56 18L32 30L8 18Z" fill="#ffffff" ${S()}/>` +
    `<path d="M8 18L32 30V58L8 46Z" fill="#e4dcf6" ${S()}/>` +
    `<path d="M32 30L56 18V46L32 58Z" fill="#b5a8de" ${S()}/>` +
    `<ellipse cx="32" cy="18" rx="5.5" ry="3.2" fill="#ff3a4a"/>` +
    [[14.7, 29.4], [25.3, 46.6]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="3.6" transform="rotate(-27 ${x} ${y})" fill="#3a2a5a"/>`).join('') +
    [[38, 34], [44, 38], [50, 42]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="2.4" ry="3.4" transform="rotate(27 ${x} ${y})" fill="#3a2a5a"/>`).join('') +
    glint(24, 16, 1.4, 4, 63, 0.9)),

  worldmap: svg(
    rg('worldmap-r', GOLD, 0.4, 0.35, 0.8) + rg('worldmap-f', ['#fffbe6', '#f2d898'], 0.5, 0.5, 0.6),
    `<circle cx="32" cy="32" r="26" fill="url(#worldmap-r)" ${S()}/>` +
    `<circle cx="32" cy="32" r="19.5" fill="url(#worldmap-f)" ${S(2.5)}/>` +
    `<path d="M32 15L35 29L49 32L35 35L32 49L29 35L15 32L29 29Z" fill="#4cb4ff" stroke="#1f4fc8" stroke-width="1.5" stroke-linejoin="round" transform="rotate(45 32 32)"/>` +
    `<path d="M32 4L37 32H27Z" fill="#ff4b3e" ${S(2.6)}/><path d="M32 60L37 32H27Z" fill="#f2f6ff" ${S(2.6)}/>` +
    `<path d="M4 32L32 27V37Z" fill="#f2f6ff" ${S(2.6)}/><path d="M60 32L32 27V37Z" fill="#f2f6ff" ${S(2.6)}/>` +
    `<path d="M32 4L37 32H32ZM32 60L27 32H32ZM4 32L32 37V32ZM60 32L32 27V32Z" fill="#24160f" opacity=".22"/>` +
    `<circle cx="32" cy="32" r="3.6" fill="#ffcc33" ${S(2.4)}/>`),

  lock: svg(
    lg('lock-a', GOLD, 0, 0, 1, 1) + lg('lock-s', SILVER, 0, 0, 1, 0),
    ln('M20 31V21C20 13 25 7.5 32 7.5C39 7.5 44 13 44 21V31', 'url(#lock-s)', 5.5) +
    `<rect x="11" y="28" width="42" height="30" rx="7" fill="url(#lock-a)" ${S()}/>` +
    `<path d="M32 36A4.5 4.5 0 0 1 34.6 44.2L36 51H28L29.4 44.2A4.5 4.5 0 0 1 32 36Z" fill="#5a2c08"/>` +
    `<path d="M15 34V46" stroke="#fff7b8" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>`),

  // ===== rewards & misc =====
  exp: svg(
    rg('exp-l', ['#fff7b8/.95', '#ffcc33/.45', '#ff9a1a/0'], 0.5, 0.5, 0.5) + rg('exp-a', GOLD, 0.45, 0.4, 0.65),
    `<circle cx="32" cy="32" r="31" fill="url(#exp-l)"/>` +
    `<path d="${starD(32, 34, 25, 11)}" fill="url(#exp-a)" ${S()}/>` +
    `<path d="${starD(32, 34, 13, 5.8)}" fill="#fff7b8" opacity=".75"/>` +
    glint(24, 25, 1.6, 3.5, 35) +
    spark(54, 9, 5.5) + spark(9, 12, 4) + spark(57, 53, 3.5)),

  wings: svg(
    lg('wings-a', ['#ffffff/.95', '#9ff0ff/.85', '#ff9ad8/.8'], 1, 0, 0, 1),
    mirror(`<path d="M30 30C24 15 13 4 6 7C1 11 4 23 12 29C18 33 25 33 30 30Z" fill="url(#wings-a)" ${S(2.6)}/>` +
    `<path d="M30 35C22 34 12 40 12 50C13 57 22 56 26 49C29 44 30 39 30 35Z" fill="url(#wings-a)" ${S(2.6)}/>` +
    `<path d="M27 28C22 21 15 14 10 12M27 37C23 41 19 45 17 50" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>`) +
    `<ellipse cx="32" cy="33" rx="3" ry="6" fill="#ffcc33" ${S(2.4)}/>` +
    spark(32, 11, 4.5) + spark(32, 55, 3.5, '#bff8ff')),

  sprite: svg(
    rg('sprite-l', ['#fffbd0/.95', '#a6ffcf/.5', '#40e0a0/0'], 0.5, 0.5, 0.5) + rg('sprite-o', ['#ffffff', '#d9ffb0', '#3ad08a'], 0.4, 0.35, 0.75) + lg('sprite-w', ['#ffffff/.95', '#9ff0ff/.8'], 1, 0, 0, 1),
    `<circle cx="32" cy="33" r="29" fill="url(#sprite-l)"/>` +
    mirror(`<path d="M23 30C17 18 7 18 6 25C5 32 14 35 22 34Z" fill="url(#sprite-w)" ${S(2.4)}/><path d="M22 37C15 38 10 43 13 47C16 50 21 45 23 40Z" fill="url(#sprite-w)" ${S(2.4)}/>`) +
    `<circle cx="32" cy="35" r="11.5" fill="url(#sprite-o)" ${S(2.6)}/>` +
    `<ellipse cx="28.3" cy="36" rx="1.6" ry="2.3" fill="${INK}"/><ellipse cx="35.7" cy="36" rx="1.6" ry="2.3" fill="${INK}"/>` +
    `<ellipse cx="25.5" cy="39.5" rx="1.8" ry="1" fill="#ff8ab0" opacity=".8"/><ellipse cx="38.5" cy="39.5" rx="1.8" ry="1" fill="#ff8ab0" opacity=".8"/>` +
    glint(28, 29.5, 2.2, 1.3, -25) +
    spark(32, 10, 5) + spark(10, 54, 3.5, '#fffbd0') + spark(55, 55, 4)),

  chest: svg(
    lg('chest-a', WOOD) + lg('chest-l', ['#f2b878', '#c47436', '#8a4518']) + lg('chest-g', GOLD),
    `<rect x="8" y="31" width="48" height="27" rx="3" fill="url(#chest-a)" ${S()}/>` +
    `<path d="M8 32V23C8 14 14 9 22 9H42C50 9 56 14 56 23V32Z" fill="url(#chest-l)" ${S()}/>` +
    `<path d="M14 11V58M50 11V58" stroke="${INK}" stroke-width="8.5"/><path d="M14 11.5V56.5M50 11.5V56.5" stroke="url(#chest-g)" stroke-width="4"/>` +
    `<rect x="6" y="28" width="52" height="6" rx="2" fill="url(#chest-g)" ${S(2.6)}/>` +
    `<rect x="25.5" y="27" width="13" height="15" rx="3" fill="url(#chest-g)" ${S(2.6)}/>` +
    `<path d="M32 32.5A2.2 2.2 0 0 1 33.3 36.5L34 39H30L30.7 36.5A2.2 2.2 0 0 1 32 32.5Z" fill="#5a2c08"/>` +
    glint(22, 14, 3.5, 1.6, -10)),

  chest_open: svg(
    rg('chest_open-l', ['#ffffff/.95', '#fff2a0/.6', '#ffcc33/0'], 0.5, 0.55, 0.5) + lg('chest_open-a', WOOD) + lg('chest_open-k', GOLD),
    `<circle cx="32" cy="27" r="27" fill="url(#chest_open-l)"/>` +
    `<path d="M10 26L13 10H51L54 26Z" fill="#6e3414" ${S()}/><path d="M13 10H51" stroke="#ffcc33" stroke-width="3"/>` +
    `<path d="${[-150, -120, -90, -60, -30].map((d) => {
      const r = Math.PI / 180, p = (q) => `${f(32 + Math.cos(q * r) * 30)} ${f(30 + Math.sin(q * r) * 30)}`;
      return `M32 30L${p(d - 6)}L${p(d + 6)}Z`;
    }).join('')}" fill="#fffbd0" opacity=".6"/>` +
    `<path d="M11 31C12 23 18 20 23 23C26 17 34 16 38 21C42 18 50 20 53 31Z" fill="url(#chest_open-k)" ${S()}/>` +
    `<ellipse cx="21" cy="26" rx="3.5" ry="2" fill="#fff7b8"/><ellipse cx="43" cy="26" rx="3.5" ry="2" fill="#fff7b8"/>` +
    `<path d="M31 18L35 23L31 28L27 23Z" fill="#ff4b6a" ${S(2.4)}/>` +
    `<rect x="8" y="31" width="48" height="27" rx="3" fill="url(#chest_open-a)" ${S()}/>` +
    `<path d="M14 31V58M50 31V58" stroke="${INK}" stroke-width="8.5"/><path d="M14 33V56.5M50 33V56.5" stroke="url(#chest_open-k)" stroke-width="4"/>` +
    `<rect x="6" y="29" width="52" height="6" rx="2" fill="url(#chest_open-k)" ${S(2.6)}/>` +
    `<rect x="25.5" y="33" width="13" height="11" rx="3" fill="url(#chest_open-k)" ${S(2.6)}/>` +
    `<circle cx="32" cy="38.5" r="2" fill="#5a2c08"/>` +
    spark(54, 7, 4.5) + spark(9, 6, 3.5)),

  key: svg(
    lg('key-a', GOLD, 0, 0, 1, 1),
    `<g transform="rotate(-45 32 32)">` +
    `<path d="M28.5 23H35.5V57H28.5Z" fill="url(#key-a)" ${S()}/>` +
    `<path d="M35.5 41H44.5V46.5H40.5V50.5H44.5V56.5H35.5Z" fill="url(#key-a)" ${S()}/>` +
    `<path d="M32 2C35.5 2 38 4.5 38 7.5C42 7 45 10.5 44 14.5C43 18.5 39 20.5 36.5 20C36 23 34 25 32 25C30 25 28 23 27.5 20C25 20.5 21 18.5 20 14.5C19 10.5 22 7 26 7.5C26 4.5 28.5 2 32 2Z${circleD(32, 13.5, 4.5)}" fill="url(#key-a)" fill-rule="evenodd" ${S()}/>` +
    `<rect x="26.5" y="24.5" width="11" height="4.5" rx="2" fill="#d9800f" ${S(2.6)}/>` +
    `<path d="M30.5 31V53" stroke="#fff7b8" stroke-width="2" stroke-linecap="round" opacity=".9"/></g>` +
    glint(18, 12.5, 1.6, 3, 0)),

  timer: svg(
    lg('timer-a', WOOD) + lg('timer-s', ['#fff2a0', '#ffb020', '#e07a10']),
    `<path d="M19 11H45C45 24 36 28 34 32C36 36 45 40 45 53H19C19 40 28 36 30 32C28 28 19 24 19 11Z" fill="#d6f6ff" fill-opacity=".55" ${S()}/>` +
    `<path d="M23.5 17H40.5C39.5 22.5 35 25.5 32 28.5C29 25.5 24.5 22.5 23.5 17Z" fill="url(#timer-s)"/>` +
    `<path d="M32 29V45" stroke="#ffb020" stroke-width="2.2" stroke-linecap="round"/>` +
    `<path d="M21 51C22 44 27 40.5 32 40.5C37 40.5 42 44 43 51Z" fill="url(#timer-s)"/>` +
    `<path d="M22 14C22 19 25 23 28 26" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>` +
    `<path d="M15 10V54M49 10V54" stroke="${INK}" stroke-width="7"/><path d="M15 10V54M49 10V54" stroke="#b0642c" stroke-width="2.6"/>` +
    `<rect x="10" y="4" width="44" height="8" rx="3.5" fill="url(#timer-a)" ${S()}/>` +
    `<rect x="10" y="52" width="44" height="8" rx="3.5" fill="url(#timer-a)" ${S()}/>` +
    `<path d="M14 7H50M14 55H50" stroke="#ffcc33" stroke-width="1.8" opacity=".9"/>`),

  skull: svg(
    lg('skull-a', ['#ffffff', '#ebe4f6', '#ad9fcc']) + lg('skull-h', ['#c69aff', '#7a3ad8', '#3a1680'], 0, 0, 1, 1),
    `<path d="M17 21C9 18 5 11 7 3C11 9 16 12 22 13Z" fill="url(#skull-h)" ${S(2.6)}/><path d="M47 21C55 18 59 11 57 3C53 9 48 12 42 13Z" fill="url(#skull-h)" ${S(2.6)}/>` +
    `<path d="M32 9C46 9 55 18 55 30C55 37 52 41 46 43.5V50C46 53 44 55.5 41 55.5H23C20 55.5 18 53 18 50V43.5C12 41 9 37 9 30C9 18 18 9 32 9Z" fill="url(#skull-a)" ${S()}/>` +
    `<path d="M14 27C18 24 26 26 29 30C29.5 36 26 39.5 21.5 39C16.5 38.5 13.5 33 14 27Z" fill="#2a1838"/><path d="M50 27C46 24 38 26 35 30C34.5 36 38 39.5 42.5 39C47.5 38.5 50.5 33 50 27Z" fill="#2a1838"/>` +
    `<circle cx="22.5" cy="32.5" r="3" fill="#ff3a3a"/><circle cx="41.5" cy="32.5" r="3" fill="#ff3a3a"/><circle cx="23.3" cy="31.6" r="1" fill="#fff"/><circle cx="42.3" cy="31.6" r="1" fill="#fff"/>` +
    `<path d="M32 39.5L29.2 44.5H34.8Z" fill="#2a1838" stroke="#2a1838" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M26 48V55M32 48V55.5M38 48V55" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>` +
    glint(22, 16, 2.2, 4.5, 50)),

  crown: svg(
    lg('crown-a', GOLD) + lg('crown-b', ['#ffcc33', '#c86a08']),
    `<path d="M8 22L20 35L32 15L44 35L56 22L52 50H12Z" fill="url(#crown-a)" ${S()}/>` +
    `<circle cx="8" cy="20" r="4.2" fill="#ffe066" ${S(2.6)}/><circle cx="32" cy="12" r="4.6" fill="#ffe066" ${S(2.6)}/><circle cx="56" cy="20" r="4.2" fill="#ffe066" ${S(2.6)}/>` +
    `<rect x="10" y="44" width="44" height="12" rx="2.5" fill="url(#crown-b)" ${S()}/>` +
    `<circle cx="32" cy="50" r="4.4" fill="#ff3a4a" ${S(2.4)}/><circle cx="19.5" cy="50" r="3.2" fill="#4cb4ff" ${S(2.4)}/><circle cx="44.5" cy="50" r="3.2" fill="#4cb4ff" ${S(2.4)}/>` +
    `<path d="M29 34L32 28L35 34L32 40Z" fill="#59e0a4" ${S(2.2)}/>` +
    glint(30.8, 48.6, 1.2, 0.8, 0) + glint(17, 33, 1.4, 4, 35) + glint(6.8, 18.8, 1, 0.8, 0)),

  star: svg(
    lg('star-a', GOLD),
    `<path d="${starD(32, 34.5, 28.5, 12.5)}" fill="url(#star-a)" ${S()}/>` +
    (() => { // cel shade: darken the right half of each arm
      let d = '';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / 5, b = a + Math.PI / 5;
        d += `M32 34.5L${f(32 + Math.cos(a) * 28.5)} ${f(34.5 + Math.sin(a) * 28.5)}L${f(32 + Math.cos(b) * 12.5)} ${f(34.5 + Math.sin(b) * 12.5)}Z`;
      }
      return `<path d="${d}" fill="#c86a08" opacity=".3"/>`;
    })() +
    glint(25, 26, 1.6, 4, 35)),

  coin: svg(
    rg('coin-a', GOLD, 0.4, 0.35, 0.75),
    `<circle cx="32" cy="34" r="26" fill="#b8650a" ${S()}/>` +
    `<circle cx="32" cy="30" r="26" fill="url(#coin-a)" ${S()}/>` +
    `<circle cx="32" cy="30" r="19" fill="none" stroke="#d9800f" stroke-width="3"/>` +
    `<path d="${starD(32, 31, 11, 5)}" fill="#fff2a0" stroke="#c06a08" stroke-width="2.2" stroke-linejoin="round"/>` +
    glint(17, 18, 2, 5, 40)),

  gem: svg(
    lg('gem-d', ['#7fd0ff', '#2e86f0']),
    diamond('gem', 32, 8, 50, 50) +
    glint(26, 14, 1.4, 3, 30) + spark(40, 17, 3.5)),

  potion: svg(
    lg('potion-r', ['#ff8270', '#f0283a', '#a8102a']) + lg('potion-k', WOOD),
    `<path d="M27 12H37V24C46 27 51 34 51 41C51 51 42 58 32 58C22 58 13 51 13 41C13 34 18 27 27 24Z" fill="#e8f8ff" fill-opacity=".85" ${S()}/>` +
    `<path d="M14.6 35C20 32 26 38 32 35C38 32 44 38 49.4 35C51 47 43 55.6 32 55.6C21 55.6 13 47 14.6 35Z" fill="url(#potion-r)"/>` +
    `<path d="M27 12H37V24C46 27 51 34 51 41C51 51 42 58 32 58C22 58 13 51 13 41C13 34 18 27 27 24Z" fill="none" ${S()}/>` +
    `<rect x="24.5" y="5" width="15" height="9" rx="2.5" fill="url(#potion-k)" ${S()}/>` +
    `<circle cx="39" cy="45" r="2.4" fill="#ffd6cc" opacity=".9"/><circle cx="34" cy="50" r="1.5" fill="#ffd6cc" opacity=".9"/>` +
    `<path d="M18 35C19 31 22 29 25 28" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round"/>`),

  paw: svg(
    lg('paw-a', ['#ffb8dc', '#ff7ab8']),
    `<g transform="translate(32 33) scale(.88) translate(-32 -33)">${pawShapes('url(#paw-a)', 3.4)}</g>` +
    glint(27, 40, 3, 1.6, -20)),

  new: svg(
    rg('new-a', GOLD, 0.45, 0.4, 0.7),
    `<path d="${starD(32, 32, 29, 21, 12)}" fill="url(#new-a)" ${S()}/>` +
    `<path d="M32 13Q34.6 29.4 51 32Q34.6 34.6 32 51Q29.4 34.6 13 32Q29.4 29.4 32 13Z" fill="#fff" stroke="#e08a12" stroke-width="2" stroke-linejoin="round"/>` +
    `<circle cx="32" cy="32" r="3" fill="#fff7b8"/>`),
};
