// Extra overworld monsters for the higher-level zones: cute field mobs, elites and boss-tier giants.
// Built on the shared toon materials and the models.js builders. Forward is +Z, feet at y=0.
import * as THREE from 'three';
import { toon, glow, mesh, outlineMaterial, critterFace, glowTexture, magicCircleTexture, getGradient } from './toon.js';
import { buildQuad } from './models.js';

export const EXTRA_MONSTER_MODELS = new Set([
  'bee', 'boar', 'sunflower', 'frog', 'croc', 'imp', 'salamander', 'yeti', 'beetle', 'wraith', 'starling', 'mimic',
  'stag', 'seraph',
  'queenbee', 'hydra', 'drake', 'colossus', 'lich', 'fenrir',
]);

// ---------------------------------------------------------------- shared helpers
const TAU = Math.PI * 2, PI = Math.PI, DS = THREE.DoubleSide;
const geo = new Map();
const G = (k, fn) => { if (!geo.has(k)) geo.set(k, fn()); return geo.get(k); };
const sph = (r, w = 16, h = 12) => G(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const cone = (r, h, s = 10) => G(`c${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const cyl = (a, b, h, s = 14, open = false) => G(`y${a}|${b}|${h}|${s}|${open}`, () => new THREE.CylinderGeometry(a, b, h, s, 1, open));
const box = (x, y, z) => G(`b${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z));
const tor = (r, t, rs = 8, ts = 24, arc = TAU) => G(`t${r}|${t}|${rs}|${ts}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
// Unit spike / crystal shard: base at the origin, tip at +Y, length 1 and radius 1 (stretch with along()).
const spike = (s = 8) => G('spk' + s, () => new THREE.ConeGeometry(1, 1, s).translate(0, 0.5, 0));
const shard = (n = 6) => G('shd' + n, () => new THREE.LatheGeometry([[0, 0], [0.8, 0.14], [1, 0.62], [0, 1]].map(([x, y]) => new THREE.Vector2(x, y)), n));
// Polyhedra with radial normals: crisp facets via faceted(), a crack-free ink hull from the smooth normals.
const gem = (kind, d = 0) => G(`gem${kind}${d}`, () => {
  const g = kind === 'ico' ? new THREE.IcosahedronGeometry(1, d) : kind === 'oct' ? new THREE.OctahedronGeometry(1, d) : new THREE.DodecahedronGeometry(1, d);
  const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  return g;
});

const mats = new Map();
const MAT = (k, fn) => { if (!mats.has(k)) mats.set(k, fn()); return mats.get(k); };
// Vertex-coloured toon: one merged mesh carries many colours (one draw call plus its outline).
const vc = (o = {}) => toon(0xffffff, { vertexColors: true, ...o });
const glowVC = () => MAT('gvc', () => new THREE.MeshBasicMaterial({ vertexColors: true }));
const glowVCDS = () => MAT('gvcds', () => new THREE.MeshBasicMaterial({ vertexColors: true, side: DS }));
const faceMat = (tex) => MAT('face' + tex.uuid, () => new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
const mapToon = (key, tex, o = {}) => MAT('mt' + key, () => new THREE.MeshToonMaterial({ map: tex, gradientMap: getGradient(), ...o }));

// Outline width is given in model units and compensated for the part's own scale (as models.js does).
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
  const mat = MAT(`halo${color}|${opacity}`, () => new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, opacity }));
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size); s.position.set(x, y, z); s.raycast = () => {};
  return s;
}
// Scale every ink outline already on a model (models.js builders keep creature-thin ink; giants want bolder lines).
function thicken(root, k) {
  root.traverse((o) => {
    if (!o.userData.isOutline) return;
    const t = o.material.userData.thick ? o.material.userData.thick.value : 0.025;
    o.material = outlineMaterial(Math.round(t * k * 1000) / 1000);
  });
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
function M(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, order = 'XYZ') {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, order)), _s.set(sx, sy, sz));
}
// A unit (+Y) part stretched from p0 to p1 with radius w.
function along(p0, p1, w, d = w) {
  _a.set(...p0); _b.set(...p1).sub(_a);
  const len = _b.length();
  _q.setFromUnitVectors(UP, _b.normalize());
  return new THREE.Matrix4().compose(_a, _q, _s.set(w, len, d));
}
const MIRROR = new THREE.Matrix4().makeScale(-1, 1, 1);
// Entries plus their mirror image across x = 0.
const sym = (L) => [...L, ...L.map(([g, m, c]) => [g, MIRROR.clone().multiply(m || new THREE.Matrix4()), c])];
const scaleAll = (L, k) => { const S = new THREE.Matrix4().makeScale(k, k, k); return L.map(([g, m, c]) => [g, S.clone().multiply(m || new THREE.Matrix4()), c]); };

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
// Tube along a smooth curve, tapering toward the end (horns, tails, necks, flames). colors(u, color) paints rings.
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
// Vertex gradient by height through any number of evenly spaced colours (mutates and returns g).
function tint(g, cols, y0, y1) {
  const p = g.attributes.position, C = cols.map((x) => new THREE.Color(x)), c = new THREE.Color(), arr = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const u = THREE.MathUtils.clamp((p.getY(i) - y0) / (y1 - y0), 0, 1) * (C.length - 1), k = Math.min(C.length - 2, Math.floor(u));
    c.copy(C[k]).lerp(C[k + 1], u - k); arr.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const tintedShard = (c0, c1, n = 6) => G(`tshd${c0}|${c1}|${n}`, () => tint(shard(n).clone(), [c0, c1], 0, 1));
const flameGeo = (cols) => G('flame' + cols.join(), () => tint(new THREE.LatheGeometry([[0, -0.5], [0.34, -0.42], [0.5, -0.12], [0.42, 0.22], [0.2, 0.6], [0, 1]].map(([x, y]) => new THREE.Vector2(x, y)), 10), cols, -0.5, 1));
const starShape = (ro, ri) => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? ri : ro, a = (i / 10) * TAU + PI / 2; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } s.closePath(); return s; };
const starGeo = (ro, ri, d, bev) => G(`star${ro}|${ri}|${d}|${bev}`, () => new THREE.ExtrudeGeometry(starShape(ro, ri), { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 3, curveSegments: 4 }).translate(0, 0, -d / 2));
const sparkleGeo = () => G('sparkle', () => { const s = new THREE.Shape(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.22 : 1, a = (i / 8) * TAU; if (i) s.lineTo(Math.sin(a) * r, Math.cos(a) * r); else s.moveTo(Math.sin(a) * r, Math.cos(a) * r); } s.closePath(); return new THREE.ShapeGeometry(s); });
// Leaf / petal in the XY plane, base at the origin and tip at +Y (length 1).
const leafGeo = () => G('leaf', () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(-0.46, 0.28, -0.36, 0.8, 0, 1); s.bezierCurveTo(0.36, 0.8, 0.46, 0.28, 0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 7 }).translate(0, 0, -0.02);
});
const petalGeo = (c0, c1) => G(`petal${c0}|${c1}`, () => {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.bezierCurveTo(-0.5, 0.2, -0.42, 0.86, 0, 1); s.bezierCurveTo(0.42, 0.86, 0.5, 0.2, 0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 7 }).translate(0, 0, -0.025);
  return tint(g, [c0, c1], 0, 1);
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

// Faces mapped onto the front of a sphere (cached geometry, unlike toon.facePatch).
const spherePatch = (r, w, top, h) => G(`sp${r}|${w}|${top}|${h}`, () => new THREE.SphereGeometry(r, 24, 16, PI / 2 - w / 2, w, top, h));
function faceOn(parent, g, tex, scale, pos) {
  const f = new THREE.Mesh(g, faceMat(tex));
  f.renderOrder = 2; f.raycast = () => {};
  if (scale) f.scale.set(...scale);
  if (pos) f.position.set(...pos);
  parent.add(f);
  return f;
}

// Self-driven motion for parts animateCreature does not know about: posed right before the carrier draws, from wall-clock
// time, so hidden models simply pause and clones (which do not copy onBeforeRender) stay still instead of driving the original.
function selfAnim(carrier, fn) {
  const t0 = Math.random() * 20;
  carrier.onBeforeRender = () => fn(performance.now() / 1000 + t0);
}
const spin = (group, carrier, speed) => selfAnim(carrier, (t) => { group.rotation.y = t * speed; });
const isDown = (body) => Math.abs(body.rotation.z) > 0.6; // animateCreature tips the body over when dead

// models.js rig helpers
const near = (a, b) => Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) < 6 && Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) < 6 && Math.abs((a & 255) - (b & 255)) < 6;
function dropColor(group, hex) {
  for (const c of [...group.children]) if (c.isMesh && c.material.color && !c.material.map && near(c.material.color.getHex(), hex)) group.remove(c);
}
// Fold each buildQuad leg's toon parts into one vertex-coloured mesh (4 legs: 16 draw calls down to 8).
function compactLegs(legs, key) {
  for (const leg of legs) {
    const list = []; let ow = 0;
    for (const c of [...leg.children]) {
      const m = c.material;
      if (!c.isMesh || !m || !m.isMeshToonMaterial || m.map || m.vertexColors || m.transparent) continue;
      c.updateMatrix();
      const o = c.children.find((k) => k.userData.isOutline);
      if (o) ow = Math.max(ow, o.material.userData.thick.value * (c.scale.x + c.scale.y + c.scale.z) / 3);
      list.push([c.geometry, c.matrix.clone(), m.color.getHex()]);
      leg.remove(c);
    }
    if (list.length) leg.add(part(G('legs' + key, () => merge(list)), vc(), 0, 0, 0, { ow: Math.round(ow * 1000) / 1000 }));
  }
}
// Raise everything on a quad body except the legs (after the legs were lengthened).
function lift(P, dy) { for (const c of P.body.children) if (!P.legs.includes(c)) c.position.y += dy; }
function rig() { const root = new THREE.Group(), body = new THREE.Group(); root.add(body); return { root, body }; }
function finish(root, parts, anim, height, scale = 1) {
  root.userData.parts = parts; root.userData.anim = anim; root.userData.height = height;
  if (scale !== 1) root.scale.setScalar(scale);
  return root;
}
// Glowing bits circling a model: one merged mesh spun by its own hook, plus optional glow sprites riding along.
function orbit(parent, key, items, { y = 0, r = 1, tilt = 0, speed = 0.6, sprite = null, spriteSize = 0.5, sprites = 0, mat = null } = {}) {
  const holder = new THREE.Group(); holder.position.y = y; holder.rotation.x = tilt; parent.add(holder);
  const ring = new THREE.Group(); holder.add(ring);
  const n = items.length, at = (i) => { const a = (i / n) * TAU; return [Math.cos(a) * r, Math.sin(i * 2.3) * r * 0.12, Math.sin(a) * r]; };
  const g = G('orbit' + key, () => merge(items.map(([ig, c, s = 1, rot = 0], i) => [ig, M(...at(i), rot, -(i / n) * TAU, rot * 0.7, s), c])));
  const m = new THREE.Mesh(g, mat || glowVC()); m.raycast = () => {}; ring.add(m);
  for (let i = 0; i < Math.min(sprites, n); i++) ring.add(halo(sprite, spriteSize, at(Math.round((i * n) / sprites)), 0.9));
  spin(ring, m, speed);
  return ring;
}

// ---------------------------------------------------------------- canvas textures
const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
const rgba = (n, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

// Striped abdomen (bees): bands measured from the tip (+Y pole of a sphere) toward the waist.
function stripeMat(base, dark, bands, trim = null) {
  const key = `st${base}|${dark}|${bands.join(';')}|${trim}`;
  return mapToon(key, canvasTex(key, 8, 256, (g, W, H) => {
    g.fillStyle = rgba(base); g.fillRect(0, 0, W, H);
    for (const [a, b] of bands) {
      g.fillStyle = rgba(dark); g.fillRect(0, a * H, W, (b - a) * H);
      if (trim !== null) { g.fillStyle = rgba(trim); g.fillRect(0, b * H, W, 5); if (a > 0) g.fillRect(0, a * H - 5, W, 5); }
    }
  }));
}
// Translucent insect wing, root at the bottom centre.
function insectWingMat(tint0) {
  return MAT('iwm' + tint0, () => new THREE.MeshBasicMaterial({
    map: canvasTex('iw' + tint0, 128, 256, (g) => {
      g.beginPath(); g.moveTo(64, 250); g.bezierCurveTo(8, 200, 2, 54, 50, 14); g.quadraticCurveTo(66, 2, 84, 16); g.bezierCurveTo(126, 62, 120, 200, 64, 250); g.closePath();
      const gr = g.createLinearGradient(0, 250, 0, 0); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, rgba(tint0, 0.55));
      g.fillStyle = gr; g.fill();
      g.lineWidth = 7; g.strokeStyle = 'rgba(40,28,52,0.9)'; g.stroke();
      g.lineWidth = 3; g.strokeStyle = 'rgba(40,28,52,0.4)'; g.lineCap = 'round';
      for (const [x, y] of [[36, 70], [70, 34], [98, 92]]) { g.beginPath(); g.moveTo(64, 244); g.quadraticCurveTo(64 + (x - 64) * 0.25, 150, x, y); g.stroke(); }
      g.beginPath(); g.moveTo(26, 150); g.quadraticCurveTo(64, 128, 106, 150); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.beginPath(); g.ellipse(46, 74, 8, 26, -0.3, 0, TAU); g.fill();
    }),
    transparent: true, side: DS, depthWrite: false,
  }));
}
const insectPlane = () => G('iwplane', () => new THREE.PlaneGeometry(1, 2).translate(0, 1, 0));
// Bat / dragon membrane: shoulder at the origin, leading edge along +X, membrane hanging toward -Y (plane 2 x 1).
const BAT = { sh: [14, 70], wr: [190, 24], tips: [[502, 14], [452, 134], [336, 216], [186, 246]], back: [14, 170] };
const batPt = ([cx, cy]) => [(cx - 14) / 256, (70 - cy) / 256, 0];
function batMat(c0, c1, bone, ink) {
  const key = `bw${c0}|${c1}|${bone}|${ink}`;
  return MAT(key, () => new THREE.MeshToonMaterial({
    map: canvasTex(key, 512, 256, (g) => {
      const { sh, wr, tips, back } = BAT;
      const path = () => {
        g.beginPath(); g.moveTo(...sh); g.lineTo(...wr); g.lineTo(...tips[0]);
        let prev = tips[0];
        for (const t of [...tips.slice(1), back]) {
          const mx = (prev[0] + t[0]) / 2, my = (prev[1] + t[1]) / 2;
          g.quadraticCurveTo(mx + (wr[0] - mx) * 0.3, my + (wr[1] - my) * 0.3, t[0], t[1]);
          prev = t;
        }
        g.closePath();
      };
      path();
      const gr = g.createRadialGradient(wr[0], wr[1], 10, wr[0], wr[1], 430); gr.addColorStop(0, rgba(c0)); gr.addColorStop(1, rgba(c1));
      g.fillStyle = gr; g.fill();
      g.lineCap = 'round'; g.lineJoin = 'round';
      const bones = [[sh, wr], ...tips.map((t) => [wr, t])];
      for (const [w, col] of [[13, ink], [6, bone]]) {
        g.strokeStyle = rgba(col); g.lineWidth = w;
        for (const [a, b] of bones) { g.beginPath(); g.moveTo(...a); g.lineTo(...b); g.stroke(); }
      }
      path(); g.strokeStyle = rgba(ink); g.lineWidth = 9; g.stroke();
      g.fillStyle = rgba(bone); g.strokeStyle = rgba(ink); g.lineWidth = 4;
      g.beginPath(); g.moveTo(wr[0] - 10, wr[1] + 4); g.lineTo(wr[0] + 4, wr[1] - 18); g.lineTo(wr[0] + 12, wr[1] + 2); g.closePath(); g.fill(); g.stroke();
    }),
    gradientMap: getGradient(), side: DS, alphaTest: 0.5,
  }));
}
const batPlane = () => G('batplane', () => new THREE.PlaneGeometry(2, 1).translate(1 - 14 / 256, 70 / 256 - 0.5, 0));
// Feathered wing (seraph): shoulder at the origin, leading edge along +X, feathers hanging toward -Y (plane 2 x 1).
function featherMat(c0, c1, ink) {
  const key = `fw${c0}|${c1}|${ink}`;
  return MAT(key, () => new THREE.MeshBasicMaterial({
    map: canvasTex(key, 512, 256, (g) => {
      const lead = (u) => [14 + u * 470, 30 - Math.sin(u * PI) * 12 + u * 14];
      const mid = '#' + new THREE.Color(c0).lerp(new THREE.Color(c1), 0.45).getHexString();
      const feather = ([x, y], ang, len, wid, cA, cB) => {
        g.save(); g.translate(x, y); g.rotate(ang);
        g.beginPath(); g.moveTo(-wid * 0.5, 0); g.quadraticCurveTo(-wid * 0.66, len * 0.62, 0, len); g.quadraticCurveTo(wid * 0.66, len * 0.62, wid * 0.5, 0); g.closePath();
        const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, cA); gr.addColorStop(1, cB);
        g.fillStyle = gr; g.fill(); g.lineWidth = 5; g.strokeStyle = rgba(ink); g.stroke();
        g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, 4); g.lineTo(0, len * 0.82); g.stroke();
        g.restore();
      };
      // long flight feathers (outer ones point down-outward), a row of coverts over them, then the arm band
      for (let i = 12; i >= 0; i--) { const u = i / 12; feather(lead(0.06 + u * 0.78), 0.12 - u * 0.82, 175 - u * 40 + Math.sin(u * PI) * 10, 50 - u * 6, mid, rgba(c1)); }
      for (let i = 9; i >= 0; i--) { const u = i / 9; feather(lead(0.04 + u * 0.8), 0.05 - u * 0.6, 92 - u * 26, 46, rgba(c0), mid); }
      g.beginPath(); g.moveTo(14, 12); g.quadraticCurveTo(250, -4, 492, 40); g.quadraticCurveTo(470, 62, 440, 58); g.quadraticCurveTo(230, 46, 14, 56); g.closePath();
      g.fillStyle = rgba(c0); g.fill(); g.lineWidth = 5; g.strokeStyle = rgba(ink); g.stroke();
    }),
    side: DS, alphaTest: 0.5,
  }));
}
const featherPlane = () => G('fwplane', () => new THREE.PlaneGeometry(2, 1).translate(1 - 14 / 256, 0.5 - 30 / 256, 0));
// Wide frog grin with blush and nostrils (mapped onto the body front).
function frogFace(lip) {
  return canvasTex('frogface' + lip, 256, 256, (g) => {
    g.lineCap = 'round'; g.strokeStyle = lip; g.lineWidth = 8;
    g.beginPath(); g.moveTo(34, 96); g.quadraticCurveTo(128, 178, 222, 96); g.stroke();
    g.fillStyle = '#ff7a9a'; g.beginPath(); g.ellipse(128, 134, 16, 9, 0, 0, PI); g.fill();
    g.fillStyle = 'rgba(255,110,140,0.6)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(128 + s * 92, 112, 20, 11, 0, 0, TAU); g.fill(); }
    g.fillStyle = lip; for (const s of [-1, 1]) { g.beginPath(); g.arc(128 + s * 14, 62, 4.5, 0, TAU); g.fill(); }
  });
}
// Big cartoon eyes with angry brows (mimic lid).
function mimicEyes(eye, ink) {
  return canvasTex('mimeyes' + eye + ink, 256, 128, (g) => {
    g.lineCap = 'round';
    for (const s of [-1, 1]) {
      const x = 128 + s * 62, y = 72;
      g.fillStyle = '#ffffff'; g.strokeStyle = ink; g.lineWidth = 7;
      g.beginPath(); g.ellipse(x, y, 32, 34, 0, 0, TAU); g.fill(); g.stroke();
      g.fillStyle = eye; g.beginPath(); g.ellipse(x - s * 5, y + 6, 18, 22, 0, 0, TAU); g.fill();
      g.fillStyle = '#1a0a0a'; g.beginPath(); g.ellipse(x - s * 5, y + 8, 9, 12, 0, 0, TAU); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - s * 5 - 6, y - 2, 6.5, 0, TAU); g.fill();
      g.strokeStyle = ink; g.lineWidth = 11;
      g.beginPath(); g.moveTo(x + s * 38, y - 46); g.lineTo(x - s * 26, y - 30); g.stroke();
    }
  });
}
// Night-sky pelt: deep blue with nebula clouds and a scatter of stars (wraps horizontally).
function galaxyMat() {
  return MAT('galaxy', () => {
    const t = canvasTex('galaxy', 512, 256, (g, W, H) => {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2e2878'); bg.addColorStop(0.5, '#201a5c'); bg.addColorStop(1, '#151040');
      g.fillStyle = bg; g.fillRect(0, 0, W, H);
      let seed = 9; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const neb = ['150,70,255', '70,120,255', '255,90,210', '120,60,220'];
      for (let i = 0; i < 22; i++) {
        const x = rnd() * W, y = rnd() * H, r = 30 + rnd() * 70, c = neb[i % 4];
        for (const dx of [-W, 0, W]) { const gr = g.createRadialGradient(x + dx, y, 0, x + dx, y, r); gr.addColorStop(0, `rgba(${c},0.32)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x + dx - r, y - r, r * 2, r * 2); }
      }
      for (let i = 0; i < 320; i++) {
        const x = rnd() * W, y = rnd() * H, big = rnd() > 0.93;
        g.fillStyle = `rgba(255,255,${200 + ((rnd() * 55) | 0)},${0.55 + rnd() * 0.45})`;
        g.beginPath(); g.arc(x, y, big ? 1.8 + rnd() * 1.4 : 0.7 + rnd() * 0.9, 0, TAU); g.fill();
        if (big) { g.fillRect(x - 6, y - 0.6, 12, 1.2); g.fillRect(x - 0.6, y - 6, 1.2, 12); }
      }
    });
    return new THREE.MeshToonMaterial({ map: t, gradientMap: getGradient(), emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.6 });
  });
}

