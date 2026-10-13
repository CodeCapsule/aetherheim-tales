// Items dropped from the bag onto the ground (the Bag's Drop button, or the Game Master's "Drop on the ground"): every
// player nearby sees them and the first to walk over one takes it. The dropper's browser owns each drop and hands it to
// the first player who reaches it ('d' broadcast: t 'put' lists its drops, sent when they change and every few seconds
// for players who arrive later; 'take' asks for one; 'grant' gives it, with the item; 'gone' takes it off the ground),
// so an item can never be picked up twice. A drop nobody takes goes back to its owner's bag after 5 minutes; the save
// keeps it until then, so leaving the game brings it back too.
import { ITEMS } from './data.js';
import { MATERIALS } from './systems-data.js';
import { RARITY } from './loot.js';
import { cleanEq } from './dz.js';
import { mp } from './mp.js';

const KEEP_MS = 5 * 60e3; // on the ground this long, then back to its owner
const PUT_SECS = 4; // the owner repeats its list this often
const STALE_MS = 20e3; // an owner not heard from for this long: its drops go
const MAX_MINE = 12, MAX_GM = 40; // drops one player can have on the ground at once
const PICK_R = 1.4; // walk this close to pick one up
const GAP = 1.7; // drops land at least this far apart, so you pick up the one you walk to
const ID_RE = /^[a-z0-9]{1,16}-\d{1,9}$/;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
const send = (t, data) => { if (mp.status === 'online' && mp.channel) mp.channel.send({ type: 'broadcast', event: 'd', payload: { i: mp.id, t, ...data } }).catch(() => {}); };
// gear, a bag item or a material: what it looks like on the ground
function dropShow(it) {
  if (it.eq) return { name: it.eq.name, q: it.eq.quality, icon: it.eq.icon, qty: 1, kind: 'e', id: '' };
  const d = ITEMS[it.id] || MATERIALS[it.id];
  return { name: d.name, q: d.quality || 0, icon: d.icon || it.id, qty: it.qty || 1, kind: ITEMS[it.id] ? 'i' : 'm', id: it.id };
}
const label = (s) => s.name + (s.qty > 1 ? ` x${s.qty}` : '');

