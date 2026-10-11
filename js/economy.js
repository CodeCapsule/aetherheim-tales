// Economy mixed into Game: bag expansion and bulk selling, NPC shops, the Auction House (real-time lots with bidding,
// buyout and rival bidders) and direct trade windows with other adventurers. installEconomy(Game) adds the methods.
import { ITEMS, PETS, MOUNTS, BOT_NAMES, DUNGEONS } from './data.js';
import { BAG_BASE, BAG_MAX, BAG_STEP, SHOPS, AUCTION, COSTUMES, RELIC_SETS, MAX_LEVEL, GATHER } from './data-world.js';
import { MATERIALS, EXTRA_NAMES, GEMS, gemId, SOULS, soulId } from './systems-data.js';
import { RARITY, sellPrice } from './loot.js';

const fmt = (n) => Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const NAMES = () => [...BOT_NAMES, ...EXTRA_NAMES];
const dgLv = (id) => DUNGEONS.find((d) => d.id === id)?.lv || 1;

// shop entry: [ref, qty, price, minLevel?, farmingLevel?]; ref prefixes m: material, p: pet, r: mount, c: costume
export function shopEntry(e) {
  const [ref, qty, price, minLv = 1, farmLv = 0] = e;
  const kind = ref[1] === ':' ? { m: 'mat', p: 'pet', r: 'mount', c: 'costume' }[ref[0]] : 'item';
  const id = ref[1] === ':' ? ref.slice(2) : ref;
  const name = kind === 'mat' ? MATERIALS[id]?.name : kind === 'pet' ? PETS.find((p) => p.id === id)?.name : kind === 'mount' ? MOUNTS.find((m) => m.id === id)?.name : kind === 'costume' ? COSTUMES.find((c) => c.id === id)?.name : ITEMS[id]?.name;
  const quality = kind === 'mat' ? MATERIALS[id]?.quality : kind === 'item' ? ITEMS[id]?.quality : kind === 'pet' ? [1, 2, 3, 5][PETS.find((p) => p.id === id)?.rarity || 0] : 4;
  return { ref, kind, id, qty, price, minLv, farmLv, name: name || id, quality: quality || 0 };
}
// a lot / trade good: { kind: 'gear' | 'mat' | 'item', eq?, id?, qty }
export const goodName = (L) => (L.kind === 'gear' ? L.eq.name : `${L.kind === 'item' ? ITEMS[L.id]?.name : MATERIALS[L.id]?.name}${L.qty > 1 ? ` x${L.qty}` : ''}`);
export const goodQuality = (L) => (L.kind === 'gear' ? L.eq.quality : L.kind === 'item' ? ITEMS[L.id]?.quality || 0 : MATERIALS[L.id]?.quality || 0);
export const goodIcon = (L) => (L.kind === 'gear' ? L.eq.icon : L.kind === 'item' ? L.id : MATERIALS[L.id]?.icon || L.id);

export function initEconomySave(S) {
  S.bagMax = clamp(S.bagMax || BAG_BASE, BAG_BASE, BAG_MAX);
  S.auc = S.auc || { lots: [], mine: [], claims: [], next: 1, won: 0, sold: 0 };
  S.trades = S.trades || 0;
  return S;
}