// ---------------------------------------------------------------- Bees (bee, queenbee)
const BEE = [
  { body: 0xffcd38, dark: 0x3a2a2a, fuzz: 0xfff1c0, wing: 0xbfe6ff, tip: 0x3a2a2a, face: { mood: 'happy', eye: '#2a1408', mouth: 'smile' } },
  { body: 0xff6a3a, dark: 0x4a1218, fuzz: 0xffc46a, wing: 0xffb488, tip: 0xffd23a, glow: 0xff7a1a, face: { mood: 'angry', eye: '#5a0a0a', mouth: 'fang' } },
  { body: 0xa274f2, dark: 0x2a1a48, fuzz: 0xe2d0ff, wing: 0xd4acff, tip: 0xff6af0, glow: 0xd07aff, face: { mood: 'glow', eye: '#ff6af0', mouth: 'fang', blush: false } },
];
const BEE_BANDS = [[0, 0.13], [0.3, 0.43], [0.6, 0.72]];
const beeWingGeo = () => G('beewing', () => merge([
  [insectPlane(), M(0, 0, 0, -0.62, 0, -PI / 2 + 0.05, 0.55, 0.42, 1)],
  [insectPlane(), M(-0.02, -0.03, -0.1, -0.62, 0, -PI / 2 - 0.42, 0.42, 0.3, 1)],
]));
// Two buzzing wing pairs on hinge pivots (flap posed by the right wing's own hook).
function insectWings(body, tint0, [x, y, z], k = 1, rate = 42, amp = 0.32) {
  const mat = insectWingMat(tint0), g = beeWingGeo(), pivots = [];
  let carrier = null;
  for (const s of [1, -1]) {
    const p = new THREE.Group(); p.position.set(s * x, y, z); p.rotation.y = s * 0.45;
    const inner = new THREE.Group(); inner.scale.set(s * k, k, k); p.add(inner);
    const w = new THREE.Mesh(g, mat); w.renderOrder = 3; w.raycast = () => {}; inner.add(w);
    body.add(p); pivots.push([p, s]); carrier = carrier || w;
  }
  selfAnim(carrier, (t) => { const a = isDown(body) ? -0.3 : Math.sin(t * rate) * amp; for (const [p, s] of pivots) p.rotation.z = s * (0.35 + a); });
}
const beeLegs = (key, c, x, y, z0, step, len = 1) => {
  const leg = tubeGeo(key, [[0, 0, 0], [0.08 * len, -0.1 * len, 0.03], [0.11 * len, -0.24 * len, 0.07]], 0.032 * len, { tip: 0.7, segs: 8, radial: 6 });
  const L = [];
  for (let j = 0; j < 3; j++) {
    L.push([leg, M(x, y, z0 - j * step, 0, (j - 1) * 0.4, 0), c]);
    L.push([sph(1, 8, 6), M(x + 0.11 * len, y - 0.25 * len, z0 - j * step + 0.07, 0, 0, 0, 0.045 * len), c]);
  }
  return sym(L);
};
function bee(v) {
  const C = BEE[v], key = 'bee' + v, { root, body } = rig();
  const ax = -PI / 2 - 0.42, dir = [0, Math.cos(ax), Math.sin(ax)];
  body.add(part(sph(0.5, 22, 18), stripeMat(C.body, C.dark, BEE_BANDS), 0, 0.68, -0.4, { s: [0.9, 1.12, 0.9], r: [ax, 0, 0], ow: 0.03 }));
  const thorax = G(key + 'th', () => {
    const L = [[sph(1, 16, 12), M(0, 0.8, -0.04, 0, 0, 0, 0.32, 0.3, 0.32), C.body]];
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU; L.push([sph(1, 10, 8), M(Math.sin(a) * 0.27, 0.92 + Math.cos(a) * 0.03, -0.03 + Math.cos(a) * 0.19, 0, 0, 0, 0.11), C.fuzz]); }
    L.push(...beeLegs('beeleg', C.dark, 0.12, 0.66, 0.12, 0.13));
    const tip = [0, 0.68 + dir[1] * 0.64, -0.4 + dir[2] * 0.64];
    L.push([cone(0.075, 0.22, 8), M(tip[0], tip[1], tip[2], ax), C.tip]);
    return merge(L);
  });
  body.add(part(thorax, vc(), 0, 0, 0, { ow: 0.025 }));
  const hg = new THREE.Group(); hg.position.set(0, 1.16, 0.2); body.add(hg);
  const head = G(key + 'hd', () => {
    const ant = tubeGeo('beeant', [[0.1, 0.32, 0.04], [0.15, 0.5, 0.1], [0.24, 0.62, 0.18], [0.33, 0.62, 0.25]], 0.026, { tip: 0.8, segs: 10, radial: 5 });
    return merge([[sph(0.42, 22, 16), undefined, C.body], ...sym([[ant, undefined, C.dark], [sph(0.075, 10, 8), M(0.34, 0.62, 0.26), C.dark]])]);
  });
  hg.add(part(head, vc(), 0, 0, 0, { ow: 0.03 }));
  faceOn(hg, spherePatch(0.424, 1.7, 1.0, 1.05), critterFace(C.face));
  insectWings(body, C.wing, [0.13, 1.02, -0.2], 1);
  if (C.glow) {
    body.add(halo(C.glow, 0.7, [0, 0.68 + dir[1] * 0.72, -0.4 + dir[2] * 0.72], 0.85));
    body.add(halo(C.glow, 2.4, [0, 0.95, -0.05], 0.22));
  }
  return finish(root, { body, head: hg }, 'float', 1.6);
}

// Queen bee boss: built at bee scale with royal trimmings, then scaled up uniformly.
function queenBee() {
  const key = 'queen', { root, body } = rig();
  const gold = 0xffc43a, deep = 0x3a2010, cream = 0xfff4dc, royal = 0x7a2ab0;
  const ax = -PI / 2 - 0.45, dir = [0, Math.cos(ax), Math.sin(ax)];
  body.add(part(sph(0.55, 26, 20), stripeMat(gold, deep, [[0, 0.1], [0.24, 0.34], [0.46, 0.56], [0.68, 0.76]], 0xfff0b0), 0, 0.62, -0.5, { s: [1, 1.32, 1], r: [ax, 0, 0], ow: 0.03 }));
  const tipAt = (d) => [0, 0.62 + dir[1] * d, -0.5 + dir[2] * d];
  const thorax = G(key + 'th', () => {
    const L = [[sph(1, 18, 14), M(0, 0.86, -0.02, 0, 0, 0, 0.34, 0.32, 0.34), gold]];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; L.push([sph(1, 10, 8), M(Math.sin(a) * 0.32, 1.0 + Math.cos(a) * 0.05, Math.cos(a) * 0.24, 0, 0, 0, 0.12), cream]); }
    for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + 0.3; L.push([sph(1, 10, 8), M(Math.sin(a) * 0.4, 0.94 + Math.cos(a) * 0.05, -0.02 + Math.cos(a) * 0.3, 0, 0, 0, 0.1, 0.07, 0.1), royal]); }
    L.push(...beeLegs('qleg', deep, 0.13, 0.7, 0.08, 0.14, 1.1));
    const arm = tubeGeo('qarm', [[0.26, 0.96, 0.1], [0.38, 0.86, 0.24], [0.38, 0.95, 0.4]], 0.045, { tip: 0.8, segs: 8, radial: 6 });
    const arm2 = tubeGeo('qarm2', [[-0.26, 0.96, 0.08], [-0.42, 0.82, 0.12], [-0.3, 0.74, 0.18]], 0.045, { tip: 0.8, segs: 8, radial: 6 });
    L.push([arm, undefined, deep], [arm2, undefined, deep], [sph(1, 10, 8), M(0.38, 0.97, 0.42, 0, 0, 0, 0.065), cream], [sph(1, 10, 8), M(-0.29, 0.73, 0.19, 0, 0, 0, 0.065), cream]);
    // honey-dipper sceptre
    const sc = [[0.38, 0.8, 0.4], [0.4, 1.62, 0.52]];
    L.push([cyl(1, 1, 1, 8), along(sc[0], sc[1], 0.025), gold]);
    for (let i = 0; i < 4; i++) L.push([tor(0.075 - Math.abs(i - 1.5) * 0.015, 0.025, 6, 16), M(0.4, 1.42 + i * 0.07, 0.5, PI / 2 - 0.15), 0xffe07a]);
    L.push([cone(0.075, 0.24, 8), M(...tipAt(0.78), ax), gold]);
    return merge(L);
  });
  body.add(part(thorax, vc(), 0, 0, 0, { ow: 0.025 }));
  const hg = new THREE.Group(); hg.position.set(0, 1.3, 0.2); body.add(hg);
  const head = G(key + 'hd', () => {
    const ant = tubeGeo('qant', [[0.1, 0.34, 0.02], [0.18, 0.56, 0.06], [0.32, 0.66, 0.12], [0.4, 0.58, 0.18]], 0.026, { tip: 0.8, segs: 10, radial: 5 });
    const L = [[sph(0.44, 24, 18), undefined, gold], ...sym([[ant, undefined, deep]])];
    // crown: gold band, five points tipped with pearls
    L.push([cyl(0.27, 0.24, 0.16, 18, true), M(0, 0.44, -0.02, -0.12), gold], [tor(0.25, 0.03, 6, 20), M(0, 0.37, -0.01, PI / 2 - 0.12), 0xd8962a]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU, x = Math.sin(a) * 0.26, z = Math.cos(a) * 0.26 - 0.02, h = i === 0 ? 0.24 : 0.18;
      L.push([cone(0.06, h, 6), M(x, 0.52 + h / 2 + z * 0.06, z, -0.12 + Math.cos(a) * 0.15, 0, -Math.sin(a) * 0.15), gold], [sph(0.035, 8, 6), M(x * 1.04, 0.52 + h + z * 0.06, z * 1.04), cream]);
    }
    return merge(L);
  });
  hg.add(part(head, vc({ side: DS }), 0, 0, 0, { ow: 0.028 }));
  faceOn(hg, spherePatch(0.444, 1.7, 1.0, 1.05), critterFace({ mood: 'angry', eye: '#5a1a08', mouth: 'fang' }));
  const jewels = G(key + 'jw', () => merge([
    [gem('oct'), M(0, 0.47, 0.25, -0.2, 0, 0, 0.06, 0.08, 0.04), 0xff3a7a],
    ...sym([[gem('oct'), M(0.41, 0.58, 0.19, 0, 0, 0, 0.06), 0xff5aa8]]),
  ]));
  hg.add(part(jewels, glowVC()));
  hg.add(halo(0xff7ab0, 0.5, [0, 0.47, 0.27], 0.8));
  const honey = new THREE.Mesh(sph(0.11, 14, 10), glow(0xffb020)); honey.position.set(0.4, 1.62, 0.52); body.add(honey);
  body.add(halo(0xffc040, 0.9, [0.4, 1.62, 0.52], 0.9));
  body.add(halo(0xffd060, 0.6, tipAt(0.9), 0.9));
  insectWings(body, 0xffe8a0, [0.15, 1.08, -0.24], 1.45, 34, 0.26);
  orbit(body, key, [0, 1, 2, 3].map(() => [flameGeo([0xff9a10, 0xffc030, 0xfff0a0]), undefined, 0.09, PI]), { y: 0.85, r: 1.05, tilt: 0.15, speed: 0.5, sprite: 0xffb030, spriteSize: 0.32, sprites: 4 });
  body.add(halo(0xffd060, 4.2, [0, 0.95, -0.1], 0.18));
  thicken(root, 1.1);
  return finish(root, { body, head: hg }, 'float', 6, 3.7);
}

// ---------------------------------------------------------------- Boar
const BOAR = [
  { body: 0x9a6440, belly: 0xd8b088, legs: 0x6e4630, hoof: 0x3a2a2a, mane: 0x4e2e1e, snout: 0xf4a8a0, tusk: 0xfff4e0, face: { mood: 'angry', eye: '#2a1408', mouth: 'none', blush: true } },
  { body: 0x3e2e52, belly: 0x6a4a82, legs: 0x2a1e3a, hoof: 0x1a1224, mane: 0xc07aff, snout: 0x8a6aa8, tusk: 0xe8d8ff, glow: 0xc07aff, face: { mood: 'glow', eye: '#ff5ad8', mouth: 'none', blush: false } },
  { body: 0xf2f6fc, belly: 0xffffff, legs: 0xd4e0f0, hoof: 0x7a98c0, mane: 0xa8d8ff, snout: 0xc8e0f8, tusk: 0xbfeaff, face: { mood: 'angry', eye: '#2a4a8a', mouth: 'none', blush: true } },
];
function boar(v) {
  const C = BOAR[v], sz = 0.9, S = (x) => x * sz, key = 'boar' + v;
  const r = buildQuad({ body: C.body, belly: C.belly, legs: C.legs, hoof: C.hoof, ear: C.body, snout: false, neck: false, tail: false, face: C.face, size: sz });
  const P = r.userData.parts, body = P.body, head = P.head;
  const [torso, belly] = body.children;
  torso.scale.set(1.2, 1.0, 1.12); belly.scale.set(1.05, 0.9, 1.35);
  head.position.set(0, S(1.04), S(0.84)); head.scale.set(1.08, 1, 1.08);
  dropColor(head, 0x2a1a1a);
  const muzzle = G(key + 'mz', () => {
    const tusk = tubeGeo('boartusk', [[0.11, -0.17, 0.4], [0.18, -0.13, 0.48], [0.21, -0.01, 0.5], [0.17, 0.08, 0.46]].map((p) => p.map(S)), S(0.04), { tip: 0.15, segs: 10, radial: 6 });
    return merge([
      [cyl(S(0.16), S(0.2), S(0.28), 14), M(0, S(-0.11), S(0.36), PI / 2), C.body],
      [cyl(S(0.17), S(0.17), S(0.06), 16), M(0, S(-0.11), S(0.51), PI / 2), C.snout],
      ...sym([[sph(S(0.034), 8, 6), M(S(0.055), S(-0.11), S(0.54)), 0x3a1a1a], [tusk, undefined, C.tusk]]),
      [sph(S(0.2), 12, 8), M(0, S(0.27), S(-0.02), -0.3, 0, 0, 0.5, 0.9, 1.2), C.mane],
    ]);
  });
  head.add(part(muzzle, vc(), 0, 0, 0, { ow: 0.022 }));
  const mane = G(key + 'mn', () => merge(Array.from({ length: 8 }, (_, i) => {
    const z = 0.64 - i * 0.17, h = 0.2 + Math.sin(((i + 1) / 9) * PI) * 0.14;
    return [spike(6), M(0, S(1.24 + Math.sin(((i + 1) / 9) * PI) * 0.05), S(z), -0.55, 0, 0, S(0.075), S(h), S(0.075)), C.mane];
  })));
  body.add(C.glow ? part(mane, glowVC()) : part(mane, vc(), 0, 0, 0, { ow: 0.02 }));
  const tail = G(key + 'tl', () => merge([
    [tubeGeo('boartail', [[0, 0, 0], [0, -0.08, -0.12], [0.03, -0.24, -0.16]].map((p) => p.map(S)), S(0.035), { tip: 0.7, segs: 8, radial: 6 }), undefined, C.legs],
    [sph(1, 10, 8), M(S(0.03), S(-0.28), S(-0.17), 0, 0, 0, S(0.06), S(0.09), S(0.06)), C.mane],
  ]));
  P.tail.add(part(tail, vc(), 0, 0, 0, { ow: 0.015 }));
  compactLegs(P.legs, key);
  if (C.glow) { head.add(halo(C.glow, 1.1, [0, 0, S(0.3)], 0.4)); body.add(halo(C.glow, 1.2, [0, S(1.4), 0], 0.3)); }
  r.userData.height = 1.7;
  return r;
}

