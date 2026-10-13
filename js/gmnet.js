// Game Master monsters everyone sees. The GM's browser lists the monsters it spawned ('g' broadcast, t: 'mobs', sent
// when the list changes and every few seconds for players who arrive later); every other browser makes its own copy of
// each, and all copies share health, threat and the kill (t: 'hit' rows, like the party's shared monsters): a hit
// anyone lands brings it down for everyone, the player holding threat keeps it (aggro.js), and it falls for all at once
// (each player who hit it earns their own reward). The copies go away when the GM removes them, goes quiet or leaves.
import { MONSTERS } from './data.js';
import { MAX_LEVEL } from './data-world.js';
import { mp } from './mp.js';

const LIST_SECS = 4; // the GM repeats its list this often
const STALE_MS = 20e3; // a GM not heard from for this long: its monsters go
const FLUSH = 0.2; // seconds between hit messages (hits in between are merged, one row per monster)
const ROWS = 60;
const DEAD_MS = 90e3; // a monster that fell is not made again from an older list
const ID_RE = /^[a-z0-9]{1,16}-\d{1,6}$/;
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// monsters a GM may spawn (not guild war units, structures or trial monsters)
export const gmMobOk = (d) => !!d && !d.war && !d.structure && !d.trial && !!d.name;
const send = (t, data) => { if (mp.status === 'online' && mp.channel) mp.channel.send({ type: 'broadcast', event: 'g', payload: { i: mp.id, t, ...data } }).catch(() => {}); };

