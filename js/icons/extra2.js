// Extra icon set #2 (SVG, 64x64): gathering materials, crops, potions & elixirs, misc items and
// profession / activity icons, plus template functions for parameterised families (relics, seeds,
// costumes). Drawn to match extra.js. Helpers are local y-prefixed copies of the extra.js ones.
// Every gradient id is "y-<key>-<part>" (templates: "y-<family>-<key>-<part>"), so ids never
// collide with other icons on the same page.
const yC = '#24160f';
const yINK = `stroke="${yC}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const yINK2 = `stroke="${yC}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"`;
const yINK1 = `stroke="${yC}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"`;
const yf = (n) => +n.toFixed(1);
const ystops = (c) => c.map((s, i) => {
  const [col, op] = s.split('/');
  return `<stop offset="${(i / (c.length - 1)).toFixed(2)}" stop-color="${col}"${op ? ` stop-opacity="${op}"` : ''}/>`;
}).join('');
const ylg = (id, c, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${ystops(c)}</linearGradient>`;
const yrg = (id, c, cx = '40%', cy = '35%', r = '65%') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${ystops(c)}</radialGradient>`;
const ysvg = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>${body}</svg>`;
const yspark = (x, y, s = 4, fill = '#fff') => `<path d="M${x} ${yf(y - s)}Q${yf(x + s * 0.2)} ${yf(y - s * 0.2)} ${yf(x + s)} ${y}Q${yf(x + s * 0.2)} ${yf(y + s * 0.2)} ${x} ${yf(y + s)}Q${yf(x - s * 0.2)} ${yf(y + s * 0.2)} ${yf(x - s)} ${y}Q${yf(x - s * 0.2)} ${yf(y - s * 0.2)} ${x} ${yf(y - s)}Z" fill="${fill}"/>`;
const yaura = (id, c, cx = 32, cy = 32, r = 31) => ({ def: `<radialGradient id="${id}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${c}" stop-opacity=".85"/><stop offset=".55" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`, el: `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>` });
// outlined stroke (ink underlay + colored line)
const yln = (d, col, w = 4, iw = w + 4.5) => `<path d="${d}" fill="none" stroke="${yC}" stroke-width="${iw}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const yglint = (x, y, rx, ry, rot = -30, op = 0.9) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="#fff" opacity="${op}"/>`;
const ymirror = (m) => m + `<g transform="matrix(-1 0 0 1 64 0)">${m}</g>`;
const ystarD = (cx, cy, R, r, n = 5, rot = 0) => {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + rot + i * Math.PI / n, rad = i % 2 ? r : R;
    d += (i ? 'L' : 'M') + yf(cx + Math.cos(a) * rad) + ' ' + yf(cy + Math.sin(a) * rad);
  }
  return d + 'Z';
};
// scalloped (fluffy / wax-blob) outline around an ellipse
const yfluff = (cx, cy, rx, ry, n, k = 1.18, rot = 0) => {
  let d = '';
  for (let i = 0; i <= n; i++) {
    const a = rot + i * 2 * Math.PI / n, m = a - Math.PI / n, x = yf(cx + Math.cos(a) * rx), y = yf(cy + Math.sin(a) * ry);
    d += i ? `Q${yf(cx + Math.cos(m) * rx * k)} ${yf(cy + Math.sin(m) * ry * k)} ${x} ${y}` : `M${x} ${y}`;
  }
  return d + 'Z';
};
// flame: base-centered at (cx, by), height h, half-width w
const yflameD = (cx, by, h, w) => {
  const X = (x) => yf(cx + x * w), Y = (y) => yf(by - y * h);
  return `M${X(0)} ${Y(1)}C${X(0.35)} ${Y(0.72)} ${X(1)} ${Y(0.55)} ${X(1)} ${Y(0.28)}C${X(1)} ${Y(0.1)} ${X(0.55)} ${Y(0)} ${X(0)} ${Y(0)}C${X(-0.55)} ${Y(0)} ${X(-1)} ${Y(0.1)} ${X(-1)} ${Y(0.3)}C${X(-1)} ${Y(0.5)} ${X(-0.7)} ${Y(0.62)} ${X(-0.55)} ${Y(0.78)}C${X(-0.4)} ${Y(0.66)} ${X(-0.25)} ${Y(0.6)} ${X(-0.15)} ${Y(0.56)}C${X(-0.25)} ${Y(0.75)} ${X(-0.1)} ${Y(0.9)} ${X(0)} ${Y(1)}Z`;
};
// straight arrow outline (shaft + triangular head) from (x0, y0) to the tip (x1, y1)
const yarwD = (x0, y0, x1, y1, h = 5.5, sw = 1.5) => {
  const L = Math.hypot(x1 - x0, y1 - y0), dx = (x1 - x0) / L, dy = (y1 - y0) / L, bx = x1 - dx * h, by = y1 - dy * h, k = h * 0.85;
  const pt = (x, y) => `${yf(x)} ${yf(y)}`;
  return `M${pt(x0 - dy * sw, y0 + dx * sw)}L${pt(bx - dy * sw, by + dx * sw)}L${pt(bx - dy * k, by + dx * k)}L${pt(x1, y1)}L${pt(bx + dy * k, by - dx * k)}L${pt(bx + dy * sw, by - dx * sw)}L${pt(x0 + dy * sw, y0 - dx * sw)}Z`;
};
// pointed leaf / petal with its base at (x, y), length len, half-width w, rotated rot degrees (0 = up)
const yleaf = (x, y, len, w, rot, fill, vein, ink = yINK2) => `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0C${w} ${yf(-len * 0.25)} ${w} ${yf(-len * 0.7)} 0 ${-len}C${-w} ${yf(-len * 0.7)} ${-w} ${yf(-len * 0.25)} 0 0Z" fill="${fill}" ${ink}/>` +
  (vein ? `<path d="M0 -2V${yf(-len * 0.72)}" stroke="${vein}" stroke-width="1.2" stroke-linecap="round"/>` : '') + '</g>';
