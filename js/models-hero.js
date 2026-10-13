// Chunky toy-style heroes and townsfolk: rounded-box heads and bodies, small dark eyes, thick brows, a real nose,
// sculpted hair and beards, big fists and boots, layered gear, soft shading. Races (human, sylvan, draken, beastkin),
// two body types, sliders and class outfits all build here. Forward is +Z, feet at y=0. The returned group keeps the
// same parts as before (body, legs, arms, hands, head, cape, scarf, wings, weapon) so every animation still works.
import * as THREE from 'three';
import { glow, glowTexture, wingTexture } from './toon.js';

// ---------------------------------------------------------------- palettes
export const SKIN_TONES = ['#f7dcc8', '#eec0a0', '#dba07c', '#bd8460', '#94603f', '#6a4430', '#e2ecd8', '#d2dcf0', '#a9aab6', '#c9785c'];
export const HERO_HAIR = ['#3a2a1e', '#6a4024', '#a0602e', '#d0783a', '#e8c070', '#f4ead0', '#d8dce4', '#2a2a3a', '#ff9ec7', '#7fd0ff', '#b48cff', '#7ef0a8', '#ff6a4a', '#f2d27a'];
export const HAIR_STYLES = ['short', 'messy', 'spiky', 'long', 'bob', 'ponytail', 'bun', 'twin', 'braid', 'mohawk', 'curly', 'bald'];
export const BEARD_STYLES = ['none', 'stubble', 'mustache', 'goatee', 'full', 'braided'];
export const MAKEUP = ['none', 'liner', 'rouge', 'lips', 'warpaint'];
export const SCARS = ['none', 'cheek', 'eye', 'nose', 'chin'];
export const TATTOOS = ['none', 'tribal', 'runes', 'spirals', 'dots'];
export const FACE_SHAPES = ['round', 'square', 'long', 'heart'];
export const BEAST_KINDS = ['wolf', 'fox', 'cat'];

// ---------------------------------------------------------------- materials (soft ramp, no ink outline)
let rampTex = null;
function ramp() {
  if (rampTex) return rampTex;
  const n = 8, data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = Math.round(255 * (0.6 + 0.4 * Math.pow(i / (n - 1), 0.75)));
  rampTex = new THREE.DataTexture(data, n, 1, THREE.RedFormat);
  rampTex.minFilter = rampTex.magFilter = THREE.LinearFilter; rampTex.generateMipmaps = false; rampTex.needsUpdate = true;
  return rampTex;
}
const matCache = new Map();
export function soft(color, opts = {}) {
  const c = new THREE.Color(color).getHex();
  const key = c + '|' + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshToonMaterial({ color: c, gradientMap: ramp(), ...opts }));
  return matCache.get(key);
}
const DS = { side: THREE.DoubleSide };
const shade = (hex, k) => { const c = new THREE.Color(hex); return k < 0 ? c.lerp(new THREE.Color(0x000000), -k).getHex() : c.lerp(new THREE.Color(0xffffff), k).getHex(); };

