// Live service link. When the game runs inside its claude.ai page it gets the artifact's shared database: each
// signed-in player's status is reported to players/<id> (readable only by the owner and editors in the admin panel),
// the live config the admin sets (announcement, EXP/Gold events, maintenance notice) is read from config/live, and
// gifts arrive from gifts/* (everyone) and players/<id>/mail/* (one player). A local copy has no link and plays as before.
import { ITEMS, CLASSES, SLOTS, TITLES } from './data.js';
import { MATERIALS } from './systems-data.js';

export const LIVE_VERSION = '2026.10.3';
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export const live = { db: null, user: null, uid: null, admin: false, owner: false, framed: false, ready: false, config: {}, gifts: [], listeners: new Set(), errors: [] };
const emit = () => { for (const fn of live.listeners) { try { fn(live); } catch { /* listener error */ } } };
export const onLive = (fn) => { live.listeners.add(fn); return () => live.listeners.delete(fn); };

// client errors are kept (deduplicated) and reported with the player's status
function noteError(msg, src) {
  msg = String(msg || 'Unknown error').slice(0, 240);
  const e = live.errors.find((x) => x.msg === msg);
  if (e) { e.n++; e.t = Date.now(); } else { live.errors.unshift({ msg, src: String(src || '').slice(0, 160), t: Date.now(), n: 1 }); live.errors.length = Math.min(live.errors.length, 10); }
  live.errorsDirty = true;
}
addEventListener('error', (e) => noteError(e.message, e.filename ? `${e.filename.split('/').pop()}:${e.lineno}` : ''));
addEventListener('unhandledrejection', (e) => noteError(e.reason?.message || e.reason, 'promise'));

export async function connectLive() {
  live.framed = !!(window.claude && typeof window.claude.use === 'function');
  if (!live.framed) { live.ready = true; emit(); return live; }
  try {
    const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
    live.db = db; live.user = user;
    if (user) { live.uid = await user.id(); live.admin = await user.canEdit(); live.owner = await user.isOwner(); }
    if (db) {
      db.doc('config/live').onSnapshot((snap) => { live.config = (snap.exists && snap.data()) || {}; emit(); }, () => {});
      db.collection('gifts').orderBy('t', 'desc').limit(20).onSnapshot((q) => { live.gifts = q.docs.map((d) => ({ id: d.id, ...d.data() })); emit(); }, () => {});
    }
  } catch { /* no live link in this view */ }
  live.ready = true; emit();
  return live;
}
export const liveConfig = () => live.config || {};
export function liveBoost(now = Date.now()) {
  const b = live.config?.boost;
  return b && b.until > now ? { exp: Math.max(1, +b.exp || 1), gold: Math.max(1, +b.gold || 1), name: b.name || 'Live Event', until: b.until } : null;
}

// status document for one player (kept small: no ids beyond the doc key, no account names)
export function playerStatus(g) {
  const S = g.S, p = g.player;
  const eq = SLOTS.map((s) => S.equip[s] && { slot: s, name: S.equip[s].name, q: S.equip[s].quality, enh: S.equip[s].enh || 0, lvl: S.equip[s].lvl }).filter(Boolean);
  return {
    name: S.name, cls: S.cls, level: S.level, exp: S.exp, br: g.br || 0, gold: S.gold, diamonds: S.diamonds,
    zone: g.dg ? g.dg.def.name : g.war ? 'Guild War' : (g.zone?.name || 'Carlyle'), where: g.dg ? 'dungeon' : g.war ? 'war' : 'world',
    pos: p ? [Math.round(p.pos.x), Math.round(p.pos.z)] : null, dead: !!p?.dead,
    playSecs: Math.round(S.stats?.playSecs || 0), deaths: S.stats?.deaths || 0, kills: Object.values(S.kills || {}).reduce((a, b) => a + b, 0),
    dgClears: Object.values(S.dgn?.clears || {}).reduce((a, b) => a + b, 0), guild: S.guild?.name || null, title: TITLES[S.title] || '',
    equip: eq, prof: Object.fromEntries(Object.entries(S.prof || {}).map(([k, v]) => [k, v.lv])), collSets: g.collSets ? g.collSets() : 0,
    red: S.life?.red || 0, pets: Object.keys(S.pets || {}).length, mounts: (S.mounts || []).length, costumes: (S.costumes || []).length,
    bag: [S.bag.length, g.bagMax ? g.bagMax() : 48], auction: { won: S.auc?.won || 0, sold: S.auc?.sold || 0 }, trades: S.trades || 0,
    device: matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop', version: LIVE_VERSION,
    firstSeen: S.stats?.firstSeen || Date.now(), lastSeen: Date.now(), events: (g.liveEvents || []).slice(0, 25), errors: live.errors.slice(0, 10),
  };
}

