// Extra HUD / activity / menu icons and crafting materials (SVG, 64x64), drawn to match items.js.
// Helpers are local x-prefixed copies of the items.js / ui.js ones. Every gradient id is
// "x-<key>-<part>" (see X below), so ids never collide with other icons on the same page.
const xC = '#24160f';
const xINK = `stroke="${xC}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const xINK2 = `stroke="${xC}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const xf = (n) => +n.toFixed(1);
const xstops = (c) => c.map((s, i) => {
  const [col, op] = s.split('/');
  return `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${col}"${op ? ` stop-opacity="${op}"` : ''}/>`;
}).join('');
const xlg = (id, c, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${xstops(c)}</linearGradient>`;
const xrg = (id, c, cx = '40%', cy = '35%', r = '65%') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${xstops(c)}</radialGradient>`;
const xsvg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>${body}</svg>`;
const xspark = (x, y, s = 4, fill = '#fff') => `<path d="M${x} ${xf(y - s)}Q${xf(x + s * 0.2)} ${xf(y - s * 0.2)} ${xf(x + s)} ${y}Q${xf(x + s * 0.2)} ${xf(y + s * 0.2)} ${x} ${xf(y + s)}Q${xf(x - s * 0.2)} ${xf(y + s * 0.2)} ${xf(x - s)} ${y}Q${xf(x - s * 0.2)} ${xf(y - s * 0.2)} ${x} ${xf(y - s)}Z" fill="${fill}"/>`;
const xaura = (id, c, cx = 32, cy = 32, r = 31) => ({ def: `<radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${c}" stop-opacity=".85"/><stop offset=".55" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`, el: `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>` });
// outlined stroke (ink underlay + colored line)
const xln = (d, col, w = 4, iw = w + 4.5) => `<path d="${d}" fill="none" stroke="${xC}" stroke-width="${iw}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const xglint = (x, y, rx, ry, rot = -30, op = 0.9) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity="${op}"/>`;
const xmirror = (m) => m + `<g transform="matrix(-1 0 0 1 64 0)">${m}</g>`;
const xstarD = (cx, cy, R, r, n = 5) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / n, rad = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + xf(cx + Math.cos(a) * rad) + ' ' + xf(cy + Math.sin(a) * rad);
  }
  return d + 'Z';
};
// scalloped (fluffy / wax-blob) outline around an ellipse
const xfluff = (cx, cy, rx, ry, n, k = 1.18, rot = 0) => {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = rot + i * 2 * Math.PI / n, m = a - Math.PI / n, x = xf(cx + Math.cos(a) * rx), y = xf(cy + Math.sin(a) * ry);
    d += i ? `Q${xf(cx + Math.cos(m) * rx * k)} ${xf(cy + Math.sin(m) * ry * k)} ${x} ${y}` : `M${x} ${y}`;
  }
  return d + 'Z';
};
const xgearD = (cx, cy, R, r, n, hole) => {
  const st = Math.PI * 2 / n, p = (a, rad) => `${xf(cx + Math.cos(a) * rad)} ${xf(cy + Math.sin(a) * rad)}`;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = i * st - Math.PI / 2;
    d += (i ? 'L' : 'M') + p(a - st * 0.25, r) + 'L' + p(a - st * 0.16, R) + 'L' + p(a + st * 0.16, R) + 'L' + p(a + st * 0.25, r) + `A${r} ${r} 0 0 1 ` + p(a + st * 0.75, r);
  }
  return d + `ZM${cx - hole} ${cy}a${hole} ${hole} 0 1 0 ${2 * hole} 0a${hole} ${hole} 0 1 0 ${-2 * hole} 0Z`;
};
// flame: base-centered at (cx, by), height h, half-width w
const xflameD = (cx, by, h, w) => {
  const X = (x) => xf(cx + x * w), Y = (y) => xf(by - y * h);
  return `M${X(0)} ${Y(1)}C${X(0.35)} ${Y(0.72)} ${X(1)} ${Y(0.55)} ${X(1)} ${Y(0.28)}C${X(1)} ${Y(0.1)} ${X(0.55)} ${Y(0)} ${X(0)} ${Y(0)}C${X(-0.55)} ${Y(0)} ${X(-1)} ${Y(0.1)} ${X(-1)} ${Y(0.3)}C${X(-1)} ${Y(0.5)} ${X(-0.7)} ${Y(0.62)} ${X(-0.55)} ${Y(0.78)}C${X(-0.4)} ${Y(0.66)} ${X(-0.25)} ${Y(0.6)} ${X(-0.15)} ${Y(0.56)}C${X(-0.25)} ${Y(0.75)} ${X(-0.1)} ${Y(0.9)} ${X(0)} ${Y(1)}Z`;
};
// clockwise arc arrow around (cx, cy) from angle a0 to a1 (degrees), head at a1
const xarc = (r, a0, a1, col, hi, head = 6.5, cx = 32, cy = 32) => {
  const R = Math.PI / 180, P = (a, rr = r) => `${xf(cx + Math.cos(a * R) * rr)} ${xf(cy + Math.sin(a * R) * rr)}`;
  const t = a1 * R, ex = cx + Math.cos(t) * r, ey = cy + Math.sin(t) * r, tx = -Math.sin(t), ty = Math.cos(t), nx = Math.cos(t), ny = Math.sin(t);
  return xln(`M${P(a0)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${P(a1)}`, col, 4.5) +
    `<path d="M${P(a0 + 6, r - 1)}A${r - 1} ${r - 1} 0 0 1 ${P(a1 - 10, r - 1)}" fill="none" stroke="${hi}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<path d="M${xf(ex + tx * head * 1.3)} ${xf(ey + ty * head * 1.3)}L${xf(ex + nx * head)} ${xf(ey + ny * head)}L${xf(ex - nx * head)} ${xf(ey - ny * head)}Z" fill="${col}" ${xINK2}/>`;
};
// straight arrow outline (shaft + triangular head) from (x0, y0) to the tip (x1, y1)
const xarwD = (x0, y0, x1, y1, h = 5.5, sw = 1.5) => {
  const L = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / L, dy = (y1 - y0) / L, bx = x1 - dx * h, by = y1 - dy * h, k = h * 0.85;
  const pt = (x, y) => `${xf(x)} ${xf(y)}`;
  return `M${pt(x0 - dy * sw, y0 + dx * sw)}L${pt(bx - dy * sw, by + dx * sw)}L${pt(bx - dy * k, by + dx * k)}L${pt(x1, y1)}L${pt(bx + dy * k, by - dx * k)}L${pt(bx + dy * sw, by - dx * sw)}L${pt(x0 + dy * sw, y0 - dx * sw)}Z`;
};
// small faceted gem (inventory sprinkles), colors [light, mid, dark]
const xmini = (cx, cy, s, [lt, md, dk]) => {
  const p = (x, y) => `${xf(cx + x * s)} ${xf(cy + y * s)}`, top = `M${p(-1, -0.25)}L${p(-0.55, -0.85)}L${p(0.55, -0.85)}L${p(1, -0.25)}`;
  return `<path d="${top}L${p(0, 1)}Z" fill="${md}"/><path d="${top}Z" fill="${lt}"/><path d="M${p(0.25, -0.25)}L${p(1, -0.25)}L${p(0, 1)}Z" fill="${dk}"/>` +
    `<path d="M${p(-1, -0.25)}L${p(1, -0.25)}" stroke="${xC}" stroke-width="1.3"/><path d="${top}L${p(0, 1)}Z" fill="none" ${xINK2}/>` +
    `<circle cx="${xf(cx - 0.4 * s)}" cy="${xf(cy - 0.52 * s)}" r="${xf(s * 0.15)}" fill="#fff"/>`;
};
// brilliant-cut gem (ui.js diamond geometry), remapped to (cx, top, w, h); C = 5 face colors, mid = center pavilion fill
const xbrill = (cx, top, w, h, C, mid) => {
  const P = (pts) => pts.map(([x, y], i) => (i ? 'L' : 'M') + xf(cx + (x - 32) * w / 44) + ' ' + xf(top + (y - 10) * h / 46)).join('') + 'Z';
  const face = (pts, col) => `<path d="${P(pts)}" fill="${col}"/>`;
  return face([[10, 24], [20, 10], [26, 10], [22, 24]], C[0]) + face([[22, 24], [26, 10], [38, 10], [42, 24]], C[1]) +
    face([[42, 24], [38, 10], [44, 10], [54, 24]], C[2]) + face([[10, 24], [22, 24], [32, 56]], C[3]) +
    face([[22, 24], [42, 24], [32, 56]], mid) + face([[42, 24], [54, 24], [32, 56]], C[4]) +
    `<path d="${P([[10, 24], [54, 24]]).slice(0, -1)}" stroke="${xC}" stroke-width="2"/>` +
    `<path d="${P([[10, 24], [20, 10], [44, 10], [54, 24], [32, 56]])}" fill="none" ${xINK}/>`;
};
// per-icon id scope: id('a') -> "x-<key>-a", u('a') -> "url(#x-<key>-a)"
const X = (key, build) => build((s) => `x-${key}-${s}`, (s) => `url(#x-${key}-${s})`);