// ---------------------------------------------------------------- geometry
const gcache = new Map();
const G = (k, f) => { if (!gcache.has(k)) gcache.set(k, f()); return gcache.get(k); };
// A rounded box (superellipsoid) with half extents a, b, c. n = squareness (2 = ellipsoid, 3+ = boxy). taper > 0 makes
// the top narrower than the bottom, < 0 the bottom narrower. theta/phi ranges cut open shells (hair caps, hoods).
export function blob(a, b, c, n = 2.6, taper = 0, o = {}) {
  const { ws = 20, hs = 14, t0 = 0, tl = Math.PI, p0 = 0, pl = Math.PI * 2 } = o;
  return G(`B${a}|${b}|${c}|${n}|${taper}|${ws}|${hs}|${t0}|${tl}|${p0}|${pl}`, () => {
    const g = new THREE.SphereGeometry(1, ws, hs, p0, pl, t0, tl);
    const p = g.attributes.position, nr = g.attributes.normal, v = new THREE.Vector3(), nv = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const s = Math.pow(Math.pow(Math.abs(v.x), n) + Math.pow(Math.abs(v.y), n) + Math.pow(Math.abs(v.z), n), -1 / n);
      const ux = v.x * s, uy = v.y * s, uz = v.z * s;
      const k = 1 - taper * uy * 0.5;
      p.setXYZ(i, ux * a * k, uy * b, uz * c * k);
      const gx = Math.sign(ux) * Math.pow(Math.abs(ux), n - 1) / a, gy = Math.sign(uy) * Math.pow(Math.abs(uy), n - 1) / b, gz = Math.sign(uz) * Math.pow(Math.abs(uz), n - 1) / c;
      nv.set(gx / k, gy + taper * 0.5 * (Math.abs(ux) + Math.abs(uz)) / b * 0.6, gz / k);
      if (nv.lengthSq() < 1e-9) nv.copy(v);
      nv.normalize(); nr.setXYZ(i, nv.x, nv.y, nv.z);
    }
    p.needsUpdate = true; nr.needsUpdate = true;
    g.computeBoundingSphere();
    return g;
  });
}
const cyl = (a, b, h, s = 12) => G(`y${a}|${b}|${h}|${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
const cone = (r, h, s = 10) => G(`o${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const tor = (r, t, arc = Math.PI * 2, rs = 8, ts = 20) => G(`t${r}|${t}|${arc}|${rs}|${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));
const sph = (r, w = 14, h = 10) => G(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const box = (x, y, z) => G(`b${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z));

function part(parent, geo, color, x = 0, y = 0, z = 0, o = {}) {
  const mat = color && color.isMaterial ? color : soft(color, o.opts);
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (o.s) m.scale.set(...o.s);
  if (o.r) m.rotation.set(...o.r);
  m.castShadow = !!o.cast;
  parent.add(m);
  return m;
}
const grp = (parent, x = 0, y = 0, z = 0, r) => { const g = new THREE.Group(); g.position.set(x, y, z); if (r) g.rotation.set(...r); parent.add(g); return g; };

// ---------------------------------------------------------------- the hero
// o: body ('a' broad | 'b' slim), race, beast, skin, hair, hairStyle, beardStyle, beard (color), eye, brow, mood,
// face (shape), faceW, eyeSize, noseSize, build, height, makeup, makeupColor, scar, tattoo, outfit {main, accent, trim,
// skirt}, pants, boots, gear flags (armor, tabard, robe, skirt, apron, pelt, bareArms, bracers, gauntlets, belt, pouch,
// quiver, runes, scarf, mask, cape, hood), hat, hatColor, weapon, wings, wingColor, scale, ears (false hides them),
// catEars (costume), horns.
export function buildHero(o = {}) {
  const body = o.body || (o.gender === 'm' ? 'a' : 'b');
  const race = o.race || 'sylvan';
  const skin = new THREE.Color(o.skin || '#f2cdb4').getHex();
  const hair = new THREE.Color(o.hair || '#6a4024').getHex();
  const out = { main: 0xd8d0c0, accent: 0x3f8cff, trim: 0xf0c24a, skirt: 0x4a5070, ...(o.outfit || {}) };
  const build = o.build ?? 0.5, broad = body === 'a';
  const W = (broad ? 1.08 : 0.94) * (0.9 + build * 0.24); // torso width factor
  const root = new THREE.Group();
  const bodyG = new THREE.Group(); root.add(bodyG);
  const P = { root, body: bodyG };
  const skinMat = soft(skin);
  const cloth = (c) => soft(c);
  const metal = (c) => soft(c, { emissive: new THREE.Color(c).multiplyScalar(0.08) });

  // ---------------------------------------------------------------- legs and boots
  const legCol = o.pants ?? out.skirt, bootCol = o.boots ?? 0x5a3a26;
  for (const s of [-1, 1]) {
    const leg = grp(bodyG, 0.14 * s * W, 0.6, 0);
    part(leg, blob(0.105 * W, 0.2, 0.11, 2.4, 0.15), legCol, 0, -0.2, 0);
    const boot = grp(leg, 0, -0.47, 0.03);
    part(boot, blob(0.125, 0.12, 0.175, 3, 0.2), bootCol, 0, 0, 0.02);
    part(boot, blob(0.13, 0.04, 0.15, 3), shade(bootCol, -0.25), 0, -0.1, 0.02); // sole
    if (o.armor || o.gauntlets) part(boot, blob(0.11, 0.07, 0.07, 2.6), out.main, 0, 0.1, 0.09); // greave plate
    if (o.pelt) part(boot, blob(0.14, 0.05, 0.14, 2.2), 0x8a6a4a, 0, 0.12, 0); // fur cuff
    if (s < 0) P.legR = leg; else P.legL = leg;
  }

  // ---------------------------------------------------------------- hips, torso, belt
  part(bodyG, blob(0.27 * W, 0.11, 0.19, 2.8), legCol, 0, 0.64, 0);
  const torsoCol = o.bareArms && !o.armor ? out.main : out.main;
  const chestA = (broad ? 0.31 : 0.27) * W, waistTaper = broad ? -0.08 : -0.22;
  part(bodyG, blob(chestA, 0.28, 0.21, 2.7, waistTaper), torsoCol, 0, 0.94, 0);
  if (!broad && !o.armor && !o.robe) part(bodyG, blob(0.2 * W, 0.09, 0.07, 2.2), torsoCol, 0, 1.0, 0.15); // bust shape
  if (o.belt !== false) {
    part(bodyG, blob(0.285 * W, 0.05, 0.205, 3), o.beltColor ?? 0x5a3a22, 0, 0.72, 0);
    part(bodyG, blob(0.06, 0.05, 0.03, 3), out.trim, 0, 0.72, 0.205);
  }
  if (o.pouch) for (const s of [-1, 1]) part(bodyG, blob(0.07, 0.08, 0.06, 2.6), 0x7a5232, 0.24 * s * W, 0.66, 0.12);
  if (o.armor) {
    part(bodyG, blob(chestA + 0.03, 0.22, 0.23, 2.8, -0.1), metal(out.main), 0, 1.0, 0.01);
    part(bodyG, blob(0.05, 0.16, 0.02, 3), metal(shade(out.main, 0.2)), 0, 1.0, 0.235); // chest ridge
  }
  if (o.tabard) {
    part(bodyG, blob(0.17 * W, 0.24, 0.025, 3.5), out.accent, 0, 0.9, 0.225);
    part(bodyG, blob(0.15 * W, 0.17, 0.02, 3.5), out.accent, 0, 0.5, 0.2, { r: [0.12, 0, 0] });
    part(bodyG, blob(0.075, 0.075, 0.02, 2.2), out.trim, 0, 0.95, 0.25);
    part(bodyG, blob(0.035, 0.05, 0.022, 2), out.accent, 0, 0.95, 0.262);
  }
  if (o.apron) part(bodyG, blob(0.2 * W, 0.3, 0.025, 3.5), o.apronColor ?? 0xf4efe4, 0, 0.68, 0.215, { r: [0.08, 0, 0] });
  if (o.robe) {
    part(bodyG, blob(0.33 * W, 0.34, 0.27, 2.4, 0.42), out.skirt, 0, 0.36, 0);
    part(bodyG, blob(0.06, 0.32, 0.02, 3), out.trim, 0, 0.36, 0.25, { r: [-0.18, 0, 0] });
  } else if (o.skirt || o.kilt) {
    part(bodyG, blob(0.3 * W, 0.15, 0.24, 2.4, 0.4), o.kilt ? 0x7a5232 : out.skirt, 0, 0.55, 0);
  }
  if (o.runes) for (const [x, y] of [[-0.16, 1.04], [0.16, 1.04], [0, 0.86]]) part(bodyG, box(0.05, 0.05, 0.02), glow(out.accent), x * W, y, 0.24);
  // straps across the chest (berserker, ranger, assassin)
  if (o.strap) {
    const st = part(bodyG, box(0.07, 0.62, 0.03), o.strapColor ?? 0x5a3a22, 0, 0.95, 0.205, { r: [0, 0, 0.62] });
    st.scale.x = 1;
    part(bodyG, blob(0.04, 0.04, 0.02, 3), out.trim, 0.08, 1.0, 0.23);
  }

  // ---------------------------------------------------------------- shoulders and arms
  const shX = chestA + 0.06;
  for (const s of [-1, 1]) {
    const arm = grp(bodyG, shX * s, 1.12, 0);
    const sleeve = o.bareArms ? skin : out.main;
    part(arm, blob(0.088 * W, 0.17, 0.088 * W, 2.3), sleeve, 0, -0.15, 0);
    if (o.bracers || o.gauntlets) part(arm, blob(0.094 * W, 0.075, 0.094 * W, 2.6), o.gauntlets ? metal(out.main) : 0x7a5232, 0, -0.29, 0);
    const hand = grp(arm, 0, -0.41, 0.02);
    part(hand, blob(0.095, 0.1, 0.095, 2.5), o.gauntlets ? metal(shade(out.main, -0.05)) : o.gloves ? o.gloves : skinMat, 0, 0, 0);
    if (o.armor || o.pauldrons) part(arm, blob(0.15, 0.1, 0.15, 2.4, 0.3), metal(out.main), 0.02 * s, 0.02, 0, { r: [0, 0, -0.3 * s] });
    if (o.pelt) part(arm, blob(0.14, 0.1, 0.15, 2), 0x8a6a4a, 0.02 * s, 0.04, 0, { r: [0, 0, -0.35 * s] });
    if (s < 0) { P.armR = arm; P.handR = hand; } else { P.armL = arm; P.handL = hand; }
  }
  if (o.pelt) { // fur mantle
    for (let i = 0; i < 7; i++) {
      const a = (i / 6 - 0.5) * Math.PI * 1.25 + Math.PI;
      part(bodyG, blob(0.12, 0.09, 0.1, 2), i % 2 ? 0x8a6a4a : 0x7a5a3c, Math.sin(a) * 0.24 * W, 1.18, Math.cos(a) * 0.17);
    }
  }

  // ---------------------------------------------------------------- neck and head
  part(bodyG, cyl(0.09, 0.1, 0.12), skinMat, 0, 1.2, 0);
  const head = grp(bodyG, 0, 1.2, 0); P.head = head;
  const shape = o.face || 'round';
  const fw = 0.94 + (o.faceW ?? 0.5) * 0.12;
  const H = {
    round: { a: 0.335, b: 0.325, c: 0.31, n: 2.4, t: 0 },
    square: { a: 0.345, b: 0.315, c: 0.305, n: 3.1, t: 0.04 },
    long: { a: 0.31, b: 0.355, c: 0.3, n: 2.7, t: 0 },
    heart: { a: 0.335, b: 0.33, c: 0.3, n: 2.5, t: -0.22 },
  }[shape] || { a: 0.335, b: 0.325, c: 0.31, n: 2.4, t: 0 };
  const ha = H.a * fw, hb = H.b, hc = H.c, hy = 0.36;
  part(head, blob(ha, hb, hc, H.n, H.t, { ws: 24, hs: 18 }), skinMat, 0, hy, 0);
  // where the face surface is at (x, y) relative to the head center
  const surf = (x, y) => {
    const k = 1 - H.t * (y / hb) * 0.5;
    const q = 1 - Math.pow(Math.abs(x / (ha * k)), H.n) - Math.pow(Math.abs(y / hb), H.n);
    return q <= 0 ? 0 : hc * k * Math.pow(q, 1 / H.n);
  };
  const face = grp(head, 0, hy, 0);
  P.face = face;
  const es = 0.85 + (o.eyeSize ?? 0.5) * 0.3, ex = 0.125 * fw, ey = 0.0;
  const eyeCol = new THREE.Color(o.eye || '#3a2a20').lerp(new THREE.Color(0x120c08), 0.45).getHex();
  const mood = o.mood || 'normal';
  for (const s of [-1, 1]) {
    const x = ex * s, z = surf(x, ey);
    if (mood === 'closed') {
      part(face, tor(0.045, 0.012, Math.PI), 0x2a1a12, x, ey - 0.01, z + 0.002, { r: [0, 0, Math.PI] });
    } else {
      part(face, blob(0.042 * es, 0.06 * es, 0.03, 2.2), eyeCol, x, ey, z - 0.008);
      part(face, sph(0.012 * es, 8, 6), soft(0xffffff, { emissive: 0x666666 }), x - 0.012 * es, ey + 0.022 * es, z + 0.014);
    }
    // brows
    const browCol = new THREE.Color(o.brow || shade(hair, -0.25)).getHex();
    const tilt = mood === 'angry' ? 0.45 : mood === 'kind' ? -0.15 : 0.12;
    part(face, blob(0.06, 0.018, 0.02, 2.6), browCol, x + 0.004 * s, ey + 0.1 * es, surf(x, ey + 0.1) + 0.004, { r: [0, 0, tilt * -s] });
    // ears
    const covered = !!o.hood || ['helm', 'pelt'].includes(o.hat);
    if (o.ears !== false && race !== 'beastkin' && !(covered && race !== 'sylvan')) {
      if (race === 'sylvan') part(head, cone(0.06, 0.26, 6), skinMat, (ha + (covered ? 0.1 : 0.06)) * s, hy + 0.03, -0.02, { r: [0, 0, -s * 1.2], s: [1, 1, 0.55] });
      else part(head, blob(0.05, 0.085, 0.04, 2), skinMat, (ha - 0.005) * s, hy - 0.02, -0.01);
    }
  }
  // nose and mouth
  const ns = 0.8 + (o.noseSize ?? 0.5) * 0.45;
  part(face, blob(0.05 * ns, 0.045 * ns, 0.045 * ns, 2.1), shade(skin, -0.06), 0, -0.07, surf(0, -0.07) + 0.012 * ns);
  const lipCol = o.makeup === 'lips' ? new THREE.Color(o.makeupColor || '#c0304a').getHex() : 0x6a2a24;
  if (mood === 'angry') part(face, box(0.08, 0.016, 0.01), lipCol, 0, -0.17, surf(0, -0.17) + 0.002);
  else part(face, tor(0.04, 0.011, Math.PI * 0.7), lipCol, 0, -0.155, surf(0, -0.16) + 0.002, { r: [0, 0, Math.PI * 1.15] });
  // makeup, scars, tattoos, race marks
  decorateFace(face, surf, o, race, skin, ex);
  // race features on the head
  if (race === 'draken' || o.horns) {
    const hc2 = o.hornColor ?? 0x3a2a24;
    for (const s of [-1, 1]) {
      const hg = grp(head, 0.2 * s * fw, hy + 0.26, -0.06, [-0.55, 0, -0.35 * s]);
      part(hg, cone(0.055, 0.2, 8), hc2, 0, 0.08, 0);
      part(hg, cone(0.04, 0.16, 8), hc2, 0, 0.21, -0.04, { r: [-0.6, 0, 0] });
    }
  }
  if (race === 'beastkin' && !o.hideBeastEars) beastEars(head, hy, ha, o.beast || 'wolf', hair);
  if (o.catEars) beastEars(head, hy, ha, 'cat', hair);

  // ---------------------------------------------------------------- hair, beard, hats
  const hat = o.hat || 'none';
  const hidesHair = hat === 'helm' || hat === 'pelt' || !!o.hood;
  buildHair(head, hy, ha, hb, hc, o.hairStyle || 'short', hair, hidesHair, hat);
  buildBeard(face, surf, o.beardStyle || (typeof o.beard === 'number' ? 'full' : 'none'), o.beard ?? hair, skin);
  if (o.mask) part(face, blob(0.3 * fw, 0.1, 0.14, 2.6), o.maskColor ?? out.accent, 0, -0.17, surf(0, -0.17) - 0.085);
  if (o.hood) buildHood(head, hy, ha, hb, hc, o.hood, out);
  buildHat(head, hy, ha, hb, hc, hat, o, out);

  // ---------------------------------------------------------------- back: scarf, cape, quiver, tail
  if (o.scarf) {
    part(bodyG, tor(0.17, 0.065), cloth(out.accent), 0, 1.19, 0, { r: [Math.PI / 2, 0, 0] });
    const tail = grp(bodyG, 0.12, 1.18, -0.2); P.scarf = tail;
    part(tail, blob(0.06, 0.26, 0.02, 3), out.accent, 0, -0.24, 0);
  }
  if (o.cape) {
    const capeG = grp(bodyG, 0, 1.16, -0.22); P.cape = capeG;
    const cgeo = G('heroCape', () => { const g = new THREE.PlaneGeometry(0.62, 0.95, 2, 5); g.translate(0, -0.47, 0); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, -Math.pow(Math.abs(p.getX(i)) / 0.31, 2) * 0.08); g.computeVertexNormals(); return g; });
    const cm = new THREE.Mesh(cgeo, soft(o.cape, DS)); capeG.add(cm);
    part(capeG, blob(0.33, 0.05, 0.08, 2.4), shade(o.cape, -0.1), 0, 0, 0.04);
  }
  if (o.quiver) {
    const q = grp(bodyG, 0.12, 0.98, -0.24, [0.2, 0, -0.5]);
    part(q, cyl(0.075, 0.065, 0.5, 10), 0x7a4a2a, 0, 0, 0);
    part(q, cyl(0.082, 0.082, 0.05, 10), out.trim, 0, 0.2, 0);
    for (let i = 0; i < 4; i++) part(q, cone(0.03, 0.09, 4), i % 2 ? 0xffffff : out.accent, (i - 1.5) * 0.03, 0.31, (i % 2) * 0.02);
  }
  if (race === 'beastkin' && !o.hideTail) beastTail(bodyG, o.beast || 'wolf', hair);
  if (race === 'draken' && !o.robe) {
    const tg = grp(bodyG, 0, 0.62, -0.2, [0.9, 0, 0]);
    part(tg, cone(0.09, 0.5, 8), o.tailColor ?? shade(skin, -0.2), 0, -0.22, 0, { r: [Math.PI, 0, 0] });
    P.tail = tg;
  }

  // ---------------------------------------------------------------- weapon and wings
  if (o.weapon) attachHeroWeapon(P, o.weapon, out, o);
  P.wings = buildWings(o.wingColor || '#9fe8ff');
  P.wings.position.set(0, 1.0, -0.24); P.wings.visible = !!o.wings; bodyG.add(P.wings);

  root.userData.parts = P;
  root.userData.height = 2.1;
  const hs = 0.92 + (o.height ?? 0.5) * 0.16;
  const sc = (o.scale || 1) * hs * (race === 'sylvan' ? 1.03 : 1);
  if (sc !== 1) root.scale.setScalar(sc);
  return root;
}

function decorateFace(face, surf, o, race, skin, ex) {
  const at = (x, y, dz = 0.003) => surf(x, y) + dz;
  const mk = o.makeup || 'none', mc = new THREE.Color(o.makeupColor || '#c0304a').getHex();
  if (mk === 'liner') for (const s of [-1, 1]) part(face, box(0.06, 0.012, 0.01), 0x1a1010, ex * s + 0.035 * s, 0.035, at(ex * s + 0.035 * s, 0.035), { r: [0, 0, 0.35 * s] });
  if (mk === 'rouge') for (const s of [-1, 1]) part(face, blob(0.05, 0.028, 0.01, 2), soft(0xff7a8a, { transparent: true, opacity: 0.55 }), (ex + 0.05) * s, -0.07, at((ex + 0.05) * s, -0.07, 0.001));
  if (mk === 'warpaint') for (const s of [-1, 1]) for (let i = 0; i < 2; i++) part(face, box(0.11, 0.014, 0.01), mc, (ex + 0.04) * s, -0.05 - i * 0.035, at((ex + 0.04) * s, -0.05 - i * 0.035), { r: [0, 0, 0.2 * s] });
  const scar = o.scar || 'none', scol = shade(skin, 0.35);
  if (scar === 'cheek') { part(face, box(0.09, 0.012, 0.01), scol, -0.17, -0.08, at(-0.17, -0.08), { r: [0, 0, 0.7] }); part(face, box(0.05, 0.01, 0.01), scol, -0.17, -0.08, at(-0.17, -0.08, 0.004), { r: [0, 0, -0.6] }); }
  if (scar === 'eye') part(face, box(0.012, 0.16, 0.01), scol, ex + 0.01, 0.0, at(ex + 0.01, 0, 0.012), { r: [0, 0, 0.18] });
  if (scar === 'nose') part(face, box(0.11, 0.012, 0.01), scol, 0, -0.04, at(0, -0.04, 0.03), { r: [0, 0, -0.35] });
  if (scar === 'chin') part(face, box(0.012, 0.06, 0.01), scol, 0.04, -0.24, at(0.04, -0.24), { r: [0, 0, 0.3] });
  const tat = o.tattoo || 'none';
  const glowy = race === 'sylvan';
  const tm = glowy ? glow(new THREE.Color(o.tattooColor || '#5ff0d8').getHex()) : soft(new THREE.Color(o.tattooColor || '#2a4a6a').getHex());
  if (tat === 'tribal') for (const s of [-1, 1]) { part(face, box(0.1, 0.014, 0.01), tm, (ex + 0.06) * s, -0.04, at((ex + 0.06) * s, -0.04), { r: [0, 0, -0.5 * s] }); part(face, box(0.07, 0.014, 0.01), tm, (ex + 0.08) * s, -0.09, at((ex + 0.08) * s, -0.09), { r: [0, 0, 0.4 * s] }); }
  if (tat === 'runes') { part(face, box(0.014, 0.08, 0.01), tm, 0, 0.17, at(0, 0.17)); part(face, box(0.06, 0.014, 0.01), tm, 0, 0.19, at(0, 0.19)); }
  if (tat === 'spirals') for (const s of [-1, 1]) part(face, tor(0.03, 0.008, Math.PI * 1.6), tm, (ex + 0.07) * s, -0.06, at((ex + 0.07) * s, -0.06));
  if (tat === 'dots') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) part(face, sph(0.012, 6, 4), tm, (ex - 0.02 + i * 0.03) * s, -0.13 + i * 0.012, at((ex - 0.02 + i * 0.03) * s, -0.13));
  if (race === 'draken') for (const s of [-1, 1]) for (let i = 0; i < 3; i++) part(face, blob(0.022, 0.018, 0.008, 3), shade(skin, -0.22), (ex + 0.07 + i * 0.022) * s, 0.05 - i * 0.03, at((ex + 0.07 + i * 0.022) * s, 0.05 - i * 0.03, 0));
}