// faceted ore nugget around (cx, cy), radius s; cols = [light, mid, dark] facets, table = center face fill
const ynug = (cx, cy, s, [lt, md, dk], table, thin) => {
  const P = (pts) => pts.map(([x, y], i) => (i ? 'L' : 'M') + yf(cx + x * s) + ' ' + yf(cy + y * s)).join('');
  const A = [-1, 0.1], B = [-0.62, -0.68], C = [0.08, -1], D = [0.78, -0.62], E = [1, 0.12], F = [0.62, 0.78], G = [-0.18, 1], H = [-0.82, 0.66];
  const a = [-0.42, -0.28], b = [0.12, -0.5], c = [0.52, -0.14], d = [0.36, 0.4], e = [-0.18, 0.46], f = [-0.52, 0.14];
  return `<path d="${P([A, B, C, b, a, f])}Z" fill="${lt}"/><path d="${P([C, D, E, d, c, b])}Z" fill="${md}"/><path d="${P([E, F, G, H, A, f, e, d])}Z" fill="${dk}"/><path d="${P([a, b, c, d, e, f])}Z" fill="${table}"/>` +
    `<path d="${P([a, b, c, d, e, f])}Z${P([B, a])}${P([C, b])}${P([D, c])}${P([E, d])}${P([G, e])}${P([A, f])}" fill="none" stroke="${yC}" stroke-width="1.2" stroke-linejoin="round" opacity=".45"/>` +
    `<path d="${P([A, B, C, D, E, F, G, H])}Z" fill="none" ${thin ? yINK2 : yINK}/>`;
};
// octagonal faceted gem (lit from the upper left), cols = [light, mid, dark], table = center fill
const yoct = (cx, cy, R, r, [lt, md, dk], table) => {
  const p = (a, rad) => `${yf(cx + Math.cos(a) * rad)} ${yf(cy + Math.sin(a) * rad)}`, st = Math.PI / 4;
  let s = '', inn = '', out = '', ln = '';
  for (let i = 0; i < 8; i++) {
    const a0 = i * st + st / 2, a1 = a0 + st, lit = Math.cos(a0 + st / 2 + Math.PI * 0.75);
    s += `<path d="M${p(a0, R)}L${p(a1, R)}L${p(a1, r)}L${p(a0, r)}Z" fill="${lit > 0.5 ? lt : lit > -0.5 ? md : dk}"/>`;
    inn += (i ? 'L' : 'M') + p(a0, r); out += (i ? 'L' : 'M') + p(a0, R); ln += `M${p(a0, r)}L${p(a0, R)}`;
  }
  return s + `<path d="${inn}Z" fill="${table}"/><path d="${inn}Z${ln}" fill="none" stroke="${yC}" stroke-width="1.2" stroke-linejoin="round" opacity=".5"/><path d="${out}Z" fill="none" ${yINK2}/>`;
};
// per-icon id scope: id('a') -> "y-<key>-a", u('a') -> "url(#y-<key>-a)"
const Y = (key, build) => build((s) => `y-${key}-${s}`, (s) => `url(#y-${key}-${s})`);
// colour maths for the templates (accepts #rgb / #rrggbb, anything else falls back to grey)
const yhex = (c) => {
  let h = String(c || '').trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.replace(/./g, '$&$&');
  if (!/^[0-9a-f]{6}$/i.test(h)) h = '8890a8';
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const ymix = (c, t, k) => { const a = yhex(c), b = yhex(t); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
const ylt = (c, k = 0.6) => ymix(c, '#ffffff', k);
const ydk = (c, k = 0.45) => ymix(c, '#000000', k);
const ypal = (c) => [ylt(c, 0.65), ymix(c, '#000000', 0), ydk(c, 0.45)];
const yid = (k) => String(k).replace(/[^A-Za-z0-9_-]/g, '_');

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
const STEEL = ['#ffffff', '#d8e4f4', '#8a9ab8'];
const SKIN = ['#fff2e4', '#ffd2ae', '#e09a6a'];

// ---------------------------------------------------------------- ores
const ore = (key, cols, tbl, deco = '', au) => Y(key, (id, u) => {
  const a = au ? yaura(id('au'), au) : null;
  return ysvg((a ? a.def : '') + yrg(id('t'), tbl, '40%', '35%', '75%'),
    `${a ? a.el : ''}${ynug(35, 30, 20, cols, u('t'))}${ynug(16, 47, 9.5, cols, u('t'), true)}${ynug(46, 53, 6.5, cols, u('t'), true)}
${yglint(24, 20, 1.5, 4, 45)}${yglint(12.5, 42.5, 1, 2.2, 45)}${deco}`);
});
const ore_copper = ore('ore_copper', ['#ffc890', '#e8803a', '#9a4218'], ['#ffe6c0', '#f29a58', '#c45a1e'],
  `<g fill="#3ad8b0" stroke="${yC}" stroke-width="1"><circle cx="46" cy="39" r="2.4"/><circle cx="39.5" cy="45" r="1.6"/><circle cx="25" cy="44" r="1.8"/><circle cx="19" cy="51" r="1.4"/></g>${yspark(54, 9, 3.5, '#ffe6c0')}`);
const ore_iron = ore('ore_iron', ['#d4dae4', '#7c8698', '#3a4256'], ['#eef2f8', '#a0aabb', '#5a6478'],
  `<g fill="#d0742e"><circle cx="45" cy="40" r="2.2"/><circle cx="38" cy="46" r="1.4"/><circle cx="50" cy="33" r="1.3"/><circle cx="14" cy="51" r="1.4"/></g>${yspark(54, 10, 3, '#e8eef8')}`);
const ore_silver = ore('ore_silver', ['#ffffff', '#d4e0f0', '#8494b4'], ['#ffffff', '#eef4fc', '#b0c0d8'],
  `${yspark(55, 10, 4.5)}${yspark(9, 25, 3)}${yspark(33, 30, 2.6)}`);
const ore_mithril = ore('ore_mithril', ['#f4ffff', '#8aeaf4', '#2a9cbc'], ['#ffffff', '#c8fbff', '#4ad0e8'],
  `${yspark(55, 9, 4.5)}${yspark(8, 26, 3.2, '#c8fbff')}${yspark(33, 30, 3)}${yspark(57, 42, 2.6, '#c8fbff')}`, '#7af0ff');
const ore_starmetal = ore('ore_starmetal', ['#8a78cc', '#40327a', '#1a1238'], ['#6a58a8', '#30266a', '#160e30'],
  `<g fill="#ffd84a" stroke="#a86a08" stroke-width=".8" stroke-linejoin="round"><path d="${ystarD(35, 31, 5, 2.2)}"/><path d="${ystarD(44.5, 41, 2.8, 1.2)}"/><path d="${ystarD(24, 37, 2.4, 1.1)}"/><path d="${ystarD(16, 47.5, 2.6, 1.1)}"/><path d="${ystarD(47, 21, 2.2, 1)}"/></g>
${yspark(55, 9, 4.5, '#ffe680')}${yspark(8, 25, 3, '#ffe680')}`, '#b08aff');

// ---------------------------------------------------------------- herbs
const herb_silverleaf = Y('herb_silverleaf', (id, u) => {
  const L = (x, y, l, w, r) => yleaf(x, y, l, w, r, u('l'), '#8aa89c');
  return ysvg(
    ylg(id('l'), ['#ffffff', '#d4e8e0', '#86ac9e'], 1, 1) + ylg(id('r'), PURPLE),
    `${yln('M30 59C30 46 31 30 34 12', '#8ab8a0', 2.4, 6.4)}
${L(30.5, 45, 17, 7, -60)}${L(31, 37, 17, 7, 56)}${L(32, 29, 15, 6.5, -52)}${L(33, 22, 13, 6, 50)}${L(34, 15, 11, 5, 4)}
<rect x="25" y="49" width="11" height="5" rx="2.5" fill="${u('r')}" ${yINK2}/>
${yspark(51, 12, 4)}${yspark(12, 20, 3)}${yspark(52, 46, 2.6, '#e0f0ea')}`);
});

const herb_moonbloom = Y('herb_moonbloom', (id, u) => {
  const a = yaura(id('au'), '#8ad0ff', 32, 25, 25);
  let pet = '', vein = '';
  for (let i = 0; i < 5; i++) {
    pet += `<ellipse cx="32" cy="15.5" rx="6.6" ry="9" transform="rotate(${i * 72} 32 25)"/>`;
    vein += `<path d="M32 19V11" transform="rotate(${i * 72} 32 25)"/>`;
  }
  return ysvg(
    a.def + yrg(id('p'), ['#ffffff', '#d4ecff', '#7ab4ff'], '50%', '35%', '80%') + ylg(id('l'), ['#c8ffd8', '#4ac080', '#1a7a4a']),
    `${a.el}${yln('M32 34C31 44 33 52 32 59', '#4aa070', 2.4, 6.4)}${yleaf(32, 51, 14, 6, -62, u('l'), '#1a6a40')}${yleaf(32, 47, 13, 5.5, 60, u('l'), '#1a6a40')}
<g fill="${u('p')}" ${yINK2}>${pet}</g><g stroke="#9ac4ff" stroke-width="1.6" stroke-linecap="round">${vein}</g>
<circle cx="32" cy="25" r="5.6" fill="#fff6c8" ${yINK2}/><path d="M33.6 21.6A3.8 3.8 0 1 0 33.6 28.4A3 3 0 1 1 33.6 21.6Z" fill="#5a8ae8"/>
${yspark(54, 10, 4)}${yspark(10, 44, 3, '#d4ecff')}${yspark(53, 44, 2.6)}`);
});

const herb_firepetal = Y('herb_firepetal', (id, u) => {
  let pet = '';
  for (let i = 0; i < 6; i++) pet += `<path d="${yflameD(32, 26, 18, 6.5)}" transform="rotate(${i * 60 + 30} 32 26)"/>`;
  return ysvg(
    ylg(id('p'), ['#ff3a1a', '#ff7a1a', '#ffd04a']) + yrg(id('c'), ['#ffffff', '#fff27a', '#ff9a1a']) + ylg(id('l'), GREEN),
    `${yln('M32 34C33 44 31 52 32 59', '#4aa040', 2.4, 6.4)}${yleaf(32, 52, 13, 5.5, -60, u('l'), '#1f6a2a')}${yleaf(32, 48, 13, 5.5, 62, u('l'), '#1f6a2a')}
<g fill="${u('p')}" ${yINK2}>${pet}</g>
<circle cx="32" cy="26" r="5.8" fill="${u('c')}" ${yINK2}/><circle cx="30.2" cy="24.2" r="1.4" fill="#fff"/>
<circle cx="53" cy="12" r="1.8" fill="#ffb020"/><circle cx="11" cy="16" r="1.4" fill="#ff7a1a"/><circle cx="50" cy="48" r="1.4" fill="#ffd04a"/>${yspark(13, 44, 3, '#ffd890')}`);
});

const herb_frostlily = Y('herb_frostlily', (id, u) => {
  const P = (r, l, w, f) => yleaf(32, 27, l, w, r, f);
  return ysvg(
    ylg(id('p'), ['#ffffff', '#e8f6ff', '#a8d4f4']) + ylg(id('q'), ['#e8f6ff', '#b8dcf4', '#7ab0e0']) + ylg(id('l'), ['#d8fff0', '#5ac8a0', '#1f7a6a']),
    `${yln('M32 40C32 48 31 54 32 59', '#4ab090', 2.4, 6.4)}${yleaf(32, 59, 18, 4.5, -32, u('l'), '#1f6a5a')}${yleaf(32, 59, 17, 4.5, 34, u('l'), '#1f6a5a')}
${P(0, 20, 7.5, u('q'))}${P(120, 18, 7.5, u('q'))}${P(240, 18, 7.5, u('q'))}${P(60, 19, 7.5, u('p'))}${P(180, 15, 7, u('p'))}${P(300, 19, 7.5, u('p'))}
<g stroke="#e0a030" stroke-width="1.3" stroke-linecap="round" fill="none"><path d="M32 27L29 18M32 27L33 17M32 27L37 19"/></g>
<g fill="#ffb84a" ${yINK1}><circle cx="29" cy="17.5" r="1.6"/><circle cx="33" cy="16.5" r="1.6"/><circle cx="37.2" cy="18.5" r="1.6"/></g>
<circle cx="32" cy="27" r="2.6" fill="#c8f0d0" ${yINK1}/>
${yspark(53, 10, 4, '#e0f8ff')}${yspark(10, 12, 3)}${yspark(55, 50, 2.6, '#bff0ff')}${yspark(9, 49, 2.4, '#bff0ff')}`);
});

const herb_starlotus = Y('herb_starlotus', (id, u) => {
  const a = yaura(id('au'), '#ffd040', 32, 30, 30);
  const P = (r, l, w, f) => yleaf(32, 47, l, w, r, f);
  return ysvg(
    a.def + ylg(id('b'), ['#ffe680', '#f0b020', '#c06a08']) + ylg(id('f'), ['#ffffff', '#ffec90', '#f4b020']) + ylg(id('d'), GREEN),
    `${a.el}<path d="M8 52C8 46.5 19 43 32 43C45 43 56 46.5 56 52C56 57 45 60 32 60C19 60 8 57 8 52Z" fill="${u('d')}" ${yINK}/><path d="M32 52L44 59" stroke="${yC}" stroke-width="1.6" opacity=".5"/>
${P(-66, 19, 7, u('b'))}${P(66, 19, 7, u('b'))}${P(-36, 25, 8.5, u('b'))}${P(36, 25, 8.5, u('b'))}${P(0, 33, 9.5, u('f'))}${P(-15, 22, 8, u('f'))}${P(15, 22, 8, u('f'))}
<path d="M30 22C30 19 31 17 32 15.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" fill="none"/>
${yspark(32, 7, 4.5)}${yspark(52, 16, 3.5, '#fff6c0')}${yspark(11, 20, 3, '#fff6c0')}`);
});

// ---------------------------------------------------------------- wood (log bundles)
// one log seen end-on: body capsule receding by (dx, dy), front face circle with growth rings
const ylog = (x, y, r, dx, dy, bark, face, ring) => {
  const L = Math.hypot(dx, dy), nx = -dy / L * r, ny = dx / L * r, p = (a, b) => `${yf(a)} ${yf(b)}`;
  return {
    body: `<path d="M${p(x + nx, y + ny)}L${p(x + dx + nx, y + dy + ny)}A${r} ${r} 0 0 0 ${p(x + dx - nx, y + dy - ny)}L${p(x - nx, y - ny)}Z" fill="${bark}" ${yINK}/>` +
      `<path d="M${p(x + nx * 0.4, y + ny * 0.4)}L${p(x + dx + nx * 0.4, y + dy + ny * 0.4)}M${p(x - nx * 0.45, y - ny * 0.45)}L${p(x + dx * 0.8 - nx * 0.45, y + dy * 0.8 - ny * 0.45)}" stroke="${yC}" stroke-width="1.4" stroke-linecap="round" opacity=".45"/>`,
    face: `<circle cx="${x}" cy="${y}" r="${r}" fill="${face}" ${yINK}/><circle cx="${x}" cy="${y}" r="${yf(r * 0.62)}" fill="none" stroke="${ring}" stroke-width="1.4"/><circle cx="${x}" cy="${y}" r="${yf(r * 0.26)}" fill="none" stroke="${ring}" stroke-width="1.3"/>`,
  };
};
const LOGS = [[18, 48], [39, 48], [28.5, 30.5]];
const wood = (key, bark, face, ring, { mid = '', top = '', au, defs = '' } = {}) => Y(key, (id, u) => {
  const a = au ? yaura(id('au'), au) : null;
  const L = LOGS.map(([x, y]) => ylog(x, y, 10, 11, -9, u('b'), u('f'), ring));
  return ysvg((a ? a.def : '') + ylg(id('b'), bark, 1, 1) + yrg(id('f'), face, '45%', '40%', '70%') + defs,
    `${a ? a.el : ''}${L[0].body}${L[1].body}${L[2].body}${mid}${L[0].face}${L[1].face}${L[2].face}${top}`);
});
const hoops = LOGS.map(([x, y]) => {
  const cx = x + 11 * 0.55, cy = y - 9 * 0.55, nx = 9 / 14.2 * 10, ny = 11 / 14.2 * 10;
  return `M${yf(cx + nx)} ${yf(cy + ny)}L${yf(cx - nx)} ${yf(cy - ny)}`;
}).join('');
const MAPLE = 'M0 -12L2.6 -6.4L7.4 -8.6L5.8 -2.6L11.6 -3L8.6 2L10.2 4.6L3.2 4.4L1 8.6H-1L-3.2 4.4L-10.2 4.6L-8.6 2L-11.6 -3L-5.8 -2.6L-7.4 -8.6L-2.6 -6.4Z';
const wood_oak = wood('wood_oak', ['#c88a52', '#8a5228', '#4e2a10'], ['#fff0d0', '#e8c088', '#b8864a'], '#b07a3a', {
  defs: ylg('y-wood_oak-l', GREEN),
  top: `${yleaf(47, 21, 14, 6, 18, 'url(#y-wood_oak-l)', '#1f6a2a')}${yleaf(47, 21, 12, 5.2, 74, 'url(#y-wood_oak-l)', '#1f6a2a')}<ellipse cx="53.5" cy="27.5" rx="3.6" ry="4.2" fill="#b0642c" ${yINK2}/><path d="M49.6 25.5C50 22 57 22 57.4 25.5Z" fill="#6e3414" ${yINK2}/>`,
});
const wood_maple = wood('wood_maple', ['#e08a6a', '#a8402a', '#5a1a10'], ['#ffe2cc', '#f0a882', '#c8683e'], '#c0603a', {
  defs: ylg('y-wood_maple-l', ['#ffc070', '#ff4a2a', '#b0141e']),
  top: `<path d="${MAPLE}" transform="translate(50 17) rotate(20)" fill="url(#y-wood_maple-l)" ${yINK2}/><path d="M0 7L0 -6M0 0L-6 -3M0 0L6 -3" transform="translate(50 17) rotate(20)" stroke="#8a1010" stroke-width="1.1" fill="none"/>`,
});
const wood_ironwood = wood('wood_ironwood', ['#8aa8a8', '#3e5a62', '#1a2a30'], ['#d8e6e2', '#8eacaa', '#4e6c6c'], '#4a6a6a', {
  mid: `<path d="${hoops}" stroke="${yC}" stroke-width="6.4" stroke-linecap="round"/><path d="${hoops}" stroke="#c8d4e4" stroke-width="2.6" stroke-linecap="round"/>`,
  top: `${yspark(54, 12, 3.5, '#d8f0f0')}`,
});
const wood_frostpine = wood('wood_frostpine', ['#a89080', '#5e4c44', '#2e2420'], ['#ffffff', '#e2f2ff', '#a8c8e8'], '#8ab0d8', {
  top: `<path d="M18 22C19 17 24 15.5 28 17C31 14 37 14.5 39 18.5C42 17 45 18.5 45.5 21.5C40 23 34 21.5 31 23.5C27 21 22 24 18 22Z" fill="#ffffff" ${yINK2}/>
<path d="M28 41.5C30 38.5 35 38 38.5 39.5C41 37 46 37.5 47.5 40.5C44 42 40 41 38 42.5C35 41 31 42.5 28 41.5Z" fill="#ffffff" ${yINK2}/>
<path d="M22 23L23.5 28L25 23.2M36 22.4L37 26L38 22.2" fill="#e0f4ff" ${yINK1}/>
${yspark(54, 12, 4, '#e0f8ff')}${yspark(9, 30, 3, '#bff0ff')}${yspark(57, 50, 2.6, '#bff0ff')}`,
});
const wood_starwood = wood('wood_starwood', ['#ffffff', '#ece8fa', '#b8b0d8'], ['#ffffff', '#ffe680', '#f0a818'], '#e0a020', {
  au: '#ffe070',
  top: `<g fill="#fff7d0" stroke="#c86a08" stroke-width="1.1" stroke-linejoin="round">${LOGS.map(([x, y]) => `<path d="${ystarD(x, y + 0.5, 4.2, 1.9)}"/>`).join('')}</g>
${yspark(54, 11, 4.5)}${yspark(9, 22, 3, '#fff6c0')}${yspark(56, 50, 3, '#fff6c0')}`,
});

// ---------------------------------------------------------------- crops
const crop_wheat = Y('crop_wheat', (id, u) => {
  const ear = (x0, y0, x1, y1) => {
    const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L, ang = Math.atan2(uy, ux) * 180 / Math.PI + 90;
    let g = '';
    for (let i = 0; i < 4; i++) {
      const t = 0.56 + i * 0.105, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
      for (const s of [1, -1]) {
        const gx = yf(x - uy * 2.6 * s), gy = yf(y + ux * 2.6 * s);
        g += `<ellipse cx="${gx}" cy="${gy}" rx="2.5" ry="4.4" transform="rotate(${yf(ang - 28 * s)} ${gx} ${gy})"/>`;
      }
    }
    return g + `<ellipse cx="${yf(x1 - ux * 1.5)}" cy="${yf(y1 - uy * 1.5)}" rx="2.4" ry="4.4" transform="rotate(${yf(ang)} ${yf(x1 - ux * 1.5)} ${yf(y1 - uy * 1.5)})"/>`;
  };
  const S = [[40, 60, 13, 12], [32, 60, 32, 6], [24, 60, 51, 12]];
  return ysvg(
    ylg(id('g'), ['#fff4b8', '#f6c84a', '#c8861a']) + ylg(id('r'), RED),
    `${S.map(([a, b, c, d]) => yln(`M${a} ${b}L${c} ${d}`, '#e0b048', 2, 5)).join('')}
<g fill="${u('g')}" stroke="${yC}" stroke-width="1.5" stroke-linejoin="round">${S.map(([a, b, c, d]) => ear(a, b, c, d)).join('')}</g>
${ymirror(`<path d="M31 44C27 38 21 38 20.5 42C20 46 26 47 31 45Z" fill="${u('r')}" ${yINK2}/>`)}
<path d="M30 45L26 54L29.5 52.5L31 56L32.5 46Z" fill="${u('r')}" ${yINK2}/><circle cx="32" cy="44.5" r="3.2" fill="${u('r')}" ${yINK2}/>
${yspark(55, 30, 3, '#fff4b8')}${yspark(9, 30, 2.6, '#fff4b8')}`);
});

const crop_carrot = Y('crop_carrot', (id, u) => ysvg(
  ylg(id('c'), ['#ffc070', '#ff8a1a', '#d0500a'], 1, 0) + ylg(id('g'), GREEN),
  `<g transform="rotate(30 32 34)">${yleaf(32, 21, 17, 5.5, -30, u('g'), '#1f6a2a')}${yleaf(32, 21, 20, 6, 0, u('g'), '#1f6a2a')}${yleaf(32, 21, 16, 5.5, 30, u('g'), '#1f6a2a')}
<path d="M20 25C20 18 44 18 44 25C44 37 37 50 32 61C27 50 20 37 20 25Z" fill="${u('c')}" ${yINK}/>
<path d="M36 31H43M21 38H27M37 44H41M26 50H30" stroke="#c0500a" stroke-width="1.8" stroke-linecap="round"/>
<path d="M24 26C24 33 26 40 28.5 46" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></g>`));

const crop_strawberry = Y('crop_strawberry', (id, u) => {
  let seeds = '';
  for (const [x, y] of [[21, 33], [29, 31], [37, 31], [44, 34], [25, 40], [33, 39], [41, 41], [20, 44], [29, 47], [37, 48], [33, 54]]) seeds += `<ellipse cx="${x}" cy="${y}" rx="1.1" ry="1.7"/>`;
  return ysvg(
    yrg(id('b'), ['#ffb8b0', '#ff3a4a', '#a8102a'], '38%', '35%', '75%') + ylg(id('g'), GREEN),
    `<path d="M32 59C19 53 11 41 12 31C13 23 21 19 32 22C43 19 51 23 52 31C53 41 45 53 32 59Z" fill="${u('b')}" ${yINK}/>
<g fill="#fff2a0" stroke="#b0581a" stroke-width=".8">${seeds}</g>
${[110, 150, 210, 250, 180].map((r) => yleaf(32, 22, r === 180 ? 9 : 11, 4.6, r, u('g'))).join('')}
${yln('M32 22C32 16 34 12 38 9', '#4a9a3a', 2.4, 6)}
<path d="M17 32C17 28 19 26 22 25" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>${yspark(53, 12, 3.5)}`);
});

const crop_pumpkin = Y('crop_pumpkin', (id, u) => ysvg(
  ylg(id('p'), ['#ffcf80', '#ff8a1a', '#c24a08']) + ylg(id('l'), GREEN),
  `<path d="M29.5 24C29.5 18 30.5 14 33.5 11L37.5 13.5C35.5 16 34.5 19.5 34.5 24Z" fill="#7a8a2a" ${yINK2}/>
<ellipse cx="19" cy="41" rx="13" ry="15" fill="${u('p')}" ${yINK}/><ellipse cx="45" cy="41" rx="13" ry="15" fill="${u('p')}" ${yINK}/><ellipse cx="32" cy="41" rx="12" ry="17" fill="${u('p')}" ${yINK}/>
<path d="M32 27V55" stroke="#c85a0a" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>
<path d="M36 17C40 10 48 10 52 13C48 18.5 42 20 36 17Z" fill="${u('l')}" ${yINK2}/><path d="M38 16.5C42 15 45 14 49 13.5" stroke="#1f6a2a" stroke-width="1.2" fill="none"/>
${yln('M30 21C26 17.5 22 18.5 22 22C22 24.5 25 25 26 23', '#5ab040', 1.8, 4.6)}
<path d="M10 36C10 31 12 28 15 26.5M25 33C25 30 26.5 28.5 28 27.5" fill="none" stroke="#ffe8c0" stroke-width="2.3" stroke-linecap="round"/>`));

const crop_moonmelon = Y('crop_moonmelon', (id, u) => {
  const a = yaura(id('au'), '#9ad4ff', 32, 36, 30);
  return ysvg(
    a.def + yrg(id('m'), ['#ffffff', '#b8e0ff', '#4a86dc'], '38%', '32%', '78%') + ylg(id('l'), GREEN),
    `${a.el}${yln('M33 20C33 15 34 12 37 9', '#4a9a3a', 2.4, 6)}
<ellipse cx="32" cy="38" rx="23" ry="19" fill="${u('m')}" ${yINK}/>
<path d="M21 21.5C14 29 14 47 21 54.5M43 21.5C50 29 50 47 43 54.5M32 19C27.5 29 27.5 47 32 57" fill="none" stroke="#3a6ac8" stroke-width="2.2" opacity=".55"/>
<path d="M35 31A7.5 7.5 0 1 0 35 45A6 6 0 1 1 35 31Z" fill="#fffbe0" stroke="#3a5ab8" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M36 15C40 9 48 9 52 12C48 17 42 18.5 36 15Z" fill="${u('l')}" ${yINK2}/>
<path d="M14 34C15 28 18.5 24.5 23 22.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>
${yspark(54, 26, 3.5)}${yspark(10, 14, 3, '#d8f0ff')}${yspark(41, 41, 2)}`);
});

const crop_sunfruit = Y('crop_sunfruit', (id, u) => {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 + 22.5) * Math.PI / 180, d = 0.17, P = (t, r) => `${yf(32 + Math.cos(t) * r)} ${yf(37 + Math.sin(t) * r)}`;
    rays += `M${P(a - d, 17)}L${P(a, 28)}L${P(a + d, 17)}Z`;
  }
  return ysvg(
    yrg(id('au'), ['#fff27a/.9', '#ffc030/.35', '#ffa020/0'], '50%', '50%', '50%') + yrg(id('f'), ['#ffffff', '#ffe050', '#f08a10'], '38%', '32%', '78%') + ylg(id('l'), GREEN),
    `<circle cx="32" cy="37" r="27" fill="${u('au')}"/><path d="${rays}" fill="#ffd84a" stroke="#d9800f" stroke-width="1.4" stroke-linejoin="round"/>
<circle cx="32" cy="37" r="17" fill="${u('f')}" ${yINK}/><ellipse cx="38" cy="44" rx="6" ry="4.5" fill="#ff8a2a" opacity=".35"/>
${yln('M32 21C32 17 33 14.5 35 12.5', '#8a5a2a', 2, 5)}${yleaf(33, 20, 13, 5.5, 55, u('l'), '#1f6a2a')}
<path d="M21 34C21.5 29.5 24.5 26 28.5 24.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>${yspark(54, 9, 3.5)}`);
});