// palettes (light -> mid -> dark)
const GOLD = ['#fff7b8', '#ffcc33', '#d9800f'];
const SILVER = ['#ffffff', '#cfdcef', '#7d8fb3'];
const BLUE = ['#c8f4ff', '#4cb4ff', '#2251d1'];
const RED = ['#ffb9a8', '#ff4b3e', '#b3172f'];
const GREEN = ['#d8ffb0', '#5ad04a', '#1f8a3a'];
const PURPLE = ['#ecc8ff', '#a362f2', '#5527b3'];
const PINK = ['#ffe3f1', '#ff8cc6', '#d9418e'];
const PARCH = ['#fffbe6', '#f6dc9a', '#d19c55'];
const WOOD = ['#eaa868', '#b0642c', '#6e3414'];
const IRON = ['#c8d0e0', '#6a7690', '#2e3548'];
const ORANGE = ['#ffd890', '#ff9a2a', '#d0560a'];
// stylised right wing (guild emblem); mirrored for a pair
const WING = 'M33 40C33 32 37 25 46 21C44.5 24 42.5 26 40.5 27C43 27 44.5 27.5 45.5 28.5C43 31 40.5 32 38 32.5C40 33 41.5 34 42 35.5C39 38 36 39.5 33 40Z';
const GEMS = { r: ['#ffc8d0', '#ff4a5e', '#a80c26'], b: ['#c8ecff', '#3a8aff', '#1a3aa8'], g: ['#d0ffd8', '#3ac860', '#137a34'], y: ['#fff6b0', '#ffc21a', '#c86a08'] };

// ---------------------------------------------------------------- HUD / activities / menus
const missions = X('missions', (id, u) => xsvg(
  xlg(id('p'), PARCH) + xlg(id('r'), ['#fff2c8', '#e6bd72', '#b07a3a']) + xlg(id('b'), RED),
  `<path d="M13 12H48V54C48 56.5 46 58 44 58H17C15 58 13 56.5 13 54Z" fill="${u('p')}" ${xINK}/>
<path d="M41.5 12H49.5V42L45.5 38L41.5 42Z" fill="${u('b')}" ${xINK2}/><path d="M44 17V34" stroke="#ffd6cc" stroke-width="1.6" stroke-linecap="round"/>
<rect x="8" y="6" width="46" height="10" rx="5" fill="${u('r')}" ${xINK}/>${xglint(15, 9.5, 3, 1.4, 0)}
<rect x="18" y="21" width="10" height="10" rx="2.5" fill="#fffbe6" ${xINK2}/><rect x="18" y="36" width="10" height="10" rx="2.5" fill="#fffbe6" ${xINK2}/>
<path d="M32 26H38M32 41H38M18 52H34" stroke="#c99a5c" stroke-width="3" stroke-linecap="round"/>
${xln('M19.5 25.5L23 29.5L31 18', '#4ad860', 3.2, 7)}${xln('M19.5 40.5L23 44.5L31 33', '#4ad860', 3.2, 7)}`));

const guild = X('guild', (id, u) => {
  const R = Math.PI / 180, P = (a, r) => [xf(32 + Math.cos(a * R) * r), xf(34 + Math.sin(a * R) * r)];
  let leaves = '';
  for (let i = 0; i < 5; i++) {
    const a = 112 + i * 25, [x, y] = P(a, 25), o = a + 40, ox = xf(x + Math.cos(o * R) * 4.5), oy = xf(y + Math.sin(o * R) * 4.5);
    leaves += `<ellipse cx="${ox}" cy="${oy}" rx="5" ry="2.4" transform="rotate(${o} ${ox} ${oy})"/>`;
  }
  const laurel = xln(`M${P(100, 25).join(' ')}A25 25 0 0 1 ${P(218, 25).join(' ')}`, '#e0a020', 2.2, 5.6) + `<g fill="${u('l')}" ${xINK2}>${leaves}</g>`;
  return xsvg(
    xlg(id('s'), BLUE) + xlg(id('l'), GOLD) + xlg(id('g'), GOLD, 1, 1),
    `${xmirror(laurel)}
<path d="M32 6L50 11.5V30C50 42 43 51 32 57C21 51 14 42 14 30V11.5Z" fill="${u('s')}" ${xINK}/>
<path d="M32 11L46 15V30C46 40 40 47.5 32 52C24 47.5 18 40 18 30V15Z" fill="none" stroke="#ffcc33" stroke-width="2.2"/>
${xmirror(`<path d="${WING}" fill="${u('g')}" ${xINK2}/>`)}<circle cx="32" cy="38" r="3.4" fill="#ff5a6a" ${xINK2}/>
<path d="M19 17C21 15 24 13.5 27 12.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>`);
});

const war = X('war', (id, u) => {
  const a = xaura(id('au'), '#c89aff');
  const sw = (r) => `<g transform="rotate(${r} 32 41)"><path d="M32 4L35.5 9V40H28.5V9Z" fill="${u('sw')}" ${xINK}/>
<rect x="22" y="39" width="20" height="5" rx="2.5" fill="${u('g')}" ${xINK2}/><rect x="29.5" y="44" width="5" height="9" rx="1.5" fill="#6a3a1a" ${xINK2}/>
<circle cx="32" cy="55.5" r="3" fill="${u('g')}" ${xINK2}/><path d="M30.4 11V36" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></g>`;
  return xsvg(
    a.def + xlg(id('b'), ['#e0f8ff', '#4cb4ff', '#1a3ab8']) + xlg(id('r'), ['#ffd8d0', '#ff4b3e', '#9a0c24']) + xlg(id('sw'), ['#ffffff', '#d8e4f4', '#8a9ab8'], 1, 0) + xlg(id('g'), GOLD),
    `${a.el}<path d="M32 3L21 15V34L32 47Z" fill="${u('b')}"/><path d="M32 3L43 15V34L32 47Z" fill="${u('r')}"/>
<path d="M21 15L32 21L43 15M32 21V47" fill="none" stroke="${xC}" stroke-width="1.6" opacity=".55"/>
<path d="M32 3L43 15V34L32 47L21 34V15Z" fill="none" ${xINK}/><path d="M24.5 17V30" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>
${sw(-38)}${sw(38)}${xspark(55, 36, 3.5)}${xspark(9, 30, 3, '#d8c8ff')}`);
});

const worldboss = X('worldboss', (id, u) => {
  const a = xaura(id('au'), '#a040ff');
  return xsvg(
    a.def + xlg(id('h'), ['#fff6e0', '#e8d0a0', '#a8804a']) + xlg(id('s'), ['#7a6a9a', '#3e2e5e', '#1c1230']) + xrg(id('e'), ['#ffd0ff/.95', '#c050ff/.45', '#a040ff/0'], '50%', '50%', '50%'),
    `${a.el}${xmirror(`<path d="M22 21C13 18 8 11 9.5 2.5C13 8.5 18 10.5 26 11.5Z" fill="${u('h')}" ${xINK}/>`)}
<path d="M32 12C44 12 51 20 51 31C51 39 47 43 45 47L41 58H23L19 47C17 43 13 39 13 31C13 20 20 12 32 12Z" fill="${u('s')}" ${xINK}/>
${xmirror(`<circle cx="24" cy="33.5" r="7.5" fill="${u('e')}"/><path d="M18 29.5L29 33L27 38C23 38 19 35 18 29.5Z" fill="#f4c8ff" stroke="${xC}" stroke-width="1.8" stroke-linejoin="round"/>`)}
<path d="M29.5 42.5L30.5 44.5M34.5 42.5L33.5 44.5" stroke="#0e0818" stroke-width="2" stroke-linecap="round"/>
<path d="M24 50H40" stroke="${xC}" stroke-width="2.2" stroke-linecap="round"/><path d="M26 50L28 55L30 50ZM34 50L36 55L38 50Z" fill="#fff6e0" stroke="${xC}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M19 24C21 19 25 16 29 15" fill="none" stroke="#a898c8" stroke-width="2.4" stroke-linecap="round"/>
<path d="M53 26L58.5 33H55L59.5 42L50 34H53.5Z" fill="#fff27a" ${xINK2}/><path d="M10 38L4.5 44.5H8L3.5 53L13 45.5H9.5Z" fill="#fff27a" ${xINK2}/>`);
});

