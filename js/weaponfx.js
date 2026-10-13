// Weapon glows. From +6 every class's weapon glows in its own way, stronger at +9, +12 and +15; a weapon infused with
// an element (data-elements.js) adds that element's effect: flames, crackling lightning, frost, a whirl of wind,
// falling earth, holy light or shadow smoke. Effects follow the blade segments attachHeroWeapon records
// (models-hero.js), and other players see them too (mp.js shares the glow tier and the element).
import * as THREE from 'three';
import { glowTexture } from './toon.js';
import { ELEMENTS, isElement } from './data-elements.js';

export const CLASS_GLOW = {
  knight: { name: 'Radiant', colors: [0xffe08a, 0xffc24a], style: 'rise' },
  berserker: { name: 'Bloodrage', colors: [0xff3a3a, 0xff8a5a], style: 'beat' },
  assassin: { name: 'Nightshade', colors: [0xb05aff, 0x7a3ae8], style: 'flicker' },
  ranger: { name: 'Verdant', colors: [0x7aff6a, 0xd8ff8a], style: 'spiral' },
  mage: { name: 'Prismatic', colors: [0xff7a3a, 0x6ad8ff, 0xc08aff], style: 'prism' },
  priest: { name: 'Tidal', colors: [0x5ae8ff, 0xc8f8ff], style: 'wave' },
  summoner: { name: 'Spirit', colors: [0x9affd0, 0xeafff6], style: 'orbit' },
  spellblade: { name: 'Runic', colors: [0x6a8aff, 0xd0dcff], style: 'runes' },
};
export const GLOW_STEP = [0, 6, 9, 12, 15]; // the enhancement each glow tier starts at
export const GLOW_NAME = ['', 'Glowing', 'Bright', 'Blazing', 'Transcendent'];
export const glowTier = (enh) => (enh >= 15 ? 4 : enh >= 12 ? 3 : enh >= 9 ? 2 : enh >= 6 ? 1 : 0);
const MOTES = [0, 3, 5, 7, 10];

// world-space sparks each element (and the bloodier class glows) shed, per second
const EMIT = {
  fire: { rate: 16, o: { count: 1, speed: 0.25, up: 1.5, life: 0.5, size: 0.34, jitter: 0.05, drag: 1 } },
  storm: { rate: 6, o: { count: 2, colors: [0xffffff, 0xbfe6ff], speed: 2.6, life: 0.16, size: 0.16 } },
  frost: { rate: 6, o: { count: 1, speed: 0.2, gravity: -1.2, life: 1, size: 0.2 } },
  wind: { rate: 5, o: { count: 1, speed: 1.5, life: 0.35, size: 0.18 } },
  earth: { rate: 4, o: { count: 1, speed: 0.6, up: 1.2, gravity: -9, life: 0.55, size: 0.2 } },
  light: { rate: 8, o: { count: 1, speed: 0.35, up: 0.5, life: 0.8, size: 0.26 } },
  shadow: { rate: 7, o: { count: 1, speed: 0.2, up: 0.6, life: 1, size: 0.42 } },
};
// wisps that live on the blade (always visible): flames and smoke rise, frost and dust fall, light twinkles upward.
// dir: +1 up, -1 down (in the world, whatever angle the weapon is held at); speed in world units per second
const WISP = {
  fire: { n: 10, dir: 1, speed: 0.9, life: 0.55, s0: 0.42, s1: 0.1, op: 0.95, ramp: [0xffd070, 0xff7a20, 0xff3010] },
  frost: { n: 7, dir: -1, speed: 0.25, life: 1.2, s0: 0.16, s1: 0.12, op: 0.9, twinkle: true },
  earth: { n: 6, dir: -1, speed: 0.8, life: 0.6, s0: 0.16, s1: 0.12, op: 0.9 },
  light: { n: 8, dir: 1, speed: 0.35, life: 1, s0: 0.2, s1: 0.12, op: 0.95, twinkle: true },
  shadow: { n: 9, dir: 1, speed: 0.4, life: 1.1, s0: 0.28, s1: 0.5, op: 0.6 },
  storm: { n: 5, dir: 0, speed: 1.6, life: 0.18, s0: 0.14, s1: 0.06, op: 1 },
};
const CLASS_EMIT = {
  beat: { colors: [0xff2a2a, 0xa80a0a], speed: 0.1, gravity: -8, life: 0.6, size: 0.16 }, // blood drips
  flicker: { colors: [0x7a3ae8, 0x4a1a8a], speed: 0.15, up: 0.5, life: 0.7, size: 0.36 }, // shadow wisps
};

