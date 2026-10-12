// Core game: entities, input, camera, combat, AI, quests, inventory, loot, dungeons, pets, mounts and saving.
import * as THREE from 'three';
import {
  CLASSES, MONSTERS, SPAWNS, ZONES, PETS, SPRITES, CLASS_SPRITE, MOUNTS, ITEMS, NPCS, TELEPORTS, QUESTS, BOUNTY_TARGETS, SIGNIN, ONLINE_GIFTS, MALL, DUNGEONS,
  TITLES,
} from './data.js';
import { ARENA, TELEPORT_CIRCLE } from './world.js';
import {
  buildHumanoid, classLook, npcLook, buildMonster, buildPet, buildMount, buildSprite, animateHumanoid, animateCreature, blobShadow, HAIR_COLORS, EYE_COLORS,
} from './models.js';
import { buildDungeonMonster } from './models-dungeon.js';
import { buildEventMonster, buildEventPet, EVENT_PET_MODELS } from './models-event.js';
import { installSystems, initSystemsSave } from './systems.js';
import { installLife, initLifeSave } from './life.js';
import { installEconomy, initEconomySave } from './economy.js';
import { installUpgrade, stoneFor } from './upgrade.js';
import { installLive, liveBoost } from './live.js';
import { installMp } from './mp.js';
import { installParty } from './party.js';
import { installTrade } from './trade.js';
import { installSocial, cleanFriends } from './social.js';
import { installGuide, initGuideSave } from './guide.js';
import { UIZ } from './touchfit.js';
import { installSky } from './sky.js';
import { buildExtraMonster, EXTRA_MONSTER_MODELS } from './models-monsters.js';
import { buildExtraPet, buildExtraMount, EXTRA_PET_MODELS, EXTRA_MOUNT_MODELS } from './models-extra.js';
import { MAX_LEVEL, curveStats, DUNGEON_RULES, RELIC_SETS } from './data-world.js';
import { CHAPTERS } from './data-story.js';
import { setOfDungeon } from './data-sets.js';
import { PET_ABILITIES, PET_MAX_LV, petAbilityValue } from './data-pets.js';
import { installCombat } from './combat.js';
import { installCombatWorld } from './combat-world.js';
import { installProgress, xpNext, expScale } from './progress.js';
import { installTrials } from './trials.js';
import { installNavigation, WALK_MAX } from './nav-world.js';
import { installGear } from './gear.js';
import { heroLook } from './models.js';
import { rankMult } from './data-classes.js';
import { installGather, initToolBelt } from './gather.js';
import { installTailor } from './tailor.js';
import { installDangerZone, DZ_ZONE } from './dz.js';
import { STARTER_TOOLS } from './data-crafting.js';
import { activeEvent } from './systems-data.js';
import { Dungeon } from './dungeon.js';
import {
  RARITY, EFFECTS, rollRarity, genEquip, genNamed, genSet, namedBySource, normalizeItem, aggregateEquip, sellPrice, tierFor,
} from './loot.js';
import { ico, iconCanvas } from './icons.js';
import { shadowTexture, textTexture, targetRingTexture, beamTexture, ringTexture, glowTexture } from './toon.js';

export const SAVE_KEY = 'alfheim_tales_save_v1';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * t; };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const rankMultOf = (g, id) => rankMult(g.S.skills?.[id] || 1);
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const POTION_TIERS = { hp: [['potion_hp3', 0.7], ['potion_hp2', 0.5], ['hp_potion', 0.35]], mp: [['potion_mp3', 0.7], ['potion_mp2', 0.5], ['mp_potion', 0.35]] };
export const PET_TIER = [1, 2, 3, 5]; // pet rarity (Common, Rare, Special, Legendary) -> item tier colors

export function newSave({ name, cls, gender, hair, eye, app }) {
  return migrateSave({
    v: 2, name, cls, gender, hair, eye, app, level: 1, exp: 0, gold: 200, diamonds: 20,
    bag: [{ id: 'hp_potion', qty: 5 }, { id: 'mp_potion', qty: 5 }], tools: Object.fromEntries(STARTER_TOOLS.map((id) => [ITEMS[id].tool, id])), toolsGiven: true, equip: {}, pets: {}, activePet: null,
    sprites: [], activeSprite: null, mounts: [], activeMount: null, wings: false,
    quest: { id: 'q1', status: 'available', prog: 0 }, bounty: null, skills: {}, loadout: [null, null, null, null, null, null], ult: null, awaken: null,
    signin: { count: 0, last: '' }, gift: { idx: 0, t: 0 }, pos: null, kills: {}, title: 0, uid: 1,
    settings: { others: true, autoPotion: true, autoLoot: true, shadows: true, sound: true, weather: true },
  });
}
const HOST_NAMES = { harvest: 'Pumpkin Pam', winter: 'Frosty Fay', sakura: 'Blossom Bea' };
const PET_BUILD = (model) => (EVENT_PET_MODELS.has(model) ? buildEventPet(model) : EXTRA_PET_MODELS.has(model) ? buildExtraPet(model) : buildPet(model));
const MOUNT_BUILD = (model) => (EXTRA_MOUNT_MODELS.has(model) ? buildExtraMount(model) : buildMount(model));
// Monster model by family: guild-war rivals are humanoids, event/world-boss models and dungeon models have their own builders.
const DUNGEON_MODELS = new Set(['cavejelly', 'sporeling', 'mossbeast', 'queenjelly', 'boneknight', 'wisp', 'cryptgolem', 'gravelord', 'rootwolf', 'blightspore', 'rottreant', 'nidhogg']);
function monsterModel(d, variant, look) {
  if (EXTRA_MONSTER_MODELS.has(d.model)) return buildExtraMonster(d.model, d.variant ?? variant);
  if (d.model === 'rival') { const h = buildHumanoid(look || classLook('knight', 'm', HAIR_COLORS[0], EYE_COLORS[0])); h.userData.humanoid = true; return h; }
  if (d.event) return buildEventMonster(d.model, d.variant ?? variant);
  if (d.dungeon || DUNGEON_MODELS.has(d.model)) return buildDungeonMonster(d.model, d.variant ?? variant);
  return buildMonster(d.model, variant);
}
// Upgrades saves from older versions in place (v1: 5 item tiers, emoji icons, no dungeons).
export function migrateSave(S) {
  if (!S) return S;
  S.settings = { others: true, autoPotion: true, autoLoot: true, shadows: true, sound: true, weather: true, ...(S.settings || {}) };
  S.dgn = S.dgn || { date: '', used: {}, best: {}, clears: {} };
  // heroes from before races and appearance sliders become Sylvans (they always had elf ears)
  if (!S.app) S.app = { race: 'sylvan', body: S.gender === 'm' ? 'a' : 'b', hair: S.hair || '#6a4024', eye: S.eye || '#3a2a20', skin: '#f2cdb4', face: 'round', build: 0.5, height: 0.5, helm: true };
  S.skills = S.skills || {}; if (!Array.isArray(S.loadout) || S.loadout.length !== 6) S.loadout = [null, null, null, null, null, null];
  if (S.awaken === undefined) S.awaken = null; if (S.ult === undefined) S.ult = null;
  delete S.tree; delete S.talent; delete S.skillLv;
  for (const b of S.bag || []) if (b.eq) normalizeItem(b.eq, S.cls);
  for (const k of Object.keys(S.equip || {})) if (S.equip[k]) normalizeItem(S.equip[k], S.cls);
  S.bag = (S.bag || []).filter((b) => b.eq || ITEMS[b.id]);
  initToolBelt(S);
  initSystemsSave(S); initLifeSave(S); initEconomySave(S);
  S.friends = cleanFriends(S.friends);
  initGuideSave(S);
  if (!S.quest || (!S.quest.id && S.quest.status === 'done' && !S.storyDone)) S.quest = { id: 'q11', status: 'available', prog: 0 }; // Chapter I used to end here
  S.v = 3;
  return S;
}
export function needExp(l) { return xpNext(l); }
// which Bag tab an entry belongs to
const BAG_USE = new Set(['consumable', 'elixir', 'food']), BAG_VAL = new Set(['egg', 'ticket', 'sigil', 'survey', 'material']);
export function bagCat(b) {
  if (b.eq) return 'gear';
  const t = ITEMS[b.id]?.type;
  return t === 'quest' ? 'quest' : BAG_USE.has(t) ? 'use' : BAG_VAL.has(t) ? 'val' : 'other';
}
const BEASTS = /^(bunny|wolf|rootwolf|boar|frog|croc|yeti|stag|behemoth|drake)$/;

export class Game {
  constructor(o) {
    Object.assign(this, o); // renderer, scene, camera, world, fx, portraits, ui, sfx, S, sun, lights
    this.time = 0; this.timers = [];
    this.monsters = []; this.npcs = []; this.ents = []; this.loots = []; this.portals = [];
    this.keys = {}; this.stick = { x: 0, y: 0 }; this.cd = {}; this.potionCD = 0;
    this.cam = { yaw: 0.35, pitch: 0.6, dist: 15, target: new THREE.Vector3() };
    this.auto = false; this.autoPathing = false; this.engage = false; this.pendingSkill = null; this.pendingTalk = null;
    this.mounted = false; this.lastCombat = -99; this.zone = null; this.saveT = 0; this.swarmHits = 0;
    this.layer = document.getElementById('world-ui');
    this.ray = new THREE.Raycaster();
    this.map = this.world; this.dg = null;
    this.mods = { stats: {}, effects: new Set() }; this.hitCount = 0; this.phoenixCD = 0; this.novaT = 8; this.procCD = {}; this.chg = {}; this.runes = 0; this.runeT = 0; this.summons = []; this.zones = []; this.traps = []; this.stillT = 0;
    this.war = null; this.wb = null; this.event = activeEvent();
  }

