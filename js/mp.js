// Real-time multiplayer for the public website. Everyone plays on one server, Pilipinas, which is one
// Supabase Realtime channel: presence carries who is online (name, class, level, look, zone, party) and broadcasts
// carry movement, chat and party messages (party.js). Monsters, loot and progress stay per player. No database tables are used.
// Staying connected: the channel's own state is watched (a reconnect the library makes quietly still counts), our own
// presence is put back if the server lost it, a page that comes back into view or a channel stuck for a while rejoins
// from scratch, heartbeats run in a worker so a tab in the background is not dropped, and players also announce
// themselves by broadcast ("hello"), so they find each other even if presence fails.
// Inside the claude.ai page (window.claude present) or without a configured key, multiplayer stays off.
import * as THREE from 'three';
import { PETS, MOUNTS, CLASSES } from './data.js';
import { MP_CONFIG } from './mp-config.js';
import { buildHumanoid } from './models.js';
import { cleanApp } from './models-hero.js';
import { lookFor } from './life.js';
import { isElement } from './data-elements.js';
import { BUILD } from './build.js';
import { checkUpdate } from './update.js';

const LIB_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/dist/umd/supabase.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
// Movement is sent with its velocity and drawn by dead reckoning: between updates a remote hero keeps walking the
// way it was going, and each update only nudges it back on course. Updates go out when the prediction the others make
// drifts, when the hero starts, stops or turns, and at least every SEND_MAX ms while moving. Nothing is sent while
// nobody else is on the server (Supabase's free plan counts every message each player receives).
const EXTRAP = 0.9; // seconds a remote hero keeps moving on its last velocity before waiting for news
const SEND_MIN = 90, SEND_MAX = 600, SEND_IDLE = 15000; // ms between movement updates
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const _off = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0), _pt = new THREE.Vector3();
const SERVER_KEY = 'aetherheim_server';
const HELLO_SECS = 15; // a player alone announces itself this often (every 30 s with company)
const PEER_TTL = 45; // a player only heard by broadcast (missing from presence) is dropped after this long in silence
const STALL_SECS = 20; // a channel that is not joined for this long while the page is in view rejoins from scratch

export const mp = { status: 'off', server: 'S1', id: null, client: null, channel: null, peers: new Map(), error: '', party: { id: null, pj: 0 }, diag: { joins: 0, drops: 0, retracks: 0, hellos: 0, since: 0, err: '' } };
export function mpEnabled() { return !!(MP_CONFIG.url && MP_CONFIG.key) && !(window.claude && typeof window.claude.use === 'function'); }
// the saved choice from when there were several servers falls back to Pilipinas
export function getServer() { try { const s = localStorage.getItem(SERVER_KEY); return SERVERS.some((x) => x.id === s) ? s : 'S1'; } catch { return 'S1'; } }
export function setServer(s) { try { localStorage.setItem(SERVER_KEY, s); } catch { /* storage unavailable */ } }
// The server's name and emblem. Its id names the Realtime channel, so it never changes.
export const SERVERS = [{ id: 'S1', name: 'Pilipinas', icon: 'srv_pilipinas' }];
export const serverName = (id) => SERVERS.find((s) => s.id === id)?.name || id;

let libPromise = null;
function loadLib() {
  if (window.supabase?.createClient) return Promise.resolve(window.supabase);
  if (!libPromise) libPromise = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = LIB_URL; s.async = true;
    s.onload = () => (window.supabase?.createClient ? res(window.supabase) : rej(new Error('library missing')));
    s.onerror = () => rej(new Error('could not load the multiplayer library'));
    document.head.appendChild(s);
  });
  return libPromise;
}

