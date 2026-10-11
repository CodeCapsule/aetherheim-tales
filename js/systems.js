// Live systems layered onto Game: daily/weekly missions, guilds, guild wars, world bosses, materials, crafting, the player
// market and bot trade offers, gear progression (reforge / re-temper / ascend / gems), the named-item codex, festivals,
// the season pass and leaderboards. installSystems(Game) mixes these methods into Game.prototype.
import * as THREE from 'three';
import {
  CLASSES, MONSTERS, PETS, ITEMS, SLOTS, BOT_NAMES, TITLES, DUNGEONS,
} from './data.js';
import {
  dayKey, weekKey, monthKey, secsToDayEnd, rng32, shuffled, hashStr, monthProgress,
  MATERIALS, GEMS, GEM_LV, gemId, parseGem, SOULS, soulId, MAT_DROPS, RECIPES, SOCKETS, GEM_COMBINE, ASCEND, reforgeCost, retemperCost, salvageYield, CODEX_MILESTONES,
  DAILY_POOL, WEEKLY_POOL, DAILY_CHESTS, WEEKLY_CHESTS,
  GUILD_LIST, GUILD_EXP, GUILD_MAX, GUILD_CREATE, GUILD_JOIN_LV, guildBuff, GUILD_DONATE, GUILD_SHOP, EXTRA_NAMES, GUILD_CHAT, GUILD_ROLES,
  WAR, WAR_DEF, WORLD_BOSS, WB_RANK_REWARDS, MARKET, MARKET_GOODS, MARKET_LINES,
  activeEvent, EVENT_SHOP, seasonInfo, PASS, passReward, SEASON_EXP, SEASON_RANK_REWARDS,
} from './systems-data.js';
import { RARITY, genEquip, genNamed, NAMED_LIST, reforgeItem, retemperItem, ascendItem, fitSockets, sellPrice, itemScore } from './loot.js';
import { Dungeon } from './dungeon.js';
import { buildHumanoid, classLook, HAIR_COLORS, EYE_COLORS } from './models.js';
import { buildEventMonster } from './models-event.js';
import { glowTexture, toon, outlineMaterial } from './toon.js';
import { curveStats, MAX_LEVEL } from './data-world.js';
import { randomGemType, stoneFor } from './upgrade.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MISSIONS = new Map([...DAILY_POOL, ...WEEKLY_POOL].map((m) => [m.id, m]));
export const missionDef = (id) => MISSIONS.get(id);
export const matName = (id) => MATERIALS[id]?.name || id;
export const tokenOf = (ev) => (ev ? ev.currency : null);
// Festival monster spawn areas: one per overworld zone so every level range can farm tokens.
export const EVENT_SPAWNS = [
  { x: 100, z: 38, r: 16, count: 5, lvl: [2, 4] },
  { x: 26, z: 98, r: 14, count: 5, lvl: [6, 8] },
  { x: -98, z: 22, r: 14, count: 5, lvl: [11, 13] },
];

// Save fields for the systems. Safe to call on any save version; fills only what is missing.
export function initSystemsSave(S) {
  S.mats = S.mats || {};
  S.ms = S.ms || { day: '', week: '', daily: [], weekly: [], dpts: 0, wpts: 0, dch: [], wch: [], onlineAcc: 0 };
  if (S.guild === undefined) S.guild = null;
  S.market = S.market || { mine: [], earned: 0, sold: 0, nextLid: 1 };
  S.season = S.season || { key: '', exp: 0, premium: false, free: [], prem: [], warWins: 0, wbBest: 0 };
  S.ev = S.ev || { id: '', got: 0, shop: {} };
  S.codex = S.codex || {}; S.codexClaim = S.codexClaim || [];
  S.titles = S.titles || []; for (let i = 0; i <= Math.min(5, S.title || 0); i++) if (!S.titles.includes(i)) S.titles.push(i);
  S.lb = S.lb || { wbBest: 0, dgTime: {} };
  S.wb = S.wb || { slot: -1, done: false, warned: -1 };
  for (const k of ['bag']) for (const b of S[k] || []) if (b.eq) fitSockets(b.eq);
  for (const k of Object.keys(S.equip || {})) if (S.equip[k]) { fitSockets(S.equip[k]); if (S.equip[k].named) S.codex[S.equip[k].named] = true; }
  for (const b of S.bag || []) if (b.eq && b.eq.named) S.codex[b.eq.named] = true;
  return S;
}