const market = X('market', (id, u) => {
  let aw = '';
  for (let i = 0; i < 5; i++) aw += `<path d="M${12 + 8 * i} 8L${7 + 10 * i} 22A5 5 0 0 0 ${17 + 10 * i} 22L${20 + 8 * i} 8Z" fill="${i % 2 ? '#fff6ea' : u('a')}"/>`;
  const cn = (y) => `<ellipse cx="44" cy="${y + 2.2}" rx="7" ry="2.8" fill="#b07a10"/><ellipse cx="44" cy="${y}" rx="7" ry="2.8"/>`;
  return xsvg(
    xlg(id('a'), RED) + xlg(id('w'), WOOD) + xlg(id('s'), ['#f8dcae', '#d8a868', '#a0703a']) + xlg(id('c'), GOLD),
    `<rect x="12" y="18" width="40" height="24" fill="#5a2c10" ${xINK2}/>
<rect x="9" y="18" width="5" height="26" fill="${u('w')}" ${xINK2}/><rect x="50" y="18" width="5" height="26" fill="${u('w')}" ${xINK2}/>
<path d="M15 42C13 36 15 31 19 29L17.5 26H27.5L26 29C30 31 32 36 30 42Z" fill="${u('s')}" ${xINK2}/><path d="M18.5 29H26.5" stroke="#8a5a2a" stroke-width="2"/>
<g fill="${u('c')}" ${xINK2}>${cn(38)}${cn(33.5)}${cn(29)}</g><path d="M41 28.5H44" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
<rect x="6" y="40" width="52" height="18" rx="2.5" fill="${u('w')}" ${xINK}/><path d="M7.5 46.5H56.5" stroke="#6e3414" stroke-width="2"/><path d="M10 43.5H30" stroke="#ffd8a8" stroke-width="1.8" stroke-linecap="round"/>
${aw}<path d="M12 8H52L57 22A5 5 0 0 1 47 22A5 5 0 0 1 37 22A5 5 0 0 1 27 22A5 5 0 0 1 17 22A5 5 0 0 1 7 22Z" fill="none" ${xINK}/>
<path d="M14.5 11L12 17" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".85"/>`);
});

const trade = X('trade', (id, u) => xsvg(
  xrg(id('c'), GOLD, '40%', '35%', '75%'),
  `${xarc(21, 200, 330, '#ffc21a', '#fff7b8')}${xarc(21, 20, 150, '#2ac8b0', '#c8fff0')}
<circle cx="32" cy="34" r="11" fill="#b8650a" ${xINK}/><circle cx="32" cy="32" r="11" fill="${u('c')}" ${xINK}/>
<circle cx="32" cy="32" r="7" fill="none" stroke="#d9800f" stroke-width="2"/>
<path d="M32 27L35 32L32 37L29 32Z" fill="#fff2a0" stroke="#c06a08" stroke-width="1.6" stroke-linejoin="round"/>${xglint(26, 26, 1.4, 3, 40)}`));

const forge = X('forge', (id, u) => xsvg(
  xlg(id('i'), IRON) + xlg(id('h'), SILVER) + xlg(id('w'), WOOD, 1, 0),
  `<path d="M4 23C11 24.5 15 26 19 26H55V35H47C43 36 41 39 41 44V47H47L50 57H14L17 47H23V44C23 39 21 37 17 36C11 35 6 31 4 23Z" fill="${u('i')}" ${xINK}/>
<path d="M19 29.5H52" stroke="#e8eef8" stroke-width="2.2" stroke-linecap="round" opacity=".85"/><path d="M20 35H54" stroke="${xC}" stroke-width="1.6" opacity=".45"/>
<g transform="rotate(35 46 13)"><rect x="43.5" y="17" width="5" height="22" rx="2" fill="${u('w')}" ${xINK2}/>
<rect x="36" y="7" width="20" height="11" rx="2.5" fill="${u('h')}" ${xINK}/><path d="M39 10.5H53" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></g>
${xspark(21, 15, 5.5, '#ffb020')}${xspark(11, 10, 3.5, '#ffd84a')}${xspark(31, 9, 3.5, '#ff7a1a')}
<circle cx="14" cy="18" r="1.6" fill="#ffcc33"/><circle cx="28" cy="18" r="1.4" fill="#ff9a2a"/><circle cx="23" cy="6" r="1.3" fill="#ffd84a"/>`));

const season = X('season', (id, u) => xsvg(
  xlg(id('m'), GOLD) + xlg(id('w'), ['#ffffff', '#fff2c0', '#f0b830']) + xlg(id('r'), RED) + xlg(id('s'), ['#ffffff', '#fff7b8', '#ffd84a']),
  `<path d="M24 40L17 59L23.5 55.5L28 61L33 44Z" fill="${u('r')}" ${xINK2}/><path d="M40 40L47 59L40.5 55.5L36 61L31 44Z" fill="${u('r')}" ${xINK2}/>
${xmirror(`<path d="M18 22C11 17 4 18 1.5 23C5 24 6 25 7 27C3 28 2 31 2 34C6 33 8 33 10 34C8 36 8 39 9 41C13 38 16 37 19 36Z" fill="${u('w')}" ${xINK2}/>`)}
<circle cx="32" cy="29" r="17" fill="${u('m')}" ${xINK}/><circle cx="32" cy="29" r="12.8" fill="none" stroke="#d9800f" stroke-width="2"/>
<path d="${xstarD(32, 30.5, 11.5, 5)}" fill="${u('s')}" stroke="#b86a08" stroke-width="2" stroke-linejoin="round"/>
${xglint(22, 19, 1.8, 4, 40)}${xspark(55, 8, 4)}${xspark(9, 52, 3)}`));

const event = X('event', (id, u) => {
  const a = xaura(id('au'), '#ffa030');
  return xsvg(
    a.def + xlg(id('p'), ['#ffcf80', '#ff8a1a', '#c24a08']) + xlg(id('f'), ['#fffbd0', '#ffd84a', '#ff9a1a']) + xlg(id('l'), GREEN),
    `${a.el}<path d="M30.5 23C30.5 17 31.5 13 34.5 10L38.5 12.5C36.5 15 35.5 18.5 35.5 23Z" fill="#7a8a2a" ${xINK2}/>
<ellipse cx="20" cy="40" rx="13" ry="16" fill="${u('p')}" ${xINK}/><ellipse cx="44" cy="40" rx="13" ry="16" fill="${u('p')}" ${xINK}/><ellipse cx="32" cy="40" rx="12" ry="17.5" fill="${u('p')}" ${xINK}/>
<path d="M37 16C41 9 49 9 53 12C49 17.5 43 19 37 16Z" fill="${u('l')}" ${xINK2}/><path d="M39 15.5C43 14 46 13 50 12.5" stroke="#1f6a2a" stroke-width="1.2" fill="none"/>
${xln('M30.5 20C26.5 16.5 22.5 17.5 22.5 21C22.5 23.5 25.5 24 26.5 22', '#5ab040', 1.8, 4.6)}
${xmirror(`<path d="M18 33L24.5 27L27.5 36Z" fill="${u('f')}" ${xINK2}/>`)}<path d="M30 38.5L32 35.5L34 38.5Z" fill="${u('f')}" ${xINK2}/>
<path d="M16 42L21 45L23.5 42.5L27.5 46L32 43L36.5 46L40.5 42.5L43 45L48 42C44 52 20 52 16 42Z" fill="${u('f')}" ${xINK2}/>
<path d="M11 36C11 31 13 28 16 26" fill="none" stroke="#ffe8c0" stroke-width="2.4" stroke-linecap="round"/>`);
});

const codex = X('codex', (id, u) => xsvg(
  xlg(id('c'), ['#7ad8f0', '#2a7ab8', '#163a78'], 1, 1) + xlg(id('p'), PARCH) + xlg(id('g'), GOLD) + xrg(id('j'), ['#ffffff', '#fff27a', '#f0a010']),
  `<rect x="17" y="9" width="36" height="49" rx="3" fill="${u('p')}" ${xINK}/><path d="M50.5 13V54M17 55H49" stroke="#c99a5c" stroke-width="1.4"/>
<rect x="11" y="5" width="38" height="49" rx="4" fill="${u('c')}" ${xINK}/><path d="M17 6.5V52.5" stroke="#0e2450" stroke-width="2.4"/>
<rect x="21" y="10" width="23" height="39" rx="2" fill="none" stroke="#ffcc33" stroke-width="1.8"/>
<path d="M38 5H45C47 5 49 7 49 9V16ZM38 54H45C47 54 49 52 49 50V43Z" fill="${u('g')}" ${xINK2}/>
<path d="M32.5 18L42 29.5L32.5 41L23 29.5Z" fill="${u('g')}" ${xINK2}/><path d="M32.5 23L37.2 29.5L32.5 36L27.8 29.5Z" fill="${u('j')}" ${xINK2}/>
<circle cx="32.5" cy="13.5" r="1.6" fill="#ffcc33"/><circle cx="32.5" cy="45.5" r="1.6" fill="#ffcc33"/>
<path d="M40 54V62L42.5 59.5L45 62V54Z" fill="#d02a3a" ${xINK2}/><path d="M13.8 10V22" stroke="#bff0ff" stroke-width="2" stroke-linecap="round"/>${xspark(31, 27, 1.8)}`));

