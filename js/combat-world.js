// What class skills do in the world: every active skill kind (strikes, projectiles, cones, novas, blasts, lines,
// chains, dashes, leaps, blinks, channels, zones, traps, summons, buffs, debuffs, heals, taunts and the special
// ones), status effects on monsters (stun, root, slow, fear, taunt, blind, silence, knockback, knock-up, pull,
// marks, armor and attack breaks, bleed, poison, burn, curses, links, doom), summons with their own AI, and the
// per-frame update for all of it.
import * as THREE from 'three';
import { CLASSES, SKILL_BY_ID } from './data-classes.js';
import { buildMonster, buildPet, buildMount, buildHumanoid, animateHumanoid, animateCreature } from './models.js';
import { glowTexture } from './toon.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rnd = (a, b) => a + Math.random() * (b - a);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const isBoss = (m) => !!(m.def0?.boss || m.wb || m.def0?.structure);

// summon types: hp / atk as a share of the hero's, attack range, how they look and act
const UNITS = {
  wisp: { name: 'Spirit Wisp', hp: 0.25, atk: 0.35, range: 9, ranged: true, slot: true, speed: 8, h: 1.2 },
  wolf: { name: 'Spirit Wolf', hp: 0.6, atk: 0.45, range: 2, slot: true, speed: 9, h: 1.4 },
  owl: { name: 'Spirit Owl', hp: 0.3, atk: 0.35, range: 11, ranged: true, slot: true, speed: 9, h: 1.6, marks: 0.05 },
  bear: { name: 'Spirit Bear', hp: 1.6, atk: 0.4, range: 2.4, slot: true, taunt: true, speed: 7, h: 2.2 },
  companion: { name: 'Companion', hp: 0.8, atk: 0.5, range: 2.2, speed: 9.5, h: 1.6 },
  beast: { name: 'Spirit Beast', hp: 0.7, atk: 0.6, range: 2.4, speed: 10, h: 1.8 },
  behemoth: { name: 'Spirit Behemoth', hp: 3.5, atk: 0.7, range: 3.5, taunt: true, speed: 6, h: 4, stomp: true },
  kraken: { name: 'Elder Kraken', hp: 5, atk: 1.4, range: 9, still: true, h: 3.5, slam: true },
  decoy: { name: 'Mirage', hp: 0.5, atk: 0, range: 0, taunt: true, still: true, h: 2 },
  clone: { name: 'Umbral Clone', hp: 0.5, atk: 0.5, range: 2.5, speed: 9, h: 2 },
  healer: { name: 'Guardian Spirit', hp: 0.4, atk: 0, range: 0, healer: true, speed: 8, h: 1.6 },
  wall: { name: 'Bastion Wall', hp: 2.5, atk: 0, range: 0, taunt: true, still: true, h: 2.2 },
};
const SPIRIT = { wisp: 0xb8ff9a, wolf: 0x9ae8ff, owl: 0xd8f0ff, bear: 0x9ad8ff, beast: 0xb8ffd8, behemoth: 0x9ac8ff, kraken: 0x7ad8c8, decoy: 0x8a6aff, clone: 0x6a4aff, healer: 0x8ad8ff };

