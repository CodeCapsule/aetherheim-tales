// Trading between real players. One player asks, the other accepts, and both get a trade window: each side offers up
// to 18 goods plus Gold, locks the offer when it is final, and confirms once both offers are locked. A chat line inside
// the window talks to the trade partner. Messages travel on the realtime channel ('t' broadcast).
// Goods you offer leave your bag at once and wait in escrow (saved with your game), so they cannot be sold or used
// meanwhile; a cancelled trade, or a reload in the middle of one, gives them back. The player with the smaller session
// id has the final word: it completes the trade once both sides confirmed and tells the other ('done'), so a trade
// happens on both sides or on neither. A side that confirmed can only back out by asking the other first.
import { mp } from './mp.js';
import { ITEMS, SLOTS, SLOT_INFO, WEAPON_ICONS, CLASSES } from './data.js';
import { MATERIALS } from './systems-data.js';
import { RARITY } from './loot.js';
import { cleanEq } from './dz.js';
import { goodName, goodQuality, goodIcon } from './economy.js';
import { ico } from './icons.js';
import { vw, vh } from './touchfit.js';

const TRADE_SLOTS = 18;
const TRADE_RANGE = 25; // to start a trade
const TRADE_KEEP = 60; // a trade is cancelled when you move further apart than this
const REQ_SECS = 30;
const RESEND = 2.5; // seconds between repeats of an unanswered confirmation
const GIVE_UP = 12; // seconds to wait for the other side before backing out on our own

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const tradeId = (v) => (/^[a-z0-9]{6,16}$/.test(v) ? v : null);
const newId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const side = () => ({ goods: [], gold: 0, rev: 0, lock: false, conf: false });

// session state that is not part of the trade itself
const ts = { req: null, sent: new Map(), done: new Map() };

// a good that came over the network (same shape as an auction lot: gear, item or material)
function cleanGood(x, cls) {
  if (!x || typeof x !== 'object') return null;
  if (x.kind === 'gear') { const eq = cleanEq(x.eq, cls); return eq && eq.quality < 5 && !eq.bound ? { kind: 'gear', eq, qty: 1 } : null; }
  const id = str(x.id, 40), qty = num(x.qty, 0, 99999, 0) | 0;
  if (qty < 1) return null;
  if (x.kind === 'item') return has(ITEMS, id) && ITEMS[id].type !== 'quest' ? { kind: 'item', id, qty: Math.min(999, qty) } : null;
  if (x.kind === 'mat') return has(MATERIALS, id) && !MATERIALS[id].notrade ? { kind: 'mat', id, qty } : null;
  return null;
}
const goodsText = (list, gold) => [...list.map((x) => `<span style="color:${RARITY[goodQuality(x)]?.color || '#fff'}">[${esc(goodName(x))}]</span>`), ...(gold ? [`<b>${fmt(gold)}</b> Gold`] : [])].join(', ') || 'nothing';

