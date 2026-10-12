// Procedural chibi models: players, NPCs, monsters, pets, mounts and sprites. Forward is +Z, feet at y=0.
import * as THREE from 'three';
import { glow, mesh, outline, critterFace, facePatch, glowTexture } from './toon.js';
import { buildHero, buildWings } from './models-hero.js';

const gcache = new Map();
function G(key, fn) { if (!gcache.has(key)) gcache.set(key, fn()); return gcache.get(key); }
const sph = (r, w = 18, h = 14) => G(`s${r}|${w}|${h}`, () => new THREE.SphereGeometry(r, w, h));
const cap = (r, l, s = 6, rs = 12) => G(`c${r}|${l}`, () => new THREE.CapsuleGeometry(r, l, s, rs));
const cyl = (a, b, h, s = 14) => G(`y${a}|${b}|${h}|${s}`, () => new THREE.CylinderGeometry(a, b, h, s));
const cone = (r, h, s = 12) => G(`o${r}|${h}|${s}`, () => new THREE.ConeGeometry(r, h, s));
const box = (x, y, z) => G(`b${x}|${y}|${z}`, () => new THREE.BoxGeometry(x, y, z));
const tor = (r, t, rs = 8, ts = 20, arc = Math.PI * 2) => G(`t${r}|${t}|${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc));

function add(parent, m, x = 0, y = 0, z = 0) { m.position.set(x, y, z); parent.add(m); return m; }
function part(geo, color, x, y, z, { sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0, ow = 0.025, opts } = {}) {
  const avg = (sx + sy + sz) / 3;
  const m = mesh(geo, color, { outlineW: ow > 0 ? Math.round((ow / avg) * 1000) / 1000 : 0, opts });
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rx, ry, rz);
  return m;
}
const DS = { side: THREE.DoubleSide };

// ---------------------------------------------------------------- Humanoid (built in models-hero.js)
export const HAIR_COLORS = ['#f2d27a', '#ff9ec7', '#7fd0ff', '#b48cff', '#5a3a2a', '#f5f5f5', '#ff6a4a', '#2a2a3a'];
export const EYE_COLORS = ['#3a6fd8', '#2fae6a', '#c0462e', '#8a4ad8', '#d89a2a'];

export function buildHumanoid(o = {}) { return buildHero(o); }

function animateWings(w, t, fast = 1) {
  if (!w || !w.visible) return;
  for (const p of w.userData.pairs) {
    const a = 0.45 + Math.sin(t * 6 * fast) * 0.35;
    p.up.rotation.y = p.s * a; p.lo.rotation.y = p.s * (a * 0.8);
  }
}

const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
// state: idle | run | attack | heavy | shoot | cast | block | roll | ride | dead | chop | mine | harvest
// a = 0..1 progress for one-shot actions
export function animateHumanoid(model, state, t, a = 0, speed = 1) {
  const P = model.userData.parts; if (!P) return;
  const reset = (g) => g && g.rotation.set(0, 0, 0);
  [P.legL, P.legR, P.armL, P.armR].forEach(reset);
  P.body.position.set(0, 0, 0); P.body.rotation.set(0, 0, 0); P.head.rotation.set(0, 0, 0);
  const ss = (e0, e1, x) => { const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return u * u * (3 - 2 * u); };
  if (P.bow && state !== 'shoot') P.bow.quaternion.identity();
  if (state === 'run') {
    const ph = t * 11 * speed;
    P.legL.rotation.x = Math.sin(ph) * 0.85; P.legR.rotation.x = -Math.sin(ph) * 0.85;
    P.armL.rotation.x = -Math.sin(ph) * 0.8; P.armR.rotation.x = Math.sin(ph) * 0.8;
    P.armL.rotation.z = 0.15; P.armR.rotation.z = -0.15;
    P.body.position.y = Math.abs(Math.sin(ph)) * 0.08; P.body.rotation.x = 0.12;
  } else if (state === 'ride') {
    P.legL.rotation.set(-1.35, 0, 0.35); P.legR.rotation.set(-1.35, 0, -0.35);
    P.armL.rotation.x = -0.6; P.armR.rotation.x = -0.6;
    P.body.position.y = Math.sin(t * 9) * 0.03;
  } else if (state === 'attack') {
    const k = a < 0.35 ? a / 0.35 : 1 - (a - 0.35) / 0.65;
    const swing = a < 0.35 ? -2.6 * (a / 0.35) : -2.6 + 3.4 * Math.min(1, (a - 0.35) / 0.3);
    P.armR.rotation.x = swing * (1 - Math.max(0, (a - 0.7) / 0.3));
    P.armR.rotation.z = -0.3 * k;
    P.armL.rotation.x = -0.6 * k;
    P.body.rotation.y = -0.35 * k;
    P.body.rotation.x = 0.15 * k;
    P.legL.rotation.x = -0.3 * k; P.legR.rotation.x = 0.3 * k;
  } else if (state === 'heavy') { // two-handed overhead chop (greataxe)
    const up = ss(0, 0.4, a) * (1 - ss(0.4, 0.55, a)), down = ss(0.4, 0.55, a) * (1 - ss(0.75, 1, a));
    const ax = -0.6 - 2.3 * up + 0.5 * down;
    P.armR.rotation.set(ax, 0, 0.3); P.armL.rotation.set(ax, 0, -0.3);
    P.body.rotation.x = -0.2 * up + 0.45 * down; P.body.position.y = -0.08 * down;
    P.legL.rotation.x = -0.45 * down; P.legR.rotation.x = 0.3 * down;
  } else if (state === 'shoot') { // draw the bow string back, then loose
    const draw = ss(0, 0.55, a) * (1 - ss(0.75, 1, a)), aim = Math.min(1, a / 0.2) * (1 - ss(0.8, 1, a));
    P.body.rotation.y = -0.65 * aim;
    P.armL.rotation.set(-1.5 * aim, 0, 0.65 * aim);
    P.armR.rotation.set(-1.5 * aim, 0, (0.65 + 0.62 * draw) * aim);
    P.head.rotation.y = 0.55 * aim;
    if (P.bow) { P.armL.updateMatrix(); P.bow.quaternion.copy(P.armL.quaternion).invert().multiply(_q.setFromAxisAngle(_up, 0.65 * aim)); }
  } else if (state === 'block') { // shield up, braced
    P.armL.rotation.set(-1.25, 0, -0.45); P.armR.rotation.set(-0.5, 0, -0.2);
    P.body.rotation.x = -0.08; P.body.position.y = -0.06;
    P.legL.rotation.x = -0.35; P.legR.rotation.x = 0.35;
  } else if (state === 'roll') { // low dive: duck forward around the hips, tuck, spring back up (stays above the ground)
    const k = Math.min(1, a), dive = ss(0, 0.28, k) * (1 - ss(0.68, 1, k));
    const lean = 1.05 * dive, hip = 0.6; // pivot at the hips; a small hop and braced legs keep the boots out of the ground
    P.body.rotation.x = lean;
    P.body.position.y = hip - hip * Math.cos(lean) - 0.05 * dive + 0.4 * dive * (1 - dive); P.body.position.z = -hip * Math.sin(lean) + 0.18 * dive;
    P.legL.rotation.x = -1.6 * dive; P.legR.rotation.x = -0.3 * dive;
    P.armL.rotation.set(-0.9 * dive, 0, 0.35 * dive); P.armR.rotation.set(-0.9 * dive, 0, -0.35 * dive);
    P.head.rotation.x = -0.55 * dive;
  } else if (state === 'chop' || state === 'mine' || state === 'harvest') {
    // gathering swings: wind up, strike at the node in front, recover (a = 0-1 through one swing)
    if (state === 'mine') { // two-handed overhead pickaxe blow
      const up = ss(0, 0.45, a) * (1 - ss(0.45, 0.58, a)), down = ss(0.45, 0.58, a) * (1 - ss(0.72, 1, a));
      const ax = -0.7 - 2.1 * up + 0.35 * down;
      P.armR.rotation.set(ax, 0, 0.32); P.armL.rotation.set(ax, 0, -0.32);
      P.body.rotation.x = -0.18 * up + 0.42 * down; P.body.position.y = -0.06 * down;
      P.legL.rotation.x = -0.35 * down; P.legR.rotation.x = 0.25 * down;
      P.head.rotation.x = 0.2 * down;
    } else if (state === 'chop') { // sideways axe swing at the trunk
      const back = ss(0, 0.42, a) * (1 - ss(0.42, 0.56, a)), hit = ss(0.42, 0.56, a) * (1 - ss(0.7, 1, a));
      P.body.rotation.y = 0.75 * back - 0.45 * hit;
      P.armR.rotation.set(-1.25 - 0.35 * back + 0.1 * hit, 0, -0.55 * back + 0.7 * hit);
      P.armL.rotation.set(-0.9 - 0.2 * back, 0, -0.2 + 0.55 * hit);
      P.body.rotation.x = 0.1 + 0.12 * hit;
      P.legL.rotation.x = -0.25 * hit; P.legR.rotation.x = 0.2 * hit;
    } else { // crouch and sweep the sickle low through the plants
      const crouch = 0.6 + 0.4 * Math.sin(Math.min(1, a) * Math.PI);
      const sweep = -0.9 + 1.7 * ss(0.3, 0.6, a) - 0.8 * ss(0.75, 1, a);
      P.body.position.y = -0.22 * crouch; P.body.rotation.x = 0.4 * crouch;
      P.legL.rotation.set(-0.8 * crouch, 0, 0.1); P.legR.rotation.set(0.3 * crouch, 0, -0.1);
      P.armR.rotation.set(-0.85, 0, sweep);
      P.armL.rotation.set(-0.5, 0, -0.3);
      P.head.rotation.x = 0.25 * crouch;
    }
  } else if (state === 'cast') {
    const k = Math.sin(Math.min(1, a) * Math.PI);
    P.armR.rotation.x = -1.6 * k - 0.2; P.armL.rotation.x = -1.2 * k;
    P.armR.rotation.z = -0.2; P.armL.rotation.z = 0.4 * k;
    P.body.position.y = 0.05 * k; P.head.rotation.x = -0.15 * k;
  } else if (state === 'dead') {
    P.body.rotation.x = -Math.PI / 2; P.body.position.y = 0.2; P.body.position.z = -0.6;
    P.armL.rotation.z = 1.2; P.armR.rotation.z = -1.2;
  } else {
    const b = Math.sin(t * 2.2);
    P.body.position.y = b * 0.015;
    P.armL.rotation.z = 0.08 + b * 0.03; P.armR.rotation.z = -0.08 - b * 0.03;
    P.head.rotation.z = Math.sin(t * 0.7) * 0.04;
  }
  if (P.cape) P.cape.rotation.x = 0.12 + (state === 'run' ? 0.5 + Math.sin(t * 14) * 0.08 : Math.sin(t * 2) * 0.04);
  if (P.scarf) P.scarf.rotation.x = (state === 'run' ? 1.1 : 0.2) + Math.sin(t * 12) * 0.12;
  if (P.tail) P.tail.rotation.z = Math.sin(t * (state === 'run' ? 9 : 2.4)) * (state === 'run' ? 0.35 : 0.18);
  if (P.wings) animateWings(P.wings, t, state === 'run' ? 1.6 : 1);
  if (P.orb) P.orb.position.y = 0.25 + Math.sin(t * 3) * 0.05;
}

// ---------------------------------------------------------------- Looks
// Class outfits. Ids stay the same for the four original classes (saves, items and icons use them).
export const CLASS_KITS = {
  knight: { outfit: { main: 0xc8d0dc, accent: 0x2f5fb8, trim: 0xe8b64a, skirt: 0x3a4a6e }, armor: true, tabard: true, gauntlets: true, hat: 'helm', hatColor: 0xc8d0dc, plume: 0xd8403a, weapon: 'sword', boots: 0x5a6070, pants: 0x3a4a6e, emblem: 0xf0d060, hair: 'short' },
  berserker: { outfit: { main: 0x8a5a38, accent: 0xa83228, trim: 0xc8a060, skirt: 0x6a4a30 }, bareArms: true, pelt: true, kilt: true, bracers: true, strap: true, hat: 'pelt', hatColor: 0x6a4a32, weapon: 'greataxe', boots: 0x5a3a26, pants: 0x5a3a26, hair: 'messy' },
  assassin: { outfit: { main: 0x3a3550, accent: 0x55d6a8, trim: 0x9aa0b8, skirt: 0x2a2638 }, hood: 0x2e2a44, mask: true, maskColor: 0x2e2a44, bracers: true, pouch: true, strap: true, strapColor: 0x2a2030, scarf: true, weapon: 'daggers', boots: 0x2a2030, pants: 0x2a2638, hair: 'bob' },
  ranger: { outfit: { main: 0x4a7a3a, accent: 0x8a5a2a, trim: 0xd8c08a, skirt: 0x4a3a2a }, hat: 'feather', hatColor: 0x5a7a3a, featherColor: 0xd84a3a, cape: 0x3a6a34, quiver: true, bracers: true, strap: true, pouch: true, weapon: 'bow', boots: 0x5a3a26, pants: 0x5a4a32, hair: 'ponytail' },
  mage: { outfit: { main: 0x5a3a9a, accent: 0xff8a3a, trim: 0xf0c24a, skirt: 0x46307a }, robe: true, hat: 'witch', hatColor: 0x4a2e86, weapon: 'staff', orbColor: 0xff8a3a, boots: 0x3a2a40, pouch: true, hair: 'long' },
  priest: { outfit: { main: 0xf4f6ff, accent: 0x3f8cff, trim: 0xf0c24a, skirt: 0xe4ecff }, robe: true, hat: 'circlet', cape: 0x8fc4ff, weapon: 'scepter', boots: 0xe8e0d0, beltColor: 0xc8a050, hair: 'long' },
  summoner: { outfit: { main: 0x3e6a3c, accent: 0x9ad86a, trim: 0xb08a4a, skirt: 0x2e4a2c }, robe: true, hat: 'antlers', hatColor: 0x3a6a3a, strap: true, weapon: 'tome', boots: 0x4a3a26, hair: 'braid' },
  spellblade: { outfit: { main: 0x2a3a5a, accent: 0x5ad8ff, trim: 0xd8dee8, skirt: 0x1a2a44 }, pauldrons: true, runes: true, bracers: true, cape: 0x2a3a6a, weapon: 'runesword', boots: 0x2a2a38, pants: 0x1a2a44, hair: 'spiky' },
};

// A hero's look: class outfit + appearance (race, body, face, hair...) + extras (wings, costume pieces).
export function heroLook(cls, app = {}, extra = {}) {
  const K = CLASS_KITS[cls] || CLASS_KITS.knight;
  const { hair: defHair, ...kit } = K;
  const look = { ...kit, ...app, hairStyle: app.hairStyle || defHair, ...extra };
  if (app.helm === false && ['helm', 'pelt', 'antlers', 'witch', 'feather', 'circlet'].includes(look.hat) && !extra.hat) look.hat = 'none';
  if (app.helm === false && look.hood && !extra.hood) look.hood = null;
  return look;
}

// Older call shape (class, gender, hair, eye, extras), used for random heroes and townsfolk.
export function classLook(cls, gender, hair, eye, extra = {}) {
  return heroLook(cls, { body: gender === 'm' ? 'a' : 'b', hair, eye, race: extra.race || 'human', skin: extra.skin }, extra);
}

export function npcLook(look) {
  switch (look) {
    case 'thalia': return { body: 'b', race: 'draken', skin: '#c8a890', hair: '#f0f0f8', eye: '#ffb030', hairStyle: 'braid', armor: true, gauntlets: true, pauldrons: true, weapon: 'spear', cape: 0x5a2a8a, hat: 'circlet', outfit: { main: 0x3a3a5a, accent: 0xe8c070, trim: 0xffd84a, skirt: 0x2a2a40 }, scale: 1.08, face: 'long' };
    case 'elder': return { body: 'a', race: 'sylvan', skin: '#eec0a0', hair: '#f4f4f4', eye: '#5a7a4a', mood: 'closed', robe: true, outfit: { main: 0x4a8a4a, accent: 0xe8d8a0, trim: 0xd8b04a, skirt: 0x3a6a3a }, beardStyle: 'full', beard: 0xf4f4f4, weapon: 'oldstaff', hairStyle: 'long', brow: '#e0e0e0', face: 'long' };
    case 'mimi': return { body: 'b', race: 'beastkin', beast: 'cat', skin: '#f7dcc8', hair: '#ff9ec7', eye: '#d89a2a', hairStyle: 'twin', apron: true, outfit: { main: 0xffffff, accent: 0xff7aa8, trim: 0xff7aa8, skirt: 0xffb6d2 }, skirt: true };
    case 'brom': return { body: 'a', race: 'human', skin: '#bd8460', hair: '#6a3a1a', eye: '#3a5a2a', hat: 'cowboy', hatColor: 0x7a4a2a, hairStyle: 'short', beardStyle: 'goatee', outfit: { main: 0x5a8a3a, accent: 0xc87a3a, trim: 0x7a4a2a, skirt: 0x6a4a2a }, strap: true, scale: 1.1, build: 0.9 };
    case 'lyla': return { body: 'b', race: 'human', skin: '#eec0a0', hair: '#d0783a', eye: '#2fae6a', hairStyle: 'braid', apron: true, hat: 'scarf', outfit: { main: 0x3a9a6a, accent: 0xf0d050, trim: 0xa0602a, skirt: 0x2a7a5a }, skirt: true, makeup: 'rouge' };
    case 'gorm': return { body: 'a', race: 'human', skin: '#dba07c', hair: '#c84a2a', eye: '#3a3a6a', beardStyle: 'braided', beard: 0xc84a2a, hairStyle: 'mohawk', weapon: 'hammer', outfit: { main: 0x7a5a3a, accent: 0x9a9aa8, trim: 0x3a2a1a, skirt: 0x4a3a2a }, scale: 0.9, build: 1, apron: true, apronColor: 0x5a3a22, bareArms: true, bracers: true, face: 'square' };
    case 'elena': return { body: 'b', race: 'human', skin: '#f7dcc8', hair: '#f2d27a', eye: '#3a6fd8', hairStyle: 'ponytail', armor: true, gauntlets: true, weapon: 'spear', cape: 0xc0303a, outfit: { main: 0xd8dee8, accent: 0xc0303a, trim: 0xe8b64a, skirt: 0x8a2030 } };
    case 'sylphie': return { body: 'b', race: 'sylvan', skin: '#e2ecd8', hair: '#7ef0a8', eye: '#2fae6a', hairStyle: 'long', wings: true, wingColor: '#b8ffd8', tattoo: 'dots', outfit: { main: 0xf0fff4, accent: 0x5ad88a, trim: 0xffe07a, skirt: 0xc8ffe0 }, skirt: true, scale: 0.85 };
    case 'nix': return { body: 'a', race: 'draken', skin: '#a9aab6', hair: '#b48cff', eye: '#8a4ad8', robe: true, hood: 0x4a2a7a, weapon: 'orb', outfit: { main: 0x5a3a8a, accent: 0xd8b0ff, trim: 0xe8c86a, skirt: 0x3a2a5a } };
    case 'mira': return { body: 'b', race: 'human', skin: '#94603f', hair: '#2a2a3a', eye: '#d89a2a', hairStyle: 'bob', hat: 'circlet', apron: true, outfit: { main: 0x2a6a8a, accent: 0xf0c050, trim: 0xe8b64a, skirt: 0x1a4a6a }, skirt: true, makeup: 'lips' };
    case 'aldric': return { body: 'a', race: 'human', skin: '#dba07c', hair: '#3a3a4a', eye: '#3a6fd8', hairStyle: 'short', beardStyle: 'full', beard: 0x3a3a4a, armor: true, tabard: true, cape: 0x2a5ab8, weapon: 'spear', outfit: { main: 0xc8d0e0, accent: 0x2a5ab8, trim: 0xe8b64a, skirt: 0x2a3a6a }, scale: 1.06, face: 'square', scar: 'eye' };
    case 'host': return { body: 'b', race: 'beastkin', beast: 'fox', skin: '#f7dcc8', hair: '#ff7a2a', eye: '#7a3ad8', hairStyle: 'twin', hat: 'witch', hatColor: 0x4a2a6a, outfit: { main: 0xff8a2a, accent: 0x7a3ad8, trim: 0x2a1a3a, skirt: 0x5a2a7a }, skirt: true };
    case 'tilly': return { body: 'b', race: 'human', skin: '#eec0a0', hair: '#e8a040', eye: '#3a8a3a', hairStyle: 'twin', hat: 'cowboy', hatColor: 0xe8c860, apron: true, outfit: { main: 0x6ab04a, accent: 0xf0e0a0, trim: 0x8a5a2a, skirt: 0x4a7ad8 }, skirt: true, tattoo: 'none' };
    case 'vera': return { body: 'b', race: 'sylvan', skin: '#f4e6da', hair: '#6a3aa8', eye: '#3ac8a0', hairStyle: 'long', robe: true, hood: 0x3a6a5a, tattoo: 'runes', outfit: { main: 0x2a8a7a, accent: 0xc8f0a0, trim: 0xe8c86a, skirt: 0x1a5a50 } };
    case 'coco': return { body: 'b', race: 'beastkin', beast: 'fox', skin: '#f7dcc8', hair: '#ff6ab8', eye: '#7a3ad8', hairStyle: 'bob', hat: 'circlet', scarf: true, outfit: { main: 0xfff0f8, accent: 0xff6ab8, trim: 0xffd84a, skirt: 0xff9ad0 }, skirt: true, makeup: 'rouge' };
    case 'opal': return { body: 'b', race: 'sylvan', skin: '#d2dcf0', hair: '#e8f0ff', eye: '#4a8aff', hairStyle: 'long', hat: 'circlet', tattoo: 'spirals', outfit: { main: 0x4a5ad8, accent: 0x5fd0ff, trim: 0xe8e0ff, skirt: 0x2a3a9a }, robe: true };
    case 'hilda': return { body: 'b', race: 'human', skin: '#dba07c', hair: '#c84a2a', eye: '#3a5a8a', hairStyle: 'braid', armor: true, hat: 'scarf', outfit: { main: 0x9a7a4a, accent: 0x3a7ad8, trim: 0xe8c86a, skirt: 0x5a4a2a }, scale: 1.05, build: 0.85, pouch: true };
    case 'grimsby': return { body: 'a', race: 'human', skin: '#eec0a0', hair: '#8a8a9a', eye: '#3a3a5a', hairStyle: 'short', beardStyle: 'mustache', beard: 0x9a9aaa, hat: 'cowboy', hatColor: 0x2a2a3a, weapon: 'hammer', outfit: { main: 0x5a2a3a, accent: 0xf0c050, trim: 0x2a1a1a, skirt: 0x3a1a2a }, scale: 0.95, face: 'round' };
    case 'elias': return { body: 'a', race: 'draken', skin: '#c9785c', hair: '#3a2a1a', eye: '#c84a3a', hairStyle: 'spiky', robe: true, cape: 0x8a1a2a, weapon: 'orb', outfit: { main: 0x2a2a3a, accent: 0xff3b3b, trim: 0xe8c86a, skirt: 0x1a1a2a } };
    case 'trader': return { body: 'a', race: 'human', skin: '#bd8460', hair: '#7a4a2a', eye: '#3a6a3a', hairStyle: 'short', beardStyle: 'stubble', hood: 0x7a5a3a, weapon: 'spear', pouch: true, strap: true, outfit: { main: 0x8a6a3a, accent: 0x3a8a5a, trim: 0xd8b070, skirt: 0x5a4a2a } };
  }
  return {};
}
// ---------------------------------------------------------------- Creatures
function withFace(parent, r, texOpts, y = 0, opts) {
  const f = facePatch(r * 1.008, critterFace(texOpts), opts);
  f.position.y = y; parent.add(f); return f;
}

export function buildJelly(color = 0x7ad8ff, scale = 1) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const m = mesh(sph(0.75, 22, 16), color, { outlineW: 0.03, opts: { transparent: true, opacity: 0.9 } });
  body.add(m);
  const core = new THREE.Mesh(sph(0.3), glow(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5), 0.5));
  core.position.set(0, -0.15, 0); body.add(core);
  add(body, new THREE.Mesh(sph(0.12), glow(0xffffff, 0.85)), -0.3, 0.4, 0.45);
  withFace(body, 0.75, { mood: 'happy', mouth: 'smile' }, 0, { width: 1.5, top: 1.15, height: 1.0 });
  const leaf = new THREE.Group(); leaf.position.y = 0.72; body.add(leaf);
  leaf.add(part(cyl(0.03, 0.03, 0.18, 6), 0x4a8a2a, 0, 0.08, 0, { ow: 0 }));
  leaf.add(part(sph(1, 10, 6), 0x6ad84a, 0.12, 0.18, 0, { sx: 0.16, sy: 0.04, sz: 0.09, rz: 0.4, ow: 0.012 }));
  body.position.y = 0.6; body.scale.set(1, 0.82, 1);
  root.userData.parts = { body };
  root.userData.anim = 'bounce';
  root.userData.height = 1.4;
  root.scale.setScalar(scale);
  return root;
}

function buildBunny(scale = 1, color = 0xffffff) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  body.add(part(sph(0.55), color, 0, 0.55, 0, { sx: 1, sy: 0.9, sz: 1.05 }));
  const head = new THREE.Group(); head.position.set(0, 1.08, 0.18); body.add(head);
  head.add(part(sph(0.45, 20, 16), color, 0, 0, 0));
  withFace(head, 0.45, { mood: 'happy', mouth: 'cat' }, 0, { width: 1.6, top: 1.2, height: 1.0 });
  head.add(part(sph(0.05), 0xff8aa8, 0, -0.05, 0.45, { ow: 0 }));
  for (const s of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(0.17 * s, 0.35, -0.05); ear.rotation.z = -s * 0.18; head.add(ear);
    ear.add(part(cap(0.1, 0.5), color, 0, 0.3, 0));
    ear.add(part(cap(0.05, 0.4), 0xffb6c8, 0, 0.3, 0.06, { ow: 0 }));
    body.add(part(sph(0.16), color, 0.24 * s, 0.1, 0.25, { sx: 1, sy: 0.6, sz: 1.4, ow: 0.02 }));
  }
  body.add(part(sph(0.17), color, 0, 0.5, -0.55, { ow: 0.02 }));
  root.userData.parts = { body, head };
  root.userData.anim = 'hop';
  root.userData.height = 1.8;
  root.scale.setScalar(scale);
  return root;
}

export function buildShroom(scale = 1, capColor = 0xe0403a) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const stem = new THREE.Group(); stem.position.y = 0.5; body.add(stem);
  stem.add(part(sph(0.45, 18, 14), 0xfff0d8, 0, 0, 0, { sx: 0.95, sy: 1.0, sz: 0.95 }));
  withFace(stem, 0.45, { mood: 'happy', mouth: 'o', eyeSize: 0.9 }, 0, { width: 1.6, top: 1.25, height: 0.9 }).scale.set(0.95, 1, 0.95);
  const capG = new THREE.Group(); capG.position.y = 1.0; body.add(capG);
  capG.add(part(G('shroomcap', () => new THREE.SphereGeometry(0.78, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2)), capColor, 0, 0, 0, { sy: 0.8, opts: DS }));
  capG.add(part(G('shroomunder', () => new THREE.CircleGeometry(0.78, 22)), 0xf8e0c0, 0, 0.005, 0, { rx: Math.PI / 2, ow: 0, opts: DS }));
  const dots = [[0, 0.62, 0], [0.42, 0.42, 0.2], [-0.38, 0.45, 0.25], [0.1, 0.4, -0.5], [-0.3, 0.38, -0.4], [0.5, 0.25, -0.3], [0.2, 0.35, 0.55]];
  for (const [x, y, z] of dots) {
    const d = part(sph(0.1, 10, 6), 0xffffff, x, y, z, { sy: 0.4, ow: 0 });
    d.lookAt(new THREE.Vector3(x * 3, y * 3 + 0.2, z * 3)); d.rotateX(Math.PI / 2);
    capG.add(d);
  }
  for (const s of [-1, 1]) body.add(part(sph(0.13), 0xfff0d8, 0.2 * s, 0.08, 0.12, { sy: 0.6, sz: 1.3, ow: 0.02 }));
  root.userData.parts = { body, cap: capG };
  root.userData.anim = 'waddle';
  root.userData.height = 1.9;
  root.scale.setScalar(scale);
  return root;
}

export function buildQuad(o = {}) {
  const c = { body: 0x8a9ab8, belly: 0xd8e0f0, legs: null, ...o };
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const sz = o.size || 1;
  body.add(part(cap(0.38 * sz, 0.85 * sz, 8, 14), c.body, 0, 0.92 * sz, 0, { rx: Math.PI / 2 }));
  body.add(part(sph(0.33 * sz), c.belly, 0, 0.82 * sz, 0.2 * sz, { sx: 0.9, sy: 0.85, sz: 1.3, ow: 0 }));
  const legs = [];
  for (const [x, z] of [[0.22, 0.38], [-0.22, 0.38], [0.22, -0.4], [-0.22, -0.4]]) {
    const leg = new THREE.Group(); leg.position.set(x * sz, 0.72 * sz, z * sz); body.add(leg);
    leg.add(part(cap(0.11 * sz, 0.42 * sz), c.legs ?? c.body, 0, -0.32 * sz, 0));
    leg.add(part(sph(0.12 * sz), c.hoof ?? (c.legs ?? c.body), 0, -0.62 * sz, 0.03 * sz, { sy: 0.6, sz: 1.2, ow: 0.015 }));
    legs.push(leg);
  }
  const head = new THREE.Group(); head.position.set(0, 1.32 * sz, 0.7 * sz); body.add(head);
  if (o.neck !== false) body.add(part(cap(0.2 * sz, 0.35 * sz), c.body, 0, 1.15 * sz, 0.55 * sz, { rx: 0.7 }));
  head.add(part(sph(0.34 * sz, 20, 16), c.body, 0, 0, 0));
  if (o.snout !== false) head.add(part(sph(0.2 * sz), c.snout ?? c.belly, 0, -0.08 * sz, 0.28 * sz, { sx: 0.9, sy: 0.75, sz: 1.1, ow: 0.015 }));
  head.add(part(sph(0.05 * sz), 0x2a1a1a, 0, -0.02 * sz, 0.5 * sz, { ow: 0 }));
  withFace(head, 0.34 * sz, o.face || { mood: 'happy', mouth: 'none', blush: false }, 0, { width: 1.9, top: 0.8, height: 0.9 });
  for (const s of [-1, 1]) {
    if (o.ears === 'round') head.add(part(sph(0.11 * sz), c.ear ?? c.body, 0.24 * s * sz, 0.27 * sz, -0.05 * sz, { sz: 0.6, ow: 0.015 }));
    else if (o.ears !== false) head.add(part(cone(0.1 * sz, 0.26 * sz, 6), c.ear ?? c.body, 0.18 * s * sz, 0.32 * sz, -0.05 * sz, { rz: -s * 0.2, ow: 0.015 }));
  }
  if (o.horn) head.add(part(cone(0.06 * sz, 0.5 * sz, 10), o.horn, 0, 0.36 * sz, 0.15 * sz, { rx: 0.45, ow: 0.012 }));
  const tail = new THREE.Group(); tail.position.set(0, 1.0 * sz, -0.75 * sz); body.add(tail);
  if (o.tail !== false) tail.add(part(cap(0.1 * sz, 0.45 * sz), o.tailColor ?? c.body, 0, 0, -0.2 * sz, { rx: -1.0, ow: 0.015 }));
  if (o.mane) {
    const mc = Array.isArray(o.mane) ? o.mane : [o.mane];
    for (let i = 0; i < 5; i++) body.add(part(sph(0.13 * sz, 10, 8), mc[i % mc.length], 0, (1.55 - i * 0.12) * sz, (0.55 - i * 0.12) * sz, { sx: 0.6, ow: 0.012 }));
  }
  if (o.spikes) for (let i = 0; i < 4; i++) body.add(part(cone(0.08 * sz, 0.3 * sz, 6), o.spikes, 0, 1.3 * sz, (0.25 - i * 0.22) * sz, { rx: -0.4, ow: 0.012 }));
  let wings = null;
  if (o.wings) {
    wings = new THREE.Group(); wings.position.set(0, 1.2 * sz, 0.1 * sz); body.add(wings);
    for (const s of [-1, 1]) {
      const w = new THREE.Group(); w.position.x = 0.3 * s * sz; wings.add(w);
      for (let i = 0; i < 3; i++) w.add(part(sph(1, 10, 6), o.wings, (0.35 + i * 0.25) * s * sz, 0.12 * sz - i * 0.02, -i * 0.1 * sz, { sx: 0.32 * sz, sy: 0.05 * sz, sz: (0.3 - i * 0.05) * sz, rz: s * 0.2, ow: 0.012 }));
    }
  }
  if (o.saddle) {
    body.add(part(cyl(0.34 * sz, 0.34 * sz, 0.1 * sz, 16), o.saddle, 0, 1.28 * sz, -0.05 * sz, { sx: 1, sz: 1.2, ow: 0.015 }));
  }
  const seat = new THREE.Object3D(); seat.position.set(0, 1.3 * sz, -0.05 * sz); body.add(seat);
  root.userData.parts = { body, legs, head, tail, wings, seat };
  root.userData.anim = 'quad';
  root.userData.height = 1.9 * sz;
  return root;
}

function buildWolf(scale = 1) {
  const m = buildQuad({ body: 0x7a8aa8, belly: 0xc8d0e0, snout: 0xc8d0e0, spikes: 0x5aa84a, face: { mood: 'angry', eye: '#ff3a3a', mouth: 'fang', blush: false }, size: 1 });
  m.scale.setScalar(scale);
  return m;
}

export function buildTreant(scale = 1, o = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const bark = o.bark ?? 0x7a5432, leaf = o.leaf ?? 0x4aa83a;
  const trunk = new THREE.Group(); trunk.position.y = 1.6; body.add(trunk);
  trunk.add(part(sph(0.8, 16, 14), bark, 0, 0, 0, { sx: 1, sy: 1.35, sz: 0.85, ow: 0.035 }));
  withFace(trunk, 0.8, { mood: 'glow', eye: o.eye || '#e8ff6a', mouth: 'fang', blush: false }, 0, { width: 1.5, top: 1.1, height: 1.0 }).scale.set(1, 1.35, 0.85);
  const crown = new THREE.Group(); crown.position.y = 2.85; body.add(crown);
  for (const [x, y, z, r] of [[0, 0.3, 0, 0.9], [0.6, 0, 0.1, 0.65], [-0.6, 0.05, 0, 0.7], [0, 0.1, -0.5, 0.7], [0.1, 0.8, -0.1, 0.55]]) {
    crown.add(part(sph(r, 12, 10), leaf, x, y, z, { ow: 0.035 }));
  }
  if (o.flowers) for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    crown.add(part(sph(0.1, 8, 6), o.flowers, Math.cos(a) * 0.85, 0.4 + Math.sin(i * 3) * 0.2, Math.sin(a) * 0.8, { ow: 0 }));
  }
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0.75 * s, 2.0, 0); body.add(arm);
    arm.add(part(cyl(0.12, 0.18, 1.2, 8), bark, 0.25 * s, -0.4, 0.1, { rz: s * 0.6, ow: 0.025 }));
    arm.add(part(sph(0.35, 10, 8), leaf, 0.6 * s, -0.95, 0.2, { ow: 0.025 }));
    arms.push(arm);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.35 * s, 0.75, 0); body.add(leg);
    leg.add(part(cyl(0.22, 0.32, 0.8, 8), bark, 0, -0.38, 0, { ow: 0.025 }));
    legs.push(leg);
  }
  if (o.crown) {
    const cg = new THREE.Group(); cg.position.y = 3.95; body.add(cg);
    cg.add(part(cyl(0.55, 0.5, 0.25, 16), 0xf0c040, 0, 0, 0, { ow: 0.02 }));
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cg.add(part(cone(0.1, 0.35, 6), 0xf0c040, Math.cos(a) * 0.5, 0.25, Math.sin(a) * 0.5, { ow: 0.015 })); }
    const gem = new THREE.Mesh(sph(0.1), glow(0xff3a6a)); gem.position.set(0, 0.05, 0.55); cg.add(gem);
  }
  root.userData.parts = { body, arms, legs, crown };
  root.userData.anim = 'stomp';
  root.userData.height = 4.0;
  root.scale.setScalar(scale);
  return root;
}

export function buildGolem(scale = 1) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const stone = 0x8a94a8, dark = 0x6a7488, rune = glow(0x5ff0ff);
  body.add(part(box(1.4, 1.2, 0.9), stone, 0, 1.95, 0, { ow: 0.04 }));
  body.add(part(box(0.9, 0.5, 0.7), dark, 0, 1.2, 0, { ow: 0.035 }));
  const head = new THREE.Group(); head.position.y = 2.85; body.add(head);
  head.add(part(box(0.7, 0.6, 0.65), stone, 0, 0, 0, { ow: 0.035 }));
  for (const s of [-1, 1]) { const e = new THREE.Mesh(box(0.14, 0.08, 0.05), rune); e.position.set(0.17 * s, 0.02, 0.33); head.add(e); }
  for (const [x, y, w, h] of [[0, 2.1, 0.08, 0.6], [0, 1.95, 0.6, 0.08], [-0.35, 1.75, 0.08, 0.3], [0.35, 1.75, 0.08, 0.3]]) {
    const r = new THREE.Mesh(box(w, h, 0.05), rune); r.position.set(x, y, 0.46); body.add(r);
  }
  for (const s of [-1, 1]) body.add(part(sph(0.3, 10, 8), 0x5a9a4a, 0.62 * s, 2.55, 0, { sy: 0.4, ow: 0.02 }));
  const arms = [];
  for (const s of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(0.95 * s, 2.3, 0); body.add(arm);
    arm.add(part(box(0.5, 0.9, 0.5), dark, 0, -0.45, 0, { ow: 0.03 }));
    arm.add(part(box(0.62, 0.55, 0.62), stone, 0, -1.1, 0.05, { ow: 0.03 }));
    arms.push(arm);
  }
  const legs = [];
  for (const s of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(0.38 * s, 0.95, 0); body.add(leg);
    leg.add(part(box(0.5, 0.95, 0.55), dark, 0, -0.48, 0, { ow: 0.03 }));
    legs.push(leg);
  }
  root.userData.parts = { body, arms, legs, head };
  root.userData.anim = 'stomp';
  root.userData.height = 3.4;
  root.scale.setScalar(scale);
  return root;
}

export function buildMonster(model, variant = 0) {
  switch (model) {
    case 'jelly': return buildJelly([0x7ad8ff, 0xff9ac8, 0x9af08a][variant % 3]);
    case 'bunny': return buildBunny(1, [0xffffff, 0xf4e2c8, 0xe8e0f4][variant % 3]);
    case 'shroom': return buildShroom(1, [0xe0403a, 0xd06a2a, 0xb04ad0][variant % 3]);
    case 'wolf': return buildWolf(1);
    case 'treant': return buildTreant(0.95, { leaf: 0x3a8a3a, eye: '#e8ff6a' });
    case 'golem': return buildGolem(1);
    case 'boss': return buildTreant(2.1, { leaf: 0x7a3aa8, bark: 0x5a3a2a, eye: '#ff4a6a', flowers: 0xff7ad0, crown: true });
  }
  return buildJelly();
}

// ---------------------------------------------------------------- Pets
export function buildPet(model) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  let anim = 'float', height = 1.1;
  switch (model) {
    case 'icecream': {
      body.add(part(cone(0.24, 0.55, 14), 0xe0a35a, 0, 0.3, 0, { rx: Math.PI }));
      const s1 = part(sph(0.28), 0xffa8c8, 0, 0.62, 0); body.add(s1);
      withFace(s1, 0.28, { mood: 'happy', mouth: 'smile' }, 0, { width: 1.7, top: 1.2, height: 1.0 });
      body.add(part(sph(0.23), 0xa8f0d0, 0.04, 0.88, -0.03));
      body.add(part(sph(0.18), 0xfff4d8, -0.02, 1.08, 0));
      body.add(part(sph(0.07), 0xe0203a, 0, 1.27, 0, { ow: 0.012 }));
      height = 1.4; break;
    }
    case 'cupcake': {
      body.add(part(cyl(0.3, 0.22, 0.32, 14), 0xff8ab8, 0, 0.2, 0));
      const fr = part(sph(0.34), 0xfff0f6, 0, 0.45, 0, { sy: 0.65 }); body.add(fr);
      withFace(body, 0.33, { mood: 'happy', mouth: 'smile' }, 0.4, { width: 1.5, top: 1.3, height: 0.8 });
      body.add(part(sph(0.22), 0xffd0e4, 0, 0.62, 0, { sy: 0.7 }));
      body.add(part(sph(0.12), 0xfff0f6, 0, 0.74, 0, { sy: 0.8 }));
      body.add(part(sph(0.07), 0xe0203a, 0, 0.86, 0, { ow: 0.012 }));
      const cols = [0x4ab8ff, 0xffd84a, 0x6ad86a, 0xc07aff];
      for (let i = 0; i < 10; i++) { const a = i * 2.4; body.add(part(box(0.06, 0.02, 0.02), cols[i % 4], Math.cos(a) * 0.24, 0.58 + (i % 3) * 0.02, Math.sin(a) * 0.24, { ry: a, ow: 0 })); }
      height = 1.1; break;
    }
    case 'minijelly': return finishPet(buildJelly(0xff9ac8, 0.42), 'bounce', 0.7);
    case 'minibunny': return finishPet(buildBunny(0.42, 0xf4e2c8), 'hop', 0.9);
    case 'minishroom': return finishPet(buildShroom(0.45, 0xb04ad0), 'waddle', 0.95);
    case 'dragon': {
      body.add(part(sph(0.33), 0xff8a3a, 0, 0.45, 0));
      body.add(part(sph(0.24), 0xffe0a0, 0, 0.4, 0.15, { sy: 1.1, ow: 0 }));
      const head = new THREE.Group(); head.position.set(0, 0.86, 0.06); body.add(head);
      head.add(part(sph(0.3), 0xff8a3a, 0, 0, 0));
      withFace(head, 0.3, { mood: 'happy', mouth: 'smile' }, 0, { width: 1.7, top: 1.15, height: 1.0 });
      for (const s of [-1, 1]) head.add(part(cone(0.06, 0.22, 6), 0xffe0a0, 0.15 * s, 0.28, -0.08, { rx: -0.5, rz: -s * 0.3, ow: 0.012 }));
      const wings = new THREE.Group(); wings.position.set(0, 0.62, -0.2); body.add(wings);
      const shp = new THREE.Shape(); shp.moveTo(0, 0); shp.lineTo(0.55, 0.35); shp.lineTo(0.5, 0.05); shp.lineTo(0.38, 0.12); shp.lineTo(0.3, -0.08); shp.lineTo(0.15, 0); shp.lineTo(0, -0.12);
      const wgeo = G('dwing', () => new THREE.ShapeGeometry(shp));
      for (const s of [-1, 1]) { const w = new THREE.Group(); w.scale.x = s; w.add(mesh(wgeo, 0xb04ad0, { outlineW: 0, opts: DS })); wings.add(w); }
      body.add(part(cone(0.1, 0.45, 8), 0xff8a3a, 0, 0.3, -0.42, { rx: -1.9, ow: 0.015 }));
      root.userData.wings = wings;
      height = 1.3; break;
    }
    case 'puppet': {
      body.add(part(cyl(0.16, 0.24, 0.4, 12), 0x3a6ad8, 0, 0.35, 0));
      body.add(part(tor(0.17, 0.04), 0xffd84a, 0, 0.5, 0, { rx: Math.PI / 2, ow: 0 }));
      const head = part(sph(0.25), 0xf4d0a8, 0, 0.78, 0); body.add(head);
      withFace(head, 0.25, { mood: 'happy', mouth: 'smile', eye: '#2a1a1a' }, 0, { width: 1.6, top: 1.2, height: 0.95 });
      body.add(part(cone(0.22, 0.35, 12), 0xd83a4a, 0, 1.1, 0, { rz: 0.15 }));
      body.add(part(sph(0.06), 0xffffff, -0.05, 1.28, 0, { ow: 0 }));
      for (const s of [-1, 1]) body.add(part(cap(0.05, 0.18), 0xf4d0a8, 0.22 * s, 0.38, 0, { rz: s * 0.4, ow: 0.012 }));
      const bar = new THREE.Group(); bar.position.y = 1.75; body.add(bar);
      bar.add(part(box(0.6, 0.05, 0.05), 0x8a5a3a, 0, 0, 0, { ow: 0.01 }));
      for (const s of [-1, 1]) bar.add(part(cyl(0.006, 0.006, 1.2, 4), 0xeeeeee, 0.25 * s, -0.6, 0, { ow: 0 }));
      height = 1.5; break;
    }
    case 'cat': {
      body.add(part(sph(0.3), 0xffb86a, 0, 0.32, -0.05, { sz: 1.3 }));
      const head = new THREE.Group(); head.position.set(0, 0.72, 0.15); body.add(head);
      head.add(part(sph(0.3), 0xffb86a, 0, 0, 0));
      withFace(head, 0.3, { mood: 'happy', mouth: 'cat' }, 0, { width: 1.7, top: 1.15, height: 1.0 });
      for (const s of [-1, 1]) head.add(part(cone(0.1, 0.18, 4), 0xffb86a, 0.17 * s, 0.27, 0, { rz: -s * 0.3, ow: 0.012 }));
      body.add(part(cap(0.05, 0.4), 0xffb86a, 0, 0.6, -0.42, { rx: -0.4, ow: 0.012 }));
      anim = 'hop'; height = 1.1; break;
    }
    case 'penguin': {
      body.add(part(sph(0.33), 0x2a2e48, 0, 0.42, 0, { sy: 1.25 }));
      body.add(part(sph(0.27), 0xffffff, 0, 0.38, 0.1, { sy: 1.2, ow: 0 }));
      withFace(body, 0.34, { mood: 'happy', mouth: 'none' }, 0.55, { width: 1.3, top: 1.15, height: 0.8 });
      body.add(part(cone(0.07, 0.15, 8), 0xffa82a, 0, 0.5, 0.36, { rx: Math.PI / 2, ow: 0.01 }));
      for (const s of [-1, 1]) {
        body.add(part(sph(0.08), 0xffa82a, 0.12 * s, 0.03, 0.08, { sz: 1.6, sy: 0.4, ow: 0.01 }));
        body.add(part(sph(0.12), 0x2a2e48, 0.33 * s, 0.4, 0, { sx: 0.3, sy: 1.1, ow: 0.012 }));
      }
      body.add(part(tor(0.15, 0.04), 0xe84a5a, 0, 0.68, 0, { rx: Math.PI / 2, ow: 0 }));
      anim = 'waddle'; height = 1.1; break;
    }
    case 'owl': {
      body.add(part(sph(0.34), 0x9a6a3a, 0, 0.45, 0, { sy: 1.1 }));
      body.add(part(sph(0.24), 0xf0d8a8, 0, 0.36, 0.14, { ow: 0 }));
      withFace(body, 0.34, { mood: 'happy', mouth: 'none', eyeSize: 1.3 }, 0.55, { width: 1.6, top: 1.0, height: 0.9 });
      body.add(part(cone(0.05, 0.1, 6), 0xffa82a, 0, 0.5, 0.36, { rx: Math.PI / 2 + 0.6, ow: 0.008 }));
      for (const s of [-1, 1]) {
        body.add(part(cone(0.07, 0.2, 5), 0x9a6a3a, 0.2 * s, 0.85, 0, { rz: -s * 0.35, ow: 0.01 }));
        body.add(part(sph(0.14), 0x7a4a2a, 0.32 * s, 0.4, -0.04, { sx: 0.35, sy: 1.0, ow: 0.012 }));
      }
      height = 1.2; break;
    }
    case 'ghost': {
      const mat = { opts: { transparent: true, opacity: 0.85 } };
      body.add(part(sph(0.36), 0xf4f8ff, 0, 0.62, 0, mat));
      body.add(part(cone(0.36, 0.5, 18), 0xf4f8ff, 0, 0.25, 0, { rx: Math.PI, ...mat }));
      withFace(body, 0.36, { mood: 'happy', mouth: 'o' }, 0.62, { width: 1.6, top: 1.2, height: 0.9 });
      for (const s of [-1, 1]) body.add(part(sph(0.08), 0xf4f8ff, 0.36 * s, 0.5, 0.05, { sx: 1.4, ow: 0.012 }));
      height = 1.3; break;
    }
    case 'star': {
      const shp = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.17 : 0.4, a = i / 10 * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) shp.lineTo(x, y); else shp.moveTo(x, y); }
      shp.closePath();
      const geo = G('star', () => { const g = new THREE.ExtrudeGeometry(shp, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 }); g.translate(0, 0, -0.06); return g; });
      const st = mesh(geo, 0xffd84a, { outlineW: 0.02 }); st.position.y = 0.6; body.add(st);
      const f = new THREE.Mesh(G('starface', () => new THREE.PlaneGeometry(0.42, 0.42)), new THREE.MeshBasicMaterial({ map: critterFace({ mood: 'happy', mouth: 'smile' }), transparent: true, depthWrite: false }));
      f.position.set(0, 0.6, 0.13); body.add(f);
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff08a, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 }));
      h.scale.setScalar(1.4); h.position.y = 0.6; body.add(h);
      height = 1.2; break;
    }
    default: return buildPet('icecream');
  }
  return finishPet(root, anim, height);
}
function finishPet(root, anim, height) {
  root.userData.anim = root.userData.anim === 'bounce' || root.userData.anim === 'hop' || root.userData.anim === 'waddle' ? root.userData.anim : anim;
  if (!root.userData.parts) root.userData.parts = { body: root.children[0] };
  root.userData.height = height;
  root.userData.isPet = true;
  return root;
}

// ---------------------------------------------------------------- Mounts
export function buildMount(model) {
  switch (model) {
    case 'chick': {
      const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
      const b = part(sph(0.85, 22, 18), 0xffe04a, 0, 1.05, 0, { ow: 0.035 }); body.add(b);
      withFace(body, 0.85, { mood: 'happy', mouth: 'none' }, 1.05, { width: 1.3, top: 1.25, height: 0.7 });
      body.add(part(cone(0.14, 0.28, 8), 0xff9a2a, 0, 1.0, 0.9, { rx: Math.PI / 2, ow: 0.015 }));
      for (let i = -1; i <= 1; i++) body.add(part(sph(1, 8, 6), 0xffe04a, i * 0.1, 1.95, 0.2, { sx: 0.06, sy: 0.2, sz: 0.06, rz: i * 0.4, ow: 0.012 }));
      const wings = new THREE.Group(); wings.position.set(0, 1.1, 0); body.add(wings);
      for (const s of [-1, 1]) { const w = new THREE.Group(); w.position.x = 0.8 * s; w.add(part(sph(1, 12, 8), 0xffd02a, 0.1 * s, 0, 0, { sx: 0.12, sy: 0.38, sz: 0.3, ow: 0.015 })); wings.add(w); }
      const legs = [];
      for (const s of [-1, 1]) {
        const leg = new THREE.Group(); leg.position.set(0.3 * s, 0.35, 0.05); body.add(leg);
        leg.add(part(cyl(0.05, 0.05, 0.35, 6), 0xff9a2a, 0, -0.15, 0, { ow: 0.01 }));
        leg.add(part(sph(0.12), 0xff9a2a, 0, -0.32, 0.08, { sy: 0.35, sz: 1.5, ow: 0.01 }));
        legs.push(leg);
      }
      body.add(part(cyl(0.38, 0.38, 0.1, 16), 0xd8403a, 0, 1.82, -0.1, { ow: 0.015 }));
      const seat = new THREE.Object3D(); seat.position.set(0, 1.85, -0.1); body.add(seat);
      root.userData.parts = { body, legs, wings, seat, chick: true };
      root.userData.anim = 'bird'; root.userData.height = 2.0;
      return root;
    }
    case 'panda': return buildQuad({ body: 0xf8f8f8, belly: 0xffffff, legs: 0x2a2a30, ear: 0x2a2a30, ears: 'round', snout: 0xffffff, tail: false, neck: false, saddle: 0x4ab86a, face: { mood: 'happy', mouth: 'cat', patches: true }, size: 1.15 });
    case 'frostwolf': return buildQuad({ body: 0xe8f4ff, belly: 0xffffff, snout: 0xffffff, mane: [0xb8e4ff, 0xffffff], tailColor: 0xb8e4ff, saddle: 0x3a6ad8, face: { mood: 'happy', eye: '#3a8aff', mouth: 'none', blush: false }, size: 1.15 });
    case 'pegasus': return buildQuad({ body: 0xffffff, belly: 0xffffff, snout: 0xf4f0ff, hoof: 0xf0c040, mane: [0x9ad8ff, 0xc8f0ff], tailColor: 0x9ad8ff, wings: 0xffffff, saddle: 0x3a8aff, face: { mood: 'happy', eye: '#3a6fd8', mouth: 'none', blush: true }, size: 1.2 });
    case 'unicorn': return buildQuad({ body: 0xfff4fb, belly: 0xffffff, snout: 0xfff0f8, hoof: 0xf0c040, horn: 0xffd84a, mane: [0xff7ab8, 0xffd84a, 0x7ad8ff, 0xb07aff], tailColor: 0xff9ad0, saddle: 0xb04ad0, face: { mood: 'happy', eye: '#b04ad0', mouth: 'none', blush: true }, size: 1.2 });
  }
  return buildMount('chick');
}

export function animateCreature(model, state, t, a = 0, moving = false) {
  const P = model.userData.parts; if (!P) return;
  const kind = model.userData.anim;
  const body = P.body;
  if (state === 'dead') { body.rotation.z = Math.PI / 2 * Math.min(1, a * 2); body.position.y = 0; return; }
  body.rotation.set(0, 0, 0);
  if (kind === 'bounce') {
    const ph = t * (moving ? 9 : 4);
    const s = Math.sin(ph);
    body.scale.set(1 + s * 0.06, 0.82 - s * 0.08, 1 + s * 0.06);
    body.position.y = 0.6 + (moving ? Math.max(0, s) * 0.35 : 0);
    if (state === 'attack') { body.scale.set(1.25 - a * 0.25, 0.6 + a * 0.22, 1.25 - a * 0.25); body.position.y = 0.5; }
  } else if (kind === 'hop') {
    const ph = t * (moving ? 10 : 3);
    body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.35 : Math.abs(Math.sin(ph)) * 0.03;
    if (P.head) P.head.rotation.z = Math.sin(t * 2) * 0.1;
    if (state === 'attack') body.rotation.x = Math.sin(a * Math.PI) * 0.5;
  } else if (kind === 'waddle') {
    const ph = t * (moving ? 10 : 2.5);
    body.rotation.z = Math.sin(ph) * (moving ? 0.18 : 0.05);
    body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.08 : 0;
    if (state === 'attack') { body.rotation.x = Math.sin(a * Math.PI) * 0.6; }
  } else if (kind === 'quad') {
    const ph = t * (moving ? 12 : 0);
    P.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7 : 0; });
    body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.08 : Math.sin(t * 2) * 0.01;
    if (P.head) P.head.rotation.x = state === 'attack' ? Math.sin(a * Math.PI) * 0.6 : Math.sin(t * 1.5) * 0.05;
    if (P.tail) P.tail.rotation.y = Math.sin(t * (moving ? 10 : 3)) * 0.3;
    if (P.wings) P.wings.children.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (Math.sin(t * (moving ? 8 : 3)) * 0.35 + 0.1); });
  } else if (kind === 'bird') {
    const ph = t * (moving ? 12 : 2);
    P.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(ph + i * Math.PI) * 0.8 : 0; });
    body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.12 : 0;
    body.rotation.z = moving ? Math.sin(ph) * 0.06 : 0;
    P.wings.children.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (moving ? 0.3 + Math.sin(t * 16) * 0.4 : Math.sin(t * 2) * 0.05); });
  } else if (kind === 'stomp') {
    const ph = t * (moving ? 6 : 1.5);
    P.legs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(ph + i * Math.PI) * 0.5 : 0; });
    P.arms.forEach((ar, i) => { ar.rotation.x = moving ? -Math.sin(ph + i * Math.PI) * 0.4 : Math.sin(t * 1.5 + i) * 0.08; ar.rotation.z = 0; });
    body.position.y = moving ? Math.abs(Math.sin(ph)) * 0.1 : 0;
    if (state === 'attack') {
      const k = Math.sin(a * Math.PI);
      P.arms.forEach((ar) => { ar.rotation.x = -2.2 * k; });
      body.rotation.x = 0.2 * k;
    }
  } else if (kind === 'float') {
    body.position.y = 0.15 + Math.sin(t * 3) * 0.08;
    body.rotation.z = Math.sin(t * 2) * 0.06;
    if (state === 'attack') body.rotation.x = Math.sin(a * Math.PI) * 0.5;
    if (model.userData.wings) model.userData.wings.children.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.3 + Math.sin(t * 12) * 0.5); });
  }
}

// ---------------------------------------------------------------- Sprite (fairy companion)
export function buildSprite(color = 0xff6a2a) {
  const root = new THREE.Group();
  const core = new THREE.Mesh(sph(0.11), glow(0xffffff)); root.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(0.9); root.add(halo);
  const w = buildWings('#' + new THREE.Color(color).getHexString(), 0.35);
  w.position.set(0, 0, -0.05); root.add(w);
  root.userData.wings = w;
  return root;
}

// ---------------------------------------------------------------- Blob shadow
export function blobShadow(r = 0.6, tex) {
  const m = new THREE.Mesh(G('blob', () => new THREE.PlaneGeometry(1, 1)), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.rotation.x = -Math.PI / 2; m.scale.setScalar(r * 2); m.renderOrder = 1;
  m.raycast = () => {};
  return m;
}

export { outline };