const W = {
  // ================================================================ dispatch
  applySkill(sk, t) {
    const p = this.player; if (p.dead) return;
    if (t && t.dead) t = null;
    if (sk.basic) return this.basicHit(sk, t);
    let m = (sk.m || 0) * this.rm(sk);
    // dungeon set powers: Riptide (+18% skill damage) and Constellation (every 10 s the next skill hits twice as hard)
    if (m > 0 && this.hasFx('set_riptide')) m *= 1.18;
    if (m > 0 && this.hasFx('set_constellation') && (this.procCD.constel || 0) <= this.time) {
      this.procCD.constel = this.time + 10; m *= 2;
      this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.5), 'Constellation!', 'crit');
    }
    const fn = this['k_' + sk.k];
    if (fn) fn.call(this, sk, t, m);
    // Overcharge: the next damaging spells also chain to extra targets
    if (this.pflag('overcharge') && t && m > 0 && sk.k !== 'buff' && sk.id !== 'el_overcharge') {
      const b = p.buffs.find((x) => x.flags?.overcharge); if (b) { b.flags.overcharge--; if (b.flags.overcharge <= 0) b.until = 0; }
      this.chainFrom(t, 2, m * 0.5, sk);
    }
    if (sk.k !== 'buff' && sk.k !== 'heal' && this.rule('darkPact') && sk.curse) this.heal(p, p.maxHp * 0.02);
    for (const s of this.summons || []) if (s.unit === 'clone' && !s.dead && t && m > 0) this.after(0.25, () => { if (!t.dead && !s.dead) { this.fx.bolt(s.pos.clone().setY(s.pos.y + 1.2), t.pos.clone().setY(t.pos.y + t.height * 0.6), 0x8a6aff); this.damage(p, t, m * 0.5, { proc: true, sk }); } });
  },
  basicHit(sk, t) {
    const p = this.player, C = CLASSES[this.S.cls];
    if (!t || t.dead) return;
    if (sk.k === 'proj') {
      const hand = p.pos.clone().add(V3(Math.sin(p.yaw) * 0.6, 1.3, Math.cos(p.yaw) * 0.6));
      this.fx.projectile(hand, t, { color: sk.color || C.elemColor, size: this.S.cls === 'ranger' ? 0.26 : 0.32, speed: 30, onHit: () => this.hitEnemy(t, sk, sk.m) });
      return;
    }
    const fxc = this.S.cls === 'berserker' ? 0xffb08a : this.S.cls === 'assassin' ? 0x7affd0 : this.S.cls === 'spellblade' ? 0x5ad8ff : 0xffffff;
    this.fx.slash(p.pos, p.yaw, fxc, this.S.cls === 'berserker' ? 2.3 : 1.7, this.S.cls === 'assassin' ? (Math.random() < 0.5 ? 0.5 : -0.5) : 0.3);
    this.hitEnemy(t, sk, sk.m);
    if (sk.cleave) for (const e of this.enemiesIn(p.pos, sk.cleave + 1)) if (e !== t && this.inCone(e, p.pos, p.yaw, sk.cleave + 1, 120)) this.hitEnemy(e, sk, sk.m * 0.5, { proc: true });
  },
  // one damaging hit on an enemy plus the skill's on-hit effects
  hitEnemy(t, sk, mult, o = {}) {
    if (!t || t.dead) return 0;
    const dmg = this.damage(this.player, t, mult, { sk, critAdd: sk?.critAdd, critDmgAdd: sk?.critDmgAdd, ...o });
    if (t.kind === 'monster' && !t.dead && sk && !o.noFx) this.onHitEffects(t, sk, dmg);
    if (sk && sk.lifesteal && dmg > 0) this.heal(this.player, dmg * sk.lifesteal / 100);
    if (sk && sk.healAllies && dmg > 0) this.healParty(dmg * (sk.healAllies + this.smod(sk.id, 'heal')) / 100 / this.player.maxHp, 15, true);
    if (sk && sk.runes) this.addRunes(sk.runes);
    if (dmg > 0 && t.kind === 'monster') this.gainMastery('weapon', sk?.basic ? 1 : 0.7, t);
    return dmg;
  },
  onHitEffects(t, sk, dmg) {
    const p = this.player;
    if (sk.stun) this.st(t, 'stun', sk.stun);
    if (sk.root) this.st(t, 'root', sk.root);
    if (sk.slow) this.st(t, 'slow', sk.slow);
    if (sk.bleed) this.st(t, 'bleed', [sk.bleed[0] * this.rm(sk), sk.bleed[1], sk.bleedStack || (this.rk(SKILL_BY_ID.bk_hemo) ? 3 : 1)]);
    if (sk.burn) this.st(t, 'burn', [sk.burn[0] * this.rm(sk), sk.burn[1]]);
    if (sk.poison) this.st(t, 'poison', sk.poison);
    if (sk.knock) this.st(t, 'knock', [sk.knock, p.pos]);
    if (sk.knockup) this.st(t, 'knockup', sk.knockup);
    if (sk.silence && (sk.needStealth !== 'silence' || this.pflag('stealth') || this.stealthHitT > this.time)) this.st(t, 'silence', sk.silence);
    if (sk.interrupt) this.st(t, 'interrupt', 1);
    if (sk.blind) this.st(t, 'blind', sk.blind);
    if (sk.fear) this.st(t, 'fear', sk.fear);
    if (sk.mark) this.st(t, 'mark', [sk.mark[0], sk.mark[1] * (1 + this.smod(sk.id, 'dur') / 100)]);
    if (sk.defdown) this.st(t, 'defdown', sk.defStack ? [Math.min(0.18, (t.ddT > this.time ? t.ddP : 0) + sk.defdown[0]), sk.defdown[1]] : sk.defdown);
    if (sk.atkdown) this.st(t, 'atkdown', sk.atkdown);
    if (sk.pull && !sk.k?.startsWith('zone')) this.st(t, 'pull', [p.pos.clone().add(V3(Math.sin(p.yaw) * 1.6, 0, Math.cos(p.yaw) * 1.6)), 99]);
    if (this.rule('avalanche') && ['cone', 'nova', 'blast', 'line', 'channel'].includes(sk.k) && this.S.cls === 'berserker' && (t.kdT || 0) <= this.time) { t.kdT = this.time + 4; this.st(t, 'stun', 0.8); }
  },

  // ================================================================ geometry helpers
  enemiesIn(c, r) {
    const out = [], Wm = this.map;
    for (const m of this.monsters) if (!m.dead && (m.map || this.world) === Wm && flat(m.pos, c) < r + m.radius * 0.5 && !(this.dg && m.dungeon && m.room > this.dg.cleared.size)) out.push(m);
    if (this.dzIn) for (const e of this.rplayers || []) if (this.pvpFoe(e) && flat(e.pos, c) < r + 0.5) out.push(e);
    return out;
  },
  inCone(e, o, yaw, r, ang) {
    const dx = e.pos.x - o.x, dz = e.pos.z - o.z, d = Math.hypot(dx, dz);
    if (d > r + (e.radius || 0.5)) return false;
    if (d < 1) return true;
    return (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / d >= Math.cos((ang / 2) * Math.PI / 180);
  },
  inLine(e, o, dir, len, w) {
    const dx = e.pos.x - o.x, dz = e.pos.z - o.z;
    const along = dx * dir.x + dz * dir.z, side = Math.abs(dx * dir.z - dz * dir.x);
    return along > -0.5 && along < len + (e.radius || 0.5) && side < w / 2 + (e.radius || 0.5) * 0.6;
  },
  area(r) { return r * (1 + this.ps('area') / 100); },
  facing(t) { const p = this.player; if (t) { const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z, L = Math.hypot(dx, dz) || 1; return V3(dx / L, 0, dz / L); } return V3(Math.sin(p.yaw), 0, Math.cos(p.yaw)); },
  ground(x, z) { return V3(x, this.map.heightAt(x, z), z); },
  hand() { const p = this.player; return p.pos.clone().add(V3(Math.sin(p.yaw) * 0.6, 1.3, Math.cos(p.yaw) * 0.6)); },
  spot(sk, t) { if (t && !t.dead) return t.pos.clone(); return this.aimPoint(this.skRange(sk)); },
  // a fake projectile target at a fixed point
  pt(v) { return { pos: v, height: 0.2, dead: false }; },

  // ================================================================ kinds
  k_strike(sk, t, m) {
    const p = this.player; if (!t) return;
    const hits = sk.hits || 1, gap = sk.gap || 0.12;
    let mult = m;
    if (sk.defScale) mult += this.defOf(p) * sk.defScale * this.rm(sk) / Math.max(1, this.atkOf(p));
    if (sk.perCurse) mult += sk.perCurse * this.rm(sk) * this.curseCount(t);
    if (sk.pull && t.kind === 'monster' && !isBoss(t)) { const d = this.facing(t); t.pos.x = p.pos.x + d.x * 2; t.pos.z = p.pos.z + d.z * 2; }
    if (this.pflag('stealth')) this.stealthHitT = this.time + 0.4;
    const ranged = (sk.range || 0) > 5;
    for (let i = 0; i < hits; i++) this.after(i * gap, () => {
      if (t.dead) return;
      if (sk.bolt) this.fx.bolt(t.pos.clone().setY(t.pos.y + 14), t.pos.clone().setY(t.pos.y + 0.5), 0xd8c8ff, 0.35);
      else if (sk.roots) { this.fx.emit(t.pos.clone().setY(t.pos.y + 0.3), { count: 26, colors: [0x5ac84a, 0x8a5a2a], speed: 3, life: 0.8, size: 0.6, up: 3 }); this.fx.circle(t.pos, '#7ad85a', 1.4, sk.root || 1.5, null); }
      else if (sk.drain) this.fx.bolt(this.hand(), t.pos.clone().setY(t.pos.y + t.height * 0.6), 0x9a4ad8, 0.3);
      else if (ranged) this.fx.bolt(this.hand(), t.pos.clone().setY(t.pos.y + t.height * 0.6), CLASSES[this.S.cls].elemColor, 0.25);
      else this.fx.slash(p.pos, p.yaw + (i % 2 ? 0.25 : -0.25), sk.magic ? 0x5ad8ff : CLASSES[this.S.cls].elemColor === '#e04a3a' ? 0xff8a6a : 0xffffff, 1.8, i % 2 ? 0.5 : -0.5, 0.24);
      if (sk.stun && i === hits - 1) { this.fx.emit(t.pos.clone().setY(t.pos.y + t.height), { count: 18, color: 0xffe07a, speed: 4, life: 0.5, size: 0.6 }); this.fx.shake(0.12); }
      this.hitEnemy(t, sk, mult, i < hits - 1 && !sk.defStack ? { noFx: !!sk.stun } : {});
    });
  },
  k_proj(sk, t, m) {
    if (!t) return;
    const from = this.hand(), color = sk.color || CLASSES[this.S.cls].elemColor;
    const hitIt = (e, mult) => {
      if (sk.bubble) this.fx.bubble(e, sk.stun || 2);
      this.hitEnemy(e, sk, mult);
      if (sk.splash) { this.fx.ring(e.pos, color, this.area(sk.splash), 0.4); this.fx.emit(e.pos.clone().setY(e.pos.y + 1), { count: 30, colors: [color, 0xffd04a], speed: 6, life: 0.5, size: 0.7 }); this.sfx.play('boom'); for (const x of this.enemiesIn(e.pos, this.area(sk.splash))) if (x !== e) this.hitEnemy(x, sk, mult * 0.6, { proc: true }); }
    };
    if (sk.bounce) {
      const hit = new Set(); let n = sk.bounce;
      const go = (fromV, e) => this.fx.projectile(fromV, e, { color, size: sk.size || 0.4, speed: 26, onHit: () => {
        hit.add(e); hitIt(e, m);
        if (--n <= 0) return;
        const next = this.enemiesIn(e.pos, 10).filter((x) => !hit.has(x)).sort((a, b) => flat(a.pos, e.pos) - flat(b.pos, e.pos))[0];
        if (next) go(e.pos.clone().setY(e.pos.y + e.height * 0.6), next);
      } });
      go(from, t); return;
    }
    if (sk.ret) {
      this.fx.projectile(from, t, { color, size: sk.size || 0.5, speed: 24, onHit: () => {
        hitIt(t, m);
        this.fx.projectile(t.pos.clone().setY(t.pos.y + 1), this.player, { color, size: sk.size || 0.5, speed: 24 });
        this.after(0.3, () => { if (!t.dead) hitIt(t, m); });
      } });
      return;
    }
    this.fx.projectile(from, t, { color, size: sk.size || 0.4, speed: sk.charge ? 40 : 28, onHit: () => hitIt(t, m) });
  },
  k_cone(sk, t, m) {
    const p = this.player, r = this.area(sk.r), yaw = p.yaw;
    for (let i = -1; i <= 1; i++) this.fx.slash(p.pos, yaw + i * (sk.ang / 180) * 0.6, CLASSES[this.S.cls].elemColor === '#e04a3a' ? 0xffb08a : 0xffe0a0, Math.min(r, 3.5), i * 0.3, 0.3);
    if (sk.r >= 6) { for (let i = 1; i <= 4; i++) this.after(i * 0.06, () => { const c = this.ground(p.pos.x + Math.sin(yaw) * r * i / 4, p.pos.z + Math.cos(yaw) * r * i / 4); this.fx.quake(c, 1.6 + i * 0.4); }); this.sfx.play('boom'); }
    for (const e of this.enemiesIn(p.pos, r + 1)) if (this.inCone(e, p.pos, yaw, r, sk.ang)) this.hitEnemy(e, sk, m);
  },
  k_nova(sk, t, m) {
    const p = this.player, c = p.pos.clone(), r = this.area(sk.r), col = CLASSES[this.S.cls].elemColor;
    if (sk.knives) { for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; this.fx.projectile(c.clone().setY(c.y + 1.1), this.pt(this.ground(c.x + Math.sin(a) * r, c.z + Math.cos(a) * r).setY(c.y + 1)), { color: 0xd8f0ff, size: 0.18, speed: 30, trail: false }); } }
    else if (sk.smoke) { this.fx.emit(c.clone().setY(c.y + 0.6), { count: 70, colors: [0x5a5a6a, 0x8a8a9a, 0x3a3a48], speed: 3, life: 2, size: 1.6, up: 0.5, drag: 1.5, jitter: r * 0.6 }); }
    else if (sk.frost) { this.fx.ring(c, 0xbfe8ff, r, 0.6); this.fx.emit(c.clone().setY(c.y + 0.4), { count: 60, colors: [0xbfe8ff, 0xffffff], speed: 9, life: 0.6, size: 0.6, spread: 1 }); }
    else if (sk.wave) { this.fx.ring(c, 0x4ab8ff, r, 0.6); this.fx.pillar(c, 0x6ad0ff, r * 0.6, 3, 0.6); }
    else if (sk.k === 'nova' && sk.r >= 7.5) { this.fx.spin(p.pos, 0xffd0a0, r); this.fx.quake(c, r); this.fx.shake(0.3); this.sfx.play('boom'); }
    else { this.fx.ring(c, typeof col === 'string' ? new THREE.Color(col).getHex() : col, r, 0.5); this.fx.spin(p.pos, 0xffe0c0, Math.min(r, 5)); }
    for (const e of this.enemiesIn(c, r)) { if (m > 0) this.hitEnemy(e, sk, m); else if (e.kind === 'monster') this.onHitEffects(e, sk, 0); }
  },
  k_blast(sk, t, m) {
    const c = this.spot(sk, t), r = this.area(sk.r), waves = sk.waves || 1, col = CLASSES[this.S.cls].elemColor;
    const land = (i) => {
      if (sk.meteor) { this.fx.meteor(c, 0xff6a1a, sk.delay || 1, () => { this.sfx.play('boom'); this.fx.shake(0.4); this.fx.quake(c, r); this.blastHit(c, r, sk, m); }); return; }
      if (sk.big) { this.fx.telegraph(c, r, sk.delay || 1, () => { this.fx.pillar(c, 0xff6a3a, 1.2, 16, 0.6); this.fx.quake(c, r); this.fx.shake(0.6); this.sfx.play('boom'); this.blastHit(c, r, sk, m); }); return; }
      if (sk.arrows) { for (let k = 0; k < 10; k++) { const o = c.clone().add(V3(rnd(-r, r) * 0.8, 0, rnd(-r, r) * 0.8)); this.fx.projectile(o.clone().setY(o.y + 12), this.pt(o), { color: 0xffe0a0, size: 0.2, speed: 40, trail: false }); } }
      if (sk.pillar) this.fx.pillar(c, 0xff6a2a, r * 0.7, 10, 0.9);
      if (sk.tentacle) { for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; this.fx.pillar(this.ground(c.x + Math.sin(a) * r * 0.7, c.z + Math.cos(a) * r * 0.7), 0x3a8a7a, 0.4, 3, 0.7); } }
      if (sk.flare) { this.fx.pillar(c, 0xfff0a0, 1, 12, 1.2); this.fx.emit(c.clone().setY(c.y + 6), { count: 60, colors: [0xffffff, 0xfff0a0], speed: 8, life: 1.2, size: 0.8 }); }
      if (sk.wave) this.fx.pillar(c, 0x6ad0ff, r * 0.7, 3, 0.6);
      this.fx.ring(c, typeof col === 'string' ? new THREE.Color(col).getHex() : col, r, 0.5);
      this.after(sk.arrows ? 0.3 : 0.05, () => this.blastHit(c, r, sk, m));
    };
    if (!sk.meteor && !sk.big && sk.delay) { this.fx.telegraph(c, r, sk.delay, () => land(0)); return; }
    for (let i = 0; i < waves; i++) this.after(i * 0.4, () => land(i));
  },
  blastHit(c, r, sk, m) {
    for (const e of this.enemiesIn(c, r)) {
      if (sk.pull && e.kind === 'monster') this.st(e, 'pull', [c, 99]);
      if (m > 0) this.hitEnemy(e, sk, m); else if (e.kind === 'monster') this.onHitEffects(e, sk, 0);
    }
  },
  k_line(sk, t, m) {
    const p = this.player, dir = t ? this.facing(t) : (() => { const a = this.aimPoint(sk.len); const dx = a.x - p.pos.x, dz = a.z - p.pos.z, L = Math.hypot(dx, dz) || 1; return V3(dx / L, 0, dz / L); })();
    p.yaw = p.yawT = Math.atan2(dir.x, dir.z);
    const o = p.pos.clone(), len = sk.len, w = this.area(sk.w), seq = sk.seq || 1;
    for (let s = 0; s < seq; s++) this.after((sk.delay || 0) + s * 0.35, () => {
      const steps = Math.max(3, Math.round(len / 2.5));
      for (let i = 1; i <= steps; i++) this.after(i * 0.03, () => {
        const c = this.ground(o.x + dir.x * len * i / steps, o.z + dir.z * len * i / steps);
        if (sk.arrow || sk.star) this.fx.emit(c.clone().setY(c.y + 1.1), { count: sk.star ? 10 : 4, colors: sk.star ? [0xffffff, 0xfff08a] : [0xffe0a0, 0xffffff], speed: 1, life: 0.4, size: sk.star ? 0.9 : 0.4 });
        else if (sk.wave) { this.fx.emit(c.clone().setY(c.y + 0.5), { count: 14, colors: [0x6ad0ff, 0xffffff], speed: 3, life: 0.6, size: 0.9, up: 3, jitter: w * 0.4 }); }
        else if (sk.beam) this.fx.emit(c.clone().setY(c.y + 1), { count: 6, colors: [sk.beam, 0xffffff], speed: 1.2, life: 0.4, size: 0.7 });
        else if (sk.herd) this.fx.emit(c.clone().setY(c.y + 0.8), { count: 10, colors: [0xb8ffd8, 0xffffff], speed: 2, life: 0.5, size: 1, jitter: w * 0.4 });
        else if (sk.shard) this.fx.emit(c.clone().setY(c.y + 1), { count: 5, colors: [0xbfe8ff, 0xffffff], speed: 1, life: 0.5, size: 0.6 });
        else this.fx.quake(c, Math.max(1.4, w * 0.6));
      });
      if (!sk.arrow && !sk.beam && !sk.shard) this.sfx.play('boom');
      for (const e of this.enemiesIn(o.clone().addScaledVector(dir, len / 2), len / 2 + w)) if (this.inLine(e, o, dir, len, w)) this.hitEnemy(e, sk, m);
    });
    if (sk.star) this.fx.shake(0.5);
  },
  k_chain(sk, t, m) { if (t) this.chainFrom(t, sk.n + (this.smod(sk.id, 'targets') || 0), m, sk, this.hand()); },
  chainFrom(t, n, m, sk, from = null) {
    let prev = from || t.pos.clone().setY(t.pos.y + t.height * 0.6), cur = t; const hit = new Set();
    for (let i = 0; i < n && cur; i++) {
      const e = cur, a = prev, b = e.pos.clone().setY(e.pos.y + e.height * 0.6);
      this.after(i * 0.08, () => { this.fx.bolt(a, b, 0xc8b8ff); if (!e.dead) this.hitEnemy(e, sk, m); });
      hit.add(e); prev = b;
      cur = this.enemiesIn(e.pos, 9).filter((x) => !hit.has(x)).sort((x, y) => flat(x.pos, e.pos) - flat(y.pos, e.pos))[0];
    }
  },
  k_multi(sk, t, m) {
    const p = this.player; if (!t) return;
    const list = [t, ...this.enemiesIn(p.pos, sk.r).filter((e) => e !== t).sort((a, b) => flat(a.pos, p.pos) - flat(b.pos, p.pos))];
    const targets = [];
    for (let i = 0; i < sk.n; i++) targets.push(sk.same ? t : list[i % list.length]);
    if (sk.via === 'proj') {
      targets.forEach((e, i) => this.after(i * (sk.same ? 0.1 : 0.04), () => { if (!e.dead) this.fx.projectile(this.hand(), e, { color: sk.color || 0xffe0a0, size: 0.3, speed: sk.same ? 18 : 30, onHit: () => this.hitEnemy(e, sk, m) }); }));
      return;
    }
    // via blink: hop from target to target and end beside the last one
    targets.forEach((e, i) => this.after(i * (sk.n >= 5 ? 0.2 : 0.25), () => {
      if (e.dead || p.dead) return;
      const a = Math.random() * Math.PI * 2, x = e.pos.x + Math.sin(a) * (e.radius + 1), z = e.pos.z + Math.cos(a) * (e.radius + 1);
      this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 14, colors: [0x6a4aff, 0x2a1a4a], speed: 2, life: 0.4, size: 0.7 });
      if (!this.map.isBlocked(x, z)) { p.pos.x = x; p.pos.z = z; }
      p.yaw = p.yawT = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      p.state = 'attack'; p.actT = p.actDur = 0.2;
      this.fx.slash(p.pos, p.yaw, 0xb07aff, 1.8, i % 2 ? 0.6 : -0.6, 0.2);
      this.hitEnemy(e, sk, m);
    }));
  },
  k_dash(sk, t, m) {
    const p = this.player, dir = this.facing(t);
    let d = sk.d;
    if (t && flat(p.pos, t.pos) < sk.d + 4) d = Math.max(0, flat(p.pos, t.pos) - t.radius - 1);
    const o = p.pos.clone();
    let end = o.clone();
    for (let s = 0.5; s <= d; s += 0.5) { const x = o.x + dir.x * s, z = o.z + dir.z * s; if (this.map.isBlocked(x, z)) break; end.set(x, 0, z); }
    const len = flat(o, end);
    this.tween = { from: o.clone(), to: end.clone(), t: 0, dur: Math.max(0.12, len / 40), h: 0 };
    for (let i = 0; i <= 8; i++) this.fx.emit(this.ground(o.x + dir.x * len * i / 8, o.z + dir.z * len * i / 8).setY(p.pos.y + 1), { count: 6, color: sk.el === 'fire' ? 0xff7a2a : sk.healPass ? 0x6ad0ff : CLASSES[this.S.cls].elemColor === '#d9a441' ? 0xffe0a0 : 0xa87aff, speed: 1, life: 0.5, size: 0.8 });
    let hits = 0; const max = sk.through || 0;
    for (const e of this.enemiesIn(o.clone().addScaledVector(dir, len / 2), len / 2 + 2)) {
      if (!this.inLine(e, o, dir, len + 1, 2.6)) continue;
      if (max && hits >= max) break;
      if (!max && e !== t) continue;
      hits++; this.after(0.08, () => this.hitEnemy(e, sk, m));
    }
    if (!max && t && !t.dead && hits === 0 && flat(end, t.pos) < t.radius + 2.5) this.after(0.08, () => this.hitEnemy(t, sk, m));
    if (sk.trail) this.addZone({ sk, kind: 'trail', at: o.clone().addScaledVector(dir, len / 2), dir, len, r: 1.6, shape: 'line', dur: 4, ticks: 8, m: 0.5 * this.rm(sk), burn: [0.2, 3], color: 0xff6a1a });
    if (sk.healPass) { this.heal(p, p.maxHp * sk.healPass * this.healMod); this.healParty(sk.healPass, 6, false); }
    if (this.mounted) this.dismount(true);
  },
  k_leap(sk, t, m) {
    const p = this.player;
    let to = null;
    if (sk.to === 'ally') { const a = this.allyNear(sk.range); if (a) to = a.pos.clone(); }
    if (!to && t && flat(p.pos, t.pos) <= sk.range + 2) to = t.pos.clone().addScaledVector(this.facing(t), -Math.min(1.2, t.radius));
    if (!to) to = this.aimPoint(sk.range);
    if (this.map.isBlocked(to.x, to.z)) to = p.pos.clone().addScaledVector(this.facing(t), Math.min(sk.range, 6));
    if (this.map.isBlocked(to.x, to.z)) to = p.pos.clone();
    const r = this.area(sk.r);
    this.tween = { from: p.pos.clone(), to, t: 0, dur: 0.5, h: 3, onEnd: () => {
      this.fx.quake(to, r); this.fx.ring(to, 0xffd08a, r, 0.4); this.fx.shake(sk.lv >= 200 ? 0.6 : 0.3); this.sfx.play('boom');
      for (const e of this.enemiesIn(to, r)) this.hitEnemy(e, sk, m);
      if (sk.guard) { const b = { id: 'guardleap', icon: sk.id, until: this.time + sk.guard, mods: { def: 1.2 } }; p.buffs = p.buffs.filter((x) => x.id !== b.id); p.buffs.push(b); this.guardT = this.time + sk.guard; }
    } };
    p.state = 'attack'; p.actT = p.actDur = 0.55;
  },
  k_blink(sk, t, m) {
    const p = this.player;
    let to;
    if (sk.dir === 'behind' && t) { const f = t.yaw ?? Math.atan2(p.pos.x - t.pos.x, p.pos.z - t.pos.z); to = V3(t.pos.x - Math.sin(f) * (t.radius + 1), 0, t.pos.z - Math.cos(f) * (t.radius + 1)); }
    else { const back = sk.dir === 'back' ? -1 : 1, d = sk.d * (sk.id === 'el_blink' ? 1 : 1); to = V3(p.pos.x + Math.sin(p.yaw) * d * back, 0, p.pos.z + Math.cos(p.yaw) * d * back); }
    const o = p.pos.clone();
    // step back toward the start until the spot is walkable
    for (let k = 0; k < 12 && this.map.isBlocked(to.x, to.z); k++) to.lerp(o, 0.2);
    this.fx.emit(o.clone().setY(o.y + 1), { count: 24, colors: [CLASSES[this.S.cls].elemColor === '#5ad8ff' ? 0x5ad8ff : 0xb07aff, 0xffffff], speed: 3, life: 0.5, size: 0.7 });
    if (sk.dir === 'back') { this.tween = { from: o, to, t: 0, dur: 0.35, h: 1.4 }; this.rolling = { t0: this.time - 0.05, dx: 0, dz: 0, done: 0, blink: true }; this.after(sk.iframes || 0.4, () => { if (this.rolling?.blink) this.rolling = null; }); }
    else { p.pos.x = to.x; p.pos.z = to.z; }
    this.fx.emit(to.clone().setY(this.map.heightAt(to.x, to.z) + 1), { count: 24, colors: [0xb07aff, 0xffffff], speed: 3, life: 0.5, size: 0.7 });
    if (t && m > 0) { p.yaw = p.yawT = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z); this.after(0.1, () => { this.fx.slash(p.pos, p.yaw, 0xb07aff, 1.8, 0.4); this.hitEnemy(t, sk, m); }); }
    if (this.mounted) this.dismount(true);
  },
  k_channel(sk, t, m) {
    const ticks = sk.ticks, every = sk.dur / ticks;
    this.channel = { sk, t, m, i: 0, next: this.time, every, until: this.time + sk.dur + 0.01 };
  },
  channelTick() {
    const C = this.channel, p = this.player;
    if (!C) return;
    if (p.dead || p.stun > 0 || this.time > C.until || C.i >= C.sk.ticks) { this.channel = null; return; }
    if (this.time < C.next) { if (C.sk.sub === 'nova') { p.state = 'attack'; p.actT = 0.1; p.yaw += 0.5; } return; }
    C.next += C.every; C.i++;
    const sk = C.sk, m = C.m;
    if (sk.sub === 'nova') {
      const r = this.area(sk.r);
      this.fx.spin(p.pos, sk.id.startsWith('gd') ? 0xd9a441 : sk.id.startsWith('sp') ? 0x5ad8ff : 0xffc0a0, r);
      for (const e of this.enemiesIn(p.pos, r)) { if (sk.pull && e.kind === 'monster') this.st(e, 'pull', [p.pos.clone(), 3]); this.hitEnemy(e, sk, m); }
      if (this.rule('spinKbImmune')) this.kbImmuneT = this.time + C.every + 0.1;
    } else if (sk.sub === 'cone') {
      const r = this.area(sk.r);
      for (let k = 0; k < 3; k++) this.fx.emit(p.pos.clone().add(V3(Math.sin(p.yaw) * (1 + k * 2.5), 1.1, Math.cos(p.yaw) * (1 + k * 2.5))), { count: 16, colors: [0xff6a1a, 0xffd04a, 0xff3a1a], speed: 4, life: 0.5, size: 1 + k * 0.4, spread: 1 });
      p.state = 'cast'; p.actT = p.actDur = C.every + 0.05;
      for (const e of this.enemiesIn(p.pos, r + 1)) if (this.inCone(e, p.pos, p.yaw, r, sk.ang)) this.hitEnemy(e, sk, m);
    } else if (sk.sub === 'strike') {
      const t = C.t && !C.t.dead ? C.t : null; if (!t) { this.channel = null; return; }
      this.fx.bolt(this.hand(), t.pos.clone().setY(t.pos.y + t.height * 0.6), sk.drain ? 0x9a4ad8 : 0xffffff, 0.3);
      p.state = 'cast'; p.actT = p.actDur = C.every + 0.05;
      this.hitEnemy(t, sk, m);
    } else if (sk.sub === 'proj') {
      const t = C.t && !C.t.dead ? C.t : this.nearestEnemy(this.skRange(sk));
      if (!t) return;
      if (t !== C.t) { C.t = t; this.setTarget(t); }
      p.yaw = p.yawT = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
      p.state = 'shoot'; p.actT = p.actDur = C.every + 0.05;
      this.fx.projectile(this.hand(), t, { color: 0xffe0a0, size: 0.24, speed: 34, onHit: () => this.hitEnemy(t, sk, m) });
    }
  },
  k_zone(sk, t, m) {
    const p = this.player;
    let at = sk.at === 'target' ? this.spot(sk, t) : p.pos.clone();
    let dir = this.facing(t);
    if (sk.at === 'front') at = p.pos.clone().addScaledVector(dir, 4);
    const r = this.area(sk.r) * (1 + this.smod(sk.id, 'area') / 100);
    this.addZone({ sk, kind: sk.at, at, dir, r, len: sk.len, shape: sk.shape, dur: sk.dur, ticks: sk.ticks, m, color: sk.color });
  },
  k_trap(sk, t, m) {
    const p = this.player;
    let at = t && flat(t.pos, p.pos) < 12 ? t.pos.clone() : p.pos.clone().addScaledVector(this.facing(t), 2.2);
    if (this.map.isBlocked(at.x, at.z)) at = p.pos.clone();
    at.y = this.map.heightAt(at.x, at.z);
    const mesh = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 20), new THREE.MeshBasicMaterial({ color: sk.magic ? 0x5ad8ff : sk.blast ? 0xff7a3a : 0xd8c08a, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; mesh.add(ring);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.12, 10), new THREE.MeshToonMaterial({ color: sk.magic ? 0x2a4a7a : 0x6a4a2a })); core.position.y = 0.06; mesh.add(core);
    mesh.position.copy(at); this.scene.add(mesh);
    (this.traps = this.traps || []).push({ sk, at, mesh, ring, armT: this.time + 0.5, until: this.time + sk.dur, m: (sk.blast ? sk.blast[0] : 0) * this.rm(sk) });
    if ((this.traps.length) > 4) this.removeTrap(this.traps[0]);
  },
  k_summon(sk, t, m) { this.summonUnits(sk, t); },
  k_buff(sk) {
    const p = this.player;
    if (sk.hpCost) { if (p.hp <= p.maxHp * sk.hpCost + 1) { this.ui.toast('Not enough HP to pay the price', 'warn'); return; } p.hp -= Math.round(p.maxHp * sk.hpCost); this.fx.text(p.pos.clone().setY(p.pos.y + p.height), '-' + Math.round(p.maxHp * sk.hpCost), 'hurt'); }
    const dur = sk.dur * (1 + this.smod(sk.id, 'dur') / 100);
    const k = this.rm(sk);
    const mods = sk.mods ? Object.fromEntries(Object.entries(sk.mods).map(([key, v]) => [key, key === 'dmgTaken' ? (v < 1 ? 1 - (1 - v) * Math.min(1.6, k) : v) : 1 + (v - 1) * k])) : null;
    const flags = sk.flags ? { ...sk.flags } : null;
    if (flags?.reflect) flags.reflect *= k;
    if (flags?.parry) flags.parry *= 1;
    const b = { id: sk.id, icon: sk.id, until: this.time + dur, mods, flags };
    p.buffs = p.buffs.filter((x) => x.id !== sk.id); p.buffs.push(b);
    if (sk.shieldPct) { p.shield = (p.shield || 0) + p.maxHp * sk.shieldPct * k; b.shield = true; this.fx.circle(p.pos, '#9ad0ff', 1.8, dur, p.model); }
    if (flags?.stealth) { for (const mo of this.monsters) if (mo.target === p) { mo.target = null; mo.returning = false; } this.ghost(p.model, true, 0x3a2a5a); }
    if (flags?.blockFront) this.fx.circle(p.pos, '#d9a441', 1.6, dur, p.model);
    if (flags?.cannotDie) this.fx.pillar(p.pos, 0xffe07a, 1.6, 8, 0.8);
    if (flags?.invuln) this.fx.circle(p.pos, '#9ae8ff', 1.4, dur, p.model);
    if (sk.party) {
      for (const s of this.summons || []) if (!s.dead && sk.shieldPct) s.shield = (s.shield || 0) + s.maxHp * sk.shieldPct;
      this.partyBuff && this.partyBuff(sk, dur);
      this.fx.ring(p.pos, 0xffe07a, 8, 0.6);
    }
    this.fx.buff(p, CLASSES[this.S.cls].elemColor); this.sfx.play('heal');
    if (flags?.ccImmune) p.stun = 0;
  },
  k_debuff(sk, t) {
    if (!t) return;
    const p = this.player;
    this.fx.bolt(this.hand(), t.pos.clone().setY(t.pos.y + t.height * 0.7), sk.curse || sk.doom ? 0x7a3ad8 : 0xb07aff, 0.3);
    if (t.kind !== 'monster') { if (sk.doom) this.after(sk.doom[1], () => { if (!t.dead) this.hitEnemy(t, sk, sk.doom[0] * this.rm(sk)); }); return; }
    const dur = (x) => x * (sk.curse && this.rule('malice') ? 1.2 : 1) * (1 + this.smod(sk.id, 'dur') / 100);
    if (sk.curse && !this.addCurse(t, sk.curse, dur(sk.atkdown?.[1] || sk.slow?.[1] || sk.dot?.[1] || 8))) return;
    if (sk.mark) this.st(t, 'mark', [sk.mark[0] * this.rm(sk), dur(sk.mark[1])]);
    if (sk.atkdown) this.st(t, 'atkdown', [sk.atkdown[0] * this.rm(sk), dur(sk.atkdown[1])]);
    if (sk.slow) this.st(t, 'slow', [sk.slow[0], dur(sk.slow[1])]);
    if (sk.dot) this.st(t, 'bane', [sk.dot[0] * this.rm(sk), dur(sk.dot[1])]);
    if (sk.doom) {
      const c = t; this.fx.circle(t.pos, '#9a4aff', 2.4, sk.doom[1], t.model);
      this.after(sk.doom[1], () => { if (c.dead) return; const at = c.pos.clone(); this.fx.pillar(at, 0x9a4aff, 2.5, 14, 0.9); this.fx.quake(at, 4); this.fx.shake(0.5); this.sfx.play('boom'); for (const e of this.enemiesIn(at, 4)) this.hitEnemy(e, sk, sk.doom[0] * this.rm(sk) * (e === c ? 1 : 0.5)); });
    }
    this.fx.emit(t.pos.clone().setY(t.pos.y + t.height), { count: 16, colors: [0x9a4aff, 0x3a1a5a], speed: 2, life: 0.8, size: 0.6, up: 1 });
    if (p && sk.curse && this.rule('darkPact')) this.heal(p, p.maxHp * 0.02);
  },
  k_heal(sk, t) {
    const p = this.player, k = 1 + 0.06 * (this.rk(sk) - 1);
    const amtOf = (e, pct) => e.maxHp * pct * k * this.healMod * (this.rule('lifeline') && e.hp < e.maxHp * 0.3 ? 1.2 : 1);
    const ally = sk.ally && this.friendTarget();
    const apply = (e) => {
      if (sk.pct) this.heal(e, amtOf(e, sk.pct));
      if (sk.shieldPct) { e.shield = (e.shield || 0) + e.maxHp * sk.shieldPct * k; if (e === p) { p.buffs = p.buffs.filter((x) => x.id !== sk.id); p.buffs.push({ id: sk.id, icon: sk.id, until: this.time + 10, shield: true }); } }
      if (sk.hot) this.addHot(e, sk.hot[0] * k * this.healMod, sk.hot[1], sk.id);
      if (sk.cleanse && e === p) this.cleanse();
      this.fx.heal(e);
    };
    if (sk.aoe) { apply(p); this.healParty(sk.pct * k, sk.aoe, false, { cleanse: sk.cleanse }); this.fx.ring(p.pos, 0x8ad8ff, sk.aoe, 0.6); }
    else if (sk.ally === 3) { apply(p); this.healParty(0, 20, false, { hot: [sk.hot[0] * k * this.healMod, sk.hot[1]], max: 2 }); for (const s of (this.summons || []).slice(0, 2)) if (!s.dead) this.addHot(s, sk.hot[0], sk.hot[1], sk.id); }
    else if (ally && ally.kind === 'rp') { this.healPeer(ally, { pct: sk.pct * k * this.healMod, shieldPct: sk.shieldPct ? sk.shieldPct * k : 0, cleanse: !!sk.cleanse }); this.fx.heal(ally); }
    else apply(p);
    this.sfx.play('heal');
  },
  k_taunt(sk, t, m) {
    const p = this.player, r = this.area(sk.r);
    this.fx.ring(p.pos, 0xffd08a, r, 0.5); this.fx.emit(p.pos.clone().setY(p.pos.y + 1.6), { count: 30, colors: [0xffd08a, 0xffffff], speed: 6, life: 0.5, size: 0.7, spread: 1 }); this.sfx.play('boom');
    for (const e of this.enemiesIn(p.pos, r)) {
      if (sk.ang && !this.inCone(e, p.pos, p.yaw, r, sk.ang)) continue;
      if (e.kind === 'monster') { e.target = p; e.tauntT = this.time + 4; e.tauntBy = p; e.returning = false; this.fx.text(e.pos.clone().setY(e.pos.y + e.height + 0.4), 'Taunted', 'miss'); }
      if (m > 0) this.hitEnemy(e, sk, m); else this.onHitEffects(e, sk, 0);
    }
  },
  k_special(sk, t, m) { const f = this['sp_' + sk.fn]; if (f) f.call(this, sk, t, m); },

  // ================================================================ special skills
  sp_bastionWall(sk) {
    const p = this.player, at = p.pos.clone().addScaledVector(this.facing(p.target && !p.target.dead ? p.target : null), 2.6);
    this.spawnSummon('wall', sk, at, sk.dur, 0);
  },
  sp_sacrifice(sk) {
    const p = this.player;
    for (const e of this.enemiesIn(p.pos, 12)) if (e.kind === 'monster') { e.target = p; e.tauntT = this.time + sk.dur; e.tauntBy = p; }
    const b = { id: sk.id, icon: sk.id, until: this.time + sk.dur, mods: { dmgTaken: 0.8 }, flags: { sacrifice: 1 } };
    p.buffs = p.buffs.filter((x) => x.id !== sk.id); p.buffs.push(b);
    this.fx.pillar(p.pos, 0xffd08a, 2, 8, 0.8); this.fx.ring(p.pos, 0xffd08a, 12, 0.6); this.sfx.play('heal');
    this.partyBuff && this.partyBuff({ ...sk, mods: { dmgTaken: 0.6 } }, sk.dur);
  },
  sp_nightReaper(sk, t) {
    if (!t) return;
    const low = t.maxHp && t.hp < t.maxHp * 0.2;
    this.fx.slash(this.player.pos, this.player.yaw, 0x9a4aff, 2.8, 0.2, 0.4); this.fx.pillar(t.pos, 0x6a2aff, 1.2, 8, 0.6); this.fx.shake(0.4);
    if (low && t.kind === 'monster' && !isBoss(t)) { this.damage(this.player, t, 0, { fixed: t.hp + 1, sk, cls: 'crit' }); this.fx.text(t.pos.clone().setY(t.pos.y + t.height + 0.6), 'Executed!', 'crit'); }
    else this.hitEnemy(t, sk, (low ? 10 : 5) * this.rm(sk), { critAdd: 30 });
  },
  sp_venomBurst(sk, t) {
    if (!t || t.kind !== 'monster') return;
    const n = t.poison?.n || 0;
    if (!n) { this.ui.toast('No poison on the target', 'warn'); return; }
    t.poison = null;
    this.fx.emit(t.pos.clone().setY(t.pos.y + 1), { count: 40, colors: [0x7aff3a, 0x3a8a1a], speed: 6, life: 0.6, size: 0.7 });
    this.hitEnemy(t, sk, 0.5 * n * this.rm(sk));
    this.heal(this.player, this.player.maxHp * 0.03 * n * this.healMod);
  },
  sp_deathBloom(sk) {
    const p = this.player; let any = false;
    for (const e of this.enemiesIn(p.pos, 18)) {
      const n = e.poison?.n || 0; if (!n) continue; any = true;
      e.poison = null;
      this.fx.pillar(e.pos, 0x7aff3a, 1.2, 6, 0.6); this.fx.emit(e.pos.clone().setY(e.pos.y + 1), { count: 30, colors: [0x7aff3a, 0xffd0f0], speed: 7, life: 0.7, size: 0.8 });
      this.hitEnemy(e, sk, 1.2 * n * this.rm(sk));
    }
    if (any) { this.sfx.play('boom'); this.fx.shake(0.4); } else this.ui.toast('No poisoned enemies nearby', 'warn');
  },
  sp_elemBurst(sk, t) {
    const hist = [...new Set(this.elemHist || [])];
    const c = this.spot(sk, t), r = this.area(6), n = Math.max(1, hist.length), m = 1.2 * n * this.rm(sk);
    this.fx.ring(c, 0xffffff, r, 0.6);
    if (hist.includes('fire')) this.fx.pillar(c, 0xff6a1a, r * 0.6, 8, 0.8);
    if (hist.includes('frost')) this.fx.emit(c.clone().setY(c.y + 1), { count: 50, colors: [0xbfe8ff, 0xffffff], speed: 8, life: 0.6, size: 0.7 });
    if (hist.includes('storm')) for (let i = 0; i < 4; i++) { const o = c.clone().add(V3(rnd(-r, r) * 0.6, 0, rnd(-r, r) * 0.6)); this.fx.bolt(o.clone().setY(o.y + 14), o, 0xd8c8ff); }
    this.sfx.play('boom'); this.fx.shake(0.35);
    for (const e of this.enemiesIn(c, r)) {
      this.hitEnemy(e, sk, m);
      if (e.kind !== 'monster' || e.dead) continue;
      if (hist.includes('fire')) this.st(e, 'burn', [0.4, 4]);
      if (hist.includes('frost')) this.st(e, 'slow', [0.5, 3]);
      if (hist.includes('storm')) this.st(e, 'stun', 1);
    }
  },
  sp_staticField(sk, t) {
    const c = this.spot(sk, t), r = this.area(sk.r);
    this.fx.ring(c, 0xc8b8ff, r, 0.6);
    for (let i = 0; i < 6; i++) { const o = c.clone().add(V3(rnd(-r, r) * 0.6, 0, rnd(-r, r) * 0.6)); this.fx.bolt(o.clone().setY(o.y + 10), o, 0xc8b8ff); }
    this.sfx.play('boom');
    for (const e of this.enemiesIn(c, r)) {
      const cap = this.atkOf(this.player) * 12 * this.rm(sk);
      this.damage(this.player, e, 0, { fixed: Math.min(cap, e.hp * 0.1 * (isBoss(e) ? 0.35 : 1)), sk, cls: 'crit' });
    }
  },
  sp_wrathSky(sk) {
    const p = this.player, list = this.enemiesIn(p.pos, sk.r);
    list.forEach((e, i) => this.after(i * 0.07, () => { if (e.dead) return; this.fx.pillar(e.pos, 0xd8c8ff, 1, 18, 0.5); this.fx.bolt(e.pos.clone().setY(e.pos.y + 18), e.pos.clone().setY(e.pos.y + 0.3), 0xffffff, 0.4); this.hitEnemy(e, sk, 6 * this.rm(sk)); if (e.kind === 'monster') this.st(e, 'stun', 1.5); }));
    this.fx.shake(0.6); this.sfx.play('boom');
  },
  sp_oceansGrace(sk) {
    const p = this.player;
    this.fx.pillar(p.pos, 0x8ad8ff, 3, 12, 1.2); this.fx.ring(p.pos, 0x8ad8ff, sk.r, 0.8); this.sfx.play('level');
    this.cleanse(); this.heal(p, p.maxHp * 0.4 * this.healMod);
    this.healParty(0.4, sk.r, false, { revive: 0.4, cleanse: true });
  },
  sp_pounce(sk, t) {
    const c = (this.summons || []).find((s) => s.unit === 'companion' && !s.dead);
    if (!c) { this.ui.toast('Summon your Companion first', 'warn'); return; }
    if (!t) return;
    const to = t.pos.clone().addScaledVector(this.facing(t), -1);
    c.tween = { from: c.pos.clone(), to, t: 0, dur: 0.35, h: 1.6, onEnd: () => { this.summonStrike(c, t, 1.5 * this.rm(sk)); if (t.kind === 'monster') this.st(t, 'root', 2); this.fx.quake(t.pos, 2); } };
    c.target = t;
  },
  sp_beastRoar(sk) {
    const c = (this.summons || []).find((s) => s.unit === 'companion' && !s.dead);
    if (!c) { this.ui.toast('Summon your Companion first', 'warn'); return; }
    this.fx.ring(c.pos, 0xffd08a, 7, 0.5); this.fx.emit(c.pos.clone().setY(c.pos.y + 1), { count: 30, colors: [0xffd08a, 0xffffff], speed: 6, life: 0.5, size: 0.7 }); this.sfx.play('boom');
    for (const e of this.enemiesIn(c.pos, 7)) if (e.kind === 'monster') this.st(e, 'fear', 2);
  },
  sp_spiritSwap(sk) {
    const list = (this.summons || []).filter((s) => !s.dead && !UNITS[s.unit].still);
    if (!list.length) { this.ui.toast('No summon to swap with', 'warn'); return; }
    const p = this.player, s = list.sort((a, b) => flat(b.pos, p.pos) - flat(a.pos, p.pos))[0];
    const a = p.pos.clone(), b = s.pos.clone();
    p.pos.x = b.x; p.pos.z = b.z; s.pos.x = a.x; s.pos.z = a.z;
    this.fx.emit(a.clone().setY(a.y + 1), { count: 20, colors: [0x9ae86a, 0xffffff], speed: 3, life: 0.5, size: 0.7 }); this.fx.emit(b.clone().setY(b.y + 1), { count: 20, colors: [0x9ae86a, 0xffffff], speed: 3, life: 0.5, size: 0.7 });
    for (const e of this.enemiesIn(s.pos, 8)) if (e.kind === 'monster') { e.target = s; e.tauntT = this.time + 3; e.tauntBy = s; }
  },
  sp_commandFocus(sk, t) {
    if (!t) return;
    let n = 0;
    for (const s of this.summons || []) if (!s.dead && UNITS[s.unit].atk > 0) { s.target = t; s.focusT = this.time + 6; s.aspdT = this.time + 6; n++; }
    if (!n) { this.ui.toast('No summons to command', 'warn'); return; }
    this.fx.circle(t.pos, '#9ae86a', 1.8, 6, t.model);
  },
  sp_spiritWard(sk) {
    const p = this.player, n = (this.summons || []).filter((s) => !s.dead).length;
    if (!n) { this.ui.toast('No summons to shield you', 'warn'); return; }
    const pct = Math.min(0.4, 0.08 * n) * this.rm(sk);
    p.shield = (p.shield || 0) + p.maxHp * pct;
    p.buffs = p.buffs.filter((x) => x.id !== sk.id); p.buffs.push({ id: sk.id, icon: sk.id, until: this.time + sk.dur, shield: true });
    for (const s of this.summons) if (!s.dead) this.fx.bolt(s.pos.clone().setY(s.pos.y + 1), p.pos.clone().setY(p.pos.y + 1), 0x9ae86a);
    this.fx.circle(p.pos, '#9ae86a', 1.6, sk.dur, p.model);
  },
  sp_spiritStorm(sk) {
    const wisps = (this.summons || []).filter((s) => s.unit === 'wisp' && !s.dead);
    if (!wisps.length) { this.ui.toast('No wisps to send', 'warn'); return; }
    wisps.forEach((w, i) => {
      const e = this.enemiesIn(w.pos, 16).sort((a, b) => flat(a.pos, w.pos) - flat(b.pos, w.pos))[i % Math.max(1, this.enemiesIn(w.pos, 16).length)] || this.player.target;
      this.removeSummon(w, true);
      if (!e || e.dead) return;
      this.fx.projectile(w.pos.clone().setY(w.pos.y + 1), e, { color: 0xb8ff9a, size: 0.5, speed: 20, onHit: () => { this.fx.ring(e.pos, 0xb8ff9a, 3, 0.4); this.sfx.play('boom'); for (const x of this.enemiesIn(e.pos, 3)) this.hitEnemy(x, sk, 2.0 * this.rm(sk)); } });
    });
  },
  sp_spiritStampede(sk) {
    const p = this.player, dir = this.facing(p.target && !p.target.dead ? p.target : null);
    const list = (this.summons || []).filter((s) => !s.dead && !UNITS[s.unit].still);
    if (!list.length) { this.ui.toast('No summons to send', 'warn'); return; }
    for (const s of list) {
      const o = s.pos.clone(), to = o.clone().addScaledVector(dir, 14);
      s.tween = { from: o, to, t: 0, dur: 0.6, h: 0.4 };
      for (const e of this.enemiesIn(o.clone().addScaledVector(dir, 7), 9)) if (this.inLine(e, o, dir, 14, 3)) this.after(0.2, () => this.hitEnemy(e, sk, 2.0 * this.rm(sk)));
      this.fx.emit(o.clone().setY(o.y + 1), { count: 20, colors: [0xb8ffd8, 0xffffff], speed: 4, life: 0.6, size: 0.8 });
    }
  },
  sp_hexChain(sk, t) {
    if (!t || t.kind !== 'monster' || !t.curses?.length) { this.ui.toast('The target has no curses to spread', 'warn'); return; }
    const near = this.enemiesIn(t.pos, 9).filter((e) => e !== t && e.kind === 'monster').slice(0, 2);
    for (const e of near) {
      this.fx.bolt(t.pos.clone().setY(t.pos.y + 1), e.pos.clone().setY(e.pos.y + 1), 0x9a4aff);
      for (const c of t.curses) { if (this.addCurse(e, c.type, c.until - this.time)) { if (c.type === 'weak') this.st(e, 'atkdown', [t.adP || 0.15, c.until - this.time]); if (c.type === 'slow') this.st(e, 'slow', [t.slowP || 0.3, c.until - this.time]); if (c.type === 'bane') this.st(e, 'bane', [t.baneM || 0.5, c.until - this.time]); } }
    }
  },
  sp_runeBurst(sk) {
    const p = this.player, n = this.spendRunes(), r = this.area(sk.r);
    this.fx.ring(p.pos, 0x5ad8ff, r, 0.5); this.fx.pillar(p.pos, 0x5ad8ff, r * 0.5, 4, 0.5); this.sfx.play('boom');
    for (const e of this.enemiesIn(p.pos, r)) this.hitEnemy(e, sk, (0.8 + 0.6 * n) * this.rm(sk));
  },
  sp_runeArmor(sk) {
    const p = this.player, n = this.spendRunes();
    const pct = 0.06 * n * (this.rule('fortifiedRunes') ? 1.3 : 1) * this.rm(sk);
    p.shield = (p.shield || 0) + p.maxHp * pct;
    p.buffs = p.buffs.filter((x) => x.id !== sk.id); p.buffs.push({ id: sk.id, icon: sk.id, until: this.time + sk.dur, shield: true });
    this.fx.circle(p.pos, '#5ad8ff', 1.8, sk.dur, p.model); this.sfx.play('heal');
  },
  sp_runicQuake(sk) {
    const p = this.player, n = this.spendRunes(), r = this.area(sk.r);
    for (let i = 0; i < 8 + n * 2; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * r; this.after(i * 0.03, () => this.fx.pillar(this.ground(p.pos.x + Math.sin(a) * d, p.pos.z + Math.cos(a) * d), 0x5ad8ff, 0.5, 3, 0.5)); }
    this.fx.quake(p.pos, r); this.sfx.play('boom'); this.fx.shake(0.3);
    for (const e of this.enemiesIn(p.pos, r)) { this.hitEnemy(e, sk, (1.5 + 0.4 * n) * this.rm(sk)); if (e.kind === 'monster') this.st(e, 'knockup', 0.8); }
  },
  sp_runicJudgment(sk, t) {
    if (!t) return;
    const n = this.spendRunes();
    this.fx.pillar(t.pos, 0x5ad8ff, 2, 16, 0.8); this.fx.slash(this.player.pos, this.player.yaw, 0x9ae8ff, 3.2, 0, 0.5); this.fx.shake(0.6); this.sfx.play('boom');
    this.hitEnemy(t, sk, (5 + 1.6 * n) * this.rm(sk));
  },
  sp_runicChain(sk) {
    const p = this.player, r = this.area(sk.r), list = this.enemiesIn(p.pos, r).filter((e) => e.kind === 'monster');
    for (const e of list) { e.linkT = this.time + sk.dur; this.fx.circle(e.pos, '#5ad8ff', 1.2, sk.dur, e.model); }
    for (let i = 1; i < list.length; i++) this.fx.bolt(list[i - 1].pos.clone().setY(list[i - 1].pos.y + 1), list[i].pos.clone().setY(list[i].pos.y + 1), 0x5ad8ff, 0.6);
  },

  // ================================================================ zones and traps
  addZone(z) {
    const p = this.player;
    z.until = this.time + z.dur; z.next = this.time + 0.05; z.every = z.dur / z.ticks;
    z.at = z.at.clone(); z.at.y = this.map.heightAt(z.at.x, z.at.z); z.map = this.map;
    const col = z.color ?? 0xffffff;
    const g = new THREE.Group();
    if (z.shape === 'wall' || z.shape === 'line') {
      const len = z.len || 8;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(z.shape === 'wall' ? len : z.r * 2, z.shape === 'wall' ? z.r * 2 : len), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      plane.rotation.x = -Math.PI / 2; plane.position.y = 0.1; g.add(plane);
      g.rotation.y = Math.atan2(z.dir.x, z.dir.z);
    } else {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(z.r, 32), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: z.sk.heal ? 0.28 : 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.08; g.add(disc);
      const rim = new THREE.Mesh(new THREE.RingGeometry(z.r * 0.94, z.r, 40), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
      rim.rotation.x = -Math.PI / 2; rim.position.y = 0.1; g.add(rim);
      if (z.sk.sun || z.sk.orb) {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col, blending: THREE.AdditiveBlending, depthWrite: false }));
        s.scale.setScalar(z.sk.sun ? 7 : 2.4); s.position.y = z.sk.sun ? 9 : 1.2; g.add(s); z.orb = s;
      }
    }
    g.position.copy(z.at); this.scene.add(g); z.mesh = g;
    if (z.kind === 'follow') z.follow = p;
    (this.zones = this.zones || []).push(z);
  },
  inZone(z, e) {
    if (z.shape === 'wall') { const d = V3(Math.cos(Math.atan2(z.dir.x, z.dir.z)), 0, -Math.sin(Math.atan2(z.dir.x, z.dir.z))); const o = z.at.clone().addScaledVector(d, -(z.len || 8) / 2); return this.inLine(e, o, d, z.len || 8, z.r * 2); }
    if (z.shape === 'line') { const o = z.at.clone().addScaledVector(z.dir, -z.len / 2); return this.inLine(e, o, z.dir, z.len, z.r * 2); }
    return flat(e.pos, z.at) < z.r + (e.radius || 0.5) * 0.5;
  },
  updateZones(dt) {
    const p = this.player;
    for (const z of [...(this.zones || [])]) {
      if (this.time > z.until || z.map !== this.map) { this.scene.remove(z.mesh); this.zones = this.zones.filter((x) => x !== z); continue; }
      if (z.follow) { z.at.copy(p.pos); }
      if (z.kind === 'moving') { z.at.x += z.dir.x * (z.sk.speed || 3) * dt; z.at.z += z.dir.z * (z.sk.speed || 3) * dt; z.at.y = this.map.heightAt(z.at.x, z.at.z); }
      z.mesh.position.copy(z.at);
      z.mesh.rotation.y += z.shape ? 0 : dt * 0.4;
      if (z.orb) z.orb.material.rotation += dt;
      // ambient particles
      const sk = z.sk;
      if (Math.random() < dt * 14) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * z.r, x = z.at.x + Math.sin(a) * d, zz = z.at.z + Math.cos(a) * d;
        if (sk.rain || sk.heal) this.fx.emit(V3(x, z.at.y + 4, zz), { count: 2, color: 0x9ad8ff, speed: 0.5, life: 0.6, size: 0.35, gravity: -18 });
        else if (sk.hawks) this.fx.emit(V3(x, z.at.y + 2, zz), { count: 2, colors: [0xb8ff9a, 0xffffff], speed: 4, life: 0.4, size: 0.6 });
        else if (sk.blades || sk.orbitBlades) this.fx.emit(V3(x, z.at.y + (sk.blades ? 8 : 1.2), zz), { count: 1, color: 0x9ae8ff, speed: 0.5, life: 0.4, size: 0.6, gravity: sk.blades ? -40 : 0 });
        else this.fx.emit(V3(x, z.at.y + 0.4, zz), { count: 2, color: z.color ?? 0xffffff, speed: 1.2, life: 0.6, size: 0.6, up: 2 });
      }
      if (this.time < z.next) continue;
      z.next += z.every;
      // heal allies inside
      if (sk.heal) { if (flat(p.pos, z.at) < z.r + 0.5) this.heal(p, p.maxHp * sk.heal * (1 + 0.06 * (this.rk(sk) - 1)) * this.healMod); this.healParty(sk.heal, z.r, false, { at: z.at }); }
      if (sk.kbImmune && flat(p.pos, z.at) < z.r) this.kbImmuneT = this.time + z.every + 0.1;
      if (!(z.m > 0) && !sk.slow && !sk.pull) continue;
      if (sk.strikes) for (let i = 0; i < 2; i++) { const a = Math.random() * Math.PI * 2, d = Math.random() * z.r; const o = this.ground(z.at.x + Math.sin(a) * d, z.at.z + Math.cos(a) * d); this.fx.bolt(o.clone().setY(o.y + 12), o, 0xd8c8ff, 0.25); }
      for (const e of this.enemiesIn(z.at, z.shape ? Math.max(z.r, (z.len || 0) / 2 + 1) : z.r)) {
        if (!this.inZone(z, e)) continue;
        if (sk.pull && e.kind === 'monster') this.st(e, 'pull', [z.at, 2.5]);
        if (z.m > 0) this.hitEnemy(e, sk, z.m, { proc: true }); else if (e.kind === 'monster') this.onHitEffects(e, sk, 0);
        if (z.burn && e.kind === 'monster' && !e.dead) this.st(e, 'burn', z.burn);
      }
    }
    // traps
    for (const tr of [...(this.traps || [])]) {
      if (this.time > tr.until) { this.removeTrap(tr); continue; }
      tr.ring.rotation.z += dt * 2;
      if (this.time < tr.armT) continue;
      const e = this.enemiesIn(tr.at, tr.sk.trig).find((x) => x.kind === 'monster');
      if (!e) continue;
      const sk = tr.sk;
      if (sk.root) { this.st(e, 'root', sk.root); this.fx.circle(e.pos, '#d8c08a', 1.3, sk.root, null); this.fx.emit(e.pos.clone().setY(e.pos.y + 0.4), { count: 20, colors: [0xd8c08a, 0x8a5a2a], speed: 3, life: 0.6, size: 0.5 }); this.hitEnemy(e, sk, 0.6 * this.rm(sk)); }
      if (sk.blast) { const r = this.area(sk.blast[1]); this.fx.ring(tr.at, sk.magic ? 0x5ad8ff : 0xff7a3a, r, 0.5); this.fx.pillar(tr.at, sk.magic ? 0x5ad8ff : 0xff7a3a, r * 0.5, 5, 0.6); this.fx.emit(tr.at.clone().setY(tr.at.y + 1), { count: 50, colors: [sk.magic ? 0x5ad8ff : 0xff7a3a, 0xffd04a], speed: 8, life: 0.6, size: 0.8 }); this.sfx.play('boom'); for (const x of this.enemiesIn(tr.at, r)) this.hitEnemy(x, sk, tr.m); }
      this.removeTrap(tr);
    }
  },
  removeTrap(tr) { this.scene.remove(tr.mesh); this.traps = this.traps.filter((x) => x !== tr); },
  clearCombatWorld() {
    for (const z of this.zones || []) this.scene.remove(z.mesh);
    for (const tr of this.traps || []) this.scene.remove(tr.mesh);
    for (const s of [...(this.summons || [])]) this.removeSummon(s, true);
    this.zones = []; this.traps = []; this.channel = null; this.tween = null;
  },

  // ================================================================ status effects on monsters
  // kind: stun | root | slow [pct, s] | fear | silence | interrupt | blind | knock [m, from] | knockup | pull [point, speed]
  //       mark [pct, s] | defdown [pct, s] | atkdown [pct, s] | bleed [mult, s, stacks] | burn [mult, s] | poison n | bane [mult, s]
  st(m, kind, v) {
    if (!m || m.dead || m.kind !== 'monster') return;
    const now = this.time, boss = isBoss(m), elite = !!m.def0?.elite;
    const ccDur = (s) => (boss ? s * 0.25 : elite ? s * 0.6 : s);
    const show = (txt) => this.fx.text(m.pos.clone().setY(m.pos.y + m.height + 0.4), txt, 'miss');
    switch (kind) {
      case 'stun': if (m.def0?.structure) return; m.stun = Math.max(m.stun || 0, ccDur(v)); if (!boss) show('Stunned'); this.checkOpportunity(m); break;
      case 'root': m.rootT = Math.max(m.rootT || 0, now + ccDur(v)); show('Rooted'); break;
      case 'slow': m.slowP = Math.max(m.slowT > now ? m.slowP : 0, v[0] * (boss ? 0.5 : 1)); m.slowT = now + v[1]; break;
      case 'fear': if (boss) return; m.fearT = now + v; m.target = null; show('Feared'); break;
      case 'silence': m.silT = now + v; show('Silenced'); break;
      case 'interrupt': m.castSeq = (m.castSeq || 0) + 1; show('Interrupted'); break;
      case 'blind': m.blindT = now + ccDur(v) * (boss ? 2 : 1); show('Blinded'); break;
      case 'knock': {
        if (boss || m.def0?.structure) return;
        const [d, from] = v, dx = m.pos.x - from.x, dz = m.pos.z - from.z, L = Math.hypot(dx, dz) || 1;
        m.knock = { dx: dx / L, dz: dz / L, left: d * (elite ? 0.5 : 1), t: 0.3 };
        if (this.rule('tidalForce')) m.stun = Math.max(m.stun || 0, 1);
        break;
      }
      case 'knockup': if (boss) return; m.kupT = now + ccDur(v); m.kupDur = ccDur(v); m.stun = Math.max(m.stun || 0, ccDur(v)); break;
      case 'pull': if (boss || m.def0?.structure) return; m.pullTo = v[0].clone(); m.pullV = v[1] || 99; m.pullT = now + 0.5; break;
      case 'mark': m.markP = Math.max(m.markT > now ? m.markP : 0, v[0]); m.markT = now + v[1]; this.fx.circle(m.pos, '#ff6a8a', 1.2, Math.min(v[1], 10), m.model); break;
      case 'defdown': m.ddP = v[0]; m.ddT = now + v[1]; break;
      case 'atkdown': m.adP = Math.max(m.adT > now ? m.adP : 0, v[0]); m.adT = now + v[1]; break;
      case 'bleed': {
        m.bleeds = (m.bleeds || []).filter((b) => b.until > now);
        if (m.bleeds.length >= (v[2] || 1)) m.bleeds.shift();
        m.bleeds.push({ m: v[0], until: now + v[1] });
        break;
      }
      case 'burn': m.burnT = Math.max(m.burnT || 0, now + v[1]); m.burnM = Math.max(m.burnT > now ? m.burnM || 0 : 0, v[0]); break;
      case 'poison': {
        const dur = 6 * (this.rule('lingering') ? 1.5 : 1);
        const n = Math.min(12, (m.poison && m.poison.until > now ? m.poison.n : 0) + v);
        m.poison = { n, until: now + dur };
        if (this.rule('neurotoxin') && n >= 5 && (m.neuroT || 0) <= now) { m.neuroT = now + 6; m.stun = Math.max(m.stun || 0, boss ? 0.25 : 1); show('Neurotoxin'); }
        break;
      }
      case 'bane': m.baneT = now + v[1]; m.baneM = v[0]; break;
    }
  },
  checkOpportunity() {},
  addCurse(m, type, dur) {
    const now = this.time;
    m.curses = (m.curses || []).filter((c) => c.until > now && c.type !== type);
    const max = this.rule('hexmaster') ? 3 : 2;
    if (m.curses.length >= max) m.curses.shift();
    m.curses.push({ type, until: now + dur });
    return true;
  },
  curseCount(m) { return (m.curses || []).filter((c) => c.until > this.time).length; },
  // damage taken multiplier on a monster (marks, curses, poison corrosion)
  takenMult(m) {
    const now = this.time; let k = 1;
    if (m.markT > now) k *= 1 + m.markP;
    for (const s of this.summons || []) if (s.unit === 'owl' && !s.dead && s.target === m) { k *= 1 + UNITS.owl.marks; break; }
    return k;
  },
  // defense break on a monster (Shatter, Sundering Combo, Corrosion)
  monsterDefMult(m) {
    const now = this.time; let k = 1;
    if (m.ddT > now) k *= 1 - m.ddP;
    if (this.rule('corrosion') && m.poison && m.poison.until > now) k *= 0.9;
    return k;
  },
  // a monster's outgoing damage (Intimidating Shout, Provoke Wave, Curse of Weakness)
  monsterOutMult(m) { return m.adT > this.time ? 1 - m.adP : 1; },
  monsterBlind(m) { return m.blindT > this.time && Math.random() < 0.75; },
  // called at the top of updateMonster; returns true when the monster's normal AI is skipped this frame
  mStatus(m, dt) {
    const now = this.time, p = this.player, Wm = m.map || this.world;
    // damage over time (once a second)
    if ((m.dotNext || 0) <= now && (m.poison || m.bleeds?.length || m.burnT > now || m.baneT > now)) {
      m.dotNext = now + 1;
      const atk = this.atkOf(p);
      if (m.poison && m.poison.until > now) { this.damage(p, m, 0.12 * m.poison.n, { canCrit: false, proc: true, cls: 'pet', dot: 'poison' }); this.fx.emit(m.pos.clone().setY(m.pos.y + m.height * 0.6), { count: 4 + m.poison.n, color: 0x7aff3a, speed: 1.4, life: 0.5, size: 0.45, up: 1 }); }
      else if (m.poison) m.poison = null;
      if (!m.dead && m.bleeds?.length) { const live = m.bleeds.filter((b) => b.until > now); m.bleeds = live; const tot = live.reduce((a, b) => a + b.m, 0); if (tot > 0) { this.damage(p, m, tot, { canCrit: false, proc: true, cls: 'pet', dot: 'bleed' }); this.fx.emit(m.pos.clone().setY(m.pos.y + m.height * 0.5), { count: 6, color: 0xc0202a, speed: 2, life: 0.5, size: 0.45, gravity: -6 }); } }
      if (!m.dead && m.burnT > now) { this.damage(p, m, m.burnM || 0.2, { canCrit: false, proc: true, cls: 'pet', dot: 'burn', sk: { el: 'fire' } }); this.fx.emit(m.pos.clone().setY(m.pos.y + m.height * 0.5), { count: 6, colors: [0xff6a1a, 0xffc04a], speed: 1.5, life: 0.5, size: 0.5, up: 2 }); }
      if (!m.dead && m.baneT > now) {
        this.damage(p, m, m.baneM || 0.5, { canCrit: false, proc: true, cls: 'pet', dot: 'bane' });
        this.fx.emit(m.pos.clone().setY(m.pos.y + m.height * 0.6), { count: 6, colors: [0x9a4aff, 0x2a1a3a], speed: 1.5, life: 0.6, size: 0.5, up: 1 });
        if (Math.random() < 0.3) { const n = this.monsters.find((x) => x !== m && !x.dead && (x.map || this.world) === Wm && flat(x.pos, m.pos) < 6 && !(x.baneT > now)); if (n) { this.st(n, 'bane', [m.baneM, Math.max(2, m.baneT - now)]); this.addCurse(n, 'bane', m.baneT - now); this.fx.bolt(m.pos.clone().setY(m.pos.y + 1), n.pos.clone().setY(n.pos.y + 1), 0x9a4aff); } }
      }
      void atk;
      if (m.dead) return true;
    }
    // knockback slide and pulls
    if (m.knock) {
      const k = m.knock, step = Math.min(k.left, 18 * dt);
      const nx = m.pos.x + k.dx * step, nz = m.pos.z + k.dz * step;
      if (!Wm.isBlocked(nx, nz)) { m.pos.x = nx; m.pos.z = nz; }
      k.left -= step; if (k.left <= 0.01) m.knock = null;
      m.pos.y = Wm.heightAt(m.pos.x, m.pos.z);
      return true;
    }
    if (m.pullT > now && m.pullTo) {
      const d = flat(m.pos, m.pullTo);
      if (d > 1.2) { const step = Math.min(d - 1, Math.min(m.pullV, 14) * dt * 3); const nx = m.pos.x + (m.pullTo.x - m.pos.x) / d * step, nz = m.pos.z + (m.pullTo.z - m.pos.z) / d * step; if (!Wm.isBlocked(nx, nz)) { m.pos.x = nx; m.pos.z = nz; } }
    }
    // knock-up: bounce in the air (stunned meanwhile)
    if (m.kupT > now) { const k = 1 - (m.kupT - now) / (m.kupDur || 1); m.inner.position.y = Math.sin(k * Math.PI) * 1.6; } else if (m.kupDur) { m.inner.position.y = 0; m.kupDur = 0; }
    // slows and roots
    m.speed0 = m.speed0 ?? m.speed;
    if (m.rootT > now) m.speed = 0;
    else if (m.slowT > now) m.speed = m.speed0 * (1 - m.slowP);
    else if (m.speed !== m.speed0) m.speed = m.speed0;
    // taunts hold the monster on its taunter
    if (m.tauntT > now && m.tauntBy && !m.tauntBy.dead) { m.target = m.tauntBy; m.returning = false; }
    // fear: run from the hero
    if (m.fearT > now) {
      const dx = m.pos.x - p.pos.x, dz = m.pos.z - p.pos.z, L = Math.hypot(dx, dz) || 1;
      this.moveEnt(m, m.pos.x + dx / L * 3, m.pos.z + dz / L * 3, (m.speed0 || 4) * 0.9, dt);
      m.moving = true; m.state = 'idle'; m.pos.y = Wm.heightAt(m.pos.x, m.pos.z);
      return true;
    }
    return false;
  },
  // when a monster dies: Living Flame and Contagion spread to the nearest enemy
  spreadOnDeath(m, kind) {
    const now = this.time;
    const has = kind === 'burn' ? m.burnT > now : m.poison && m.poison.until > now;
    if (!has) return;
    const n = this.monsters.filter((x) => !x.dead && x !== m && (x.map || this.world) === (m.map || this.world) && flat(x.pos, m.pos) < 8).sort((a, b) => flat(a.pos, m.pos) - flat(b.pos, m.pos)).slice(0, 2);
    for (const e of n) {
      this.fx.bolt(m.pos.clone().setY(m.pos.y + 1), e.pos.clone().setY(e.pos.y + 1), kind === 'burn' ? 0xff7a2a : 0x7aff3a);
      if (kind === 'burn') this.st(e, 'burn', [m.burnM || 0.3, 4]); else this.st(e, 'poison', Math.max(1, Math.floor((m.poison?.n || 2) / 2)));
    }
  },

  // ================================================================ summons
  summonSlots() { return 2 + (this.ps('summonSlots') || 0); },
  summonUnits(sk, t) {
    const p = this.player, U = UNITS[sk.unit];
    const durBase = sk.dur ? sk.dur * (1 + this.ps('summonDur') / 100) : 0;
    let n = sk.n;
    if (sk.unit === 'companion') n = 1;
    for (let i = 0; i < n; i++) {
      if (U.slot) {
        const live = (this.summons || []).filter((s) => !s.dead && UNITS[s.unit].slot);
        if (live.length >= this.summonSlots()) this.removeSummon(live.sort((a, b) => a.born - b.born)[0], true);
      }
      const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.random();
      let at = sk.at === 'target' ? this.spot(sk, t) : p.pos.clone().add(V3(Math.sin(a) * 1.8, 0, Math.cos(a) * 1.8));
      if (this.map.isBlocked(at.x, at.z)) at = p.pos.clone();
      this.spawnSummon(sk.unit, sk, at, durBase, i);
    }
    this.fx.ring(p.pos, 0x9ae86a, 3, 0.5); this.sfx.play('heal');
  },
  summonModel(unit) {
    let m;
    switch (unit) {
      case 'wisp': case 'healer': {
        m = new THREE.Group();
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: SPIRIT[unit], blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.setScalar(unit === 'healer' ? 1.8 : 1.3); core.add(halo); core.position.y = 1.2; m.add(core); m.userData.float = core;
        return m;
      }
      case 'wolf': case 'companion': case 'beast': m = buildMonster('wolf'); break;
      case 'owl': m = buildPet('owl'); break;
      case 'bear': m = buildMount('bear'); break;
      case 'behemoth': m = buildMonster('behemoth'); break;
      case 'decoy': case 'clone': m = buildHumanoid(this.playerLook()); m.userData.humanoid = true; break;
      case 'kraken': {
        m = new THREE.Group();
        const mat = new THREE.MeshToonMaterial({ color: 0x3a8a7a });
        const head = new THREE.Mesh(new THREE.SphereGeometry(1.4, 18, 14), mat); head.position.y = 1.2; head.scale.y = 1.2; m.add(head);
        m.userData.tent = [];
        for (let i = 0; i < 6; i++) { const t = new THREE.Group(); const a = (i / 6) * Math.PI * 2; t.position.set(Math.sin(a) * 1.6, 0.2, Math.cos(a) * 1.6); for (let k = 0; k < 5; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.42 - k * 0.07, 10, 8), mat); s.position.y = k * 0.55; t.add(s); } m.add(t); m.userData.tent.push(t); }
        break;
      }
      case 'wall': {
        m = new THREE.Group();
        const mat = new THREE.MeshToonMaterial({ color: 0x9a8a6a });
        for (let i = -2; i <= 2; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2 - Math.abs(i) * 0.25, 0.8), mat); b.position.set(i * 1.05, (2.2 - Math.abs(i) * 0.25) / 2, 0); m.add(b); }
        return m;
      }
    }
    if (unit !== 'decoy' && unit !== 'clone') this.ghost(m, true, SPIRIT[unit] ?? 0x9ae86a, unit === 'companion' ? 0.95 : 0.78);
    else this.ghost(m, true, SPIRIT[unit], 0.55);
    return m;
  },
  spawnSummon(unit, sk, at, dur, idx = 0) {
    const p = this.player, U = UNITS[unit];
    const g = new THREE.Group(), inner = this.summonModel(unit);
    g.add(inner);
    if (unit === 'behemoth') inner.scale.setScalar(0.85);
    if (unit === 'kraken') inner.scale.setScalar(1);
    if (unit === 'wall') g.rotation.y = p.yaw;
    at.y = this.map.heightAt(at.x, at.z); g.position.copy(at); this.scene.add(g);
    const share = this.ps('statShare') / 100;
    const hpMul = 1 + this.ps('summonHp') / 100, atkMul = 1 + this.ps('summonDmg') / 100;
    const e = {
      kind: 'summon', unit, name: U.name, model: g, inner, pos: g.position, yaw: p.yaw, yawT: p.yaw, t0: Math.random() * 6,
      level: p.level, maxHp: Math.round(p.maxHp * U.hp * hpMul * (1 + share)), atk: p.atk * U.atk * atkMul * (1 + share), def: p.def * (0.4 + share), crit: (p.crit || 5) * this.ps('summonCrit') / 100, critDmg: 0.5,
      speed: U.speed || 0, radius: unit === 'behemoth' ? 1.6 : unit === 'kraken' ? 2.2 : unit === 'wall' ? 1.5 : 0.6, height: U.h, buffs: [], dead: false,
      until: dur ? this.time + dur : Infinity, born: this.time, attackCD: 0.5 + idx * 0.2, map: this.map, revives: this.rule('undyingSpirits') ? 1 : 0,
      humanoid: unit === 'decoy' || unit === 'clone' ? inner : null, state: 'idle', actT: 0, actDur: 0.4,
    };
    e.hp = e.maxHp;
    if (U.taunt) for (const m of this.enemiesIn(at, unit === 'wall' ? 10 : 9)) if (m.kind === 'monster' && !isBoss(m)) { m.target = e; m.tauntT = this.time + (unit === 'wall' ? dur : 4); m.tauntBy = e; }
    if (U.taunt) for (const m of this.enemiesIn(at, 9)) if (m.kind === 'monster' && isBoss(m)) { m.target = e; m.tauntT = this.time + 2; m.tauntBy = e; }
    (this.summons = this.summons || []).push(e);
    this.fx.spawnPuff(at.clone().setY(at.y + 0.5), SPIRIT[unit] ?? 0x9ae86a);
    return e;
  },
  removeSummon(s, quiet = false) {
    if (!s) return;
    this.scene.remove(s.model); s.np?.remove(); s.dead = true;
    this.summons = (this.summons || []).filter((x) => x !== s);
    for (const m of this.monsters) if (m.target === s) { m.target = m.tauntBy === s ? null : m.target; if (m.tauntBy === s) m.tauntBy = null; }
    if (!quiet) this.fx.emit(s.pos.clone().setY(s.pos.y + 1), { count: 20, color: SPIRIT[s.unit] ?? 0xffffff, speed: 3, life: 0.6, size: 0.6 });
  },
  summonDown(s) {
    if (s.revives > 0) { s.revives--; s.hp = Math.round(s.maxHp * 0.5); this.fx.pillar(s.pos, 0x9ae86a, 1, 4, 0.6); this.fx.text(s.pos.clone().setY(s.pos.y + s.height + 0.3), 'Revived', 'heal'); return; }
    this.removeSummon(s);
  },
  summonStrike(s, t, mult = 1) {
    if (!t || t.dead || s.dead) return;
    const p = this.player;
    const atkMul = (s.aspdT > this.time ? 1.1 : 1) * (1 + this.pflag('alphaCmd') / 100);
    const dmg = this.damage({ ...s, kind: 'pet', buffs: [], atk: s.atk * atkMul }, t, mult, { proc: true, cls: 'pet' });
    if (t.kind === 'monster' && !t.dead && !(t.tauntT > this.time) && Math.random() < 0.3) t.target = s;
    if (dmg > 0 && s.unit === 'companion' && this.rule('wildHeart')) this.heal(p, p.maxHp * 0.02);
    return dmg;
  },
  updateSummons(dt) {
    const p = this.player;
    for (const s of [...(this.summons || [])]) {
      if (s.dead) continue;
      if (this.time > s.until || s.map !== this.map) { this.removeSummon(s); continue; }
      const U = UNITS[s.unit];
      s.actT = Math.max(0, (s.actT || 0) - dt); s.attackCD -= dt;
      if (s.model.userData.float || s.inner.userData.float) { const f = s.inner.userData.float; f.position.y = 1.2 + Math.sin(this.time * 3 + s.t0) * 0.15; }
      if (s.inner.userData.tent) s.inner.userData.tent.forEach((tt, i) => { tt.rotation.x = Math.sin(this.time * 2 + i) * 0.4; tt.rotation.z = Math.cos(this.time * 1.7 + i) * 0.4; });
      if (s.tween) { const T = s.tween; T.t += dt; const k = Math.min(1, T.t / T.dur); s.pos.lerpVectors(T.from, T.to, k); s.pos.y = this.map.heightAt(s.pos.x, s.pos.z) + Math.sin(k * Math.PI) * T.h; if (k >= 1) { s.tween = null; T.onEnd && T.onEnd(); } continue; }
      if (U.still) {
        if (s.unit === 'kraken' && s.attackCD <= 0) {
          const list = this.enemiesIn(s.pos, U.range);
          if (list.length) { s.attackCD = 1.2; const e = list[(Math.random() * list.length) | 0]; this.fx.pillar(e.pos, 0x3a8a7a, 1, 5, 0.5); this.fx.quake(e.pos, 2.5); for (const x of this.enemiesIn(e.pos, 2.5)) this.summonStrike(s, x, 1.4); if (e.kind === 'monster') this.st(e, 'pull', [s.pos.clone(), 3]); }
        }
        continue;
      }
      if (U.healer) {
        const allies = [p, ...(this.summons || []).filter((x) => !x.dead && x !== s)];
        const low = allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        const goal = low && low !== p ? low.pos : p.pos;
        if (flat(s.pos, goal) > 2) this.moveEnt(s, goal.x, goal.z, U.speed, dt);
        if (s.attackCD <= 0) { s.attackCD = 1; if (low && low.hp < low.maxHp) { this.heal(low, low.maxHp * 0.04 * this.healMod); this.fx.bolt(s.pos.clone().setY(s.pos.y + 1.2), low.pos.clone().setY(low.pos.y + 1), 0x8ad8ff, 0.25); } }
        s.pos.y = this.map.heightAt(s.pos.x, s.pos.z);
        continue;
      }
      // pick a target: focused, the hero's target, whoever attacks the hero, or the nearest enemy
      let t = s.target && !s.target.dead && s.focusT > this.time ? s.target : null;
      if (!t && p.target && p.target.kind === 'monster' && !p.target.dead && flat(p.target.pos, p.pos) < 22) t = p.target;
      if (!t && this.time - this.lastCombat < 4) t = this.nearestEnemy(14, null, p.pos);
      s.target = t;
      let moving = false;
      if (flat(s.pos, p.pos) > 32) { s.pos.set(p.pos.x - 1, p.pos.y, p.pos.z - 1); }
      if (t && U.atk > 0) {
        const d = flat(s.pos, t.pos) - t.radius;
        if (d > U.range) { this.moveEnt(s, t.pos.x, t.pos.z, U.speed, dt); moving = true; }
        else {
          s.yawT = Math.atan2(t.pos.x - s.pos.x, t.pos.z - s.pos.z);
          if (s.attackCD <= 0) {
            s.attackCD = 1.4 / (1 + this.ps('summonAspd') / 100) / (s.aspdT > this.time ? 1.3 : 1);
            s.state = 'attack'; s.actT = s.actDur = 0.4;
            if (U.ranged) this.fx.projectile(s.pos.clone().setY(s.pos.y + U.h * 0.8), t, { color: SPIRIT[s.unit], size: 0.28, speed: 22, onHit: () => this.summonStrike(s, t, 1) });
            else if (U.stomp) { this.fx.quake(s.pos, 4); for (const x of this.enemiesIn(s.pos, 4)) this.summonStrike(s, x, 1); }
            else this.after(0.15, () => this.summonStrike(s, t, 1));
          }
        }
      } else if (U.taunt) {
        // tanks hold position near the hero and keep enemies on themselves
        if (flat(s.pos, p.pos) > 4) { this.moveEnt(s, p.pos.x + 1.5, p.pos.z + 1.5, U.speed, dt); moving = true; }
      } else {
        const off = V3(1.6, 0, -1.2).applyAxisAngle(V3(0, 1, 0), p.yaw + s.t0);
        const gx = p.pos.x + off.x, gz = p.pos.z + off.z;
        if (Math.hypot(gx - s.pos.x, gz - s.pos.z) > 1.2) { this.moveEnt(s, gx, gz, Math.max(U.speed || 8, this.speedOf(p) * 1.05), dt); moving = true; }
      }
      if (U.taunt && (s.tauntNext || 0) <= this.time) { s.tauntNext = this.time + 3; for (const m of this.enemiesIn(s.pos, 7)) if (m.kind === 'monster' && !isBoss(m)) { m.target = s; m.tauntT = this.time + 3; m.tauntBy = s; } }
      s.moving = moving; if (s.actT <= 0) s.state = moving ? 'run' : 'idle';
      s.pos.y = this.map.heightAt(s.pos.x, s.pos.z);
    }
    // turn toward where they go and animate
    for (const s of this.summons || []) {
      if (s.dead || UNITS[s.unit].still) continue;
      let d = s.yawT - s.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      s.yaw += d * Math.min(1, dt * 10); s.model.rotation.y = s.yaw;
      const a = s.actDur ? 1 - s.actT / s.actDur : 0, t = this.time + s.t0;
      if (s.humanoid) animateHumanoid(s.humanoid, s.state === 'attack' ? 'attack' : s.state, t, a, 1);
      else if (s.inner.userData.parts || s.inner.userData.anim) animateCreature(s.inner, s.state, t, a, s.moving);
    }
  },

  // ================================================================ allies, heals, hots, cleanse
  friendTarget() { const t = this.player.target; return t && !t.dead && t.kind === 'rp' && this.partyHas && this.partyHas(t.peerId) ? t : null; },
  allyNear(r) {
    const p = this.player;
    const list = [...(this.rplayers || []).filter((e) => !e.netHidden && this.partyHas && this.partyHas(e.peerId)), ...(this.summons || []).filter((s) => !s.dead), ...(this.pet ? [this.pet] : [])];
    return list.filter((e) => flat(e.pos, p.pos) <= r && flat(e.pos, p.pos) > 2).sort((a, b) => flat(a.pos, p.pos) - flat(b.pos, p.pos))[0] || null;
  },
  // heal party members (over the network), summons and the pet nearby; pct of their max HP
  healParty(pct, r, includeSelf, o = {}) {
    const p = this.player, at = o.at || p.pos;
    if (includeSelf && pct > 0) this.heal(p, p.maxHp * pct * this.healMod);
    for (const s of this.summons || []) if (!s.dead && flat(s.pos, at) < r && pct > 0) s.hp = Math.min(s.maxHp, s.hp + s.maxHp * pct);
    if (this.pet && flat(this.pet.pos, at) < r && this.pet.hp != null) this.pet.hp = Math.min(this.pet.maxHp || this.pet.hp, this.pet.hp + (this.pet.maxHp || 0) * pct);
    let n = 0;
    for (const e of this.rplayers || []) {
      if (e.netHidden || !this.partyHas || !this.partyHas(e.peerId) || flat(e.pos, at) > r) continue;
      if (o.max && n >= o.max) break;
      n++;
      this.healPeer(e, { pct: pct * this.healMod, cleanse: !!o.cleanse, hot: o.hot, revive: o.revive });
    }
  },
  healPeer(e, h) { if (this.partySendHeal) this.partySendHeal(e.peerId, h); },
  addHot(e, pct, dur, id) {
    for (let i = 1; i <= dur; i++) this.after(i, () => { if (!e.dead) { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * pct); if (e === this.player && i % 2 === 0) this.fx.emit(e.pos.clone().setY(e.pos.y + 1), { count: 6, color: 0x9ae8a0, speed: 1, life: 0.6, size: 0.4, up: 2 }); } });
    if (e === this.player) { this.player.buffs = this.player.buffs.filter((x) => x.id !== id); this.player.buffs.push({ id, icon: id, until: this.time + dur }); }
  },
  cleanse() {
    const p = this.player;
    p.stun = 0; p.slowT = 0;
    p.buffs = p.buffs.filter((b) => !b.debuff);
    this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 24, colors: [0xffffff, 0x9ad8ff], speed: 3, life: 0.6, size: 0.5, up: 2 });
  },

  // ================================================================ per frame
  updateCombat(dt) {
    const p = this.player;
    this.tickCharges();
    this.channelTick();
    // leaps and dashes move the hero along a path
    if (this.tween) {
      const T = this.tween; T.t += dt;
      const k = Math.min(1, T.t / T.dur);
      p.pos.x = T.from.x + (T.to.x - T.from.x) * k; p.pos.z = T.from.z + (T.to.z - T.from.z) * k;
      p.jumpY = Math.sin(k * Math.PI) * (T.h || 0);
      if (k >= 1) { this.tween = null; p.jumpY = 0; T.onEnd && T.onEnd(); }
    }
    this.updateZones(dt);
    this.updateSummons(dt);
    // runes fade 12 s after the last one was stored (unless Eternal Runes)
    if (this.runes > 0 && !this.rule('eternalRunes') && this.time - this.runeT > 12) this.runes = Math.max(0, this.runes - 1), this.runeT = this.time;
    // standing still (Hawk's Patience, Fortress Stance)
    this.stillT = p.moving ? 0 : (this.stillT || 0) + dt;
    // stealth: Nightwalker speed, and it ends by itself
    if (p.model && !this.pflag('stealth') && p.model.userData.ghosted) { this.ghost(p.model, false); p.model.userData.ghosted = false; }
    if (this.pflag('stealth')) p.model.userData.ghosted = true;
    // rage aura
    if (this.inRage() && Math.random() < dt * 10) this.fx.emit(p.pos.clone().setY(p.pos.y + 0.4), { count: 1, color: 0xff3a2a, speed: 0.6, life: 0.7, size: 0.6, up: 2, jitter: 0.6 });
  },
};

export function installCombatWorld(Game) { Object.assign(Game.prototype, W); }
export { UNITS };