const T = {
  // ------------------------------------------------------------ escrow
  // goods left in escrow by a page that closed in the middle of a trade go back to the bag
  tradeInit() {
    this.tr = null;
    const E = this.S.tradeEsc;
    if (E && typeof E === 'object' && ((E.goods && E.goods.length) || E.gold > 0)) {
      this.tradeReturn(E);
      this.ui.chat('system', '<b>[Trade]</b> A trade was left unfinished. The goods you offered are back in your bag.');
    }
    this.S.tradeEsc = null;
  },
  tradeReturn(E) {
    const S = this.S;
    for (const x of E.goods || []) {
      if (x.kind === 'mat') { if (has(MATERIALS, x.id)) this.addMat(x.id, x.qty, true); continue; }
      const fits = x.kind === 'gear' ? S.bag.length < this.bagMax() : S.bag.some((b) => b.id === x.id) || S.bag.length < this.bagMax();
      if (x.kind === 'item' && !has(ITEMS, x.id)) continue;
      if (!fits) { S.auc.claims.push({ ...x, note: 'Returned from a trade' }); this.ui.toast('Bag is full — collect the rest at the Auction House', 'warn'); continue; }
      if (x.kind === 'gear') S.bag.push({ eq: x.eq });
      else { const ex = S.bag.find((b) => b.id === x.id); if (ex) ex.qty = Math.min(999, ex.qty + x.qty); else S.bag.push({ id: x.id, qty: x.qty }); }
    }
    S.gold += Math.max(0, E.gold | 0);
    S.tradeEsc = null;
    this.ui.refreshWallet(); this.ui.refreshPanel(); this.ui.refreshSkills();
  },
  tradeKeep() { const me = this.tr.me; this.S.tradeEsc = { goods: me.goods, gold: me.gold }; this.save(); },
  // bag slots needed for what the other side offers
  tradeRoomNeed(goods) {
    const S = this.S, ids = new Set(S.bag.map((b) => b.id));
    let need = 0;
    for (const x of goods) if (x.kind === 'gear' || (x.kind === 'item' && !ids.has(x.id) && !(ITEMS[x.id].type === 'tool' && this.beltWants(x.id)))) need++;
    return Math.max(0, need - (this.bagMax() - S.bag.length));
  },
  // ------------------------------------------------------------ messages
  tradeSend(t, data = {}) {
    if (mp.status !== 'online' || !mp.channel) return;
    mp.channel.send({ type: 'broadcast', event: 't', payload: { i: mp.id, t, ...data } }).catch(() => {});
  },
  tradeLeader() { return !!this.tr && mp.id < this.tr.peer; },
  tradeAway() { return !!(this.dg || this.war || this.trial); },
  tradeDist(key) { const pr = mp.peers.get(key); return pr && pr.info.map === 'world' && pr.net?.w ? Math.hypot(pr.net.x - this.player.pos.x, pr.net.z - this.player.pos.z) : Infinity; },
  // ------------------------------------------------------------ asking
  tradeRequest(key) {
    const pr = mp.peers.get(key);
    if (mp.status !== 'online' || !pr) { this.ui.toast('That player is not online', 'warn'); return; }
    const name = pr.info.name;
    if (this.tr) { this.ui.toast('Finish your current trade first', 'warn'); return; }
    if (this.tradeAway()) { this.ui.toast('You can only trade out in the world', 'warn'); return; }
    if (this.tradeDist(key) > TRADE_RANGE) { this.ui.toast(`Move closer to ${name} to trade (within ${TRADE_RANGE} m)`, 'warn'); return; }
    const last = ts.sent.get(key);
    if (last && Date.now() - last.at < 8000) { this.ui.toast(`You already asked ${name}`, 'warn'); return; }
    const tid = newId(); ts.sent.set(key, { tid, at: Date.now() });
    this.tradeSend('req', { to: key, tid });
    this.ui.toast(`Trade request sent to ${name}`, 'good');
  },
  tradeAnswer(yes) {
    const q = ts.req; ts.req = null; this.ui.askPop('trade-ask', null);
    if (!q) return;
    const pr = mp.peers.get(q.from);
    if (!pr) { this.ui.toast('The trade request is no longer valid', 'warn'); return; }
    if (!yes) { this.tradeSend('dec', { to: q.from, tid: q.tid }); return; }
    if (this.tr) { this.ui.toast('Finish your current trade first', 'warn'); this.tradeSend('busy', { to: q.from, tid: q.tid, why: 'busy' }); return; }
    if (this.tradeAway() || this.tradeDist(q.from) > TRADE_KEEP) { this.ui.toast(`You are too far from ${pr.info.name} to trade`, 'warn'); this.tradeSend('busy', { to: q.from, tid: q.tid, why: 'far' }); return; }
    this.tradeSend('acc', { to: q.from, tid: q.tid });
    this.tradeOpen(q.from, q.tid);
  },
  tradeOpen(key, tid) {
    const pr = mp.peers.get(key); if (!pr) return;
    this.tr = { tid, peer: key, name: pr.info.name, me: side(), them: side(), log: [], t: 0, resendT: 0, backing: 0 };
    this.ui.closePanels(); this.ui.playerMenu && this.ui.playerMenu(null);
    this.ui.chat('system', `<b>[Trade]</b> Trading with <b>${esc(pr.info.name)}</b>.`);
    this.sfx.play('open');
    this.ui.tradeWin(true);
  },
  // ------------------------------------------------------------ building your offer
  tradeBump() {
    const tr = this.tr, me = tr.me;
    me.rev++; me.conf = false; tr.them.conf = false;
    this.tradeSend('off', { to: tr.peer, tid: tr.tid, rev: me.rev, gold: me.gold, goods: me.goods });
    this.tradeKeep();
    this.ui.refreshWallet(); this.ui.refreshSkills(); this.ui.refreshTrade();
  },
  tradeEditable() {
    if (!this.tr) return false;
    if (this.tr.me.lock) { this.ui.toast('Unlock your offer to change it', 'warn'); return false; }
    return true;
  },
  // src: { bag: index } | { mat: id }; mode: 'all' | 'half' | 'one'
  tradePut(src, mode = 'all') {
    if (!this.tradeEditable()) return;
    const S = this.S, G = this.tr.me.goods;
    const take = (n) => (mode === 'one' ? 1 : mode === 'half' ? Math.ceil(n / 2) : n);
    const full = () => { this.ui.toast(`The trade window holds ${TRADE_SLOTS} goods`, 'warn'); };
    if (src.mat) {
      const m = MATERIALS[src.mat]; if (!m || m.notrade) { this.ui.toast('That cannot be traded', 'warn'); return; }
      const have = this.matCount(src.mat); if (!have) return;
      const ex = G.find((x) => x.kind === 'mat' && x.id === src.mat);
      if (!ex && G.length >= TRADE_SLOTS) { full(); return; }
      const n = take(have); this.takeMat(src.mat, n);
      if (ex) ex.qty += n; else G.push({ kind: 'mat', id: src.mat, qty: n });
    } else {
      const b = S.bag[src.bag]; if (!b) return;
      if (b.eq) {
        if (b.eq.lock) { this.ui.toast('Unlock the item first', 'warn'); return; }
        if (this.isBound(b.eq)) { this.ui.toast('Account-bound: Legendary and higher items cannot be traded', 'warn'); return; }
        if (G.length >= TRADE_SLOTS) { full(); return; }
        S.bag.splice(src.bag, 1); G.push({ kind: 'gear', eq: b.eq, qty: 1 });
      } else {
        if (ITEMS[b.id].type === 'quest') { this.ui.toast('Quest items cannot be traded', 'warn'); return; }
        const ex = G.find((x) => x.kind === 'item' && x.id === b.id);
        if (!ex && G.length >= TRADE_SLOTS) { full(); return; }
        const n = take(b.qty); b.qty -= n; if (b.qty <= 0) S.bag.splice(src.bag, 1);
        if (ex) ex.qty += n; else G.push({ kind: 'item', id: b.id, qty: n });
      }
    }
    this.sfx.play('click');
    this.tradeBump();
  },
  tradeTakeBack(i, mode = 'all') {
    if (!this.tradeEditable()) return;
    const S = this.S, G = this.tr.me.goods, x = G[i]; if (!x) return;
    const n = mode === 'one' ? 1 : mode === 'half' ? Math.ceil(x.qty / 2) : x.qty;
    if (x.kind === 'gear' || (x.kind === 'item' && !S.bag.some((b) => b.id === x.id))) {
      if (S.bag.length >= this.bagMax()) { this.ui.toast('Bag is full!', 'warn'); return; }
    }
    if (x.kind === 'gear') S.bag.push({ eq: x.eq });
    else if (x.kind === 'item') { const ex = S.bag.find((b) => b.id === x.id); if (ex) ex.qty = Math.min(999, ex.qty + n); else S.bag.push({ id: x.id, qty: n }); }
    else this.addMat(x.id, n, true);
    x.qty -= n; if (x.kind === 'gear' || x.qty <= 0) G.splice(i, 1);
    this.sfx.play('click');
    this.tradeBump();
  },
  tradeGold(v) {
    if (!this.tradeEditable()) return;
    const S = this.S, me = this.tr.me, n = Math.round(num(v, 0, S.gold + me.gold, 0));
    if (n === me.gold) { this.ui.refreshTrade(); return; }
    S.gold += me.gold - n; me.gold = n;
    this.tradeBump();
  },
  // ------------------------------------------------------------ lock, confirm, cancel
  tradeLock(on) {
    const tr = this.tr; if (!tr || tr.backing) return;
    if (!on && tr.me.conf && !this.tradeLeader()) { this.ui.toast('You confirmed: cancel the trade to back out', 'warn'); return; }
    tr.me.lock = !!on;
    if (!on) { tr.me.conf = false; tr.them.conf = false; }
    this.tradeSend('lock', { to: tr.peer, tid: tr.tid, on: !!on, rev: tr.me.rev });
    this.sfx.play('click'); this.ui.refreshTrade();
  },
  tradeConfirm() {
    const tr = this.tr; if (!tr || tr.backing || tr.me.conf) return;
    if (!tr.me.lock || !tr.them.lock) { this.ui.toast('Both offers must be locked first', 'warn'); return; }
    if (!tr.me.goods.length && !tr.me.gold && !tr.them.goods.length && !tr.them.gold) { this.ui.toast('Both offers are empty', 'warn'); return; }
    const need = this.tradeRoomNeed(tr.them.goods);
    if (need) { this.ui.toast(`Free ${need} more bag slot${need > 1 ? 's' : ''} for this trade`, 'warn'); return; }
    tr.me.conf = true; tr.resendT = RESEND;
    this.tradeSend('conf', { to: tr.peer, tid: tr.tid, mine: tr.me.rev, theirs: tr.them.rev });
    this.sfx.play('click');
    if (tr.them.conf && this.tradeLeader()) this.tradeCommit();
    else this.ui.refreshTrade();
  },
  tradeCancel(why = '') {
    const tr = this.tr; if (!tr || tr.backing) return;
    this.tradeSend('cancel', { to: tr.peer, tid: tr.tid });
    // a confirmed follower waits for the leader: the leader may already have completed the trade
    if (tr.me.conf && !this.tradeLeader()) { tr.backing = GIVE_UP; this.ui.refreshTrade(); return; }
    this.tradeClose(why || 'You cancelled the trade.');
  },
  tradeClose(note) {
    const tr = this.tr; if (!tr) return;
    this.tradeReturn({ goods: tr.me.goods, gold: tr.me.gold });
    this.tr = null;
    if (note) this.ui.chat('system', `<b>[Trade]</b> ${note}`);
    this.ui.tradeWin(false); this.save();
  },
  tradeCommit() {
    const tr = this.tr, S = this.S; if (!tr) return;
    let late = 0;
    for (const x of tr.them.goods) {
      const fits = x.kind === 'gear' ? S.bag.length < this.bagMax() : x.kind === 'item' ? S.bag.some((b) => b.id === x.id) || S.bag.length < this.bagMax() || (ITEMS[x.id].type === 'tool' && this.beltWants(x.id)) : true;
      const good = x.kind === 'gear' ? { ...x, eq: { ...x.eq, uid: S.uid++ } } : x;
      if (!fits) { S.auc.claims.push({ ...good, note: `Traded by ${tr.name}` }); late++; continue; }
      if (good.kind === 'gear') this.addEquip(good.eq); else if (good.kind === 'item') this.addItem(good.id, good.qty); else this.addMat(good.id, good.qty, true);
    }
    S.gold += tr.them.gold;
    ts.done.set(tr.tid, { mine: tr.me.rev, theirs: tr.them.rev, at: Date.now() });
    this.tradeSend('done', { to: tr.peer, tid: tr.tid, mine: tr.me.rev, theirs: tr.them.rev });
    this.ui.chat('system', `<b>[Trade]</b> Trade with <b>${esc(tr.name)}</b> complete. You received ${goodsText(tr.them.goods, tr.them.gold)}; you gave ${goodsText(tr.me.goods, tr.me.gold)}.`);
    if (late) this.ui.toast('Bag is full — collect the rest at the Auction House', 'warn');
    this.ui.toast(`Trade with ${tr.name} complete!`, 'good');
    this.track('trade'); this.sfx.play('quest');
    this.tr = null; S.tradeEsc = null;
    this.ui.tradeWin(false);
    this.ui.refreshWallet(); this.ui.refreshPanel(); this.ui.refreshSkills(); this.save();
  },
  tradeSay(text) {
    const tr = this.tr; text = str(text, 120).trim(); if (!tr || !text) return;
    if (performance.now() - (this.tradeChatT || 0) < 600) return;
    this.tradeChatT = performance.now();
    this.tradeSend('msg', { to: tr.peer, tid: tr.tid, text });
    this.tradeLog(this.S.name, text, true);
  },
  tradeLog(who, text, me) {
    const tr = this.tr; if (!tr) return;
    tr.log.push({ who, text, me }); if (tr.log.length > 30) tr.log.shift();
    this.ui.chat('player', `<span class="muted">(trade)</span> ${esc(text)}`, who);
    this.ui.tradeLogShow();
  },
  // ------------------------------------------------------------ incoming
  tradeMsg(m) {
    if (!m || typeof m !== 'object' || m.to !== mp.id) return;
    const from = str(m.i, 40), pr = mp.peers.get(from), tid = tradeId(m.tid);
    if (!pr || !tid) return;
    const name = pr.info.name, t = m.t, tr = this.tr;
    if (t === 'req') {
      if (tr || (ts.req && ts.req.until > Date.now() && ts.req.from !== from)) { this.tradeSend('busy', { to: from, tid, why: 'busy' }); return; }
      if (this.tradeAway()) { this.tradeSend('busy', { to: from, tid, why: 'away' }); return; }
      ts.req = { from, tid, until: Date.now() + REQ_SECS * 1000 };
      this.ui.askPop('trade-ask', {
        title: 'Trade request', cls: 'trade', secs: REQ_SECS, until: ts.req.until,
        text: `<b>${esc(name)}</b> (Lv ${pr.info.level} ${esc(CLASSES[pr.info.cls]?.name || '')}) wants to trade with you.`,
        yes: () => this.tradeAnswer(true), no: () => this.tradeAnswer(false),
      });
      this.sfx.play('open');
      return;
    }
    if (t === 'acc' || t === 'dec' || t === 'busy') {
      const s = ts.sent.get(from); if (!s || s.tid !== tid) return;
      ts.sent.delete(from);
      if (t === 'acc') { if (!this.tr) this.tradeOpen(from, tid); else this.tradeSend('cancel', { to: from, tid }); }
      else this.ui.toast(t === 'dec' ? `${name} declined the trade` : m.why === 'away' ? `${name} is not out in the world` : m.why === 'far' ? `${name} is too far away to trade` : `${name} is busy right now`, 'warn');
      return;
    }
    // a trade we already completed: the other side missed our 'done'
    const fin = ts.done.get(tid);
    if (fin && (!tr || tr.tid !== tid)) { if (t === 'conf' || t === 'cancel') this.tradeSend('done', { to: from, tid, mine: fin.mine, theirs: fin.theirs }); return; }
    if (!tr || tr.tid !== tid || tr.peer !== from) { if (t === 'cancel') this.tradeSend('cancelled', { to: from, tid }); return; }
    if (t === 'off') {
      if (tr.them.lock && tr.me.conf) return; // a locked offer does not change
      const goods = (Array.isArray(m.goods) ? m.goods : []).slice(0, TRADE_SLOTS).map((x) => cleanGood(x, this.S.cls)).filter(Boolean);
      Object.assign(tr.them, { goods, gold: Math.floor(num(m.gold, 0, 1e10, 0)), rev: num(m.rev, 0, 1e6, 0) | 0, lock: false, conf: false });
      tr.me.conf = false;
      this.ui.refreshTrade();
    } else if (t === 'lock') {
      if (m.on) { if ((num(m.rev, 0, 1e6, -1) | 0) !== tr.them.rev) return; tr.them.lock = true; }
      else { tr.them.lock = false; tr.them.conf = false; tr.me.conf = false; }
      this.ui.refreshTrade();
    } else if (t === 'conf') {
      if (!tr.me.lock || !tr.them.lock || num(m.mine, 0, 1e6, -1) !== tr.them.rev || num(m.theirs, 0, 1e6, -1) !== tr.me.rev) return;
      tr.them.conf = true;
      if (tr.me.conf && this.tradeLeader() && !tr.backing) this.tradeCommit();
      else this.ui.refreshTrade();
    } else if (t === 'done') {
      // the leader completed the trade; it saw the same two offers we confirmed
      if (!this.tradeLeader() && tr.me.conf && num(m.mine, 0, 1e6, -1) === tr.them.rev && num(m.theirs, 0, 1e6, -1) === tr.me.rev) this.tradeCommit();
    } else if (t === 'cancel' || t === 'cancelled') {
      if (t === 'cancel' && this.tradeLeader()) this.tradeSend('cancelled', { to: from, tid });
      this.tradeClose(tr.backing ? 'You cancelled the trade.' : `${esc(name)} cancelled the trade.`);
      if (t === 'cancel') this.ui.toast(`${name} cancelled the trade`, 'warn');
    } else if (t === 'msg') {
      const text = str(m.text, 120).trim(); if (text) this.tradeLog(name, text, false);
    }
  },
  tradePeerGone(key) {
    if (ts.req && ts.req.from === key) { ts.req = null; this.ui.askPop('trade-ask', null); }
    if (this.tr && this.tr.peer === key) { this.tradeClose(`${esc(this.tr.name)} went offline. The trade was cancelled.`); }
  },
  tradeUpdate(dt) {
    if (ts.req && ts.req.until < Date.now()) { this.tradeSend('dec', { to: ts.req.from, tid: ts.req.tid }); ts.req = null; this.ui.askPop('trade-ask', null); }
    const tr = this.tr; if (!tr) return;
    if (tr.backing) { tr.backing -= dt; if (tr.backing <= 0) this.tradeClose(`${esc(tr.name)} did not answer. The trade was cancelled.`); return; }
    if (tr.me.conf && !tr.them.conf) { tr.resendT -= dt; if (tr.resendT <= 0) { tr.resendT = RESEND; this.tradeSend('conf', { to: tr.peer, tid: tr.tid, mine: tr.me.rev, theirs: tr.them.rev }); } }
    tr.t += dt; if (tr.t < 1) return; tr.t = 0;
    for (const [k, v] of ts.done) if (Date.now() - v.at > 120000) ts.done.delete(k);
    if (this.tradeAway()) this.tradeCancel('You left the area. The trade was cancelled.');
    else if (this.tradeDist(tr.peer) > TRADE_KEEP) this.tradeCancel(`You moved too far from ${esc(tr.name)}. The trade was cancelled.`);
  },
};