// first-clear times another player reports (trial t1..t10, Ancient items a<id>)
function cleanFirsts(v) {
  const out = {};
  if (!v || typeof v !== 'object') return out;
  for (const [k, t] of Object.entries(v).slice(0, 40)) if (/^(t\d{1,2}|a[a-z0-9_]{1,30})$/.test(k) && Number.isFinite(+t) && +t > 1.7e12 && +t < Date.now() + 864e5) out[k] = +t;
  return out;
}
// sanitise what another browser sent us
function cleanInfo(m) {
  if (!m || typeof m !== 'object') return null;
  const cls = CLASSES[m.cls] ? m.cls : 'knight';
  return {
    id: str(m.id, 40), name: str(m.name, 16) || 'Adventurer', cls, gender: m.gender === 'm' ? 'm' : 'f',
    hair: /^#[0-9a-f]{6}$/i.test(m.hair) ? m.hair : '#f2d27a', eye: /^#[0-9a-f]{6}$/i.test(m.eye) ? m.eye : '#3a6fd8', app: cleanApp(m.app),
    level: num(m.level, 1, 200, 1) | 0, guild: str(m.guild, 24) || null, title: str(m.title, 32), wings: !!m.wings,
    wingColor: /^#[0-9a-f]{6}$/i.test(m.wingColor) ? m.wingColor : null,
    costume: { outfit: str(m.costume?.outfit, 24) || null, head: str(m.costume?.head, 24) || null, back: str(m.costume?.back, 24) || null },
    mount: MOUNTS.some((x) => x.id === m.mount) ? m.mount : null, pet: PETS.some((x) => x.id === m.pet) ? m.pet : null,
    zone: str(m.zone, 40), map: m.map === 'world' ? 'world' : 'away', br: num(m.br, 0, 1e9, 0) | 0,
    x: num(m.x, -400, 400, 0), z: num(m.z, -400, 400, 9),
    party: /^[a-z0-9]{4,16}$/.test(m.party) ? m.party : null, pj: num(m.pj, 0, 1e13, 0),
    aura: /^#[0-9a-f]{6}$/i.test(m.aura) ? m.aura : null, pr: cleanFirsts(m.pr), gt: num(m.gt, 0, 7, 0) | 0, dawn: !!m.dawn,
    wg: num(m.wg, 0, 4, 0) | 0, we: isElement(m.we) ? m.we : null, gm: !!m.gm, bv: num(m.bv, 0, 1e14, 0),
  };
}