const sprite = (color, opacity, size) => {
  const m = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity });
  const s = new THREE.Sprite(m); s.scale.setScalar(size); s.raycast = () => {}; s.renderOrder = 6; return s;
};
const hash = (n) => { const x = Math.sin(n * 127.1) * 43758.5453; return x - Math.floor(x); };
const beat = (t) => { const c = t % 1.1; return Math.exp(-c * 16) + 0.7 * Math.exp(-Math.abs(c - 0.24) * 16); };

// the effect for one weapon: cls's glow at tier (0 = none) and element el (or null)
function buildWeaponFx(humanoid, cls, tier, el) {
  const P = humanoid?.userData?.parts, list = P?.wfx;
  if (!list?.length || (!tier && !isElement(el))) return null;
  const CG = CLASS_GLOW[cls] || CLASS_GLOW.knight, E = isElement(el) ? ELEMENTS[el] : null;
  const segs = list.map(({ o, a, b }) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length() || 0.1;
    const u = d.clone().divideScalar(len), p1 = new THREE.Vector3(1, 0, 0);
    if (Math.abs(u.x) > 0.9) p1.set(0, 0, 1);
    p1.sub(u.clone().multiplyScalar(p1.dot(u))).normalize();
    const p2 = u.clone().cross(p1);
    return { o, A, B, d, len, u, p1, p2 };
  });
  const objs = [], tmp = new THREE.Vector3(), col = new THREE.Color();
  const add = (seg, obj) => { seg.o.add(obj); objs.push(obj); return obj; };
  const at = (seg, s, ang = 0, r = 0, out = tmp) => out.copy(seg.A).addScaledVector(seg.d, s).addScaledVector(seg.p1, Math.cos(ang) * r).addScaledVector(seg.p2, Math.sin(ang) * r);
  const chains = []; // { sp, seg, k, base, size, kind: 'class' | 'el' }
  const chain = (seg, color, base, size, kind, step) => {
    const n = Math.max(2, Math.min(10, Math.round(seg.len / step)));
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) / n, sp = add(seg, sprite(color, base, size));
      sp.position.copy(at(seg, k));
      chains.push({ sp, seg, k, i, base, size, kind });
    }
  };
  // ---- the class glow
  const motes = [];
  let flare = null;
  if (tier) {
    const base = 0.38 + 0.09 * tier, size = 0.32 + 0.05 * tier;
    for (const seg of segs) chain(seg, CG.colors[0], base, size, 'class', 0.12);
    if (tier >= 4) for (const seg of segs) chain(seg, 0xffffff, 0.4, size * 0.45, 'core', 0.16); // +15: a white-hot core
    if (tier >= 2) for (const seg of segs) { // +9: a soft aura around the whole blade
      const sp = add(seg, sprite(CG.colors[0], 0.12 + 0.06 * tier, Math.max(0.5, seg.len * 1.25)));
      sp.position.copy(at(seg, 0.5)); chains.push({ sp, seg, k: 0.5, i: 99, base: 0.12 + 0.06 * tier, size: Math.max(0.5, seg.len * 1.25), kind: 'aura' });
    }
    const M = MOTES[tier];
    for (let j = 0; j < M; j++) {
      const seg = segs[j % segs.length], sp = add(seg, sprite(CG.colors[j % CG.colors.length], 0.85, 0.14 + 0.02 * tier));
      motes.push({ sp, seg, j, ph: j / M, M });
    }
    if (tier >= 3) { flare = add(segs[0], sprite(CG.colors[0], 0.5, 0.75 + 0.15 * (tier - 3))); flare.position.copy(segs[0].B); }
  }
  // ---- the element
  const arcs = [], whirl = [], wisps = [];
  let halo = null;
  if (E) {
    for (const seg of segs) chain(seg, E.hex, 0.55, 0.4, 'el', 0.14);
    if (el === 'storm') for (const seg of segs.slice(0, 3)) for (let q = 0; q < 2; q++) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
      const line = add(seg, new THREE.Line(g, new THREE.LineBasicMaterial({ color: q ? 0x9ad0ff : 0xf0faff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
      line.renderOrder = 7; line.raycast = () => {}; line.frustumCulled = false;
      arcs.push({ line, seg, q, next: 0 });
    }
    if (el === 'wind' || el === 'earth') {
      const n = el === 'wind' ? 5 : 3;
      for (let j = 0; j < n; j++) { const seg = segs[j % segs.length]; whirl.push({ sp: add(seg, sprite(E.parts[j % 3], 0.9, el === 'wind' ? 0.17 : 0.15)), seg, j, n }); }
    }
    if (el === 'light') { halo = add(segs[0], sprite(0xfff6c0, 0.5, 0.8)); halo.position.copy(segs[0].B); }
    const Wc = WISP[el];
    if (Wc) for (let j = 0; j < Wc.n; j++) { const seg = segs[j % segs.length]; wisps.push({ sp: add(seg, sprite(E.parts[j % 3], 0, Wc.s0)), seg, j, ph: j / Wc.n + hash(j) * 0.3, s: hash(j * 7 + 1), ang: hash(j * 3) * 6.28 }); }
  }
  const total = segs.reduce((a, s) => a + s.len, 0);
  // the world's up, in each blade's own space (scaled), refreshed every frame for the wisps
  const q = new THREE.Quaternion(), sc = new THREE.Vector3();
  for (const seg of segs) seg.up = new THREE.Vector3();
  const upFor = (seg) => { seg.o.getWorldQuaternion(q); seg.o.getWorldScale(sc); seg.up.set(0, 1, 0).applyQuaternion(q.invert()).divideScalar(sc.x || 1); };
  let acc = 0, accC = 0;
  const wpos = new THREE.Vector3();
  const randomPoint = () => { let r = Math.random() * total; for (const seg of segs) { if (r <= seg.len) return seg.o.localToWorld(at(seg, r / seg.len, 0, 0, wpos)); r -= seg.len; } return segs[0].o.localToWorld(wpos.copy(segs[0].B)); };

  return {
    update(t, dt, emit) {
      // chains: the class style or the element's rhythm
      for (const c of chains) {
        let op = c.base, sz = c.size;
        if (c.kind === 'aura') op *= 0.8 + 0.2 * Math.sin(t * 1.8);
        else if (c.kind === 'class' || c.kind === 'core') {
          const st = CG.style;
          if (st === 'rise') op *= 0.85 + 0.15 * Math.sin(t * 2 + c.k * 3);
          else if (st === 'beat') { const b = beat(t); op *= 0.55 + 0.6 * b; sz *= 1 + 0.3 * b; }
          else if (st === 'flicker') op *= 0.35 + 0.65 * (Math.sin(t * 23 + c.i * 7.1) * Math.sin(t * 13.7 + c.i * 3.3) * 0.5 + 0.5);
          else if (st === 'spiral') op *= 0.8 + 0.2 * Math.sin(t * 3 - c.k * 6);
          else if (st === 'prism' && c.kind === 'class') c.sp.material.color.copy(col.setHSL((t * 0.12 + c.k * 0.25) % 1, 1, 0.6));
          else if (st === 'wave') op *= 0.45 + 0.55 * Math.max(0, Math.sin(t * 4 - c.k * 5));
          else if (st === 'orbit') op *= 0.75 + 0.25 * Math.sin(t * 1.5);
          else if (st === 'runes') op *= 0.45 + 0.55 * Math.max(0, Math.sin(t * 5 - c.k * 8));
        } else if (el === 'fire') { op *= 0.7 + 0.3 * Math.sin(t * 19 + c.i * 2.3) * Math.sin(t * 11 + c.i); sz *= 0.9 + 0.2 * Math.sin(t * 9 + c.i * 1.7); }
        else if (el === 'storm') op *= hash(Math.floor(t * 14) + c.i * 13) > 0.6 ? 1.4 : 0.55;
        else if (el === 'frost') op *= 0.8 + 0.2 * Math.sin(t * 1.3 + c.i);
        else if (el === 'wind') op *= 0.6 + 0.4 * Math.sin(t * 6 - c.k * 7);
        else if (el === 'earth') op *= 0.8 + 0.2 * Math.sin(t * 1.6);
        else if (el === 'light') op *= 1.1 + 0.15 * Math.sin(t * 2.4);
        else if (el === 'shadow') op *= 0.6 + 0.35 * Math.sin(t * 1.2 + c.k * 2);
        c.sp.material.opacity = Math.min(1, op); c.sp.scale.setScalar(sz);
      }
      // motes: how each class's glow moves
      for (const m of motes) {
        const { seg, j, ph, M } = m, st = CG.style;
        let s = 0.5, ang = j * 2.4, r = 0.06, op = 0.8;
        if (st === 'rise') { s = (t * 0.45 + ph) % 1; op = Math.sin(s * Math.PI) * 0.9; }
        else if (st === 'beat') { s = 1 - ((t * 0.5 + ph) % 1); r = 0.04; op = Math.sin(s * Math.PI) * (0.6 + 0.5 * beat(t)); }
        else if (st === 'flicker') { const cyc = t * 5.5 + ph * 7, n = Math.floor(cyc); s = hash(n + j * 31); ang = hash(n * 3 + j) * 6.28; r = 0.04 + hash(n * 7 + j) * 0.1; op = 1 - (cyc - n); }
        else if (st === 'spiral') { s = (t * 0.35 + ph) % 1; ang = t * 4 + j * 2.1; r = 0.1; op = Math.sin(s * Math.PI); }
        else if (st === 'prism') { s = 0.15 + ph * 0.8; ang = t * 2.5 + j * 2.4; r = 0.14; m.sp.material.color.copy(col.setHSL((t * 0.15 + ph) % 1, 1, 0.62)); }
        else if (st === 'wave') { s = (t * 0.3 + ph) % 1; r = 0.05 + 0.03 * Math.sin(t * 6 + j); op = Math.sin(s * Math.PI); }
        else if (st === 'orbit') { s = 0.5 + 0.35 * Math.sin(t * 0.9 + j); ang = t * 1.6 + (j * Math.PI * 2) / M; r = 0.28; op = 0.75; }
        else if (st === 'runes') { s = (t * 0.4) % 1; ang = t * 3 + (j * Math.PI * 2) / M; r = 0.11; op = Math.sin(s * Math.PI); }
        m.sp.position.copy(at(seg, s, ang, r)); m.sp.material.opacity = Math.max(0, op);
      }
      if (flare) { const k = 0.75 + 0.25 * Math.sin(t * 3); flare.material.opacity = 0.35 + 0.25 * k; flare.scale.setScalar((0.75 + 0.15 * (tier - 3)) * k); }
      if (halo) { const k = 0.8 + 0.2 * Math.sin(t * 2.2); halo.material.opacity = 0.4 * k + 0.15; halo.scale.setScalar(0.8 * k + 0.1); }
      for (const w of whirl) {
        const { seg, j, n } = w;
        if (el === 'wind') { const s = (t * 0.8 + j / n) % 1; w.sp.position.copy(at(seg, s, t * 9 + j * 2.1, 0.15)); w.sp.material.opacity = Math.sin(s * Math.PI); }
        else { w.sp.position.copy(at(seg, 0.3 + 0.4 * (j / n), t * 1.2 + (j * Math.PI * 2) / n, 0.2)); w.sp.material.opacity = 0.7; }
      }
      // lightning: jagged arcs along the blade, redrawn several times a second
      for (const a of arcs) {
        if (t < a.next) continue;
        a.next = t + 0.05 + Math.random() * 0.06;
        const pos = a.line.geometry.attributes.position, seg = a.seg, amp = 0.05 + seg.len * 0.06;
        for (let k = 0; k < 9; k++) {
          const s = k / 8, edge = k === 0 || k === 8 ? 0 : 1;
          at(seg, s, Math.random() * 6.28, edge * amp * Math.random(), tmp);
          pos.setXYZ(k, tmp.x, tmp.y, tmp.z);
        }
        pos.needsUpdate = true;
        a.line.material.opacity = Math.random() < 0.25 ? 0 : 0.6 + Math.random() * 0.4;
      }
      // element wisps: born on the blade, drifting up or down in the world as they fade
      const Wc = E && WISP[el];
      if (Wc && wisps.length) {
        for (const seg of segs) upFor(seg);
        for (const w of wisps) {
          const age = ((t / Wc.life + w.ph) % 1), cyc = Math.floor(t / Wc.life + w.ph);
          if (cyc !== w.cyc) { w.cyc = cyc; w.s = hash(cyc * 13 + w.j * 7); w.ang = hash(cyc * 5 + w.j) * 6.28; }
          const sp = w.sp, dist = Wc.speed * Wc.life * age;
          at(w.seg, w.s, w.ang, 0.03, sp.position);
          if (Wc.dir) sp.position.addScaledVector(w.seg.up, Wc.dir * dist);
          else sp.position.addScaledVector(w.seg.p1, Math.cos(w.ang) * dist).addScaledVector(w.seg.p2, Math.sin(w.ang) * dist); // storm: sparks fly out
          sp.scale.setScalar(Wc.s0 + (Wc.s1 - Wc.s0) * age);
          let op = Wc.op * Math.min(1, (1 - age) * 2.5) * Math.min(1, age * 8 + 0.2);
          if (Wc.twinkle) op *= 0.55 + 0.45 * Math.sin(t * 14 + w.j * 2.1);
          sp.material.opacity = op;
          if (Wc.ramp) sp.material.color.setHex(Wc.ramp[Math.min(2, Math.floor(age * 3))]);
        }
      }
      if (!emit) return;
      // sparks in the world: the element's, and blood drips or shadow wisps for the classes that have them
      if (E) {
        const X = EMIT[el]; acc += X.rate * dt;
        while (acc >= 1) { acc -= 1; emit(randomPoint(), { colors: E.parts, ...X.o }); }
      }
      const CE = tier && CLASS_EMIT[CG.style];
      const rate = CE ? 2 * tier : tier >= 4 ? 6 : 0;
      if (rate) { accC += rate * dt; while (accC >= 1) { accC -= 1; emit(randomPoint(), CE || { colors: CG.colors, speed: 0.4, up: 0.8, life: 0.7, size: 0.22 }); } }
    },
    dispose() {
      for (const o of objs) { o.parent && o.parent.remove(o); o.material?.dispose(); if (o.isLine) o.geometry.dispose(); }
      objs.length = 0;
    },
  };
}

// a burst on whatever an infused weapon hits
export function elementHitFx(fx, pos, el) {
  const E = isElement(el) && ELEMENTS[el]; if (!E) return;
  const p = pos.clone(); p.y += 1;
  if (el === 'fire') fx.emit(p, { count: 8, colors: E.parts, speed: 2, up: 2, life: 0.45, size: 0.4, drag: 2 });
  else if (el === 'storm') fx.emit(p, { count: 10, colors: E.parts, speed: 5, life: 0.18, size: 0.22 });
  else if (el === 'frost') fx.emit(p, { count: 8, colors: E.parts, speed: 2.4, gravity: -4, life: 0.6, size: 0.28 });
  else if (el === 'wind') fx.emit(p, { count: 8, colors: E.parts, speed: 3.5, life: 0.3, size: 0.24, drag: 3 });
  else if (el === 'earth') fx.emit(p, { count: 7, colors: E.parts, speed: 2.5, up: 2.5, gravity: -14, life: 0.6, size: 0.28 });
  else if (el === 'light') fx.emit(p, { count: 9, colors: E.parts, speed: 2.2, up: 1, life: 0.55, size: 0.3 });
  else fx.emit(p, { count: 8, colors: E.parts, speed: 1.2, up: 1.2, life: 0.8, size: 0.45 });
}

// ============================================================ game side
const G = {
  // what your weapon shows: glow tier from its enhancement (broken weapons show nothing) and its element
  weaponLook() {
    const eq = this.S.equip.weapon;
    if (!eq || eq.dur === 0) return { wg: 0, we: null };
    return { wg: glowTier(eq.enh || 0), we: isElement(eq.el) ? eq.el : null };
  },
  applyWeaponFx(e, cls, wg, we) {
    if (e.wfx) { e.wfx.dispose(); e.wfx = null; }
    e.wfxKey = `${cls}|${wg}|${we}`; e.wfxHum = e.humanoid || null;
    if (e.humanoid && (wg || we)) e.wfx = buildWeaponFx(e.humanoid, cls, wg, we);
  },
  // after gear changes (recalc): rebuild your weapon's effect if it changed, and tell the others
  refreshWeaponFx() {
    const p = this.player; if (!p) return;
    const { wg, we } = this.weaponLook(), key = `${this.S.cls}|${wg}|${we}`;
    if (key === p.wfxKey && p.wfxHum === (p.humanoid || null)) return;
    const prev = this.wfxShown;
    this.applyWeaponFx(p, this.S.cls, wg, we);
    this.wfxShown = { wg, we };
    if (prev && wg > prev.wg) this.ui.toast(`Your weapon glows: ${GLOW_NAME[wg]} ${(CLASS_GLOW[this.S.cls] || CLASS_GLOW.knight).name}!`, 'good');
    if (prev && we && we !== prev.we) this.ui.toast(`Your weapon now carries ${ELEMENTS[we].name}!`, 'good');
    this.mpTrackNow && this.mpTrackNow();
  },
  animateWeaponFx() {
    const t = this.time, dt = Math.min(0.1, Math.max(0, t - (this.wfxT ?? t))); this.wfxT = t;
    const p = this.player; if (!p) return;
    if ((p.humanoid || null) !== p.wfxHum) this.refreshWeaponFx(); // the hero model was rebuilt (class, costume)
    const emit = (pos, o) => this.fx.emit(pos, o);
    if (p.wfx) p.wfx.update(t, dt, p.model.visible ? emit : null);
    for (const e of this.rplayers || []) {
      if (!e.wfx) continue;
      const near = !e.netHidden && e.model.visible && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < 60;
      e.wfx.update(t, dt, near ? emit : null);
    }
  },
};
export function installWeaponFx(Game) { Object.assign(Game.prototype, G); }