function beastEars(head, hy, ha, kind, hair) {
  const inner = 0xffc8b8;
  for (const s of [-1, 1]) {
    const g = grp(head, 0.2 * s, hy + 0.3, -0.04, [-0.15, 0, -0.32 * s]);
    const tall = kind === 'fox' ? 0.24 : kind === 'cat' ? 0.17 : 0.21;
    part(g, cone(0.09, tall, 4), hair, 0, tall / 2, 0, { s: [1, 1, 0.55], r: [0, Math.PI / 4, 0] });
    part(g, cone(0.05, tall * 0.7, 4), inner, 0, tall * 0.4, 0.025, { s: [1, 1, 0.4], r: [0, Math.PI / 4, 0] });
    if (kind === 'fox') part(g, cone(0.04, 0.06, 4), 0x2a1a14, 0, tall - 0.02, 0, { r: [0, Math.PI / 4, 0] });
  }
}
function beastTail(bodyG, kind, hair) {
  const g = grp(bodyG, 0, 0.64, -0.2, [0.95, 0, 0]);
  if (kind === 'cat') {
    for (let i = 0; i < 5; i++) part(g, blob(0.04, 0.07, 0.04, 2), hair, 0, -0.06 - i * 0.1, Math.sin(i * 0.8) * 0.05);
  } else {
    part(g, blob(0.11, 0.25, 0.11, 2, kind === 'fox' ? 0.6 : 0.4), hair, 0, -0.25, 0);
    if (kind === 'fox') part(g, blob(0.07, 0.09, 0.07, 2), 0xffffff, 0, -0.48, 0);
  }
}