const M = {
  // ============================================================ connection
  async mpStart() {
    if (this.mpStarted) { this.mpRejoin(); return; } // Retry: rejoin, keeping who we are
    this.mpStarted = true;
    this.rplayers = [];
    this.mpPresT = 0; this.mpLastSent = null; this.mpChatT = 0; this.mpPrev = null; this.mpVx = 0; this.mpVz = 0;
    this.mpWatchT = 1; this.mpHelloT = 0; this.mpStallT = 0; this.mpMissing = 0;
    if (!mpEnabled()) { mp.status = 'off'; return; }
    mp.server = getServer();
    this.partyInit();
    mp.id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, '').slice(0, 16);
    // back in view: say hello and check the line (the watchdog rejoins soon if the library has not reconnected)
    addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !mp.channel) return;
      if (mp.channel.state === 'joined') { this.mpTrack(); this.mpHelloSend(true); } else this.mpStallT = STALL_SECS - 5;
    });
    addEventListener('pagehide', () => { if (mp.status === 'online') mp.channel.send({ type: 'broadcast', event: 'b', payload: { i: mp.id } }).catch(() => {}); });
    mp.status = 'connecting'; this.ui.refreshOnline && this.ui.refreshOnline();
    try {
      const lib = await loadLib();
      mp.client = mp.client || lib.createClient(MP_CONFIG.url, MP_CONFIG.key, { auth: { persistSession: false, autoRefreshToken: false }, realtime: { worker: true } });
      await this.mpJoin();
    } catch (e) { mp.status = 'error'; mp.error = e.message || 'connection failed'; mp.diag.err = mp.error; this.ui.refreshOnline && this.ui.refreshOnline(); }
  },
  // leave the channel (if any) and join it afresh
  async mpJoin() {
    if (mp.channel) { const old = mp.channel; mp.channel = null; try { await mp.client.removeChannel(old); } catch { /* already gone */ } }
    mp.diag.joins++;
    const ch = mp.client.channel('aetherheim-' + mp.server.toLowerCase(), { config: { broadcast: { self: false, ack: false }, presence: { key: mp.id } } });
    mp.channel = ch;
    const on = (ev, fn) => ch.on('broadcast', { event: ev }, ({ payload }) => { if (mp.channel === ch) { this.mpHeard(payload); fn(payload); } });
    ch.on('presence', { event: 'sync' }, () => { if (mp.channel === ch) this.mpSync(); });
    on('m', (p) => this.mpMove(p)); on('c', (p) => this.mpChat(p)); on('p', (p) => this.partyMsg(p)); on('z', (p) => this.dzMsg(p));
    on('t', (p) => this.tradeMsg(p)); on('f', (p) => this.socialMsg(p)); on('h', (p) => this.mpHello(p)); on('b', (p) => this.mpByeGot(p));
    on('w', (p) => this.wbNetMsg(p)); // the world boss's health and threat (aggro.js)
    on('g', (p) => this.gmNetMsg(p)); // a Game Master's monsters (gmnet.js)
    on('d', (p) => this.dropMsg(p)); // items dropped on the ground (drops.js)
    ch.subscribe((status, err) => {
      if (mp.channel !== ch) return;
      if (status === 'SUBSCRIBED') this.mpJoined();
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        mp.status = 'error'; mp.error = status === 'TIMED_OUT' ? 'the server did not answer' : 'the connection dropped, reconnecting';
        mp.diag.drops++; mp.diag.err = `${status}${err?.message ? ': ' + err.message : ''}`.slice(0, 120);
      } else if (status === 'CLOSED') mp.status = 'off';
      this.ui.refreshOnline && this.ui.refreshOnline();
    });
  },
  async mpRejoin() {
    if (this.mpRejoining || !mpEnabled()) return;
    this.mpRejoining = true; this.mpStallT = 0;
    mp.status = 'connecting'; this.ui.refreshOnline && this.ui.refreshOnline();
    try { if (mp.client) await this.mpJoin(); else { this.mpStarted = false; await this.mpStart(); } } catch (e) { mp.status = 'error'; mp.error = e.message || 'connection failed'; mp.diag.err = mp.error; }
    finally { this.mpRejoining = false; this.ui.refreshOnline && this.ui.refreshOnline(); }
  },
  // the channel is joined (first time or again): be seen, and say "Connected" only once
  mpJoined() {
    mp.status = 'online'; mp.error = ''; mp.diag.since = Date.now(); this.mpStallT = 0; this.mpMissing = 0;
    this.mpTrack(); this.mpHelloSend(true); this.mpLastSent = null;
    if (!this.mpAnnounced) { this.mpAnnounced = true; this.ui.chat('system', `Connected to the <b>${esc(serverName(mp.server))}</b> server. Everyone online appears in your world.`); }
    this.ui.refreshOnline && this.ui.refreshOnline();
  },
  mpTrack() {
    if (!mp.channel) return;
    this.mpLastInfo = JSON.stringify(this.mpInfo(true)); this.mpTrackT = performance.now();
    mp.channel.track(this.mpInfo()).catch(() => {});
  },
  // "hello": who we are, by broadcast; ask = the others answer with theirs
  mpHelloSend(ask) {
    if (!mp.channel || mp.channel.state !== 'joined') return;
    this.mpHelloT = mp.peers.size ? 30 : HELLO_SECS;
    mp.channel.send({ type: 'broadcast', event: 'h', payload: { i: mp.id, a: ask ? 1 : 0, info: this.mpInfo() } }).catch(() => {});
  },
  mpHello(m) {
    if (!m || typeof m !== 'object') return;
    const key = str(m.i, 40); if (!key || key === mp.id) return;
    const info = cleanInfo(m.info); if (!info) return;
    info.id = key; mp.diag.hellos++;
    this.mpAddPeer(key, info, false);
    this.partySync(); this.ui.refreshOnline && this.ui.refreshOnline();
    const now = performance.now();
    if (m.a && now - (this.mpHelloReplyT || 0) > 2000) { this.mpHelloReplyT = now; this.mpHelloSend(false); }
  },
  mpByeGot(m) { const key = str(m?.i, 40), pr = mp.peers.get(key); if (pr && !pr.pres) this.mpDropPeer(key); },
  // any message from a player keeps them listed; from someone we have not met yet, ask who they are
  mpHeard(m) {
    const key = m && typeof m === 'object' ? str(m.i, 40) : ''; if (!key || key === mp.id) return;
    const pr = mp.peers.get(key), now = performance.now();
    if (pr) pr.heard = now;
    else if (now - (this.mpAskT || 0) > 3000) { this.mpAskT = now; this.mpHelloSend(true); }
  },
  // the line, once a second: the channel's real state, our presence, hellos and players gone quiet
  mpWatch(dt) {
    this.mpWatchT -= dt; if (this.mpWatchT > 0) return;
    this.mpWatchT = 1;
    const ch = mp.channel; if (!ch || !mp.client || this.mpRejoining) return;
    const st = ch.state, now = performance.now();
    if (st === 'joined' && mp.status !== 'online') this.mpJoined(); // the library rejoined without telling us
    else if (st !== 'joined' && mp.status === 'online') { mp.status = st === 'joining' ? 'connecting' : 'error'; mp.error = 'the connection dropped, reconnecting'; this.ui.refreshOnline && this.ui.refreshOnline(); }
    if (st !== 'joined') {
      if (document.visibilityState === 'visible' && ++this.mpStallT >= STALL_SECS) this.mpRejoin();
      return;
    }
    this.mpStallT = 0;
    // our own presence must be there; put it back if the server lost it, rejoin if that keeps failing
    const mine = !!ch.presenceState()[mp.id];
    if (mine) this.mpMissing = 0;
    else if (now - (this.mpTrackT || 0) > 6000) { mp.diag.retracks++; if (++this.mpMissing >= 4) this.mpRejoin(); else this.mpTrack(); }
    if (--this.mpHelloT <= 0) this.mpHelloSend(!mp.peers.size);
    for (const [key, pr] of [...mp.peers]) if (!pr.pres && now - (pr.heard || 0) > PEER_TTL * 1000) this.mpDropPeer(key);
  },
  mpInfo(stable = false) {
    const S = this.S, p = this.player;
    const where = this.dg || this.war || this.trial ? 'away' : 'world';
    const info = {
      id: mp.id, name: S.name, cls: S.cls, gender: S.gender, hair: S.hair, eye: S.eye, app: S.app, level: S.level, guild: S.guild?.name || null,
      wings: !!S.wings, wingColor: S.wingColor || null, costume: S.costume || {}, mount: this.mounted ? S.activeMount : null, pet: S.activePet || null,
      zone: this.trial ? 'Breakthrough Trial' : this.dg ? this.dg.def.name : this.war ? 'Guild War' : (this.zone?.name || 'Carlyle'), map: where, br: this.br || 0,
      party: mp.party.id, pj: mp.party.pj, aura: this.myAuraColor ? this.myAuraColor() : null, pr: this.prestigeInfo ? this.prestigeInfo() : {}, gt: this.gearGlowTier ? this.gearGlowTier() : 0, ...(this.weaponLook ? this.weaponLook() : {}), dawn: !!(this.hasFx && this.hasFx('six_dawn6')), gm: !!S.gm, bv: BUILD,
    };
    if (!stable) { info.x = Math.round(p.pos.x * 10) / 10; info.z = Math.round(p.pos.z * 10) / 10; }
    return info;
  },
  // publish presence right away (joining or leaving a party)
  mpTrackNow() {
    if (mp.status !== 'online' || !mp.channel) return;
    this.mpTrack(); this.mpHelloSend(false);
  },
  // ============================================================ per frame
  mpUpdate(dt) {
    for (const e of this.rplayers || []) this.mpAnimate(e, dt);
    this.partyUpdate(dt); this.wbNetUpdate(dt); this.gmNetUpdate(dt);
    this.tradeUpdate(dt); this.socialUpdate();
    if (mp.channel) this.mpWatch(dt);
    if (mp.status !== 'online' || !mp.channel) return;
    const p = this.player;
    // presence: only when what others see changes (look, level, zone, mount, pet)
    this.mpPresT -= dt;
    if (this.mpPresT <= 0) {
      this.mpPresT = 2;
      const sig = JSON.stringify(this.mpInfo(true));
      if (sig !== this.mpLastInfo) { this.mpTrack(); this.mpHelloSend(false); } // players who only hear our hellos see the change too
    }
    // own velocity in world units per real second: the others extrapolate with it
    const now = performance.now(), pv = this.mpPrev;
    if (pv && now > pv.t) {
      const sec = (now - pv.t) / 1000, ix = (p.pos.x - pv.x) / sec, iz = (p.pos.z - pv.z) / sec;
      if (!this.mpMoving || Math.hypot(ix, iz) > 40) { this.mpVx = 0; this.mpVz = 0; } // standing, or a teleport
      else { const k = 1 - Math.exp(-sec * 30); this.mpVx += (ix - this.mpVx) * k; this.mpVz += (iz - this.mpVz) * k; }
    }
    this.mpPrev = { x: p.pos.x, z: p.pos.z, t: now };
    const st = p.dead ? 4 : p.state === 'attack' ? 2 : p.state === 'cast' ? 3 : this.mpMoving ? 1 : 0;
    if (!mp.peers.size) { this.mpLastSent = null; return; } // alone on the server: nobody to tell
    const w = this.dg || this.war || this.trial ? 0 : 1, L = this.mpLastSent, gap = L ? now - L.t : Infinity;
    const hp = Math.round((100 * p.hp) / p.maxHp); // shown on party frames
    // hp goes out for party frames, and quickly inside the Danger Zone where others are fighting you
    let send = !L || gap > SEND_IDLE || w !== L.w || (st !== L.s && gap > 60) || (!!mp.party.id && Math.abs(hp - L.h) >= 8 && gap > 500) || (this.dzIn && Math.abs(hp - L.h) >= 3 && gap > 150);
    if (!send && gap > SEND_MIN) {
      // where the others currently draw us
      const a = Math.min(gap / 1000, EXTRAP), ex = L.x + L.vx * a, ez = L.z + L.vz * a;
      send = Math.hypot(p.pos.x - ex, p.pos.z - ez) > 0.4 || Math.hypot(this.mpVx - L.vx, this.mpVz - L.vz) > 1.2
        || (st === 1 && gap > SEND_MAX) || (Math.abs(angDiff(p.yaw, L.y)) > 0.5 && gap > 300);
    }
    if (!send) return;
    const r2 = (v) => Math.round(v * 100) / 100;
    const cur = { x: r2(p.pos.x), z: r2(p.pos.z), y: r2(p.yaw), s: st, w, vx: r2(this.mpVx), vz: r2(this.mpVz), h: hp };
    this.mpLastSent = { ...cur, t: now };
    mp.channel.send({ type: 'broadcast', event: 'm', payload: { i: mp.id, ...cur } }).catch(() => {});
  },
  mpSendChat(text) {
    if (mp.status !== 'online' || !mp.channel) return false;
    if (performance.now() - this.mpChatT < 800) return false;
    this.mpChatT = performance.now();
    mp.channel.send({ type: 'broadcast', event: 'c', payload: { i: mp.id, n: this.S.name, t: str(text, 120) } }).catch(() => {});
    return true;
  },
  // ============================================================ incoming
  mpSync() {
    const state = mp.channel.presenceState(), seen = new Set(), now = performance.now();
    for (const [key, metas] of Object.entries(state)) {
      if (key === mp.id || !metas || !metas.length) continue;
      try { // one odd player never hides the rest
        const info = cleanInfo(metas[metas.length - 1]); if (!info) continue;
        info.id = key; seen.add(key);
        this.prestigeFromPeer && this.prestigeFromPeer(info);
        this.mpAddPeer(key, info, true);
      } catch (e) { mp.diag.err = ('sync: ' + (e.message || e)).slice(0, 120); console.error(e); }
    }
    // gone from presence: dropped at once if presence knew them, after a silence if we only heard their hellos
    for (const [key, pr] of [...mp.peers]) if (!seen.has(key) && (pr.pres || now - (pr.heard || 0) > PEER_TTL * 1000)) this.mpDropPeer(key);
    this.partySync();
    this.ui.refreshOnline && this.ui.refreshOnline();
  },
  // a player seen in presence (pres) or heard by hello
  mpAddPeer(key, info, pres) {
    const old = mp.peers.get(key);
    if (!old) { if (!this.friendOnline(info)) this.ui.chat('system', `<b>${esc(info.name)}</b> (Lv ${info.level} ${esc(CLASSES[info.cls].name)}) is online.`); this.mpLastSent = null; } // tell the newcomer where we are
    mp.peers.set(key, { ...(old || {}), info, pres: pres || !!old?.pres, heard: performance.now(), net: old?.net || { x: info.x, z: info.z, y: 0, s: 0, w: info.map === 'world' ? 1 : 0, t: performance.now() } });
    if (!old) this.mpVersionNote(info);
    this.mpEnsure(key);
  },
  // a player on another version of the game (an old copy does not know newer things, like a Game Master's monsters)
  mpVersionNote(info) {
    if (!BUILD) return; // a local copy
    if (info.bv > BUILD) { checkUpdate(true); return; } // we are the old one: the Update bar
    if (info.bv < BUILD && !(this.mpOldNoted ||= new Set()).has(info.id)) {
      this.mpOldNoted.add(info.id);
      this.ui.chat('system', `<b>${esc(info.name)}</b> is playing an older version of the game: ask them to reload the page (or close and reopen it) so you both see the same monsters and items.`);
    }
  },
  mpDropPeer(key) {
    const pr = mp.peers.get(key); if (!pr) return;
    mp.peers.delete(key);
    this.mpRemove(key); this.dzPeerGone(key); this.tradePeerGone(key); this.socialPeerGone(key); this.gmNetPeerGone(key); this.dropsPeerGone(key);
    this.ui.chat('system', `<b>${esc(pr.info.name)}</b> went offline.`);
    this.partySync(); this.ui.refreshOnline && this.ui.refreshOnline();
  },
  mpMove(m) {
    if (!m || typeof m !== 'object') return;
    const pr = mp.peers.get(str(m.i, 40)); if (!pr) return;
    pr.net = {
      x: num(m.x, -5200, 5200, pr.net?.x || 0), z: num(m.z, -400, 5200, pr.net?.z || 0), vx: num(m.vx, -40, 40, 0), vz: num(m.vz, -40, 40, 0),
      y: num(m.y, -10, 10, 0), s: num(m.s, 0, 4, 0) | 0, w: m.w ? 1 : 0, h: num(m.h, 0, 100, pr.net?.h ?? 100), t: performance.now(),
    };
    const e = this.rplayers.find((x) => x.peerId === pr.info.id);
    if (e) { e.maxHp = 100; e.hp = pr.net.h; } // HP in percent (target frame)
  },
  mpChat(m) {
    if (!m || typeof m !== 'object') return;
    const pr = mp.peers.get(str(m.i, 40)); if (!pr) return;
    const text = str(m.t, 120).trim(); if (!text) return;
    this.ui.chat('player', esc(text), (pr.info.gm ? '[GM] ' : '') + pr.info.name);
    const e = this.rplayers.find((x) => x.peerId === pr.info.id);
    if (e) this.mpBubble(e, text);
  },
  // ============================================================ remote heroes in the world
  mpEnsure(key) {
    const pr = mp.peers.get(key); if (!pr) return;
    const info = pr.info;
    const sig = JSON.stringify([info.cls, info.app, info.gender, info.hair, info.eye, info.wings, info.wingColor, info.costume, info.mount, info.pet, info.name, info.level, info.guild, info.aura, info.gt, info.wg, info.we, info.gm]);
    let e = this.rplayers.find((x) => x.peerId === key);
    if (e && e.sig === sig) return;
    const keepPos = e ? { x: e.pos.x, z: e.pos.z, yaw: e.yaw } : null;
    if (e) this.mpRemove(key);
    const look = lookFor(info);
    const hum = buildHumanoid(look);
    e = this.makeEnt('rp', hum, { name: info.name, radius: 0.6 });
    e.peerId = key; e.sig = sig; e.humanoid = hum; e.cls = info.cls; e.look = look; e.level = info.level; e.guild = info.guild;
    e.maxHp = 100; e.hp = pr.net.h ?? 100; e.speed = CLASSES[info.cls].speed;
    const x = keepPos ? keepPos.x : pr.net.x, z = keepPos ? keepPos.z : pr.net.z;
    e.pos.set(x, this.world.heightAt(x, z), z); e.yaw = e.yawT = keepPos ? keepPos.yaw : pr.net.y;
    if (info.mount) {
      const md = MOUNTS.find((m) => m.id === info.mount); const mm = this.mountBuild(md.model);
      e.model.remove(hum); mm.userData.parts.seat.add(hum); hum.position.set(0, -0.55, 0);
      e.model.add(mm); e.inner = mm; e.mounted = true; e.mountSpeed = md.speed;
    }
    if (info.pet) { const pd = PETS.find((p) => p.id === info.pet); e.petModel = this.petBuild(pd.model); e.petModel.scale.multiplyScalar(0.9); e.petModel.position.copy(e.pos); this.scene.add(e.petModel); }
    const g = info.guild ? `<div class="g">&lt;${esc(info.guild)}&gt;</div>` : '';
    this.nameplate(e, `${g}<div class="n">${info.gm ? '<span class="gmtag">GM</span>' : ''}${esc(info.name)}</div><div class="t">${info.gm ? 'Game Master' : `Lv ${info.level} ${esc(CLASSES[info.cls].name)}`}</div>`, 'rp');
    if (info.aura && this.applyAura) this.applyAura(e, info.aura);
    if (info.gt >= 5 && this.applyGearGlow) this.applyGearGlow(e, info.gt); // Legendary-and-up gear glows for everyone
    if ((info.wg || info.we) && this.applyWeaponFx) this.applyWeaponFx(e, info.cls, info.wg, info.we); // weapon glow and element (weaponfx.js)
    this.rplayers.push(e);
  },
  mpRemove(key) {
    const e = this.rplayers.find((x) => x.peerId === key); if (!e) return;
    if (e.petModel) this.scene.remove(e.petModel);
    if (e.wfx) { e.wfx.dispose(); e.wfx = null; }
    e.bubble?.remove();
    this.removeEnt(e);
    this.rplayers = this.rplayers.filter((x) => x !== e);
  },
  mpAnimate(e, dt) {
    const pr = mp.peers.get(e.peerId); if (!pr) return;
    const n = pr.net, here = !this.dg && !this.war && !this.trial;
    e.netHidden = !here || !n.w || pr.info.map !== 'world';
    if (e.netHidden) { if (e.petModel) e.petModel.visible = false; return; }
    // dead reckoning: where the hero should be now, from the last update and its velocity
    const age = Math.min(Math.max(0, performance.now() - n.t) / 1000, EXTRAP);
    const vx = n.vx || 0, vz = n.vz || 0, tx = n.x + vx * age, tz = n.z + vz * age;
    const ox = e.pos.x, oz = e.pos.z;
    if (Math.hypot(tx - ox, tz - oz) > 12) e.pos.set(tx, 0, tz); // teleported or far behind: jump
    else {
      if (age < EXTRAP) { e.pos.x += vx * dt; e.pos.z += vz * dt; }
      const k = 1 - Math.exp(-dt * 6); e.pos.x += (tx - e.pos.x) * k; e.pos.z += (tz - e.pos.z) * k;
    }
    e.pos.y = this.world.heightAt(e.pos.x, e.pos.z);
    const spd = dt > 0 ? Math.hypot(e.pos.x - ox, e.pos.z - oz) / dt : 0;
    e.drawSpd = (e.drawSpd || 0) + (spd - (e.drawSpd || 0)) * (1 - Math.exp(-dt * 10));
    const going = Math.hypot(vx, vz) > 0.5 && age < EXTRAP;
    e.yawT = going ? Math.atan2(vx, vz) : n.y;
    e.moving = going || e.drawSpd > 1;
    e.state = n.s === 4 ? 'dead' : n.s === 2 ? 'attack' : n.s === 3 ? 'cast' : e.moving ? 'run' : 'idle';
    const foe = this.pvpFoe(e); // red nameplate: you can fight this player
    if (foe !== e.foe) { e.foe = foe; e.np?.classList.toggle('foe', foe); }
    if ((n.s === 2 || n.s === 3) && e.actT <= 0) { e.actT = e.actDur = 0.45; }
    e.actT = Math.max(0, e.actT - dt);
    if (e.petModel) {
      e.petModel.visible = e.model.visible;
      _off.set(-1.3, 0, -1.2).applyAxisAngle(_up, e.yaw);
      _pt.set(e.pos.x + _off.x, this.world.heightAt(e.pos.x + _off.x, e.pos.z + _off.z), e.pos.z + _off.z);
      e.petModel.position.lerp(_pt, 1 - Math.exp(-dt * 4));
      e.petModel.rotation.y = e.yaw;
    }
    if (e.bubble) {
      e.bubbleT -= dt;
      if (e.bubbleT <= 0) { e.bubble.remove(); e.bubble = null; }
    }
  },
  mpBubble(e, text) {
    e.bubble?.remove();
    const b = document.createElement('div'); b.className = 'chat-bubble'; b.textContent = text.slice(0, 80);
    e.np?.prepend(b); e.bubble = b; e.bubbleT = 6;
  },
  // where a friend is, in words (fast travel is only between waystones)
  mpGoTo(key) {
    const pr = mp.peers.get(key); if (!pr) return;
    if (pr.info.map !== 'world' || !pr.net.w) { this.ui.toast(`${pr.info.name} is in ${pr.info.zone}`, 'warn'); return; }
    this.ui.closePanels();
    this.giveDirections(pr.net.x, pr.net.z, pr.info.name, null, false);
  },
};