const M = {
  // ============================================================ boot & loop
  initSystems() {
    const S = this.S;
    initSystemsSave(S);
    this.event = activeEvent();
    this.market = { listings: [], refreshAt: 0, offer: null, offerT: rnd(...MARKET.offerEvery) };
    this.sysT = 0; this.guildChatT = rnd(20, 40); this.recruitT = 200;
    this.ensureResets(true);
    this.seasonCheck(true);
    if (this.event) {
      if (S.ev.id !== this.event.id) S.ev = { id: this.event.id, got: 0, shop: {} };
      this.spawnEventMonsters();
      this.buildFestivalDecor();
    }
  },
  updateSystems(dt) {
    const S = this.S;
    this.sysT -= dt;
    S.ms.onlineAcc = (S.ms.onlineAcc || 0) + dt;
    if (S.ms.onlineAcc >= 60) { S.ms.onlineAcc -= 60; this.track('online', 1); }
    this.updateWar(dt);
    this.updateMarket(dt);
    this.updateLife(dt);
    this.updateEconomy(dt);
    this.updateLive(dt);
    if (this.festival) this.festival.update(this.time);
    if (this.wb && this.wb.altarFx) this.wb.altarFx(this.time);
    if (this.sysT <= 0) {
      this.sysT = 1;
      this.ensureResets();
      this.updateWorldBoss();
      this.updateGuildLife();
    }
  },

  // ============================================================ rewards, materials, titles
  addMat(id, n = 1, quiet = false) {
    if (!MATERIALS[id] || n <= 0) return;
    const S = this.S;
    S.mats[id] = (S.mats[id] || 0) + n;
    if (this.event && id === this.event.currency) { S.ev.got += n; this.track('eventToken', n); }
    if (!quiet) this.ui.chat('system', `Obtained <span class="it" style="color:${RARITY[MATERIALS[id].quality].color}">[${esc(MATERIALS[id].name)}]</span> x${n}`);
    this.ui.markMenu && this.ui.markMenu('bag');
    if (this.onMatGain) this.onMatGain(id);
  },
  matCount(id) { return this.S.mats[id] || 0; },
  takeMat(id, n) { const S = this.S; if ((S.mats[id] || 0) < n) return false; S.mats[id] -= n; if (S.mats[id] <= 0) delete S.mats[id]; return true; },
  // cost: { gold, diamonds, mats: {id: n}, contrib, tokens }
  canAfford(c = {}) {
    const S = this.S;
    if ((c.gold || 0) > S.gold || (c.diamonds || 0) > S.diamonds) return false;
    if ((c.contrib || 0) > (S.guild?.contrib || 0)) return false;
    for (const [id, n] of Object.entries(c.mats || {})) if (this.matCount(id) < n) return false;
    return true;
  },
  missingText(c = {}) {
    const S = this.S, out = [];
    if ((c.gold || 0) > S.gold) out.push('Gold');
    if ((c.diamonds || 0) > S.diamonds) out.push('Diamonds');
    if ((c.contrib || 0) > (S.guild?.contrib || 0)) out.push('Contribution');
    for (const [id, n] of Object.entries(c.mats || {})) if (this.matCount(id) < n) out.push(matName(id));
    return out.length ? `Not enough ${out.join(', ')}` : '';
  },
  pay(c = {}) {
    if (!this.canAfford(c)) { this.ui.toast(this.missingText(c), 'warn'); this.sfx.play('error'); return false; }
    const S = this.S;
    S.gold -= c.gold || 0; S.diamonds -= c.diamonds || 0;
    if (c.contrib) S.guild.contrib -= c.contrib;
    for (const [id, n] of Object.entries(c.mats || {})) this.takeMat(id, n);
    this.ui.refreshWallet();
    return true;
  },
  // r: { gold, diamonds, items: [[id, n]], mats: {id: n}, title, pet, mount }
  giveReward(r = {}, quiet = false) {
    const S = this.S;
    this.grant({ gold: r.gold, diamonds: r.diamonds, items: r.items, pet: r.pet, mount: r.mount });
    for (const [id, n] of Object.entries(r.mats || {})) this.addMat(id, n, quiet);
    if (r.title) this.unlockTitle(r.title);
    if (r.contrib && S.guild) S.guild.contrib += r.contrib;
    this.ui.refreshWallet();
  },
  rewardText(r = {}) {
    const out = [];
    if (r.gold) out.push(`${fmt(r.gold)} Gold`);
    if (r.diamonds) out.push(`${fmt(r.diamonds)} Diamonds`);
    for (const [id, n] of r.items || []) out.push(`${ITEMS[id]?.name || id} x${n}`);
    for (const [id, n] of Object.entries(r.mats || {})) out.push(`${matName(id)} x${n}`);
    if (r.contrib) out.push(`${r.contrib} Contribution`);
    if (r.title) out.push(`Title «${r.title}»`);
    return out.join(' · ');
  },
  unlockTitle(name) {
    const S = this.S, i = TITLES.indexOf(name);
    if (i < 0 || S.titles.includes(i)) return;
    S.titles.push(i);
    this.ui.toast(`New title unlocked: ${name}`, 'good');
    this.ui.chat('system', `New title unlocked: <b>«${esc(name)}»</b>. Change titles in the Character panel.`);
  },
  setTitle(i) { const S = this.S; if (!S.titles.includes(i)) return; S.title = i; this.refreshPlayerPlate(); this.ui.refreshPanel(); },
  systemMods() {
    const S = this.S;
    let atk = 0, hp = 0, br = 0;
    if (S.guild) { const b = guildBuff(S.guild.lv); atk += b.atk; hp += b.hp; br += S.guild.lv * 60; }
    const cx = this.codexBonus(); atk += cx.atk; hp += cx.hp; br += cx.found * 40;
    if (this.collectionMods) { const cm = this.collectionMods(); atk += cm.atk; hp += cm.hp; br += cm.br; }
    return { atk, hp, br };
  },

  // ============================================================ drops from kills
  onKillSystems(m) {
    const d = m.def0, S = this.S;
    this.track('kill');
    if (d.elite || d.boss) this.track('killElite');
    this.addSeasonExp(d.boss ? SEASON_EXP.boss : d.elite ? SEASON_EXP.elite : SEASON_EXP.kill);
    const got = [];
    for (const [id, ch, a, b] of MAT_DROPS[m.type] || []) if (Math.random() < ch) got.push([id, Math.round(rnd(a, b))]);
    const gemCh = d.boss ? 0.4 : d.elite ? 0.07 : m.dungeon ? 0.03 : 0.006;
    if (Math.random() < gemCh) got.push([gemId(randomGemType(), d.boss && Math.random() < 0.25 ? 2 : 1), 1]);
    if (!d.structure && !d.war && Math.random() < (d.boss ? 1 : d.elite ? 0.35 : m.dungeon ? 0.1 : 0.05)) got.push([stoneFor(m.level), d.boss ? 3 : 1]);
    if (d.boss && !d.war && Math.random() < (m.wb ? 0.12 : 0.05)) got.push([soulId(pick(Object.keys(SOULS))), 1]);
    if (!d.structure && Math.random() < (d.boss ? 1 : d.elite ? 0.3 : 0.05)) got.push(['spirit_dust', d.boss ? 4 : 1]);
    if (this.event && !d.war) {
      const tok = this.event.currency;
      if (d.festival) got.push([tok, 2 + ((Math.random() * 3) | 0)]);
      else if (d.worldBoss) got.push([tok, 40]);
      else if (Math.random() < (d.boss ? 1 : d.elite ? 0.4 : 0.1)) got.push([tok, d.boss ? 10 : 1]);
    }
    if (!got.length) return;
    const head = m.pos.clone().setY(m.pos.y + m.height + 0.6);
    got.forEach(([id, n], i) => {
      this.addMat(id, n, true);
      this.after(0.35 + i * 0.22, () => this.fx.text(head.clone().setY(head.y + i * 0.5), `+${n} ${MATERIALS[id].name}`, 'mat'));
    });
    if (got.some(([id]) => MATERIALS[id].quality >= 3)) this.ui.chat('system', `Obtained ${got.map(([id, n]) => `<span class="it" style="color:${RARITY[MATERIALS[id].quality].color}">[${esc(MATERIALS[id].name)}]</span> x${n}`).join(', ')}`);
  },

  // ============================================================ daily & weekly missions
  ensureResets(first = false) {
    const S = this.S, M2 = S.ms, day = dayKey(), week = weekKey();
    let changed = false;
    if (M2.week !== week) {
      const rand = rng32('w' + week + S.name);
      const pool = WEEKLY_POOL.filter((m) => m.lv <= Math.max(S.level, 4));
      M2.weekly = shuffled(pool, rand).slice(0, 5).map((m) => ({ id: m.id, prog: 0, done: false, claimed: false }));
      M2.week = week; M2.wpts = 0; M2.wch = [];
      if (S.guild) { S.guild.shopW = {}; }
      changed = true;
    }
    if (M2.day !== day) {
      const ev = activeEvent();
      const rand = rng32('d' + day + S.name);
      const pool = DAILY_POOL.filter((m) => m.lv <= S.level && !m.event && m.id !== 'd_kill');
      const picked = [DAILY_POOL.find((m) => m.id === 'd_kill'), ...shuffled(pool, rand).slice(0, ev ? 4 : 5)];
      if (ev) picked.push(DAILY_POOL.find((m) => m.id === 'd_event'));
      M2.daily = picked.map((m) => ({ id: m.id, prog: 0, done: false, claimed: false }));
      const wasActive = !!M2.day;
      M2.day = day; M2.dpts = 0; M2.dch = [];
      if (S.guild) {
        S.guild.don = { day, gold: 0, mats: 0, diamond: 0 }; S.guild.shopD = {};
        if (wasActive) { const g = Math.round(this.guildSize() * 12); this.addGuildExp(g, true); this.ui.chat('guild', `While you were away, your guildmates donated <b>${g}</b> guild EXP.`); }
      }
      if (this.event?.id !== ev?.id && !first) this.ui.chat('system', 'A new day dawns in Carlyle. Festival status updated, so restart the game to see the new decorations.');
      changed = true;
      if (!first) { this.ui.toast('Daily missions have reset!', 'good'); this.ui.chat('system', 'New <b>daily missions</b> are available. Open Missions (H) to see them.'); }
    }
    if (changed && this.ui.g) { this.ui.refreshActs(); this.ui.refreshQuest(); }
  },
  track(ev, n = 1) {
    const M2 = this.S.ms; if (!M2 || !M2.daily) return;
    let done = 0;
    for (const list of [M2.daily, M2.weekly]) for (const m of list) {
      const d = MISSIONS.get(m.id); if (!d || d.ev !== ev || m.done) continue;
      m.prog = Math.min(d.n, m.prog + n);
      if (m.prog >= d.n) {
        m.done = true; done++;
        this.ui.toast(`Mission complete: ${d.name}`, 'good'); this.sfx.play('quest');
        this.ui.chat('system', `Mission complete: <b>${esc(d.name)}</b>. Claim the reward in Missions (H).`);
        if (list === M2.daily) this.after(0, () => this.track('dailyDone'));
      }
    }
    if (done) { this.ui.refreshActs(); this.ui.refreshQuest(); }
    if (this.ui.panelName === 'missions') this.ui.softRefresh();
  },
  claimMission(kind, i) {
    const M2 = this.S.ms, m = (kind === 'daily' ? M2.daily : M2.weekly)[i]; if (!m || !m.done || m.claimed) return;
    const d = MISSIONS.get(m.id);
    m.claimed = true;
    this.giveReward(d.reward);
    if (kind === 'daily') M2.dpts += d.pts;
    M2.wpts += d.pts;
    this.addSeasonExp(d.pts * SEASON_EXP.missionPt);
    this.sfx.play('coin'); this.fx.buff(this.player, '#ffe07a');
    this.ui.toast(`+${d.pts} activity · ${this.rewardText(d.reward)}`, 'good');
    this.ui.refreshActs(); this.ui.refreshPanel(); this.save();
  },
  claimActivityChest(kind, i) {
    const M2 = this.S.ms, list = kind === 'daily' ? DAILY_CHESTS : WEEKLY_CHESTS, got = kind === 'daily' ? M2.dch : M2.wch, pts = kind === 'daily' ? M2.dpts : M2.wpts;
    const c = list[i]; if (!c || got.includes(i) || pts < c.pts) return;
    got.push(i);
    this.giveReward(c.reward);
    this.sfx.play('chest'); this.fx.levelUp(this.player);
    this.ui.banner('Activity Chest', this.rewardText(c.reward));
    this.ui.refreshActs(); this.ui.refreshPanel(); this.save();
  },
  missionsClaimable() {
    const M2 = this.S.ms; if (!M2.daily) return 0;
    let n = [...M2.daily, ...M2.weekly].filter((m) => m.done && !m.claimed).length;
    n += DAILY_CHESTS.filter((c, i) => M2.dpts >= c.pts && !M2.dch.includes(i)).length;
    n += WEEKLY_CHESTS.filter((c, i) => M2.wpts >= c.pts && !M2.wch.includes(i)).length;
    return n;
  },

  // ============================================================ guilds
  guildDef(name) { return GUILD_LIST.find((g) => g.name === name) || null; },
  guildSize() { const G = this.S.guild; if (!G) return 0; return G.own ? G.members.length + 1 : (this.guildDef(G.name)?.size || 20); },
  guildCap(lv) { return 18 + lv * 4; },
  guildRoster() {
    const S = this.S, G = S.guild; if (!G) return [];
    const me = { name: S.name, cls: S.cls, lv: S.level, br: this.br, role: G.own ? 'Leader' : 'Member', contrib: G.contribTotal || 0, online: true, me: true };
    if (G.own) return [me, ...G.members.map((m) => ({ ...m, online: (hashStr(m.name + Math.floor(Date.now() / 600000)) % 3) === 0 }))];
    const def = this.guildDef(G.name), rand = rng32('roster' + G.name);
    const inWorld = this.bots.filter((b) => b.guild === G.name).map((b) => b.name);
    const names = [...new Set([def.leader, ...inWorld, ...shuffled([...BOT_NAMES, ...EXTRA_NAMES], rand)])].filter((n) => n !== S.name).slice(0, Math.min(def.size - 1, 24));
    const cls = Object.keys(CLASSES);
    const out = names.map((name, i) => {
      const lv = clamp(Math.round(30 - i * 0.7 - rand() * 6), 6, 30);
      return { name, cls: cls[(rand() * 4) | 0], lv, br: Math.round(900 + lv * lv * 28 * (0.8 + rand() * 0.5)), role: GUILD_ROLES[i] || 'Member', contrib: Math.round((4000 - i * 120) * (0.5 + rand())), online: inWorld.includes(name) || (hashStr(name + Math.floor(Date.now() / 600000)) % 3) === 0 };
    });
    out.splice(Math.min(out.length, 6), 0, me);
    return out;
  },
  joinGuild(name) {
    const S = this.S, def = this.guildDef(name);
    if (!def || S.guild) return;
    if (S.level < GUILD_JOIN_LV) { this.ui.toast(`Guilds unlock at Lv ${GUILD_JOIN_LV}`, 'warn'); return; }
    S.guild = this.newGuildState({ name, own: false, lv: def.lv, color: def.color, emblem: def.emblem });
    this.afterGuildJoin(`You joined <b>&lt;${esc(name)}&gt;</b>! Welcome, guildmate~`);
    this.ui.chat('guild', `${esc(def.leader)}: welcome to ${esc(name)}, ${esc(S.name)}! say hi everyone~`);
  },
  createGuild(name, emblem, color) {
    const S = this.S;
    name = String(name || '').trim().replace(/\s+/g, ' ');
    if (S.guild) return false;
    if (S.level < GUILD_CREATE.lv) { this.ui.toast(`Requires Lv ${GUILD_CREATE.lv}`, 'warn'); return false; }
    if (!/^[A-Za-z0-9 '\-]{3,14}$/.test(name)) { this.ui.toast('Guild names use 3-14 letters, numbers or spaces', 'warn'); return false; }
    if (GUILD_LIST.some((g) => g.name.toLowerCase() === name.toLowerCase())) { this.ui.toast('That guild name is taken', 'warn'); return false; }
    if (!this.pay({ gold: GUILD_CREATE.gold })) return false;
    S.guild = this.newGuildState({ name, own: true, lv: 1, color, emblem });
    const rand = rng32('recruits' + name);
    S.guild.members = shuffled(EXTRA_NAMES, rand).slice(0, 3).map((n) => this.makeRecruit(n));
    this.afterGuildJoin(`You founded the guild <b>&lt;${esc(name)}&gt;</b>! Recruits will find their way to your banner.`);
    this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} founded the guild <b>&lt;${esc(name)}&gt;</b>!`);
    return true;
  },
  newGuildState(o) { return { ...o, exp: 0, contrib: 0, contribTotal: 0, joined: dayKey(), don: { day: dayKey(), gold: 0, mats: 0, diamond: 0 }, shopD: {}, shopW: {}, members: [], warDay: '', warUsed: 0, wins: 0, losses: 0 }; },
  makeRecruit(name) {
    const cls = Object.keys(CLASSES), lv = Math.round(rnd(Math.max(5, this.S.level - 6), this.S.level + 4));
    return { name, cls: pick(cls), lv, br: Math.round(900 + lv * lv * 28 * rnd(0.8, 1.3)), role: 'Member', contrib: 0 };
  },
  afterGuildJoin(msg) {
    this.ui.chat('system', msg); this.sfx.play('quest'); this.fx.levelUp(this.player);
    this.ui.banner(this.S.guild.name, `Guild Lv ${this.S.guild.lv}`, 'zone');
    this.refreshPlayerPlate(); this.recalc(); this.ui.refreshPanel(); this.ui.refreshActs(); this.save();
  },
  leaveGuild() {
    const S = this.S; if (!S.guild) return;
    const n = S.guild.name; S.guild = null;
    this.ui.chat('system', `You left <b>&lt;${esc(n)}&gt;</b>.`);
    this.refreshPlayerPlate(); this.recalc(); this.ui.refreshPanel(); this.ui.refreshActs(); this.save();
  },
  addGuildExp(n, quiet = false) {
    const G = this.S.guild; if (!G) return;
    G.exp += n;
    while (G.lv < GUILD_MAX && G.exp >= GUILD_EXP[G.lv]) {
      G.exp -= GUILD_EXP[G.lv]; G.lv++;
      this.ui.banner('GUILD LEVEL UP!', `${G.name} reached Lv ${G.lv}`); this.sfx.play('level');
      this.ui.chat('guild', `<b>${esc(G.name)}</b> reached guild level <b>${G.lv}</b>! Guild Blessing: +${(guildBuff(G.lv).atk * 100).toFixed(1)}% Attack & Max HP.`);
      this.recalc();
    }
    if (!quiet) this.ui.refreshPanel();
  },
  donate(id) {
    const S = this.S, G = S.guild, d = GUILD_DONATE.find((x) => x.id === id); if (!G || !d) return;
    if (G.don.day !== dayKey()) G.don = { day: dayKey(), gold: 0, mats: 0, diamond: 0 };
    if (G.don[id] >= d.max) { this.ui.toast('Daily donation limit reached', 'warn'); return; }
    if (!this.pay(d.cost)) return;
    G.don[id]++; G.contrib += d.contrib; G.contribTotal += d.contrib;
    this.addGuildExp(d.exp);
    this.track('donate');
    this.sfx.play('coin'); this.fx.buff(this.player, G.color || '#9ad0ff');
    this.ui.toast(`+${d.contrib} Contribution · +${d.exp} Guild EXP`, 'good');
    this.ui.chat('guild', `${esc(S.name)} made a ${d.name.toLowerCase()}. Thank you!`);
    this.ui.refreshPanel(); this.save();
  },
  guildShopLeft(it) {
    const G = this.S.guild; if (!G) return 0;
    const used = (it.per === 'week' ? G.shopW : G.shopD)[it.id] || 0;
    return it.max - used;
  },
  guildBuy(id) {
    const S = this.S, G = S.guild, it = GUILD_SHOP.find((x) => x.id === id); if (!G || !it) return;
    if (G.lv < it.lv) { this.ui.toast(`Requires guild Lv ${it.lv}`, 'warn'); return; }
    if (this.guildShopLeft(it) <= 0) { this.ui.toast(`Limit reached this ${it.per}`, 'warn'); return; }
    if (it.item && !this.bagRoomFor(it.item)) return;
    if (!this.pay({ contrib: it.cost })) return;
    const lim = it.per === 'week' ? G.shopW : G.shopD; lim[it.id] = (lim[it.id] || 0) + 1;
    if (it.item) this.addItem(it.item, it.qty); else this.addMat(it.mat, it.qty, true);
    this.sfx.play('coin'); this.ui.toast(`Bought ${it.name}`, 'good'); this.ui.refreshPanel(); this.save();
  },
  bagRoomFor(id) {
    const S = this.S;
    if (S.bag.some((b) => b.id === id) || S.bag.length < this.bagMax()) return true;
    this.ui.toast('Bag is full!', 'warn'); return false;
  },
  updateGuildLife() {
    const S = this.S, G = S.guild; if (!G) return;
    this.guildChatT -= 1;
    if (this.guildChatT <= 0) {
      this.guildChatT = rnd(25, 55);
      const r = this.guildRoster().filter((m) => !m.me && m.online);
      if (r.length) this.ui.chat('guild', esc(pick(GUILD_CHAT)), pick(r).name);
    }
    if (G.own && G.members.length + 1 < this.guildCap(G.lv)) {
      this.recruitT -= 1;
      if (this.recruitT <= 0) {
        this.recruitT = rnd(150, 260);
        const used = new Set(G.members.map((m) => m.name));
        const name = [...BOT_NAMES, ...EXTRA_NAMES].find((n) => !used.has(n) && n !== S.name && Math.random() < 0.15) || EXTRA_NAMES.find((n) => !used.has(n));
        if (name) { G.members.push(this.makeRecruit(name)); this.ui.chat('guild', `<b>${esc(name)}</b> joined the guild! Say hello~`); this.addGuildExp(10, true); }
      }
    }
  },

  // ============================================================ guild war
  warEntriesLeft() {
    const G = this.S.guild; if (!G) return 0;
    if (G.warDay !== dayKey()) { G.warDay = dayKey(); G.warUsed = 0; }
    return Math.max(0, WAR.entries - G.warUsed);
  },
  startWar() {
    const S = this.S, p = this.player, G = S.guild;
    if (!G) { this.ui.toast('Join a guild to fight in Guild Wars', 'warn'); return false; }
    if (S.level < WAR.lv) { this.ui.toast(`Guild Wars unlock at Lv ${WAR.lv}`, 'warn'); return false; }
    if (this.dg || this.war || p.dead) { this.ui.toast('Not available right now', 'warn'); return false; }
    if (this.warEntriesLeft() <= 0) { this.ui.toast('No Guild War entries left today', 'warn'); return false; }
    G.warUsed++;
    const opp = pick(GUILD_LIST.filter((g) => g.name !== G.name));
    this.prepareInstance();
    this.ui.fade(() => this.switchToWar(opp));
    return true;
  },
  prepareInstance() {
    const p = this.player;
    this.ui.closeDialog(); this.ui.closePanels();
    this.auto = false; this.ui.setAutoBattle(false); this.engage = false; this.setTarget(null);
    p.path = []; this.pendingTalk = null; this.pendingPortal = null; this.pendingSkill = null;
    if (this.casting) { this.casting = null; this.ui.cancelCast(); }
    if (this.mounted) this.dismount(true);
    for (const m of this.monsters) if (m.target === p) { m.target = null; m.returning = true; }
    this.sfx.play('cast');
  },
  switchToWar(opp) {
    const S = this.S, p = this.player, L = S.level;
    const arena = new Dungeon(this.scene, WAR_DEF).build();
    const room = arena.rooms[0];
    const ours = { x: room.x, z: room.maxZ - 15 }, theirs = { x: room.x, z: room.minZ + 15 };
    this.overworldReturn = { x: p.pos.x, z: p.pos.z, yaw: this.cam.yaw };
    this.war = { opp, map: arena, left: WAR.duration, allies: [], ours, theirs, score: { us: 0, them: 0 }, kills: 0, deaths: 0, done: false, started: false, countdown: 5 };
    this.world.root.visible = false;
    this.applyAmbience(arena.ambience);
    this.map = arena; p.map = arena;
    p.pos.set(arena.start.x, 0, arena.start.z); p.yaw = p.yawT = Math.PI; this.cam.yaw = 0; this.cam.target.copy(p.pos);
    if (this.pet) { this.pet.map = arena; this.pet.pos.set(p.pos.x - 1.2, 0, p.pos.z + 1.2); }
    const crystalHp = Math.round(Math.max(2600 + 1600 * L, p.atk * 140));
    // our crystal (an allied structure the rivals attack)
    const oc = this.makeEnt('ally', buildEventMonster('warcrystal', 0), { name: 'Spirit Crystal', radius: 2.6, shadowR: 2.4, height: 5.5 });
    oc.map = arena; oc.pos.set(ours.x, 0, ours.z); oc.crystal = true; oc.maxHp = oc.hp = crystalHp; oc.def = 20 + L; oc.atk = 0; oc.yaw = oc.yawT = 0;
    this.nameplate(oc, `<div class="n">${esc(S.guild.name)} Crystal</div>`, 'ally crystal', true); oc.npY = 6.2;
    arena.nav.blockCircle(ours.x, ours.z, 2.4);
    this.war.ourCrystal = oc;
    // their crystal (a monster you can target)
    const tc = this.createMonster({ type: 'warcrystal', x: theirs.x, z: theirs.z, r: 0 }, { map: arena, exact: true, fixed: { level: L, hp: crystalHp, atk: 0, def: 20 + L } });
    tc.warUnit = true; tc.yaw = tc.yawT = Math.PI; tc.np.querySelector('.n').textContent = `${opp.name} Crystal`;
    arena.nav.blockCircle(theirs.x, theirs.z, 2.4);
    this.war.theirCrystal = tc;
    // allies from your guild roster
    const roster = this.guildRoster().filter((m) => !m.me).slice(0, WAR.teamSize);
    roster.forEach((m, i) => this.makeAlly(m, ours.x + (i - 1.5) * 3.2, ours.z + 4, L));
    // rivals from the opposing guild
    const rand = rng32('rivals' + opp.name + dayKey());
    const names = shuffled([opp.leader, ...EXTRA_NAMES, ...BOT_NAMES], rand).slice(0, WAR.teamSize + 1);
    names.forEach((name, i) => {
      const cls = Object.keys(CLASSES)[(rand() * 4) | 0], gender = rand() < 0.55 ? 'f' : 'm';
      const look = classLook(cls, gender, HAIR_COLORS[(rand() * HAIR_COLORS.length) | 0], EYE_COLORS[(rand() * EYE_COLORS.length) | 0], { wings: rand() < 0.5, wingColor: '#ffb0b0' });
      const lvl = clamp(L + Math.round(rand() * 4 - 2), 1, 32);
      const C = CLASSES[cls];
      // rivals are measured against your own hero so wars stay fair from Lv 10 to Lv 200
      const st = { level: lvl, hp: Math.round(Math.max((190 + 34 * lvl), p.maxHp * 0.62) * (C.base.hp / 220)), atk: Math.max(13 + 4.1 * lvl, p.atk * 0.48) * (C.base.atk / 22), def: Math.max(5 + 2.3 * lvl, p.def * 0.55) };
      const r = this.createMonster({ type: 'rival', x: theirs.x + (i - 2) * 3.2, z: theirs.z + 6, r: 3 }, { map: arena, exact: true, look, fixed: st });
      r.warUnit = true; r.cls = cls; r.name = name; r.speed = C.speed * 0.92; r.rangeW = C.ranged ? C.range * 0.8 : 2.4; r.ranged = C.ranged;
      r.labelHtml = `<span class="g">&lt;${esc(opp.name)}&gt;</span> Lv${lvl} ${esc(name)}`;
      r.np.querySelector('.n').innerHTML = r.labelHtml;
      r.yaw = r.yawT = 0;
    });
    this.zone = arena.zone; this.ui.setZone(arena.zone);
    this.ui.banner('GUILD WAR', `${S.guild.name}  vs  ${opp.name}`, 'boss');
    this.ui.chat('system', `<b>Guild War</b> vs <b>&lt;${esc(opp.name)}&gt;</b>! Destroy their Spirit Crystal (north) and protect yours. ${WAR.duration / 60} minutes. Battle starts in 5 seconds.`);
    this.ui.enterWar();
    this.track('war');
  },
  makeAlly(m, x, z, L) {
    const look = classLook(m.cls, hashStr(m.name) % 2 ? 'f' : 'm', HAIR_COLORS[hashStr(m.name) % HAIR_COLORS.length], EYE_COLORS[hashStr(m.name + 'e') % EYE_COLORS.length], { wings: hashStr(m.name) % 3 === 0, wingColor: '#9fe8ff' });
    const hum = buildHumanoid(look);
    const e = this.makeEnt('ally', hum, { name: m.name, radius: 0.6 });
    const C = CLASSES[m.cls];
    e.humanoid = hum; e.cls = m.cls; e.map = this.war.map; e.level = L;
    const p = this.player;
    e.maxHp = e.hp = Math.round(Math.max(200 + 36 * L, p.maxHp * 0.66) * (C.base.hp / 220)); e.atk = Math.max(14 + 4.3 * L, p.atk * 0.5) * (C.base.atk / 22); e.def = Math.max(6 + 2.5 * L, p.def * 0.6); e.crit = 10;
    e.speed = C.speed * 0.92; e.range = C.ranged ? C.range * 0.8 : 2.4; e.ranged = C.ranged; e.home = { x, z };
    e.pos.set(x, 0, z); e.yaw = e.yawT = Math.PI; e.attackCD = rnd(0, 1);
    this.nameplate(e, `<div class="g">&lt;${esc(this.S.guild.name)}&gt;</div><div class="n">${esc(m.name)}</div>`, 'ally', true);
    this.war.allies.push(e);
    return e;
  },
  warFoes(side) {
    const W = this.war;
    if (side === 'rivals') return this.monsters.filter((m) => m.warUnit && !m.dead && !m.def0.structure);
    return [this.player, ...W.allies].filter((e) => !e.dead && !e.crystal);
  },
  updateWar(dt) {
    const W = this.war; if (!W) return;
    W.map.update(dt, this.time);
    if (!W.started) {
      W.countdown -= dt;
      if (Math.ceil(W.countdown) !== W.lastCount && W.countdown > 0) { W.lastCount = Math.ceil(W.countdown); this.ui.banner(String(W.lastCount), '', 'zone'); this.sfx.play('click'); }
      if (W.countdown <= 0) { W.started = true; this.ui.banner('FIGHT!', 'Destroy the enemy Spirit Crystal', 'boss'); this.sfx.play('boom'); }
    } else if (!W.done) {
      W.left -= dt;
      if (W.left <= 0) {
        const a = W.ourCrystal.hp / W.ourCrystal.maxHp, b = W.theirCrystal.hp / W.theirCrystal.maxHp;
        const win = Math.abs(a - b) > 0.01 ? a > b : W.score.us >= W.score.them;
        this.endWar(win, 'time');
      }
    }
    for (const a of W.allies) this.updateAlly(a, dt);
    if (W.respawnT != null && this.player.dead) {
      W.respawnT -= dt;
      if (W.respawnT <= 0) { W.respawnT = null; this.warRespawnPlayer(); }
    }
  },
  updateAlly(e, dt) {
    const W = this.war;
    if (e.crystal) { e.hitT = Math.max(0, (e.hitT || 0) - dt); return; }
    e.actT = Math.max(0, e.actT - dt); e.attackCD -= dt;
    if (e.dead) {
      e.respawnT -= dt;
      if (e.respawnT <= 0) {
        e.dead = false; e.hp = e.maxHp; e.state = 'idle'; e.model.visible = true; e.inner.position.y = 0;
        e.pos.set(e.home.x + rnd(-2, 2), 0, e.home.z); this.fx.spawnPuff(e.pos, 0x7ad8ff);
      }
      return;
    }
    let moving = false;
    if (W.started && !W.done) {
      let t = e.target;
      if (!t || t.dead || flat(t.pos, e.pos) > 30) {
        t = null; let bd = 22;
        for (const m of this.warFoes('rivals')) { const d = flat(m.pos, e.pos); if (d < bd) { bd = d; t = m; } }
        if (!t && !W.theirCrystal.dead) t = W.theirCrystal;
        e.target = t;
      }
      if (t) {
        const d = flat(e.pos, t.pos) - t.radius;
        if (d > e.range) { const r = this.moveEnt(e, t.pos.x, t.pos.z, e.speed, dt); moving = r !== 'blocked'; if (r === 'blocked') this.unstick(e, t, dt); }
        else {
          e.yawT = Math.atan2(t.pos.x - e.pos.x, t.pos.z - e.pos.z);
          if (e.attackCD <= 0) {
            e.attackCD = rnd(1.2, 1.6); e.state = e.ranged ? 'cast' : 'attack'; e.actT = e.actDur = 0.45;
            this.after(0.2, () => {
              if (t.dead || e.dead) return;
              const mult = Math.random() < 0.25 ? 1.9 : 1;
              if (e.ranged) this.fx.projectile(e.pos.clone().setY(1.3), t, { color: e.cls === 'mage' ? 0xff7a2a : 0x4ab8ff, size: 0.3, onHit: () => { if (!t.dead) this.damage(e, t, mult); } });
              else { this.fx.slash(e.pos, e.yaw, 0x9ad8ff, 1.4, 0.3, 0.25); this.damage(e, t, mult); }
            });
          }
        }
      }
    } else if (W.done) e.state = 'idle';
    if (e.actT <= 0) e.state = moving ? 'run' : 'idle';
    e.moving = moving;
    e.pos.y = 0;
  },
  unstick(e, t, dt) {
    if (!e.path || !e.path.length || e.pathT < this.time) { e.path = this.map.findPath(e.pos.x, e.pos.z, t.pos.x, t.pos.z); e.pathT = this.time + 1.5; }
    const w = e.path[0]; if (!w) return;
    if (this.moveEnt(e, w.x, w.z, e.speed, dt) === true) e.path.shift();
  },
  // Rival AI (monsters with warUnit). Structures (the enemy crystal) just sit there.
  updateWarUnit(m, dt) {
    const W = this.war;
    m.actT = Math.max(0, m.actT - dt); m.attackCD -= dt; m.hitT = Math.max(0, (m.hitT || 0) - dt);
    if (m.def0.structure || !W || !W.started || W.done) { m.moving = false; if (m.actT <= 0) m.state = 'idle'; return; }
    if (m.stun > 0) { m.stun -= dt; m.moving = false; return; }
    let t = m.target;
    if (!t || t.dead || (t !== W.ourCrystal && flat(t.pos, m.pos) > 26)) {
      t = null; let bd = 18;
      for (const e of this.warFoes('allies')) { const d = flat(e.pos, m.pos); if (d < bd) { bd = d; t = e; } }
      if (!t) t = W.ourCrystal;
      m.target = t;
    }
    let moving = false;
    const range = m.rangeW || 2.4;
    const d = flat(m.pos, t.pos) - t.radius;
    if (d > range) { if (m.actT <= 0) { const r = this.moveEnt(m, t.pos.x, t.pos.z, m.speed, dt); moving = r !== 'blocked'; if (r === 'blocked') this.unstick(m, t, dt); } }
    else {
      m.yawT = Math.atan2(t.pos.x - m.pos.x, t.pos.z - m.pos.z);
      if (m.attackCD <= 0 && m.actT <= 0) {
        m.attackCD = rnd(1.3, 1.7); m.state = m.ranged ? 'cast' : 'attack'; m.actT = m.actDur = 0.45;
        this.after(0.2, () => {
          if (m.dead || t.dead) return;
          const mult = Math.random() < 0.22 ? 1.8 : 1;
          if (m.ranged) this.fx.projectile(m.pos.clone().setY(1.3), t, { color: m.cls === 'mage' ? 0xff5a2a : 0x6a8aff, size: 0.3, onHit: () => { if (!m.dead && !t.dead) this.damage(m, t, mult); } });
          else { this.fx.slash(m.pos, m.yaw, 0xff8a8a, 1.4, 0.3, 0.25); this.damage(m, t, mult); }
        });
      }
    }
    if (m.actT <= 0) m.state = moving ? 'run' : 'idle';
    m.moving = moving;
    m.pos.y = 0;
  },
  allyDown(e) {
    const W = this.war; if (!W) return;
    if (e.crystal) { e.hp = 0; e.dead = true; this.fx.pillar(e.pos, 0x7ad8ff, 3, 14, 1.2); this.fx.shake(0.6); this.sfx.play('boom'); e.model.visible = false; this.endWar(false, 'crystal'); return; }
    e.hp = 0; e.dead = true; e.state = 'dead'; e.respawnT = 8; e.target = null;
    this.fx.spawnPuff(e.pos, 0x7ad8ff);
    if (!W.done) { W.score.them += WAR.killPts; this.ui.toast(`${e.name} was defeated!`, 'warn'); }
    for (const m of this.monsters) if (m.target === e) m.target = null;
    this.after(1.2, () => { if (e.dead) e.model.visible = false; });
  },
  onWarKill(m) {
    const W = this.war; if (!W || W.done) return;
    if (m.type === 'warcrystal') { this.fx.pillar(m.pos, 0xff5a5a, 3, 14, 1.2); this.fx.shake(0.6); this.endWar(true, 'crystal'); return; }
    W.score.us += WAR.killPts; W.kills++;
    this.ui.toast(`${m.name || 'Rival'} defeated! +${WAR.killPts}`, 'good');
  },
  warPlayerDown() {
    const W = this.war; if (!W) return;
    W.deaths++; if (!W.done) W.score.them += WAR.killPts;
    W.respawnT = 6;
    this.ui.toast('Respawning at your crystal in 6s...', 'warn');
  },
  warRespawnPlayer() {
    const W = this.war, p = this.player; if (!W) return;
    p.dead = false; p.state = 'idle'; p.hp = p.maxHp; p.mp = p.maxMp;
    p.pos.set(W.map.start.x, 0, W.map.start.z); this.cam.target.copy(p.pos);
    if (this.pet) this.pet.pos.set(p.pos.x - 1.2, 0, p.pos.z + 1.2);
    this.fx.levelUp(p);
  },
  endWar(win, reason) {
    const W = this.war, S = this.S, G = S.guild; if (!W || W.done) return;
    W.done = true; W.win = win;
    this.logEvent('war', `Guild war ${win ? 'won' : 'lost'}${S.guild ? ` for ${S.guild.name}` : ''}`, true);
    for (const m of this.monsters) if (m.warUnit) m.target = null;
    const L = S.level;
    const r = win ? { gold: 400 + L * 60, diamonds: 20, mats: { spirit_shard: 2 }, contrib: 120 } : { gold: 200 + L * 30, diamonds: 8, mats: { spirit_dust: 5 }, contrib: 50 };
    r.gold += W.kills * 40;
    this.giveReward(r, true);
    if (G) { G.contribTotal += r.contrib; this.addGuildExp(win ? 120 : 50, true); if (win) G.wins++; else G.losses++; }
    if (win) { this.track('warWin'); S.season.warWins++; this.addSeasonExp(SEASON_EXP.warWin); if (G && G.wins >= 10) this.unlockTitle('Warlord'); }
    this.addSeasonExp(SEASON_EXP.war);
    this.gainExp(Math.round(needExpL(L) * (win ? 0.12 : 0.06)));
    this.sfx.play(win ? 'level' : 'error');
    this.ui.banner(win ? 'VICTORY!' : 'DEFEAT', `${S.guild?.name || 'You'} ${W.score.us} : ${W.score.them} ${W.opp.name}`, win ? 'clear' : 'boss');
    const why = reason === 'crystal' ? (win ? 'You shattered their Spirit Crystal!' : 'Your Spirit Crystal fell...') : 'Time ran out: the healthier crystal wins.';
    this.after(1.6, () => this.ui.modal(win ? 'Guild War Victory!' : 'Guild War Defeat', `${why} Kills ${W.kills} · Deaths ${W.deaths}. Rewards: ${this.rewardText(r)}.`, [{ label: 'Leave Battlefield', fn: () => this.leaveWar() }], true));
    this.save();
  },
  leaveWar() {
    const W = this.war; if (!W || W.leaving) return;
    W.leaving = true;
    this.ui.fade(() => {
      const p = this.player;
      for (const m of [...this.monsters]) if (m.map === W.map) this.removeEnt(m);
      for (const a of [...W.allies, W.ourCrystal]) { this.scene.remove(a.model); a.np?.remove(); this.ents = this.ents.filter((x) => x !== a); }
      for (const L of [...this.loots]) if (L.map === W.map) this.removeLoot(L);
      W.map.dispose();
      this.war = null; this.map = this.world; p.map = this.world;
      if (this.pet) this.pet.map = this.world;
      this.world.root.visible = true; this.applyAmbience(null);
      const r = this.overworldReturn || { x: 0, z: 9 };
      p.pos.set(r.x, this.world.heightAt(r.x, r.z), r.z); this.cam.target.copy(p.pos);
      if (r.yaw !== undefined) this.cam.yaw = r.yaw;
      if (this.pet) this.pet.pos.set(r.x - 1.2, p.pos.y, r.z + 1.2);
      if (p.dead) { p.dead = false; p.state = 'idle'; } p.hp = p.maxHp; p.mp = p.maxMp;
      this.setTarget(null); this.auto = false; this.ui.setAutoBattle(false); p.path = [];
      this.zone = null; this.ui.leaveWar(); this.save();
    });
  },

  // ============================================================ world boss
  wbType() { return this.event ? this.event.boss : 'behemoth'; },
  wbState(now = Date.now()) {
    const s = now / 1000, slot = Math.floor(s / WORLD_BOSS.every), into = s - slot * WORLD_BOSS.every;
    const active = into < WORLD_BOSS.lasts;
    return { slot, active, endsIn: WORLD_BOSS.lasts - into, nextIn: WORLD_BOSS.every - into };
  },
  wbStats(L) { const c = curveStats(L, { hp: 90, atk: 2.2, def: 1.2 }); return { level: L, hp: c.hp, atk: c.atk, def: c.def }; },
  updateWorldBoss() {
    const S = this.S, st = this.wbState();
    if (!st.active && st.nextIn < 120 && S.wb.warned !== st.slot + 1) {
      S.wb.warned = st.slot + 1;
      this.ui.chat('announce', `<b>[World Boss]</b> ${MONSTERS[this.wbType()].name} will appear at the ${WORLD_BOSS.name} in 2 minutes!`);
    }
    if (st.active && !this.wb && !(S.wb.slot === st.slot && S.wb.done)) this.spawnWorldBoss(st.slot);
    if (this.wb && !this.wb.e.dead && !st.active) this.despawnWorldBoss();
    if (this.wb && this.wb.e.dead && this.wb.finished && this.time - this.wb.finished > 20) this.wb = null;
  },
  spawnWorldBoss(slot) {
    const S = this.S, type = this.wbType(), site = WORLD_BOSS.site;
    const L = clamp(S.level + 3, 8, MAX_LEVEL + 3);
    const e = this.createMonster({ type, x: site.x, z: site.z, r: 0 }, { exact: true, fixed: this.wbStats(L) });
    e.wb = true; e.yaw = e.yawT = Math.atan2(-site.x, -site.z); e.skillT = 6;
    this.wb = { e, slot, dmg: new Map(), start: this.time, bots: [] };
    S.wb.slot = slot; S.wb.done = false;
    this.fx.pillar(e.pos, 0x9ad8ff, 4, 20, 1.6); this.fx.spawnPuff(e.pos, 0xc8e8ff);
    this.ui.chat('announce', `<b>[World Boss]</b> ${esc(e.def0.name)} has descended on the ${WORLD_BOSS.name}! Everyone, gather!`);
    if (!this.dg && !this.war) this.ui.banner(e.def0.name, `World Boss · ${WORLD_BOSS.name}`, 'boss');
    this.sfx.play('boom');
    // other adventurers teleport in over the next half minute
    const pool = shuffled(this.bots, Math.random).slice(0, WORLD_BOSS.bots);
    pool.forEach((b, i) => this.after(2 + i * rnd(2, 5), () => {
      if (!this.wb || this.wb.e.dead || this.wb.e !== e) return;
      const a = Math.random() * Math.PI * 2, r = rnd(9, 14);
      const [x, z] = this.world.nearestFree(site.x + Math.cos(a) * r, site.z + Math.sin(a) * r);
      b.wbHome = { role: b.role, x: b.pos.x, z: b.pos.z, goal: b.goal };
      b.role = 'wboss'; b.target = e; b.goal = null;
      b.pos.set(x, this.world.heightAt(x, z), z);
      this.fx.pillar(b.pos, 0x7ad8ff, 1.4, 8, 0.8);
      this.wb.bots.push(b);
      if (i % 3 === 0) this.ui.chat('world', esc(pick(['omw to the boss!!', 'here!', 'go go go', 'tank pls', 'I brought potions', 'lets get top dmg'])), b.name);
    }));
    this.ui.refreshQuest(); this.ui.refreshActs();
  },
  despawnWorldBoss() {
    const W = this.wb; if (!W) return;
    this.ui.chat('announce', `<b>[World Boss]</b> ${esc(W.e.def0.name)} retreats into the storm...`);
    this.fx.pillar(W.e.pos, 0x9ad8ff, 4, 20, 1.4);
    this.removeEnt(W.e);
    this.releaseWbBots();
    this.wb = null; this.ui.refreshQuest(); this.ui.refreshActs();
  },
  releaseWbBots() {
    const W = this.wb; if (!W) return;
    W.bots.forEach((b, i) => this.after(3 + i * 0.7, () => {
      if (b.role !== 'wboss' || !b.wbHome) return;
      this.fx.pillar(b.pos, 0x7ad8ff, 1.4, 8, 0.6);
      b.role = b.wbHome.role; b.target = null; b.goal = null;
      const [x, z] = this.world.nearestFree(b.wbHome.x, b.wbHome.z);
      b.pos.set(x, this.world.heightAt(x, z), z); b.wbHome = null;
    }));
  },
  wbHit(src, dst, dmg) {
    const W = this.wb; if (!W || W.e !== dst || dmg <= 0) return;
    const name = src === this.player || src.kind === 'pet' ? this.S.name : src.name || '?';
    W.dmg.set(name, (W.dmg.get(name) || 0) + dmg);
  },
  wbBotAttack(b, t) {
    const W = this.wb, n = Math.max(3, W.bots.length);
    const per = t.maxHp / 230 / n * 1.4;
    return per * rnd(0.7, 1.35);
  },
  wbRanking() {
    const W = this.wb; if (!W) return [];
    return [...W.dmg.entries()].map(([name, dmg]) => ({ name, dmg, me: name === this.S.name })).sort((a, b) => b.dmg - a.dmg);
  },
  onWorldBossKilled(m, lastHitByMe) {
    const W = this.wb, S = this.S; if (!W || W.e !== m) return;
    W.finished = this.time; S.wb.done = true;
    const rank = this.wbRanking(), idx = rank.findIndex((r) => r.me), myDmg = idx >= 0 ? rank[idx].dmg : 0;
    if (myDmg > 0) this.logEvent('worldboss', `Fought ${m.def0.name} · rank ${idx + 1} · ${Math.round(myDmg).toLocaleString('en-US')} dmg`, true);
    this.ui.chat('announce', `<b>[World Boss]</b> ${esc(m.def0.name)} has been defeated! Top damage: <b>${esc(rank[0]?.name || '?')}</b>.`);
    this.releaseWbBots();
    if (myDmg <= 0) { this.ui.refreshQuest(); return; }
    const place = idx + 1, tier = WB_RANK_REWARDS.find((t) => place <= t.upTo);
    S.lb.wbBest = Math.max(S.lb.wbBest || 0, Math.round(myDmg));
    S.season.wbBest = Math.max(S.season.wbBest || 0, Math.round(myDmg));
    this.track('worldboss'); this.addSeasonExp(SEASON_EXP.worldboss);
    if (place === 1) this.unlockTitle('Titan Slayer');
    const items = [];
    if (Math.random() < tier.gearChance) items.push(this.makeEquip(null, m.level, tier.gear));
    else items.push(this.makeEquip(null, m.level, Math.max(2, tier.gear - 1)));
    const r = { diamonds: tier.diamonds, mats: { ...(tier.mats || {}) }, items: tier.items };
    if (lastHitByMe) r.mats.star_essence = (r.mats.star_essence || 0) + 1;
    this.giveReward(r, true);
    for (const eq of items) if (!this.addEquip(eq)) this.dropLoot({ eq }, this.player.pos);
    this.after(1.4, () => this.ui.lootPopup(items, { diamonds: r.diamonds, title: `${m.def0.name} · Rank #${place}`, note: `${fmt(myDmg)} damage (${tier.label})${lastHitByMe ? ' · Last hit bonus!' : ''}`, mats: r.mats }));
    this.ui.refreshQuest(); this.save();
  },
  goToWorldBoss() {
    if (this.dg || this.war) { this.ui.toast('Leave the instance first', 'warn'); return; }
    const s = WORLD_BOSS.site, p = this.player;
    this.ui.closePanels();
    if (flat(p.pos, s) > 60) {
      this.castBar(`Teleporting to the ${WORLD_BOSS.name}`, 1.4, () => {
        const [x, z] = this.world.nearestFree(s.x - 10, s.z + 12);
        this.fx.pillar(p.pos, 0x7ad8ff, 1.6, 10, 0.8);
        p.pos.set(x, this.world.heightAt(x, z), z); p.path = []; this.cam.target.copy(p.pos);
        if (this.pet) this.pet.pos.set(x - 1.5, p.pos.y, z - 1);
        this.fx.pillar(p.pos, 0x7ad8ff, 1.6, 10, 1.0); this.sfx.play('cast');
      });
    } else this.pathTo(s.x - 6, s.z + 8, true);
  },

  // ============================================================ crafting, salvage, gems, gear progression
  craft(rid, slot = null) {
    const S = this.S, r = RECIPES.find((x) => x.id === rid); if (!r) return;
    if (S.level < r.lv) { this.ui.toast(`Requires Lv ${r.lv}`, 'warn'); return; }
    const cost = { gold: r.gold, mats: r.mats };
    if (!this.canAfford(cost)) { this.ui.toast(this.missingText(cost), 'warn'); this.sfx.play('error'); return; }
    if (r.gear && S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return; }
    if (r.out?.item && !this.bagRoomFor(r.out.item)) return;
    this.pay(cost);
    let msg;
    if (r.gear) {
      let q = r.gear.quality; const master = Math.random() < r.gear.up; if (master) q++;
      const eq = this.makeEquip(slot || pick(SLOTS), S.level, q);
      this.addEquip(eq);
      msg = `${master ? 'Masterwork! ' : ''}Forged ${eq.name}`;
      if (master) { this.ui.banner('MASTERWORK!', eq.name, q >= 5 ? 'loot5' : 'loot4'); this.sfx.play('legend'); }
      this.ui.lootPopup([eq], { title: master ? 'Masterwork!' : 'Forged' });
    } else if (r.out.item) { this.addItem(r.out.item, r.out.qty); msg = `Crafted ${ITEMS[r.out.item].name} x${r.out.qty}`; }
    else { this.addMat(r.out.mat, r.out.qty, true); msg = `Crafted ${matName(r.out.mat)} x${r.out.qty}`; }
    this.track('craft');
    this.sfx.play('level'); this.fx.buff(this.player, '#ffb04a');
    this.ui.toast(msg, 'good'); this.ui.refreshPanel(); this.save();
  },
  salvage(idxs) {
    const S = this.S;
    const list = [...new Set(idxs)].sort((a, b) => b - a).filter((i) => S.bag[i]?.eq);
    if (!list.length) return;
    const total = {};
    for (const i of list) {
      const eq = S.bag[i].eq;
      for (const [k, n] of Object.entries(salvageYield(eq))) total[k] = (total[k] || 0) + n;
      for (const g of eq.gems || []) if (g) total[g] = (total[g] || 0) + 1;
      S.bag.splice(i, 1);
    }
    for (const [k, n] of Object.entries(total)) this.addMat(k, n, true);
    this.track('salvage', list.length);
    this.sfx.play('chest'); this.fx.emit(this.player.pos.clone().setY(this.player.pos.y + 1), { count: 30, colors: [0xc8a0ff, 0xffffff], speed: 3, life: 0.8, size: 0.5, up: 3 });
    this.ui.toast(`Salvaged ${list.length} item${list.length > 1 ? 's' : ''}: ${Object.entries(total).map(([k, n]) => `${matName(k)} x${n}`).join(', ')}`, 'good');
    this.ui.sel.bagIdx = null; this.ui.sel.forgeRef = null;
    this.ui.refreshPanel(); this.save();
  },
  salvageBelow(maxQ) {
    const idx = this.S.bag.map((b, i) => (b.eq && b.eq.quality <= maxQ && !b.eq.named ? i : -1)).filter((i) => i >= 0);
    if (!idx.length) { this.ui.toast('Nothing to salvage', 'warn'); return; }
    this.salvage(idx);
  },
  // ref: { where: 'equip', slot } | { where: 'bag', idx }
  refItem(ref) { if (!ref) return null; return ref.where === 'equip' ? this.S.equip[ref.slot] : this.S.bag[ref.idx]?.eq; },
  afterUpgrade(ref, msg) {
    if (ref.where === 'equip') this.recalc();
    this.track('enhance');
    this.sfx.play('level'); this.fx.buff(this.player, '#c8a0ff');
    this.ui.toast(msg, 'good'); this.ui.refreshPanel(); this.save();
  },
  reforge(ref) {
    const eq = this.refItem(ref); if (!eq) return;
    if (!RARITY[eq.quality].affixes) { this.ui.toast('Only Rare or better gear has affixes to reforge', 'warn'); return; }
    if (!this.pay(reforgeCost(eq))) return;
    reforgeItem(eq);
    this.afterUpgrade(ref, `${eq.name} reforged!`);
  },
  retemper(ref) {
    const eq = this.refItem(ref), L = this.S.level; if (!eq) return;
    if (eq.lvl >= L) { this.ui.toast('Already at your level', 'warn'); return; }
    if (!this.pay(retemperCost(eq, L))) return;
    retemperItem(eq, L);
    this.afterUpgrade(ref, `${eq.name} re-tempered to Lv ${L}`);
  },
  ascend(ref) {
    const eq = this.refItem(ref), S = this.S; if (!eq) return;
    const A = ASCEND[eq.quality]; if (!A) { this.ui.toast('Already Legendary', 'warn'); return; }
    if (!this.pay({ gold: A.gold, mats: A.mats })) return;
    const before = eq.name;
    ascendItem(eq, S.cls);
    if (eq.named) this.registerNamed(eq);
    if (eq.quality >= 4) {
      this.ui.banner(eq.quality === 5 ? 'LEGENDARY!' : 'UNIQUE!', eq.name, 'loot' + eq.quality);
      this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} awakened <span style="color:${RARITY[eq.quality].color}">[${esc(eq.name)}]</span> at the Forge!`);
      this.sfx.play(eq.quality === 5 ? 'legend' : 'rare'); this.fx.shake(0.3);
    }
    this.afterUpgrade(ref, `${before} ascended to ${RARITY[eq.quality].name}!`);
  },
  // Bag consumables added by the systems. Returns true when handled.
  useSystemItem(id) {
    const S = this.S;
    if (id === 'gem_pouch') {
      this.removeItem('gem_pouch', 1);
      const g = gemId(randomGemType(), Math.random() < 0.08 ? 2 : 1);
      this.addMat(g, 1, true); this.sfx.play('chest'); this.fx.buff(this.player, GEMS[parseGem(g).type].color);
      this.ui.toast(`The pouch held a ${matName(g)}!`, 'good');
      return true;
    }
    if (id === 'unique_cache' || id === 'legend_cache') {
      if (S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return true; }
      this.removeItem(id, 1);
      const eq = this.makeEquip(null, S.level, id === 'legend_cache' ? 5 : 4);
      this.addEquip(eq);
      this.sfx.play(eq.quality === 5 ? 'legend' : 'rare'); this.fx.levelUp(this.player);
      this.ui.lootPopup([eq], { title: ITEMS[id].name });
      this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} opened a ${ITEMS[id].name} and found <span style="color:${RARITY[eq.quality].color}">[${esc(eq.name)}]</span>!`);
      return true;
    }
    return false;
  },

  // ============================================================ codex
  registerNamed(eq) {
    const S = this.S; if (!eq || !eq.named || S.codex[eq.named]) return;
    S.codex[eq.named] = true;
    const n = Object.keys(S.codex).length;
    this.ui.toast(`New Codex entry (${n}/${NAMED_LIST.length}): ${eq.name}`, 'item');
    this.ui.markMenu('codex');
    this.recalc();
  },
  codexBonus() {
    const S = this.S; let atk = 0, hp = 0, found = 0;
    for (const d of NAMED_LIST) if (S.codex[d.id]) { found++; const v = d.quality === 5 ? 0.01 : 0.005; atk += v; hp += v; }
    return { atk, hp, found };
  },
  claimCodex(i) {
    const S = this.S, ms = CODEX_MILESTONES[i]; if (!ms || S.codexClaim.includes(i)) return;
    if (Object.keys(S.codex).length < ms.n) return;
    S.codexClaim.push(i);
    this.giveReward(ms.reward);
    this.sfx.play('chest'); this.ui.toast(`Codex reward: ${ms.label}`, 'good'); this.ui.refreshPanel(); this.save();
  },

  // ============================================================ market
  mkValue(kind, id, eq) {
    if (kind === 'mat') return MATERIALS[id]?.price || 10;
    if (kind === 'item') return ({ dungeon_ticket: 1500 })[id] || ITEMS[id]?.price || 20;
    return Math.round(sellPrice(eq) * 3 + itemScore(eq) * 0.8);
  },
  mkIndex(id, t = Date.now()) {
    const slot = Math.floor(t / 1800000);
    const a = rng32(id + slot)(), b = rng32(id + (slot + 1))(), k = (t / 1800000) - slot;
    return 0.78 + (a + (b - a) * k) * 0.55;
  },
  mkTrend(id) { const now = this.mkIndex(id), before = this.mkIndex(id, Date.now() - 3600000); return now > before * 1.04 ? 1 : now < before * 0.96 ? -1 : 0; },
  mkPrice(kind, id, eq, qty = 1) { return Math.max(1, Math.round(this.mkValue(kind, id, eq) * (kind === 'gear' ? 1 : this.mkIndex(id)) * qty)); },
  refreshListings(force = false) {
    const S = this.S, K = this.market;
    if (!force && this.time < K.refreshAt && K.listings.length) return;
    K.refreshAt = this.time + MARKET.refresh;
    const goods = MARKET_GOODS.filter((g) => g[4] <= S.level);
    const total = goods.reduce((a, g) => a + g[3], 0);
    const sellers = [...BOT_NAMES, ...EXTRA_NAMES];
    K.listings = [];
    for (let i = 0; i < 16; i++) {
      let r = Math.random() * total, g = goods[0];
      for (const x of goods) { r -= x[3]; if (r <= 0) { g = x; break; } }
      const [kind, id, [a, b]] = g, qty = Math.round(rnd(a, b));
      const deal = Math.random() < 0.18 ? rnd(0.62, 0.8) : rnd(0.9, 1.3);
      const L = { lid: 'b' + i + '_' + Math.floor(this.time), kind, seller: pick(sellers), note: pick(MARKET_LINES), qty };
      if (kind === 'gear') { L.eq = this.makeEquip(null, clamp(S.level + Math.round(rnd(-2, 2)), 1, MAX_LEVEL), id); L.price = Math.round(this.mkPrice('gear', null, L.eq) * deal); L.kind = 'gear'; }
      else { L.id = id; L.price = Math.round(this.mkPrice(kind, id, null, qty) * deal); }
      L.deal = deal < 0.82;
      K.listings.push(L);
    }
  },
  buyListing(lid) {
    const S = this.S, K = this.market, i = K.listings.findIndex((l) => l.lid === lid); if (i < 0) return;
    const L = K.listings[i];
    if (S.gold < L.price) { this.ui.toast('Not enough Gold', 'warn'); this.sfx.play('error'); return; }
    if (L.kind === 'gear' && S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return; }
    if (L.kind === 'item' && !this.bagRoomFor(L.id)) return;
    S.gold -= L.price;
    if (L.kind === 'gear') this.addEquip(L.eq);
    else if (L.kind === 'item') this.addItem(L.id, L.qty);
    else this.addMat(L.id, L.qty, true);
    K.listings.splice(i, 1);
    this.track('trade');
    this.sfx.play('coin'); this.ui.refreshWallet();
    const nm = L.kind === 'gear' ? L.eq.name : `${L.kind === 'item' ? ITEMS[L.id].name : matName(L.id)} x${L.qty}`;
    this.ui.toast(`Bought ${nm} for ${fmt(L.price)} Gold`, 'good');
    this.ui.chat('whisper', `Thanks for buying my ${esc(nm)}~`, L.seller);
    this.ui.refreshPanel(); this.save();
  },
  // src: { bag: index } | { mat: id }
  listForSale(src, qty, price) {
    const S = this.S, K = S.market;
    if (K.mine.length >= MARKET.maxListings) { this.ui.toast(`You can have ${MARKET.maxListings} listings at once`, 'warn'); return false; }
    price = Math.max(1, Math.round(price));
    let L;
    if (src.mat) {
      const m = MATERIALS[src.mat]; if (!m || m.notrade) { this.ui.toast('That cannot be traded', 'warn'); return false; }
      qty = clamp(Math.round(qty), 1, this.matCount(src.mat)); if (!qty || !this.takeMat(src.mat, qty)) return false;
      L = { kind: 'mat', id: src.mat, qty };
    } else {
      const b = S.bag[src.bag]; if (!b) return false;
      if (b.eq) { L = { kind: 'gear', eq: b.eq, qty: 1 }; S.bag.splice(src.bag, 1); }
      else {
        const it = ITEMS[b.id]; if (it.type === 'quest') { this.ui.toast('Quest items cannot be traded', 'warn'); return false; }
        qty = clamp(Math.round(qty), 1, b.qty);
        L = { kind: 'item', id: b.id, qty }; b.qty -= qty; if (b.qty <= 0) S.bag.splice(src.bag, 1);
      }
    }
    L.lid = 'm' + (K.nextLid++); L.price = price; L.t = Date.now();
    K.mine.push(L);
    this.sfx.play('coin'); this.ui.toast('Listed on the Market', 'good');
    this.ui.sel.bagIdx = null; this.ui.refreshPanel(); this.ui.refreshSkills(); this.save();
    return true;
  },
  cancelListing(lid) {
    const S = this.S, K = S.market, i = K.mine.findIndex((l) => l.lid === lid); if (i < 0) return;
    const L = K.mine[i];
    if (L.kind === 'gear') { if (!this.addEquip(L.eq)) return; }
    else if (L.kind === 'item') { if (!this.addItem(L.id, L.qty)) return; }
    else this.addMat(L.id, L.qty, true);
    K.mine.splice(i, 1);
    this.ui.toast('Listing cancelled', 'good'); this.ui.refreshPanel(); this.save();
  },
  listingName(L) { return L.kind === 'gear' ? L.eq.name : `${L.kind === 'item' ? ITEMS[L.id].name : matName(L.id)} x${L.qty}`; },
  saleChance(L) {
    const fair = L.kind === 'gear' ? this.mkPrice('gear', null, L.eq) : this.mkPrice(L.kind, L.id, null, L.qty);
    const ratio = L.price / fair;
    const k = ratio <= 0.7 ? 8 : ratio <= 1 ? 1 + (1 - ratio) * 18 : Math.exp(-(ratio - 1) * 4.5);
    return { fair, ratio, perSec: k / 75 };
  },
  updateMarket(dt) {
    const S = this.S, K = S.market;
    for (const L of [...K.mine]) {
      if (Math.random() >= this.saleChance(L).perSec * dt) continue;
      const net = Math.round(L.price * (1 - MARKET.tax));
      K.mine.splice(K.mine.indexOf(L), 1);
      S.gold += net; K.earned += net; K.sold++;
      const buyer = pick([...BOT_NAMES, ...EXTRA_NAMES].filter((n) => n !== S.name));
      this.track('trade'); this.track('marketGold', net);
      if (K.earned >= 50000) this.unlockTitle('Market Mogul');
      this.sfx.play('coin'); this.ui.refreshWallet();
      this.ui.toast(`Market: sold ${this.listingName(L)} for ${fmt(net)} Gold`, 'good');
      this.ui.chat('system', `<b>[Market]</b> ${esc(buyer)} bought your ${esc(this.listingName(L))} for <b>${fmt(L.price)}</b> Gold (after 5% tax: ${fmt(net)}).`);
      if (this.ui.panelName === 'market') this.ui.softRefresh();
    }
    // bot trade offers
    const M2 = this.market;
    if (M2.offer && (this.time > M2.offer.expires || this.dg || this.war)) { this.ui.tradeOffer(null); M2.offer = null; }
    M2.offerT -= dt;
    if (M2.offerT > 0 || M2.offer || this.dg || this.war || S.level < 3) return;
    M2.offerT = rnd(...MARKET.offerEvery);
    const sellable = Object.entries(S.mats).filter(([id, n]) => n >= 2 && !MATERIALS[id].notrade);
    const who = pick([...BOT_NAMES, ...EXTRA_NAMES]);
    let offer;
    if (sellable.length && Math.random() < 0.6) {
      const [id, have] = pick(sellable), qty = Math.max(1, Math.min(have, Math.round(rnd(2, 6))));
      const price = Math.round(this.mkPrice('mat', id, null, qty) * rnd(1.08, 1.4));
      offer = { who, kind: 'buy', id, qty, price, text: `wants to buy your <b>${esc(matName(id))} x${qty}</b> for <b>${fmt(price)}</b> Gold` };
    } else {
      const goods = MARKET_GOODS.filter((g) => g[0] === 'mat' && g[4] <= S.level);
      const g = pick(goods), qty = Math.round(rnd(g[2][0], g[2][1]));
      const price = Math.round(this.mkPrice('mat', g[1], null, qty) * rnd(0.7, 0.92));
      offer = { who, kind: 'sell', id: g[1], qty, price, text: `offers you <b>${esc(matName(g[1]))} x${qty}</b> for <b>${fmt(price)}</b> Gold` };
    }
    offer.expires = this.time + 25;
    M2.offer = offer;
    this.ui.chat('whisper', offer.kind === 'buy' ? `hey! I'll pay ${fmt(offer.price)}g for your ${esc(matName(offer.id))} x${offer.qty}, deal?` : `selling ${esc(matName(offer.id))} x${offer.qty} for ${fmt(offer.price)}g, cheaper than market!`, who);
    this.ui.tradeOffer(offer);
    this.sfx.play('open');
  },
  answerOffer(accept) {
    const S = this.S, M2 = this.market, o = M2.offer; if (!o) return;
    M2.offer = null; this.ui.tradeOffer(null);
    if (!accept) { this.ui.chat('whisper', pick(['aww ok', 'maybe next time~', 'np!']), o.who); return; }
    if (o.kind === 'buy') {
      if (!this.takeMat(o.id, o.qty)) { this.ui.toast('You no longer have those', 'warn'); return; }
      S.gold += o.price; this.track('marketGold', o.price);
    } else {
      if (S.gold < o.price) { this.ui.toast('Not enough Gold', 'warn'); return; }
      S.gold -= o.price; this.addMat(o.id, o.qty, true);
    }
    this.track('trade');
    this.sfx.play('coin'); this.ui.refreshWallet(); this.ui.refreshPanel();
    this.ui.toast(`Traded with ${o.who}!`, 'good');
    this.ui.chat('whisper', pick(['ty! pleasure doing business', 'thanks!! <3', 'deal~ good luck out there']), o.who);
    this.save();
  },

  // ============================================================ festival
  spawnEventMonsters() {
    const type = this.event.monster;
    for (const sp of EVENT_SPAWNS) for (let i = 0; i < sp.count; i++) this.createMonster({ type, ...sp });
  },
  eventShopItems() {
    const ev = this.event; if (!ev) return [];
    return EVENT_SHOP.map((it) => {
      const o = { ...it };
      if (it.kind === 'pet') { const pd = PETS.find((p) => p.id === ev.pet); o.name = `Pet: ${pd.name}`; o.owned = !!this.S.pets[ev.pet]; }
      if (it.kind === 'wings') { o.name = `${ev.short} Wings`; o.owned = this.S.wingColor === ev.wings; }
      if (it.kind === 'title') { o.name = `Title «${ev.title}»`; o.owned = this.S.titles.includes(TITLES.indexOf(ev.title)); }
      if (it.kind === 'item') o.name = `${ITEMS[it.id2].name} x${it.qty}`;
      if (it.kind === 'mat') o.name = `${matName(it.id2)} x${it.qty}`;
      o.left = it.max - (this.S.ev.shop[it.id] || 0);
      return o;
    });
  },
  eventBuy(id) {
    const S = this.S, ev = this.event; if (!ev) return;
    const it = this.eventShopItems().find((x) => x.id === id); if (!it) return;
    if (it.owned) { this.ui.toast('Already owned', 'warn'); return; }
    if (it.left <= 0) { this.ui.toast('Sold out for this festival', 'warn'); return; }
    if (it.kind === 'item' && !this.bagRoomFor(it.id2)) return;
    if (!this.pay({ mats: { [ev.currency]: it.cost } })) return;
    S.ev.shop[id] = (S.ev.shop[id] || 0) + 1;
    if (it.kind === 'pet') this.gainPet(ev.pet, true);
    if (it.kind === 'wings') { S.wings = true; S.wingColor = ev.wings; this.rebuildPlayerModel(); if (this.mounted) { this.dismount(true); this.mount(true); } this.recalc(); this.fx.levelUp(this.player); }
    if (it.kind === 'title') this.unlockTitle(ev.title);
    if (it.kind === 'item') this.addItem(it.id2, it.qty);
    if (it.kind === 'mat') this.addMat(it.id2, it.qty, true);
    this.sfx.play('coin'); this.ui.toast(`Exchanged for ${it.name}`, 'good'); this.ui.refreshPanel(); this.save();
  },
  // Lanterns and pumpkins (or snowmen / blossoms) around Sylvan Haven, as a few instanced meshes.
  buildFestivalDecor() {
    const ev = this.event, W = this.world, root = new THREE.Group(); root.name = 'festival';
    const spots = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + 0.2; spots.push([Math.cos(a) * 19.5, Math.sin(a) * 19.5]); }
    for (const [x, z] of [[-8, 26], [8, 26], [-34, 4], [34, -6], [-4, -30], [4, -30], [-26, 20], [24, 24], [40, 10], [-40, -10], [12, -26], [-14, -24]]) spots.push([x, z]);
    const ok = spots.filter(([x, z]) => !W.isBlocked(x, z) && Math.hypot(x, z) > 16);
    const kind = ev.decor;
    const bodyCol = kind === 'pumpkin' ? 0xff8a1a : kind === 'snow' ? 0xffffff : 0xffb6d8;
    const geo = new THREE.SphereGeometry(0.62, 16, 12);
    const bodies = new THREE.InstancedMesh(geo, toon(bodyCol), ok.length);
    const lines = new THREE.InstancedMesh(geo, outlineMaterial(0.04, 0x2a1408), ok.length);
    const cap = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.1, 0.32, 6), toon(kind === 'pumpkin' ? 0x4a7a2a : kind === 'snow' ? 0xd04a3a : 0x6ac85a), ok.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: kind === 'pumpkin' ? 0xffb03a : kind === 'snow' ? 0x9ad8ff : 0xffa8d8, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 });
    const glows = [];
    ok.forEach(([x, z], i) => {
      const y = W.heightAt(x, z), s = 0.8 + ((i * 37) % 10) / 25;
      q.setFromEuler(new THREE.Euler(0, Math.atan2(-x, -z), 0));
      m4.compose(new THREE.Vector3(x, y + 0.45 * s, z), q, sc.set(s * 1.15, s * 0.82, s * 1.15)); bodies.setMatrixAt(i, m4); lines.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, y + 0.95 * s, z), q, sc.set(s, s, s)); cap.setMatrixAt(i, m4);
      const g = new THREE.Sprite(glowMat); g.position.set(x, y + 0.6 * s, z); g.scale.setScalar(2.2 * s); g.raycast = () => {}; root.add(g); glows.push(g);
      W.blockCircle(x, z, 0.6 * s);
    });
    for (const m of [bodies, lines, cap]) { m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; root.add(m); }
    bodies.castShadow = true;
    // string lanterns over the plaza
    const lantern = new THREE.InstancedMesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshBasicMaterial({ color: kind === 'pumpkin' ? 0xffb84a : kind === 'snow' ? 0xc8f0ff : 0xffc8e8 }), 48);
    let k = 0;
    for (let i = 0; i < 6; i++) {
      const a0 = (i / 6) * Math.PI * 2, a1 = a0 + Math.PI / 3;
      for (let j = 1; j <= 8; j++) {
        const t = j / 9, a = a0 + (a1 - a0) * t, r = 15;
        const x = Math.cos(a) * r, z = Math.sin(a) * r, y = 6.2 - Math.sin(t * Math.PI) * 1.4;
        m4.compose(new THREE.Vector3(x, y, z), q.identity(), sc.set(1, 1.2, 1)); lantern.setMatrixAt(k++, m4);
      }
    }
    lantern.instanceMatrix.needsUpdate = true; root.add(lantern);
    W.root.add(root);
    this.festival = { root, update: (t) => { glowMat.opacity = 0.6 + Math.sin(t * 2.4) * 0.2; } };
  },

  // ============================================================ season pass & leaderboards
  seasonCheck(first = false) {
    const S = this.S, info = seasonInfo();
    if (S.season.key === info.key) return;
    const old = S.season;
    if (old.key && old.exp > 0) {
      const rows = this.lbRows('season', old.key, 1, old.exp);
      const place = rows.findIndex((r) => r.me) + 1, tier = SEASON_RANK_REWARDS.find((t) => place <= t.upTo);
      this.giveReward({ diamonds: tier.diamonds, title: tier.title }, true);
      const show = () => this.ui.modal(`Season ${old.n || ''} has ended!`, `You finished #${place} on the Season leaderboard with ${fmt(old.exp)} season points. Reward: ${tier.label}. A new season begins: ${info.name}!`, [{ label: 'Hooray!' }]);
      if (first) setTimeout(show, 2500); else show();
    }
    S.season = { key: info.key, n: info.n, exp: 0, premium: false, free: [], prem: [], warWins: 0, wbBest: 0 };
  },
  passTier() { return Math.min(PASS.tiers, Math.floor(this.S.season.exp / PASS.perTier)); },
  addSeasonExp(n) {
    const S = this.S; if (!S.season || n <= 0) return;
    const before = this.passTier();
    S.season.exp += Math.round(n);
    const after = this.passTier();
    if (after > before) { this.ui.toast(`Season Pass tier ${after} reached!`, 'good'); this.ui.refreshActs(); }
  },
  claimPass(tier, premium) {
    const S = this.S, P = S.season, list = premium ? P.prem : P.free;
    if (tier > this.passTier() || list.includes(tier) || (premium && !P.premium)) return;
    const r = passReward(tier, premium);
    list.push(tier);
    this.giveReward(r);
    this.sfx.play('coin'); this.ui.toast(`Season reward: ${r.label}`, 'good'); this.ui.refreshActs(); this.ui.refreshPanel(); this.save();
  },
  claimAllPass() {
    const P = this.S.season, top = this.passTier();
    for (let t = 1; t <= top; t++) { if (!P.free.includes(t)) this.claimPass(t, false); if (P.premium && !P.prem.includes(t)) this.claimPass(t, true); }
  },
  buyPremiumPass() {
    const P = this.S.season; if (P.premium) return;
    if (!this.pay(PASS.premium)) return;
    P.premium = true; this.sfx.play('legend'); this.fx.levelUp(this.player);
    this.ui.banner('Premium Pass', 'Golden rewards unlocked!', 'loot5'); this.ui.refreshPanel(); this.save();
  },
  passClaimable() {
    const P = this.S.season, top = this.passTier(); let n = 0;
    for (let t = 1; t <= top; t++) { if (!P.free.includes(t)) n++; if (P.premium && !P.prem.includes(t)) n++; }
    return n;
  },
  // Leaderboard rows: simulated adventurers (stable for the season) plus you.
  lbRows(cat, key = monthKey(), prog = Math.max(0.08, monthProgress()), mine = null) {
    const S = this.S, rand = rng32(cat + key), names = shuffled([...BOT_NAMES, ...EXTRA_NAMES], rand).slice(0, 19);
    const cls = Object.keys(CLASSES);
    const rows = names.map((name, i) => ({ name, cls: cls[(rand() * 4) | 0], guild: GUILD_LIST[(rand() * GUILD_LIST.length) | 0].name, r: rand(), i }));
    const L = S.level;
    let val, me, fmtv = fmt, lowerBetter = false;
    switch (cat) {
      case 'level': rows.forEach((r) => { r.v = clamp(Math.round(200 - r.i * 7 - r.r * 6 - (1 - prog) * 60), 6, 200); }); me = S.level; fmtv = (v) => `Lv ${v}`; break;
      case 'wboss': { const top = this.wbStats(clamp(L + 3, 8, MAX_LEVEL + 3)).hp * 0.32; rows.forEach((r) => { r.v = Math.round(top * Math.pow(0.86, r.i) * (0.9 + r.r * 0.2)); }); me = S.lb.wbBest || 0; break; }
      case 'dungeon': { lowerBetter = true; const id = this.ui?.sel?.lbDungeon || 'd1', par = { d1: 240, d2: 300, d3: 360 }[id]; rows.forEach((r) => { r.v = Math.round(par * (0.5 + r.i * 0.035 + r.r * 0.03)); }); me = S.lb.dgTime?.[id] || 0; fmtv = (v) => (v ? `${Math.floor(v / 60)}:${String(Math.round(v % 60)).padStart(2, '0')}` : '—'); break; }
      case 'season': rows.forEach((r) => { r.v = Math.round(30000 * Math.pow(0.88, r.i) * (0.85 + r.r * 0.3) * prog); }); me = mine ?? S.season.exp; break;
      case 'war': rows.forEach((r) => { r.v = Math.round(46 * Math.pow(0.84, r.i) * (0.8 + r.r * 0.4) * prog); }); me = S.season.warWins || 0; fmtv = (v) => `${v} wins`; break;
      case 'guild': {
        const gl = GUILD_LIST.map((g) => ({ name: g.name, guild: g.name, cls: null, v: Math.round(g.size * 2400 * (1 + g.lv * 0.25)), lv: g.lv, color: g.color }));
        const G = S.guild;
        if (G && G.own) gl.push({ name: G.name, guild: G.name, v: Math.round(this.guildRoster().reduce((a, m) => a + m.br, 0) * (1 + G.lv * 0.25)), lv: G.lv, color: G.color, me: true });
        else if (G) gl.forEach((g) => { if (g.name === G.name) g.me = true; });
        return { rows: gl.sort((a, b) => b.v - a.v), fmtv: (v) => fmt(v) };
      }
      default: rows.forEach((r) => { r.v = Math.round(42000 * Math.pow(0.8, r.i) * (0.9 + r.r * 0.2) + 600); r.lv = clamp(Math.round(30 - r.i * 1.5), 5, 30); }); me = this.br;
    }
    rows.push({ name: S.name, cls: S.cls, guild: S.guild?.name || '', v: me, me: true, lv: S.level });
    const ok = rows.filter((r) => !lowerBetter || r.v > 0 || r.me);
    ok.sort((a, b) => (lowerBetter ? (a.v || 1e9) - (b.v || 1e9) : b.v - a.v));
    if (mine !== null) return ok;
    return { rows: ok, fmtv };
  },
};

function needExpL(l) { return Math.floor(70 * Math.pow(l, 1.6) + 30); }

export function installSystems(Game) { Object.assign(Game.prototype, M); }
export { GEMS, GEM_LV };