function buildHair(head, hy, ha, hb, hc, style, hair, hidden, hat) {
  if (style === 'bald') return;
  const H = grp(head, 0, hy, 0);
  const capOnly = hidden;
  // the cap always sits on the skull (under hats it keeps the sides from looking bald)
  if (!capOnly || hat === 'none') {
    part(H, blob(ha + 0.03, hb + 0.03, hc + 0.03, 2.5, 0, { t0: 0, tl: Math.PI * 0.46 }), soft(hair, DS), 0, 0.01, -0.012);
    part(H, blob(ha + 0.035, hb + 0.02, hc + 0.03, 2.5, 0, { t0: 0, tl: Math.PI * 0.8, p0: Math.PI * 0.9, pl: Math.PI * 1.2 }), soft(hair, DS), 0, -0.01, -0.015);
  }
  if (capOnly) {
    if (style === 'long' || style === 'braid' || style === 'ponytail' || style === 'twin') part(H, blob(0.22, 0.24, 0.07, 2.4, 0.3), hair, 0, -0.3, -0.27);
    return;
  }
  const lock = (x, y, z, a, b, c, rz = 0, rx = 0) => part(H, blob(a, b, c, 2.2), hair, x, y, z, { r: [rx, 0, rz] });
  switch (style) {
    case 'short':
      lock(-0.14, 0.22, 0.24, 0.13, 0.07, 0.08, 0.35); lock(0.06, 0.25, 0.25, 0.14, 0.07, 0.08, -0.2); lock(0.23, 0.2, 0.2, 0.08, 0.07, 0.07, -0.5);
      break;
    case 'messy':
      lock(-0.15, 0.22, 0.25, 0.12, 0.08, 0.08, 0.6); lock(0.02, 0.27, 0.25, 0.12, 0.08, 0.08, -0.1); lock(0.19, 0.22, 0.22, 0.1, 0.08, 0.08, -0.7);
      lock(-0.25, 0.3, 0.02, 0.09, 0.12, 0.08, 0.6); lock(0.24, 0.31, -0.02, 0.09, 0.12, 0.08, -0.6); lock(0, 0.36, -0.12, 0.1, 0.1, 0.1, 0, -0.4);
      break;
    case 'spiky':
      for (const [x, y, z, rx, rz] of [[0, 0.36, 0.08, 0.5, 0], [0.18, 0.32, 0.02, 0.2, -0.6], [-0.18, 0.32, 0.02, 0.2, 0.6], [0, 0.3, -0.2, -0.7, 0], [0.2, 0.22, -0.18, -0.6, -0.7], [-0.2, 0.22, -0.18, -0.6, 0.7]]) part(H, cone(0.1, 0.26, 7), hair, x, y, z, { r: [rx, 0, rz] });
      lock(-0.1, 0.22, 0.26, 0.12, 0.06, 0.07, 0.4); lock(0.1, 0.22, 0.26, 0.12, 0.06, 0.07, -0.4);
      break;
    case 'long':
      lock(-0.12, 0.23, 0.25, 0.15, 0.07, 0.08, 0.5); lock(0.13, 0.23, 0.25, 0.15, 0.07, 0.08, -0.5);
      part(H, blob(0.33, 0.36, 0.12, 2.6, 0.25), hair, 0, -0.2, -0.22);
      for (const s of [-1, 1]) part(H, blob(0.07, 0.26, 0.08, 2.4), hair, (ha + 0.01) * s, -0.16, 0.08);
      break;
    case 'bob':
      lock(0, 0.24, 0.25, 0.26, 0.07, 0.08);
      for (const s of [-1, 1]) part(H, blob(0.09, 0.2, 0.17, 2.4), hair, (ha + 0.015) * s, -0.06, 0.0);
      part(H, blob(0.3, 0.2, 0.12, 2.6), hair, 0, -0.08, -0.22);
      break;
    case 'ponytail':
      lock(-0.13, 0.23, 0.25, 0.14, 0.07, 0.08, 0.45); lock(0.12, 0.24, 0.25, 0.13, 0.07, 0.08, -0.3);
      part(H, sph(0.06), 0x8a4a3a, 0, 0.18, -0.33);
      part(H, blob(0.09, 0.26, 0.09, 2.2, 0.4), hair, 0, -0.06, -0.4, { r: [0.3, 0, 0] });
      break;
    case 'bun':
      lock(0, 0.24, 0.25, 0.25, 0.06, 0.08);
      part(H, blob(0.13, 0.12, 0.13, 2.2), hair, 0, 0.35, -0.16);
      break;
    case 'twin':
      lock(-0.12, 0.23, 0.25, 0.15, 0.07, 0.08, 0.5); lock(0.13, 0.23, 0.25, 0.15, 0.07, 0.08, -0.5);
      for (const s of [-1, 1]) { part(H, blob(0.09, 0.26, 0.09, 2.2, 0.3), hair, (ha + 0.09) * s, -0.12, -0.08, { r: [0, 0, 0.25 * s] }); part(H, sph(0.05), 0xff6a8a, (ha + 0.02) * s, 0.12, -0.08); }
      break;
    case 'braid':
      lock(-0.12, 0.23, 0.25, 0.15, 0.07, 0.08, 0.5); lock(0.13, 0.23, 0.25, 0.15, 0.07, 0.08, -0.5);
      for (let i = 0; i < 5; i++) part(H, blob(0.075 - i * 0.006, 0.07, 0.075 - i * 0.006, 2), hair, 0, -0.12 - i * 0.11, -0.32 - i * 0.015);
      break;
    case 'mohawk':
      for (let i = 0; i < 5; i++) part(H, blob(0.05, 0.12, 0.08, 2.2), hair, 0, 0.32 - Math.abs(i - 1) * 0.04, 0.2 - i * 0.12, { r: [-0.3 * i, 0, 0] });
      break;
    case 'curly':
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; part(H, sph(0.09, 10, 8), hair, Math.sin(a) * (ha - 0.02), 0.2 + Math.cos(a * 2) * 0.05, Math.cos(a) * (hc - 0.02) - 0.04); }
      lock(0, 0.33, 0, 0.2, 0.08, 0.2);
      break;
  }
}