// ---------------------------------------------------------------- Sunflower sprite
const SUN = [
  { p0: 0xffa81a, p1: 0xffe45a, disk: 0x7a4422, face: 0xc8843a, stem: 0x4aa83a, leaf: 0x6ad04a, boot: 0x8a5a2a, eye: '#2a1206' },
  { p0: 0xffcf5a, p1: 0xfffbea, disk: 0xf2c260, face: 0xfff0c4, stem: 0x7ad8a8, leaf: 0xb0f0c8, boot: 0xe0b860, eye: '#c87a10', em: 0x6a5420, glow: 0xfff0a0 },
];
function sunflower(v) {
  const C = SUN[v], key = 'sun' + v, { root, body } = rig();
  const low = G(key + 'low', () => {
    const L = [
      [sph(1, 18, 14), M(0, 0.4, 0, 0, 0, 0, 0.27, 0.33, 0.24), C.stem],
      [tubeGeo('sunstem', [[0, 0.6, 0], [0.02, 0.85, 0.02], [0, 1.12, 0.0]], 0.085, { tip: 0.8, segs: 8, radial: 8 }), undefined, C.stem],
      ...sym([
        [sph(1, 14, 10), M(0.14, 0.08, 0.06, 0, 0, 0, 0.14, 0.1, 0.2), C.boot],
        [leafGeo(), M(0.2, 0.55, 0.04, 0.25, 0, -1.15, 0.3, 0.44, 0.3), C.leaf],
        [leafGeo(), M(0.12, 0.2, -0.06, -0.3, 0.6, -1.9, 0.24, 0.32, 0.24), C.leaf],
      ]),
      [leafGeo(), M(0, 0.18, 0.16, 1.5, 0, 0, 0.26, 0.3, 0.26), C.leaf],
    ];
    return merge(L);
  });
  body.add(part(low, vc(), 0, 0, 0, { ow: 0.022 }));
  const hg = new THREE.Group(); hg.position.set(0, 1.38, 0.02); hg.rotation.x = -0.14; body.add(hg);
  const disk = G(key + 'dk', () => merge([
    [sph(1, 20, 14), M(0, 0, -0.02, 0, 0, 0, 0.36, 0.36, 0.15), C.disk],
    [sph(1, 20, 14), M(0, 0, 0.02, 0, 0, 0, 0.29, 0.29, 0.14), C.face],
    ...Array.from({ length: 8 }, (_, i) => [leafGeo(), M(-Math.sin((i / 8) * TAU) * 0.2, Math.cos((i / 8) * TAU) * 0.2, -0.12, -0.5, 0, (i / 8) * TAU, 0.14, 0.24, 0.14, 'ZYX'), C.stem]),
  ]));
  hg.add(part(disk, vc(), 0, 0, 0, { ow: 0.022 }));
  faceOn(hg, spherePatch(1.01, 1.65, 0.85, 1.4), critterFace({ mood: 'happy', eye: C.eye, mouth: 'smile' }), [0.29, 0.29, 0.14], [0, 0, 0.02]);
  const petals = G(key + 'pt', () => {
    const L = [];
    for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; L.push([petalGeo(C.p0, C.p1), M(-Math.sin(a) * 0.27, Math.cos(a) * 0.27, -0.04, 0.12, 0, a, 0.24, 0.4, 0.24, 'ZYX')]); }
    for (let i = 0; i < 14; i++) { const a = ((i + 0.5) / 14) * TAU; L.push([petalGeo(C.p0, C.p1), M(-Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.0, 0.35, 0, a, 0.2, 0.32, 0.2, 'ZYX')]); }
    return merge(L);
  });
  hg.add(part(petals, vc(C.em ? { emissive: C.em } : {}), 0, 0, 0, { ow: 0.018 }));
  if (C.glow) {
    hg.add(halo(C.glow, 2.2, [0, 0, -0.1], 0.5));
    orbit(body, key, [0, 1, 2].map(() => [sparkleGeo(), 0xfff6c0, 0.09]), { y: 1.1, r: 0.75, tilt: 0.2, speed: 0.9, sprite: 0xffe07a, spriteSize: 0.3, sprites: 3, mat: glowVCDS() });
  }
  return finish(root, { body, head: hg }, 'waddle', 1.9);
}

// ---------------------------------------------------------------- Bog frog
const FROG = [
  { body: 0x6cc84a, belly: 0xf2f0b0, spot: 0x4aa83a, lip: '#3a1a10', hat: true },
  { body: 0x9a5ae8, belly: 0xf0d8ff, spot: 0xffd23a, lip: '#2a0a3a' },
  { body: 0x8cd8ff, belly: 0xf6fcff, spot: 0xffffff, lip: '#1a3a6a', ice: 0xbff4ff },
];
function frog(v) {
  const C = FROG[v], key = 'frog' + v, { root, body } = rig();
  const bd = G(key + 'bd', () => {
    const L = [
      [sph(1, 22, 16), M(0, 0.5, 0, 0, 0, 0, 0.64, 0.48, 0.56), C.body],
      [sph(1, 16, 12), M(0, 0.4, 0.18, 0, 0, 0, 0.5, 0.36, 0.42), C.belly],
      ...sym([
        [sph(1, 14, 10), M(0.46, 0.26, -0.14, 0, 0, 0.3, 0.22, 0.24, 0.32), C.body],
        [sph(1, 12, 8), M(0.54, 0.05, 0.12, 0, 0.35, 0, 0.17, 0.05, 0.28), C.body],
        [sph(1, 8, 6), M(0.5, 0.05, 0.4, 0, 0, 0, 0.06), C.body], [sph(1, 8, 6), M(0.64, 0.05, 0.36, 0, 0, 0, 0.06), C.body],
        [tubeGeo('frogarm', [[0.28, 0.34, 0.34], [0.32, 0.16, 0.44], [0.33, 0.06, 0.48]], 0.065, { tip: 0.8, segs: 8, radial: 6 }), undefined, C.body],
        [sph(1, 10, 8), M(0.34, 0.04, 0.52, 0, 0, 0, 0.11, 0.045, 0.12), C.body],
      ]),
    ];
    for (const [x, y, z, s] of [[0.24, 0.84, -0.18, 0.09], [-0.22, 0.86, -0.06, 0.08], [0.04, 0.9, -0.3, 0.07], [-0.4, 0.68, -0.28, 0.08], [0.42, 0.68, -0.04, 0.07], [-0.08, 0.72, -0.46, 0.08]]) L.push([sph(1, 10, 8), M(x, y, z, 0, 0, 0, s), C.spot]);
    return merge(L);
  });
  body.add(part(bd, vc(), 0, 0, 0, { ow: 0.028 }));
  faceOn(body, spherePatch(1.008, 1.9, 0.8, 0.95), frogFace(C.lip), [0.64, 0.48, 0.56], [0, 0.5, 0]);
  const hg = new THREE.Group(); hg.position.set(0, 0.84, 0.1); body.add(hg);
  const eyes = G(key + 'ey', () => {
    const L = sym([
      [sph(1, 16, 12), M(0.25, 0.12, 0.04, 0, 0, 0, 0.21), C.body],
      [sph(1, 16, 12), M(0.26, 0.16, 0.14, 0, 0, 0, 0.16), 0xffffff],
      [sph(1, 14, 10), M(0.26, 0.17, 0.27, 0, 0, 0, 0.1, 0.11, 0.05), 0x1a1020],
      [sph(1, 8, 6), M(0.23, 0.21, 0.31, 0, 0, 0, 0.035), 0xffffff],
    ]);
    if (C.hat) {
      const pad = new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20, 1, false, 0.5, TAU - 0.6);
      L.push([pad, M(0, 0.24, -0.08, 0.15, 0, 0), 0x4a9a3a]);
      for (let i = 0; i < 6; i++) L.push([petalGeo(0xff8ab8, 0xffe0ee), M(0.02, 0.26, -0.06, -0.55, (i / 6) * TAU, 0, 0.09, 0.12, 0.09, 'YXZ')]);
      L.push([sph(0.03, 8, 6), M(0.02, 0.29, -0.06), 0xffe27a]);
    }
    if (C.ice) for (const [x, z, rz] of [[0, -0.1, 0], [0.09, -0.06, -0.4], [-0.08, -0.14, 0.45]]) L.push([tintedShard(0x8ad0ff, C.ice), M(x, 0.18, z, -0.2, 0, rz, 0.05, 0.22, 0.05)]);
    return merge(L);
  });
  hg.add(part(eyes, vc(C.ice ? { emissive: 0x1a3a5a } : {}), 0, 0, 0, { ow: 0.022 }));
  return finish(root, { body, head: hg }, 'hop', 1.4);
}

// ---------------------------------------------------------------- Mire crocodile & fire salamander (low quads)
const CROC = [
  { body: 0x5e9a3e, belly: 0xe2e2a2, legs: 0x4e8834, hoof: 0x3e6e2a, scute: 0x3e6e2a, mouth: 0xff8a9a, teeth: 0xffffff, face: { mood: 'happy', eye: '#2a1a0a', mouth: 'none', blush: true, eyeSize: 1.25 } },
  { body: 0xe8e0d0, belly: 0xb8a8c8, legs: 0xd0c8bc, hoof: 0x6a5a7a, scute: 0xb04aff, mouth: 0x4a1a5a, teeth: 0xffffff, glow: 0xc07aff, face: { mood: 'glow', eye: '#b04aff', mouth: 'none', blush: false } },
];
function croc(v) {
  const C = CROC[v], sz = 0.8, S = (x) => x * sz, key = 'croc' + v;
  const r = buildQuad({ body: C.body, belly: C.belly, legs: C.legs, hoof: C.hoof, ears: false, neck: false, snout: false, tail: false, face: C.face, size: sz });
  const P = r.userData.parts, body = P.body, head = P.head;
  const [torso, belly] = body.children;
  torso.position.y = S(0.5); torso.scale.set(1.25, 1.6, 0.74);
  belly.position.set(0, S(0.42), S(0.1)); belly.scale.set(1.3, 0.6, 2.7);
  P.legs.forEach((l, i) => { const s = i % 2 ? -1 : 1; l.position.set(s * S(0.46), S(0.42), i < 2 ? S(0.66) : S(-0.66)); l.scale.set(1.15, 0.6, 1.15); l.rotation.z = s * 0.35; });
  head.position.set(0, S(0.66), S(1.38)); head.scale.set(1.38, 1.12, 1.3);
  dropColor(head, 0x2a1a1a);
  const jaw = G(key + 'jw', () => {
    const L = [
      [sph(1, 18, 12), M(0, S(-0.02), S(0.5), 0, 0, 0, S(0.27), S(0.12), S(0.48)), C.body],
      [sph(1, 16, 10), M(0, S(-0.17), S(0.43), 0.12, 0, 0, S(0.24), S(0.08), S(0.42)), C.belly],
      [sph(1, 14, 10), M(0, S(-0.1), S(0.42), 0.05, 0, 0, S(0.22), S(0.05), S(0.38)), C.mouth],
      ...sym([[sph(1, 8, 6), M(S(0.08), S(0.08), S(0.88), 0, 0, 0, S(0.05)), C.body]]),
    ];
    for (let i = 0; i < 6; i++) {
      const z = 0.2 + i * 0.12, x = 0.25 * Math.sqrt(Math.max(0, 1 - ((z - 0.5) / 0.48) ** 2));
      L.push(...sym([[cone(1, 1, 5), M(S(x), S(-0.11), S(z), PI, 0, 0, S(0.026), S(0.075), S(0.026)), C.teeth]]));
    }
    return merge(L);
  });
  head.add(part(jaw, vc(), 0, 0, 0, { ow: 0.02 }));
  P.tail.position.set(0, S(0.48), S(-1.15));
  const tail = G(key + 'tl', () => {
    const pts = [[0, 0, 0], [0, -0.03, -0.55], [0.05, -0.12, -1.05], [0, -0.24, -1.5]].map((p) => p.map(S));
    const L = [[tubeGeo('croctail', pts, S(0.26), { tip: 0.12, segs: 16, radial: 10 }), M(0, 0, 0, 0, 0, 0, 0.8, 1, 1), C.body]];
    const crv = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), q = new THREE.Vector3();
    for (let i = 1; i < 7; i++) { const u = i / 8; crv.getPointAt(u, q); L.push([cone(1, 1, 4), M(q.x * 0.8, q.y + S(0.26) * (1 - 0.88 * u), q.z, 0, PI / 4, 0, S(0.05), S(0.12 * (1 - u * 0.5)), S(0.05)), C.scute]); }
    return merge(L);
  });
  P.tail.add(part(tail, vc(), 0, 0, 0, { ow: 0.02 }));
  const scutes = G(key + 'sc', () => merge(sym(Array.from({ length: 8 }, (_, i) => [cone(1, 1, 4), M(S(0.13), S(0.76), S(0.9 - i * 0.26), 0, PI / 4, 0, S(0.055), S(0.12), S(0.07)), C.scute]))));
  body.add(C.glow ? part(scutes, glowVC()) : part(scutes, vc(), 0, 0, 0, { ow: 0.015 }));
  compactLegs(P.legs, key);
  if (C.glow) { head.add(halo(C.glow, 1.0, [0, S(0.15), S(0.2)], 0.45)); body.add(halo(C.glow, 1.6, [0, S(0.85), 0], 0.25)); }
  r.userData.height = 1.3;
  return r;
}

const SALA = [
  { body: 0xe0582a, belly: 0xffc860, legs: 0xc84a22, hoof: 0x7a2412, spike: [0xff4a10, 0xffa020, 0xfff0a0], spot: 0x8a2a14, eye: '#3a1004', glow: 0xff8a2a },
  { body: 0x6a8ae0, belly: 0xd8e4ff, legs: 0x5a78d0, hoof: 0x3a4a9a, crystal: [0x6ad8ff, 0xf0ffff], em: 0x1a4a8a, spot: 0x3a5ab8, eye: '#1a1a4a', glow: 0x8af0ff },
];
function salamander(v) {
  const C = SALA[v], sz = 0.72, S = (x) => x * sz, key = 'sala' + v;
  const r = buildQuad({ body: C.body, belly: C.belly, legs: C.legs, hoof: C.hoof, ears: false, neck: false, tail: false, snout: C.belly, face: { mood: 'happy', eye: C.eye, mouth: 'smile', blush: true, eyeSize: 1.3 }, size: sz });
  const P = r.userData.parts, body = P.body, head = P.head;
  const [torso, belly] = body.children;
  torso.position.y = S(0.62); torso.scale.set(1.02, 1.3, 0.82);
  belly.position.set(0, S(0.52), S(0.16)); belly.scale.set(1.0, 0.7, 2.0);
  P.legs.forEach((l, i) => { const s = i % 2 ? -1 : 1; l.position.set(s * S(0.36), S(0.52), i < 2 ? S(0.5) : S(-0.5)); l.scale.set(1.05, 0.75, 1.05); l.rotation.z = s * 0.3; });
  head.position.set(0, S(0.86), S(1.1)); head.scale.set(1.34, 1.0, 1.22);
  dropColor(head, 0x2a1a1a);
  for (const c of head.children) if (c.isMesh && c.material.color && near(c.material.color.getHex(), C.belly)) { c.position.set(0, S(-0.14), S(0.14)); c.scale.set(1.35, 0.5, 0.92); }
  P.tail.position.set(0, S(0.62), S(-0.95));
  const tailPts = [[0, 0, 0], [0, -0.1, -0.5], [0.1, -0.25, -0.95], [0.05, -0.2, -1.35]].map((p) => p.map(S));
  P.tail.add(part(G(key + 'tl', () => merge([[tubeGeo('salatail', tailPts, S(0.2), { tip: 0.15, segs: 14, radial: 8 }), undefined, C.body]])), vc(), 0, 0, 0, { ow: 0.02 }));
  const tipP = tailPts[3];
  const spots = G(key + 'sp', () => merge(sym([[0.18, 0.86, 0.3, 0.07], [0.22, 0.82, -0.2, 0.08], [0.1, 0.9, -0.55, 0.06]].map(([x, y, z, s]) => [sph(1, 10, 8), M(S(x), S(y), S(z), 0, 0, 0, S(s), S(s * 0.5), S(s)), C.spot]))));
  body.add(part(spots, vc(), 0, 0, 0, { ow: 0 }));
  const spineAt = Array.from({ length: 6 }, (_, i) => [0, S(0.9 - Math.abs(i - 2) * 0.012), S(0.62 - i * 0.26), 0.13 + Math.sin(((i + 1) / 7) * PI) * 0.12]);
  if (C.crystal) {
    const cr = G(key + 'cr', () => merge([...spineAt.map(([x, y, z, h]) => [tintedShard(...C.crystal), M(x, y - S(0.05), z, -0.35, 0, 0, S(0.07), S(h * 1.6), S(0.07))]),
      [tintedShard(...C.crystal), M(tipP[0], tipP[1], tipP[2] - S(0.04), -1.9, 0, 0, S(0.07), S(0.3), S(0.07))]]));
    body.add(faceted(cr, vc({ emissive: C.em }), 0.02));
  } else {
    const fl = G(key + 'fl', () => merge(spineAt.map(([x, y, z, h]) => [flameGeo(C.spike), M(x, y + S(h * 0.4), z, -0.3, 0, 0, S(h * 0.55), S(h * 0.9), S(h * 0.55))])));
    body.add(part(fl, glowVC()));
    const tf = new THREE.Mesh(flameGeo(C.spike), glowVC()); tf.position.set(tipP[0], tipP[1] + S(0.08), tipP[2]); tf.scale.setScalar(S(0.26)); P.tail.add(tf);
    selfAnim(tf, (t) => { const k = 1 + Math.sin(t * 13) * 0.12; tf.scale.set(S(0.26) / k, S(0.26) * k, S(0.26) / k); });
  }
  P.tail.add(halo(C.glow, 0.6, [tipP[0], tipP[1] + S(0.08), tipP[2]], 0.9));
  body.add(halo(C.glow, 1.4, [0, S(1.0), S(0.0)], 0.3));
  compactLegs(P.legs, key);
  r.userData.height = 1.4;
  return r;
}

