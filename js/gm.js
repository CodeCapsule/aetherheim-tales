// Game Master: a hero of its own (a separate save, so your normal hero is untouched), opened from the title screen with
// the GM passcode (gm-config.js keeps only its hash). Its editor (the GM button, or the ` key) sets its level, gold,
// stats and powers, makes any gear (rarity, level, +0 to +15, element, set or named) and gives items, spawns monsters
// next to you and decides what they drop, and changes the world (teleport, time of day, weather, the world boss).
// Everyone sees a GM tag on it, and it stays out of the economy and competition: it cannot trade or fight players,
// claims no Hall of Firsts, and its world boss is its own.
import { GM_CONFIG } from './gm-config.js';
import { MONSTERS, ITEMS, SLOTS, SLOT_INFO, ZONES } from './data.js';
import { NEW_ZONES, MAX_LEVEL, RELIC_SETS } from './data-world.js';
import { RARITY, NAMED_LIST, genSix, genRed } from './loot.js';
import { SIX_SETS } from './data-sets.js';
import { MATERIALS, WORLD_BOSS } from './systems-data.js';
import { ELEMENTS, ELEMENT_IDS } from './data-elements.js';
import { WEATHER } from './sky.js';
import { MASTERY_MAX } from './progress.js';
import { mp } from './mp.js';
import { gmMobOk } from './gmnet.js';
import { ico } from './icons.js';