function buildBeard(face, surf, style, color, skin) {
  if (!style || style === 'none') return;
  const c = new THREE.Color(color).getHex();
  if (style === 'stubble') { part(face, blob(0.22, 0.12, 0.08, 2.4), soft(shade(skin, -0.22), { transparent: true, opacity: 0.55 }), 0, -0.17, surf(0, -0.17) - 0.07); return; }
  if (style === 'mustache' || style === 'goatee' || style === 'full' || style === 'braided') {
    for (const s of [-1, 1]) part(face, blob(0.07, 0.03, 0.03, 2.2), c, 0.05 * s, -0.12, surf(0.05, -0.12) + 0.01, { r: [0, 0, 0.35 * s] });
  }
  if (style === 'goatee') part(face, blob(0.06, 0.07, 0.05, 2.2), c, 0, -0.26, surf(0, -0.24) - 0.02);
  if (style === 'full' || style === 'braided') {
    part(face, blob(0.27, 0.17, 0.17, 2.4, 0.4), c, 0, -0.25, surf(0, -0.2) - 0.12);
    part(face, blob(0.18, 0.11, 0.1, 2.2), c, 0, -0.38, surf(0, -0.2) - 0.05);
    if (style === 'braided') for (let i = 0; i < 3; i++) part(face, blob(0.045, 0.05, 0.045, 2), c, 0, -0.49 - i * 0.07, surf(0, -0.2) - 0.03);
  }
}

