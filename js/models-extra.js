// Extra collectibles: companion pets, rideable mounts, gathering nodes and farm crops.
// Same chibi toon style as models.js (ink outlines, critter faces, cached geometry). Forward is +Z, feet at y=0.
import * as THREE from 'three';
import { toon, glow, mesh, outlineMaterial, critterFace, glowTexture } from './toon.js';
import { buildQuad } from './models.js';

export const EXTRA_PET_MODELS = new Set(['fox', 'bee', 'frog', 'imp', 'yeti', 'turtle', 'bat', 'phoenix', 'whale', 'kitsune', 'panda', 'icedragon']);
export const EXTRA_MOUNT_MODELS = new Set(['lion', 'bear', 'stag', 'griffin', 'panther', 'drake', 'cloud', 'phoenixmount']);

// ---------------------------------------------------------------- shared helpers
const geo = new Map();
const G = (k, fn) => { if (!geo.has(k)) geo.set(k, fn()); return geo.get(k); };
const sph = (r, w = 16, h = 12) => G(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const cone = (r, h, s = 10) => G(`c${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const cyl = (a, b, h, s = 14, open = false) => G(`y${a}|${b}|${h}|${s}|${open}`, () => new THREE.CylinderGeometry(a, b, h, s, 1, open));
const box = (x, y, z) => G(`b${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z));
const tor = (r, t, rs = 8, ts = 24, arc = Math.PI * 2) => G(`t${r}|${t}|${rs}|${ts}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const oct = () => G('oct', () => new THREE.OctahedronGeometry(1, 0));
const cap = (r, w = 14, h = 8, t = 1.2) => G(`cap${r}|${w}|${h}|${t}`, () => new THREE.SphereGeometry(r, w, h, 0, Math.PI * 2, 0, t));
const DS = THREE.DoubleSide;

const mats = new Map();
const MAT = (k, fn) => { if (!mats.has(k)) mats.set(k, fn()); return mats.get(k); };
// Vertex-coloured toon: one merged mesh carries several colours (one draw call plus its ink hull).
const vc = (o = {}) => toon(0xffffff, { vertexColors: true, ...o });
const glowVC = () => MAT('gvc', () => new THREE.MeshBasicMaterial({ vertexColors: true }));
const faceMat = (tex) => MAT('face' + tex.uuid, () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));

// Outline width is in world-ish units, compensated for the part's own scale (as models.js does).
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
  const s = new THREE.Sprite(MAT(`halo${color}|${opacity}`, () => new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, opacity })));
  s.scale.setScalar(size); s.position.set(x, y, z); s.raycast = () => {};
  return s;
}
function sparkle(color, size, [x, y, z] = [0, 0, 0]) {
  const s = new THREE.Sprite(MAT('spk' + color, () => new THREE.SpriteMaterial({ map: sparkleTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false })));
  s.scale.setScalar(size); s.position.set(x, y, z); s.raycast = () => {};
  return s;
}
// Self-driven motion for bits animateCreature does not pose: they update right before they draw.
function tick(carrier, fn) {
  const t0 = Math.random() * 20;
  carrier.onBeforeRender = () => fn(performance.now() / 1000 + t0);
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, order = 'XYZ') {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, order)), _s.set(sx, sy, sz));
}
// Matrix that stands a +Y piece of unit length on point a and points it at b; r scales its girth.
function along(a, b, r, len = 1) {
  const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
  return new THREE.Matrix4().compose(new THREE.Vector3(...a), new THREE.Quaternion().setFromUnitVectors(_up, d.normalize()), new THREE.Vector3(r, L * len, r));
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
// Average normals of coincident vertices so seams, poles and bevels keep a crack-free ink hull.
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
  return g;
}
// Colour ramp: stops [[t, hex], ...] -> (color, t) => color.
function ramp(stops) {
  const cs = stops.map(([t, h]) => [t, new THREE.Color(h)]);
  return (c, t) => {
    if (t <= cs[0][0]) return c.copy(cs[0][1]);
    for (let i = 1; i < cs.length; i++) if (t <= cs[i][0]) return c.copy(cs[i - 1][1]).lerp(cs[i][1], (t - cs[i - 1][0]) / (cs[i][0] - cs[i - 1][0]));
    return c.copy(cs[cs.length - 1][1]);
  };
}
function paint(g, fn) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(c, p.getX(i), p.getY(i), p.getZ(i), i); col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// Tube along a smooth curve, tapering toward the end (horns, tails, stalks, vines).
function tubeGeo(key, pts, r0, { segs = 16, radial = 8, tip = 0.15, taper = 1 } = {}) {
  return G('tube' + key, () => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    const g = new THREE.TubeGeometry(curve, segs, r0, radial, false);
    const pos = g.attributes.position, P = new THREE.Vector3(), V = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const u = i / segs; curve.getPointAt(u, P);
      const k = 1 - (1 - tip) * Math.pow(u, taper);
      for (let j = 0; j <= radial; j++) {
        const id = i * (radial + 1) + j;
        V.fromBufferAttribute(pos, id).sub(P).multiplyScalar(k).add(P);
        pos.setXYZ(id, V.x, V.y, V.z);
      }
    }
    g.computeBoundingSphere();
    return g;
  });
}
// Bend a +Y lathe in the YZ plane toward +Z with radius R (arc length kept).
function bend(g, R) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), th = y / R;
    p.setXYZ(i, x, (R - z) * Math.sin(th), R - (R - z) * Math.cos(th));
  }
  g.computeVertexNormals();
  return weldNormals(g);
}
const lathe = (prof, n) => new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), n);

// Thin bevelled plates from 2D outlines in the XY plane (base at the origin, tip toward +Y), painted base->tip.
function plate(key, draw, c0, c1 = c0, axis = 'y') {
  return G(`pl${key}|${c0}|${c1}|${axis}`, () => {
    const s = new THREE.Shape(); draw(s);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 2, curveSegments: 8 });
    g.translate(0, 0, -0.02);
    g.computeBoundingBox();
    const hi = axis === 'x' ? g.boundingBox.max.x : g.boundingBox.max.y, r = ramp([[0, c0], [hi, c1]]);
    paint(g, (c, x, y) => r(c, axis === 'x' ? x : y));
    return weldNormals(g);
  });
}
const LEAF = (s) => { s.moveTo(0, 0); s.bezierCurveTo(-0.46, 0.28, -0.36, 0.8, 0, 1); s.bezierCurveTo(0.36, 0.8, 0.46, 0.28, 0, 0); };
const PLUME = (s) => { s.moveTo(0, 0); s.bezierCurveTo(-0.3, 0.1, -0.34, 0.78, -0.06, 1); s.quadraticCurveTo(0.0, 0.97, 0.04, 1); s.bezierCurveTo(0.3, 0.82, 0.3, 0.1, 0, 0); };
const FEATHER = (s) => { s.moveTo(0, 0); s.bezierCurveTo(-0.2, 0.18, -0.24, 0.72, 0, 1); s.bezierCurveTo(0.17, 0.78, 0.2, 0.2, 0, 0); };
const PETAL = (s) => { s.moveTo(0, 0); s.bezierCurveTo(-0.56, 0.25, -0.5, 0.86, -0.17, 1); s.lineTo(0, 0.88); s.lineTo(0.17, 1); s.bezierCurveTo(0.5, 0.86, 0.56, 0.25, 0, 0); };
const POINT = (s) => { s.moveTo(0, 0); s.bezierCurveTo(-0.34, 0.3, -0.24, 0.72, 0, 1); s.bezierCurveTo(0.24, 0.72, 0.34, 0.3, 0, 0); };
const ROUND = (s) => { s.moveTo(0, 0); s.bezierCurveTo(-0.64, 0.08, -0.62, 0.96, 0, 1); s.bezierCurveTo(0.62, 0.96, 0.64, 0.08, 0, 0); };
const FLAMEP = (s) => { s.moveTo(0, 0); s.bezierCurveTo(-0.5, 0.2, -0.3, 0.55, -0.16, 0.7); s.quadraticCurveTo(-0.1, 0.86, 0.06, 1); s.quadraticCurveTo(0.02, 0.8, 0.2, 0.62); s.bezierCurveTo(0.4, 0.4, 0.42, 0.16, 0, 0); };
const BATWING = (s) => { s.moveTo(0, -0.08); s.lineTo(0, 0.08); s.quadraticCurveTo(0.14, 0.3, 0.32, 0.28); s.lineTo(0.56, 0.2); s.quadraticCurveTo(0.44, 0.1, 0.44, -0.04); s.quadraticCurveTo(0.33, 0.04, 0.26, -0.1); s.quadraticCurveTo(0.14, 0.0, 0, -0.08); };
const DRAGWING = (s) => { s.moveTo(0, -0.06); s.lineTo(0, 0.08); s.quadraticCurveTo(0.25, 0.3, 0.58, 0.42); s.quadraticCurveTo(0.5, 0.22, 0.52, 0.06); s.quadraticCurveTo(0.42, 0.12, 0.36, -0.04); s.quadraticCurveTo(0.27, 0.04, 0.18, -0.08); s.quadraticCurveTo(0.1, -0.02, 0, -0.06); };
// Folded drake wing: u runs back along the body, v up (root at the shoulder).
const FOLDWING = (s) => { s.moveTo(0, 0); s.lineTo(-0.08, 0.16); s.lineTo(0.16, 0.44); s.lineTo(1.0, 0.36); s.quadraticCurveTo(0.84, 0.18, 0.8, 0.02); s.quadraticCurveTo(0.62, 0.12, 0.52, -0.04); s.quadraticCurveTo(0.34, 0.08, 0.24, -0.06); s.quadraticCurveTo(0.12, 0.04, 0, 0); };
const FLUKE = (s) => { s.moveTo(0, -0.02); s.bezierCurveTo(0.12, 0.0, 0.3, 0.06, 0.44, 0.3); s.quadraticCurveTo(0.3, 0.2, 0.17, 0.23); s.quadraticCurveTo(0.06, 0.24, 0, 0.13); s.quadraticCurveTo(-0.06, 0.24, -0.17, 0.23); s.quadraticCurveTo(-0.3, 0.2, -0.44, 0.3); s.bezierCurveTo(-0.3, 0.06, -0.12, 0.0, 0, -0.02); };
const leafG = (c0, c1 = c0) => plate('leaf', LEAF, c0, c1);
const featherG = (c0, c1 = c0) => plate('feather', FEATHER, c0, c1);

// Teardrop flame, base at the origin and tip at +Y (length 1), tip flicked toward +X; painted base->middle->tip.
const flameGeo = (c0, c1, c2) => G(`flame${c0}|${c1}|${c2}`, () => {
  const g = lathe([[0, 0], [0.2, 0.05], [0.3, 0.2], [0.28, 0.38], [0.2, 0.58], [0.1, 0.8], [0, 1]], 10);
  const r = ramp([[0, c0], [0.45, c1], [1, c2]]), p = g.attributes.position;
  paint(g, (c, x, y) => r(c, y));
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) + 0.18 * y * y); }
  g.computeVertexNormals();
  return weldNormals(g);
});
// Hexagonal crystal: unit radius, base buried slightly below y=0, point at y=1.
const crystalG = (c0, c1, n = 6) => G(`crys${n}|${c0}|${c1}`, () => {
  const r = ramp([[0, c0], [1, c1]]);
  return paint(lathe([[0, -0.12], [0.86, 0], [1, 0.14], [1, 0.64], [0, 1]], n), (c, x, y) => r(c, y));
});
// 5-point star in the XY plane (radius 1), painted from the centre out.
const starG = (c0, c1, inner = 0.46) => G(`star${c0}|${c1}|${inner}`, () => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const r = i % 2 ? inner : 1, a = (i / 10) * Math.PI * 2 + Math.PI / 2; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.12, bevelSegments: 2 });
  g.translate(0, 0, -0.13);
  const r = ramp([[0, c0], [1.1, c1]]);
  paint(g, (c, x, y) => r(c, Math.hypot(x, y)));
  return weldNormals(g);
});
// Faceted boulder: an icosphere with a positional wobble (identical for shared corners, so no cracks).
const rockGeo = (seed) => G('rock' + seed, () => {
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const k = 1 + 0.15 * Math.sin(v.x * 5.1 + seed * 1.7) * Math.cos(v.y * 4.3 + seed) + 0.08 * Math.sin(v.z * 7.7 + seed * 2.3);
    n.setXYZ(i, v.x, v.y, v.z); p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  return g;
});
// Ribbed gourd (pumpkin / melon): N lobes with creases, dimpled at the poles. stripe paints the creases as bands.
const gourdGeo = (N, depth, cA, cB, stripe = false) => G(`gourd${N}|${depth}|${cA}|${cB}|${stripe}`, () => {
  const g = new THREE.SphereGeometry(1, N * 4, 14), p = g.attributes.position, v = new THREE.Vector3(), a = new THREE.Color(cA), b = new THREE.Color(cB), c = new THREE.Color();
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const h = Math.min(1, Math.hypot(v.x, v.z)), rib = 1 - Math.abs(Math.cos((N * Math.atan2(v.x, v.z)) / 2));
    const m = 1 - depth * rib; v.x *= m; v.z *= m;
    v.y -= Math.sign(v.y) * 0.22 * (1 - h) ** 2;
    p.setXYZ(i, v.x, v.y, v.z);
    c.copy(a).lerp(b, stripe ? (rib > 0.62 ? 1 : 0) : rib ** 2.2); col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return weldNormals(g);
});

// Faceted look for toon (MeshToonMaterial has no flatShading): flat normals to draw, smooth normals for the ink hull.
const flatCache = new WeakMap();
function faceted(g, mat, ow = 0.03) {
  let f = flatCache.get(g);
  if (!f) { f = g.index ? g.toNonIndexed() : g.clone(); f.computeVertexNormals(); flatCache.set(g, f); }
  const m = new THREE.Mesh(f, mat);
  if (ow > 0) { const o = new THREE.Mesh(g, outlineMaterial(ow)); o.userData.isOutline = true; o.raycast = () => {}; m.add(o); }
  return m;
}

// Faces mapped onto the front of a sphere (cached geometry, unlike toon.facePatch).
const spherePatch = (r, w, top, h) => G(`sp${r}|${w}|${top}|${h}`, () => new THREE.SphereGeometry(r, 24, 16, Math.PI / 2 - w / 2, w, top, h));
function face(parent, r, tex, { x = 0, y = 0, z = 0, w = 1.6, top = 1.1, h = 1.0, s = null } = {}) {
  const f = new THREE.Mesh(spherePatch(Math.round(r * 1.012 * 1e4) / 1e4, w, top, h), faceMat(tex));
  f.renderOrder = 2; f.raycast = () => {};
  f.position.set(x, y, z);
  if (s) f.scale.set(...s);
  parent.add(f);
  return f;
}

// Canvas textures
const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
function sparkleTexture() {
  return canvasTex('sparkle', 64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(32, 1); g.quadraticCurveTo(35, 29, 63, 32); g.quadraticCurveTo(35, 35, 32, 63); g.quadraticCurveTo(29, 35, 1, 32); g.quadraticCurveTo(29, 29, 32, 1); g.fill();
  });
}
// Frog: wide grin, nostrils and blush only (its eyes are 3D bulbs).
function frogMouth() {
  return canvasTex('frogmouth', 256, 256, (g) => {
    g.fillStyle = 'rgba(255,110,140,0.6)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 84, 86, 22, 12, 0, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = '#2a5a1a';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 12, 44, 4, 3, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#2a3a14'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(58, 84); g.quadraticCurveTo(128, 150, 198, 84); g.stroke();
    g.fillStyle = '#ff7a8a'; g.beginPath(); g.ellipse(128, 112, 14, 9, 0, 0, Math.PI); g.fill();
  });
}
// Nimbus cloud: big sparkly eyes set wide apart, rosy cheeks and a small smile.
function cloudFace() {
  return canvasTex('cloudface', 256, 256, (g) => {
    for (const s of [-1, 1]) {
      const x = 128 + s * 58, y = 112;
      g.fillStyle = '#2a2a6a'; g.beginPath(); g.ellipse(x, y, 19, 25, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#5a6ad8'; g.beginPath(); g.ellipse(x, y + 10, 12, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 6, y - 9, 8, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + 7, y + 9, 3.5, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(255,120,160,0.6)';
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 96, 150, 24, 13, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#3a2a4a'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.arc(128, 142, 14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  });
}
// Glowing tiger stripes for the shadow panther's flanks (white, tinted by the material). Thick at the spine edge (u=1).
function stripeTexture() {
  return canvasTex('pa-stripes', 256, 256, (g) => {
    g.translate(256, 0); g.scale(-1, 1);
    g.fillStyle = '#ffffff'; g.shadowColor = '#ffffff'; g.shadowBlur = 8;
    for (const [y0, k, len] of [[22, 0.8, 200], [76, 1.1, 236], [134, 1.05, 226], [190, 1.0, 236], [240, 0.75, 180]]) {
      g.beginPath(); g.moveTo(0, y0 - 16 * k);
      g.quadraticCurveTo(len * 0.5, y0 - 10 * k, len, y0 + 6 * k);
      g.quadraticCurveTo(len * 0.5, y0 + 10 * k, 0, y0 + 16 * k);
      g.fill();
      g.beginPath(); g.moveTo(len * 0.35, y0 - 4 * k); g.lineTo(len * 0.55, y0 - 22 * k); g.lineTo(len * 0.6, y0 - 8 * k); g.fill();
    }
  });
}

// ---------------------------------------------------------------- pets
function petRig() { const root = new THREE.Group(), body = new THREE.Group(); root.add(body); return { root, body }; }
function finish(root, parts, anim, height) {
  root.userData.parts = parts;
  root.userData.anim = anim;
  root.userData.height = height;
  root.userData.isPet = true;
  return root;
}
// animateCreature's 'float' beats root.userData.wings' children about their Y axis. The rig is tipped onto its back
// (and each wing tipped upright again inside), so that turn becomes an up-down wingbeat about the body's long axis.
function wingRig(body, y, z, spread, make) {
  const rig = new THREE.Group(); rig.position.set(0, y, z); rig.rotation.x = -Math.PI / 2; body.add(rig);
  for (const s of [-1, 1]) {
    const pv = new THREE.Group(); pv.position.x = s * spread; rig.add(pv);
    const inner = new THREE.Group(); inner.rotation.x = Math.PI / 2; inner.scale.x = s; pv.add(inner);
    inner.add(make());
  }
  return rig;
}
// Fluffy plume tail: a bulging lathe, bent so it curls up; `tip` paints the end (null = one colour).
const tailGeo = (key, main, tip, from = 0, to = 1) => G(`tail${key}|${main}|${tip}|${from}|${to}`, () => {
  const prof = [[0, 0], [0.055, 0.02], [0.1, 0.12], [0.135, 0.28], [0.142, 0.42], [0.128, 0.54], [0.12, 0.565], [0.09, 0.66], [0.045, 0.73], [0, 0.76]]
    .filter(([, y]) => y >= from * 0.76 - 1e-6 && y <= to * 0.76 + 1e-6);
  if (from > 0) prof.unshift([0, prof[0][1] - 0.02]);
  if (to < 1) prof.push([0, prof[prof.length - 1][1]]);
  const g = lathe(prof, 14), a = new THREE.Color(main), b = new THREE.Color(tip ?? main);
  paint(g, (c, x, y) => c.copy(y > 0.55 ? b : a));
  return bend(g, 0.55);
});

const FOX = { fur: 0xff8a34, cream: 0xfff4e4, sock: 0x5a3428, earIn: 0xffe0c8, eye: '#2a1408' };
const KITSUNE = { fur: 0xfdfbff, cream: 0xffffff, sock: 0xffffff, earIn: 0xff5a72, eye: '#c0182e', mark: 0xe8263e };
// Fox & kitsune share a body: round torso, big head with cheek fluff and a pointed muzzle, tall ears.
function foxBase(C, key) {
  const { root, body } = petRig();
  const extra = C.mark ? [
    [tor(0.12, 0.024, 6, 20), M(0, 0.405, 0.05, Math.PI / 2 + 0.35), C.mark],
    [sph(0.045, 12, 10), M(0, 0.345, 0.165), 0xffd040],
    [box(0.012, 0.03, 0.012), M(0, 0.31, 0.205), 0x8a5a10],
  ] : [];
  body.add(part(G(key + '-body', () => merge([
    [sph(0.2, 20, 16), M(0, 0.25, -0.04, 0, 0, 0, 1.05, 0.95, 1.2), C.fur],
    [sph(0.13, 16, 12), M(0, 0.27, 0.1, 0, 0, 0, 1, 1.15, 0.8), C.cream],
    [sph(0.07, 12, 10), M(0.1, 0.05, 0.12, 0, 0, 0, 1, 0.8, 1.25), C.sock],
    [sph(0.07, 12, 10), M(-0.1, 0.05, 0.12, 0, 0, 0, 1, 0.8, 1.25), C.sock],
    [sph(0.075, 12, 10), M(0.12, 0.055, -0.16, 0, 0, 0, 1, 0.8, 1.3), C.sock],
    [sph(0.075, 12, 10), M(-0.12, 0.055, -0.16, 0, 0, 0, 1, 0.8, 1.3), C.sock],
    ...extra,
  ])), vc(), 0, 0, 0, { ow: 0.02 }));
  const head = new THREE.Group(); head.position.set(0, 0.56, 0.06); body.add(head);
  const ear = (s) => [
    [cone(0.09, 0.25, 8), M(0.13 * s, 0.21, -0.03, 0, 0, -0.32 * s, 1, 1, 0.7), C.fur],
    [cone(0.058, 0.17, 8), M(0.126 * s, 0.195, 0.0, -0.08, 0, -0.32 * s, 1, 1, 0.45), C.earIn],
  ];
  // kitsune paint: a flame mark on the brow and two whisker stripes per cheek (flush with the head, no ink)
  const marks = C.mark ? [
    [cone(0.03, 0.09, 8), M(0, 0.165, 0.158, -0.85, 0, 0, 1, 1, 0.35), C.mark],
    [sph(0.03, 10, 8), M(0, 0.125, 0.19, -0.6, 0, 0, 1, 1, 0.4), C.mark],
    ...[1, -1].flatMap((s) => [
      [sph(0.04, 10, 8), M(0.185 * s, 0.0, 0.125, 0, 0.98 * s, -0.25 * s, 1.1, 0.22, 0.25), C.mark],
      [sph(0.035, 10, 8), M(0.19 * s, -0.05, 0.11, 0, 1.03 * s, -0.4 * s, 1.0, 0.2, 0.25), C.mark],
    ]),
  ] : [];
  head.add(part(G(key + '-head', () => merge([
    [sph(0.23, 22, 16), undefined, C.fur],
    [sph(0.085, 12, 10), M(0.14, -0.11, 0.1, 0, 0, 0, 1.2, 0.75, 0.85), C.cream],
    [sph(0.085, 12, 10), M(-0.14, -0.11, 0.1, 0, 0, 0, 1.2, 0.75, 0.85), C.cream],
    ...ear(1), ...ear(-1),
  ])), vc(), 0, 0, 0, { ow: 0.02 }));
  head.add(part(G(key + '-snout', () => merge([
    [sph(0.075, 14, 10), M(0, -0.105, 0.18, 0, 0, 0, 1.15, 0.72, 0.95), C.cream],
    [sph(0.024, 8, 6), M(0, -0.085, 0.25, 0, 0, 0, 1.35, 0.95, 1), 0x2a1a1a],
    ...marks,
  ])), vc(), 0, 0, 0, { ow: 0 }));
  face(head, 0.23, critterFace({ mood: 'happy', mouth: 'cat', eye: C.eye, eyeSize: 1.25 }), { top: 0.86, h: 1.0, w: 1.7 });
  return { root, body, head };
}
function foxPet() {
  const { root, body, head } = foxBase(FOX, 'fox');
  const tail = new THREE.Group(); tail.position.set(0, 0.22, -0.22); tail.rotation.x = -0.95; body.add(tail);
  const m = part(tailGeo('fox', FOX.fur, FOX.cream), vc(), 0, 0, 0, { ow: 0.02 }); tail.add(m);
  tick(m, (t) => { tail.rotation.z = Math.sin(t * 2.6) * 0.2; });
  return finish(root, { body, head }, 'hop', 1.0);
}
function kitsunePet() {
  const { root, body, head } = foxBase(KITSUNE, 'kit');
  const tails = new THREE.Group(); tails.position.set(0, 0.24, -0.2); body.add(tails);
  const fan = Array.from({ length: 9 }, (_, i) => -1.05 + (i / 8) * 2.1);
  const place = (a) => M(0, 0, 0, -0.85 + Math.abs(a) * 0.2, 0, a, 0.58, 0.86, 0.58, 'ZYX');
  const fluff = part(G('kit-tails', () => merge(fan.map((a, i) => [tailGeo('kitA', i % 2 ? 0xf1ecff : KITSUNE.fur, null, 0, 0.75), place(a)]))), vc(), 0, 0, 0, { ow: 0.018 });
  tails.add(fluff);
  tails.add(part(G('kit-tips', () => merge(fan.map((a) => [tailGeo('kitB', 0xa8f4ff, 0xf0ffff, 0.7, 1), place(a)]))), glowVC(), 0, 0, 0, { ow: 0.014 }));
  // foxfire glow at each tip
  const tip = new THREE.Vector3();
  for (const a of fan) { tip.set(0, 0.6, 0.2).applyMatrix4(place(a)); tails.add(halo(0x7ae8ff, 0.3, [tip.x, tip.y, tip.z], 0.8)); }
  tick(fluff, (t) => { tails.rotation.z = Math.sin(t * 1.7) * 0.07; tails.rotation.x = Math.sin(t * 2.3) * 0.05; });
  return finish(root, { body, head }, 'hop', 1.05);
}

function beePet() {
  const { root, body } = petRig();
  const Y = 0xffcf2e, K = 0x3a2a34, y0 = 0.38;
  // stripes are sphere slices about the body's long axis, so the band edges stay crisp
  body.add(part(G('bee-body', () => merge([[0, 0.95, Y], [0.95, 0.36, K], [1.31, 0.4, Y], [1.71, 0.36, K], [2.07, 0.42, Y], [2.49, Math.PI - 2.49, K]]
    .map(([t0, dt, c]) => [new THREE.SphereGeometry(0.25, 28, Math.max(3, Math.round(dt * 9)), 0, Math.PI * 2, t0, dt), M(0, 0, 0, Math.PI / 2), c]))), vc(), 0, y0, 0, { ow: 0.022 }));
  face(body, 0.25, critterFace({ mood: 'happy', mouth: 'smile', eye: '#2a1408' }), { y: y0, w: 1.5, top: 1.12, h: 0.95 });
  const ant = tubeGeo('bee-ant', [[0.06, 0.2, 0.1], [0.085, 0.3, 0.14], [0.14, 0.37, 0.19]], 0.016, { tip: 0.75, segs: 8, radial: 6 });
  body.add(part(G('bee-bits', () => merge([
    [ant, undefined, K], [ant, M(0, 0, 0, 0, 0, 0, -1, 1, 1), K],
    [sph(0.034, 10, 8), M(0.14, 0.37, 0.19), K], [sph(0.034, 10, 8), M(-0.14, 0.37, 0.19), K],
    [cone(0.045, 0.11, 8), M(0, -0.02, -0.27, -Math.PI / 2), K],
    [sph(0.055, 10, 8), M(0, 0.235, 0.03), Y], [sph(0.042, 10, 8), M(0.045, 0.225, -0.02), Y], [sph(0.04, 10, 8), M(-0.04, 0.228, 0.06), Y],
    [sph(0.032, 8, 6), M(0.09, -0.225, 0.06, 0, 0, 0, 1, 1.3, 1), K], [sph(0.032, 8, 6), M(-0.09, -0.225, 0.06, 0, 0, 0, 1, 1.3, 1), K],
    [sph(0.032, 8, 6), M(0.08, -0.22, -0.08, 0, 0, 0, 1, 1.3, 1), K], [sph(0.032, 8, 6), M(-0.08, -0.22, -0.08, 0, 0, 0, 1, 1.3, 1), K],
  ])), vc(), 0, y0, 0, { ow: 0.014 }));
  const wing = G('bee-wing', () => merge([[leafG(0xc8eeff, 0xffffff), M(0.01, 0, 0, 0, 0, -0.85, 0.2, 0.3, 0.25)], [leafG(0xc8eeff, 0xffffff), M(0.01, -0.03, -0.01, 0, 0, -1.85, 0.13, 0.19, 0.25)]]));
  root.userData.wings = wingRig(body, y0 + 0.2, -0.06, 0.05, () => part(wing, vc(), 0, 0, 0, { ow: 0.012 }));
  return finish(root, { body }, 'float', 1.05);
}

function frogPet() {
  const { root, body } = petRig();
  const Gr = 0x5ad84a, Lt = 0xecf8a8, Dk = 0x3aae3a;
  body.add(part(G('frog-body', () => merge([
    [sph(0.24, 20, 16), M(0, 0.22, -0.03, 0, 0, 0, 1.15, 0.85, 1.05), Gr],
    [sph(0.17, 16, 12), M(0, 0.2, 0.1, 0, 0, 0, 1.15, 0.92, 0.8), Lt],
    [sph(0.12, 14, 10), M(0.22, 0.13, -0.07, 0, 0, 0, 0.85, 0.85, 1.25), Gr],
    [sph(0.12, 14, 10), M(-0.22, 0.13, -0.07, 0, 0, 0, 0.85, 0.85, 1.25), Gr],
    [sph(0.08, 12, 8), M(0.28, 0.028, 0.07, 0, -0.5, 0, 1.0, 0.4, 1.6), Dk],
    [sph(0.08, 12, 8), M(-0.28, 0.028, 0.07, 0, 0.5, 0, 1.0, 0.4, 1.6), Dk],
    [sph(0.06, 12, 8), M(0.12, 0.03, 0.2, 0, 0, 0, 1.15, 0.45, 1.3), Dk],
    [sph(0.06, 12, 8), M(-0.12, 0.03, 0.2, 0, 0, 0, 1.15, 0.45, 1.3), Dk],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  const head = new THREE.Group(); head.position.set(0, 0.42, 0.05); body.add(head);
  const HS = [1.3, 0.82, 1.05];
  head.add(part(G('frog-head', () => merge([
    [sph(0.2, 22, 16), M(0, 0, 0, 0, 0, 0, ...HS), Gr],
    [sph(0.095, 14, 12), M(0.14, 0.12, 0.02), Gr],
    [sph(0.095, 14, 12), M(-0.14, 0.12, 0.02), Gr],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  head.add(part(G('frog-eyes', () => merge([[sph(0.075, 14, 12), M(0.14, 0.14, 0.07)], [sph(0.075, 14, 12), M(-0.14, 0.14, 0.07)]])), 0xffffff, 0, 0, 0, { ow: 0.016 }));
  head.add(part(G('frog-pupils', () => merge([
    [sph(0.045, 12, 10), M(0.14, 0.145, 0.128, 0, 0, 0, 1, 1.2, 0.5), 0x1a1020], [sph(0.045, 12, 10), M(-0.14, 0.145, 0.128, 0, 0, 0, 1, 1.2, 0.5), 0x1a1020],
    [sph(0.016, 8, 6), M(0.127, 0.168, 0.15), 0xffffff], [sph(0.016, 8, 6), M(-0.153, 0.168, 0.15), 0xffffff],
  ])), glowVC(), 0, 0, 0, { ow: 0 }));
  face(head, 0.2, frogMouth(), { w: 1.8, top: 1.42, h: 0.85, s: HS });
  return finish(root, { body, head }, 'hop', 0.85);
}

function impPet() {
  const { root, body } = petRig();
  const R = 0xff5236, B = 0xffb45a, H = 0x5a2a52, y0 = 0.36;
  const horn = tubeGeo('imp-horn', [[0.1, 0.16, 0.02], [0.15, 0.25, 0.0], [0.21, 0.31, -0.04]], 0.04, { tip: 0.12, segs: 10, radial: 7 });
  const tailT = tubeGeo('imp-tail', [[0, -0.12, -0.16], [0, -0.17, -0.3], [0, -0.1, -0.42], [0, 0.03, -0.46]], 0.026, { tip: 0.6, segs: 12, radial: 6 });
  body.add(part(G('imp-body', () => merge([
    [sph(0.23, 22, 16), undefined, R],
    [sph(0.15, 16, 12), M(0, -0.07, 0.1, 0, 0, 0, 1.05, 0.95, 0.75), B],
    [sph(0.055, 10, 8), M(0.215, -0.06, 0.06), R], [sph(0.055, 10, 8), M(-0.215, -0.06, 0.06), R],
    [sph(0.06, 10, 8), M(0.09, -0.21, 0.04, 0, 0, 0, 1, 0.75, 1.3), H], [sph(0.06, 10, 8), M(-0.09, -0.21, 0.04, 0, 0, 0, 1, 0.75, 1.3), H],
    [horn, undefined, H], [horn, M(0, 0, 0, 0, 0, 0, -1, 1, 1), H],
    [tailT, undefined, R],
    [cone(0.06, 0.12, 4), M(0, 0.07, -0.46, 0, 0, 0, 1, 1, 0.4), H],
  ])), vc(), 0, y0, 0, { ow: 0.02 }));
  face(body, 0.23, critterFace({ mood: 'happy', mouth: 'fang', eye: '#3a0a14' }), { y: y0, top: 1.18, h: 1.0, w: 1.6 });
  // flickering flame hair
  const fl = new THREE.Group(); fl.position.set(0, y0 + 0.19, -0.05); body.add(fl);
  const flames = part(G('imp-flame', () => {
    const f = flameGeo(0xff3a12, 0xff9a1a, 0xfff07a);
    return merge([[f, M(0, 0, 0, -0.3, 0, 0, 0.42, 0.22, 0.42)], [f, M(0.07, -0.02, 0.01, -0.25, 0, -0.7, 0.3, 0.15, 0.3)], [f, M(-0.07, -0.02, 0.01, -0.25, Math.PI, 0.7, 0.3, 0.15, 0.3)]]);
  }), glowVC(), 0, 0, 0, { ow: 0.016 });
  fl.add(flames);
  tick(flames, (t) => fl.scale.set(1 + Math.sin(t * 11) * 0.06, 1 + Math.sin(t * 7.3) * 0.12 + Math.sin(t * 17) * 0.04, 1));
  body.add(halo(0xff7a2a, 1.25, [0, y0 + 0.05, 0], 0.4));
  root.userData.wings = wingRig(body, y0 + 0.04, -0.17, 0.06, () => part(plate('batwing', BATWING, H, 0x8a3a6a, 'x'), vc(), 0, 0, 0, { s: [0.45, 0.45, 0.45], ow: 0.014 }));
  return finish(root, { body }, 'float', 1.05);
}

function yetiPet() {
  const { root, body } = petRig();
  const W = 0xfafcff, W2 = 0xe2f0ff, S = 0xa2d6ff, Hn = 0xfff0c8, So = 0x7ab4f0;
  const clumps = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    return [sph(0.1, 12, 10), M(Math.sin(a) * 0.235, 0.3 + (i % 2 ? 0.08 : -0.06), Math.cos(a) * 0.215), i % 3 ? W : W2];
  });
  body.add(part(G('yeti-body', () => merge([
    [sph(0.27, 20, 16), M(0, 0.3, 0, 0, 0, 0, 1, 1, 0.95), W],
    ...clumps,
    [sph(0.085, 12, 10), M(0.29, 0.33, 0.05, 0, 0, 0.55, 0.9, 1.6, 0.9), W], [sph(0.085, 12, 10), M(-0.29, 0.33, 0.05, 0, 0, -0.55, 0.9, 1.6, 0.9), W],
    [sph(0.045, 10, 8), M(0.34, 0.22, 0.08), S], [sph(0.045, 10, 8), M(-0.34, 0.22, 0.08), S],
    [sph(0.1, 12, 10), M(0.13, 0.045, 0.08, 0, 0, 0, 1, 0.5, 1.35), W], [sph(0.1, 12, 10), M(-0.13, 0.045, 0.08, 0, 0, 0, 1, 0.5, 1.35), W],
    [sph(0.06, 10, 8), M(0.13, 0.03, 0.19, 0, 0, 0, 1.1, 0.4, 0.5), So], [sph(0.06, 10, 8), M(-0.13, 0.03, 0.19, 0, 0, 0, 1.1, 0.4, 0.5), So],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  const head = new THREE.Group(); head.position.set(0, 0.64, 0.02); body.add(head);
  const horn = tubeGeo('yeti-horn', [[0.15, 0.14, -0.02], [0.22, 0.24, -0.03], [0.25, 0.34, -0.07]], 0.045, { tip: 0.15, segs: 10, radial: 7 });
  const FS = [1.15, 0.95, 0.55];
  head.add(part(G('yeti-head', () => merge([
    [sph(0.25, 22, 16), undefined, W],
    [sph(0.085, 12, 10), M(0, 0.23, -0.02), W], [sph(0.07, 12, 10), M(0.085, 0.215, 0.04), W2], [sph(0.068, 12, 10), M(-0.08, 0.22, 0.05), W],
    [sph(0.08, 12, 10), M(0.22, 0.0, 0.0), W2], [sph(0.08, 12, 10), M(-0.22, 0.0, 0.0), W2],
    [horn, undefined, Hn], [horn, M(0, 0, 0, 0, 0, 0, -1, 1, 1), Hn],
    [sph(0.18, 20, 14), M(0, -0.02, 0.165, 0, 0, 0, ...FS), S],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  face(head, 0.18, critterFace({ mood: 'happy', mouth: 'smile', eye: '#1a2450', eyeSize: 1.2 }), { y: -0.02, z: 0.165, s: FS, w: 1.9, top: 1.0, h: 1.15 });
  return finish(root, { body, head }, 'waddle', 1.05);
}

function turtlePet() {
  const { root, body } = petRig();
  const Sk = 0x8ae0a0, Rim = 0xffd27a, Bel = 0xfff2c8;
  body.add(part(G('turtle-body', () => merge([
    [sph(0.28, 20, 10), M(0, 0.15, 0, 0, 0, 0, 1, 0.32, 1.12), Bel],
    [tor(0.29, 0.035, 8, 32), M(0, 0.165, 0, Math.PI / 2, 0, 0, 1, 1.12, 1), Rim],
    [sph(0.085, 12, 10), M(0.22, 0.08, 0.2, 0, 0, 0, 1, 0.75, 1.15), Sk], [sph(0.085, 12, 10), M(-0.22, 0.08, 0.2, 0, 0, 0, 1, 0.75, 1.15), Sk],
    [sph(0.08, 12, 10), M(0.22, 0.08, -0.2, 0, 0, 0, 1, 0.75, 1.15), Sk], [sph(0.08, 12, 10), M(-0.22, 0.08, -0.2, 0, 0, 0, 1, 0.75, 1.15), Sk],
    [cone(0.05, 0.13, 8), M(0, 0.12, -0.36, -1.8), Sk],
    [sph(0.075, 12, 10), M(0, 0.2, 0.28, 0, 0, 0, 1, 1, 1.3), Sk],
  ])), vc(), 0, 0, 0, { ow: 0.02 }));
  // crystal shell: a faceted gem dome with crystals growing from its crown
  const shell = G('turtle-shell', () => {
    const dome = new THREE.SphereGeometry(0.29, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
    const r = ramp([[0, 0x6a5aff], [0.3, 0x9a8aff], [0.75, 0xa8f0ff]]), c = new THREE.Color(), p = dome.attributes.position, col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i += 3) {
      const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
      r(c, y / 0.29); if ((i / 3) % 2) c.lerp(new THREE.Color(0xffffff), 0.18);
      for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3);
    }
    dome.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const cr = crystalG(0x8a6aff, 0xeafcff);
    return merge([[dome, M(0, 0.16, 0, 0, 0, 0, 1, 0.85, 1.12)],
      [cr, M(0, 0.36, -0.02, 0, 0, 0, 0.065, 0.24, 0.065)], [cr, M(0.07, 0.34, 0.05, 0.35, 0, -0.45, 0.05, 0.16, 0.05)],
      [cr, M(-0.08, 0.33, -0.06, -0.3, 0, 0.5, 0.05, 0.17, 0.05)], [cr, M(0.02, 0.33, -0.12, -0.6, 0, -0.1, 0.04, 0.12, 0.04)]]);
  });
  body.add(faceted(shell, vc({ emissive: 0x2a2470 }), 0.02));
  body.add(halo(0xb8a8ff, 0.7, [0, 0.5, -0.02], 0.4));
  const head = new THREE.Group(); head.position.set(0, 0.29, 0.36); body.add(head);
  head.add(part(sph(0.15, 20, 14), Sk, 0, 0, 0, { ow: 0.02 }));
  face(head, 0.15, critterFace({ mood: 'happy', mouth: 'smile', eye: '#1a2a20' }), { top: 1.05, h: 1.05, w: 1.7 });
  return finish(root, { body, head }, 'waddle', 0.85);
}

function batPet() {
  const { root, body } = petRig();
  const P = 0x9a6ae8, Bl = 0xdcc8ff, In = 0xff9ad0, y0 = 0.38;
  const ear = (s) => [
    [cone(0.1, 0.27, 8), M(0.13 * s, 0.24, -0.02, 0, 0, -0.34 * s, 1, 1, 0.7), P],
    [cone(0.062, 0.18, 8), M(0.126 * s, 0.225, 0.008, -0.1, 0, -0.34 * s, 1, 1, 0.42), In],
  ];
  body.add(part(G('bat-body', () => merge([
    [sph(0.24, 22, 16), undefined, P],
    [sph(0.16, 16, 12), M(0, -0.075, 0.1, 0, 0, 0, 1.05, 0.95, 0.75), Bl],
    ...ear(1), ...ear(-1),
    [sph(0.05, 10, 8), M(0, 0.235, 0.03), P], [sph(0.04, 10, 8), M(0.04, 0.228, -0.01), P],
    [sph(0.04, 8, 6), M(0.07, -0.235, 0.03, 0, 0, 0, 1, 0.8, 1.2), 0x4a2a6a], [sph(0.04, 8, 6), M(-0.07, -0.235, 0.03, 0, 0, 0, 1, 0.8, 1.2), 0x4a2a6a],
  ])), vc(), 0, y0, 0, { ow: 0.02 }));
  face(body, 0.24, critterFace({ mood: 'happy', mouth: 'fang', eye: '#2a1030' }), { y: y0, top: 1.12, h: 1.0, w: 1.6 });
  root.userData.wings = wingRig(body, y0 + 0.03, -0.04, 0.19, () => part(plate('batwing', BATWING, 0x6a3ab8, 0xb88af0, 'x'), vc(), 0, 0, 0, { s: [0.78, 0.78, 0.6], ow: 0.016 }));
  return finish(root, { body }, 'float', 1.05);
}

function phoenixPet() {
  const { root, body } = petRig();
  const y0 = 0.35;
  const bodyG = G('phx-body', () => { const r = ramp([[-0.23, 0xffb83a], [0.02, 0xff7a2a], [0.23, 0xff3a2a]]); return paint(new THREE.SphereGeometry(0.23, 22, 16), (c, x, y) => r(c, y)); });
  body.add(part(G('phx-bodym', () => merge([
    [bodyG],
    [sph(0.15, 16, 12), M(0, -0.07, 0.1, 0, 0, 0, 1.05, 1, 0.75), 0xffe48a],
    [cone(0.05, 0.11, 8), M(0, -0.015, 0.245, Math.PI / 2), 0xffc020],
    [sph(0.045, 10, 8), M(0.08, -0.215, 0.05, 0, 0, 0, 1, 0.6, 1.4), 0xffb020], [sph(0.045, 10, 8), M(-0.08, -0.215, 0.05, 0, 0, 0, 1, 0.6, 1.4), 0xffb020],
  ])), vc(), 0, y0, 0, { ow: 0.02 }));
  face(body, 0.23, critterFace({ mood: 'happy', mouth: 'none', eye: '#3a140a' }), { y: y0, top: 1.06, h: 1.0, w: 1.6 });
  const crest = new THREE.Group(); crest.position.set(0, y0 + 0.19, -0.02); body.add(crest);
  const fire = part(G('phx-fire', () => {
    const f = flameGeo(0xff3a12, 0xff9a1a, 0xfff27a), t = flameGeo(0xff5a1a, 0xffb42a, 0xfff6a0);
    return merge([[f, M(0, 0, 0, -0.4, 0, 0, 0.4, 0.24, 0.4)], [f, M(0.06, -0.01, -0.01, -0.35, 0, -0.6, 0.3, 0.17, 0.3)], [f, M(-0.06, -0.01, -0.01, -0.35, Math.PI, 0.6, 0.3, 0.17, 0.3)],
      [t, M(0, -0.25, -0.2, -1.15, 0, 0, 0.5, 0.34, 0.5)], [t, M(0.07, -0.27, -0.18, -1.0, 0, -0.5, 0.38, 0.26, 0.38)], [t, M(-0.07, -0.27, -0.18, -1.0, Math.PI, 0.5, 0.38, 0.26, 0.38)]]);
  }), glowVC(), 0, 0, 0, { ow: 0.016 });
  crest.add(fire);
  tick(fire, (t) => crest.scale.set(1 + Math.sin(t * 10) * 0.05, 1 + Math.sin(t * 7) * 0.1, 1 + Math.sin(t * 13) * 0.05));
  body.add(halo(0xff8a2a, 1.3, [0, y0 + 0.05, -0.02], 0.45));
  const wing = G('phx-wing', () => {
    const f = featherG(0xff5a2a, 0xffd23a);
    return merge([[f, M(0.02, 0, 0, -2.45, Math.PI / 2, 0, 0.16, 0.2, 0.3)], [f, M(0.02, 0, -0.02, -2.8, Math.PI / 2, 0, 0.15, 0.17, 0.3)], [f, M(0.03, 0.0, 0.02, -2.15, Math.PI / 2, 0, 0.12, 0.14, 0.3)]]);
  });
  root.userData.wings = wingRig(body, y0 + 0.08, -0.01, 0.2, () => part(wing, vc(), 0, 0, 0, { ow: 0.014 }));
  return finish(root, { body }, 'float', 1.1);
}

function whalePet() {
  const { root, body } = petRig();
  const B = 0xa6d6ff, Bel = 0xfff4fa, F = 0x86c0f6, y0 = 0.36, S = [1, 0.88, 1.28];
  body.add(part(G('whale-body', () => merge([
    [new THREE.SphereGeometry(0.27, 26, 12, 0, Math.PI * 2, 0, 1.95), M(0, 0, 0, 0, 0, 0, ...S), B],
    [new THREE.SphereGeometry(0.27, 26, 6, 0, Math.PI * 2, 1.95, Math.PI - 1.95), M(0, 0, 0, 0, 0, 0, ...S), Bel],
    [tubeGeo('whale-tail', [[0, 0.02, -0.26], [0, 0.05, -0.4], [0, 0.13, -0.52]], 0.12, { tip: 0.42, segs: 10, radial: 10 }), undefined, B],
    [plate('fluke', FLUKE, B, F), M(0, 0.12, -0.5, -Math.PI / 2 + 0.55, 0, 0, 0.62, 0.62, 0.5)],
    [sph(0.08, 12, 10), M(0.245, -0.09, 0.06, 0, 0.4, 0.6, 1.3, 0.35, 0.8), F], [sph(0.08, 12, 10), M(-0.245, -0.09, 0.06, 0, -0.4, -0.6, 1.3, 0.35, 0.8), F],
    [sph(0.05, 10, 8), M(0, 0.235, -0.05, 0, 0, 0, 1.4, 0.5, 1), F],
  ])), vc(), 0, y0, 0, { ow: 0.022 }));
  face(body, 0.27, critterFace({ mood: 'happy', mouth: 'smile', eye: '#1a2a4a' }), { y: y0, s: S, top: 1.2, h: 0.9, w: 1.4 });
  // sparkly water spout
  const spout = new THREE.Group(); spout.position.set(0, y0 + 0.23, 0.03); body.add(spout);
  const water = part(G('whale-spout', () => {
    const d = flameGeo(0x7ad8ff, 0xbff0ff, 0xffffff), L = [[cyl(0.045, 0.025, 0.2, 10), M(0, 0.1, 0), 0xa8ecff]];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; L.push([d, M(Math.sin(a) * 0.04, 0.2, Math.cos(a) * 0.04, 0, a, 2.3, 0.18, 0.12, 0.18, 'YXZ')]); }
    L.push([sph(0.04, 10, 8), M(0, 0.24, 0), 0xeafcff]);
    return merge(L);
  }), glowVC(), 0, 0, 0, { ow: 0.012 });
  spout.add(water);
  const sp = [sparkle(0xbff4ff, 0.14, [0.12, 0.26, 0.02]), sparkle(0xffffff, 0.11, [-0.1, 0.3, -0.03]), sparkle(0xd8f8ff, 0.09, [0.02, 0.36, 0.06])];
  sp.forEach((s) => spout.add(s));
  tick(water, (t) => {
    spout.scale.set(1, 0.9 + Math.sin(t * 5) * 0.12, 1);
    sp.forEach((s, i) => s.scale.setScalar((0.08 + i * 0.02) * (0.6 + 0.6 * Math.abs(Math.sin(t * 3 + i * 2.1)))));
  });
  return finish(root, { body }, 'float', 1.1);
}

function pandaPet() {
  const { root, body } = petRig();
  const W = 0xffffff, K = 0x2a2a34;
  body.add(part(G('panda-body', () => merge([
    [sph(0.25, 20, 16), M(0, 0.27, 0, 0, 0, 0, 1, 0.95, 0.95), W],
    [new THREE.SphereGeometry(0.252, 20, 3, 0, Math.PI * 2, 0.7, 0.42), M(0, 0.27, 0, 0, 0, 0, 1, 0.95, 0.95), K],
    [sph(0.085, 12, 10), M(0.2, 0.3, 0.13, -0.9, 0, 0.15, 1, 1.7, 1), K], [sph(0.085, 12, 10), M(-0.2, 0.3, 0.12, -0.7, 0, -0.35, 1, 1.7, 1), K],
    [sph(0.1, 12, 10), M(0.13, 0.07, 0.07, 0, 0, 0, 1, 0.75, 1.2), K], [sph(0.1, 12, 10), M(-0.13, 0.07, 0.07, 0, 0, 0, 1, 0.75, 1.2), K],
    [sph(0.04, 8, 6), M(0.13, 0.06, 0.18, 0, 0, 0, 1, 0.6, 0.5), 0xffb0c8], [sph(0.04, 8, 6), M(-0.13, 0.06, 0.18, 0, 0, 0, 1, 0.6, 0.5), 0xffb0c8],
    [sph(0.05, 8, 6), M(0, 0.18, -0.24), W],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  // bamboo sprig hugged in its arms
  const stalk = tubeGeo('panda-bamboo', [[0.12, 0.12, 0.22], [0.25, 0.4, 0.24], [0.36, 0.7, 0.2]], 0.03, { tip: 0.8, segs: 10, radial: 8 });
  body.add(part(G('panda-bamboo', () => merge([
    [stalk, undefined, 0x7ad84a],
    [cyl(0.036, 0.036, 0.02, 10), along([0.19, 0.27, 0.235], [0.21, 0.3, 0.237], 1), 0x4aa83a],
    [cyl(0.034, 0.034, 0.02, 10), along([0.29, 0.5, 0.228], [0.3, 0.53, 0.226], 1), 0x4aa83a],
    [leafG(0x4ab83a, 0x8aec5a), M(0.34, 0.64, 0.21, 0.2, 0, -0.9, 0.12, 0.26, 0.4)], [leafG(0x4ab83a, 0x8aec5a), M(0.33, 0.6, 0.22, -0.1, 0, -2.2, 0.1, 0.22, 0.4)],
  ])), vc(), 0, 0, 0, { ow: 0.016 }));
  const head = new THREE.Group(); head.position.set(0, 0.63, 0.03); body.add(head);
  head.add(part(G('panda-head', () => merge([
    [sph(0.25, 22, 16), undefined, W],
    [sph(0.085, 12, 10), M(0.18, 0.19, -0.02, 0, 0, 0, 1, 1, 0.65), K], [sph(0.085, 12, 10), M(-0.18, 0.19, -0.02, 0, 0, 0, 1, 1, 0.65), K],
    [sph(0.03, 8, 6), M(0, -0.02, 0.247, 0, 0, 0, 1.3, 0.9, 0.7), K],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  face(head, 0.25, critterFace({ mood: 'happy', mouth: 'cat', patches: true, eye: '#1a1020' }), { top: 1.12, h: 1.0, w: 1.75 });
  return finish(root, { body, head }, 'waddle', 1.0);
}

function iceDragonPet() {
  const { root, body } = petRig();
  const B = 0xc4e8ff, Bel = 0xf6fcff, Wm = 0x8ccaf8;
  const cr = () => crystalG(0x4aa8ff, 0xf2fcff);
  body.add(part(G('idr-body', () => merge([
    [sph(0.22, 20, 16), M(0, 0.33, -0.03), B],
    [sph(0.16, 16, 12), M(0, 0.31, 0.08, 0, 0, 0, 1, 1.15, 0.8), Bel],
    [sph(0.06, 10, 8), M(0.1, 0.1, 0.08, 0, 0, 0, 1, 0.7, 1.3), B], [sph(0.06, 10, 8), M(-0.1, 0.1, 0.08, 0, 0, 0, 1, 0.7, 1.3), B],
    [sph(0.065, 10, 8), M(0.13, 0.11, -0.12, 0, 0, 0, 1, 0.7, 1.3), B], [sph(0.065, 10, 8), M(-0.13, 0.11, -0.12, 0, 0, 0, 1, 0.7, 1.3), B],
    [tubeGeo('idr-tail', [[0, 0.26, -0.16], [0, 0.18, -0.33], [0.02, 0.22, -0.47], [0.05, 0.34, -0.55]], 0.085, { tip: 0.3, segs: 14, radial: 8 }), undefined, B],
  ])), vc(), 0, 0, 0, { ow: 0.02 }));
  body.add(faceted(G('idr-spines', () => merge([
    [cr(), along([0, 0.52, -0.12], [0, 0.62, -0.22], 0.035)], [cr(), along([0, 0.44, -0.22], [0, 0.52, -0.32], 0.03)],
    [cr(), along([0.05, 0.33, -0.55], [0.09, 0.5, -0.62], 0.05)], [cr(), along([0.05, 0.33, -0.55], [0.14, 0.42, -0.56], 0.035)],
  ])), vc({ emissive: 0x1a4a8a }), 0.016));
  const head = new THREE.Group(); head.position.set(0, 0.66, 0.05); body.add(head);
  head.add(part(G('idr-head', () => merge([
    [sph(0.24, 22, 16), undefined, B],
    [sph(0.1, 14, 10), M(0, -0.11, 0.17, 0, 0, 0, 1.35, 0.66, 0.85), Bel],
    [cone(0.06, 0.16, 4), M(0.23, 0.02, -0.03, 0, 0, -1.25, 1, 1, 0.35), Wm], [cone(0.06, 0.16, 4), M(-0.23, 0.02, -0.03, 0, 0, 1.25, 1, 1, 0.35), Wm],
  ])), vc(), 0, 0, 0, { ow: 0.02 }));
  face(head, 0.24, critterFace({ mood: 'happy', mouth: 'none', eye: '#2a5ad8', eyeSize: 1.15 }), { top: 0.92, h: 1.0, w: 1.7 });
  head.add(faceted(G('idr-horns', () => merge([
    [cr(), along([0.1, 0.16, -0.05], [0.18, 0.36, -0.17], 0.05)], [cr(), along([-0.1, 0.16, -0.05], [-0.18, 0.36, -0.17], 0.05)],
    [cr(), along([0, 0.2, 0.0], [0, 0.31, -0.02], 0.035)],
  ])), vc({ emissive: 0x1a4a8a }), 0.016));
  head.add(halo(0x9ae4ff, 0.8, [0, 0.25, -0.1], 0.35));
  root.userData.wings = wingRig(body, 0.47, -0.15, 0.1, () => part(plate('dragwing', DRAGWING, 0x6ab0f0, 0xd8f2ff, 'x'), vc(), 0, 0, 0, { s: [0.7, 0.7, 0.55], ow: 0.014 }));
  return finish(root, { body, head }, 'float', 1.2);
}

export function buildExtraPet(model) {
  switch (model) {
    case 'fox': return foxPet();
    case 'bee': return beePet();
    case 'frog': return frogPet();
    case 'imp': return impPet();
    case 'yeti': return yetiPet();
    case 'turtle': return turtlePet();
    case 'bat': return batPet();
    case 'phoenix': return phoenixPet();
    case 'whale': return whalePet();
    case 'kitsune': return kitsunePet();
    case 'panda': return pandaPet();
    case 'icedragon': return iceDragonPet();
  }
  return foxPet();
}

// ---------------------------------------------------------------- mounts
// Saddle cloth draped over a buildQuad torso (capsule along Z, radius 0.38·sz), in torso-centred coordinates
// so the mesh can be scaled with a bulked-up torso. Seat top sits 0.46·sz above the torso centre.
function saddleList(sz, C) {
  const S = (v) => v * sz, R = S(0.395), L = S(0.62), a = 1.15, z0 = S(-0.05);
  const L2 = [
    [G(`sd-cloth${sz}`, () => new THREE.CylinderGeometry(R, R, L, 22, 1, true, -a, 2 * a)), M(0, 0, z0, -Math.PI / 2), C.cloth],
    [cyl(S(0.026), S(0.026), L, 8), M(R * Math.sin(a), R * Math.cos(a), z0, Math.PI / 2), C.trim],
    [cyl(S(0.026), S(0.026), L, 8), M(-R * Math.sin(a), R * Math.cos(a), z0, Math.PI / 2), C.trim],
    [tor(R, S(0.026), 6, 20, 2 * a), M(0, 0, z0 + L / 2, 0, 0, Math.PI / 2 - a), C.trim],
    [tor(R, S(0.026), 6, 20, 2 * a), M(0, 0, z0 - L / 2, 0, 0, Math.PI / 2 - a), C.trim],
    [cyl(S(0.25), S(0.27), S(0.08), 18), M(0, S(0.42), z0, 0, 0, 0, 1, 1, 1.25), C.seat],
    [sph(1, 14, 10), M(0, S(0.47), z0 - S(0.3), -0.35, 0, 0, S(0.22), S(0.1), S(0.075)), C.seat],
    [sph(S(0.055), 10, 8), M(0, S(0.48), z0 + S(0.3)), C.trim],
    [box(1, 1, 1), M(S(0.37), S(0.12), z0, 0, 0, 0.35, S(0.045), S(0.26), S(0.24)), C.flap],
    [box(1, 1, 1), M(S(-0.37), S(0.12), z0, 0, 0, -0.35, S(0.045), S(0.26), S(0.24)), C.flap],
  ];
  return L2;
}
// buildQuad plus handles: torso / belly meshes, the neck (if any) and the default saddle seat height.
function quad(o) {
  const r = buildQuad(o), P = r.userData.parts, sz = o.size || 1;
  const kids = P.body.children, neck = o.neck === false ? null : kids[kids.indexOf(P.head) + 1];
  P.seat.position.y = (0.92 + 0.46) * sz;
  return { r, P, sz, S: (v) => v * sz, torso: kids[0], belly: kids[1], neck };
}
function addSaddle(q, key, C, ky = 1, kx = 1) {
  const { P, sz, S } = q;
  P.body.add(part(G(key, () => merge(saddleList(sz, C))), vc(), 0, S(0.92), 0, { s: [kx, ky, 1], ow: 0.025 }));
  P.seat.position.y = S(0.92 + 0.46 * ky);
}
const recolor = (m, c) => { m.material = toon(c); };
// Wings for the 'quad' rig: animateCreature beats P.wings' children about Z; the mirror and rest pose sit inside.
function quadWings(P, [x, y, z], spread, make, pose = [0, 0, 0]) {
  const wings = new THREE.Group(); wings.position.set(x, y, z); P.body.add(wings);
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.x = s * spread; wings.add(w);
    const mir = new THREE.Group(); mir.scale.x = s; w.add(mir);
    const ps = new THREE.Group(); ps.rotation.set(...pose); mir.add(ps);
    ps.add(make());
  }
  P.wings = wings;
  return wings;
}
// Feathered wing for the +X side: flight feathers fanned along the arm with a row of coverts on top. Pivot at the origin.
// Feathers lie flat (normal +Y); b sweeps them from pointing back (near the body) to pointing out (at the tip).
const featherWing = (key, C) => G('fw' + key, () => {
  const L = [], pl = plate('plume', PLUME, C.p0, C.p1), cv = plate('plume', PLUME, C.c0, C.c1);
  for (let i = 0; i < 8; i++) {
    const u = i / 7, b = 1.5 - u * 1.35, len = 0.46 + u * 0.36;
    L.push([pl, M(0.03 + u * 0.6, u * 0.07 - i * 0.004, -u * 0.04, -Math.PI / 2, b - Math.PI / 2, 0, 0.62 * len, len, 0.35, 'YXZ')]);
  }
  for (let i = 0; i < 6; i++) {
    const u = i / 5, b = 1.35 - u * 1.2, len = 0.28 + u * 0.1;
    L.push([cv, M(0.02 + u * 0.52, 0.04 + u * 0.07, 0.03 - u * 0.03, -Math.PI / 2, b - Math.PI / 2, 0, 0.75 * len, len, 0.4, 'YXZ')]);
  }
  L.push([sph(1, 14, 8), M(0.32, 0.075, 0.03, 0, 0, 0.12, 0.38, 0.07, 0.13), C.arm]);
  return merge(L);
});

function lionMount() {
  const q = quad({ body: 0xffb544, belly: 0xffe6b2, hoof: 0xfff0d6, ears: 'round', snout: 0xfff2dc, tailColor: 0xffb544, face: { mood: 'happy', eye: '#d8401a', mouth: 'none', blush: true }, size: 1.2 });
  const { r, P, S } = q;
  // flaming mane: two rings of flame tongues around the face, sweeping back
  const mane = new THREE.Group(); P.head.add(mane);
  const flames = part(G('lion-mane', () => {
    const outer = flameGeo(0xff3a12, 0xff8a1a, 0xffd84a), inner = flameGeo(0xff6a1a, 0xffb02a, 0xfff08a), L = [];
    for (let i = 0; i < 9; i++) { const a = ((i + 0.5) / 9) * Math.PI * 2; L.push([outer, M(Math.sin(a) * S(0.27), Math.cos(a) * S(0.27), S(-0.2), -1.0, 0, -a, S(0.7), S(0.66), S(0.7), 'ZYX')]); }
    for (let i = 0; i < 11; i++) { const a = (i / 11) * Math.PI * 2, k = 0.85 + 0.25 * Math.max(0, Math.cos(a)); L.push([inner, M(Math.sin(a) * S(0.33), Math.cos(a) * S(0.33), S(-0.06), -0.55, 0, -a, S(0.55) * k, S(0.46) * k, S(0.55) * k, 'ZYX')]); }
    return merge(L);
  }), glowVC(), 0, 0, 0, { ow: 0.024 });
  mane.add(flames);
  tick(flames, (t) => mane.scale.set(1 + Math.sin(t * 9) * 0.03, 1 + Math.sin(t * 7 + 1) * 0.03, 1 + Math.sin(t * 12) * 0.06));
  P.head.add(halo(0xff7a1a, S(2.2), [0, 0, S(-0.15)], 0.32));
  // long tail ending in a flame tuft
  P.tail.clear();
  P.tail.add(part(tubeGeo('lion-tail', [[0, 0, 0], [0, 0.04, -0.22], [0, -0.04, -0.42], [0, 0.1, -0.6]].map((p) => p.map(S)), S(0.06), { tip: 0.6, segs: 14, radial: 8 }), 0xffb544, 0, 0, 0, { ow: 0.022 }));
  P.tail.add(part(G('lion-tuft', () => { const f = flameGeo(0xff3a12, 0xff8a1a, 0xffe04a); return merge([[f, M(0, S(0.08), S(-0.6), -0.4, 0, 0, S(0.42))], [f, M(0, S(0.08), S(-0.6), -0.9, 0, 0.7, S(0.32))], [f, M(0, S(0.08), S(-0.6), -0.9, Math.PI, 0.7, S(0.32))]]); }), glowVC(), 0, 0, 0, { ow: 0.022 }));
  P.tail.add(halo(0xff7a1a, S(0.9), [0, S(0.2), S(-0.62)], 0.5));
  addSaddle(q, 'lion-saddle', { cloth: 0xd8323a, trim: 0xffd04a, seat: 0x8a4a2a, flap: 0xb02830 });
  r.userData.height = S(1.85);
  return r;
}

function bearMount() {
  const q = quad({ body: 0xf4f9ff, belly: 0xe0eeff, legs: 0xeef5ff, hoof: 0xc8e2ff, ears: 'round', ear: 0xf4f9ff, snout: 0xffffff, tailColor: 0xf4f9ff, neck: false, face: { mood: 'happy', eye: '#2a64d8', mouth: 'cat', blush: true }, size: 1.2 });
  const { r, P, S, torso } = q;
  torso.scale.set(1.16, 1.0, 1.08); // wider, taller barrel (the capsule lies along Z, so local z is height)
  P.legs.forEach((l) => { l.position.x *= 1.14; l.scale.set(1.32, 1, 1.32); });
  P.head.position.set(0, S(1.27), S(0.8)); P.head.scale.setScalar(1.08);
  P.tail.scale.setScalar(0.6);
  addSaddle(q, 'bear-saddle', { cloth: 0x2a4ab4, trim: 0xd8f2ff, seat: 0xeef6ff, flap: 0x23409c }, 1.08, 1.16);
  // glacier armour: shoulder plates with ice crystals and a gem, plus a brow helm
  const plate = (s) => [
    [cap(1, 16, 8, 1.15), M(s * S(0.31), S(1.13), S(0.42), 0, 0, -s * 0.85, S(0.21), S(0.17), S(0.21)), 0x5aa0f4],
    [tor(1, 0.12, 6, 20), M(s * S(0.31), S(1.13), S(0.42), Math.PI / 2, -s * 0.85, 0, S(0.19), S(0.19), S(0.19), 'ZYX'), 0xe8f6ff],
  ];
  P.body.add(part(G('bear-armor', () => merge([...plate(1), ...plate(-1),
    [cap(1, 18, 8, 1.0), M(0, S(1.0), S(0.7), 1.35, 0, 0, S(0.3), S(0.24), S(0.24)), 0x5aa0f4],
    [tor(1, 0.09, 6, 22), M(0, S(1.0) + Math.sin(1.35 - Math.PI / 2) * 0, S(0.7), 1.35 + Math.PI / 2, 0, 0, S(0.25), S(0.25), S(0.2)), 0xe8f6ff],
  ])), vc(), 0, 0, 0, { ow: 0.024 }));
  const ice = () => crystalG(0x5ab8ff, 0xf4feff);
  P.body.add(faceted(G('bear-ice', () => merge([
    [ice(), along([S(0.36), S(1.22), S(0.42)], [S(0.5), S(1.55), S(0.36)], S(0.06))], [ice(), along([S(0.3), S(1.25), S(0.32)], [S(0.36), S(1.48), S(0.18)], S(0.045))],
    [ice(), along([S(-0.36), S(1.22), S(0.42)], [S(-0.5), S(1.55), S(0.36)], S(0.06))], [ice(), along([S(-0.3), S(1.25), S(0.32)], [S(-0.36), S(1.48), S(0.18)], S(0.045))],
    [ice(), along([0, S(1.3), S(-0.55)], [0, S(1.55), S(-0.68)], S(0.055))], [ice(), along([S(0.1), S(1.28), S(-0.5)], [S(0.2), S(1.46), S(-0.6)], S(0.04))], [ice(), along([S(-0.1), S(1.28), S(-0.5)], [S(-0.2), S(1.46), S(-0.6)], S(0.04))],
  ])), vc({ emissive: 0x1a4a7a }), 0.024));
  const gem = new THREE.Mesh(oct(), glow(0x8ae8ff)); gem.position.set(0, S(1.05), S(0.95)); gem.scale.set(S(0.07), S(0.1), S(0.05)); P.body.add(gem);
  P.body.add(halo(0x8ae8ff, S(0.6), [0, S(1.05), S(0.98)], 0.7));
  P.head.add(part(G('bear-helm', () => merge([
    [cap(S(0.355), 18, 8, 0.85), M(0, 0, S(-0.02), -0.15), 0x5aa0f4],
    [tor(S(0.355) * Math.sin(0.85), S(0.025), 6, 26), M(0, S(0.355) * Math.cos(0.85) * Math.cos(0.15) - 0.0, S(-0.02) + S(0.355) * Math.cos(0.85) * Math.sin(0.15), Math.PI / 2 - 0.15), 0xe8f6ff],
    [cone(S(0.05), S(0.2), 6), M(0, S(0.36), S(0.12), 0.5), 0xbfeaff],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  r.userData.height = S(1.75);
  return r;
}

function stagMount() {
  const q = quad({ body: 0xece6ff, belly: 0xffffff, legs: 0xdcd4fb, hoof: 0x8ae2ff, ear: 0xece6ff, snout: 0xfdfcff, tailColor: 0xffffff, face: { mood: 'happy', eye: '#6a4ae0', mouth: 'none', blush: true }, size: 1.2 });
  const { r, P, S } = q;
  P.legs.forEach((l) => l.scale.set(0.82, 1, 0.82));
  const cr = () => crystalG(0x6a7aff, 0xeafcff);
  // crystal antlers: a beam with three tines per side
  const antler = (s) => [
    [cr(), along([s * 0.12, 0.25, -0.06].map(S), [s * 0.28, 0.6, -0.18].map(S), S(0.06))],
    [cr(), along([s * 0.27, 0.57, -0.17].map(S), [s * 0.42, 0.98, -0.3].map(S), S(0.05))],
    [cr(), along([s * 0.2, 0.42, -0.11].map(S), [s * 0.2, 0.7, 0.04].map(S), S(0.042))],
    [cr(), along([s * 0.33, 0.72, -0.21].map(S), [s * 0.55, 0.86, -0.1].map(S), S(0.038))],
    [cr(), along([s * 0.38, 0.86, -0.26].map(S), [s * 0.34, 1.08, -0.38].map(S), S(0.034))],
  ];
  P.head.add(faceted(G('stag-antlers', () => merge([...antler(1), ...antler(-1)])), vc({ emissive: 0x24307a }), 0.022));
  P.head.add(halo(0x9ab4ff, S(1.7), [0, S(0.65), S(-0.18)], 0.32));
  P.body.add(faceted(G('stag-shards', () => merge([
    [cr(), along([0, 1.28, -0.5].map(S), [0, 1.5, -0.64].map(S), S(0.05))],
    [cr(), along([0.1, 1.26, -0.46].map(S), [0.2, 1.42, -0.56].map(S), S(0.036))],
    [cr(), along([-0.1, 1.26, -0.46].map(S), [-0.2, 1.42, -0.56].map(S), S(0.036))],
  ])), vc({ emissive: 0x24307a }), 0.022));
  const gem = new THREE.Mesh(oct(), glow(0xa8e8ff)); gem.position.set(0, S(1.02), S(0.86)); gem.scale.set(S(0.06), S(0.09), S(0.045)); P.body.add(gem);
  P.body.add(halo(0x9ae0ff, S(0.55), [0, S(1.02), S(0.9)], 0.7));
  addSaddle(q, 'stag-saddle', { cloth: 0x8a6ae8, trim: 0xf4f0ff, seat: 0xf6f2ff, flap: 0x7458d0 });
  r.userData.height = S(2.1);
  return r;
}

function griffinMount() {
  const q = quad({ body: 0xf2c060, belly: 0xffe6b0, hoof: 0xfff0d8, ears: false, snout: false, tailColor: 0xf2c060, face: { mood: 'happy', eye: '#a8560a', mouth: 'none', blush: false }, size: 1.2 });
  const { r, P, S, neck } = q;
  // eagle fore-half: white head and neck, feathered forelegs with golden talons
  recolor(P.head.children[0], 0xffffff); recolor(neck, 0xffffff);
  P.head.remove(P.head.children[1]); // nose dot
  for (const l of P.legs.slice(0, 2)) { recolor(l.children[0], 0xffffff); recolor(l.children[1], 0xffc23a); }
  const crest = featherG(0x2a5ad8, 0x8ac0ff);
  P.head.add(part(G('gr-head', () => merge([
    [cone(S(0.13), S(0.3), 10), M(0, S(-0.03), S(0.36), Math.PI / 2 - 0.25), 0xffbe2a],
    [tubeGeo('gr-hook', [[0, -0.02, 0.48], [0, -0.08, 0.53], [0, -0.15, 0.5]].map((p) => p.map(S)), S(0.05), { tip: 0.2, segs: 8, radial: 8 }), undefined, 0xe8901a],
    [sph(S(0.1), 12, 8), M(S(0.13), S(0.12), S(0.24), 0, 0, -0.3, 1.2, 0.35, 0.8), 0xffffff],
    [sph(S(0.1), 12, 8), M(S(-0.13), S(0.12), S(0.24), 0, 0, 0.3, 1.2, 0.35, 0.8), 0xffffff],
    [crest, M(0, S(0.2), S(-0.2), -2.0, 0, 0, S(0.18), S(0.38), S(0.35))],
    [crest, M(S(0.1), S(0.16), S(-0.22), -2.2, 0.35, 0, S(0.15), S(0.32), S(0.35))],
    [crest, M(S(-0.1), S(0.16), S(-0.22), -2.2, -0.35, 0, S(0.15), S(0.32), S(0.35))],
    [featherG(0xffffff, 0xdfe8ff), M(S(0.2), S(0.24), S(-0.04), -0.3, 0, -0.45, S(0.1), S(0.22), S(0.35))],
    [featherG(0xffffff, 0xdfe8ff), M(S(-0.2), S(0.24), S(-0.04), -0.3, 0, 0.45, S(0.1), S(0.22), S(0.35))],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  quadWings(P, [0, S(1.24), S(0.16)], S(0.24), () => part(featherWing('griffin', { p0: 0xffffff, p1: 0x3a6ae8, c0: 0xffffff, c1: 0xf4f0e0, arm: 0xffffff }), vc(), 0, 0, 0, { s: [S(1), S(1), S(1)], ow: 0.02 }), [0, 0.3, 0.75]);
  P.tail.clear();
  P.tail.add(part(G('gr-tail', () => merge([
    [tubeGeo('gr-tailT', [[0, 0, 0], [0, 0.02, -0.25], [0, -0.1, -0.45], [0, -0.02, -0.62]].map((p) => p.map(S)), S(0.055), { tip: 0.7, segs: 14, radial: 8 }), undefined, 0xf2c060],
    [sph(S(0.1), 12, 10), M(0, S(0.0), S(-0.66), 0, 0, 0, 1, 0.9, 1.3), 0xc8862a],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  addSaddle(q, 'gr-saddle', { cloth: 0x2a4ad8, trim: 0xffd04a, seat: 0x7a4a2a, flap: 0x2340b8 });
  // white chest ruff where the eagle half meets the lion half
  P.body.add(part(G('gr-ruff', () => merge([[0, 1.18, 0.62, 0.17], [0.15, 1.08, 0.6, 0.14], [-0.15, 1.08, 0.6, 0.14], [0, 0.98, 0.7, 0.15], [0.1, 0.9, 0.66, 0.11], [-0.1, 0.9, 0.66, 0.11]]
    .map(([x, y, z, k], i) => [sph(1, 12, 10), M(S(x), S(y), S(z), 0, 0, 0, S(k)), i % 2 ? 0xf4f0ff : 0xffffff]))), vc(), 0, 0, 0, { ow: 0.022 }));
  r.userData.height = S(1.9);
  return r;
}

function pantherMount() {
  const q = quad({ body: 0x3a3262, belly: 0x564a8c, legs: 0x342c5a, hoof: 0x2a2448, ear: 0x3a3262, snout: 0x4c4280, tailColor: 0x3a3262, face: { mood: 'happy', eye: '#c46aff', mouth: 'none', blush: false }, size: 1.15 });
  const { r, P, S, torso } = q;
  torso.scale.set(0.92, 1.08, 0.94);
  P.legs.forEach((l) => { l.scale.set(0.86, 1, 0.86); l.children[1].material = glow(0xb68aff); }); // shadow-step paws glow
  P.head.scale.setScalar(0.94);
  // glowing violet tiger stripes on both flanks, hugging the torso's straight section
  const stripeGeo = G('pa-stripe', () => new THREE.CylinderGeometry(S(0.38) * 1.014, S(0.38) * 1.014, S(0.85) * 0.98, 16, 1, true, Math.PI / 2 - 0.75, 1.95));
  const stripeMat = MAT('pa-stripe', () => new THREE.MeshBasicMaterial({ map: stripeTexture(), color: 0xd08aff, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  for (const s of [1, -1]) {
    const m = new THREE.Mesh(stripeGeo, stripeMat);
    m.position.copy(torso.position); m.rotation.copy(torso.rotation); m.scale.set(s * torso.scale.x, torso.scale.y, torso.scale.z);
    m.renderOrder = 2; m.raycast = () => {}; P.body.add(m);
  }
  // glowing crescent mark on the brow
  const mark = new THREE.Mesh(tor(S(0.07), S(0.016), 6, 16, Math.PI * 1.1), glow(0xe0a8ff));
  mark.position.set(0, S(0.2), S(0.3)); mark.rotation.set(-0.6, 0, Math.PI * 1.45); P.head.add(mark);
  P.head.add(halo(0xc46aff, S(0.5), [0, S(0.05), S(0.33)], 0.5));
  P.tail.clear();
  P.tail.add(part(tubeGeo('pa-tail', [[0, 0, 0], [0, -0.05, -0.25], [0, -0.3, -0.42], [0, -0.32, -0.62], [0, -0.14, -0.78]].map((p) => p.map(S)), S(0.065), { tip: 0.55, segs: 18, radial: 8 }), 0x3a3262, 0, 0, 0, { ow: 0.022 }));
  const tipOrb = new THREE.Mesh(sph(S(0.06), 12, 10), glow(0xe0a8ff)); tipOrb.position.set(0, S(-0.13), S(-0.79)); P.tail.add(tipOrb);
  P.tail.add(halo(0xb05aff, S(0.5), [0, S(-0.13), S(-0.79)], 0.85));
  addSaddle(q, 'pa-saddle', { cloth: 0x7a3ac8, trim: 0xe8e0ff, seat: 0x2a2440, flap: 0x5a2a9a }, 0.94, 0.92);
  const gem = new THREE.Mesh(oct(), glow(0xe0a8ff)); gem.position.set(0, S(1.36), S(0.22)); gem.scale.set(S(0.04), S(0.06), S(0.03)); P.body.add(gem);
  r.userData.height = S(1.85);
  return r;
}

function drakeMount() {
  const q = quad({ body: 0xe0442c, belly: 0xffc85a, legs: 0xcc3a28, hoof: 0x4a2626, ears: false, snout: 0xf05a3e, tailColor: 0xe0442c, face: { mood: 'happy', eye: '#ffb000', mouth: 'none', blush: false }, size: 1.2 });
  const { r, P, S } = q;
  const snout = P.head.children[1], nose = P.head.children[2];
  snout.scale.z *= 1.35; snout.position.z += S(0.05); nose.position.z += S(0.1); nose.position.y += S(0.02); nose.scale.set(1.5, 0.6, 0.8); recolor(nose, 0x8a1a14);
  const horn = tubeGeo('dr-horn', [[0.13, 0.22, -0.06], [0.22, 0.38, -0.22], [0.22, 0.46, -0.42]].map((p) => p.map(S)), S(0.07), { tip: 0.1, segs: 12, radial: 8 });
  P.head.add(part(G('dr-head', () => merge([
    [horn, undefined, 0xfff0c8], [horn, M(0, 0, 0, 0, 0, 0, -1, 1, 1), 0xfff0c8],
    [cone(S(0.05), S(0.16), 6), M(0, S(0.3), S(-0.12), -0.6), 0xffc85a], [cone(S(0.04), S(0.12), 6), M(0, S(0.25), S(-0.26), -1.0), 0xffc85a],
    [cone(S(0.05), S(0.16), 6), M(S(0.3), S(0.0), S(-0.08), 0, 0, -1.2), 0xffc85a], [cone(S(0.05), S(0.16), 6), M(S(-0.3), S(0.0), S(-0.08), 0, 0, 1.2), 0xffc85a],
    [cone(S(0.025), S(0.07), 6), M(S(0.07), S(-0.2), S(0.4), Math.PI), 0xffffff], [cone(S(0.025), S(0.07), 6), M(S(-0.07), S(-0.2), S(0.4), Math.PI), 0xffffff],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  // spine ridge (before and behind the saddle) merged with the saddle
  const spikes = [[0, 1.48, 0.62, 0.4, 0.07, 0.17], [0, 1.4, 0.48, 0.5, 0.07, 0.17], [0, 1.24, -0.48, -0.5, 0.08, 0.2], [0, 1.18, -0.64, -0.7, 0.07, 0.17], [0, 1.1, -0.8, -0.9, 0.06, 0.14]];
  P.body.add(part(G('dr-spikes', () => merge(spikes.map(([x, y, z, rx, rr, h]) => [cone(S(rr), S(h), 6), M(S(x), S(y), S(z), rx), 0xffc85a]))), vc(), 0, 0, 0, { ow: 0.022 }));
  addSaddle(q, 'dr-saddle', { cloth: 0x3a2a3a, trim: 0xffc84a, seat: 0x5a3a2a, flap: 0x2a1e2a });
  // folded wings resting along the back behind the rider
  const wingG = G('dr-wing', () => {
    const memb = plate('foldwing', FOLDWING, 0xff7a2a, 0xffc84a, 'x');
    const bone = tubeGeo('dr-bone', [[0, 0, 0], [0, 0.44, -0.16], [0, 0.36, -1.0]], 0.05, { tip: 0.4, segs: 12, radial: 6 });
    return merge([[memb, M(0, 0, 0, 0, Math.PI / 2, 0, 1, 1, 0.8)], [bone, M(0.02, 0, 0), 0xb02a20], [cone(0.04, 0.12, 6), M(0.02, 0.5, -0.14, -0.3), 0xfff0c8]]);
  });
  quadWings(P, [0, S(1.22), S(-0.3)], S(0.2), () => part(wingG, vc(), 0, 0, 0, { s: [S(1.05), S(1.05), S(1.05)], ow: 0.022 }), [0.35, -0.15, -0.55]);
  // long tail with an ember tip
  P.tail.clear();
  P.tail.add(part(G('dr-tail', () => merge([
    [tubeGeo('dr-tailT', [[0, 0, 0.05], [0, -0.06, -0.3], [0, -0.26, -0.62], [0, -0.3, -1.0]].map((p) => p.map(S)), S(0.15), { tip: 0.18, segs: 18, radial: 10 }), undefined, 0xe0442c],
    [cone(S(0.05), S(0.13), 6), M(0, S(0.1), S(-0.25), -0.5), 0xffc85a], [cone(S(0.045), S(0.12), 6), M(0, S(-0.08), S(-0.58), -0.9), 0xffc85a],
  ])), vc(), 0, 0, 0, { ow: 0.022 }));
  P.tail.add(part(G('dr-ember', () => { const f = flameGeo(0xff3a12, 0xff9a1a, 0xfff07a); return merge([[f, M(0, S(-0.3), S(-1.02), -1.3, 0, 0, S(0.42))], [f, M(0, S(-0.3), S(-1.0), -0.8, 0, 0.6, S(0.3))], [f, M(0, S(-0.3), S(-1.0), -0.8, Math.PI, 0.6, S(0.3))]]); }), glowVC(), 0, 0, 0, { ow: 0.02 }));
  P.tail.add(halo(0xff7a1a, S(1.0), [0, S(-0.22), S(-1.15)], 0.55));
  r.userData.height = S(1.95);
  return r;
}

function cloudMount() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const puffs = [[0, 0.86, -0.05, 0.58], [0, 0.9, 0.5, 0.52], [0, 0.86, -0.55, 0.5], [0.5, 0.78, 0.12, 0.4], [-0.5, 0.78, 0.12, 0.4], [0.46, 0.78, -0.4, 0.38], [-0.46, 0.78, -0.4, 0.38],
    [0, 0.56, 0.0, 0.42], [0.42, 0.62, 0.52, 0.22], [-0.42, 0.62, 0.52, 0.22], [0, 1.12, -0.48, 0.34], [0, 0.82, -1.02, 0.3], [0, 0.98, -1.24, 0.2], [0, 1.16, -1.34, 0.13]];
  body.add(part(G('cloud-puffs', () => {
    const g = merge(puffs.map(([x, y, z, k]) => [sph(1, 20, 14), M(x, y, z, 0, 0, 0, k)]));
    const r = ramp([[0.3, 0xc8c4ff], [0.62, 0xe4e4ff], [0.95, 0xffffff]]);
    return paint(g, (c, x, y) => r(c, y));
  }), vc(), 0, 0, 0, { ow: 0.03 }));
  face(body, 0.52, cloudFace(), { y: 0.9, z: 0.5, top: 1.12, h: 0.85, w: 1.3 });
  // a few twinkles drifting round it
  const tw = [sparkle(0xfff4c0, 0.3, [0.75, 1.2, 0.3]), sparkle(0xffffff, 0.24, [-0.7, 1.05, -0.4]), sparkle(0xd8e4ff, 0.2, [0.5, 0.55, -0.9])];
  tw.forEach((s) => body.add(s));
  tick(body.children[0], (t) => tw.forEach((s, i) => s.scale.setScalar((0.16 + i * 0.04) * (0.5 + 0.7 * Math.abs(Math.sin(t * 2.2 + i * 1.9))))));
  body.add(halo(0xe8e8ff, 2.6, [0, 0.8, 0], 0.25));
  const seat = new THREE.Object3D(); seat.position.set(0, 1.4, -0.1); body.add(seat);
  root.userData.parts = { body, seat };
  root.userData.anim = 'float';
  root.userData.height = 1.75;
  return root;
}

function phoenixMount() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bodyG = G('phm-bodyG', () => { const r = ramp([[0.3, 0xffc23a], [1.1, 0xff7a2a], [1.85, 0xff3a2a]]); return paint(new THREE.SphereGeometry(1, 26, 20), (c, x, y) => r(c, 1.1 + y * 0.8)); });
  const headG = G('phm-headG', () => { const r = ramp([[-0.4, 0xff7a2a], [0.4, 0xff4a26]]); return paint(new THREE.SphereGeometry(0.4, 22, 16), (c, x, y) => r(c, y)); });
  body.add(part(G('phm-body', () => merge([
    [bodyG, M(0, 1.1, 0, 0, 0, 0, 0.8, 0.76, 0.9)],
    [sph(0.5, 18, 14), M(0, 0.98, 0.32, 0, 0, 0, 1.05, 1.15, 0.8), 0xffdf7a],
    [cap(1, 16, 10, Math.PI), M(0, 1.72, 0.62, 0.75, 0, 0, 0.27, 0.42, 0.27), 0xff5a26],
    [headG, M(0, 2.02, 0.8)],
    [cone(0.11, 0.26, 10), M(0, 1.97, 1.22, Math.PI / 2 - 0.15), 0xffc020],
    [tubeGeo('phm-hook', [[0, 1.98, 1.3], [0, 1.94, 1.36], [0, 1.88, 1.34]], 0.04, { tip: 0.25, segs: 6, radial: 6 }), undefined, 0xe8901a],
  ])), vc(), 0, 0, 0, { ow: 0.03 }));
  face(body, 0.4, critterFace({ mood: 'happy', mouth: 'none', eye: '#3a140a' }), { y: 2.02, z: 0.8, top: 1.05, h: 0.95, w: 1.7 });
  // flame crest and tail plumes
  const crest = new THREE.Group(); crest.position.set(0, 2.32, 0.72); body.add(crest);
  const crestM = part(G('phm-crest', () => {
    const f = flameGeo(0xff3a12, 0xff9a1a, 0xfff27a);
    return merge([[f, M(0, 0, 0, -0.55, 0, 0, 0.45, 0.62, 0.45)], [f, M(0.12, -0.04, -0.02, -0.6, 0, -0.55, 0.34, 0.46, 0.34)], [f, M(-0.12, -0.04, -0.02, -0.6, Math.PI, 0.55, 0.34, 0.46, 0.34)], [f, M(0, -0.1, -0.12, -1.1, 0, 0, 0.36, 0.5, 0.36)]]);
  }), glowVC(), 0, 0, 0, { ow: 0.022 });
  crest.add(crestM);
  crest.add(halo(0xff8a2a, 1.4, [0, 0.25, -0.1], 0.45));
  const tail = new THREE.Group(); tail.position.set(0, 1.25, -0.62); body.add(tail);
  const tailM = part(G('phm-tail', () => {
    const fe = plate('plume', PLUME, 0xff4a1a, 0xffb02a), L = [];
    for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.42; L.push([fe, M(0, 0, 0, -1.15 - Math.abs(a) * 0.3, 0, a, 0.55, 1.3 - Math.abs(a) * 0.35, 0.5, 'ZYX')]); }
    return merge(L);
  }), vc(), 0, 0, 0, { ow: 0.026 });
  tail.add(tailM);
  tail.add(part(G('phm-tailfire', () => {
    const f = flameGeo(0xff6a1a, 0xffb42a, 0xfff6a0), L = [];
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.42, rx = -1.15 - Math.abs(a) * 0.3, len = 1.3 - Math.abs(a) * 0.35;
      const tip = new THREE.Vector3(0, len * 0.92, 0).applyMatrix4(M(0, 0, 0, rx, 0, a, 1, 1, 1, 'ZYX'));
      L.push([f, M(tip.x, tip.y, tip.z, rx + 0.5, 0, a, 0.42, 0.5, 0.42, 'ZYX')]);
    }
    return merge(L);
  }), glowVC(), 0, 0, 0, { ow: 0.022 }));
  tail.add(halo(0xff9a3a, 2.0, [0, 0.45, -0.8], 0.35));
  tick(crestM, (t) => {
    crest.scale.set(1 + Math.sin(t * 9) * 0.05, 1 + Math.sin(t * 6.5) * 0.1, 1);
    tail.rotation.x = Math.sin(t * 1.6) * 0.06; tail.rotation.z = Math.sin(t * 1.1) * 0.05;
  });
  // wings: big feathered fans at the sides ('bird' beats wings' children about Z)
  const wings = new THREE.Group(); wings.position.set(0, 1.35, 0.0); body.add(wings);
  const wingG = featherWing('phoenix', { p0: 0xff5a1a, p1: 0xffd23a, c0: 0xff3a2a, c1: 0xff8a2a, arm: 0xff4a2a });
  for (const s of [-1, 1]) {
    const w = new THREE.Group(); w.position.x = s * 0.68; wings.add(w);
    const mir = new THREE.Group(); mir.scale.x = s; w.add(mir);
    const ps = new THREE.Group(); ps.rotation.set(0, 0.25, 0.5); mir.add(ps);
    ps.add(part(wingG, vc(), 0, 0, 0, { s: [1.55, 1.55, 1.55], ow: 0.026 }));
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.32 * s, 0.5, 0.08); body.add(leg);
    leg.add(part(G('phm-leg', () => merge([
      [cyl(0.06, 0.05, 0.42, 8), M(0, -0.22, 0), 0xffb020],
      [sph(0.11, 12, 10), M(0, -0.02, 0, 0, 0, 0, 1, 1.2, 1), 0xff7a2a],
      [cap(1, 10, 8, 1.6), M(0, -0.44, 0.1, 0, 0, 0, 0.05, 0.05, 0.16), 0xffb020], [cap(1, 10, 8, 1.6), M(0.08, -0.44, 0.08, 0, 0.5, 0, 0.045, 0.045, 0.13), 0xffb020],
      [cap(1, 10, 8, 1.6), M(-0.08, -0.44, 0.08, 0, -0.5, 0, 0.045, 0.045, 0.13), 0xffb020], [cap(1, 10, 8, 1.6), M(0, -0.44, -0.06, 0, Math.PI, 0, 0.04, 0.04, 0.1), 0xffb020],
    ])), vc(), 0, 0, 0, { ow: 0.02 }));
    legs.push(leg);
  }
  body.add(part(G('phm-saddle', () => merge([
    [cyl(0.36, 0.38, 0.1, 18), M(0, 1.9, -0.26, -0.12, 0, 0, 1, 1, 1.2), 0x1a9a9a],
    [tor(0.37, 0.028, 6, 30), M(0, 1.9, -0.26, Math.PI / 2 - 0.12, 0, 0, 1, 1.2, 1), 0xffd04a],
    [sph(1, 14, 10), M(0, 1.98, -0.66, -0.4, 0, 0, 0.26, 0.11, 0.08), 0x1a9a9a],
    [sph(0.06, 10, 8), M(0, 2.0, 0.16), 0xffd04a],
  ])), vc(), 0, 0, 0, { ow: 0.024 }));
  body.add(halo(0xff9a3a, 3.2, [0, 1.3, 0], 0.18));
  const seat = new THREE.Object3D(); seat.position.set(0, 1.96, -0.26); body.add(seat);
  root.userData.parts = { body, legs, wings, seat, chick: true };
  root.userData.anim = 'bird';
  root.userData.height = 2.6;
  return root;
}

export function buildExtraMount(model) {
  switch (model) {
    case 'lion': return lionMount();
    case 'bear': return bearMount();
    case 'stag': return stagMount();
    case 'griffin': return griffinMount();
    case 'panther': return pantherMount();
    case 'drake': return drakeMount();
    case 'cloud': return cloudMount();
    case 'phoenixmount': return phoenixMount();
  }
  return lionMount();
}

// ---------------------------------------------------------------- gathering nodes
const ORE = [
  { rock: [0x9a8670, 0x857360], c0: 0xa8461e, c1: 0xffb478, em: 0x2a0c00, chunky: true, moss: 0x4ab89a },
  { rock: [0x8c8f98, 0x767a84], c0: 0x50586a, c1: 0xd2dae6, em: 0x000000, chunky: true },
  { rock: [0x8a92a8, 0x747c92], c0: 0x9aa8c0, c1: 0xffffff, em: 0x1a2232, glint: 0xffffff },
  { rock: [0x6e7c9e, 0x5a6688], c0: 0x34b8e0, c1: 0xeaffff, em: 0x125a7a, glow: 0x7ae8ff, glint: 0xd8ffff },
  { rock: [0x3e3656, 0x2e2842], c0: 0xd08a12, c1: 0xfff2a8, em: 0x5a3800, glow: 0xffd24a, glint: 0xfff0a0, stars: true },
];
const HERB = [
  { leaf: [0x5e9a6e, 0xc8ead2], stem: 0x6aa07a, kind: 'silver', p0: 0xd8eee0, p1: 0xffffff, ctr: 0xf4f8ff },
  { leaf: [0x2a6e66, 0x5ec0a0], stem: 0x3a8a74, kind: 'bell', p0: 0x6ab8ff, p1: 0xe8f8ff, ctr: 0xffffff, glow: 0x8ad8ff },
  { leaf: [0x3e8a34, 0x8ad050], stem: 0x4a8a2a, kind: 'flame', p0: 0xff2a1a, p1: 0xffc23a, ctr: 0xfff07a },
  { leaf: [0x3a8a8a, 0xc8f2ff], stem: 0x4a9a9a, kind: 'lily', p0: 0xbfe8ff, p1: 0xffffff, ctr: 0x8ae0ff },
  { leaf: [0x2e8a4e, 0x86d878], stem: 0x3a8a4a, kind: 'lotus', p0: 0xffd04a, p1: 0xfffcec, ctr: 0xffb020, glow: 0xffe28a },
];
const TREE = [
  { bark: 0x8a5a34, wood: 0xf4d6a0, leaf: [0x3a9a3a, 0x8ae06a], fruit: 'acorn' },
  { bark: 0x7a4a34, wood: 0xf6d8a4, leaf: [0xd8401e, 0xffb43a], fruit: 'seed' },
  { bark: 0x3e3440, wood: 0xc8b4a0, leaf: [0x0e7a7a, 0x5ae6d2], fruit: 'pod' },
  { bark: 0x6a4a3a, wood: 0xf0d8b0, leaf: [0x1e6a52, 0x3a9a76], fruit: 'cone', pine: true },
  { bark: 0xf2eefa, wood: 0xffe6a0, leaf: [0x9a8ae8, 0xe4e0ff], fruit: 'star', glow: 0xffe28a },
];

function oreNode(tier) {
  const C = ORE[tier], root = new THREE.Group(), yieldG = new THREE.Group();
  const rock = G('ore-rock' + tier, () => merge([
    [rockGeo(1), M(0, 0.5, 0, 0, 0.3, 0, 0.9, 0.72, 0.78), C.rock[0]],
    [rockGeo(2), M(0.62, 0.28, 0.18, 0, 1.1, 0, 0.48, 0.42, 0.44), C.rock[1]],
    [rockGeo(3), M(-0.58, 0.26, -0.12, 0, 2.0, 0, 0.5, 0.4, 0.46), C.rock[1]],
    [rockGeo(4), M(0.18, 0.14, 0.66, 0, 0.6, 0, 0.3, 0.24, 0.28), C.rock[0]],
    [rockGeo(5), M(-0.28, 0.12, 0.62, 0, 1.4, 0, 0.2, 0.16, 0.2), C.rock[1]],
    ...(C.moss ? [[sph(1, 8, 6), M(-0.35, 0.86, 0.2, 0, 0, 0.3, 0.16, 0.05, 0.12), C.moss], [sph(1, 8, 6), M(0.42, 0.58, 0.42, 0.4, 0, -0.5, 0.12, 0.04, 0.1), C.moss]] : []),
  ]));
  root.add(faceted(rock, vc(), 0.03));
  // ore crystals growing out of the outcrop: squat chunks for base metals, tall prisms for the precious ones
  // [boulder centre, semi-axes, outward direction, length, radius]
  const B0 = [[0, 0.5, 0], [0.9, 0.72, 0.78]], B1 = [[0.62, 0.28, 0.18], [0.48, 0.42, 0.44]], B2 = [[-0.58, 0.26, -0.12], [0.5, 0.4, 0.46]];
  const sites = [[B0, [0.05, 1, 0.12], 0.78, 0.17], [B0, [0.62, 0.75, 0.35], 0.56, 0.13], [B0, [-0.6, 0.72, 0.3], 0.54, 0.13], [B0, [0.22, 0.55, 0.85], 0.44, 0.11],
    [B0, [-0.25, 0.6, -0.8], 0.46, 0.11], [B1, [0.6, 0.75, 0.35], 0.38, 0.1], [B2, [-0.55, 0.8, 0.1], 0.4, 0.1], [B0, [-0.2, 0.45, 0.88], 0.3, 0.08]];
  const k = C.chunky ? 0.95 : 1.2, kr = C.chunky ? 1.3 : 1;
  const crystals = G('ore-crys' + tier, () => merge(sites.map(([[c, ax], d, len, r]) => {
    const n = new THREE.Vector3(...d).normalize(), a = [c[0] + n.x * ax[0] * 0.82, c[1] + n.y * ax[1] * 0.82, c[2] + n.z * ax[2] * 0.82];
    const up = n.clone().lerp(new THREE.Vector3(0, 1, 0), 0.35).normalize();
    return [crystalG(C.c0, C.c1, C.chunky ? 5 : 6), along(a, [a[0] + up.x, a[1] + up.y, a[2] + up.z], r * kr, len * k)];
  })));
  yieldG.add(faceted(crystals, vc({ emissive: C.em }), 0.026));
  if (C.stars) {
    const st = starG(0xffc020, 0xfff6c0);
    const sm = part(G('ore-stars', () => merge([[st, M(0.08, 2.0, 0.2, 0, 0.3, 0.1, 0.17)], [st, M(0.66, 1.42, 0.42, 0, -0.5, -0.3, 0.13)], [st, M(-0.64, 1.38, 0.38, 0, 0.5, 0.25, 0.13)], [st, M(0.36, 1.08, 0.98, 0, -0.1, 0.2, 0.1)]])), glowVC(), 0, 0, 0, { ow: 0.02 });
    yieldG.add(sm);
  }
  if (C.glow) { yieldG.add(halo(C.glow, 2.6, [0, 1.3, 0.15], 0.45)); yieldG.add(halo(C.glow, 1.1, [0.05, 1.75, 0.15], 0.6)); }
  if (C.glint) [[0.3, 1.75, 0.35, 0.32], [-0.62, 1.3, 0.4, 0.26], [0.75, 1.05, 0.55, 0.22]].forEach(([x, y, z, s]) => yieldG.add(sparkle(C.glint, s, [x, y, z])));
  root.add(yieldG);
  return finishNode(root, yieldG, 'ore', tier, 2.0);
}

// One flower head (around +Y, centred on the origin) for each herb kind.
function flowerList(C) {
  const L = [];
  if (C.kind === 'silver') {
    const lf = leafG(0xa8d4b4, 0xf4fff8);
    for (let i = 0; i < 6; i++) L.push([lf, M(0, -0.05 - i * 0.05, 0, 0.8, (i / 6) * Math.PI * 2 + i, 0, 0.09, 0.2, 0.3, 'YXZ')]);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; L.push([sph(0.035, 8, 6), M(Math.sin(a) * 0.05, 0.03 + (i % 2) * 0.03, Math.cos(a) * 0.05), i % 2 ? 0xffffff : 0xe8f4ff]); }
    L.push([sph(0.04, 8, 6), M(0, 0.08, 0), 0xffffff]);
  } else if (C.kind === 'bell') {
    const pt = plate('point', POINT, C.p0, C.p1);
    for (let i = 0; i < 6; i++) L.push([pt, M(0, 0, 0, Math.PI / 2 - 0.45, (i / 6) * Math.PI * 2, 0, 0.11, 0.17, 0.3, 'YXZ')]);
    for (let i = 0; i < 6; i++) L.push([pt, M(0, 0.02, 0, Math.PI / 2 - 1.0, (i / 6) * Math.PI * 2 + 0.52, 0, 0.08, 0.12, 0.3, 'YXZ')]);
    L.push([sph(0.035, 10, 8), M(0, 0.04, 0), C.ctr]);
  } else if (C.kind === 'flame') {
    const fp = plate('flamep', FLAMEP, C.p0, C.p1);
    for (let i = 0; i < 6; i++) L.push([fp, M(0, 0, 0, Math.PI / 2 - 0.75, (i / 6) * Math.PI * 2, 0, 0.13, 0.2, 0.3, 'YXZ')]);
    for (let i = 0; i < 4; i++) L.push([fp, M(0, 0.03, 0, Math.PI / 2 - 1.25, (i / 4) * Math.PI * 2 + 0.6, 0, 0.09, 0.15, 0.3, 'YXZ')]);
    L.push([sph(0.04, 10, 8), M(0, 0.05, 0), C.ctr]);
  } else if (C.kind === 'lily') {
    const pt = plate('point', POINT, C.p0, C.p1);
    for (let i = 0; i < 6; i++) L.push([pt, M(0, 0, 0, 0.55, (i / 6) * Math.PI * 2, 0, 0.12, 0.24, 0.3, 'YXZ')]);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; L.push([crystalG(0x8ae0ff, 0xffffff, 5), M(Math.sin(a) * 0.025, 0.02, Math.cos(a) * 0.025, Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3, 0.012, 0.16, 0.012)]); }
  } else {
    const pt = plate('point', POINT, C.p0, C.p1);
    for (let i = 0; i < 8; i++) L.push([pt, M(0, 0, 0, 0.95, (i / 8) * Math.PI * 2, 0, 0.12, 0.2, 0.3, 'YXZ')]);
    for (let i = 0; i < 6; i++) L.push([pt, M(0, 0.01, 0, 0.45, (i / 6) * Math.PI * 2 + 0.4, 0, 0.11, 0.2, 0.3, 'YXZ')]);
    L.push([cyl(0.05, 0.04, 0.04, 12), M(0, 0.06, 0), C.ctr]);
  }
  return L;
}
function herbNode(tier) {
  const C = HERB[tier], root = new THREE.Group(), yieldG = new THREE.Group();
  const lotus = C.kind === 'lotus';
  root.add(part(G('herb-bush' + tier, () => {
    const lf = lotus ? plate('round', ROUND, C.leaf[0], C.leaf[1]) : leafG(C.leaf[0], C.leaf[1]), L = [];
    const rings = lotus ? [[7, 1.35, 0.55, 0.3], [5, 1.05, 0.45, 0.35]] : [[8, 1.15, 0.55, 0.0], [7, 0.75, 0.6, 0.4], [5, 0.38, 0.52, 0.9]];
    rings.forEach(([n, tilt, len, off], j) => { for (let i = 0; i < n; i++) L.push([lf, M(0, 0.06 + j * 0.04, 0, tilt, (i / n) * Math.PI * 2 + off, 0, len * (lotus ? 0.9 : 0.62), len, 0.5, 'YXZ')]); });
    L.push([sph(1, 10, 6), M(0, 0.0, 0, 0, 0, 0, 0.32, 0.07, 0.32), 0x6a5a3a]);
    return merge(L);
  }), vc(), 0, 0, 0, { ow: 0.022 }));
  // harvestable: stalks topped with flowers
  const heads = lotus ? [[0, 1.0, 0.05, 1.5], [0.34, 0.74, 0.22, 1.1], [-0.3, 0.68, -0.18, 1.05]] : [[0, 1.22, 0, 1.15], [0.3, 1.0, 0.18, 1.0], [-0.3, 0.98, 0.12, 0.95], [0.12, 0.86, -0.32, 0.9], [-0.18, 0.78, 0.38, 0.85]];
  yieldG.add(part(G('herb-stems' + tier, () => merge(heads.map(([x, y, z], i) => [tubeGeo(`herb-stem${tier}|${i}`, [[x * 0.2, 0.05, z * 0.2], [x * 0.6, y * 0.55, z * 0.6], [x, y, z]], 0.022, { tip: 0.7, segs: 10, radial: 6 }), undefined, C.stem]))), vc(), 0, 0, 0, { ow: 0.014 }));
  const fl = flowerList(C);
  const flowers = G('herb-flowers' + tier, () => merge(heads.flatMap(([x, y, z, k], i) => fl.map(([g, m, c]) => [g, M(x, y, z, 0.15 * Math.sin(i * 2.1), i * 1.3, 0.15 * Math.cos(i * 1.7), k).multiply(m), c]))));
  yieldG.add(part(flowers, C.glow ? glowVC() : vc(), 0, 0, 0, { ow: 0.016 }));
  if (C.glow) { heads.forEach(([x, y, z, k]) => yieldG.add(halo(C.glow, 0.55 * k, [x, y + 0.05, z], 0.6))); yieldG.add(halo(C.glow, 2.2, [0, 0.8, 0], 0.22)); }
  if (C.kind === 'lily' || lotus) [[0.35, 1.05, 0.3, 0.2], [-0.4, 0.9, 0.1, 0.16], [0.1, 1.35, -0.1, 0.18]].forEach(([x, y, z, s]) => yieldG.add(sparkle(lotus ? 0xfff2b0 : 0xe8fbff, s, [x, y, z])));
  root.add(yieldG);
  return finishNode(root, yieldG, 'herb', tier, lotus ? 1.35 : 1.45);
}

// Trunk with a V-shaped chopping notch on its front: the cut faces are flattened and painted as fresh wood.
const notchTrunk = (key, bark, wood, h, r0, r1) => G('trunk' + key, () => {
  const g = new THREE.CylinderGeometry(r1, r0, h, 22, 40, false, Math.PI);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position, yc = 0.48, hw = 0.13, depth = 0.6;
  const cb = new THREE.Color(bark), cd = new THREE.Color(bark).multiplyScalar(0.78), cw = new THREE.Color(wood), c = new THREE.Color(), col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), rr = Math.hypot(x, z);
    const k = Math.max(0, 1 - Math.abs(y - yc) / hw), zc = rr * (1 - depth * k);
    let cut = false;
    if (k > 0 && rr > 1e-4 && z > zc) { p.setZ(i, zc); cut = true; }
    if (cut && k > 0.12) c.copy(cw).lerp(cd, Math.max(0, 0.35 - k) * 0.6);
    else c.copy(cb).lerp(cd, Math.sin(Math.atan2(x, z) * 7 + y * 3) > 0.55 ? 1 : 0);
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return weldNormals(g);
});
function treeNode(tier) {
  const C = TREE[tier], outer = new THREE.Group(), root = new THREE.Group(), yieldG = new THREE.Group();
  outer.add(root); root.scale.setScalar(0.88);
  const th = C.pine ? 1.0 : 1.3;
  root.add(part(G('tree-trunk' + tier, () => {
    const L = [[notchTrunk('t' + tier, C.bark, C.wood, th, 0.25, 0.16)]];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; L.push([cone(0.1, 0.3, 6), M(Math.sin(a) * 0.22, 0.08, Math.cos(a) * 0.22, Math.cos(a) * 1.2, 0, -Math.sin(a) * 1.2, 1, 1, 0.7), C.bark]); }
    if (!C.pine) {
      L.push([tubeGeo('tree-br1', [[0, 1.0, 0], [0.25, 1.3, 0.05], [0.42, 1.55, 0.08]], 0.075, { tip: 0.5, segs: 8, radial: 7 }), undefined, C.bark]);
      L.push([tubeGeo('tree-br2', [[0, 1.05, 0], [-0.22, 1.35, -0.06], [-0.36, 1.62, -0.1]], 0.07, { tip: 0.5, segs: 8, radial: 7 }), undefined, C.bark]);
    }
    for (const [x, z, ry] of [[0.32, 0.42, 0.4], [0.12, 0.55, 1.2], [-0.2, 0.46, 2.2]]) L.push([box(0.09, 0.03, 0.06), M(x, 0.015, z, 0, ry, 0), C.wood]);
    return merge(L);
  }), vc(), 0, 0, 0, { ow: 0.028 }));
  // harvestable canopy
  const canopy = G('tree-canopy' + tier, () => {
    const r = ramp([[1.2, C.leaf[0]], [2.3, C.leaf[1]]]);
    if (C.pine) {
      const L = [];
      [[0.78, 0.8, 0.9], [0.62, 0.7, 1.38], [0.44, 0.6, 1.8], [0.24, 0.42, 2.12]].forEach(([rad, h, y]) => {
        L.push([cone(rad, h, 12), M(0, y, 0), C.leaf[0]]);
        L.push([cone(rad * 0.82, h * 0.42, 12), M(0, y + h * 0.3, 0), 0xffffff]);
        L.push([cone(rad * 1.02, h * 0.16, 12), M(0, y - h * 0.38, 0), C.leaf[1]]);
      });
      return merge(L);
    }
    const g = merge([[0, 1.62, 0, 0.6], [0.48, 1.46, 0.1, 0.44], [-0.48, 1.48, 0.04, 0.46], [0.1, 1.42, -0.44, 0.46], [-0.06, 2.02, -0.06, 0.44], [0.16, 1.56, 0.46, 0.4], [-0.3, 1.82, 0.3, 0.34]]
      .map(([x, y, z, k]) => [sph(1, 16, 12), M(x, y, z, 0, 0, 0, k)]));
    return paint(g, (c, x, y) => r(c, y));
  });
  yieldG.add(part(canopy, vc(), 0, 0, 0, { ow: 0.03 }));
  const onBall = (c, r, d) => { const n = new THREE.Vector3(...d).normalize(); return [c[0] + n.x * r, c[1] + n.y * r, c[2] + n.z * r]; };
  const spots = C.pine ? [[0.5, 0.75, 0.42], [-0.46, 1.2, 0.3], [0.3, 1.62, 0.28], [-0.12, 0.72, 0.62]] : [
    onBall([0.16, 1.56, 0.46], 0.4, [0.35, -0.35, 0.85]), onBall([0.48, 1.46, 0.1], 0.44, [0.8, -0.3, 0.5]), onBall([-0.48, 1.48, 0.04], 0.46, [-0.6, -0.25, 0.75]),
    onBall([0, 1.62, 0], 0.6, [0.2, 0.45, 0.87]), onBall([-0.3, 1.82, 0.3], 0.34, [-0.35, 0.5, 0.8]), onBall([-0.06, 2.02, -0.06], 0.44, [0.55, 0.65, 0.5]),
    ...(C.fruit === 'star' ? [onBall([0.1, 1.42, -0.44], 0.46, [0.6, -0.2, -0.75]), onBall([-0.48, 1.48, 0.04], 0.46, [-0.8, 0.3, -0.4]), onBall([-0.06, 2.02, -0.06], 0.44, [-0.4, 0.8, 0.3]), onBall([0.48, 1.46, 0.1], 0.44, [0.5, 0.6, -0.4])] : []),
  ];
  const fruitG = G('tree-fruit' + tier, () => merge(spots.flatMap(([x, y, z], i) => {
    const m = M(x, y, z, 0, i * 1.7, 0);
    if (C.fruit === 'acorn') return [[sph(0.09, 10, 8), m.clone().multiply(M(0, -0.07, 0, 0, 0, 0, 1, 1.25, 1)), 0xd8963a], [cap(0.1, 10, 6, 1.4), m.clone().multiply(M(0, -0.01, 0)), 0x6a4426], [cyl(0.014, 0.014, 0.06, 5), m.clone().multiply(M(0, 0.05, 0)), 0x5a3a20]];
    if (C.fruit === 'seed') return [[leafG(0xffd84a, 0xfff0b0), m.clone().multiply(M(0, 0, 0, 0, 0, 0.55, 0.13, 0.28, 0.5))], [leafG(0xffd84a, 0xfff0b0), m.clone().multiply(M(0, 0, 0, 0, 0, -0.55, 0.13, 0.28, 0.5))], [sph(0.04, 8, 6), m, 0xc8862a]];
    if (C.fruit === 'pod') return [[sph(0.09, 12, 10), m.clone().multiply(M(0, -0.07, 0, 0, 0, 0, 0.8, 1.35, 0.8)), 0xd8e6f4], [cyl(0.012, 0.012, 0.07, 5), m.clone().multiply(M(0, 0.05, 0)), 0x3a3440]];
    if (C.fruit === 'cone') return [[cone(0.06, 0.16, 8), m.clone().multiply(M(0, -0.05, 0, Math.PI)), 0x7ac8ff], [sph(0.04, 8, 6), m.clone().multiply(M(0, 0.03, 0)), 0xeafaff]];
    return [];
  })));
  if (C.fruit === 'star') {
    const st = starG(0xffd24a, 0xfffbe0);
    yieldG.add(part(G('tree-stars', () => merge(spots.map(([x, y, z], i) => [st, M(x, y, z, 0, i * 0.9 + Math.atan2(x, z), i * 0.4, 0.15)]))), glowVC(), 0, 0, 0, { ow: 0.018 }));
    spots.forEach(([x, y, z]) => yieldG.add(halo(C.glow, 0.55, [x, y, z], 0.75)));
    yieldG.add(halo(0xd8c8ff, 3.2, [0, 1.6, 0], 0.3));
    [[0.8, 2.1, 0.2, 0.3], [-0.7, 2.2, -0.1, 0.24], [0.2, 2.45, 0.3, 0.22]].forEach(([x, y, z, s]) => yieldG.add(sparkle(0xfff2b0, s, [x, y, z])));
  } else {
    yieldG.add(part(fruitG, vc(), 0, 0, 0, { ow: 0.018 }));
  }
  root.add(yieldG);
  return finishNode(outer, yieldG, 'tree', tier, C.pine ? 2.1 : 2.2);
}
function finishNode(root, yieldG, kind, tier, height) {
  yieldG.name = 'yield';
  root.userData.parts = { yield: yieldG };
  root.userData.kind = kind; root.userData.tier = tier;
  root.userData.height = height;
  return root;
}

export function buildNode(kind, tier = 0) {
  const t = Math.max(0, Math.min(4, tier | 0));
  if (kind === 'herb') return herbNode(t);
  if (kind === 'tree') return treeNode(t);
  return oreNode(t);
}

// ---------------------------------------------------------------- farm crops
// Four plants spread over a 2.4 x 2.4 m patch (the soil itself is drawn by the game). Each crop is at most a few
// merged meshes: foliage, produce and (for the magic crops) a glowing layer with halos.
const PLOTS = [[-0.6, -0.58, 0.3], [0.62, -0.6, 2.1], [-0.58, 0.62, 4.0], [0.6, 0.6, 5.3]];
const at = (x, z, ry, m = new THREE.Matrix4()) => M(x, 0, z, 0, ry, 0).multiply(m);
const sproutList = (c0, c1, k = 1) => {
  const lf = leafG(c0, c1);
  return [[cyl(0.014, 0.018, 0.12 * k, 5), M(0, 0.06 * k, 0), c0], [lf, M(0.01, 0.11 * k, 0, 0, 0, -1.0, 0.1 * k, 0.13 * k, 0.4)], [lf, M(-0.01, 0.11 * k, 0, 0, 0, 1.0, 0.1 * k, 0.13 * k, 0.4)]];
};
// Feathery frond (carrot top): a stalk with paired leaflets, base at the origin.
const frondG = (c) => G('frond' + c, () => {
  const lf = leafG(c, 0x9ae86a), L = [[tubeGeo('frond-stalk', [[0, 0, 0], [0, 0.22, 0.02], [0, 0.42, 0.08]], 0.012, { tip: 0.6, segs: 8, radial: 5 }), undefined, c]];
  for (let i = 0; i < 4; i++) { const y = 0.14 + i * 0.08, k = 1 - i * 0.18; for (const s of [-1, 1]) L.push([lf, M(0, y, 0.02 + i * 0.015, 0.3, 0, -s * 1.0, 0.07 * k, 0.11 * k, 0.4)]); }
  L.push([lf, M(0, 0.42, 0.08, 0.4, 0, 0, 0.07, 0.1, 0.4)]);
  return merge(L);
});
function cropLists(type, stage) {
  const leaves = [], produce = [], glowL = [], halos = [];
  const each = (fn) => PLOTS.forEach(([x, z, ry], i) => fn(x, z, ry, i));
  const push = (list, items, x, z, ry) => items.forEach(([g, m = new THREE.Matrix4(), c]) => list.push([g, at(x, z, ry, m), c]));
  const green = type === 'moonmelon' ? [0x3a9a8a, 0x8ae0c8] : type === 'starberry' ? [0x2e7a6a, 0x6ad0b0] : [0x4aae3a, 0x9ae86a];
  if (stage === 0) {
    each((x, z, ry) => { push(leaves, sproutList(green[0], green[1]), x, z, ry); push(leaves, sproutList(green[0], green[1], 0.75), x + 0.18, z + 0.1, ry + 1.3); push(leaves, sproutList(green[0], green[1], 0.8), x - 0.15, z - 0.14, ry + 2.4); });
    return { leaves, produce, glowL, halos, height: 0.3 };
  }
  const ripe = stage >= 2;
  if (type === 'wheat') {
    const col = ripe ? [0xc89a3a, 0xf4d070] : [0x4aa83a, 0x8ae05a], h = ripe ? 1.0 : 0.65;
    const blade = plate('point', POINT, col[0], col[1]);
    each((x, z, ry, i) => {
      for (let j = 0; j < 9; j++) {
        const a = (j / 9) * Math.PI * 2 + i, d = j ? 0.1 + (j % 3) * 0.06 : 0, lean = 0.08 + (j % 3) * 0.04;
        const px = Math.sin(a) * d, pz = Math.cos(a) * d, hh = h * (0.85 + ((j * 7) % 5) * 0.04);
        const m = M(px, 0, pz, Math.cos(a) * lean, 0, -Math.sin(a) * lean);
        push(leaves, [[cyl(0.012, 0.018, hh, 5), m.clone().multiply(M(0, hh / 2, 0)), col[0]], [blade, m.clone().multiply(M(0, hh * 0.3, 0, 0.5, a, 0, 0.06, hh * 0.45, 0.4, 'YXZ'))]], x, z, ry);
        if (ripe) push(produce, [[sph(1, 10, 8), m.clone().multiply(M(0, hh + 0.07, 0, 0, 0, 0, 0.045, 0.13, 0.045)), 0xffd860], [cyl(0.003, 0.003, 0.14, 3), m.clone().multiply(M(0, hh + 0.2, 0)), 0xffe8a0]], x, z, ry);
      }
    });
    return { leaves, produce, glowL, halos, height: h + 0.25 };
  }
  if (type === 'carrot') {
    const fr = frondG(0x5ab83a), k = ripe ? 1.15 : 0.8;
    each((x, z, ry) => {
      for (let j = 0; j < 6; j++) push(leaves, [[fr, M(0, ripe ? 0.08 : 0, 0, 0.4, (j / 6) * Math.PI * 2, 0, k, k, k, 'YXZ')]], x, z, ry);
      if (ripe) push(produce, [[cone(0.13, 0.42, 14), M(0, -0.15, 0, Math.PI), 0xff8a1e], [cap(0.13, 14, 6, 1.3), M(0, 0.06, 0, 0, 0, 0, 1, 0.42, 1), 0xff9a2e], [tor(0.12, 0.009, 4, 16), M(0, 0.03, 0, Math.PI / 2), 0xe0661a]], x, z, ry);
    });
    return { leaves, produce, glowL, halos, height: ripe ? 0.7 : 0.4 };
  }
  if (type === 'strawberry') {
    const rl = plate('round', ROUND, 0x3a9a3a, 0x7ad85a);
    const berry = G('strawberry', () => {
      const g = lathe([[0, -0.07], [0.035, -0.06], [0.06, -0.02], [0.065, 0.02], [0.05, 0.05], [0, 0.06]], 12);
      return paint(g, (c, x, y, z, i) => c.set((i % 3 === 0 && y > -0.055 && y < 0.04) ? 0xffe0a0 : 0xff2a3a));
    });
    each((x, z, ry) => {
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2;
        push(leaves, [[cyl(0.01, 0.012, 0.22, 5), M(Math.sin(a) * 0.08, 0.1, Math.cos(a) * 0.08, Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5), 0x4a9a3a]], x, z, ry);
        for (const t of [-0.5, 0, 0.5]) push(leaves, [[rl, M(Math.sin(a) * 0.17, 0.2, Math.cos(a) * 0.17, 1.15, a + t, 0, 0.11, 0.14, 0.4, 'YXZ')]], x, z, ry);
      }
      if (!ripe) push(leaves, [[sph(0.035, 8, 6), M(0.05, 0.3, 0.02), 0xffe24a], ...[0, 1, 2, 3, 4].map((i) => [plate('petal', PETAL, 0xffffff, 0xfff4f8), M(0.05, 0.3, 0.02, Math.PI / 2 - 0.3, (i / 5) * Math.PI * 2, 0, 0.06, 0.07, 0.4, 'YXZ')])], x, z, ry);
      if (ripe) for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2 + 0.6, m = M(Math.sin(a) * 0.28, 0.1, Math.cos(a) * 0.28, 0.35 * Math.cos(a), 0, -0.35 * Math.sin(a));
        push(produce, [[berry, m.clone().multiply(M(0, 0, 0, 0, 0, 0, 1.15))], ...[0, 1, 2, 3, 4].map((i) => [leafG(0x3a9a3a, 0x6ad04a), m.clone().multiply(M(0, 0.06, 0, Math.PI / 2 - 0.2, (i / 5) * Math.PI * 2, 0, 0.03, 0.05, 0.4, 'YXZ'))])], x, z, ry);
      }
    });
    return { leaves, produce, glowL, halos, height: 0.45 };
  }
  if (type === 'pumpkin' || type === 'moonmelon') {
    const melon = type === 'moonmelon', rl = plate('round', ROUND, green[0], green[1]);
    each((x, z, ry, i) => {
      push(leaves, [[tubeGeo('vine' + type, [[-0.3, 0.03, -0.2], [0, 0.05, 0.05], [0.25, 0.03, 0.3], [0.45, 0.05, 0.2]], 0.022, { tip: 0.6, segs: 14, radial: 6 }), undefined, green[0]]], x, z, ry);
      for (let j = 0; j < 5; j++) {
        const a = (j / 5) * Math.PI * 2 + 0.3, d = ripe ? 0.36 : 0.22;
        push(leaves, [[cyl(0.012, 0.015, 0.2, 5), M(Math.sin(a) * d * 0.5, 0.1, Math.cos(a) * d * 0.5, Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6), green[0]], [rl, M(Math.sin(a) * d, 0.17, Math.cos(a) * d, 1.2, a, 0, 0.22, 0.26, 0.4, 'YXZ')]], x, z, ry);
      }
      if (!ripe) push(melon ? glowL : leaves, [[cone(0.05, 0.1, 8), M(0.05, 0.28, 0.05, Math.PI), melon ? 0xbfe8ff : 0xffd23a], [sph(0.02, 6, 4), M(0.05, 0.22, 0.05), melon ? 0xffffff : 0xffb020]], x, z, ry);
      if (ripe) {
        const s = melon ? [0.26, 0.22, 0.32] : [0.3, 0.24, 0.3], g = melon ? gourdGeo(12, 0.03, 0x9ad4ff, 0xdff4ff, true) : gourdGeo(10, 0.09, 0xff9a26, 0xd0601a);
        push(produce, [[g, M(0.04, s[1] * 0.92, 0.06, 0, i, 0, ...s)], [cyl(0.03, 0.04, 0.12, 6), M(0.04, s[1] * 1.75 + 0.03, 0.06, 0.25, 0, 0.2), melon ? 0x4a8a8a : 0x6a7a2a]], x, z, ry);
        if (melon) halos.push([x + 0.04, 0.25, z + 0.06, 0.95]);
      }
    });
    return { leaves, produce, glowL, halos, height: ripe ? 0.65 : 0.4 };
  }
  // sunfruit & starberry: little round bushes
  const star = type === 'starberry';
  each((x, z, ry, i) => {
    const k = ripe ? 1 : 0.8;
    push(leaves, [[cyl(0.03, 0.045, 0.2, 6), M(0, 0.1, 0), 0x7a5a3a], ...[[0, 0.42, 0, 0.3], [0.2, 0.32, 0.08, 0.22], [-0.2, 0.32, -0.04, 0.22], [0.04, 0.3, -0.2, 0.22], [-0.04, 0.3, 0.2, 0.2]]
      .map(([px, py, pz, r], j) => [sph(1, 14, 10), M(px * k, py * k, pz * k, 0, 0, 0, r * k), j % 2 ? green[0] : green[1]])], x, z, ry);
    if (!ripe) push(leaves, [[sph(0.03, 8, 6), M(0.18, 0.42, 0.18), star ? 0xffc8f0 : 0xfff0a0], [sph(0.03, 8, 6), M(-0.2, 0.36, 0.14), star ? 0xffc8f0 : 0xfff0a0]], x, z, ry);
    if (ripe) {
      const spots = [[0.2, 0.46, 0.22], [-0.24, 0.38, 0.2], [0.3, 0.3, -0.08], [-0.06, 0.62, 0.12], [-0.26, 0.3, -0.18], [0.08, 0.4, -0.3], [0.04, 0.34, 0.34]];
      spots.forEach(([px, py, pz], j) => {
        if (star) push(glowL, [[starG(0xff2ab8, 0xffd8f6), M(px * 1.08, py, pz * 1.08, 0, Math.atan2(px, pz) + j * 0.3, j * 0.5, 0.1)]], x, z, ry);
        else push(glowL, [[sph(0.09, 12, 10), M(px * 1.05, py, pz * 1.05), 0xffc42a], [leafG(0x4aae3a, 0x9ae86a), M(px * 1.05, py + 0.075, pz * 1.05, 0.6, j, 0, 0.05, 0.08, 0.4, 'YXZ')]], x, z, ry);
      });
      halos.push([x, 0.42, z, 1.2]);
    }
  });
  return { leaves, produce, glowL, halos, height: ripe ? 0.75 : 0.55, glowColor: star ? 0xff5ad0 : 0xffd84a };
}

export function buildCrop(type, stage = 0) {
  const T = ['wheat', 'carrot', 'strawberry', 'pumpkin', 'moonmelon', 'sunfruit', 'starberry'].includes(type) ? type : 'wheat';
  const st = Math.max(0, Math.min(2, stage | 0));
  const root = new THREE.Group();
  const L = G(`croplist${T}|${st}`, () => cropLists(T, st));
  if (L.leaves.length) root.add(part(G(`crop-leaves${T}|${st}`, () => merge(L.leaves)), vc(), 0, 0, 0, { ow: 0.016 }));
  if (L.produce.length) root.add(part(G(`crop-prod${T}|${st}`, () => merge(L.produce)), T === 'moonmelon' ? vc({ emissive: 0x2a5a8a }) : vc(), 0, 0, 0, { ow: 0.02 }));
  if (L.glowL.length) root.add(part(G(`crop-glow${T}|${st}`, () => merge(L.glowL)), glowVC(), 0, 0, 0, { ow: 0.014 }));
  const hc = T === 'moonmelon' ? 0x8ad8ff : L.glowColor;
  if (hc) L.halos.forEach(([x, y, z, s]) => root.add(halo(hc, s, [x, y, z], 0.45)));
  root.userData.type = T; root.userData.stage = st;
  root.userData.height = L.height;
  return root;
}
