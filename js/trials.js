// Breakthrough trials: a solo instance at every 20-level wall (and the Final Ascension at 200) that tests one mechanic
// with normalized stats, so gear and Battle Rating do not matter. A Trial Sigil, crafted at the Trial Warden from that
// bracket's materials, opens one attempt; failing keeps your XP and mastery but uses the sigil. A clear grants a title,
// an aura other players see, 3 skill points, and lets the waiting level-up through.
// Also here: cooking at campfires (the only healing in the Hunger trial) and the server's first-clear board.
import * as THREE from 'three';
import { Dungeon } from './dungeon.js';
import { TRIALS, SIGILS, trialLabel, COOKING, CAMPFIRES } from './data-trials.js';
import { CLASSES, SKILL_BY_ID } from './data-classes.js';
import { ITEMS, TITLES } from './data.js';
import { heroLook } from './models.js';
import { cleanApp } from './models-hero.js';
import { mp } from './mp.js';
import { live } from './live.js';
import { toon, glow, glowTexture, ringTexture } from './toon.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rnd = (a, b) => a + Math.random() * (b - a);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const mmss = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

const ORIGIN = { x: 7000, z: 0 };
// arena size and theme per trial kind (the theme falls back to the trial's own)
const MAPS = {
  duel: { w: 40, d: 40 }, twins: { w: 46, d: 46 }, mirror: { w: 40, d: 40 }, storm: { w: 50, d: 50 }, gauntlet: { w: 48, d: 48 },
  silent: { w: 44, d: 44 }, final: { w: 54, d: 54 }, road: { w: 150, d: 150, theme: 'marsh' }, maze: { w: 90, d: 90, theme: 'shadow' }, hunger: { w: 80, d: 80, theme: 'frost' },
};
const HUNGER_DRAIN = 100 / 240; // the stomach empties in 4 minutes
const MAZE_N = 8, MAZE_CELL = 11, MAZE_SHIFT = 75;
const SOUND_CAPTION = { rumble: 'a deep rumble', chime: 'a high chime', hiss: 'a sharp hiss' };

// ---------------------------------------------------------------- attack patterns
// A step draws a telegraph (unless the fight is silent) and lands after `tele` seconds on whatever stands inside it.
// Shapes: circle {at: self|target|front, r, off}, cone {r, ang}, line {len, w}, ring {r0, r1}, multi {n, r, spread},
// safe {n, r} (everything outside the green spots is hit). pct = share of your max HP the hit takes.
const PAT = {
  swing: { name: 'Sweeping Cut', dur: 1.3, steps: [{ t: 0, tele: 0.9, s: 'cone', r: 4.4, ang: 2.1, pct: 0.16 }] },
  overhead: { name: 'Crushing Overhead', dur: 1.9, steps: [{ t: 0, tele: 1.4, s: 'circle', at: 'front', off: 2.4, r: 2.8, pct: 0.34, big: true }] },
  thrust: { name: 'Lunge', dur: 1.5, steps: [{ t: 0, tele: 1.0, s: 'line', len: 10, w: 2.2, pct: 0.24, lunge: true }] },
  combo: { name: 'Twin Cuts', dur: 2.1, steps: [{ t: 0, tele: 0.8, s: 'cone', r: 4.2, ang: 1.8, pct: 0.12 }, { t: 0.95, tele: 0.7, s: 'cone', r: 4.2, ang: 1.8, pct: 0.12 }] },
  whirl: { name: 'Whirlwind', dur: 1.7, steps: [{ t: 0, tele: 1.2, s: 'circle', at: 'self', r: 5.5, pct: 0.3, big: true }] },
  moonArc: { name: 'Moon Arc', dur: 1.4, steps: [{ t: 0, tele: 1.0, s: 'line', len: 18, w: 2.4, pct: 0.18, color: 0x7ab8ff }] },
  crescent: { name: 'Crescent Ring', dur: 1.8, steps: [{ t: 0, tele: 1.3, s: 'ring', at: 'target', r0: 2.2, r1: 6.5, pct: 0.22, color: 0x7ab8ff }] },
  fury: { name: 'Rising Fury', dur: 3.0, channel: true, steps: [{ t: 0, tele: 2.6, s: 'circle', at: 'self', r: 8, pct: 0.55, big: true, color: 0xffb02a }] },
  bolts: { name: 'Lightning Call', dur: 1.9, steps: [{ t: 0, tele: 1.3, s: 'multi', n: 4, r: 3, spread: 6, pct: 0.2, fx: 'bolt' }] },
  chain: { name: 'Chain Bolt', dur: 1.3, steps: [{ t: 0, tele: 0.9, s: 'line', len: 22, w: 2, pct: 0.2, fx: 'bolt' }] },
  gale: { name: 'Gale Sweep', dur: 2.6, steps: [{ t: 0, tele: 1.1, s: 'cone', r: 13, ang: 1.7, pct: 0.22 }, { t: 1.2, tele: 1.0, s: 'cone', r: 13, ang: 1.7, pct: 0.22, turn: Math.PI }] },
  eye: { name: 'Eye of the Storm', dur: 2.2, steps: [{ t: 0, tele: 1.6, s: 'ring', at: 'self', r0: 3.6, r1: 16, pct: 0.3, big: true }] },
  tempest: { name: 'Tempest', dur: 2.8, steps: [{ t: 0, tele: 2.2, s: 'safe', n: 3, r: 3.2, pct: 0.45, big: true }] },
  graveSlam: { name: 'Grave Slam', dur: 2.1, steps: [{ t: 0, tele: 1.6, s: 'circle', at: 'self', r: 6.5, pct: 0.32, cue: 'rumble', big: true }] },
  soulLance: { name: 'Soul Lance', dur: 1.8, steps: [{ t: 0, tele: 1.3, s: 'line', len: 18, w: 2.4, pct: 0.28, cue: 'chime' }] },
  venom: { name: 'Creeping Venom', dur: 2.0, steps: [{ t: 0, tele: 1.5, s: 'circle', at: 'target', r: 3.4, pct: 0.26, cue: 'hiss' }] },
};
const POOLS = {
  duel: [['swing', 3], ['overhead', 2], ['thrust', 2], ['combo', 2]],
  duelHard: [['swing', 2], ['overhead', 2], ['thrust', 2], ['combo', 2], ['whirl', 2]],
  sol: [['swing', 3], ['combo', 2], ['thrust', 2], ['whirl', 1]],
  luna: [['moonArc', 3], ['crescent', 2], ['swing', 1]],
  storm1: [['bolts', 3], ['chain', 2]],
  storm2: [['gale', 2], ['eye', 2], ['chain', 1]],
  storm3: [['tempest', 2], ['bolts', 2], ['eye', 1]],
  silent: [['graveSlam', 1], ['soulLance', 1], ['venom', 1]],
};
const weighted = (pool) => { const tot = pool.reduce((a, [, w]) => a + w, 0); let r = Math.random() * tot; for (const [k, w] of pool) { r -= w; if (r <= 0) return k; } return pool[0][0]; };

// your own skills as the Mirror uses them: the telegraph shape follows the skill kind
function mirrorPattern(sk) {
  const k = sk.kind || sk.k, name = sk.name;
  const base = { name, dur: 1.6, skill: sk.id };
  if (['strike', 'chain', 'multi', 'target'].includes(k)) return { ...base, steps: [{ t: 0, tele: 0.8, s: 'cone', r: 4.4, ang: 1.6, pct: 0.18 }] };
  if (['proj', 'line'].includes(k)) return { ...base, steps: [{ t: 0, tele: 0.9, s: 'line', len: 16, w: 2.2, pct: 0.2 }] };
  if (k === 'cone') return { ...base, steps: [{ t: 0, tele: 1.0, s: 'cone', r: 7.5, ang: 1.3, pct: 0.22 }] };
  if (['nova', 'channel', 'taunt'].includes(k)) return { ...base, steps: [{ t: 0, tele: 1.1, s: 'circle', at: 'self', r: 5.5, pct: 0.24 }] };
  if (['blast', 'zone', 'trap', 'summon', 'debuff', 'special'].includes(k)) return { ...base, steps: [{ t: 0, tele: 1.1, s: 'circle', at: 'target', r: 3.4, pct: 0.24 }] };
  if (['dash', 'leap', 'blink'].includes(k)) return { ...base, steps: [{ t: 0, tele: 0.9, s: 'line', len: 11, w: 2.4, pct: 0.2, lunge: true }] };
  if (['buff', 'heal'].includes(k)) return { ...base, dur: 1, self: k };
  return { ...base, steps: [{ t: 0, tele: 1.0, s: 'circle', at: 'front', off: 2.2, r: 3, pct: 0.2 }] };
}