const crop_starberry = Y('crop_starberry', (id, u) => {
  const a = yaura(id('au'), '#ff8ad8', 32, 34, 30), star = ystarD(32, 37, 23, 12, 5, Math.PI / 5);
  let seeds = '';
  for (let i = 0; i < 5; i++) {
    const t = (i * 72 + 36 - 90) * Math.PI / 180;
    seeds += `<ellipse cx="${yf(32 + Math.cos(t) * 13)}" cy="${yf(37 + Math.sin(t) * 13)}" rx="1.1" ry="1.6"/>`;
  }
  return ysvg(
    a.def + ylg(id('b'), ['#ffd8f4', '#ff5aaa', '#b0207a']) + ylg(id('g'), GREEN),
    `${a.el}<path d="${star}" fill="none" stroke="${yC}" stroke-width="9" stroke-linejoin="round"/><path d="${star}" fill="${u('b')}" stroke="#ff5aaa" stroke-width="3.6" stroke-linejoin="round"/>
<g fill="#fff4a0" stroke="#a0306a" stroke-width=".8">${seeds}<ellipse cx="32" cy="42" rx="1.1" ry="1.6"/><ellipse cx="27" cy="34" rx="1" ry="1.5"/><ellipse cx="37" cy="34" rx="1" ry="1.5"/></g>
${yleaf(32, 27, 10, 4.4, -62, u('g'))}${yleaf(32, 27, 10, 4.4, 62, u('g'))}${yln('M32 27C32 22 33 19 36 16', '#4a9a3a', 2.2, 5.6)}
<path d="M17 32C18.5 30 20.5 29 23 29" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
${yspark(54, 10, 4)}${yspark(10, 14, 3, '#ffd8f4')}${yspark(32, 38, 2.4)}`);
});

// ---------------------------------------------------------------- farming
const fertilizer = Y('fertilizer', (id, u) => ysvg(
  ylg(id('s'), ['#f6e2b4', '#d4ac70', '#94683a']) + ylg(id('l'), GREEN),
  `<path d="M15 21H49L51 53C51 56.5 49 58 46 58H18C15 58 13 56.5 13 53Z" fill="${u('s')}" ${yINK}/>
<path d="M12 11C20 13 44 13 52 11L49 24C40 26.5 24 26.5 15 24Z" fill="#c89a5e" ${yINK}/><path d="M17 18.5C26 20.5 38 20.5 47 18.5" fill="none" stroke="#7a4a1a" stroke-width="1.6" stroke-dasharray="3 2.4"/>
<circle cx="32" cy="40" r="10.5" fill="#fffbe6" ${yINK2}/>${yleaf(32, 47, 11, 4.4, -38, u('l'), '#1f6a2a')}${yleaf(32, 47, 12, 4.6, 34, u('l'), '#1f6a2a')}
<path d="M18 29V51" stroke="#fff4dc" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>
<g fill="#7a4a24" ${yINK1}><circle cx="55" cy="56" r="2.6"/><circle cx="58.5" cy="51" r="2"/><circle cx="8.5" cy="57" r="2.2"/></g>`));

const watering_can = Y('watering_can', (id, u) => ysvg(
  ylg(id('c'), ['#c8fff0', '#3ac8b0', '#127a6a'], 1, 0) + ylg(id('r'), STEEL),
  `${yln('M18 27C18 13 36 13 36 27', '#2aa890', 3.4)}
${yln('M40 46L53 26', '#3ac8b0', 4.2)}<ellipse cx="54.5" cy="22.5" rx="5" ry="3" transform="rotate(-57 54.5 22.5)" fill="${u('r')}" ${yINK2}/>
<path d="M13 26H41L43 53C43 56 41 58 38 58H16C13 58 11 56 11 53Z" fill="${u('c')}" ${yINK}/>
<rect x="10" y="23" width="34" height="6" rx="3" fill="${u('r')}" ${yINK2}/><path d="M11 50.5H43" stroke="#0e5a4a" stroke-width="1.6" opacity=".55"/>
<path d="M16 33V50" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>
<g fill="#9ae0ff" ${yINK1}><path d="M57 30C58.5 32.5 59.5 34 59.5 35.2A2.5 2.5 0 0 1 54.5 35.2C54.5 34 55.5 32.5 57 30Z"/><path d="M51 34C52.2 36 53 37.2 53 38.2A2 2 0 0 1 49 38.2C49 37.2 49.8 36 51 34Z"/><path d="M58 40C59.2 42 60 43.2 60 44.2A2 2 0 0 1 56 44.2C56 43.2 56.8 42 58 40Z"/></g>
<circle cx="27" cy="41" r="5.5" fill="#fffbe6" ${yINK2}/>${yleaf(27, 45, 7, 3, -35, '#5ad04a')}${yleaf(27, 45, 7, 3, 35, '#5ad04a')}`));