function buildHood(head, hy, ha, hb, hc, color, out) {
  const g = grp(head, 0, hy, 0);
  part(g, blob(ha + 0.07, hb + 0.07, hc + 0.05, 2.4, 0, { t0: 0, tl: Math.PI * 0.62 }), soft(color, DS), 0, 0.02, -0.07);
  part(g, blob(ha + 0.08, hb + 0.02, hc + 0.02, 2.4, 0, { t0: 0, tl: Math.PI, p0: Math.PI * 0.85, pl: Math.PI * 1.3 }), soft(color, DS), 0, -0.02, -0.08);
  part(g, cone(0.1, 0.22, 8), color, 0, 0.1, -0.42, { r: [-1.9, 0, 0] });
  part(g, tor(ha + 0.06, 0.035, Math.PI * 1.15), shade(color, -0.15), 0, 0.02, 0.17, { r: [0, 0, -Math.PI * 0.075], s: [1, 1.05, 1] });
}

function buildHat(head, hy, ha, hb, hc, hat, o, out) {
  const hcol = o.hatColor ?? out.main;
  if (hat === 'none') return;
  const g = grp(head, 0, hy, 0);
  if (hat === 'helm') { // open-faced knight helmet with cheek guards and a plume
    const steel = soft(hcol, { emissive: new THREE.Color(hcol).multiplyScalar(0.08) });
    part(g, blob(ha + 0.05, hb + 0.05, hc + 0.05, 2.6, 0, { t0: 0, tl: Math.PI * 0.5 }), soft(hcol, { ...DS, emissive: new THREE.Color(hcol).multiplyScalar(0.08) }), 0, 0.01, -0.01);
    part(g, blob(ha + 0.055, hb + 0.03, hc + 0.04, 2.6, 0, { t0: Math.PI * 0.5, tl: Math.PI * 0.32, p0: Math.PI * 1.05, pl: Math.PI * 0.9 }), soft(hcol, DS), 0, 0.0, -0.01);
    for (const s of [-1, 1]) part(g, blob(0.07, 0.17, 0.15, 2.6), steel, (ha + 0.02) * s, -0.08, 0.1);
    part(g, blob(ha + 0.07, 0.035, hc + 0.07, 3), steel, 0, 0.13, 0.0);
    part(g, box(0.04, 0.16, 0.03), steel, 0, 0.06, hc + 0.05);
    for (let i = 0; i < 6; i++) part(g, blob(0.06, 0.1, 0.08, 2), o.plume ?? out.accent, 0, hb + 0.1 - i * 0.035, 0.12 - i * 0.09, { r: [-0.3 - i * 0.28, 0, 0] });
  } else if (hat === 'witch') { // wide brim, tall bent cone, band and buckle
    const hg = grp(g, 0, hb - 0.02, -0.02, [-0.12, 0, 0]);
    part(hg, cyl(0.62, 0.62, 0.035, 28), soft(hcol, DS), 0, 0, 0);
    part(hg, cone(0.32, 0.52, 18), hcol, 0, 0.27, 0);
    part(hg, cone(0.17, 0.36, 12), hcol, 0.05, 0.6, -0.08, { r: [-0.55, 0, -0.35] });
    part(hg, cyl(0.325, 0.325, 0.09, 18), out.trim, 0, 0.06, 0);
    part(hg, blob(0.06, 0.05, 0.02, 3), out.accent, 0, 0.06, 0.32);
  } else if (hat === 'circlet') {
    part(g, tor(ha + 0.02, 0.022), out.trim, 0, 0.16, 0, { r: [Math.PI / 2 - 0.12, 0, 0], s: [1, (hc + 0.02) / (ha + 0.02), 1] });
    const gem = new THREE.Mesh(G('heroGem', () => new THREE.OctahedronGeometry(0.05)), glow(0x5fd0ff)); gem.position.set(0, 0.2, hc + 0.02); g.add(gem);
  } else if (hat === 'cowboy' || hat === 'feather') { // ranger hat with a feather
    part(g, cyl(0.5, 0.5, 0.035, 22), soft(hcol, DS), 0, hb - 0.02, 0, { r: [-0.08, 0, 0] });
    part(g, blob(0.27, 0.15, 0.26, 2.6, 0.3), hcol, 0, hb + 0.1, -0.02);
    part(g, cyl(0.28, 0.28, 0.05, 18), 0xa04a2a, 0, hb + 0.03, -0.02);
    if (hat === 'feather' || o.feather) part(g, blob(0.03, 0.22, 0.06, 2), o.featherColor ?? 0xd84a3a, 0.25, hb + 0.18, -0.08, { r: [-0.4, 0, -0.5] });
  } else if (hat === 'scarf') { // bandana
    part(g, blob(ha + 0.035, hb * 0.55, hc + 0.035, 2.5, 0, { t0: 0, tl: Math.PI * 0.42 }), soft(out.accent, DS), 0, 0.1, -0.01);
    part(g, blob(0.06, 0.05, 0.05, 2), out.accent, 0, 0.0, -hc - 0.04);
    for (const s of [-1, 1]) part(g, blob(0.03, 0.09, 0.02, 2), out.accent, 0.04 * s, -0.08, -hc - 0.04, { r: [0, 0, 0.4 * s] });
  } else if (hat === 'pelt') { // a bear's head worn as a hood
    const fur = o.hatColor ?? 0x6a4a32;
    part(g, blob(ha + 0.07, hb + 0.06, hc + 0.08, 2.4, 0, { t0: 0, tl: Math.PI * 0.5 }), soft(fur, DS), 0, 0.03, -0.03);
    part(g, blob(ha + 0.075, hb + 0.03, hc + 0.06, 2.4, 0, { t0: Math.PI * 0.5, tl: Math.PI * 0.3, p0: Math.PI, pl: Math.PI }), soft(fur, DS), 0, 0.03, -0.03);
    part(g, blob(0.15, 0.1, 0.15, 2.2), fur, 0, hb * 0.62, hc * 0.72); // snout over the brow
    part(g, blob(0.1, 0.06, 0.06, 2.2), 0xc89a7a, 0, hb * 0.55, hc * 0.72 + 0.12);
    part(g, blob(0.055, 0.04, 0.04, 2.2), 0x2a1a14, 0, hb * 0.62, hc * 0.72 + 0.16);
    for (const s of [-1, 1]) { part(g, sph(0.08, 10, 8), fur, 0.2 * s, hb + 0.04, -0.02); part(g, sph(0.045, 8, 6), 0xc89a7a, 0.2 * s, hb + 0.05, 0.03); part(g, sph(0.024, 6, 4), 0x1a1210, 0.075 * s, hb * 0.78, hc * 0.72 + 0.06); }
    part(g, blob(0.3, 0.3, 0.12, 2.4, 0.3), fur, 0, -0.22, -0.3); // fur down the back
  } else if (hat === 'antlers') { // summoner's leafy cowl with antlers
    const leaf = o.hatColor ?? 0x3a6a3a;
    part(g, blob(ha + 0.06, hb * 0.6, hc + 0.06, 2.4, 0, { t0: 0, tl: Math.PI * 0.5 }), soft(leaf, DS), 0, 0.05, -0.02);
    for (let i = 0; i < 6; i++) { const a = (i / 5 - 0.5) * 2.2; part(g, blob(0.07, 0.04, 0.11, 2), shade(leaf, i % 2 ? 0.15 : -0.05), Math.sin(a) * (ha + 0.04), 0.14, Math.cos(a) * (hc + 0.02), { r: [0.4, a, 0] }); }
    const bone = 0xeadcc0;
    for (const s of [-1, 1]) {
      const ag = grp(g, 0.18 * s, hb, 0, [0, 0, -0.45 * s]);
      part(ag, cyl(0.025, 0.035, 0.36, 6), bone, 0, 0.18, 0);
      part(ag, cyl(0.018, 0.024, 0.2, 6), bone, 0.06 * s, 0.24, 0, { r: [0, 0, -0.9 * s] });
      part(ag, cyl(0.016, 0.022, 0.18, 6), bone, -0.04 * s, 0.33, 0.02, { r: [0.3, 0, 0.7 * s] });
      part(ag, cyl(0.014, 0.02, 0.15, 6), bone, 0.03 * s, 0.42, 0, { r: [0, 0, -0.5 * s] });
    }
  } else if (hat === 'crown') {
    part(g, cyl(ha * 0.75, ha * 0.78, 0.1, 16), soft(0xf0c24a, { emissive: 0x3a2a00 }), 0, hb + 0.02, 0);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; part(g, cone(0.04, 0.1, 4), 0xf0c24a, Math.sin(a) * ha * 0.75, hb + 0.11, Math.cos(a) * ha * 0.75); }
  }
}