const trophy = X('trophy', (id, u) => xsvg(
  xlg(id('g'), GOLD) + xlg(id('h'), ['#fffbe0', '#ffe07a', '#f0b020']) + xlg(id('w'), WOOD),
  `${xmirror(xln('M16 15H10C7.5 15 6 17 6 19.5C6 27 11 32 19 33', '#f0b020', 3.8))}
<path d="M15 9H49V22C49 33 41.5 41 32 41C22.5 41 15 33 15 22Z" fill="${u('g')}" ${xINK}/><rect x="12" y="6" width="40" height="6.5" rx="3.2" fill="${u('h')}" ${xINK}/>
<path d="M28 40.5H36L35 47H29Z" fill="${u('g')}" ${xINK2}/><rect x="21" y="46" width="22" height="5.5" rx="2" fill="${u('g')}" ${xINK2}/>
<rect x="16" y="51" width="32" height="8" rx="2.5" fill="${u('w')}" ${xINK}/><rect x="26" y="53" width="12" height="4" rx="1" fill="#ffcc33"/>
<path d="${xstarD(32, 24, 7.5, 3.3)}" fill="#fff7b8" stroke="#c06a08" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M20 15C20 23 22 29 26 33" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>${xspark(55, 44, 4)}${xspark(9, 46, 3)}`));

const crystal = X('crystal', (id, u) => {
  const a = xaura(id('au'), '#5ae8ff', 32, 30, 30);
  return xsvg(
    a.def + xlg(id('l'), ['#f0ffff', '#7ae8ff', '#2aa0e0']) + xlg(id('r'), ['#9ae8ff', '#2a8ae8', '#1a3ab8']) + xlg(id('s'), ['#d8d4e0', '#9a94a8', '#5a5468']),
    `${a.el}<path d="M20 30L14.5 36L16.5 49H24Z" fill="${u('r')}" ${xINK2}/><path d="M44 32L49.5 38L47.5 49H40Z" fill="${u('l')}" ${xINK2}/>
<path d="M32 3L22 15L24 49H32Z" fill="${u('l')}"/><path d="M32 3L42 15L40 49H32Z" fill="${u('r')}"/>
<path d="M22 15L32 21L42 15M32 21V49" fill="none" stroke="${xC}" stroke-width="1.6" opacity=".55"/><path d="M32 3L42 15L40 49H24L22 15Z" fill="none" ${xINK}/>
<path d="M26 18L27 40" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
<path d="M14 48H50L54 55C55 57 53 59 51 59H13C11 59 9 57 10 55Z" fill="${u('s')}" ${xINK}/>
<path d="M24 52.5L27 55.5M40 51.5L37 55.5" stroke="#4a4458" stroke-width="1.6" stroke-linecap="round"/><path d="M16 51H30" stroke="#f0eef8" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>
${xspark(51, 15, 4.5)}${xspark(13, 21, 3, '#bff8ff')}`);
});

const contrib = X('contrib', (id, u) => xsvg(
  xrg(id('c'), ['#ffffff', '#bcd8ff', '#5a7ac8'], '40%', '35%', '75%') + xlg(id('w'), GOLD, 1, 1),
  `<circle cx="32" cy="35" r="25" fill="#33508e" ${xINK}/><circle cx="32" cy="31" r="25" fill="${u('c')}" ${xINK}/>
<circle cx="32" cy="31" r="18.5" fill="none" stroke="#5a7ac8" stroke-width="2.6"/>
<g transform="translate(0 -6)">${xmirror(`<path d="${WING}" fill="${u('w')}" ${xINK2}/>`)}<circle cx="32" cy="38" r="3.4" fill="#4cb4ff" ${xINK2}/></g>
${xglint(16, 19, 2, 5, 40)}`));

const reforge = X('reforge', (id, u) => {
  const a = xaura(id('au'), '#c070ff');
  return xsvg(
    a.def,
    `${a.el}${xarc(20, 195, 330, '#b47aff', '#f0d8ff')}${xarc(20, 15, 150, '#8a46f0', '#d8b8ff')}
<path d="M32 18Q33.6 30.4 46 32Q33.6 33.6 32 46Q30.4 33.6 18 32Q30.4 30.4 32 18Z" fill="#f6e6ff" ${xINK2}/><circle cx="32" cy="32" r="2.6" fill="#fff"/>
${xspark(54, 54, 3.5)}${xspark(10, 10, 3, '#f0d8ff')}`);
});

const ascend = X('ascend', (id, u) => {
  const a = xaura(id('au'), '#ffc030');
  return xsvg(
    a.def + xlg(id('a'), ['#fff7b8', '#ffb020', '#e0600a']) + xlg(id('s'), ['#ffffff', '#fff7b8']),
    `${a.el}<path d="M32 4L55 29H43V58H21V29H9Z" fill="${u('a')}" ${xINK}/><path d="M32 4L55 29H43V58H32Z" fill="#c84a00" opacity=".16"/>
<path d="M16 26L29.5 11.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"/><path d="M25 34V52" stroke="#fff6c0" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>
<path d="${xstarD(32, 41.5, 9.5, 4.2)}" fill="${u('s')}" stroke="#c86a08" stroke-width="2" stroke-linejoin="round"/>
${xspark(53, 46, 4)}${xspark(11, 44, 3)}`);
});

const salvage = X('salvage', (id, u) => xsvg(
  xlg(id('g'), SILVER, 1, 1) + xlg(id('h'), IRON) + xlg(id('w'), WOOD, 1, 0),
  `<path d="${xgearD(27, 37, 21, 16.5, 8, 6)}" fill="${u('g')}" fill-rule="evenodd" ${xINK}/>
<path d="M22.5 16.5L28 23.5L23.5 28.5L28.5 32M31 42L35.5 46.5L32.5 51L37 56" fill="none" stroke="${xC}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7 13L14 10L12.5 17.5Z" fill="${u('g')}" ${xINK2}/><path d="M17 8L20 6.5L19.5 10Z" fill="#cfdcef" stroke="${xC}" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M14 30C14.5 26 16.5 22.5 19.5 20.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
<g transform="rotate(45 46 18)"><rect x="43.5" y="-1" width="5" height="16" rx="2" fill="${u('w')}" ${xINK2}/><rect x="37" y="13" width="18" height="9" rx="2" fill="${u('h')}" ${xINK}/>
<path d="M40 15.5H52" stroke="#e8eef8" stroke-width="1.6" stroke-linecap="round"/></g>${xspark(37, 27, 3.5, '#ffd84a')}`));

const socket = X('socket', (id, u) => {
  let dots = '', prongs = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 + 22.5) * Math.PI / 180;
    dots += `<circle cx="${xf(32 + Math.cos(a) * 21.5)}" cy="${xf(32 + Math.sin(a) * 21.5)}" r="1.7" fill="#fff7b8" stroke="#b8650a" stroke-width="1.1"/>`;
  }
  for (let i = 0; i < 4; i++) {
    const d = i * 90 + 45, a = d * Math.PI / 180, x = xf(32 + Math.cos(a) * 15.5), y = xf(32 + Math.sin(a) * 15.5);
    prongs += `<ellipse cx="${x}" cy="${y}" rx="4" ry="2.5" transform="rotate(${d} ${x} ${y})" fill="${u('g')}" ${xINK2}/>`;
  }
  return xsvg(
    xlg(id('g'), GOLD, 1, 1) + xrg(id('h'), ['#4a3a6a', '#241a38', '#100a1c'], '62%', '66%', '70%'),
    `<circle cx="32" cy="32" r="26" fill="${u('g')}" ${xINK}/>${dots}<circle cx="32" cy="32" r="16" fill="${u('h')}" ${xINK}/>
<path d="M21 27A12 12 0 0 1 37 20.5" fill="none" stroke="#000" stroke-width="2.4" stroke-linecap="round" opacity=".35"/>
<path d="M44 34A12.5 12.5 0 0 1 34.5 44.2" fill="none" stroke="#a898d8" stroke-width="2" stroke-linecap="round" opacity=".75"/>${prongs}
${xglint(15, 19, 1.8, 4.5, 40)}`);
});

const combine = X('combine', (id, u) => xsvg(
  xlg(id('m'), ['#ffffff', '#ffb8f0', '#a050ff']),
  `${xmini(11, 12, 7, GEMS.r)}${xmini(32, 9, 7, GEMS.g)}${xmini(53, 12, 7, GEMS.b)}
<path d="${xarwD(15, 21, 23, 31)}${xarwD(32, 18.5, 32, 31)}${xarwD(49, 21, 41, 31)}" fill="#ffe07a" ${xINK2}/>
${xbrill(32, 33, 34, 26, ['#ffd8f8', '#fff4fe', '#e890ff', '#d070ff', '#7a2ad0'], u('m'))}${xglint(26, 37, 1.3, 2.6, 30)}${xspark(55, 44, 4)}${xspark(9, 46, 3)}`));