const E = {
  initEconomy() {
    initEconomySave(this.S);
    this.trade = null; this.ecoT = 0;
    this.aucTick(true);
  },
  updateEconomy(dt) {
    this.ecoT -= dt;
    if (this.ecoT > 0) return;
    this.ecoT = 1;
    this.aucTick();
  },

  // ============================================================ bag
  bagMax() { return clamp(this.S.bagMax || BAG_BASE, BAG_BASE, BAG_MAX); },
  bagExpandCost() { const n = (this.bagMax() - BAG_BASE) / BAG_STEP; return { gold: 15000 * (n + 1), diamonds: 60 + n * 20 }; },
  // fromScroll: consume a Bag Expansion Scroll; pay: 'gold' | 'diamonds'
  expandBag(fromScroll = false, pay = null) {
    const S = this.S;
    if (this.bagMax() >= BAG_MAX) { this.ui.toast(`Your bag is already at the maximum ${BAG_MAX} slots`, 'warn'); return false; }
    if (fromScroll) { if (this.countItem('bag_scroll') < 1) { this.ui.toast('No Bag Expansion Scroll', 'warn'); return false; } this.removeItem('bag_scroll', 1); }
    else if (pay) { const c = this.bagExpandCost(); if (!this.pay({ [pay]: c[pay] })) return false; }
    else return false;
    S.bagMax = this.bagMax() + BAG_STEP;
    this.sfx.play('level'); this.fx.buff(this.player, '#ffd84a');
    this.ui.toast(`Bag expanded to ${S.bagMax} slots!`, 'good');
    this.ui.refreshPanel(); this.save();
    return true;
  },
  // Sell-all filter: { maxQ: highest gear rarity to sell, gear, items, mats }
  sellAllPlan(o) {
    const S = this.S, bag = [], mats = []; let gold = 0;
    S.bag.forEach((b, i) => {
      if (b.eq) {
        if (!o.gear || b.eq.lock || b.eq.quality > o.maxQ) return;
        gold += sellPrice(b.eq); bag.push(i);
      } else {
        const it = ITEMS[b.id];
        if (!o.items || !it || it.type === 'quest' || it.type === 'egg' || (it.quality || 0) > Math.max(1, o.maxQ) || b.id === 'crimson_core' || b.id === 'bag_scroll') return;
        gold += Math.round((it.price || 10) * 0.3) * b.qty; bag.push(i);
      }
    });
    if (o.mats) for (const [id, n] of Object.entries(S.mats)) {
      const m = MATERIALS[id];
      if (!m || m.notrade || m.relic || m.gem || n <= 0 || m.quality > Math.min(2, o.maxQ)) continue;
      gold += Math.round(m.price * 0.3) * n; mats.push([id, n]);
    }
    return { bag, mats, gold, count: bag.length + mats.length };
  },
  sellAll(o) {
    const S = this.S, plan = this.sellAllPlan(o);
    if (!plan.count) { this.ui.toast('Nothing matches — locked and higher-rarity items are kept', 'warn'); return 0; }
    for (const i of [...plan.bag].sort((a, b) => b - a)) S.bag.splice(i, 1);
    for (const [id, n] of plan.mats) this.takeMat(id, n);
    S.gold += plan.gold;
    this.sfx.play('coin'); this.ui.sel.bagIdx = null;
    this.ui.toast(`Sold ${plan.count} item${plan.count > 1 ? 's' : ''} for ${fmt(plan.gold)} Gold`, 'good');
    this.ui.chat('system', `Sold <b>${plan.count}</b> items for <b>${fmt(plan.gold)}</b> Gold.`);
    this.ui.refreshWallet(); this.ui.refreshPanel(); this.ui.refreshSkills(); this.save();
    return plan.gold;
  },
  toggleLock(i) { const b = this.S.bag[i]; if (!b || !b.eq) return; b.eq.lock = !b.eq.lock; this.ui.toast(b.eq.lock ? 'Locked: Sell All will skip it' : 'Unlocked', 'good'); this.ui.refreshPanel(); },

  // ============================================================ NPC shops
  openShop(key) { if (!SHOPS[key]) return; this.ui.sel.shop = key; this.ui.closeDialog(); this.ui.togglePanel('shop', true); },
  shopOwned(x) {
    const S = this.S;
    return x.kind === 'pet' ? !!S.pets[x.id] : x.kind === 'mount' ? S.mounts.includes(x.id) : x.kind === 'costume' ? (S.costumes || []).includes(x.id) : false;
  },
  buyShop(key, i, times = 1) {
    const S = this.S, x = shopEntry(SHOPS[key].items[i]);
    times = x.kind === 'item' || x.kind === 'mat' ? clamp(times | 0, 1, 99) : 1;
    if (S.level < x.minLv) { this.ui.toast(`Requires Lv ${x.minLv}`, 'warn'); return; }
    if (x.farmLv && this.profLv('farming') < x.farmLv) { this.ui.toast(`Requires Farming Lv ${x.farmLv}`, 'warn'); return; }
    if (this.shopOwned(x)) { this.ui.toast('You already own that', 'warn'); return; }
    if (x.kind === 'item' && !this.bagRoomFor(x.id)) return;
    const cost = { gold: (x.price.gold || 0) * times, diamonds: (x.price.diamonds || 0) * times };
    if (!this.pay(cost)) return;
    if (x.kind === 'item') this.addItem(x.id, x.qty * times);
    else if (x.kind === 'mat') this.addMat(x.id, x.qty * times, true);
    else if (x.kind === 'pet') this.gainPet(x.id, false);
    else if (x.kind === 'mount') this.gainMount(x.id, false);
    else if (x.kind === 'costume') this.gainCostume(x.id);
    this.track('shop');
    this.sfx.play('coin');
    this.ui.toast(`Bought ${x.name}${x.qty * times > 1 ? ` x${x.qty * times}` : ''}`, 'good');
    this.ui.refreshWallet(); this.ui.refreshPanel(); this.save();
  },
  // extra dialog buttons for the service NPCs
  serviceButtons(d) {
    const ui = this.ui, out = [];
    const shop = (k, label) => out.push({ label, cls: 'blue', fn: () => this.openShop(k) });
    const panel = (name, label, sel = {}) => out.push({ label, cls: 'blue', fn: () => { Object.assign(ui.sel, sel); ui.closeDialog(); ui.togglePanel(name, true); } });
    const s = d.service || '';
    if (s.startsWith('shop:')) shop(s.slice(5), 'Browse Wares');
    if (s === 'farm') { shop('farm', 'Seed Shop'); panel('life', 'My Farm', { lifeTab: 'farm' }); }
    if (s === 'alchemy') { shop('alchemy', 'Apothecary'); panel('life', 'Brew Potions', { lifeTab: 'alchemy' }); }
    if (s === 'tailor') { shop('tailor', 'Boutique'); panel('wardrobe', 'Wardrobe'); }
    if (s === 'auction') panel('auction', 'Auction House', { aucTab: 'browse' });
    if (s === 'collector') { shop('collector', 'Curio Shop'); panel('collect', 'Relic Collection'); }
    if (s === 'pets') shop('pets', 'Pet Shop');
    if (s === 'mounts') shop('stable', 'Stable Shop');
    if (s === 'enhance') { panel('life', 'Smithing', { lifeTab: 'smithing' }); panel('life', 'Crimson Forge', { lifeTab: 'red' }); }
    if (s === 'market') panel('auction', 'Auction House', { aucTab: 'browse' });
    return out;
  },

  // ============================================================ auction house
  goodValue(L) {
    if (L.kind === 'gear') return this.mkPrice('gear', null, L.eq);
    return this.mkPrice(L.kind, L.id, null, L.qty);
  },
  aucNewLot() {
    const S = this.S, lv = S.level, t = Math.min(4, Math.floor(lv / 42)), r = Math.random();
    let L;
    if (r < 0.4) {
      const q = Math.random() < 0.08 ? 5 : Math.random() < 0.3 ? 4 : Math.random() < 0.55 ? 3 : 2;
      L = { kind: 'gear', eq: this.makeEquip(null, clamp(lv + Math.round(rnd(-3, 3)), 1, MAX_LEVEL), q), qty: 1 };
    } else if (r < 0.6) L = { kind: 'mat', id: pick([GATHER.ore, GATHER.herb, GATHER.tree]).mats[clamp(t + (Math.random() < 0.3 ? 1 : 0), 0, 4)], qty: Math.round(rnd(5, 20)) };
    else if (r < 0.7) L = { kind: 'mat', id: pick(['star_essence', 'spirit_shard', 'spirit_shard']), qty: Math.round(rnd(1, 5)) };
    else if (r < 0.77) L = { kind: 'mat', id: gemId(pick(Object.keys(GEMS)), Math.random() < 0.1 ? 4 : Math.random() < 0.3 ? 3 : 2), qty: 1 };
    else if (r < 0.85) {
      const sets = Object.entries(RELIC_SETS).filter(([dg]) => dgLv(dg) <= lv + 10);
      const [, set] = pick(sets.length ? sets : Object.entries(RELIC_SETS).slice(0, 1));
      L = { kind: 'mat', id: pick(set.ids), qty: 1 };
    } else if (r < 0.89) L = { kind: 'item', id: 'crimson_core', qty: 1 };
    else if (r < 0.91) L = { kind: 'mat', id: soulId(pick(Object.keys(SOULS))), qty: 1 };
    else if (r < 0.94) L = { kind: 'mat', id: lv >= 130 ? 'enh_stone3' : lv >= 60 ? 'enh_stone2' : 'enh_stone', qty: Math.round(rnd(2, 6)) };
    else if (r < 0.95) L = { kind: 'item', id: pick(['socket_drill', 'enh_protect', 'enh_luck']), qty: 1 };
    else L = { kind: 'item', id: pick(['costume_box', 'bag_scroll', 'elixir_wisdom', 'elixir_fortune', 'elixir_might', 'pet_egg', 'phoenix_draught']), qty: 1 };
    const fair = this.goodValue(L);
    Object.assign(L, {
      aid: 'a' + S.auc.next++, seller: pick(NAMES()), start: Math.max(10, Math.round(fair * rnd(0.4, 0.75))), bid: 0, bidder: null, bids: 0,
      buyout: Math.random() < 0.75 ? Math.round(fair * rnd(1.25, 1.75)) : 0, cap: Math.round(fair * rnd(0.85, 1.35)),
      ends: Date.now() + pick(AUCTION.durations) * 60000 * rnd(0.25, 1),
    });
    return L;
  },
  aucMinBid(L) { return L.bidder ? Math.ceil(L.bid * (1 + AUCTION.minStep)) : L.start; },
  aucTick(first = false) {
    const S = this.S, A = S.auc, now = Date.now();
    let changed = false;
    // rival bidders on the board and on your own lots
    for (const L of [...A.lots, ...A.mine]) {
      if (L.ends <= now) continue;
      const left = (L.ends - now) / 1000, next = this.aucMinBid(L);
      if (L.buyout && L.cap >= L.buyout && L.mineLot && Math.random() < 1 / 90) { this.aucRivalBid(L, L.buyout, true); changed = true; continue; }
      if (next > L.cap || first) continue;
      const rate = left < 45 ? 1 / 5 : left < 180 ? 1 / 20 : 1 / 60;
      if (L.bidder !== 'me' && L.bidder && Math.random() > 0.35) continue; // rivals rarely outbid each other
      if (Math.random() < rate) { this.aucRivalBid(L, Math.min(L.cap, Math.round(next * rnd(1, 1.12)))); changed = true; }
    }
    // closings
    for (const L of [...A.lots]) {
      if (L.ends > now) continue;
      A.lots.splice(A.lots.indexOf(L), 1); changed = true;
      if (L.bidder === 'me') {
        A.claims.push({ ...this.goodOf(L), note: `Won for ${fmt(L.bid)} Gold` }); A.won++;
        this.ui.toast(`Auction won: ${goodName(L)}! Collect it at the Auction House`, 'good');
        this.ui.chat('system', `<b>[Auction]</b> You won <span class="it" style="color:${RARITY[goodQuality(L)].color}">[${esc(goodName(L))}]</span> for <b>${fmt(L.bid)}</b> Gold. Collect it from the Auction House.`);
        this.track('trade'); this.sfx.play('quest');
      }
    }
    for (const L of [...A.mine]) {
      if (L.ends > now) continue;
      A.mine.splice(A.mine.indexOf(L), 1); changed = true;
      if (L.bidder) {
        const net = Math.round(L.bid * (1 - AUCTION.fee));
        A.claims.push({ kind: 'gold', gold: net, note: `${goodName(L)} sold to ${L.bidder}` }); A.sold++;
        this.ui.toast(`Auction: ${goodName(L)} sold for ${fmt(L.bid)} Gold`, 'good');
        this.ui.chat('system', `<b>[Auction]</b> ${esc(L.bidder)} won your ${esc(goodName(L))} for <b>${fmt(L.bid)}</b> Gold (after the ${Math.round(AUCTION.fee * 100)}% fee: ${fmt(net)}). Collect it from the Auction House.`);
        this.track('trade'); this.track('marketGold', net); this.sfx.play('coin');
      } else {
        A.claims.push({ ...this.goodOf(L), note: 'Returned unsold' });
        this.ui.chat('system', `<b>[Auction]</b> Nobody bid on your ${esc(goodName(L))}; it is waiting for you at the Auction House.`);
      }
    }
    while (A.lots.length < AUCTION.active) { A.lots.push(this.aucNewLot()); changed = true; }
    if (changed) {
      if (this.ui.panelName === 'auction') this.ui.softRefresh();
      this.ui.refreshActs && this.ui.acts && this.ui.refreshActs();
    }
  },
  goodOf(L) { return L.kind === 'gear' ? { kind: 'gear', eq: L.eq, qty: 1 } : { kind: L.kind, id: L.id, qty: L.qty }; },
  aucRivalBid(L, amount, buyout = false) {
    const S = this.S;
    if (L.bidder === 'me') {
      S.gold += L.bid; this.ui.refreshWallet();
      this.ui.toast(`Outbid on ${goodName(L)} — ${fmt(L.bid)} Gold refunded`, 'warn');
      this.ui.chat('system', `<b>[Auction]</b> You were outbid on <b>${esc(goodName(L))}</b> (${fmt(amount)} Gold). Your ${fmt(L.bid)} Gold was refunded.`);
    }
    L.bid = amount; L.bidder = pick(NAMES().filter((n) => n !== L.seller && n !== S.name)); L.bids++;
    if (buyout) L.ends = Date.now();
  },
  aucBid(aid, amount) {
    const S = this.S, L = S.auc.lots.find((x) => x.aid === aid);
    if (!L || L.ends <= Date.now()) { this.ui.toast('That auction has ended', 'warn'); return false; }
    amount = Math.round(amount);
    const min = L.bidder === 'me' ? Math.ceil(L.bid * (1 + AUCTION.minStep)) : this.aucMinBid(L);
    if (!(amount >= min)) { this.ui.toast(`Minimum bid is ${fmt(min)} Gold`, 'warn'); return false; }
    if (L.buyout && amount >= L.buyout) return this.aucBuyout(aid);
    const due = amount - (L.bidder === 'me' ? L.bid : 0);
    if (!this.pay({ gold: due })) return false;
    L.bid = amount; L.bidder = 'me'; L.bids++;
    if (L.ends - Date.now() < 30000) L.ends = Date.now() + 30000; // anti-snipe
    this.sfx.play('coin');
    this.ui.toast(`You bid ${fmt(amount)} Gold on ${goodName(L)}`, 'good');
    this.ui.refreshPanel(); this.save();
    return true;
  },
  aucBuyout(aid) {
    const S = this.S, A = S.auc, L = A.lots.find((x) => x.aid === aid);
    if (!L || !L.buyout || L.ends <= Date.now()) return false;
    const due = L.buyout - (L.bidder === 'me' ? L.bid : 0);
    if (!this.pay({ gold: due })) return false;
    A.lots.splice(A.lots.indexOf(L), 1); A.won++;
    A.claims.push({ ...this.goodOf(L), note: `Bought out for ${fmt(L.buyout)} Gold` });
    this.track('trade');
    this.sfx.play('quest');
    this.ui.toast(`Bought ${goodName(L)}!`, 'good');
    this.collectClaims(true);
    this.aucTick();
    this.ui.refreshPanel(); this.save();
    return true;
  },
  // src: { bag: index } | { mat: id }
  aucList(src, qty, start, buyout, mins) {
    const S = this.S, A = S.auc;
    if (A.mine.length >= AUCTION.maxMine) { this.ui.toast(`You can run ${AUCTION.maxMine} auctions at once`, 'warn'); return false; }
    start = Math.max(1, Math.round(start)); buyout = Math.max(0, Math.round(buyout || 0));
    if (buyout && buyout <= start) { this.ui.toast('Buyout must be higher than the starting bid', 'warn'); return false; }
    const deposit = Math.round(10 + start * 0.01);
    if (S.gold < deposit) { this.ui.toast(`The listing deposit is ${fmt(deposit)} Gold`, 'warn'); return false; }
    let L;
    if (src.mat) {
      const m = MATERIALS[src.mat]; if (!m || m.notrade) { this.ui.toast('That cannot be traded', 'warn'); return false; }
      qty = clamp(Math.round(qty), 1, this.matCount(src.mat)); if (!qty || !this.takeMat(src.mat, qty)) return false;
      L = { kind: 'mat', id: src.mat, qty };
    } else {
      const b = S.bag[src.bag]; if (!b) return false;
      if (b.eq) { if (b.eq.lock) { this.ui.toast('Unlock the item first', 'warn'); return false; } L = { kind: 'gear', eq: b.eq, qty: 1 }; S.bag.splice(src.bag, 1); }
      else {
        const it = ITEMS[b.id]; if (it.type === 'quest') { this.ui.toast('Quest items cannot be traded', 'warn'); return false; }
        qty = clamp(Math.round(qty), 1, b.qty);
        L = { kind: 'item', id: b.id, qty }; b.qty -= qty; if (b.qty <= 0) S.bag.splice(src.bag, 1);
      }
    }
    S.gold -= deposit;
    const fair = this.goodValue(L);
    Object.assign(L, { aid: 'm' + A.next++, mineLot: true, seller: S.name, start, buyout, bid: 0, bidder: null, bids: 0, cap: Math.round(fair * rnd(0.75, 1.3)), ends: Date.now() + clamp(mins, 1, 60) * 60000 });
    A.mine.push(L);
    this.sfx.play('coin'); this.ui.toast(`Auction started: ${goodName(L)} (deposit ${fmt(deposit)} Gold)`, 'good');
    this.ui.sel.aucSrc = null; this.ui.refreshWallet(); this.ui.refreshPanel(); this.ui.refreshSkills(); this.save();
    return true;
  },
  aucCancel(aid) {
    const A = this.S.auc, L = A.mine.find((x) => x.aid === aid); if (!L) return;
    if (L.bidder) { this.ui.toast('Someone already bid — the auction must run its course', 'warn'); return; }
    A.mine.splice(A.mine.indexOf(L), 1);
    A.claims.push({ ...this.goodOf(L), note: 'Auction cancelled' });
    this.collectClaims(true);
    this.ui.refreshPanel(); this.save();
  },
  collectClaims(quiet = false) {
    const S = this.S, A = S.auc, keep = [];
    let got = 0;
    for (const c of A.claims) {
      let ok = true;
      if (c.kind === 'gold') S.gold += c.gold;
      else if (c.kind === 'gear') ok = S.bag.length < this.bagMax() && this.addEquip(c.eq);
      else if (c.kind === 'item') ok = this.bagRoomFor(c.id) && this.addItem(c.id, c.qty);
      else this.addMat(c.id, c.qty, true);
      if (ok) got++; else keep.push(c);
    }
    A.claims = keep;
    if (got && !quiet) { this.sfx.play('coin'); this.ui.toast(`Collected ${got} item${got > 1 ? 's' : ''}`, 'good'); }
    if (keep.length && !quiet) this.ui.toast('Bag is full — some items are still waiting', 'warn');
    this.ui.refreshWallet(); this.ui.refreshPanel(); this.ui.refreshActs && this.ui.acts && this.ui.refreshActs(); this.save();
  },

  // ============================================================ direct trade with another adventurer
  tradeGoods(lv) {
    const t = Math.min(4, Math.floor(lv / 42)), out = [], n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if (r < 0.25) out.push({ kind: 'gear', eq: this.makeEquip(null, clamp(lv + Math.round(rnd(-2, 2)), 1, MAX_LEVEL), Math.random() < 0.15 ? 4 : Math.random() < 0.5 ? 3 : 2), qty: 1 });
      else if (r < 0.65) out.push({ kind: 'mat', id: pick([GATHER.ore, GATHER.herb, GATHER.tree]).mats[t], qty: Math.round(rnd(3, 12)) });
      else if (r < 0.8) out.push({ kind: 'mat', id: pick(['spirit_shard', 'spirit_dust', 'star_essence']), qty: Math.round(rnd(1, 4)) });
      else if (r < 0.9) out.push({ kind: 'mat', id: gemId(pick(Object.keys(GEMS)), Math.random() < 0.3 ? 2 : 1), qty: 1 });
      else out.push({ kind: 'item', id: pick(['elixir_might', 'elixir_swift', 'potion_hp2', 'pet_treat', 'fertilizer', 'teleport_scroll']), qty: Math.round(rnd(1, 3)) });
    }
    for (const g of out) g.want = true;
    return out;
  },
  openTrade(b) {
    if (this.dg || this.war) { this.ui.toast('Finish what you are doing first', 'warn'); return; }
    if (!b || b.kind !== 'bot') return;
    if (Math.random() < 0.12) { this.ui.chat('whisper', pick(['busy rn sorry!', 'in a dungeon, later?', 'afk~']), b.name); this.ui.toast(`${b.name} declined the trade`, 'warn'); return; }
    const S = this.S;
    const mate = S.guild && b.guild === S.guild.name;
    this.trade = { who: b.name, cls: b.cls, level: b.level || S.level, theirs: this.tradeGoods(b.level || S.level), mine: [], myGold: 0, theirGold: 0, greed: rnd(0.92, 1.12) * (mate ? 0.9 : 1), tries: 0, agreed: false, msg: pick(['hi! here is what I can offer', 'sure, let us trade~', 'looking for mats, what do you have?']) };
    this.ui.chat('whisper', esc(this.trade.msg), b.name);
    this.sfx.play('open');
    this.ui.togglePanel('trade', true);
  },
  tradeValues() {
    const T = this.trade; if (!T) return { mine: 0, theirs: 0 };
    const theirs = T.theirs.filter((g) => g.want).reduce((a, g) => a + this.goodValue(g), 0) + T.theirGold;
    const mine = T.mine.reduce((a, g) => a + this.goodValue(g), 0) + T.myGold;
    return { mine, theirs };
  },
  tradeAdd(src, qty = 1) {
    const T = this.trade, S = this.S; if (!T) return;
    if (src.mat) {
      const m = MATERIALS[src.mat]; if (!m || m.notrade) { this.ui.toast('That cannot be traded', 'warn'); return; }
      const have = this.matCount(src.mat) - T.mine.filter((g) => g.kind === 'mat' && g.id === src.mat).reduce((a, g) => a + g.qty, 0);
      qty = clamp(Math.round(qty), 1, have); if (qty <= 0 || have <= 0) return;
      const ex = T.mine.find((g) => g.kind === 'mat' && g.id === src.mat);
      if (ex) ex.qty += qty; else T.mine.push({ kind: 'mat', id: src.mat, qty });
    } else {
      const b = S.bag[src.bag]; if (!b) return;
      if (b.eq) { if (b.eq.lock) { this.ui.toast('Locked items cannot be traded', 'warn'); return; } if (T.mine.some((g) => g.eq === b.eq)) return; T.mine.push({ kind: 'gear', eq: b.eq, qty: 1 }); }
      else {
        const it = ITEMS[b.id]; if (it.type === 'quest') return;
        const have = this.countItem(b.id) - T.mine.filter((g) => g.kind === 'item' && g.id === b.id).reduce((a, g) => a + g.qty, 0);
        qty = clamp(Math.round(qty), 1, have); if (have <= 0) return;
        const ex = T.mine.find((g) => g.kind === 'item' && g.id === b.id);
        if (ex) ex.qty += qty; else T.mine.push({ kind: 'item', id: b.id, qty });
      }
    }
    T.agreed = false; this.ui.refreshPanel();
  },
  tradeRemove(i) { const T = this.trade; if (!T) return; T.mine.splice(i, 1); T.agreed = false; this.ui.refreshPanel(); },
  tradeToggle(i) { const T = this.trade; if (!T || !T.theirs[i]) return; T.theirs[i].want = !T.theirs[i].want; T.agreed = false; this.ui.refreshPanel(); },
  tradeGold(n) { const T = this.trade; if (!T) return; T.myGold = clamp(Math.round(n) || 0, 0, this.S.gold); T.agreed = false; this.ui.refreshPanel(); },
  tradePropose() {
    const T = this.trade; if (!T) return;
    const v = this.tradeValues();
    if (!v.theirs && !v.mine) { this.ui.toast('Add something to the trade first', 'warn'); return; }
    T.tries++;
    if (v.mine >= v.theirs * T.greed) {
      T.agreed = true; T.ask = 0;
      if (v.theirs > 0 && v.mine > v.theirs * 1.5 && T.theirGold === 0) {
        T.theirGold = Math.round((v.mine - v.theirs * 1.2) * 0.8);
        T.msg = `that's way too generous! I'll add ${fmt(T.theirGold)} gold~`;
      } else T.msg = pick(['deal!', 'sounds fair~', 'ok! confirm when ready', 'pleasure doing business']);
    } else if (T.tries >= 4) {
      T.msg = pick(['nvm, good luck!', 'not worth it for me, bye~', 'I think I will pass']);
      this.ui.chat('whisper', esc(T.msg), T.who);
      this.ui.toast(`${T.who} left the trade`, 'warn');
      this.trade = null; this.ui.closePanels(); return;
    } else {
      T.ask = Math.ceil(v.theirs * T.greed - v.mine);
      T.msg = pick([`hmm, that's ${fmt(T.ask)} gold short...`, `add about ${fmt(T.ask)} gold and it's a deal`, `my stuff is worth more, ${fmt(T.ask)} gold more?`]);
    }
    this.ui.chat('whisper', esc(T.msg), T.who);
    this.ui.refreshPanel();
  },
  tradeConfirm() {
    const T = this.trade, S = this.S; if (!T || !T.agreed) return;
    // validate what you are giving
    for (const g of T.mine) {
      if (g.kind === 'gear' && !S.bag.some((b) => b.eq === g.eq)) { this.ui.toast('An offered item is gone', 'warn'); T.agreed = false; return; }
      if (g.kind === 'item' && this.countItem(g.id) < g.qty) { this.ui.toast('An offered item is gone', 'warn'); T.agreed = false; return; }
      if (g.kind === 'mat' && this.matCount(g.id) < g.qty) { this.ui.toast('An offered material is gone', 'warn'); T.agreed = false; return; }
    }
    if (S.gold < T.myGold) { this.ui.toast('Not enough Gold', 'warn'); return; }
    const got = T.theirs.filter((g) => g.want);
    const gearIn = got.filter((g) => g.kind === 'gear').length, gearOut = T.mine.filter((g) => g.kind === 'gear').length;
    if (S.bag.length - gearOut + gearIn + got.filter((g) => g.kind === 'item' && !S.bag.some((b) => b.id === g.id)).length > this.bagMax()) { this.ui.toast('Not enough bag space', 'warn'); return; }
    for (const g of T.mine) {
      if (g.kind === 'gear') S.bag.splice(S.bag.findIndex((b) => b.eq === g.eq), 1);
      else if (g.kind === 'item') this.removeItem(g.id, g.qty);
      else this.takeMat(g.id, g.qty);
    }
    S.gold += T.theirGold - T.myGold;
    for (const g of got) {
      if (g.kind === 'gear') { g.eq.uid = S.uid++; this.addEquip(g.eq); }
      else if (g.kind === 'item') this.addItem(g.id, g.qty);
      else this.addMat(g.id, g.qty, true);
    }
    S.trades++; this.track('trade');
    this.ui.chat('system', `<b>[Trade]</b> Trade with ${esc(T.who)} complete: received ${got.map((g) => esc(goodName(g))).join(', ') || 'nothing'}${T.theirGold ? ` and ${fmt(T.theirGold)} Gold` : ''}.`);
    this.ui.chat('whisper', pick(['ty!! <3', 'thanks, gl out there!', 'nice trade~']), T.who);
    this.sfx.play('quest'); this.fx.buff(this.player, '#7aff9a');
    this.trade = null;
    this.ui.closePanels(); this.ui.refreshWallet(); this.ui.refreshSkills(); this.save();
  },
  tradeCancel() { if (!this.trade) return; this.ui.chat('whisper', pick(['ok np', 'maybe later~', 'cya']), this.trade.who); this.trade = null; this.ui.closePanels(); },
};

export function installEconomy(Game) { Object.assign(Game.prototype, E); }