// ---------------------------------------------------------------- Fire imp
const IMP = [
  { skin: 0xff5a4a, belly: 0xffc8a8, horn: 0xfff0d0, wing0: 0x6a1020, wing1: 0xff7a5a, ink: 0x2a0a10, flame: [0xff3a10, 0xffa020, 0xfff2a0], eye: '#3a0606', mood: 'happy', fork: 0x3a2a3a, prong: 0xffd23a, glow: 0xff8a2a },
  { skin: 0x7a50d0, belly: 0xd0b8ff, horn: 0x2a1a40, wing0: 0x1e1036, wing1: 0x9a6ae8, ink: 0x0e0618, flame: [0x6a1ac8, 0xc07aff, 0xffe0ff], eye: '#ffd84a', mood: 'glow', fork: 0x1a1028, prong: 0xc07aff, glow: 0xb07aff },
  { skin: 0x6ab8f0, belly: 0xe4f6ff, horn: 0xffffff, wing0: 0x2a5a9a, wing1: 0xb0ecff, ink: 0x10203a, flame: [0x2a98ff, 0x9af0ff, 0xffffff], eye: '#1a2a5a', mood: 'happy', fork: 0x2a3a5a, prong: 0xbff4ff, glow: 0x8af0ff },
];
function imp(v) {
  const C = IMP[v], key = 'imp' + v, { root, body } = rig();
  const tailPts = [[0, 0.42, -0.2], [0.02, 0.26, -0.42], [0.08, 0.36, -0.66], [0.12, 0.62, -0.74]];
  const bd = G(key + 'bd', () => merge([
    [sph(1, 16, 12), M(0, 0.56, 0, 0, 0, 0, 0.26, 0.28, 0.24), C.skin],
    [sph(1, 14, 10), M(0, 0.52, 0.09, 0, 0, 0, 0.19, 0.2, 0.17), C.belly],
    ...sym([
      [tubeGeo('implegs', [[0.12, 0.4, 0], [0.15, 0.22, 0.04], [0.15, 0.1, 0.1]], 0.07, { tip: 0.75, segs: 8, radial: 6 }), undefined, C.skin],
      [cone(1, 1, 6), M(0.15, 0.08, 0.16, PI / 2 + 0.3, 0, 0, 0.06, 0.16, 0.06), C.horn],
    ]),
    [tubeGeo('imparmR', [[0.22, 0.66, 0], [0.34, 0.52, 0.1], [0.36, 0.5, 0.26]], 0.06, { tip: 0.8, segs: 8, radial: 6 }), undefined, C.skin],
    [tubeGeo('imparmL', [[-0.22, 0.66, 0], [-0.36, 0.56, 0.06], [-0.42, 0.66, 0.16]], 0.06, { tip: 0.8, segs: 8, radial: 6 }), undefined, C.skin],
    [sph(1, 10, 8), M(0.36, 0.5, 0.28, 0, 0, 0, 0.075), C.skin], [sph(1, 10, 8), M(-0.43, 0.68, 0.18, 0, 0, 0, 0.075), C.skin],
    [tubeGeo('imptail', tailPts, 0.04, { tip: 0.7, segs: 14, radial: 6 }), undefined, C.skin],
    // little trident
    [cyl(1, 1, 1, 6), along([0.36, 0.18, 0.3], [0.36, 1.12, 0.3], 0.022), C.fork],
    [box(0.24, 0.035, 0.035), M(0.36, 1.08, 0.3), C.prong],
    ...[-0.11, 0, 0.11].map((dx) => [cone(0.03, dx ? 0.14 : 0.18, 5), M(0.36 + dx, 1.08 + (dx ? 0.08 : 0.1), 0.3), C.prong]),
  ]));
  body.add(part(bd, vc(), 0, 0, 0, { ow: 0.022 }));
  const hd = G(key + 'hd', () => {
    const horn = tubeGeo('imphorn', [[0.16, 0.3, 0], [0.24, 0.44, 0.0], [0.26, 0.6, -0.04], [0.2, 0.7, -0.08]], 0.07, { tip: 0.1, segs: 10, radial: 7 });
    return merge([[sph(0.4, 22, 16), undefined, C.skin], ...sym([[horn, undefined, C.horn], [cone(1, 1, 6), M(0.42, 0.02, -0.02, 0, 0, -1.25, 0.08, 0.26, 0.05), C.skin]]),
      [sph(1, 10, 8), M(0, 0.38, 0.1, 0.4, 0, 0, 0.09, 0.05, 0.12), C.skin]]);
  });
  const hg = new THREE.Group(); hg.position.set(0, 1.04, 0.03); body.add(hg);
  hg.add(part(hd, vc(), 0, 0, 0, { ow: 0.026 }));
  faceOn(hg, spherePatch(0.404, 1.7, 1.0, 1.05), critterFace({ mood: C.mood, eye: C.eye, mouth: 'fang', blush: C.mood !== 'glow' }));
  const wings = new THREE.Group(); wings.position.set(0, 0.72, -0.18); body.add(wings);
  for (const s of [1, -1]) {
    const p = new THREE.Group(); p.position.x = s * 0.1; wings.add(p);
    const inner = new THREE.Group(); inner.scale.set(s, 1, 1); inner.rotation.z = s * 0.42; p.add(inner);
    const w = new THREE.Mesh(batPlane(), batMat(C.wing0, C.wing1, C.skin, C.ink)); w.scale.setScalar(0.42); w.raycast = () => {}; inner.add(w);
  }
  const tp = tailPts[3];
  const fl = new THREE.Mesh(flameGeo(C.flame), glowVC()); fl.position.set(tp[0], tp[1] + 0.08, tp[2]); fl.scale.setScalar(0.17); body.add(fl);
  selfAnim(fl, (t) => { const k = 1 + Math.sin(t * 14) * 0.12; fl.scale.set(0.17 / k, 0.17 * k * (1 + Math.sin(t * 23) * 0.05), 0.17 / k); });
  body.add(halo(C.glow, 0.55, [tp[0], tp[1] + 0.1, tp[2]], 0.9));
  body.add(halo(C.glow, 1.0, [0.36, 1.12, 0.3], 0.35));
  root.userData.wings = wings;
  return finish(root, { body, head: hg }, 'float', 1.5);
}

// ---------------------------------------------------------------- Yeti
const YETI = [
  { fur: 0xf6f9ff, fur2: 0xdce8f8, skin: 0x8ab8ea, horn: 0xe8d8b8, ice: [0x7ac8ff, 0xf0fcff], em: 0x1a3a6a, face: { mood: 'happy', eye: '#24305a', mouth: 'fang', eyeSize: 1.2 } },
  { fur: 0x4c4668, fur2: 0x38324e, skin: 0x9c7ae0, horn: 0x241c34, ice: [0x8a3ad8, 0xffb0ff], em: 0x5a1a8a, glow: 0xd07aff, face: { mood: 'glow', eye: '#ff6ad8', mouth: 'fang', blush: false } },
];
function yeti(v) {
  const C = YETI[v], key = 'yeti' + v, { root, body } = rig();
  const torso = G(key + 'to', () => {
    const horn = tubeGeo('yetihorn', [[0.3, 0.28, 0], [0.44, 0.38, 0.02], [0.5, 0.58, 0.06]], 0.085, { tip: 0.25, segs: 8, radial: 7 });
    const L = [
      [sph(1, 22, 16), M(0, 1.3, 0, 0, 0, 0, 0.82, 0.8, 0.68), C.fur],
      [sph(1, 18, 14), M(0, 1.18, 0.3, 0, 0, 0, 0.56, 0.52, 0.42), C.fur2],
      [sph(1, 20, 16), M(0, 2.02, 0.16, 0, 0, 0, 0.54, 0.5, 0.48), C.fur],
      [sph(1, 18, 14), M(0, 1.97, 0.46, 0, 0, 0, 0.42, 0.35, 0.24), C.skin],
      ...sym([
        [sph(1, 14, 10), M(0.6, 1.84, 0, 0, 0, 0, 0.34, 0.3, 0.34), C.fur],
        [sph(1, 12, 10), M(0.44, 0.72, 0, 0, 0, 0, 0.3, 0.26, 0.3), C.fur],
        [sph(1, 12, 10), M(0.46, 1.6, 0.3, 0, 0, 0, 0.2, 0.16, 0.16), C.fur],
        [horn, M(0, 2.02, 0.14), C.horn],
      ]),
    ];
    for (const [x, z, s] of [[0, 0.16, 0.16], [0.13, 0.08, 0.13], [-0.13, 0.1, 0.12], [0.05, -0.04, 0.12]]) L.push([sph(1, 10, 8), M(x, 2.47, z, 0, 0, 0, s), C.fur]);
    return merge(L);
  });
  body.add(part(torso, vc(), 0, 0, 0, { ow: 0.03 }));
  faceOn(body, spherePatch(1.01, 1.9, 0.95, 1.15), critterFace(C.face), [0.42, 0.35, 0.24], [0, 1.97, 0.46]);
  const ice = G(key + 'ic', () => merge(sym([[0.62, 2.08, -0.06, 0.1, -0.5, 0.36], [0.5, 2.0, -0.26, -0.3, -0.25, 0.28], [0.74, 1.96, 0.1, 0.2, -0.85, 0.26], [0.2, 1.72, -0.55, -0.7, -0.2, 0.3]].map(([x, y, z, rx, rz, h]) => [tintedShard(...C.ice), M(x, y, z, rx, 0, rz, 0.08, h, 0.08)]))));
  body.add(faceted(ice, vc({ emissive: C.em }), 0.022));
  const arm = G(key + 'arm', () => merge([
    [sph(1, 14, 10), M(0.12, -0.46, 0, 0, 0, 0.22, 0.26, 0.52, 0.26), C.fur],
    [sph(1, 12, 10), M(0.22, -0.96, 0.04, 0, 0, 0, 0.3, 0.24, 0.3), C.fur2],
    [sph(1, 14, 10), M(0.24, -1.22, 0.1, 0, 0, 0, 0.25, 0.26, 0.27), C.skin],
    ...[-0.1, 0, 0.1].map((dx) => [sph(1, 8, 6), M(0.24 + dx, -1.42, 0.22 - Math.abs(dx) * 0.5, 0, 0, 0, 0.075, 0.09, 0.075), C.skin]),
  ]));
  const leg = G(key + 'leg', () => merge([
    [sph(1, 14, 10), M(0, -0.22, 0, 0, 0, 0, 0.28, 0.36, 0.28), C.fur],
    [sph(1, 14, 10), M(0, -0.5, 0.12, 0, 0, 0, 0.27, 0.13, 0.38), C.skin],
    ...[-0.12, 0, 0.12].map((dx) => [sph(1, 8, 6), M(dx, -0.52, 0.46, 0, 0, 0, 0.08, 0.07, 0.08), C.skin]),
  ]));
  const arms = [], legs = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group(); a.position.set(s * 0.8, 1.82, 0); body.add(a);
    const am = new THREE.Group(); am.scale.x = s; a.add(am); am.add(part(arm, vc(), 0, 0, 0, { ow: 0.028 }));
    arms.push(a);
    const l = new THREE.Group(); l.position.set(s * 0.36, 0.62, 0); body.add(l);
    l.add(part(leg, vc(), 0, 0, 0, { ow: 0.028 }));
    legs.push(l);
  }
  if (C.glow) { body.add(halo(C.glow, 3.2, [0, 1.5, 0], 0.25)); body.add(halo(C.glow, 0.9, [0, 2.0, 0.6], 0.5)); }
  return finish(root, { body, arms, legs }, 'stomp', 2.6);
}

// ---------------------------------------------------------------- Crystal beetle
const BEETLE = [
  { shell: [0x5a1ab0, 0xb070ff, 0xf0d8ff], em: 0x2a0a4a, body: 0x2e2440, head: 0x8a78c8, eye: '#1a0e30', glow: 0xc08aff },
  { shell: [0x0a7a44, 0x3ad88a, 0xd8ffe8], em: 0x0a3a1a, body: 0x22303a, head: 0x5a9a84, eye: '#0a2a1a', glow: 0x6affb0 },
  { shell: [0xc8700a, 0xffc43a, 0xfff6c8], em: 0x5a3a00, body: 0x3a2a1a, head: 0xc89a5a, eye: '#2a1404', glow: 0xffe07a, star: true },
];
function beetle(v) {
  const C = BEETLE[v], key = 'beetle' + v, { root, body } = rig();
  const bd = G(key + 'bd', () => {
    const leg = tubeGeo('beetleleg', [[0.3, 0.36, 0], [0.52, 0.3, 0.02], [0.6, 0.02, 0.06]], 0.04, { tip: 0.6, segs: 8, radial: 6 });
    const ant = tubeGeo('beetleant', [[0.1, 0.72, 0.64], [0.2, 0.92, 0.78], [0.32, 0.98, 0.9]], 0.022, { tip: 0.8, segs: 8, radial: 5 });
    return merge([
      [sph(1, 18, 12), M(0, 0.42, -0.05, 0, 0, 0, 0.48, 0.3, 0.62), C.body],
      [sph(1, 20, 16), M(0, 0.48, 0.52, 0, 0, 0, 0.32, 0.3, 0.3), C.head],
      ...sym([
        ...[0.3, 0, -0.32].map((z, j) => [leg, M(0, 0, z, 0, (1 - j) * 0.45, 0), C.body]),
        [ant, undefined, C.body], [sph(1, 8, 6), M(0.33, 0.99, 0.92, 0, 0, 0, 0.05), C.shell[2]],
      ]),
    ]);
  });
  body.add(part(bd, vc(), 0, 0, 0, { ow: 0.024 }));
  faceOn(body, spherePatch(1.01, 1.7, 1.05, 1.05), critterFace({ mood: 'happy', eye: C.eye, mouth: 'smile' }), [0.32, 0.3, 0.3], [0, 0.48, 0.52]);
  const shell = G(key + 'sh', () => {
    const half = tint(gem('ico', 1).clone(), [C.shell[0], C.shell[1], C.shell[2]], -0.9, 1.0);
    const sh = tintedShard(C.shell[1], C.shell[2]);
    return merge([
      [half, M(0.2, 0.62, -0.12, 0.08, 0, -0.18, 0.3, 0.3, 0.6)], [half, MIRROR.clone().multiply(M(0.2, 0.62, -0.12, 0.08, 0, -0.18, 0.3, 0.3, 0.6))],
      [sh, along([0.12, 0.82, -0.2], [0.18, 1.18, -0.36], 0.08)], [sh, along([-0.1, 0.84, -0.32], [-0.18, 1.12, -0.5], 0.07)], [sh, along([0.0, 0.84, -0.02], [0.02, 1.02, -0.06], 0.06)],
      [sh, along([0, 0.66, 0.6], [0, 1.2, 0.88], 0.1)],
    ]);
  });
  body.add(faceted(shell, vc({ emissive: C.em }), 0.026));
  if (C.star) {
    const st = new THREE.Mesh(starGeo(0.12, 0.05, 0.03, 0.02), glow(0xfff2a0)); st.position.set(0, 1.24, 0.9); st.rotation.x = -0.4; body.add(st);
    body.add(halo(0xffe07a, 0.7, [0, 1.24, 0.9], 0.8));
  }
  body.add(halo(C.glow, 1.2, [0, 1.0, -0.2], 0.4));
  return finish(root, { body }, 'waddle', 1.4);
}

// ---------------------------------------------------------------- Wraith
const WRAITH = [
  { cloak: 0x5a3a8a, dark: 0x22123a, trim: 0x8a6ad8, hand: 0xd8d0f0, void: 0x0e0618, eye: '#d0a0ff', glow: 0xb07aff },
  { cloak: 0x5a8ad8, dark: 0x1e3a78, trim: 0xbfe8ff, hand: 0xe8f6ff, void: 0x081428, eye: '#9af8ff', glow: 0x8af0ff, ice: [0x7ac8ff, 0xf0fcff] },
];
function tatteredLathe(key, prof, cols, segs, drop, { phiStart = PI, phiLength = TAU, top = 0 } = {}) {
  return G(key, () => {
    const n = prof.length, g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), segs, phiStart, phiLength);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i <= segs; i++) for (let j = 0; j < n; j++) {
      const id = i * n + j;
      if (j === 0 && i % 2) p.setY(id, p.getY(id) - drop * (0.7 + (i % 3) * 0.25));
      if (top && j === n - 1 && i % 2) p.setY(id, p.getY(id) + top);
      c.set(cols[Math.min(cols.length - 1, Math.round((j / (n - 1)) * (cols.length - 1)))]); col.set([c.r, c.g, c.b], id * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  });
}
function wraith(v) {
  const C = WRAITH[v], key = 'wraith' + v, { root, body } = rig();
  const cloak = G(key + 'cl', () => {
    const robe = tatteredLathe(key + 'robe', [[0.64, 0.2], [0.6, 0.5], [0.52, 0.92], [0.44, 1.3], [0.36, 1.56], [0.2, 1.7]], [C.dark, C.dark, C.cloak, C.cloak, C.cloak, C.cloak], 20, 0.3);
    const mantle = tatteredLathe(key + 'mantle', [[0.5, 1.28], [0.47, 1.42], [0.38, 1.58], [0.24, 1.68]], [C.trim, C.cloak, C.cloak, C.cloak], 16, 0.16);
    const hood = new THREE.SphereGeometry(0.42, 20, 12, PI / 2 + 0.72, TAU - 1.44, 0, 2.2);
    const sleeve = tubeGeo('wsleeve', [[0.32, 1.48, 0.02], [0.46, 1.22, 0.2], [0.52, 1.04, 0.4]], 0.12, { tip: 1.6, segs: 10, radial: 10 });
    const finger = tubeGeo('wfinger', [[0, 0, 0], [0.01, -0.1, 0.06], [0, -0.2, 0.08]], 0.025, { tip: 0.3, segs: 6, radial: 5 });
    return merge([
      [robe], [mantle], [hood, M(0, 1.8, 0), C.cloak], [cone(0.16, 0.36, 10), M(0, 2.12, -0.24, -0.9), C.cloak],
      ...sym([[sleeve, undefined, C.cloak], [sph(1, 8, 6), M(0.53, 1.0, 0.44, 0, 0, 0, 0.07), C.hand],
        ...[-0.05, 0, 0.05].map((dx) => [finger, M(0.53 + dx, 0.98, 0.46, 0, dx * 4, 0), C.hand])]),
    ]);
  });
  body.add(part(cloak, vc({ side: DS }), 0, 0, 0, { ow: 0.026 }));
  body.add(part(sph(0.33, 18, 14), C.void, 0, 1.79, 0.03, { ow: 0 }));
  faceOn(body, spherePatch(0.336, 1.5, 1.1, 1.0), critterFace({ mood: 'glow', eye: C.eye, mouth: 'none', blush: false }), null, [0, 1.79, 0.03]);
  for (const s of [-1, 1]) body.add(halo(C.glow, 0.32, [s * 0.11, 1.84, 0.34], 0.9));
  if (C.ice) {
    const ice = G(key + 'ic', () => merge(sym([[0.36, 1.58, 0, 0.1, -0.6, 0.26], [0.42, 1.5, -0.14, -0.3, -0.9, 0.22], [0.2, 1.62, -0.24, -0.6, -0.3, 0.2]].map(([x, y, z, rx, rz, h]) => [tintedShard(...C.ice), M(x, y, z, rx, 0, rz, 0.06, h, 0.06)]))));
    body.add(faceted(ice, vc({ emissive: 0x1a3a6a }), 0.02));
  }
  orbit(body, key, [0, 1].map(() => [sph(1, 10, 8), 0xffffff, 0.07]), { y: 1.15, r: 0.85, tilt: 0.25, speed: 0.9, sprite: C.glow, spriteSize: 0.45, sprites: 2 });
  body.add(halo(C.glow, 2.8, [0, 1.2, 0], 0.22));
  return finish(root, { body }, 'float', 2.2);
}

