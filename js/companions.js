// Companions: pets, sprites and mounts grow with you.
// - Pets earn XP from every kill made while they are out (feeding with Gold still works) and evolve twice, at Lv 20
//   and Lv 40, with Evolution Stones: each stage makes the pet bigger and stronger and its ability better. Every pet
//   has an element and fights 25% harder in the lands of that element. The Pet Book shows every pet's three stages;
//   pets owned and stages reached give a collection bonus to the whole account (Max HP, Attack, Combat Power).
// - Sprites level up to 30 with Sprite Essence (their bonus grows 5% a level) and learn one of two talents at Lv 10,
//   20 and 30. The active sprite senses buried treasure three times a day, and at the Sprite Realm each sprite's
//   guardian can be challenged three times a day: beating a guardian wins its sprite (the first time) and Essence.
// - Mounts train from Lv 1 to 10 with Gold and Spirit Shards: +1% speed and +15% of their Combat Power a level.
import * as THREE from 'three';
import { PETS, SPRITES, MOUNTS, ZONES } from './data.js';
import { PET_MAX_LV } from './data-pets.js';
import { ELEMENTS, ZONE_ELEMENT } from './data-elements.js';
import { MATERIALS, dayKey } from './systems-data.js';
import { ico } from './icons.js';
import { dirWord } from './nav-world.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const rnd = (a, b) => a + Math.random() * (b - a);

// ============================================================ pets
// every pet's element (it fights 25% harder in lands of that element: data-elements.js ZONE_ELEMENT)
export const PET_ELEMENT = {
  pet_icecream: 'frost', pet_cat: 'light', pet_jelly: 'storm', pet_bunny: 'wind', pet_shroom: 'earth', pet_cupcake: 'light', pet_penguin: 'frost',
  pet_owl: 'wind', pet_fox: 'fire', pet_bee: 'light', pet_frog: 'storm', pet_panda: 'earth', pet_puppet: 'shadow', pet_ghost: 'shadow',
  pet_pumpkin: 'fire', pet_snowpuff: 'frost', pet_blossom: 'wind', pet_imp: 'fire', pet_yeti: 'frost', pet_turtle: 'earth', pet_bat: 'shadow',
  pet_star: 'light', pet_dragon: 'fire', pet_phoenix: 'fire', pet_whale: 'storm', pet_kitsune: 'shadow', pet_icedragon: 'frost',
};
export const petElement = (id) => PET_ELEMENT[id] || 'earth';
// stage 0 is the pet as hatched; 1 Evolved (Lv 20), 2 Awakened (Lv 40)
export const PET_EVO = [
  { name: '', mult: 1, ab: 1, scale: 1 },
  { name: 'Evolved', lv: 20, cost: { gold: 20000, mats: { evo_stone: 3 } }, mult: 1.3, ab: 1.15, scale: 1.18, glow: 0x9ad8ff },
  { name: 'Awakened', lv: 40, cost: { gold: 80000, mats: { evo_stone: 8, star_essence: 2 } }, mult: 1.7, ab: 1.35, scale: 1.36, glow: 0xffd84a },
];
export const petNeed = (lv) => Math.round(40 * Math.pow(lv, 1.5)); // XP from Lv lv to lv + 1
const petKillXp = (m) => Math.round((10 + (m.level || 1) * 0.5) * (m.def0?.boss || m.wb ? 10 : m.def0?.elite ? 3 : 1));
export const PET_ZONE_BONUS = 0.25;
// the Pet Book's collection bonus: per pet owned and per evolution stage reached
export const BOOK = { hp: 0.4, atk: 0.2, cpPet: 30, cpStage: 40 };

