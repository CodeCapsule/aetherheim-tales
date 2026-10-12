// Gear rules from the item design: the mastery lock, durability (lost on death, repaired at Gorm), account binding,
// the visible glow of Legendary-and-up gear, Ancient items (one per account per season, the owner's name engraved),
// the six-piece set powers, and where those sets drop.
import * as THREE from 'three';
import { SLOTS } from './data.js';
import { SIX_SETS, SIX_BY_DUNGEON } from './data-sets.js';
import { RARITY, tierMin, genSix, repairCost, DUR_DEATH, AWAKEN } from './loot.js';
import { CLASSES } from './data-classes.js';
import { glowTexture } from './toon.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pick = (a) => a[(Math.random() * a.length) | 0];
const seasonKey = () => { const d = new Date(); return `${d.getUTCFullYear()}-${Math.floor(d.getUTCMonth() / 3)}`; }; // a season is a quarter
const MOVE_KINDS = new Set(['dash', 'leap']), AREA_KINDS = new Set(['nova', 'blast', 'zone', 'cone', 'channel']);

const G = {
  // ================================================================ requirements
  gearReq(eq) { return Math.max(tierMin(eq.quality), SIX_SETS[eq.set]?.min || 0); },
  // '' when you may wear it, else why not (weapon mastery must reach the item's tier minimum)
  equipBlock(eq) {
    const need = this.gearReq(eq), have = this.masteryLv ? this.masteryLv('weapon') : 999;
    return have < need ? `Needs weapon mastery ${need} (you have ${have})` : '';
  },
  gearCtx() { return { mastery: this.masteryLv ? this.masteryLv('weapon') : null }; },
  isBound(eq) { return !!eq && (eq.bound || eq.quality >= 5); },

  // ================================================================ durability
  // dying wears every worn item down (never inside a trial: the trial already costs the sigil)
  wearOnDeath() {
    if (this.trial) return;
    let broke = 0;
    for (const s of SLOTS) { const eq = this.S.equip[s]; if (!eq || eq.dur == null) continue; const was = eq.dur; eq.dur = Math.max(0, eq.dur - DUR_DEATH); if (was > 0 && eq.dur === 0) broke++; }
    if (broke) { this.ui.toast(`${broke} item${broke > 1 ? 's' : ''} broke: repair at Gorm the Blacksmith`, 'warn'); this.ui.chat('system', 'Broken gear gives no stats until Gorm repairs it.'); }
    this.recalc();
  },
  repairList() { return SLOTS.map((s) => ({ s, eq: this.S.equip[s] })).filter(({ eq }) => eq && repairCost(eq)); },
  repairTotal() {
    const c = { gold: 0, mats: {} };
    for (const { eq } of this.repairList()) { const r = repairCost(eq); c.gold += r.gold; for (const [k, v] of Object.entries(r.mats)) c.mats[k] = (c.mats[k] || 0) + v; }
    return c;
  },
  repairAll() {
    const list = this.repairList(); if (!list.length) { this.ui.toast('Nothing needs repairing', 'good'); return false; }
    const c = this.repairTotal();
    if (!this.canAfford(c)) { this.ui.toast(this.missingText(c), 'warn'); this.sfx.play('error'); return false; }
    this.pay(c);
    for (const { eq } of list) eq.dur = 100;
    this.sfx.play('upgrade'); this.ui.toast(`Repaired ${list.length} item${list.length > 1 ? 's' : ''}`, 'good');
    this.recalc(); this.ui.refreshPanel(); this.save();
    return true;
  },

  // ================================================================ visible progress: the glow of high-tier gear
  gearGlowTier() {
    let q = 0;
    for (const s of SLOTS) { const eq = this.S.equip[s]; if (eq && eq.dur !== 0 && eq.quality > q) q = eq.quality; }
    return q >= 5 ? q : 0;
  },
  applyGearGlow(e, tier) {
    if (e.gearGlow) { e.model.remove(e.gearGlow); e.gearGlow.userData.dispose(); e.gearGlow = null; }
    if (!tier || tier < 5) return;
    const col = new THREE.Color(RARITY[tier].color), g = new THREE.Group();
    const mat = new THREE.SpriteMaterial({ map: glowTexture(), color: col, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 });
    const core = new THREE.Sprite(mat); core.position.y = 1.2; core.scale.set(2.2, 2.8, 1); core.raycast = () => {}; g.add(core);
    const motes = [];
    for (let i = 0; i < (tier === 7 ? 6 : tier === 6 ? 5 : 4); i++) { const m = new THREE.Sprite(mat.clone()); m.scale.setScalar(0.35); m.raycast = () => {}; g.add(m); motes.push(m); }
    g.userData.update = (t) => { mat.opacity = 0.32 + Math.sin(t * 2.2) * 0.1; motes.forEach((m, i) => { const a = t * (1.2 + i * 0.1) + i * 1.7; m.position.set(Math.cos(a) * 0.9, 0.5 + ((t * 0.6 + i * 0.37) % 1.6), Math.sin(a) * 0.9); m.material.opacity = 0.7 - ((t * 0.6 + i * 0.37) % 1.6) * 0.4; }); };
    g.userData.dispose = () => { mat.dispose(); motes.forEach((m) => m.material.dispose()); };
    e.model.add(g); e.gearGlow = g;
  },
  refreshGearGlow() {
    const t = this.gearGlowTier();
    if (t !== this.gearGlowT) { this.gearGlowT = t; this.applyGearGlow(this.player, t); this.mpTrackNow && this.mpTrackNow(); }
  },

  // ================================================================ Ancient: one per account per season, name engraved
  ancientAllowed() { return this.S.ancient?.season !== seasonKey(); },
  noteAncient(eq) {
    this.S.ancient = { season: seasonKey(), name: eq.name, t: Date.now() };
    eq.engraved = this.S.name;
    this.ui.banner('ANCIENT', eq.name, 'loot6');
    this.ui.chat('announce', `<b>[Announcement]</b> ${this.S.name} found the Ancient <b>${eq.name}</b>!`);
    const key = 'a' + (eq.set || eq.named || 'item');
    this.S.ancientFirst = { ...(this.S.ancientFirst || {}), [key]: Date.now() };
    this.prestigeClaim && this.prestigeClaim(key);
  },
  // a piece of a six-piece set for you (Ancient tiers respect the season limit)
  makeSix(setId, slot = null) {
    const set = SIX_SETS[setId]; if (!set) return null;
    if (set.tier === 7 && !this.ancientAllowed()) return null;
    const eq = genSix(setId, { slot, lvl: Math.max(set.min, this.S.level), cls: this.S.cls, uid: this.S.uid++, owner: this.S.name });
    if (set.tier === 7) this.noteAncient(eq);
    return eq;
  },
  giveSix(setId, slot = null, why = '') {
    const eq = this.makeSix(setId, slot); if (!eq) return null;
    if (this.addEquip(eq)) { this.lootMsg(eq.name, RARITY[eq.quality].color); if (why) this.ui.chat('system', `${why}: <b>${eq.name}</b> (${SIX_SETS[setId].name} set).`); }
    return eq;
  },
  // field elites and world bosses (open world) can drop the explorer and beast sets that live there
  sixWorldDrop(m) {
    const d = m.def0, L = m.level || 1; if (m.dungeon || m.trialMob || m.summoned) return;
    let pool = [];
    if (d.elite && !d.boss) { if (L >= 20) pool.push('six_wayfarer'); if (L >= 45) pool.push('six_griffin'); }
    if (m.wb || (d.boss && !m.dungeon)) { if (L >= 70) pool.push('six_emberheart'); if (L >= 75) pool.push('six_hydra'); }
    if (!pool.length) return;
    const chance = m.wb ? 0.35 : d.boss ? 0.12 : 0.03;
    if (Math.random() < chance) { const eq = this.makeSix(pick(pool)); if (eq) this.dropLoot({ eq }, m.pos); }
  },
  // a dungeon chest may also hold a piece of the six-piece sets tied to that dungeon
  sixDungeonDrop(dgId, rating) {
    const list = (SIX_BY_DUNGEON[dgId] || []).filter((id) => this.S.level >= SIX_SETS[id].min - 5);
    if (!list.length || Math.random() > ({ S: 0.5, A: 0.35, B: 0.2 }[rating] || 0.2)) return null;
    return this.makeSix(pick(list));
  },
  // trial rewards: the sets the design ties to each trial
  sixTrialReward(n) {
    const map = { 2: 'six_wayfarer', 7: 'six_bloodsworn', 8: Math.random() < 0.5 ? 'six_fenrir' : 'six_bloodsworn', 9: 'six_bloodsworn', 10: Math.random() < 0.5 ? 'six_firstdawn' : 'six_jormungandr' };
    if (map[n]) this.giveSix(map[n], null, 'Trial reward');
  },

  // ================================================================ set powers in combat
  // outgoing damage: returns { m, crit }
  gearOut(dst, o) {
    const sk = o.sk; let m = 1, crit = 0;
    const boss = dst.def0?.boss || dst.wb;
    if (boss) m *= 1 + this.stat('bossPct') / 100;
    if (sk && (sk.el === 'fire' || (CLASSES[this.S.cls].element === 'Fire' && !sk.basic)) || o.dot === 'burn') m *= 1 + this.stat('firePct') / 100;
    if (o.dot === 'poison') m *= 1 + this.stat('poisonPct') / 100;
    if (CLASSES[this.S.cls].ranged || sk?.k === 'proj') m *= 1 + this.stat('rangedPct') / 100;
    if (sk && this.awakened(sk)) m *= AWAKEN.dmg;
    if (dst.guardBreakT > this.time) m *= 1.25;
    if (this.hasFx('six_fenrir6')) { m *= 1.15; if (boss && dst.hp < dst.maxHp * 0.2) m *= 2; }
    if (this.perfectNext > this.time && !o.proc) { m *= 1.4; this.perfectNext = 0; }
    if (this.sureCrit && !o.proc) { crit += 1000; this.sureCrit = false; }
    return { m, crit };
  },
  // incoming damage multiplier (after dodge and block)
  gearInMult() { return 1 - Math.min(40, this.stat('dmgTaken')) / 100; },
  // is this skill in its awakened form? (a Red item awakens one; Bloodsworn 6 awakens all below 40% HP)
  awakened(sk) {
    if (!sk || sk.basic) return false;
    if ((this.awakenIds || []).includes(sk.id)) return true;
    return this.hasFx('six_blood6') && this.player.hp < this.player.maxHp * 0.4;
  },
  gearHurt(src, dmg) {
    const p = this.player;
    if (this.hasFx('six_cerb4') && src?.kind === 'monster' && !src.dead && Math.random() < 0.15) this.st(src, 'burn', [0.4, 3]);
    if (this.hasFx('six_cerb6') && src?.kind === 'monster') {
      this.guardCharges = (this.guardCharges || 0) + 1;
      if (this.guardCharges >= 3 && (this.procCD.howl || 0) <= this.time) {
        this.guardCharges = 0; this.procCD.howl = this.time + 20;
        this.fx.ring(p.pos, 0xff5a2a, 8, 0.6); this.sfx.play('boom'); this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.4), 'Hellfire Howl', 'crit');
        for (const m of this.enemiesIn ? this.enemiesIn(p.pos, 8) : []) this.st(m, 'fear', 2);
      }
    }
    if (this.hasFx('six_hydra6') && p.hp > 0 && p.hp < p.maxHp * 0.25 && (this.procCD.regrow || 0) <= this.time) {
      this.procCD.regrow = this.time + 180; this.heal(p, p.maxHp * 0.3); this.fx.heal(p); this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.4), 'Regrowth', 'heal');
    }
    if (this.hasFx('six_tide6') && p.hp > 0 && p.hp < p.maxHp * 0.3 && (this.procCD.lifeline || 0) <= this.time) {
      this.procCD.lifeline = this.time + 60; this.heal(p, p.maxHp * 0.3); this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.4), 'Lifeline', 'heal');
    }
  },
  gearOnHit(dst, sk) {
    if (dst.kind !== 'monster' || dst.dead) return;
    const boss = dst.def0?.boss || dst.wb;
    if (this.hasFx('six_hydra4')) { dst.venom = Math.min(5, (dst.venom || 0) + 1); dst.venomT = this.time + 5; }
    if (this.hasFx('six_basi4') && dst.poison && dst.poison.until > this.time) this.st(dst, 'slow', [0.15, 1.5]);
    if (this.hasFx('six_basi6') && !boss && (this.procCD.gaze || 0) <= this.time) { this.procCD.gaze = this.time + 30; this.st(dst, 'stun', 3); this.fx.text(dst.pos.clone().setY(dst.pos.y + dst.height + 0.4), 'Petrified', 'miss'); }
    if (sk && MOVE_KINDS.has(sk.k)) {
      if (this.hasFx('six_mino4') && !boss) this.st(dst, 'stun', 1);
      if (this.hasFx('six_mino6') && boss) { dst.guardBreakT = this.time + 3; this.fx.text(dst.pos.clone().setY(dst.pos.y + dst.height + 0.4), 'Guard broken', 'crit'); }
    }
    if (sk && AREA_KINDS.has(sk.k) && this.hasFx('six_kraken4') && !boss) this.st(dst, 'root', 1);
    if (sk && this.hasFx('six_ember4') && (sk.el === 'fire' || CLASSES[this.S.cls].element === 'Fire') && dst.burnT > this.time) {
      const near = (this.enemiesIn ? this.enemiesIn(dst.pos, 5) : []).find((m) => m !== dst && !(m.burnT > this.time));
      if (near) this.st(near, 'burn', [0.3, 3]);
    }
  },
  gearOnKill(m) {
    const p = this.player;
    if (this.hasFx('six_blood4')) this.heal(p, p.maxHp * 0.03);
    if (this.hasFx('six_phoenix4') && (m.burnT > this.time || CLASSES[this.S.cls].element === 'Fire')) this.heal(p, p.maxHp * 0.02);
    if (this.hasFx('six_fenrir4')) {
      let b = p.buffs.find((x) => x.id === 'wolffrenzy');
      if (!b) { b = { id: 'wolffrenzy', icon: 'fenrir', stacks: 0, mods: { aspd: 1 } }; p.buffs.push(b); }
      b.stacks = Math.min(4, b.stacks + 1); b.mods.aspd = 1 + 0.05 * b.stacks; b.until = this.time + 10;
    }
  },
  gearOnCast(sk) {
    const p = this.player;
    if (sk.basic) return;
    if (this.hasFx('six_ember6') && (sk.el || sk.magic || CLASSES[this.S.cls].element === 'Fire')) {
      this.spellN = (this.spellN || 0) + 1;
      if (this.spellN % 5 === 0) { this.fx.ring(p.pos, 0xff6a2a, 6, 0.5); this.fx.emit(p.pos.clone().setY(1), { count: 40, colors: [0xff6a2a, 0xffd04a], speed: 8, life: 0.5, size: 0.8 }); this.aoe(p.pos.clone(), 6, 1.8, 0, true); this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.4), 'Ember Nova', 'crit'); }
    }
    if (this.hasFx('six_kraken6')) {
      this.skillN = (this.skillN || 0) + 1;
      if (this.skillN % 6 === 0) {
        const c = (p.target && !p.target.dead ? p.target.pos : p.pos).clone();
        this.fx.circle(c, '#4a8ad8', 4, 1); this.fx.text(c.clone().setY(c.y + 2), 'Tentacles', 'crit');
        for (const m of this.enemiesIn ? this.enemiesIn(c, 7) : []) { this.st(m, 'pull', [c, 12]); this.damage(p, m, 1.5, { proc: true }); }
      }
    }
  },
  // lethal damage: Last Stand (Crown of the Fallen King) and Rebirth (Phoenix)
  gearCannotDie() {
    const p = this.player, key = this.dg ? 'dg:' + this.dg.startT : 'w:' + Math.floor(this.time / 600);
    const save = (id, hp, label) => { if (!this.hasFx(id) || (this.onceUsed?.[id] === key)) return false; this.onceUsed = { ...(this.onceUsed || {}), [id]: key }; p.hp = hp; this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.4), label, 'crit'); this.fx.pillar(p.pos, 0xffd84a, 1.6, 8, 0.8); return true; };
    return save('six_phoenix6', Math.round(p.maxHp * 0.5), 'Rebirth!') || save('six_king6', 1, 'Last Stand!');
  },
  // twice a second: venom ticks, the Ancient Aura, World Coil, Sky Dive readiness, Hydra regeneration
  gearTick(dt) {
    const p = this.player;
    if ((this.gearT = (this.gearT || 0) - dt) > 0) return;
    this.gearT = 0.5;
    if (p.dead) return;
    // venom stacks deal damage over time
    if (this.hasFx('six_hydra4')) for (const m of this.monsters) if (m.venom && !m.dead && m.venomT > this.time && (m.map || this.world) === this.map) this.damage(p, m, 0.02 * m.venom, { proc: true, dot: 'poison', canCrit: false });
    // HP regeneration from Hydra pieces
    const rp = this.stat('regenPct'); if (rp > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.004 * rp / 10);
    // Relics of the First Dawn: +10% all stats for you and party members near you
    const dawn = this.hasFx('six_dawn6') || (this.partyMembersNear ? this.partyMembersNear().some((m) => m.dawn) : false);
    const b = p.buffs.find((x) => x.id === 'dawn');
    if (dawn && !b) p.buffs.push({ id: 'dawn', icon: 'buff_atk', until: Infinity, mods: { atk: 1.1, def: 1.1 } });
    else if (!dawn && b) p.buffs = p.buffs.filter((x) => x !== b);
    // World Coil: the first time you face a boss or elite in a fight
    if (this.hasFx('six_jorm6') && (this.procCD.coil || 0) <= this.time) {
      const t = p.target;
      if (t && !t.dead && (t.def0?.boss || t.def0?.elite || t.wb) && flat(t.pos, p.pos) < 12) {
        this.procCD.coil = this.time + 90;
        this.fx.circle(p.pos, '#7ad85a', 12, 6); this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.6), 'World Coil', 'crit');
        for (let i = 1; i <= 6; i++) this.after(i, () => { for (const m of this.enemiesIn ? this.enemiesIn(p.pos, 12) : []) this.damage(p, m, 0, { fixed: m.maxHp * (m.def0?.boss || m.wb ? 0.01 : 0.05), proc: true, cls: 'pet' }); });
      }
    }
    if (this.hasFx('six_griffin6') && (this.procCD.dive || 0) <= this.time && !this.diveReady) { this.diveReady = true; }
  },
  // Griffin: every 15 s a roll is a 10 m dive and readies a guaranteed critical
  rollDistance(base) {
    if (this.hasFx('six_griffin6') && this.diveReady) { this.diveReady = false; this.procCD.dive = this.time + 15; this.sureCrit = true; this.fx.text(this.player.pos.clone().setY(this.player.pos.y + 2.4), 'Sky Dive', 'crit'); return 10; }
    return base;
  },
};

export function installGear(Game) { Object.assign(Game.prototype, G); }