// ---------------------------------------------------------------- potions & elixirs
const GCAP = (gem) => `<path d="M23 9.5C23 6.5 25 5 27.5 5H36.5C39 5 41 6.5 41 9.5V15H23Z" fill="url(#GC)" ${yINK}/><circle cx="32" cy="10" r="2.6" fill="${gem}" stroke="${yC}" stroke-width="1.4"/><path d="M26 8.5H28.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`;
const potion_hp2 = Y('potion_hp2', (id, u) => ysvg(
  ylg(id('l'), ['#ff9a8a', '#f0283a', '#8a0a20']) + ylg(id('g'), GOLD),
  `<rect x="26" y="13" width="12" height="13" fill="#e8f8ff" ${yINK}/>
<circle cx="32" cy="40" r="20" fill="${u('l')}" ${yINK}/><path d="M14.7 30A20 20 0 0 1 49.3 30C44 33 38 30.5 32 32C26 33.5 20 33 14.7 30Z" fill="#ffe0e4" opacity=".5"/><circle cx="32" cy="40" r="20" fill="none" ${yINK}/>
<rect x="24" y="19.5" width="16" height="5.5" rx="2.2" fill="${u('g')}" ${yINK2}/>${GCAP('#ff5a6a').replace('url(#GC)', u('g'))}
<path d="M32 51C26 46.5 23.5 44 23.5 41C23.5 38 27 36.5 29 38.5L32 41.5L35 38.5C37 36.5 40.5 38 40.5 41C40.5 44 38 46.5 32 51Z" fill="#fff4f4" stroke="#7a0a18" stroke-width="1.5" stroke-linejoin="round"/>
<circle cx="42" cy="36" r="2" fill="#fff" opacity=".7"/><circle cx="38.5" cy="31.5" r="1.3" fill="#fff" opacity=".7"/>
<path d="M17 38C17.5 32.5 20.5 29 24.5 27.5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".9"/>${yspark(54, 13, 3.5)}`));

const potion_mp2 = Y('potion_mp2', (id, u) => {
  const fl = 'M26.5 14H37.5V26L52 51.5C54.5 55.5 51.5 59 46.5 59H17.5C12.5 59 9.5 55.5 12 51.5L26.5 26Z';
  return ysvg(
    ylg(id('l'), ['#8ae0ff', '#2a8aff', '#1a3ab8']) + ylg(id('g'), GOLD),
    `<path d="${fl}" fill="${u('l')}" ${yINK}/><path d="M26.5 14H37.5V26L42.2 34.3C37 36.5 31 33 21.8 34.3L26.5 26Z" fill="#e0f4ff" opacity=".55"/><path d="${fl}" fill="none" ${yINK}/>
<rect x="24" y="20" width="16" height="5.5" rx="2.2" fill="${u('g')}" ${yINK2}/>${GCAP('#7ae8ff').replace('url(#GC)', u('g'))}
<path d="M17 51L22 41.5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".9"/>
${yspark(35, 46, 6, '#f0faff')}${yspark(28, 53, 3, '#cfeaff')}<circle cx="40" cy="40" r="1.6" fill="#fff" opacity=".7"/>${yspark(54, 13, 3.5)}`);
});

// ornate tier-3 bottles: winged, gold collar and crown cap
const ornate = (key, body, glass, liq, gem, au, emblem) => Y(key, (id, u) => {
  const a = yaura(id('au'), au);
  return ysvg(
    a.def + ylg(id('l'), liq) + ylg(id('g'), GOLD) + ylg(id('w'), ['#ffffff', '#fff2c0', '#f0b830']),
    `${a.el}${ymirror(`<path d="M18 31C11 26 4 27 1.5 32C5 33 6 34 7 36C3 37 2 40 2 43C6 42 8 42 10 43C8 45 8 48 9 50C13 47 16 46 19 45Z" fill="${u('w')}" ${yINK2}/><path d="M6 39C9 38.5 12 38.5 15 39.5" stroke="#f0b830" stroke-width="1.3" fill="none" stroke-linecap="round"/>`)}
<rect x="27" y="12" width="10" height="13" fill="#e8f8ff" ${yINK}/>
<path d="${body}" fill="${u('l')}" ${yINK}/>${glass}<path d="${body}" fill="none" ${yINK}/>${emblem}
<rect x="24.5" y="17.5" width="15" height="5" rx="2" fill="${u('g')}" ${yINK2}/>
<path d="M25 13.5C25 9 28 6.5 32 6.5C36 6.5 39 9 39 13.5Z" fill="${u('g')}" ${yINK2}/><circle cx="32" cy="4.6" r="2.4" fill="${u('g')}" ${yINK2}/><circle cx="32" cy="11" r="2.1" fill="${gem}" stroke="${yC}" stroke-width="1.2"/>
${yspark(55, 9, 4)}${yspark(9, 14, 3)}`);
});
const potion_hp3 = ornate('potion_hp3',
  'M32 58C20 50 11 42.5 11 32C11 24 16.5 19 22.5 19C27 19 30 21.5 32 24.5C34 21.5 37 19 41.5 19C47.5 19 53 24 53 32C53 42.5 44 50 32 58Z',
  '<path d="M17 33C17 28 19.5 25 23 24.5" fill="none" stroke="#fff" stroke-width="2.8" stroke-linecap="round" opacity=".9"/>',
  ['#ff9aa0', '#f0203a', '#80081e'], '#ff5a6a', '#ff6a7a',
  `<path d="M32 49C25.5 44.5 22 41 22 36.5C22 33 24.5 31 27.2 31C29.4 31 31 32.4 32 34.2C33 32.4 34.6 31 36.8 31C39.5 31 42 33 42 36.5C42 41 38.5 44.5 32 49Z" fill="#ffe4e8" stroke="#ffcc33" stroke-width="2.4" stroke-linejoin="round"/><path d="M25.5 35C26 33.5 27 33 28 33" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>${yspark(41.5, 46.5, 2.4)}`);
const potion_mp3 = ornate('potion_mp3',
  'M26 21H38L51.5 35.5L32 59L12.5 35.5Z',
  '<path d="M26 21H38L51.5 35.5H12.5Z" fill="#e0f4ff" opacity=".35"/><path d="M17.5 36L28 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"/><path d="M12.5 35.5H51.5M26 21L22 35.5L32 59L42 35.5L38 21" fill="none" stroke="#24160f" stroke-width="1.3" stroke-linejoin="round" opacity=".45"/>',
  ['#a8ecff', '#2a7aff', '#141e9a'], '#7ae8ff', '#5ab4ff',
  `<path d="${ystarD(32, 40, 8.5, 3.8)}" fill="#fff7b8" stroke="#ffcc33" stroke-width="1.8" stroke-linejoin="round"/>`);

const empty_vial = Y('empty_vial', (id, u) => ysvg(
  ylg(id('g'), ['#ffffff/.95', '#e4f6ff/.7', '#b4dcff/.85'], 1, 0) + ylg(id('k'), WOOD),
  `<g transform="rotate(-18 32 34)"><path d="M25 16H39V49C39 54 36 58 32 58C28 58 25 54 25 49Z" fill="${u('g')}" ${yINK}/>
<rect x="22" y="12.5" width="20" height="5" rx="2.5" fill="#e8f8ff" ${yINK2}/><rect x="26" y="4.5" width="12" height="9" rx="2" fill="${u('k')}" ${yINK2}/>
<path d="M28.5 22V47" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M35.5 44C35.5 49 34 52 32 53" fill="none" stroke="#bfe6ff" stroke-width="1.6" stroke-linecap="round"/>
<path d="M29 5.5V12" stroke="#ffd8a8" stroke-width="1.4" stroke-linecap="round"/></g>${yspark(50, 44, 3, '#e0f4ff')}${yspark(14, 22, 2.4, '#e0f4ff')}`));

const ELIX = 'M26 13H38V20C44.5 21.5 49 25.5 49 31.5V50C49 55 45 58 40 58H24C19 58 15 55 15 50V31.5C15 25.5 19.5 21.5 26 20Z';
const elixir = (key, liq, au, emblem) => Y(key, (id, u) => {
  const a = yaura(id('au'), au);
  return ysvg(
    a.def + ylg(id('l'), liq) + ylg(id('g'), GOLD) + yrg(id('b'), ['#ffffff', '#fff6dc', '#ead2a0']),
    `${a.el}<path d="${ELIX}" fill="${u('l')}" ${yINK}/><path d="M26 13H38V20C44.5 21.5 49 25.5 49 31.5V33C40 29.5 24 35.5 15 33V31.5C15 25.5 19.5 21.5 26 20Z" fill="#fff" opacity=".35"/><path d="${ELIX}" fill="none" ${yINK}/>
<rect x="23.5" y="16.5" width="17" height="5" rx="2" fill="${u('g')}" ${yINK2}/>
<path d="M32 2.5L38.5 9L32 15L25.5 9Z" fill="${u('g')}" ${yINK2}/><path d="M32 5.5L35 9L32 12" fill="none" stroke="#fff7b8" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="32" cy="43" r="10" fill="${u('b')}" ${yINK2}/>${emblem}
<path d="M19.5 35V50" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>${yspark(55, 13, 3.5)}`);
});
const elixir_might = elixir('elixir_might', ['#ffc070', '#ff5a1a', '#b01a0a'], '#ff6a2a',
  `<path d="M32 34L34.2 36.8V45H29.8V36.8Z" fill="#eef4fc" ${yINK1}/><path d="M32 37V44" stroke="#9aaac8" stroke-width="1"/><rect x="26.5" y="44.5" width="11" height="3" rx="1.4" fill="#ffcc33" ${yINK1}/><rect x="30.8" y="47.5" width="2.4" height="3.6" fill="#7a3a1a" ${yINK1}/><circle cx="32" cy="52" r="1.4" fill="#ffcc33" ${yINK1}/>`);
const elixir_iron = elixir('elixir_iron', ['#eef2f8', '#8a96ac', '#3e4860'], '#b8c8e0',
  `<path d="M32 34.5L39.5 37V42.5C39.5 46.5 36.5 49.5 32 51.5C27.5 49.5 24.5 46.5 24.5 42.5V37Z" fill="#a8b8d0" ${yINK1}/><path d="M32 37.5V48.5M27 41.5H37" stroke="#ffcc33" stroke-width="2" stroke-linecap="round"/><path d="M26.8 38.5V42.5" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>`);
const elixir_swift = elixir('elixir_swift', ['#d8ffb0', '#3ac860', '#127a3a'], '#6aff8a',
  `<path d="M39 34C30.5 35 25.5 41.5 25 51C30.5 49 37.5 43.5 39 34Z" fill="#8ae87a" ${yINK1}/><path d="M24 52.5L37 37M29.5 43.5L27 41M32.5 40L30.5 37.5M30 45.5L33 46.5" fill="none" stroke="${yC}" stroke-width="1.2" stroke-linecap="round"/>`);
const elixir_wisdom = elixir('elixir_wisdom', ['#ecc8ff', '#9a5af0', '#4a1aa8'], '#c08aff',
  `<path d="M24 45.5C27 44 30 44 32 46C34 44 37 44 40 45.5V51C37 49.5 34 49.5 32 51.5C30 49.5 27 49.5 24 51Z" fill="#fff" ${yINK1}/><path d="M32 46V51" stroke="${yC}" stroke-width="1.1"/><path d="${ystarD(32, 39.5, 6, 2.6)}" fill="#c88aff" ${yINK1}/>`);
const elixir_fortune = elixir('elixir_fortune', ['#fff7b8', '#ffcc33', '#c8700a'], '#ffd84a',
  `<circle cx="32" cy="44" r="6.8" fill="#b8650a" ${yINK1}/><circle cx="32" cy="42.8" r="6.8" fill="#ffd84a" ${yINK1}/><circle cx="32" cy="42.8" r="4.2" fill="none" stroke="#d9800f" stroke-width="1.2"/><path d="${ystarD(32, 43, 2.8, 1.2)}" fill="#fff7b8"/>`);

const phoenix_draught = Y('phoenix_draught', (id, u) => {
  const a = yaura(id('au'), '#ff8a2a');
  return ysvg(
    a.def + ylg(id('l'), ['#fff2a0', '#ff8a1a', '#c0220a']) + ylg(id('f'), ['#fff6c0', '#ffb02a', '#ff4a1a']) + ylg(id('g'), GOLD) + ylg(id('fe'), ['#fff27a', '#ff6a1a', '#c01a2a']),
    `${a.el}<path d="${yflameD(30, 21, 20, 10)}" fill="${u('f')}" ${yINK2}/><path d="${yflameD(30, 20, 10, 5)}" fill="#fff6c0"/>
<rect x="24.5" y="16" width="11" height="11" fill="#ffe8d0" ${yINK}/><circle cx="30" cy="42" r="17" fill="${u('l')}" ${yINK}/>
<path d="${yflameD(30, 54, 17, 8)}" fill="#fff2a0" opacity=".75"/><rect x="22.5" y="20.5" width="15" height="5" rx="2" fill="${u('g')}" ${yINK2}/>
<path d="M16.5 40C17 34.5 20 31 24 29.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".9"/>
<g transform="rotate(28 50 42)"><path d="M50 61C44.5 51 44.5 35 50.5 22C56.5 35 56 51 50 61Z" fill="${u('fe')}" ${yINK2}/>
<path d="M50 63V27M46.5 44L50 47.5M54 39L50.3 42.5M46.6 36L50.2 39.5M53.6 48L50 51.5" fill="none" stroke="${yC}" stroke-width="1.3" stroke-linecap="round"/></g>
${yspark(13, 13, 3.5, '#fff2a0')}<circle cx="45" cy="10" r="1.6" fill="#ffb02a"/><circle cx="18" cy="24" r="1.3" fill="#ff6a1a"/>`);
});