// ---------------------------------------------------------------- Starling (star sprite)
const STARLING = [
  { star: 0xffd84a, em: 0x7a5a00, eye: '#5a2a00', glow: 0xfff08a, spark: 0xfff6c0 },
  { star: 0x6ae8ff, em: 0x0a5a7a, eye: '#0a2a5a', glow: 0x9af8ff, spark: 0xe0ffff },
];
function starling(v) {
  const C = STARLING[v], key = 'starling' + v, { root, body } = rig();
  const holder = new THREE.Group(); holder.position.y = 0.74; body.add(holder);
  const st = part(starGeo(0.5, 0.3, 0.16, 0.1), toon(C.star, { emissive: C.em }), 0, 0, 0, { ow: 0.03 });
  holder.add(st);
  const face = new THREE.Mesh(G('starface', () => new THREE.PlaneGeometry(0.5, 0.5)), faceMat(critterFace({ mood: 'happy', eye: C.eye, mouth: 'smile' })));
  face.position.set(0, -0.02, 0.19); face.renderOrder = 2; face.raycast = () => {}; st.add(face);
  selfAnim(st, (t) => { st.rotation.y = Math.sin(t * 1.3) * 0.35; st.rotation.z = Math.sin(t * 0.9) * 0.12; });
  holder.add(halo(C.glow, 1.9, [0, 0, -0.1], 0.6));
  orbit(holder, key, [0, 1, 2, 3].map((i) => [sparkleGeo(), C.spark, i % 2 ? 0.07 : 0.11]), { r: 0.72, tilt: 0.35, speed: 1.1, sprite: C.glow, spriteSize: 0.35, sprites: 2, mat: glowVCDS() });
  const trail = G(key + 'tr', () => merge([[starGeo(0.5, 0.3, 0.16, 0.1), M(0.1, -0.5, -0.5, 0, 0, 0.3, 0.22)], [starGeo(0.5, 0.3, 0.16, 0.1), M(-0.08, -0.62, -0.74, 0, 0, -0.2, 0.13)]].map(([g, m]) => [g, m, C.spark])));
  holder.add(part(trail, glowVC()));
  return finish(root, { body }, 'float', 1.3);
}

// ---------------------------------------------------------------- Treasure-chest mimic
const MIMIC = [
  { wood: 0xa8692e, dark: 0x6a3e1a, gold: 0xffc83a, tongue: 0xff5a7a, inner: 0x2a0a14, teeth: 0xfff8e8, eye: '#3a1a0a', ink: '#2a140c', glow: 0xffd060 },
  { wood: 0xc0303a, dark: 0x6a1424, gold: 0xffd84a, tongue: 0xff7aa8, inner: 0x1e0410, teeth: 0xfff8e8, eye: '#c01a1a', ink: '#2a0a0a', glow: 0xff7a6a },
];
function mimic(v) {
  const C = MIMIC[v], key = 'mimic' + v, { root, body } = rig();
  const base = G(key + 'base', () => {
    const tongue = tubeGeo('mimtongue', [[0, 0.62, 0.0], [0, 0.7, 0.22], [0.02, 0.6, 0.4], [0.04, 0.4, 0.44], [0.03, 0.3, 0.4]], 0.11, { tip: 0.7, segs: 16, radial: 10 });
    const L = [
      [box(0.9, 0.5, 0.66), M(0, 0.42, 0), C.wood],
      [box(0.82, 0.03, 0.58), M(0, 0.66, 0), C.inner],
      [box(0.94, 0.08, 0.7), M(0, 0.2, 0), C.gold],
      [box(0.2, 0.18, 0.04), M(0, 0.44, 0.34), C.gold],
      [box(0.04, 0.08, 0.02), M(0, 0.42, 0.36), C.inner],
      [tongue, M(0, 0, 0, 0, 0, 0, 1, 1, 0.55), C.tongue],
      ...sym([
        [box(0.08, 0.52, 0.08), M(0.43, 0.42, 0.31), C.gold], [box(0.08, 0.52, 0.08), M(0.43, 0.42, -0.31), C.gold],
        [sph(1, 12, 8), M(0.27, 0.08, 0.06, 0, 0, 0, 0.14, 0.09, 0.2), C.dark],
        ...[0.08, 0.2, 0.32].map((x) => [cone(0.05, 0.13, 5), M(x, 0.73, 0.29), C.teeth]),
        [cone(0.045, 0.11, 5), M(0.39, 0.72, 0.1), C.teeth],
      ]),
    ];
    return merge(L);
  });
  body.add(part(base, vc(), 0, 0, 0, { ow: 0.024 }));
  const lid = new THREE.Group(); lid.position.set(0, 0.66, -0.33); body.add(lid);
  const lidGeo = G(key + 'lid', () => merge([
    [box(0.92, 0.26, 0.68), M(0, 0.13, 0.33), C.wood],
    [new THREE.CylinderGeometry(0.34, 0.34, 0.92, 16, 1, false, 0, PI), M(0, 0.26, 0.33, 0, 0, PI / 2, 1, 1, 0.45), C.wood],
    [box(0.84, 0.02, 0.6), M(0, -0.005, 0.33), C.inner],
    ...sym([
      [box(0.08, 0.28, 0.72), M(0.43, 0.14, 0.33), C.gold],
      [new THREE.CylinderGeometry(0.355, 0.355, 0.08, 16, 1, false, 0, PI), M(0.43, 0.26, 0.33, 0, 0, PI / 2, 1, 1, 0.47), C.gold],
      ...[0.08, 0.2, 0.32].map((x) => [cone(0.05, 0.13, 5), M(x, -0.06, 0.62, PI), C.teeth]),
    ]),
  ]));
  lid.add(part(lidGeo, vc(), 0, 0, 0, { ow: 0.024 }));
  const eyes = new THREE.Mesh(G('mimeyes', () => new THREE.PlaneGeometry(0.62, 0.31)), faceMat(mimicEyes(C.eye, C.ink)));
  eyes.position.set(0, 0.14, 0.677); eyes.renderOrder = 2; eyes.raycast = () => {}; lid.add(eyes);
  lid.rotation.x = -0.5;
  selfAnim(eyes, (t) => { lid.rotation.x = isDown(body) ? -0.15 : -(0.32 + Math.max(0, Math.sin(t * 3.4)) * 0.32); });
  body.add(halo(C.glow, 0.9, [0, 0.62, 0.1], 0.35));
  return finish(root, { body }, 'waddle', 1.5);
}

// ---------------------------------------------------------------- Crystal stag (elite)
const STAG = [
  { body: 0x9ac0ec, belly: 0xeaf4ff, legs: 0x7a9ad0, hoof: 0x5ad8ff, ant: [0x3a8ae8, 0xe8ffff], em: 0x1a4a8a, glow: 0x7af0ff, mane: 0xffffff, face: { mood: 'angry', eye: '#1a5ab8', mouth: 'none', blush: false } },
  { body: 0xfff2d8, belly: 0xffffff, legs: 0xf0dca8, hoof: 0xffc83a, ant: [0xffa82a, 0xfffbe0], em: 0x6a4a10, glow: 0xffe07a, mane: 0xfff2c0, face: { mood: 'angry', eye: '#c88a10', mouth: 'none', blush: false } },
  { body: 0x3e2e5e, belly: 0x6a4a8a, legs: 0x2a1e40, hoof: 0xb04aff, ant: [0x7a2ad8, 0xffb0ff], em: 0x3a0a5a, glow: 0xd07aff, mane: 0x8a5ad8, face: { mood: 'glow', eye: '#ff5ad8', mouth: 'none', blush: false } },
];
const ANTLER = [
  [[0.1, 0.24, -0.04], [0.24, 0.55, -0.12], 0.075], [[0.24, 0.55, -0.12], [0.4, 0.88, -0.2], 0.065], [[0.4, 0.88, -0.2], [0.48, 1.24, -0.32], 0.055],
  [[0.18, 0.42, -0.08], [0.3, 0.56, 0.2], 0.05], [[0.3, 0.66, -0.14], [0.62, 0.84, -0.06], 0.05], [[0.4, 0.88, -0.2], [0.28, 1.18, -0.04], 0.045],
  [[0.45, 1.06, -0.25], [0.78, 1.26, -0.34], 0.045], [[0.6, 0.8, -0.08], [0.76, 1.0, 0.04], 0.035],
];
function stag(v) {
  const C = STAG[v], sz = 1.0, S = (x) => x * sz, key = 'stag' + v;
  const r = buildQuad({ body: C.body, belly: C.belly, snout: C.belly, legs: C.legs, hoof: C.hoof, ear: C.body, tailColor: C.belly, face: C.face, size: sz });
  const P = r.userData.parts, body = P.body, head = P.head;
  const [torso] = body.children;
  torso.scale.set(0.86, 1.05, 0.9);
  const dy = S(0.692 * 0.34);
  P.legs.forEach((l) => { l.scale.set(0.72, 1.34, 0.72); l.position.y += dy; });
  lift(P, dy);
  const neck = body.children.find((c) => c.isMesh && Math.abs(c.rotation.x - 0.7) < 1e-3);
  if (neck) { neck.position.set(0, S(1.36) + dy, S(0.6)); neck.rotation.x = 0.42; neck.scale.set(0.82, 1.5, 0.82); }
  head.position.set(0, S(1.82) + dy, S(0.84)); head.scale.set(0.92, 0.95, 1.08);
  for (const c of head.children) if (c.isMesh && c.material.color && !c.material.map) { const h = c.material.color.getHex(); if (near(h, C.belly) && c.position.z > 0) { c.position.set(0, S(-0.1), S(0.32)); c.scale.set(0.8, 0.7, 1.55); } else if (near(h, 0x2a1a1a)) c.position.set(0, S(-0.07), S(0.62)); }
  for (const c of head.children) if (c.geometry && c.geometry.type === 'ConeGeometry') { const s = Math.sign(c.position.x); c.rotation.set(-0.2, 0, -s * 1.15); c.position.y -= S(0.08); c.scale.set(1.1, 1.2, 0.7); }
  const ant = G(key + 'ant', () => {
    const sh = tintedShard(...C.ant), A = 0.82;
    return merge(scaleAll(sym(ANTLER.map(([a, b, w]) => [sh, along(a, b, w)])), A * sz));
  });
  head.add(faceted(ant, vc({ emissive: C.em }), 0.028));
  head.add(halo(C.glow, 2.4, [0, S(0.85), S(-0.1)], 0.3));
  const back = G(key + 'bk', () => merge([[0.42, 0.14, 0.2], [0.1, 0.17, 0.16], [-0.22, 0.13, 0.14], [-0.5, 0.1, 0.12]].map(([z, h, rx]) => [tintedShard(...C.ant), M(0, S(1.28) + dy, S(z), -0.5 - rx, 0, 0, S(0.07), S(h * 1.8), S(0.07))])));
  body.add(faceted(back, vc({ emissive: C.em }), 0.022));
  const ruff = G(key + 'rf', () => merge([[0, 1.06, 0.76, 0.17], [0.12, 1.0, 0.7, 0.13], [-0.12, 1.0, 0.7, 0.13], [0, 0.9, 0.74, 0.14], [0.08, 1.2, 0.72, 0.12], [-0.08, 1.2, 0.72, 0.12]].map(([x, y, z, s]) => [sph(1, 10, 8), M(S(x), S(y) + dy, S(z), 0, 0, 0, S(s)), C.mane])));
  body.add(part(ruff, vc(), 0, 0, 0, { ow: 0.02 }));
  P.legs.forEach((l) => l.add(halo(C.glow, 0.5, [0, S(-0.62), S(0.03)], 0.6)));
  compactLegs(P.legs, key);
  r.userData.height = 2.6;
  return r;
}

// ---------------------------------------------------------------- Astral seraph (elite)
const SERAPH = [
  { armor: 0xf4f4ff, armor2: 0xc8d0f0, trim: 0xffc83a, cloth: 0xfff8ec, cloth2: 0xe8d8b0, visor: 0x7af0ff, wing: [0xfffbe8, 0xffd86a, 0xc8962a], halo: 0xffd860, lance: 0xe8f0ff, tip: 0x9af8ff, aura: 0xffe8a0, broken: false },
  { armor: 0x2e2840, armor2: 0x1c1828, trim: 0xb04aff, cloth: 0x3a1a3a, cloth2: 0x1a0a1e, visor: 0xff3a5a, wing: [0x2a1438, 0x8a2ad8, 0xff4ad8], halo: 0xd03aff, lance: 0x3a3048, tip: 0xff4a6a, aura: 0xb04aff, broken: true },
];
function seraph(v) {
  const C = SERAPH[v], key = 'seraph' + v, { root, body } = rig();
  const robe = G(key + 'rb', () => {
    const r0 = tatteredLathe(key + 'robe', [[0.04, 0.12], [0.22, 0.26], [0.42, 0.56], [0.5, 0.92], [0.46, 1.2], [0.36, 1.42], [0.3, 1.5]], [C.cloth2, C.cloth2, C.cloth, C.cloth, C.cloth, C.cloth, C.cloth], 18, 0);
    const L = [[r0], [tor(0.34, 0.045, 8, 24), M(0, 1.44, 0, PI / 2), C.trim], [tor(0.47, 0.03, 6, 28), M(0, 0.62, 0, PI / 2 - 0.05), C.trim]];
    for (const a of [-1.35, -0.5, 0.5, 1.35]) L.push([box(0.24, 0.38, 0.05), M(Math.sin(a) * 0.4, 1.24, Math.cos(a) * 0.4, -0.25 * Math.cos(a), a, 0.25 * Math.sin(a), 1, 1, 1, 'YXZ'), C.armor], [box(0.26, 0.05, 0.06), M(Math.sin(a) * 0.43, 1.06, Math.cos(a) * 0.43, -0.25 * Math.cos(a), a, 0.25 * Math.sin(a), 1, 1, 1, 'YXZ'), C.trim]);
    return merge(L);
  });
  body.add(part(robe, vc({ side: DS }), 0, 0, 0, { ow: 0.024 }));
  const torso = G(key + 'to', () => {
    const arm = (a, b, w, c) => [cyl(1, 1, 1, 10), along(a, b, w), c];
    return merge([
      [sph(1, 18, 14), M(0, 1.72, 0.02, 0, 0, 0, 0.36, 0.34, 0.28), C.armor],
      [sph(1, 14, 10), M(0, 1.5, 0, 0, 0, 0, 0.3, 0.2, 0.24), C.armor2],
      [tor(0.17, 0.035, 6, 20), M(0, 1.98, 0.02, PI / 2 - 0.2), C.trim],
      [box(0.06, 0.34, 0.04), M(0, 1.72, 0.29, -0.1), C.trim],
      ...sym([
        [sph(1, 14, 10), M(0.42, 1.93, 0, 0, 0, -0.35, 0.25, 0.17, 0.25), C.armor],
        [sph(1, 14, 10), M(0.47, 1.83, 0, 0, 0, -0.4, 0.22, 0.12, 0.22), C.trim],
        [cone(1, 1, 6), M(0.45, 2.1, -0.04, 0, 0, -0.3, 0.05, 0.24, 0.05), C.trim],
      ]),
      arm([0.46, 1.86, 0], [0.54, 1.52, 0.12], 0.075, C.armor2), arm([0.54, 1.52, 0.12], [0.46, 1.36, 0.42], 0.085, C.armor),
      [sph(1, 10, 8), M(0.46, 1.35, 0.45, 0, 0, 0, 0.08), C.armor],
      arm([-0.46, 1.86, 0], [-0.58, 1.52, 0.04], 0.075, C.armor2), arm([-0.58, 1.52, 0.04], [-0.56, 1.32, 0.26], 0.085, C.armor),
      [sph(1, 10, 8), M(-0.57, 1.3, 0.3, 0, 0, 0, 0.08), C.armor],
      // round shield on the left arm
      [cyl(0.3, 0.3, 0.05, 20), M(-0.68, 1.42, 0.3, PI / 2, 0, 0.5, 1, 1, 1, 'ZXY'), C.armor],
      [tor(0.3, 0.03, 6, 24), M(-0.68, 1.42, 0.3, 0, -0.5, 0, 1, 1, 1, 'YXZ'), C.trim],
    ]);
  });
  body.add(part(torso, vc(), 0, 0, 0, { ow: 0.024 }));
  const helm = G(key + 'hm', () => {
    const plume = tubeGeo('seraplume', [[0, 2.42, 0.02], [0, 2.52, -0.2], [0, 2.4, -0.45], [0, 2.18, -0.58]], 0.07, { tip: 0.25, segs: 12, radial: 8 });
    return merge([
      [sph(1, 18, 14), M(0, 2.2, 0.02, 0, 0, 0, 0.25, 0.27, 0.26), C.armor],
      [box(0.05, 0.12, 0.42), M(0, 2.44, -0.02), C.trim],
      [plume, undefined, C.cloth],
      ...sym([[cone(1, 1, 5), M(0.25, 2.3, -0.06, -0.5, 0, -0.5, 0.05, 0.3, 0.02), C.trim], [cone(1, 1, 5), M(0.25, 2.22, -0.1, -0.8, 0, -0.75, 0.04, 0.24, 0.02), C.trim]]),
    ]);
  });
  body.add(part(helm, vc(), 0, 0, 0, { ow: 0.024 }));
  const lanceDir = new THREE.Vector3(0, 1, -0.2).normalize(), hand = [0.46, 1.35, 0.45], at = (d) => hand.map((h, i) => h + lanceDir.getComponent(i) * d);
  const lance = G(key + 'ln', () => merge([
    [cyl(1, 1, 1, 8), along(at(-0.95), at(1.45), 0.035), C.lance],
    [spike(12), along(at(0.08), at(0.62), 0.16), C.trim],
    [tor(0.05, 0.02, 6, 12), M(...at(-0.9), PI / 2 - 0.2), C.trim], [tor(0.05, 0.02, 6, 12), M(...at(1.4), PI / 2 - 0.2), C.trim],
  ]));
  body.add(part(lance, vc(), 0, 0, 0, { ow: 0.02 }));
  const glows = G(key + 'gl', () => merge([
    [gem('oct'), along(at(1.42), at(2.05), 0.075), C.tip],
    [box(0.22, 0.035, 0.02), M(0, 2.2, 0.265), C.visor], [box(0.035, 0.12, 0.02), M(0, 2.16, 0.265), C.visor],
    [gem('oct'), M(0, 1.84, 0.29, 0, 0, 0, 0.06, 0.08, 0.03), C.visor],
    [gem('oct'), M(-0.75, 1.42, 0.43, 0, -0.5, 0, 0.08, 0.1, 0.03, 'YXZ'), C.visor],
  ]));
  body.add(part(glows, glowVC()));
  body.add(halo(C.tip, 0.9, at(1.75), 0.8));
  body.add(halo(C.visor, 0.5, [0, 2.2, 0.3], 0.6));
  // halo ring behind the helm (a broken ring for the fallen variant), turning slowly
  const ringHolder = new THREE.Group(); ringHolder.position.set(0, 2.36, -0.24); ringHolder.rotation.x = -0.3; body.add(ringHolder);
  const ring = part(G(key + 'hr', () => {
    const L = [[tor(0.36, 0.028, 6, 40, C.broken ? TAU - 1.1 : TAU), undefined, C.halo]];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; if (C.broken && a > TAU - 1.3) continue; L.push([cone(1, 1, 4), M(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0, 0, 0, a - PI / 2, 0.025, 0.12, 0.012), C.halo]); }
    return merge(L);
  }), glowVC());
  ringHolder.add(ring); ringHolder.add(halo(C.halo, 1.3, [0, 0, -0.02], 0.45));
  selfAnim(ring, (t) => { ring.rotation.z = t * 0.4; });
  // four glowing wings on slow hinges
  const wmat = featherMat(...C.wing), wingG = featherPlane(), pivots = [];
  for (const [s, lower] of [[1, 0], [-1, 0], [1, 1], [-1, 1]]) {
    const p = new THREE.Group(); p.position.set(s * 0.14, lower ? 1.66 : 1.9, -0.22); body.add(p);
    const inner = new THREE.Group(); inner.scale.set(s * (lower ? 0.62 : 0.95), lower ? 0.62 : 0.95, 1); inner.rotation.set(0, 0, 0); p.add(inner);
    const w = new THREE.Mesh(wingG, wmat); w.raycast = () => {}; inner.add(w);
    pivots.push([p, s, lower ? -0.45 : 0.42]);
  }
  selfAnim(pivots[0][0].children[0].children[0], (t) => {
    const a = isDown(body) ? 0 : Math.sin(t * 1.7) * 0.13;
    for (const [p, s, base] of pivots) { p.rotation.y = s * 0.42; p.rotation.z = s * (base + a * (base > 0 ? 1 : -0.6)); }
  });
  for (const s of [-1, 1]) body.add(halo(C.aura, 1.6, [s * 0.9, 2.15, -0.35], 0.3));
  body.add(halo(C.aura, 1.2, [0, 0.15, 0], 0.5));
  return finish(root, { body }, 'float', 3.0);
}