const levelup = X('levelup', (id, u) => xsvg(
  xlg(id('b'), ['#ffffff', '#d8e4f4', '#8a9ab8'], 1, 0) + xlg(id('g'), GOLD) + xlg(id('a'), GREEN),
  `<g transform="translate(-6 -2) rotate(45 32 32)"><path d="M32 2L37 9V41H27V9Z" fill="${u('b')}" ${xINK}/><path d="M32 6V38" stroke="#9aaac8" stroke-width="1.6"/>
<rect x="19" y="40" width="26" height="6" rx="2.5" fill="${u('g')}" ${xINK}/><rect x="29" y="46" width="6" height="11" rx="1.5" fill="#6a3a1a" ${xINK}/>
<circle cx="32" cy="59.5" r="3.6" fill="${u('g')}" ${xINK2}/><path d="M29.5 12V34" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9"/></g>
<path d="M47 25L61 41H53.5V59H40.5V41H33Z" fill="${u('a')}" ${xINK}/><path d="M38.5 39.5L46.5 30.5M44 44V54" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>`));

const lock_open = X('lock_open', (id, u) => xsvg(
  xlg(id('a'), GOLD, 1, 1) + xlg(id('s'), SILVER, 1, 0),
  `${xln('M44 31V17C44 9.5 39 4.5 32 4.5C25 4.5 20 9.5 20 17V21', u('s'), 5.5)}
<rect x="11" y="29" width="42" height="29" rx="7" fill="${u('a')}" ${xINK}/>
<path d="M32 36A4.5 4.5 0 0 1 34.6 44.2L36 51H28L29.4 44.2A4.5 4.5 0 0 1 32 36Z" fill="#5a2c08"/>
<path d="M15 35V47" stroke="#fff7b8" stroke-width="2.5" stroke-linecap="round" opacity=".9"/>${xspark(11, 19, 4.5)}${xspark(53, 8, 3, '#fff7b8')}`));

const calendar = X('calendar', (id, u) => {
  let grid = '';
  for (const y of [29, 37, 45, 52]) for (const x of [14, 23, 34, 43]) grid += `M${x} ${y}h7v5h-7Z`;
  return xsvg(
    xlg(id('p'), ['#ffffff', '#fff6e0', '#ecd8b0']) + xlg(id('r'), RED) + xlg(id('s'), GOLD) + xlg(id('m'), SILVER, 1, 0),
    `<rect x="8" y="11" width="48" height="48" rx="6" fill="${u('p')}" ${xINK}/><path d="${grid}" fill="#ead6b0" stroke="#ead6b0" stroke-width="1.4" stroke-linejoin="round"/>
<path d="M8 17C8 13.7 10.7 11 14 11H50C53.3 11 56 13.7 56 17V25H8Z" fill="${u('r')}" ${xINK}/><path d="M13 15H24" stroke="#ffd6cc" stroke-width="2" stroke-linecap="round"/>
<path d="${xstarD(32, 42.5, 12.5, 5.5)}" fill="${u('s')}" ${xINK2}/>${xglint(28.5, 39, 1.3, 2.8, 35)}
<rect x="17.5" y="5" width="5" height="12" rx="2.5" fill="${u('m')}" ${xINK2}/><rect x="41.5" y="5" width="5" height="12" rx="2.5" fill="${u('m')}" ${xINK2}/>`);
});

const mail = X('mail', (id, u) => xsvg(
  xlg(id('e'), ['#fffdf4', '#f6e6c0', '#dcbc84']) + xlg(id('f'), ['#ffffff', '#fdf0d0']) + xrg(id('w'), ['#ff9a8a', '#e0283a', '#8a0a1a']),
  `<rect x="5" y="14" width="54" height="38" rx="4.5" fill="${u('e')}" ${xINK}/>
<path d="M7 50L26 34M57 50L38 34" stroke="${xC}" stroke-width="2.2" stroke-linecap="round"/>
<path d="M7 16.5L32 37L57 16.5" fill="${u('f')}" ${xINK}/>
<path d="${xfluff(32, 37, 8, 8, 9, 1.12)}" fill="${u('w')}" ${xINK2}/><circle cx="32" cy="37" r="4.6" fill="none" stroke="#a8102a" stroke-width="1.4"/>
<path d="${xstarD(32, 37.3, 3.4, 1.5)}" fill="#ffb0a0"/><path d="M10 21V30" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>`));

// ---------------------------------------------------------------- materials
const jelly_gel = X('jelly_gel', (id, u) => xsvg(
  xlg(id('j'), ['#a8e6ff', '#4cb4ff', '#2a64e0']) + xlg(id('g'), ['#ffffff/.6', '#d8f4ff/.15', '#a8dcff/.4'], 1, 0) + xlg(id('r'), ['#ffffff/.8', '#bfe6ff/.45']),
  `<path d="M18.5 52V38C15.5 33 16.5 25.5 21.5 22.5C21 14.5 26.5 9.5 33 10C40 10.5 44.5 15.5 44 22C48.5 24 49.5 30.5 46 37V52C46 55 44 56.5 41 56.5H23.5C20.5 56.5 18.5 55 18.5 52Z" fill="${u('j')}" fill-opacity=".92" ${xINK}/>
<ellipse cx="26.5" cy="18" rx="4.6" ry="2.5" transform="rotate(-35 26.5 18)" fill="#fff" opacity=".95"/><circle cx="34" cy="14.5" r="1.5" fill="#fff"/><ellipse cx="36" cy="28" rx="5" ry="3" fill="#d8f6ff" opacity=".35"/>
<path d="M11.5 19C9.5 22.5 9.5 26.5 11.5 30M52.5 19C54.5 22.5 54.5 26.5 52.5 30" fill="none" stroke="#9ad8ff" stroke-width="2.2" stroke-linecap="round"/>
<path d="M17 36H47V52C47 55.5 44.5 58 41 58H23C19.5 58 17 55.5 17 52Z" fill="${u('g')}" ${xINK}/><rect x="14.5" y="32" width="35" height="6" rx="3" fill="${u('r')}" ${xINK2}/>
<path d="M21 41V52" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/><circle cx="37" cy="47" r="2" fill="#e0f6ff" opacity=".8"/>${xspark(54, 9, 3.5)}${xspark(9, 44, 2.6, '#c8f4ff')}`));

const soft_fur = X('soft_fur', (id, u) => xsvg(
  xrg(id('f'), ['#ffffff', '#fff6e6', '#e8d2b0'], '40%', '30%', '75%') + xlg(id('p'), PINK),
  `<path d="M26 49C23 52 22 56 24 59C27 58.5 29 57 30 55C31 57.5 33.5 59 36.5 58.5C37.5 56 37.5 52.5 38 49Z" fill="${u('f')}" ${xINK2}/>
<path d="M25 47C17 42 12 33 13.5 24C15 17.5 18.5 13 23 10C22.5 13.5 23.5 16 25.5 17.5C25.5 11.5 29 6.5 34.5 4.5C33 8.5 33.5 12 35.5 13.5C38 9 42.5 6.5 48 6.5C45 9.5 44 13 45 16C48 15 51 15.5 53.5 17.5C49.5 19.5 48 23 48 27C48 36 44.5 43 39 47Z" fill="${u('f')}" ${xINK}/>
<path d="M24 39C21 33 20.5 26 23.5 19.5M31 41C29 33 30 25 34 17M38.5 40C40.5 33 41.5 26 44.5 20.5" fill="none" stroke="#dcc29a" stroke-width="1.8" stroke-linecap="round"/>
<path d="M18.5 30C18.5 24 20.5 19 23.5 16" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
<rect x="24" y="44.5" width="16" height="5.5" rx="2.2" fill="${u('p')}" ${xINK2}/>
${xmirror(`<path d="M31 47C26 42 19 43 19.5 47.5C20 52 26 51.5 31 47.5Z" fill="${u('p')}" ${xINK2}/>`)}<circle cx="32" cy="47.3" r="3.3" fill="${u('p')}" ${xINK2}/>
<path d="M22.5 45.5C23.5 44.8 25 44.7 26 45" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none"/>${xspark(55, 32, 3, '#ffe3f1')}`));

