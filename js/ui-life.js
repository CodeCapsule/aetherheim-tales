// Panels for the life & economy systems: professions (gathering, farm, alchemy, smithing, Crimson Forge), relic
// collection, wardrobe, NPC shops, the Auction House, direct trades and the bag's Sell All box.
// installLifeUI(UI) mixes these into UI.prototype.
import { ITEMS, SLOTS, SLOT_INFO, DUNGEONS } from './data.js';
import {
  PROF, PROF_MAX, profNeed, TIER_REQ, GATHER, CROPS, FARM_PLOTS, ALCHEMY, ELIXIRS, SMITHING, COSTUMES, RELICS, RELIC_SETS,
  COLLECTION_BONUS, SHOPS, AUCTION, BAG_MAX, BAG_STEP,
} from './data-world.js';
import { MATERIALS } from './systems-data.js';
import { RARITY } from './loot.js';
import { fmtLeft, COSTUME_SLOTS } from './life.js';
import { shopEntry, goodName, goodQuality, goodIcon } from './economy.js';
import { ico } from './icons.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (a, b) => `${Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100))}%`;
const nameOf = (id) => MATERIALS[id]?.name || ITEMS[id]?.name || id;
const iconOf = (id) => MATERIALS[id]?.icon || ITEMS[id]?.icon || id;
const qOf = (id) => MATERIALS[id]?.quality ?? ITEMS[id]?.quality ?? 0;
const priceTxt = (p) => (p.diamonds ? `<span class="gem"></span>${fmt(p.diamonds)}` : `<span class="coin"></span>${fmt(p.gold || 0)}`);