// ============================================================ sprites
export const SPRITE_MAX = 30;
export const spriteUpCost = (lv) => ({ gold: 1000 * lv, mats: { sprite_essence: lv } });
export const SPRITE_TALENTS = [
  { lv: 10, opts: [{ id: 'might', name: 'Might', desc: '+3% Attack', stat: { atkPct: 3 } }, { id: 'ward', name: 'Ward', desc: '+3% Defense', stat: { defPct: 3 } }] },
  { lv: 20, opts: [{ id: 'focus', name: 'Focus', desc: '+2% Critical chance', stat: { crit: 2 } }, { id: 'vigor', name: 'Vigor', desc: '+4% Max HP', stat: { hpPct: 4 } }] },
  { lv: 30, opts: [{ id: 'arcana', name: 'Arcana', desc: '+5% Skill damage', stat: { skillDmg: 5 } }, { id: 'fury', name: 'Fury', desc: '+8% Critical damage', stat: { critDmg: 8 } }] },
];
export const HUNTS_A_DAY = 3, REALM_A_DAY = 3;
// each sprite's guardian in the Sprite Realm (a boss at your level)
export const REALM = {
  sp_fire: { type: 'ignisling', name: 'Guardian of Flame' },
  sp_water: { type: 'hydraling', name: 'Guardian of Tides' },
  sp_wind: { type: 'behemoth', name: 'Guardian of Gales' },
  sp_earth: { type: 'bogtreant', name: 'Guardian of Stone' },
};

// ============================================================ mounts
export const MOUNT_MAX = 10;
export const mountUpCost = (lv) => ({ gold: 5000 * lv * lv, mats: { spirit_shard: 2 * lv } });