// ---------------------------------------------------------------- misc items
const yscroll = (u, paper, roll, cap) => `<rect x="15" y="14" width="34" height="36" fill="${paper}" ${yINK}/>
<rect x="10" y="8" width="44" height="9" rx="4.5" fill="${roll}" ${yINK}/><rect x="10" y="47" width="44" height="9" rx="4.5" fill="${roll}" ${yINK}/>
<rect x="7" y="9.5" width="5" height="6" rx="2" fill="${cap}" ${yINK2}/><rect x="52" y="9.5" width="5" height="6" rx="2" fill="${cap}" ${yINK2}/><rect x="7" y="48.5" width="5" height="6" rx="2" fill="${cap}" ${yINK2}/><rect x="52" y="48.5" width="5" height="6" rx="2" fill="${cap}" ${yINK2}/>
<path d="M15 11H30M15 50H28" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>`;
const bag_scroll = Y('bag_scroll', (id, u) => ysvg(
  ylg(id('p'), PARCH) + ylg(id('b'), WOOD) + ylg(id('k'), GOLD) + yrg(id('g'), ['#d8ffb0', '#4ad04a', '#1f8a3a'], '40%', '35%', '75%'),
  `${yscroll(u, u('p'), '#e8c890', u('k'))}
${yln('M28 22.5C28 18.5 36 18.5 36 22.5', '#b0642c', 2, 4.6)}<rect x="22.5" y="21" width="19" height="22" rx="5" fill="${u('b')}" ${yINK2}/>
<path d="M22.5 28C22.5 25 24.5 23.2 27.5 23.2H36.5C39.5 23.2 41.5 25 41.5 28V30C41.5 32 37.5 33.2 32 33.2C26.5 33.2 22.5 32 22.5 30Z" fill="#e0a060" ${yINK2}/>
<rect x="29.5" y="30.5" width="5" height="5" rx="1.2" fill="${u('k')}" ${yINK1}/><rect x="25.5" y="36.5" width="13" height="4.5" rx="1.6" fill="#8a4520"/>
<circle cx="47" cy="45" r="9.5" fill="${u('g')}" ${yINK}/><path d="M47 40V50M42 45H52" stroke="${yC}" stroke-width="6" stroke-linecap="round"/><path d="M47 40V50M42 45H52" stroke="#fff" stroke-width="3" stroke-linecap="round"/>`));

const teleport_scroll = Y('teleport_scroll', (id, u) => {
  const a = yaura(id('au'), '#6ac8ff');
  return ysvg(
    a.def + ylg(id('p'), ['#f0faff', '#a8daff', '#5a96e8']) + ylg(id('r'), ['#8ab8ff', '#3a5ad8', '#1a2a8a']) + yrg(id('v'), ['#ffffff', '#9ae8ff/.9', '#4a8aff/0'], '50%', '50%', '50%'),
    `${a.el}${yscroll(u, u('p'), u('r'), '#ffcc33')}
<circle cx="32" cy="32" r="13" fill="${u('v')}"/>
${yln('M30 32a2 2 0 0 1 4 0a4 4 0 0 1-8 0a6 6 0 0 1 12 0a8 8 0 0 1-16 0a10 10 0 0 1 20 0', '#3a4ae0', 2.4, 5)}
<circle cx="32" cy="32" r="1.6" fill="#fff"/>${yspark(52, 32, 3, '#e0f8ff')}${yspark(11, 33, 2.4, '#e0f8ff')}`);
});

const pet_treat = Y('pet_treat', (id, u) => {
  const bone = '<circle cx="13" cy="27" r="7"/><circle cx="13" cy="39" r="7"/><circle cx="51" cy="27" r="7"/><circle cx="51" cy="39" r="7"/><rect x="13" y="27" width="38" height="12"/>';
  return ysvg(
    ylg(id('i'), PINK),
    `<g transform="rotate(-24 32 33)"><g fill="${yC}" stroke="${yC}" stroke-width="6" stroke-linejoin="round">${bone}</g><g fill="#e6a45a">${bone}</g>
<path d="M8 24C9 21.5 11.5 20.5 14 21M46 24C47 21.5 49.5 20.5 52 21M20 29.5H44" fill="none" stroke="#ffe0b0" stroke-width="2.2" stroke-linecap="round"/>
<path d="M19 30.5C24 29 40 29 45 30.5C46 33 46 36 45 37C43 36 42 39.5 40 38.5C38 37.5 37 40 35 39C33 38 31 40.5 29 39C27 37.5 25 40 23.5 38.5C22 37 20.5 37.5 19 37C18 35 18 33 19 30.5Z" fill="${u('i')}" ${yINK2}/>
<g stroke-width="1.6" stroke-linecap="round"><path d="M24 33L26 32.4" stroke="#fff"/><path d="M30 34.5L31.5 33" stroke="#4cb4ff"/><path d="M36 32.6L38 33.4" stroke="#ffcc33"/><path d="M40.5 35.2L42 34" stroke="#5ad04a"/></g>
<g fill="#c87a3a"><circle cx="10" cy="39" r="1"/><circle cx="54" cy="27" r="1"/><circle cx="16" cy="25" r=".9"/></g></g>
${yspark(53, 49, 3.5)}${yspark(11, 13, 3, '#ffe3f1')}`);
});

const crimson_core = Y('crimson_core', (id, u) => {
  const a = yaura(id('au'), '#ff2a3a');
  let riv = '';
  for (let i = 0; i < 8; i++) { const t = (i * 45 + 22.5) * Math.PI / 180; riv += `<circle cx="${yf(32 + Math.cos(t) * 19.5)}" cy="${yf(32 + Math.sin(t) * 19.5)}" r="1.5"/>`; }
  return ysvg(
    a.def + ylg(id('r'), ['#8a7488', '#3e2a3c', '#160c16'], 1, 1) + yrg(id('t'), ['#ffffff', '#ff6a6a', '#b0101e'], '40%', '35%', '75%'),
    `${a.el}<circle cx="32" cy="32" r="23.5" fill="${u('r')}" ${yINK}/><g fill="#b8a0b4" stroke="${yC}" stroke-width="1">${riv}</g>
<circle cx="32" cy="32" r="16.5" fill="#1a080e" ${yINK2}/>${yoct(32, 32, 15, 7.5, ['#ffb0b0', '#ff3a4a', '#8a0a1e'], u('t'))}
<path d="M15 21A19 19 0 0 1 26 13" fill="none" stroke="#c8b0c4" stroke-width="2.2" stroke-linecap="round"/>${yglint(28.5, 28, 1.3, 2.6, 40)}
${yspark(55, 9, 4, '#ffd0d0')}${yspark(9, 54, 3, '#ff9a9a')}`);
});

const ANVIL = 'M4 25C11 26.5 15 28 19 28H55V37H47C43 38 41 41 41 46V49H47L50 59H14L17 49H23V46C23 41 21 39 17 38C11 37 6 33 4 25Z';
const red_forge = Y('red_forge', (id, u) => {
  const a = yaura(id('au'), '#ff2a3a', 32, 34, 30);
  return ysvg(
    a.def + ylg(id('i'), ['#7a6a7a', '#3e3040', '#1c141c']) + yrg(id('h'), ['#fff6d0', '#ff5a3a', '#a00a1a'], '50%', '30%', '80%'),
    `${a.el}<path d="${ANVIL}" fill="${u('i')}" ${yINK}/><path d="M19 31.5H53" stroke="#ff6a5a" stroke-width="2.4" stroke-linecap="round"/><path d="M8 28.5C11 29.5 14 30.5 17 31" stroke="#ff9a8a" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>
<path d="M20 37H54" stroke="${yC}" stroke-width="1.6" opacity=".5"/><path d="M26 47.5H38" stroke="#8a6a8a" stroke-width="1.6" stroke-linecap="round"/>
<path d="M24 28L28 19.5H46L50 28Z" fill="${u('h')}" ${yINK}/><path d="M29.5 22H43" stroke="#fff6d0" stroke-width="1.8" stroke-linecap="round"/>
${yspark(17, 13, 5.5, '#ff4a3a')}${yspark(54, 11, 4, '#ff9a8a')}${yspark(36, 8, 3.2, '#ffb08a')}
<circle cx="24" cy="10" r="1.6" fill="#ff6a5a"/><circle cx="46" cy="14" r="1.4" fill="#ffd0a0"/><circle cx="10" cy="20" r="1.3" fill="#ff3a3a"/>`);
});

const mythic_badge = Y('mythic_badge', (id, u) => {
  const a = yaura(id('au'), '#ff3a5a');
  return ysvg(
    a.def + ylg(id('g'), GOLD, 1, 1) + ylg(id('e'), ['#c8203a', '#7a0a1e']) + yrg(id('t'), ['#ffffff', '#ff6a7a', '#b0102a'], '40%', '35%', '75%'),
    `${a.el}<path d="M32 3L42 10L54 7L52 21V32C52 45 43 53 32 60C21 53 12 45 12 32V21L10 7L22 10Z" fill="${u('g')}" ${yINK}/>
<path d="M32 10L41 15.5L47.5 14V32C47.5 42 40.5 49 32 54C23.5 49 16.5 42 16.5 32V14L23 15.5Z" fill="${u('e')}" ${yINK2}/>
${yoct(32, 32, 11.5, 5.8, ['#ffc0c8', '#ff3a52', '#8a0a22'], u('t'))}${yglint(29, 29, 1.1, 2.2, 40)}
<circle cx="32" cy="49" r="2" fill="#ffcc33" ${yINK1}/><circle cx="10" cy="7" r="2.6" fill="#fff7b8" ${yINK1}/><circle cx="54" cy="7" r="2.6" fill="#fff7b8" ${yINK1}/><circle cx="32" cy="3.5" r="2.6" fill="#ff5a6a" ${yINK1}/>
<path d="M15.5 23V31C15.5 35 16.5 38 18 41" fill="none" stroke="#fff7b8" stroke-width="1.8" stroke-linecap="round" opacity=".8"/>${yspark(57, 44, 3.5)}${yspark(7, 46, 3, '#ffd0d8')}`);
});

// ---------------------------------------------------------------- tools (drawn upright, wrap in a transform)
const ypick = (w, s) => `<rect x="29.5" y="14" width="5" height="46" rx="2.2" fill="${w}" ${yINK2}/><path d="M4 26C13 13 51 13 60 26L58.5 28C49 20.5 15 20.5 5.5 28Z" fill="${s}" ${yINK2}/>` +
  `<rect x="27" y="13" width="10" height="11" rx="2" fill="${s}" ${yINK2}/><path d="M11 21.5C18 17.5 25 16.5 28 16.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`;
const ysickle = (w, s) => `<rect x="29.5" y="38" width="5" height="22" rx="2.2" fill="${w}" ${yINK2}/><rect x="28.5" y="35" width="7" height="5.5" rx="1.5" fill="${s}" ${yINK2}/>` +
  `<path d="M31 37C18 34 12 21 21 12C27 6 38 5 47 9C37 9 28 13 26 20C24 27 28 33 34 36Z" fill="${s}" ${yINK2}/><path d="M21.5 16C25 11.5 31 9 37 8.5" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`;
const yhammer = (w, s) => `<rect x="29.5" y="20" width="5" height="39" rx="2.2" fill="${w}" ${yINK2}/><rect x="16" y="8" width="32" height="14" rx="3" fill="${s}" ${yINK}/>` +
  `<path d="M22 8.5V21.5M42 8.5V21.5" stroke="${yC}" stroke-width="1.5" opacity=".45"/><path d="M19.5 11.5H44.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`;
const yaxe = (w, s) => `<rect x="29.5" y="7" width="5" height="53" rx="2.2" fill="${w}" ${yINK2}/><path d="M31 10C24 8 15 8.5 9.5 12.5C6.5 19 6.5 27 9.5 33.5C15 30 23 28 31 28Z" fill="${s}" ${yINK2}/>` +
  `<rect x="28" y="9" width="10" height="17" rx="2" fill="${s}" ${yINK2}/><path d="M12 15C11.2 19 11.2 24 12.2 28" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none"/>`;
const yhoe = (w, s) => `<rect x="29.5" y="10" width="5" height="50" rx="2.2" fill="${w}" ${yINK2}/><path d="M28 6.5H50V11H28Z" fill="${s}" ${yINK2}/>` +
  `<path d="M44.5 9H51L54 26.5H42Z" fill="${s}" ${yINK2}/><path d="M46.5 12L45.6 23" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`;
// small faceted gem, colors [light, mid, dark]
const ymini = (cx, cy, s, [lt, md, dk]) => {
  const p = (x, y) => `${yf(cx + x * s)} ${yf(cy + y * s)}`, top = `M${p(-1, -0.25)}L${p(-0.55, -0.85)}L${p(0.55, -0.85)}L${p(1, -0.25)}`;
  return `<path d="${top}L${p(0, 1)}Z" fill="${md}"/><path d="${top}Z" fill="${lt}"/><path d="M${p(0.25, -0.25)}L${p(1, -0.25)}L${p(0, 1)}Z" fill="${dk}"/>` +
    `<path d="M${p(-1, -0.25)}L${p(1, -0.25)}" stroke="${yC}" stroke-width="1.3"/><path d="${top}L${p(0, 1)}Z" fill="none" ${yINK2}/>` +
    `<circle cx="${yf(cx - 0.4 * s)}" cy="${yf(cy - 0.52 * s)}" r="${yf(s * 0.15)}" fill="#fff"/>`;
};
const yleafG = (id) => ylg(id('l'), GREEN);
const ycoin = (x, y, r, fill) => `<circle cx="${x}" cy="${y + r * 0.2}" r="${r}" fill="#b8650a" ${yINK2}/><circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${yINK2}/><circle cx="${x}" cy="${y}" r="${yf(r * 0.66)}" fill="none" stroke="#d9800f" stroke-width="1.4"/><path d="${ystarD(x, y + 0.3, r * 0.45, r * 0.2)}" fill="#fff2a0"/>`;

