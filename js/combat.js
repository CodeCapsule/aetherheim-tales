// Class skills in play: the skill book (ranks, awakening paths, loadout, respec), passive totals read by recalc,
// casting every kind of active skill, the damage hooks game.js calls, class resources (runes, rage, stealth,
// elements), action combat (dodge roll with a perfect-dodge window, shield block, parry) and the auto-hit rules.
// Monster status effects, summons, zones, traps and the special skills live in combat-world.js.
import * as THREE from 'three';
import { CLASSES, BASIC, CLASS_SKILLS, SKILL_BY_ID, MAX_RANK, skillPointsFor, rankMastery, rankMult, RACES } from './data-classes.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const today = () => new Date().toISOString().slice(0, 10);
const MELEE_KINDS = new Set(['strike', 'cone', 'nova', 'channel']);
const ROLL = { dur: 0.42, dist: 4.5, cost: 30, perfect: 0.2 };
const basicCache = {};

const CB = {
  // ================================================================ skill book
  classSkills() { return CLASS_SKILLS[this.S.cls]; },
  allSkills() { const T = this.classSkills(); return [...T.core, ...T.paths[0], ...T.paths[1]]; },
  skillUnlocked(sk) { return !!sk && (sk.basic || (this.S.level >= sk.lv && (sk.path == null || this.S.awaken === sk.path))); },
  rk(sk) { return sk.basic ? 1 : (this.S.skills[sk.id] || 0); },
  rm(sk) { return rankMult(this.rk(sk)); },
  weaponMastery() { return this.masteryLv ? this.masteryLv('weapon') : this.S.level; },
  // grant rank 1 of newly reached skills, drop skills of a path no longer chosen, keep the loadout valid
  syncSkills(announce = false) {
    const S = this.S;
    S.skills = S.skills || {}; S.loadout = Array.isArray(S.loadout) && S.loadout.length === 6 ? S.loadout : [null, null, null, null, null, null];
    const fresh = [];
    for (const sk of this.allSkills()) if (this.skillUnlocked(sk) && !S.skills[sk.id]) { S.skills[sk.id] = 1; fresh.push(sk); }
    for (const id of Object.keys(S.skills)) { const sk = SKILL_BY_ID[id]; if (!sk || sk.cls !== S.cls || !this.skillUnlocked(sk)) delete S.skills[id]; }
    S.loadout = S.loadout.map((id) => (id && S.skills[id] && SKILL_BY_ID[id].type === 'active' ? id : null));
    for (const sk of fresh) if (sk.type === 'active' && !S.loadout.includes(sk.id)) { const i = S.loadout.indexOf(null); if (i >= 0) S.loadout[i] = sk.id; }
    if (S.ult && !S.skills[S.ult]) S.ult = null;
    if (!S.ult) { const u = this.allSkills().find((s) => s.type === 'ultimate' && S.skills[s.id]); if (u) S.ult = u.id; }
    if (announce) for (const sk of fresh) this.ui.chat('system', `New ${sk.type === 'passive' ? 'passive' : sk.type === 'ultimate' ? 'ultimate' : 'active'} skill: <b>${sk.name}</b> (${sk.desc}).${sk.type === 'active' && !S.loadout.includes(sk.id) ? ' Put it in your loadout in the Skills window (K).' : ''}`);
    return fresh;
  },
  skillPtsTotal() { return skillPointsFor(this.S.level, this.trialsCleared ? this.trialsCleared() : 0); },
  skillPtsSpent() { let n = 0; for (const [id, r] of Object.entries(this.S.skills || {})) if (SKILL_BY_ID[id]?.cls === this.S.cls) n += r - 1; return n; },
  skillPtsLeft() { return this.skillPtsTotal() - this.skillPtsSpent(); },
  // why a skill cannot take another rank right now ('' when it can)
  rankBlock(sk) {
    const S = this.S;
    if (sk.path != null && S.awaken !== sk.path) return S.level >= 100 ? `Choose the ${CLASSES[S.cls].paths[sk.path]} path to learn it` : `Awakening path skill (Lv 100+)`;
    if (!this.skillUnlocked(sk)) return `Unlocks at Lv ${sk.lv}`;
    const r = this.rk(sk);
    if (r >= MAX_RANK) return 'Mastered';
    const need = rankMastery(r + 1);
    if (need && this.weaponMastery() < need) return `Rank ${r + 1} needs weapon mastery ${need} (you have ${this.weaponMastery()})`;
    if (this.skillPtsLeft() < 1) return 'No skill points left (1 per level, 3 per cleared trial)';
    return '';
  },
  rankUp(id) {
    const sk = SKILL_BY_ID[id]; if (!sk) return false;
    const why = this.rankBlock(sk);
    if (why) { this.ui.toast(why, 'warn'); this.sfx.play('error'); return false; }
    this.S.skills[id]++;
    this.sfx.play('upgrade'); this.fx.buff(this.player, CLASSES[this.S.cls].elemColor);
    this.recalc(); this.ui.refreshPanel(); this.ui.refreshSkills(); this.save();
    return true;
  },
  // free once per day, and only in a town
  respecInfo() {
    const town = !!(this.zone && this.zone.safe) && !this.dg && !this.war && !this.trial;
    const free = this.S.respecDay !== today();
    return { town, free, ok: town && free };
  },
  respecSkills() {
    const R = this.respecInfo();
    if (!R.town) { this.ui.toast('Skills can only be reset in a town', 'warn'); return false; }
    if (!R.free) { this.ui.toast('You already reset your skills today — come back tomorrow', 'warn'); return false; }
    for (const id of Object.keys(this.S.skills)) this.S.skills[id] = 1;
    this.S.respecDay = today();
    this.ui.toast('Skill ranks reset: every point is back', 'good'); this.sfx.play('level');
    this.recalc(); this.ui.refreshPanel(); this.ui.refreshSkills(); this.save();
    return true;
  },
  // awakening at Lv 100: the first choice is free, switching costs a Trial Sigil
  chooseAwaken(i) {
    const S = this.S;
    if (S.level < 100) { this.ui.toast('Awakening opens at Lv 100 (after Trial V)', 'warn'); return false; }
    if (S.awaken === i) return false;
    if (S.awaken != null) {
      const sig = S.bag.findIndex((b) => b.id && b.id.startsWith('sigil_'));
      if (sig < 0) { this.ui.toast('Switching your awakening path costs a Trial Sigil', 'warn'); this.sfx.play('error'); return false; }
      const b = S.bag[sig]; b.qty--; if (b.qty <= 0) S.bag.splice(sig, 1);
    }
    S.awaken = i;
    this.syncSkills(true);
    const C = CLASSES[S.cls];
    this.ui.banner('AWAKENED', `${C.name} · ${C.paths[i]}`, 'level'); this.fx.levelUp(this.player); this.sfx.play('level');
    this.recalc(); this.ui.refreshPanel(); this.ui.refreshSkills(); this.save();
    return true;
  },
  setLoadout(slot, id) {
    const S = this.S, sk = id && SKILL_BY_ID[id];
    if (slot === 'ult') { if (sk && sk.type === 'ultimate' && S.skills[id]) S.ult = id; }
    else if (!sk) S.loadout[slot] = null;
    else if (sk.type === 'active' && S.skills[id]) { const j = S.loadout.indexOf(id); if (j >= 0) S.loadout[j] = S.loadout[slot]; S.loadout[slot] = id; }
    this.ui.refreshSkills(); this.ui.refreshPanel(); this.save();
  },
  basicSkill() {
    const cls = this.S.cls;
    if (!basicCache[cls]) { const B = BASIC[cls]; basicCache[cls] = { ...B, id: cls + '_basic', basic: true, type: 'basic', lv: 1, lvl: 1, mp: 0, kind: B.k, desc: 'Basic weapon attack. Used automatically while you fight.', range: CLASSES[cls].range }; }
    return basicCache[cls];
  },
  // [basic, six loadout slots, ultimate]; empty slots are null
  skillList() {
    const S = this.S;
    return [this.basicSkill(), ...(S.loadout || []).map((id) => (id ? SKILL_BY_ID[id] : null)), S.ult ? SKILL_BY_ID[S.ult] : null];
  },

  // ================================================================ passives (read by recalc)
  passiveAgg() {
    const A = { stat: {}, cond: [], onKill: [], onHit: {}, onHurt: {}, rules: new Set(), ruleV: {}, mods: {}, wind: null };
    for (const sk of this.allSkills()) {
      if (sk.type !== 'passive' || !this.skillUnlocked(sk)) continue;
      const k = this.rm(sk), p = sk.p;
      if (p.stat) for (const [key, v] of Object.entries(p.stat)) A.stat[key] = (A.stat[key] || 0) + (key === 'summonSlots' ? v : v * k);
      if (p.cond) A.cond.push({ ...p.cond, v: p.cond.v * k });
      if (p.onKill) A.onKill.push({ ...p.onKill, heal: (p.onKill.heal || 0) * k, atkStack: p.onKill.atkStack && [p.onKill.atkStack[0] * k, p.onKill.atkStack[1], p.onKill.atkStack[2]] });
      if (p.onHit) for (const [key, v] of Object.entries(p.onHit)) A.onHit[key] = Array.isArray(v) ? [v[0], v[1] * k] : (A.onHit[key] || 0) + v * k;
      if (p.onHurt) for (const [key, v] of Object.entries(p.onHurt)) A.onHurt[key] = Array.isArray(v) ? [v[0] * k, v[1], v[2]] : (A.onHurt[key] || 0) + v * k;
      if (p.rule) { A.rules.add(p.rule); if (p.v) A.ruleV[p.rule] = p.v * k; }
      if (p.skillMod) {
        const m = A.mods[p.skillMod.id] = A.mods[p.skillMod.id] || {};
        for (const [key, v] of Object.entries(p.skillMod)) if (key !== 'id') m[key] = (m[key] || 0) + (key === 'charges' || key === 'targets' ? v : v * k);
      }
      if (p.secondWind) A.wind = { ...p.secondWind, heal: p.secondWind.heal * k };
    }
    const R = RACES[this.S.app?.race]?.mods || {};
    if (R.hpPct) A.stat.hpPct = (A.stat.hpPct || 0) + R.hpPct;
    if (R.speedPct) A.stat.speedPct = (A.stat.speedPct || 0) + R.speedPct;
    return A;
  },
  ps(k) { return this.pAgg?.stat[k] || 0; },
  rule(r) { return !!this.pAgg?.rules.has(r); },
  smod(id, k) { return this.pAgg?.mods[id]?.[k] || 0; },
  // the passive conditions that hold right now against a target (key: dmg | crit | critDmg | aspd)
  condV(key, dst = null) {
    const A = this.pAgg; if (!A) return 0;
    const p = this.player; let v = 0;
    for (const c of A.cond) {
      if ((c.key || 'dmg') !== key) continue;
      let ok = false;
      switch (c.when) {
        case 'rage': ok = this.inRage(); break;
        case 'highHp': ok = p.hp > p.maxHp * c.x / 100; break;
        case 'targetLow': ok = !!dst && dst.maxHp > 0 && dst.hp < dst.maxHp * c.x / 100; break;
        case 'boss': ok = !!dst && !!(dst.def0?.boss || dst.wb); break;
        case 'behind': ok = !!dst && this.isBehind(dst); break;
        case 'moving': ok = !!dst && !!dst.moving; break;
        case 'stunned': ok = !!dst && (dst.stun > 0); break;
        case 'still': ok = this.stillT >= (c.x || 2); break;
        case 'burning': ok = !!dst && (dst.burnT || 0) > this.time; break;
        case 'cursed': ok = !!dst && this.curseCount(dst) > 0; break;
        case 'far': ok = !!dst && flat(p.pos, dst.pos) > c.x; break;
        case 'companion': ok = (this.summons || []).some((s) => s.unit === 'companion' && !s.dead); break;
        case 'fullRunes': ok = this.runes >= this.runeCap(); break;
      }
      if (ok) v += c.v;
    }
    return v;
  },
  inRage() { const p = this.player; return this.S.cls === 'berserker' && !!this.pAgg?.cond.some((c) => c.when === 'rage') && p.hp < p.maxHp * (this.rule('deathless') ? 0.7 : 0.5); },
  isBehind(dst) {
    const p = this.player, fy = dst.yaw ?? 0;
    const ax = Math.sin(fy), az = Math.cos(fy), dx = p.pos.x - dst.pos.x, dz = p.pos.z - dst.pos.z, L = Math.hypot(dx, dz) || 1;
    return (ax * dx + az * dz) / L < -0.3;
  },
  // buff flags on the player (first matching value)
  pflag(name) { for (const b of this.player.buffs) if (b.flags && b.flags[name] != null && b.until > this.time) return b.flags[name]; return 0; },
  dropFlag(name) { this.player.buffs = this.player.buffs.filter((b) => !(b.flags && b.flags[name] != null)); },

  // ================================================================ cooldowns, charges, costs
  cdOf(sk) {
    if (sk.basic) {
      const as = (1 + (this.ps('aspd') + this.condV('aspd')) / 100) * this.buffMod(this.player, 'aspd');
      return (sk.cd / as / (1 + this.stat('atkSpeed') / 100)) * (this.hasFx('swift') ? 0.88 : 1);
    }
    return sk.cd * (1 - this.cdr) * Math.max(0.4, 1 + this.smod(sk.id, 'cd') / 100) * (this.awakened(sk) ? 0.7 : 1);
  },
  cdTotal(sk) { return sk ? this.cdOf(sk) : 1; },
  maxCharges(sk) { return Math.max(1, this.smod(sk.id, 'charges') || 1); },
  chargesLeft(sk) { const mx = this.maxCharges(sk); return mx > 1 ? (this.chg[sk.id] ?? mx) : ((this.cd[sk.id] || 0) <= this.time ? 1 : 0); },
  skillReady(sk) { return this.chargesLeft(sk) > 0; },
  spendCharge(sk, cdMult = 1) {
    const mx = this.maxCharges(sk);
    if (mx <= 1) { this.cd[sk.id] = this.time + this.cdOf(sk) * cdMult; return; }
    const n = (this.chg[sk.id] ?? mx) - 1; this.chg[sk.id] = n;
    if ((this.cd[sk.id] || 0) <= this.time) this.cd[sk.id] = this.time + this.cdOf(sk) * cdMult;
  },
  tickCharges() {
    for (const [id, n] of Object.entries(this.chg)) {
      const sk = SKILL_BY_ID[id]; if (!sk) continue;
      const mx = this.maxCharges(sk);
      if (n < mx && (this.cd[id] || 0) <= this.time) { this.chg[id] = n + 1; if (n + 1 < mx) this.cd[id] = this.time + this.cdOf(sk); }
    }
  },
  chargeTime(sk) {
    if (!sk.charge) return 0;
    return sk.charge * Math.max(0.3, 1 + this.smod(sk.id, 'charge') / 100) / (1 + this.ps('castSpeed') / 100);
  },
  skRange(sk) {
    const C = CLASSES[this.S.cls];
    let r = sk.range ?? (sk.basic ? C.range : MELEE_KINDS.has(sk.k) ? C.range + 0.4 : sk.k === 'dash' ? sk.d : sk.k === 'leap' ? 10 : 3);
    if (this.S.cls === 'ranger') r *= 1 + this.ps('rangePct') / 100;
    if (!sk.basic) r *= (1 + this.stat('skillRange') / 100) * (this.awakened(sk) ? 1.3 : 1);
    return r;
  },
  needsEnemy(sk) {
    if (sk.basic) return true;
    if (['strike', 'proj', 'chain', 'debuff'].includes(sk.k)) return true;
    if (sk.k === 'multi' || (sk.k === 'blink' && sk.dir === 'behind')) return true;
    return sk.k === 'special' && ['nightReaper', 'venomBurst', 'hexChain', 'commandFocus', 'pounce', 'runicJudgment'].includes(sk.fn);
  },
  needRunes(sk) { return sk.k === 'special' && ['runeBurst', 'runeArmor', 'runicJudgment'].includes(sk.fn); },
  animFor(sk) {
    const C = CLASSES[this.S.cls];
    if (sk.basic) return C.anim;
    if (['buff', 'heal', 'summon', 'debuff'].includes(sk.k) || (sk.k === 'zone' && sk.at !== 'follow')) return C.ranged ? 'cast' : this.S.cls === 'berserker' ? 'heavy' : 'cast';
    if (this.S.cls === 'ranger') return ['proj', 'line', 'multi', 'blast', 'channel', 'trap'].includes(sk.k) ? 'shoot' : 'attack';
    if (C.ranged) return 'cast';
    return this.S.cls === 'berserker' ? 'heavy' : 'attack';
  },

  // ================================================================ casting
  useSkill(i) {
    const p = this.player; if (p.dead) return;
    const sk = this.skillList()[i];
    if (!sk) { this.ui.toast(i === 7 ? 'Your ultimate unlocks at Lv 200' : 'Empty slot — choose a skill for it in the Skills window (K)', 'warn'); return; }
    this.trySkill(sk);
  },
  trySkill(sk, auto = false) {
    if (!auto && this.noteInput) this.noteInput(sk.id);
    const p = this.player;
    if (p.dead || p.stun > 0 || this.rolling || (this.casting && !sk.basic)) return false;
    if (!this.skillUnlocked(sk)) { if (!auto) this.ui.toast(`Unlocks at Lv ${sk.lv}`, 'warn'); return false; }
    if (!this.skillReady(sk)) { if (!auto) this.ui.toast('Skill is cooling down', 'warn'); return false; }
    if (p.mp < this.mpCost(sk)) { if (!auto) { this.ui.toast('Not enough MP', 'warn'); this.sfx.play('error'); } return false; }
    if (this.needRunes(sk) && this.runes < 1) { if (!auto) this.ui.toast('No runes stored — Rune Strike stores them', 'warn'); return false; }
    if (sk.k === 'summon' && sk.unit === 'companion' && (this.summons || []).filter((s) => s.unit === 'companion' && !s.dead).length >= (this.rule('alphaSpirit') ? 2 : 1)) {
      if (!auto) this.ui.toast('Your companion is already at your side', 'warn'); return false;
    }
    if (this.needsEnemy(sk)) {
      let t = p.target;
      const foe = (e) => e && !e.dead && (e.kind === 'monster' || this.pvpFoe(e));
      const range = this.skRange(sk);
      if (!foe(t)) {
        const n = this.nearestEnemy(Math.max(25, range + 5));
        if (!n) { if (!auto) this.ui.toast('No target nearby', 'warn'); return false; }
        this.setTarget(n); t = n;
      }
      this.engage = true;
      if (flat(p.pos, t.pos) - t.radius > range) {
        if (auto) return false; // auto-hit never moves your hero
        this.pendingSkill = sk; p.path = []; return true;
      }
    }
    this.castSkill(sk);
    return true;
  },
  castSkill(sk) {
    const p = this.player, t = p.target;
    if (this.mounted) this.dismount(true);
    p.path = []; this.pendingSkill = null;
    const foe = t && !t.dead && (t.kind === 'monster' || this.pvpFoe(t)) ? t : null;
    if (foe) p.yaw = p.yawT = Math.atan2(foe.pos.x - p.pos.x, foe.pos.z - p.pos.z);
    else if (!sk.basic && ['blast', 'zone', 'line', 'trap'].includes(sk.k)) { const a = this.aimPoint(this.skRange(sk)); p.yaw = p.yawT = Math.atan2(a.x - p.pos.x, a.z - p.pos.z); }
    const ch = this.chargeTime(sk);
    if (ch > 0) {
      if (this.casting) return;
      p.state = this.animFor(sk); p.actDur = p.actT = ch + 0.3;
      this.fx.circle(p.pos, CLASSES[this.S.cls].elemColor, 1.4, ch, p.model);
      this.castBar(sk.name, ch, () => this.releaseSkill(sk, foe && !foe.dead ? foe : null));
      return;
    }
    this.releaseSkill(sk, foe);
  },
  releaseSkill(sk, t) {
    const p = this.player;
    p.mp -= this.mpCost(sk);
    let cdMult = 1;
    if (!sk.basic) {
      this.track('skill');
      if (this.hasFx('set_riptide')) p.mp = Math.min(p.maxMp, p.mp + p.maxMp * 0.03);
      if (this.petIs('bloom')) this.heal(p, p.maxHp * this.petFx.v / 100);
      this.gearOnCast(sk);
      // Elemental Flow: a spell of a different element than the last one comes back 20% sooner
      if (sk.el) {
        if (this.rule('elemFlow') && this.lastEl && this.lastEl !== sk.el) cdMult *= 0.8;
        this.lastEl = sk.el; this.elemHist = [...(this.elemHist || []), sk.el].slice(-3);
      }
      // Spellweave: each skill cuts the next one's cooldown 10%
      if (this.rule('spellweave')) { if (this.weaveNext) cdMult *= 0.9; this.weaveNext = true; }
    }
    this.spendCharge(sk, cdMult);
    const anim = this.animFor(sk);
    const C = CLASSES[this.S.cls];
    p.state = anim; p.actDur = p.actT = sk.basic ? (anim === 'heavy' ? 0.55 : 0.42) : 0.5;
    p.attackCD = (this.cd[sk.id] || 0) - this.time;
    this.lastCombat = this.time;
    if (!sk.basic) { this.sfx.play('cast'); this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 12, color: C.elemColor, speed: 2, life: 0.5, size: 0.5, up: 1 }); }
    const delay = sk.basic ? (anim === 'heavy' ? 0.26 : anim === 'shoot' ? 0.24 : 0.16) : anim === 'shoot' ? 0.26 : 0.2;
    this.after(delay, () => this.applySkill(sk, t));
    // offensive actions end stealth (after the opening hit lands)
    if (sk.k !== 'buff' && sk.k !== 'heal' && sk.k !== 'summon' && sk.k !== 'blink' && this.pflag('stealth')) this.after(delay + 0.05, () => this.endStealth());
    this.ui.refreshSkillCD && this.ui.refreshSkillCD();
  },
  // where an aimed skill lands without a target: the cursor on the ground (desktop) or straight ahead
  aimPoint(range) {
    const p = this.player, a = this.mouseGround;
    if (a && this.time - (this.mouseGroundT || -9) < 3 && flat(a, p.pos) <= range + 0.5 && flat(a, p.pos) > 1) return a.clone();
    const d = Math.min(range, 7);
    const v = new THREE.Vector3(p.pos.x + Math.sin(p.yaw) * d, 0, p.pos.z + Math.cos(p.yaw) * d);
    v.y = this.map.heightAt(v.x, v.z);
    return v;
  },

  // ================================================================ damage hooks (called from game.js damage())
  // the player's outgoing multiplier and crit bonuses against dst
  cbOut(dst, o) {
    const sk = o.sk; let m = 1, crit = 0, cd = 0;
    let add = this.ps('dmg') + this.condV('dmg', dst);
    if (sk && !sk.basic) add += this.ps('skillDmg');
    if (sk && sk.magic) add += this.ps('magicDmg');
    if (this.S.cls === 'ranger') add += this.ps('rangedDmg');
    if (sk && sk.el === 'fire') add += this.ps('fireDmg');
    if (o.dot === 'poison') add += this.ps('poisonDmg');
    if (o.dot === 'burn') add += this.ps('burnDmg');
    if (o.dot === 'burn' && this.S.cls === 'mage') add += this.ps('fireDmg');
    m *= 1 + add / 100;
    m *= this.buffMod(this.player, 'dmg');
    if (dst.kind === 'monster') m *= this.takenMult(dst);
    if (sk && sk.basic && this.rule('manaEdge') && this.player.mp >= this.player.maxMp * 0.01) { m *= 1.2; this.player.mp -= this.player.maxMp * 0.01; }
    crit += this.condV('crit', dst) + (o.critAdd || 0);
    cd += this.condV('critDmg', dst) / 100 + (o.critDmgAdd || 0);
    if (this.pflag('stealth') && !o.proc) {
      if (sk && sk.stealthBonus) m *= 1 + sk.stealthBonus;
      if (this.rule('stealthCrit')) crit += 1000;
    }
    const GO = this.gearOut(dst, o); m *= GO.m; crit += GO.crit; // gear: set powers, awakened skills
    return { m, crit, cd };
  },
  // a hit coming at the player: returns { cancel } or { m }
  cbIn(src, o) {
    const p = this.player;
    if (o.fixed != null && !o.pvp) return { m: 1 };
    const head = p.pos.clone().setY(p.pos.y + p.height);
    if (this.pflag('invuln')) { this.fx.text(head, 'Immune', 'miss'); return { cancel: true }; }
    if (this.rolling && this.time - this.rolling.t0 < ROLL.dur - 0.08) {
      const perfect = this.time - this.rolling.t0 < ROLL.perfect + (this.rule('ghostStep') ? 0.1 : 0);
      this.fx.text(head, perfect ? 'Perfect dodge!' : 'Dodge', perfect ? 'crit' : 'miss');
      if (perfect) this.onPerfectDodge(src); else this.gainMastery('defense', 3, src);
      return { cancel: true };
    }
    // parry (Blade Ward): the hit is turned aside and answered
    const parry = this.pflag('parry');
    if (parry && src && src.kind === 'monster') {
      this.dropFlag('parry');
      this.fx.text(head, 'Parry!', 'crit'); this.sfx.play('crit'); this.fx.slash(p.pos, p.yaw, 0x5ad8ff, 2.2, 0.3);
      this.after(0.08, () => { if (!src.dead) this.hitEnemy(src, SKILL_BY_ID.sp_ward, parry * this.rm(SKILL_BY_ID.sp_ward)); });
      this.gainMastery('defense', 5, src);
      return { cancel: true };
    }
    if (src && src.kind === 'monster' && Math.random() * 100 < this.ps('dodge')) { this.fx.text(head, 'Dodge', 'miss'); this.gainMastery('defense', 1, src); return { cancel: true }; }
    let m = this.buffMod(p, 'dmgTaken');
    const front = src && this.inFront(src);
    if (front && this.pflag('blockFront')) { this.fx.text(head, 'Blocked', 'miss'); this.fx.ring(p.pos, 0xd9a441, 1.6, 0.25); this.gainMastery('defense', 1.5, src); return { cancel: true }; }
    if (src && front && this.blocking) {
      const perfect = this.time - this.blocking.t0 < 0.25;
      this.player.sta = Math.max(0, (this.player.sta ?? 100) - 12);
      this.fx.text(head, perfect ? 'Perfect block!' : 'Block', perfect ? 'crit' : 'miss'); this.sfx.play('hit');
      this.gainMastery('defense', perfect ? 6 : 2, src);
      if (perfect) return { cancel: true };
      m *= 0.3;
    } else if (src && Math.random() * 100 < this.ps('block') + this.setBlock()) {
      this.fx.text(head, 'Block', 'miss'); m *= 0.3; this.gainMastery('defense', 1, src);
      if (this.hasFx('set_ironbound6')) this.after(0.05, () => { if (src && !src.dead) this.damage(p, src, 0, { fixed: (o.raw || 1) * 0.2, proc: true, cls: 'pet' }); });
    }
    if (this.pflag('lifeLink')) m *= (this.summons || []).some((s) => !s.dead) || this.pet || this.partyNear?.() ? 0.75 : 0.9;
    if (this.rule('guardianAngel')) m *= 1 - (this.pAgg.ruleV.guardianAngel || 8) / 200;
    return { m };
  },
  setBlock() { return this.hasFx('set_ironbound4') ? 10 : 0; },
  inFront(src) {
    const p = this.player, dx = src.pos.x - p.pos.x, dz = src.pos.z - p.pos.z, L = Math.hypot(dx, dz) || 1;
    return (Math.sin(p.yaw) * dx + Math.cos(p.yaw) * dz) / L > 0.2;
  },
  // after the player took dmg from src (dmg already subtracted)
  cbHurt(src, dmg) {
    const p = this.player, A = this.pAgg;
    if (!A || dmg <= 0) return;
    this.gearHurt(src, dmg);
    if (A.onHurt.atkStack) this.stackBuff('painfeeder', A.onHurt.atkStack, 'heart');
    if (A.onHurt.reflectM && src && src.kind === 'monster' && !src.dead && (this.procCD.storm || 0) <= this.time) {
      this.procCD.storm = this.time + 0.4;
      this.fx.bolt(p.pos.clone().setY(p.pos.y + 1.4), src.pos.clone().setY(src.pos.y + src.height * 0.6), 0xb8a8ff);
      this.after(0.05, () => { if (!src.dead) this.damage(p, src, A.onHurt.reflectM, { proc: true, canCrit: false }); });
    }
    const refl = this.pflag('reflect');
    if (refl && src && src.kind === 'monster' && !src.dead) this.after(0.05, () => { if (!src.dead) this.damage(p, src, 0, { fixed: dmg * refl / 100, proc: true, cls: 'pet' }); });
    if (this.rule('feral') && src && src.kind === 'monster') for (const s of this.summons || []) if (s.unit === 'companion' && !s.dead) { src.target = s; src.tauntT = this.time + 2; src.tauntBy = s; }
    const W = A.wind;
    if (W && p.hp > 0 && p.hp < p.maxHp * W.below / 100 && (this.procCD.wind || 0) <= this.time) {
      this.procCD.wind = this.time + W.cd; this.heal(p, p.maxHp * W.heal / 100);
      this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.4), 'Second Wind', 'heal'); this.fx.heal(p);
    }
  },
  // Mana Shield: part of each hit comes out of mana instead of HP
  manaShield(dmg) {
    if (!this.rule('manaShield')) return dmg;
    const p = this.player, part = Math.min(p.mp, dmg * 0.1);
    p.mp -= part; return dmg - part;
  },
  stackBuff(id, [pct, max, dur], icon) {
    const p = this.player;
    let b = p.buffs.find((x) => x.id === id);
    if (!b) { b = { id, icon, stacks: 0, mods: { atk: 1 } }; p.buffs.push(b); }
    b.stacks = Math.min(max, b.stacks + 1); b.mods.atk = 1 + pct / 100 * b.stacks; b.until = this.time + dur;
  },
  // passives and buffs that react to the player's own direct hit
  cbOnHit(dst, dmg, crit, sk) {
    const p = this.player, A = this.pAgg; if (!A || dst.dead && !dmg) return;
    this.gearOnHit(dst, sk);
    const H = A.onHit;
    if (H.stunChance && dst.kind === 'monster' && !dst.dead && Math.random() * 100 < H.stunChance) this.st(dst, 'stun', 1);
    if (H.burnOnCrit && crit && dst.kind === 'monster' && !dst.dead) this.st(dst, 'burn', [0.3, 3]);
    if (H.manaOnCrit && crit && (this.procCD.surge || 0) <= this.time) { this.procCD.surge = this.time + 0.5; p.mp = Math.min(p.maxMp, p.mp + p.maxMp * H.manaOnCrit / 100); }
    if (H.healAllies && (this.procCD.rising || 0) <= this.time) { this.procCD.rising = this.time + 0.6; this.healParty(H.healAllies / 100, 18, true); }
    if (H.everyNth) { this.nthHits = (this.nthHits || 0) + 1; if (this.nthHits % H.everyNth[0] === 0) p.mp = Math.min(p.maxMp, p.mp + p.maxMp * H.everyNth[1] / 100); }
    if (this.pflag('toxicEdge') && dst.kind === 'monster' && !dst.dead) this.st(dst, 'poison', 1);
    if (this.pflag('undying') && dmg > 0) this.heal(p, dmg);
    if (this.pflag('packHunt') && dst.kind === 'monster') for (const s of this.summons || []) if (s.unit === 'companion' && !s.dead) this.after(0.15, () => { if (!dst.dead) this.summonStrike(s, dst, 0.5); });
    if (sk && sk.basic && this.pflag('spellBlade') && dst.kind === 'monster' && !dst.dead) {
      const hand = p.pos.clone().setY(p.pos.y + 1.3);
      this.fx.projectile(hand, dst, { color: 0xff7a3a, size: 0.32, speed: 28, onHit: () => this.damage(p, dst, this.pflag('spellBlade') * this.rm(SKILL_BY_ID.sp_spellblade), { proc: true, sk: SKILL_BY_ID.sp_spellblade }) });
    }
    if (this.S.cls === 'spellblade' && crit && sk && sk.runes && this.rule('runeLord')) this.addRunes(1);
    if (dst.kind === 'monster' && dst.linkT > this.time && dmg > 0 && !this.linkBusy) {
      this.linkBusy = true;
      for (const m of this.monsters) if (m !== dst && !m.dead && m.linkT > this.time) this.damage(p, m, 0, { fixed: dmg * 0.25, proc: true, cls: 'pet' });
      this.linkBusy = false;
    }
    const ls = Math.min(30, this.stat('lifesteal') + (this.petIs('vampire') ? this.petFx.v : 0) + this.ps('lifesteal'));
    if (ls > 0) p.hp = Math.min(p.maxHp, p.hp + dmg * ls / 100);
    if (this.inRage() && Math.random() < 0.2) this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 6, color: 0xff3a2a, speed: 2, life: 0.5, size: 0.5, up: 1.5 });
  },
  cbOnKill(m) {
    const A = this.pAgg; if (!A) return;
    for (const k of A.onKill) {
      if (k.heal) this.heal(this.player, this.player.maxHp * k.heal / 100);
      if (k.atkStack) this.stackBuff('conqueror', k.atkStack, 'crown');
      if (k.reset) { this.cd[k.reset] = 0; delete this.chg[k.reset]; }
      if (k.spread) this.spreadOnDeath(m, k.spread);
    }
  },
  // can the player be kept alive at 1 HP right now?
  cbCannotDie() {
    if (this.pflag('cannotDie')) { this.player.hp = 1; this.fx.text(this.player.pos.clone().setY(this.player.pos.y + this.player.height + 0.4), 'Undying!', 'crit'); return true; }
    return false;
  },
  // Fortress Stance and Battle Hardened on defense / attack
  defStanceMult() { const f = this.pflag('fortress'); return f && !this.player.moving ? 1 + f * this.rm(SKILL_BY_ID.gd_fortress) : 1; },

  // ================================================================ class resources
  runeCap() { return this.rule('runeCap7') ? 7 : this.rule('runeCap5') ? 5 : 3; },
  addRunes(n) {
    if (this.S.cls !== 'spellblade') return;
    const before = this.runes;
    this.runes = Math.min(this.runeCap(), this.runes + n); this.runeT = this.time;
    if (this.runes > before) this.fx.emit(this.player.pos.clone().setY(this.player.pos.y + 1.6), { count: 8, color: 0x5ad8ff, speed: 1.5, life: 0.6, size: 0.5, up: 1 });
  },
  spendRunes() { const n = this.runes; this.runes = 0; return n; },
  endStealth() {
    if (!this.pflag('stealth')) return;
    this.dropFlag('stealth'); this.ghost(this.player.model, false);
  },
  // the hero turns see-through while in stealth (materials swapped for faded copies)
  ghost(model, on, color = null, opacity = 0.32) {
    const cache = this.ghostMats || (this.ghostMats = new Map());
    model.traverse((o) => {
      if (!o.isMesh || o.userData.isOutline) return;
      if (on) {
        if (o.userData.realMat) return;
        o.userData.realMat = o.material;
        const key = o.material.uuid + '|' + color + '|' + opacity;
        let g = cache.get(key);
        if (!g) { g = o.material.clone(); g.transparent = true; g.opacity = opacity; g.depthWrite = false; if (color != null && g.color) { g.color.lerp(new THREE.Color(color), 0.55); if (g.emissive) g.emissive.set(color).multiplyScalar(0.25); } cache.set(key, g); }
        o.material = g;
      } else if (o.userData.realMat) { o.material = o.userData.realMat; delete o.userData.realMat; }
    });
  },

  // ================================================================ action combat: dodge roll and block
  roll() {
    const p = this.player;
    if (p.dead || p.stun > 0 || this.rolling || this.casting) return;
    this.noteInput && this.noteInput('r');
    if ((p.sta ?? 100) < ROLL.cost) { this.ui.toast('Too tired to roll', 'warn'); return; }
    if (this.mounted) this.dismount(true);
    p.sta = (p.sta ?? 100) - ROLL.cost;
    let dx = 0, dz = 0;
    if (this.keys.w || this.keys.a || this.keys.s || this.keys.d || this.stick.x || this.stick.y) {
      let kx = 0, kz = 0;
      if (this.keys.w) kz -= 1; if (this.keys.s) kz += 1; if (this.keys.a) kx -= 1; if (this.keys.d) kx += 1;
      if (this.stick.x || this.stick.y) { kx = this.stick.x; kz = this.stick.y; }
      const y = this.cam.yaw, fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
      dx = fx * -kz + rx * kx; dz = fz * -kz + rz * kx;
    } else { dx = Math.sin(p.yaw); dz = Math.cos(p.yaw); }
    const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    p.path = []; this.pendingSkill = null;
    p.yaw = p.yawT = Math.atan2(dx, dz);
    this.rolling = { t0: this.time, dx, dz, done: 0, dist: this.rollDistance(ROLL.dist) };
    p.state = 'roll'; p.actDur = p.actT = ROLL.dur;
    this.sfx.play('swish');
    this.fx.emit(p.pos.clone().setY(p.pos.y + 0.3), { count: 10, color: 0xd8c8a8, speed: 2, life: 0.4, size: 0.5 });
  },
  updateRoll(dt) {
    const p = this.player, R = this.rolling;
    p.sta = Math.min(100, (p.sta ?? 100) + 22 * (1 + this.ps('stamina') / 100) * this.buffMod(p, 'staRegen') * dt * (this.rolling || this.blocking ? 0.3 : 1));
    if (this.blocking && (!this.blockHold || p.dead || (p.sta ?? 0) <= 0)) { this.blocking = null; }
    if (this.blocking) { p.state = 'block'; p.actT = Math.max(p.actT, 0.05); }
    if (!R) return false;
    const k = Math.min(1, (this.time - R.t0) / ROLL.dur);
    const want = (R.dist || ROLL.dist) * Math.sin(k * Math.PI / 2), step = want - R.done;
    if (step > 0) {
      const nx = p.pos.x + R.dx * step, nz = p.pos.z + R.dz * step;
      if (!this.map.isBlocked(nx, nz)) { p.pos.x = nx; p.pos.z = nz; }
      R.done = want;
    }
    p.state = 'roll'; p.actT = Math.max(0.01, ROLL.dur - (this.time - R.t0));
    if (k >= 1) { this.rolling = null; p.state = 'idle'; p.actT = 0; }
    return true;
  },
  startBlock() {
    const p = this.player;
    if (this.S.cls !== 'knight' || p.dead || this.rolling || this.blocking) return;
    this.blocking = { t0: this.time };
  },
  onPerfectDodge(src) {
    const p = this.player;
    // a perfect dodge is worth three normal ones
    this.gainMastery('defense', 9, src);
    this.fx.ring(p.pos, 0xffffff, 2.2, 0.3); this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 20, colors: [0xffffff, 0xb07aff], speed: 3, life: 0.4, size: 0.45 });
    this.sfx.play('crit');
    if (this.hasFx('set_shadowstep4')) { const ids = (this.S.loadout || []).filter((id) => id && (this.cd[id] || 0) > this.time); if (ids.length) this.cd[ids[0]] -= 3; }
    if (this.hasFx('set_shadowstep6')) this.perfectNext = this.time + 4;
  },

  // ================================================================ auto-hit (open world only, never moves you)
  autoAllowed() { return !this.dg && !this.war && !this.trial; },
  autoBattle() {
    const p = this.player;
    if (!this.autoAllowed()) { this.auto = false; this.ui.setAutoBattle(false); return; }
    const reach = (e, r) => flat(p.pos, e.pos) - e.radius <= r;
    let t = p.target;
    const basic = this.basicSkill(), range = this.skRange(basic);
    if (!t || t.dead || t.kind !== 'monster' || !reach(t, range + 0.5)) {
      t = this.nearestEnemy(range + 1.5);
      if (t && reach(t, range + 0.5)) this.setTarget(t); else return;
    }
    this.engage = true;
    if (p.actT > 0 || this.casting) return;
    for (let i = 1; i <= 6; i++) {
      const sk = this.skillList()[i];
      if (!sk || ['dash', 'leap', 'blink'].includes(sk.k) || sk.charge) continue;
      if (sk.k === 'heal' && p.hp > p.maxHp * 0.6) continue;
      if (sk.k === 'buff' && p.buffs.some((b) => b.id === sk.id)) continue;
      if (sk.k === 'summon' && sk.unit === 'companion' && (this.summons || []).some((s) => s.unit === 'companion' && !s.dead)) continue;
      if (this.trySkill(sk, true)) return;
    }
  },
};

export function installCombat(Game) { Object.assign(Game.prototype, CB); }
export { ROLL };