const glow_spore = X('glow_spore', (id, u) => {
  const a = xaura(id('au'), '#4affc8');
  const orb = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${xf(r * 1.9)}" fill="${u('au')}"/><circle cx="${x}" cy="${y}" r="${r}" fill="${u('o')}" ${xINK2}/><circle cx="${xf(x - r * 0.35)}" cy="${xf(y - r * 0.35)}" r="${xf(r * 0.3)}" fill="#fff"/>`;
  return xsvg(
    a.def + xrg(id('o'), ['#ffffff', '#a0ffe0', '#18b89a']) + xlg(id('c'), ['#c8fff0', '#3ad8b0', '#127a6a']) + xlg(id('s'), ['#fffaf0', '#e8d8b8']),
    `${orb(40, 22, 9)}${orb(51, 41, 6)}${orb(24, 14, 5)}${orb(36, 40, 4.2)}${orb(55, 12, 3)}
<path d="M17 45H24L25 56C25 57.5 24 58 22.5 58H18.5C17 58 16 57.5 16 56Z" fill="${u('s')}" ${xINK2}/>
<path d="M7 47C8 38 14 34 20.5 34C27 34 32 38 33 47C27 50 13 50 7 47Z" fill="${u('c')}" ${xINK2}/>
<circle cx="15" cy="41" r="2" fill="#f0fffa"/><circle cx="23" cy="38.5" r="1.6" fill="#f0fffa"/><circle cx="26" cy="44" r="1.4" fill="#f0fffa"/>
<path d="M11 42C12 39 14 37 16.5 36" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`);
});

const wolf_fang = X('wolf_fang', (id, u) => {
  const thorn = (x, y, r) => `<path d="M${x - 2} ${y}L${x} ${y - 4.5}L${x + 2} ${y}Z" transform="rotate(${r} ${x} ${y})"/>`;
  return xsvg(
    xlg(id('f'), ['#ffffff', '#fff2d0', '#d8bc88'], 1, 1) + xlg(id('l'), GREEN),
    `<path d="M20 11C23 4.5 41 4.5 45 10.5C48 22 46 37 38 48C35 52 31 56 26 60C28 52 28 45 26 39C23 30 18.5 22 20 11Z" fill="${u('f')}" ${xINK}/>
<path d="M41.5 37C40 41 37 45 33 48.5M25 38C27.5 43 28 49 27 55" fill="none" stroke="#c8a870" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
<path d="M42.5 36C42 40.5 40 44 37.5 46.5M39 10C41 11 42 12.5 42.5 14" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
<g fill="#2a9a3a" stroke="${xC}" stroke-width="1.4" stroke-linejoin="round">${thorn(22, 22.5, -15)}${thorn(34, 23.5, 5)}${thorn(45, 19.5, 25)}${thorn(25, 36, 190)}${thorn(37, 35, 165)}</g>
${xln('M15 21C24 26 37 25 50 18', '#4ac04a', 3)}${xln('M18 31.5C26 35.5 35 35 47 28.5', '#3aa83e', 3)}
<path d="M50 18.5C53.5 12.5 59 12 62 14C59.5 19 54.5 20.5 50 18.5Z" fill="${u('l')}" ${xINK2}/><path d="M52 17.5C55 16.5 57.5 15.5 60 14.5" stroke="#1f6a2a" stroke-width="1.1" fill="none"/>
<path d="M20 20L25 22.5" stroke="#c8ffb0" stroke-width="1.3" stroke-linecap="round"/>`);
});

const golem_core = X('golem_core', (id, u) => {
  const a = xaura(id('au'), '#ff8a1a');
  const crack = 'M23 21L29 29L22 37L27 46M41 19L36 28L44 35L40 44M29 29H36';
  return xsvg(
    a.def + xrg(id('s'), ['#dcd4cc', '#8a8078', '#463c34']),
    `${a.el}<path d="M30 8L42 10.5L51 19L55.5 33L50 47L39 56L25 56L14 48L8.5 35L12.5 21L20 12.5Z" fill="${u('s')}" ${xINK}/>
<path d="M20 12.5L24 21L12.5 21M42 10.5L40 19L51 19M50 47L42.5 44L39 56M14 48L22 43" fill="none" stroke="#4a3e34" stroke-width="1.4" opacity=".55"/>
<path d="${crack}" fill="none" stroke="#ff7a1a" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/>
<path d="${crack}" fill="none" stroke="#ffe890" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M32.5 26L38.5 33L32.5 40L26.5 33Z" fill="#ffd27a" stroke="#ff7a1a" stroke-width="2" stroke-linejoin="round"/><circle cx="32.5" cy="33" r="2" fill="#fff"/>
<path d="M14 30C15 24 18 19 22 16" fill="none" stroke="#f4eee8" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`);
});

const heartwood = X('heartwood', (id, u) => xsvg(
  xlg(id('b'), ['#b07040', '#6e3a1a', '#3a1c0a']) + xrg(id('e'), ['#ffe4b0', '#e0a060', '#a8682e'], '50%', '50%', '60%') + xrg(id('c'), ['#ffffff', '#ffd84a/.9', '#ff9a1a/0'], '50%', '50%', '50%') + xlg(id('l'), GREEN),
  `<path d="M24 21L46 17C53 17 57 26 57 36C57 46 53 54 46 54L24 55Z" fill="${u('b')}" ${xINK}/>
<path d="M36 20C34 30 37 42 35 53.5M46 18C44 29 47 42 45 53" fill="none" stroke="#2a1408" stroke-width="1.6" opacity=".7"/><path d="M29 23.5L42 21" stroke="#d89a6a" stroke-width="1.6" stroke-linecap="round"/>
<ellipse cx="24" cy="38" rx="15" ry="17" fill="${u('e')}" ${xINK}/>
<ellipse cx="24" cy="38" rx="10.5" ry="12" fill="none" stroke="#b07038" stroke-width="1.6"/><ellipse cx="24" cy="38" rx="6.5" ry="7.5" fill="none" stroke="#b07038" stroke-width="1.4"/>
<circle cx="24" cy="38" r="8.5" fill="${u('c')}"/><ellipse cx="24" cy="38" rx="3.2" ry="3.6" fill="#ffd84a" stroke="#c86a08" stroke-width="1.4"/>
${xln('M43 18C43 13 42 10 40 7', '#5ab040', 2.2, 5.6)}
<path d="M41 10.5C36 4 28 5 25 8C29 12.5 36 13.5 41 10.5Z" fill="${u('l')}" ${xINK2}/><path d="M42.5 12C46 5 54 3 58 6C55 11 48 13 42.5 12Z" fill="${u('l')}" ${xINK2}/>
<path d="M14 30C15 26 17 24 19 23" fill="none" stroke="#fff4dc" stroke-width="2.2" stroke-linecap="round"/>`));

const soul_ember = X('soul_ember', (id, u) => xsvg(
  xrg(id('g'), ['#f0c8ff/.95', '#b060ff/.45', '#8a3ae8/0'], '50%', '50%', '50%') + xlg(id('f'), ['#ffffff', '#e0a8ff', '#8a3ae8']) + xlg(id('i'), IRON),
  `${xln('M26.5 12C26.5 4.5 37.5 4.5 37.5 12', '#5a6680', 2.4, 6.4)}<circle cx="32" cy="35" r="19" fill="${u('g')}"/>
<path d="${xflameD(32, 49, 30, 10.5)}" fill="${u('f')}" ${xINK2}/><path d="${xflameD(32, 48, 13, 5)}" fill="#fff" opacity=".8"/>
<ellipse cx="28.5" cy="40" rx="1.4" ry="2.1" fill="#3a1060"/><ellipse cx="35.5" cy="40" rx="1.4" ry="2.1" fill="#3a1060"/>
<path d="M25.5 18.5V49.5M38.5 18.5V49.5" stroke="${xC}" stroke-width="1.8" opacity=".75"/>
<path d="M19 18V50M45 18V50" stroke="${xC}" stroke-width="6.5"/><path d="M19 18.5V49.5M45 18.5V49.5" stroke="#7a86a0" stroke-width="2.6"/>
<path d="M16.5 19.5L24 11H40L47.5 19.5Z" fill="${u('i')}" ${xINK}/><path d="M15.5 49H48.5L45 57H19Z" fill="${u('i')}" ${xINK}/>
<path d="M25 14H35M20 51.5H30" stroke="#e8eef8" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>${xspark(53, 30, 3, '#e8c8ff')}${xspark(11, 38, 2.5, '#e8c8ff')}`));

