// Dungeon monsters and bosses, built on the overworld model builders with their own silhouettes and palettes.
import * as THREE from 'three';
import { toon, glow, mesh, critterFace, glowTexture } from './toon.js';
import { buildHumanoid, buildJelly, buildShroom, buildQuad, buildTreant, buildGolem, buildMonster } from './models.js';

const geo = new Map();
const G = (k, fn) => { if (!geo.has(k)) geo.set(k, fn()); return geo.get(k); };
const sph = (r, w = 14, h = 10) => G(`s${r}${w}`, () => new THREE.SphereGeometry(r, w, h));
const cone = (r, h, s = 8) => G(`c${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const cyl = (a, b, h, s = 10) => G(`y${a}|${b}|${h}|${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
const oct = (r) => G(`o${r}`, () => new THREE.OctahedronGeometry(r, 0));
const box = (x, y, z) => G(`b${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z));

function part(g, color, x, y, z, o = {}) {
  const m = color && color.isMaterial ? new THREE.Mesh(g, color) : mesh(g, color, { outlineW: o.ow ?? 0.025 });
  m.position.set(x, y, z);
  if (o.s) m.scale.set(...o.s);
  if (o.r) m.rotation.set(...o.r);
  return m;
}
function halo(color, size, y = 0, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, opacity }));
  s.scale.setScalar(size); s.position.y = y; s.raycast = () => {};
  return s;
}
const near = (a, b) => Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) < 6 && Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) < 6 && Math.abs((a & 255) - (b & 255)) < 6;
// Swap materials by source color without touching the shared cached materials.
function recolor(root, map) {
  root.traverse((o) => {
    if (!o.isMesh || o.userData.isOutline || !o.material || !o.material.color || o.material.map) return;
    const hex = o.material.color.getHex();
    for (const [from, to] of map) {
      if (!near(hex, from)) continue;
      o.material = o.material.isMeshBasicMaterial ? glow(to, o.material.opacity, o.material.blending === THREE.AdditiveBlending) : toon(to, o.material.transparent ? { transparent: true, opacity: o.material.opacity } : {});
      break;
    }
  });
}
function setFace(root, texOpts) {
  root.traverse((o) => { if (o.isMesh && o.renderOrder === 2 && o.material.map) { o.material.map = critterFace(texOpts); o.material.needsUpdate = true; } });
}

function caveJelly() {
  const r = buildJelly(0x8a7aff, 1.05);
  const body = r.userData.parts.body;
  const cm = glow(0x8af0ff);
  [[0, 0.78, 0, 0.22, 0], [0.28, 0.68, 0.12, 0.16, 0.5], [-0.26, 0.7, -0.1, 0.15, -0.5], [0.05, 0.66, -0.3, 0.13, -0.2]].forEach(([x, y, z, s, rz]) => {
    const c = new THREE.Mesh(oct(1), cm); c.position.set(x, y, z); c.scale.set(s, s * 2.2, s); c.rotation.z = rz; body.add(c);
  });
  body.add(halo(0x9ac8ff, 2.2, 0, 0.45));
  r.userData.height = 1.5;
  return r;
}

function sporeling(variant) {
  const blight = variant === 2;
  const r = buildShroom(1.05, blight ? 0x2a3a2a : 0x8a4ae0);
  const body = r.userData.parts.body, capG = r.userData.parts.cap;
  if (blight) {
    recolor(r, [[0xfff0d8, 0x7a8a6a], [0xf8e0c0, 0x4a5a3a], [0xffffff, 0x3a2a3a]]);
    setFace(r, { mood: 'angry', eye: '#ff3ad0', mouth: 'fang', blush: false });
  } else setFace(r, { mood: 'angry', eye: '#4a0a6a', mouth: 'o' });
  capG.add(part(sph(0.34), blight ? 0x3a4a3a : 0xc89aff, 0, 0.55, 0, { s: [1, 0.8, 1] }));
  const gm = glow(blight ? 0xff3ad0 : 0xd8b0ff);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2, d = new THREE.Mesh(sph(0.07, 8, 6), gm);
    d.position.set(Math.cos(a) * 0.62, 0.32 + (i % 2) * 0.12, Math.sin(a) * 0.62); capG.add(d);
  }
  body.add(halo(blight ? 0xff3ad0 : 0xc07aff, 2.6, 1.1, 0.5));
  r.userData.height = 1.9;
  return r;
}

function mossbeast() {
  const r = buildQuad({ body: 0x5a7a3a, belly: 0x8a9a5a, snout: 0x8a9a5a, legs: 0x4a3a2a, ear: 0x5a7a3a, spikes: 0x8a8a90, tailColor: 0x5a7a3a, face: { mood: 'angry', eye: '#ffd84a', mouth: 'fang', blush: false }, size: 1.3 });
  const body = r.userData.parts.body;
  for (let i = 0; i < 3; i++) body.add(part(box(0.9, 0.18, 0.55), 0x8a8a90, 0, 1.55 - i * 0.04, 0.35 - i * 0.45, { r: [0.15, i * 0.3, 0.1 * (i - 1)] }));
  for (const s of [-1, 1]) body.add(part(sph(0.32), 0x6a9a4a, 0.45 * s, 1.3, 0.55, { s: [1, 0.6, 1] }));
  r.userData.height = 2.4;
  return r;
}

function queenJelly() {
  const r = buildJelly(0xff7ad0, 3.8);
  const body = r.userData.parts.body;
  setFace(r, { mood: 'angry', eye: '#5a0a3a', mouth: 'smile' });
  const crown = new THREE.Group(); crown.position.y = 0.66; body.add(crown);
  crown.add(part(cyl(0.3, 0.27, 0.12, 14), 0xf0c040, 0, 0, 0, { ow: 0.012 }));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; crown.add(part(cone(0.06, 0.18, 6), 0xf0c040, Math.cos(a) * 0.27, 0.13, Math.sin(a) * 0.27, { ow: 0.008 })); }
  const gem = new THREE.Mesh(oct(0.06), glow(0xff3a8a)); gem.position.set(0, 0.03, 0.3); crown.add(gem);
  const heart = new THREE.Mesh(sph(0.16), glow(0xff3aa8)); heart.position.set(0, -0.12, 0.05); body.add(heart);
  body.add(halo(0xff7ad0, 0.9, -0.12, 0.7));
  const bm = new THREE.MeshBasicMaterial({ color: 0xffd0f0, transparent: true, opacity: 0.55 });
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2, b = new THREE.Mesh(sph(0.07, 10, 8), bm); b.position.set(Math.cos(a) * 0.95, 0.1 + Math.sin(i * 2) * 0.2, Math.sin(a) * 0.95); body.add(b); }
  r.userData.height = 5.5;
  return r;
}

function boneKnight() {
  const r = buildHumanoid({
    gender: 'm', skin: 0xc8ecff, hair: '#e8f4ff', eye: '#3af0ff', mood: 'angry', brow: '#2a3a5a', ears: false, hairStyle: 'spiky',
    outfit: { main: 0x5a6a8a, accent: 0x3af0ff, trim: 0x8a9ab8, skirt: 0x2a3048 }, armor: true, hat: 'helm', weapon: 'sword', cape: 0x2a3048, boots: 0x2a3048,
  });
  r.userData.parts.body.add(halo(0x7af0ff, 2.6, 1.1, 0.35));
  r.scale.setScalar(1.08);
  r.userData.humanoid = true;
  r.userData.height = 2.3;
  return r;
}

function wisp() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const shell = part(sph(0.6, 18, 14), toon(0x9a8aff, { transparent: true, opacity: 0.6 }), 0, 1.5, 0);
  body.add(shell);
  const core = new THREE.Mesh(sph(0.32), glow(0xe8e0ff)); core.position.set(0, 1.5, 0); body.add(core);
  const face = new THREE.Mesh(G('wf', () => new THREE.SphereGeometry(0.61, 20, 14, Math.PI / 2 - 0.8, 1.6, 1.15, 1.0)), new THREE.MeshBasicMaterial({ map: critterFace({ mood: 'angry', eye: '#1a0a3a', mouth: 'o', blush: false }), transparent: true, depthWrite: false }));
  face.position.y = 1.5; face.renderOrder = 2; body.add(face);
  const tm = toon(0x7a5ae8, { transparent: true, opacity: 0.7 });
  [[0, 0.75, 0, 0.42, 1.1], [0.18, 0.55, -0.05, 0.22, 0.8], [-0.2, 0.6, 0.05, 0.2, 0.7]].forEach(([x, y, z, rad, h]) => body.add(part(cone(rad, h, 12), tm, x, y, z, { r: [Math.PI, 0, x * 0.6], ow: 0 })));
  for (const s of [-1, 1]) body.add(part(sph(0.18), tm, 0.62 * s, 1.35, 0.1, { s: [0.7, 1.4, 0.7], r: [0, 0, s * 0.6], ow: 0 }));
  body.add(halo(0xa08aff, 3.2, 1.4, 0.55));
  root.userData.parts = { body };
  root.userData.anim = 'float';
  root.userData.height = 2.2;
  return root;
}

function cryptGolem() {
  const r = buildGolem(1.06);
  recolor(r, [[0x8a94a8, 0x4a4a5c], [0x6a7488, 0x34343f], [0x5a9a4a, 0x6a3a8a], [0x5ff0ff, 0xc07aff]]);
  r.userData.parts.head.add(halo(0xc07aff, 1.6, 0, 0.6));
  r.userData.height = 3.6;
  return r;
}

function gravelord() {
  const r = buildGolem(2.3);
  recolor(r, [[0x8a94a8, 0x5a5468], [0x6a7488, 0x3a3444], [0x5a9a4a, 0xe8e0c8], [0x5ff0ff, 0xb04aff]]);
  const head = r.userData.parts.head;
  for (let i = 0; i < 5; i++) head.add(part(cone(0.09, 0.42, 5), 0x8a8478, (i - 2) * 0.15, 0.42 + (i === 2 ? 0.08 : 0), 0, { r: [0, 0, (2 - i) * 0.18], ow: 0.015 }));
  const body = r.userData.parts.body;
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) body.add(part(cone(0.1, 0.5, 6), 0xe8e0c8, (0.75 + i * 0.12) * s, 2.65 + i * 0.05, -0.1 + i * 0.12, { r: [0, 0, -s * (0.4 + i * 0.25)], ow: 0.015 }));
  body.add(halo(0xb04aff, 3.5, 2.0, 0.4));
  r.userData.height = 8;
  return r;
}

function rootwolf() {
  const r = buildQuad({ body: 0x3a2a4a, belly: 0x6a4a7a, snout: 0x6a4a7a, legs: 0x2a1a3a, ear: 0x3a2a4a, spikes: 0xa83a8a, tailColor: 0x3a2a4a, face: { mood: 'angry', eye: '#ff3ad0', mouth: 'fang', blush: false }, size: 0.95 });
  const body = r.userData.parts.body;
  const rm = 0x6a4a2a;
  for (let i = 0; i < 4; i++) body.add(part(cyl(0.035, 0.06, 0.6, 6), rm, (i % 2 ? 0.25 : -0.25), 1.05, 0.3 - i * 0.2, { r: [0.9, 0, (i % 2 ? -1 : 1) * 0.8], ow: 0.012 }));
  r.userData.parts.head.add(halo(0xff3ad0, 0.9, 0, 0.5));
  r.userData.height = 1.8;
  return r;
}

function rottreant() {
  const r = buildTreant(1.0, { leaf: 0x4a1a5a, bark: 0x3a2a2a, eye: '#ff3ad0', flowers: 0xff3ad0 });
  const body = r.userData.parts.body, cm = glow(0xff4ad8);
  [[0.3, 1.9, 0.62, 0.05, 0.5, 0.3], [-0.35, 1.4, 0.6, 0.05, 0.45, -0.4], [0.1, 1.1, 0.66, 0.04, 0.35, 0.1]].forEach(([x, y, z, w, h, rz]) => body.add(part(box(w, h, 0.04), cm, x, y, z, { r: [0, 0, rz] })));
  body.add(halo(0xff3ad0, 3, 2.6, 0.35));
  r.userData.height = 4;
  return r;
}

function nidhogg() {
  const sz = 3.2;
  const r = buildQuad({ body: 0x3a2a6a, belly: 0x8ad8c8, snout: 0x4a3a7a, legs: 0x2a1a4a, spikes: 0x6af0d0, tailColor: 0x3a2a6a, ears: false, face: { mood: 'angry', eye: '#6af0d0', mouth: 'fang', blush: false }, size: sz });
  const P = r.userData.parts;
  for (const s of [-1, 1]) {
    P.head.add(part(cone(0.06 * sz, 0.45 * sz, 7), 0xe8e0c8, 0.17 * s * sz, 0.36 * sz, -0.12 * sz, { r: [-0.7, 0, -s * 0.35], ow: 0.03 }));
    P.head.add(part(cone(0.04 * sz, 0.2 * sz, 6), 0xe8e0c8, 0.08 * s * sz, -0.02 * sz, 0.48 * sz, { r: [Math.PI, 0, 0], ow: 0.02 }));
  }
  // bat wings: membrane shapes on pivots that animateCreature flaps about z
  const shp = new THREE.Shape();
  shp.moveTo(0, 0); shp.lineTo(1.6, 1.1); shp.lineTo(2.3, 0.4); shp.lineTo(1.75, 0.15); shp.lineTo(1.9, -0.45); shp.lineTo(1.25, -0.25); shp.lineTo(1.1, -0.85); shp.lineTo(0.55, -0.35); shp.lineTo(0, -0.4);
  const wgeo = G('nidwing', () => new THREE.ShapeGeometry(shp));
  const wmat = toon(0x5a3a9a, { side: THREE.DoubleSide });
  const wings = new THREE.Group(); wings.position.set(0, 1.25 * sz, 0.05 * sz); P.body.add(wings);
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.x = 0.25 * s * sz; wings.add(pivot);
    const w = new THREE.Mesh(wgeo, wmat); w.scale.set(s * sz * 0.9, sz * 0.9, 1); w.rotation.x = -Math.PI / 2 + 0.35; pivot.add(w);

  }
  P.wings = wings;
  for (let i = 0; i < 4; i++) P.tail.add(part(cone(0.06 * sz, 0.22 * sz, 5), 0x6af0d0, 0, 0.08 * sz, (-0.15 - i * 0.12) * sz, { r: [-1.2, 0, 0], ow: 0.015 }));
  P.head.add(halo(0x6af0d0, 1.6 * sz, 0, 0.35));
  r.userData.height = 7;
  return r;
}

export function buildDungeonMonster(model, variant = 0) {
  switch (model) {
    case 'cavejelly': return caveJelly();
    case 'sporeling': return sporeling(variant);
    case 'mossbeast': return mossbeast();
    case 'queenjelly': return queenJelly();
    case 'boneknight': return boneKnight();
    case 'wisp': return wisp();
    case 'cryptgolem': return cryptGolem();
    case 'gravelord': return gravelord();
    case 'rootwolf': return rootwolf();
    case 'rottreant': return rottreant();
    case 'nidhogg': return nidhogg();
  }
  return buildMonster(model, variant);
}