const L = {
  initLive() {
    const S = this.S;
    S.stats = S.stats || { playSecs: 0, deaths: 0, firstSeen: Date.now() };
    S.giftsClaimed = S.giftsClaimed || [];
    this.liveEvents = this.liveEvents || [];
    this.liveT = 5; this.liveSig = ''; this.liveLastWrite = 0; this.liveSoon = false; this.giftQueue = [];
    this.liveMotd = S.lastMotd || '';
    this.offLive = onLive(() => this.onLiveChange());
    this.onLiveChange(true);
    this.logEvent('login', `Logged in · Lv ${S.level} ${CLASSES[S.cls]?.name || ''}`);
    if (live.db && live.uid) {
      live.db.collection(`players/${live.uid}/mail`).onSnapshot((q) => {
        for (const d of q.docs) if (!this.giftQueue.some((x) => x.id === d.id) && !S.giftsClaimed.includes('m:' + d.id)) this.giftQueue.push({ id: d.id, mail: true, ...d.data() });
        this.showNextGift();
      }, () => {});
    }
  },
  // notable moments, shown in the admin panel's activity feed
  logEvent(type, text, important = false) {
    if (!this.liveEvents) this.liveEvents = [];
    this.liveEvents.unshift({ t: Date.now(), type, text: String(text).slice(0, 120) });
    this.liveEvents.length = Math.min(this.liveEvents.length, 25);
    if (important) this.liveSoon = true;
  },
  updateLive(dt) {
    const S = this.S;
    S.stats.playSecs = (S.stats.playSecs || 0) + dt;
    this.liveT -= dt;
    if (this.liveT > 0) return;
    this.liveT = 5;
    if (this.giftQueue.length) this.showNextGift();
    if (!live.db || !live.uid) return;
    const sig = [S.level, Math.floor(S.exp / 50), Math.floor(S.gold / 100), S.diamonds, this.zone?.name, !!this.dg, this.liveEvents[0]?.t, live.errors.length, live.errorsDirty].join('|');
    const since = Date.now() - this.liveLastWrite;
    if (sig === this.liveSig || (since < 60000 && !(this.liveSoon && since > 5000))) return;
    this.liveSig = sig; this.liveSoon = false; this.liveLastWrite = Date.now(); live.errorsDirty = false;
    this.liveWrite();
  },
  async liveWrite() {
    if (!live.db || !live.uid || this.liveWriting) return;
    this.liveWriting = true;
    try { await live.db.doc('players/' + live.uid).set(playerStatus(this)); } catch { /* view-only viewers cannot write; that is fine */ }
    this.liveWriting = false;
  },
  onLiveChange(first = false) {
    const S = this.S, c = live.config || {};
    if (c.motd && c.motdT && c.motdT !== S.lastMotdT) {
      S.lastMotdT = c.motdT;
      this.ui.chat('announce', `<b>[GM]</b> ${esc(c.motd)}`);
      if (!first) this.ui.banner('Announcement', c.motd.slice(0, 80), 'zone');
    }
    const b = liveBoost();
    const key = b ? `${b.name}|${b.exp}|${b.gold}|${b.until}` : '';
    if (key !== this.boostKey) {
      this.boostKey = key;
      if (b) { this.ui.chat('announce', `<b>[Event]</b> ${esc(b.name)}: ${b.exp > 1 ? `x${b.exp} EXP ` : ''}${b.gold > 1 ? `x${b.gold} Gold ` : ''}until ${new Date(b.until).toLocaleString()}`); this.ui.banner(b.name, `${b.exp > 1 ? `x${b.exp} EXP` : ''}${b.exp > 1 && b.gold > 1 ? ' · ' : ''}${b.gold > 1 ? `x${b.gold} Gold` : ''}`, 'clear'); }
    }
    if (c.maint?.on && c.maint.text && c.maint.t !== this.maintSeen) { this.maintSeen = c.maint.t; this.ui.toast(`Notice: ${c.maint.text}`, 'warn'); }
    for (const gf of live.gifts || []) {
      if (S.giftsClaimed.includes(gf.id) || this.giftQueue.some((x) => x.id === gf.id)) continue;
      if (gf.until && gf.until < Date.now()) continue;
      if (gf.minLv && S.level < gf.minLv) continue;
      this.giftQueue.push(gf);
    }
    this.showNextGift();
  },
  giftText(gf) {
    const out = [];
    if (gf.gold) out.push(`${fmt(gf.gold)} Gold`);
    if (gf.diamonds) out.push(`${fmt(gf.diamonds)} Diamonds`);
    for (const [id, n] of gf.items || []) if (ITEMS[id]) out.push(`${ITEMS[id].name} x${n}`);
    for (const [id, n] of gf.mats || []) out.push(`${MATERIALS[id]?.name || id} x${n}`);
    return out.join(', ') || 'a kind word';
  },
  showNextGift() {
    const md = document.getElementById('modal');
    if (this.giftOpen && md && md.hidden) this.giftOpen = false; // another dialog replaced ours: show it again
    if (this.giftOpen || !this.giftQueue.length || !this.ui.g || (md && !md.hidden)) return;
    const gf = this.giftQueue[0], key = gf.mail ? 'm:' + gf.id : gf.id;
    this.giftOpen = true;
    const claim = () => {
      const S = this.S;
      if (this.giftQueue[0] === gf) this.giftQueue.shift();
      this.giftOpen = false;
      if (S.giftsClaimed.includes(key)) return;
      S.giftsClaimed.push(key);
      if (S.giftsClaimed.length > 200) S.giftsClaimed.splice(0, S.giftsClaimed.length - 200);
      this.giveReward({ gold: gf.gold || 0, diamonds: gf.diamonds || 0, items: (gf.items || []).filter(([id]) => ITEMS[id]), mats: Object.fromEntries(gf.mats || []) }, true);
      this.sfx.play('quest'); this.fx.levelUp(this.player);
      this.logEvent('gift', `Claimed gift: ${gf.title || 'Gift'}`);
      if (gf.mail && live.db && live.uid) live.db.doc(`players/${live.uid}/mail/${gf.id}`).delete().catch(() => {});
      this.save();
      setTimeout(() => this.showNextGift(), 400);
    };
    this.ui.modal(gf.title || 'A gift from the Game Masters', `${gf.note ? gf.note + ' ' : ''}Contents: ${this.giftText(gf)}.`, [{ label: 'Claim', cls: 'green', fn: claim }], true);
  },
};

export function installLive(Game) { Object.assign(Game.prototype, L); }
