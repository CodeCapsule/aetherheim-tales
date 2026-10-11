// Life skills mixed into Game: gathering (mining, herbalism, logging) at world nodes, real-time farming on the homestead,
// alchemy and smithing recipes, elixir buffs, cosmetic costumes and the dungeon relic collection that forges Red gear.
// installLife(Game) adds the methods; initLifeSave(S) fills the save fields.
import * as THREE from 'three';
import { ITEMS, PETS, SLOTS, NPCS } from './data.js';
import {
  PROF, PROF_MAX, profNeed, TIER_REQ, GATHER, NODE_FIELDS, CROPS, FARM, FARM_PLOTS, ALCHEMY, ELIXIRS, SMITHING,
  COSTUMES, RELICS, RELIC_SETS, redCost, COLLECTION_BONUS, MAX_LEVEL,
} from './data-world.js';
import { MATERIALS } from './systems-data.js';
import { classLook } from './models.js';
import { buildNode, buildCrop } from './models-extra.js';
import { RARITY, genRed } from './loot.js';
import { registerIcon } from './icons.js';
import { relicIcon, seedIcon, costumeIcon } from './icons/extra2.js';
import { riverDist, roadDist, mulberry, WATER_Y } from './world.js';
import { toon } from './toon.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const TIER_COLOR = [0xffb070, 0xd8e0f0, 0xf4f8ff, 0x9af0ff, 0xffe07a];
export const COSTUME_SLOTS = ['outfit', 'head', 'back'];
export const costumeById = (id) => COSTUMES.find((c) => c.id === id);
export const fmtLeft = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

// Parameterised icons (relics, seeds, costumes) are generated once and registered under their item ids.
for (const [id, r] of Object.entries(RELICS)) registerIcon(id, relicIcon(id, r.shape, r.c1, r.c2));
for (const [k, c] of Object.entries(CROPS)) registerIcon('seed_' + k, seedIcon('seed_' + k, c.color));
for (const c of COSTUMES) registerIcon(c.id, costumeIcon(c.id, c.slot, c.c1, c.c2));

export function initLifeSave(S) {
  S.prof = S.prof || {};
  for (const k of Object.keys(PROF)) S.prof[k] = S.prof[k] || { lv: 1, exp: 0 };
  S.farm = Array.isArray(S.farm) ? S.farm : [];
  while (S.farm.length < FARM_PLOTS) S.farm.push(null);
  S.elixirs = S.elixirs || {};
  S.costumes = S.costumes || [];
  S.costume = S.costume || { outfit: null, head: null, back: null };
  S.coll = S.coll || {};
  S.life = S.life || { gathered: 0, harvested: 0, brewed: 0, forged: 0, red: 0 };
  return S;
}