// ---------------------------------------------------------------- UI / activity icons
const auction = Y('auction', (id, u) => ysvg(
  ylg(id('h'), GOLD) + ylg(id('w'), WOOD, 1, 0) + ylg(id('b'), ['#d89050', '#9a5a26', '#5a2c10']),
  `<path d="M6 47V51.5C6 55 15.5 58 27 58C38.5 58 48 55 48 51.5V47Z" fill="${u('b')}" ${yINK}/><ellipse cx="27" cy="47" rx="21" ry="6.5" fill="#eab474" ${yINK}/><ellipse cx="27" cy="47" rx="13" ry="3.6" fill="none" stroke="#b07a3a" stroke-width="1.6"/>
<g transform="rotate(-38 38 30)"><rect x="35" y="31" width="6" height="32" rx="2.6" fill="${u('w')}" ${yINK2}/><rect x="22" y="16" width="32" height="15" rx="4" fill="${u('h')}" ${yINK}/>
<rect x="25.5" y="14.5" width="5" height="18" rx="1.6" fill="#e8960f" ${yINK2}/><rect x="45.5" y="14.5" width="5" height="18" rx="1.6" fill="#e8960f" ${yINK2}/><path d="M32 19.5H43" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>
${yln('M6 32L10.5 36.5M12.5 25.5L15 31.5M4 41H9.5', '#fff7b8', 2, 5)}${yspark(54, 10, 4)}`));

const wardrobe = Y('wardrobe', (id, u) => ysvg(
  ylg(id('w'), WOOD) + ylg(id('d'), ['#f2b878', '#c47436', '#8a4518'], 1, 0) + ylg(id('p'), PINK) + ylg(id('b'), BLUE),
  `${ymirror(`<path d="M16 9L4 13V55L16 59Z" fill="${u('d')}" ${yINK}/><path d="M7 18.5L13 16.5V31L7 33ZM7 37.5L13 35.5V50.5L7 52.5Z" fill="#8a4518" opacity=".45"/><circle cx="12.5" cy="34" r="1.5" fill="#ffcc33" ${yINK1}/>`)}
<rect x="15" y="8" width="34" height="51" rx="2" fill="${u('w')}" ${yINK}/><rect x="19" y="13" width="26" height="42" fill="#3a1e10" ${yINK2}/>
<path d="M19 17H45" stroke="#c8d0e0" stroke-width="2"/><path d="M25 17V20M38 17V20" stroke="#e8eef8" stroke-width="1.4"/>
<path d="M20 23L25 20L30 23" fill="none" stroke="#e8eef8" stroke-width="1.6" stroke-linejoin="round"/><path d="M20 23L25 25L30 23L32 28.5L29.5 29.5V43H20.5V29.5L18 28.5Z" fill="${u('b')}" ${yINK1}/>
<path d="M32.5 23L38 20L43.5 23" fill="none" stroke="#e8eef8" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M34 22.5L38 25L42 22.5L43 30H33Z" fill="${u('p')}" ${yINK1}/><path d="M33 30H43L48 51C42 53.5 34 53.5 28 51Z" fill="${u('p')}" ${yINK1}/><rect x="32.5" y="29" width="11" height="3" rx="1.2" fill="#ffcc33" ${yINK1}/>
<path d="M30 49C35 51 41 51 46.5 49" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round"/>
<rect x="12" y="4.5" width="40" height="6" rx="2" fill="${u('w')}" ${yINK2}/><path d="M18 59V62M46 59V62" stroke="${yC}" stroke-width="3" stroke-linecap="round"/>${yspark(58, 6, 3)}`));

const farm = Y('farm', (id, u) => ysvg(
  ylg(id('r'), ['#ff8a7a', '#d8342a', '#8a1418']) + yleafG(id) + ylg(id('g'), ['#a8f07a', '#4ab040', '#2a7a2a']),
  `<path d="M3 55C14 50.5 50 50.5 61 55V60H3Z" fill="${u('g')}" ${yINK2}/>
<path d="M14 56V31L20.5 19H43.5L50 31V56Z" fill="${u('r')}" ${yINK}/>${yln('M10.5 33L19.5 16.5H44.5L53.5 33', '#6a2a1a', 3.6)}
<rect x="24" y="38" width="16" height="18" fill="#b0241e" ${yINK2}/><path d="M25.5 39.5L38.5 54.5M38.5 39.5L25.5 54.5" stroke="#fff6e8" stroke-width="2"/><rect x="25.5" y="39.5" width="13" height="15" fill="none" stroke="#fff6e8" stroke-width="2"/>
<rect x="28" y="24" width="8" height="8" rx="1" fill="#fff6dc" ${yINK2}/><path d="M32 24.5V31.5M28.5 28H35.5" stroke="#b07a3a" stroke-width="1.3"/>
<path d="M17.5 34V52" stroke="#ffb0a0" stroke-width="2" stroke-linecap="round" opacity=".8"/>
${yln('M9 55C9 50 9.5 47 11.5 44.5', '#4aa040', 2, 5)}${yleaf(11.5, 45, 10, 4.2, -58, u('l'), '#1f6a2a')}${yleaf(11.5, 45, 11, 4.4, 42, u('l'), '#1f6a2a')}
${yspark(55, 10, 4, '#fff7b8')}`));

const gather = Y('gather', (id, u) => ysvg(
  ylg(id('w'), WOOD, 1, 0) + ylg(id('s'), STEEL),
  `<g transform="rotate(-40 32 34)">${ypick(u('w'), u('s'))}</g><g transform="rotate(36 32 34) matrix(-1 0 0 1 64 0)">${ysickle(u('w'), u('s'))}</g>${yspark(32, 54, 3.5, '#fff7b8')}`));

const alchemy = Y('alchemy', (id, u) => ysvg(
  ylg(id('l'), ['#e8ffb0', '#6ad84a', '#1f8a3a']) + ylg(id('f'), ['#fff6c0', '#ffb02a', '#ff4a1a']) + ylg(id('m'), IRON) + ylg(id('g'), ['#ffffff/.85', '#e0f4ff/.6']),
  `<path d="${yflameD(32, 61, 13, 8)}" fill="${u('f')}" ${yINK2}/><path d="${yflameD(32, 60, 6, 4)}" fill="#fff6c0"/>
${yln('M19 59L23.5 46M45 59L40.5 46', '#7a86a0', 2.2, 5.6)}
<rect x="27" y="10" width="10" height="13" fill="${u('g')}" ${yINK}/><circle cx="32" cy="33" r="15" fill="${u('g')}" ${yINK}/>
<path d="M17.1 31C22 29 26 33 32 31C38 29 42 33 46.9 31A15 15 0 1 1 17.1 31Z" fill="${u('l')}"/><circle cx="32" cy="33" r="15" fill="none" ${yINK}/>
<g fill="#f0ffd8"><circle cx="27" cy="40" r="2.6"/><circle cx="36" cy="36" r="1.8"/><circle cx="38" cy="43" r="1.3"/></g>
<rect x="25" y="7.5" width="14" height="4.5" rx="2" fill="#e8f8ff" ${yINK2}/><ellipse cx="32" cy="47.5" rx="12" ry="3" fill="${u('m')}" ${yINK2}/>
<g fill="#c8ffa0" ${yINK1}><circle cx="41" cy="5" r="2.4"/><circle cx="46" cy="11" r="1.6"/><circle cx="23" cy="4" r="1.6"/></g>
<path d="M20.5 30C21.5 26 24 23.5 27 22.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>${yspark(54, 26, 3.5, '#e8ffb0')}`));

const professions = Y('professions', (id, u) => ysvg(
  ylg(id('c'), ['#d08c50', '#8a4a22', '#4e2410'], 1, 1) + ylg(id('p'), PARCH) + ylg(id('g'), GOLD),
  `<rect x="17" y="9" width="36" height="49" rx="3" fill="${u('p')}" ${yINK}/><path d="M50.5 13V54M17 55H49" stroke="#c99a5c" stroke-width="1.4"/>
<rect x="11" y="5" width="38" height="49" rx="4" fill="${u('c')}" ${yINK}/><path d="M17 6.5V52.5" stroke="#3a1a08" stroke-width="2.4"/>
<path d="M38 5H45C47 5 49 7 49 9V16ZM38 54H45C47 54 49 52 49 50V43Z" fill="${u('g')}" ${yINK2}/>
<circle cx="33" cy="29.5" r="12.5" fill="${u('g')}" ${yINK2}/><circle cx="33" cy="29.5" r="9.6" fill="#fff6dc" stroke="#d9800f" stroke-width="1.4"/>
${yln('M27 36L38.5 24.5', '#b0642c', 1.8, 4.2)}${yln('M39 36L27.5 24.5', '#b0642c', 1.8, 4.2)}
${yln('M34.5 21.5Q40.5 21.5 42 28', '#cfdcef', 2.2, 4.8)}<rect x="23.5" y="21" width="8" height="4.6" rx="1" transform="rotate(45 27.5 23.3)" fill="#cfdcef" ${yINK1}/>
<path d="M13.8 10V22" stroke="#ffd8a8" stroke-width="2" stroke-linecap="round"/><path d="M40 54V62L42.5 59.5L45 62V54Z" fill="#3a8ad8" ${yINK2}/>`));

const mining = Y('mining', (id, u) => ysvg(
  ylg(id('w'), WOOD, 1, 0) + ylg(id('s'), STEEL) + ylg(id('t'), ['#d8d4e0', '#a8a2b8']),
  `${ynug(17, 47, 13, ['#e0dce8', '#9a94a8', '#5a5468'], u('t'))}${ymini(15.5, 46, 4.6, ['#c8f4ff', '#4cb4ff', '#2251d1'])}
<g transform="rotate(-42 36 30) translate(3 -4)">${ypick(u('w'), u('s'))}</g>
${yspark(8, 26, 3.5, '#fff7b8')}${yspark(30, 33, 2.6, '#fff7b8')}<circle cx="27" cy="27" r="1.4" fill="#ffd84a"/>`));

const herbalism = Y('herbalism', (id, u) => ysvg(
  ylg(id('w'), WOOD, 1, 0) + ylg(id('s'), STEEL) + yleafG(id),
  `<g transform="rotate(26 32 32) translate(6 -2)">${ysickle(u('w'), u('s'))}</g>
${yln('M14 60C14 52 15 46 17 41', '#4aa040', 2.4, 6)}${yleaf(15, 54, 20, 8, -40, u('l'), '#1f6a2a')}${yleaf(15.5, 50, 22, 8.5, 6, u('l'), '#1f6a2a')}${yleaf(16, 52, 16, 6.5, 50, u('l'), '#1f6a2a')}
${yspark(52, 52, 3.5, '#d8ffb0')}`));

const logging = Y('logging', (id, u) => ysvg(
  ylg(id('b'), ['#c88a52', '#8a5228', '#4e2a10'], 1, 0) + yrg(id('f'), ['#fff0d0', '#e8c088', '#b8864a'], '45%', '40%', '70%') + ylg(id('w'), WOOD, 1, 0) + ylg(id('s'), STEEL),
  `<path d="M10 42C10 47 9 53 4 59H60C55 53 54 47 54 42Z" fill="${u('b')}" ${yINK}/><path d="M18 48V57M30 50V59M43 48V57" stroke="${yC}" stroke-width="1.5" stroke-linecap="round" opacity=".45"/>
<ellipse cx="32" cy="42" rx="22" ry="8" fill="${u('f')}" ${yINK}/><ellipse cx="32" cy="42" rx="14" ry="5" fill="none" stroke="#b07a3a" stroke-width="1.4"/><ellipse cx="32" cy="42" rx="6.5" ry="2.3" fill="none" stroke="#b07a3a" stroke-width="1.3"/>
<g transform="translate(-1.5 -8) rotate(-110 32 32) translate(32 32) scale(.85) translate(-32 -32)">${yaxe(u('w'), u('s'))}</g>
<path d="M8 33L12 31L11 35Z" fill="#e8c088" ${yINK1}/><path d="M54 30L58 31L55 34Z" fill="#e8c088" ${yINK1}/>`));

const farming = Y('farming', (id, u) => ysvg(
  ylg(id('w'), WOOD, 1, 0) + ylg(id('s'), STEEL) + yleafG(id) + ylg(id('d'), ['#b07a4a', '#7a4a24', '#4a2a10']),
  `<g transform="rotate(-24 32 32) translate(8 0)">${yhoe(u('w'), u('s'))}</g>
<path d="M3 59C5 50 14 46 22 46C30 46 37 50 39 59Z" fill="${u('d')}" ${yINK}/><path d="M10 52H14M24 50H28M17 55H20" stroke="#c8925a" stroke-width="1.6" stroke-linecap="round"/>
${yln('M21 47C21 41 21 37 22 33', '#4aa040', 2.4, 6)}${yleaf(22, 35, 13, 5.6, -55, u('l'), '#1f6a2a')}${yleaf(22, 34, 14, 6, 48, u('l'), '#1f6a2a')}
${yspark(10, 14, 3.5, '#d8ffb0')}`));

