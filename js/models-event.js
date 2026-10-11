// Seasonal event content: world bosses, festival monsters, the guild-war crystal and collectible event pets.
// Built on the shared toon materials and the models.js builders. Forward is +Z, feet at y=0.
import * as THREE from 'three';
import { toon, glow, mesh, outlineMaterial, critterFace, glowTexture, magicCircleTexture } from './toon.js';
import { buildQuad } from './models.js';

export const EVENT_MONSTER_MODELS = new Set(['behemoth', 'pumpkinking', 'jackpuff', 'warcrystal']);
export const EVENT_PET_MODELS = new Set(['pumpkin', 'snowpuff', 'blossom']);

// ---------------------------------------------------------------- shared helpers
const geo = new Map();
const G = (k, fn) => { if (!geo.has(k)) geo.set(k, fn()); return geo.get(k); };
const sph = (r, w = 16, h = 12) => G(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const cone = (r, h, s = 10) => G(`c${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const cyl = (a, b, h, s = 14, open = false) => G(`y${a}|${b}|${h}|${s}|${open}`, () => new THREE.CylinderGeometry(a, b, h, s, 1, open));
const oct = (r) => G(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));
const box = (x, y, z) => G(`b${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z));
const tor = (r, t, rs = 8, ts = 28, arc = Math.PI * 2) => G(`t${r}|${t}|${rs}|${ts}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const DS = THREE.DoubleSide;

const mats = new Map();
const MAT = (k, fn) => { if (!mats.has(k)) mats.set(k, fn()); return mats.get(k); };
// Vertex-coloured toon lets one merged mesh carry several colours: one draw call (plus its outline) per piece.
const vc = (o = {}) => toon(0xffffff, { vertexColors: true, ...o });
const glowVC = () => MAT('gvc', () => new THREE.MeshBasicMaterial({ vertexColors: true }));
const glowDS = (c) => MAT('gds' + c, () => new THREE.MeshBasicMaterial({ color: c, side: DS }));
const faceMat = (tex) => MAT('face' + tex.uuid, () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));

// Outline width is given in world-ish units and compensated for the part's own scale (as models.js does).
function part(g, mat, x = 0, y = 0, z = 0, o = {}) {
  const basic = mat && mat.isMeshBasicMaterial;
  const ow = o.ow ?? (basic ? 0 : 0.025);
  const avg = o.s ? (Math.abs(o.s[0]) + Math.abs(o.s[1]) + Math.abs(o.s[2])) / 3 : 1;
  const m = mesh(g, mat, { outlineW: ow > 0 ? Math.round((ow / avg) * 1000) / 1000 : 0, opts: o.opts });
  m.position.set(x, y, z);
  if (o.s) m.scale.set(...o.s);
  if (o.r) m.rotation.set(...o.r);
  return m;
}
function halo(color, size, [x, y, z] = [0, 0, 0], opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, opacity }));
  s.scale.setScalar(size); s.position.set(x, y, z); s.raycast = () => {};
  return s;
}
// Scale every ink outline already on a model (models.js builders use thin creature outlines; bosses want bolder ink).
function thicken(root, k) {
  root.traverse((o) => {
    if (!o.userData.isOutline) return;
    const t = o.material.userData.thick ? o.material.userData.thick.value : 0.025;
    o.material = outlineMaterial(Math.round(t * k * 1000) / 1000);
  });
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, order = 'XYZ') {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, order)), _s.set(sx, sy, sz));
}
// Merge [geometry, matrix?, colorHex?] entries into one indexed geometry with vertex colours. Mirrored matrices keep their winding.
function merge(list) {
  const pos = [], nor = [], uv = [], col = [], idx = [];
  const useUv = list.every(([g]) => g.attributes.uv);
  const tmp = new THREE.Color();
  let base = 0;
  for (const [g0, m = new THREE.Matrix4(), c] of list) {
    const g = g0.clone(); g.applyMatrix4(m);
    const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv, gc = g.attributes.color;
    if (c !== undefined) tmp.set(c);
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      if (useUv) uv.push(u.getX(i), u.getY(i));
      if (c !== undefined) col.push(tmp.r, tmp.g, tmp.b);
      else if (gc) col.push(gc.getX(i), gc.getY(i), gc.getZ(i));
      else col.push(1, 1, 1);
    }
    const ix = g.index ? g.index.array : Array.from({ length: p.count }, (_, i) => i);
    const flip = m.determinant() < 0;
    for (let i = 0; i < ix.length; i += 3) {
      if (flip) idx.push(ix[i] + base, ix[i + 2] + base, ix[i + 1] + base);
      else idx.push(ix[i] + base, ix[i + 1] + base, ix[i + 2] + base);
    }
    base += p.count; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  if (useUv) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setIndex(idx);
  out.computeBoundingSphere();
  return out;
}
// Average normals of coincident vertices so displaced spheres keep a crack-free ink hull along seams and poles.
function weldNormals(g) {
  const p = g.attributes.position, n = g.attributes.normal, groups = new Map(), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const k = `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
    let a = groups.get(k); if (!a) groups.set(k, (a = [])); a.push(i);
  }
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    v.set(0, 0, 0);
    for (const i of ids) v.x += n.getX(i), v.y += n.getY(i), v.z += n.getZ(i);
    v.normalize();
    for (const i of ids) n.setXYZ(i, v.x, v.y, v.z);
  }
}
// Tube along a smooth curve, tapering toward the end (horns, vines, roots, tendrils). colors(u, color) paints rings.
function tubeGeo(key, pts, r0, { segs = 20, radial = 8, tip = 0.1, taper = 1, colors = null } = {}) {
  return G('tube' + key, () => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, segs, r0, radial, false);
    const pos = g.attributes.position, P = new THREE.Vector3(), V = new THREE.Vector3(), c = new THREE.Color();
    const col = colors ? new Float32Array(pos.count * 3) : null;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs; curve.getPointAt(u, P);
      const k = 1 - (1 - tip) * Math.pow(u, taper);
      if (colors) colors(u, c);
      for (let j = 0; j <= radial; j++) {
        const id = i * (radial + 1) + j;
        V.fromBufferAttribute(pos, id).sub(P).multiplyScalar(k).add(P);
        pos.setXYZ(id, V.x, V.y, V.z);
        if (col) col.set([c.r, c.g, c.b], id * 3);
      }
    }
    if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeBoundingSphere();
    return g;
  });
}
const curlGeo = () => G('curl', () => {
  const pts = [];
  for (let i = 0; i <= 14; i++) { const u = i / 14, a = u * Math.PI * 3, r = 0.22 * (1 - 0.72 * u); pts.push([Math.cos(a) * r - 0.22, Math.sin(a) * r, u * 0.05]); }
  return tubeGeo('curlT', pts, 0.04, { segs: 42, radial: 6, tip: 0.45 });
});
// Flat-ish shapes in the XY plane, base at the origin and tip at +Y (length 1).
const leafGeo = () => G('leaf', () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(-0.46, 0.28, -0.36, 0.8, 0, 1); s.bezierCurveTo(0.36, 0.8, 0.46, 0.28, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 7 });
  g.translate(0, 0, -0.02); return g;
});
const petalGeo = (c0, c1) => G(`petal${c0}|${c1}`, () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(-0.56, 0.25, -0.5, 0.86, -0.17, 1); s.lineTo(0, 0.85); s.lineTo(0.17, 1); s.bezierCurveTo(0.5, 0.86, 0.56, 0.25, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 7 });
  g.translate(0, 0, -0.025);
  const p = g.attributes.position, a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color(), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { c.copy(a).lerp(b, THREE.MathUtils.clamp(p.getY(i), 0, 1) ** 0.8); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
});
const boltGeo = () => G('bolt', () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(0.26, 0.44); s.lineTo(0.1, 0.46); s.lineTo(0.34, 1); s.lineTo(-0.04, 0.4); s.lineTo(0.12, 0.38); s.lineTo(-0.06, 0.02);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false });
  g.translate(-0.12, 0, -0.035); return g;
});