const L = {
  // ============================================================ setup & loop
  initLife() {
    const S = this.S, W = this.world;
    initLifeSave(S);
    this.lifeEnts = []; this.nodes = []; this.plots = []; this.lifeT = 0; this.pendingLife = null;
    // gathering nodes: deterministic placement so the same veins and trees are there after every reload
    const rng = mulberry(4242);
    const npcs = NPCS.map((n) => [n.x, n.z]);
    for (const [cx, cz, r, tier, counts] of NODE_FIELDS) for (const [kind, n] of Object.entries(counts)) {
      for (let i = 0, k = 0; i < n * 25 && k < n; i++) {
        const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * r, x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
        if (Math.max(Math.abs(x), Math.abs(z)) > 355 || Math.hypot(x, z) < 34 || Math.hypot(x - FARM.x, z - FARM.z) < 22) continue;
        if (W.isBlocked(x, z) || W.isBlocked(x + 1.5, z) || W.isBlocked(x - 1.5, z) || W.isBlocked(x, z + 1.5) || W.isBlocked(x, z - 1.5)) continue;
        if (W.heightAt(x, z) < WATER_Y + 0.4 || roadDist(x, z) < 4.5 || riverDist(x, z) < 8) continue;
        if (this.nodes.some((nd) => Math.hypot(nd.pos.x - x, nd.pos.z - z) < 7) || npcs.some(([nx, nz]) => Math.hypot(nx - x, nz - z) < 8)) continue;
        if ((W.gates || []).some((gt) => Math.hypot(x - gt.x, z - gt.z) < 14)) continue;
        this.makeNode(kind, Math.max(0, tier - (rng() < 0.3 ? 1 : 0)), x, z, rng() * Math.PI * 2);
        k++;
      }
    }
    // farm plots on the homestead
    const soilGeo = new THREE.BoxGeometry(3.8, 0.34, 4.4), furrowGeo = new THREE.BoxGeometry(3.5, 0.12, 0.42);
    const soil = toon(0x7a4f30), furrow = toon(0x5a3820), wet = toon(0x4a2e1a);
    (W.farmPlots || []).slice(0, FARM_PLOTS).forEach((fp, i) => {
      const g = new THREE.Group(), y = W.heightAt(fp.x, fp.z);
      g.position.set(fp.x, y, fp.z);
      const base = new THREE.Mesh(soilGeo, soil); base.position.y = 0.1; base.receiveShadow = true; g.add(base);
      const furrows = [];
      for (let r = 0; r < 4; r++) { const f = new THREE.Mesh(furrowGeo, furrow); f.position.set(0, 0.3, -1.5 + r * 1.0); g.add(f); furrows.push(f); }
      W.root.add(g);
      const e = { kind: 'plot', idx: i, model: g, pos: g.position, height: 1.2, radius: 2, map: W, dead: false, furrows, wetMat: wet, dryMat: furrow, crop: null, cropKey: '' };
      this.nameplate(e, '<div class="t">&lt;Farm Plot&gt;</div><div class="n">Empty</div>', 'npc plot');
      e.npT = e.np.querySelector('.n'); e.npY = 2.2;
      this.plots.push(e); this.lifeEnts.push(e);
    });
    this.refreshPlots();
    this.expireElixirs(true);
  },
  makeNode(kind, tier, x, z, yaw) {
    const G = GATHER[kind], W = this.world;
    const model = buildNode(kind, tier);
    model.position.set(x, W.heightAt(x, z), z); model.rotation.y = yaw;
    W.root.add(model);
    const e = { kind: 'node', nkind: kind, tier, model, pos: model.position, height: model.userData.height || 1.8, radius: 1.3, map: W, dead: false, ready: true, uses: 0, respawnAt: 0, name: G.names[tier], mat: G.mats[tier], prof: G.prof };
    this.nameplate(e, `<div class="t">&lt;${PROF[G.prof].name} ${TIER_REQ[tier]}&gt;</div><div class="n">${esc(G.names[tier])}</div>`, 'npc node');
    e.npY = e.height + 0.5;
    W.blockCircle && W.blockCircle(x, z, 0.7);
    this.nodes.push(e); this.lifeEnts.push(e);
  },
  updateLife(dt) {
    const p = this.player;
    const P2 = this.pendingLife;
    if (P2 && !p.dead && !this.casting && flat(p.pos, P2.pos) < (P2.kind === 'plot' ? 3.6 : 3)) { this.pendingLife = null; p.path = []; this.lifeAct(P2); }
    this.lifeT -= dt;
    if (this.lifeT > 0) return;
    this.lifeT = 1;
    for (const n of this.nodes) if (!n.ready && this.time >= n.respawnAt) { n.ready = true; n.uses = 0; n.model.userData.parts?.yield && (n.model.userData.parts.yield.visible = true); n.np.classList.remove('dim'); }
    this.refreshPlots();
    this.expireElixirs();
  },

  // ============================================================ professions
  profLv(k) { return this.S.prof[k]?.lv || 1; },
  addProfExp(k, n) {
    const P = this.S.prof[k]; if (!P || P.lv >= PROF_MAX) return;
    P.exp += Math.round(n);
    let up = false;
    while (P.lv < PROF_MAX && P.exp >= profNeed(P.lv)) { P.exp -= profNeed(P.lv); P.lv++; up = true; }
    if (P.lv >= PROF_MAX) P.exp = 0;
    if (up) {
      this.ui.toast(`${PROF[k].name} rose to Lv ${P.lv}!`, 'good'); this.sfx.play('level');
      this.ui.chat('system', `<b>${PROF[k].name}</b> is now level <b>${P.lv}</b>.`);
      const tier = TIER_REQ.indexOf(P.lv);
      if (tier > 0 && ['mining', 'herbalism', 'logging'].includes(k)) this.ui.chat('system', `You can now gather <b>${esc(Object.values(GATHER).find((g) => g.prof === k).names[tier])}</b>.`);
      if (P.lv >= 50 && ['mining', 'herbalism', 'logging'].includes(k)) this.unlockTitle('Master Gatherer');
      if (k === 'farming' && P.lv >= 40) this.unlockTitle('Green Thumb');
      if (k === 'alchemy' && P.lv >= 50) this.unlockTitle('Grand Alchemist');
    }
    if (this.ui.panelName === 'life') this.ui.softRefresh();
  },

  // ============================================================ world interaction (nodes & plots)
  lifeClick(e) {
    const p = this.player;
    this.engage = false; this.pendingTalk = null; this.pendingPortal = null; this.setTarget(null);
    if (flat(p.pos, e.pos) < (e.kind === 'plot' ? 3.6 : 3)) { p.path = []; this.lifeAct(e); return; }
    this.pendingLife = e;
    this.pathTo(e.pos.x, e.pos.z, flat(p.pos, e.pos) > 12);
  },
  lifeAct(e) {
    if (e.kind === 'node') this.gatherNode(e);
    else this.plotAct(e.idx);
  },
  gatherNode(e) {
    const G = GATHER[e.nkind], req = TIER_REQ[e.tier], lv = this.profLv(G.prof);
    if (this.casting) return;
    if (!e.ready) { this.ui.toast(`${e.name} is depleted · regrows in ${fmtLeft((e.respawnAt - this.time) * 1000)}`, 'warn'); return; }
    if (lv < req) { this.ui.toast(`Requires ${PROF[G.prof].name} Lv ${req} (you are Lv ${lv})`, 'warn'); this.sfx.play('error'); return; }
    if (this.mounted) this.dismount(true);
    const p = this.player;
    p.yawT = Math.atan2(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
    p.state = 'attack'; p.actT = p.actDur = 0.6;
    this.castBar(`${G.verb} ${e.name}`, Math.max(1.1, 2.4 - lv * 0.012), () => this.finishGather(e));
  },
  finishGather(e) {
    if (!e.ready) return;
    const S = this.S, G = GATHER[e.nkind], lv = this.profLv(G.prof);
    const qty = 1 + (Math.random() < 0.3 + lv / 250 ? 1 : 0) + (lv >= TIER_REQ[e.tier] + 25 && Math.random() < 0.35 ? 1 : 0);
    this.addMat(e.mat, qty, true);
    this.lootMsg(`${MATERIALS[e.mat].name} x${qty}`, RARITY[MATERIALS[e.mat].quality].color);
    const bonus = Math.random();
    if (e.nkind === 'ore' && bonus < 0.04) { this.addItem('gem_pouch', 1); this.lootMsg('Gem Pouch', RARITY[2].color); }
    else if (e.nkind === 'herb' && bonus < 0.06) { const c = pick(Object.keys(CROPS).filter((k) => CROPS[k].lv <= this.profLv('farming') + 10)); this.addItem('seed_' + c, 2); this.lootMsg(`${ITEMS['seed_' + c].name} x2`, RARITY[ITEMS['seed_' + c].quality].color); }
    else if (e.nkind === 'tree' && bonus < 0.05) { this.addItem('fertilizer', 1); this.lootMsg('Fertilizer', RARITY[1].color); }
    if (bonus > 0.985) { this.addMat('spirit_shard', 1, true); this.lootMsg('Spirit Shard', RARITY[3].color); }
    this.addProfExp(G.prof, 10 + e.tier * 14 + Math.max(0, 6 - (lv - TIER_REQ[e.tier]) / 5));
    const c = e.pos.clone(); c.y += e.height * 0.6;
    this.fx.emit(c, { count: 18, color: TIER_COLOR[e.tier], speed: 3, life: 0.8, size: 0.4, up: 3, gravity: -6, jitter: 0.8 });
    this.sfx.play('pickup');
    S.life.gathered++; this.track('gather');
    e.uses++;
    if (e.uses >= 3) {
      e.ready = false; e.respawnAt = this.time + 45 + e.tier * 12;
      if (e.model.userData.parts?.yield) e.model.userData.parts.yield.visible = false;
      e.np.classList.add('dim');
      this.fx.spawnPuff(e.pos, 0xd8c8a0);
    }
    if (this.ui.panelName === 'life') this.ui.softRefresh();
  },

  // ============================================================ farming (real time, survives reloads)
  plotState(i, now = Date.now()) {
    const P = this.S.farm[i];
    if (!P) return { empty: true };
    const C = CROPS[P.crop], total = Math.max(1, P.ready - P.t0), k = Math.min(1, (now - P.t0) / total);
    return { crop: P.crop, def: C, k, left: Math.max(0, P.ready - now), ripe: now >= P.ready, stage: now >= P.ready ? 2 : k < 0.4 ? 0 : 1, watered: !!P.water, fert: !!P.fert };
  },
  refreshPlots() {
    const now = Date.now();
    for (const e of this.plots || []) {
      const st = this.plotState(e.idx, now);
      const key = st.empty ? '' : `${st.crop}:${st.stage}`;
      if (key !== e.cropKey) {
        if (e.crop) { e.model.remove(e.crop); e.crop = null; }
        if (!st.empty) { e.crop = buildCrop(st.crop, st.stage); e.crop.position.y = 0.3; e.model.add(e.crop); }
        e.cropKey = key;
      }
      for (const f of e.furrows) f.material = st.watered && !st.ripe ? e.wetMat : e.dryMat;
      const label = st.empty ? 'Empty · click to plant' : st.ripe ? `${st.def.name} · Ripe!` : `${st.def.name} · ${fmtLeft(st.left)}`;
      if (e.npText !== label) { e.npText = label; e.npT.textContent = label; e.np.classList.toggle('ripe', !!st.ripe); }
    }
    const ripe = (this.plots || []).some((e) => this.plotState(e.idx, now).ripe), F = this.ui.acts?.farm;
    if (F && ripe !== this.farmRipe) { this.farmRipe = ripe; F.classList.toggle('glow', ripe); this.ui.setBadge(F, ripe); }
  },
  plotAct(i) {
    const st = this.plotState(i);
    if (st.empty) {
      const seed = this.ui.sel.seed && this.countItem(this.ui.sel.seed) > 0 ? this.ui.sel.seed : this.bestSeed();
      if (seed) this.plant(i, seed.replace('seed_', ''));
      else { this.ui.sel.lifeTab = 'farm'; this.ui.togglePanel('life', true); this.ui.toast('Buy seeds from Tilly the Farmer', 'warn'); }
      return;
    }
    if (st.ripe) { this.harvest(i); return; }
    if (!st.watered) { this.water(i); return; }
    this.ui.sel.lifeTab = 'farm'; this.ui.togglePanel('life', true);
  },
  bestSeed() {
    const fl = this.profLv('farming');
    const own = Object.keys(CROPS).filter((k) => CROPS[k].lv <= fl && this.countItem('seed_' + k) > 0);
    return own.length ? 'seed_' + own[own.length - 1] : null;
  },
  plant(i, crop) {
    const S = this.S, C = CROPS[crop]; if (!C) return false;
    if (S.farm[i]) { this.ui.toast('That plot is already planted', 'warn'); return false; }
    if (this.profLv('farming') < C.lv) { this.ui.toast(`${C.name} needs Farming Lv ${C.lv}`, 'warn'); this.sfx.play('error'); return false; }
    if (this.countItem('seed_' + crop) < 1) { this.ui.toast(`No ${C.name} Seeds — Tilly sells them`, 'warn'); return false; }
    this.removeItem('seed_' + crop, 1);
    const now = Date.now();
    S.farm[i] = { crop, t0: now, ready: now + C.mins * 60000, water: false, fert: false };
    this.addProfExp('farming', C.exp * 0.25);
    const e = this.plots[i]; if (e) this.fx.emit(e.pos.clone().setY(e.pos.y + 0.6), { count: 14, color: 0x9ad85a, speed: 1.5, life: 0.7, size: 0.35, up: 2, jitter: 1.2 });
    this.sfx.play('pickup'); this.refreshPlots(); this.ui.refreshPanel(); this.save();
    return true;
  },
  plantAll(crop) {
    let n = 0;
    for (let i = 0; i < FARM_PLOTS; i++) if (!this.S.farm[i] && this.countItem('seed_' + crop) > 0) { if (!this.plant(i, crop)) break; n++; }
    if (n) this.ui.toast(`Planted ${n} plot${n > 1 ? 's' : ''} of ${CROPS[crop].name}`, 'good');
    else if (!this.S.farm.some((p) => !p)) this.ui.toast('Every plot is already planted', 'warn');
  },
  // watering speeds the remaining growth by 25% once per planting; fertilizer halves what is left
  water(i) {
    const P = this.S.farm[i]; if (!P || P.water) return;
    const now = Date.now(); if (now >= P.ready) return;
    P.water = true; P.ready = now + (P.ready - now) * 0.75;
    this.addProfExp('farming', 4);
    const e = this.plots[i]; if (e) this.fx.emit(e.pos.clone().setY(e.pos.y + 1.6), { count: 26, color: 0x7ad8ff, speed: 1.2, life: 0.9, size: 0.3, up: -2, gravity: -10, jitter: 1.4 });
    this.sfx.play('heal'); this.refreshPlots(); this.ui.refreshPanel(); this.save();
  },
  waterAll() { let n = 0; for (let i = 0; i < FARM_PLOTS; i++) { const st = this.plotState(i); if (!st.empty && !st.ripe && !st.watered) { this.water(i); n++; } } if (!n) this.ui.toast('Nothing needs watering', 'warn'); },
  fertilize(i) {
    const P = this.S.farm[i], now = Date.now();
    if (!P || now >= P.ready) { this.ui.toast('Fertilizer only helps growing crops', 'warn'); return false; }
    if (P.fert) { this.ui.toast('Already fertilized', 'warn'); return false; }
    if (this.countItem('fertilizer') < 1) { this.ui.toast('No Fertilizer', 'warn'); return false; }
    this.removeItem('fertilizer', 1);
    P.fert = true; P.ready = now + (P.ready - now) * 0.5;
    this.sfx.play('heal'); this.refreshPlots(); this.ui.refreshPanel(); this.save();
    return true;
  },
  harvest(i) {
    const S = this.S, st = this.plotState(i);
    if (st.empty || !st.ripe) return false;
    const C = st.def, fl = this.profLv('farming');
    let qty = Math.round(rnd(C.yield[0], C.yield[1]) + fl / 30 + (st.fert ? 1 : 0));
    this.addMat('crop_' + st.crop, qty, true);
    this.lootMsg(`${MATERIALS['crop_' + st.crop].name} x${qty}`, RARITY[MATERIALS['crop_' + st.crop].quality].color);
    if (Math.random() < 0.35) { this.addItem('seed_' + st.crop, 1); }
    S.farm[i] = null;
    this.addProfExp('farming', C.exp);
    S.life.harvested++; this.track('harvest');
    const e = this.plots[i]; if (e) this.fx.emit(e.pos.clone().setY(e.pos.y + 0.8), { count: 24, color: new THREE.Color(C.color).getHex(), speed: 3, life: 0.9, size: 0.45, up: 4, gravity: -8, jitter: 1.4 });
    this.sfx.play('coin'); this.refreshPlots(); this.ui.refreshPanel(); this.save();
    return true;
  },
  harvestAll() { let n = 0; for (let i = 0; i < FARM_PLOTS; i++) if (this.harvest(i)) n++; if (!n) this.ui.toast('Nothing is ripe yet', 'warn'); },

  // ============================================================ alchemy & smithing
  insOk(ins) { return Object.entries(ins).every(([id, n]) => (MATERIALS[id] ? this.matCount(id) : this.countItem(id)) >= n); },
  takeIns(ins) { for (const [id, n] of Object.entries(ins)) { if (MATERIALS[id]) this.takeMat(id, n); else this.removeItem(id, n); } },
  brew(rid, times = 1) {
    const r = ALCHEMY.find((x) => x.id === rid); if (!r) return;
    if (this.profLv('alchemy') < r.lv) { this.ui.toast(`Requires Alchemy Lv ${r.lv}`, 'warn'); return; }
    let made = 0;
    for (let t = 0; t < times; t++) {
      if (!this.insOk(r.ins)) break;
      if (!this.bagRoomFor(r.out)) break;
      this.takeIns(r.ins);
      this.addItem(r.out, r.qty); made++;
      this.addProfExp('alchemy', r.exp);
    }
    if (!made) { this.ui.toast('Missing ingredients', 'warn'); this.sfx.play('error'); return; }
    this.S.life.brewed += made; this.track('craft', made);
    this.sfx.play('level'); this.fx.buff(this.player, '#9a7aff');
    this.ui.toast(`Brewed ${ITEMS[r.out].name} x${r.qty * made}`, 'good'); this.ui.refreshPanel(); this.save();
  },
  smith(rid, slot = null) {
    const S = this.S, r = SMITHING.find((x) => x.id === rid); if (!r) return;
    if (this.profLv('smithing') < r.lv) { this.ui.toast(`Requires Smithing Lv ${r.lv}`, 'warn'); return; }
    const cost = { gold: r.gold, mats: r.mats };
    if (!this.canAfford(cost)) { this.ui.toast(this.missingText(cost), 'warn'); this.sfx.play('error'); return; }
    if (r.core) { if (!this.bagRoomFor('crimson_core')) return; }
    else if (S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return; }
    this.pay(cost);
    this.addProfExp('smithing', r.exp);
    S.life.forged++; this.track('craft');
    if (r.core) {
      this.addItem('crimson_core', 1);
      this.sfx.play('legend'); this.fx.buff(this.player, '#ff3b3b');
      this.ui.toast('Forged a Crimson Core!', 'good'); this.ui.refreshPanel(); this.save();
      return;
    }
    let q = r.quality; const master = Math.random() < r.up + this.profLv('smithing') / 1000; if (master) q++;
    const eq = this.makeEquip(slot || pick(SLOTS), S.level, q);
    this.addEquip(eq);
    if (master) { this.ui.banner('MASTERWORK!', eq.name, q >= 5 ? 'loot5' : 'loot4'); this.sfx.play('legend'); } else this.sfx.play('level');
    this.fx.buff(this.player, '#ffb04a');
    this.ui.lootPopup([eq], { title: master ? 'Masterwork!' : 'Smithed' });
    this.ui.refreshPanel(); this.save();
  },

  // ============================================================ relic collection & Red gear
  onMatGain(id) {
    const S = this.S, r = RELICS[id];
    if (!r || S.coll[id]) return;
    S.coll[id] = true;
    const set = RELIC_SETS[r.dungeon];
    const have = set.ids.filter((x) => S.coll[x]).length;
    this.ui.toast(`Collection: ${r.name} (${have}/4)`, 'item');
    this.ui.chat('system', `New relic for your <b>${esc(set.adj)}</b> collection: <span class="it" style="color:${set.c1}">[${esc(r.name)}]</span> (${have}/4)`);
    if (have === 4) {
      this.ui.banner('COLLECTION COMPLETE', `${set.adj} Relics · +${Math.round(COLLECTION_BONUS * 1000) / 10}% Attack & HP`, 'loot5');
      this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} completed the <b>${esc(set.adj)}</b> relic collection!`);
      this.sfx.play('legend'); this.recalc();
      if (this.collSets() >= 5) this.unlockTitle('Relic Hunter');
    }
    this.ui.markMenu && this.ui.markMenu('collect');
  },
  collSets() { const S = this.S; return Object.values(RELIC_SETS).filter((set) => set.ids.every((x) => S.coll[x])).length; },
  collectionMods() { const n = this.collSets(); return { atk: n * COLLECTION_BONUS, hp: n * COLLECTION_BONUS, br: n * 250 }; },
  redRecipe(dg) {
    const set = RELIC_SETS[dg]; if (!set) return null;
    const lv = Math.min(MAX_LEVEL, Math.max(this.S.level, 10));
    const c = redCost(lv);
    return { set, lv, cost: { gold: c.gold, mats: { ...c.mats, ...Object.fromEntries(set.ids.map((id) => [id, 1])) } }, items: c.items };
  },
  canForgeRed(dg) {
    const R = this.redRecipe(dg); if (!R) return false;
    return this.canAfford(R.cost) && R.items.every(([id, n]) => this.countItem(id) >= n);
  },
  forgeRed(dg, slot) {
    const S = this.S, R = this.redRecipe(dg); if (!R) return;
    if (!R.items.every(([id, n]) => this.countItem(id) >= n)) { this.ui.toast('You need a Crimson Core', 'warn'); this.sfx.play('error'); return; }
    if (!this.canAfford(R.cost)) { this.ui.toast(this.missingText(R.cost), 'warn'); this.sfx.play('error'); return; }
    if (S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return; }
    this.pay(R.cost);
    for (const [id, n] of R.items) this.removeItem(id, n);
    const eq = genRed({ adj: R.set.adj, set: dg, slot: SLOTS.includes(slot) ? slot : pick(SLOTS), lvl: R.lv, cls: S.cls, uid: S.uid++ });
    this.addEquip(eq);
    S.life.red++; this.track('craft');
    this.unlockTitle('Crimson Smith');
    this.addProfExp('smithing', 400);
    this.ui.banner('RED ITEM!', eq.name, 'loot6');
    this.logEvent('red', `Forged ${eq.name}`, true);
    this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} forged the Red item <span class="it" style="color:${RARITY[6].color}">[${esc(eq.name)}]</span>!`);
    this.sfx.play('legend'); this.fx.shake(0.5); this.fx.pillar(this.player.pos, 0xff3b3b, 2, 14, 1.4);
    this.ui.lootPopup([eq], { title: 'Crimson Forge' });
    this.ui.refreshPanel(); this.save();
  },

  // ============================================================ elixirs
  elixirMods() {
    const now = Date.now(), out = { atk: 1, def: 1, speed: 1, exp: 0, gold: 0, luck: 0 };
    for (const [id, until] of Object.entries(this.S.elixirs || {})) {
      if (until <= now) continue;
      const E = ELIXIRS[id]; if (!E) continue;
      for (const k in E.mods || {}) out[k] *= E.mods[k];
      out.exp += E.exp || 0; out.gold += E.gold || 0; out.luck += E.luck || 0;
    }
    return out;
  },
  activeElixirs() { const now = Date.now(); return Object.entries(this.S.elixirs || {}).filter(([id, t]) => t > now && ELIXIRS[id]).map(([id, t]) => ({ id, left: t - now, def: ELIXIRS[id] })); },
  expireElixirs(quiet = false) {
    const S = this.S, now = Date.now(); let gone = false;
    for (const [id, t] of Object.entries(S.elixirs)) if (t <= now) { delete S.elixirs[id]; gone = true; if (!quiet && ELIXIRS[id]) this.ui.toast(`${ELIXIRS[id].name} has worn off`, 'warn'); }
    if (gone) this.recalc();
    this.ui.refreshBuffs && this.ui.refreshBuffs();
  },
  drinkElixir(id) {
    const S = this.S, E = ELIXIRS[id]; if (!E) return false;
    const now = Date.now(), cur = Math.max(now, S.elixirs[id] || 0);
    if (cur - now > E.mins * 60000 * 3 - 1000) { this.ui.toast('That elixir is already at its maximum duration', 'warn'); return true; }
    this.removeItem(id, 1);
    S.elixirs[id] = cur + E.mins * 60000;
    this.recalc(); this.fx.buff(this.player, '#c8a0ff'); this.sfx.play('heal');
    this.ui.toast(`${E.name}: ${E.desc}`, 'good');
    this.ui.refreshBuffs && this.ui.refreshBuffs();
    this.track('elixir');
    return true;
  },

  // ============================================================ bag consumables added by the life systems
  useLifeItem(id) {
    const S = this.S, it = ITEMS[id];
    if (ELIXIRS[id]) return this.drinkElixir(id);
    if (id.startsWith('seed_')) { this.ui.sel.seed = id; this.ui.sel.lifeTab = 'farm'; this.ui.togglePanel('life', true); return true; }
    if (id === 'fertilizer') {
      const now = Date.now();
      const best = S.farm.map((P, i) => [P, i]).filter(([P]) => P && !P.fert && P.ready > now).sort((a, b) => b[0].ready - a[0].ready)[0];
      if (!best) { this.ui.toast('No growing crop to fertilize', 'warn'); return true; }
      if (this.fertilize(best[1])) this.ui.toast(`Fertilized your ${CROPS[best[0].crop].name}`, 'good');
      return true;
    }
    if (id === 'bag_scroll') { this.expandBag(true); return true; }
    if (id === 'teleport_scroll') {
      if (this.dg || this.war) { this.ui.toast('Cannot teleport from here', 'warn'); return true; }
      this.removeItem(id, 1); this.ui.closePanels();
      this.castBar('Homeward Scroll', 1.2, () => {
        const p = this.player; this.fx.pillar(p.pos, 0x7ad8ff, 1.6, 10, 0.8);
        if (this.mounted) this.dismount(true);
        p.pos.set(0, this.world.heightAt(0, 9), 9); p.path = []; this.cam.target.copy(p.pos);
        if (this.pet) this.pet.pos.set(-1.5, p.pos.y, 8);
        this.fx.pillar(p.pos, 0x7ad8ff, 1.6, 10, 1.0); this.sfx.play('cast');
      });
      return true;
    }
    if (id === 'pet_treat') {
      const pid = S.activePet, st = S.pets[pid];
      if (!st) { this.ui.toast('Summon a pet first', 'warn'); return true; }
      if (st.lv >= 60) { this.ui.toast('Max pet level', 'warn'); return true; }
      this.removeItem(id, 1); st.lv++; this.track('feed');
      this.sfx.play('level'); if (this.pet) this.fx.levelUp(this.pet);
      this.ui.toast(`${PETS.find((x) => x.id === pid).name} grew to Lv ${st.lv}!`, 'good');
      this.recalc(); this.ui.refreshPlayer(); return true;
    }
    if (id === 'costume_box') {
      const pool = COSTUMES.filter((c) => !S.costumes.includes(c.id));
      this.removeItem(id, 1);
      if (!pool.length) { S.gold += 5000; this.ui.toast('You own every costume: received 5,000 Gold', 'good'); this.ui.refreshWallet(); return true; }
      const c = pick(pool);
      this.gainCostume(c.id);
      this.ui.modal('Wardrobe Box', `Inside you find the ${c.name}! Try it on in your Wardrobe.`, [{ label: 'Wear it', cls: 'green', fn: () => this.wearCostume(c.id) }, { label: 'Later', cls: 'gray' }], false, null);
      return true;
    }
    if (it && it.type === 'material') { this.ui.toast(id === 'crimson_core' ? 'Used to forge Red gear (Forge → Crimson)' : 'A crafting material', 'warn'); return true; }
    return false;
  },

  // ============================================================ costumes (cosmetic only)
  gainCostume(id) {
    const S = this.S, c = costumeById(id); if (!c || S.costumes.includes(id)) return false;
    S.costumes.push(id);
    this.ui.toast(`New costume: ${c.name}`, 'good');
    this.ui.chat('system', `New costume for your wardrobe: <b>[${esc(c.name)}]</b>`);
    if (S.costumes.length >= 10) this.unlockTitle('Fashionista');
    this.ui.markMenu && this.ui.markMenu('wardrobe');
    return true;
  },
  wearCostume(id, slot = null) {
    const S = this.S;
    if (id) { const c = costumeById(id); if (!c || !S.costumes.includes(id)) return; slot = c.slot; S.costume[slot] = id; }
    else if (slot) S.costume[slot] = null;
    const wasMounted = this.mounted;
    if (wasMounted) this.dismount(true);
    this.rebuildPlayerModel();
    if (wasMounted) this.mount(true);
    this.fx.spawnPuff(this.player.pos, 0xffb8e8); this.sfx.play('click');
    this.ui.refreshPanel(); this.ui.refreshPlayer(); this.save();
  },
  // Costume pieces replace the look of the class outfit / headwear / back; stats never change.
  playerLook() {
    const S = this.S;
    let o = { wings: S.wings, ...(S.wingColor ? { wingColor: S.wingColor } : {}) };
    const out = costumeById(S.costume?.outfit), head = costumeById(S.costume?.head), back = costumeById(S.costume?.back);
    if (out) o = { ...o, armor: false, robe: false, cape: null, scarf: false, apron: false, hood: null, ...out.look };
    if (head) o = { ...o, hat: 'none', hood: null, catEars: false, ears: true, hatColor: undefined, ...head.look };
    if (back) o = { ...o, ...back.look };
    return classLook(S.cls, S.gender, S.hair, S.eye, o);
  },
};

export function installLife(Game) { Object.assign(Game.prototype, L); }