const smithing = Y('smithing', (id, u) => ysvg(
  ylg(id('w'), WOOD, 1, 0) + ylg(id('s'), STEEL) + ylg(id('i'), ['#fff6c0', '#ffa040', '#e0500a']) + yaura(id('au'), '#ff9a2a', 32, 46, 22).def,
  `${yaura(id('au'), '#ff9a2a', 32, 46, 22).el}<path d="M8 50L16 40H48L56 50Z" fill="${u('i')}" ${yINK}/><path d="M8 50H56L53 58H11Z" fill="#c0400a" ${yINK}/><path d="M18.5 42.5H40" stroke="#fff6d0" stroke-width="2" stroke-linecap="round"/>
<g transform="rotate(-40 38 22) translate(4 -6)">${yhammer(u('w'), u('s'))}</g>
${yspark(13, 30, 4.5, '#ffb020')}${yspark(22, 22, 3, '#ffd84a')}${yspark(54, 34, 3, '#ff9a2a')}<circle cx="9" cy="22" r="1.4" fill="#ffcc33"/><circle cx="18" cy="33" r="1.2" fill="#ff9a2a"/>`));

const shop = Y('shop', (id, u) => {
  let st = '';
  for (let i = 1; i < 8; i += 2) { const t0 = i / 8, t1 = (i + 1) / 8; st += `M${yf(12 + 40 * t0)} 22L${yf(12 + 40 * t1)} 22L${yf(15 + 34 * t1)} 58L${yf(15 + 34 * t0)} 58Z`; }
  return ysvg(
    ylg(id('b'), ['#ffffff', '#fff2f8', '#f0d0e0']) + ylg(id('s'), PINK) + yrg(id('c'), GOLD, '40%', '35%', '75%'),
    `${yln('M23 24C23 10 41 10 41 24', '#d9418e', 3)}
<path d="M12 22H52L49 58H15Z" fill="${u('b')}"/><path d="${st}" fill="${u('s')}"/><path d="M12 22H52L49 58H15Z" fill="none" ${yINK}/>
<path d="M10.5 18H53.5L52.5 26H11.5Z" fill="#ff8cc6" ${yINK2}/><path d="M14 21H26" stroke="#ffe3f1" stroke-width="1.8" stroke-linecap="round"/>
${ycoin(47, 48, 10, u('c'))}${yglint(42, 43, 1.3, 2.8, 40)}${yspark(9, 46, 3)}`);
});

const bag_plus = Y('bag_plus', (id, u) => ysvg(
  ylg(id('a'), WOOD) + ylg(id('b'), ['#ffd29c', '#d98c4a', '#a0521f']) + ylg(id('k'), GOLD) + yrg(id('g'), ['#d8ffb0', '#4ad04a', '#1f8a3a'], '40%', '35%', '75%'),
  `${yln('M20 17C20 8 34 8 34 17', '#b0642c', 3.6)}
<rect x="7" y="16" width="40" height="42" rx="10" fill="${u('a')}" ${yINK}/><rect x="14" y="41" width="26" height="13" rx="5" fill="#8a4520" ${yINK2}/>
<path d="M7 27C7 20 12 15 19 15H35C42 15 47 20 47 27V30C47 36 39 38 27 38C15 38 7 36 7 30Z" fill="${u('b')}" ${yINK}/>
<rect x="24" y="30" width="6" height="15" rx="2" fill="#6e3414" ${yINK2}/><rect x="22.5" y="34" width="9" height="7.5" rx="2" fill="${u('k')}" ${yINK2}/>
${yglint(15, 21, 3, 1.8, -25)}<circle cx="47" cy="46" r="11" fill="${u('g')}" ${yINK}/><path d="M47 40V52M41 46H53" stroke="${yC}" stroke-width="6.5" stroke-linecap="round"/><path d="M47 40V52M41 46H53" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>`));

const sell_all = Y('sell_all', (id, u) => {
  const st = (x, y, n) => { let s = ''; for (let i = 0; i < n; i++) s += `<ellipse cx="${x}" cy="${y - i * 4 + 2.4}" rx="8.5" ry="3.4" fill="#b07a10"/><ellipse cx="${x}" cy="${y - i * 4}" rx="8.5" ry="3.4"/>`; return s; };
  return ysvg(
    ylg(id('b'), ['#f6c46a', '#c8862e', '#8a4e14']) + ylg(id('c'), GOLD) + ylg(id('a'), GREEN),
    `<g fill="${u('c')}" ${yINK2}>${st(12, 30, 4)}${st(52, 30, 3)}</g><path d="M8 17.5H12M48 21.5H52" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>
<path d="M22 37C12 44 11 55 19 60H45C53 55 52 44 42 37Z" fill="${u('b')}" ${yINK}/>
<path d="M22 38L17 31C25 33.5 39 33.5 47 31L42 38C36 40 28 40 22 38Z" fill="#e0a050" ${yINK2}/>${yln('M21.5 39C28 41 36 41 42.5 39', '#ffcc33', 2, 4.6)}
<circle cx="32" cy="50" r="5.5" fill="${u('c')}" ${yINK2}/><path d="${ystarD(32, 50.3, 2.6, 1.1)}" fill="#fff7b8"/><path d="M19 47C19 44 20.5 42 22.5 41" stroke="#ffe0a8" stroke-width="2.2" stroke-linecap="round" fill="none"/>
<path d="${yarwD(32, 3, 32, 31, 9, 3.4)}" fill="${u('a')}" ${yINK2}/><path d="M30.8 6V20" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>`);
});

const collection = Y('collection', (id, u) => {
  const a = yaura(id('au'), '#7ae8ff', 32, 17, 15);
  let slots = '';
  for (const [x, y] of [[11, 30], [20, 31.5], [11, 40], [20, 41.5]]) slots += `<rect x="${x}" y="${y}" width="7" height="7" rx="1.5" transform="skewY(4)"/><rect x="${64 - x - 7}" y="${y}" width="7" height="7" rx="1.5" transform="skewY(-4)"/>`;
  return ysvg(
    a.def + ylg(id('c'), ['#d05a7a', '#a02a4a', '#5a0e24']) + ylg(id('p'), ['#fffdf4', '#f6e6c0']),
    `<path d="M3 27L32 33L61 27V53L32 59L3 53Z" fill="${u('c')}" ${yINK}/>
${ymirror(`<path d="M7 24C15 21 25 22 32 27V55C25 51 15 50 7 52Z" fill="${u('p')}" ${yINK2}/>`)}
<g fill="#ead6b0" stroke="#c8a870" stroke-width="1">${slots}</g><path d="M32 27V55" stroke="${yC}" stroke-width="1.8"/>
${a.el}${ymini(32, 16, 9.5, ['#e8fbff', '#4cc8ff', '#1a5ad1'])}${yspark(50, 10, 4)}${yspark(13, 12, 3, '#c8f4ff')}`);
});

const npc_shop = Y('npc_shop', (id, u) => ysvg(
  ylg(id('w'), ['#f2b878', '#c47436', '#8a4518']) + ylg(id('m'), IRON) + ylg(id('b'), ['#f6c46a', '#c8862e', '#8a4e14']) + yrg(id('c'), GOLD, '40%', '35%', '75%'),
  `<rect x="2.5" y="3" width="5.5" height="20" rx="2" fill="${u('m')}" ${yINK2}/>${yln('M7 8H56', '#7a86a0', 3)}${yln('M7.5 18C13 18 17 14 19 8.5', '#7a86a0', 2.2, 5.6)}
<path d="M19 9V22M47 9V22" stroke="${yC}" stroke-width="2.6" stroke-dasharray="3.2 1.6"/>
<rect x="7" y="21" width="52" height="34" rx="5" fill="${u('w')}" ${yINK}/><rect x="11" y="25" width="44" height="26" rx="3" fill="none" stroke="#ffcc33" stroke-width="2"/>
<path d="M33 30.5C26.5 35 26 46 30 48H44C48 46 47.5 35 41 30.5Z" fill="${u('b')}" ${yINK2}/><path d="M32.5 31L30 27.5H44L41.5 31Z" fill="#e0a050" ${yINK2}/>
<circle cx="37" cy="40.5" r="3.6" fill="${u('c')}" ${yINK1}/><circle cx="23" cy="42" r="4.6" fill="${u('c')}" ${yINK2}/><path d="M15 29V40" stroke="#ffd8a8" stroke-width="2" stroke-linecap="round"/>${yspark(56, 60, 2.6)}`));

const level_star = Y('level_star', (id, u) => {
  const R = Math.PI / 180, P = (a, r) => [yf(32 + Math.cos(a * R) * r), yf(33 + Math.sin(a * R) * r)];
  let leaves = '';
  for (let i = 0; i < 5; i++) {
    const a = 100 + i * 24, [x, y] = P(a, 26), o = a + 40, ox = yf(x + Math.cos(o * R) * 4.5), oy = yf(y + Math.sin(o * R) * 4.5);
    leaves += `<ellipse cx="${ox}" cy="${oy}" rx="5" ry="2.4" transform="rotate(${o} ${ox} ${oy})"/>`;
  }
  const laurel = yln(`M${P(96, 26).join(' ')}A26 26 0 0 1 ${P(212, 26).join(' ')}`, '#e0a020', 2.2, 5.6) + `<g fill="${u('l')}" ${yINK2}>${leaves}</g>`;
  let shade = '';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 5, b = a + Math.PI / 5;
    shade += `M32 30L${yf(32 + Math.cos(a) * 21)} ${yf(30 + Math.sin(a) * 21)}L${yf(32 + Math.cos(b) * 9.5)} ${yf(30 + Math.sin(b) * 9.5)}Z`;
  }
  return ysvg(
    ylg(id('s'), GOLD) + ylg(id('l'), ['#d8ffb0', '#6ac84a', '#2a8a3a']) + ylg(id('r'), RED),
    `${ymirror(laurel)}<path d="${ystarD(32, 30, 21, 9.5)}" fill="${u('s')}" ${yINK}/><path d="${shade}" fill="#c86a08" opacity=".28"/>
<path d="M27 55L32 51.5L37 55L35 60L32 57.5L29 60Z" fill="${u('r')}" ${yINK2}/>${yglint(26, 22, 1.5, 3.8, 35)}${yspark(54, 9, 4)}${yspark(10, 10, 3, '#fff7b8')}`);
});

const handshake = Y('handshake', (id, u) => ysvg(
  ylg(id('h'), SKIN) + ylg(id('k'), ['#ffe4c8', '#f0b484', '#c87a44']) + ylg(id('a'), BLUE) + ylg(id('b'), ORANGE) + yrg(id('c'), GOLD, '40%', '35%', '75%'),
  `<path d="M1.5 28L13 23L19 42L7 47Z" fill="${u('a')}" ${yINK}/><path d="M62.5 28L51 23L45 42L57 47Z" fill="${u('b')}" ${yINK}/>
<path d="M15 26C22 22.5 30 23 37 27L48 35C50.5 37 49 41 46 40.5L42 39.5C43 42 41 44.5 38.5 43.5L34 42C29 45 21 45 17.5 41Z" fill="${u('k')}" ${yINK2}/>
<path d="M49 25C42 21.5 34 22 28 26L18.5 33C16 35 17.5 39 20.5 38.5L25 36.5C24 39 26 41.5 28.5 40.5L31 39.5C30.5 42 33 44 35.5 42.5L38 41C39 43 42 43.5 43.5 41.5C46 40 47.5 38 48 36Z" fill="${u('h')}" ${yINK2}/>
<path d="M25 36.5L28.5 33.5M31 39.5L33.8 36.2M38 41L40 37.6" stroke="${yC}" stroke-width="1.5" stroke-linecap="round"/>
<path d="M23 28.5C26 24.5 31.5 22.5 36 23.5C38.5 24 38.5 27 36 27.5L29 29.5Z" fill="${u('k')}" ${yINK2}/>
<path d="M33 27C37 25 41 25 44 26" stroke="#fff" stroke-width="1.6" stroke-linecap="round" fill="none" opacity=".8"/>
${ycoin(32, 11, 6.5, u('c'))}${yspark(11, 12, 3.5)}${yspark(53, 12, 3.5)}${yspark(32, 54, 3, '#fff7b8')}`));

// ---------------------------------------------------------------- templates
// Each template scopes its ids as "y-<family>-<key>-<part>"; pass a unique key per generated icon.
// Colours are #rgb / #rrggbb strings.