// ============================================================ UI
const TU = {
  // the window is a regular game panel (same frame, title bar, cells and footer as the Bag); refreshTrade fills it
  tradeWin(open) {
    let el = $('trade-win');
    $('tooltip').hidden = true;
    if (!open) { if (el) el.remove(); return; }
    const g = this.g, tr = g.tr; if (!tr) return;
    if (el) el.remove();
    el = h('div', 'panel frame trade2'); el.id = 'trade-win';
    el.innerHTML = `<div class="ptitle">Trade <small>with ${esc(tr.name)}</small></div><button class="x-close" aria-label="Cancel trade"></button>
      <div class="pbody">
        <div class="tw-banner"></div>
        <div class="tw-body">
          <div class="tw-armor"><div class="tw-lbl">Your armor</div><div class="tw-col"></div></div>
          <div class="tw-main">
            <div class="tw-offers">
              <div class="tw-sec"><span class="tw-who">${esc(tr.name)}</span><span class="tw-tag" data-s="them"></span><span class="tw-gold" data-g="them"></span></div>
              <div class="tw-grid" data-grid="them"></div>
              <div class="tw-sec"><span class="tw-who">You</span><span class="tw-tag" data-s="me"></span><label class="tw-gold">${ico('coin', 'ico inl')}<input type="number" min="0" step="1" inputmode="numeric" aria-label="Gold to offer"></label></div>
              <div class="tw-grid" data-grid="me"></div>
            </div>
            <div class="tw-side">
              <div class="tw-sec"><span class="tw-who">Inventory</span><div class="tabs small tw-move" role="group" aria-label="How much of a stack to move"><button data-m="all">All</button><button data-m="half">Half</button><button data-m="one">1</button></div></div>
              <div class="tw-grid tw-inv" data-grid="inv"></div>
              <div class="tw-log"></div>
              <input class="tw-say" maxlength="120" placeholder="Message ${esc(tr.name)} — Enter to send" aria-label="Message ${esc(tr.name)}">
              <div class="tw-acts"><button class="btn small blue" data-a="lock"></button><button class="btn small green" data-a="conf">Confirm</button><button class="btn small gray" data-a="cancel">Cancel</button></div>
            </div>
          </div>
        </div>
        <div class="bag-foot"><div class="bag-money"><div>${ico('coin', 'ico inl')}Your Gold<b data-w="gold"></b></div></div></div>
      </div>`;
    $('panels').appendChild(el);
    this.tradeMove = this.tradeMove || 'all';
    el.querySelector('.x-close').onclick = () => g.tradeCancel();
    el.querySelector('[data-a="lock"]').onclick = () => g.tradeLock(!g.tr?.me.lock);
    el.querySelector('[data-a="conf"]').onclick = () => g.tradeConfirm();
    el.querySelector('[data-a="cancel"]').onclick = () => g.tradeCancel();
    for (const b of el.querySelectorAll('.tw-move button')) b.onclick = () => { this.tradeMove = b.dataset.m; this.refreshTrade(); };
    const gi = el.querySelector('.tw-gold input');
    gi.onchange = () => g.tradeGold(gi.value);
    gi.onkeydown = (e) => { if (e.key === 'Enter') gi.blur(); };
    const say = el.querySelector('.tw-say');
    say.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); g.tradeSay(say.value); say.value = ''; } };
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    this.refreshTrade();
    this.tradeLogShow();
    // centre once it is filled, then keep it on screen
    el.style.left = (vw() - el.offsetWidth) / 2 + 'px';
    el.style.top = (vh() - el.offsetHeight) / 2 - 10 + 'px';
    this.tradeFit();
    if (!this.tradeOnResize) { this.tradeOnResize = () => this.tradeFit(); addEventListener('resize', this.tradeOnResize); }
    this.dragify(el);
  },
  // keep the window on screen (a phone turned sideways, a smaller window)
  tradeFit() {
    const el = $('trade-win'); if (!el) return;
    const x = parseFloat(el.style.left) || 0, y = parseFloat(el.style.top) || 0;
    el.style.left = Math.max(8, Math.min(x, vw() - el.offsetWidth - 8)) + 'px';
    el.style.top = Math.max(8, Math.min(y, vh() - el.offsetHeight - 8)) + 'px';
  },
  tradeCell(x, onClick, extra = '') {
    const q = goodQuality(x), c = h('button', `cell q${q}${extra}`, `${ico(goodIcon(x))}${x.qty > 1 ? `<span class="cnt">${fmt(x.qty)}</span>` : ''}${x.kind === 'gear' && x.eq.enh ? `<span class="enh">+${x.eq.enh}</span>` : ''}`);
    if (onClick) { c.onclick = () => onClick('click'); c.oncontextmenu = (e) => { e.preventDefault(); onClick('one'); }; }
    this.tip(c, () => (x.kind === 'gear' ? this.equipTip(x.eq) : `<b style="color:${RARITY[q]?.color}">${esc(goodName(x))}</b>${esc((x.kind === 'item' ? ITEMS[x.id]?.desc : MATERIALS[x.id]?.desc) || '')}`));
    return c;
  },
  refreshTrade() {
    const el = $('trade-win'), g = this.g, tr = g.tr; if (!el || !tr) return;
    const S = g.S, me = tr.me, them = tr.them, lead = g.tradeLeader(), mode = this.tradeMove || 'all';
    $('tooltip').hidden = true;
    const both = me.lock && them.lock, who = esc(tr.name);
    const ban = el.querySelector('.tw-banner');
    ban.innerHTML = tr.backing ? `Waiting for ${who} to answer…`
      : !both ? (me.lock ? `Waiting for ${who} to lock` : them.lock ? `${who} locked their offer — lock yours when ready` : 'Add goods, then lock your offer')
        : me.conf && them.conf ? 'Completing the trade…' : me.conf ? `Waiting for ${who} to confirm` : them.conf ? `${who} confirmed — press Confirm to trade` : 'Both offers locked — check them, then Confirm';
    ban.classList.toggle('ready', both);
    const tag = (s) => (s.conf ? ['Confirmed', 'conf'] : s.lock ? ['Locked', 'lock'] : ['Editing', 'edit']);
    for (const [k, s] of [['them', them], ['me', me]]) { const [t, c] = tag(s), e = el.querySelector(`[data-s="${k}"]`); e.textContent = t; e.className = 'tw-tag ' + c; }
    el.querySelector('[data-g="them"]').innerHTML = `${ico('coin', 'ico inl')}<b>${fmt(them.gold)}</b>`;
    el.querySelector('[data-w="gold"]').textContent = fmt(S.gold);
    const gi = el.querySelector('.tw-gold input');
    if (document.activeElement !== gi) gi.value = me.gold;
    gi.disabled = me.lock; gi.max = S.gold + me.gold;
    // the two offers, 2 x 9 each
    const fill = (grid, list, click) => {
      grid.innerHTML = '';
      for (let i = 0; i < TRADE_SLOTS; i++) {
        const x = list[i];
        grid.appendChild(x ? this.tradeCell(x, click ? (how) => click(i, how) : null) : h('div', 'cell empty'));
      }
    };
    fill(el.querySelector('[data-grid="them"]'), them.goods, null);
    fill(el.querySelector('[data-grid="me"]'), me.goods, me.lock ? null : (i, how) => g.tradeTakeBack(i, how === 'one' ? 'one' : mode));
    el.querySelector('[data-grid="me"]').classList.toggle('locked', me.lock);
    el.querySelector('[data-grid="them"]').classList.toggle('locked', them.lock);
    // your inventory: bag first, then tradable materials
    const inv = el.querySelector('[data-grid="inv"]'); inv.innerHTML = '';
    S.bag.forEach((b, i) => {
      const x = b.eq ? { kind: 'gear', eq: b.eq, qty: 1 } : { kind: 'item', id: b.id, qty: b.qty };
      const no = b.eq ? (b.eq.lock ? 'Locked' : g.isBound(b.eq) ? 'Account-bound' : '') : ITEMS[b.id]?.type === 'quest' ? 'Quest item' : '';
      const c = this.tradeCell(x, no || me.lock ? null : (how) => g.tradePut({ bag: i }, how === 'one' ? 'one' : mode), no ? ' no' : '');
      if (no) c.title = `${no}: cannot be traded`;
      inv.appendChild(c);
    });
    for (const id of Object.keys(S.mats)) {
      if (!has(MATERIALS, id) || MATERIALS[id].notrade || !S.mats[id]) continue;
      inv.appendChild(this.tradeCell({ kind: 'mat', id, qty: S.mats[id] }, me.lock ? null : (how) => g.tradePut({ mat: id }, how === 'one' ? 'one' : mode)));
    }
    if (!inv.children.length) inv.appendChild(h('div', 'tw-none muted', 'Your bag is empty.'));
    inv.classList.toggle('locked', me.lock);
    for (const b of el.querySelectorAll('.tw-move button')) b.classList.toggle('sel', b.dataset.m === mode);
    // what you wear (read only)
    const col = el.querySelector('.tw-col'); col.innerHTML = '';
    for (const s of SLOTS) {
      const eq = S.equip[s];
      const c = eq ? this.tradeCell({ kind: 'gear', eq, qty: 1 }, null, ' worn') : h('div', 'cell empty', `<span class="ghost">${ico(s === 'weapon' ? WEAPON_ICONS[S.cls] : SLOT_INFO[s].icon)}</span>`);
      if (!eq) this.tip(c, () => `<b>${SLOT_INFO[s].label}</b>Empty slot`);
      col.appendChild(c);
    }
    const lk = el.querySelector('[data-a="lock"]'), cf = el.querySelector('[data-a="conf"]'), cx = el.querySelector('[data-a="cancel"]');
    lk.textContent = me.lock ? 'Unlock' : 'Lock';
    lk.className = 'btn small ' + (me.lock ? 'gray' : 'blue');
    lk.disabled = !!tr.backing || (me.conf && !lead);
    cf.disabled = !both || me.conf || !!tr.backing;
    cx.disabled = !!tr.backing;
  },
  tradeLogShow() {
    const el = $('trade-win'), tr = this.g.tr; if (!el || !tr) return;
    const log = el.querySelector('.tw-log');
    log.innerHTML = tr.log.length ? tr.log.slice(-6).map((l) => `<p class="${l.me ? 'me' : ''}"><b>${esc(l.who)}:</b> ${esc(l.text)}</p>`).join('') : '<p class="tw-hint">Click a good in your inventory to offer it, and click it in your offer to take it back. Move sets how much of a stack goes.</p>';
    log.scrollTop = log.scrollHeight;
  },
};

export function installTrade(Game) { Object.assign(Game.prototype, T); }
export function installTradeUI(UI) { Object.assign(UI.prototype, TU); }