  // ============================================================== setup
  start() {
    const S = this.S;
    this.initProgress();
    this.createPlayer();
    this.dzInit();
    let p = S.pos || { x: 0, z: 9 };
    if (Math.abs(p.x) > 380 || Math.abs(p.z) > 380) p = { x: 0, z: 9 };
    this.player.pos.set(p.x, this.world.heightAt(p.x, p.z), p.z);
    this.player.yaw = Math.PI;
    for (const n of NPCS) {
      if (n.event && !this.event) continue;
      this.createNPC(n.event ? { ...n, name: HOST_NAMES[this.event.id] || n.name } : n);
    }
    for (const sp of SPAWNS) for (let i = 0; i < sp.count; i++) this.createMonster(sp);
    this.createPortals();
    this.initSystems();
    this.initLife();
    this.initEconomy();
    this.initCampfires();
    this.initNavigation();
    this.skyInit();
    this.prestigeInit();
    this.targetRing = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ map: targetRingTexture('#ff4a3a'), transparent: true, depthWrite: false }));
    this.targetRing.rotation.x = -Math.PI / 2; this.targetRing.visible = false; this.targetRing.renderOrder = 2;
    this.scene.add(this.targetRing);
    this.recalc(true);
    this.applyAura(this.player, this.myAuraColor());
    this.syncPet(); this.syncSprite();
    this.cam.target.copy(this.player.pos);
    this.ui.bind(this);
    this.ui.refreshAll();
    this.initLive();
    this.tradeInit();
    this.mpStart();
    this.ui.chat('system', 'Welcome to <b>Carlyle</b>! Click the quest in the tracker on the right to auto-path to your goal.');
    this.ui.chat('system', 'Controls: click to move or attack · drag to turn the camera · scroll to zoom · 1–7 skills · Shift dodge roll · Space jump · R mount · T auto battle.');
    this.ui.chat('system', 'Daily & Weekly <b>Missions</b> (H), <b>World Bosses</b> every 15 minutes, the <b>Season Pass</b> and leaderboards. <b>Professions</b> (Z): gather ore, herbs and wood and farm the homestead west of town.');
    this.ui.chat('system', 'Town services are run by their keepers in Sylvan Haven: <b>Gorm</b> (Forge), <b>Opal</b> (Gem Workshop), <b>Vera</b> (Alchemy), <b>Mira</b> (Market), <b>Grimsby</b> (Auction House), <b>Aldric</b> (Guilds) and <b>Coco</b> (Wardrobe). Thalia the Trial Warden guards the walls every 20 levels.');
    if (this.event) this.ui.chat('announce', `<b>[Festival]</b> The <span style="color:${this.event.color}">${esc(this.event.name)}</span> is on! ${esc(this.event.desc)}`);
    if (S.level === 1 && S.quest.id === 'q1') setTimeout(() => this.ui.banner('Sylvan Haven', 'Carlyle · Town', 'zone'), 400);
    this.bindInput();
    if (S.mounts.length && S.activeMount && S.wasMounted) this.mount(true);
  }

  createPortals() {
    for (const gt of this.world.gates || []) {
      const e = { kind: 'portal', def: gt.def, gate: gt, pos: new THREE.Vector3(gt.front.x, this.world.heightAt(gt.front.x, gt.front.z), gt.front.z), height: 7, radius: 3.5, model: gt.model, dead: false };
      e.center = new THREE.Vector3(gt.x, this.world.heightAt(gt.x, gt.z), gt.z);
      this.nameplate(e, `<div class="t">&lt;Dungeon · Lv ${gt.def.lv}+&gt;</div><div class="n">${esc(gt.def.name)}</div>`, 'npc portal');
      e.npY = 8.5;
      this.portals.push(e);
    }
  }

  makeEnt(kind, inner, o = {}) {
    const model = new THREE.Group();
    model.add(inner);
    const sh = blobShadow(o.shadowR || 0.65, shadowTexture()); sh.position.y = 0.06; model.add(sh);
    this.scene.add(model);
    const e = {
      kind, model, inner, pos: model.position, yaw: 0, yawT: 0, name: o.name || '', level: o.level || 1,
      hp: 1, maxHp: 1, mp: 0, maxMp: 0, atk: 10, def: 5, crit: 5, critDmg: 0.6, speed: o.speed || 5,
      height: o.height || inner.userData.height || 2, radius: o.radius || 0.7, dead: false, state: 'idle',
      actT: 0, actDur: 1, attackCD: 0, stun: 0, buffs: [], shield: 0, path: [], target: null, vy: 0, jumpY: 0, t0: Math.random() * 10,
    };
    this.ents.push(e);
    return e;
  }

  nameplate(e, html, cls, hp = false) {
    const el = document.createElement('div');
    el.className = 'np stroke ' + cls;
    el.innerHTML = html + (hp ? '<div class="hb"><i></i></div>' : '');
    this.layer.appendChild(el);
    e.np = el; e.npHb = hp ? el.querySelector('.hb i') : null;
  }

  playerLook() { return this.lookFor ? this.lookFor(this.S) : heroLook(this.S.cls, this.S.app, { wings: this.S.wings }); }

  createPlayer() {
    const S = this.S;
    const inner = buildHumanoid(this.playerLook());
    const p = this.makeEnt('player', inner, { name: S.name, radius: 0.6 });
    p.humanoid = inner;
    this.player = p;
    this.nameplate(p, '', 'me', true);
    this.refreshPlayerPlate();
  }
  refreshPlayerPlate() {
    const S = this.S;
    const t = TITLES[Math.min(TITLES.length - 1, S.title)];
    if (S.titles && !S.titles.includes(S.title)) S.titles.push(S.title);
    const g = S.guild ? `<div class="g">&lt;${esc(S.guild.name)}&gt;</div>` : '';
    this.player.np.innerHTML = `${g}<div class="t">«${esc(t)}»</div><div class="n">${esc(S.name)}</div><div class="hb"><i></i></div>`;
    this.player.npHb = this.player.np.querySelector('.hb i');
  }
  rebuildPlayerModel() {
    const p = this.player, old = p.humanoid;
    const inner = buildHumanoid(this.playerLook());
    old.parent.add(inner); old.parent.remove(old);
    inner.position.copy(old.position); inner.rotation.copy(old.rotation);
    p.humanoid = inner; if (p.inner === old) p.inner = inner;
    this.portraits.cache.delete('player-head'); this.portraits.cache.delete('player-full');
  }

  createNPC(n) {
    const look = npcLook(n.look);
    const inner = buildHumanoid(look);
    const e = this.makeEnt('npc', inner, { name: n.name, radius: 0.8 });
    const y = this.world.heightAt(n.x, n.z);
    e.pos.set(n.x, y + (n.look === 'sylphie' ? 0.6 : 0), n.z);
    e.baseY = e.pos.y; e.yaw = e.homeYaw = n.face; e.data = n; e.id = n.id; e.humanoid = inner;
    e.float = n.look === 'sylphie';
    // role icon before the name so each keeper is easy to spot (the same icon marks them on the maps)
    this.nameplate(e, `<div class="t">&lt;${esc(n.title)}&gt;</div><div class="n">${n.icon ? ico(n.icon, 'ico npi') : ''}${esc(n.name)}</div>`, 'npc');
    const mk = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture('!'), depthWrite: false }));
    mk.scale.setScalar(1.3); mk.visible = false; e.marker = mk; this.scene.add(mk);
    this.npcs.push(e);
  }

  monsterStats(type, lvl) {
    const d = MONSTERS[type], k = lvl - d.lvl[0];
    if (d.curve) return curveStats(lvl, d.curve);
    // festival monsters roam at Lv 2-13; above Lv 15 (a world boss's helpers) they follow the normal level curve
    if (d.festival) return lvl > 15 ? curveStats(lvl) : { hp: Math.round(d.hp * Math.pow(1.28, lvl - 1)), atk: d.atk * Math.pow(1.2, lvl - 1), def: d.def + lvl * 1.8 };
    const hard = d.dungeon ? 1.5 : 1; // dungeon monsters hit harder and last longer than their overworld cousins
    return { hp: Math.round(d.hp * (1 + 0.18 * k) * hard), atk: d.atk * (1 + 0.1 * k) * (d.dungeon ? 1.25 : 1), def: d.def * (1 + 0.08 * k) };
  }
  // exp / gold multipliers for a kill (festival monsters follow the level curve of the zone they live in)
  killScale(d, lvl) {
    if (d.festival && lvl > 15) { const c = curveStats(lvl); return { exp: c.exp / d.exp, gold: (c.gold[0] + c.gold[1]) / (d.gold[0] + d.gold[1]) }; }
    if (d.festival) return { exp: Math.pow(1.27, lvl - 1), gold: Math.pow(1.2, lvl - 1) };
    return { exp: 1 + 0.15 * (lvl - d.lvl[0]), gold: 1 + 0.1 * (lvl - d.lvl[0]) };
  }
  createMonster(sp, o = {}) {
    const d = MONSTERS[sp.type];
    const variant = d.variant ?? ((Math.random() * 3) | 0);
    const inner = monsterModel(d, variant, o.look);
    if (d.scale && d.scale !== 1) inner.scale.multiplyScalar(d.scale);
    const e = this.makeEnt('monster', inner, { radius: d.boss ? 3 : d.structure ? 2.6 : d.elite ? 1.6 : d.height > 3 ? 1.4 : d.war ? 0.6 : 0.9, shadowR: d.boss ? 4 : d.structure ? 2.4 : d.elite || d.height > 3 ? 1.6 : 0.85, height: d.height });
    e.type = sp.type; e.def0 = d; e.spawn = sp; e.speed = d.speed;
    e.baseScale = inner.scale.x || 1;
    if (inner.userData.humanoid) e.humanoid = inner;
    e.map = o.map || this.world; e.dungeon = !!o.dungeon; e.room = o.room ?? -1; e.summoned = !!o.summoned; e.fixed = o.fixed || null;
    if (d.dz) { e.dz = true; this.dzTint(e); }
    const cls = 'monster' + (d.aggressive ? ' aggr' : '') + (d.elite ? ' elite' : '') + (d.boss ? ' boss' : '');
    this.nameplate(e, `<div class="n"></div>`, cls, true);
    this.respawn(e, true, o.exact);
    this.monsters.push(e);
    return e;
  }
  respawn(e, first = false, exact = false) {
    const sp = e.spawn, d = e.def0, W = e.map || this.world;
    let x = sp.x, z = sp.z;
    if (!exact) for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp.r;
      x = sp.x + Math.cos(a) * r; z = sp.z + Math.sin(a) * r;
      if (!W.isBlocked(x, z)) break;
    }
    const lr = sp.lvl || d.lvl;
    e.level = e.fixed?.level ?? (d.dz ? this.dzMonsterLevel(e) : Math.round(rnd(lr[0], lr[1])));
    const st = e.fixed || this.monsterStats(e.type, e.level);
    e.maxHp = e.hp = st.hp; e.atk = st.atk; e.def = st.def; e.crit = d.boss ? 8 : 4;
    e.pos.set(x, W.heightAt(x, z), z);
    e.home = { x, z };
    e.dead = false; e.state = 'idle'; e.target = null; e.returning = false; e.tagged = false; e.stun = 0; e.dots = [];
    e.model.visible = true; e.inner.position.y = 0; e.inner.scale.setScalar(e.baseScale || 1);
    e.wanderT = rnd(1, 5); e.attackCD = 1; e.skillT = 6;
    e.yaw = e.yawT = Math.random() * Math.PI * 2;
    if (e.np) {
      const tag = d.boss ? '[Boss] ' : d.elite ? '[Elite] ' : '';
      if (e.labelHtml) e.np.querySelector('.n').innerHTML = e.labelHtml;
      else e.np.querySelector('.n').textContent = `${tag}Lv${e.level} ${d.name}`;
    }
    if (!first) {
      this.fx.spawnPuff(e.pos, 0xffffff);
      if (d.boss && !e.dungeon && !d.worldBoss) this.ui.chat('announce', `<b>[Announcement]</b> ${d.name} has awakened in ${esc(this.world.zoneAt(sp.x, sp.z, ZONES)?.name || 'Carlyle')}!`);
    }
  }
  removeEnt(e) {
    e.dead = true; e.removed = true;
    this.scene.remove(e.model);
    e.np?.remove();
    this.ents = this.ents.filter((x) => x !== e);
    this.monsters = this.monsters.filter((x) => x !== e);
    if (this.player.target === e) this.setTarget(null);
  }

  // ============================================================== stats
  recalc(fill = false) {
    const S = this.S, C = CLASSES[S.cls], L = S.level, p = this.player;
    let hp = C.base.hp + C.grow.hp * (L - 1), mp = C.base.mp + C.grow.mp * (L - 1), atk = C.base.atk + C.grow.atk * (L - 1), def = C.base.def + C.grow.def * (L - 1);
    let crit = C.base.crit, critDmg = 0.6, speed = C.speed, heal = 1, cdr = 0;
    const G = aggregateEquip(S.equip || {}, this.gearCtx ? this.gearCtx() : null), gs = G.stats || {}, fxs = new Set(G.effects || []);
    this.awakenIds = G.awaken || [];
    hp += gs.hp || 0; atk += gs.atk || 0; def += gs.def || 0; crit += gs.crit || 0; critDmg += (gs.critDmg || 0) / 100;
    let petBR = 0;
    if (S.activePet) { const pd = PETS.find((x) => x.id === S.activePet), lv = S.pets[S.activePet]?.lv || 1; hp += pd.hp * (1 + 0.15 * (lv - 1)); petBR = (pd.atk * 12 + pd.hp) * (1 + 0.15 * (lv - 1)); }
    let spBR = 0;
    if (S.activeSprite) {
      const sd = SPRITES.find((x) => x.id === S.activeSprite), m = sd.mods || {};
      atk *= m.atk || 1; def *= m.def || 1; speed *= m.speed || 1; crit += m.crit || 0; spBR = 260;
    }
    if (S.wings) { hp *= 1.05; atk *= 1.05; }
    const X = this.systemMods ? this.systemMods() : { atk: 0, hp: 0, br: 0 };
    hp *= 1 + X.hp; atk *= 1 + X.atk;
    const EL = this.elixirMods ? this.elixirMods() : {};
    atk *= EL.atk || 1; def *= EL.def || 1; speed *= EL.speed || 1;
    if (fxs.has('worldtree')) hp *= 1.2;
    // the summoned pet's passive ability
    const PA = this.petFx = this.petAbility();
    if (PA) {
      const v = PA.v / 100;
      if (PA.kind === 'speed') speed *= 1 + v;
      else if (PA.kind === 'might') { atk *= 1 + v; def *= 1 + v; }
      else if (PA.kind === 'crit') crit += PA.v;
      else if (PA.kind === 'vigor' || PA.kind === 'guardian') hp *= 1 + v;
      else if (PA.kind === 'cdr') cdr += v;
      else if (PA.kind === 'dragon') { atk *= 1 + v; critDmg += v * 2; }
    }
    // passive class skills and race bonuses
    if (this.syncSkills().length && this.ui?.refreshSkills) this.ui.refreshSkills();
    const PA2 = this.pAgg = this.passiveAgg(), ps = PA2.stat;
    hp *= 1 + (ps.hpPct || 0) / 100; mp *= 1 + (ps.mpPct || 0) / 100; atk *= 1 + (ps.atkPct || 0) / 100; def *= 1 + (ps.defPct || 0) / 100;
    // gear percentages (set bonuses and Special passives)
    hp *= 1 + ((gs.hpPct || 0) + (gs.allPct || 0)) / 100; atk *= 1 + ((gs.atkPct || 0) + (gs.allPct || 0)) / 100; def *= 1 + ((gs.defPct || 0) + (gs.allPct || 0)) / 100; heal *= 1 + (gs.healPct || 0) / 100;
    crit += ps.crit || 0; critDmg += (ps.critDmg || 0) / 100; speed *= 1 + (ps.speedPct || 0) / 100; heal *= 1 + (ps.healPct || 0) / 100;
    // Battle Hardened: +1% attack per 5% of defense above the class base
    if (PA2.rules.has('battleHardened')) { const d0 = C.base.def + C.grow.def * (L - 1); atk *= 1 + Math.max(0, (def / d0 - 1) * 100) / 500 * rankMultOf(this, 'gd_hardened'); }
    speed *= 1 + (gs.speed || 0) / 100;
    if (fxs.has('swift')) speed *= 1.12;
    cdr = Math.min(0.5, cdr + (gs.cdr || 0) / 100);
    this.mods = { stats: gs, effects: fxs };
    const mountBR = S.mounts.reduce((a, id) => a + (MOUNTS.find((m) => m.id === id)?.br || 0), 0);
    const ratio = p.maxHp > 1 ? p.hp / p.maxHp : 1, mratio = p.maxMp > 1 ? p.mp / p.maxMp : 1;
    if (this.trial) ({ hp, mp, atk, def, crit, critDmg, speed } = this.trialStats(ps)); // the same for every hero of the class
    p.maxHp = Math.round(hp); p.maxMp = Math.round(mp); p.atk = atk; p.def = def; p.crit = crit; p.critDmg = critDmg; p.baseSpeed = speed; p.level = L;
    p.hp = fill ? p.maxHp : Math.max(1, Math.round(p.maxHp * ratio)); p.mp = fill ? p.maxMp : Math.round(p.maxMp * mratio);
    this.healMod = heal; this.cdr = cdr;
    const extras = (gs.critDmg || 0) * 4 + (gs.speed || 0) * 10 + (gs.lifesteal || 0) * 25 + (gs.cdr || 0) * 20 + (gs.expGain || 0) * 3 + (gs.goldFind || 0) * 2
      + (gs.thorns || 0) * 6 + (gs.regen || 0) * 8 + (gs.manaCost || 0) * 6 + [...fxs].reduce((a, id) => a + (EFFECTS[id]?.tier === 'legendary' ? 900 : EFFECTS[id]?.tier === 'set' ? 700 : EFFECTS[id]?.tier === 'ancient' ? 1100 : 350), 0);
    // Battle Rating (a guide only): level x 100 + item stats x tier multiplier + average mastery x 50
    this.br = this.calcBR ? this.calcBR() : Math.round(p.maxHp * 0.55 + atk * 9 + def * 7);
    void petBR; void spBR; void mountBR; void extras;
    if (this.refreshGearGlow && this.player) this.refreshGearGlow();
    this.ui.refreshPlayer && this.ui.refreshPlayer();
  }
  hasFx(id) { return this.mods.effects.has(id); }
  // the summoned pet's ability with its number at the pet's level, or null
  petAbility() {
    const id = this.S.activePet, ab = id && PET_ABILITIES[id];
    return ab ? { ...ab, v: petAbilityValue(ab, this.S.pets[id]?.lv || 1) } : null;
  }
  petIs(kind) { return this.petFx?.kind === kind; }
  stat(k) { return this.mods.stats[k] || 0; }
  mpCost(sk) { let c = sk.mp * (1 - Math.min(60, this.stat('manaCost')) / 100); if (this.hasFx('mana_font')) c *= 0.7; return Math.round(c); }
  buffMod(e, key) { let m = 1; for (const b of e.buffs) if (b.mods && b.mods[key] && key !== 'crit') m *= b.mods[key]; return m; }
  atkOf(e) { return e.atk * this.buffMod(e, 'atk'); }
  defOf(e) { return e.def * this.buffMod(e, 'def') * (e === this.player ? this.defStanceMult() : e.kind === 'monster' ? this.monsterDefMult(e) : 1); }
  critOf(e) { let c = e.crit; for (const b of e.buffs) if (b.mods && b.mods.crit) c += b.mods.crit; return c; }
  speedOf(e) {
    if (e === this.player) return e.baseSpeed * this.buffMod(e, 'speed') * (this.rule('nightwalker') && this.pflag('stealth') ? 1.3 : 1) * (this.mounted ? (MOUNTS.find((m) => m.id === this.S.activeMount)?.speed || 1.4) : 1);
    return e.speed * (e.mounted ? e.mountSpeed : 1);
  }

  // ============================================================== input
  bindInput() {
    const cv = this.renderer.domElement;
    const ptrs = new Map(); let drag = null, pinch = 0;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      this.sfx.ensure();
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, moved: false };
      if (e.button === 2 && this.S.cls === 'knight') { this.blockHold = true; this.startBlock(); } // hold the right mouse button to block
      document.activeElement && document.activeElement.blur && document.activeElement !== document.body && document.activeElement.blur();
    });
    cv.addEventListener('pointermove', (e) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.cam.dist = THREE.MathUtils.clamp(this.cam.dist * (pinch / Math.max(1, d)), 6, 30); pinch = d; return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) drag.moved = true;
        if (drag.moved) {
          this.cam.yaw -= dx * 0.006; this.cam.pitch = THREE.MathUtils.clamp(this.cam.pitch + dy * 0.004, 0.18, 1.35);
        }
        drag.x = e.clientX; drag.y = e.clientY;
      } else {
        const h = this.pick(e.clientX, e.clientY);
        cv.style.cursor = h ? (h.kind === 'monster' ? 'crosshair' : 'pointer') : 'default';
      }
    });
    const up = (e) => {
      ptrs.delete(e.pointerId);
      if (e.button === 2) this.blockHold = false;
      if (drag && !drag.moved && drag.btn === 0 && ptrs.size === 0) this.onClick(e.clientX, e.clientY);
      if (ptrs.size === 0) drag = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); drag = null; this.blockHold = false; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.cam.dist = THREE.MathUtils.clamp(this.cam.dist * (1 + Math.sign(e.deltaY) * 0.1), 6, 30); }, { passive: false });
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys = {}; this.blockHold = false; this.setStick(0, 0); });
  }

  // on-screen joystick: x right, y down (towards the camera), each -1..1; 0, 0 when released
  setStick(x, y) {
    const was = !!(this.stick.x || this.stick.y);
    this.stick.x = x; this.stick.y = y;
    if ((x || y) && !was) { this.player.path = []; this.autoPathing = false; this.pendingTalk = null; this.pendingPortal = null; this.pendingLife = null; this.ui.setAutoPath(false); }
  }
  onKey(e, down) {
    const adm = document.getElementById('scr-admin'); if (adm && !adm.hidden) return;
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (down && e.key === 'Escape') e.target.blur();
      return;
    }
    const k = e.key.toLowerCase();
    this.keys[k] = down;
    if (!down) return;
    if (this.player.dead && k !== 'escape') return;
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) { this.player.path = []; this.autoPathing = false; this.pendingTalk = null; this.pendingPortal = null; this.pendingLife = null; this.ui.setAutoPath(false); if (k.startsWith('arrow')) e.preventDefault(); return; }
    const dk = /^(?:Digit|Numpad)(\d)$/.exec(e.code || '')?.[1] ?? (k >= '0' && k <= '9' ? k : null); // the key itself, so Shift+1 still casts
    if (dk >= '1' && dk <= '7') { this.useSkill(+dk); return; }
    if (dk === '8' || dk === '9' || dk === '0') { this.useToolSlot({ 8: 'axe', 9: 'pick', 0: 'sickle' }[dk]); return; }
    switch (k) {
      case 'q': this.usePotion('hp_potion'); break;
      case 'e': this.usePotion('mp_potion'); break;
      case 'r': this.toggleMount(); break;
      case 't': this.toggleAuto(); break;
      case 'f': { const n = this.npcs.filter((x) => flat(x.pos, this.player.pos) < 6).sort((a, b) => flat(a.pos, this.player.pos) - flat(b.pos, this.player.pos))[0]; if (n) this.talkTo(n); break; }
      case ' ': e.preventDefault(); this.jump(); break;
      case 'shift': if (!e.repeat) this.roll(); break;
      case 'tab': e.preventDefault(); this.cycleTarget(); break;
      case 'enter': e.preventDefault(); this.ui.focusChat(); break;
      case 'escape': if (!this.ui.closeTop()) { this.setTarget(null); this.engage = false; } break;
      case 'c': this.ui.togglePanel('char'); break;
      case 'b': case 'i': this.ui.togglePanel('bag'); break;
      case 'k': this.ui.togglePanel('skills'); break;
      case 'p': this.ui.togglePanel('pets'); break;
      case 'u': this.ui.togglePanel('mounts'); break;
      case 'l': this.ui.togglePanel('quests'); break;
      case 'm': this.ui.togglePanel('map'); break;
      case 'o': this.ui.togglePanel('settings'); break;
      case 'g': this.ui.togglePanel('guild'); break;
      case 'h': this.ui.togglePanel('missions'); break;
      case 'n': this.ui.togglePanel('market'); break;
      case 'y': if (this.ui.sel.fgTab === 'gems') this.ui.sel.fgTab = 'enhance'; this.ui.togglePanel('forge'); break;
      case 'x': this.ui.togglePanel('codex'); break;
      case 'j': this.ui.togglePanel('season'); break;
      case 'z': if (['alchemy', 'smithing', 'red'].includes(this.ui.sel.lifeTab)) this.ui.sel.lifeTab = 'gather'; this.ui.togglePanel('life'); break;
      case 'v': this.ui.togglePanel('wardrobe'); break;
    }
  }

  screenOf(v) {
    const p = v.clone().project(this.camera);
    const w = this.renderer.domElement.clientWidth, h = this.renderer.domElement.clientHeight;
    return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * h, z: p.z };
  }
  pick(sx, sy) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = sx - rect.left, y = sy - rect.top;
    let best = null, bd = Infinity;
    const focal = rect.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));
    const extra = this.trial ? this.trial.ents.filter((e) => e.model) : this.dg ? [this.dg.chestEnt, this.dg.exitEnt].filter(Boolean) : this.war ? [] : [...this.portals, ...(this.lifeEnts || []), ...(this.dzBags || []), ...(this.S.settings.others ? this.rplayers || [] : []).filter((e) => !e.netHidden)];
    const cands = [...this.monsters, ...this.npcs, ...this.loots.filter((l) => l.map === this.map), ...extra];
    for (const e of cands) {
      if (e.dead || !e.model.visible) continue;
      if (e.map && e.map !== this.map) continue;
      const c = e.pos.clone(); c.y += e.height * 0.5;
      const dcam = c.distanceTo(this.camera.position);
      if (dcam > 120) continue;
      const s = this.screenOf(c); if (s.z > 1) continue;
      const rpx = Math.max(16, (Math.max(e.radius, e.height * 0.45) / dcam) * focal);
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < rpx && dcam < bd) { bd = dcam; best = e; }
    }
    return best;
  }
  groundPoint(sx, sy) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((sx - rect.left) / rect.width) * 2 - 1, -((sy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    let prev = 0;
    for (let t = 0.5; t < 400; t += t < 40 ? 0.5 : 2) {
      const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
      if (y <= this.map.heightAt(x, z)) {
        let a = prev, b = t;
        for (let i = 0; i < 12; i++) { const m = (a + b) / 2; const mx = o.x + d.x * m, my = o.y + d.y * m, mz = o.z + d.z * m; if (my <= this.map.heightAt(mx, mz)) b = m; else a = m; }
        return new THREE.Vector3(o.x + d.x * b, o.y + d.y * b, o.z + d.z * b);
      }
      prev = t;
    }
    return null;
  }

  onClick(x, y) {
    if (this.player.dead) return;
    const h = this.pick(x, y);
    if (this.ui.pmenuKey) this.ui.playerMenu(null);
    if (h) {
      if (h.kind === 'monster') { this.setTarget(h); this.engage = true; this.player.path = []; this.pendingTalk = null; this.autoPathing = false; this.ui.setAutoPath(false); return; }
      if (h.kind === 'npc') { this.talkTo(h); return; }
      if (h.kind === 'rp') { this.setTarget(h); if (this.pvpFoe(h)) { this.engage = true; this.player.path = []; this.pendingTalk = null; } else this.ui.playerMenu(h, x, y); return; }
      if (h.kind === 'dzbag') { this.engage = false; this.pendingTalk = null; this.pathTo(h.pos.x, h.pos.z, false); return; }
      if (h.kind === 'loot' || h.kind === 'chest' || h.kind === 'exit') { this.engage = false; this.pendingTalk = null; this.pathTo(h.pos.x, h.pos.z, false); return; }
      if (h.kind === 'portal') { this.goToPortal(h); return; }
      if (['node', 'plot', 'campfire', 'forage', 'lore', 'waystone'].includes(h.kind)) { this.lifeClick(h); return; }
    }
    const g = this.groundPoint(x, y);
    if (g) { this.engage = false; this.pendingSkill = null; this.pendingTalk = null; this.pendingPortal = null; this.pendingLife = null; this.pathTo(g.x, g.z, false); this.fx.clickMarker(g); }
  }

  // click-to-move reaches what you can see (WALK_MAX); quest auto-paths (far = true) go all the way, mounting up for long trips
  pathTo(x, z, auto = true, far = false) {
    const p = this.player;
    if (!far && flat(p.pos, { x, z }) > WALK_MAX) { p.path = []; this.autoPathing = false; this.ui.setAutoPath(false); this.ui.toast(`Too far to walk there in one go: it lies ${this.directionsTo(x, z, 'it').replace(/^Head /, '')}`, 'warn'); return false; }
    if (!far) auto = false;
    p.path = this.map.findPath(p.pos.x, p.pos.z, x, z);
    this.autoPathing = auto && flat(p.pos, { x, z }) > 12;
    this.ui.setAutoPath(this.autoPathing);
    if (auto && this.autoPathing && !this.mounted && this.S.activeMount && !this.casting && flat(p.pos, { x, z }) > 40) this.mount(true);
  }

  setTarget(t) {
    this.player.target = t;
    this.ui.refreshTarget && this.ui.refreshTarget();
  }
  // the phone Attack button: hit the current enemy, or the nearest one
  attackNearest() {
    const p = this.player; if (p.dead) return;
    let t = p.target;
    if (!t || t.dead || !(t.kind === 'monster' || (t.kind === 'rp' && this.pvpFoe(t)))) {
      t = this.nearestEnemy(30);
      if (!t) for (const e of this.rplayers || []) if (!e.dead && !e.netHidden && this.pvpFoe(e) && flat(e.pos, p.pos) < 30 && (!t || flat(e.pos, p.pos) < flat(t.pos, p.pos))) t = e;
    }
    if (!t) { this.ui.toast('No enemy nearby', 'warn'); return; }
    this.setTarget(t); this.engage = true; p.path = []; this.pendingTalk = null; this.pendingLife = null;
    this.autoPathing = false; this.ui.setAutoPath(false);
  }
  cycleTarget() {
    const p = this.player;
    const list = this.monsters.filter((m) => !m.dead && flat(m.pos, p.pos) < 30).sort((a, b) => flat(a.pos, p.pos) - flat(b.pos, p.pos));
    if (!list.length) return;
    const i = list.indexOf(p.target);
    this.setTarget(list[(i + 1) % list.length]); this.engage = true;
  }
  nearestEnemy(r = 25, type = null, from = null) {
    const c = from || this.player.pos;
    let best = null, bd = r;
    for (const m of this.monsters) {
      if (m.dead || m.returning || (m.map || this.world) !== this.map) continue;
      if (this.dg && m.dungeon && m.room > this.dg.cleared.size) continue;
      if (type && m.type !== type) continue;
      const d = flat(m.pos, c);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  jump() {
    const p = this.player;
    if (p.jumpY > 0.01 || p.vy > 0 || p.dead || p.stun > 0 || this.rolling || this.blocking || this.casting) return;
    p.vy = 8.5;
    this.sfx.play('swish');
  }

  // ============================================================== skills & combat
  aoe(c, r, mult, stun, proc = false, sk = null) {
    let n = 0;
    for (const m of [...this.monsters]) {
      if (m.dead || (m.map || this.world) !== this.map || flat(m.pos, c) > r + m.radius * 0.5) continue;
      this.damage(this.player, m, mult, { proc, sk }); n++;
      if (stun && !m.dead && !m.def0.boss) m.stun = stun;
    }
    this.pvpAoe(c, r, mult, proc, sk);
    return n;
  }

  damage(src, dst, mult, o = {}) {
    if (dst.dead) return 0;
    if (dst.kind === 'rp') return this.pvpStrike(src, dst, mult, o);
    const canCrit = o.canCrit !== false && o.fixed == null && o.pct == null;
    // trial attacks are a share of your max HP (stats are normalized there), still dodged, blocked and parried as usual
    let base = o.pct != null ? dst.maxHp * o.pct * (src.atkBuffT > this.time ? 1.25 : 1) : this.atkOf(src) * mult * rnd(0.9, 1.1);
    let critB = 0, cdB = 0;
    if (src === this.player && o.fixed == null) { const X = this.cbOut(dst, o); base *= X.m; critB = X.crit; cdB = X.cd; }
    const crit = canCrit && Math.random() * 100 < this.critOf(src) + critB;
    if (crit) { let cd = (src.critDmg ?? 0.6) + cdB; for (const b of src.buffs || []) if (b.mods?.critDmg) cd += b.mods.critDmg; base *= 1 + cd; }
    if (src.kind === 'monster' && o.fixed == null && o.pct == null && (Math.random() < 0.05 || this.monsterBlind(src))) {
      if (dst === this.player) this.fx.text(dst.pos.clone().setY(dst.pos.y + dst.height), 'Miss', 'miss');
      return 0;
    }
    if (src.kind === 'monster') base *= this.monsterOutMult(src);
    if (dst === this.player && src.kind === 'monster' && o.fixed == null && this.petIs('dodge') && Math.random() * 100 < this.petFx.v) {
      this.fx.text(dst.pos.clone().setY(dst.pos.y + dst.height), 'Dodge', 'miss');
      return 0;
    }
    if (dst === this.player && src !== this.player) { const R = this.cbIn(src, { ...o, raw: base }); if (R.cancel) return 0; base *= R.m * this.gearInMult(); }
    if (src === this.player && o.fixed == null) {
      if (this.hasFx('giant_slayer') && (dst.def0?.elite || dst.def0?.boss || dst.wb)) base *= 1.2;
      if (this.hasFx('executioner') && dst.maxHp && dst.hp < dst.maxHp * 0.3) base *= 1.4;
      if (this.hasFx('set_entangle') && dst.rootedT > this.time) base *= 1.15;
      if (this.hasFx('set_shatter') && dst.frozenT > this.time) base *= 1.3;
      if (this.hasFx('anc_king') && (dst.def0?.elite || dst.def0?.boss || dst.wb)) base *= 1.3;
    }
    if (dst === this.player && o.fixed == null && this.hasFx('anc_dread')) base *= 0.8;
    if (this.hasFx('set_covenant') && o.fixed == null) { if (src === this.player || src.kind === 'pet') base *= 1.15; else if (dst === this.player) base *= 0.85; }
    if (dst === this.player && o.fixed == null && (this.petIs('guard') || this.petIs('guardian'))) base *= 1 - this.petFx.v / 100;
    if (dst.guard && src === this.player) base *= 0.25; // a Twin Blade on guard
    const K = 50 + 8 * (src.level || 1); // armor matters relative to the attacker's level, so it scales to Lv 200
    let dmg = o.fixed != null ? Math.max(1, Math.round(o.fixed)) : o.pct != null ? Math.max(1, Math.round(base)) : Math.max(1, Math.round(base * K / (K + this.defOf(dst))));
    if (dst === this.player && dmg > 0) dmg = Math.round(this.manaShield(dmg));
    if (dst.shield > 0) {
      const ab = Math.min(dst.shield, dmg); dst.shield -= ab; dmg -= ab;
      if (dst === this.player && ab > 0) this.fx.text(dst.pos.clone().setY(dst.pos.y + dst.height), 'Absorb', 'miss');
      if (dst.shield <= 0) dst.buffs = dst.buffs.filter((b) => !b.shield);
    }
    dst.hp -= dmg;
    const head = dst.pos.clone().setY(dst.pos.y + dst.height * 0.9);
    const mine = src === this.player || src.kind === 'pet';
    if (dst === this.player) { if (dmg) this.fx.text(head, '-' + dmg, 'hurt'); this.sfx.play('hurt'); this.lastCombat = this.time; if (dmg > 0) { this.setPowersHurt(src); this.cbHurt(src, dmg); } }
    else if (mine) {
      this.fx.text(head, String(dmg), o.cls || (src.kind === 'pet' ? 'pet' : crit ? 'crit' : 'dmg'));
      if (!o.proc) this.sfx.play(crit ? 'crit' : 'hit');
      this.fx.emit(head, { count: crit ? 16 : 8, color: crit ? 0xffb02a : 0xffffff, speed: 4, life: 0.3, size: 0.4 });
      dst.hitT = 0.15;
      if (crit) this.fx.shake(0.12);
    } else if ((src.kind === 'ally' || src.kind === 'monster') && flat(dst.pos, this.player.pos) < 25) {
      this.fx.emit(head, { count: 5, color: dst.kind === 'monster' ? 0xffffff : 0xff8a8a, speed: 3, life: 0.25, size: 0.35 });
      if (!dst.crystal) dst.hitT = 0.12;
      if (dst.kind === 'monster' && dst.wb && dmg > 0 && Math.random() < 0.35) this.fx.text(head, String(dmg), 'other');
    }
    if (dst.wb) this.wbHit(src, dst, dmg);
    if (dst.kind === 'monster') {
      if (mine) { dst.tagged = true; this.lastCombat = this.time; }
      if (!dst.target || dst.target.dead) dst.target = src.kind === 'pet' ? this.player : src;
      dst.returning = false;
    }
    if (src === this.player && !o.proc && dmg > 0) this.onPlayerHit(dst, dmg, crit, o.sk);
    if (dst === this.player && src.kind === 'monster' && dmg > 0 && !src.dead) {
      let back = dmg * Math.min(60, this.stat('thorns')) / 100;
      if (this.hasFx('thorn_aura')) back += this.defOf(this.player) * 0.4;
      if (this.petIs('reflect')) back += dmg * this.petFx.v / 100;
      if (back >= 1) this.after(0.05, () => { if (!src.dead) this.damage(this.player, src, 0, { fixed: back, proc: true, cls: 'pet' }); });
    }
    if (dst.hp <= 0) {
      if (dst === this.player && this.hasFx('phoenix') && this.time >= this.phoenixCD) {
        dst.hp = Math.round(dst.maxHp * 0.5); this.phoenixCD = this.time + 60;
        this.fx.pillar(dst.pos, 0xff8a2a, 2.2, 12, 1.2); this.fx.circle(dst.pos, '#ffb35a', 3, 1.5, dst.model);
        this.fx.emit(dst.pos.clone().setY(dst.pos.y + 1), { count: 70, colors: [0xff6a2a, 0xffd04a, 0xffffff], speed: 6, life: 1.2, size: 0.8, up: 4 });
        this.ui.toast('Phoenix rebirth! You rise again.', 'good'); this.sfx.play('level');
        return dmg;
      }
      if (dst === this.player && this.petIs('rebirth') && this.time >= (this.procCD.petRebirth || 0)) {
        dst.hp = Math.round(dst.maxHp * this.petFx.v / 100); this.procCD.petRebirth = this.time + 300;
        this.fx.pillar(dst.pos, 0xffa03a, 2, 10, 1); this.fx.emit(dst.pos.clone().setY(dst.pos.y + 1), { count: 50, colors: [0xff7a2a, 0xffe07a], speed: 5, life: 1, size: 0.7, up: 4 });
        this.ui.toast(`${this.pet?.data.name || 'Your pet'}'s Rebirth! You rise again.`, 'good'); this.sfx.play('level');
        return dmg;
      }
      if (dst === this.player && (this.cbCannotDie() || this.gearCannotDie())) return dmg;
      if (dst.kind === 'monster') this.killMonster(dst);
      else if (dst === this.player) this.playerDied(src);
      else if (dst.kind === 'ally') this.allyDown(dst);
      else if (dst.kind === 'summon') this.summonDown(dst);
    }
    return dmg;
  }

  // On-hit item effects for the player's own direct hits (procs never trigger procs).
  onPlayerHit(dst, dmg, crit, sk = null) {
    const p = this.player;
    this.cbOnHit(dst, dmg, crit, sk);
    if (this.hasFx('anc_void') && !dst.dead && (this.procCD.void || 0) <= this.time) {
      this.procCD.void = this.time + 8; const c = dst.pos.clone();
      this.fx.ring(c, 0x9a4aff, 5, 0.5); this.fx.emit(c.clone().setY(c.y + 1), { count: 40, colors: [0x9a4aff, 0x3a1a6a, 0xffffff], speed: 6, life: 0.6, size: 0.6 });
      this.sfx.play('boom'); this.aoe(c, 5, 4, 0, true);
    }
    if (this.hasFx('double_strike') && Math.random() < 0.15) this.after(0.12, () => { if (!dst.dead) this.damage(p, dst, 0, { fixed: dmg * 0.7, proc: true, cls: 'crit' }); });
    if (crit && this.hasFx('crit_heal') && (this.procCD.critHeal || 0) <= this.time) { this.procCD.critHeal = this.time + 0.4; this.heal(p, p.maxHp * 0.04); }
    if (this.hasFx('chain') && Math.random() < 0.18) this.chainLightning(dst);
    if (this.petIs('foxfire') && !dst.dead && Math.random() < 0.2) this.petFoxFire(dst);
    if (this.hasFx('stun_chance') && !dst.dead && !dst.def0?.boss && Math.random() < 0.1) { dst.stun = 1.5; this.fx.text(dst.pos.clone().setY(dst.pos.y + dst.height + 0.4), 'Stunned', 'miss'); }
    if (this.hasFx('meteor_proc') && ++this.hitCount % 6 === 0) {
      const c = dst.pos.clone();
      this.fx.meteor(c, 0xffb02a, 0.6, () => { this.sfx.play('boom'); this.aoe(c, 5, 2.6, 0, true); });
    }
    if (this.hasFx('set_entangle') && !dst.dead && !dst.def0?.boss && !dst.wb && Math.random() < 0.12) { dst.stun = Math.max(dst.stun || 0, 2); dst.rootedT = this.time + 2; this.fx.text(dst.pos.clone().setY(dst.pos.y + dst.height + 0.4), 'Rooted', 'miss'); this.fx.circle(dst.pos, '#7ad85a', 1.4, 2, null); }
    if (this.hasFx('set_swarm') && ++this.swarmHits % 5 === 0) for (let i = 0; i < 3; i++) {
      this.after(0.12 + i * 0.14, () => { if (dst.dead) return; this.fx.projectile(p.pos.clone().setY(p.pos.y + 1.6), dst, { color: 0xffd23a, size: 0.22, speed: 26, onHit: () => this.damage(p, dst, 0.6, { proc: true }) }); });
    }
    if (crit && this.hasFx('set_shatter') && !dst.dead && !dst.def0?.boss && !dst.wb) { dst.stun = Math.max(dst.stun || 0, 1); dst.frozenT = this.time + 1; this.fx.text(dst.pos.clone().setY(dst.pos.y + dst.height + 0.4), 'Frozen', 'miss'); this.fx.emit(dst.pos.clone().setY(dst.pos.y + 1), { count: 18, colors: [0xc8f0ff, 0xffffff], speed: 3, life: 0.6, size: 0.5 }); }
    if (this.hasFx('set_refraction') && !dst.dead && Math.random() < 0.18) this.after(0.1, () => { if (dst.dead) return; this.fx.bolt(p.pos.clone().setY(p.pos.y + 1.4), dst.pos.clone().setY(dst.pos.y + dst.height * 0.6), 0xd8a0ff); this.damage(p, dst, 1.5, { proc: true }); });
    if (crit && this.hasFx('starfall') && !dst.dead) {
      const from = dst.pos.clone().add(new THREE.Vector3(rnd(-3, 3), 16, rnd(-3, 3)));
      this.fx.projectile(from, dst, { color: 0xfff08a, size: 0.55, speed: 34, onHit: () => this.damage(p, dst, 1.2, { proc: true }) });
    }
  }
  // dungeon set powers that react to being hit
  setPowersHurt(src) {
    const p = this.player;
    if (this.hasFx('set_gravepact') && p.hp > 0 && p.hp < p.maxHp * 0.3 && (this.procCD.grave || 0) <= this.time) {
      this.procCD.grave = this.time + 45;
      p.shield = (p.shield || 0) + p.maxHp * 0.25;
      p.buffs.push({ id: 'gravepact', icon: 'm5', until: this.time + 10, shield: true });
      this.fx.circle(p.pos, '#9ad0ff', 2.2, 1.2, p.model); this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.4), 'Grave Pact', 'heal');
    }
    if (this.hasFx('anc_dread') && src && src.kind === 'monster' && !src.dead && !src.def0?.boss && !src.wb && Math.random() < 0.15) { src.stun = Math.max(src.stun || 0, 1); this.fx.text(src.pos.clone().setY(src.pos.y + src.height + 0.4), 'Stunned', 'miss'); }
    if (this.hasFx('set_moltencore') && src && src.kind === 'monster' && !src.dead && (src.burnUntil || 0) <= this.time) {
      src.burnUntil = this.time + 3;
      for (let i = 1; i <= 3; i++) this.after(i, () => { if (!src.dead) { this.fx.emit(src.pos.clone().setY(src.pos.y + src.height * 0.6), { count: 8, colors: [0xff6a1a, 0xffc04a], speed: 2, life: 0.5, size: 0.5, up: 2 }); this.damage(p, src, 0.3, { canCrit: false, proc: true, cls: 'pet' }); } });
    }
  }
  chainLightning(from) {
    const W = from.map || this.world;
    const near = this.monsters.filter((m) => m !== from && !m.dead && (m.map || this.world) === W && flat(m.pos, from.pos) < 9)
      .sort((a, b) => flat(a.pos, from.pos) - flat(b.pos, from.pos)).slice(0, 2);
    let prev = from;
    for (const m of near) {
      const a = prev.pos.clone().setY(prev.pos.y + prev.height * 0.6), b = m.pos.clone().setY(m.pos.y + m.height * 0.6);
      this.fx.bolt(a, b, 0x9ad8ff);
      this.damage(this.player, m, 0.8, { proc: true });
      prev = m;
    }
  }
  addFrenzy() {
    const p = this.player;
    let b = p.buffs.find((x) => x.id === 'frenzy');
    if (!b) { b = { id: 'frenzy', icon: 'a5', stacks: 0, mods: { atk: 1 } }; p.buffs.push(b); }
    b.stacks = Math.min(3, b.stacks + 1); b.mods.atk = 1 + 0.12 * b.stacks; b.until = this.time + 8;
  }

  heal(e, amt) {
    if (e === this.player) amt *= 1 + this.ps('healRecv') / 100; // Sanguine Veins
    amt = Math.round(amt);
    const before = e.hp; e.hp = Math.min(e.maxHp, e.hp + amt);
    // Flow: overhealing becomes a shield (Overflow makes it 50% stronger)
    if (e === this.player && before + amt > e.maxHp && this.rule('flow')) {
      const k = this.rule('overflow') ? 1.5 : 1, cap = e.maxHp * 0.2 * k;
      e.shield = Math.min(cap, (e.shield || 0) + (before + amt - e.maxHp) * k);
      const b = e.buffs.find((x) => x.id === 'flow');
      if (b) b.until = this.time + 8; else e.buffs.push({ id: 'flow', icon: 'tw_flow', until: this.time + 8, shield: true });
    }
    if (e === this.player && e.hp > before) this.fx.text(e.pos.clone().setY(e.pos.y + e.height), '+' + (e.hp - before), 'heal');
    if (e === this.player && amt > 0 && this.hasFx('six_tide4') && (this.procCD.tideward || 0) <= this.time) { this.procCD.tideward = this.time + 1; e.shield = Math.max(e.shield || 0, e.maxHp * 0.05); }
  }

  killMonster(m) {
    const d = m.def0, p = this.player;
    m.hp = 0; m.dead = true; m.state = 'dead'; m.deadT = 0;
    m.respawnT = m.dungeon || m.summoned || m.wb || d.structure ? Infinity : d.war ? 7 : d.boss ? 90 : rnd(9, 15);
    m.dots = [];
    if (p.target === m) { this.setTarget(null); }
    if (this.pet && this.pet.target === m) this.pet.target = null;
    if (m.dungeon && this.dg && m === this.dg.boss) this.completeDungeon();
    if (m.warUnit) this.onWarKill(m);
    if (m.wb) this.onWorldBossKilled(m);
    if (m.trialMob) { this.cbOnKill(m); this.gearOnKill(m); this.onTrialKill(m); return; }
    if (!m.tagged) return;
    m.tagged = false;
    const K = this.killScale(d, m.level);
    // exp
    const cs = d.curve ? curveStats(m.level, d.curve) : null;
    const EL = this.elixirMods ? this.elixirMods() : {}, LB = liveBoost();
    const exp = this.killExp(m, this.personalExp(this.partyShareExp(m, (cs ? cs.exp : d.exp * K.exp) * expScale(m.level)), m.level));
    if (exp > 0) this.after(0.3, () => { this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.3), `+${fmt(exp)} EXP`, 'exp'); this.gainExp(exp); });
    this.gainMastery('weapon', 2, m); // finishing blow
    // gold
    const gold = Math.round((cs ? rnd(cs.gold[0], cs.gold[1]) : rnd(d.gold[0], d.gold[1]) * K.gold) * (1 + this.stat('goldFind') / 100 + (EL.gold || 0) + (this.petIs('gold') ? this.petFx.v / 100 : 0)) * (LB ? LB.gold : 1));
    this.fx.coins(m.pos, p, Math.min(8, 2 + (gold / 15) | 0), () => { this.S.gold += gold; this.sfx.play('coin'); this.ui.refreshWallet(); this.fx.text(p.pos.clone().setY(p.pos.y + p.height), `+${gold} Gold`, 'gold', 0.5); this.track('gold', gold); });
    this.S.kills[m.type] = (this.S.kills[m.type] || 0) + 1;
    if (this.hasFx('frenzy')) this.addFrenzy();
    if (this.hasFx('set_mossmend')) this.heal(p, p.maxHp * 0.03);
    this.cbOnKill(m); this.gearOnKill(m);
    if (this.hasFx('set_soulharvest')) {
      let b = p.buffs.find((x) => x.id === 'soulharvest');
      if (!b) { b = { id: 'soulharvest', icon: 'a5', stacks: 0, mods: { atk: 1, critDmg: 0 } }; p.buffs.push(b); }
      b.stacks = Math.min(5, b.stacks + 1); b.mods.atk = 1 + 0.04 * b.stacks; b.mods.critDmg = 0.04 * b.stacks; b.until = this.time + 10;
    }
    if (!d.structure && !d.war) { this.rollDrops(m); this.tailorDrop(m); this.dzKill(m); this.sixWorldDrop(m); }
    // beasts sometimes leave meat for the campfire
    if (BEASTS.test(d.model) && !d.boss && Math.random() < 0.3) { this.addMat('raw_meat', 1, true); this.lootMsg('Raw Meat', '#ffffff'); }
    if (this.hasFx('anc_bloodthirst')) this.ancBloodthirst();
    this.onKillSystems(m);
    if (m.dungeon && this.dg) this.dungeonRelicDrop(m);
    this.questKill(m);
  }

  rollDrops(m) {
    const d = m.def0, S = this.S;
    const luck = this.petIs('luck') ? this.petFx.v : 0; // Lucky Paw: more gear drops and better rarity
    const ctx = { lvl: m.level || 1, elite: !!d.elite, boss: !!d.boss, dungeon: !!m.dungeon, luck: Math.min(0.6, this.stat('goldFind') / 200 + ((this.elixirMods && this.elixirMods().luck) || 0) + luck / 200) };
    const rolls = d.boss ? (m.dungeon ? 1 : 2) : 1;
    const chance = (d.boss ? 1 : d.elite ? 0.55 : m.dungeon ? 0.24 : 0.12) * (1 + luck / 100);
    for (let i = 0; i < rolls; i++) {
      if (Math.random() > chance) continue;
      this.dropLoot({ eq: this.makeEquip(null, Math.max(1, m.level), rollRarity(ctx)) }, m.pos);
    }
    if (!m.dungeon) for (const nd of namedBySource(m.type)) if (Math.random() < 0.15) this.dropLoot({ eq: genNamed(nd.id, { lvl: m.level, cls: S.cls, uid: S.uid++ }) }, m.pos);
    const pt = m.level >= 60 ? 3 : m.level >= 25 ? 2 : 1;
    if (Math.random() < 0.08) this.dropLoot({ id: pt === 1 ? 'hp_potion' : 'potion_hp' + pt, qty: 1 }, m.pos);
    if (Math.random() < 0.05) this.dropLoot({ id: pt === 1 ? 'mp_potion' : 'potion_mp' + pt, qty: 1 }, m.pos);
    for (const dr of d.drops || []) {
      if (Math.random() > dr.chance) continue;
      if (dr.id.startsWith('pet_') && dr.id !== 'pet_egg') {
        if (S.pets[dr.id]) continue;
        this.gainPet(dr.id, true);
      } else if (dr.id.startsWith('mount_')) {
        if (S.mounts.includes(dr.id)) continue;
        this.gainMount(dr.id, true);
      } else if (ITEMS[dr.id]) this.dropLoot({ id: dr.id, qty: 1 }, m.pos);
    }
  }

  // ---------------------------------------------------------------- ground loot
  dropLoot(item, from) {
    const W = this.map, it = item.eq ? null : ITEMS[item.id];
    const q = item.eq ? item.eq.quality : (it.quality || 0), R = RARITY[q];
    const name = item.eq ? item.eq.name : it.name + (item.qty > 1 ? ` x${item.qty}` : '');
    const a = Math.random() * Math.PI * 2, r = 0.9 + Math.random() * 1.8;
    let x = from.x + Math.cos(a) * r, z = from.z + Math.sin(a) * r;
    if (W.isBlocked(x, z)) { x = from.x; z = from.z; }
    const g = new THREE.Group(); g.position.set(x, W.heightAt(x, z), z);
    const mat = new THREE.SpriteMaterial({ transparent: true, depthWrite: false });
    const spr = new THREE.Sprite(mat); spr.scale.setScalar(1.05); spr.position.y = 0.95; spr.renderOrder = 4; g.add(spr);
    iconCanvas(item.eq ? item.eq.icon : item.id).then((c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; mat.map = t; mat.needsUpdate = true; });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: R.color, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75 }));
    halo.scale.setScalar(1.6 + q * 0.25); halo.position.y = 0.95; g.add(halo);
    if (!this.lootDisc) this.lootDisc = new THREE.CircleGeometry(1, 32);
    const ring = new THREE.Mesh(this.lootDisc, new THREE.MeshBasicMaterial({ map: ringTexture(R.color, 0.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; ring.scale.setScalar(1.0 + q * 0.18); g.add(ring);
    let beam = null;
    if (R.beam > 0) {
      const hgt = 3 + 9 * R.beam;
      beam = new THREE.Mesh(this.fx.geo.cyl, new THREE.MeshBasicMaterial({ color: R.color, map: beamTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, opacity: 0.85 }));
      beam.scale.set(0.28 + q * 0.07, hgt, 0.28 + q * 0.07); beam.position.y = hgt / 2; g.add(beam);
    }
    this.scene.add(g);
    const L = { kind: 'loot', item, q, name, model: g, pos: g.position, spr, ring, beam, t: 0, height: 1.3, radius: 1, map: W, dead: false, from: new THREE.Vector3(from.x, from.y + 1.4, from.z), ground: g.position.clone() };
    g.position.copy(L.from);
    this.nameplate(L, `<div class="n" style="color:${R.color}">${esc(name)}</div>`, 'loot');
    this.loots.push(L);
    if (q >= 3) this.sfx.play(q >= 5 ? 'legend' : 'rare');
    if (item.eq && q >= 4) {
      const label = q === 5 ? 'LEGENDARY!' : 'UNIQUE!';
      this.ui.banner(label, item.eq.name, 'loot' + q);
      this.ui.chat('announce', `<b>[Announcement]</b> ${esc(this.S.name)} found <span class="it" style="color:${R.color}">[${esc(item.eq.name)}]</span>!`);
      this.logEvent('loot', `Found ${R.name} ${item.eq.name}`, q >= 5);
      this.fx.shake(q === 5 ? 0.5 : 0.25);
    }
    return L;
  }
  updateLoot(dt) {
    const p = this.player, S = this.S;
    for (const L of [...this.loots]) {
      L.t += dt;
      if (L.t < 0.55) { const k = L.t / 0.55; L.pos.lerpVectors(L.from, L.ground, k); L.pos.y += Math.sin(k * Math.PI) * 1.6; continue; }
      L.spr.position.y = 0.95 + Math.sin(L.t * 3 + L.q) * 0.12;
      L.ring.rotation.z += dt * 1.2;
      if (L.q >= 4 && Math.random() < dt * 10) this.fx.emit(L.pos.clone().setY(L.pos.y + 0.6), { count: 1, color: RARITY[L.q].color, speed: 0.6, life: 1, size: 0.4, up: 2.5, jitter: 1 });
      if (L.map !== this.map || p.dead) continue;
      const d = flat(p.pos, L.pos);
      if (!L.flying && d < 2.2) { this.pickupLoot(L); continue; }
      if (!L.flying && S.settings.autoLoot && L.t > 1.1 && d < 16 && this.time - (L.failT ?? -99) > 4) L.flying = true;
      if (L.flying) {
        const to = p.pos.clone().setY(p.pos.y + 1);
        const dir = to.sub(L.pos); const len = dir.length();
        if (len < 0.8) { this.pickupLoot(L); continue; }
        L.pos.addScaledVector(dir.normalize(), Math.min(len, (14 + L.t * 4) * dt));
      }
      if (L.t > 180) this.removeLoot(L);
    }
  }
  pickupLoot(L, quiet = false) {
    const it = L.item;
    const ok = it.eq ? this.addEquip(it.eq) : this.addItem(it.id, it.qty || 1);
    if (!ok) { L.flying = false; L.failT = this.time; L.ground.copy(L.pos); L.pos.y = (L.map || this.world).heightAt(L.pos.x, L.pos.z); return false; }
    if (it.eq && it.eq.quality >= 2) this.track('lootRare');
    this.removeLoot(L);
    if (!quiet) { this.sfx.play('pickup'); this.lootMsg(L.name, RARITY[L.q].color); }
    return true;
  }
  removeLoot(L) {
    this.scene.remove(L.model); L.np?.remove();
    L.model.traverse((o) => { if (o.material) { o.material.map && o.material.map.isCanvasTexture && o.material.map.dispose(); o.material.dispose(); } });
    this.loots = this.loots.filter((x) => x !== L);
  }

  lootMsg(name, color) {
    this.ui.chat('system', `Obtained <span class="it" style="color:${color}">[${esc(name)}]</span>`);
    this.ui.toast(`Obtained [${name}]`, 'item');
  }

  // EXP from a monster of level lvl after EXP Gain, elixirs and live events (also used for party shares; the level gap,
  // diminishing returns and rested XP are applied by killExp)
  personalExp(base, lvl) {
    const EL = this.elixirMods ? this.elixirMods() : {}, LB = liveBoost();
    return Math.round(base * (1 + this.stat('expGain') / 100 + (EL.exp || 0) + (this.petIs('exp') ? this.petFx.v / 100 : 0)) * (LB ? LB.exp : 1));
  }
  // a full XP bar levels up unless a trial wall is still standing; until it is cleared the bar stays full and further
  // XP is not banked
  gainExp(n) {
    const S = this.S;
    if (S.level >= MAX_LEVEL) return;
    S.exp += Math.max(0, n);
    let leveled = false, block = null;
    while (S.level < MAX_LEVEL && S.exp >= needExp(S.level)) {
      block = this.levelBlock(S.level);
      if (block) { S.exp = needExp(S.level); break; }
      S.exp -= needExp(S.level); S.level++; leveled = true;
    }
    if (block && n > 0) this.levelBlockNotice(block);
    if (leveled) {
      this.recalc(true);
      this.fx.levelUp(this.player); this.sfx.play('level');
      this.ui.banner('LEVEL UP!', `You reached Level ${S.level}`);
      this.ui.chat('system', `Congratulations! You reached <b>Level ${S.level}</b>.`);
      this.logEvent('level', `Reached Lv ${S.level}`, S.level % 10 === 0);
      const fresh = this.syncSkills(true);
      for (const s of fresh) this.ui.toast(`New skill: ${s.name}`, 'good');
      if (S.level === 100 && S.awaken == null) { this.ui.banner('AWAKENING', 'Choose your path in the Skills window (K)', 'level'); this.ui.markMenu('skills'); }
      if (this.skillPtsLeft() > 0) this.ui.markMenu('skills');
      if (S.level >= 10 && S.title < 3) { S.title = 3; this.refreshPlayerPlate(); }
      this.questLevelUp();
      if (S.level >= MAX_LEVEL) { this.unlockTitle('Legend of Hiraya'); this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} reached the maximum level ${MAX_LEVEL}!`); }
      else if (S.level % 25 === 0) this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} reached Level ${S.level}!`);
      this.ui.refreshSkills();
      this.save();
    }
    this.ui.refreshExp();
  }

  playerDied(src) {
    const p = this.player;
    p.hp = 0; p.dead = true; p.state = 'dead'; this.auto = false; this.ui.setAutoBattle(false);
    this.engage = false; p.path = []; this.setTarget(null);
    this.clearCombatWorld(); this.rolling = null; this.blocking = null; this.endStealth();
    if (this.mounted) this.dismount(true);
    for (const m of this.monsters) if (m.target === p) { m.target = null; m.returning = true; }
    this.ui.chat('system', `You were defeated by ${esc(src?.name || src?.def0?.name || 'a monster')}.`);
    if (this.S.stats) this.S.stats.deaths = (this.S.stats.deaths || 0) + 1;
    this.logEvent('death', `Defeated by ${src?.name || src?.def0?.name || 'a monster'}${this.dg ? ` in ${this.dg.def.name}` : ''}`);
    if (this.countItem('phoenix_draught') > 0 && !this.war) {
      this.removeItem('phoenix_draught', 1);
      this.after(1.2, () => { if (!p.dead) return; p.dead = false; p.state = 'idle'; p.hp = p.maxHp; p.mp = p.maxMp; this.fx.pillar(p.pos, 0xff8a2a, 2.2, 12, 1.2); this.ui.toast('The Phoenix Draught revives you!', 'good'); this.sfx.play('level'); });
      return;
    }
    if (this.war) { this.warPlayerDown(); return; }
    if (this.trial) { this.trialPlayerDown(); return; }
    this.wearOnDeath();
    const lost = this.dropSoul();
    if (lost) this.ui.chat('system', `You dropped <b>${fmt(lost)} EXP</b> as a soul marker${this.dg ? ' at the dungeon entrance' : ' where you fell'}. Reach it within 10 minutes to take it back; dying again first loses it.`);
    if (this.dg) {
      this.dg.deaths++;
      if (this.dg.deaths > DUNGEON_RULES.deathLimit) { this.failDungeon('deaths'); return; }
      this.ui.modal('You have been defeated', `The ${this.dg.def.name} claims another adventurer... ${DUNGEON_RULES.deathLimit - this.dg.deaths + 1} revive${DUNGEON_RULES.deathLimit - this.dg.deaths ? 's' : ''} left before the run fails.`, [
        { label: 'Revive at Entrance', cls: 'blue', fn: () => this.revive(false) },
        { label: 'Revive Here (10 Diamonds)', fn: () => this.revive(true) },
        { label: 'Leave Dungeon', cls: 'gray', fn: () => { this.revive(false); this.leaveDungeon(); return true; } },
      ], true);
      return;
    }
    if (this.dzIn) this.dzOnDeath(src);
    this.ui.modal('You have been defeated', this.dzIn ? 'You fell in the Danger Zone and dropped part of your loot where you stood. Hurry back before someone takes it!' : 'Your spirit drifts back toward the World Tree... Choose how to return.', [
      { label: 'Revive in Town', cls: 'blue', fn: () => this.revive(false) },
      { label: 'Revive Here (10 Diamonds)', fn: () => this.revive(true) },
    ], true);
  }
  revive(here) {
    const p = this.player, S = this.S;
    if (here && S.diamonds < 10) { this.ui.toast('Not enough diamonds', 'warn'); return false; }
    if (here) S.diamonds -= 10;
    else if (this.dg) { const st = this.dg.map.start; p.pos.set(st.x, this.map.heightAt(st.x, st.z), st.z); p.yaw = p.yawT = st.yaw; this.cam.target.copy(p.pos); }
    else { p.pos.set(0, this.world.heightAt(0, 9), 9); this.cam.target.copy(p.pos); }
    if (this.pet) this.pet.pos.set(p.pos.x - 1.2, p.pos.y, p.pos.z + 1);
    p.dead = false; p.state = 'idle'; p.hp = p.maxHp; p.mp = p.maxMp;
    this.fx.levelUp(p); this.ui.refreshWallet();
    return true;
  }

  // ============================================================== items
  makeEquip(slot, lvl, quality, named = null) {
    const S = this.S;
    return genEquip({ slot, lvl, quality, cls: S.cls, uid: S.uid++, named });
  }
  addItem(id, qty = 1) {
    const S = this.S, it = ITEMS[id];
    if (it.type === 'tool' && this.beltWants(id)) { this.beltTool(id); if (--qty <= 0) { this.ui.refreshPanel(); return true; } }
    const ex = S.bag.find((b) => b.id === id);
    if (ex) ex.qty = Math.min(999, ex.qty + qty);
    else { if (S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return false; } S.bag.push({ id, qty }); }
    if (it.type === 'quest') this.questCollectCheck();
    this.ui.refreshPanel(); this.ui.refreshSkills();
    return true;
  }
  addEquip(eq) {
    const S = this.S;
    if (S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return false; }
    S.bag.push({ eq }); this.ui.refreshPanel(); this.ui.markMenu('bag');
    if (eq.named) this.registerNamed(eq);
    return true;
  }
  countItem(id) { return this.S.bag.filter((b) => b.id === id).reduce((a, b) => a + b.qty, 0); }
  removeItem(id, qty) {
    const S = this.S;
    for (const b of S.bag) if (b.id === id) { const n = Math.min(qty, b.qty); b.qty -= n; qty -= n; if (!qty) break; }
    S.bag = S.bag.filter((b) => !b.id || b.qty > 0);
    this.ui.refreshPanel(); this.ui.refreshSkills();
  }
  potionKind(id) { return id === 'hp_potion' || id.startsWith('potion_hp') ? 'hp' : 'mp'; }
  countPotions(id) { return POTION_TIERS[this.potionKind(id)].reduce((a, [pid]) => a + this.countItem(pid), 0); }
  // Q / E and auto-potions drink the strongest draught you carry; using one from the bag drinks exactly that one.
  usePotion(id, exact = false) {
    const p = this.player;
    if (p.dead) return;
    this.noteInput && this.noteInput('p' + id.length);
    if (this.trial?.noPotions) { this.ui.toast('Potions do not work in this trial: cook food at the campfire', 'warn'); return; }
    if (this.potionCD > this.time) return;
    const kind = this.potionKind(id), tiers = POTION_TIERS[kind];
    const pick2 = exact ? tiers.find(([pid]) => pid === id) : tiers.find(([pid]) => this.countItem(pid) > 0);
    if (!pick2 || !this.countItem(pick2[0])) { this.ui.toast(`No ${kind === 'hp' ? 'healing' : 'mana'} draughts left`, 'warn'); return; }
    this.removeItem(pick2[0], 1); this.potionCD = this.time + 3;
    if (kind === 'hp') { this.heal(p, p.maxHp * pick2[1]); this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 20, color: 0xff6a7a, speed: 1, life: 0.8, size: 0.5, up: 2.5, jitter: 1 }); }
    else { p.mp = Math.min(p.maxMp, p.mp + p.maxMp * pick2[1]); this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 20, color: 0x5aa8ff, speed: 1, life: 0.8, size: 0.5, up: 2.5, jitter: 1 }); }
    this.sfx.play('heal');
  }
  useBagItem(i) {
    const S = this.S, b = S.bag[i]; if (!b) return;
    if (b.eq) return this.equip(i);
    const it = ITEMS[b.id];
    if (b.id === 'hp_potion' || b.id === 'mp_potion' || b.id.startsWith('potion_')) return this.usePotion(b.id, true);
    if (this.useUpgradeItem(b.id)) return;
    if (this.useLifeItem(b.id)) return;
    if (b.id === 'pet_egg') {
      const pool = PETS.filter((pd) => pd.rarity <= 2 && !pd.event && !S.pets[pd.id]);
      this.removeItem('pet_egg', 1);
      if (!pool.length) { S.gold += 600; this.ui.toast('All common pets collected: received 600 Gold', 'good'); this.ui.refreshWallet(); return; }
      const pd = pick(pool);
      this.fx.levelUp(this.player); this.sfx.play('quest');
      this.gainPet(pd.id, false);
      this.ui.modal('The egg hatched!', `A ${pd.species} named ${pd.name} wriggles out of the shell and looks up at you adoringly.`, [{ label: 'Summon it', fn: () => this.setPet(pd.id) }, { label: 'Later', cls: 'gray' }], false, this.petIcon(pd.id));
      return;
    }
    if (it.type === 'tool') { this.equipTool(i); return; }
    if (it.type === 'food') { this.eatFood(b.id); return; }
    if (it.type === 'survey') { this.readSurvey(b.id); return; }
    if (it.type === 'sigil') { this.ui.toast('Bring the sigil to the Trial Warden in Sylvan Haven', 'good'); return; }
    if (b.id === 'dungeon_ticket') { this.ui.toast('Tickets are used automatically when your free dungeon entries run out', 'good'); return; }
    if (this.useSystemItem(b.id)) return;
    if (b.id === 'exp_scroll') { this.removeItem('exp_scroll', 1); this.gainExp(Math.round(needExp(S.level) * 0.05)); this.fx.buff(this.player, '#c8ff6a'); return; }
    if (it.type === 'quest') this.ui.toast('Quest item — bring it to the right person', 'warn');
  }
  equip(i) {
    const S = this.S, b = S.bag[i]; if (!b || !b.eq) return;
    const eq = b.eq;
    if (eq.lvl > S.level + 5) { this.ui.toast(`Requires Lv ${eq.lvl - 5}`, 'warn'); return; }
    { const why = this.equipBlock(eq); if (why) { this.ui.toast(why, 'warn'); this.sfx.play('error'); return; } }
    S.bag.splice(i, 1);
    if (S.equip[eq.slot]) S.bag.push({ eq: S.equip[eq.slot] });
    S.equip[eq.slot] = eq;
    this.recalc(); this.sfx.play('click'); this.ui.refreshPanel();
    this.ui.toast(`Equipped ${eq.name}`, 'good');
  }
  unequip(slot) {
    const S = this.S;
    if (!S.equip[slot]) return;
    if (S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return; }
    S.bag.push({ eq: S.equip[slot] }); delete S.equip[slot];
    this.recalc(); this.ui.refreshPanel();
  }
  // Sort: gear first (best quality, then level), then consumables, quest items, valuables and the rest
  sortBag() {
    const rank = { gear: 0, use: 1, quest: 2, val: 3, other: 4 };
    this.S.bag.sort((a, b) => rank[bagCat(a)] - rank[bagCat(b)]
      || (a.eq && b.eq ? b.eq.quality - a.eq.quality || b.eq.lvl - a.eq.lvl || a.eq.slot.localeCompare(b.eq.slot)
        : !a.eq && !b.eq ? (ITEMS[b.id].quality || 0) - (ITEMS[a.id].quality || 0) || ITEMS[a.id].name.localeCompare(ITEMS[b.id].name) : 0));
    this.sfx.play('click'); this.ui.refreshPanel();
  }
  sell(i) {
    const S = this.S, b = S.bag[i]; if (!b) return;
    let g = 0;
    if (b.eq) g = sellPrice(b.eq);
    else { const it = ITEMS[b.id]; if (it.type === 'quest') { this.ui.toast('Quest items cannot be sold', 'warn'); return; } g = Math.round((it.price || 10) * 0.3) * b.qty; }
    S.bag.splice(i, 1); S.gold += g; this.sfx.play('coin');
    this.ui.toast(`Sold for ${fmt(g)} Gold`, 'good'); this.ui.refreshWallet(); this.ui.refreshPanel();
  }

  // ============================================================== pets / sprites / mounts
  gainPet(id, announce) {
    const S = this.S, pd = PETS.find((x) => x.id === id);
    if (S.pets[id]) return;
    S.pets[id] = { lv: 1 };
    this.ui.chat('system', `New pet: <span class="it" style="color:${RARITY[PET_TIER[pd.rarity]].color}">[${esc(pd.name)}]</span> joined your collection!`);
    if (announce || pd.rarity >= 2) this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} obtained the pet <b>[${esc(pd.name)}]</b>!`);
    this.ui.toast(`New pet: ${pd.name}!`, 'good');
    this.ui.markMenu('pets');
    if (!S.activePet) this.setPet(id);
    this.recalc(); this.ui.refreshPanel();
  }
  setPet(id) {
    this.S.activePet = id; this.syncPet(); this.recalc(); this.ui.refreshPanel(); this.ui.refreshPlayer();
  }
  feedPet(id) {
    const S = this.S, st = S.pets[id]; if (!st) return;
    if (st.lv >= PET_MAX_LV) { this.ui.toast('Max pet level', 'warn'); return; }
    const cost = 150 * st.lv * st.lv;
    if (S.gold < cost) { this.ui.toast('Not enough Gold', 'warn'); this.sfx.play('error'); return; }
    S.gold -= cost; st.lv++;
    this.track('feed');
    this.sfx.play('level'); if (this.pet && S.activePet === id) this.fx.levelUp(this.pet);
    this.ui.toast(`${PETS.find((x) => x.id === id).name} grew to Lv ${st.lv}!`, 'good');
    this.recalc(); this.ui.refreshWallet(); this.ui.refreshPanel(); this.ui.refreshPlayer();
  }
  syncPet() {
    const S = this.S;
    if (this.pet) { this.scene.remove(this.pet.model); this.ents = this.ents.filter((e) => e !== this.pet); this.pet.np?.remove(); this.pet = null; }
    if (!S.activePet) return;
    const pd = PETS.find((x) => x.id === S.activePet);
    const inner = PET_BUILD(pd.model);
    const e = this.makeEnt('pet', inner, { name: pd.name, radius: 0.5, shadowR: 0.45 });
    const pp = this.player.pos;
    e.pos.set(pp.x - 1.5, pp.y, pp.z - 1); e.data = pd; e.speed = 8; e.attackCD = 1;
    this.nameplate(e, `<div class="n" style="color:#ffb8e8;font-size:11px">${esc(pd.name)}</div>`, 'pet');
    this.pet = e;
    this.fx.spawnPuff(e.pos, 0xffb8e8);
  }
  setSprite(id) { this.S.activeSprite = id; this.syncSprite(); this.recalc(); this.ui.refreshPanel(); }
  syncSprite() {
    if (this.sprite) { this.scene.remove(this.sprite); this.sprite = null; }
    const id = this.S.activeSprite; if (!id) return;
    const sd = SPRITES.find((x) => x.id === id);
    this.sprite = buildSprite(sd.color); this.sprite.userData.color = sd.color; this.sprite.userData.def = sd;
    this.scene.add(this.sprite);
    this.spriteRegenT = 4;
  }
  gainMount(id, announce) {
    const S = this.S, md = MOUNTS.find((x) => x.id === id);
    if (S.mounts.includes(id)) return;
    S.mounts.push(id);
    this.ui.chat('system', `New mount: <span class="it" style="color:#ff9a2e">[${esc(md.name)}]</span>! Press R to ride.`);
    if (announce) this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} tamed the mount <b>[${esc(md.name)}]</b>!`);
    this.ui.toast(`New mount: ${md.name}!`, 'good');
    this.ui.markMenu('mounts');
    if (!S.activeMount) S.activeMount = id;
    this.recalc(); this.ui.refreshPanel();
  }
  setMount(id) {
    const was = this.mounted;
    if (was) this.dismount(true);
    this.S.activeMount = id;
    if (was) this.mount(true);
    this.ui.refreshPanel(); this.ui.refreshMountBtn();
  }
  toggleMount() { if (this.mounted) this.dismount(); else this.mount(); }
  mount(instant = false) {
    const S = this.S, p = this.player;
    if (!S.activeMount) { this.ui.toast('You have no mount yet', 'warn'); return; }
    if (p.dead || this.mounted || this.casting) return;
    const go = () => {
      const md = MOUNTS.find((x) => x.id === S.activeMount);
      const mm = MOUNT_BUILD(md.model);
      p.model.remove(p.humanoid); mm.userData.parts.seat.add(p.humanoid); p.humanoid.position.set(0, -0.55, 0); p.humanoid.rotation.set(0, 0, 0);
      p.model.add(mm); p.inner = mm; this.mountModel = mm; this.mounted = true; S.wasMounted = true;
      this.fx.spawnPuff(p.pos, 0xffffff); this.sfx.play('mount');
      p.height = 3.2; this.ui.refreshMountBtn();
    };
    if (instant) go();
    else this.castBar(`Summoning ${MOUNTS.find((x) => x.id === S.activeMount).name}`, 1.0, go);
  }
  dismount(quiet = false) {
    const p = this.player; if (!this.mounted) return;
    const mm = this.mountModel;
    mm.userData.parts.seat.remove(p.humanoid); p.model.remove(mm); p.model.add(p.humanoid); p.humanoid.position.set(0, 0, 0);
    p.inner = p.humanoid; this.mounted = false; this.mountModel = null; this.S.wasMounted = false; p.height = 2.1;
    if (!quiet) this.fx.spawnPuff(p.pos, 0xffffff);
    this.ui.refreshMountBtn();
  }
  castBar(label, dur, done, onEnd = null) {
    if (this.casting) return;
    this.player.path = [];
    this.casting = { t: 0, dur, done, onEnd, x: this.player.pos.x, z: this.player.pos.z };
    this.ui.cast(label, dur);
  }

  toggleAuto(force) {
    if ((force === undefined ? !this.auto : force) && !this.autoAllowed()) { this.ui.toast('Auto-hit is off in dungeons and trials: every attack, dodge and skill is yours', 'warn'); return; }
    this.auto = force !== undefined ? force : !this.auto;
    this.ui.setAutoBattle(this.auto);
    if (this.auto) { this.autoAnchor = this.player.pos.clone(); this.engage = true; this.ui.toast('Auto-hit ON: attacks enemies within reach, never moves you', 'good'); }
    else { this.autoPref = null; this.ui.toast('Auto-hit OFF'); }
  }

  // ============================================================== quests
  quest() { const q = this.S.quest; return q && q.id ? { def: QUESTS.find((x) => x.id === q.id), ...q } : null; }
  npcById(id) { return this.npcs.find((n) => n.id === id); }
  npcName(id) { return NPCS.find((n) => n.id === id)?.name || id; }

  goToPortal(h, far = false) {
    const p = this.player;
    this.engage = false; this.pendingTalk = null;
    if (flat(p.pos, h.pos) < 4) { p.path = []; this.pendingPortal = null; this.ui.togglePanel('dungeons', true, h.def.id); return; }
    if (!far && flat(p.pos, h.pos) > WALK_MAX) { this.giveDirections(h.pos.x, h.pos.z, `the entrance of ${h.def.name}`); return; }
    this.pendingPortal = h; this.pathTo(h.pos.x, h.pos.z, far, far);
  }
  talkTo(n, far = false) {
    const p = this.player;
    if (this.dg || this.war || this.trial) { this.ui.toast(this.war ? 'Finish the battle first' : this.trial ? 'Finish the trial first' : 'Leave the dungeon first', 'warn'); return; }
    if (!far && flat(p.pos, n.pos) > WALK_MAX) { this.pendingStation = null; this.giveDirections(n.pos.x, n.pos.z, `${n.data.name} the ${n.data.title}`); return; }
    if (flat(p.pos, n.pos) > 4.5) { this.pendingTalk = n; this.pathTo(n.pos.x, n.pos.z, far, far); return; }
    const sent = this.pendingTalk === n, st = this.pendingStation;
    this.pendingTalk = null; this.pendingStation = null; p.path = []; this.autoPathing = false; this.ui.setAutoPath(false);
    n.yaw = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z);
    this.sfx.play('open');
    if (st && sent && st.npc === n.id) this.ui.openStation(st.name, n.id);
    else this.openDialog(n);
  }
  // Station windows (forge, gems, alchemy, smithing, market, guild, wardrobe, auction) open only at their NPC.
  stationFor(name) {
    const sel = this.ui.sel;
    if (name === 'forge') return sel.fgTab === 'gems' ? 'opal' : 'gorm';
    if (name === 'life') return { alchemy: 'vera', smithing: 'gorm', red: 'gorm' }[sel.lifeTab] || null;
    return { market: 'mira', guild: 'aldric', wardrobe: 'coco', auction: 'grimsby', trials: 'thalia' }[name] || null;
  }
  // walk to the NPC that runs a station and open it on arrival
  goToStation(name) {
    const id = this.stationFor(name), n = id && this.npcById(id); if (!n) return;
    if (this.dg || this.war || this.trial) { this.ui.toast(`Visit ${n.data.name} the ${n.data.title} in Sylvan Haven`, 'warn'); return; }
    this.ui.closePanels(); this.ui.closeDialog();
    if (flat(this.player.pos, n.pos) <= 4.5) { this.ui.openStation(name, id); return; }
    this.ui.toast(`Heading to ${n.data.name} the ${n.data.title}`);
    this.pendingStation = { npc: id, name };
    this.talkTo(n);
  }

  openDialog(n) {
    const q = this.quest(), S = this.S, d = n.data;
    const btns = [];
    let text = d.greet, qname = null, rewards = null;
    if (q && q.def) {
      if (q.status === 'available' && q.def.giver === n.id && q.def.minLv > S.level) {
        qname = q.def.name; text = `${q.def.text} (You must be Lv ${q.def.minLv} to take this on. Come back when you are stronger.)`;
      } else if (q.status === 'available' && q.def.giver === n.id) {
        qname = q.def.name; text = q.def.text; rewards = q.def.type === 'end' ? null : { ...q.def.rewards, exp: this.questExp(q.def.rewards?.exp || 0), equipQ: this.questEquipQ(q.def) };
        btns.push({ label: q.def.type === 'end' ? 'Farewell' : 'Accept', fn: () => this.acceptQuest() });
      } else if (q.status === 'complete' && q.def.turnin === n.id) {
        qname = q.def.name; text = q.def.done; rewards = { ...q.def.rewards, exp: this.questExp(q.def.rewards?.exp || 0), equipQ: this.questEquipQ(q.def) };
        btns.push({ label: 'Complete', cls: 'green', fn: () => this.completeQuest(n) });
      } else if (q.status === 'active' && q.def.turnin === n.id) {
        qname = q.def.name; text = `Still working on it? ${this.questObjective()}.`;
      }
    }
    const B = S.bounty;
    if (d.service === 'bounty' && this.bountyUnlocked()) {
      if (B && B.status === 'complete') btns.push({ label: 'Turn in Bounty', cls: 'green', fn: () => this.completeBounty() });
      else if (!B) btns.push({ label: 'Take a Bounty', cls: 'blue', fn: () => this.takeBounty() });
    }
    const svc = { pets: ['Pet Collection', 'pets'], mounts: ['Mount Stable', 'mounts'], shop: ['Open Shop', 'mall'], enhance: ['Open the Forge', 'forge', { fgTab: 'enhance' }], market: ['Open the Market', 'market'], guild: [S.guild ? 'Guild Hall' : 'Find a Guild', 'guild', { guildTab: 'hall' }], event: ['Festival Exchange', 'event'] }[d.service];
    if (svc) btns.push({ label: svc[0], cls: 'blue', fn: () => (['forge', 'market', 'guild'].includes(svc[1]) ? this.ui.openStation(svc[1], n.id, svc[2]) : this.ui.togglePanel(svc[1], true)) });
    btns.push(...this.serviceButtons(d));
    if (d.service === 'guild' && S.guild && S.level >= 10) btns.push({ label: `Guild War (${this.warEntriesLeft()} left)`, cls: 'green', fn: () => { this.ui.closeDialog(); this.startWar(); } });
    if (d.service === 'event' && this.event) text = `${d.greet} ${this.event.desc}`;
    if (d.service === 'teleport') { TELEPORTS.forEach((t, i) => { if (this.waystoneOn(i)) btns.push({ label: `${t.name}`, cls: 'blue small', fn: () => this.teleport(i) }); }); const dark = TELEPORTS.filter((t, i) => !this.waystoneOn(i)).length; if (dark) text = `${d.greet} I can only send you to waystones you have awakened on foot: ${dark} still sleep out in the wilds.`; }
    btns.push({ label: 'Goodbye', cls: 'gray' });
    this.ui.dialog({ npc: n, qname, text, rewards, buttons: btns });
  }

  questObjective(q = this.quest()) {
    if (!q || !q.def) return '';
    const d = q.def;
    if (q.status === 'available' && d.minLv > this.S.level) return `Reach Lv ${d.minLv} to continue (now Lv ${this.S.level})`;
    if (q.status === 'available') return `Talk to ${this.npcName(d.giver)}`;
    if (q.status === 'complete') return `${d.type === 'talk' ? 'Talk to' : 'Return to'} ${this.npcName(d.turnin)}`;
    if (d.type === 'kill') return `Defeat ${MONSTERS[d.target].name} (${q.prog}/${d.count})`;
    if (d.type === 'dungeon') return `Clear ${DUNGEONS.find((x) => x.id === d.target)?.name || 'the dungeon'} (${q.prog}/${d.count})`;
    if (d.type === 'level') return `Reach Lv ${d.count} (now Lv ${this.S.level})`;
    if (d.type === 'collect') return `Collect ${ITEMS[d.item].name} (${Math.min(d.count, this.countItem(d.item))}/${d.count})`;
    return `Talk to ${this.npcName(d.turnin)}`;
  }

  acceptQuest() {
    const q = this.quest(), S = this.S; if (!q) return;
    const d = q.def;
    if (d.minLv > S.level) { this.ui.toast(`Reach Lv ${d.minLv} first`, 'warn'); return; }
    this.sfx.play('quest');
    if (d.type === 'end') { S.quest = { id: null, status: 'done', prog: 0 }; S.storyDone = true; this.ui.banner('The End', 'Your legend is complete. Thank you for playing!'); this.ui.closeDialog(); this.ui.refreshQuest(); this.save(); return; }
    if (d.type === 'talk') {
      S.quest.status = 'complete';
      if (d.turnin === d.giver) { this.completeQuest(this.npcById(d.giver)); return; }
    } else {
      S.quest.status = 'active'; S.quest.prog = 0;
      if (d.type === 'collect') this.questCollectCheck();
      if (d.type === 'level' && S.level >= d.count) { S.quest.prog = d.count; this.questReady(d); }
    }
    this.ui.toast(`Quest accepted: ${d.name}`, 'good');
    this.ui.chat('system', `Quest accepted: <b>${esc(d.name)}</b>`);
    this.ui.closeDialog();
    // the giver tells you the way, and the journal keeps their words
    { const T = this.questTarget(); if (T && T.what) this.giveDirections(T.x, T.z, T.what, this.npcName(d.giver)); }
    this.ui.refreshQuest(); this.save();
  }

  completeQuest(n) {
    const q = this.quest(), S = this.S; if (!q || q.status !== 'complete') return;
    const d = q.def, r = d.rewards || {};
    if (d.type === 'collect') this.removeItem(d.item, d.count);
    this.sfx.play('quest');
    this.ui.banner('Quest Complete', d.name);
    this.ui.chat('system', `Quest complete: <b>${esc(d.name)}</b>`);
    if (r.gold) { S.gold += r.gold; }
    if (r.diamonds) { S.diamonds += r.diamonds; }
    if (r.items) for (const [id, qty] of r.items) this.addItem(id, qty);
    if (r.equip) { const eq = this.makeEquip(r.equip, Math.max(S.level, 2), this.questEquipQ(d)); if (this.addEquip(eq)) this.lootMsg(eq.name, RARITY[eq.quality].color); }
    if (r.mats) for (const [id, n] of Object.entries(r.mats)) this.addMat(id, n, true);
    if (r.title) this.unlockTitle(r.title);
    if (r.pet) this.gainPet(r.pet, d.id === 'q10');
    if (r.mount) { this.gainMount(r.mount); }
    if (r.sprite) { const sid = CLASS_SPRITE[S.cls]; if (!S.sprites.includes(sid)) S.sprites.push(sid); this.setSprite(sid); this.ui.chat('system', `The Sprite <b>${SPRITES.find((x) => x.id === sid).name}</b> now flies at your side.`); }
    if (r.wings) { S.wings = true; this.rebuildPlayerModel(); if (this.mounted) { this.dismount(true); this.mount(true); } S.title = Math.max(S.title, 5); this.refreshPlayerPlate(); this.fx.levelUp(this.player); }
    if (d.id === 'q2') S.title = Math.max(S.title, 1);
    if (d.id === 'q4') { S.title = Math.max(S.title, 2); this.refreshPlayerPlate(); }
    if (r.exp) this.gainExp(this.questExp(r.exp));
    this.ui.refreshWallet();
    S.quest = d.next ? { id: d.next, status: 'available', prog: 0 } : { id: null, status: 'done', prog: 0 };
    { const T2 = this.questTarget(); if (T2 && T2.npc !== n && T2.what) this.after(0.6, () => this.giveDirections(T2.x, T2.z, T2.what, n?.data?.name)); }
    const nd = d.next && QUESTS.find((x) => x.id === d.next), ch = CHAPTERS.find((c) => c.n === (nd?.ch || 1));
    if (nd && (nd.ch || 1) !== (d.ch || 1) && ch) {
      setTimeout(() => this.ui.banner(`Chapter ${ROMAN[ch.n]}`, ch.name, 'clear'), 1600);
      this.ui.chat('announce', `<b>Chapter ${ROMAN[(d.ch || 1)]} complete!</b> Chapter ${ROMAN[ch.n]} · <b>${esc(ch.name)}</b> begins (${esc(ch.lv)}).`);
      this.logEvent('story', `Started Chapter ${ROMAN[ch.n]}: ${ch.name}`, true);
    }
    this.recalc(); this.ui.refreshQuest(); this.ui.refreshPanel(); this.save();
    const nq = this.quest();
    if (nq && nq.def && nq.def.giver === n?.id) setTimeout(() => this.openDialog(n), 350);
    else this.ui.closeDialog();
  }

  questEquipQ(d) { return d.rewards?.equipQ ?? (d.id === 'q10' ? 4 : d.id === 'q9' ? 3 : 2); }
  questLevelUp() {
    const q = this.quest();
    if (q && q.def && q.status === 'active' && q.def.type === 'level' && this.S.level >= q.def.count) { this.S.quest.prog = q.def.count; this.questReady(q.def); }
    this.ui.refreshQuest();
  }
  questDungeon(id) {
    const q = this.quest(), d = q?.def;
    if (!d || q.status !== 'active' || d.type !== 'dungeon' || d.target !== id) return;
    this.S.quest.prog = Math.min(d.count, (this.S.quest.prog || 0) + 1);
    if (this.S.quest.prog >= d.count) this.questReady(d);
    this.ui.refreshQuest();
  }
  questKill(m) {
    const q = this.quest(), S = this.S;
    if (q && q.def && q.status === 'active') {
      const d = q.def;
      if (d.type === 'kill' && d.target === m.type) {
        S.quest.prog++;
        this.ui.toast(`${MONSTERS[d.target].name} ${Math.min(S.quest.prog, d.count)}/${d.count}`);
        if (S.quest.prog >= d.count) this.questReady(d);
      }
      if (d.type === 'collect' && d.target === m.type && Math.random() < d.chance && this.countItem(d.item) < d.count) {
        this.addItem(d.item, 1); this.lootMsg(ITEMS[d.item].name, RARITY[1].color);
      }
    }
    const B = S.bounty;
    if (B && B.status === 'active' && B.target === m.type) {
      B.prog++;
      if (B.prog >= B.count) { B.status = 'complete'; this.ui.toast('Bounty complete! Report to Captain Elena', 'good'); this.sfx.play('quest'); }
    }
    this.ui.refreshQuest();
  }
  questCollectCheck() {
    const q = this.quest();
    if (q && q.def && q.status === 'active' && q.def.type === 'collect' && this.countItem(q.def.item) >= q.def.count) this.questReady(q.def);
    this.ui.refreshQuest();
  }
  questReady(d) {
    this.S.quest.status = 'complete';
    this.sfx.play('quest');
    this.ui.toast(`Quest objective complete! Return to ${this.npcName(d.turnin)}`, 'good');
    this.ui.chat('system', `<b>${esc(d.name)}</b>: objective complete. Return to ${esc(this.npcName(d.turnin))}.`);
    if (this.auto && this.autoPref === d.target) { this.toggleAuto(false); this.autoQuest('main'); }
  }
  bountyUnlocked() { const i = QUESTS.findIndex((x) => x.id === this.S.quest.id); return i === -1 || i >= 5; }
  takeBounty() {
    const S = this.S;
    const options = BOUNTY_TARGETS.filter((t) => MONSTERS[t].lvl[0] <= S.level + 2);
    const target = options.length ? options[Math.max(0, options.length - 1 - ((Math.random() * 2) | 0))] : 'jelly';
    const count = MONSTERS[target].elite ? 4 : 10;
    S.bounty = { target, count, prog: 0, status: 'active' };
    this.sfx.play('quest'); this.ui.toast(`Bounty: defeat ${count} ${MONSTERS[target].name}`, 'good');
    this.ui.refreshQuest(); this.ui.closeDialog(); this.save();
  }
  completeBounty() {
    const S = this.S, B = S.bounty; if (!B || B.status !== 'complete') return;
    const exp = this.questExp(0, 0.06), gold = 150 + S.level * 40;
    S.gold += gold; S.diamonds += 10; S.bounty = null;
    this.track('bounty');
    this.sfx.play('quest'); this.ui.banner('Bounty Complete', `+${fmt(exp)} EXP · +${fmt(gold)} Gold · +10 Diamonds`);
    this.gainExp(exp); this.ui.refreshWallet(); this.ui.refreshQuest(); this.ui.closeDialog(); this.save();
  }

  // the quest tracker's path finder: walks (and rides) you all the way to the quest giver, the monsters or the dungeon
  autoQuest(which = 'main') {
    const p = this.player; if (p.dead) return;
    if (this.dg || this.war || this.trial) { this.ui.toast(this.war ? 'Finish the battle first' : this.trial ? 'Finish the trial first' : 'Leave the dungeon first', 'warn'); return; }
    const q = this.quest();
    if (which === 'main' && q?.def && q.status === 'available' && q.def.minLv > this.S.level) { this.ui.toast(`Reach Lv ${q.def.minLv} to continue the story: try bounties, dungeons and the zone for your level`, 'warn'); return; }
    if (which === 'main' && q?.def?.type === 'level' && q.status === 'active') { this.ui.toast(`Reach Lv ${q.def.count}: try bounties, dungeons and the zone for your level`, 'warn'); return; }
    const T = this.questTarget(which); if (!T) return;
    this.engage = false; this.pendingSkill = null; this.pendingTalk = null; this.pendingPortal = null; this.pendingLife = null;
    if (T.npc) { this.talkTo(T.npc, true); if (this.pendingTalk) this.ui.toast(`Auto-path: heading to ${T.what}`); return; }
    if (T.portal) { this.goToPortal(T.portal, true); if (this.pendingPortal) this.ui.toast(`Auto-path: heading to ${T.what}`); return; }
    if (flat(p.pos, T) < 14) { this.ui.toast(`You are at ${T.what}`); return; }
    this.pathTo(T.x, T.z, true, true);
    this.ui.toast(`Auto-path: heading to ${T.what}`);
  }

  teleport(i) {
    const t = TELEPORTS[i];
    this.ui.closeDialog();
    this.castBar(`Teleporting to ${t.name}`, 1.4, () => {
      const p = this.player;
      this.fx.pillar(p.pos, 0x7ad8ff, 1.6, 10, 0.8);
      const [x, z] = this.world.nearestFree(t.x, t.z);
      p.pos.set(x, this.world.heightAt(x, z), z); p.path = [];
      this.cam.target.copy(p.pos);
      if (this.pet) this.pet.pos.set(x - 1.5, p.pos.y, z - 1);
      this.fx.pillar(p.pos, 0x7ad8ff, 1.6, 10, 1.0); this.fx.circle(p.pos, '#7ad8ff', 2.5, 1.2);
      this.sfx.play('cast');
    });
  }

  // ============================================================== activities
  claimSignin() {
    const S = this.S;
    if (S.signin.last === today()) { this.ui.toast('Already claimed today — come back tomorrow!', 'warn'); return; }
    const r = SIGNIN[S.signin.count % 7];
    S.signin.count++; S.signin.last = today();
    this.grant(r);
    this.ui.toast(`Day ${r.day} reward: ${r.label}`, 'good'); this.sfx.play('quest');
    this.ui.refreshPanel(); this.ui.refreshActs(); this.save();
  }
  grant(r) {
    const S = this.S;
    if (r.gold) S.gold += r.gold;
    if (r.diamonds) S.diamonds += r.diamonds;
    if (r.items) for (const [id, q] of r.items) this.addItem(id, q);
    if (r.pet) { if (S.pets[r.pet]) { S.gold += 1000; this.ui.toast('Duplicate pet converted to 1,000 Gold', 'good'); } else this.gainPet(r.pet); }
    if (r.mount) { if (S.mounts.includes(r.mount)) S.gold += 2000; else this.gainMount(r.mount); }
    this.ui.refreshWallet();
  }
  claimGift() {
    const S = this.S, g = ONLINE_GIFTS[S.gift.idx]; if (!g) return;
    if (S.gift.t < g.secs) { this.ui.toast('Gift is not ready yet', 'warn'); return; }
    this.grant(g); S.gift.idx++; S.gift.t = 0;
    this.ui.toast(`Online gift: ${g.label}`, 'good'); this.sfx.play('quest'); this.ui.refreshActs(); this.save();
  }
  buyMall(i) {
    const S = this.S, m = MALL[i];
    const c = m.cost;
    if (m.kind === 'pet' && S.pets[m.id]) { this.ui.toast('You already own this pet', 'warn'); return; }
    if (m.kind === 'mount' && S.mounts.includes(m.id)) { this.ui.toast('You already own this mount', 'warn'); return; }
    if ((c.gold || 0) > S.gold || (c.diamonds || 0) > S.diamonds) { this.ui.toast(c.gold ? 'Not enough Gold' : 'Not enough Diamonds', 'warn'); this.sfx.play('error'); return; }
    S.gold -= c.gold || 0; S.diamonds -= c.diamonds || 0;
    if (m.kind === 'item') { this.addItem(m.id, m.qty); this.ui.toast(`Bought ${ITEMS[m.id].name} x${m.qty}`, 'good'); }
    if (m.kind === 'pet') this.gainPet(m.id, true);
    if (m.kind === 'mount') this.gainMount(m.id, true);
    this.sfx.play('coin'); this.ui.refreshWallet(); this.ui.refreshPanel(); this.save();
  }
  setSetting(k, v) {
    this.S.settings[k] = v;
    if (k === 'shadows') { this.renderer.shadowMap.enabled = v; this.sun.castShadow = v; this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; }); }
    if (k === 'sound') this.sfx.on = v;
    this.save();
  }
  sendChat(text) {
    text = text.trim().slice(0, 80); if (!text) return;
    const pm = /^\/p(arty)?\s+/i.exec(text);
    if (pm || this.ui.chatFilter === 'party') { this.partySay(pm ? text.slice(pm[0].length) : text); return; }
    this.ui.chat('world', esc(text), this.S.name);
    if (this.mpSendChat) this.mpSendChat(text);
  }

  // ============================================================== portraits
  headIcon() {
    const key = 'player-head';
    return this.portraits.snap(key, () => buildHumanoid(this.playerLook()), { w: 128, h: 128, look: [0, 1.5, 0], from: [0.45, 1.62, 2.3], fov: 32 });
  }
  fullIcon() {
    return this.portraits.snap('player-full', () => { const m = buildHumanoid(this.playerLook()); m.rotation.y = 0.35; return m; }, { w: 190, h: 250, look: [0, 1.08, 0], from: [0, 1.25, 5.4], fov: 30 });
  }
  npcIcon(id, look) {
    return this.portraits.snap('npc-' + id, () => buildHumanoid(npcLook(look)), { w: 180, h: 220, look: [0, 1.25, 0], from: [0.5, 1.4, 3.7], fov: 32 });
  }
  monsterIcon(type) {
    const d = MONSTERS[type], h = d.height;
    return this.portraits.snap('mon-' + type, () => monsterModel(d, d.variant ?? 0), { w: 96, h: 96, look: [0, h * 0.62, 0], from: [h * 0.35, h * 0.72, h * 1.25], fov: 34 });
  }
  mountBuild(model) { return MOUNT_BUILD(model); }
  petBuild(model) { return PET_BUILD(model); }
  heroIcon(b) {
    return this.portraits.snap('hero-' + b.name, () => buildHumanoid(b.look), { w: 96, h: 96, look: [0, 1.5, 0], from: [0.45, 1.62, 2.3], fov: 32 });
  }
  heroFullIcon(name, look) {
    return this.portraits.snap('herofull-' + name, () => { const m = buildHumanoid(look); m.rotation.y = 0.35; return m; }, { w: 190, h: 250, look: [0, 1.08, 0], from: [0, 1.25, 5.4], fov: 30 });
  }
  petIcon(id) {
    const pd = PETS.find((x) => x.id === id);
    const small = EVENT_PET_MODELS.has(pd.model), mid = EXTRA_PET_MODELS.has(pd.model);
    return this.portraits.snap('pet-' + id, () => PET_BUILD(pd.model), small ? { w: 112, h: 112, look: [0, 0.32, 0], from: [0.32, 0.5, 1.45], fov: 34 } : mid ? { w: 112, h: 112, look: [0, 0.45, 0], from: [0.45, 0.68, 1.9], fov: 34 } : { w: 112, h: 112, look: [0, 0.6, 0], from: [0.6, 0.95, 2.6], fov: 34 });
  }
  mountIcon(id) {
    const md = MOUNTS.find((x) => x.id === id);
    return this.portraits.snap('mount-' + id, () => { const m = MOUNT_BUILD(md.model); m.rotation.y = 0.6; return m; }, { w: 112, h: 112, look: [0, 1.1, 0], from: [1.6, 1.9, 4.6], fov: 34 });
  }
  spriteIcon(id) {
    const sd = SPRITES.find((x) => x.id === id);
    return this.portraits.snap('sprite-' + id, () => buildSprite(sd.color), { w: 96, h: 96, look: [0, 0, 0], from: [0, 0.1, 1.4], fov: 40 });
  }

  // ============================================================== timers
  after(t, fn) { this.timers.push({ t: this.time + t, fn }); }

  // ============================================================== update
  update(dt) {
    this.time += dt;
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.timers[i].t <= this.time) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    this.updatePlayer(dt);
    this.updatePet(dt);
    this.updateCombat(dt);
    this.updateSoul(dt); this.updateFog(); this.updateNavigation(dt); this.gearTick(dt);
    this.skyUpdate(dt);
    this.dzUpdate(dt);
    this.updateSprite(dt);
    for (const m of this.monsters) this.updateMonster(m, dt);
    for (const n of this.npcs) this.updateNPC(n, dt);
    this.updateLoot(dt);
    this.updateDungeon(dt);
    this.updateTrial(dt); this.animateAuras();
    this.updateSystems(dt);
    this.animateAll(dt);
    this.updateCamera(dt);
    this.updatePlates();
    this.updateTargetRing();
    this.updateMisc(dt);
  }

  updatePlayer(dt) {
    const p = this.player, S = this.S;
    if (p.dead) return;
    p.actT = Math.max(0, p.actT - dt);
    if (p.stun > 0) { p.stun -= dt; return; }
    // buffs
    p.buffs = p.buffs.filter((b) => b.until > this.time || (b.shield && p.shield > 0 && b.until > this.time));
    if (!p.buffs.some((b) => b.shield)) p.shield = 0;
    // casting bar
    if (this.casting) {
      const c = this.casting; c.t += dt;
      if (flat(p.pos, c) > 0.5 || this.keys.w || this.keys.a || this.keys.s || this.keys.d || this.stick.x || this.stick.y) { this.casting = null; this.ui.cancelCast(); c.onEnd?.(); this.ui.toast('Interrupted', 'warn'); }
      else if (c.t >= c.dur) { this.casting = null; this.ui.cancelCast(); c.onEnd?.(); c.done(); }
    }
    // dodge rolls, leaps and dashes move the hero by themselves
    const rolled = this.updateRoll(dt) || !!this.tween;
    let moving = rolled;
    if (!rolled) {
    // keyboard
    let kx = 0, kz = 0;
    if (this.keys.w || this.keys.arrowup) kz -= 1; if (this.keys.s || this.keys.arrowdown) kz += 1;
    if (this.keys.a || this.keys.arrowleft) kx -= 1; if (this.keys.d || this.keys.arrowright) kx += 1;
    if (this.stick.x || this.stick.y) { kx = this.stick.x; kz = this.stick.y; } // on-screen joystick (phones)
    const speed = this.speedOf(p);
    if ((kx || kz) && p.actT <= 0.1) {
      const y = this.cam.yaw;
      const fx = -Math.sin(y), fz = -Math.cos(y), rx = Math.cos(y), rz = -Math.sin(y);
      let dx = fx * -kz + rx * kx, dz = fz * -kz + rz * kx; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
      this.moveEnt(p, p.pos.x + dx * 3, p.pos.z + dz * 3, speed, dt);
      moving = true; this.pendingSkill = null; this.pendingTalk = null; this.pendingPortal = null; this.engage = this.auto ? this.engage : false;
    }
    // pending skill: approach
    const t = p.target;
    if (!moving && this.pendingSkill != null) {
      const sk = this.pendingSkill;
      if (!t || t.dead) this.pendingSkill = null;
      else {
        const d = flat(p.pos, t.pos) - t.radius;
        if (d <= this.skRange(sk)) { if (p.actT <= 0) this.castSkill(sk); }
        else { this.moveEnt(p, t.pos.x, t.pos.z, speed, dt); moving = true; }
      }
    }
    // auto battle
    if (this.auto && !moving && this.pendingSkill == null) this.autoBattle(dt);
    // engage basic attacks
    if (!moving && this.pendingSkill == null && this.engage && t && (t.kind === 'monster' || this.pvpFoe(t)) && !t.dead) {
      const basic = this.basicSkill();
      const d = flat(p.pos, t.pos) - t.radius;
      if (d > this.skRange(basic)) {
        if (this.auto) { /* auto-hit never moves your hero */ }
        else if (this.map.lineClear(p.pos.x, p.pos.z, t.pos.x, t.pos.z)) { this.moveEnt(p, t.pos.x, t.pos.z, speed, dt); moving = true; }
        else if (!p.path.length) p.path = this.map.findPath(p.pos.x, p.pos.z, t.pos.x, t.pos.z);
      } else if (p.actT <= 0 && this.skillReady(basic) && !this.casting && !this.channel) {
        p.path = []; this.castSkill(basic);
      } else p.yawT = Math.atan2(t.pos.x - p.pos.x, t.pos.z - p.pos.z);
    }
    // path following
    if (!moving && p.path.length && p.actT <= 0.1) {
      const wp = p.path[0];
      const r = this.moveEnt(p, wp.x, wp.z, speed, dt);
      moving = true;
      if (r === true || flat(p.pos, wp) < 0.4) p.path.shift();
      if (r === 'blocked' && p.path.length) {
        p.blockedN = (p.blockedN || 0) + 1;
        const end = p.path[p.path.length - 1];
        p.path = p.blockedN > 3 ? [] : this.map.findPath(p.pos.x, p.pos.z, end.x, end.z);
      } else if (r !== 'blocked') p.blockedN = 0;
      if (!p.path.length) {
        this.autoPathing = false; this.ui.setAutoPath(false);
      }
    }
    }
    if (this.pendingTalk && flat(p.pos, this.pendingTalk.pos) < 4.5) { const n = this.pendingTalk; this.talkTo(n); }
    if (this.pendingPortal && flat(p.pos, this.pendingPortal.pos) < 4) this.goToPortal(this.pendingPortal);
    // jump physics
    if (p.vy !== 0 || p.jumpY > 0) { p.vy -= 24 * dt; p.jumpY = Math.max(0, p.jumpY + p.vy * dt); if (p.jumpY === 0) p.vy = 0; }
    p.pos.y = this.map.heightAt(p.pos.x, p.pos.z);
    p.inner.position.y = p.jumpY;
    p.moving = moving; this.mpMoving = moving;
    if (p.actT <= 0) p.state = moving ? 'run' : 'idle';
    // regen
    const ooc = this.time - this.lastCombat > 5;
    const zoneSafe = this.zone && this.zone.safe;
    const rate = ooc && !this.trial ? (zoneSafe ? 0.06 : 0.025) : 0; // no resting inside a trial
    if (rate) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * rate * dt); }
    p.mp = Math.min(p.maxMp, p.mp + p.maxMp * (ooc ? 0.03 : 0.012) * dt);
    if (S.settings.autoPotion && p.hp < p.maxHp * 0.35 && this.countPotions('hp_potion') && this.potionCD <= this.time) this.usePotion('hp_potion');
    if (S.settings.autoPotion && p.mp < p.maxMp * 0.15 && this.countPotions('mp_potion') && this.potionCD <= this.time) this.usePotion('mp_potion');
    // gear effects that tick over time
    const regen = this.stat('regen') + (this.hasFx('worldtree') ? p.maxHp * 0.012 : 0);
    if (regen > 0) p.hp = Math.min(p.maxHp, p.hp + regen * dt);
    if (this.hasFx('holy_nova') && !ooc) {
      this.novaT -= dt;
      if (this.novaT <= 0) {
        this.novaT = 8;
        this.fx.ring(p.pos, 0xfff0a0, 6, 0.6); this.fx.pillar(p.pos, 0xfff0a0, 1.4, 6, 0.6);
        this.aoe(p.pos.clone(), 6, 1.5, 0, true); this.heal(p, p.maxHp * 0.05); this.sfx.play('heal');
      }
    }
    // legendary / unique weapons shimmer
    const wq = S.equip.weapon?.quality ?? 0;
    if (wq >= 4 && p.humanoid && Math.random() < dt * (wq === 5 ? 16 : 8)) {
      const hp = new THREE.Vector3(); p.humanoid.userData.parts.handR.getWorldPosition(hp);
      this.fx.emit(hp, { count: 1, color: RARITY[wq].color, speed: 0.5, life: 0.7, size: 0.45, up: 1.2, jitter: 0.6 });
    }
    // enhanced weapons glow: blue from +7, violet from +10, blazing from +15
    const we = S.equip.weapon?.enh || 0;
    if (we >= 7 && p.humanoid && Math.random() < dt * (we >= 15 ? 26 : we >= 10 ? 14 : 7)) {
      const hp = new THREE.Vector3(); p.humanoid.userData.parts.handR.getWorldPosition(hp);
      this.fx.emit(hp, { count: we >= 15 ? 2 : 1, colors: we >= 15 ? [0xff5a2a, 0xffc04a] : [we >= 10 ? 0xc46bff : 0x5ab8ff], speed: 0.7, life: 0.6, size: we >= 15 ? 0.6 : 0.45, up: 1.6, jitter: 0.5 });
    }
  }

  autoBattle() {
    const p = this.player;
    let t = p.target;
    if (!t || t.dead || t.kind !== 'monster') {
      const anchor = this.autoAnchor || p.pos;
      t = this.nearestEnemy(14, this.autoPref, p.pos) || this.nearestEnemy(40, this.autoPref, anchor) || (this.autoPref ? null : this.nearestEnemy(40, null, anchor));
      if (t) { this.setTarget(t); this.engage = true; }
      else if (this.autoAnchor && flat(p.pos, this.autoAnchor) > 6 && !p.path.length) p.path = this.map.findPath(p.pos.x, p.pos.z, this.autoAnchor.x, this.autoAnchor.z);
      return;
    }
    this.engage = true;
    if (p.actT > 0) return;
    const list = this.skillList();
    // heal / buffs first
    for (let i = list.length - 1; i >= 1; i--) {
      const sk = list[i];
      if (this.S.level < sk.lvl || (this.cd[sk.id] || 0) > this.time || p.mp < this.mpCost(sk)) continue;
      if (sk.kind === 'heal' && p.hp > p.maxHp * 0.6) continue;
      if (sk.kind === 'buff' && p.buffs.some((b) => b.id === sk.id)) continue;
      if (sk.kind === 'zone' && p.hp > p.maxHp * 0.8 && flat(p.pos, t.pos) > sk.radius) continue;
      if (sk.kind === 'aoeSelf' && flat(p.pos, t.pos) > sk.radius) continue;
      const d = flat(p.pos, t.pos) - t.radius;
      if (['target', 'dash', 'proj', 'aoeTarget'].includes(sk.kind) && d > (sk.range || 3)) continue;
      this.useSkill(i);
      return;
    }
  }

  moveEnt(e, tx, tz, speed, dt) {
    const dx = tx - e.pos.x, dz = tz - e.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return true;
    const step = Math.min(d, speed * dt);
    const nx = e.pos.x + (dx / d) * step, nz = e.pos.z + (dz / d) * step;
    const W = e.map || this.world;
    const inside = W.isBlocked(e.pos.x, e.pos.z);
    e.yawT = Math.atan2(dx, dz);
    if (inside || !W.isBlocked(nx, nz)) { e.pos.x = nx; e.pos.z = nz; }
    else if (!W.isBlocked(nx, e.pos.z)) e.pos.x = nx;
    else if (!W.isBlocked(e.pos.x, nz)) e.pos.z = nz;
    else return 'blocked';
    return d <= step;
  }

  updatePet(dt) {
    const e = this.pet; if (!e) return;
    const p = this.player;
    e.attackCD -= dt;
    const pd = e.data, lv = this.S.pets[pd.id]?.lv || 1;
    e.level = p.level;
    e.atk = pd.atk * (1 + 0.15 * (lv - 1)) + p.atk * 0.15; e.crit = 5; e.critDmg = 0.5;
    const t = p.target && p.target.kind === 'monster' && !p.target.dead && this.time - this.lastCombat < 4 ? p.target : null;
    let moving = false;
    if (flat(e.pos, p.pos) > 30) { e.pos.set(p.pos.x - 1, p.pos.y, p.pos.z - 1); }
    if (t && flat(t.pos, p.pos) < 25) {
      const d = flat(e.pos, t.pos) - t.radius;
      if (d > 1.6) { this.moveEnt(e, t.pos.x, t.pos.z, Math.max(8, this.speedOf(p) * 1.1), dt); moving = true; }
      else {
        e.yawT = Math.atan2(t.pos.x - e.pos.x, t.pos.z - e.pos.z);
        if (e.attackCD <= 0) {
          e.attackCD = 1.5 / (this.petIs('frenzy') ? 1 + this.petFx.v / 100 : 1); e.state = 'attack'; e.actT = e.actDur = 0.4;
          this.after(0.18, () => { if (!t.dead) { this.damage(e, t, 1); this.fx.emit(t.pos.clone().setY(t.pos.y + 1), { count: 10, color: 0xff9ad8, speed: 3, life: 0.4, size: 0.5 }); this.petStrike(t); } });
        }
      }
    } else {
      const off = new THREE.Vector3(-1.4, 0, -1.3).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.yaw);
      const gx = p.pos.x + off.x, gz = p.pos.z + off.z;
      if (Math.hypot(gx - e.pos.x, gz - e.pos.z) > 0.6) { this.moveEnt(e, gx, gz, Math.max(5, this.speedOf(p) * (flat(e.pos, p.pos) > 5 ? 1.25 : 1.0)), dt); moving = Math.hypot(gx - e.pos.x, gz - e.pos.z) > 0.3; }
      else e.yawT = p.yaw;
    }
    e.actT = Math.max(0, e.actT - dt);
    if (e.actT <= 0) e.state = 'idle';
    e.moving = moving;
    e.pos.y = this.map.heightAt(e.pos.x, e.pos.z);
    this.petTick(dt, t && flat(t.pos, p.pos) < 25 ? t : null);
  }

  // pet abilities that ride on the pet's own bites
  petStrike(t) {
    const P = this.petFx, p = this.player; if (!P || t.dead) return;
    const head = t.pos.clone().setY(t.pos.y + t.height + 0.4);
    if (P.kind === 'poison' && (t.petPoisonT || 0) <= this.time) {
      t.petPoisonT = this.time + 4;
      for (let i = 1; i <= 4; i++) this.after(i, () => { if (!t.dead) { this.fx.emit(t.pos.clone().setY(t.pos.y + t.height * 0.6), { count: 8, color: 0x9aff4a, speed: 1.5, life: 0.5, size: 0.5, up: 1 }); this.damage(p, t, P.v / 100, { canCrit: false, proc: true, cls: 'pet' }); } });
    } else if (P.kind === 'freeze' && !t.def0?.boss && !t.wb && Math.random() * 100 < P.v) {
      t.stun = Math.max(t.stun || 0, 2); this.fx.text(head, 'Frozen', 'miss');
      this.fx.emit(t.pos.clone().setY(t.pos.y + 1), { count: 18, colors: [0xc8f0ff, 0xffffff], speed: 3, life: 0.6, size: 0.5 });
    } else if (P.kind === 'hellfire') {
      this.fx.ring(t.pos, 0xff6a2a, 4, 0.4);
      for (const m of [...this.monsters]) if (m !== t && !m.dead && (m.map || this.world) === this.map && flat(m.pos, t.pos) < 4 + m.radius * 0.5) this.damage(p, m, P.v / 100, { canCrit: false, proc: true, cls: 'pet' });
    }
  }
  // timed pet abilities: heals, mana and shields any time; stomp, star and frost breath while you fight
  petTick(dt, t) {
    const P = this.petFx, p = this.player; if (!P || p.dead) return;
    const every = { heal: 5, mana: 4, shield: 20, stomp: 8, starfall: 10, frostbreath: 12 }[P.kind]; if (!every) return;
    this.petT = (this.petT || 0) + dt;
    if (this.petT < every) return;
    const v = P.v / 100;
    if (P.kind === 'heal') { if (p.hp >= p.maxHp) return; this.heal(p, p.maxHp * v); this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 10, color: 0xffb8e8, speed: 1.5, life: 0.7, size: 0.4, up: 2 }); }
    else if (P.kind === 'mana') { if (p.mp >= p.maxMp) return; p.mp = Math.min(p.maxMp, p.mp + p.maxMp * v); this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 10, color: 0xffd84a, speed: 1.5, life: 0.7, size: 0.4, up: 2 }); }
    else if (P.kind === 'shield') {
      const amt = p.maxHp * v; if ((p.shield || 0) >= amt) return;
      p.shield = amt; p.buffs = p.buffs.filter((b) => b.id !== 'petshield');
      p.buffs.push({ id: 'petshield', icon: 'paw', until: this.time + every, shield: true });
      this.fx.circle(p.pos, '#bfefff', 2, 1, p.model);
    } else {
      if (!t || t.dead || !this.pet) return; // ready the moment a fight starts
      if (P.kind === 'stomp') { const c = this.pet.pos.clone(); this.fx.quake(c, 4); this.sfx.play('boom'); this.aoe(c, 5, v, 1, true); }
      else if (P.kind === 'starfall') { const from = t.pos.clone().add(new THREE.Vector3(rnd(-3, 3), 16, rnd(-3, 3))); this.fx.projectile(from, t, { color: 0xfff08a, size: 0.65, speed: 34, onHit: () => this.damage(p, t, v, { proc: true }) }); }
      else if (P.kind === 'frostbreath') {
        const c = t.pos.clone(); this.fx.ring(c, 0x9ad8ff, 4, 0.5); this.fx.emit(c.clone().setY(c.y + 1), { count: 40, colors: [0xc8f0ff, 0xffffff, 0x7ac8ff], speed: 5, life: 0.7, size: 0.6 });
        for (const m of [...this.monsters]) if (!m.dead && (m.map || this.world) === this.map && flat(m.pos, c) < 4 + m.radius * 0.5) { this.damage(p, m, v, { proc: true, canCrit: false, cls: 'pet' }); if (!m.dead && !m.def0?.boss && !m.wb) m.stun = Math.max(m.stun || 0, 2); }
      }
    }
    this.petT = 0;
  }
  // Nine Tails: fox fire at the target and up to two enemies near it
  petFoxFire(dst) {
    const p = this.player, v = this.petFx.v / 100, from = (this.pet || p).pos.clone().setY((this.pet || p).pos.y + 1.2);
    const near = this.monsters.filter((m) => m !== dst && !m.dead && (m.map || this.world) === this.map && flat(m.pos, dst.pos) < 8).sort((a, b) => flat(a.pos, dst.pos) - flat(b.pos, dst.pos)).slice(0, 2);
    for (const m of [dst, ...near]) this.fx.projectile(from, m, { color: 0xff7ab8, size: 0.32, speed: 24, onHit: () => { if (!m.dead) this.damage(p, m, v, { proc: true, canCrit: false, cls: 'pet' }); } });
  }

  updateSprite(dt) {
    const s = this.sprite; if (!s) return;
    const p = this.player, t = this.time;
    const tgt = new THREE.Vector3(p.pos.x + Math.sin(t * 1.3) * 1.1, p.pos.y + p.height + 0.3 + Math.sin(t * 2.6) * 0.2, p.pos.z + Math.cos(t * 1.3) * 1.1);
    s.position.lerp(tgt, 1 - Math.exp(-dt * 6));
    s.userData.wings.children.forEach((w, i) => { w.rotation.y = (i % 2 ? -1 : 1) * (0.4 + Math.sin(t * 22) * 0.5); });
    if (Math.random() < dt * 14) this.fx.emit(s.position, { count: 1, color: s.userData.color, speed: 0.4, life: 0.8, size: 0.35, gravity: -1 });
    const sd = s.userData.def;
    if (sd.regen) {
      this.spriteRegenT -= dt;
      if (this.spriteRegenT <= 0) { this.spriteRegenT = 4; if (p.hp < p.maxHp && !p.dead) { this.heal(p, p.maxHp * sd.regen); } }
    }
  }

  updateMonster(m, dt) {
    const d = m.def0, W = m.map || this.world;
    if (m.dead) {
      m.deadT += dt; m.respawnT -= dt;
      if (m.deadT > 1.4) { m.inner.position.y = -Math.min(2, (m.deadT - 1.4) * 2); if (m.deadT > 2.4) m.model.visible = false; }
      if (m.respawnT <= 0) this.respawn(m);
      else if (m.respawnT === Infinity && !m.dungeon && !m.warUnit && m.deadT > 3 && !m.removed) this.removeEnt(m);
      return;
    }
    if (m.warUnit) { this.updateWarUnit(m, dt); return; }
    m.actT = Math.max(0, m.actT - dt); m.attackCD -= dt; m.hitT = Math.max(0, (m.hitT || 0) - dt);
    if (this.mStatus(m, dt)) return; // knockbacks, fear, damage over time (combat-world.js)
    if (m.target === this.player && this.pflag('stealth') && !(m.tauntT > this.time)) m.target = null;
    if (m.stun > 0) { m.stun -= dt; m.moving = false; if (Math.random() < dt * 8) this.fx.emit(m.pos.clone().setY(m.pos.y + m.height + 0.2), { count: 1, color: 0xffe07a, speed: 1, life: 0.5, size: 0.4 }); return; }
    if (m.trialAI) { this.updateTrialMonster(m, dt); return; } // trials.js
    const home = m.home;
    let moving = false;
    if (m.target && (m.target.dead || (!m.noLeash && flat(m.pos, home) > (d.boss ? 30 : 38)) || (m.target === this.player && this.player.dead))) { m.target = null; m.returning = true; }
    if (m.returning) {
      const r = this.moveEnt(m, home.x, home.z, m.speed * 1.8, dt); moving = true;
      if (!m.wb) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25 * dt); // the world boss keeps its wounds until it retreats
      if (r === true || flat(m.pos, home) < 1 || r === 'blocked') { m.returning = false; if (!m.wb) m.hp = m.maxHp; }
    } else {
      if (!m.target && d.aggressive && !this.player.dead && !this.pflag('stealth')) {
        const ar = d.boss ? 13 : 9;
        if (flat(m.pos, this.player.pos) < ar && !(this.zone && this.zone.safe)) m.target = this.player;
      }
      const t = m.target;
      if (t) {
        const dd = flat(m.pos, t.pos) - t.radius;
        if (dd > d.range) { if (m.actT <= 0) { const r = this.moveEnt(m, t.pos.x, t.pos.z, m.speed * 1.25, dt); moving = r !== 'blocked'; } }
        else {
          m.yawT = Math.atan2(t.pos.x - m.pos.x, t.pos.z - m.pos.z);
          if (m.attackCD <= 0 && m.actT <= 0) {
            m.attackCD = d.boss ? 2.1 : d.elite ? 1.8 : 1.6; m.state = 'attack'; m.actT = m.actDur = 0.55;
            this.after(0.3, () => {
              if (m.dead || t.dead || m.stun > 0) return;
              if (flat(m.pos, t.pos) - t.radius <= d.range + 1) {
                if (d.ranged) { this.fx.projectile(m.pos.clone().setY(m.pos.y + m.height * 0.6), t, { color: 0xb07aff, size: 0.4, speed: 18, onHit: () => { if (!m.dead) this.damage(m, t, 1); } }); return; }
                this.damage(m, t, 1);
                this.fx.emit(t.pos.clone().setY(t.pos.y + 1), { count: 8, color: d.boss ? 0xc07aff : 0xff8a6a, speed: 3, life: 0.3, size: 0.45 });
              }
            });
          }
          if (d.boss && !(m.silT > this.time)) this.bossSkills(m, t, dt);
        }
      } else {
        m.wanderT -= dt;
        if (m.wanderT <= 0) {
          m.wanderT = rnd(3, 8);
          const a = Math.random() * Math.PI * 2, r = Math.random() * m.spawn.r * 0.8;
          m.wander = { x: m.spawn.x + Math.cos(a) * r, z: m.spawn.z + Math.sin(a) * r };
          if (Math.random() < 0.35) m.wander = null;
        }
        if (m.wander) {
          const r = this.moveEnt(m, m.wander.x, m.wander.z, m.speed * 0.45, dt); moving = true;
          if (r === true || r === 'blocked') m.wander = null;
        }
      }
    }
    if (m.actT <= 0) m.state = 'idle';
    m.moving = moving;
    m.pos.y = W.heightAt(m.pos.x, m.pos.z);
  }

  bossTargets(m) {
    const W = m.map || this.world, out = [];
    if (!this.player.dead && (this.player.map || this.world) === W) out.push(this.player);
    return out;
  }
  bossSkills(m, t, dt) {
    m.skillT -= dt;
    if (m.skillT > 0) return;
    const d = m.def0, W = m.map || this.world;
    // Spellbreaker interrupts: a telegraph only lands if the boss was not interrupted meanwhile
    const seq0 = m.castSeq || 0, tg = (c, r, dur, fn) => this.fx.telegraph(c, r, dur, () => { if ((m.castSeq || 0) !== seq0) return; fn(); });
    const near = W === this.map && flat(m.pos, this.player.pos) < 45;
    const warn = (msg) => { if (near) this.ui.toast(msg, 'warn'); };
    const boom = () => { if (near) this.sfx.play('boom'); };
    const enraged = m.hp < m.maxHp * 0.4;
    m.skillT = (enraged ? 5.5 : 8.5) + Math.random() * 1.5;
    if (enraged && !m.enraged) { m.enraged = true; warn(`${d.name} is enraged!`); this.fx.ring(m.pos, 0xff3a3a, 9, 0.8); }
    const skills = d.skills || ['slam', 'roots'];
    let sk = pick(skills);
    if (sk === 'summon' && ((!m.dungeon && !m.wb) || this.monsters.filter((x) => x.summoned && !x.dead).length >= (m.wb ? 2 : 4))) sk = 'slam';
    const gy = (x, z) => W.heightAt(x, z) + 0.05;
    const hitIn = (c, r, mult) => { for (const e of this.bossTargets(m)) if (flat(e.pos, c) < r) this.damage(m, e, mult, { canCrit: false }); };
    if (sk === 'slam') {
      const c = m.pos.clone().add(new THREE.Vector3(Math.sin(m.yaw) * 3, 0, Math.cos(m.yaw) * 3)); c.y = gy(c.x, c.z);
      warn(`${d.name} raises up — get out of the red circle!`);
      m.state = 'attack'; m.actT = m.actDur = 1.6;
      tg(c, 7, 1.6, () => { if (m.dead) return; this.fx.quake(c, 7); boom(); hitIn(c, 7, 2.4); });
    } else if (sk === 'roots') {
      warn('The ground splits beneath you!');
      for (let i = 0; i < (enraged ? 4 : 3); i++) {
        const c = t.pos.clone().add(new THREE.Vector3(rnd(-4, 4), 0, rnd(-4, 4))); c.y = gy(c.x, c.z);
        tg(c, 3.2, 1.4 + i * 0.15, () => {
          if (m.dead) return;
          this.fx.emit(c.clone().setY(c.y + 0.5), { count: 30, colors: [0x7a3aa8, 0x5ac84a, 0x3a2a1a], speed: 6, life: 0.6, size: 0.8, up: 6, gravity: -14 });
          this.fx.pillar(c, 0x8a4ac8, 1.6, 4, 0.5);
          hitIn(c, 3.2, 1.6);
        });
      }
    } else if (sk === 'nova') {
      const c = m.pos.clone(); c.y = gy(c.x, c.z);
      warn(`${d.name} gathers power — run away!`);
      m.state = 'cast'; m.actT = m.actDur = 2.2;
      this.fx.circle(c, '#ff6aa8', 4, 2.3);
      tg(c, 10, 2.2, () => {
        if (m.dead) return;
        this.fx.ring(c, 0xff6aa8, 11, 0.6); this.fx.ring(c, 0xffffff, 8, 0.45);
        this.fx.emit(c.clone().setY(c.y + 1), { count: 80, colors: [0xff6aa8, 0xffffff, 0xb07aff], speed: 14, life: 0.7, size: 0.9, spread: 1 });
        boom(); if (near) this.fx.shake(0.5); hitIn(c, 10, 2.0);
      });
    } else if (sk === 'breath') {
      m.yaw = m.yawT = Math.atan2(t.pos.x - m.pos.x, t.pos.z - m.pos.z);
      const dir = new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
      warn(`${d.name} inhales deeply — dodge the breath!`);
      m.state = 'attack'; m.actT = m.actDur = 1.8;
      const zones = [[4.5, 3], [8.5, 3.8], [12.5, 4.6]].map(([dist, r]) => { const c = m.pos.clone().addScaledVector(dir, dist); c.y = gy(c.x, c.z); return [c, r]; });
      zones.forEach(([c, r]) => tg(c, r, 1.6));
      this.after(1.6, () => {
        if (m.dead) return;
        for (let i = 0; i < 14; i++) this.after(i * 0.04, () => {
          const c = m.pos.clone().addScaledVector(dir, 2 + i); c.y = gy(c.x, c.z) + 1.4;
          this.fx.emit(c, { count: 8, colors: [0xb07aff, 0x6af0d0, 0xffffff], speed: 4, life: 0.6, size: 1.2, up: 1 });
        });
        boom();
        const hit = new Set();
        for (const [c, r] of zones) for (const e of this.bossTargets(m)) if (!hit.has(e) && flat(e.pos, c) < r) { hit.add(e); this.damage(m, e, 2.6, { canCrit: false }); }
      });
    } else if (sk === 'summon') {
      warn(`${d.name} calls for help!`);
      m.state = 'cast'; m.actT = m.actDur = 1.2;
      const n = (enraged ? 3 : 2) - (m.wb ? 1 : 0); // the world boss is fought alone: fewer, weaker helpers
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random();
        let x = m.pos.x + Math.cos(a) * 5, z = m.pos.z + Math.sin(a) * 5;
        [x, z] = W.nearestFree(x, z);
        const opts = { map: W, dungeon: !!m.dungeon, room: m.room, summoned: true, exact: true };
        if (m.wb) { const lv = Math.max(1, m.level - 2), st = this.monsterStats(d.summon, lv); opts.fixed = { level: lv, hp: Math.round(st.hp * 0.6), atk: st.atk * 0.5, def: st.def }; }
        const add = this.createMonster({ type: d.summon, x, z, r: 2, lvl: [Math.max(1, m.level - 3), Math.max(1, m.level - 1)] }, opts);
        add.target = t; this.fx.spawnPuff(add.pos, 0xc07aff); this.fx.circle(add.pos, '#c07aff', 1.6, 0.8);
      }
    } else if (sk === 'storm') {
      // lightning (or cursed lantern fire) strikes under several targets at once
      const col = d.model === 'pumpkinking' ? '#ff9a2e' : '#9ad8ff', hex = d.model === 'pumpkinking' ? 0xffa040 : 0x9ad8ff;
      warn(d.model === 'pumpkinking' ? 'Lanterns blaze overhead — keep moving!' : 'Thunder gathers overhead — keep moving!');
      m.state = 'cast'; m.actT = m.actDur = 1.4;
      const targets = this.bossTargets(m).filter((e) => flat(e.pos, m.pos) < 30).sort(() => Math.random() - 0.5).slice(0, enraged ? 6 : 4);
      targets.forEach((e, i) => {
        const c = e.pos.clone(); c.y = gy(c.x, c.z);
        this.fx.circle(c, col, 3, 1.5);
        tg(c, 3, 1.3 + i * 0.12, () => {
          if (m.dead) return;
          this.fx.bolt(c.clone().setY(c.y + 18), c.clone().setY(c.y + 0.3), hex, 0.35);
          this.fx.emit(c.clone().setY(c.y + 0.5), { count: 26, colors: [hex, 0xffffff], speed: 7, life: 0.5, size: 0.7, up: 4 });
          boom();
          hitIn(c, 3, 1.8);
        });
      });
    }
  }

  // ============================================================== dungeons
  // the dungeon tracker: say what is left (no auto-path)
  dungeonGo() {
    const dg = this.dg; if (!dg) return;
    const P = this.dungeonProgress();
    this.ui.toast(P.done ? (dg.opened ? 'Step into the exit portal' : 'Open the treasure chest') : P.cur === P.total - 1 ? 'The boss waits in the last chamber' : `Chamber ${P.cur + 1}/${P.total}: defeat all foes (${P.count - P.alive}/${P.count})`);
  }
  dungeonEntries(def) {
    const D = this.S.dgn;
    if (D.date !== today()) { D.date = today(); D.used = {}; }
    return Math.max(0, def.entries - (D.used[def.id] || 0));
  }
  enterDungeon(id) {
    this.clearCombatWorld(); this.auto = false; this.ui.setAutoBattle(false);
    const def = DUNGEONS.find((d) => d.id === id), S = this.S, p = this.player;
    if (!def || this.dg || this.war || this.trial || p.dead) return false;
    if (S.level < def.lv - 2) { this.ui.toast(`Requires Lv ${def.lv - 2}`, 'warn'); this.sfx.play('error'); return false; }
    if (this.dungeonEntries(def) > 0) S.dgn.used[def.id] = (S.dgn.used[def.id] || 0) + 1;
    else if (this.countItem('dungeon_ticket') > 0) this.removeItem('dungeon_ticket', 1);
    else if (S.diamonds >= 30) { S.diamonds -= 30; this.ui.refreshWallet(); }
    else { this.ui.toast('No entries left today. Use a Dungeon Ticket or 30 Diamonds.', 'warn'); this.sfx.play('error'); return false; }
    this.ui.closeDialog(); this.ui.closePanels();
    this.auto = false; this.ui.setAutoBattle(false); this.engage = false; this.setTarget(null);
    p.path = []; this.pendingTalk = null; this.pendingPortal = null; this.pendingSkill = null;
    if (this.casting) { const c = this.casting; this.casting = null; this.ui.cancelCast(); c.onEnd?.(); }
    if (this.mounted) this.dismount(true);
    for (const m of this.monsters) if (m.target === p) { m.target = null; m.returning = true; }
    this.sfx.play('cast');
    this.ui.fade(() => this.switchToDungeon(def));
    return true;
  }
  switchToDungeon(def) {
    const p = this.player;
    const dung = new Dungeon(this.scene, def); dung.build();
    const gate = (this.world.gates || []).find((g) => g.def.id === def.id);
    this.overworldReturn = gate ? { x: gate.front.x, z: gate.front.z, yaw: gate.yaw } : { x: 0, z: 9 };
    this.dg = { def, map: dung, startT: this.time, deaths: 0, cleared: new Set(), bossSpawned: false, boss: null, done: false, opened: false };
    this.world.root.visible = false;
    this.applyAmbience(dung.ambience);
    this.map = dung; p.map = dung;
    p.pos.set(dung.start.x, dung.heightAt(dung.start.x, dung.start.z), dung.start.z);
    p.yaw = p.yawT = dung.start.yaw; this.cam.yaw = 0; this.cam.target.copy(p.pos);
    if (this.pet) { this.pet.map = dung; this.pet.pos.set(p.pos.x - 1.2, p.pos.y, p.pos.z + 1.2); }
    dung.rooms.forEach((room, i) => {
      const list = [];
      for (const [type, n] of room.def.spawns || []) for (let k = 0; k < n; k++) list.push(type);
      const pts = room.spawnPoints(list.length);
      list.forEach((type, k) => {
        const pt = pts[k] || { x: room.x, z: room.z };
        this.createMonster({ type, x: pt.x, z: pt.z, r: 3 }, { map: dung, dungeon: true, room: i, exact: true });
      });
    });
    this.zone = dung.zone; this.ui.setZone(dung.zone);
    this.ui.banner(def.name, `Dungeon · Lv ${def.lv}+`, 'zone');
    this.ui.chat('system', `You entered <b>${esc(def.name)}</b>. Clear each chamber to break the seal ahead. Par time ${Math.round((def.par || 300) / 60)} min for an S rating. The run fails after ${DUNGEON_RULES.timeLimit / 60} minutes or ${DUNGEON_RULES.deathLimit + 1} deaths, and bosses go berserk after ${DUNGEON_RULES.enrageAfter / 60} minutes.`);
    this.ui.enterDungeon();
  }
  applyAmbience(a) {
    const L = this.lights, sc = this.scene;
    if (!this.amb0) this.amb0 = { bg: sc.background, fog: [sc.fog.near, sc.fog.far, sc.fog.color.getHex()], hemi: [L.hemi.color.getHex(), L.hemi.groundColor.getHex(), L.hemi.intensity], ambient: L.ambient.intensity, sun: [this.sun.color.getHex(), this.sun.intensity] };
    const o = this.amb0;
    if (!a) {
      sc.background = o.bg; sc.fog.near = o.fog[0]; sc.fog.far = o.fog[1]; sc.fog.color.setHex(o.fog[2]);
      L.hemi.color.setHex(o.hemi[0]); L.hemi.groundColor.setHex(o.hemi[1]); L.hemi.intensity = o.hemi[2];
      L.ambient.intensity = o.ambient; this.sun.color.setHex(o.sun[0]); this.sun.intensity = o.sun[1];
      return;
    }
    sc.background = new THREE.Color(a.background);
    sc.fog.near = a.fog[0]; sc.fog.far = a.fog[1]; sc.fog.color.setHex(a.fog[2]);
    L.hemi.color.setHex(a.hemi[0]); L.hemi.groundColor.setHex(a.hemi[1]); L.hemi.intensity = a.hemi[2];
    L.ambient.intensity = a.ambient; this.sun.color.setHex(a.sun[0]); this.sun.intensity = a.sun[1];
  }
  dungeonProgress() {
    const dg = this.dg; if (!dg) return null;
    const rooms = dg.map.rooms, p = this.player;
    const cur = dg.done ? rooms.length - 1 : Math.min(rooms.length - 1, dg.cleared.size);
    const inRoom = this.monsters.filter((m) => m.dungeon && m.room === cur && !m.summoned);
    return { cur, total: rooms.length, alive: inRoom.filter((m) => !m.dead).length, count: inRoom.length, time: (dg.done ? dg.time : this.time - dg.startT), boss: dg.boss, done: dg.done, opened: dg.opened, rating: dg.rating, here: dg.map.roomAt(p.pos.x, p.pos.z) };
  }
  updateDungeon(dt) {
    const dg = this.dg; if (!dg) return;
    const map = dg.map, p = this.player, rooms = map.rooms, last = rooms.length - 1;
    map.update(dt, this.time);
    for (let i = 0; i < last; i++) {
      if (dg.cleared.has(i)) continue;
      if (this.monsters.some((m) => m.dungeon && m.room === i && !m.dead)) break;
      dg.cleared.add(i); map.openBarrier(i);
      this.ui.toast(i + 1 < last ? `Chamber ${i + 1} cleared — the seal fades!` : 'The way to the boss is open!', 'good'); this.sfx.play('door');
    }
    if (!dg.bossSpawned && dg.cleared.size >= last && map.roomAt(p.pos.x, p.pos.z) === last) {
      dg.bossSpawned = true;
      const room = rooms[last], type = room.def.boss;
      const b = this.createMonster({ type, x: room.x, z: room.z - room.d * 0.18, r: 1 }, { map, dungeon: true, room: last, exact: true });
      b.yaw = b.yawT = 0; b.skillT = 5; dg.boss = b; dg.bossT = this.time;
      this.fx.pillar(b.pos, 0xc07aff, 4, 16, 1.4); this.fx.spawnPuff(b.pos, 0xc07aff); this.fx.shake(0.6); this.sfx.play('boom');
      this.ui.banner(MONSTERS[type].name, 'Boss Battle', 'boss');
    }
    if (!dg.done && this.time - dg.startT > DUNGEON_RULES.timeLimit) { this.failDungeon('time'); return; }
    if (dg.boss && !dg.boss.dead && !dg.boss.berserk && this.time - dg.bossT > DUNGEON_RULES.enrageAfter) {
      const b = dg.boss; b.berserk = true; b.atk *= 1.6; b.skillT = Math.min(b.skillT, 2);
      this.ui.banner('BERSERK!', `${b.def0.name} grows furious`, 'boss'); this.fx.ring(b.pos, 0xff2a2a, 12, 1); this.sfx.play('boom');
    }
    if (dg.exit && dg.exit.userData.update) dg.exit.userData.update(this.time);
    if (dg.chest && !dg.opened && flat(p.pos, dg.chestEnt.pos) < 3) this.openChest();
    if (dg.exit && flat(p.pos, dg.exitEnt.pos) < 2.6 && !p.dead) {
      if (!dg.opened) { if (this.time - (dg.nagT || -9) > 4) { dg.nagT = this.time; this.ui.toast('Open the treasure chest first!', 'warn'); } }
      else this.leaveDungeon();
    }
  }
  completeDungeon() {
    const dg = this.dg, def = dg.def, S = this.S, map = dg.map;
    if (dg.done) return;
    dg.done = true; dg.time = this.time - dg.startT;
    this.questDungeon(def.id);
    const par = def.par || 300;
    dg.rating = dg.deaths === 0 && dg.time <= par ? 'S' : dg.deaths <= 1 && dg.time <= par * 1.6 ? 'A' : 'B';
    const order = { S: 3, A: 2, B: 1 };
    if (!S.dgn.best[def.id] || order[dg.rating] > order[S.dgn.best[def.id]]) S.dgn.best[def.id] = dg.rating;
    dg.firstClear = !S.dgn.clears[def.id];
    S.dgn.clears[def.id] = (S.dgn.clears[def.id] || 0) + 1;
    this.track('dungeon'); this.addSeasonExp(300);
    if (dg.rating === 'S') { this.track('dungeonS'); this.addSeasonExp(150); }
    const best = S.lb.dgTime[def.id];
    if (!best || dg.time < best) { S.lb.dgTime[def.id] = Math.round(dg.time); if (best) this.ui.chat('system', `New personal record for <b>${esc(def.name)}</b>!`); }
    for (const m of [...this.monsters]) if (m.dungeon && m.summoned && !m.dead) { m.tagged = false; this.killMonster(m); }
    const chest = map.buildChest(); chest.position.set(map.chestPos.x, map.heightAt(map.chestPos.x, map.chestPos.z), map.chestPos.z); map.root.add(chest);
    const exit = map.buildExitPortal(); exit.position.set(map.exitPos.x, map.heightAt(map.exitPos.x, map.exitPos.z), map.exitPos.z); map.root.add(exit);
    dg.chest = chest; dg.exit = exit;
    dg.chestEnt = { kind: 'chest', pos: chest.position, height: 1.6, radius: 1.4, model: chest, dead: false, map };
    dg.exitEnt = { kind: 'exit', pos: exit.position, height: 3, radius: 1.6, model: exit, dead: false, map };
    this.fx.pillar(chest.position, 0xffd84a, 2, 12, 1.4); this.fx.spawnPuff(chest.position, 0xffe07a);
    this.after(1.2, () => { this.ui.banner('DUNGEON CLEARED', `Rating ${dg.rating} · ${Math.floor(dg.time / 60)}:${String(Math.floor(dg.time % 60)).padStart(2, '0')}`, 'clear'); this.sfx.play('level'); });
    this.ui.chat('system', `<b>${esc(def.name)}</b> cleared in ${Math.floor(dg.time / 60)}m ${Math.floor(dg.time % 60)}s · Rating <b>${dg.rating}</b>${dg.firstClear ? ' · First clear bonus!' : ''}`);
    this.logEvent('dungeon', `Cleared ${def.name} · ${dg.rating} · ${Math.floor(dg.time / 60)}m ${Math.floor(dg.time % 60)}s`, true);
    this.save();
  }
  openChest() {
    const dg = this.dg; if (!dg || dg.opened) return;
    dg.opened = true;
    const S = this.S, lid = dg.chest.userData.lid;
    if (lid) this.fx.add(null, 0.7, (k) => { lid.rotation.x = -1.9 * (1 - k); });
    this.sfx.play('chest');
    this.fx.emit(dg.chest.position.clone().setY(dg.chest.position.y + 1), { count: 90, colors: [0xffe07a, 0xffffff, 0xffb84a], speed: 5, life: 1.4, size: 0.7, up: 5, gravity: -6 });
    const bossType = dg.boss ? dg.boss.type : dg.def.rooms[dg.def.rooms.length - 1].boss;
    const lvl = MONSTERS[bossType].lvl[0];
    const named = namedBySource(bossType);
    const n = { S: 4, A: 3, B: 2 }[dg.rating];
    const luck = { S: 0.35, A: 0.18, B: 0 }[dg.rating];
    const items = [];
    for (let i = 0; i < n; i++) {
      let q = rollRarity({ boss: true, dungeon: true, luck, lvl });
      if (i === 0) q = Math.max(q, 3);
      if (i === 0 && dg.firstClear) q = Math.max(q, 4);
      q = Math.min(q, tierFor(lvl)); // a tier never drops below its minimum level
      const nd = q >= 4 && named.length && Math.random() < 0.5 ? pick(named) : null;
      items.push(nd ? genNamed(nd.id, { lvl, cls: S.cls, uid: S.uid++ }) : this.makeEquip(null, lvl, q));
    }
    // this dungeon's set: a piece now and then (always on the first clear), favouring pieces you do not have yet
    const set = setOfDungeon(dg.def.id);
    if (set && Math.random() < (dg.firstClear ? 1 : { S: 0.6, A: 0.4, B: 0.25 }[dg.rating])) {
      const own = new Set([...S.bag.filter((b) => b.eq?.set === set.id).map((b) => b.eq.slot), ...Object.values(S.equip).filter((e) => e?.set === set.id).map((e) => e.slot)]);
      const missing = set.slots.filter((sl) => !own.has(sl));
      const piece = genSet(set.id, { slot: missing.length && Math.random() < 0.7 ? pick(missing) : pick(set.slots), lvl, cls: S.cls, uid: S.uid++ });
      items.push(piece);
      this.logEvent('set', `Found ${piece.name} (${set.name} set)`, true);
    }
    { const six = this.sixDungeonDrop(dg.def.id, dg.rating); if (six) { items.push(six); this.logEvent('set', `Found ${six.name}`, true); } }
    const gold = Math.round(150 * dg.def.lv * (1 + dg.def.lv / 40) * ({ S: 1.6, A: 1.25, B: 1 }[dg.rating]));
    const diamonds = { S: 25, A: 15, B: 10 }[dg.rating];
    const exp = Math.round(needExp(S.level) * ({ S: 0.1, A: 0.07, B: 0.05 }[dg.rating]));
    S.gold += gold; S.diamonds += diamonds;
    let ticket = false;
    if (Math.random() < (dg.rating === 'S' ? 0.35 : 0.15)) { this.addItem('dungeon_ticket', 1); ticket = true; }
    const relicSet = RELIC_SETS[dg.def.id], relics = {};
    if (relicSet) for (let i = 0; i < (dg.rating === 'S' ? 2 : 1); i++) { const r = pick(relicSet.ids); relics[r] = (relics[r] || 0) + 1; this.addMat(r, 1, true); }
    if (Math.random() < 0.12 + (dg.rating === 'S' ? 0.08 : 0)) { this.addItem('crimson_core', 1); relics.crimson = 1; }
    if (Math.random() < 0.06) this.addItem('costume_box', 1);
    const stone = stoneFor(dg.def.lv), sn = (dg.rating === 'S' ? 4 : dg.rating === 'A' ? 3 : 2);
    relics[stone] = (relics[stone] || 0) + sn; this.addMat(stone, sn, true);
    if (Math.random() < 0.05) this.addItem('socket_drill', 1);
    if (Math.random() < (dg.rating === 'S' ? 0.06 : dg.rating === 'A' ? 0.03 : 0.01)) this.addItem('soul_cache', 1);
    for (const eq of items) {
      if (eq.quality >= 2) this.track('lootRare');
      if (!this.addEquip(eq)) this.dropLoot({ eq }, dg.chest.position);
      else if (eq.quality >= 4) this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} looted <span class="it" style="color:${RARITY[eq.quality].color}">[${esc(eq.name)}]</span> from ${esc(dg.def.name)}!`);
    }
    this.gainExp(exp); this.ui.refreshWallet(); this.save();
    this.after(0.6, () => this.ui.lootPopup(items, { gold, diamonds, exp, rating: dg.rating, ticket, title: dg.def.name, mats: Object.fromEntries(Object.entries(relics).filter(([k]) => k !== 'crimson')), note: relics.crimson ? 'A Crimson Core glows among the treasure!' : '' }));
    if (items.some((x) => x.quality >= 5)) { this.sfx.play('legend'); this.fx.shake(0.5); }
  }
  failDungeon(why) {
    const dg = this.dg; if (!dg || dg.done || dg.failed) return;
    dg.failed = true;
    for (const m of this.monsters) if (m.dungeon) { m.target = null; }
    this.sfx.play('error');
    this.ui.banner('RUN FAILED', why === 'time' ? 'Time ran out' : 'Too many deaths', 'boss');
    this.logEvent('dungeonFail', `Failed ${dg.def.name} (${why === 'time' ? 'time ran out' : 'too many deaths'})`, true);
    this.ui.modal('Dungeon failed', why === 'time' ? `You ran out of time in ${dg.def.name}. Grow stronger and try again!` : `You fell too many times in ${dg.def.name}. Grow stronger and try again!`, [{ label: 'Return to Carlyle', fn: () => { const p = this.player; if (p.dead) { p.dead = false; p.state = 'idle'; p.hp = p.maxHp; } this.leaveDungeon(); } }], true);
  }
  // Collection relics: chamber monsters 3%, elites 15%; chests always hold at least one.
  dungeonRelicDrop(m) {
    const set = RELIC_SETS[this.dg.def.id]; if (!set) return;
    const ch = m.def0.boss ? 0 : m.def0.elite ? 0.15 : 0.03;
    if (Math.random() < ch * (1 + ((this.elixirMods && this.elixirMods().luck) || 0))) this.addMat(pick(set.ids), 1);
  }
  leaveDungeon() {
    this.clearCombatWorld();
    const dg = this.dg; if (!dg || dg.leaving) return;
    dg.leaving = true;
    for (const L of [...this.loots]) if (L.map === dg.map) this.pickupLoot(L, true);
    this.ui.fade(() => {
      const p = this.player;
      for (const m of [...this.monsters]) if (m.dungeon) this.removeEnt(m);
      for (const L of [...this.loots]) if (L.map === dg.map) this.removeLoot(L);
      dg.map.dispose();
      this.dg = null; this.map = this.world; p.map = this.world;
      if (this.pet) this.pet.map = this.world;
      this.world.root.visible = true; this.applyAmbience(null);
      const r = this.overworldReturn || { x: 0, z: 9 };
      p.pos.set(r.x, this.world.heightAt(r.x, r.z), r.z); this.cam.target.copy(p.pos);
      if (r.yaw !== undefined) { this.cam.yaw = r.yaw; p.yaw = p.yawT = r.yaw; }
      if (this.pet) this.pet.pos.set(r.x - 1.2, p.pos.y, r.z + 1.2);
      if (p.dead) { p.dead = false; p.state = 'idle'; p.hp = p.maxHp; }
      this.setTarget(null); this.auto = false; this.ui.setAutoBattle(false); p.path = [];
      this.zone = null; this.ui.leaveDungeon(); this.save();
    });
  }

  updateNPC(n, dt) {
    const p = this.player, d = flat(n.pos, p.pos);
    if (d < 7) n.yawT = Math.atan2(p.pos.x - n.pos.x, p.pos.z - n.pos.z); else n.yawT = n.homeYaw;
    if (n.float) n.pos.y = n.baseY + Math.sin(this.time * 2) * 0.15;
    // quest marker
    const q = this.quest(); let mark = null;
    if (q && q.def) {
      if (q.status === 'available' && q.def.giver === n.id && !(q.def.minLv > this.S.level)) mark = '!';
      else if (q.status === 'complete' && q.def.turnin === n.id) mark = '?';
      else if (q.status === 'active' && q.def.turnin === n.id) mark = '…';
    }
    if (n.id === 'elena' && this.S.bounty && this.S.bounty.status === 'complete') mark = '?';
    if (n.id === 'grimsby' && !mark && this.S.auc?.claims?.length) mark = '?'; // auction items or gold waiting to be collected
    if (mark !== n.markChar) {
      n.markChar = mark;
      if (mark) { n.marker.material.map = textTexture(mark, mark === '…' ? { color: '#c8d0e0', stroke: '#2a2a3a' } : {}); n.marker.material.needsUpdate = true; }
    }
    n.marker.visible = !!mark && d < 120;
    n.marker.position.set(n.pos.x, n.pos.y + n.height * (n.data.look === 'brom' ? 1.12 : n.data.look === 'sylphie' ? 0.85 : 1) + 1.55 + Math.sin(this.time * 3) * 0.12, n.pos.z);
  }

  animateAll(dt) {
    const camPos = this.camera.position;
    for (const e of this.ents) {
      const far = e.pos.distanceTo(camPos) > (e.kind === 'monster' && e.def0.boss ? 220 : 110);
      if (e.kind === 'monster' && e.dead && e.deadT > 2.4) continue;
      e.model.visible = !far && !e.netHidden && !(e.kind === 'rp' && !this.S.settings.others);
      if (far) continue;
      e.yaw = angLerp(e.yaw, e.yawT ?? e.yaw, 1 - Math.exp(-dt * 12));
      e.model.rotation.y = e.yaw;
      const t = this.time + e.t0;
      const a = e.actDur ? 1 - e.actT / e.actDur : 0;
      const hum = e.humanoid;
      if (hum) {
        const riding = (e === this.player && this.mounted) || e.mounted;
        animateHumanoid(hum, e.state === 'dead' ? 'dead' : riding && e.state !== 'attack' && e.state !== 'cast' ? 'ride' : e.state, t, a, 1);
        if (riding) animateCreature(e.inner, e.moving ? 'run' : 'idle', t, 0, e.moving);
      } else {
        animateCreature(e.inner, e.state, t, e.state === 'dead' ? Math.min(1, e.deadT || 0) : a, e.moving);
        const bs = e.baseScale || 1; if (e.hitT > 0) { const s = 1 + e.hitT * 0.6; e.inner.scale.set(bs * s, bs / s, bs * s); } else if (e.kind === 'monster') e.inner.scale.setScalar(bs);
      }
    }
    for (const e of this.rplayers || []) if (e.petModel?.visible) animateCreature(e.petModel, 'idle', this.time + e.t0, 0, e.moving);
  }

  updateCamera(dt) {
    const p = this.player, c = this.cam;
    const tgt = p.pos.clone(); tgt.y += (this.mounted ? 2.2 : 1.5) + p.jumpY * 0.5;
    c.target.lerp(tgt, 1 - Math.exp(-dt * 10));
    const cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    const pos = new THREE.Vector3(c.target.x + Math.sin(c.yaw) * cp * c.dist, c.target.y + sp * c.dist, c.target.z + Math.cos(c.yaw) * cp * c.dist);
    const gh = this.map.heightAt(pos.x, pos.z) + 1.2;
    if (pos.y < gh) pos.y = gh;
    if (this.fx.shakeAmt > 0) pos.add(new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(this.fx.shakeAmt * 0.6));
    this.camera.position.copy(pos);
    this.camera.lookAt(c.target);
    // the sun (or moon) follows the player for shadows, from where it stands in the sky (sky.js)
    const ld = this.skyLit ? this.skyLightDir : null;
    this.sun.position.set(p.pos.x + (ld ? ld.x : 50), p.pos.y + (ld ? ld.y : 70), p.pos.z + (ld ? ld.z : 40));
    this.sun.target.position.set(p.pos.x, p.pos.y, p.pos.z);
  }

  updatePlates() {
    const w = this.renderer.domElement.clientWidth / UIZ.k, h = this.renderer.domElement.clientHeight / UIZ.k; // #world-ui may be zoomed (touchfit.js)
    const v = new THREE.Vector3();
    const range = { npc: 80, portal: 90, loot: 40, node: 42, plot: 45, rp: 100, soul: 160 };
    for (const e of [...this.ents, ...this.loots, ...this.portals, ...(this.lifeEnts || []), ...(this.dzBags || []), ...(this.soulEnt ? [this.soulEnt] : []), ...(this.trial ? this.trial.ents.filter((e) => e.np) : [])]) {
      if (!e.np) continue;
      let show = !(e.kind === 'monster' && e.dead) && (!e.map || e.map === this.map) && !(e.kind === 'portal' && (this.dg || this.war || this.trial));
      if (show && e.kind !== 'portal') show = e.model.visible;
      if (show) {
        v.copy(e.pos); v.y += e.npY ?? (e.height + 0.25);
        const dist = v.distanceTo(this.camera.position);
        if (dist > (range[e.kind] || (e.kind === 'monster' && e.def0.boss ? 120 : 55))) show = false;
        else {
          v.project(this.camera);
          if (v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2) show = false;
          else {
            e.np.style.transform = `translate(${((v.x * 0.5 + 0.5) * w) | 0}px, ${((-v.y * 0.5 + 0.5) * h) | 0}px) translate(-50%, -100%)`;
            if (e.npHb) e.npHb.style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';
          }
        }
      }
      if (show !== e.npShown) { e.np.style.visibility = show ? 'visible' : 'hidden'; e.npShown = show; }
    }
  }

  updateTargetRing() {
    const t = this.player.target, r = this.targetRing;
    if (!t || t.dead || !t.model.visible) { r.visible = false; return; }
    r.visible = true;
    r.position.set(t.pos.x, t.pos.y + 0.12, t.pos.z);
    r.scale.setScalar(t.radius * 1.5 + 0.4);
    r.rotation.z = this.time * 1.5;
    r.material.color.set(t.kind === 'monster' ? 0xffffff : 0x7aff7a);
  }

  updateMisc(dt) {
    const S = this.S, p = this.player;
    S.gift.t += dt;
    // zone
    const z = this.map.isDungeon ? this.map.zone : this.dzInside() ? DZ_ZONE : (this.world.zoneAt(p.pos.x, p.pos.z, ZONES) || { name: 'Wilds of Carlyle', lv: '', x: 0, z: 0, wild: true });
    if (!this.zone || z.name !== this.zone.name) {
      const first = !this.zone; this.zone = z; this.ui.setZone(z);
      if (!first && !z.dz) { this.ui.banner(z.name, z.lv ? `Carlyle · ${z.lv}` : 'Carlyle', 'zone'); } // the Danger Zone shows its own warning
      // discovery: the first visit to a zone or dungeon is worth 2% of a level (the zone you start in just counts as seen)
      const D = S.disc;
      if (D && !z.wild && !this.war && !this.trial && !D.zones.includes(z.name)) { D.zones.push(z.name); if (!first) this.after(1.2, () => this.discoverXp('zone', `entered ${esc(z.name)}`)); }
    }
    this.saveT += dt;
    if (this.saveT > 15) { this.saveT = 0; this.save(); }
  }

  save() {
    const S = this.S, p = this.player;
    this.saveFog(); S.lastSeen = Date.now();
    if (this.dg || this.war || this.trial) { const r = this.overworldReturn || { x: 0, z: 9 }; S.pos = { x: r.x, z: r.z }; }
    else if (p && !p.dead) S.pos = { x: Math.round(p.pos.x * 10) / 10, z: Math.round(p.pos.z * 10) / 10 };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch { /* storage unavailable */ }
  }
}

export { fmt, esc, ARENA, TELEPORT_CIRCLE };

installSystems(Game);
installLife(Game);
installEconomy(Game);
installUpgrade(Game);
installLive(Game);
installMp(Game);
installParty(Game);
installTrade(Game);
installSocial(Game);
installGuide(Game);
installSky(Game);
installCombat(Game);
installCombatWorld(Game);
installProgress(Game);
installTrials(Game);
installNavigation(Game);
installGear(Game);
installGather(Game);
installTailor(Game);
installDangerZone(Game);