export function installMp(Game) { Object.assign(Game.prototype, M); }

// Title screen: how many heroes are on each server right now. A separate connection listens to every server's
// presence without joining it (it never shows up as a player) and closes when you leave the title screen.
// onCount(serverId, n) gets n = player count, or null when the server cannot be reached.
let peek = null;
export async function peekServers(onCount) {
  if (!mpEnabled() || peek) return;
  const me = peek = { client: null, stopped: false };
  try {
    const lib = await loadLib();
    if (me.stopped) return;
    me.client = lib.createClient(MP_CONFIG.url, MP_CONFIG.key, { auth: { persistSession: false, autoRefreshToken: false } });
    for (const sv of SERVERS) {
      const ch = me.client.channel('aetherheim-' + sv.id.toLowerCase());
      let ok = false;
      const count = () => { if (ok && !me.stopped) onCount(sv.id, Object.keys(ch.presenceState()).length); };
      ch.on('presence', { event: 'sync' }, count).subscribe((st) => {
        if (st === 'SUBSCRIBED') { ok = true; count(); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') { ok = false; if (!me.stopped) onCount(sv.id, null); }
      });
    }
  } catch { if (!me.stopped) for (const sv of SERVERS) onCount(sv.id, null); }
}
export function stopPeek() {
  if (!peek) return;
  peek.stopped = true;
  // a failing teardown must never stop you entering the game
  if (peek.client) try { peek.client.removeAllChannels(); peek.client.realtime?.disconnect(); } catch { /* already closed */ }
  peek = null;
}