const P = {
  // ------------------------------------------------------------ shared bits
  insChips(ins) {
    const g = this.g;
    return Object.entries(ins).map(([id, n]) => {
      const have = MATERIALS[id] ? g.matCount(id) : g.countItem(id);
      return `<span class="need ${have >= n ? '' : 'no'}" title="${esc(nameOf(id))}">${ico(iconOf(id), 'ico inl')}${fmt(have)}/${n}</span>`;
    }).join('');
  },
  costLine(c = {}) {
    const g = this.g, S = g.S, out = [];
    if (c.gold) out.push(`<span class="need ${S.gold >= c.gold ? '' : 'no'}"><span class="coin"></span>${fmt(c.gold)}</span>`);
    if (c.diamonds) out.push(`<span class="need ${S.diamonds >= c.diamonds ? '' : 'no'}"><span class="gem"></span>${fmt(c.diamonds)}</span>`);
    return out.join('') + this.insChips(c.mats || {});
  },
  profBar(k) {
    const P2 = this.g.S.prof[k], max = P2.lv >= PROF_MAX;
    return `<div class="prof-bar"><span class="pl">${ico(PROF[k].icon, 'ico inl')} ${PROF[k].name} <b>Lv ${P2.lv}</b></span><span class="bar xp"><i style="width:${max ? 100 : pct(P2.exp, profNeed(P2.lv))}"></i></span><small>${max ? 'MAX' : `${fmt(P2.exp)}/${fmt(profNeed(P2.lv))}`}</small></div>`;
  },

  // ------------------------------------------------------------ professions
  panel_life(body) {
    const tab = this.tabs(body, 'lifeTab', [['gather', 'Gathering'], ['farm', 'Farm'], ['alchemy', 'Alchemy'], ['smithing', 'Smithing'], ['red', 'Crimson Forge']]);
    this['life_' + tab](body);
  },
  life_gather(body) {
    const g = this.g, S = g.S;
    const grid = h('div', 'prof-grid');
    for (const k of Object.keys(PROF)) grid.appendChild(h('div', '', this.profBar(k)));
    body.appendChild(grid);
    const L = h('div', 'list');
    for (const [kind, G] of Object.entries(GATHER)) {
      const lv = g.profLv(G.prof);
      G.mats.forEach((m, t) => {
        const ok = lv >= TIER_REQ[t];
        const near = g.nodes ? g.nodes.filter((n) => n.nkind === kind && n.tier === t).sort((a, b) => Math.hypot(a.pos.x - g.player.pos.x, a.pos.z - g.player.pos.z) - Math.hypot(b.pos.x - g.player.pos.x, b.pos.z - g.player.pos.z))[0] : null;
        const r = h('div', 'row slim' + (ok ? '' : ' locked'), `<div class="ic q${qOf(m)}">${ico(m)}</div><div class="tx"><b>${esc(G.names[t])}</b>${PROF[G.prof].name} Lv ${TIER_REQ[t]} · yields ${esc(nameOf(m))} · you have ${fmt(g.matCount(m))}</div>`);
        if (near) {
          const b = h('button', 'btn small blue', 'Go'); b.disabled = !!(g.dg || g.war);
          b.onclick = () => { this.closePanels(); g.lifeClick(near); };
          r.appendChild(b);
        }
        L.appendChild(r);
      });
    }
    body.appendChild(L);
    body.appendChild(h('div', 'note', `Click ore veins, herbs and trees in the wilds to gather. Each node gives three harvests, then regrows. Higher tiers grow in the outer zones and need a higher profession level. Gathering, farming, alchemy and smithing level up to ${PROF_MAX}.`));
  },
  life_farm(body) {
    const g = this.g, S = g.S, now = Date.now();
    body.appendChild(h('div', '', this.profBar('farming')));
    const seeds = Object.keys(CROPS).filter((k) => g.countItem('seed_' + k) > 0);
    let seed = this.sel.seed && g.countItem(this.sel.seed) > 0 ? this.sel.seed : (seeds.length ? 'seed_' + seeds[seeds.length - 1] : null);
    const sp = h('div', 'seed-pick');
    sp.appendChild(h('span', 'muted', 'Seed:'));
    for (const k of Object.keys(CROPS)) {
      const id = 'seed_' + k, n = g.countItem(id), C = CROPS[k], lock = g.profLv('farming') < C.lv;
      const c = h('button', `cell q${ITEMS[id].quality}` + (seed === id ? ' picked' : '') + (lock ? ' dim' : ''), `${ico(id)}<span class="cnt">${n}</span>`);
      c.onclick = () => { this.sel.seed = id; this.renderPanel(); };
      this.tip(c, () => `<b>${esc(ITEMS[id].name)}</b>${esc(ITEMS[id].desc)}${lock ? `<br><span style="color:#ff8a7a">Needs Farming Lv ${C.lv}</span>` : ''}`);
      sp.appendChild(c);
    }
    body.appendChild(sp);
    const grid = h('div', 'farm-grid');
    for (let i = 0; i < FARM_PLOTS; i++) {
      const st = g.plotState(i, now);
      const c = h('div', 'plot' + (st.ripe ? ' ripe' : '') + (st.empty ? ' empty' : ''));
      if (st.empty) c.innerHTML = `<div class="pi">${seed ? ico(seed) : ico('farm')}</div><b>Plot ${i + 1}</b><small>Empty</small>`;
      else c.innerHTML = `<div class="pi">${ico('crop_' + st.crop)}</div><b>${esc(st.def.name)}</b><small>${st.ripe ? 'Ripe!' : fmtLeft(st.left)}</small><div class="bar xp"><i style="width:${Math.round(st.k * 100)}%"></i></div><div class="tags">${st.watered ? '<span>Watered</span>' : ''}${st.fert ? '<span>Fertilized</span>' : ''}</div>`;
      const a = h('div', 'pa');
      if (st.empty) { const b = h('button', 'btn small green', 'Plant'); b.disabled = !seed; b.onclick = () => g.plant(i, seed.replace('seed_', '')); a.appendChild(b); }
      else if (st.ripe) { const b = h('button', 'btn small green', 'Harvest'); b.onclick = () => g.harvest(i); a.appendChild(b); }
      else {
        if (!st.watered) { const b = h('button', 'btn small blue', 'Water'); b.onclick = () => g.water(i); a.appendChild(b); }
        if (!st.fert) { const b = h('button', 'btn small', 'Fertilize'); b.disabled = g.countItem('fertilizer') < 1; b.onclick = () => g.fertilize(i); a.appendChild(b); }
      }
      c.appendChild(a); grid.appendChild(c);
    }
    body.appendChild(grid);
    const row = h('div', 'acts-row');
    const pa = h('button', 'btn small green', 'Plant All'); pa.disabled = !seed; pa.onclick = () => g.plantAll(seed.replace('seed_', '')); row.appendChild(pa);
    const wa = h('button', 'btn small blue', 'Water All'); wa.onclick = () => g.waterAll(); row.appendChild(wa);
    const ha = h('button', 'btn small', 'Harvest All'); ha.onclick = () => g.harvestAll(); row.appendChild(ha);
    if (!g.dg && !g.war) { const go = h('button', 'btn small gray', 'Go to Farm'); go.onclick = () => { this.closePanels(); g.lifeClick(g.plots[0]); }; row.appendChild(go); }
    body.appendChild(row);
    body.appendChild(h('div', 'note', `Your homestead is west of town, next to Tilly. Crops grow in real time, even while you are away. Water once per planting for 25% faster growth; Fertilizer halves the time left. Buy seeds from Tilly. Fertilizer: ${g.countItem('fertilizer')}.`));
  },
  life_alchemy(body) {
    const g = this.g;
    body.appendChild(h('div', '', this.profBar('alchemy')));
    const L = h('div', 'list');
    for (const r of ALCHEMY) {
      const it = ITEMS[r.out], lock = g.profLv('alchemy') < r.lv, ok = g.insOk(r.ins);
      const row = h('div', 'row slim' + (lock ? ' locked' : ''), `<div class="ic q${it.quality}">${ico(r.out)}</div><div class="tx"><b style="color:${RARITY[it.quality].color}">${esc(it.name)}${r.qty > 1 ? ` x${r.qty}` : ''}</b>${lock ? `Alchemy Lv ${r.lv}` : esc(it.desc)}<div class="needs">${this.insChips(r.ins)}</div></div>`);
      this.tip(row.querySelector('.ic'), () => `<b>${esc(it.name)}</b>${esc(it.desc)}`);
      const b = h('button', 'btn small green', 'Brew'); b.disabled = lock || !ok; b.onclick = () => g.brew(r.id); row.appendChild(b);
      const b5 = h('button', 'btn small', 'x5'); b5.disabled = lock || !ok; b5.onclick = () => g.brew(r.id, 5); row.appendChild(b5);
      L.appendChild(row);
    }
    body.appendChild(L);
    const act = g.activeElixirs();
    body.appendChild(h('div', 'note', `Herbs come from gathering, produce from your farm and Empty Vials from Vera. ${act.length ? `Active elixirs: ${act.map((x) => `${esc(x.def.name)} (${fmtLeft(x.left)})`).join(', ')}.` : 'Elixir buffs last in real time and stack duration up to 3x.'}`));
  },
  life_smithing(body) {
    const g = this.g, S = g.S;
    body.appendChild(h('div', '', this.profBar('smithing')));
    const slot = this.sel.smithSlot || null;
    const sr = h('div', 'tabs small');
    for (const s of [null, ...SLOTS]) { const b = h('button', slot === s ? 'sel' : '', s ? SLOT_INFO[s].label : 'Random slot'); b.onclick = () => { this.sel.smithSlot = s; this.renderPanel(); }; sr.appendChild(b); }
    body.appendChild(sr);
    const L = h('div', 'list');
    for (const r of SMITHING) {
      const lock = g.profLv('smithing') < r.lv, ok = g.canAfford({ gold: r.gold, mats: r.mats });
      const desc = r.core ? 'Heart of every Red item' : `${RARITY[r.quality].name} gear at your level (Lv ${S.level}) · ${Math.round((r.up + g.profLv('smithing') / 1000) * 100)}% Masterwork`;
      const icon = r.core ? 'crimson_core' : 'smithing';
      const row = h('div', 'row slim' + (lock ? ' locked' : ''), `<div class="ic q${r.core ? 6 : r.quality}">${ico(icon)}</div><div class="tx"><b style="color:${RARITY[r.core ? 6 : r.quality].color}">${esc(r.name)}</b>${lock ? `Smithing Lv ${r.lv}` : desc}<div class="needs">${this.costLine({ gold: r.gold, mats: r.mats })}</div></div>`);
      const b = h('button', 'btn small green', 'Forge'); b.disabled = lock || !ok; b.onclick = () => g.smith(r.id, slot); row.appendChild(b);
      L.appendChild(row);
    }
    body.appendChild(L);
    body.appendChild(h('div', 'note', 'Smithing turns ore and logs into gear. Masterworks come out one rarity higher; the chance grows with your Smithing level.'));
  },
  life_red(body) {
    const g = this.g, S = g.S;
    body.appendChild(h('div', 'red-hero', `${ico('red_forge')}<div><b>Crimson Forge</b><span>Combine the four relics of one dungeon, a Crimson Core, Star Essence and gold into a <b style="color:${RARITY[6].color}">Red</b> item: 4 bonus affixes, a legendary power and 3 gem sockets, at your level (Lv ${Math.max(10, S.level)}).</span></div>`));
    const slot = this.sel.redSlot || 'weapon';
    const sr = h('div', 'tabs small');
    for (const s of SLOTS) { const b = h('button', slot === s ? 'sel' : '', SLOT_INFO[s].label); b.onclick = () => { this.sel.redSlot = s; this.renderPanel(); }; sr.appendChild(b); }
    body.appendChild(sr);
    const L = h('div', 'list');
    for (const [dg, set] of Object.entries(RELIC_SETS)) {
      const R = g.redRecipe(dg), have = set.ids.filter((id) => g.matCount(id) > 0).length;
      const row = h('div', 'row slim red', `<div class="ic q6">${ico(set.ids[0])}</div><div class="tx"><b style="color:${set.c1}">Crimson ${esc(set.adj)} ${esc(SLOT_INFO[slot].label)}</b>Relics ${have}/4<div class="needs">${set.ids.map((id) => `<span class="need ${g.matCount(id) ? '' : 'no'}" title="${esc(RELICS[id].name)}">${ico(id, 'ico inl')}${g.matCount(id)}</span>`).join('')}${this.costLine({ gold: R.cost.gold, mats: { star_essence: R.cost.mats.star_essence } })}${this.insChips({ crimson_core: 1 })}</div></div>`);
      const b = h('button', 'btn small red', 'Forge'); b.disabled = !g.canForgeRed(dg); b.onclick = () => g.forgeRed(dg, slot); row.appendChild(b);
      L.appendChild(row);
    }
    body.appendChild(L);
    body.appendChild(h('div', 'note', 'Relics drop inside dungeons (chamber monsters, elites and the treasure chest). Crimson Cores come from dungeon chests, Smithing and Elias the Relic Collector. Relics can also turn up at the Auction House.'));
  },

  // ------------------------------------------------------------ relic collection
  panel_collect(body) {
    const g = this.g, S = g.S, done = g.collSets();
    body.appendChild(h('div', 'wallet-row', `<span><b>${done}</b>/${Object.keys(RELIC_SETS).length} sets complete · +${(done * COLLECTION_BONUS * 100).toFixed(1)}% Attack & Max HP</span><span class="muted">${Object.keys(S.coll).length}/${Object.keys(RELICS).length} relics registered</span>`));
    const L = h('div', 'list');
    for (const [dg, set] of Object.entries(RELIC_SETS)) {
      const n = set.ids.filter((id) => S.coll[id]).length;
      const def = DUNGEONS.find((d) => d.id === dg);
      const row = h('div', 'row coll' + (n === 4 ? ' done' : ''));
      row.innerHTML = `<div class="tx"><b style="color:${set.c1}">${esc(set.adj)} Relics</b>${esc(def ? `${def.name} · Lv ${def.lv}` : dg)} · ${n}/4${n === 4 ? ` · <span style="color:#7aff7a">+${(COLLECTION_BONUS * 100).toFixed(1)}% Attack & HP</span>` : ''}</div>`;
      const cells = h('div', 'coll-cells');
      for (const id of set.ids) {
        const c = h('div', `cell q5${S.coll[id] ? '' : ' ghost'}`, `${ico(id)}${g.matCount(id) ? `<span class="cnt">${g.matCount(id)}</span>` : ''}`);
        this.tip(c, () => `<b style="color:${set.c1}">${esc(RELICS[id].name)}</b>${S.coll[id] ? 'Registered.' : 'Not found yet.'} You hold ${g.matCount(id)}.`);
        cells.appendChild(c);
      }
      row.appendChild(cells); L.appendChild(row);
    }
    body.appendChild(L);
    body.appendChild(h('div', 'note', 'Each relic registers the first time you obtain it. A complete set gives a permanent bonus, and four relics of one dungeon plus a Crimson Core forge a Red item at the Crimson Forge.'));
  },

  // ------------------------------------------------------------ wardrobe
  panel_wardrobe(body) {
    const g = this.g, S = g.S;
    const tab = this.tabs(body, 'wdTab', [['outfit', 'Outfits'], ['head', 'Headwear'], ['back', 'Wings']]);
    const wrap = h('div', 'wd-wrap');
    const pv = h('div', 'wd-prev', `<img src="${g.fullIcon()}" alt=""><small>Costumes are cosmetic only and never change your stats.</small>`);
    wrap.appendChild(pv);
    const grid = h('div', 'wd-grid');
    const none = h('button', 'wd-item' + (!S.costume[tab] ? ' on' : ''), `<div class="wi">${ico('wardrobe')}</div><b>Class default</b>`);
    none.onclick = () => g.wearCostume(null, tab); grid.appendChild(none);
    for (const c of COSTUMES.filter((x) => x.slot === tab)) {
      const own = S.costumes.includes(c.id), on = S.costume[tab] === c.id;
      const el = h('button', 'wd-item' + (on ? ' on' : '') + (own ? '' : ' locked'), `<div class="wi">${ico(c.id)}</div><b>${esc(c.name)}</b><small>${own ? (on ? 'Wearing' : 'Owned') : c.src ? esc(c.src) : `Coco · ${priceTxt(c.price)}`}</small>`);
      el.onclick = () => { if (own) g.wearCostume(c.id); else this.toast(c.src ? c.src : 'Buy it at Coco\'s Boutique', 'warn'); };
      grid.appendChild(el);
    }
    wrap.appendChild(grid); body.appendChild(wrap);
    body.appendChild(h('div', 'note', `${S.costumes.length}/${COSTUMES.length} costumes owned. Wardrobe Boxes unlock a random costume.`));
  },

  // ------------------------------------------------------------ NPC shop
  panel_shop(body) {
    const g = this.g, S = g.S, key = this.sel.shop || 'general', shop = SHOPS[key];
    body.appendChild(h('div', 'wallet-row', `<span class="price"><span class="coin"></span>${fmt(S.gold)} &nbsp; <span class="gem"></span>${fmt(S.diamonds)}</span><span class="muted">Bag ${S.bag.length}/${g.bagMax()}</span>`));
    const L = h('div', 'list mk');
    shop.items.forEach((e, i) => {
      const x = shopEntry(e), owned = g.shopOwned(x);
      const lock = S.level < x.minLv || (x.farmLv && g.profLv('farming') < x.farmLv);
      const icon = x.kind === 'pet' ? `<img class="ico" src="${g.petIcon(x.id)}" alt="">` : x.kind === 'mount' ? `<img class="ico" src="${g.mountIcon(x.id)}" alt="">` : ico(x.kind === 'mat' ? MATERIALS[x.id].icon : x.id);
      const sub = x.kind === 'item' ? ITEMS[x.id].desc : x.kind === 'mat' ? MATERIALS[x.id].desc : x.kind === 'pet' ? 'Companion pet' : x.kind === 'mount' ? 'Mount' : 'Cosmetic costume';
      const r = h('div', 'row slim' + (lock ? ' locked' : ''), `<div class="ic q${Math.min(6, x.quality)}">${icon}</div><div class="tx"><b style="color:${RARITY[Math.min(6, x.quality)].color}">${esc(x.name)}${x.qty > 1 ? ` x${x.qty}` : ''}</b>${lock ? (x.farmLv && g.profLv('farming') < x.farmLv ? `Farming Lv ${x.farmLv}` : `Lv ${x.minLv}`) : esc(sub)}</div><div class="mk-price"><span class="price">${priceTxt(x.price)}</span></div>`);
      const b = h('button', 'btn small green', owned ? 'Owned' : 'Buy'); b.disabled = owned || lock; b.onclick = () => g.buyShop(key, i, 1); r.appendChild(b);
      if (!owned && (x.kind === 'item' || x.kind === 'mat') && !x.price.diamonds) { const b5 = h('button', 'btn small', 'x5'); b5.disabled = lock; b5.onclick = () => g.buyShop(key, i, 5); r.appendChild(b5); }
      L.appendChild(r);
    });
    body.appendChild(L);
  },

  // ------------------------------------------------------------ auction house
  panel_auction(body) {
    const g = this.g, S = g.S, A = S.auc, now = Date.now();
    const tab = this.tabs(body, 'aucTab', [['browse', 'Browse'], ['sell', 'Sell'], ['mine', `My Auctions (${A.mine.length}/${AUCTION.maxMine})`], ['claims', `Collect${A.claims.length ? ` (${A.claims.length})` : ''}`]]);
    body.appendChild(h('div', 'wallet-row', `<span class="price"><span class="coin"></span>${fmt(S.gold)}</span><span class="muted">Won ${A.won} · Sold ${A.sold} · ${Math.round(AUCTION.fee * 100)}% fee on sales</span>`));
    const lotRow = (L, mine) => {
      const q = goodQuality(L), left = L.ends - now;
      const top = L.bidder === 'me' ? '<span class="deal good">YOUR BID</span>' : L.bidder ? `<span class="muted">${esc(L.bidder)}</span>` : '<span class="muted">no bids</span>';
      const r = h('div', 'row slim auc' + (L.bidder === 'me' ? ' lead' : ''), `<div class="ic q${q}">${ico(goodIcon(L))}</div><div class="tx"><b style="color:${RARITY[q].color}">${esc(goodName(L))}</b>${mine ? '' : `${esc(L.seller)} · `}<span class="${left < 60000 ? 'hot' : ''}">${fmtLeft(left)} left</span> · ${L.bids} bid${L.bids === 1 ? '' : 's'}</div><div class="auc-p"><span class="price"><span class="coin"></span>${fmt(L.bid || L.start)}</span>${top}${L.buyout ? `<small>Buyout ${fmt(L.buyout)}</small>` : ''}</div>`);
      if (L.kind === 'gear') this.tip(r.querySelector('.ic'), () => this.equipTip(L.eq) + this.compare(L.eq));
      else this.tip(r.querySelector('.ic'), () => `<b>${esc(goodName(L))}</b>${esc((L.kind === 'item' ? ITEMS[L.id]?.desc : MATERIALS[L.id]?.desc) || '')}<br><span class="ts">Worth ~${fmt(g.goodValue(L))} Gold</span>`);
      return r;
    };
    if (tab === 'browse') {
      const L = h('div', 'list mk');
      for (const lot of [...A.lots].sort((a, b) => a.ends - b.ends)) {
        const r = lotRow(lot, false), min = g.aucMinBid(lot);
        const next = lot.bidder === 'me' ? Math.ceil(lot.bid * (1 + AUCTION.minStep)) : min;
        const b = h('button', 'btn small green', `Bid ${fmt(next)}`); b.disabled = S.gold < next - (lot.bidder === 'me' ? lot.bid : 0); b.onclick = () => g.aucBid(lot.aid, next); r.appendChild(b);
        if (lot.buyout) { const bo = h('button', 'btn small', 'Buyout'); bo.disabled = S.gold < lot.buyout - (lot.bidder === 'me' ? lot.bid : 0); bo.onclick = () => g.aucBuyout(lot.aid); r.appendChild(bo); }
        L.appendChild(r);
      }
      body.appendChild(L);
      body.appendChild(h('div', 'note', 'Bids hold your Gold until you are outbid (it is refunded at once). Rival bidders get busier near the end; a late bid extends the timer to 30s. Won items wait in Collect.'));
    } else if (tab === 'sell') {
      const src = this.sel.aucSrc;
      const grid = h('div', 'grid-bag sm');
      const cells = [];
      S.bag.forEach((b, i) => { if ((b.eq && !b.eq.lock) || (ITEMS[b.id] && ITEMS[b.id].type !== 'quest')) cells.push({ src: { bag: i }, icon: b.eq ? b.eq.icon : b.id, q: b.eq ? b.eq.quality : ITEMS[b.id].quality, n: b.eq ? 0 : b.qty, eq: b.eq, id: b.id }); });
      Object.keys(S.mats).filter((id) => !MATERIALS[id].notrade).forEach((id) => cells.push({ src: { mat: id }, icon: MATERIALS[id].icon, q: MATERIALS[id].quality, n: S.mats[id], id }));
      for (const c of cells) {
        const on = src && ((src.bag !== undefined && src.bag === c.src.bag) || (src.mat && src.mat === c.src.mat));
        const el = h('button', `cell q${c.q}` + (on ? ' picked' : ''), `${ico(c.icon)}${c.n ? `<span class="cnt">${fmt(c.n)}</span>` : ''}`);
        el.onclick = () => { this.sel.aucSrc = c.src; this.sel.aucStart = null; this.sel.aucBuy = null; this.sel.aucQty = null; this.renderPanel(); };
        this.tip(el, () => (c.eq ? this.equipTip(c.eq) : `<b>${esc(nameOf(c.id))}</b>`));
        grid.appendChild(el);
      }
      if (!cells.length) grid.appendChild(h('div', 'muted', 'Nothing to sell.'));
      body.appendChild(grid);
      const sel = src && (src.mat ? (S.mats[src.mat] ? { kind: 'mat', id: src.mat, max: S.mats[src.mat] } : null) : S.bag[src.bag] ? (S.bag[src.bag].eq ? { kind: 'gear', eq: S.bag[src.bag].eq, max: 1 } : { kind: 'item', id: S.bag[src.bag].id, max: S.bag[src.bag].qty }) : null);
      if (sel) {
        const qty = Math.min(sel.max, this.sel.aucQty || sel.max);
        const fair = g.goodValue({ ...sel, qty });
        const start = this.sel.aucStart || Math.round(fair * 0.7), buy = this.sel.aucBuy ?? Math.round(fair * 1.4), mins = this.sel.aucMins || 15;
        const f = h('div', 'detail sellbox');
        f.innerHTML = `<div class="dtx"><b>${esc(goodName({ ...sel, qty }))}</b><br>Worth ~<b>${fmt(fair)}</b> Gold · deposit ${fmt(10 + start * 0.01)} Gold · ${Math.round(AUCTION.fee * 100)}% fee on sale<div class="sell-ctl">${sel.max > 1 ? `<label>Qty <input type="number" id="au-qty" min="1" max="${sel.max}" value="${qty}"></label>` : ''}<label>Start <input type="number" id="au-start" min="1" value="${start}"></label><label>Buyout <input type="number" id="au-buy" min="0" value="${buy}"></label><label>Time <select id="au-mins">${AUCTION.durations.map((d) => `<option value="${d}"${d === mins ? ' selected' : ''}>${d} min</option>`).join('')}</select></label></div></div>`;
        const acts = h('div', 'acts');
        const go = h('button', 'btn small green', 'Start Auction'); go.onclick = () => g.aucList(src, qty, start, buy, mins); acts.appendChild(go);
        f.appendChild(acts); body.appendChild(f);
        const qi = f.querySelector('#au-qty'); if (qi) qi.onchange = (e) => { this.sel.aucQty = Math.max(1, Math.min(sel.max, +e.target.value || 1)); this.sel.aucStart = null; this.sel.aucBuy = null; this.renderPanel(); };
        f.querySelector('#au-start').onchange = (e) => { this.sel.aucStart = Math.max(1, +e.target.value || 1); this.renderPanel(); };
        f.querySelector('#au-buy').onchange = (e) => { this.sel.aucBuy = Math.max(0, +e.target.value || 0); this.renderPanel(); };
        f.querySelector('#au-mins').onchange = (e) => { this.sel.aucMins = +e.target.value; this.renderPanel(); };
      } else body.appendChild(h('div', 'note', 'Pick an item or material to auction. Bidders value items near their worth; a low start draws more bids. Set buyout to 0 for none.'));
    } else if (tab === 'mine') {
      const L = h('div', 'list');
      if (!A.mine.length) L.appendChild(h('div', 'note', 'You have no running auctions.'));
      for (const lot of A.mine) {
        const r = lotRow(lot, true);
        const b = h('button', 'btn small gray', 'Cancel'); b.disabled = !!lot.bidder; b.onclick = () => g.aucCancel(lot.aid); r.appendChild(b);
        L.appendChild(r);
      }
      body.appendChild(L);
    } else {
      const L = h('div', 'list');
      if (!A.claims.length) L.appendChild(h('div', 'note', 'Nothing to collect.'));
      for (const c of A.claims) {
        if (c.kind === 'gold') L.appendChild(h('div', 'row slim', `<div class="ic q4">${ico('gold')}</div><div class="tx"><b>${fmt(c.gold)} Gold</b>${esc(c.note || '')}</div>`));
        else { const q = goodQuality(c); L.appendChild(h('div', 'row slim', `<div class="ic q${q}">${ico(goodIcon(c))}</div><div class="tx"><b style="color:${RARITY[q].color}">${esc(goodName(c))}</b>${esc(c.note || '')}</div>`)); }
      }
      body.appendChild(L);
      if (A.claims.length) { const row = h('div', 'acts-row'); const b = h('button', 'btn green', 'Collect All'); b.onclick = () => g.collectClaims(); row.appendChild(b); body.appendChild(row); }
    }
  },

  // ------------------------------------------------------------ direct trade window
  panel_trade(body) {
    const g = this.g, S = g.S, T = g.trade;
    if (!T) { body.appendChild(h('div', 'note', 'No trade open. Click another adventurer and press Trade.')); return; }
    const v = g.tradeValues();
    body.appendChild(h('div', 'trade-msg', `<b>${esc(T.who)}</b> (Lv ${T.level}): “${esc(T.msg)}”`));
    const cols = h('div', 'trade-cols');
    const theirs = h('div', 'trade-side', `<h4>${esc(T.who)} offers <small>~${fmt(v.theirs)}</small></h4>`);
    T.theirs.forEach((x, i) => {
      const q = goodQuality(x);
      const r = h('button', 'trow' + (x.want ? ' on' : ''), `<span class="ic q${q}">${ico(goodIcon(x))}</span><span class="tn" style="color:${RARITY[q].color}">${esc(goodName(x))}</span><span class="tv">${fmt(g.goodValue(x))}</span>`);
      r.onclick = () => g.tradeToggle(i);
      if (x.kind === 'gear') this.tip(r, () => this.equipTip(x.eq) + this.compare(x.eq));
      theirs.appendChild(r);
    });
    if (T.theirGold) theirs.appendChild(h('div', 'trow on', `<span class="ic">${ico('gold')}</span><span class="tn">${fmt(T.theirGold)} Gold</span>`));
    const mine = h('div', 'trade-side', `<h4>You offer <small>~${fmt(v.mine)}</small></h4>`);
    T.mine.forEach((x, i) => {
      const q = goodQuality(x);
      const r = h('button', 'trow on', `<span class="ic q${q}">${ico(goodIcon(x))}</span><span class="tn" style="color:${RARITY[q].color}">${esc(goodName(x))}</span><span class="tv">✕</span>`);
      r.onclick = () => g.tradeRemove(i); mine.appendChild(r);
    });
    const gold = h('label', 'tgold', `Gold <input type="number" id="tr-gold" min="0" max="${S.gold}" value="${T.myGold}">`);
    mine.appendChild(gold);
    cols.appendChild(theirs); cols.appendChild(mine); body.appendChild(cols);
    gold.querySelector('input').onchange = (e) => g.tradeGold(+e.target.value);
    // pick from your bag
    const grid = h('div', 'grid-bag sm');
    S.bag.forEach((b, i) => {
      if (b.eq ? b.eq.lock : ITEMS[b.id]?.type === 'quest') return;
      const c = h('button', `cell q${b.eq ? b.eq.quality : ITEMS[b.id].quality}`, `${ico(b.eq ? b.eq.icon : b.id)}${b.eq ? '' : `<span class="cnt">${b.qty}</span>`}`);
      c.onclick = () => g.tradeAdd({ bag: i }, b.eq ? 1 : b.qty);
      this.tip(c, () => (b.eq ? this.equipTip(b.eq) : `<b>${esc(ITEMS[b.id].name)}</b>`)); grid.appendChild(c);
    });
    Object.keys(S.mats).filter((id) => !MATERIALS[id].notrade).forEach((id) => {
      const c = h('button', `cell q${MATERIALS[id].quality}`, `${ico(MATERIALS[id].icon)}<span class="cnt">${fmt(S.mats[id])}</span>`);
      c.onclick = () => g.tradeAdd({ mat: id }, Math.min(S.mats[id], 5));
      this.tip(c, () => `<b>${esc(MATERIALS[id].name)}</b>Click to add 5`); grid.appendChild(c);
    });
    body.appendChild(h('div', 'muted', 'Click your items to offer them (materials add 5 at a time). Click their goods to include or skip them.'));
    body.appendChild(grid);
    const row = h('div', 'acts-row');
    if (T.ask && !T.agreed) { const add = h('button', 'btn small', `Add ${fmt(T.ask)} Gold`); add.disabled = S.gold < T.myGold + T.ask; add.onclick = () => { g.tradeGold(T.myGold + T.ask); T.ask = 0; }; row.appendChild(add); }
    const pr = h('button', 'btn blue', T.agreed ? 'Agreed!' : 'Propose'); pr.disabled = T.agreed; pr.onclick = () => g.tradePropose(); row.appendChild(pr);
    const ok = h('button', 'btn green', 'Confirm Trade'); ok.disabled = !T.agreed; ok.onclick = () => g.tradeConfirm(); row.appendChild(ok);
    const cx = h('button', 'btn gray', 'Cancel'); cx.onclick = () => g.tradeCancel(); row.appendChild(cx);
    body.appendChild(row);
  },

  // ------------------------------------------------------------ bag: sell all & expansion
  bagTools(body) {
    const g = this.g, S = g.S;
    const row = h('div', 'acts-row bag-tools');
    const sa = h('button', 'btn small', `${ico('sell_all', 'ico inl')} Sell All…`); sa.onclick = () => { this.sel.sellAll = !this.sel.sellAll; this.renderPanel(); }; row.appendChild(sa);
    if (g.bagMax() < BAG_MAX) {
      const c = g.bagExpandCost();
      if (g.countItem('bag_scroll')) { const b = h('button', 'btn small green', `${ico('bag_plus', 'ico inl')} Use Scroll (+${BAG_STEP})`); b.onclick = () => g.expandBag(true); row.appendChild(b); }
      const bg = h('button', 'btn small', `+${BAG_STEP} slots · <span class="coin"></span>${fmt(c.gold)}`); bg.onclick = () => g.expandBag(false, 'gold'); row.appendChild(bg);
      const bd = h('button', 'btn small blue', `+${BAG_STEP} · <span class="gem"></span>${fmt(c.diamonds)}`); bd.onclick = () => g.expandBag(false, 'diamonds'); row.appendChild(bd);
    }
    body.appendChild(row);
    if (!this.sel.sellAll) return;
    const o = this.sel.sellOpt = this.sel.sellOpt || { maxQ: 1, gear: true, items: false, mats: false };
    const plan = g.sellAllPlan(o);
    const box = h('div', 'detail sellall');
    box.innerHTML = `<div class="dtx"><b>Sell All</b><br>Sell gear up to <select id="sa-q">${[0, 1, 2, 3, 4, 5].map((q) => `<option value="${q}"${q === o.maxQ ? ' selected' : ''}>${RARITY[q].name}</option>`).join('')}</select>
      <label><input type="checkbox" id="sa-gear"${o.gear ? ' checked' : ''}> Equipment</label> <label><input type="checkbox" id="sa-items"${o.items ? ' checked' : ''}> Consumables</label> <label><input type="checkbox" id="sa-mats"${o.mats ? ' checked' : ''}> Common materials</label>
      <br><span class="muted">Locked gear, quest items, relics, gems, eggs and Crimson Cores are always kept.</span><br>${plan.count} item${plan.count === 1 ? '' : 's'} for <b class="price"><span class="coin"></span>${fmt(plan.gold)}</b></div>`;
    const acts = h('div', 'acts');
    const go = h('button', 'btn small green', 'Sell'); go.disabled = !plan.count;
    go.onclick = () => this.modal('Sell All?', `Sell ${plan.count} items for ${fmt(plan.gold)} Gold?`, [{ label: 'Sell', cls: 'green', fn: () => { g.sellAll(o); } }, { label: 'Cancel', cls: 'gray' }]);
    acts.appendChild(go); box.appendChild(acts); body.appendChild(box);
    box.querySelector('#sa-q').onchange = (e) => { o.maxQ = +e.target.value; this.renderPanel(); };
    for (const k of ['gear', 'items', 'mats']) box.querySelector('#sa-' + k).onchange = (e) => { o[k] = e.target.checked; this.renderPanel(); };
  },

  // target frame: trade button for other adventurers
  refreshTradeBtn(t) {
    let b = $('tg-trade');
    if (!b) { b = h('button', 'btn small blue', 'Trade'); b.id = 'tg-trade'; b.onclick = (e) => { e.stopPropagation(); const tt = this.g.player.target; if (tt && tt.kind === 'bot') this.g.openTrade(tt); }; $('hud-target').appendChild(b); }
    b.hidden = !(t && t.kind === 'bot');
  },
};

export function installLifeUI(UI) { Object.assign(UI.prototype, P); }
