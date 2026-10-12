// Earned levels: the XP curve, diminishing returns per monster type, the level-gap penalty, discovery XP, the soul
// marker left on death, the three masteries (Weapon, Defense, Survival), the trial walls every 20 levels, rested XP, the mentor bonus, the seasonal catch-up, Battle Rating and the explored-map grid.
import * as THREE from 'three';
import { CLASSES, RACES } from './data-classes.js';
import { glowTexture } from './toon.js';

export const MAX_LV = 200;
// XP to reach the next level from level L
export const xpNext = (L) => Math.floor(500 * Math.pow(Math.max(1, L), 2.2));
// the old curve: monster and quest XP were tuned to it, so they are scaled to keep the same share of a level
const oldNeed = (L) => Math.floor(70 * Math.pow(L, 1.6) + 30);
export const expScale = (L) => xpNext(Math.max(1, L)) / oldNeed(Math.max(1, L));
// the mastery rank a hero from before masteries starts at (1-19: 10, 20-39: 30 ...)
export const minMastery = (L) => Math.min(190, 10 + 20 * Math.floor(Math.max(1, L) / 20));
// a breakthrough trial at the end of each 20-level bracket blocks further levels until it is cleared
export const TRIAL_WALLS = [20, 40, 60, 80, 100, 120, 140, 160, 180];
export const MASTERY_MAX = 200;
// points per rank; the first ranks come quickly so new heroes learn what each mastery asks for
export const masteryNeed = (r) => Math.max(1, Math.round((3 + 0.9 * Math.pow(r, 1.5)) * Math.min(1, 0.25 + r / 16)));
export const MASTERY = {
  weapon: { name: 'Weapon', how: 'Landing hits and skills with your weapon', tip: 'Fight enemies within 5 levels of you' },
  defense: { name: 'Defense', how: 'Successful blocks, dodges and parries', tip: 'Roll through attacks (Shift), block (hold the right mouse button) or parry' },
  survival: { name: 'Survival', how: 'Exploring, gathering, crafting and cooking', tip: 'Explore new ground, gather, craft and cook' },
};
// level-gap penalty: monsters below your level give less XP
export function gapMult(me, mon) { const d = me - mon; return d <= 2 ? 1 : d <= 5 ? 0.6 : d <= 9 ? 0.2 : 0; }
// discovery XP (first time only), as a share of the current level's requirement
export const DISCOVERY = { zone: 0.02, hidden: 0.08, lore: 0.03, elite: 0.1, waystone: 0.05 };
// the explored-map grid: 16 m cells over the 800 x 800 m world
export const FOG = { size: 800, cell: 16, n: 50 };
// tier multipliers used by Battle Rating
const TIER_MULT = [1.0, 1.2, 1.5, 1.9, 2.4, 3.0, 3.8, 5.0];

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