const N = {
  gmNetInit() { this.gmMobMap = new Map(); this.gmHits = new Map(); this.gmHeard = new Map(); this.gmDead = new Map(); this.gmHitT = 0; this.gmListT = 0; this.gmSweepT = 0; this.gmMobN = 0; },
  gmMe() { return mp.id || 'me'; },
  // a monster the GM just spawned (gm.js): it joins the GM's list
  gmMobAdd(e, o = {}) {
    e.gmId = `${this.gmMe().slice(0, 16)}-${++this.gmMobN}`; e.gmOwner = this.gmMe(); e.gmFlags = (o.harmless ? 1 : 0) | (o.still ? 2 : 0);
    this.gmMobTag(e); this.gmMobMap.set(e.gmId, e); this.gmListDirty = true;
  },
  gmMobTag(e) { const n = e.np?.querySelector('.n'); if (n && !n.querySelector('.gmtag')) n.insertAdjacentHTML('afterbegin', '<span class="gmtag">GM</span>'); },
  // one of our hits landed (game.js damage) / we killed it (game.js killMonster)
  gmMobHit(e) { if (e.gmId && !this.gmHits.get(e.gmId)?.[3]) this.gmHits.set(e.gmId, [e.gmId, Math.round(Math.max(0, e.hp / e.maxHp) * 1e4) / 1e4, Math.round(e.threat || 0), 0]); },
  gmMobKill(e) { if (!e.gmId || this.gmNetKill) return; this.gmDead.set(e.gmId, Date.now()); this.gmHits.set(e.gmId, [e.gmId, 0, Math.round(e.threat || 0), 1]); this.gmHitT = 0; this.gmListDirty = !!this.S.gm; }, // the kill goes out before the list without it
  gmMobDrop(e) { if (!e.removed) { this.fx.spawnPuff(e.pos, 0xffd36b); this.removeEnt(e); } this.gmMobMap.delete(e.gmId); },
  // ------------------------------------------------------------ per frame (from mp.js)
  gmNetUpdate(dt) {
    if (!this.gmMobMap) return;
    if ((this.gmSweepT -= dt) <= 0) {
      this.gmSweepT = 1;
      const now = Date.now(), me = this.gmMe();
      for (const [id, e] of this.gmMobMap) {
        if (e.removed) { this.gmMobMap.delete(id); continue; }
        if (e.gmOwner !== me && !e.dead && now - (this.gmHeard.get(e.gmOwner) || 0) > STALE_MS) this.gmMobDrop(e);
      }
      for (const [id, t] of this.gmDead) if (now - t > DEAD_MS) this.gmDead.delete(id);
    }
    if (mp.status !== 'online' || !mp.channel) { this.gmHits.clear(); return; }
    if (this.gmHits.size && (this.gmHitT -= dt) <= 0) {
      this.gmHitT = FLUSH;
      send('hit', { h: [...this.gmHits.values()].slice(0, ROWS) });
      this.gmHits.clear();
    }
    // the GM: where its monsters are and how hurt they are
    if (this.S.gm) {
      this.gmListT -= dt;
      const mine = [...this.gmMobMap.values()].filter((e) => e.gmOwner === this.gmMe() && !e.dead && !e.removed);
      if (this.gmListDirty || (this.gmListT <= 0 && (mine.length || this.gmListWas))) {
        this.gmListT = LIST_SECS; this.gmListDirty = false; this.gmListWas = mine.length > 0;
        send('mobs', { l: mine.slice(0, ROWS).map((e) => [e.gmId, e.type, e.level, Math.round(e.pos.x * 10) / 10, Math.round(e.pos.z * 10) / 10, e.gmFlags || 0, Math.round(Math.max(0, e.hp / e.maxHp) * 1e4) / 1e4]) });
      }
    }
  },
  // ------------------------------------------------------------ network
  gmNetMsg(m) {
    if (!m || typeof m !== 'object' || !this.gmMobMap) return;
    const from = str(m.i, 40), pr = mp.peers.get(from); if (!pr) return;
    if (m.t === 'mobs') this.gmMobList(from, pr, m.l);
    else if (m.t === 'hit') this.gmMobRows(from, m.h);
  },
  // a GM's monsters: make the ones we do not have, follow the ones we do, remove the ones it no longer lists
  gmMobList(from, pr, list) {
    if (!pr.info.gm || !Array.isArray(list)) return;
    this.gmHeard.set(from, Date.now());
    const away = !!(this.dg || this.war || this.trial), seen = new Set();
    for (const row of list.slice(0, ROWS)) {
      if (!Array.isArray(row)) continue;
      const id = str(row[0], 40), d = MONSTERS[row[1]];
      if (!ID_RE.test(id) || !gmMobOk(d)) continue;
      seen.add(id);
      const L = num(row[2], 1, MAX_LEVEL + 10, 1) | 0, x = num(row[3], -420, 420, 0), z = num(row[4], -420, 420, 0), fl = num(row[5], 0, 3, 0) | 0, f = num(row[6], 0, 1, 1);
      const e = this.gmMobMap.get(id);
      if (e && !e.removed) {
        if (e.gmOwner !== from || e.dead) continue;
        e.hp = Math.min(e.hp, Math.max(1, Math.ceil(f * e.maxHp)));
        if (!e.target && !e.returning && flat(e.pos, { x, z }) > 4) e.pull = { x, z, fx: null, fz: null }; // nobody fights it here: it goes where the GM sees it
        continue;
      }
      if (away || f <= 0 || this.gmDead.has(id)) continue;
      const n = this.gmMobMake(row[1], L, x, z, fl, id, from);
      n.hp = Math.max(1, Math.ceil(f * n.maxHp));
    }
    for (const e of [...this.gmMobMap.values()]) if (e.gmOwner === from && !seen.has(e.gmId) && !e.dead && !e.removed) this.gmMobDrop(e);
  },
  gmMobMake(type, L, x, z, fl, id, owner) {
    [x, z] = this.world.nearestFree(x, z);
    const e = this.createMonster({ type, x, z, r: 0, lvl: [L, L] }, { exact: true, summoned: true, map: this.world });
    e.gmId = id; e.gmOwner = owner; e.gmFlags = fl;
    if (fl & 1) e.atk = 0; // harmless
    if (fl & 2) e.wanderT = 1e9; // stays in place
    this.gmMobTag(e); this.gmMobMap.set(id, e);
    this.fx.spawnPuff(e.pos, 0xffd36b);
    return e;
  },
  // someone's hits and kills
  gmMobRows(from, rows) {
    if (!Array.isArray(rows)) return;
    for (const row of rows.slice(0, ROWS)) {
      if (!Array.isArray(row)) continue;
      const e = this.gmMobMap.get(str(row[0], 40)); if (!e || e.removed || e.dead) continue;
      this.threatNote(e, from, num(row[2], 0, 1e15, 0));
      if (row[3] || num(row[1], 0, 1, 1) <= 0) {
        // it fell on their screen: it falls here too (with your reward if you hit it)
        this.gmDead.set(e.gmId, Date.now());
        this.gmNetKill = true; try { this.killMonster(e); } finally { this.gmNetKill = false; }
        if (this.S.gm) this.gmListDirty = true;
        continue;
      }
      e.hp = Math.min(e.hp, Math.max(1, Math.ceil(num(row[1], 0, 1, 1) * e.maxHp)));
    }
  },
  // a player left: a GM's monsters leave with it
  gmNetPeerGone(key) {
    if (!this.gmMobMap) return;
    this.gmHeard.delete(key);
    for (const e of [...this.gmMobMap.values()]) if (e.gmOwner === key && !e.dead) this.gmMobDrop(e);
  },
};

export function installGmNet(Game) { Object.assign(Game.prototype, N); }
