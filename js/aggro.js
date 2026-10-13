// Shared aggro: whom a monster attacks when several players fight it. Every browser runs its own copy of a monster,
// so all of them pick the same victim from the same numbers: each player's threat on it (the damage they deal, tripled
// for Guardians; a taunt jumps to the top), shared a few times a second (party.js rows for field monsters in a party,
// "w" messages for the world boss, which everyone at the Storm Altar fights together). The highest threat holds the
// monster; another player only takes it by beating that by 10% up close or 30% from range, so the tank keeps the boss
// and the others can hit it from a distance without being attacked. A copy whose victim is another player chases and
// swings at that player's hero; the damage happens in that player's own browser.
// The world boss also shares its health: every hit anyone lands brings it down for everyone, and it falls for all
// at once (each player still earns their own reward for their own damage).
import { mp } from './mp.js';
import { partyMembers } from './party.js';

const THREAT_MULT = { knight: 3, berserker: 1.3 }; // the Guardian is the tank
const KEEP_NEAR = 1.1, KEEP_FAR = 1.3, NEAR = 8; // a challenger needs 110% of the holder's threat up close, 130% from range
const RANGE = 32; // players farther than this from the monster do not count
const FRESH = 12; // seconds a remote player's threat still counts after their last update
const WB_FLUSH = 0.25; // seconds between world-boss messages while fighting
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };

const A = {
  // monsters several players fight together: the world boss, and field monsters while you are in a party
  aggroShared(m) { return !!(m && (m.wb || (m.uid && mp.party.id && mp.status === 'online' && partyMembers().length > 1))); },
  threatAdd(m, dmg) { if (dmg > 0) m.threat = (m.threat || 0) + dmg * (THREAT_MULT[this.S.cls] || 1); },
  threatNote(m, key, th) { if (key && th > 0) (m.rthreat ||= new Map()).set(key, { th, t: this.time }); },
  threatTopRemote(m) { let t = 0; for (const r of m.rthreat?.values() || []) if (this.time - r.t <= FRESH) t = Math.max(t, r.th); return t; },
  // a few times a second: point the monster at whoever holds it
  aggroUpdate(m) {
    if ((m.aggroT || 0) > this.time) return;
    m.aggroT = this.time + 0.3;
    const p = this.player, now = this.time, me = mp.id || 'me';
    if (p.dead) m.threat = 0; // falling wipes your threat
    else if (m.tauntT > now && m.tauntBy === p) m.threat = Math.max(m.threat || 0, this.threatTopRemote(m) * 1.3 + 50); // your taunt puts you on top
    const cand = [];
    if (!p.dead && (m.threat || 0) > 0 && (p.map || this.world) === (m.map || this.world) && flat(p.pos, m.pos) < RANGE) cand.push({ key: me, th: m.threat, e: p });
    for (const [key, r] of m.rthreat || []) {
      if (now - r.t > FRESH) { m.rthreat.delete(key); continue; }
      const e = (this.rplayers || []).find((x) => x.peerId === key && !x.netHidden);
      if (e && !e.dead && e.state !== 'dead' && e.hp > 0 && flat(e.pos, m.pos) < RANGE) cand.push({ key, th: r.th, e }); // a fallen player is out
    }
    if (!cand.length) { m.aggroKey = null; return; } // nobody has hit it yet: the usual rules
    cand.sort((a, b) => b.th - a.th || (a.key < b.key ? -1 : 1));
    let top = cand[0];
    const cur = cand.find((c) => c.key === m.aggroKey);
    if (cur && cur !== top && top.th < cur.th * (flat(top.e.pos, m.pos) <= NEAR ? KEEP_NEAR : KEEP_FAR)) top = cur;
    m.aggroKey = top.key;
    if (m.tauntT > now && m.tauntBy && m.tauntBy !== p && !m.tauntBy.dead) return; // held by one of your summons (only here)
    if (m.target !== top.e) { m.target = top.e; m.returning = false; m.pull = null; }
  },
  // who it is after, for the target frame
  aggroName(m) {
    if (!m?.aggroKey) return null;
    if (m.aggroKey === (mp.id || 'me')) return 'You';
    return mp.peers.get(m.aggroKey)?.info.name || null;
  },
  // ------------------------------------------------------------ the world boss, fought together
  wbNetUpdate(dt) {
    const W = this.wb;
    if (!W || !this.wbNetDirty || mp.status !== 'online' || !mp.channel || !mp.peers.size) return;
    this.wbNetT = (this.wbNetT || 0) - dt;
    if (this.wbNetT > 0) return;
    this.wbNetT = WB_FLUSH; this.wbNetDirty = false;
    this.wbNetSend(0);
  },
  wbNetSend(kill) {
    const W = this.wb; if (!W || mp.status !== 'online' || !mp.channel) return;
    const e = W.e;
    mp.channel.send({ type: 'broadcast', event: 'w', payload: { i: mp.id, s: W.slot, f: kill ? 0 : Math.round(Math.max(0, e.hp / e.maxHp) * 1e4) / 1e4, th: Math.round(e.threat || 0), k: kill ? 1 : 0 } }).catch(() => {});
  },
  wbNetMsg(m) {
    const W = this.wb; if (!W || !m || typeof m !== 'object' || (m.s | 0) !== W.slot) return;
    const key = String(m.i ?? '').slice(0, 40); if (!mp.peers.has(key)) return;
    const e = W.e; if (e.dead || e.removed) return;
    this.threatNote(e, key, num(m.th, 0, 1e15, 0));
    const f = num(m.f, 0, 1, 1);
    if (m.k || f <= 0) {
      // it fell on their screen: it falls here too, and you are rewarded for your own damage
      if (!(W.dmg > 0)) e.tagged = false;
      this.wbRemoteKill = true; this.killMonster(e); this.wbRemoteKill = false;
      return;
    }
    e.hp = Math.min(e.hp, Math.max(1, Math.ceil(f * e.maxHp)));
  },
};

export function installAggro(Game) { Object.assign(Game.prototype, A); }