const P = {
  // ================================================================ save
  initProgress() {
    const S = this.S;
    if (!S.mastery) {
      // heroes from before masteries start at the minimum of their bracket, so nobody is stuck on their next level-up
      const start = S.level > 1 ? minMastery(S.level) : 1;
      const w = CLASSES[S.cls].wkey;
      S.mastery = { weapon: { [w]: { r: start, p: 0 } }, defense: { r: start, p: 0 }, survival: { r: start, p: 0 } };
    }
    S.dr = S.dr || {}; S.disc = S.disc || { zones: [], elites: [], hidden: [], lore: [], waystones: [] };
    for (const k of ['zones', 'elites', 'hidden', 'lore', 'waystones']) S.disc[k] = S.disc[k] || [];
    if (!S.trials) {
      // heroes past a wall before trials existed keep those levels: the walls behind them count as passed
      S.trials = {};
      for (const w of TRIAL_WALLS) if (S.level > w) S.trials[w / 20] = { legacy: true, t: Date.now() };
    }
    if (S.rested == null) S.rested = 0;
    // rested XP: each hour away banks 1% of a level, up to half a level
    const now = Date.now();
    if (S.lastSeen) { const hrs = Math.max(0, (now - S.lastSeen) / 3600000); if (hrs >= 1) S.rested = Math.min(xpNext(S.level) * 0.5, S.rested + xpNext(S.level) * 0.01 * Math.floor(hrs)); }
    S.lastSeen = now;
    if (!S.fog) S.fog = '';
    this.fogBits = decodeFog(S.fog);
    this.soulEnt = null;
  },

  // ================================================================ masteries
  masteryRec(type) {
    const M = this.S.mastery;
    if (type === 'weapon') { const w = CLASSES[this.S.cls].wkey; return (M.weapon[w] = M.weapon[w] || { r: 1, p: 0 }); }
    return M[type];
  },
  masteryLv(type) { return this.masteryRec(type)?.r || 1; },
  // points from doing the activity; against enemies they only count within 5 levels of you (not for low zones)
  gainMastery(type, pts, enemy = null) {
    const S = this.S;
    if (!S.mastery || pts <= 0) return;
    if (enemy && enemy.kind === 'monster') {
      const lv = enemy.level || 1;
      if (lv < S.level - 5 && !this.mentorActive()) return;
      pts *= 1 + lv / 20;
      if (this.auto && !this.dg && !this.trial) pts *= 0.5; // auto-hit gives half
    } else if (enemy) return; // other players (PvP) do not train masteries
    else pts *= 1 + S.level / 20; // gathering, crafting, exploring: higher-level work is worth more
    if (type === 'survival') pts *= 1 + (RACES[S.app?.race]?.mods.survival || 0);
    pts *= 1 + (this.stat ? this.stat('masteryPct') : 0) / 100;
    const m = this.masteryRec(type);
    if (m.r >= MASTERY_MAX) return;
    m.p += pts;
    let up = false;
    while (m.r < MASTERY_MAX && m.p >= masteryNeed(m.r)) { m.p -= masteryNeed(m.r); m.r++; up = true; }
    if (up) {
      const p = this.player;
      this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.9), `${MASTERY[type].name} mastery ${m.r}`, 'exp');
      if (m.r % 10 === 0) this.ui.chat('system', `<b>${MASTERY[type].name} mastery</b> reached rank ${m.r}.`);
      this.recalc();
      this.ui.refreshPanel && this.ui.refreshPanel();
    }
  },
  // the reason the next level is blocked (an uncleared trial wall), or null; masteries never hold a level back
  levelBlock(L = this.S.level) {
    if (L >= MAX_LV) return null;
    if (TRIAL_WALLS.includes(L) && !this.S.trials?.[L / 20]) return { trial: L / 20 };
    return null;
  },
  blockText(b) {
    if (!b) return '';
    return `Clear Trial ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][b.trial]} to pass Lv ${b.trial * 20}`;
  },
  trialsCleared() { return Object.keys(this.S.trials || {}).length; },
  // high-level players grouped with someone 10+ levels lower earn mastery against that member's enemies
  mentorActive() {
    if (!this.partyMembersNear) return false;
    return this.partyMembersNear().some((m) => m.level <= this.S.level - 10);
  },

  // ================================================================ XP
  // a monster kill's XP for you: level gap, diminishing returns for the same type, rested bonus
  killExp(m, base) {
    const S = this.S;
    let xp = base * gapMult(S.level, m.level || 1);
    if (xp <= 0) return 0;
    // the same monster type within a rolling 2 hours: -5% each kill, down to 10%; it recovers 10% per 15 minutes away
    xp *= this.diminishInfo(m.type);
    S.dr[m.type] = { n: this.drCount(m.type) + 1, t: Date.now() };
    // first kill of a rare or elite type
    if ((m.def0?.elite || m.def0?.boss) && !S.disc.elites.includes(m.type)) { S.disc.elites.push(m.type); this.after(0.6, () => this.discoverXp('elite', m.def0.name)); }
    xp *= this.catchUp(S.level);
    // rested: doubles kill XP while it lasts
    if (S.rested > 0) { const bonus = Math.min(S.rested, xp); S.rested -= bonus; xp += bonus; }
    return Math.round(xp);
  },
  // recent kills of a type, after recovery for time spent away (2 steps of 5% per 15 minutes; gone after 2 hours)
  drCount(type) {
    const r = this.S.dr[type]; if (!r) return 0;
    const away = Date.now() - r.t;
    return away > 2 * 3600000 ? 0 : Math.max(0, r.n - 2 * Math.floor(away / 900000));
  },
  diminishInfo(type) { return Math.max(0.1, 1 - 0.05 * this.drCount(type)); },
  // quest XP keeps the same share of a level it had before the steeper curve, or is a share of the level (Humans +5%)
  questExp(xp, share = 0) {
    const L = this.S.level;
    return Math.round((share ? xpNext(L) * share : xp * expScale(L)) * (1 + (RACES[this.S.app?.race]?.mods.questExp || 0)));
  },
  discoverXp(kind, label) {
    const xp = Math.round(xpNext(this.S.level) * DISCOVERY[kind] * (1 + (this.stat ? this.stat('discovery') : 0) / 100));
    const p = this.player;
    this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.6), `Discovery +${fmt(xp)} EXP`, 'exp');
    this.ui.chat('system', `<b>Discovery:</b> ${label} · +${fmt(xp)} EXP`);
    this.gainExp(xp);
  },
  // seasonal catch-up: brackets most players have passed get +15% base XP (one more bracket each month)
  catchUp(L) {
    const d = new Date(), months = (d.getUTCFullYear() - 2026) * 12 + d.getUTCMonth() - 9;
    return months >= 1 && L < 20 * months ? 1.15 : 1;
  },
  // the XP bar is full but a trial wall holds the level: say so now and then
  levelBlockNotice(b) {
    if (this.time - (this.blockNoteT ?? -99) < 45) return;
    this.blockNoteT = this.time;
    this.ui.toast(`XP bar full: ${this.blockText(b)}`, 'warn');
    this.ui.chat('system', `Your XP bar is full, but the next level needs: <b>${this.blockText(b)}</b>. Talk to the Trial Warden in Sylvan Haven.`);
  },

  // ================================================================ death: the soul marker
  dropSoul() {
    const S = this.S, p = this.player;
    const lost = Math.min(S.exp, Math.round(xpNext(S.level) * 0.05));
    if (this.soulEnt) this.removeSoul(); // dying again first: the old soul is gone
    S.soul = null;
    if (lost <= 0) return 0;
    S.exp -= lost;
    let x = p.pos.x, z = p.pos.z;
    if (this.dg && this.dg.def?.portal) { x = this.dg.def.portal.x; z = this.dg.def.portal.z + 4; }
    S.soul = { x, z, exp: lost, until: Date.now() + 600000, inDg: !!this.dg };
    this.ui.refreshExp && this.ui.refreshExp();
    return lost;
  },
  makeSoul() {
    const s = this.S.soul; if (!s || this.soulEnt) return;
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), new THREE.MeshBasicMaterial({ color: 0xdff4ff }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x7ac8ff, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(2.4); core.add(halo); core.position.y = 1.4; g.add(core);
    g.position.set(s.x, this.world.heightAt(s.x, s.z), s.z); this.scene.add(g);
    const e = { kind: 'soul', model: g, pos: g.position, height: 2, map: this.world, core };
    this.nameplate(e, '<div class="t">&lt;Your lost soul&gt;</div><div class="n">10:00</div>', 'npc soul');
    e.npT = e.np.querySelector('.n'); e.npY = 2.4;
    this.soulEnt = e;
  },
  removeSoul() { const e = this.soulEnt; if (!e) return; this.scene.remove(e.model); e.np?.remove(); this.soulEnt = null; },
  updateSoul(dt) {
    const s = this.S.soul;
    if (!s) { if (this.soulEnt) this.removeSoul(); return; }
    const left = s.until - Date.now();
    if (left <= 0) { this.S.soul = null; this.removeSoul(); this.ui.chat('system', 'Your lost soul faded away.'); return; }
    if (!this.soulEnt && !this.player.dead) this.makeSoul();
    const e = this.soulEnt; if (!e) return;
    e.core.position.y = 1.4 + Math.sin(this.time * 2.5) * 0.2;
    if ((this.soulTxtT = (this.soulTxtT || 0) - dt) <= 0) { this.soulTxtT = 0.5; e.npT.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`; }
    const p = this.player;
    if (!p.dead && this.map === this.world && flat(p.pos, e.pos) < 2.5) {
      this.S.soul = null; this.removeSoul();
      this.fx.pillar(p.pos, 0x9ad8ff, 1.4, 8, 0.8); this.sfx.play('heal');
      this.ui.toast(`You recovered your soul: +${fmt(s.exp)} EXP`, 'good');
      this.gainExp(s.exp);
    }
  },

  // ================================================================ exploration (fog of war)
  fogIdx(x, z) {
    const c = FOG.cell, n = FOG.n, i = Math.floor((x + FOG.size / 2) / c), j = Math.floor((z + FOG.size / 2) / c);
    return i < 0 || j < 0 || i >= n || j >= n ? -1 : j * n + i;
  },
  fogSeen(x, z) { const k = this.fogIdx(x, z); return k >= 0 && !!this.fogBits[k]; },
  // reveal the cells around the hero; new ground raises Survival mastery
  updateFog() {
    const p = this.player; if (this.map !== this.world || p.dead) return;
    const ci = this.fogIdx(p.pos.x, p.pos.z); if (ci < 0 || ci === this.fogLast) return;
    this.fogLast = ci;
    const R = this.revealR ? this.revealR() : 1;
    let fresh = 0;
    const n = FOG.n, i0 = ci % n, j0 = Math.floor(ci / n);
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) {
      if (di * di + dj * dj > R * R + 1) continue;
      const i = i0 + di, j = j0 + dj; if (i < 0 || j < 0 || i >= n || j >= n) continue;
      const k = j * n + i;
      if (!this.fogBits[k]) { this.fogBits[k] = 1; fresh++; }
    }
    if (fresh) { this.fogDirty = true; this.gainMastery('survival', 0.6 * fresh); this.ui.fogChanged && this.ui.fogChanged(); }
  },
  saveFog() { if (this.fogDirty) { this.S.fog = encodeFog(this.fogBits); this.fogDirty = false; } },

  // ================================================================ Battle Rating (a guide only; content gates never use it)
  calcBR() {
    const S = this.S;
    let items = 0;
    for (const eq of Object.values(S.equip || {})) {
      if (!eq) continue;
      const st = eq.stats || {};
      let v = (st.atk || 0) + (st.def || 0) + (st.hp || 0) * 0.1 + (st.crit || 0) * 4;
      for (const a of eq.affixes || []) v += Math.abs(a.v || 0) * 2;
      items += v * (TIER_MULT[eq.quality] || 1) * (1 + 0.06 * (eq.enh || 0));
    }
    const ms = ['weapon', 'defense', 'survival'].map((t) => this.masteryLv(t));
    return Math.round(S.level * 100 + items + (ms[0] + ms[1] + ms[2]) / 3 * 50);
  },
  // what to do next, for the Hero panel
  nextGoal() {
    const S = this.S, need = xpNext(S.level);
    return { xpLeft: Math.max(0, need - S.exp), need, block: this.levelBlock(), trial: TRIAL_WALLS.find((w) => w >= S.level && !S.trials?.[w / 20]) || null };
  },
};

function encodeFog(bits) {
  let s = '';
  for (let k = 0; k < bits.length; k += 6) { let v = 0; for (let b = 0; b < 6; b++) v |= (bits[k + b] ? 1 : 0) << b; s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[v]; }
  return s;
}
function decodeFog(str) {
  const bits = new Uint8Array(FOG.n * FOG.n);
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let i = 0; i < (str || '').length && i * 6 < bits.length; i++) { const v = A.indexOf(str[i]); if (v < 0) continue; for (let b = 0; b < 6 && i * 6 + b < bits.length; b++) bits[i * 6 + b] = (v >> b) & 1; }
  return bits;
}
export { encodeFog, decodeFog };
export function installProgress(Game) { Object.assign(Game.prototype, P); }