const G = {
  compInit() {
    const S = this.S;
    for (const st of Object.values(S.pets || {})) { st.xp = st.xp || 0; st.evo = st.evo || 0; }
    S.spr = S.spr && typeof S.spr === 'object' ? S.spr : {};
    S.mountLv = S.mountLv && typeof S.mountLv === 'object' ? S.mountLv : {};
    if (!S.comp || typeof S.comp !== 'object') S.comp = { day: '', hunts: 0, realm: 0 };
  },
  compDay() { const C = this.S.comp; if (C.day !== dayKey()) { C.day = dayKey(); C.hunts = 0; C.realm = 0; } return C; },

  // ---------------------------------------------------------------- pets
  petEl() { return this.S.activePet ? petElement(this.S.activePet) : null; },
  petEvo(id) { return PET_EVO[this.S.pets[id]?.evo || 0]; },
  petEvoMult(id) { return this.petEvo(id).mult; },
  petName(id) { const pd = PETS.find((x) => x.id === id), E = this.petEvo(id); return E.name ? `${E.name} ${pd.name}` : pd.name; },
  // the pet's bite: evolution, and its own element's lands
  petAtkMult() {
    const id = this.S.activePet; if (!id) return 1;
    const home = !this.dg && ZONE_ELEMENT[this.zone?.name] === petElement(id);
    return this.petEvoMult(id) * (home ? 1 + PET_ZONE_BONUS : 1);
  },
  // Evolution Stones and Sprite Essence from kills
  compOnKill(m) {
    const d = m.def0 || {}, big = d.boss || m.wb, el = d.elite;
    if (m.summoned && !m.gmId) return;
    if (Math.random() < (big ? 0.4 : el ? 0.05 : 0)) { this.addMat('evo_stone', 1, true); this.lootMsg('Evolution Stone', '#ff9a2e'); }
    if (Math.random() < (big ? 0.6 : el ? 0.15 : 0.015)) { const n = big ? 3 : 1; this.addMat('sprite_essence', n, true); this.lootMsg(`Sprite Essence${n > 1 ? ' x' + n : ''}`, '#c46bff'); }
  },
  petKill(m) {
    const S = this.S, id = S.activePet, st = id && S.pets[id]; if (!st || !this.pet) return;
    if (st.lv >= PET_MAX_LV) return;
    st.xp = (st.xp || 0) + petKillXp(m);
    let up = 0;
    while (st.lv < PET_MAX_LV && st.xp >= petNeed(st.lv)) { st.xp -= petNeed(st.lv); st.lv++; up++; }
    if (st.lv >= PET_MAX_LV) st.xp = 0;
    if (up) {
      this.fx.levelUp(this.pet); this.sfx.play('level');
      this.ui.toast(`${this.petName(id)} grew to Lv ${st.lv}!`, 'good');
      if (PET_EVO.some((E) => E.lv === st.lv) && st.evo < PET_EVO.findIndex((E) => E.lv === st.lv)) this.ui.chat('system', `<b>${esc(this.petName(id))}</b> can evolve now: open Pets (P).`);
      this.recalc(); this.ui.refreshPanel(); this.ui.refreshPlayer();
    }
  },
  petEvolve(id) {
    const S = this.S, st = S.pets[id], pd = PETS.find((x) => x.id === id); if (!st || !pd) return false;
    const nx = PET_EVO[(st.evo || 0) + 1];
    if (!nx) { this.ui.toast('Already at its final stage', 'warn'); return false; }
    if (!this.featureGate('evolve')) return false;
    if (st.lv < nx.lv) { this.ui.toast(`${pd.name} must reach Lv ${nx.lv} to evolve`, 'warn'); return false; }
    if (!this.pay(nx.cost)) return false;
    st.evo = (st.evo || 0) + 1;
    this.ui.banner(nx.name.toUpperCase() + '!', `${pd.name} evolved`, st.evo === 2 ? 'loot5' : 'loot4');
    this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)}'s pet <b>${esc(pd.name)}</b> became <b>${esc(this.petName(id))}</b>!`);
    this.sfx.play('legend');
    if (S.activePet === id) { this.syncPet(); this.fx.pillar(this.pet.pos, nx.glow, 1.4, 8, 1); }
    this.recalc(); this.ui.refreshPanel(); this.ui.refreshPlayer(); this.save();
    return true;
  },
  // bigger, with a glow at its feet, once evolved
  petLook(e, id) {
    const E = this.petEvo(id);
    if (E.scale !== 1) e.model.scale.multiplyScalar(E.scale);
    if (E.glow) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.62, 28), new THREE.MeshBasicMaterial({ color: E.glow, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; e.model.add(ring);
    }
  },
  petBook() {
    const S = this.S, own = Object.keys(S.pets || {}).filter((id) => PETS.some((p) => p.id === id));
    const stages = own.reduce((a, id) => a + (S.pets[id].evo || 0), 0);
    return { own: own.length, stages, hp: own.length * BOOK.hp, atk: stages * BOOK.atk, cp: own.length * BOOK.cpPet + stages * BOOK.cpStage };
  },

  // ---------------------------------------------------------------- sprites
  spriteSt(id) { const S = this.S; if (!S.spr[id]) S.spr[id] = { lv: 1, tal: [null, null, null] }; return S.spr[id]; },
  spriteK(id) { return 1 + 0.05 * ((this.S.spr?.[id]?.lv || 1) - 1); },
  // the active sprite's bonus at its level (game.js recalc)
  spriteMods(sd) {
    const m = sd.mods || {}, k = this.spriteK(sd.id), sc = (v) => (v ? 1 + (v - 1) * k : 1);
    return { atk: sc(m.atk), def: sc(m.def), speed: sc(m.speed), crit: (m.crit || 0) * k, regen: (sd.regen || 0) * k };
  },
  spriteCP() { const id = this.S.activeSprite; return id ? 260 + 25 * ((this.S.spr?.[id]?.lv || 1) - 1) : 0; },
  addSpriteStats(ps) {
    const id = this.S.activeSprite, st = id && this.S.spr?.[id]; if (!st) return;
    SPRITE_TALENTS.forEach((T, i) => { const o = T.opts.find((x) => x.id === st.tal?.[i]); if (o) for (const [k, v] of Object.entries(o.stat)) ps[k] = (ps[k] || 0) + v; });
  },
  spriteLevelUp(id) {
    const S = this.S; if (!S.sprites.includes(id)) return false;
    const st = this.spriteSt(id);
    if (st.lv >= SPRITE_MAX) { this.ui.toast('This sprite is fully grown', 'warn'); return false; }
    if (!this.pay(spriteUpCost(st.lv))) return false;
    st.lv++;
    const sd = SPRITES.find((x) => x.id === id);
    this.sfx.play('level'); if (this.sprite && S.activeSprite === id) this.fx.emit(this.sprite.position.clone(), { count: 24, color: sd.color, speed: 3, life: 0.7, size: 0.5, up: 1 });
    this.ui.toast(`${sd.name} reached Lv ${st.lv}${SPRITE_TALENTS.some((T) => T.lv === st.lv) ? ' · choose a talent!' : ''}`, 'good');
    this.recalc(); this.ui.refreshPanel(); this.save();
    return true;
  },
  spriteTalent(id, tier, opt) {
    const st = this.spriteSt(id), T = SPRITE_TALENTS[tier]; if (!T || !T.opts.some((o) => o.id === opt)) return false;
    if (st.lv < T.lv) { this.ui.toast(`Talents of this row open at Lv ${T.lv}`, 'warn'); return false; }
    if (st.tal[tier] && st.tal[tier] !== opt && !this.pay({ gold: 10000 })) return false; // changing your mind costs 10,000 Gold
    st.tal[tier] = opt;
    this.sfx.play('upgrade'); this.recalc(); this.ui.refreshPanel(); this.save();
    return true;
  },
  // ---------------------------------------------------------------- treasure hunts
  huntsLeft() { return Math.max(0, HUNTS_A_DAY - this.compDay().hunts); },
  huntStart() {
    const S = this.S, p = this.player;
    if (!this.featureGate('hunt')) return false;
    if (!S.activeSprite) { this.ui.toast('Call a sprite first: it senses the treasure', 'warn'); return false; }
    if (this.dg || this.trial || this.war || this.map !== this.world) { this.ui.toast('Treasure lies out in the open world', 'warn'); return false; }
    if (S.hunt) { this.ui.toast('Your sprite already senses a treasure: follow the tracker', 'warn'); return false; }
    if (!this.huntsLeft()) { this.ui.toast('Your sprite needs rest: three hunts a day', 'warn'); return false; }
    let spot = null;
    for (let i = 0; i < 20 && !spot; i++) {
      const a = Math.random() * Math.PI * 2, d = rnd(40, 85);
      const [x, z] = this.world.nearestFree(p.pos.x + Math.sin(a) * d, p.pos.z + Math.cos(a) * d);
      const zn = this.world.zoneAt(x, z, ZONES);
      if (Math.abs(x) < 395 && Math.abs(z) < 395 && !(zn && zn.safe) && this.world.findPath(p.pos.x, p.pos.z, x, z).length) spot = { x, z };
    }
    if (!spot) { this.ui.toast('Your sprite senses nothing here: try somewhere more open', 'warn'); return false; }
    this.compDay().hunts++;
    S.hunt = { x: Math.round(spot.x * 10) / 10, z: Math.round(spot.z * 10) / 10 };
    this.huntFxT = 0;
    this.sfx.play('chime');
    this.ui.toast(`Your sprite senses treasure ${Math.round(flat(p.pos, spot))} m ${dirWord(spot.x - p.pos.x, spot.z - p.pos.z)}: follow the tracker`, 'good');
    this.ui.refreshQuest(); this.save();
    return true;
  },
  huntUpdate(dt) {
    const S = this.S, H = S.hunt, p = this.player; if (!H || p.dead || this.map !== this.world) return;
    this.huntFxT = (this.huntFxT || 0) - dt;
    const d = flat(p.pos, H);
    if (this.huntFxT <= 0 && d < 70) { this.huntFxT = 2.2; this.fx.pillar({ x: H.x, y: this.world.heightAt(H.x, H.z), z: H.z }, 0xffe07a, 0.6, 6, 1.2); }
    this.huntTrackN = (this.huntTrackN || 0) + 1; if (this.huntTrackN % 30 === 0) this.ui.refreshQuest();
    if (d < 2.6 && !this.casting && !this.huntDigging) {
      this.huntDigging = true; p.path = [];
      this.castBar('Digging up the treasure', 1.6, () => { this.huntDigging = false; this.huntDig(); }, () => { this.huntDigging = false; });
    }
  },
  huntDig() {
    const S = this.S, H = S.hunt; if (!H) return;
    S.hunt = null;
    const lv = S.level, got = [];
    const ess = 2 + ((Math.random() * 3) | 0); this.addMat('sprite_essence', ess, true); got.push(`Sprite Essence x${ess}`);
    const gold = 1000 + lv * 60; S.gold += gold; got.push(`${fmt(gold)} Gold`);
    if (Math.random() < 0.25) { this.addMat('evo_stone', 1, true); got.push('Evolution Stone'); }
    if (Math.random() < 0.12) { this.addItem('gem_pouch', 1); got.push('Gem Pouch'); }
    if (Math.random() < 0.06) { S.diamonds += 30; got.push('30 Diamonds'); }
    this.fx.pillar({ x: H.x, y: this.world.heightAt(H.x, H.z), z: H.z }, 0xffe07a, 1.6, 10, 1); this.sfx.play('chest');
    this.ui.toast(`Treasure! ${got.join(', ')}`, 'good');
    this.ui.chat('system', `Treasure hunt: ${got.join(', ')}.`);
    this.track && this.track('hunt');
    this.ui.refreshWallet(); this.ui.refreshQuest(); this.ui.refreshPanel(); this.save();
  },
  // ---------------------------------------------------------------- the Sprite Realm
  realmLeft() { return Math.max(0, REALM_A_DAY - this.compDay().realm); },
  realmChallenge(id) {
    const S = this.S, p = this.player, R = REALM[id], sd = SPRITES.find((x) => x.id === id);
    if (!R || !sd) return false;
    if (this.realmFight) { this.ui.toast('A guardian is already waiting for you', 'warn'); return false; }
    if (this.dg || this.trial || this.war || this.map !== this.world) { this.ui.toast('The Sprite Realm opens in the open world', 'warn'); return false; }
    if (this.zone?.safe) { this.ui.toast('Step outside the town: the guardians do not come where people live', 'warn'); return false; }
    if (!this.featureGate('realm')) return false;
    if (!this.realmLeft()) { this.ui.toast('The Sprite Realm closes for today: three challenges a day', 'warn'); return false; }
    this.compDay().realm++;
    const a = p.yaw, [x, z] = this.world.nearestFree(p.pos.x + Math.sin(a) * 9, p.pos.z + Math.cos(a) * 9);
    const L = S.level, m = this.createMonster({ type: R.type, x, z, r: 0, lvl: [L, L] }, { exact: true, summoned: true });
    m.realm = id; m.name = R.name; m.wanderT = 1e9; m.noLeash = true; m.target = p;
    m.maxHp = m.hp = Math.round(m.maxHp * 1.6);
    m.labelHtml = `Lv${L} ${esc(R.name)}`; if (m.np) m.np.querySelector('.n').innerHTML = m.labelHtml;
    this.realmFight = { m, id, x: p.pos.x, z: p.pos.z, t: 0 };
    this.fx.ring(p.pos, sd.color, 14, 1.2); this.fx.pillar(m.pos, sd.color, 2.4, 14, 1.2); this.sfx.play('boom'); this.fx.shake(0.4);
    this.ui.banner('SPRITE REALM', R.name, 'level');
    this.setTarget(m);
    return true;
  },
  realmUpdate(dt) {
    const F = this.realmFight; if (!F) return;
    F.t += dt;
    const p = this.player, far = flat(p.pos, F) > 40;
    if (F.m.dead) { this.realmFight = null; return; }
    if (p.dead || far || F.t > 300) {
      this.realmFight = null;
      if (!F.m.removed) this.removeEnt(F.m);
      this.ui.toast(p.dead ? 'The guardian sends you back. Try again with more strength.' : far ? 'You left the Sprite Realm: the guardian fades away' : 'The guardian fades with the realm', 'warn');
    }
  },
  realmWon(m) {
    const S = this.S, id = m.realm, sd = SPRITES.find((x) => x.id === id);
    this.realmFight = null;
    const got = [], ess = 5 + ((Math.random() * 4) | 0);
    this.addMat('sprite_essence', ess, true); got.push(`Sprite Essence x${ess}`);
    if (Math.random() < 0.5) { this.addMat('evo_stone', 1, true); got.push('Evolution Stone'); }
    if (!S.sprites.includes(id)) {
      S.sprites.push(id);
      this.ui.banner('NEW SPRITE', `${sd.name} (${sd.element})`, 'loot5');
      this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} won the sprite <b>${esc(sd.name)}</b> in the Sprite Realm!`);
      got.unshift(`the sprite ${sd.name}`);
      if (!S.activeSprite) this.setSprite(id);
    }
    this.sfx.play('legend');
    this.ui.toast(`Guardian defeated: ${got.join(', ')}`, 'good');
    this.track && this.track('realm');
    this.ui.refreshPanel(); this.save();
  },

  // ---------------------------------------------------------------- mounts
  mountLv(id) { return this.S.mountLv?.[id] || 1; },
  mountSpeed(id) { const md = MOUNTS.find((m) => m.id === id); return md ? md.speed + 0.01 * (this.mountLv(id) - 1) : 1.4; },
  mountCP() { return this.S.mounts.reduce((a, id) => a + (MOUNTS.find((m) => m.id === id)?.br || 0) * (1 + 0.15 * (this.mountLv(id) - 1)), 0); },
  mountTrain(id) {
    const S = this.S; if (!S.mounts.includes(id)) return false;
    const lv = this.mountLv(id);
    if (lv >= MOUNT_MAX) { this.ui.toast('Fully trained', 'warn'); return false; }
    if (!this.pay(mountUpCost(lv))) return false;
    S.mountLv[id] = lv + 1;
    this.sfx.play('level'); this.ui.toast(`${MOUNTS.find((m) => m.id === id).name} trained to Lv ${lv + 1}`, 'good');
    this.recalc(); this.ui.refreshPanel(); this.save();
    return true;
  },
};

// ============================================================ windows
const RARC = ['#e8e8e8', '#4aa8ff', '#c46bff', '#ffd84a'];
const costChips = (g, c = {}) => {
  const out = [];
  if (c.gold) out.push(`<span class="need ${g.S.gold >= c.gold ? '' : 'no'}"><span class="coin"></span>${fmt(c.gold)}</span>`);
  for (const [id, n] of Object.entries(c.mats || {})) out.push(`<span class="need ${g.matCount(id) >= n ? '' : 'no'}" title="${esc(MATERIALS[id]?.name || id)}">${ico(MATERIALS[id]?.icon || id, 'ico inl')}${g.matCount(id)}/${n}</span>`);
  return out.join('');
};
const elTag = (el) => `<span class="el-tag" style="--el:${ELEMENTS[el].color}">${ELEMENTS[el].name}</span>`;
const U = {
  // the pet's growth box in the Pets window: XP, element, evolution
  petGrowBox(pd) {
    const g = this.g, S = g.S, st = S.pets[pd.id]; if (!st) return null;
    const E = g.petEvo(pd.id), nx = PET_EVO[(st.evo || 0) + 1], el = petElement(pd.id), max = st.lv >= PET_MAX_LV;
    const home = Object.entries(ZONE_ELEMENT).filter(([, e]) => e === el).map(([z]) => z);
    const box = h('div', 'pet-grow');
    box.innerHTML = `<div class="pg-row"><span>${'★'.repeat(st.evo || 0)}${E.name ? ` <b>${E.name}</b>` : ' Stage 1'}</span>${elTag(el)}</div>
      <div class="pg-xp"><span class="bar xp"><i style="width:${max ? 100 : Math.min(100, (st.xp || 0) / petNeed(st.lv) * 100)}%"></i></span><small>${max ? 'Max level' : `Pet XP ${fmt(st.xp || 0)} / ${fmt(petNeed(st.lv))} · grows from your kills while it is out`}</small></div>
      <small class="muted">Fights 25% harder in ${home.length ? esc(home.join(', ')) : 'its own lands'}.${E.mult > 1 ? ` Evolution: stats x${E.mult}, ability x${E.ab}.` : ''}</small>`;
    if (nx) {
      const r = h('div', 'pg-evo', `<div><b>Evolve: ${nx.name}</b><small>Lv ${nx.lv} · stats x${nx.mult}, ability x${nx.ab}, a bigger pet with a glow</small><div class="cost">${costChips(g, nx.cost)}</div></div>`);
      const b = h('button', 'btn small' + (st.lv >= nx.lv ? ' green' : ''), st.lv >= nx.lv ? 'Evolve' : `Lv ${nx.lv}`);
      b.disabled = st.lv < nx.lv || !g.canAfford(nx.cost); b.onclick = () => g.petEvolve(pd.id);
      r.appendChild(b); box.appendChild(r);
    } else box.appendChild(h('div', 'pg-evo done', '<b>Fully evolved</b>'));
    return box;
  },
  // the Pet Book: every pet's three stages
  petBookPanel(body) {
    const g = this.g, S = g.S, B = g.petBook();
    body.appendChild(h('div', 'pb-sum', `<b>${B.own} / ${PETS.length}</b> pets · <b>${B.stages} / ${PETS.length * 2}</b> evolutions · Collection bonus: <span class="good">+${B.hp.toFixed(1)}% Max HP, +${B.atk.toFixed(1)}% Attack, +${fmt(B.cp)} Combat Power</span>`));
    const grid = h('div', 'pb-grid');
    for (const pd of PETS) {
      const st = S.pets[pd.id], ev = st ? st.evo || 0 : -1;
      const row = h('div', 'pb-row' + (st ? '' : ' locked'));
      row.innerHTML = `<div class="pb-name"><b style="color:${RARC[pd.rarity]}">${st ? esc(pd.name) : '???'}</b>${elTag(petElement(pd.id))}</div>` + [0, 1, 2].map((i) => `<div class="pb-st${ev >= i ? ' on' : ''}" title="${i ? PET_EVO[i].name + ` (Lv ${PET_EVO[i].lv})` : 'Hatched'}"><img alt="" src="${g.petIcon(pd.id)}" style="transform:scale(${0.8 + i * 0.12})">${i ? `<i>${'★'.repeat(i)}</i>` : ''}</div>`).join('<span class="pb-ar">➜</span>');
      row.title = st ? '' : `How to obtain: ${pd.src}`;
      grid.appendChild(row);
    }
    body.appendChild(grid);
    body.appendChild(h('div', 'note', `Each pet you own adds +${BOOK.hp}% Max HP and each evolution stage +${BOOK.atk}% Attack to your hero. Evolution Stones drop from elites and bosses, the Sprite Realm and treasure hunts, and Mimi sells them.`));
  },
  // the Sprites tab: levels, talents, treasure hunts and the Sprite Realm
  spritePanel(body) {
    const g = this.g, S = g.S; g.compDay();
    const top = h('div', 'sp-top');
    const hb = h('button', 'btn small' + (S.hunt ? ' gray' : ' green'), S.hunt ? 'Hunting…' : `Treasure Hunt (${g.huntsLeft()}/${HUNTS_A_DAY})`);
    hb.disabled = !!S.hunt || !g.huntsLeft() || !S.activeSprite; hb.onclick = () => { if (g.huntStart()) this.closePanels(); };
    top.appendChild(h('span', 'muted', `${ico('sprite_essence', 'ico inl')} Sprite Essence ${g.matCount('sprite_essence')} · Sprite Realm ${g.realmLeft()}/${REALM_A_DAY} today`));
    top.appendChild(hb); body.appendChild(top);
    const list = h('div', 'list');
    for (const sd of SPRITES) {
      const own = S.sprites.includes(sd.id), st = own ? g.spriteSt(sd.id) : null, R = REALM[sd.id];
      const r = h('div', 'row sp-row' + (own ? '' : ' locked'));
      const k = own ? g.spriteK(sd.id) : 1;
      r.innerHTML = `<div class="ic"><img alt="" src="${g.spriteIcon(sd.id)}"></div><div class="tx"><b>${esc(sd.name)} <span style="color:var(--cyan);font-size:12px">${sd.element} Sprite${own ? ` · Lv ${st.lv}` : ''}</span></b>${esc(sd.desc)}${own && k > 1 ? ` <span class="good">(x${k.toFixed(2)})</span>` : ''}${own ? '' : `<br><span style="color:var(--dim)">Beat the ${esc(R.name)} in the Sprite Realm to win it</span>`}</div>`;
      const acts = h('div', 'sp-acts');
      if (own) { const b = h('button', S.activeSprite === sd.id ? 'btn gray small' : 'btn green small', S.activeSprite === sd.id ? 'Active' : 'Call'); b.onclick = () => g.setSprite(sd.id); acts.appendChild(b); }
      const rb = h('button', 'btn small blue', 'Sprite Realm'); rb.title = `Challenge the ${R.name} (a boss at your level)`; rb.disabled = !g.realmLeft() || !!g.realmFight;
      rb.onclick = () => { if (g.realmChallenge(sd.id)) this.closePanels(); }; acts.appendChild(rb);
      r.appendChild(acts);
      if (own) {
        const up = h('div', 'sp-up');
        if (st.lv < SPRITE_MAX) { const c = spriteUpCost(st.lv); up.innerHTML = `<span class="cost">${costChips(g, c)}</span>`; const b = h('button', 'btn small', `Level up ➜ ${st.lv + 1}`); b.disabled = !g.canAfford(c); b.onclick = () => g.spriteLevelUp(sd.id); up.appendChild(b); }
        else up.innerHTML = '<span class="good">Fully grown</span>';
        const tal = h('div', 'sp-tal');
        SPRITE_TALENTS.forEach((T, i) => {
          const row = h('div', 'sp-trow' + (st.lv < T.lv ? ' locked' : ''), `<small>Lv ${T.lv}</small>`);
          for (const o of T.opts) { const b = h('button', 'chip' + (st.tal[i] === o.id ? ' sel' : ''), `${o.name} <small>${o.desc}</small>`); b.disabled = st.lv < T.lv; b.onclick = () => g.spriteTalent(sd.id, i, o.id); row.appendChild(b); }
          tal.appendChild(row);
        });
        r.appendChild(up); r.appendChild(tal);
      }
      list.appendChild(r);
    }
    body.appendChild(list);
    body.appendChild(h('div', 'note', 'Sprite Essence comes from treasure hunts, the Sprite Realm and, now and then, from monsters. Talents only work while their sprite is the active one; changing a chosen talent costs 10,000 Gold.'));
  },
  // the mount's training box
  mountTrainBox(md) {
    const g = this.g, lv = g.mountLv(md.id), box = h('div', 'mt-box');
    box.innerHTML = `<b>Training Lv ${lv} / ${MOUNT_MAX}</b> <small class="muted">speed +${Math.round((g.mountSpeed(md.id) - 1) * 100)}% · Combat Power +${fmt(md.br * (1 + 0.15 * (lv - 1)))}</small>`;
    if (lv < MOUNT_MAX) { const c = mountUpCost(lv); box.appendChild(h('span', 'cost', costChips(g, c))); const b = h('button', 'btn small', `Train ➜ ${lv + 1}`); b.disabled = !g.canAfford(c); b.onclick = () => g.mountTrain(md.id); box.appendChild(b); }
    return box;
  },
};

export function installCompanions(Game) { Object.assign(Game.prototype, G); }
export function installCompanionsUI(UI) { Object.assign(UI.prototype, U); }