// ---------------------------------------------------------------- Marsh hydra (boss)
const HYDRA = [
  { body: 0x4e8a52, belly: 0xd8e0a0, legs: 0x3e6a42, claw: 0xe8e0c8, fin: 0x9ad85a, spine: 0xe8e0c8, horn: 0xe8e0c8, mouth: 0x8a1a2a, eye: '#ffe84a', mood: 'angry', glow: 0xd8ff6a, moss: 0x6ab83a, lily: 0x4a9a3a },
  { body: 0xb0d4f4, belly: 0xf2f8ff, legs: 0x82acdc, claw: 0xffffff, fin: 0x6ac8ff, spine: 0xc8f0ff, horn: 0xe8f8ff, mouth: 0x2a3a7a, eye: '#2ad8ff', mood: 'glow', glow: 0x9af8ff, ice: [0x6ac8ff, 0xf4feff] },
];
function hydra(v) {
  const C = HYDRA[v], sz = 2.4, S = (x) => x * sz, key = 'hydra' + v;
  const r = buildQuad({ body: C.body, belly: C.belly, legs: C.legs, hoof: C.claw, ears: false, neck: false, snout: false, tail: false, face: { mood: 'angry', eye: C.eye, mouth: 'none', blush: false }, size: sz });
  thicken(r, 2.2);
  const P = r.userData.parts, body = P.body, root3 = P.head;
  const [torso, belly] = body.children;
  torso.scale.set(1.38, 1.0, 1.16); belly.scale.set(1.2, 1.0, 1.4);
  P.legs.forEach((l) => { l.position.x *= 1.3; l.scale.set(1.55, 1, 1.55); });
  root3.clear(); root3.position.set(0, S(1.12), S(0.58));
  // three necks: lower and upper segments sway on their own hooks; P.head (all three) nods for attacks
  const lowerG = G(key + 'nl', () => merge([[tubeGeo('hyneckL', [[0, -0.1, -0.05], [0, 0.5, 0.1], [0, 1.0, 0.2]].map((p) => p.map(S)), S(0.19), { tip: 0.78, segs: 14, radial: 12 }), undefined, C.body],
    ...[0.15, 0.4, 0.65, 0.9].map((u) => [spike(5), M(0, S(-0.1 + u * 1.1), S(0.02 + u * 0.16) - S(0.16 - u * 0.03), -1.9, 0, 0, S(0.05), S(0.16), S(0.05)), C.spine])]));
  const upperG = G(key + 'nu', () => merge([[tubeGeo('hyneckU', [[0, -0.05, 0], [0, 0.35, 0.1], [0, 0.6, 0.38]].map((p) => p.map(S)), S(0.15), { tip: 0.85, segs: 12, radial: 12 }), undefined, C.body],
    ...[0.2, 0.5].map((u) => [spike(5), M(0, S(u * 0.6), S(u * 0.25) - S(0.12), -1.7 - u, 0, 0, S(0.04), S(0.13), S(0.04)), C.spine])]));
  const headG = G(key + 'hd', () => {
    const horn = tubeGeo('hyhorn', [[0.08, 0.18, -0.04], [0.13, 0.27, -0.2], [0.15, 0.26, -0.38]].map((p) => p.map(S)), S(0.035), { tip: 0.12, segs: 8, radial: 6 });
    const L = [
      [sph(1, 20, 14), M(0, S(0.06), 0, 0, 0, 0, S(0.2), S(0.18), S(0.22)), C.body],
      [sph(1, 16, 12), M(0, S(0.0), S(0.22), 0, 0, 0, S(0.14), S(0.085), S(0.22)), C.body],
      [sph(1, 14, 10), M(0, S(-0.09), S(0.17), 0.28, 0, 0, S(0.115), S(0.05), S(0.19)), C.belly],
      [sph(1, 12, 8), M(0, S(-0.06), S(0.18), 0.15, 0, 0, S(0.11), S(0.03), S(0.17)), C.mouth],
      ...sym([
        [horn, undefined, C.horn],
        [sph(1, 8, 6), M(S(0.05), S(0.06), S(0.42), 0, 0, 0, S(0.022)), 0x2a1a1a],
        ...[0, 1, 2].map((k) => [spike(4), M(S(0.17), S(0.06 - k * 0.07), S(-0.04 - k * 0.04), -0.8, 0, -1.2 + k * 0.25, S(0.06), S(0.22 - k * 0.04), S(0.012)), C.fin]),
        ...[0.12, 0.24].map((z) => [cone(1, 1, 5), M(S(0.1 * (1 - z)), S(-0.05), S(z + 0.12), PI, 0, 0, S(0.016), S(0.05), S(0.016)), 0xffffff]),
      ]),
    ];
    return merge(L);
  });
  const necks = [];
  for (const [x, rz, ry, ph] of [[0, 0, 0, 0], [-0.3, 0.42, 0.25, 2.1], [0.3, -0.42, -0.25, 4.2]]) {
    const lower = new THREE.Group(); lower.position.set(S(x), 0, x ? S(-0.06) : 0); root3.add(lower);
    const lm = part(lowerG, vc(), 0, 0, 0, { ow: 0.05 }); lower.add(lm);
    const upper = new THREE.Group(); upper.position.set(0, S(1.0), S(0.2)); lower.add(upper);
    upper.add(part(upperG, vc(), 0, 0, 0, { ow: 0.045 }));
    const hg = new THREE.Group(); hg.position.set(0, S(0.62), S(0.4)); hg.scale.setScalar(1.5); upper.add(hg);
    hg.add(part(headG, vc(), 0, 0, 0, { ow: 0.045 }));
    faceOn(hg, spherePatch(1.01, 1.5, 0.95, 0.95), critterFace({ mood: C.mood, eye: C.eye, mouth: 'none', blush: false }), [S(0.2), S(0.18), S(0.22)], [0, S(0.06), 0]);
    hg.add(halo(C.glow, S(0.45), [0, S(0.1), S(0.2)], 0.45));
    necks.push({ lower, upper, hg, rz, ry, ph });
    selfAnim(lm, (t) => {
      const k = isDown(body) ? 0 : 1, tt = t + ph;
      lower.rotation.set(0.22 + Math.sin(tt * 0.7) * 0.07 * k, ry, rz + Math.sin(tt * 0.9) * 0.1 * k);
      upper.rotation.set(Math.sin(tt * 1.1) * 0.14 * k, 0, -rz * 0.5 + Math.sin(tt * 0.8 + 1) * 0.1 * k);
      hg.rotation.set(0.2 + Math.sin(tt * 1.3) * 0.1 * k, -ry * 0.8 + Math.sin(tt * 0.6) * 0.2 * k, -rz * 0.45);
    });
  }
  // back: bony spines and swamp moss with lily pads, or frost crystals
  const back = G(key + 'bk', () => {
    const L = [];
    for (let i = 0; i < 7; i++) L.push([spike(6), M(0, S(1.36 - Math.abs(i - 2) * 0.02), S(0.5 - i * 0.2), -0.5, 0, 0, S(0.07), S(0.26 - Math.abs(i - 2) * 0.02), S(0.07)), C.spine]);
    if (C.moss) {
      for (const [x, z, s] of [[0.3, 0.2, 0.2], [-0.32, -0.1, 0.22], [0.25, -0.45, 0.18], [-0.2, 0.42, 0.16], [0.05, -0.65, 0.15]]) L.push([sph(1, 12, 8), M(S(x), S(1.25 - Math.abs(x) * 0.25), S(z), 0, 0, 0, S(s), S(s * 0.4), S(s)), C.moss]);
      for (const [x, z] of [[0.34, 0.18], [-0.3, -0.12]]) L.push([new THREE.CylinderGeometry(1, 1, 0.1, 18, 1, false, 0.4, TAU - 0.5), M(S(x), S(1.33 - Math.abs(x) * 0.25), S(z), 0.1, 0, x * 0.4, S(0.15), S(0.15), S(0.15)), C.lily]);
    }
    return merge(L);
  });
  body.add(part(back, vc(), 0, 0, 0, { ow: 0.045 }));
  if (C.ice) {
    const ice = G(key + 'ic', () => merge([[0.32, 0.25, 0.3, -0.5], [-0.34, -0.05, 0.36, 0.5], [0.28, -0.42, 0.26, -0.4], [-0.25, 0.4, 0.24, 0.45], [0, -0.7, 0.22, 0], [0.12, 0.0, 0.3, -0.2]].map(([x, z, h, rz]) => [tintedShard(...C.ice), M(S(x), S(1.2 - Math.abs(x) * 0.2), S(z), -0.3, 0, rz, S(0.07), S(h), S(0.07))])));
    body.add(faceted(ice, vc({ emissive: 0x1a4a7a }), 0.05));
  }
  P.tail.add(part(G(key + 'tl', () => merge([
    [tubeGeo('hytail', [[0, 0, 0], [0, -0.12, -0.5], [0.12, -0.32, -1.0], [0.05, -0.5, -1.45]].map((p) => p.map(S)), S(0.24), { tip: 0.12, segs: 16, radial: 10 }), undefined, C.body],
    [new THREE.SphereGeometry(1, 12, 8), M(0, S(-0.48), S(-1.5), 0.3, 0, 0, S(0.04), S(0.18), S(0.3)), C.fin],
    ...[0.15, 0.35, 0.55].map((u) => [spike(5), M(S(0.06 * u), S(0.22 - u * 0.62), S(-0.1 - u * 1.2), -1.0 - u * 0.4, 0, 0, S(0.05), S(0.16), S(0.05)), C.spine]),
  ])), vc(), 0, 0, 0, { ow: 0.04 }));
  body.add(halo(C.glow, S(2.4), [0, S(1.6), S(0.6)], 0.15));
  compactLegs(P.legs, key);
  r.userData.height = 7;
  return r;
}