export const GM_SAVE_KEY = 'hiraya_gm_save_v1';
const OK_KEY = 'hiraya_gm_ok';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// ------------------------------------------------------------ the passcode
async function sha256(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
export function gmUnlocked() { try { return !!GM_CONFIG.hash && localStorage.getItem(OK_KEY) === GM_CONFIG.hash; } catch { return false; } }
export async function gmUnlock(pass) {
  if (!GM_CONFIG.hash || !globalThis.crypto?.subtle) return false;
  const hash = await sha256(String(pass || '').trim());
  if (hash !== GM_CONFIG.hash) return false;
  try { localStorage.setItem(OK_KEY, hash); } catch { /* storage unavailable: this visit only */ }
  return true;
}
export function gmLock() { try { localStorage.removeItem(OK_KEY); } catch { /* storage unavailable */ } }
// the Game Master's save, ready to play (null when there is none yet)
export function loadGmSave(valid, migrate) {
  try { const s = JSON.parse(localStorage.getItem(GM_SAVE_KEY) || 'null'); if (!s || !valid(s)) return null; const S = migrate(s); initGmSave(S); return S; } catch { return null; }
}
export function initGmSave(S) {
  const E = S.gmEdit && typeof S.gmEdit === 'object' ? S.gmEdit : {};
  S.gm = true;
  S.gmEdit = {
    stats: E.stats && typeof E.stats === 'object' ? E.stats : {}, flags: E.flags && typeof E.flags === 'object' ? E.flags : {},
    drop: clamp(+E.drop || 1, 1, 20), queue: Array.isArray(E.queue) ? E.queue.slice(0, 10) : [],
    time: Number.isFinite(E.time) ? E.time : null, weather: WEATHER[E.weather] ? E.weather : null,
  };
  return S;
}

const STATS = [['hp', 'Max HP'], ['mp', 'Max MP'], ['atk', 'Attack'], ['def', 'Defense'], ['crit', 'Crit %'], ['critDmg', 'Crit Damage %'], ['speed', 'Move speed %']];
const POWERS = [['god', 'God mode', 'You take no damage'], ['ohk', 'One-hit kills', 'Every hit kills a monster'], ['nocd', 'No cooldowns', 'Skills are ready again at once'], ['freemp', 'Free skills', 'Skills cost no MP'], ['hidden', 'Monsters ignore me', 'Monsters only fight you if you attack them']];
const TIMES = [[null, 'Real time'], [0.3, 'Morning'], [0.5, 'Noon'], [0.76, 'Dusk'], [0.95, 'Night']];
const DROP_X = [1, 2, 5, 10, 20];
const GEAR_Q = 6; // Common to Red (Ancient pieces are set pieces: First Dawn, Jormungandr)
const gearQuality = (q) => clamp(q | 0, 0, GEAR_Q);
const minLv = (q) => RARITY[q]?.min || 1; // a rarity never comes below its level

// ============================================================ game side
const G = {
  gmFlag(k) { return !!(this.S.gm && this.S.gmEdit?.flags?.[k]); },
  // recalc: the stats you set replace the normal ones (empty = normal)
  gmStatMods(v) {
    const st = this.S.gmEdit?.stats || {}, n = (k) => (st[k] === '' || st[k] == null || !Number.isFinite(+st[k]) ? null : +st[k]);
    if (n('hp') != null) v.hp = Math.max(1, n('hp'));
    if (n('mp') != null) v.mp = Math.max(0, n('mp'));
    if (n('atk') != null) v.atk = Math.max(0, n('atk'));
    if (n('def') != null) v.def = Math.max(0, n('def'));
    if (n('crit') != null) v.crit = clamp(n('crit'), 0, 100);
    if (n('critDmg') != null) v.critDmg = Math.max(0, n('critDmg')) / 100;
    if (n('speed') != null) v.speed *= clamp(n('speed'), 10, 500) / 100;
    return v;
  },
  gmDropMult() { return this.S.gm ? this.S.gmEdit.drop || 1 : 1; },
  gmChanged(msg) { if (msg) this.ui.toast(msg, 'good'); this.ui.refreshAll(); this.ui.refreshWallet(); this.ui.refreshPanel(); this.save(); },
  gmSetLevel(L) {
    const S = this.S; S.level = clamp(Math.round(+L || 1), 1, MAX_LEVEL); S.exp = 0;
    this.recalc(true); this.syncSkills(true); this.ui.refreshSkills();
    this.fx.levelUp(this.player); this.sfx.play('level'); this.mpTrackNow && this.mpTrackNow();
    this.gmChanged(`Level ${S.level}`);
  },
  gmSetMoney(kind, v) { this.S[kind] = Math.max(0, Math.round(+v || 0)); this.gmChanged(`${kind === 'gold' ? 'Gold' : 'Diamonds'}: ${fmt(this.S[kind])}`); },
  gmSetStats(stats) { this.S.gmEdit.stats = stats; this.recalc(); this.gmChanged('Stats updated'); },
  gmToggle(k) { const F = this.S.gmEdit.flags; F[k] = !F[k]; this.gmChanged(`${POWERS.find((p) => p[0] === k)?.[1]}: ${F[k] ? 'on' : 'off'}`); },
  gmHeal() { const p = this.player; if (p.dead && this.revive) this.revive(); p.hp = p.maxHp; p.mp = p.maxMp; this.fx.buff(p, '#7aff9a'); this.gmChanged('Fully healed'); },
  gmMaxMastery() {
    const M = this.S.mastery; if (!M) return;
    this.masteryRec('weapon').r = MASTERY_MAX; M.defense.r = MASTERY_MAX; M.survival.r = MASTERY_MAX;
    this.recalc(); this.gmChanged(`Masteries at ${MASTERY_MAX}`);
  },
  gmMaxSkills() {
    const S = this.S; this.syncSkills();
    for (const sk of this.allSkills()) if (this.skillUnlocked(sk)) S.skills[sk.id] = 10;
    this.syncSkills(); this.recalc(); this.ui.refreshSkills(); this.gmChanged('Every skill you have is at rank 10');
  },
  // any gear: random of a rarity, a piece of a six-piece set, or a named item; then level, enhancement and element
  gmGear({ slot = 'weapon', quality = 3, lvl = this.S.level, enh = 0, el = null, set = null, named = null } = {}) {
    const S = this.S; lvl = clamp(Math.round(+lvl || 1), 1, MAX_LEVEL + 10);
    let eq;
    if (named) { const d = NAMED_LIST.find((x) => x.id === named); if (!d) return null; eq = this.makeEquip(d.slot, Math.max(lvl, minLv(d.quality)), d.quality, named); }
    else if (set) { const st = SIX_SETS[set]; if (!st) return null; eq = genSix(set, { slot: st.slots.includes(slot) ? slot : st.slots[0], lvl: Math.max(st.min, lvl), cls: S.cls, uid: S.uid++, owner: S.name }); }
    else {
      const q = gearQuality(quality); lvl = Math.max(lvl, minLv(q));
      if (q === 6) { const [dg, R] = Object.entries(RELIC_SETS)[(Math.random() * Object.keys(RELIC_SETS).length) | 0]; eq = genRed({ adj: R.adj, set: dg, slot, lvl, cls: S.cls, uid: S.uid++ }); }
      else eq = this.makeEquip(slot, lvl, q);
    }
    if (!eq) return null;
    eq.enh = clamp(enh | 0, 0, 15); eq.dur = 100;
    if (eq.slot === 'weapon' && ELEMENTS[el]) eq.el = el; else delete eq.el;
    return eq;
  },
  gmEquip(eq) {
    const S = this.S, old = S.equip[eq.slot];
    S.equip[eq.slot] = eq;
    if (old) S.bag.push({ eq: old });
    this.recalc(); this.gmChanged(`Equipped ${eq.name}${eq.enh ? ' +' + eq.enh : ''}`);
  },
  gmEditEquipped(slot, ch) {
    const eq = this.S.equip[slot]; if (!eq) return;
    if (ch.enh != null) eq.enh = clamp(ch.enh | 0, 0, 15);
    if (ch.el !== undefined) { if (eq.slot === 'weapon' && ELEMENTS[ch.el]) eq.el = ch.el; else delete eq.el; }
    if (ch.remove) { delete this.S.equip[slot]; this.S.bag.push({ eq }); }
    this.recalc(); this.gmChanged();
  },
  gmGive(id, qty) {
    qty = clamp(Math.round(+qty || 1), 1, 9999);
    if (ITEMS[id]) { if (!this.addItem(id, qty)) { this.ui.toast('Your bag is full', 'warn'); return; } }
    else if (MATERIALS[id]) this.addMat(id, qty, true);
    else return;
    this.gmChanged(`${ITEMS[id]?.name || MATERIALS[id].name} x${qty}`);
  },
  // an item on the ground in front of you for anyone to take (drops.js)
  gmDropItem(id, qty) {
    qty = clamp(Math.round(+qty || 1), 1, ITEMS[id] ? 999 : 9999);
    if ((ITEMS[id] || MATERIALS[id]) && this.groundDrop({ id, qty })) this.ui.toast(`${ITEMS[id]?.name || MATERIALS[id].name} x${qty} is on the ground for anyone to take`, 'good');
  },
  // monsters right in front of you; GM monsters do not respawn
  gmSpawn(type, lvl, n = 1, o = {}) {
    const d = MONSTERS[type]; if (!d) return 0;
    if (this.dg || this.war || this.trial) { this.ui.toast('Spawn monsters out in the world', 'warn'); return 0; }
    const p = this.player, W = this.world, L = clamp(Math.round(+lvl || this.S.level), 1, MAX_LEVEL + 10);
    n = clamp(n | 0, 1, 20);
    let made = 0;
    for (let i = 0; i < n; i++) {
      const a = p.yaw + (i - (n - 1) / 2) * 0.32, dist = (d.boss ? 9 : 5.5) + (i % 3) * 1.6;
      let x = p.pos.x + Math.sin(a) * dist, z = p.pos.z + Math.cos(a) * dist;
      [x, z] = W.nearestFree(x, z);
      const e = this.createMonster({ type, x, z, r: 0, lvl: [L, L] }, { exact: true, summoned: true });
      e.gmSpawn = true; e.yaw = e.yawT = Math.atan2(p.pos.x - x, p.pos.z - z);
      if (o.harmless) e.atk = 0;
      if (o.still) e.wanderT = 1e9;
      this.gmMobAdd(e, o); // everyone sees it (gmnet.js)
      this.fx.spawnPuff(e.pos, 0xffd36b);
      made++;
    }
    this.sfx.play('open');
    this.ui.toast(`Spawned ${made} ${d.name}${made > 1 ? 's' : ''} (Lv ${L})`, 'good');
    return made;
  },
  gmClearSpawns() { let n = 0; for (const m of [...this.monsters]) if (m.gmSpawn && !m.removed) { this.removeEnt(m); this.gmMobMap?.delete(m.gmId); n++; } this.gmListDirty = true; this.ui.toast(`Removed ${n} monster${n === 1 ? '' : 's'}`); },
  gmKillNear(r = 20) {
    const p = this.player; let n = 0;
    for (const m of [...this.monsters]) if (!m.dead && (m.map || this.world) === (this.map || this.world) && flat(m.pos, p.pos) <= r && !m.war) { m.tagged = true; this.damage(p, m, 0, { fixed: m.hp + 1 }); n++; }
    this.ui.toast(`Defeated ${n} monster${n === 1 ? '' : 's'} around you`);
  },
  gmSetDrop(x) { this.S.gmEdit.drop = clamp(+x || 1, 1, 20); this.gmChanged(`Drop chance x${this.S.gmEdit.drop}`); },
  gmQueue(entry) { const Q = this.S.gmEdit.queue; if (Q.length >= 10) { this.ui.toast('Up to 10 guaranteed drops at a time', 'warn'); return; } Q.push(entry); this.gmChanged('Added to the next kills'); },
  // after one of your kills: the next guaranteed drop falls
  gmOnKill(m) {
    const Q = this.S.gm && this.S.gmEdit.queue; if (!Q?.length) return;
    const it = Q.shift();
    if (it.gear) { const eq = this.gmGear({ slot: it.slot, quality: it.q, lvl: m.level || this.S.level }); if (eq) this.dropLoot({ eq }, m.pos); }
    else if (ITEMS[it.id]) this.dropLoot({ id: it.id, qty: it.qty || 1 }, m.pos);
    else if (MATERIALS[it.id]) { this.addMat(it.id, it.qty || 1, true); this.lootMsg(`${MATERIALS[it.id].name} x${it.qty || 1}`, RARITY[MATERIALS[it.id].quality || 0].color); }
    this.save();
  },
  gmTeleport(x, z, label) {
    if (this.dg || this.war || this.trial) { this.ui.toast('Leave the instance first', 'warn'); return; }
    const p = this.player; [x, z] = this.world.nearestFree(x, z);
    this.fx.pillar(p.pos, 0xffd36b, 1.6, 10, 0.8);
    p.pos.set(x, this.world.heightAt(x, z), z); p.path = []; this.cam.target.copy(p.pos);
    if (this.pet) this.pet.pos.set(x - 1.5, p.pos.y, z - 1);
    this.fx.pillar(p.pos, 0xffd36b, 1.6, 10, 0.8); this.sfx.play('portal');
    this.ui.closePanels(); this.ui.toast(`Teleported to ${label}`, 'good');
  },
  gmSetTime(t) { this.S.gmEdit.time = t; this.gmChanged(t == null ? 'Real time' : `Time: ${TIMES.find((x) => x[0] === t)?.[1]}`); },
  gmSetWeather(w) { this.S.gmEdit.weather = WEATHER[w] ? w : null; if (this.wx) this.wx.mix = 0; this.gmChanged(`Weather: ${w ? WEATHER[w].name : 'real'}`); },
  // a world boss of your own, now, for 8 minutes
  gmWorldBoss() {
    if (this.wb && !this.wb.e.dead) { this.ui.toast('The world boss is already up', 'warn'); return; }
    this.wb = null; this.S.wb.done = false;
    this.wbForce = { slot: 9e8 + (Math.floor(Date.now() / 1000) % 1e6), until: Date.now() + 8 * 60e3 };
    this.updateWorldBoss();
    this.ui.closePanels();
  },
};

// ============================================================ the editor
const U = {
  panel_gm(body) {
    body.classList.add('gm-body');
    const tab = this.tabs(body, 'gmTab', [['hero', 'Hero'], ['gear', 'Gear'], ['items', 'Items'], ['mobs', 'Monsters'], ['world', 'World']]);
    if (tab === 'gear') this.gmGearTab(body);
    else if (tab === 'items') this.gmItemsTab(body);
    else if (tab === 'mobs') this.gmMobsTab(body);
    else if (tab === 'world') this.gmWorldTab(body);
    else this.gmHeroTab(body);
  },
  gmSec(body, title, note = '') { const s = h('div', 'gm-sec', `<div class="gm-h">${title}${note ? `<small>${note}</small>` : ''}</div>`); body.appendChild(s); return s; },
  gmField(parent, label, el) { const f = h('label', 'gm-f', `<span>${label}</span>`); f.appendChild(el); parent.appendChild(f); return el; },
  gmInput(value, o = {}) { const i = h('input', 'gm-in'); i.type = o.type || 'number'; if (o.min != null) i.min = o.min; if (o.max != null) i.max = o.max; if (o.ph) i.placeholder = o.ph; i.value = value ?? ''; return i; },
  gmSelect(opts, value) { const s = h('select', 'gm-in'); for (const [v, label] of opts) { const o = h('option', '', esc(label)); o.value = v ?? ''; if (String(v ?? '') === String(value ?? '')) o.selected = true; s.appendChild(o); } return s; },
  gmBtn(parent, label, fn, cls = 'btn small') { const b = h('button', cls, label); b.onclick = () => { this.g.sfx.play('click'); fn(); }; parent.appendChild(b); return b; },

  gmHeroTab(body) {
    const g = this.g, S = g.S, p = g.player;
    const sec = this.gmSec(body, 'Level and money');
    const row = h('div', 'gm-row'); sec.appendChild(row);
    const lv = this.gmField(row, `Level (max ${MAX_LEVEL})`, this.gmInput(S.level, { min: 1, max: MAX_LEVEL }));
    this.gmBtn(row, 'Set', () => g.gmSetLevel(lv.value), 'btn small green');
    this.gmBtn(row, '+1', () => g.gmSetLevel(S.level + 1)); this.gmBtn(row, '+10', () => g.gmSetLevel(S.level + 10)); this.gmBtn(row, 'Max', () => g.gmSetLevel(MAX_LEVEL));
    const row2 = h('div', 'gm-row'); sec.appendChild(row2);
    const gold = this.gmField(row2, 'Gold', this.gmInput(S.gold, { min: 0 })); this.gmBtn(row2, 'Set', () => g.gmSetMoney('gold', gold.value));
    const dia = this.gmField(row2, 'Diamonds', this.gmInput(S.diamonds, { min: 0 })); this.gmBtn(row2, 'Set', () => g.gmSetMoney('diamonds', dia.value));
    const st = this.gmSec(body, 'Stats', 'Leave a box empty for the normal value');
    const grid = h('div', 'gm-grid'); st.appendChild(grid);
    const cur = { hp: p.maxHp, mp: p.maxMp, atk: Math.round(p.atk), def: Math.round(p.def), crit: Math.round(p.crit * 10) / 10, critDmg: Math.round((p.critDmg || 0) * 100), speed: 100 };
    const ins = {};
    for (const [k, label] of STATS) ins[k] = this.gmField(grid, `${label} <em>now ${fmt(cur[k])}</em>`, this.gmInput(S.gmEdit.stats[k] ?? '', { min: 0, ph: 'normal' }));
    const sr = h('div', 'gm-row'); st.appendChild(sr);
    this.gmBtn(sr, 'Apply stats', () => { const o = {}; for (const [k] of STATS) if (ins[k].value !== '') o[k] = +ins[k].value; g.gmSetStats(o); }, 'btn small green');
    this.gmBtn(sr, 'Back to normal', () => g.gmSetStats({}), 'btn small gray');
    const pw = this.gmSec(body, 'Powers');
    const chips = h('div', 'gm-row'); pw.appendChild(chips);
    for (const [k, label, tip] of POWERS) { const b = this.gmBtn(chips, label, () => g.gmToggle(k), 'chip' + (g.gmFlag(k) ? ' sel' : '')); b.title = tip; }
    const q = this.gmSec(body, 'Quick');
    const qr = h('div', 'gm-row'); q.appendChild(qr);
    this.gmBtn(qr, 'Full heal', () => g.gmHeal()); this.gmBtn(qr, `Max masteries (${MASTERY_MAX})`, () => g.gmMaxMastery()); this.gmBtn(qr, 'Max all skills', () => g.gmMaxSkills());
  },

  gmGearTab(body) {
    const g = this.g, S = g.S, o = this.sel.gmGear = this.sel.gmGear || { kind: 'random', slot: 'weapon', quality: 4, lvl: S.level, enh: 0, el: '', set: Object.keys(SIX_SETS)[0], named: NAMED_LIST[0]?.id };
    const sec = this.gmSec(body, 'Make gear', 'A rarity never comes below its level (Rare 20, Special 40, Unique 60, Legendary 100, Red 140): a lower level is raised');
    const kind = h('div', 'gm-row'); sec.appendChild(kind);
    for (const [k, label] of [['random', 'Any rarity'], ['set', 'Set piece'], ['named', 'Named item']]) this.gmBtn(kind, label, () => { o.kind = k; this.renderPanel(); }, 'chip' + (o.kind === k ? ' sel' : ''));
    const grid = h('div', 'gm-grid'); sec.appendChild(grid);
    const read = [];
    if (o.kind !== 'named') { const sl = this.gmField(grid, 'Slot', this.gmSelect(SLOTS.map((s) => [s, SLOT_INFO[s].label]), o.slot)); read.push(() => { o.slot = sl.value; }); }
    if (o.kind === 'random') { const q = this.gmField(grid, 'Rarity', this.gmSelect(RARITY.slice(0, GEAR_Q + 1).map((r, i) => [i, r.name]), o.quality)); read.push(() => { o.quality = +q.value; }); }
    if (o.kind === 'set') { const st = this.gmField(grid, 'Set', this.gmSelect(Object.entries(SIX_SETS).map(([id, x]) => [id, `${x.name} (${RARITY[x.tier]?.name || ''})`]), o.set)); read.push(() => { o.set = st.value; }); }
    if (o.kind === 'named') { const nm = this.gmField(grid, 'Item', this.gmSelect(NAMED_LIST.map((d) => [d.id, `${d.name} · ${SLOT_INFO[d.slot]?.label || d.slot}`]), o.named)); read.push(() => { o.named = nm.value; }); }
    const lv = this.gmField(grid, 'Level', this.gmInput(o.lvl, { min: 1, max: MAX_LEVEL + 10 })); read.push(() => { o.lvl = +lv.value; });
    const en = this.gmField(grid, 'Enhance', this.gmSelect(Array.from({ length: 16 }, (_, i) => [i, '+' + i]), o.enh)); read.push(() => { o.enh = +en.value; });
    const el = this.gmField(grid, 'Element (weapons)', this.gmSelect([['', 'None'], ...ELEMENT_IDS.map((k) => [k, ELEMENTS[k].name])], o.el)); read.push(() => { o.el = el.value; });
    const make = () => { read.forEach((f) => f()); return g.gmGear({ slot: o.slot, quality: o.quality, lvl: o.lvl, enh: o.enh, el: o.el || null, set: o.kind === 'set' ? o.set : null, named: o.kind === 'named' ? o.named : null }); };
    const acts = h('div', 'gm-row'); sec.appendChild(acts);
    this.gmBtn(acts, 'Make and equip', () => { const eq = make(); if (eq) g.gmEquip(eq); }, 'btn small green');
    this.gmBtn(acts, 'Put in bag', () => { const eq = make(); if (!eq) return; if (g.addEquip(eq)) g.gmChanged(`${eq.name} is in your bag`); else this.toast('Your bag is full', 'warn'); });
    this.gmBtn(acts, 'Drop on the ground', () => { const eq = make(); if (eq && g.groundDrop({ eq })) this.toast(`${eq.name} is on the ground for anyone to take`, 'good'); });
    const eqs = this.gmSec(body, 'Equipped', 'Change enhancement or element, or take a piece off');
    const L = h('div', 'list'); eqs.appendChild(L);
    for (const s of SLOTS) {
      const eq = S.equip[s]; if (!eq) continue;
      const r = h('div', 'row slim gm-eq', `<div class="ic q${eq.quality}">${ico(eq.icon)}</div><div class="tx"><b style="color:${RARITY[eq.quality]?.color}">${esc(eq.name)}${eq.enh ? ` +${eq.enh}` : ''}</b>${SLOT_INFO[s].label} · Lv ${eq.lvl}${eq.el ? ` · ${ELEMENTS[eq.el]?.name}` : ''}</div>`);
      this.gmBtn(r, '−', () => g.gmEditEquipped(s, { enh: (eq.enh || 0) - 1 }), 'btn small gray');
      this.gmBtn(r, '+', () => g.gmEditEquipped(s, { enh: (eq.enh || 0) + 1 }), 'btn small');
      if (s === 'weapon') { const sel = this.gmSelect([['', 'No element'], ...ELEMENT_IDS.map((k) => [k, ELEMENTS[k].name])], eq.el || ''); sel.onchange = () => g.gmEditEquipped(s, { el: sel.value || null }); r.appendChild(sel); }
      this.gmBtn(r, 'Take off', () => g.gmEditEquipped(s, { remove: true }), 'btn small gray');
      this.tip(r.querySelector('.ic'), () => this.equipTip(eq));
      L.appendChild(r);
    }
    if (!L.children.length) L.appendChild(h('div', 'muted', 'Nothing equipped.'));
  },

  gmItemsTab(body) {
    const g = this.g, o = this.sel.gmItem = this.sel.gmItem || { q: '', id: 'hp_potion', qty: 10 };
    const sec = this.gmSec(body, 'Give items', 'Potions, eggs, scrolls, stones, gems, crystals, materials');
    const all = [...Object.entries(ITEMS).map(([id, it]) => [id, it.name]), ...Object.entries(MATERIALS).map(([id, m]) => [id, m.name])];
    const row = h('div', 'gm-row'); sec.appendChild(row);
    const q = this.gmField(row, 'Search', this.gmInput(o.q, { type: 'search', ph: 'type to filter' }));
    const list = all.filter(([id, name]) => !o.q || (name + ' ' + id).toLowerCase().includes(o.q.toLowerCase()));
    const sel = this.gmField(row, `Item (${list.length})`, this.gmSelect(list.slice(0, 400), list.some((x) => x[0] === o.id) ? o.id : list[0]?.[0]));
    const qty = this.gmField(row, 'Amount', this.gmInput(o.qty, { min: 1, max: 9999 }));
    q.oninput = () => { o.q = q.value; this.renderPanel(); const n = this.panel?.querySelector('.gm-in[type="search"]'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };
    this.gmBtn(row, 'Give', () => { o.id = sel.value; o.qty = +qty.value; g.gmGive(sel.value, qty.value); }, 'btn small green');
    this.gmBtn(row, 'Drop on the ground', () => { o.id = sel.value; o.qty = +qty.value; g.gmDropItem(sel.value, qty.value); });
    const packs = this.gmSec(body, 'Quick packs');
    const pr = h('div', 'gm-row'); packs.appendChild(pr);
    this.gmBtn(pr, 'Potions x50', () => { for (const id of ['hp_potion', 'mp_potion']) g.gmGive(id, 50); });
    this.gmBtn(pr, 'Enhancement stones x50', () => { for (const id of ['enh_stone', 'enh_stone2', 'enh_stone3']) g.gmGive(id, 50); });
    this.gmBtn(pr, 'All element crystals x10', () => { for (const el of ELEMENT_IDS) g.gmGive('crys_' + el, 10); });
    this.gmBtn(pr, '+1,000,000 Gold', () => g.gmSetMoney('gold', g.S.gold + 1e6));
  },

  gmMobsTab(body) {
    const g = this.g, S = g.S, o = this.sel.gmMob = this.sel.gmMob || { type: null, lvl: S.level, n: 1, harmless: false, still: true };
    const types = Object.entries(MONSTERS).filter(([, d]) => gmMobOk(d)).sort((a, b) => (a[1].boss ? 2 : a[1].elite ? 1 : 0) - (b[1].boss ? 2 : b[1].elite ? 1 : 0) || (a[1].lvl?.[0] || 0) - (b[1].lvl?.[0] || 0));
    if (!o.type || !MONSTERS[o.type]) o.type = types[0][0];
    const sec = this.gmSec(body, 'Spawn monsters', 'They appear in front of you for everyone online and do not respawn');
    const grid = h('div', 'gm-grid'); sec.appendChild(grid);
    const ty = this.gmField(grid, `Monster (${types.length})`, this.gmSelect(types.map(([id, d]) => [id, `${d.boss ? '[Boss] ' : d.elite ? '[Elite] ' : ''}${d.name}${d.lvl ? ` (Lv ${d.lvl[0]}-${d.lvl[1]})` : ''}`]), o.type));
    const lv = this.gmField(grid, 'Level', this.gmInput(o.lvl, { min: 1, max: MAX_LEVEL + 10 }));
    const n = this.gmField(grid, 'How many (1-20)', this.gmInput(o.n, { min: 1, max: 20 }));
    const opt = h('div', 'gm-row'); sec.appendChild(opt);
    this.gmBtn(opt, 'Harmless (deals no damage)', () => { o.harmless = !o.harmless; this.renderPanel(); }, 'chip' + (o.harmless ? ' sel' : ''));
    this.gmBtn(opt, 'Stay in place', () => { o.still = !o.still; this.renderPanel(); }, 'chip' + (o.still ? ' sel' : ''));
    const acts = h('div', 'gm-row'); sec.appendChild(acts);
    this.gmBtn(acts, 'Spawn', () => { o.type = ty.value; o.lvl = +lv.value; o.n = +n.value; g.gmSpawn(o.type, o.lvl, o.n, o); }, 'btn small green');
    this.gmBtn(acts, 'Defeat everything near me', () => g.gmKillNear(20));
    this.gmBtn(acts, 'Remove my monsters', () => g.gmClearSpawns(), 'btn small gray');
    const dr = this.gmSec(body, 'Drops', 'For your kills');
    const dx = h('div', 'gm-row'); dr.appendChild(dx);
    dx.appendChild(h('span', 'muted', 'Drop chance'));
    for (const x of DROP_X) this.gmBtn(dx, 'x' + x, () => g.gmSetDrop(x), 'chip' + ((S.gmEdit.drop || 1) === x ? ' sel' : ''));
    const gq = h('div', 'gm-row'); dr.appendChild(gq);
    const all = [...Object.entries(ITEMS).map(([id, it]) => [id, it.name]), ...Object.entries(MATERIALS).map(([id, m]) => [id, m.name])];
    const it = this.gmField(gq, 'Next kills drop', this.gmSelect([['gear', 'Gear (pick rarity)'], ...all.slice(0, 400)], this.sel.gmDropId || 'gear'));
    const rq = this.gmField(gq, 'Gear rarity', this.gmSelect(RARITY.slice(0, GEAR_Q + 1).map((r, i) => [i, r.name]), this.sel.gmDropQ ?? 4));
    const sl = this.gmField(gq, 'Gear slot', this.gmSelect([['', 'Any'], ...SLOTS.map((s) => [s, SLOT_INFO[s].label])], this.sel.gmDropSlot || ''));
    this.gmBtn(gq, 'Add', () => {
      this.sel.gmDropId = it.value; this.sel.gmDropQ = +rq.value; this.sel.gmDropSlot = sl.value;
      g.gmQueue(it.value === 'gear' ? { gear: true, q: +rq.value, slot: sl.value || SLOTS[(Math.random() * SLOTS.length) | 0] } : { id: it.value, qty: 1 });
    }, 'btn small green');
    const Q = S.gmEdit.queue;
    const ql = h('div', 'gm-row gm-queue'); dr.appendChild(ql);
    if (!Q.length) ql.appendChild(h('span', 'muted', 'No guaranteed drops queued.'));
    Q.forEach((e, i) => this.gmBtn(ql, `${i + 1}. ${e.gear ? `${RARITY[e.q]?.name} gear` : esc(ITEMS[e.id]?.name || MATERIALS[e.id]?.name || e.id)} ✕`, () => { Q.splice(i, 1); g.gmChanged(); }, 'chip'));
  },

  gmWorldTab(body) {
    const g = this.g, S = g.S;
    const tp = this.gmSec(body, 'Teleport');
    const tr = h('div', 'gm-row'); tp.appendChild(tr);
    for (const z of [...ZONES, ...NEW_ZONES]) this.gmBtn(tr, esc(z.name), () => g.gmTeleport(z.x, z.z, z.name), 'chip');
    this.gmBtn(tr, WORLD_BOSS.name + ' (boss)', () => g.gmTeleport(WORLD_BOSS.site.x + 8, WORLD_BOSS.site.z + 8, WORLD_BOSS.name), 'chip');
    const peers = [...mp.peers.values()].filter((pr) => pr.info.map === 'world' && pr.net);
    if (peers.length) { const pp = h('div', 'gm-row'); tp.appendChild(pp); pp.appendChild(h('span', 'muted', 'Players:')); for (const pr of peers) this.gmBtn(pp, esc(pr.info.name), () => g.gmTeleport(pr.net.x + 2, pr.net.z + 2, pr.info.name), 'chip'); }
    const tm = this.gmSec(body, 'Time of day', 'Only on your screen');
    const trw = h('div', 'gm-row'); tm.appendChild(trw);
    for (const [t, label] of TIMES) this.gmBtn(trw, label, () => g.gmSetTime(t), 'chip' + (S.gmEdit.time === t ? ' sel' : ''));
    const wx = this.gmSec(body, 'Weather', 'Only on your screen');
    const wr = h('div', 'gm-row'); wx.appendChild(wr);
    this.gmBtn(wr, 'Real weather', () => g.gmSetWeather(null), 'chip' + (!S.gmEdit.weather ? ' sel' : ''));
    for (const [k, w] of Object.entries(WEATHER)) this.gmBtn(wr, esc(w.name), () => g.gmSetWeather(k), 'chip' + (S.gmEdit.weather === k ? ' sel' : ''));
    const wb = this.gmSec(body, 'World boss', 'Your own, for 8 minutes; it does not end anyone else\'s');
    const br = h('div', 'gm-row'); wb.appendChild(br);
    this.gmBtn(br, 'Summon the world boss now', () => g.gmWorldBoss(), 'btn small red');
    const ex = this.gmSec(body, 'Game Master');
    const er = h('div', 'gm-row'); ex.appendChild(er);
    this.gmBtn(er, 'Back to the title screen', () => { g.save(); location.reload(); }, 'btn small gray');
    this.gmBtn(er, 'Lock Game Master on this device', () => { gmLock(); this.toast('The passcode will be asked again next time', 'good'); }, 'btn small gray');
  },
};

export function installGm(Game) { Object.assign(Game.prototype, G); }
export function installGmUI(UI) { Object.assign(UI.prototype, U); }