const spirit_dust = X('spirit_dust', (id, u) => xsvg(
  xlg(id('p'), ['#f0d8ff', '#b88ae8', '#6a3aa8']) + xlg(id('d'), ['#ffffff', '#e8c8ff', '#b07ae8']),
  `<path d="M28 58C32 50 40 46 48 47C55 48 59 53 60 58Z" fill="${u('d')}" ${xINK2}/>
<g transform="rotate(32 24 36)"><path d="M14 30C7 37 6.5 50 14 54H34C41.5 50 41 37 34 30Z" fill="${u('p')}" ${xINK}/>
<path d="M15.5 30L12 21L19 25L24 18.5L29 25L36 21L32.5 30Z" fill="#c8a0f0" ${xINK}/>${xln('M14 30.5C20 33 28 33 34 30.5', '#ffcc33', 2.2, 5.4)}
<path d="M12 37C11 41 11.5 45 13 48" fill="none" stroke="#f6e8ff" stroke-width="2.4" stroke-linecap="round"/><path d="M24 39L27 43L24 47L21 43Z" fill="#ffcc33" stroke="#4a1a7a" stroke-width="1.3" stroke-linejoin="round"/></g>
<path d="${xfluff(38, 24, 5, 4.2, 7, 1.25)}" fill="${u('d')}" ${xINK2}/>
<circle cx="44" cy="30" r="2.4" fill="#e8c8ff"/><circle cx="47" cy="36" r="2" fill="#d8b0ff"/><circle cx="45" cy="41" r="2.2" fill="#e8c8ff"/><circle cx="50" cy="40" r="1.4" fill="#fff"/>
${xspark(53, 28, 4)}${xspark(36, 50, 2.6)}${xspark(56, 51, 2.6)}${xspark(48, 15, 2.8, '#e8c8ff')}`));

const spirit_shard = X('spirit_shard', (id, u) => {
  const a = xaura(id('au'), '#b070ff');
  const out = 'M28 4L44 18L39 28L49 42L35 60L21 45L26 33L15 22Z';
  return xsvg(
    a.def + xlg(id('l'), ['#fbeaff', '#c890ff', '#8a4ae8']) + xlg(id('r'), ['#d8b0ff', '#7a3ae0', '#3a1490']),
    `${a.el}<path d="${out}" fill="${u('r')}"/><path d="M28 4L15 22L26 33L21 45L35 60L32 36L36 22Z" fill="${u('l')}"/>
<path d="M28 4L36 22L32 36L35 60M36 22L44 18M32 36L39 28M26 33L32 36" fill="none" stroke="${xC}" stroke-width="1.4" stroke-linejoin="round" opacity=".5"/>
<path d="${out}" fill="none" ${xINK}/><path d="M25 11L19.5 20M27 39L25 45" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>
${xspark(50, 12, 4.5)}${xspark(12, 46, 3.5, '#f0d8ff')}${xspark(52, 54, 3)}`);
});

const star_essence = X('star_essence', (id, u) => {
  const a = xaura(id('au'), '#ffd040');
  const flask = 'M26 15H38V26C46 29 51 35 51 43C51 52 42.5 58 32 58C21.5 58 13 52 13 43C13 35 18 29 26 26Z';
  return xsvg(
    a.def + xrg(id('i'), ['#fffbe0/.95', '#ffd84a/.6', '#ff9a1a/.15'], '50%', '50%', '50%') + xlg(id('s'), GOLD) + xlg(id('k'), WOOD),
    `${a.el}<path d="${flask}" fill="#e8f8ff" fill-opacity=".35"/><circle cx="32" cy="43" r="15" fill="${u('i')}"/>
<path d="${xstarD(32, 44.5, 11, 4.8)}" fill="${u('s')}" ${xINK2}/>${xglint(28.5, 41, 1.2, 2.6, 35)}
<path d="${flask}" fill="none" ${xINK}/><rect x="24" y="7" width="16" height="9" rx="2.5" fill="${u('k')}" ${xINK}/>
<path d="M17.5 40C18 35 21 31.5 25 30" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>${xspark(52, 14, 4)}${xspark(12, 20, 3)}`);
});

const moon_candy = X('moon_candy', (id, u) => xsvg(
  xlg(id('w'), PURPLE) + xlg(id('c'), ORANGE),
  `${xmirror(`<path d="M19 32L7 20C4.5 24 6.5 28 4 32C6.5 36 4.5 40 7 44Z" fill="${u('w')}" ${xINK}/><path d="M9.5 25.5L14.5 30.5M9.5 38.5L14.5 33.5" stroke="#e8c8ff" stroke-width="1.6" stroke-linecap="round"/>`)}
<ellipse cx="32" cy="32" rx="15" ry="13.5" fill="${u('c')}" ${xINK}/>
${xmirror(`<path d="M16 28L19.5 29.5V34.5L16 36Z" fill="#7a3ac8" ${xINK2}/>`)}
<path d="M38 25.5A8.5 8.5 0 1 0 38 38.5A6.6 6.6 0 1 1 38 25.5Z" fill="#fff4b0" stroke="#b8650a" stroke-width="1.8" stroke-linejoin="round"/>
${xspark(41.5, 29, 2.4, '#fff7d0')}<circle cx="40" cy="36.5" r="1.1" fill="#fff7d0"/>
<path d="M22 26C24 22 27 20.5 31 20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`));

const gem_ruby = X('gem_ruby', (id, u) => xsvg(
  xlg(id('m'), ['#ff8a9a', '#c8102e']),
  `${xbrill(32, 9, 46, 48, ['#ff9aa8', '#ffdce2', '#ff5a6e', '#ff3a52', '#8a0a22'], u('m'))}
<path d="M21 9L26.5 23.5L32 9L37.5 23.5L43 9" fill="none" stroke="${xC}" stroke-width="1.4" stroke-linejoin="round" opacity=".45"/>
${xglint(26, 14, 1.4, 3, 30)}${xspark(46, 33, 4.5)}${xspark(16, 46, 3)}`));

const gem_sapphire = X('gem_sapphire', (id, u) => xsvg(
  xrg(id('o'), ['#c8ecff', '#3a8aff', '#142a9a'], '40%', '30%', '75%') + xlg(id('t'), ['#e8f8ff', '#7ab8ff', '#2a5ae0']),
  `<ellipse cx="32" cy="32" rx="19" ry="25" fill="${u('o')}"/><path d="M32 7A19 25 0 0 1 32 57Z" fill="#0a1a6a" opacity=".22"/>
<path d="M32 16L41 23V41L32 48L23 41V23Z" fill="${u('t')}"/>
<path d="M32 7V16M32 48V57M13 32H23M41 32H51M18.5 14.5L23 23M45.5 14.5L41 23M18.5 49.5L23 41M45.5 49.5L41 41M32 16L41 23V41L32 48L23 41V23Z" fill="none" stroke="${xC}" stroke-width="1.4" stroke-linejoin="round" opacity=".5"/>
<ellipse cx="32" cy="32" rx="19" ry="25" fill="none" ${xINK}/>${xglint(25.5, 21, 1.6, 4, 25)}${xspark(46, 44, 4)}${xspark(52, 12, 3)}`));

const gem_emerald = X('gem_emerald', (id, u) => xsvg(
  xlg(id('t'), ['#d8ffe0', '#4ad070', '#178a3a']),
  `<path d="M20 7H44L54 17V47L44 57H20L10 47V17Z" fill="#3ac060"/><path d="M10 17L20 7H44L54 17L45 21L40 16H24L19 21Z" fill="#b8f5c0"/>
<path d="M54 17V47L45 43V21Z" fill="#1f9a48"/><path d="M54 47L44 57H20L10 47L19 43L24 48H40L45 43Z" fill="#13703a"/><path d="M10 17V47L19 43V21Z" fill="#6ad888"/>
<path d="M24 16H40L45 21V43L40 48H24L19 43V21Z" fill="${u('t')}" stroke="${xC}" stroke-width="1.5" stroke-linejoin="round" stroke-opacity=".6"/>
<path d="M27 21H37L40 24V40L37 43H27L24 40V24Z" fill="none" stroke="#e8ffe8" stroke-width="1.3" opacity=".6"/>
<path d="M10 17L19 21M54 17L45 21M10 47L19 43M54 47L45 43M20 7L24 16M44 7L40 16M20 57L24 48M44 57L40 48" stroke="${xC}" stroke-width="1.4" opacity=".5"/>
<path d="M20 7H44L54 17V47L44 57H20L10 47V17Z" fill="none" ${xINK}/>${xglint(29, 26, 1.6, 4, 30)}${xspark(50, 52, 3.5)}`));

const gem_topaz = X('gem_topaz', (id, u) => xsvg(
  xlg(id('t'), ['#fffbe0', '#ffd84a', '#f0a010']),
  `<path d="M9 18.5L32 5V17L20 24Z" fill="#fff6b0"/><path d="M32 5L55 18.5L44 24L32 17Z" fill="#ffd84a"/><path d="M55 18.5V45.5L44 40V24Z" fill="#f0a020"/>
<path d="M55 45.5L32 59V47L44 40Z" fill="#c86a08"/><path d="M32 59L9 45.5L20 40L32 47Z" fill="#e08a10"/><path d="M9 45.5V18.5L20 24V40Z" fill="#ffe27a"/>
<path d="M32 17L44 24V40L32 47L20 40V24Z" fill="${u('t')}"/>
<path d="M9 18.5L20 24M32 5V17M55 18.5L44 24M55 45.5L44 40M32 59V47M9 45.5L20 40M32 17L44 24V40L32 47L20 40V24Z" fill="none" stroke="${xC}" stroke-width="1.4" stroke-linejoin="round" opacity=".5"/>
<path d="M32 5L55 18.5V45.5L32 59L9 45.5V18.5Z" fill="none" ${xINK}/>${xglint(26, 26, 1.5, 3.6, 30)}${xspark(49, 52, 3.5)}${xspark(14, 10, 3)}`));