const D = {
  dropsInit() { this.dropSweepT = 0; this.dropPutT = 0; this.dropN = Date.now() % 1e6; this.dropsLoaded = false; },
  myDrops() { return this.loots.filter((L) => L.net?.mine); },
  // ------------------------------------------------------------ dropping
  // the Bag's Drop button: all of a stack, or qty of it
  bagDrop(i, qty = null) {
    const S = this.S, b = S.bag[i]; if (!b) return false;
    if (this.dg || this.war || this.trial) { this.ui.toast('You can only drop items out in the world', 'warn'); return false; }
    if (b.eq) {
      if (b.eq.lock) { this.ui.toast('Unlock it first', 'warn'); return false; }
      if (!S.gm && this.isBound(b.eq)) { this.ui.toast('Bound items cannot be dropped', 'warn'); return false; }
    } else if (!ITEMS[b.id] || ITEMS[b.id].type === 'quest') { this.ui.toast('Quest items cannot be dropped', 'warn'); return false; }
    if (!this.dropRoom()) return false;
    let item;
    if (b.eq) { item = { eq: b.eq }; S.bag.splice(i, 1); }
    else { const n = Math.max(1, Math.min(b.qty, qty || b.qty)); item = { id: b.id, qty: n }; b.qty -= n; if (b.qty <= 0) S.bag.splice(i, 1); }
    this.groundDrop(item);
    this.ui.refreshPanel(); this.ui.refreshSkills();
    return true;
  },
  dropRoom() {
    if (this.player.dead) return false;
    const max = this.S.gm ? MAX_GM : MAX_MINE;
    if (this.myDrops().length >= max) { this.ui.toast(`You already have ${max} items on the ground`, 'warn'); return false; }
    return true;
  },
  // put an item (already out of the bag) on the ground in front of you
  groundDrop(item) {
    if (this.dg || this.war || this.trial || !this.dropRoom()) return null;
    const S = this.S, p = this.player;
    // in front of you, beside the ones already there
    let x = 0, z = 0;
    spot: for (const r of [1.8, 3.4, 5]) for (const k of [0, 1, -1, 2, -2, 3, -3]) {
      [x, z] = this.world.nearestFree(p.pos.x + Math.sin(p.yaw + k * 0.95 * 1.8 / r) * r, p.pos.z + Math.cos(p.yaw + k * 0.95 * 1.8 / r) * r);
      if (!this.loots.some((L) => L.map === this.world && Math.hypot(L.ground.x - x, L.ground.z - z) < GAP)) break spot;
    }
    const id = `${(mp.id || 'me').slice(0, 16)}-${++this.dropN}`, until = Date.now() + KEEP_MS;
    (S.grounded ||= []).push({ id, item, until });
    const L = this.dropMake({ id, owner: mp.id || 'me', ownerName: S.name, x, z, until, show: dropShow(item), mine: true, item, src: p.pos });
    this.sfx.play('pickup');
    this.dropPutT = 0; this.save();
    return L;
  },
  dropMake({ id, owner, ownerName, x, z, until, show, mine, item = null, src = null }) {
    const L = this.dropLoot(item || { id: '' }, { x, y: this.world.heightAt(x, z), z }, { at: true, quiet: true, map: this.world, src, show: { name: label(show), q: show.q, icon: show.icon }, by: mine ? 'Your drop' : `Dropped by ${ownerName}` });
    L.net = { id, owner, ownerName, mine, until, show, seen: Date.now(), left: false, askT: 0 };
    return L;
  },
  // ------------------------------------------------------------ picking up (game.js updateLoot, when you are near one)
  dropNear(L, d) {
    const n = L.net;
    if (n.mine) { if (!n.left) n.left = d > PICK_R * 1.8; else if (d < PICK_R) this.dropTakeBack(L); return; } // walk away and back to take your own
    if (d >= PICK_R || n.askT > this.time) return;
    n.askT = this.time + 1.5;
    const S = this.S, s = n.show;
    const room = s.kind === 'm' || (s.kind === 'i' && S.bag.some((b) => b.id === s.id)) || S.bag.length < this.bagMax();
    if (!room) { this.ui.toast('Your bag is full', 'warn'); n.askT = this.time + 4; return; }
    if (mp.status !== 'online' || !mp.channel || !mp.peers.has(n.owner)) { this.ui.toast('Its owner left: it is gone', 'warn'); this.removeLoot(L); return; }
    send('take', { id: n.id, to: n.owner });
  },
  dropTakeBack(L) {
    if (!this.dropToBag(L.item)) { L.net.left = false; return; }
    this.dropForget(L);
    send('gone', { id: L.net.id });
    this.sfx.play('pickup'); this.lootMsg(label(L.net.show), RARITY[L.q].color);
    this.ui.refreshPanel(); this.save();
  },
  dropForget(L) { const S = this.S; S.grounded = (S.grounded || []).filter((g) => g.id !== L.net.id); this.removeLoot(L); },
  dropToBag(it) {
    if (it.eq) return this.addEquip(it.eq);
    if (ITEMS[it.id]) return this.addItem(it.id, it.qty || 1);
    if (MATERIALS[it.id]) { this.addMat(it.id, it.qty || 1, true); return true; }
    return true; // nothing we know: nothing to keep
  },
  // ------------------------------------------------------------ per frame
  dropsUpdate(dt) {
    if (!this.dropsLoaded) this.dropsLoad();
    if ((this.dropSweepT -= dt) > 0) return;
    this.dropSweepT = 1; this.dropPutT -= 1;
    const now = Date.now();
    for (const L of this.loots.filter((x) => x.net)) {
      const n = L.net;
      if (n.mine) { if (now > n.until) this.dropExpire(L); }
      else if (now > n.until + 5000 || now - n.seen > STALE_MS) this.removeLoot(L);
    }
    // tell the others where our drops lie
    const mine = this.myDrops();
    if (this.dropPutT <= 0 && (mine.length || this.dropPutWas) && mp.status === 'online' && mp.channel) {
      this.dropPutT = PUT_SECS; this.dropPutWas = mine.length > 0;
      send('put', { l: mine.map((L) => { const s = L.net.show; return [L.net.id, Math.round(L.ground.x * 10) / 10, Math.round(L.ground.z * 10) / 10, Math.max(0, L.net.until - now), s.name, s.q, s.icon, s.qty, s.kind, s.id]; }) });
    }
  },
  // nobody took it: back to the bag (or a minute more on the ground while the bag is full)
  dropExpire(L) {
    if (!this.dropToBag(L.item)) { L.net.until = Date.now() + 60e3; this.ui.toast('Your bag is full: make room to get back what you dropped', 'warn'); return; }
    this.dropForget(L); send('gone', { id: L.net.id });
    this.ui.chat('system', `Nobody took your <span class="it" style="color:${RARITY[L.q].color}">[${esc(label(L.net.show))}]</span>: it is back in your bag.`);
    this.ui.refreshPanel(); this.save();
  },
  // after a reload: what you left on the ground comes back to your bag
  dropsLoad() {
    this.dropsLoaded = true;
    const S = this.S, list = Array.isArray(S.grounded) ? S.grounded : [];
    S.grounded = [];
    let back = 0;
    for (const g of list) {
      if (!g || typeof g !== 'object' || !g.item) continue;
      if (this.dropToBag(g.item)) back++;
      else if (!this.groundDrop(g.item)) S.grounded.push(g); // bag full and no room on the ground: keep it for later
    }
    if (back) this.ui.chat('system', `${back} item${back === 1 ? '' : 's'} you left on the ground ${back === 1 ? 'is' : 'are'} back in your bag.`);
  },
  // ------------------------------------------------------------ network
  dropMsg(m) {
    if (!m || typeof m !== 'object') return;
    const from = str(m.i, 40), pr = mp.peers.get(from); if (!pr) return;
    const id = str(m.id, 40), find = (owner) => this.loots.find((L) => L.net && L.net.id === id && L.net.owner === owner);
    switch (m.t) {
      case 'put': this.dropPut(from, pr, m.l); break;
      case 'take': { // someone reached one of ours: the first one gets it
        if (m.to !== mp.id) return;
        const L = find(mp.id); if (!L || !L.net.mine) return;
        this.dropForget(L);
        send('grant', { id, to: from, item: L.item });
        this.ui.chat('system', `<b>${esc(pr.info.name)}</b> picked up your <span class="it" style="color:${RARITY[L.q].color}">[${esc(label(L.net.show))}]</span>.`);
        this.save();
        break;
      }
      case 'grant': {
        const L = find(from); if (!L) return;
        this.removeLoot(L);
        if (m.to === mp.id) this.dropGot(m.item, pr.info.name);
        break;
      }
      case 'gone': { const L = find(from); if (L) this.removeLoot(L); break; }
    }
  },
  // a player's drops: show the new ones, forget the ones they no longer list
  dropPut(from, pr, list) {
    if (!Array.isArray(list)) return;
    const now = Date.now(), seen = new Set(), away = !!(this.dg || this.war || this.trial);
    for (const row of list.slice(0, MAX_GM)) {
      if (!Array.isArray(row)) continue;
      const id = str(row[0], 40); if (!ID_RE.test(id)) continue;
      seen.add(id);
      const L = this.loots.find((x) => x.net && x.net.id === id && x.net.owner === from);
      if (L) { L.net.seen = now; continue; }
      if (away) continue;
      const kind = ['e', 'i', 'm'].includes(row[8]) ? row[8] : 'e';
      const show = { name: str(row[4], 48) || 'Item', q: num(row[5], 0, 7, 0) | 0, icon: str(row[6], 32), qty: num(row[7], 1, 9999, 1) | 0, kind, id: str(row[9], 32) };
      this.dropMake({ id, owner: from, ownerName: pr.info.name, x: num(row[1], -420, 420, 0), z: num(row[2], -420, 420, 0), until: now + num(row[3], 0, KEEP_MS, 0), show, mine: false });
    }
    for (const L of this.loots.filter((x) => x.net && x.net.owner === from && !seen.has(x.net.id))) this.removeLoot(L);
  },
  // it is ours now (checked like anything that comes over the network)
  dropGot(raw, fromName) {
    const S = this.S;
    let it = null;
    if (raw?.eq) { const eq = cleanEq(raw.eq, S.cls); if (eq) { eq.uid = S.uid++; it = { eq }; } }
    else if (ITEMS[raw?.id] && ITEMS[raw.id].type !== 'quest') it = { id: raw.id, qty: num(raw.qty, 1, 999, 1) | 0 };
    else if (MATERIALS[raw?.id]) it = { id: raw.id, qty: num(raw.qty, 1, 9999, 1) | 0 };
    if (!it) return;
    const s = dropShow(it), color = RARITY[s.q]?.color || '#fff';
    if (!this.dropToBag(it)) { this.groundDrop(it); this.ui.toast('Your bag is full: it stays on the ground', 'warn'); return; }
    this.sfx.play('pickup'); this.fx.buff(this.player, color);
    this.ui.chat('system', `You picked up <span class="it" style="color:${color}">[${esc(label(s))}]</span> dropped by <b>${esc(fromName)}</b>.`);
    this.ui.toast(`Obtained [${label(s)}]`, 'item');
    this.ui.refreshPanel(); this.save();
  },
  // a player left: their drops go from our ground (they get them back in their own game)
  dropsPeerGone(key) { for (const L of this.loots.filter((x) => x.net && x.net.owner === key)) this.removeLoot(L); },
};

export function installDrops(Game) { Object.assign(Game.prototype, D); }