// ---------------------------------------------------------------- Drake (boss, five elemental variants)
const DRAKE = [
  { body: 0xc8322e, belly: 0xffb04a, legs: 0xa82828, claw: 0x2a1a1a, horn: 0x3a2626, spine: 0x2a1a1a, mem: [0x6a0a14, 0xff7a3a], bone: 0xe0483a, ink: 0x2a0a0a, glow: [0xff4a10, 0xffa020, 0xfff0a0], eye: '#ffe25a', mood: 'angry', aura: 0xff7a2a, mote: 'flame' },
  { body: 0xeaf4ff, belly: 0xa8e4ff, legs: 0xc8dcf4, claw: 0x5a8ac8, horn: 0xa8d8ff, spine: [0x7ac8ff, 0xf4feff], mem: [0x4a8ae0, 0xe8f8ff], bone: 0xd8e8fa, ink: 0x1a2a5a, glow: [0x3aa8ff, 0x8ae8ff, 0xffffff], eye: '#2ab8ff', mood: 'angry', aura: 0x9af0ff, mote: 'sparkle', em: 0x1a4a7a },
  { body: 0x7a4ad8, belly: 0xe0b0ff, legs: 0x5a3ab0, claw: 0x2a1a4a, horn: 0xe0a8ff, spine: [0x9a4aff, 0xffd0ff], mem: [0x3a1a8a, 0xd8a8ff], bone: 0x9a6ae8, ink: 0x1a0a3a, glow: [0xb04aff, 0xe0a0ff, 0xffffff], eye: '#ff8af0', mood: 'angry', aura: 0xd08aff, mote: 'gem', em: 0x3a0a6a },
  { body: 0x2c2440, belly: 0x5a3a8a, legs: 0x221a32, claw: 0x0e0a16, horn: 0x161020, spine: 0x7a2ad8, mem: [0x120a1e, 0x7a2aa8], bone: 0x3a2e52, ink: 0x07040c, glow: [0x6a1ab0, 0xc04aff, 0xffb0ff], eye: '#ff3ad0', mood: 'glow', aura: 0xb04aff, mote: 'orb' },
  { body: 0xfff8ee, belly: 0xffe08a, legs: 0xf0e0c0, claw: 0xffc83a, horn: 0xffc83a, spine: 0xffd86a, mem: [0xffe0a0, 0xffffff], bone: 0xffd86a, ink: 0x8a5a10, glow: [0xffb02a, 0xffe07a, 0xffffff], eye: '#2ad0ff', mood: 'angry', aura: 0xffe07a, mote: 'star' },
];
function drake(v) {
  const C = DRAKE[v], sz = 2.6, S = (x) => x * sz, key = 'drake' + v, crystal = Array.isArray(C.spine);
  const r = buildQuad({ body: C.body, belly: C.belly, legs: C.legs, hoof: C.claw, ears: false, neck: false, snout: false, tail: false, face: { mood: C.mood, eye: C.eye, mouth: 'none', blush: false }, size: sz });
  thicken(r, 2.2);
  const P = r.userData.parts, body = P.body, head = P.head;
  const [torso, belly] = body.children;
  torso.scale.set(1.15, 1.1, 1.08); belly.scale.set(1.05, 0.95, 1.4);
  P.legs.forEach((l) => { l.position.x *= 1.15; l.scale.set(1.35, 1, 1.35); });
  head.position.set(0, S(1.9), S(1.2));
  dropColor(head, 0x2a1a1a);
  const neckPts = [[0, 1.0, 0.42], [0, 1.36, 0.74], [0, 1.68, 1.02], [0, 1.84, 1.14]];
  const neckCurve = new THREE.CatmullRomCurve3(neckPts.map((p) => new THREE.Vector3(...p.map(S))));
  const spineGeo = crystal ? tintedShard(...C.spine) : spike(6);
  const neck = G(key + 'nk', () => {
    const L = [[tubeGeo('drakeneck' + v, neckPts.map((p) => p.map(S)), S(0.25), { tip: 0.72, segs: 14, radial: 12 }), undefined, C.body]];
    const q = new THREE.Vector3(), tg = new THREE.Vector3();
    for (let i = 0; i < 4; i++) {
      const u = 0.12 + i * 0.22; neckCurve.getPointAt(u, q); neckCurve.getTangentAt(u, tg);
      const back = new THREE.Vector3(0, tg.z, -tg.y); // up-back normal of the neck
      L.push([spineGeo, along(q.clone().addScaledVector(back, S(0.2 * (1 - u * 0.25))).toArray(), q.clone().addScaledVector(back, S(0.42 - u * 0.12)).add(new THREE.Vector3(0, 0, S(-0.12))).toArray(), S(0.06)), crystal ? undefined : C.spine]);
    }
    for (let i = 0; i < 6; i++) L.push([spineGeo, M(0, S(1.34 - Math.abs(i - 1) * 0.02), S(0.5 - i * 0.24), -0.55, 0, 0, S(0.075), S(0.3 - i * 0.025), S(0.075)), crystal ? undefined : C.spine]);
    return merge(L);
  });
  body.add(crystal ? faceted(neck, vc({ emissive: C.em }), 0.05) : part(neck, vc(), 0, 0, 0, { ow: 0.055 }));
  // glowing chest and belly plates following the throat and underside
  const plates = G(key + 'pl', () => {
    const L = [], q = new THREE.Vector3(), tg = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < 5; i++) {
      const u = 0.08 + i * 0.2; neckCurve.getPointAt(u, q); neckCurve.getTangentAt(u, tg);
      const n = new THREE.Vector3(0, -tg.z, tg.y), at = q.clone().addScaledVector(n, S(0.25 * (1 - u * 0.28)) * 0.98);
      _q.setFromUnitVectors(UP, n);
      L.push([box(1, 1, 1), new THREE.Matrix4().compose(at, _q.clone(), new THREE.Vector3(S(0.3 - u * 0.08), S(0.05), S(0.13))), C.glow[i % 2 ? 1 : 2]]);
    }
    for (let i = 0; i < 6; i++) {
      const a = 0.25 + i * 0.36, y = S(0.86) - Math.sin(a) * S(0.38), z = S(0.32) + Math.cos(a) * S(0.5);
      L.push([box(1, 1, 1), M(0, y, z, a - PI / 2 + PI, 0, 0, S(0.4 - i * 0.02), S(0.05), S(0.14)), C.glow[i % 2 ? 1 : 0]]);
    }
    return merge(L);
  });
  body.add(part(plates, glowVC()));
  // dragon head: long muzzle, brow ridges, swept horns and cheek frills
  const hd = G(key + 'hd', () => {
    const horn = tubeGeo('drakehorn', [[0.15, 0.2, -0.04], [0.26, 0.38, -0.32], [0.3, 0.47, -0.72], [0.24, 0.36, -1.08]].map((p) => p.map(S)), S(0.09), { tip: 0.07, segs: 16, radial: 8 });
    const horn2 = tubeGeo('drakehorn2', [[0.26, 0.02, -0.08], [0.42, 0.04, -0.3], [0.48, 0.14, -0.52]].map((p) => p.map(S)), S(0.045), { tip: 0.1, segs: 10, radial: 6 });
    const L = [
      [sph(1, 20, 14), M(0, S(-0.1), S(0.5), 0, 0, 0, S(0.2), S(0.13), S(0.44)), C.body],
      [sph(1, 16, 12), M(0, S(-0.25), S(0.42), 0.16, 0, 0, S(0.17), S(0.07), S(0.4)), C.belly],
      [sph(1, 12, 8), M(0, S(-0.18), S(0.44), 0.08, 0, 0, S(0.16), S(0.04), S(0.36)), 0x5a0a14],
      [spike(6), along([0, S(0.0), S(0.76)], [0, S(0.15), S(0.86)], S(0.045)), C.horn],
      ...sym([
        [horn, undefined, C.horn], [horn2, undefined, C.horn],
        [sph(1, 12, 8), M(S(0.13), S(0.245), S(0.16), 0, 0, -0.35, S(0.13), S(0.045), S(0.14)), C.body],
        [sph(1, 8, 6), M(S(0.07), S(-0.02), S(0.9), 0, 0, 0, S(0.03)), 0x2a1a1a],
        ...[0, 1, 2].map((k) => [spike(4), M(S(0.3), S(0.02 - k * 0.1), S(-0.02 - k * 0.05), -0.9, 0, -1.3 + k * 0.28, S(0.07), S(0.26 - k * 0.05), S(0.014)), C.spine === undefined || crystal ? C.horn : C.spine]),
        [cone(1, 1, 5), M(S(0.11), S(-0.2), S(0.72), PI, 0, 0, S(0.024), S(0.09), S(0.024)), 0xffffff],
        [cone(1, 1, 5), M(S(0.15), S(-0.2), S(0.52), PI, 0, 0, S(0.02), S(0.07), S(0.02)), 0xffffff],
      ]),
    ];
    return merge(L);
  });
  head.add(part(hd, vc(), 0, 0, 0, { ow: 0.05 }));
  for (const s of [-1, 1]) head.add(halo(C.glow[1], S(0.24), [s * S(0.1), S(0.12), S(0.31)], 0.85));
  // membrane wings: pivots flapped by animateCreature (quad), raised and swept back inside
  const wings = new THREE.Group(); wings.position.set(0, S(1.36), S(0.12)); body.add(wings);
  const wm = batMat(C.mem[0], C.mem[1], C.bone, C.ink);
  const arm = G('drakewingarm', () => merge([[tubeGeo('dwa', [batPt(BAT.sh), batPt(BAT.wr), batPt(BAT.tips[0])], 0.035, { tip: 0.3, segs: 16, radial: 6 })], [sph(1, 8, 6), M(...batPt(BAT.wr), 0, 0, 0, 0.05)]]));
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.x = s * S(0.28); wings.add(pivot);
    const inner = new THREE.Group(); inner.scale.set(s, 1, 1); inner.rotation.order = 'ZYX'; inner.rotation.set(PI / 2 - 0.25, s * 0.3, s * 0.3); pivot.add(inner);
    const k = S(1.45);
    const w = new THREE.Mesh(batPlane(), wm); w.scale.setScalar(k); w.raycast = () => {}; inner.add(w);
    inner.add(part(arm, C.bone, 0, 0, 0, { ow: 0.02, s: [k, k, k] }));
  }
  P.wings = wings;
  // tail with a spined ridge and an elemental tip
  const tailPts = [[0, 0, 0], [0, -0.16, -0.5], [0, -0.36, -1.0], [0.12, -0.42, -1.5], [0.26, -0.3, -1.9]];
  const tcurve = new THREE.CatmullRomCurve3(tailPts.map((p) => new THREE.Vector3(...p.map(S))));
  const tail = G(key + 'tl', () => {
    const L = [[tubeGeo('draketail', tailPts.map((p) => p.map(S)), S(0.22), { tip: 0.14, segs: 20, radial: 10 }), undefined, C.body]];
    const q = new THREE.Vector3();
    for (let i = 0; i < 6; i++) { const u = 0.06 + i * 0.15; tcurve.getPointAt(u, q); L.push([spineGeo, M(q.x, q.y + S(0.2 * (1 - u * 0.8)), q.z, -1.0, 0, 0, S(0.06 * (1 - u * 0.5)), S(0.22 * (1 - u * 0.6)), S(0.06 * (1 - u * 0.5))), crystal ? undefined : C.spine]); }
    const e = tailPts[4].map(S);
    L.push([gem('oct'), M(e[0] + S(0.06), e[1] + S(0.02), e[2] - S(0.1), 0.3, 0.6, 0.2, S(0.18), S(0.06), S(0.24)), crystal ? undefined : C.spine]);
    return merge(L);
  });
  P.tail.add(crystal ? faceted(tail, vc({ emissive: C.em }), 0.045) : part(tail, vc(), 0, 0, 0, { ow: 0.045 }));
  const e = tailPts[4].map(S);
  const tf = new THREE.Mesh(flameGeo(C.glow), glowVC()); tf.position.set(e[0] + S(0.06), e[1] + S(0.12), e[2] - S(0.12)); tf.scale.setScalar(S(0.22)); P.tail.add(tf);
  selfAnim(tf, (t) => { const k = 1 + Math.sin(t * 11) * 0.12; tf.scale.set(S(0.22) / k, S(0.22) * k, S(0.22) / k); });
  P.tail.add(halo(C.aura, S(0.7), [e[0], e[1] + S(0.16), e[2] - S(0.1)], 0.7));
  // elemental motes circling the body
  const moteGeo = { flame: flameGeo(C.glow), sparkle: sparkleGeo(), gem: gem('oct'), orb: sph(1, 10, 8), star: starGeo(0.5, 0.22, 0.1, 0.04) }[C.mote];
  orbit(body, key, [0, 1, 2, 3, 4].map((i) => [moteGeo, C.mote === 'flame' ? undefined : C.glow[i % 2 ? 1 : 2], S(C.mote === 'flame' ? 0.12 : 0.07), C.mote === 'flame' ? 0 : 0.6]), { y: S(1.2), r: S(1.5), tilt: 0.12, speed: 0.35, sprite: C.aura, spriteSize: S(0.35), sprites: 3, mat: C.mote === 'sparkle' || C.mote === 'star' ? glowVCDS() : glowVC() });
  body.add(halo(C.aura, S(2.0), [0, S(1.0), S(0.7)], 0.25));
  r.userData.height = 7;
  return r;
}

// ---------------------------------------------------------------- Colossus (boss golem)
const COLOSSUS = [
  { rock: 0x4a3c3c, rock2: 0x5e4a46, glow: 0xff6a1a, core: 0xffd04a, eye: 0xffe04a, crys: null, vent: [0xff3a10, 0xffa020, 0xfff0a0], aura: 0xff7a2a },
  { rock: 0x8a90b8, rock2: 0xa0a8cc, glow: 0x6af0ff, core: 0xe8ffff, eye: 0xa8ffff, crys: [0x3aa8ff, 0xe8ffff], crys2: [0xff6ad8, 0xfff0ff], em: 0x1a4a7a, aura: 0x8af0ff },
  { rock: 0x24306a, rock2: 0x2e3c82, glow: 0x8ab0ff, core: 0xfff0a0, eye: 0xfff0a0, trim: 0xffc83a, star: 0xfff6d0, aura: 0x9ab8ff },
];
function colossus(v) {
  const C = COLOSSUS[v], key = 'colossus' + v, { root, body } = rig();
  const R = (x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0, c = C.rock) => [gem('dod'), M(x, y, z, rx, ry, rz, sx, sy, sz), c];
  const torso = G(key + 'to', () => merge([
    R(0, 2.45, 0, 0.95, 0.5, 0.72, 0, 0.3), R(0, 3.2, 0.02, 0.8, 0.5, 0.66, 0.2, 0.5, 0, C.rock2),
    R(-0.6, 4.62, 0.16, 0.8, 0.64, 0.78, 0.2, 0.3, 0.1), R(0.6, 4.62, 0.16, 0.8, 0.64, 0.78, -0.2, -0.3, -0.1),
    R(-0.52, 3.94, 0.2, 0.66, 0.56, 0.7, 0.4, 0.1, 0, C.rock2), R(0.52, 3.94, 0.2, 0.66, 0.56, 0.7, -0.4, -0.1, 0, C.rock2),
    R(0, 4.4, -0.46, 1.36, 1.02, 0.78, 0.1, 0.2), R(0, 4.95, -0.62, 1.1, 0.8, 0.6, 0.3, 0.6, 0, C.rock2),
    R(-1.45, 4.95, -0.04, 0.82, 0.76, 0.82, 0.5, 0.2, 0.3), R(1.45, 4.95, -0.04, 0.82, 0.76, 0.82, -0.5, -0.2, -0.3),
    R(0, 5.42, 0.25, 0.52, 0.32, 0.4, 0, 0.4, 0, C.rock2),
    ...(C.trim ? sym([[tor(0.62, 0.07, 6, 20), M(1.45, 4.95, -0.04, PI / 2, 0, -0.5, 1, 1, 1), C.trim], [tor(0.5, 0.06, 6, 20), M(0, 2.45, 0, PI / 2, 0, 0, 1.6, 1.3, 1), C.trim]]) : []),
  ]));
  body.add(faceted(torso, vc(), 0.05));
  const inner = new THREE.Mesh(G('colinner', () => merge([[sph(1, 16, 12), M(0, 4.25, 0.05, 0, 0, 0, 1.1, 0.95, 0.72)], [sph(1, 12, 10), M(0, 3.3, 0.02, 0, 0, 0, 0.7, 0.8, 0.55)], [sph(1, 12, 10), M(0, 2.5, 0, 0, 0, 0, 0.82, 0.38, 0.6)]])), glow(C.glow));
  body.add(inner);
  const core = new THREE.Mesh(v === 1 ? gem('oct') : v === 2 ? starGeo(0.5, 0.22, 0.12, 0.06) : sph(1, 16, 12), glow(C.core));
  core.position.set(0, 4.3, 0.78); core.scale.setScalar(v === 2 ? 0.75 : 0.34); body.add(core);
  selfAnim(core, (t) => { core.rotation.z = v === 2 ? t * 0.6 : 0; core.rotation.y = v === 1 ? t * 0.9 : 0; });
  body.add(halo(C.aura, 2.2, [0, 4.3, 0.9], 0.75));
  const hd = G(key + 'hd', () => {
    const L = [R(0, 5.72, 0.42, 0.58, 0.5, 0.52, 0, 0.3), R(0, 5.88, 0.72, 0.56, 0.15, 0.24, 0.2, 0, 0, C.rock2), R(0, 5.42, 0.62, 0.42, 0.2, 0.34, 0, 0.2, 0, C.rock2)];
    if (!C.crys && !C.trim) L.push(...sym([[spike(6), along([0.32, 5.95, 0.3], [0.62, 6.65, 0.1], 0.11), C.rock2], [spike(6), along([1.5, 5.5, -0.1], [1.75, 6.2, -0.3], 0.18), C.rock2]]));
    if (C.trim) L.push([tor(0.46, 0.06, 6, 22), M(0, 6.02, 0.36, PI / 2 + 0.2), C.trim], ...[-0.3, 0, 0.3].map((x) => [spike(4), along([x, 6.0, 0.62], [x * 1.3, 6.5 - Math.abs(x) * 0.6, 0.66], 0.06), C.trim]));
    return merge(L);
  });
  body.add(faceted(hd, vc(), 0.045));
  const glowBits = G(key + 'gb', () => {
    const L = sym([[box(0.2, 0.07, 0.05), M(0.2, 5.7, 0.9, 0, 0, -0.28), C.eye]]);
    if (C.vent) L.push(...sym([[flameGeo(C.vent), M(1.75, 6.25, -0.3, 0, 0, -0.35, 0.22), undefined], [flameGeo(C.vent), M(0.63, 6.68, 0.1, 0, 0, -0.4, 0.13), undefined]]));
    if (C.star) {
      const pts = [[-0.55, 4.9, 0.86], [-0.3, 4.6, 0.92], [-0.62, 4.3, 0.8], [0.25, 4.95, 0.88], [0.6, 4.62, 0.86], [0.45, 4.2, 0.85], [0.75, 4.05, 0.7], [-0.4, 3.7, 0.86], [0.42, 3.72, 0.86], [1.45, 5.45, 0.4], [-1.45, 5.45, 0.4], [1.7, 4.9, 0.5], [-1.7, 4.9, 0.5]];
      for (const p of pts) L.push([gem('oct'), M(...p, 0, 0, 0, 0.06, 0.09, 0.06), C.star]);
      for (const [a, b] of [[0, 1], [1, 2], [3, 4], [4, 5], [5, 6], [9, 11], [10, 12]]) L.push([cyl(1, 1, 1, 4), along(pts[a], pts[b], 0.012), C.glow]);
    }
    return merge(L);
  });
  body.add(part(glowBits, glowVC()));
  if (C.crys) {
    const cr = G(key + 'cr', () => {
      const a = tintedShard(...C.crys), b = tintedShard(...C.crys2);
      return merge([
        ...sym([[a, along([1.4, 5.45, -0.1], [1.8, 6.5, -0.35], 0.22)], [b, along([1.2, 5.4, -0.3], [1.25, 6.05, -0.75], 0.14)], [a, along([1.7, 5.2, 0.25], [2.2, 5.75, 0.45], 0.12)], [a, along([0.3, 5.92, 0.35], [0.52, 6.55, 0.3], 0.1)]]),
        [a, along([0, 5.0, -0.9], [0, 6.3, -1.4], 0.26)], [b, along([0.4, 4.8, -0.95], [0.75, 5.8, -1.45], 0.18)], [b, along([-0.4, 4.8, -0.95], [-0.75, 5.8, -1.45], 0.18)], [a, along([0, 5.98, 0.4], [0, 6.75, 0.42], 0.13)],
      ]);
    });
    body.add(faceted(cr, vc({ emissive: C.em }), 0.045));
  }
  // limbs: shoulder / hip pivots for the stomp rig, glowing joints between the boulders
  const armG = G(key + 'arm', () => merge([R(0.15, -0.72, 0, 0.55, 0.78, 0.55, 0.2, 0.3, 0.1), R(0.25, -2.05, 0.12, 0.66, 0.84, 0.66, 0, 0.6, 0.1, C.rock2), R(0.28, -3.05, 0.22, 0.86, 0.74, 0.86, 0.3, 0.2, 0),
    R(0.12, -3.5, 0.72, 0.3, 0.26, 0.3, 0, 0, 0, C.rock2), R(0.46, -3.45, 0.7, 0.28, 0.24, 0.28, 0, 0.5, 0, C.rock2),
    ...(C.trim ? [[tor(0.62, 0.07, 6, 20), M(0.25, -2.55, 0.12, PI / 2), C.trim]] : []),
    ...(C.crys ? [[tintedShard(...C.crys), along([0.6, -1.85, -0.1], [1.15, -1.5, -0.45], 0.14)], [tintedShard(...C.crys2), along([0.5, -2.3, -0.35], [0.85, -2.2, -0.95], 0.11)]] : [])]));
  const legG = G(key + 'leg', () => merge([R(0, -0.55, 0, 0.62, 0.7, 0.62, 0.3, 0.2, 0), R(0, -1.62, 0.06, 0.7, 0.55, 0.74, 0, 0.5, 0, C.rock2), R(0, -2.04, 0.26, 0.78, 0.26, 0.96, 0, 0, 0, C.rock),
    ...(C.trim ? [[tor(0.6, 0.07, 6, 20), M(0, -1.2, 0.04, PI / 2), C.trim]] : [])]));
  const jointG = G(key + 'jt', () => merge([[sph(1, 12, 10), M(0.22, -1.42, 0.06, 0, 0, 0, 0.42)], [sph(1, 12, 10), M(0.1, -0.05, 0, 0, 0, 0, 0.5)], [sph(1, 12, 10), M(0.28, -2.62, 0.18, 0, 0, 0, 0.5)]]));
  const kneeG = G('colknee', () => merge([[sph(1, 12, 10), M(0, -1.12, 0.05, 0, 0, 0, 0.42)]]));
  const arms = [], legs = [];
  for (const s of [1, -1]) {
    const a = new THREE.Group(); a.position.set(s * 1.75, 4.8, 0); body.add(a);
    const am = new THREE.Group(); am.scale.x = s; a.add(am);
    am.add(C.crys ? faceted(armG, vc({ emissive: C.em }), 0.045) : faceted(armG, vc(), 0.045));
    am.add(new THREE.Mesh(jointG, glow(C.glow)));
    arms.push(a);
    const l = new THREE.Group(); l.position.set(s * 0.78, 2.25, 0); body.add(l);
    l.add(faceted(legG, vc(), 0.045)); l.add(new THREE.Mesh(kneeG, glow(C.glow)));
    legs.push(l);
  }
  orbit(body, key, [0, 1, 2].map((i) => [gem('dod'), i === 1 ? C.rock2 : C.rock, 0.28, 0.5]), { y: 3.8, r: 2.7, tilt: 0.1, speed: 0.3, sprite: C.aura, spriteSize: 0.9, sprites: 3, mat: vc() });
  body.add(halo(C.aura, 5.5, [0, 4.0, 0], 0.18));
  return finish(root, { body, arms, legs }, 'stomp', 8, 1.25);
}