// Faceted look for toon (MeshToonMaterial has no flatShading): flat normals to draw, smooth normals for the ink hull.
const flatCache = new WeakMap();
function faceted(g, mat, ow = 0.04) {
  let f = flatCache.get(g);
  if (!f) { f = g.index ? g.toNonIndexed() : g.clone(); f.computeVertexNormals(); flatCache.set(g, f); }
  const m = new THREE.Mesh(f, mat);
  if (ow > 0) { const o = new THREE.Mesh(g, outlineMaterial(ow)); o.userData.isOutline = true; o.raycast = () => {}; m.add(o); }
  return m;
}
const octSmooth = () => G('octs', () => {
  const g = new THREE.OctahedronGeometry(1, 0), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return g;
});

// Self-driven spin for orbiting bits: animateCreature only poses the known parts, so these turn themselves right before they draw.
function spin(group, carrier, speed) {
  const t0 = Math.random() * 20;
  carrier.onBeforeRender = () => { group.rotation.y = (performance.now() / 1000 + t0) * speed; };
}

// Canvas textures (carved faces, rune bands)
const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
function poly(g, pts) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
const mirror = (pts) => pts.map(([x, y]) => [512 - x, y]);
function arcPts(x0, x1, y0, sag, n) { const out = []; for (let i = 0; i <= n; i++) { const u = i / n; out.push([x0 + (x1 - x0) * u, y0 + Math.sin(u * Math.PI) * sag]); } return out; }
function kingShapes() {
  const eye = [[90, 30], [222, 98], [122, 124]];
  const nose = [[256, 104], [282, 146], [230, 146]];
  const top = [[64, 128], [104, 160], [134, 164], [150, 194], [166, 168], [206, 174], [222, 204], [238, 176], [274, 176], [290, 204], [306, 174], [346, 168], [362, 194], [378, 164], [408, 160], [448, 128]];
  const bottom = [[434, 172], [398, 208], [344, 232], [318, 236], [302, 208], [286, 240], [226, 240], [210, 208], [194, 236], [168, 232], [114, 208], [78, 172]];
  return [eye, mirror(eye), nose, [...top, ...bottom]];
}
function cuteShapes() {
  const eye = [[178, 34], [210, 96], [146, 96]];
  const nose = [[256, 102], [268, 122], [244, 122]];
  const mouth = [[132, 134], [180, 150], [236, 156], [236, 174], [276, 174], [276, 156], [332, 150], [380, 134], ...arcPts(380, 132, 134, 86, 16).slice(1, -1)];
  return [eye, mirror(eye), nose, mouth];
}
// Jack-o'-lantern carving: warm spill glow, an inked cut edge and a hot yellow core.
function carvedFace(kind) {
  return canvasTex('carve-' + kind, 512, 256, (g) => {
    const shapes = kind === 'king' ? kingShapes() : cuteShapes();
    const round = kind === 'king' ? 5 : 22;
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.save(); g.shadowColor = 'rgba(255,150,20,1)'; g.shadowBlur = 30; g.fillStyle = 'rgba(255,176,48,0.95)'; g.strokeStyle = g.fillStyle; g.lineWidth = round;
    for (const s of shapes) { poly(g, s); g.fill(); g.stroke(); }
    g.restore();
    g.strokeStyle = '#3a1004'; g.lineWidth = round + 16;
    for (const s of shapes) { poly(g, s); g.stroke(); }
    const gr = g.createRadialGradient(256, 120, 6, 256, 130, 250);
    gr.addColorStop(0, '#fffef0'); gr.addColorStop(0.35, '#ffec7a'); gr.addColorStop(0.75, '#ffb52e'); gr.addColorStop(1, '#ff8a1a');
    g.fillStyle = gr; g.strokeStyle = gr; g.lineWidth = round;
    for (const s of shapes) { poly(g, s); g.fill(); g.stroke(); }
  });
}
// Critter face with the mouth set lower, leaving room for a carrot nose between eyes and smile.
function snowFace(eye = '#2a2440', mouth = 'smile') {
  return canvasTex('snowface' + eye + mouth, 256, 256, (g) => {
    const cx = 128, ey = 100, dx = 44;
    for (const s of [-1, 1]) {
      const x = cx + s * dx;
      g.fillStyle = eye; g.beginPath(); g.ellipse(x, ey, 14, 19, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 4, ey - 7, 6, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + 4, ey + 7, 2.5, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(255,110,140,0.6)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(cx + s * 76, ey + 30, 17, 10, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#3a1a1a'; g.lineWidth = 5; g.lineCap = 'round';
    if (mouth === 'cat') { g.beginPath(); g.arc(cx - 9, ey + 58, 9, 0, Math.PI); g.stroke(); g.beginPath(); g.arc(cx + 9, ey + 58, 9, 0, Math.PI); g.stroke(); }
    else { g.beginPath(); g.arc(cx, ey + 50, 14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  });
}
function runeBandTexture() {
  return canvasTex('runeband', 1024, 64, (g, W, H) => {
    g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 4; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(0, 6); g.lineTo(W, 6); g.moveTo(0, H - 6); g.lineTo(W, H - 6); g.stroke();
    let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = 24, step = W / n;
    for (let i = 0; i < n; i++) {
      const x = step * (i + 0.35), top = 16, bot = H - 16;
      g.beginPath(); g.moveTo(x, top); g.lineTo(x, bot);
      const k = 1 + ((rnd() * 3) | 0);
      for (let j = 0; j < k; j++) {
        const y = top + 4 + rnd() * (bot - top - 14), d = rnd() < 0.5 ? -1 : 1, up = rnd() < 0.5 ? -1 : 1;
        g.moveTo(x, y); g.lineTo(x + d * 13, y + up * 11);
        if (rnd() < 0.35) g.lineTo(x, y + up * 22);
      }
      g.stroke();
      g.beginPath(); g.arc(step * (i + 0.85), H / 2, 3.5, 0, Math.PI * 2); g.fill();
    }
  });
}

// Faces mapped onto the front of a sphere (cached geometry, unlike toon.facePatch).
const spherePatch = (r, w, top, h) => G(`sp${r}|${w}|${top}|${h}`, () => new THREE.SphereGeometry(r, 24, 16, Math.PI / 2 - w / 2, w, top, h));
function faceOn(parent, g, tex, scale) {
  const f = new THREE.Mesh(g, faceMat(tex));
  f.renderOrder = 2; f.raycast = () => {};
  if (scale) f.scale.set(...scale);
  parent.add(f);
  return f;
}

// Ribbed pumpkin surface: N lobes with inked creases (vertex-coloured), dimpled at stem and base. Lobe centred on +Z.
function pumpkinShape(v, N, depth, dimple) {
  const h = Math.min(1, Math.hypot(v.x, v.z));
  const rib = 1 - Math.abs(Math.cos((N * Math.atan2(v.x, v.z)) / 2));
  const m = 1 - depth * rib;
  v.x *= m; v.z *= m;
  v.y -= Math.sign(v.y) * dimple * (1 - h) ** 2;
  return rib;
}
function pumpkinGeo(N, depth, dimple, cA, cB) {
  return G(`pk${N}|${depth}|${dimple}|${cA}|${cB}`, () => {
    const g = new THREE.SphereGeometry(1, N * 6, 22);
    const p = g.attributes.position, v = new THREE.Vector3(), a = new THREE.Color(cA), b = new THREE.Color(cB), c = new THREE.Color();
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const rib = pumpkinShape(v.fromBufferAttribute(p, i), N, depth, dimple);
      p.setXYZ(i, v.x, v.y, v.z);
      c.copy(a).lerp(b, rib ** 2.2); col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals(); weldNormals(g);
    return g;
  });
}
function pumpkinPatch(N, depth, dimple, w, top, h, eps = 0.012) {
  return G(`pkp${N}|${depth}|${dimple}|${w}|${top}|${h}`, () => {
    const g = new THREE.SphereGeometry(1, 56, 24, Math.PI / 2 - w / 2, w, top, h);
    const p = g.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { pumpkinShape(v.fromBufferAttribute(p, i), N, depth, dimple); v.multiplyScalar(1 + eps); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    return g;
  });
}
// Stem + curly vine + leaf sprouting from a pumpkin top (base at origin).
const sproutGeo = () => G('sprout', () => merge([
  [tubeGeo('sproutstem', [[0, -0.05, 0], [0.02, 0.12, 0], [0.08, 0.26, 0.02]], 0.08, { tip: 0.7, segs: 10 }), undefined, 0x6a7a2a],
  [sph(0.058, 10, 8), M(0.08, 0.26, 0.02), 0x9aa84a],
  [curlGeo(), M(0.06, 0.16, 0.02, 0, 0.3, 0.5, 0.7), 0x5ab83a],
  [leafGeo(), M(-0.04, 0.05, 0, Math.PI / 2 + 0.55, -2.2, 0, 0.32, 0.38, 0.32, 'YXZ'), 0x5ec83e],
]));

// ---------------------------------------------------------------- Thunderhoof Behemoth (overworld world boss)
const BEHEMOTH = [
  { body: 0x4a58a8, belly: 0x98a4e4, snout: 0x8592d4, legs: 0x36428a, hoof: 0xf4c440, horn: 0xfff2d6, hornTip: 0xffffff, band: 0xf4c440, armor: 0x262e66, trim: 0xf4c440, cloud: 0x3c447c, cloud2: 0x6674b8, glow: 0x6af2ff, eye: '#4af0ff', bolt: 0x9af8ff, stripe: 0x6af0ff },
  { body: 0xe8f4ff, belly: 0xffffff, snout: 0xf2f8ff, legs: 0xbcd6f2, hoof: 0x7cc8f4, horn: 0xc8ecff, hornTip: 0xffffff, band: 0x5aaeea, armor: 0x5a8ad0, trim: 0xf0fbff, cloud: 0xa8c8ee, cloud2: 0xe2f2ff, glow: 0xa8f6ff, eye: '#22c8ff', bolt: 0xb8fbff, stripe: 0x3aaeea, ice: 0x8ad8ff, iceTip: 0xf4feff, iceGlow: 0x1a5a8a },
];
// Lightning tiger-stripes for the flanks (white, tinted by the material).
function stripeTexture() {
  return canvasTex('bh-stripes', 256, 256, (g) => {
    g.lineJoin = 'miter'; g.lineCap = 'round'; g.strokeStyle = '#ffffff';
    g.shadowColor = '#ffffff'; g.shadowBlur = 10;
    for (const [y0, k] of [[46, 1], [128, 1.15], [206, 0.85]]) {
      const pts = [[252, y0 - 26 * k], [196, y0 - 4 * k], [210, y0 - 16 * k], [140, y0 + 10 * k], [154, y0 - 2 * k], [72, y0 + 26 * k]];
      for (let i = 0; i < pts.length - 1; i++) {
        g.lineWidth = 15 * (1 - i / (pts.length - 1)) * k + 3;
        g.beginPath(); g.moveTo(...pts[i]); g.lineTo(...pts[i + 1]); g.stroke();
      }
    }
  });
}
function behemoth(variant) {
  const vi = variant === 1 ? 1 : 0, C = BEHEMOTH[vi];
  const sz = 3.4, S = (v) => v * sz;
  const r = buildQuad({ body: C.body, belly: C.belly, snout: C.snout, legs: C.legs, hoof: C.hoof, ears: false, tailColor: C.legs, face: { mood: 'glow', eye: C.eye, mouth: 'none', blush: false }, size: sz });
  thicken(r, 2.2);
  const P = r.userData.parts, body = P.body, head = P.head;
  // bulk up: wider barrel torso (capsule lies along z, so local z is height), deep chest, pillar legs, big lowered head
  const [torso, belly] = body.children;
  torso.scale.set(1.3, 1, 1.2);
  belly.scale.set(1.15, 1.0, 1.45); belly.position.set(0, S(0.8), S(0.42));
  P.legs.forEach((l) => { l.position.x *= 1.22; l.scale.set(1.45, 1, 1.45); });
  head.position.set(0, S(1.2), S(0.92)); head.scale.setScalar(1.3);
  P.tail.children[0].rotation.x = -2.5; // let the tail hang down-back instead of poking up

  // glowing lightning stripes on both flanks: a patch hugging the torso capsule's straight section
  const stripeGeo = G('bh-stripe', () => new THREE.CylinderGeometry(S(0.38) * 1.012, S(0.38) * 1.012, S(0.85) * 0.96, 12, 1, true, Math.PI / 2 - 0.75, 1.5));
  const stripeMat = MAT('bh-stripe' + vi, () => new THREE.MeshBasicMaterial({ map: stripeTexture(), color: C.stripe, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(stripeGeo, stripeMat);
    m.position.copy(torso.position); m.rotation.copy(torso.rotation); m.scale.set(s * torso.scale.x, torso.scale.y, torso.scale.z);
    m.renderOrder = 2; m.raycast = () => {}; body.add(m);
  }
  // shoulder hump under a thunderhead mane
  body.add(part(sph(1, 22, 16), C.body, 0, S(1.28), S(0.26), { s: [S(0.52), S(0.42), S(0.6)], ow: 0.06 }));
  const puff = (list) => merge(list.map(([x, y, z, rad], i) => [sph(1, 12, 9), M(S(x), S(y), S(z), 0, 0, 0, S(rad), S(rad * 0.8), S(rad)), i % 3 === 1 ? C.cloud2 : C.cloud]));
  const mane = G('bh-mane' + vi, () => puff([
    [0, 1.8, 0.34, 0.22], [0, 1.68, 0.62, 0.19], [0, 1.74, 0.06, 0.2], [0, 1.62, -0.18, 0.16], [0, 1.52, -0.4, 0.13],
    [0.24, 1.68, 0.44, 0.17], [-0.24, 1.68, 0.44, 0.17], [0.26, 1.62, 0.16, 0.16], [-0.26, 1.62, 0.16, 0.16], [0.18, 1.56, 0.7, 0.14], [-0.18, 1.56, 0.7, 0.14],
    [0.42, 1.44, 0.46, 0.15], [-0.42, 1.44, 0.46, 0.15], [0.44, 1.38, 0.2, 0.13], [-0.44, 1.38, 0.2, 0.13], [0.16, 1.58, -0.14, 0.13], [-0.16, 1.58, -0.14, 0.13],
  ]));
  body.add(part(mane, vc(), 0, 0, 0, { ow: 0.06 }));
  if (C.ice) {
    // frost: faceted ice crystals bristling out of a snow-cloud mane
    const spikes = G('bh-ice', () => {
      const ice = tintByHeight(crystalLathe(5).clone(), C.ice, C.iceTip, -1.6, 1.9);
      return merge([[0, 1.92, 0.36, 0, 0, 0.2], [0, 1.86, 0.08, -0.35, 0, 0.17], [0, 1.72, -0.2, -0.6, 0, 0.14], [0.3, 1.78, 0.46, 0.15, -0.5, 0.15], [-0.3, 1.78, 0.46, 0.15, 0.5, 0.15],
        [0.36, 1.68, 0.14, -0.2, -0.65, 0.13], [-0.36, 1.68, 0.14, -0.2, 0.65, 0.13], [0.48, 1.5, 0.42, 0.1, -1.0, 0.11], [-0.48, 1.5, 0.42, 0.1, 1.0, 0.11]]
        .map(([x, y, z, rx, rz, k]) => [ice, M(S(x), S(y), S(z), rx, 0, rz, S(k * 0.55), S(k), S(k * 0.55))]));
    });
    body.add(faceted(spikes, vc({ emissive: C.iceGlow }), 0.05));
  } else {
    // storm: crackling lightning bolts jutting out of the mane
    const bolts = G('bh-bolts', () => merge([[0.4, 1.66, 0.52, -0.75, 0.4], [-0.4, 1.64, 0.36, 0.8, -0.5], [0.12, 1.92, 0.12, -0.25, 1.4], [-0.2, 1.84, -0.2, 0.45, 2.2], [0.46, 1.5, -0.1, -1.05, -0.3], [-0.12, 1.86, 0.52, 0.3, 0.9]]
      .map(([x, y, z, rz, ry]) => [boltGeo(), M(S(x), S(y), S(z), 0, ry, rz, S(0.48), S(0.48), S(0.48), 'YXZ')])));
    body.add(new THREE.Mesh(bolts, glowDS(C.bolt)));
  }
  // floating crackle orbs circling the mane
  const orbit = new THREE.Group(); orbit.position.set(0, S(1.66), S(0.22)); body.add(orbit);
  const orbAngles = [0.3, 2.4, 4.4];
  const orbs = new THREE.Mesh(G('bh-orbs', () => merge(orbAngles.map((a, i) => [sph(1, 10, 8), M(Math.cos(a) * S(0.74), S(0.12 * (i - 1)), Math.sin(a) * S(0.74), 0, 0, 0, S(0.05))]))), glow(0xffffff));
  orbit.add(orbs);
  orbAngles.forEach((a, i) => orbit.add(halo(C.glow, S(0.36), [Math.cos(a) * S(0.74), S(0.12 * (i - 1)), Math.sin(a) * S(0.74)], 0.95)));
  spin(orbit, orbs, 0.55);
  body.add(halo(C.glow, S(1.6), [0, S(1.66), S(0.25)], 0.22));
  // storm-cloud cuffs above each hoof and on the tail tip
  const cuff = G('bh-cuff' + vi, () => merge([[0.1, -0.5, 0], [-0.1, -0.5, 0], [0, -0.48, 0.1], [0, -0.52, -0.1], [0.05, -0.43, 0.06]].map(([x, y, z], i) => [sph(1, 10, 8), M(S(x), S(y), S(z), 0, 0, 0, S(i === 4 ? 0.06 : 0.075)), i === 2 ? C.cloud2 : C.cloud])));
  P.legs.forEach((l) => l.add(part(cuff, vc(), 0, 0, 0, { ow: 0.05 })));
  P.tail.add(part(G('bh-tuft' + vi, () => puff([[0, -0.3, -0.42, 0.12], [0.07, -0.25, -0.38, 0.09], [-0.06, -0.26, -0.46, 0.09], [0, -0.36, -0.46, 0.09]])), vc(), 0, 0, 0, { ow: 0.05 }));

  // head: great curved horns + rhino nose horn (one merged mesh), armoured brow, cloud forelock and beard
  const hornCol = (u, c) => (u > 0.05 && u < 0.15 ? c.set(C.band) : c.set(C.horn).lerp(new THREE.Color(C.hornTip), Math.max(0, u - 0.5) * 2));
  const horn = tubeGeo('bh-horn' + vi, [[0.18, 0.18, 0], [0.44, 0.25, 0.03], [0.66, 0.4, 0.12], [0.74, 0.62, 0.3], [0.64, 0.8, 0.5]].map((p) => p.map(S)), S(0.115), { segs: 26, radial: 10, tip: 0.06, taper: 1.3, colors: hornCol });
  const nose = tubeGeo('bh-nose' + vi, [[0, 0.0, 0.34], [0, 0.08, 0.44], [0, 0.17, 0.47], [0, 0.25, 0.43]].map((p) => p.map(S)), S(0.07), { segs: 12, radial: 8, tip: 0.1, colors: (u, c) => c.set(C.horn) });
  head.add(part(G('bh-horns' + vi, () => merge([[horn], [horn, M(0, 0, 0, 0, 0, 0, -1, 1, 1)], [nose]])), vc(), 0, 0, 0, { ow: 0.05 }));
  const helm = G('bh-helm', () => new THREE.SphereGeometry(1, 22, 10, 0, Math.PI * 2, 0, 1.05));
  const brow = G('bh-brow' + vi, () => merge([
    [helm, M(0, S(0.01), S(-0.01), 0.12, 0, 0, S(0.365)), C.armor],
    [box(1, 1, 1), M(0, S(0.36), S(0.04), 0.1, 0, 0, S(0.05), S(0.06), S(0.36)), C.trim],
    [box(1, 1, 1), M(S(0.125), S(0.19), S(0.28), -0.35, 0, -0.42, S(0.22), S(0.055), S(0.12)), C.trim],
    [box(1, 1, 1), M(S(-0.125), S(0.19), S(0.28), -0.35, 0, 0.42, S(0.22), S(0.055), S(0.12)), C.trim],
  ]));
  head.add(part(brow, vc(), 0, 0, 0, { ow: 0.045 }));
  const gem = new THREE.Mesh(oct(1), glow(C.glow)); gem.position.set(0, S(0.25), S(0.31)); gem.scale.set(S(0.05), S(0.075), S(0.035)); gem.rotation.x = -0.6; head.add(gem);
  head.add(part(G('bh-headcloud' + vi, () => puff([[0, 0.34, 0.0, 0.13], [0.13, 0.31, -0.06, 0.1], [-0.13, 0.31, -0.06, 0.1], [0, 0.3, -0.16, 0.11],
    [0, -0.29, 0.14, 0.12], [0.11, -0.26, 0.06, 0.1], [-0.11, -0.26, 0.06, 0.1], [0, -0.33, 0.02, 0.1]])), vc(), 0, 0, 0, { ow: 0.045 }));
  // glowing storm eyes
  for (const s of [-1, 1]) head.add(halo(C.glow, S(0.2), [s * S(0.099), S(0.117), S(0.33)], 0.9));
  head.add(halo(C.glow, S(1.0), [0, S(0.1), S(0.1)], 0.18));

  r.userData.height = 7;
  return r;
}

// ---------------------------------------------------------------- Pumpkin King (Harvest Moon festival world boss)
const PK_N = 10, PK_DEPTH = 0.075, PK_DIMPLE = 0.25;
const vineArmGeo = () => G('pk-arm', () => {
  const hx = 0.78, hy = -1.78, hz = 0.34, L = [
    [tubeGeo('pk-vine', [[-0.4, 0.05, 0], [0.32, -0.1, 0.05], [0.76, -0.55, 0.12], [0.88, -1.12, 0.2], [0.8, -1.64, 0.3]], 0.27, { tip: 0.62, segs: 26, radial: 10 }), undefined, 0x3f8a2e],
    [curlGeo(), M(0.66, -0.36, 0.22, 0, 0, 0.6, 1.3), 0x5aa83a],
    [curlGeo(), M(1.02, -1.0, 0.1, 0, Math.PI, -0.4, 1.1), 0x5aa83a],
    [leafGeo(), M(0.46, -0.2, 0.16, 0.3, 0, -1.0, 0.55), 0x6ad04a],
    [leafGeo(), M(0.98, -0.8, 0.18, 0.5, 0, -1.7, 0.5), 0x6ad04a],
    [sph(1, 14, 10), M(hx, hy, hz, 0, 0, 0, 0.36), 0x4a9a34],
  ];
  for (let k = -2; k <= 2; k++) L.push([leafGeo(), M(hx, hy, hz, -0.55 + Math.abs(k) * 0.14, 0, Math.PI + k * 0.42, 0.78, 0.84, 0.78), k % 2 ? 0x8ae05a : 0x74d04a]);
  return merge(L);
});
const rootLegGeo = () => G('pk-leg', () => merge([
  [tubeGeo('pk-leg0', [[0, 0.4, 0], [0.02, -0.35, 0.02], [0.06, -1.05, 0.06], [0.08, -1.52, 0.1]], 0.46, { tip: 0.72, segs: 14, radial: 10 }), undefined, 0x7a5232],
  [sph(1, 12, 10), M(0.08, -1.52, 0.1, 0, 0, 0, 0.33, 0.28, 0.33), 0x7a5232],
  [tubeGeo('pk-toe0', [[0.06, -1.5, 0.12], [0.14, -1.76, 0.45], [0.2, -1.84, 0.84]], 0.2, { tip: 0.2, radial: 7, segs: 10 }), undefined, 0x8e623c],
  [tubeGeo('pk-toe1', [[0.12, -1.5, 0.05], [0.48, -1.76, 0.22], [0.8, -1.84, 0.34]], 0.18, { tip: 0.2, radial: 7, segs: 10 }), undefined, 0x8e623c],
  [tubeGeo('pk-toe2', [[0.0, -1.5, 0.08], [-0.24, -1.76, 0.36], [-0.36, -1.84, 0.62]], 0.17, { tip: 0.2, radial: 7, segs: 10 }), undefined, 0x8e623c],
  [tubeGeo('pk-toe3', [[0.06, -1.5, -0.02], [0.12, -1.78, -0.36], [0.16, -1.86, -0.6]], 0.16, { tip: 0.2, radial: 7, segs: 10 }), undefined, 0x8e623c],
]));
// Royal cape wrapped round the back with a high gold-rimmed collar and a tattered hem (vertex-coloured lathe).
const capeGeo = () => G('pk-cape', () => {
  const prof = [[2.95, 0.45, 0x4a1a6a], [2.78, 1.1, 0x5a2280], [2.62, 1.9, 0x6a2a9a], [2.52, 2.9, 0x6a2a9a], [2.4, 3.7, 0x6a2a9a], [2.02, 4.42, 0x6a2a9a], [1.62, 4.74, 0x6a2a9a], [1.76, 5.08, 0x7a34b0], [2.06, 5.4, 0x7a34b0], [2.14, 5.48, 0xf4c445]];
  const segs = 16, g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), segs, Math.PI / 2 + 0.32, Math.PI - 0.64);
  const p = g.attributes.position, n = prof.length, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i <= segs; i++) {
    for (let j = 0; j < n; j++) {
      const id = i * n + j;
      if (j === 0 && i % 2) p.setY(id, p.getY(id) + 0.5 + (i % 3) * 0.12);
      if (j === 1 && i % 4 === 1) p.setY(id, p.getY(id) + 0.18);
      c.set(prof[j][2]); col.set([c.r, c.g, c.b], id * 3);
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
});
const crownGeo = () => G('pk-crown', () => {
  const gold = 0xf6c445, deep = 0xd8962a, L = [
    [cyl(0.8, 0.72, 0.44, 22, true), M(0, 0.22, 0), gold],
    [tor(0.74, 0.07, 8, 30), M(0, 0.02, 0, Math.PI / 2), deep],
    [tor(0.81, 0.055, 8, 30), M(0, 0.44, 0, Math.PI / 2), deep],
  ];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2, big = i === 0, h = big ? 0.62 : 0.48, x = Math.sin(a) * 0.8, z = Math.cos(a) * 0.8;
    L.push([cone(big ? 0.2 : 0.16, h, 8), M(x, 0.44 + h / 2, z, Math.cos(a) * 0.14, 0, -Math.sin(a) * 0.14), gold]);
    L.push([sph(big ? 0.09 : 0.075, 10, 8), M(x * 1.06, 0.44 + h + 0.02, z * 1.06), 0xffe68a]);
  }
  return merge(L);
});
const crownGemGeo = () => G('pk-gems', () => merge([
  [oct(1), M(0, 0.23, 0.79, 0, 0, 0, 0.14, 0.18, 0.08), 0xff3a5a],
  [oct(1), M(Math.sin(1.25) * 0.79, 0.23, Math.cos(1.25) * 0.79, 0, 1.25, 0, 0.1, 0.13, 0.06), 0x3aff9a],
  [oct(1), M(Math.sin(-1.25) * 0.79, 0.23, Math.cos(-1.25) * 0.79, 0, -1.25, 0, 0.1, 0.13, 0.06), 0x4ab4ff],
  [oct(1), M(Math.sin(2.5) * 0.79, 0.23, Math.cos(2.5) * 0.79, 0, 2.5, 0, 0.1, 0.13, 0.06), 0xc04aff],
  [oct(1), M(Math.sin(-2.5) * 0.79, 0.23, Math.cos(-2.5) * 0.79, 0, -2.5, 0, 0.1, 0.13, 0.06), 0xc04aff],
]));
const kingSproutGeo = () => G('pk-sprout', () => merge([
  [tubeGeo('pk-stem', [[0, -0.25, 0], [0.03, 0.3, 0], [-0.06, 0.78, 0.03], [0.12, 1.08, 0.08]], 0.27, { tip: 0.62, segs: 16, radial: 9 }), undefined, 0x627a2a],
  [sph(1, 12, 10), M(0.12, 1.08, 0.08, 0, 0, 0, 0.18, 0.12, 0.18), 0x9ab04a],
  [curlGeo(), M(0.12, 0.72, 0.16, 0, 0.2, 0.3, 1.7), 0x5aa83a],
  [leafGeo(), M(0.2, 0.0, 0.1, Math.PI / 2 + 0.5, 2.2, 0, 1.15, 1.25, 1.15, 'YXZ'), 0x4aa83a],
  [leafGeo(), M(-0.2, 0.0, -0.1, Math.PI / 2 + 0.45, -2.5, 0, 1.0, 1.1, 1.0, 'YXZ'), 0x5ab846],
  [leafGeo(), M(0.1, 0.0, -0.2, Math.PI / 2 + 0.55, 3.4, 0, 0.9, 1.0, 0.9, 'YXZ'), 0x4aa83a],
]));
function pumpkinKing() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const R = 2.3, RY = 1.95, CY = 3.25;
  body.add(part(pumpkinGeo(PK_N, PK_DEPTH, PK_DIMPLE, 0xff8c1a, 0xb8460c), vc(), 0, CY, 0, { s: [R, RY, R], ow: 0.065 }));
  faceOn(body, pumpkinPatch(PK_N, PK_DEPTH, PK_DIMPLE, 2.2, 1.0, 1.25), carvedFace('king'), [R, RY, R]).position.y = CY;
  body.add(halo(0xffa030, 4.6, [0, CY - 0.15, R + 0.5], 0.42));
  for (const s of [-1, 1]) body.add(halo(0xffd060, 1.3, [s * 0.95, CY + 0.72, R * 0.88], 0.6));
  // crown of the harvest: stem and leaves on top, a crooked gold crown set askew around the stem
  body.add(part(kingSproutGeo(), vc(), 0, CY + RY * (1 - PK_DIMPLE) - 0.08, 0, { ow: 0.04 }));
  const crown = new THREE.Group(); crown.position.set(0.08, CY + RY * 0.8, -0.02); crown.rotation.set(-0.14, 0.15, 0.24); crown.scale.setScalar(1.3); body.add(crown);
  crown.add(part(crownGeo(), vc({ side: DS }), 0, 0, 0, { ow: 0.035 }));
  crown.add(part(crownGemGeo(), glowVC(), 0, 0, 0, { ow: 0.02 }));
  body.add(part(capeGeo(), vc({ side: DS }), 0, 0, 0, { ow: 0.04 }));
  // vine arms with leafy hands (shoulder pivots, hanging down: the stomp swing lifts them overhead)
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(s * 2.0, CY + 0.75, 0.3); body.add(arm);
    const m = new THREE.Group(); m.scale.x = s; arm.add(m);
    m.add(part(vineArmGeo(), vc(), 0, 0, 0, { ow: 0.045 }));
    arms.push(arm);
    const leg = new THREE.Group(); leg.position.set(s * 0.95, 1.9, 0.05); body.add(leg);
    const lm = new THREE.Group(); lm.scale.x = s; leg.add(lm);
    lm.add(part(rootLegGeo(), vc(), 0, 0, 0, { ow: 0.05 }));
    legs.push(leg);
  }
  // will-o'-wisp lanterns circling the king
  const orbit = new THREE.Group(); orbit.position.y = CY + 0.8; body.add(orbit);
  const wa = [0.4, 2.5, 4.6];
  const wisps = new THREE.Mesh(G('pk-wisps', () => merge(wa.map((a, i) => [sph(1, 10, 8), M(Math.cos(a) * 3.3, (i - 1) * 0.45, Math.sin(a) * 3.3, 0, 0, 0, 0.17, 0.22, 0.17)]))), glow(0xffe08a));
  orbit.add(wisps);
  wa.forEach((a, i) => orbit.add(halo(0xff9a2a, 1.4, [Math.cos(a) * 3.3, (i - 1) * 0.45, Math.sin(a) * 3.3], 0.9)));
  spin(orbit, wisps, 0.45);
  root.userData.parts = { body, arms, legs, crown };
  root.userData.anim = 'stomp';
  root.userData.height = 7;
  root.scale.setScalar(1.12);
  return root;
}

// ---------------------------------------------------------------- Jackpuff (Lv 1-15 farmable event monster, bounces)
// Same rig as buildJelly: body raised to 0.6 and squashed so animateCreature's 'bounce' fits.
function bounceRig() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  body.position.y = 0.6; body.scale.set(1, 0.82, 1);
  return { root, body };
}
const JP_N = 8, JP_DEPTH = 0.1, JP_DIMPLE = 0.2;
const scarfGeo = (main, stripe) => G(`scarf${main}|${stripe}`, () => merge([
  [tor(0.68, 0.11, 8, 30), M(0, 0, 0, Math.PI / 2), main],
  [sph(1, 12, 10), M(0.38, -0.04, 0.55, 0, 0, 0, 0.14, 0.12, 0.12), main],
  [box(0.2, 0.36, 0.07), M(0.42, -0.2, 0.58, 0.2, -0.5, 0.18), main],
  [box(0.215, 0.05, 0.085), M(0.416, -0.16, 0.58, 0.2, -0.5, 0.18), stripe],
  [box(0.215, 0.05, 0.085), M(0.43, -0.28, 0.6, 0.2, -0.5, 0.18), stripe],
]));
const hollyGeo = () => G('holly', () => merge([
  [tubeGeo('holly-twig', [[0, -0.04, 0], [0.02, 0.1, 0], [0.07, 0.2, 0.02]], 0.032, { tip: 0.6, segs: 8, radial: 6 }), undefined, 0x7a5232],
  [leafGeo(), M(0, 0.04, 0, Math.PI / 2 + 0.25, 0.9, 0, 0.2, 0.3, 0.2, 'YXZ'), 0x2a9a46],
  [leafGeo(), M(0, 0.04, 0, Math.PI / 2 + 0.25, -0.9, 0, 0.2, 0.3, 0.2, 'YXZ'), 0x2a9a46],
  [sph(0.055, 10, 8), M(0.02, 0.08, 0.06), 0xe8203a],
  [sph(0.05, 10, 8), M(-0.05, 0.07, 0.03), 0xe8203a],
  [sph(0.048, 10, 8), M(0.05, 0.06, -0.03), 0xff3a4a],
]));
const blossomCrownGeo = () => G('blossomcrown', () => {
  const L = [];
  for (let i = 0; i < 5; i++) L.push([petalGeo(0xff3d8e, 0xffa0c8), M(0, 0, 0, Math.PI / 2 - 0.72, (i / 5) * Math.PI * 2 + 0.3, 0, 0.56, 0.56, 0.56, 'YXZ')]);
  for (let i = 0; i < 5; i++) L.push([petalGeo(0xff6aa8, 0xffd2e6), M(0, 0.05, 0, Math.PI / 2 - 1.15, (i / 5) * Math.PI * 2 + 0.93, 0, 0.36, 0.36, 0.36, 'YXZ')]);
  L.push([sph(0.11, 12, 10), M(0, 0.1, 0), 0xffe27a]);
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; L.push([sph(0.035, 8, 6), M(Math.sin(a) * 0.15, 0.2, Math.cos(a) * 0.15), 0xffa83a]); }
  return merge(L);
});
function jackpuff(variant) {
  const v = ((variant % 3) + 3) % 3;
  const { root, body } = bounceRig();
  if (v === 0) {
    const s = [0.8, 0.76, 0.8];
    body.add(part(pumpkinGeo(JP_N, JP_DEPTH, JP_DIMPLE, 0xffa030, 0xd05a14), vc(), 0, 0, 0, { s, ow: 0.03 }));
    faceOn(body, pumpkinPatch(JP_N, JP_DEPTH, JP_DIMPLE, 1.9, 1.05, 1.15), carvedFace('cute'), s);
    body.add(part(sproutGeo(), vc(), 0, 0.58, 0, { ow: 0.018 }));
    body.add(halo(0xffb040, 1.5, [0, -0.05, 0.9], 0.35));
  } else if (v === 1) {
    body.add(part(sph(0.75, 24, 18), 0xf6fbff, 0, 0, 0, { ow: 0.03 }));
    faceOn(body, spherePatch(0.756, 1.6, 0.95, 1.1), snowFace('#2a2440'));
    body.add(part(cone(0.075, 0.36, 10), 0xff8a2a, 0, 0.03, 0.88, { r: [Math.PI / 2, 0, 0], ow: 0.015 }));
    body.add(part(scarfGeo(0xe8343a, 0xffffff), vc(), 0, -0.34, 0, { ow: 0.02 }));
    body.add(part(hollyGeo(), vc(), 0.12, 0.72, -0.05, { ow: 0.015 }));
  } else {
    body.add(part(sph(0.75, 24, 18), 0xffd8e8, 0, 0, 0, { ow: 0.03 }));
    faceOn(body, spherePatch(0.756, 1.5, 1.15, 1.0), critterFace({ mood: 'happy', eye: '#7a2a52', mouth: 'cat' }));
    body.add(part(blossomCrownGeo(), vc(), 0, 0.64, 0, { ow: 0.016 }));
    body.add(halo(0xffb0d8, 2.0, [0, 0.1, 0], 0.22));
  }
  root.userData.parts = { body };
  root.userData.anim = 'bounce';
  root.userData.height = 1.5;
  return root;
}

// ---------------------------------------------------------------- Guild-war spirit crystal (objective)
const WAR = [
  { crystal: 0x5ac8ff, deep: 0x2a6ae0, tip: 0xd8f8ff, emissive: 0x123a7a, glow: 0x6af0ff, rune: 0x5ae8ff, circle: '#8af4ff' },
  { crystal: 0xff5a6a, deep: 0xb81830, tip: 0xffd8dc, emissive: 0x6a0a18, glow: 0xff6a5a, rune: 0xff4a4a, circle: '#ff9a8a' },
];
const crystalLathe = (n = 6) => G('crys' + n, () => new THREE.LatheGeometry([[0, -1.65], [0.62, -0.55], [0.78, 0.15], [0.7, 0.75], [0, 1.95]].map(([x, y]) => new THREE.Vector2(x, y)), n));
function tintByHeight(g, c0, c1, y0, y1) {
  const p = g.attributes.position, a = new THREE.Color(c0), b = new THREE.Color(c1), c = new THREE.Color(), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { c.copy(a).lerp(b, THREE.MathUtils.clamp((p.getY(i) - y0) / (y1 - y0), 0, 1)); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function warCrystal(variant) {
  const vi = variant === 1 ? 1 : 0, C = WAR[vi];
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  // carved stone pedestal (stays grounded on root)
  const stone = G('wc-stone', () => {
    const L = [[cyl(1.95, 2.15, 0.36, 18), M(0, 0.18, 0), 0x6e7892], [cyl(1.5, 1.62, 0.56, 18), M(0, 0.64, 0), 0x929cb6], [cyl(1.78, 1.6, 0.26, 18), M(0, 1.04, 0), 0xaab4ca]];
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; L.push([box(0.34, 0.62, 0.3), M(Math.sin(a) * 1.62, 0.64, Math.cos(a) * 1.62, 0, a, 0), 0x828ca8]); }
    return merge(L);
  });
  root.add(part(stone, vc(), 0, 0, 0, { ow: 0.04 }));
  const band = new THREE.Mesh(cyl(1.535, 1.535, 0.34, 32, true), MAT('wc-band' + vi, () => new THREE.MeshBasicMaterial({ map: runeBandTexture(), color: C.rune, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  band.position.y = 0.64; root.add(band);
  root.add(part(G('wc-rings', () => merge([[tor(2.0, 0.035, 6, 48), M(0, 0.37, 0, Math.PI / 2)], [tor(1.66, 0.03, 6, 48), M(0, 1.18, 0, Math.PI / 2)]])), glow(C.glow), 0, 0, 0));
  const circle = new THREE.Mesh(G('wc-circle', () => new THREE.PlaneGeometry(3.2, 3.2)), MAT('wc-circle' + vi, () => new THREE.MeshBasicMaterial({ map: magicCircleTexture(C.circle), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  circle.rotation.x = -Math.PI / 2; circle.position.y = 1.18; root.add(circle);
  root.add(part(cyl(0.22, 0.75, 0.9, 16, true), glow(C.glow, 0.28, true), 0, 1.62, 0));
  // the floating faceted crystal cluster
  const cy = 3.2;
  const crystal = G('wc-crystal' + vi, () => {
    const main = tintByHeight(crystalLathe(6).clone(), C.deep, C.tip, -1.6, 1.9);
    const small = tintByHeight(crystalLathe(5).clone(), C.deep, C.crystal, -1.6, 1.9);
    // smaller crystals growing up and out of the lower half: a cluster rather than a lone spike
    return merge([[main], ...[[0.6, -0.45, 0.42], [2.7, -0.6, 0.36], [4.6, -0.5, 0.32], [1.7, -0.8, 0.26], [3.7, -0.85, 0.24], [5.6, -0.8, 0.22]]
      .map(([a, y, k]) => [small, M(Math.sin(a) * 0.5, y, Math.cos(a) * 0.5, 0.62, a, 0, k * 0.85, k, k * 0.85, 'YXZ')])]);
  });
  const crysMat = vc({ emissive: C.emissive });
  const cm = faceted(crystal, crysMat, 0.05); cm.position.y = cy; body.add(cm);
  const ring = new THREE.Group(); ring.position.y = cy; body.add(ring);
  const shards = G('wc-shards' + vi, () => merge([[0, 0.3, 0.5], [2.1, -0.5, -0.3], [4.2, 0.75, 0.2]].map(([a, y, t]) => [octSmooth(), M(Math.cos(a) * 1.75, y, Math.sin(a) * 1.75, t, 0, 0.4, 0.17, 0.44, 0.17), C.crystal])));
  const sh = faceted(shards, crysMat, 0.03);
  ring.add(sh);
  ring.add(part(G('wc-halo-rings', () => merge([[tor(1.25, 0.03, 6, 48), M(0, 0, 0, Math.PI / 2 + 0.28)], [tor(1.1, 0.025, 6, 48), M(0, 0.1, 0, Math.PI / 2 - 0.3, 0.9)]])), glow(C.glow, 0.9, true), 0, 0, 0));
  spin(ring, sh, 0.6);
  body.add(halo(C.glow, 7.5, [0, cy, 0], 0.5));
  body.add(halo(C.tip, 3.0, [0, cy + 0.2, 0], 0.55));
  root.userData.parts = { body, ring };
  root.userData.anim = 'float';
  root.userData.height = 5.5;
  return root;
}

export function buildEventMonster(model, variant = 0) {
  switch (model) {
    case 'behemoth': return behemoth(variant);
    case 'pumpkinking': return pumpkinKing();
    case 'jackpuff': return jackpuff(variant);
    case 'warcrystal': return warCrystal(variant);
  }
  return jackpuff(0);
}

// ---------------------------------------------------------------- Event pets
// Bouncing pets keep the bounce rig at full size inside a scaled holder, so outside code may still set root.scale freely.
function petBounceRig(k) {
  const root = new THREE.Group(), holder = new THREE.Group(), body = new THREE.Group();
  root.add(holder); holder.add(body); holder.scale.setScalar(k);
  body.position.y = 0.6; body.scale.set(1, 0.82, 1);
  return { root, body };
}
function finish(root, body, anim, height) {
  root.userData.parts = { body };
  root.userData.anim = anim;
  root.userData.height = height;
  root.userData.isPet = true;
  return root;
}
const feetGeo = (c) => G('feet' + c, () => merge([-1, 1].map((s) => [sph(1, 12, 8), M(0.3 * s, -0.64, 0.3, 0, 0, 0, 0.2, 0.13, 0.27), c])));
const twigArmsGeo = () => G('twigarms', () => {
  const arm = tubeGeo('twigarm', [[0.6, 0.0, 0], [0.86, 0.1, 0.04], [1.08, 0.3, 0.06]], 0.045, { tip: 0.5, segs: 10, radial: 6 });
  const fork = tubeGeo('twigfork', [[0.9, 0.12, 0.04], [1.02, 0.12, 0.12], [1.12, 0.06, 0.18]], 0.03, { tip: 0.5, segs: 6, radial: 5 });
  return merge([[arm, undefined, 0x7a5232], [fork, undefined, 0x7a5232], [arm, M(0, 0, 0, 0, 0, 0, -1, 1, 1), 0x7a5232], [fork, M(0, 0, 0, 0, 0, 0, -1, 1, 1), 0x7a5232]]);
});
const beanieGeo = () => G('beanie', () => merge([
  [G('beaniecap', () => new THREE.SphereGeometry(0.78, 22, 10, 0, Math.PI * 2, 0, 1.1)), M(0, 0.02, 0, 0, 0, 0, 1, 1.28, 1), 0x5a9af0],
  [tor(0.6, 0.045, 6, 30), M(0, 0.66, 0, Math.PI / 2), 0xffffff],
  [tor(0.43, 0.04, 6, 30), M(0, 0.86, 0, Math.PI / 2), 0xffffff],
  [tor(0.67, 0.12, 8, 30), M(0, 0.4, 0, Math.PI / 2), 0x2f62c8],
  [sph(0.19, 12, 10), M(0, 1.06, 0), 0xffffff],
]));
function pumpkinPet() {
  const { root, body } = petBounceRig(0.4);
  const s = [0.8, 0.74, 0.8];
  body.add(part(pumpkinGeo(JP_N, JP_DEPTH, JP_DIMPLE, 0xffa53a, 0xe0661c), vc(), 0, 0, 0, { s, ow: 0.035 }));
  faceOn(body, pumpkinPatch(JP_N, JP_DEPTH, JP_DIMPLE, 1.55, 1.12, 1.0, 0.014), critterFace({ mood: 'happy', mouth: 'smile', eye: '#2a1408' }), s);
  body.add(part(sproutGeo(), vc(), 0, 0.57, 0, { ow: 0.02 }));
  body.add(part(feetGeo(0xe8862a), vc(), 0, 0, 0, { ow: 0.025 }));
  return finish(root, body, 'bounce', 0.85);
}
function snowpuffPet() {
  const { root, body } = petBounceRig(0.35);
  body.add(part(sph(0.75, 24, 18), 0xf6fbff, 0, 0, 0, { ow: 0.035 }));
  faceOn(body, spherePatch(0.756, 1.6, 0.95, 1.1), snowFace('#2a2440', 'cat'));
  body.add(part(cone(0.08, 0.3, 10), 0xff8a2a, 0, 0.03, 0.86, { r: [Math.PI / 2, 0, 0], ow: 0.02 }));
  body.add(part(scarfGeo(0xe8343a, 0xfff4d8), vc(), 0, -0.34, 0, { ow: 0.025 }));
  body.add(part(beanieGeo(), vc(), 0, 0.02, 0, { r: [0.05, 0, -0.14], ow: 0.025 }));
  body.add(part(twigArmsGeo(), vc(), 0, -0.1, 0, { ow: 0.02 }));
  return finish(root, body, 'bounce', 0.75);
}
function blossomPet() {
  // body is what the 'float' animation lifts; the spirit is built at a comfortable size inside and shrunk to pet scale
  const root = new THREE.Group(), body = new THREE.Group(), g = new THREE.Group(); root.add(body); body.add(g); g.scale.setScalar(0.78);
  const y = 0.42;
  g.add(part(sph(0.26, 22, 16), 0xffc6de, 0, y, 0, { ow: 0.022 }));
  faceOn(g, spherePatch(0.262, 1.6, 1.12, 1.0), critterFace({ mood: 'happy', eye: '#7a2a5a', mouth: 'smile' })).position.y = y;
  const petals = G('blossom-petals', () => {
    const L = [];
    for (const s of [-1, 1]) L.push([petalGeo(0xff7ab4, 0xffe8f4), M(0.12 * s, y + 0.17, -0.02, -0.15, 0, -s * 0.5, 0.3, 0.36, 0.3)]);
    for (let i = 0; i < 5; i++) L.push([petalGeo(0xffa8cc, 0xfff0f6), M(0, y - 0.12, 0, Math.PI / 2 + 0.95, (i / 5) * Math.PI * 2, 0, 0.24, 0.26, 0.24, 'YXZ')]);
    for (let i = 0; i < 5; i++) L.push([petalGeo(0xff6aa8, 0xffd8ea), M(0.2, y + 0.2, 0.08, Math.PI / 2 - 0.9, (i / 5) * Math.PI * 2, 0, 0.07, 0.07, 0.07, 'YXZ')]);
    L.push([sph(0.03, 8, 6), M(0.2, y + 0.21, 0.08), 0xffe27a]);
    return merge(L);
  });
  g.add(part(petals, vc(), 0, 0, 0, { ow: 0.015 }));
  // three drifting petals circling the spirit
  const orbit = new THREE.Group(); orbit.position.y = y; g.add(orbit);
  const drift = new THREE.Mesh(G('blossom-drift', () => merge([0, 2.1, 4.2].map((a, i) => [petalGeo(0xff8abc, 0xffe8f4), M(Math.cos(a) * 0.42, (i - 1) * 0.08, Math.sin(a) * 0.42, 0.6, a, 0.8, 0.09)]))), vc({ side: DS }));
  orbit.add(drift);
  spin(orbit, drift, 1.2);
  g.add(halo(0xffb0d8, 1.0, [0, y, 0], 0.4));
  return finish(root, body, 'float', 0.9);
}

export function buildEventPet(model) {
  switch (model) {
    case 'pumpkin': return pumpkinPet();
    case 'snowpuff': return snowpuffPet();
    case 'blossom': return blossomPet();
  }
  return pumpkinPet();
}