// Dungeon "collection" relic. shape: 'crown' (broken crown shard) | 'seal' (rune seal) |
// 'idol' (carved statuette) | 'tome' (clasped ancient book); c1 = main colour, c2 = glow / accent.
export function relicIcon(key, shape, c1, c2) {
  return Y(`rl-${yid(key)}`, (id, u) => {
    const M = ypal(c1), G = ypal(c2), a = yaura(id('au'), c2);
    const jew = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${u('j')}" ${yINK2}/><circle cx="${yf(x - r * 0.35)}" cy="${yf(y - r * 0.35)}" r="${yf(r * 0.32)}" fill="#fff"/>`;
    const defs = a.def + ylg(id('m'), M) + ylg(id('d'), [M[1], M[2]]) + yrg(id('j'), ['#ffffff', G[0], c2, G[2]], '40%', '35%', '75%') + ylg(id('g'), GOLD);
    let b;
    if (shape === 'crown') {
      b = `<g transform="rotate(-8 30 36)"><path d="M9 20L18 33L29 12L37 30L42 25L40 32.5L45.5 35.5L41 40.5L46 45.5L42 52H11Z" fill="${u('m')}" ${yINK}/>
<path d="M10.6 42H42.6L46 45.5L42 52H11Z" fill="${u('d')}" ${yINK2}/><path d="M14 26L12.5 39M29 19L27.5 28" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>
${jew(9, 19.5, 3.4)}${jew(29, 11.5, 4)}${jew(19, 47, 3)}${jew(31, 47, 3)}<path d="M37 30L39 36L36.5 42" fill="none" stroke="${yC}" stroke-width="1.3" opacity=".5"/></g>
<path d="M49.5 21.5L57 24.5L55 31.5L48 28.5Z" fill="${u('m')}" ${yINK2}/><path d="M50.5 24L54.5 25.5" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`;
    } else if (shape === 'idol') {
      b = `<path d="M13 51H51L53 59H11Z" fill="${u('d')}" ${yINK}/><rect x="16" y="46" width="32" height="6" rx="2" fill="${u('m')}" ${yINK2}/>
<path d="M22 30C19 37 19 43 21 47H43C45 43 45 37 42 30Z" fill="${u('m')}" ${yINK}/><path d="M22.5 35.5C26 40.5 38 40.5 41.5 35.5" fill="none" stroke="${M[2]}" stroke-width="2.2" stroke-linecap="round"/>
<ellipse cx="32" cy="22.5" rx="11.5" ry="10.5" fill="${u('m')}" ${yINK}/><path d="M20 17L23 6L28 12.5L32 3.5L36 12.5L41 6L44 17C38 14.5 26 14.5 20 17Z" fill="${u('g')}" ${yINK2}/>
<circle cx="27.5" cy="23.5" r="4.2" fill="${c2}" opacity=".45"/><circle cx="36.5" cy="23.5" r="4.2" fill="${c2}" opacity=".45"/>
<ellipse cx="27.5" cy="23.5" rx="2.4" ry="1.9" fill="${G[0]}" ${yINK1}/><ellipse cx="36.5" cy="23.5" rx="2.4" ry="1.9" fill="${G[0]}" ${yINK1}/>
<path d="M29.5 29H34.5" stroke="${M[2]}" stroke-width="1.6" stroke-linecap="round"/>${jew(32, 41.5, 3.2)}
<path d="M23.5 18C24 15.5 25.5 14 27 13.5M24 33V43" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/>`;
    } else if (shape === 'tome') {
      b = `<g transform="rotate(-6 32 34)"><rect x="16" y="10" width="36" height="47" rx="3" fill="#fbecc4" ${yINK}/><path d="M49.5 14V53.5M16 54H48" stroke="#c99a5c" stroke-width="1.3"/>
<rect x="10" y="6" width="38" height="48" rx="4" fill="${u('m')}" ${yINK}/><path d="M16 7.5V52.5" stroke="${M[2]}" stroke-width="2.6"/>
<path d="M10 15V10C10 8 12 6 14 6H19ZM10 45V50C10 52 12 54 14 54H19ZM48 15V10C48 8 46 6 44 6H39ZM48 45V50C48 52 46 54 44 54H39Z" fill="${u('g')}" ${yINK2}/>
<circle cx="30" cy="29" r="10" fill="${u('g')}" ${yINK2}/><circle cx="30" cy="29" r="6.6" fill="${u('j')}" ${yINK1}/><path d="${ystarD(30, 29.4, 4, 1.7, 4)}" fill="#fff"/>
<path d="M43 26.5H55C56.5 26.5 57 27.5 57 29V35C57 36.5 56.5 37.5 55 37.5H43Z" fill="${u('d')}" ${yINK2}/><rect x="50" y="27" width="8.5" height="10" rx="2" fill="${u('g')}" ${yINK2}/><circle cx="54.2" cy="31.5" r="1.3" fill="${yC}"/>
<path d="M13.6 12V24" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".75"/></g>`;
    } else {
      const rune = 'M32 17.5L39.5 26L28 40M32 17.5L24.5 26L36 40';
      b = `${ymirror(`<path d="M24.5 42L17 60L23 56.5L27 61L31.5 46Z" fill="url(#${id('r')})" ${yINK2}/>`)}
<path d="${yfluff(32, 29, 20.5, 20.5, 12, 1.1)}" fill="${u('s')}" ${yINK}/><circle cx="32" cy="29" r="14.5" fill="${u('i')}" stroke="${M[2]}" stroke-width="2"/>
<path d="${rune}" fill="none" stroke="${c2}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/><path d="${rune}" fill="none" stroke="${G[0]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="${rune}" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M17 22C18.5 17.5 21.5 14 26 12" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>`;
      return ysvg(defs + ylg(id('r'), G) + yrg(id('s'), M, '40%', '35%', '75%') + yrg(id('i'), [M[2], M[1]], '50%', '50%', '70%'), `${a.el}${b}${yspark(54, 9, 4)}${yspark(10, 50, 3, G[0])}`);
    }
    return ysvg(defs, `${a.el}${b}${yspark(54, 9, 4)}${yspark(10, 50, 3, G[0])}`);
  });
}

// Seed packet with a picture of the plant (flower tinted c1).
export function seedIcon(key, c1) {
  return Y(`sd-${yid(key)}`, (id, u) => {
    const P = ypal(c1);
    let crimp = 'M12 13V8', pet = '';
    for (let i = 0; i < 8; i++) crimp += `L${yf(14.5 + 5 * i)} 5L${17 + 5 * i} 8`;
    for (let i = 0; i < 5; i++) { const t = (i * 72 - 90) * Math.PI / 180; pet += `<circle cx="${yf(32 + Math.cos(t) * 4.2)}" cy="${yf(25.5 + Math.sin(t) * 4.2)}" r="3.4"/>`; }
    return ysvg(
      ylg(id('k'), ['#fffbe6', '#f2dca4', '#d4aa68']) + ylg(id('s'), ['#ffffff', '#e0f4ff', '#b0dcf8']) + yrg(id('f'), [P[0], c1, P[2]], '40%', '35%', '75%') + ylg(id('t'), P) + ylg(id('l'), GREEN),
      `<path d="M13 11H51V54.5C51 56.5 49.5 58 47.5 58H16.5C14.5 58 13 56.5 13 54.5Z" fill="${u('k')}" ${yINK}/><path d="${crimp}V13Z" fill="#e6c88a" ${yINK2}/>
<rect x="18" y="17" width="28" height="25" rx="4" fill="${u('s')}" ${yINK2}/><path d="M19.2 38C24 35 40 35 44.8 38V40C44.8 40.5 44.3 40.9 43.8 40.9H20.2C19.7 40.9 19.2 40.5 19.2 40Z" fill="#9a6a3a"/>
${yln('M32 37V28', '#4aa040', 1.8, 4.4)}${yleaf(32, 35.5, 8, 3.4, -58, u('l'), '', yINK1)}${yleaf(32, 34, 8, 3.4, 58, u('l'), '', yINK1)}
<g fill="${u('f')}" ${yINK1}>${pet}</g><circle cx="32" cy="25.5" r="2.3" fill="#fff27a" ${yINK1}/>
<rect x="17" y="46" width="30" height="7" rx="2.5" fill="${u('t')}" ${yINK2}/><path d="M21 49.5H34" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>
<path d="M16 15V43" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
<g fill="${ymix(c1, '#6a4020', 0.55)}" ${yINK1}><ellipse cx="55.5" cy="53" rx="2.3" ry="3.1" transform="rotate(30 55.5 53)"/><ellipse cx="57.5" cy="60" rx="2.1" ry="2.8" transform="rotate(-40 57.5 60)"/><ellipse cx="51" cy="60.5" rx="2" ry="2.7" transform="rotate(75 51 60.5)"/></g>`);
  });
}

// Costume preview. kind: 'outfit' (dress on a hanger) | 'head' (stylish hat) | 'back' (pair of wings);
// c1 = main colour, c2 = accent.
export function costumeIcon(key, kind, c1, c2) {
  return Y(`cs-${yid(key)}`, (id, u) => {
    const M = ypal(c1), A = ypal(c2);
    const defs = ylg(id('m'), M) + ylg(id('a'), A) + ylg(id('w'), [ylt(c2, 0.35), ylt(c1, 0.45), c1], 1, 0);
    let b;
    if (kind === 'head') {
      b = `<ellipse cx="32" cy="45" rx="28" ry="9.5" fill="${u('m')}" ${yINK}/><path d="M8 44C11 41 15 39.5 19 39" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".75"/>
<path d="M17 44C16 30 21 16 32 16C43 16 48 30 47 44C40 47.5 24 47.5 17 44Z" fill="${u('m')}" ${yINK}/><path d="M32 18.5C30 24 30 30 32 35" fill="none" stroke="${M[2]}" stroke-width="1.6" stroke-linecap="round" opacity=".5"/>
<path d="M17.3 37C24 40.5 40 40.5 46.7 37L47 44C40 47.5 24 47.5 17 44Z" fill="${u('a')}" ${yINK2}/>
${yleaf(43, 39, 23, 6, 30, u('a'), A[2])}<circle cx="43" cy="40.5" r="4" fill="${A[0]}" ${yINK2}/><circle cx="42" cy="39.5" r="1.2" fill="#fff"/>
<path d="M22 36C21.5 29 23.5 23 27 20" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`;
    } else if (kind === 'back') {
      b = `${ymirror(`<path d="M29 30C26 19 17 9 4 6C3 13 5 19 8 22C5 23.5 5 27 7.5 29C5.5 31.5 6.5 35 10 36C9.5 39.5 12 41.5 15.5 41C18.5 41 22 39.5 25 37C27.5 35 29 33 29 30Z" fill="${u('w')}" ${yINK2}/>
<path d="M27 31C21 26 14 24 9 22.5M26 33.5C21 31.5 15 30.5 8.5 29.5M25 36C21 36 17 37 13.5 38.5" fill="none" stroke="${M[2]}" stroke-width="1.3" stroke-linecap="round" opacity=".55"/>
<path d="M29 37C23 38 16 42.5 14 49C16.5 53 21.5 53.5 25 50C27.5 47.5 29 43 29 37Z" fill="${u('w')}" ${yINK2}/><path d="M24 24C20 18 14 13 8 10" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>`)}
<path d="M32 25L37 33L32 42L27 33Z" fill="${u('a')}" ${yINK2}/>${yglint(30.5, 31, 1, 2.2, 30)}`;
    } else {
      b = `${yln('M32 14V10C32 6 37.5 6 37.5 9.5', '#cfdcef', 2, 4.6)}${yln('M32 14L12 23H52Z', '#e8eef8', 2, 5)}
<path d="M22.5 33H41.5L52 55C44 59.5 20 59.5 12 55Z" fill="${u('m')}" ${yINK}/><path d="M32 37V57.5M27 37L20.5 56.5M37 37L43.5 56.5" stroke="${M[2]}" stroke-width="1.4" stroke-linecap="round" opacity=".45"/>
<path d="M14.5 54.2C22 57.6 42 57.6 49.5 54.2" fill="none" stroke="${c2}" stroke-width="2.6" stroke-linecap="round"/>
<path d="M24 20L32 25L40 20L45 24L41.5 34H22.5L19 24Z" fill="${u('m')}" ${yINK2}/><path d="M28.5 22.8L32 25L35.5 22.8L32 28.5Z" fill="${A[0]}" ${yINK1}/>
<rect x="21.5" y="31" width="21" height="5" rx="2" fill="${u('a')}" ${yINK2}/>${ymirror(`<path d="M31 33.5C27 30 23.5 31 24 34C24.5 37 28 37 31 34Z" fill="${u('a')}" ${yINK1}/>`)}<circle cx="32" cy="33.5" r="2.2" fill="${A[0]}" ${yINK1}/>
<path d="M18 51C19.5 45.5 22 41 24.5 38" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>`;
    }
    return ysvg(defs, `${b}${yspark(55, 9, 4)}${yspark(9, 52, 3, A[0])}`);
  });
}

export const EXTRA2_ICONS = {
  ore_copper, ore_iron, ore_silver, ore_mithril, ore_starmetal,
  herb_silverleaf, herb_moonbloom, herb_firepetal, herb_frostlily, herb_starlotus,
  wood_oak, wood_maple, wood_ironwood, wood_frostpine, wood_starwood,
  crop_wheat, crop_carrot, crop_strawberry, crop_pumpkin, crop_moonmelon, crop_sunfruit, crop_starberry,
  fertilizer, watering_can,
  potion_hp2, potion_hp3, potion_mp2, potion_mp3, empty_vial,
  elixir_might, elixir_iron, elixir_swift, elixir_wisdom, elixir_fortune, phoenix_draught,
  bag_scroll, teleport_scroll, pet_treat, crimson_core, red_forge, mythic_badge,
  auction, wardrobe, farm, gather, alchemy, professions, mining, herbalism, logging, farming, smithing,
  shop, bag_plus, sell_all, collection, npc_shop, level_star, handshake,
};