// ---------------------------------------------------------------- Lich king (boss)
function lich() {
  const key = 'lich', { root, body } = rig();
  const robe = 0x4a2a7a, robe2 = 0x22103a, gold = 0xe8b84a, bone = 0xf0ead8, soul = 0x7aff6a, soul2 = 0xc07aff, stole = 0x2a6a4a, dark = 0x120818;
  const cloth = G(key + 'cl', () => {
    const r0 = tatteredLathe('lichrobe', [[1.15, 0.3], [1.08, 0.7], [0.98, 1.4], [0.9, 2.2], [0.84, 3.0], [0.86, 3.6], [0.92, 3.95], [0.78, 4.2], [0.5, 4.35], [0.3, 4.42]], [robe2, robe2, robe, robe, robe, robe, robe, robe, robe, robe], 24, 0.4);
    const collar = tatteredLathe('lichcollar', [[0.52, 4.25], [0.7, 4.7], [0.86, 5.2], [0.98, 5.7]], [robe2, robe, robe, gold], 14, 0, { phiStart: 0.75, phiLength: TAU - 1.5, top: 0.32 });
    const sleeveR = tubeGeo('lichslR', [[0.82, 4.05, 0.04], [1.1, 3.45, 0.32], [1.22, 3.0, 0.56]], 0.24, { tip: 1.9, segs: 12, radial: 12 });
    const sleeveL = tubeGeo('lichslL', [[-0.82, 4.05, 0.04], [-1.22, 3.85, 0.38], [-1.42, 4.05, 0.72]], 0.24, { tip: 1.9, segs: 12, radial: 12 });
    return merge([
      [r0], [collar],
      [box(0.42, 3.3, 0.07), M(0, 2.28, 1.0, -0.06), stole], [box(0.06, 3.3, 0.09), M(0.23, 2.28, 1.0, -0.06), gold], [box(0.06, 3.3, 0.09), M(-0.23, 2.28, 1.0, -0.06), gold],
      [tor(1.1, 0.06, 6, 40), M(0, 0.8, 0, PI / 2), gold], [tor(0.88, 0.06, 6, 36), M(0, 2.6, 0, PI / 2), gold],
      [sleeveR, undefined, robe], [sleeveL, undefined, robe],
      ...sym([[sph(1, 14, 10), M(0.86, 4.26, 0, 0, 0, -0.3, 0.42, 0.3, 0.42), gold],
        ...[0, 1, 2].map((k) => [spike(5), along([0.9 + k * 0.08, 4.38, -0.2 + k * 0.18], [1.18 + k * 0.1, 4.85 - k * 0.08, -0.25 + k * 0.2], 0.06), bone])]),
    ]);
  });
  body.add(part(cloth, vc({ side: DS }), 0, 0, 0, { ow: 0.03 }));
  const skull = G(key + 'sk', () => {
    const finger = tubeGeo('lichfinger', [[0, 0, 0], [0.02, 0.1, 0.06], [0.0, 0.2, 0.1]], 0.035, { tip: 0.5, segs: 6, radial: 5 });
    const grip = tubeGeo('lichgrip', [[0, 0, 0], [0.1, -0.02, 0.06], [0.08, -0.06, 0.14]], 0.04, { tip: 0.6, segs: 6, radial: 5 });
    return merge([
      [sph(1, 20, 16), M(0, 4.98, 0.12, 0, 0, 0, 0.4, 0.42, 0.44), bone],
      [sph(1, 14, 10), M(0, 4.66, 0.32, 0.2, 0, 0, 0.25, 0.14, 0.24), bone],
      ...sym([[sph(1, 10, 8), M(0.2, 4.8, 0.4, 0, 0, 0, 0.12, 0.08, 0.1), bone], [sph(1, 12, 10), M(0.15, 4.96, 0.47, 0, 0, 0, 0.11, 0.12, 0.07), dark]]),
      [sph(1, 8, 6), M(0, 4.8, 0.55, 0, 0, 0, 0.04, 0.06, 0.03), dark],
      ...[-0.1, -0.035, 0.035, 0.1].map((x) => [box(0.05, 0.06, 0.04), M(x, 4.72, 0.52 - Math.abs(x) * 0.3), 0xfffaf0]),
      // skeletal hands: right grips the staff, left holds up a soul flame
      [sph(1, 10, 8), M(1.28, 2.86, 0.66, 0, 0, 0, 0.12, 0.14, 0.1), bone],
      ...[0, 1, 2].map((k) => [grip, M(1.22, 2.92 - k * 0.08, 0.7, 0, -0.4, 0), bone]),
      [sph(1, 10, 8), M(-1.48, 4.18, 0.82, 0, 0, 0, 0.13, 0.08, 0.13), bone],
      ...[-0.09, -0.03, 0.03, 0.09].map((dx) => [finger, M(-1.48 + dx, 4.2, 0.84 + Math.abs(dx) * 0.3, 0, 0, -dx * 2.5), bone]),
      // crown
      [cyl(0.36, 0.33, 0.16, 20, true), M(0, 5.32, 0.1, -0.12), gold], [tor(0.36, 0.035, 6, 24), M(0, 5.25, 0.1, PI / 2 - 0.12), gold],
      ...Array.from({ length: 7 }, (_, i) => { const a = (i / 7) * TAU, h = i === 0 ? 0.42 : 0.26; return [spike(5), M(Math.sin(a) * 0.35, 5.38 + Math.cos(a) * 0.04, 0.1 + Math.cos(a) * 0.35, -0.12 + Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12, 0.06, h, 0.06), gold]; }),
    ]);
  });
  body.add(part(skull, vc(), 0, 0, 0, { ow: 0.026 }));
  const staff = G(key + 'st', () => {
    const shaft = tubeGeo('lichshaft', [[1.3, 0.35, 0.78], [1.34, 1.6, 0.72], [1.27, 3.0, 0.68], [1.33, 4.4, 0.64], [1.3, 5.55, 0.6]], 0.07, { tip: 0.8, segs: 20, radial: 7 });
    const L = [[shaft, undefined, 0x3a2a3a]];
    for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU; L.push([tubeGeo('lichclaw' + i, [[1.3, 5.5, 0.6], [1.3 + Math.cos(a) * 0.28, 5.75, 0.6 + Math.sin(a) * 0.28], [1.3 + Math.cos(a) * 0.24, 6.12, 0.6 + Math.sin(a) * 0.24], [1.3 + Math.cos(a) * 0.08, 6.32, 0.6 + Math.sin(a) * 0.08]], 0.045, { tip: 0.25, segs: 10, radial: 5 }), undefined, gold]); }
    L.push([tor(0.1, 0.03, 6, 14), M(1.3, 5.45, 0.6, PI / 2), gold], [tor(0.09, 0.03, 6, 14), M(1.28, 2.6, 0.68, PI / 2), gold]);
    return merge(L);
  });
  body.add(part(staff, vc(), 0, 0, 0, { ow: 0.024 }));
  const glows = G(key + 'gl', () => merge([
    [sph(1, 16, 12), M(1.3, 5.96, 0.6, 0, 0, 0, 0.26), soul],
    ...sym([[sph(1, 10, 8), M(0.15, 4.96, 0.53, 0, 0, 0, 0.055), soul]]),
    [gem('oct'), M(0, 5.36, 0.48, -0.2, 0, 0, 0.07, 0.1, 0.05), soul], ...sym([[gem('oct'), M(0.24, 5.34, 0.38, 0, 0.6, 0, 0.05, 0.07, 0.04), soul2]]),
    [gem('oct'), M(0, 3.9, 1.04, 0, 0, 0, 0.1, 0.14, 0.05), soul],
    [flameGeo([0x2ac83a, 0x7aff6a, 0xe8ffe0]), M(-1.48, 4.55, 0.86, 0, 0, 0, 0.3)],
  ]));
  body.add(part(glows, glowVC()));
  for (const [p, s, c] of [[[1.3, 5.96, 0.6], 2.0, soul], [[-1.48, 4.6, 0.86], 1.4, soul], [[0.15, 4.96, 0.56], 0.45, soul], [[-0.15, 4.96, 0.56], 0.45, soul]]) body.add(halo(c, s, p, 0.85));
  const ringHolder = new THREE.Group(); ringHolder.position.set(1.3, 5.96, 0.6); body.add(ringHolder);
  const ring = new THREE.Mesh(G('lichring', () => merge([[tor(0.44, 0.025, 6, 36), M(0, 0, 0, PI / 2 + 0.4)], [tor(0.38, 0.02, 6, 32), M(0, 0, 0, PI / 2 - 0.6, 0.5)]])), glow(soul2)); ringHolder.add(ring);
  selfAnim(ring, (t) => { ringHolder.rotation.y = t * 1.2; });
  orbit(body, key, [0, 1, 2, 3, 4].map((i) => [flameGeo(i % 2 ? [0x7a2ad8, 0xc07aff, 0xffe8ff] : [0x2ac83a, 0x7aff6a, 0xe8ffe0]), undefined, 0.22, 0]), { y: 3.0, r: 2.25, tilt: 0.12, speed: 0.5, sprite: soul, spriteSize: 1.0, sprites: 5 });
  // rune circle on the ground (stays put while the lich floats)
  const circle = new THREE.Mesh(G('lichcircle', () => new THREE.PlaneGeometry(6.4, 6.4)), MAT('lichcircle', () => new THREE.MeshBasicMaterial({ map: magicCircleTexture('#9aff7a'), transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })));
  circle.rotation.x = -PI / 2; circle.position.y = 0.05; circle.renderOrder = 1; circle.raycast = () => {}; root.add(circle);
  selfAnim(circle, (t) => { circle.rotation.z = t * 0.25; circle.visible = !isDown(body); });
  body.add(halo(soul2, 6, [0, 3.2, 0], 0.15));
  thicken(root, 1.3);
  return finish(root, { body }, 'float', 6.5);
}

// ---------------------------------------------------------------- Fenrir, the World Devourer (final boss)
function fenrir() {
  const sz = 4.3, S = (x) => x * sz, key = 'fenrir', PELT = 0x1c1a40;
  const gold = 0xffc83a, gold2 = 0xd8902a, flameCols = [0x4a14a8, 0xb03aff, 0xff8af0, 0xfff0ff];
  const r = buildQuad({ body: PELT, belly: 0x3a3480, snout: 0x463e94, legs: PELT, hoof: 0x0e0c20, ear: PELT, tail: false, face: { mood: 'glow', eye: '#ffe066', mouth: 'none', blush: false }, size: sz });
  thicken(r, 2.4);
  const P = r.userData.parts, body = P.body, head = P.head;
  const gm = galaxyMat();
  r.traverse((o) => { if (o.isMesh && !o.userData.isOutline && o.material.color && !o.material.map && near(o.material.color.getHex(), PELT)) o.material = gm; });
  const [torso, belly] = body.children;
  torso.scale.set(1.25, 1.12, 1.15); belly.scale.set(1.1, 0.95, 1.4);
  P.legs.forEach((l) => { l.position.x *= 1.15; l.scale.set(1.35, 1, 1.35); });
  head.scale.set(1.14, 1.1, 1.2);
  for (const c of head.children) if (c.geometry && c.geometry.type === 'ConeGeometry') { c.scale.set(1.15, 1.75, 1.0); c.position.y += S(0.06); }
  // snarl: fangs, brow, cheek ruff and a gleaming nose
  const hd = G(key + 'hd', () => merge([
    [sph(1, 16, 12), M(0, S(-0.08), S(0.42), 0.08, 0, 0, S(0.15), S(0.11), S(0.31)), 0x463e94],
    [sph(1, 12, 10), M(0, S(-0.02), S(0.71), 0, 0, 0, S(0.06), S(0.045), S(0.045)), 0x0a0814],
    [sph(1, 14, 10), M(0, S(-0.17), S(0.36), 0.2, 0, 0, S(0.12), S(0.05), S(0.24)), 0x2a1a3a],
    ...sym([
      [cone(1, 1, 6), M(S(0.08), S(-0.17), S(0.56), PI, 0, 0, S(0.03), S(0.12), S(0.03)), 0xffffff],
      [cone(1, 1, 6), M(S(0.12), S(-0.12), S(0.3), PI, 0, 0, S(0.022), S(0.08), S(0.022)), 0xffffff],
      [sph(1, 12, 8), M(S(0.13), S(0.16), S(0.24), 0, 0, -0.35, S(0.12), S(0.04), S(0.1)), 0x2a2060],
      ...[0, 1, 2].map((k) => [spike(5), M(S(0.27), S(-0.02 - k * 0.1), S(-0.02 - k * 0.04), -1.1, 0, -1.2 + k * 0.25, S(0.07), S(0.28 - k * 0.05), S(0.05)), 0x2a2468]),
    ]),
  ]));
  head.add(part(hd, vc(), 0, 0, 0, { ow: 0.05 }));
  for (const s of [-1, 1]) head.add(halo(0xffd84a, S(0.22), [s * S(0.12), S(0.08), S(0.32)], 0.9));
  // broken golden chains: collar with a snapped length hanging from the throat
  const link = tor(1, 0.26, 6, 12);
  const chain = (pts, k, broken) => pts.map((p, i) => [i === pts.length - 1 && broken ? tor(1, 0.26, 6, 10, PI * 1.3) : link, M(...p, i % 2 ? 0 : PI / 2, i % 2 ? PI / 2 : 0, 0.3, k, k * 1.45, k), i % 2 ? gold2 : gold]);
  const collar = G(key + 'col', () => merge([
    [tor(S(0.26), S(0.05), 8, 28), M(0, S(1.18), S(0.62), 0.7 - PI / 2), gold],
    ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * TAU; return [gem('oct'), M(Math.cos(a) * S(0.3), S(1.18) + Math.sin(a) * S(0.3) * 0.64, S(0.62) - Math.sin(a) * S(0.3) * 0.77, 0, 0, 0, S(0.04)), gold2]; }),
    ...chain([[0, 0.96, 0.82], [0.03, 0.84, 0.86], [0.05, 0.72, 0.88], [0.08, 0.6, 0.88], [0.12, 0.5, 0.86]].map((p) => p.map(S)), S(0.05), true),
    ...chain([[-0.28, 1.04, 0.56], [-0.36, 0.94, 0.48], [-0.42, 0.84, 0.4], [-0.46, 0.74, 0.32]].map((p) => p.map(S)), S(0.045), true),
  ]));
  body.add(part(collar, vc(), 0, 0, 0, { ow: 0.04 }));
  const shackle = G(key + 'sh', () => merge([
    [tor(S(0.15), S(0.035), 8, 22), M(0, S(-0.44), S(0.0), PI / 2), gold],
    ...chain([[0.12, -0.5, 0.06], [0.16, -0.58, 0.1], [0.19, -0.64, 0.16]].map((p) => p.map(S)), S(0.04), true),
  ]));
  P.legs.forEach((l) => l.add(part(shackle, vc(), 0, 0, 0, { ow: 0.035 })));
  // mane of violet cosmic flame around the neck and down the spine; the tail is a plume of the same fire
  const tongue = (k, bend) => tubeGeo('fentongue' + k, [[0, 0, 0], [0, 0.45, -0.12], [0, 0.8, -0.36 - bend], [0, 1.0, -0.66 - bend]], 0.2, { tip: 0.05, taper: 1.4, segs: 12, radial: 7, colors: (u, c) => { const x = u * 3, i = Math.min(2, Math.floor(x)); c.set(flameCols[i]).lerp(new THREE.Color(flameCols[i + 1]), x - i); } });
  const mane = G(key + 'mane', () => {
    const L = [];
    for (let i = 0; i < 13; i++) {
      const a = -1.35 + (i / 12) * 2.7, rad = S(0.36), y = S(1.4) + Math.cos(a) * rad * 0.7, x = Math.sin(a) * rad * 1.1;
      L.push([tongue(i % 3, (i % 3) * 0.12), M(x, y - S(0.06), S(0.5 - Math.abs(a) * 0.08), -0.75 - Math.abs(a) * 0.15, 0, -a * 0.8, S(0.5 + (i % 2) * 0.14))]);
    }
    for (let i = 0; i < 7; i++) L.push([tongue((i + 1) % 3, 0.1), M(S((i % 2 ? 0.07 : -0.07)), S(1.3 - i * 0.015), S(0.32 - i * 0.18), -0.95, 0, (i % 2 ? -0.35 : 0.35), S(0.42 - i * 0.03))]);
    return merge(L);
  });
  const maneM = new THREE.Mesh(mane, glowVC()); body.add(maneM);
  selfAnim(maneM, (t) => { maneM.scale.set(1, 1 + Math.sin(t * 5) * 0.04, 1 + Math.sin(t * 4.1 + 1) * 0.04); });
  const plume = G(key + 'tail', () => merge([0, 1, 2, 3, 4].map((i) => [tongue(i % 3, 0.15), M(S((i - 2) * 0.05), 0, 0, -1.3 + (i % 2) * 0.22, 0, (i - 2) * 0.22, S(0.8 + (i === 2 ? 0.3 : 0)))])));
  P.tail.add(new THREE.Mesh(plume, glowVC()));
  P.tail.add(halo(0xc07aff, S(1.2), [0, S(0.2), S(-0.6)], 0.4));
  // star speckles twinkling on the night-sky pelt
  const stars = G(key + 'stars', () => {
    const L = []; let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 46; i++) {
      const a = (rnd() - 0.5) * 2.4, z = (rnd() - 0.5) * 1.5, y = S(0.92) + Math.cos(a) * S(0.38 * 1.12) * 1.02, x = Math.sin(a) * S(0.38 * 1.25) * 1.02;
      L.push([gem('oct'), M(x, y, S(z * 0.62), rnd(), rnd(), rnd(), S(0.012 + rnd() * 0.018)), [0xffffff, 0xfff2b0, 0xc8e8ff][i % 3]]);
    }
    return merge(L);
  });
  body.add(part(stars, glowVC()));
  body.add(halo(0x9a5aff, S(2.6), [0, S(1.2), S(0.4)], 0.22));
  body.add(halo(0xffd84a, S(0.9), [0, S(1.1), S(0.85)], 0.35));
  r.userData.height = 9;
  return r;
}

// ---------------------------------------------------------------- entry point
const N = { bee: 3, boar: 3, sunflower: 2, frog: 3, croc: 2, imp: 3, salamander: 2, yeti: 2, beetle: 3, wraith: 2, starling: 2, mimic: 2, stag: 3, seraph: 2, queenbee: 1, hydra: 2, drake: 5, colossus: 3, lich: 1, fenrir: 1 };
const BUILD = { bee, boar, sunflower, frog, croc, imp, salamander, yeti, beetle, wraith, starling, mimic, stag, seraph, queenbee: queenBee, hydra, drake, colossus, lich, fenrir };

export function buildExtraMonster(model, variant = 0) {
  const k = EXTRA_MONSTER_MODELS.has(model) ? model : 'bee', n = N[k];
  const v = (((Math.floor(Number(variant)) || 0) % n) + n) % n;
  return BUILD[k](v);
}