// looks for the human trial foes
const FOE_LOOK = {
  warden: () => heroLook('knight', cleanApp({ race: 'draken', body: 'a', skin: '#8f96a8', hair: '#2a2a34', eye: '#ffb030', face: 'square', scar: 'eye' }), { cape: 0x8a6a2a, outfit: { main: 0x6a7080, accent: 0xe8c070, trim: 0xffd84a, skirt: 0x3a3a48 }, scale: 1.25 }),
  sol: () => heroLook('spellblade', cleanApp({ race: 'human', body: 'a', skin: '#dba07c', hair: '#ff5a3a', eye: '#ffb030' }), { outfit: { main: 0xc83a2a, accent: 0xffd84a, trim: 0xffe07a, skirt: 0x7a1a14 }, scale: 1.1 }),
  luna: () => heroLook('assassin', cleanApp({ race: 'sylvan', body: 'b', skin: '#d2dcf0', hair: '#8ac8ff', eye: '#9ae8ff', tattoo: 'dots', tattooColor: '#9ae8ff' }), { outfit: { main: 0x2a4a9a, accent: 0x9ae8ff, trim: 0xe8f0ff, skirt: 0x1a2a6a }, scale: 1.1 }),
};

const T = {
  // ================================================================ status
  trialDef(n) { return TRIALS.find((t) => t.n === n); },
  trialCleared(n) { return !!this.S.trials?.[n]; },
  // why a trial cannot be attempted now ('' when it can)
  trialBlock(n) {
    const T0 = this.trialDef(n), S = this.S; if (!T0) return 'Unknown trial';
    if (this.trialCleared(n)) return 'Cleared';
    if (S.level < T0.lv) return `Reach Lv ${T0.lv}`;
    const prev = TRIALS.find((t) => t.n < n && !this.trialCleared(t.n));
    if (prev) return `Clear ${trialLabel(prev.n)} first`;
    if (!this.countItem(`sigil_${n}`)) return 'Needs a Trial Sigil';
    return '';
  },
  sigilCost(n) { const s = SIGILS.find((x) => x.n === n); return { gold: s.gold, mats: s.mats }; },
  craftSigil(n) {
    const cost = this.sigilCost(n);
    if (this.trialCleared(n)) { this.ui.toast('You already cleared that trial', 'warn'); return false; }
    if (!this.canAfford(cost)) { this.ui.toast(this.missingText(cost), 'warn'); this.sfx.play('error'); return false; }
    if (!this.countItem(`sigil_${n}`) && this.S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return false; }
    this.pay(cost); this.addItem(`sigil_${n}`, 1);
    this.gainMastery('survival', 8);
    this.sfx.play('upgrade'); this.fx.buff(this.player, '#e8c070');
    this.ui.toast(`Crafted ${ITEMS[`sigil_${n}`].name}`, 'good');
    this.ui.refreshPanel(); this.save();
    return true;
  },

  // ================================================================ entering and leaving
  enterTrial(n) {
    const T0 = this.trialDef(n), p = this.player;
    if (!T0 || this.dg || this.war || this.trial || p.dead) { this.ui.toast('Not available right now', 'warn'); return false; }
    const why = this.trialBlock(n);
    if (why) { this.ui.toast(why, 'warn'); this.sfx.play('error'); return false; }
    this.removeItem(`sigil_${n}`, 1);
    this.S.trialTries = this.S.trialTries || {}; this.S.trialTries[n] = (this.S.trialTries[n] || 0) + 1;
    this.prepareInstance(); this.clearCombatWorld();
    this.ui.fade(() => this.switchToTrial(T0));
    return true;
  },
  switchToTrial(T0) {
    const p = this.player, M = MAPS[T0.kind];
    const def = { id: 'tr' + T0.n, name: T0.n === 10 ? T0.name : `${trialLabel(T0.n)} · ${T0.name}`, theme: M.theme || T0.theme || 'crypt', lv: T0.lv, origin: ORIGIN, rooms: [{ x: 0, z: 0, w: M.w, d: M.d }], plain: ['road', 'maze', 'hunger'].includes(T0.kind) };
    const map = new Dungeon(this.scene, def).build();
    map.zone = { ...map.zone, lv: 'Breakthrough Trial', trial: true };
    if (['road', 'maze'].includes(T0.kind)) map.noMap = true; // no map and no markers: find the way yourself
    this.overworldReturn = { x: p.pos.x, z: p.pos.z, yaw: this.cam.yaw };
    const tr = this.trial = { T: T0, map, t: 0, left: T0.time || 0, done: false, ents: [], mobs: [], tempo: 1, dmgK: 1, food: 100, phase: 0, idx: 0, wave: 0, waveT: 8 };
    this.world.root.visible = false;
    this.applyAmbience(map.ambience);
    this.map = map; p.map = map;
    p.pos.set(map.start.x, 0, map.start.z); p.yaw = p.yawT = Math.PI; this.cam.yaw = 0; this.cam.target.copy(p.pos);
    // pets stay home: only your class and build come along
    if (this.pet) { tr.petId = this.S.activePet; this.pet.model.visible = false; this.pet.map = null; }
    p.buffs = []; this.cd = {}; this.chg = {}; p.shield = 0; this.runes = 0;
    this.recalc(true); // normalized stats (see trialStats)
    p.sta = 100;
    this.zone = map.zone; this.ui.setZone(map.zone);
    this['setup_' + T0.kind](tr);
    this.ui.banner(trialLabel(T0.n).toUpperCase(), T0.name, 'boss');
    this.ui.chat('system', `<b>${esc(trialLabel(T0.n))}: ${esc(T0.name)}</b> · ${esc(T0.challenge)}. Your stats are set to the same values every ${esc(CLASSES[this.S.cls].name)} gets at Lv ${T0.lv}: only your skills and your play count. Auto-hit is off. Out-of-combat healing does not work here.`);
    this.ui.enterTrial();
    this.logEvent && this.logEvent('trial', `Entered ${trialLabel(T0.n)}`);
  },
  // the stats every hero of your class gets in a trial: class base and growth at the trial's level, a fixed gear
  // allowance and your passive skills and race (no gear, pets, sprites or elixirs)
  trialStats(ps) {
    const C = CLASSES[this.S.cls], L = this.trial.T.lv;
    const b = (k) => C.base[k] + (C.grow[k] || 0) * (L - 1);
    return {
      hp: b('hp') * 2.6 * (1 + (ps.hpPct || 0) / 100), mp: b('mp') * 2.2 * (1 + (ps.mpPct || 0) / 100),
      atk: b('atk') * 2.2 * (1 + (ps.atkPct || 0) / 100), def: b('def') * 2 * (1 + (ps.defPct || 0) / 100),
      crit: C.base.crit + 10 + (ps.crit || 0), critDmg: 0.6 + (ps.critDmg || 0) / 100, speed: C.speed * (1 + (ps.speedPct || 0) / 100),
    };
  },
  leaveTrial() {
    const tr = this.trial; if (!tr || tr.leaving) return;
    tr.leaving = true;
    this.clearCombatWorld();
    this.ui.fade(() => {
      const p = this.player;
      for (const m of [...this.monsters]) if (m.map === tr.map) this.removeEnt(m);
      for (const e of tr.ents) { e.np?.remove(); }
      tr.map.dispose();
      this.trial = null; this.map = this.world; p.map = this.world;
      if (this.pet) { this.pet.model.visible = true; this.pet.map = this.world; }
      this.world.root.visible = true; this.applyAmbience(null);
      const r = this.overworldReturn || { x: 0, z: 9 };
      p.pos.set(r.x, this.world.heightAt(r.x, r.z), r.z); this.cam.target.copy(p.pos);
      if (r.yaw !== undefined) { this.cam.yaw = r.yaw; p.yaw = p.yawT = r.yaw; }
      if (this.pet) this.pet.pos.set(r.x - 1.2, p.pos.y, r.z + 1.2);
      p.dead = false; p.state = 'idle'; p.buffs = []; this.cd = {};
      this.recalc(true);
      this.setTarget(null); this.auto = false; this.ui.setAutoBattle(false); p.path = [];
      this.zone = null; this.ui.leaveTrial(); this.save();
    });
  },
  trialPlayerDown() { this.failTrial('You fell.'); },
  failTrial(why) {
    const tr = this.trial; if (!tr || tr.done) return;
    tr.done = 'fail';
    this.sfx.play('error');
    this.ui.chat('system', `<b>${esc(trialLabel(tr.T.n))} failed</b>: ${esc(why)} Your XP and mastery are kept; the sigil is spent. Craft another at the Trial Warden to try again.`);
    this.ui.modal(`${trialLabel(tr.T.n)} failed`, `${why} You keep your XP and mastery; the Trial Sigil is used up. Each attempt teaches the pattern: craft a new sigil and try again.`, [{ label: 'Return to Sylvan Haven', fn: () => this.leaveTrial() }], true);
  },
  clearTrial() {
    const tr = this.trial; if (!tr || tr.done) return;
    tr.done = 'clear';
    const T0 = tr.T, S = this.S, secs = Math.round(tr.t);
    S.trials[T0.n] = { t: Date.now(), secs };
    S.aura = T0.n;
    this.unlockTitle(T0.title);
    const ti = TITLES.indexOf(T0.title); if (ti >= 0 && S.titles.includes(ti)) S.title = ti;
    this.refreshPlayerPlate && this.refreshPlayerPlate();
    this.fx.levelUp(this.player); this.sfx.play('legend');
    this.ui.banner('TRIAL CLEARED', `${trialLabel(T0.n)} · «${T0.title}»`, 'level');
    this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} cleared <b>${esc(trialLabel(T0.n))}: ${esc(T0.name)}</b> in ${mmss(secs)}!`);
    this.logEvent && this.logEvent('trial', `Cleared ${trialLabel(T0.n)} in ${mmss(secs)}`, true);
    this.prestigeClaim('t' + T0.n);
    this.applyAura(this.player, T0.aura);
    this.mpTrackNow && this.mpTrackNow();
    this.syncSkills(true); this.ui.markMenu && this.ui.markMenu('skills');
    this.after(0.4, () => this.gainExp(0)); // the level that waited behind the wall comes through
    this.after(0.8, () => this.sixTrialReward && this.sixTrialReward(T0.n));
    this.ui.modal('Trial cleared!', `You cleared ${trialLabel(T0.n)}: ${T0.name} in ${mmss(secs)}. You earned the title «${T0.title}», an aura every player can see, and 3 skill points.${T0.n < 10 ? ` Levels ${T0.lv + 1}–${T0.lv + 19} are open.` : ' You have reached the summit of Hiraya.'}`, [{ label: 'Return to Sylvan Haven', fn: () => this.leaveTrial() }], true);
    this.save();
  },

  // ================================================================ per frame
  updateTrial(dt) {
    const tr = this.trial; if (!tr) return;
    tr.map.update(dt, this.time);
    if (tr.done) return;
    tr.t += dt;
    if (tr.T.time) {
      tr.left -= dt;
      if (tr.left <= 0) { if (tr.T.kind === 'hunger') this.clearTrial(); else this.failTrial('Time ran out.'); return; }
    }
    const fn = this['tick_' + tr.T.kind]; if (fn) fn.call(this, tr, dt);
    for (const e of tr.ents) if (e.update) e.update(dt, this.time);
  },

  // ================================================================ trial foes
  trialFoe(type, x, z, o = {}) {
    const p = this.player, tr = this.trial, L = tr.T.lv;
    const hits = o.hits ?? 10; // basic-attack-sized hits it takes to bring down
    const st = { level: L, hp: Math.round(p.atk * hits), atk: this.atkForPct(o.pct ?? 0.08, L), def: 0 };
    const m = this.createMonster({ type, x, z, r: 0 }, { map: tr.map, dungeon: true, exact: true, fixed: st, look: o.look });
    m.trialMob = true; m.noLeash = !o.leash; m.tagged = false;
    if (o.ai) { m.trialAI = o.ai; m.patT = o.delay ?? 2.5; m.busyT = 0; }
    if (o.name) { m.labelHtml = `${o.boss === false ? '' : '[Trial] '}${esc(o.name)}`; m.np.querySelector('.n').innerHTML = m.labelHtml; }
    if (o.speed) m.speed = o.speed;
    m.prefR = o.prefR ?? 2.6; m.reach = o.reach ?? 16;
    m.target = p;
    tr.mobs.push(m);
    return m;
  },
  // monster attack that takes about pct of your max HP through your (normalized) defense
  atkForPct(pct, lvl) {
    const p = this.player, K = 50 + 8 * lvl;
    return pct * p.maxHp * (K + this.defOf(p)) / K;
  },
  updateTrialMonster(m, dt) {
    const tr = this.trial, p = this.player, W = m.map;
    let moving = false;
    if (!tr || tr.done || p.dead || m.dormant) { if (m.actT <= 0) m.state = 'idle'; m.moving = false; return; }
    m.busyT = Math.max(0, (m.busyT || 0) - dt);
    m.patT -= dt;
    const d = flat(m.pos, p.pos);
    if (m.busyT <= 0) {
      m.yawT = Math.atan2(p.pos.x - m.pos.x, p.pos.z - m.pos.z);
      const want = m.prefR;
      if (d > want + 0.6) { const r = this.moveEnt(m, p.pos.x, p.pos.z, m.speed, dt); moving = r !== 'blocked'; }
      else if (m.kite && d < want * 0.55) {
        const ax = m.pos.x - p.pos.x, az = m.pos.z - p.pos.z, l = Math.hypot(ax, az) || 1;
        const r = this.moveEnt(m, m.pos.x + ax / l * 5, m.pos.z + az / l * 5, m.speed * 0.8, dt); moving = r !== 'blocked' && r !== true;
      }
      if (m.patT <= 0 && d < m.reach) {
        const pat = this.nextPattern(m);
        if (pat) { this.runPattern(m, pat); m.patT = pat.dur * tr.tempo + (m.gap ?? 0.9) * tr.tempo; } else m.patT = 1;
      }
    }
    if (m.actT <= 0) m.state = 'idle';
    m.moving = moving;
    m.pos.y = W.heightAt(m.pos.x, m.pos.z);
  },
  nextPattern(m) {
    const tr = this.trial, hp = m.hp / m.maxHp;
    switch (m.trialAI) {
      case 'duel': return PAT[weighted(hp < 0.5 ? POOLS.duelHard : POOLS.duel)];
      case 'twin': {
        if (tr.active !== m && !tr.alone) return null; // waiting its turn
        if (!m.furyDone && hp < 0.7) { m.furyDone = true; return PAT.fury; }
        return PAT[weighted(m.twin === 'sol' ? POOLS.sol : POOLS.luna)];
      }
      case 'mirror': {
        const list = m.mirrorPats; if (!list?.length) return PAT.swing;
        m.mirrorI = ((m.mirrorI ?? -1) + 1) % list.length;
        return Math.random() < 0.35 ? list[0] : list[m.mirrorI];
      }
      case 'storm': return PAT[weighted(hp > 0.66 ? POOLS.storm1 : hp > 0.33 ? POOLS.storm2 : POOLS.storm3)];
      case 'silent': return PAT[weighted(POOLS.silent)];
      case 'final': {
        const ph = hp > 0.8 ? 0 : hp > 0.6 ? 1 : hp > 0.4 ? 2 : hp > 0.2 ? 3 : 4;
        if (ph !== tr.phase) this.finalPhase(m, ph);
        return PAT[weighted([POOLS.duelHard, POOLS.storm1, POOLS.storm2, POOLS.silent, POOLS.storm3][ph])];
      }
      default: return PAT.swing;
    }
  },
  // run one attack pattern: telegraphs, then hits; a stun or interrupt on the caster cancels what has not landed
  runPattern(m, pat) {
    const tr = this.trial, p = this.player, seq0 = m.castSeq || 0;
    m.busyT = pat.dur * tr.tempo;
    if (pat.self) { this.mirrorSelf(m, pat); return; }
    if (!tr.silent) this.trialSay(m, pat.name, pat.channel ? 'crit' : 'dmg');
    if (pat.channel) this.ui.toast(`${m.def0.name.split(',')[0]} channels ${pat.name}: interrupt it (stun, knock-up, silence) or get far away!`, 'warn');
    for (const st of pat.steps) this.after(st.t * tr.tempo, () => {
      if (!this.trial || tr.done || m.dead || (m.castSeq || 0) !== seq0 || m.stun > 0) return;
      if (st.turn == null) m.yaw = m.yawT = Math.atan2(p.pos.x - m.pos.x, p.pos.z - m.pos.z);
      else m.yaw = m.yawT = m.yaw + st.turn;
      const shapes = this.shapesFor(m, st), tele = st.tele * tr.tempo;
      if (st.cue) this.trialCue(st.cue);
      for (const sh of shapes) this.drawTele(sh, tele, st.color);
      m.state = pat.channel ? 'cast' : 'attack'; m.actT = m.actDur = tele + 0.25;
      this.after(tele, () => {
        if (!this.trial || tr.done || m.dead || (m.castSeq || 0) !== seq0 || m.stun > 0) { if (pat.channel && !m.dead && this.trial) this.trialSay(m, 'Interrupted!', 'crit'); return; }
        this.landFx(shapes, st);
        if (!p.dead && shapes.some((sh) => this.inShape(sh, p.pos))) this.damage(m, p, 0, { pct: st.pct * tr.dmgK, canCrit: false });
        if (st.lunge) { const sh = shapes[0], [x, z] = tr.map.nearestFree(sh.x + Math.sin(sh.yaw) * (sh.len - 1.5), sh.z + Math.cos(sh.yaw) * (sh.len - 1.5)); this.fx.emit(m.pos.clone().setY(1), { count: 18, color: 0xffffff, speed: 3, life: 0.4, size: 0.6 }); m.pos.set(x, 0, z); }
      });
    });
  },
  // where a step lands, fixed at the moment its telegraph appears
  shapesFor(m, st) {
    const p = this.player, yaw = m.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw);
    const at = st.at === 'target' ? { x: p.pos.x, z: p.pos.z } : st.at === 'front' ? { x: m.pos.x + fx * (st.off || 2), z: m.pos.z + fz * (st.off || 2) } : { x: m.pos.x, z: m.pos.z };
    if (st.s === 'multi') {
      const out = [{ s: 'circle', x: p.pos.x, z: p.pos.z, r: st.r }];
      for (let i = 1; i < st.n; i++) { const a = Math.random() * Math.PI * 2, r = rnd(2, st.spread); out.push({ s: 'circle', x: p.pos.x + Math.cos(a) * r, z: p.pos.z + Math.sin(a) * r, r: st.r }); }
      return out;
    }
    if (st.s === 'safe') {
      const c = this.trial.map.rooms[0], spots = [];
      for (let i = 0; i < st.n; i++) { const a = (i / st.n) * Math.PI * 2 + Math.random() * 1.5, r = rnd(5, Math.min(c.w, c.d) * 0.32); spots.push({ x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r, r: st.r }); }
      return [{ s: 'safe', x: c.x, z: c.z, r: Math.max(c.w, c.d) * 0.75, spots }];
    }
    if (st.s === 'cone' || st.s === 'line') return [{ s: st.s, x: m.pos.x, z: m.pos.z, yaw, r: st.r, ang: st.ang, len: st.len, w: st.w }];
    return [{ s: st.s, x: at.x, z: at.z, r: st.r, r0: st.r0, r1: st.r1 }];
  },
  inShape(sh, pos) {
    const dx = pos.x - sh.x, dz = pos.z - sh.z, d = Math.hypot(dx, dz);
    if (sh.s === 'circle') return d <= sh.r + 0.35;
    if (sh.s === 'ring') return d >= sh.r0 - 0.25 && d <= sh.r1 + 0.35;
    if (sh.s === 'safe') return !sh.spots.some((s) => Math.hypot(pos.x - s.x, pos.z - s.z) <= s.r);
    if (sh.s === 'cone') {
      if (d > sh.r + 0.35) return false; if (d < 0.9) return true;
      const da = Math.abs(((Math.atan2(dx, dz) - sh.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      return da <= sh.ang / 2 + 0.08;
    }
    if (sh.s === 'line') {
      const fx = Math.sin(sh.yaw), fz = Math.cos(sh.yaw), t = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      return t >= -0.6 && t <= sh.len + 0.35 && side <= sh.w / 2 + 0.35;
    }
    return false;
  },
  // a ground telegraph that fills up until the hit lands (nothing is drawn in the Silent Keeper's fight)
  drawTele(sh, dur, color = 0xff2a2a) {
    if (this.trial?.silent) return;
    const g = new THREE.Group(), geos = [], mats = [];
    g.position.set(sh.x, this.map.heightAt(sh.x, sh.z) + 0.14, sh.z);
    const mesh = (geo, col, op) => { geos.push(geo); const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide }); mats.push(mat); const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.renderOrder = 3; g.add(m); return m; };
    let fill, edge, grow = 'all';
    if (sh.s === 'circle') { fill = mesh(new THREE.CircleGeometry(sh.r, 40), color, 0.3); edge = mesh(new THREE.RingGeometry(sh.r - 0.14, sh.r, 48), color, 0.85); }
    else if (sh.s === 'ring') { fill = mesh(new THREE.RingGeometry(sh.r0, sh.r1, 48), color, 0.28); edge = mesh(new THREE.RingGeometry(sh.r1 - 0.14, sh.r1, 48), color, 0.85); mesh(new THREE.RingGeometry(sh.r0, sh.r0 + 0.12, 40), 0x5aff8a, 0.9); grow = 'fade'; }
    else if (sh.s === 'cone') {
      g.rotation.y = sh.yaw - Math.PI / 2;
      fill = mesh(new THREE.CircleGeometry(sh.r, 24, -sh.ang / 2, sh.ang), color, 0.3); edge = mesh(new THREE.RingGeometry(sh.r - 0.16, sh.r, 24, 1, -sh.ang / 2, sh.ang), color, 0.85);
    } else if (sh.s === 'line') {
      g.rotation.y = sh.yaw;
      const fg = new THREE.PlaneGeometry(sh.w, sh.len); fg.translate(0, -sh.len / 2, 0);
      const eg = new THREE.PlaneGeometry(sh.w, sh.len); eg.translate(0, -sh.len / 2, 0);
      edge = mesh(eg, color, 0.22); fill = mesh(fg, color, 0.32); grow = 'y';
    } else if (sh.s === 'safe') {
      fill = mesh(new THREE.CircleGeometry(sh.r, 48), color, 0.16); edge = mesh(new THREE.RingGeometry(sh.r - 0.2, sh.r, 48), color, 0.6); grow = 'fade';
      for (const s of sh.spots) { const m = mesh(new THREE.CircleGeometry(s.r, 32), 0x5aff8a, 0.45); m.position.set(s.x - sh.x, 0.02, s.z - sh.z); const e = mesh(new THREE.RingGeometry(s.r - 0.15, s.r, 32), 0xb8ffc8, 0.95); e.position.set(s.x - sh.x, 0.03, s.z - sh.z); }
    }
    this.fx.add(g, dur, (k) => {
      const u = Math.max(0.02, 1 - k);
      if (grow === 'all') fill.scale.setScalar(u); else if (grow === 'y') fill.scale.y = u; else fill.material.opacity = 0.12 + 0.3 * u;
      edge.material.opacity = 0.55 + Math.sin(k * 38) * 0.3;
    }, () => { for (const x of geos) x.dispose(); for (const x of mats) x.dispose(); });
  },
  landFx(shapes, st) {
    const near = true;
    for (const sh of shapes) {
      const c = new THREE.Vector3(sh.x, this.map.heightAt(sh.x, sh.z) + 0.2, sh.z);
      if (st.fx === 'bolt' && sh.s === 'circle') this.fx.bolt(c.clone().setY(c.y + 16), c, 0x9ad8ff, 0.3);
      if (sh.s === 'circle') { this.fx.ring(c, st.color || 0xff6a3a, sh.r, 0.4); this.fx.emit(c, { count: 18, color: st.color || 0xff8a4a, speed: 5, life: 0.5, size: 0.7, up: 3 }); }
      else if (sh.s === 'ring') this.fx.ring(c, st.color || 0xff6a3a, sh.r1, 0.5);
      else if (sh.s === 'cone' || sh.s === 'line') { const L = sh.s === 'cone' ? sh.r * 0.6 : sh.len * 0.5; this.fx.emit(c.clone().add(new THREE.Vector3(Math.sin(sh.yaw) * L, 0.8, Math.cos(sh.yaw) * L)), { count: 22, color: st.color || 0xffb07a, speed: 6, life: 0.4, size: 0.7 }); }
      else if (sh.s === 'safe') { this.fx.shake(0.6); this.fx.ring(c, 0xb8a8ff, sh.r * 0.5, 0.6); }
    }
    if (near) this.sfx.play(st.big ? 'boom' : 'hit');
    if (st.big) this.fx.shake(0.35);
  },
  trialSay(m, text, cls = 'dmg') { this.fx.text(m.pos.clone().setY(m.pos.y + m.height + 0.8), text, cls, 0.9); },
  // the Silent Keeper's only tells: sounds (with optional captions for players who cannot hear them)
  trialCue(cue) {
    this.sfx.play(cue);
    if (this.S.settings.captions) this.ui.toast(`[${SOUND_CAPTION[cue] || cue}]`);
  },

  // ================================================================ Trial I: the Gate Warden
  setup_duel(tr) {
    const c = tr.map.rooms[0];
    tr.boss = this.trialFoe('tr_warden', c.x, c.z - 6, { ai: 'duel', name: 'The Gate Warden', hits: 70, look: FOE_LOOK.warden(), speed: 5, prefR: 2.6, delay: 3 });
    tr.goal = 'Defeat the Gate Warden. Every attack is telegraphed: roll through it (Shift) or block it (Guardians, hold the right mouse button).';
  },
  // ================================================================ Trial II: Lost Road
  setup_road(tr) {
    const map = tr.map, c = map.rooms[0], O = { x: c.x, z: c.z }, rng = mulberry(4040);
    const p = this.player;
    p.pos.set(O.x - 58, 0, O.z + 60); p.yaw = p.yawT = Math.PI; this.cam.target.copy(p.pos);
    tr.shrine = { x: O.x + 56, z: O.z - 58 };
    const keep = [{ x: p.pos.x, z: p.pos.z, r: 9 }, { x: tr.shrine.x, z: tr.shrine.z, r: 9 }];
    const L = {
      pillars: { x: O.x - 56, z: O.z - 6 }, tower: { x: O.x + 34, z: O.z - 12 }, arch: { x: O.x + 47, z: O.z - 42 },
      statue: { x: O.x - 52, z: O.z - 58 }, black: { x: O.x + 30, z: O.z + 42 },
    };
    for (const v of Object.values(L)) keep.push({ x: v.x, z: v.z, r: 7 });
    const lanterns = []; for (let i = 0; i < 7; i++) lanterns.push({ x: O.x - 46 + i * 11.5, z: O.z - 8 }); for (const v of lanterns) keep.push({ ...v, r: 3 });
    const clear = (x, z) => keep.every((k) => Math.hypot(k.x - x, k.z - z) > k.r);
    const root = map.root;
    const add = (geo, mat, x, y, z, sx, sy, sz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; root.add(m); map.track(geo); return m; };
    // rocks and thickets: detours, never walls
    const rock = toon(0x6a7060), bush = toon(0x3a6a34);
    for (let i = 0; i < 70; i++) {
      const x = c.minX + 8 + rng() * (c.w - 16), z = c.minZ + 8 + rng() * (c.d - 16), r = 1.4 + rng() * 2.4;
      if (!clear(x, z)) continue;
      add(new THREE.DodecahedronGeometry(1, 0), rng() < 0.6 ? rock : bush, x, r * 0.45, z, r, r * 0.8, r);
      map.nav.blockCircle(x, z, r * 0.9);
    }
    // landmarks you can see from afar
    const white = toon(0xf0ece0), red = toon(0xc83a2a), stone = toon(0x8a8a90), dark = toon(0x2a2a34);
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.9, 1.1, 16, 10), white, L.pillars.x + s * 2.6, 8, L.pillars.z, 1, 1, 1); map.nav.blockCircle(L.pillars.x + s * 2.6, L.pillars.z, 1.3); }
    for (const v of lanterns) {
      add(new THREE.CylinderGeometry(0.14, 0.18, 4.4, 6), dark, v.x, 2.2, v.z, 1, 1, 1);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), glow(0xff4a2a)); lamp.position.set(v.x, 4.6, v.z); root.add(lamp);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff6a3a, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.set(v.x, 4.6, v.z); sp.scale.setScalar(3); root.add(sp);
      map.nav.blockCircle(v.x, v.z, 0.5);
    }
    add(new THREE.CylinderGeometry(2.2, 3, 20, 9), stone, L.tower.x, 10, L.tower.z, 1, 1, 1); add(new THREE.CylinderGeometry(2.5, 2.2, 2, 9), red, L.tower.x, 20.5, L.tower.z, 1, 1, 1);
    map.nav.blockCircle(L.tower.x, L.tower.z, 3.2);
    for (const s of [-1, 1]) { add(new THREE.BoxGeometry(1.4, 9, 1.4), stone, L.arch.x + s * 3, 4.5, L.arch.z, 1, 1, 1); map.nav.blockCircle(L.arch.x + s * 3, L.arch.z, 1.1); }
    add(new THREE.BoxGeometry(8, 1.2, 1.6), stone, L.arch.x, 9.4, L.arch.z, 1, 1, 1);
    add(new THREE.CylinderGeometry(1, 1.4, 5, 8), stone, L.statue.x, 2.5, L.statue.z, 1, 1, 1); add(new THREE.SphereGeometry(1.2, 10, 8), stone, L.statue.x, 5.9, L.statue.z, 1, 1, 1); map.nav.blockCircle(L.statue.x, L.statue.z, 1.6);
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.9, 1.1, 14, 8), dark, L.black.x + s * 2.6, 7, L.black.z, 1, 1, 1); map.nav.blockCircle(L.black.x + s * 2.6, L.black.z, 1.3); }
    // the shrine
    const sh = new THREE.Group(); sh.position.set(tr.shrine.x, 0, tr.shrine.z); root.add(sh);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 0.6, 12), toon(0xe8e0c8)); base.position.y = 0.3; sh.add(base);
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.1, 0), glow(0x8affb8)); crystal.position.y = 2.6; sh.add(crystal);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x8affb8, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.y = 2.6; halo.scale.setScalar(6); sh.add(halo);
    tr.ents.push({ update: (dt, t) => { crystal.rotation.y = t * 1.4; crystal.position.y = 2.6 + Math.sin(t * 2) * 0.25; } });
    // the valley's creatures
    for (let i = 0; i < 16; i++) {
      const x = c.minX + 12 + rng() * (c.w - 24), z = c.minZ + 12 + rng() * (c.d - 24);
      if (!clear(x, z) || map.isBlocked(x, z) || Math.hypot(x - p.pos.x, z - p.pos.z) < 22) continue;
      const m = this.trialFoe(i % 3 ? 'tr_bog' : 'tr_snap', x, z, { hits: 9, pct: 0.07, name: i % 3 ? 'Valley Croaker' : 'Valley Snapper', boss: false, leash: true });
      m.target = null; m.home = { x, z };
    }
    tr.directions = 'Walk north from where you stand until you reach the Twin White Pillars. There, turn east and follow the line of red lanterns. At the Broken Tower with the red crown, bear north-east to the Drowned Arch; the shrine lies just beyond it. The grey statue in the north-west is no shrine, and black pillars mark a dead end.';
    tr.goal = 'Reach the shrine across the valley. There is no map and no marker: follow the directions in your journal.';
    this.after(1.5, () => this.ui.modal('Directions', `${tr.directions} (Your compass points north. Read this again from the trial tracker.)`, [{ label: 'Set off' }]));
  },
  tick_road(tr) {
    if (flat(this.player.pos, tr.shrine) < 4) this.clearTrial();
  },
  // ================================================================ Trial III: Twin Blades
  setup_twins(tr) {
    const c = tr.map.rooms[0];
    const sol = this.trialFoe('tr_sol', c.x - 5, c.z - 8, { ai: 'twin', name: 'Sol, the Red Blade', hits: 55, look: FOE_LOOK.sol(), speed: 6, prefR: 2.6, delay: 2.5 });
    const luna = this.trialFoe('tr_luna', c.x + 5, c.z - 8, { ai: 'twin', name: 'Luna, the Blue Blade', hits: 50, look: FOE_LOOK.luna(), speed: 6.2, prefR: 9, delay: 3 });
    sol.twin = 'sol'; luna.twin = 'luna'; luna.kite = true;
    tr.twins = [sol, luna]; tr.active = sol; tr.swapT = 7;
    this.twinMark();
    tr.goal = 'Defeat both twins. They take turns: the one on guard takes 75% less damage, so switch to whoever is attacking. Interrupt Rising Fury.';
  },
  tick_twins(tr, dt) {
    if (tr.alone) return;
    tr.swapT -= dt;
    if (tr.swapT <= 0) {
      tr.swapT = 7; tr.active = tr.twins.find((m) => m !== tr.active && !m.dead) || tr.active;
      this.twinMark();
      this.ui.toast(`${tr.active.def0.name.split(',')[0]} steps forward!`, 'warn'); this.sfx.play('swish');
    }
  },
  twinMark() {
    const tr = this.trial;
    for (const m of tr.twins) {
      const on = m === tr.active || tr.alone;
      m.guard = !on;
      m.np?.classList.toggle('dim', !on);
      if (!on) this.fx.ring(m.pos, m.twin === 'sol' ? 0xff7a5a : 0x7ab8ff, 2.4, 0.5);
    }
  },
  // ================================================================ Trial IV: Hunger
  setup_hunger(tr) {
    const map = tr.map, c = map.rooms[0], rng = mulberry(8080);
    tr.noPotions = true;
    const fire = this.makeCampfire(map, c.x, c.z);
    tr.ents.push(fire);
    const kinds = [['crop_strawberry', 'Wild Berries', 0xd83a5a, 2], ['crop_wheat', 'Wild Wheat', 0xe8c860, 2], ['crop_carrot', 'Wild Carrots', 0xff8a2a, 2], ['herb_silverleaf', 'Silverleaf', 0xb8d8e8, 1]];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + rng() * 0.4, r = 12 + rng() * (Math.min(c.w, c.d) * 0.5 - 18);
      const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
      if (map.isBlocked(x, z)) continue;
      tr.ents.push(this.makeForage(map, x, z, kinds[i % kinds.length]));
    }
    tr.goal = 'Survive 20 minutes. No potions and no resting: hunt for Raw Meat, forage, and cook at the campfire to heal and stay fed.';
    this.ui.chat('system', 'Your stomach will empty as time passes: an empty stomach costs HP. Cooked food heals over time and fills you up. Wolves drop Raw Meat.');
  },
  tick_hunger(tr, dt) {
    const p = this.player, c = tr.map.rooms[0];
    tr.food = Math.max(0, tr.food - HUNGER_DRAIN * dt);
    if (tr.food <= 0 && !p.dead) { p.hp -= p.maxHp * 0.012 * dt; if (p.hp <= 0) { p.hp = 0; this.playerDied({ name: 'Hunger' }); return; } }
    tr.waveT -= dt;
    if (tr.waveT <= 0) {
      tr.wave++; tr.waveT = 50;
      const n = 2 + Math.floor(tr.t / 240), yeti = tr.wave % 5 === 0;
      for (let i = 0; i < n + (yeti ? 1 : 0); i++) {
        const a = Math.random() * Math.PI * 2, r = Math.min(c.w, c.d) * 0.45;
        const [x, z] = tr.map.nearestFree(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r);
        const big = yeti && i === n;
        this.trialFoe(big ? 'tr_hyeti' : 'tr_hwolf', x, z, { hits: big ? 30 : 7, pct: big ? 0.12 : 0.06, name: big ? 'Ravenous Yeti' : 'Starving Wolf', boss: false, speed: big ? 4.6 : 6 });
      }
      this.ui.toast(yeti ? 'A ravenous yeti joins the hunt!' : 'Starving wolves close in...', 'warn');
    }
  },
  // ================================================================ Trial V: the Mirror
  setup_mirror(tr) {
    const c = tr.map.rooms[0], S = this.S;
    const m = this.trialFoe('tr_mirror', c.x, c.z - 7, { ai: 'mirror', name: `${S.name}'s Reflection`, hits: 75, look: heroLook(S.cls, S.app || {}, {}), speed: CLASSES[S.cls].speed * 0.95, prefR: CLASSES[S.cls].ranged ? 9 : 2.6, delay: 2 });
    m.kite = !!CLASSES[S.cls].ranged;
    const sk = [this.basicSkill(), ...(S.loadout || []).map((id) => SKILL_BY_ID[id]).filter(Boolean)];
    m.mirrorPats = sk.map(mirrorPattern);
    if (S.ult && SKILL_BY_ID[S.ult]) m.mirrorPats.push({ ...mirrorPattern({ ...SKILL_BY_ID[S.ult], kind: 'nova' }), steps: [{ t: 0, tele: 1.6, s: 'circle', at: 'self', r: 7, pct: 0.4, big: true }] });
    this.ghost && this.ghost(m.model, true, '#9ae8ff', 0.75);
    tr.boss = m;
    tr.goal = 'Defeat your Reflection. It fights with your class, your loadout and your stats.';
  },
  mirrorSelf(m, pat) {
    if (pat.self === 'heal') { m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.06); this.trialSay(m, `${pat.name} +6%`, 'heal'); this.fx.heal(m); }
    else { m.atkBuffT = this.time + 6; this.trialSay(m, pat.name, 'crit'); this.fx.buff(m, '#ffd36b'); }
  },
  // ================================================================ Trial VI: Ashen Labyrinth
  setup_maze(tr) {
    const map = tr.map, c = map.rooms[0], p = this.player;
    tr.maze = { x0: c.x - (MAZE_N * MAZE_CELL) / 2, z0: c.z - (MAZE_N * MAZE_CELL) / 2, walls: null, mesh: null, seed: 1 + ((Math.random() * 1e6) | 0), shiftT: MAZE_SHIFT };
    const cellC = (i, j) => ({ x: tr.maze.x0 + (i + 0.5) * MAZE_CELL, z: tr.maze.z0 + (j + 0.5) * MAZE_CELL });
    tr.maze.cellC = cellC;
    const st = cellC(0, MAZE_N - 1); p.pos.set(st.x, 0, st.z); this.cam.target.copy(p.pos);
    this.buildMaze(tr, true);
    // the hidden exit: the cell farthest from the start, marked only by a faint rune you see up close
    const ex = cellC(MAZE_N - 1 - ((Math.random() * 2) | 0), (Math.random() * 2) | 0);
    tr.exit = ex;
    const tex = ringTexture('#ffe8a0', 0.7), mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
    const rune = new THREE.Mesh(new THREE.CircleGeometry(2.4, 32), mat); rune.rotation.x = -Math.PI / 2; rune.position.set(ex.x, 0.06, ex.z); map.root.add(rune); map.track(rune.geometry); map.track(mat);
    tr.ents.push({ update: (dt, t) => { const d = flat(p.pos, ex); mat.opacity = d < 8 ? (1 - d / 8) * (0.55 + Math.sin(t * 3) * 0.2) : 0; rune.rotation.z = t * 0.5; } });
    // fire vents
    tr.vents = [];
    for (let k = 0; k < 10; k++) {
      const i = (Math.random() * MAZE_N) | 0, j = (Math.random() * MAZE_N) | 0;
      if ((i === 0 && j === MAZE_N - 1) || flat(cellC(i, j), ex) < 4) continue;
      tr.vents.push({ ...cellC(i, j), t: rnd(2, 6) });
    }
    for (let k = 0; k < 5; k++) {
      const i = 2 + ((Math.random() * (MAZE_N - 2)) | 0), j = (Math.random() * (MAZE_N - 2)) | 0, q = cellC(i, j);
      const m = this.trialFoe('tr_ash', q.x, q.z, { hits: 12, pct: 0.08, name: 'Ash Wraith', boss: false, leash: true });
      m.target = null;
    }
    tr.goal = 'Find the hidden exit. The walls shift every so often; fire vents flare before they burst. The exit is marked only by a faint rune.';
  },
  tick_maze(tr, dt) {
    const p = this.player, M = tr.maze;
    if (flat(p.pos, tr.exit) < 2.4) { this.clearTrial(); return; }
    M.shiftT -= dt;
    if (M.shiftT <= 0) { M.shiftT = MAZE_SHIFT; M.seed++; this.buildMaze(tr, false); this.fx.shake(0.5); this.sfx.play('boom'); this.ui.toast('The walls grind and shift!', 'warn'); }
    for (const v of tr.vents) {
      v.t -= dt;
      if (v.t <= 0) {
        v.t = rnd(4, 7);
        const sh = { s: 'circle', x: v.x, z: v.z, r: 2.4 };
        this.drawTele(sh, 0.9, 0xff7a2a);
        this.after(0.9, () => {
          if (!this.trial || tr.done) return;
          const c = new THREE.Vector3(v.x, 0.2, v.z);
          this.fx.pillar(c, 0xff6a2a, 1.4, 6, 0.5); this.fx.emit(c, { count: 20, colors: [0xff6a2a, 0xffd04a], speed: 4, life: 0.6, size: 0.8, up: 5 });
          if (this.inShape(sh, p.pos) && !p.dead) this.damage({ name: 'Fire Vent', kind: 'trap', atk: 0, buffs: [], level: tr.T.lv, pos: c, def0: { name: 'Fire Vent' } }, p, 0, { pct: 0.15, canCrit: false });
        });
      }
    }
  },
  // a perfect maze (every cell reachable) from the seed; walls stand between cells
  buildMaze(tr, first) {
    const M = tr.maze, map = tr.map, N = MAZE_N, C = MAZE_CELL, rng = mulberry(M.seed);
    // walls[k]: east walls (i,j) for i<N-1 and south walls (i,j) for j<N-1
    const east = Array.from({ length: N }, () => Array(N).fill(true)), south = Array.from({ length: N }, () => Array(N).fill(true));
    const seen = Array.from({ length: N }, () => Array(N).fill(false)), stack = [[0, N - 1]]; seen[0][N - 1] = true;
    while (stack.length) {
      const [i, j] = stack[stack.length - 1];
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([di, dj]) => [i + di, j + dj, di, dj]).filter(([a, b]) => a >= 0 && b >= 0 && a < N && b < N && !seen[a][b]);
      if (!nb.length) { stack.pop(); continue; }
      const [a, b, di, dj] = nb[(rng() * nb.length) | 0];
      if (di === 1) east[i][j] = false; else if (di === -1) east[a][b] = false; else if (dj === 1) south[i][j] = false; else south[a][b] = false;
      seen[a][b] = true; stack.push([a, b]);
    }
    // a few extra openings so it is a labyrinth, not a single corridor
    for (let k = 0; k < N; k++) { const i = (rng() * (N - 1)) | 0, j = (rng() * N) | 0; if (rng() < 0.5) east[i][j] = false; else south[j % N][Math.min(N - 2, i)] = false; }
    const rects = [];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      if (i < N - 1 && east[i][j]) rects.push({ x: M.x0 + (i + 1) * C, z: M.z0 + (j + 0.5) * C, w: 1.2, d: C + 1.2 });
      if (j < N - 1 && south[i][j]) rects.push({ x: M.x0 + (i + 0.5) * C, z: M.z0 + (j + 1) * C, w: C + 1.2, d: 1.2 });
    }
    // clear the old walls from the nav grid, then block the new ones
    const nav = map.nav;
    if (M.walls) for (const r of M.walls) nav.setRect(r.x, r.z, r.w, r.d, 0, 0, 0.4);
    for (const r of rects) nav.setRect(r.x, r.z, r.w, r.d, 0, 1, 0.4);
    M.walls = rects;
    if (M.mesh) { map.root.remove(M.mesh); M.mesh.dispose(); }
    const geo = map.track(new THREE.BoxGeometry(1, 1, 1)), mat = map.track(toon(0x8a8478));
    const im = new THREE.InstancedMesh(geo, mat, rects.length), m4 = new THREE.Matrix4();
    rects.forEach((r, k) => { m4.compose(new THREE.Vector3(r.x, 2.2, r.z), new THREE.Quaternion(), new THREE.Vector3(r.w, 4.4, r.d)); im.setMatrixAt(k, m4); });
    im.castShadow = true; map.root.add(im); M.mesh = im;
    // anyone caught inside a new wall is pushed into the nearest open cell
    const p = this.player;
    if (!first && map.isBlocked(p.pos.x, p.pos.z)) { const [x, z] = map.nearestFree(p.pos.x, p.pos.z); p.pos.set(x, 0, z); p.path = []; }
    for (const m of this.trial.mobs) if (!m.dead && map.isBlocked(m.pos.x, m.pos.z)) { const [x, z] = map.nearestFree(m.pos.x, m.pos.z); m.pos.set(x, 0, z); }
  },
  // ================================================================ Trial VII: Stormcaller
  setup_storm(tr) {
    const c = tr.map.rooms[0];
    tr.boss = this.trialFoe('tr_storm', c.x, c.z - 6, { ai: 'storm', name: 'The Stormcaller', hits: 130, speed: 3.6, prefR: 8, reach: 30, delay: 3 });
    tr.boss.kite = true; tr.boss.gap = 0.7;
    tr.goal = 'Defeat the Stormcaller. Its storm changes at two-thirds and one-third health: read each new pattern.';
  },
  tick_storm(tr) {
    const b = tr.boss; if (!b || b.dead) return;
    const ph = b.hp > b.maxHp * 0.66 ? 0 : b.hp > b.maxHp * 0.33 ? 1 : 2;
    if (ph !== tr.phase) { tr.phase = ph; tr.tempo = [1, 0.92, 0.85][ph]; this.ui.banner('THE STORM CHANGES', ['', 'Gale and the Eye', 'Tempest: find the green'][ph], 'boss'); this.sfx.play('boom'); }
  },
  // ================================================================ Trial VIII: Gauntlet
  setup_gauntlet(tr) {
    tr.order = ['tr_g1', 'tr_g2', 'tr_g3', 'tr_g4', 'tr_g5'];
    tr.goal = 'Defeat five bosses back to back. Nothing heals you between them, so spend potions and cooldowns wisely.';
    this.after(2.5, () => this.gauntletNext(tr));
  },
  gauntletNext(tr) {
    if (!tr || tr !== this.trial || tr.done || tr.idx >= tr.order.length) return;
    const c = tr.map.rooms[0], type = tr.order[tr.idx];
    const m = this.trialFoe(type, c.x, c.z - 8, { hits: 55 + tr.idx * 6, pct: 0.09, name: null });
    m.labelHtml = `[Trial] ${esc(m.def0.name)}`; m.np.querySelector('.n').innerHTML = m.labelHtml;
    m.skillT = 4;
    this.fx.spawnPuff(m.pos, 0xff5a3a); this.fx.pillar(m.pos, 0xff5a3a, 2, 10, 0.8);
    this.ui.banner(`BOSS ${tr.idx + 1} / 5`, m.def0.name.replace(/^Gauntlet [IVX]+ · /, ''), 'boss');
  },
  // ================================================================ Trial IX: the Silent Keeper
  setup_silent(tr) {
    const c = tr.map.rooms[0];
    tr.silent = true;
    tr.boss = this.trialFoe('tr_silent', c.x, c.z - 7, { ai: 'silent', name: 'The Silent Keeper', hits: 110, speed: 4.4, prefR: 3.4, delay: 3.5 });
    tr.goal = 'Defeat the Silent Keeper. It shows nothing: listen. A rumble means get away from it, a chime means step aside from its line, a hiss means move from where you stand.';
    this.ui.chat('system', 'Sound matters here. <b>Rumble</b>: get away from the Keeper. <b>Chime</b>: sidestep its lance. <b>Hiss</b>: move off the spot you stand on. (Settings → Sound captions shows them as text.)');
    this.after(1.5, () => { this.sfx.play('rumble'); this.after(1.3, () => this.sfx.play('chime')); this.after(2.6, () => this.sfx.play('hiss')); });
  },
  // ================================================================ Final Ascension
  setup_final(tr) {
    const c = tr.map.rooms[0];
    tr.boss = this.trialFoe('tr_ascendant', c.x, c.z - 8, { ai: 'final', name: 'The Ascendant', hits: 240, speed: 5, prefR: 3.4, reach: 30, delay: 3 });
    tr.goal = 'Defeat the Ascendant. Every trial you have passed returns: telegraphs, twins, the storm, your reflection, silence and hunger.';
  },
  finalPhase(m, ph) {
    const tr = this.trial, c = tr.map.rooms[0], S = this.S;
    tr.phase = ph;
    const names = ['', 'The Twins return', 'The storm and your reflection', 'Silence', 'Hunger: your potions are sealed'];
    this.ui.banner('FINAL ASCENSION', names[ph], 'boss'); this.sfx.play('boom');
    tr.silent = ph === 3;
    if (ph === 1) {
      const sol = this.trialFoe('tr_sol', c.x - 9, c.z, { ai: 'twin', name: 'Echo of Sol', hits: 22, look: FOE_LOOK.sol(), speed: 6, delay: 2 });
      const luna = this.trialFoe('tr_luna', c.x + 9, c.z, { ai: 'twin', name: 'Echo of Luna', hits: 20, look: FOE_LOOK.luna(), speed: 6, prefR: 9, delay: 3 });
      sol.twin = 'sol'; luna.twin = 'luna'; luna.kite = true; sol.furyDone = luna.furyDone = true;
      tr.twins = [sol, luna]; tr.active = sol; tr.swapT = 6;
    }
    if (ph === 2) {
      const r = this.trialFoe('tr_mirror', c.x, c.z + 8, { ai: 'mirror', name: 'Your Reflection', hits: 28, look: heroLook(S.cls, S.app || {}, {}), speed: CLASSES[S.cls].speed * 0.9, prefR: CLASSES[S.cls].ranged ? 9 : 2.6 });
      r.mirrorPats = [this.basicSkill(), ...(S.loadout || []).map((id) => SKILL_BY_ID[id]).filter(Boolean)].map(mirrorPattern);
      this.ghost && this.ghost(r.model, true, '#9ae8ff', 0.75);
    }
    if (ph === 4) { tr.noPotions = true; tr.tempo = 0.85; }
  },
  tick_final(tr, dt) {
    if (tr.twins && !tr.alone) {
      tr.swapT -= dt;
      if (tr.swapT <= 0) { tr.swapT = 6; tr.active = tr.twins.find((m) => m !== tr.active && !m.dead) || tr.active; this.twinMark(); }
    }
  },

  // ================================================================ kills inside a trial
  onTrialKill(m) {
    const tr = this.trial; if (!tr || tr.done) return;
    const k = tr.T.kind;
    if (k === 'hunger') { this.addMat('raw_meat', m.def0.elite ? 3 : 1, true); this.lootMsg && this.lootMsg(`Raw Meat x${m.def0.elite ? 3 : 1}`, '#ffffff'); }
    if (tr.twins?.includes(m)) {
      const other = tr.twins.find((x) => x !== m && !x.dead);
      if (other) { tr.alone = true; tr.active = other; tr.tempo = 0.8; this.twinMark(); this.ui.toast(`${other.def0.name.split(',')[0]} is enraged!`, 'warn'); }
      else if (k === 'twins') { this.clearTrial(); return; }
    }
    if (k === 'gauntlet') {
      tr.idx++;
      if (tr.idx >= tr.order.length) { this.clearTrial(); return; }
      this.ui.toast(`Boss ${tr.idx} down. The next one comes...`, 'good');
      this.after(3, () => this.gauntletNext(tr));
      return;
    }
    if (m === tr.boss) this.clearTrial();
  },

  // ================================================================ campfires and cooking
  makeCampfire(W, x, z) {
    const g = new THREE.Group(); g.position.set(x, W.heightAt(x, z), z);
    const wood = toon(0x5a3a24);
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 6), wood); l.rotation.set(Math.PI / 2, i * 0.8, 0); l.position.y = 0.15; g.add(l); }
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), toon(0x8a8478)); const a = i / 8 * Math.PI * 2; s.position.set(Math.cos(a) * 0.8, 0.1, Math.sin(a) * 0.8); g.add(s); }
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 8), glow(0xffa040)); f1.position.y = 0.6; g.add(f1);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 8), glow(0xffe07a)); f2.position.y = 0.5; g.add(f2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa040, blending: THREE.AdditiveBlending, depthWrite: false })); sp.position.y = 0.8; sp.scale.setScalar(4); sp.raycast = () => {}; g.add(sp);
    (W.root || this.scene).add(g);
    W.blockCircle ? W.blockCircle(x, z, 0.8) : W.nav?.blockCircle(x, z, 0.8);
    const e = { kind: 'campfire', model: g, pos: g.position, height: 1.4, radius: 1.2, map: W, dead: false, name: 'Campfire' };
    e.update = (dt, t) => { const k = 1 + Math.sin(t * 9) * 0.08 + Math.sin(t * 5.3) * 0.06; f1.scale.set(1, k, 1); f2.scale.set(1, 2 - k, 1); };
    this.nameplate(e, '<div class="t">&lt;Cook here&gt;</div><div class="n">Campfire</div>', 'npc node');
    e.npY = 1.9;
    return e;
  },
  makeForage(W, x, z, [mat, name, color, qty]) {
    const g = new THREE.Group(); g.position.set(x, W.heightAt(x, z), z);
    const bush = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), toon(0x3a7a3a)); bush.scale.set(1, 0.7, 1); bush.position.y = 0.5; g.add(bush);
    const fruit = new THREE.Group(); g.add(fruit);
    for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), toon(color)); const a = i / 6 * Math.PI * 2; b.position.set(Math.cos(a) * 0.6, 0.6 + (i % 2) * 0.25, Math.sin(a) * 0.6); fruit.add(b); }
    (W.root || this.scene).add(g);
    const e = { kind: 'forage', model: g, pos: g.position, height: 1.2, radius: 1, map: W, dead: false, name, mat, qty, ready: true, respawnAt: 0 };
    e.update = () => { if (!e.ready && this.time >= e.respawnAt) { e.ready = true; fruit.visible = true; e.np.classList.remove('dim'); } };
    e.fruit = fruit;
    this.nameplate(e, `<div class="t">&lt;Forage&gt;</div><div class="n">${esc(name)}</div>`, 'npc node');
    e.npY = 1.6;
    return e;
  },
  forage(e) {
    if (!e.ready) { this.ui.toast('Nothing left here yet', 'warn'); return; }
    e.ready = false; e.respawnAt = this.time + 60; e.fruit.visible = false; e.np.classList.add('dim');
    this.addMat(e.mat, e.qty, true); this.sfx.play('rustle');
    this.lootMsg && this.lootMsg(`${e.name} x${e.qty}`, '#ffffff');
    this.gainMastery('survival', 2);
  },
  // the open world's campfires: the two in town (built here) and the outpost camps (built by the world)
  initCampfires() {
    this.campfireEnts = CAMPFIRES.map((c) => this.makeCampfire(this.world, c.x, c.z));
    for (const [x, , z] of this.world.campfires || []) {
      const e = { kind: 'campfire', model: new THREE.Group(), pos: new THREE.Vector3(x, this.world.heightAt(x, z), z), height: 1.4, radius: 1.2, map: this.world, dead: false, name: 'Campfire' };
      e.model.position.copy(e.pos); this.world.root.add(e.model);
      this.nameplate(e, '<div class="t">&lt;Cook here&gt;</div><div class="n">Campfire</div>', 'npc node'); e.npY = 1.9;
      this.campfireEnts.push(e);
    }
    this.lifeEnts = this.lifeEnts || [];
    this.lifeEnts.push(...this.campfireEnts);
  },
  nearCampfire(r = 4.5) {
    const p = this.player, list = this.trial ? this.trial.ents.filter((e) => e.kind === 'campfire') : this.campfireEnts || [];
    return list.some((e) => (e.map || this.world) === this.map && flat(e.pos, p.pos) < r);
  },
  openCooking() {
    if (!this.nearCampfire()) { this.ui.toast('Cook at a campfire (there is one in the town square)', 'warn'); return; }
    this.ui.togglePanel('cooking', true);
  },
  cook(id, n = 1) {
    const r = COOKING.find((x) => x.id === id); if (!r) return 0;
    if (!this.nearCampfire()) { this.ui.toast('Move closer to the campfire', 'warn'); return 0; }
    let made = 0;
    for (let i = 0; i < n; i++) {
      const cost = { mats: r.ins };
      if (!this.canAfford(cost)) break;
      if (!this.bagRoomFor(r.out)) { this.ui.toast('Bag is full!', 'warn'); break; }
      this.pay(cost); this.addItem(r.out, 1); made++;
      this.gainMastery('survival', 3 + r.tier);
    }
    if (!made) { this.ui.toast(this.missingText({ mats: r.ins }), 'warn'); this.sfx.play('error'); return 0; }
    this.sfx.play('sizzle'); this.fx.emit(this.player.pos.clone().setY(1.2), { count: 14, colors: [0xffa040, 0xffffff], speed: 1.4, life: 0.8, size: 0.5, up: 2 });
    this.ui.toast(`Cooked ${ITEMS[r.out].name}${made > 1 ? ` x${made}` : ''}`, 'good');
    this.track && this.track('craft');
    this.ui.refreshPanel(); this.save();
    return made;
  },
  eatFood(id) {
    const it = ITEMS[id], p = this.player; if (!it || it.type !== 'food' || p.dead) return false;
    if (this.foodCD > this.time) { this.ui.toast('Still eating...', 'warn'); return false; }
    this.foodCD = this.time + 1.5;
    this.removeItem(id, 1);
    const [pct, secs] = it.heal;
    this.addHot(p, pct / secs * this.healMod, secs, id);
    if (it.buff) { p.buffs = p.buffs.filter((b) => b.id !== 'food'); p.buffs.push({ id: 'food', icon: id, until: this.time + 120, mods: { ...(it.buff.atk ? { atk: it.buff.atk } : {}), ...(it.buff.def ? { def: it.buff.def } : {}), ...(it.buff.stamina ? { staRegen: it.buff.stamina } : {}) } }); }
    if (this.trial) this.trial.food = Math.min(100, this.trial.food + 30 + it.quality * 12);
    this.sfx.play('heal'); this.fx.heal(p);
    this.ui.refreshPanel(); return true;
  },

  // ================================================================ auras (visible to every player)
  // a ring of light at the feet of everyone who cleared a trial (the latest one, or the one chosen in the Hero panel)
  applyAura(e, color) {
    if (e.aura) { e.model.remove(e.aura); e.aura.userData.dispose(); e.aura = null; }
    if (!color) return;
    const g = new THREE.Group(), tex = ringTexture(color, 0.7);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 });
    const ring = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), mat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
    const smat = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.35 });
    const sp = new THREE.Sprite(smat); sp.position.y = 1.1; sp.scale.set(2.4, 3.2, 1); g.add(sp);
    g.userData.update = (t) => { ring.rotation.z = t * 0.8; mat.opacity = 0.6 + Math.sin(t * 2.4) * 0.2; smat.opacity = 0.22 + Math.sin(t * 1.7) * 0.08; };
    g.userData.dispose = () => { ring.geometry.dispose(); mat.dispose(); tex.dispose && tex.dispose(); smat.dispose(); };
    e.model.add(g); e.aura = g;
  },
  myAuraColor() { const n = this.S.aura; return n && this.trialCleared(n) ? this.trialDef(n)?.aura : null; },
  setAura(n) { this.S.aura = n; this.applyAura(this.player, this.myAuraColor()); this.mpTrackNow && this.mpTrackNow(); this.ui.refreshPanel(); this.save(); },
  animateAuras() {
    const t = this.time;
    if (this.player.aura) this.player.aura.userData.update(t);
    if (this.player.gearGlow) this.player.gearGlow.userData.update(t);
    for (const e of this.rplayers || []) { if (e.aura) e.aura.userData.update(t); if (e.gearGlow) e.gearGlow.userData.update(t); }
  },

  // ================================================================ first clears (prestige board)
  // Kept per server: first clears seen from everyone online (their presence carries their clear times), plus the
  // shared database when the game runs inside its claude.ai page.
  prestigeKey() { return 'aetherheim_prestige_' + (mp.server || 'S1'); },
  prestigeInit() {
    try { this.prestige = JSON.parse(localStorage.getItem(this.prestigeKey()) || '{}') || {}; } catch { this.prestige = {}; }
    for (const [n, r] of Object.entries(this.S.trials || {})) if (r && !r.legacy && r.t) this.prestigeNote('t' + n, this.S.name, r.t, true);
    if (live.db) {
      try { live.db.collection('prestige').onSnapshot((q) => { for (const d of q.docs) { const v = d.data(); if (v && v.name && v.t) this.prestigeNote(d.id, String(v.name).slice(0, 16), +v.t); } }, () => {}); } catch { /* no shared board */ }
    }
  },
  prestigeNote(key, name, t, quiet = false) {
    if (!/^(t\d{1,2}|a[a-z0-9_]{1,30})$/.test(key) || !Number.isFinite(t)) return;
    const cur = this.prestige[key];
    if (cur && cur.t <= t) return;
    this.prestige[key] = { name, t };
    try { localStorage.setItem(this.prestigeKey(), JSON.stringify(this.prestige)); } catch { /* storage unavailable */ }
    if (!quiet && this.ui.panelName === 'prestige') this.ui.refreshPanel();
  },
  prestigeClaim(key) {
    const t = Date.now(), first = !this.prestige[key];
    this.prestigeNote(key, this.S.name, t);
    if (first) this.ui.chat('announce', `<b>[Hall of Firsts]</b> ${esc(this.S.name)} is the first on this server to ${key[0] === 't' ? `clear ${esc(trialLabel(+key.slice(1)))}` : 'own this Ancient item'}!`);
    if (live.db) {
      try { const ref = live.db.doc(`prestige/${key}`); ref.get().then((s) => { if (!s.exists) ref.set({ name: this.S.name, t }); }).catch(() => {}); } catch { /* no shared board */ }
    }
  },
  // presence info: our own first-clear times, so others can fill their boards
  prestigeInfo() {
    const out = {};
    for (const [n, r] of Object.entries(this.S.trials || {})) if (r && !r.legacy && r.t) out['t' + n] = r.t;
    for (const [k, t] of Object.entries(this.S.ancientFirst || {})) out[k] = t;
    return out;
  },
  prestigeFromPeer(info) { for (const [k, t] of Object.entries(info.pr || {})) this.prestigeNote(k, info.name, t, true); },
};

export function installTrials(Game) { Object.assign(Game.prototype, T); }