const gem_pouch = X('gem_pouch', (id, u) => xsvg(
  xlg(id('v'), ['#e878b8', '#a02a78', '#5a0e44']),
  `${xmini(23, 18, 6.5, GEMS.r)}${xmini(41, 17, 6.5, GEMS.b)}${xmini(32, 13, 7.5, GEMS.g)}
<path d="M19 27C10 35 9 52 19 57H45C55 52 54 35 45 27Z" fill="${u('v')}" ${xINK}/>
<path d="M17 28L13 21.5C21 24.5 43 24.5 51 21.5L47 28C39 31 25 31 17 28Z" fill="#c4489a" ${xINK2}/>
${xln('M17 29.5C25 32.5 39 32.5 47 29.5', '#ffcc33', 2.4, 5.4)}${xln('M47 30L51 40', '#ffcc33', 2, 5)}<circle cx="51.5" cy="42" r="2.6" fill="#ffcc33" ${xINK2}/>
<path d="M17 42C17 37 18.5 34 21 32" fill="none" stroke="#ffb8e0" stroke-width="2.4" stroke-linecap="round"/>
<path d="M32 40L35 44L32 48L29 44Z" fill="#ffcc33" stroke="#7a1a50" stroke-width="1.4" stroke-linejoin="round"/>${xspark(54, 12, 3.5)}`));

const cache = (key, glow, body, trim, gem) => X(key, (id, u) => {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 + 22.5) * Math.PI / 180, d = 0.11, P = (t) => `${xf(32 + Math.cos(t) * 31)} ${xf(34 + Math.sin(t) * 31)}`;
    rays += `M32 34L${P(a - d)}L${P(a + d)}Z`;
  }
  return xsvg(
    xrg(id('au'), [`${glow}/.95`, `${glow}/.4`, `${glow}/0`], '50%', '50%', '50%') + xrg(id('ry'), ['#ffffff', `${glow}/.95`, `${glow}/.6`, `${glow}/0`], '50%', '50%', '50%') + xlg(id('b'), body) + xlg(id('t'), trim) + xrg(id('j'), gem),
    `<path d="${rays}" fill="${u('ry')}"/><circle cx="32" cy="34" r="30" fill="${u('au')}"/>
<rect x="10" y="32" width="44" height="24" rx="3" fill="${u('b')}" ${xINK}/><path d="M10 33V25C10 17 15 13 22 13H42C49 13 54 17 54 25V33Z" fill="${u('b')}" ${xINK}/>
<path d="M16 14V56M48 14V56" stroke="${xC}" stroke-width="8.5"/><path d="M16 14.5V54.5M48 14.5V54.5" stroke="${u('t')}" stroke-width="4"/>
<path d="M27 13.5L32 7L37 13.5Z" fill="${u('t')}" ${xINK2}/><rect x="8" y="30" width="48" height="6" rx="2" fill="${u('t')}" ${xINK2}/>
<path d="M26 29H38V39C38 42 35 44 32 45.5C29 44 26 42 26 39Z" fill="${u('t')}" ${xINK2}/><circle cx="32" cy="37" r="3.8" fill="${u('j')}" ${xINK2}/>
<path d="M21 17.5C24 16 27 15.5 30 15.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".9"/>${xspark(56, 10, 4.5)}${xspark(8, 52, 3)}`);
});
const legend_cache = cache('legend_cache', '#ffe040', ['#ffffff', '#eef2fa', '#b4c0d8'], GOLD, ['#ffffff', '#7ae8ff', '#1a7ad8']);
const unique_cache = cache('unique_cache', '#ff9a2a', ['#f08a7a', '#a8283a', '#5a0c1c'], GOLD, ['#ffffff', '#ffc070', '#ff6a0a']);

const candy_bag = X('candy_bag', (id, u) => xsvg(
  xlg(id('b'), ORANGE) + xrg(id('p'), PINK) + xlg(id('g'), GREEN),
  `${xln('M21 28C21 12 43 12 43 28', '#8a3a10', 3.2)}
${xln('M40 30L45 13', '#ffffff', 2, 5)}<circle cx="45.5" cy="12" r="6.5" fill="${u('p')}" ${xINK2}/><path d="M45.5 12m-3 0a3 3 0 1 1 3 3" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
<g transform="rotate(-25 24 22)"><path d="M18.5 22L13 18V26ZM29.5 22L35 18V26Z" fill="#ffe07a" ${xINK2}/><ellipse cx="24" cy="22" rx="6" ry="4.6" fill="${u('g')}" ${xINK2}/></g>
<circle cx="33.5" cy="22.5" r="4.4" fill="#ffd84a" ${xINK2}/>
<path d="M12 27H52L48 58H16Z" fill="${u('b')}" ${xINK}/><path d="M11 24.5H53L52 31H12Z" fill="#ffb050" ${xINK2}/>
${xmirror(`<path d="M22 38L27 34L28.5 41Z" fill="#5a2408"/>`)}<path d="M21 46L24.5 48.5L27 46.5L29.5 49L32 47L34.5 49L37 46.5L39.5 48.5L43 46C40 53 24 53 21 46Z" fill="#5a2408"/>
<path d="M16 34L18 52" stroke="#ffe0b0" stroke-width="2.2" stroke-linecap="round"/>`));

// ---------------------------------------------------------------- festival tokens
const star_cookie = X('star_cookie', (id, u) => {
  const star = xstarD(32, 34, 26, 12.5);
  return xsvg(
    xlg(id('c'), ['#ffdca8', '#e09a52', '#a85a22']) + xlg(id('s'), ['#e8f8ff', '#4cb4ff', '#2251d1']),
    `<path d="${star}" fill="none" stroke="${xC}" stroke-width="9.5" stroke-linejoin="round"/><path d="${star}" fill="${u('c')}" stroke="#d08440" stroke-width="4" stroke-linejoin="round"/>
<path d="${xstarD(32, 34.5, 19, 9.2)}" fill="none" stroke="#fffaf0" stroke-width="2.6" stroke-linejoin="round"/>
<path d="${xstarD(32, 35, 7, 3.1)}" fill="${u('s')}" stroke="${xC}" stroke-width="1.6" stroke-linejoin="round"/>
<circle cx="20" cy="31" r="1.3" fill="#fffaf0"/><circle cx="44" cy="31" r="1.3" fill="#fffaf0"/><circle cx="25" cy="46" r="1.3" fill="#fffaf0"/><circle cx="39" cy="46" r="1.3" fill="#fffaf0"/>
<path d="M27.5 14L30 9.5" stroke="#ffe8c8" stroke-width="2.2" stroke-linecap="round"/>${xspark(53, 8, 3.5, '#d8f0ff')}`);
});

const sakura_petal = X('sakura_petal', (id, u) => {
  const a = xaura(id('au'), '#ffa8d0');
  const petal = (x, y, s, r) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})"><path d="M0 0C-3 -3 -8 -10 -8 -17C-8 -21 -5 -23.5 -2 -22.5L0 -20L2 -22.5C5 -23.5 8 -21 8 -17C8 -10 3 -3 0 0Z" fill="${u('p')}" stroke="${xC}" stroke-width="${xf(3 / s)}" stroke-linejoin="round"/>
<path d="M0 -3C-0.5 -9 -0.3 -14 0 -18" fill="none" stroke="#f070a8" stroke-width="${xf(1.4 / s)}" stroke-linecap="round" opacity=".7"/><path d="M-4.5 -19C-5.5 -16 -5.3 -13 -4 -10.5" fill="none" stroke="#fff" stroke-width="${xf(1.8 / s)}" stroke-linecap="round"/></g>`;
  return xsvg(
    a.def + xlg(id('p'), ['#fff4f8', '#ffb8d8', '#f07aaa']),
    `${a.el}${petal(24, 22, 0.75, -50)}${petal(41, 37, 1.0, 40)}${petal(30, 58, 1.4, -25)}
${xspark(52, 49, 3.5)}${xspark(12, 46, 2.8, '#ffe3f1')}${xspark(31, 9, 2.6)}`);
});

export const EXTRA_ICONS = {
  missions, guild, war, worldboss, market, trade, forge, season, event, codex, trophy, crystal, contrib,
  reforge, ascend, salvage, socket, combine, levelup, lock_open, calendar, mail,
  jelly_gel, soft_fur, glow_spore, wolf_fang, golem_core, heartwood, soul_ember, spirit_dust, spirit_shard,
  star_essence, moon_candy, gem_ruby, gem_sapphire, gem_emerald, gem_topaz, gem_pouch, legend_cache, unique_cache, candy_bag,
  star_cookie, sakura_petal,
};