// ---------------------------------------------------------------- weapons
function attachHeroWeapon(P, kind, out, o) {
  const w = new THREE.Group();
  // where weapon glows and element effects run (weaponfx.js): a segment along each blade, in that object's own space
  P.wfx = [];
  const seg = (obj, a, b) => P.wfx.push({ o: obj, a, b });
  const steel = soft(0xdfe6f0, { emissive: 0x161a20 }), wood = 0x7a4a2a, grip = 0x4a2e1e;
  if (kind === 'sword' || kind === 'runesword') {
    const rune = kind === 'runesword';
    part(w, box(0.085, 0.78, 0.035), steel, 0, 0.55, 0);
    part(w, cone(0.06, 0.14, 4), steel, 0, 1.01, 0, { r: [0, Math.PI / 4, 0], s: [1, 1, 0.45] });
    if (rune) for (let i = 0; i < 4; i++) part(w, box(0.03, 0.08, 0.04), glow(out.accent), 0, 0.3 + i * 0.16, 0);
    part(w, blob(0.2, 0.04, 0.06, 2.6), out.trim, 0, 0.14, 0);
    part(w, cyl(0.035, 0.035, 0.2, 8), grip, 0, 0.02, 0);
    part(w, sph(0.05), out.accent, 0, -0.1, 0);
    w.rotation.x = Math.PI / 2 - 0.25;
    P.handR.add(w); seg(w, [0, 0.22, 0], [0, 1.06, 0]);
    if (!rune) { // heater shield
      const sh = grp(P.handL, 0.13, 0.1, 0.1, [0, 0.55, 0]);
      part(sh, blob(0.3, 0.34, 0.05, 2.6, -0.45), out.accent, 0, 0, 0);
      part(sh, blob(0.32, 0.36, 0.04, 2.6, -0.45), out.trim, 0, 0, -0.012);
      part(sh, blob(0.06, 0.2, 0.02, 3), o.emblem ?? out.trim, 0, 0.02, 0.05);
      part(sh, blob(0.16, 0.05, 0.02, 3), o.emblem ?? out.trim, 0, 0.08, 0.05);
      P.shield = sh;
    }
  } else if (kind === 'greataxe') {
    part(w, cyl(0.04, 0.045, 1.5, 8), wood, 0, 0.3, 0);
    for (let i = 0; i < 3; i++) part(w, cyl(0.048, 0.048, 0.05, 8), 0x3a2a1e, 0, -0.1 + i * 0.12, 0);
    for (const s of [-1, 1]) part(w, blob(0.22, 0.2, 0.03, 2.2, -0.5), steel, 0.2 * s, 0.86, 0, { r: [0, 0, s * Math.PI / 2] });
    part(w, blob(0.07, 0.12, 0.07, 2.6), 0x8a8f9a, 0, 0.86, 0);
    part(w, cone(0.05, 0.16, 6), steel, 0, 1.1, 0);
    w.rotation.set(0.25, 0, -0.15); w.position.y = -0.1;
    P.handR.add(w); seg(w, [-0.36, 0.86, 0], [0.36, 0.86, 0]); seg(w, [0, 0.55, 0], [0, 1.16, 0]);
  } else if (kind === 'daggers') {
    for (const h of [P.handR, P.handL]) {
      const d = new THREE.Group();
      part(d, box(0.06, 0.38, 0.025), steel, 0, 0.26, 0);
      part(d, cone(0.042, 0.1, 4), steel, 0, 0.5, 0, { r: [0, Math.PI / 4, 0], s: [1, 1, 0.5] });
      part(d, blob(0.11, 0.03, 0.04, 2.6), out.accent, 0, 0.07, 0);
      part(d, cyl(0.03, 0.03, 0.14, 6), 0x2a2030, 0, 0, 0);
      d.rotation.x = Math.PI / 2 - 0.1;
      h.add(d); seg(d, [0, 0.12, 0], [0, 0.54, 0]);
    }
  } else if (kind === 'bow') {
    const b = grp(P.handL, 0.03, 0, 0.02);
    const arc = Math.PI * 0.62, R = 0.62;
    part(b, tor(R, 0.032, arc, 6, 18), wood, 0, 0, -R, { r: [0, -Math.PI / 2, -arc / 2] });
    for (const s of [-1, 1]) part(b, sph(0.04, 8, 6), out.trim, 0, R * Math.sin(arc / 2) * s, R * Math.cos(arc / 2) - R);
    part(b, blob(0.05, 0.11, 0.05, 2.6), grip, 0, 0, 0);
    const str = part(b, cyl(0.007, 0.007, 2 * R * Math.sin(arc / 2), 4), 0xf4f0e0, 0, 0, R * Math.cos(arc / 2) - R);
    P.string = str;
    const tip = R * Math.cos(arc / 2) - R, end = R * Math.sin(arc / 2);
    seg(b, [0, -end, tip], [0, -0.1, -0.01]); seg(b, [0, 0.1, -0.01], [0, end, tip]);
    P.bow = b; P.weapon = b;
    return;
  } else if (kind === 'staff') {
    part(w, cyl(0.035, 0.045, 1.55, 8), wood, 0, 0.3, 0);
    part(w, tor(0.12, 0.03, Math.PI * 1.5), out.trim, 0, 1.13, 0, { r: [0, 0, Math.PI * 0.25] });
    const orb = new THREE.Mesh(sph(0.1), glow(o.orbColor ?? 0xff8a3a)); orb.position.y = 1.13; w.add(orb);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: o.orbColor ?? 0xff7a2a, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(0.6); halo.position.y = 1.13; w.add(halo);
    w.rotation.x = 0.1;
    P.handR.add(w); seg(w, [0, 0.62, 0], [0, 1.24, 0]);
  } else if (kind === 'scepter') {
    part(w, cyl(0.03, 0.035, 0.8, 8), out.trim, 0, 0.25, 0);
    const gem = new THREE.Mesh(G('heroGemL', () => new THREE.OctahedronGeometry(0.11)), glow(0x6fd8ff)); gem.position.y = 0.76; gem.scale.y = 1.5; w.add(gem);
    for (const s of [-1, 1]) part(w, blob(0.12, 0.04, 0.03, 2.2), 0xffffff, 0.12 * s, 0.66, 0, { r: [0, 0, s * 0.5] });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6fd8ff, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(0.5); halo.position.y = 0.76; w.add(halo);
    w.rotation.x = Math.PI / 2 - 0.5;
    P.handR.add(w); seg(w, [0, 0.3, 0], [0, 0.9, 0]);
    if (o.offOrb !== false) {
      const orb = new THREE.Mesh(sph(0.12), glow(0x8ae0ff)); orb.position.set(0, 0.22, 0.12);
      const h2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6fd8ff, blending: THREE.AdditiveBlending, depthWrite: false }));
      h2.scale.setScalar(0.6); orb.add(h2);
      P.handL.add(orb); P.orb = orb;
    }
  } else if (kind === 'tome') {
    const bk = grp(P.handL, 0.0, 0.05, 0.14, [0.9, 0, 0]);
    part(bk, box(0.32, 0.05, 0.24), out.accent, 0, 0, 0);
    part(bk, box(0.29, 0.055, 0.21), 0xf4ead0, 0.01, 0.005, 0);
    part(bk, box(0.02, 0.06, 0.24), out.trim, -0.15, 0, 0);
    part(bk, blob(0.05, 0.02, 0.05, 2.2), glow(0xb8ff9a), 0, 0.035, 0);
    const wisp = new THREE.Mesh(sph(0.08), glow(0xb8ff9a)); wisp.position.set(0, 0.32, 0.18);
    const h3 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9aff7a, blending: THREE.AdditiveBlending, depthWrite: false }));
    h3.scale.setScalar(0.5); wisp.add(h3);
    P.handR.add(wisp); P.orb = wisp;
    seg(bk, [-0.14, 0.05, 0], [0.14, 0.05, 0]); seg(wisp, [0, -0.06, 0], [0, 0.1, 0]);
    P.weapon = bk;
    return;
  } else if (kind === 'spear') {
    part(w, cyl(0.03, 0.03, 2.0, 8), 0x8a5a3a, 0, 0.5, 0);
    part(w, cone(0.08, 0.32, 4), steel, 0, 1.6, 0);
    part(w, sph(0.06), 0xd04a3a, 0, 1.4, 0);
    P.handR.add(w);
  } else if (kind === 'hammer') {
    part(w, cyl(0.035, 0.035, 0.7, 8), wood, 0, 0.25, 0);
    part(w, blob(0.19, 0.12, 0.12, 3), 0x8a8f9a, 0, 0.62, 0);
    w.rotation.x = 0.3;
    P.handR.add(w);
  } else if (kind === 'oldstaff') {
    part(w, cyl(0.04, 0.05, 1.8, 8), 0x6a4a2a, 0, 0.4, 0);
    part(w, blob(0.15, 0.11, 0.13, 2), 0x5aa84a, 0.05, 1.32, 0);
    P.handR.add(w);
  } else if (kind === 'orb') {
    const orb = new THREE.Mesh(sph(0.14), glow(0xc07aff)); orb.position.set(0, 0.25, 0.15);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xb06aff, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(0.8); orb.add(halo);
    P.handR.add(orb); P.orb = orb;
  }
  P.weapon = w;
}

// ---------------------------------------------------------------- fairy wings (same as before)
export function buildWings(color = '#9fe8ff', size = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: wingTexture(color), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9 });
  const geo = G('wingplane', () => { const p = new THREE.PlaneGeometry(1, 1); p.translate(0.5, 0.5, 0); return p; });
  const make = (s, upper) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(upper ? 0.9 * size : 0.6 * size, upper ? 0.9 * size : 0.55 * size, 1);
    if (!upper) m.rotation.z = -Math.PI / 2 - 0.2;
    m.raycast = () => {};
    pivot.add(m); pivot.scale.x = s; pivot.rotation.y = s * 0.5;
    return pivot;
  };
  g.userData.pairs = [];
  for (const s of [1, -1]) { const up = make(s, true), lo = make(s, false); g.add(up); g.add(lo); g.userData.pairs.push({ s, up, lo }); }
  return g;
}

// ---------------------------------------------------------------- appearance from saves or from the network
const HEX = /^#[0-9a-f]{6}$/i;
const n01 = (v, d = 0.5) => (Number.isFinite(+v) ? Math.max(0, Math.min(1, +v)) : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
export function cleanApp(a) {
  if (!a || typeof a !== 'object') return null;
  return {
    race: oneOf(a.race, ['human', 'sylvan', 'draken', 'beastkin'], 'human'), body: a.body === 'a' ? 'a' : 'b', beast: oneOf(a.beast, BEAST_KINDS, 'wolf'),
    skin: HEX.test(a.skin) ? a.skin : '#f2cdb4', hair: HEX.test(a.hair) ? a.hair : '#6a4024', eye: HEX.test(a.eye) ? a.eye : '#3a2a20',
    hairStyle: oneOf(a.hairStyle, HAIR_STYLES, undefined), beardStyle: oneOf(a.beardStyle, BEARD_STYLES, 'none'), face: oneOf(a.face, FACE_SHAPES, 'round'),
    faceW: n01(a.faceW), eyeSize: n01(a.eyeSize), noseSize: n01(a.noseSize), build: n01(a.build), height: n01(a.height), voice: n01(a.voice),
    makeup: oneOf(a.makeup, MAKEUP, 'none'), makeupColor: HEX.test(a.makeupColor) ? a.makeupColor : '#c0304a', scar: oneOf(a.scar, SCARS, 'none'),
    tattoo: oneOf(a.tattoo, TATTOOS, 'none'), tattooColor: HEX.test(a.tattooColor) ? a.tattooColor : undefined, helm: a.helm !== false,
  };
}

// share codes for appearance presets: "AET1." + base64 of the cleaned appearance
export function encodeApp(a) {
  const c = cleanApp(a);
  return 'AET1.' + btoa(JSON.stringify(c)).replace(/=+$/, ''); // the appearance is plain ASCII
}
export function decodeApp(code) {
  try {
    const m = /^AET1\.([A-Za-z0-9+/]+)$/.exec(String(code).trim());
    if (!m) return null;
    return cleanApp(JSON.parse(atob(m[1])));
  } catch { return null; }
}
