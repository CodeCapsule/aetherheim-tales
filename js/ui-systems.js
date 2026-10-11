// Panels and HUD widgets for the live systems (missions, guild & war, world boss, market, forge, codex, season pass,
// festival and leaderboards). installSystemsUI(UI) mixes these into UI.prototype.
import { CLASSES, MONSTERS, ITEMS, SLOTS, SLOT_INFO, PETS, TITLES, DUNGEONS } from './data.js';
import {
  MATERIALS, GEMS, GEM_LV, GEM_MAX, gemId, parseGem, parseSoul, SOULS, soulId, SOUL_FORGE, SOCKET_MAX, DRILL_MAX, drillCost, ENH_MAX, ENH_RATE, ENH_LUCK, enhCost, enhRisk, REFINE,
  RECIPES, SOCKETS, GEM_COMBINE, ASCEND, reforgeCost, retemperCost, salvageYield, CODEX_MILESTONES,
  DAILY_CHESTS, WEEKLY_CHESTS, GUILD_LIST, GUILD_EXP, GUILD_MAX, GUILD_CREATE, GUILD_JOIN_LV, guildBuff, GUILD_DONATE, GUILD_SHOP, GUILD_EMBLEMS,
  WAR, WORLD_BOSS, WB_RANK_REWARDS, MARKET, EVENTS, nextEvent, eventEnds, seasonInfo, PASS, passReward, SEASON_RANK_REWARDS,
  secsToDayEnd, secsToWeekEnd, fmtDur,
} from './systems-data.js';
import { RARITY, NAMED_LIST, EFFECTS, iconKey, itemScore, enhMult, enhAffixMult } from './loot.js';
import { missionDef, matName } from './systems.js';
import { fmt, esc } from './game.js';
import { ico } from './icons.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const pct = (a, b) => `${Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100))}%`;
const costChips = (g, c = {}) => {
  const out = [];
  if (c.gold) out.push(`<span class="need ${g.S.gold >= c.gold ? '' : 'no'}"><span class="coin"></span>${fmt(c.gold)}</span>`);
  if (c.diamonds) out.push(`<span class="need ${g.S.diamonds >= c.diamonds ? '' : 'no'}"><span class="gem"></span>${fmt(c.diamonds)}</span>`);
  if (c.contrib) out.push(`<span class="need ${(g.S.guild?.contrib || 0) >= c.contrib ? '' : 'no'}">${ico('contrib', 'ico inl')}${fmt(c.contrib)}</span>`);
  for (const [id, n] of Object.entries(c.mats || {})) out.push(`<span class="need ${g.matCount(id) >= n ? '' : 'no'}" title="${esc(matName(id))}">${ico(MATERIALS[id].icon, 'ico inl')}${g.matCount(id)}/${n}</span>`);
  return out.join('');
};
// Guild emblems as inline SVG (never depends on the device's symbol fonts).
const EMB_PATH = {
  moon: '<path d="M15.5 2.5a9.5 9.5 0 1 0 6 16.8A8 8 0 1 1 15.5 2.5z"/>',
  star: '<path d="M12 1.8l3 6.6 7.2.7-5.4 4.8 1.6 7.1L12 17.3 5.6 21l1.6-7.1-5.4-4.8 7.2-.7z"/>',
  flower: '<g><circle cx="12" cy="5.5" r="4"/><circle cx="18.2" cy="10" r="4"/><circle cx="15.8" cy="17.4" r="4"/><circle cx="8.2" cy="17.4" r="4"/><circle cx="5.8" cy="10" r="4"/></g><circle cx="12" cy="12" r="3.2" fill="#ffd84a"/>',
  axe: '<path d="M4.5 2.5l10 10-2 2-10-10V2.5zM19.5 2.5h2v2l-10 10-2-2zM6.5 15.5l2 2-3.5 3.5-2-2zM17.5 15.5l3.5 3.5-2 2-3.5-3.5z"/>',
  cloud: '<path d="M6.5 19a5 5 0 0 1-.6-9.96A6.5 6.5 0 0 1 18.4 8a5.5 5.5 0 0 1-.4 11z"/>',
  wing: '<path d="M2 15C6 6 13 3 22 3c-2 3-4.5 4.5-7.5 5.2 2.6.3 4.8 0 6.5-.8-1.8 3.8-5 5.8-9 6.1 2 .8 4 .9 5.6.6C14.5 17.8 9 19.6 2 15z"/>',
};
const emblem = (k) => `<svg viewBox="0 0 24 24" fill="#fff" stroke="#24160f" stroke-width="1.2" stroke-linejoin="round">${EMB_PATH[k] || EMB_PATH.wing}</svg>`;
const MISSION_GO = { dungeon: 'dungeons', dungeonS: 'dungeons', worldboss: 'worldboss', war: 'guild', warWin: 'guild', donate: 'guild', craft: 'forge', salvage: 'forge', enhance: 'forge', gem: 'forge', trade: 'market', marketGold: 'market', feed: 'pets', eventToken: 'event' };

const P = {
  // ------------------------------------------------------------ setup & refresh hooks
  bindSystems() {
    const hud = $('hud');
    for (const [id, cls] of [['hud-wb', ''], ['hud-war', 'stroke'], ['trade-offer', 'frame']]) {
      if ($(id)) continue;
      const el = h('div', cls); el.id = id; el.hidden = true; hud.appendChild(el);
    }
  },
  softRefresh() {
    if (this.softT) return;
    this.softT = setTimeout(() => {
      this.softT = null;
      const a = document.activeElement;
      if (this.panel && !(a && a.tagName === 'INPUT' && this.panel.contains(a))) this.renderPanel();
    }, 300);
  },
  refreshActsSys() {
    const g = this.g, S = g.S, A = this.acts; if (!A) return;
    const mc = g.missionsClaimable();
    A.missions.classList.toggle('glow', mc > 0); this.setBadge(A.missions, mc > 0);
    const pc = g.passClaimable();
    A.season.classList.toggle('glow', pc > 0); this.setBadge(A.season, pc > 0);
    A.event.hidden = !g.event;
    if (g.event) { const tok = g.matCount(g.event.currency); this.setBadge(A.event, g.eventShopItems().some((it) => !it.owned && it.left > 0 && tok >= it.cost)); }
    A.war.hidden = !S.guild || S.level < WAR.lv;
    if (!A.war.hidden) { const left = g.warEntriesLeft(); A.war.classList.toggle('glow', left > 0 && !g.war && !g.dg); }
  },
  questExtras(list) {
    const g = this.g, S = g.S;
    if (g.wb && !g.wb.e.dead) {
      const it = h('div', 'qt-item', `<span class="qtag wboss">World Boss</span><span class="qn">${esc(g.wb.e.def0.name)}</span><div class="qo">Gather at the <u>${WORLD_BOSS.name}</u></div>`);
      it.onclick = () => { g.sfx.play('click'); g.goToWorldBoss(); };
      list.appendChild(it);
    }
    const M = S.ms;
    if (M.daily && M.daily.length) {
      const done = M.daily.filter((m) => m.done).length, claim = g.missionsClaimable();
      const it = h('div', 'qt-item', `<span class="qtag daily">Daily</span><span class="qn">Missions ${done}/${M.daily.length}</span><div class="qo ${claim ? 'done' : ''}">${claim ? `${claim} reward${claim > 1 ? 's' : ''} ready to claim!` : `Activity ${M.dpts} pts · next chest at ${DAILY_CHESTS.find((c) => c.pts > M.dpts)?.pts ?? 'max'}`}</div>`);
      it.onclick = () => { g.sfx.play('click'); this.togglePanel('missions', true); };
      list.appendChild(it);
    }
    if (g.event) {
      const it = h('div', 'qt-item', `<span class="qtag event" style="background:${g.event.color}">Festival</span><span class="qn">${esc(g.event.short)}</span><div class="qo">${ico(MATERIALS[g.event.currency].icon, 'ico inl')}${fmt(g.matCount(g.event.currency))} ${esc(matName(g.event.currency))}</div>`);
      it.onclick = () => { g.sfx.play('click'); this.togglePanel('event', true); };
      list.appendChild(it);
    }
  },
  frameSys() {
    const g = this.g; if (!g) return;
    this.sysFrame = (this.sysFrame || 0) + 1;
    if (this.sysFrame % 15) return;
    // world boss timer on the activity button
    const st = g.wbState(), A = this.acts;
    if (A) {
      const lbl = A.worldboss.querySelector('.al');
      const live = g.wb && !g.wb.e.dead;
      this.txt(lbl, live ? 'Live!' : st.active && g.S.wb.done ? fmtDur(st.nextIn) : st.active ? 'Live!' : fmtDur(st.nextIn));
      if (live !== this.wbLive) { this.wbLive = live; A.worldboss.classList.toggle('glow', !!live); this.setBadge(A.worldboss, !!live); }
    }
    // world boss damage meter
    const wbEl = $('hud-wb');
    const showWb = g.wb && !g.wb.e.dead && !g.dg && !g.war && (g.wb.dmg.has(g.S.name) || Math.hypot(g.player.pos.x - WORLD_BOSS.site.x, g.player.pos.z - WORLD_BOSS.site.z) < 70);
    wbEl.hidden = !showWb;
    if (showWb) {
      const rank = g.wbRanking(), me = rank.findIndex((r) => r.me), e = g.wb.e;
      const rows = rank.slice(0, 5).map((r, i) => `<div class="wr ${r.me ? 'me' : ''}"><span>${i + 1}</span><span>${esc(r.name)}</span><span>${fmt(r.dmg)}</span></div>`).join('');
      wbEl.innerHTML = `<div class="wt">${ico('worldboss', 'ico inl')}${esc(e.def0.name)} <small>${Math.ceil((e.hp / e.maxHp) * 100)}%</small></div><div class="bar"><i style="width:${pct(e.hp, e.maxHp)}"></i></div><div class="wl">${rows || '<div class="wr"><span></span><span>No damage yet</span><span></span></div>'}${me >= 5 ? `<div class="wr me"><span>${me + 1}</span><span>${esc(g.S.name)}</span><span>${fmt(rank[me].dmg)}</span></div>` : ''}</div><div class="wf">Ends in ${fmtDur(st.endsIn)}</div>`;
    }
    // guild war scoreboard
    const W = g.war, wEl = $('hud-war');
    wEl.hidden = !W;
    if (W) {
      const a = W.ourCrystal, b = W.theirCrystal;
      wEl.innerHTML = `<div class="ws"><div class="side us"><b>${esc(g.S.guild?.name || 'You')}</b><div class="bar"><i style="width:${pct(a.hp, a.maxHp)}"></i></div></div><div class="mid"><div class="sc">${W.score.us} : ${W.score.them}</div><div class="tm">${W.started ? fmtDur(Math.max(0, W.left)) : 'Get ready!'}</div></div><div class="side them"><b>${esc(W.opp.name)}</b><div class="bar"><i style="width:${pct(b.hp, b.maxHp)}"></i></div></div></div>`;
    }
    // trade offer countdown
    const o = g.market?.offer, tEl = $('trade-offer');
    if (o && !tEl.hidden) { const f = tEl.querySelector('.tf i'); if (f) f.style.width = pct(o.expires - g.time, 25); }
    if (this.panelName === 'worldboss' && this.sysFrame % 60 === 0) this.renderPanel();
    if (this.panelName === 'market' && this.sysFrame % 120 === 0) this.softRefresh();
  },
  tradeOffer(o) {
    const el = $('trade-offer'); if (!el) return;
    if (!o) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div class="th">${ico('trade', 'ico inl')}Trade request</div><div class="tt"><b>${esc(o.who)}</b> ${o.text}</div><div class="ta"></div><div class="tf"><i></i></div>`;
    const yes = h('button', 'btn small green', 'Accept'), no = h('button', 'btn small gray', 'Decline');
    yes.onclick = () => this.g.answerOffer(true); no.onclick = () => this.g.answerOffer(false);
    el.querySelector('.ta').append(yes, no);
  },
  enterWar() { this.closePanels(); this.closeDialog(); this.refreshQuest(); this.refreshActs(); $('hud').classList.add('in-dungeon', 'in-war'); },
  leaveWar() { $('hud').classList.remove('in-dungeon', 'in-war'); this.refreshQuest(); this.refreshActs(); this.closeModal(); },
  titleChooser(body) {
    const g = this.g, S = g.S;
    body.appendChild(h('div', 'lbl', '<br>Titles'));
    const row = h('div', 'chips');
    for (const i of [...S.titles].sort((a, b) => a - b)) {
      const b = h('button', 'chip' + (S.title === i ? ' sel' : ''), `«${esc(TITLES[i])}»`);
      b.onclick = () => g.setTitle(i);
      row.appendChild(b);
    }
    body.appendChild(row);
  },
  matsGrid(body) {
    const g = this.g, S = g.S;
    const ids = Object.keys(MATERIALS).filter((id) => S.mats[id]);
    const grid = h('div', 'grid-bag');
    for (let k = 0; k < Math.max(24, ids.length); k++) {
      const id = ids[k];
      if (!id) { grid.appendChild(h('div', 'cell empty')); continue; }
      const m = MATERIALS[id], gm = parseGem(id);
      const c = h('div', `cell q${m.quality}`, `${ico(m.icon)}<span class="cnt">${fmt(S.mats[id])}</span>${gm ? `<span class="glv">${'I'.repeat(gm.lv)}</span>` : ''}`);
      this.tip(c, () => `<b style="color:${RARITY[m.quality].color}">${esc(m.name)}</b>${esc(m.desc)}<br><span class="ts">${m.notrade ? 'Festival token · cannot be traded' : `Market value ~${fmt(g.mkPrice('mat', id))} Gold`}</span>`);
      grid.appendChild(c);
    }
    body.appendChild(grid);
    body.appendChild(h('div', 'note', 'Materials live in their own pouch and never take bag space. Use them at the Forge (Y), trade them at the Market (N).'));
  },

  // ------------------------------------------------------------ missions
  panel_missions(body) {
    const g = this.g, S = g.S, M = S.ms;
    g.ensureResets();
    const tab = this.tabs(body, 'msTab', [['daily', 'Daily Missions'], ['weekly', 'Weekly Missions']]);
    const daily = tab === 'daily', list = daily ? M.daily : M.weekly, chests = daily ? DAILY_CHESTS : WEEKLY_CHESTS, got = daily ? M.dch : M.wch, pts = daily ? M.dpts : M.wpts;
    const max = chests[chests.length - 1].pts;
    const head = h('div', 'act-track');
    head.innerHTML = `<div class="at-top"><span>Activity <b>${pts}</b> pts</span><span class="muted">${ico('timer', 'ico inl')}Resets in ${fmtDur(daily ? secsToDayEnd() : secsToWeekEnd())}</span></div><div class="at-bar"><i style="width:${pct(pts, max)}"></i></div>`;
    const marks = h('div', 'at-chests');
    chests.forEach((c, i) => {
      const open = got.includes(i), ready = pts >= c.pts && !open;
      const b = h('button', 'at-chest' + (ready ? ' ready' : '') + (open ? ' open' : ''), `${ico(open ? 'chest_open' : 'chest')}<small>${c.pts}</small>`);
      b.style.left = pct(c.pts, max);
      b.onclick = () => (ready ? g.claimActivityChest(tab, i) : this.toast(open ? 'Already opened' : `Reach ${c.pts} activity: ${g.rewardText(c.reward)}`, open ? '' : 'warn'));
      this.tip(b, () => `<b>${c.pts} Activity Chest</b>${esc(g.rewardText(c.reward))}`);
      marks.appendChild(b);
    });
    head.appendChild(marks);
    body.appendChild(head);
    const L = h('div', 'list');
    list.forEach((m, i) => {
      const d = missionDef(m.id); if (!d) return;
      const r = h('div', 'row mission' + (m.claimed ? ' claimed' : m.done ? ' done' : ''));
      const prog = d.ev === 'gold' || d.ev === 'marketGold' ? `${fmt(m.prog)} / ${fmt(d.n)}` : `${m.prog} / ${d.n}`;
      r.innerHTML = `<div class="ic">${ico(MISSION_GO[d.ev] === 'forge' ? 'forge' : d.ev === 'worldboss' ? 'worldboss' : d.ev.startsWith('war') ? 'war' : d.ev === 'donate' ? 'guild' : d.ev.startsWith('dungeon') ? 'dungeon' : d.ev === 'trade' || d.ev === 'marketGold' ? 'market' : d.ev === 'eventToken' ? 'event' : 'missions')}</div><div class="tx"><b>${esc(d.name)} <span class="pts">+${d.pts}</span></b>${esc(d.desc.replace('{n}', fmt(d.n)))}<div class="mbar"><i style="width:${pct(m.prog, d.n)}"></i><span>${prog}</span></div><span class="rwd">${esc(g.rewardText(d.reward))}</span></div>`;
      if (m.claimed) r.appendChild(h('span', 'stamp', 'Done'));
      else if (m.done) { const b = h('button', 'btn small green', 'Claim'); b.onclick = () => g.claimMission(tab, i); r.appendChild(b); }
      else if (MISSION_GO[d.ev] || d.ev === 'bounty') {
        const b = h('button', 'btn small blue', 'Go');
        b.onclick = () => {
          if (d.ev === 'worldboss') { this.togglePanel('worldboss', true); return; }
          if (d.ev === 'bounty') { this.closePanels(); if (S.bounty) g.autoQuest('bounty'); else g.talkTo(g.npcById('elena')); return; }
          if (MISSION_GO[d.ev] === 'guild') this.sel.guildTab = d.ev.startsWith('war') ? 'war' : 'hall';
          this.togglePanel(MISSION_GO[d.ev], true);
        };
        r.appendChild(b);
      }
      L.appendChild(r);
    });
    body.appendChild(L);
    body.appendChild(h('div', 'note', 'Missions refresh every day (and every Monday for weekly ones) at 00:00 UTC. Every claimed mission also grants Season Pass points.'));
  },

  // ------------------------------------------------------------ guild
  panel_guild(body) {
    const g = this.g, S = g.S, G = S.guild;
    if (!G) return this.guildBrowser(body);
    const def = g.guildDef(G.name);
    const tab = this.tabs(body, 'guildTab', [['hall', 'Guild Hall'], ['members', `Members (${g.guildSize()})`], ['shop', 'Guild Shop'], ['war', 'Guild War']]);
    const head = h('div', 'g-head');
    head.innerHTML = `<div class="g-emb" style="--gc:${G.color || '#9ad0ff'}">${emblem(G.emblem)}</div><div class="g-info"><div class="g-name">${esc(G.name)} <small>Lv ${G.lv}</small></div><div class="muted">${def ? esc(def.motto) : 'Your own banner, your own legend.'}</div><div class="g-bar"><i style="width:${G.lv >= GUILD_MAX ? '100%' : pct(G.exp, GUILD_EXP[G.lv])}"></i><span>${G.lv >= GUILD_MAX ? 'MAX' : `${fmt(G.exp)} / ${fmt(GUILD_EXP[G.lv])} EXP`}</span></div></div><div class="g-contrib">${ico('contrib', 'ico inl')}<b>${fmt(G.contrib)}</b><small>Contribution</small></div>`;
    body.appendChild(head);
    if (tab === 'hall') {
      const b = guildBuff(G.lv);
      body.appendChild(h('div', 'g-buff', `${ico('guild', 'ico inl')}Guild Blessing: <b>+${(b.atk * 100).toFixed(1)}% Attack</b> and <b>+${(b.hp * 100).toFixed(1)}% Max HP</b> · next level +1.5% each`));
      body.appendChild(h('div', 'lbl', 'Daily Donations'));
      const dl = h('div', 'don-row');
      if (G.don.day !== new Date().toISOString().slice(0, 10)) G.don = { day: new Date().toISOString().slice(0, 10), gold: 0, mats: 0, diamond: 0 };
      for (const d of GUILD_DONATE) {
        const left = d.max - G.don[d.id];
        const c = h('div', 'don', `<b>${esc(d.name)}</b><div class="cost">${costChips(g, d.cost)}</div><small>+${d.contrib} Contribution · +${d.exp} Guild EXP</small><small class="muted">${left}/${d.max} left today</small>`);
        const btn = h('button', 'btn small', 'Donate'); btn.disabled = left <= 0; btn.onclick = () => g.donate(d.id);
        c.appendChild(btn); dl.appendChild(c);
      }
      body.appendChild(dl);
      const acts = h('div', 'acts-row');
      const leave = h('button', 'btn small gray', G.own ? 'Disband Guild' : 'Leave Guild');
      leave.onclick = () => this.modal(G.own ? 'Disband your guild?' : 'Leave the guild?', 'Your contribution points will be lost.', [{ label: 'Confirm', fn: () => g.leaveGuild() }, { label: 'Cancel', cls: 'gray' }]);
      acts.appendChild(leave);
      body.appendChild(acts);
    } else if (tab === 'members') {
      const t = h('div', 'rank-table');
      t.appendChild(h('div', 'rank-row hd', '<span class="rk">#</span><span>Name</span><span class="cls">Role</span><span style="text-align:right">Contribution</span>'));
      g.guildRoster().forEach((m, i) => t.appendChild(h('div', 'rank-row' + (m.me ? ' me' : ''), `<span class="rk"><i class="dot ${m.online ? 'on' : ''}"></i></span><span>${esc(m.name)} <small style="color:${CLASSES[m.cls]?.elemColor}">Lv${m.lv} ${CLASSES[m.cls]?.name}</small></span><span class="cls">${m.role}</span><span style="text-align:right" class="num">${fmt(m.contrib)}</span>`)));
      body.appendChild(t);
      if (G.own) body.appendChild(h('div', 'note', `Recruits arrive while you play (cap ${g.guildCap(G.lv)} at guild Lv ${G.lv}).`));
    } else if (tab === 'shop') {
      const grid = h('div', 'mall-grid');
      for (const it of GUILD_SHOP) {
        const locked = G.lv < it.lv, left = g.guildShopLeft(it);
        const icon = it.item ? ico(ITEMS[it.item].icon) : ico(MATERIALS[it.mat].icon);
        const c = h('div', 'mall-item' + (locked ? ' locked' : ''), `<div class="mi">${icon}</div><div>${esc(it.name)}</div><div class="price">${ico('contrib', 'ico inl')}${fmt(it.cost)}</div><small class="muted">${locked ? `Guild Lv ${it.lv}` : `${left}/${it.max} per ${it.per}`}</small>`);
        const b = h('button', 'btn small', 'Buy'); b.disabled = locked || left <= 0; b.onclick = () => g.guildBuy(it.id);
        c.appendChild(b); grid.appendChild(c);
      }
      body.appendChild(grid);
    } else {
      const left = g.warEntriesLeft();
      const w = h('div', 'war-card');
      w.innerHTML = `<div class="war-hero">${ico('war')}</div><div class="tx"><b>Spirit Crystal Arena</b><p>Lead ${WAR.teamSize} guildmates into a ${WAR.duration / 60}-minute battle against a rival guild. Destroy their Spirit Crystal at the north end while defending yours. If time runs out, the healthier crystal wins.</p>
        <div class="dg-stats"><span>Requirement</span><span>Lv ${WAR.lv}+ · in a guild</span><span>Entries today</span><span><b>${left}</b> / ${WAR.entries}</span><span>Record</span><span>${G.wins} wins · ${G.losses} losses</span><span>Victory</span><span>Gold, 20 Diamonds, Spirit Shards, 120 Contribution</span></div></div>`;
      body.appendChild(w);
      const b = h('button', 'btn big', S.level < WAR.lv ? `Requires Lv ${WAR.lv}` : left ? 'Enter Guild War' : 'No entries left');
      b.disabled = S.level < WAR.lv || !left || !!g.dg || !!g.war; b.onclick = () => g.startWar();
      const wrap = h('div', 'center'); wrap.appendChild(b); body.appendChild(wrap);
    }
  },
  guildBrowser(body) {
    const g = this.g, S = g.S;
    body.appendChild(h('div', 'note', S.level < GUILD_JOIN_LV ? `Guilds unlock at Lv ${GUILD_JOIN_LV}.` : 'Join a guild for a permanent Guild Blessing, the guild shop, guild chat and Guild Wars.'));
    const L = h('div', 'list');
    for (const gd of GUILD_LIST) {
      const r = h('div', 'row');
      r.innerHTML = `<div class="ic g-emb sm" style="--gc:${gd.color}">${emblem(gd.emblem)}</div><div class="tx"><b>${esc(gd.name)} <span class="lv">Lv ${gd.lv}</span></b>${esc(gd.motto)}<br><span class="muted">Leader ${esc(gd.leader)} · ${gd.size} members · Blessing +${(guildBuff(gd.lv).atk * 100).toFixed(1)}%</span></div>`;
      const b = h('button', 'btn small green', 'Join'); b.disabled = S.level < GUILD_JOIN_LV; b.onclick = () => g.joinGuild(gd.name);
      r.appendChild(b); L.appendChild(r);
    }
    body.appendChild(L);
    body.appendChild(h('div', 'lbl', '<br>Found your own guild'));
    const f = h('div', 'g-create');
    const emb = this.sel.gEmb || 'wing', col = this.sel.gCol || '#9ad0ff';
    f.innerHTML = `<input id="g-name" maxlength="14" placeholder="Guild name" value="${esc(this.sel.gName || '')}"><div class="chips">${Object.keys(EMB_PATH).map((k) => `<button class="chip emb ${k === emb ? 'sel' : ''}" data-e="${k}" aria-label="${k} emblem">${emblem(k)}</button>`).join('')}</div><div class="chips">${['#9ad0ff', '#ffd84a', '#ff9ad0', '#7aff9a', '#ff7a5a', '#c8a0ff'].map((c) => `<button class="chip sw ${c === col ? 'sel' : ''}" data-c="${c}" style="background:${c}"></button>`).join('')}</div>`;
    f.querySelector('#g-name').oninput = (e) => { this.sel.gName = e.target.value; };
    f.querySelectorAll('[data-e]').forEach((b) => { b.onclick = () => { this.sel.gEmb = b.dataset.e; this.renderPanel(); }; });
    f.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => { this.sel.gCol = b.dataset.c; this.renderPanel(); }; });
    const btn = h('button', 'btn', `Found Guild · <span class="coin" style="display:inline-block;vertical-align:-3px"></span> ${fmt(GUILD_CREATE.gold)}`);
    btn.disabled = S.level < GUILD_CREATE.lv;
    btn.onclick = () => { if (g.createGuild(this.sel.gName, emb, col)) this.sel.gName = ''; };
    f.appendChild(btn);
    body.appendChild(f);
  },

  // ------------------------------------------------------------ world boss
  panel_worldboss(body) {
    const g = this.g, S = g.S, type = g.wbType(), d = MONSTERS[type], st = g.wbState();
    const live = g.wb && !g.wb.e.dead;
    const L = Math.max(8, Math.min(32, S.level + 3)), stats = g.wbStats(L);
    const det = h('div', 'dg-detail');
    det.innerHTML = `<div class="dg-hero"><img alt="" src="${g.monsterIcon(type)}"><div><div class="dg-name">${esc(d.name)}</div><div class="dg-sub">World Boss · ${WORLD_BOSS.name}${g.event ? ` · <span style="color:${g.event.color}">${esc(g.event.short)} special</span>` : ''}</div><p>Every ${WORLD_BOSS.every / 60} minutes a world boss descends on the ${WORLD_BOSS.name}, north-east of Breezy Meadow. Adventurers from all over Carlyle join in; rewards depend on your damage ranking.</p></div></div>
      <div class="wb-status ${live ? 'live' : ''}">${live ? `LIVE · ${Math.ceil((g.wb.e.hp / g.wb.e.maxHp) * 100)}% HP · ends in ${fmtDur(st.endsIn)}` : st.active && S.wb.done ? `Defeated! Next in ${fmtDur(st.nextIn)}` : st.active ? 'Arriving...' : `Next appearance in ${fmtDur(st.nextIn)}`}</div>
      <div class="dg-stats"><span>Level</span><span>Lv ${L} · ${fmt(stats.hp)} HP (scales with you)</span><span>Your best</span><span>${fmt(S.lb.wbBest || 0)} damage</span><span>Attacks</span><span>${(d.skills || []).map((x) => ({ slam: 'Stomp', storm: d.model === 'pumpkinking' ? 'Lantern Rain' : 'Thunderstorm', nova: 'Shockwave', breath: 'Storm Breath', roots: 'Vine Burst', summon: 'Summon Jackpuffs' }[x])).join(', ')}</span></div>
      <div class="lbl">Ranking rewards</div>`;
    const rl = h('div', 'list');
    for (const t of WB_RANK_REWARDS) rl.appendChild(h('div', 'row slim', `<div class="tx"><b>${t.label}</b>${t.diamonds} Diamonds · ${Object.entries(t.mats || {}).map(([k, n]) => `${matName(k)} x${n}`).join(', ')}${t.items ? ` · ${t.items.map(([k, n]) => `${ITEMS[k].name} x${n}`).join(', ')}` : ''} · ${Math.round(t.gearChance * 100)}% ${RARITY[t.gear].name} gear</div>`));
    det.appendChild(rl);
    const acts = h('div', 'acts-row');
    const go = h('button', 'btn big', live ? 'Join the Battle!' : `Go to the ${WORLD_BOSS.name}`); go.onclick = () => g.goToWorldBoss();
    go.disabled = !!(g.dg || g.war);
    acts.appendChild(go);
    det.appendChild(acts);
    body.appendChild(det);
  },

  // ------------------------------------------------------------ market
  panel_market(body) {
    const g = this.g, S = g.S;
    const tab = this.tabs(body, 'mkTab', [['buy', 'Buy'], ['sell', 'Sell'], ['mine', `My Listings (${S.market.mine.length}/${MARKET.maxListings})`]]);
    body.appendChild(h('div', 'wallet-row', `<span class="price"><span class="coin"></span>${fmt(S.gold)}</span><span class="muted">Earned from sales: ${fmt(S.market.earned)} Gold · ${S.market.sold} sold</span>`));
    if (tab === 'buy') {
      g.refreshListings();
      const L = h('div', 'list mk');
      for (const it of g.market.listings) {
        const nm = it.kind === 'gear' ? it.eq.name : it.kind === 'item' ? ITEMS[it.id].name : matName(it.id);
        const q = it.kind === 'gear' ? it.eq.quality : it.kind === 'item' ? ITEMS[it.id].quality : MATERIALS[it.id].quality;
        const icon = it.kind === 'gear' ? ico(it.eq.icon) : it.kind === 'item' ? ico(ITEMS[it.id].icon) : ico(MATERIALS[it.id].icon);
        const tr = it.kind === 'gear' ? 0 : g.mkTrend(it.id);
        const r = h('div', 'row slim');
        r.innerHTML = `<div class="ic q${q}">${icon}</div><div class="tx"><b style="color:${RARITY[q].color}">${esc(nm)}${it.kind !== 'gear' ? ` x${it.qty}` : ''}</b><span class="muted">${esc(it.seller)}${it.note ? ` · "${esc(it.note)}"` : ''}</span></div><div class="mk-price">${it.deal ? '<span class="deal">DEAL</span>' : ''}<span class="price"><span class="coin"></span>${fmt(it.price)}</span>${tr ? `<span class="trend ${tr > 0 ? 'up' : 'down'}">${tr > 0 ? '▲' : '▼'}</span>` : ''}</div>`;
        if (it.kind === 'gear') this.tip(r.querySelector('.ic'), () => this.equipTip(it.eq) + this.compare(it.eq));
        const b = h('button', 'btn small', 'Buy'); b.disabled = S.gold < it.price; b.onclick = () => g.buyListing(it.lid);
        r.appendChild(b); L.appendChild(r);
      }
      body.appendChild(L);
      const foot = h('div', 'acts-row');
      foot.appendChild(h('span', 'muted', `New listings in ${fmtDur(Math.max(0, g.market.refreshAt - g.time))}`));
      const rf = h('button', 'btn small blue', 'Refresh (100 Gold)');
      rf.onclick = () => { if (g.pay({ gold: 100 })) { g.refreshListings(true); this.renderPanel(); } };
      foot.appendChild(rf);
      body.appendChild(foot);
    } else if (tab === 'sell') {
      const src = this.sel.mkSrc;
      const grid = h('div', 'grid-bag sm');
      const cells = [];
      S.bag.forEach((b, i) => { if (b.eq || (ITEMS[b.id] && ITEMS[b.id].type !== 'quest')) cells.push({ src: { bag: i }, icon: b.eq ? b.eq.icon : ITEMS[b.id].icon, q: b.eq ? b.eq.quality : ITEMS[b.id].quality, n: b.eq ? 0 : b.qty, eq: b.eq, id: b.id }); });
      Object.keys(S.mats).filter((id) => !MATERIALS[id].notrade).forEach((id) => cells.push({ src: { mat: id }, icon: MATERIALS[id].icon, q: MATERIALS[id].quality, n: S.mats[id], id }));
      for (const c of cells) {
        const selected = src && (src.bag === c.src.bag && src.bag !== undefined || (src.mat && src.mat === c.src.mat));
        const el = h('button', `cell q${c.q}` + (selected ? ' picked' : ''), `${ico(c.icon)}${c.n ? `<span class="cnt">${fmt(c.n)}</span>` : ''}`);
        el.onclick = () => { this.sel.mkSrc = c.src; this.sel.mkQty = null; this.sel.mkPrice = null; this.renderPanel(); };
        this.tip(el, () => (c.eq ? this.equipTip(c.eq) : `<b>${esc(c.src.mat ? matName(c.id) : ITEMS[c.id].name)}</b>`));
        grid.appendChild(el);
      }
      if (!cells.length) grid.appendChild(h('div', 'muted', 'Nothing to sell yet.'));
      body.appendChild(grid);
      const sel = src && (src.mat ? (S.mats[src.mat] ? { kind: 'mat', id: src.mat, max: S.mats[src.mat] } : null) : S.bag[src.bag] ? (S.bag[src.bag].eq ? { kind: 'gear', eq: S.bag[src.bag].eq, max: 1 } : { kind: 'item', id: S.bag[src.bag].id, max: S.bag[src.bag].qty }) : null);
      if (sel) {
        const qty = Math.min(sel.max, this.sel.mkQty || sel.max);
        const fair = sel.kind === 'gear' ? g.mkPrice('gear', null, sel.eq) : g.mkPrice(sel.kind, sel.id, null, qty);
        const price = this.sel.mkPrice || fair;
        const chance = g.saleChance({ kind: sel.kind, id: sel.id, eq: sel.eq, qty, price });
        const speed = chance.ratio <= 0.85 ? ['Very fast', 'fast'] : chance.ratio <= 1.05 ? ['Normal', 'ok'] : chance.ratio <= 1.3 ? ['Slow', 'slow'] : ['Very slow', 'bad'];
        const name = sel.kind === 'gear' ? sel.eq.name : sel.kind === 'item' ? ITEMS[sel.id].name : matName(sel.id);
        const f = h('div', 'detail sellbox');
        f.innerHTML = `<div class="dtx"><b>${esc(name)}</b><br>Market price ~<b>${fmt(fair)}</b> Gold${sel.kind !== 'gear' ? ` for ${qty}` : ''} · 5% tax on sale<div class="sell-ctl">${sel.max > 1 ? `<label>Qty <input type="number" id="mk-qty" min="1" max="${sel.max}" value="${qty}"></label>` : ''}<label>Price <input type="number" id="mk-price" min="1" value="${price}"></label><span class="speed ${speed[1]}">Sale speed: ${speed[0]}</span></div></div>`;
        const acts = h('div', 'acts');
        for (const [lbl, k] of [['-10%', 0.9], ['Market', 0], ['+10%', 1.1]]) { const b = h('button', 'btn small gray', lbl); b.onclick = () => { this.sel.mkPrice = k ? Math.max(1, Math.round(price * k)) : fair; this.renderPanel(); }; acts.appendChild(b); }
        const go = h('button', 'btn small green', 'List for Sale'); go.onclick = () => { if (g.listForSale(src, qty, this.sel.mkPrice || fair)) { this.sel.mkSrc = null; this.sel.mkPrice = null; this.sel.mkQty = null; } }; acts.appendChild(go);
        f.appendChild(acts);
        body.appendChild(f);
        const qi = f.querySelector('#mk-qty'); if (qi) qi.onchange = (e) => { this.sel.mkQty = Math.max(1, Math.min(sel.max, +e.target.value || 1)); this.sel.mkPrice = null; this.renderPanel(); };
        f.querySelector('#mk-price').onchange = (e) => { this.sel.mkPrice = Math.max(1, +e.target.value || 1); this.renderPanel(); };
      } else body.appendChild(h('div', 'note', 'Pick something to list. Other adventurers buy listings over time; cheaper listings sell faster. Bots may also whisper you trade offers.'));
    } else {
      const L = h('div', 'list');
      if (!S.market.mine.length) L.appendChild(h('div', 'note', 'No active listings.'));
      for (const it of S.market.mine) {
        const c = g.saleChance(it);
        const q = it.kind === 'gear' ? it.eq.quality : it.kind === 'item' ? ITEMS[it.id].quality : MATERIALS[it.id].quality;
        const icon = it.kind === 'gear' ? ico(it.eq.icon) : it.kind === 'item' ? ico(ITEMS[it.id].icon) : ico(MATERIALS[it.id].icon);
        const r = h('div', 'row slim', `<div class="ic q${q}">${icon}</div><div class="tx"><b style="color:${RARITY[q].color}">${esc(g.listingName(it))}</b><span class="muted">Listed ${fmtDur((Date.now() - it.t) / 1000)} ago · market ~${fmt(c.fair)} · ${c.ratio <= 1.05 ? 'should sell soon' : c.ratio <= 1.3 ? 'a bit pricey' : 'overpriced'}</span></div><div class="mk-price"><span class="price"><span class="coin"></span>${fmt(it.price)}</span></div>`);
        const b = h('button', 'btn small gray', 'Cancel'); b.onclick = () => g.cancelListing(it.lid);
        r.appendChild(b); L.appendChild(r);
      }
      body.appendChild(L);
    }
  },

  // ------------------------------------------------------------ forge
  forgePicker(body, filter = () => true) {
    const g = this.g, S = g.S;
    let ref = this.sel.forgeRef;
    if (ref && !g.refItem(ref)) ref = this.sel.forgeRef = null;
    const wrap = h('div', 'forge-pick');
    const row = h('div', 'grid-bag sm');
    for (const s of SLOTS) {
      const eq = S.equip[s]; if (!eq || !filter(eq)) continue;
      const on = ref && ref.where === 'equip' && ref.slot === s;
      const c = h('button', `cell q${eq.quality}` + (on ? ' picked' : ''), `${ico(eq.icon)}<span class="eqd">E</span>${eq.enh ? `<span class="enh">+${eq.enh}</span>` : ''}`);
      c.onclick = () => { this.sel.forgeRef = { where: 'equip', slot: s }; this.renderPanel(); };
      this.tip(c, () => this.equipTip(eq)); row.appendChild(c);
    }
    S.bag.forEach((b, i) => {
      if (!b.eq || !filter(b.eq)) return;
      const on = ref && ref.where === 'bag' && ref.idx === i;
      const c = h('button', `cell q${b.eq.quality}` + (on ? ' picked' : ''), `${ico(b.eq.icon)}${b.eq.enh ? `<span class="enh">+${b.eq.enh}</span>` : ''}`);
      c.onclick = () => { this.sel.forgeRef = { where: 'bag', idx: i }; this.renderPanel(); };
      this.tip(c, () => this.equipTip(b.eq)); row.appendChild(c);
    });
    if (!row.children.length) row.appendChild(h('div', 'muted', 'No gear here.'));
    wrap.appendChild(row); body.appendChild(wrap);
    return ref ? g.refItem(ref) : null;
  },
  panel_forge(body) {
    const g = this.g, S = g.S;
    const tab = this.tabs(body, 'fgTab', [['enhance', 'Enhance'], ['craft', 'Craft'], ['upgrade', 'Upgrade'], ['gems', 'Gems'], ['salvage', 'Salvage']]);
    if (tab === 'enhance') this.forgeEnhance(body);
    else if (tab === 'craft') {
      const L = h('div', 'list');
      for (const r of RECIPES) {
        const locked = S.level < r.lv;
        const out = r.gear ? `${RARITY[r.gear.quality].name} gear (Lv ${S.level}) · ${Math.round(r.gear.up * 100)}% Masterwork chance` : r.out.item ? `${ITEMS[r.out.item].name} x${r.out.qty}` : `${matName(r.out.mat)} x${r.out.qty}`;
        const icon = r.gear ? ico(iconKey(this.sel.craftSlot || 'weapon', S.cls, r.gear.quality)) : r.out.item ? ico(ITEMS[r.out.item].icon) : ico(MATERIALS[r.out.mat].icon);
        const row = h('div', 'row' + (locked ? ' locked' : ''), `<div class="ic q${r.gear ? r.gear.quality : r.out.item ? ITEMS[r.out.item].quality : MATERIALS[r.out.mat].quality}">${icon}</div><div class="tx"><b>${esc(r.name)}${locked ? ` <span class="muted">Lv ${r.lv}</span>` : ''}</b>${esc(out)}<div class="cost">${costChips(g, { gold: r.gold, mats: r.mats })}</div></div>`);
        const b = h('button', 'btn small', 'Craft'); b.disabled = locked || !g.canAfford({ gold: r.gold, mats: r.mats });
        b.onclick = () => g.craft(r.id, r.gear ? this.sel.craftSlot || null : null);
        row.appendChild(b); L.appendChild(row);
      }
      const slots = h('div', 'chips');
      slots.appendChild(h('span', 'muted', 'Gear slot: '));
      for (const s of [null, ...SLOTS]) { const b = h('button', 'chip' + ((this.sel.craftSlot || null) === s ? ' sel' : ''), s ? SLOT_INFO[s].label : 'Random'); b.onclick = () => { this.sel.craftSlot = s; this.renderPanel(); }; slots.appendChild(b); }
      body.appendChild(slots);
      body.appendChild(L);
    } else if (tab === 'upgrade') {
      const eq = this.forgePicker(body);
      if (!eq) { body.appendChild(h('div', 'note', 'Select a piece of gear. Equipped items are marked E.')); return; }
      const ref = this.sel.forgeRef;
      const det = h('div', 'detail'); det.innerHTML = `<div class="dtx">${this.equipTip(eq)}</div>`; body.appendChild(det);
      const L = h('div', 'list');
      const action = (icon, title, desc, cost, label, fn, disabled = false) => {
        const r = h('div', 'row slim', `<div class="ic">${ico(icon)}</div><div class="tx"><b>${title}</b>${desc}${cost ? `<div class="cost">${costChips(g, cost)}</div>` : ''}</div>`);
        const b = h('button', 'btn small', label); b.disabled = disabled || (cost && !g.canAfford(cost)); b.onclick = fn; r.appendChild(b); L.appendChild(r);
      };
      action('reforge', 'Reforge', RARITY[eq.quality].affixes ? `Reroll all ${RARITY[eq.quality].affixes} bonus affixes${eq.effect ? ' (the named power stays)' : ''}` : 'Common and Uncommon gear has no affixes', reforgeCost(eq), 'Reforge', () => g.reforge(ref), !RARITY[eq.quality].affixes);
      action('levelup', `Re-temper to Lv ${S.level}`, eq.lvl >= S.level ? 'Already at your level' : `Raise item level ${eq.lvl} → ${S.level}; stats and affixes grow with it`, eq.lvl < S.level ? retemperCost(eq, S.level) : null, 'Re-temper', () => g.retemper(ref), eq.lvl >= S.level);
      const A = ASCEND[eq.quality];
      action('ascend', A ? `Ascend to ${RARITY[A.to].name}` : 'Ascend', A ? (A.to >= 4 ? `Awaken into a named ${RARITY[A.to].name} ${SLOT_INFO[eq.slot].label.toLowerCase()} with a special power. Level, enhancement and gems are kept.` : `Raise rarity: stronger base stats, +1 affix, more gem sockets (${SOCKETS[A.to]}).`) : 'Legendary is the highest tier', A ? { gold: A.gold, mats: A.mats } : null, 'Ascend', () => g.ascend(ref), !A);
      body.appendChild(L);
    } else if (tab === 'gems') {
      this.forgeGems(body);
    } else {
      const sel = this.sel.salv || (this.sel.salv = new Set());
      for (const i of [...sel]) if (!S.bag[i]?.eq) sel.delete(i);
      const grid = h('div', 'grid-bag sm');
      S.bag.forEach((b, i) => {
        if (!b.eq) return;
        const c = h('button', `cell q${b.eq.quality}` + (sel.has(i) ? ' picked' : ''), `${ico(b.eq.icon)}${b.eq.enh ? `<span class="enh">+${b.eq.enh}</span>` : ''}`);
        c.onclick = () => { if (sel.has(i)) sel.delete(i); else sel.add(i); this.renderPanel(); };
        this.tip(c, () => this.equipTip(b.eq) + this.compare(b.eq)); grid.appendChild(c);
      });
      if (!grid.children.length) grid.appendChild(h('div', 'muted', 'No gear in your bag.'));
      body.appendChild(grid);
      const total = {};
      for (const i of sel) for (const [k, n] of Object.entries(salvageYield(S.bag[i].eq))) total[k] = (total[k] || 0) + n;
      body.appendChild(h('div', 'note', sel.size ? `Selected ${sel.size}: yields ${Object.entries(total).map(([k, n]) => `${matName(k)} x${n}`).join(', ')} (socketed gems are returned)` : 'Select gear to break it into Spirit Dust, Spirit Shards and Star Essence.'));
      const acts = h('div', 'acts-row');
      const go = h('button', 'btn small green', `Salvage ${sel.size || ''}`); go.disabled = !sel.size; go.onclick = () => { const list = [...sel]; sel.clear(); g.salvage(list); }; acts.appendChild(go);
      for (const [lbl, q] of [['All Common', 0], ['Uncommon & below', 1], ['Rare & below', 2]]) { const b = h('button', 'btn small gray', lbl); b.onclick = () => { sel.clear(); g.salvageBelow(q); }; acts.appendChild(b); }
      body.appendChild(acts);
    }
  },

  // ------------------------------------------------------------ forge: enhancement +1 to +15
  forgeEnhance(body) {
    const g = this.g, S = g.S;
    const eq = this.forgePicker(body);
    if (!eq) { body.appendChild(h('div', 'note', 'Pick any piece of gear (equipped items are marked E). Enhancement raises base stats up to +15, with bonus steps at +5, +10 and +15. Stones drop from monsters and dungeons and are sold by Hilda.')); this.refinery(body); return; }
    const ref = this.sel.forgeRef, e = eq.enh || 0, maxed = e >= ENH_MAX;
    const o = this.sel.enhOpt = this.sel.enhOpt || { luck: false, protect: true };
    const R = this.enhResult && this.enhResult.uid === eq.uid && performance.now() - this.enhResult.t < 2500 ? this.enhResult : null;
    const box = h('div', 'enh-box' + (R ? (R.ok ? ' ok' : ' fail') : ''));
    const pips = Array.from({ length: ENH_MAX }, (_, i) => `<i class="${i < e ? 'on' : ''}${i + 1 === 5 || i + 1 === 10 || i + 1 === 15 ? ' ms' : ''}" title="+${i + 1}: ${Math.round(ENH_RATE[i] * 100)}%"></i>`).join('');
    const cur = enhMult(e), nxt = enhMult(Math.min(ENH_MAX, e + 1));
    box.innerHTML = `<div class="enh-item cell q${eq.quality}">${ico(eq.icon)}${e ? `<span class="enh">+${e}</span>` : ''}</div>
      <div class="enh-main"><b style="color:${RARITY[eq.quality].color}">${esc(eq.name)}</b>
      <div class="enh-lv"><span class="big">+${e}</span>${maxed ? '<span class="mx">MAX</span>' : `<span class="arrow">➜</span><span class="big nx">+${e + 1}</span>`}</div>
      <div class="enh-pips">${pips}</div>
      <div class="muted">Base stats x${cur.toFixed(2)}${maxed ? '' : ` ➜ x${nxt.toFixed(2)}`}${enhAffixMult(e) > 1 ? ` · affixes x${enhAffixMult(e).toFixed(2)}` : ''}</div>
      ${R ? `<div class="enh-res">${R.ok ? `SUCCESS! +${R.to}` : R.lost ? `FAILED · dropped to +${R.to}` : 'FAILED · level kept'}</div>` : ''}</div>`;
    body.appendChild(box);
    if (!maxed) {
      const cost = enhCost(eq), target = e + 1, risk = enhRisk(target);
      const chance = g.enhChance(eq, o.luck && g.countItem('enh_luck') > 0);
      const info = h('div', 'detail enh-ctl');
      info.innerHTML = `<div class="dtx"><b>${Math.round(chance * 100)}% success</b>${eq.fs ? ` <span class="muted">(includes +${Math.round(eq.fs * 100)}% from failed tries)</span>` : ''}<br>
        ${risk ? (o.protect && g.countItem('enh_protect') ? '<span style="color:#7aff7a">On failure: the Protection Charm breaks, your level is kept</span>' : '<span style="color:#ff8a7a">On failure: drops to +' + (e ? e - 1 : 0) + '</span>') : '<span style="color:#7aff7a">On failure: nothing but the materials is lost</span>'}
        <div class="cost">${costChips(g, cost)}</div>
        <label class="ck"><input type="checkbox" id="en-luck"${o.luck ? ' checked' : ''}> ${ico('enh_luck', 'ico inl')} Lucky Charm +${Math.round(ENH_LUCK * 100)}% (have ${g.countItem('enh_luck')})</label>
        ${risk ? `<label class="ck"><input type="checkbox" id="en-prot"${o.protect ? ' checked' : ''}> ${ico('enh_protect', 'ico inl')} Protection Charm (have ${g.countItem('enh_protect')})</label>` : ''}</div>`;
      const acts = h('div', 'acts');
      const go = h('button', 'btn big-ish' + (target >= 10 ? ' red' : ' green'), `Enhance +${target}`); go.disabled = !g.canAfford(cost);
      go.onclick = () => g.enhanceItem(ref, { luck: o.luck, protect: o.protect });
      acts.appendChild(go); info.appendChild(acts); body.appendChild(info);
      info.querySelector('#en-luck').onchange = (ev) => { o.luck = ev.target.checked; this.renderPanel(); };
      const pr = info.querySelector('#en-prot'); if (pr) pr.onchange = (ev) => { o.protect = ev.target.checked; this.renderPanel(); };
    }
    this.refinery(body);
  },
  refinery(body) {
    const g = this.g;
    const row = h('div', 'refinery');
    row.innerHTML = `<span class="muted">Stones:</span>${['enh_stone', 'enh_stone2', 'enh_stone3'].map((id) => `<span class="need" title="${esc(MATERIALS[id].name)}: ${esc(MATERIALS[id].desc)}">${ico(id, 'ico inl')}${fmt(g.matCount(id))}</span>`).join('')}`;
    REFINE.forEach((r, i) => { const b = h('button', 'btn small', `Refine ${r.n} ➜ 1 ${ico(r.to, 'ico inl')} · ${fmt(r.gold)}`); b.disabled = !g.canAfford({ gold: r.gold, mats: { [r.from]: r.n } }); b.onclick = () => g.refineStones(i); row.appendChild(b); });
    body.appendChild(row);
  },

  // ------------------------------------------------------------ forge: gems, arcane gems, soulstones, socket drill
  forgeGems(body) {
    const g = this.g, S = g.S;
    const eq = this.forgePicker(body);
    if (eq) {
      const ref = this.sel.forgeRef;
      const sk = h('div', 'sockets');
      eq.gems.forEach((gid, i) => {
        const gm = parseGem(gid), fx = parseSoul(gid);
        const s = h('button', 'socket' + (gm || fx ? ' full' : '') + (fx ? ' soul' : ''), gm ? `${ico('gem_' + gm.type)}<small>${GEM_LV[gm.lv - 1]}</small>` : fx ? `${ico(gid)}<small>Soul</small>` : ico('socket'));
        s.style.setProperty('--gc', gm ? GEMS[gm.type].color : fx ? '#ff9ae8' : '#8a94b0');
        if (gm || fx) { s.title = 'Remove gem'; s.onclick = () => this.modal('Remove gem?', `Costs ${fmt(g.unsocketCost(gid))} Gold. The gem returns to your pouch.`, [{ label: 'Remove', fn: () => g.unsocketGem(ref, i) }, { label: 'Cancel', cls: 'gray' }]); this.tip(s, () => (gm ? `<b style="color:${GEMS[gm.type].color}">${esc(MATERIALS[gid].name)}</b>${esc(GEMS[gm.type].label(GEMS[gm.type].vals[gm.lv - 1]))}` : `<b style="color:#ff9ae8">${esc(MATERIALS[gid].name)}</b>${esc(EFFECTS[fx].desc)}`)); }
        else s.onclick = () => { this.sel.socketIdx = i; this.renderPanel(); };
        if (this.sel.socketIdx === i && !gm && !fx) s.classList.add('picked');
        sk.appendChild(s);
      });
      body.appendChild(h('div', 'lbl', `${esc(eq.name)}: ${eq.gems.length} socket${eq.gems.length === 1 ? '' : 's'}${eq.xs ? ` (${eq.xs} drilled)` : ''}`));
      body.appendChild(sk);
      // socket drill
      if ((eq.xs || 0) < DRILL_MAX && g.socketCount(eq) < SOCKET_MAX) {
        const dr = h('div', 'row slim', `<div class="ic q4">${ico('socket_drill')}</div><div class="tx"><b>Socket Drill</b>Add a socket (up to ${SOCKET_MAX} per item) · you have ${g.countItem('socket_drill')} drill${g.countItem('socket_drill') === 1 ? '' : 's'}<div class="cost">${costChips(g, drillCost(eq))}</div></div>`);
        const b = h('button', 'btn small', 'Drill'); b.disabled = !g.countItem('socket_drill') || !g.canAfford(drillCost(eq)); b.onclick = () => g.drillSocket(ref); dr.appendChild(b);
        body.appendChild(dr);
      }
      const si = this.sel.socketIdx;
      if (si != null && si < eq.gems.length && !eq.gems[si]) {
        const owned = Object.keys(S.mats).filter((id) => parseGem(id) || parseSoul(id));
        const hasSoul = eq.gems.some((x) => parseSoul(x));
        const pick = h('div', 'chips');
        if (!owned.length) pick.appendChild(h('span', 'muted', 'You have no gems. Monsters, bosses, salvage, Gem Pouches, Opal and the Auction House have them.'));
        for (const id of owned) {
          const gm = parseGem(id), fx = parseSoul(id);
          if (fx && hasSoul) continue;
          const b = h('button', 'chip gemchip' + (fx ? ' soulchip' : ''), gm ? `${ico('gem_' + gm.type, 'ico inl')}${esc(MATERIALS[id].name)} x${S.mats[id]} · ${GEMS[gm.type].label(GEMS[gm.type].vals[gm.lv - 1])}` : `${ico(id, 'ico inl')}${esc(MATERIALS[id].name)} x${S.mats[id]} · ${esc(EFFECTS[fx].desc)}`);
          b.onclick = () => { this.sel.socketIdx = null; g.socketGem(ref, si, id); }; pick.appendChild(b);
        }
        body.appendChild(pick);
      } else body.appendChild(h('div', 'note', 'Click an empty socket to insert a gem. Soulstones (one per item) add a named power.'));
    } else body.appendChild(h('div', 'note', 'Pick a piece of gear. Uncommon/Rare have 1 socket, Special/Unique 2, Legendary and Red 3; a Socket Drill adds up to 2 more.'));
    // gem pouch with combining up to Celestial
    const tab = this.tabs(body, 'gemTab', [['classic', 'Classic Gems'], ['arcane', 'Arcane Gems'], ['soul', 'Soulstones']]);
    if (tab === 'soul') {
      const owned = Object.keys(SOULS).filter((fx) => g.matCount(soulId(fx)) > 0);
      const L = h('div', 'list');
      for (const fx of Object.keys(SOULS)) {
        const n = g.matCount(soulId(fx)), E = EFFECTS[fx];
        L.appendChild(h('div', 'row slim' + (n ? '' : ' locked'), `<div class="ic q5">${ico(soulId(fx))}</div><div class="tx"><b style="color:${E.tier === 'legendary' ? '#ffe27a' : '#ffb35a'}">${esc(SOULS[fx])} Soulstone${n ? ` x${n}` : ''}</b>${esc(E.desc)}</div>`));
      }
      const sf = h('div', 'row soulforge', `<div class="ic q5">${ico('soul_cache')}</div><div class="tx"><b>Soul Forge</b>Fuse ${SOUL_FORGE.gems} Brilliant gems of any kind into a random Soulstone (you have ${g.soulForgeGems().reduce((a, id) => a + g.matCount(id), 0)} Brilliant)<div class="cost">${costChips(g, { gold: SOUL_FORGE.gold, mats: SOUL_FORGE.mats })}</div></div>`);
      const b = h('button', 'btn small red', 'Fuse'); b.disabled = !g.canSoulForge(); b.onclick = () => g.soulForge(); sf.appendChild(b);
      body.appendChild(sf); body.appendChild(L);
      body.appendChild(h('div', 'note', `${owned.length} kinds owned. Soulstones drop from bosses and world bosses, come from Soulstone Chests (Opal) and the Soul Forge, and turn up at the Auction House.`));
      return;
    }
    body.appendChild(h('div', 'lbl', 'Combine 3 gems into 1 of the next level, up to Celestial'));
    const t = h('div', 'gem-table g5');
    for (const [type, gd] of Object.entries(GEMS)) {
      if (!!gd.arcane !== (tab === 'arcane')) continue;
      const r = h('div', 'gem-row', `<span class="gn" style="color:${gd.color}" title="${esc(gd.label(gd.vals[0]))} … ${esc(gd.label(gd.vals[GEM_MAX - 1]))}">${ico('gem_' + type, 'ico inl')}${gd.name}<small>up to ${esc(gd.label(gd.vals[GEM_MAX - 1]))}</small></span>`);
      for (let lv = 1; lv <= GEM_MAX; lv++) {
        const n = g.matCount(gemId(type, lv));
        const c = h('span', 'gc', `<b>${n}</b><small>${GEM_LV[lv - 1]}</small>`);
        if (lv < GEM_MAX) { const b = h('button', 'btn small', `${ico('combine', 'ico inl')}${fmt(GEM_COMBINE[lv].gold)}`); b.disabled = n < 3 || S.gold < GEM_COMBINE[lv].gold; b.title = `Combine 3 ${GEM_LV[lv - 1]} into 1 ${GEM_LV[lv]}`; b.onclick = () => g.combineGems(type, lv); c.appendChild(b); }
        r.appendChild(c);
      }
      t.appendChild(r);
    }
    body.appendChild(t);
    if (tab === 'arcane') body.appendChild(h('div', 'note', 'Arcane gems carry the rare stats: crit damage, lifesteal, cooldowns, move speed, thorns, regeneration, EXP and gold find.'));
  },

  // ------------------------------------------------------------ codex
  panel_codex(body) {
    const g = this.g, S = g.S, B = g.codexBonus();
    body.appendChild(h('div', 'codex-head', `<b>${B.found}/${NAMED_LIST.length}</b> named items discovered · Collection bonus <b>+${(B.atk * 100).toFixed(1)}% Attack & Max HP</b> (Unique +0.5%, Legendary +1% each)`));
    const ms = h('div', 'codex-ms');
    CODEX_MILESTONES.forEach((m, i) => {
      const got = S.codexClaim.includes(i), ready = B.found >= m.n && !got;
      const b = h('button', 'cms' + (got ? ' got' : ready ? ' ready' : ''), `<b>${m.n}</b><small>${esc(m.label)}</small>`);
      b.onclick = () => (ready ? g.claimCodex(i) : null);
      ms.appendChild(b);
    });
    body.appendChild(ms);
    const tab = this.tabs(body, 'cxTab', [['all', 'All'], ['4', 'Unique'], ['5', 'Legendary']]);
    const grid = h('div', 'codex-grid');
    for (const d of NAMED_LIST) {
      if (tab !== 'all' && +tab !== d.quality) continue;
      const found = !!S.codex[d.id], R = RARITY[d.quality], E = EFFECTS[d.effect];
      const c = h('div', 'cx q' + d.quality + (found ? '' : ' unk'), `<div class="ci">${ico(iconKey(d.slot, d.cls || S.cls, d.quality))}</div><b style="color:${found ? R.color : 'var(--dim)'}">${found ? esc(d.name) : '???'}</b><small>${R.name} ${SLOT_INFO[d.slot].label}${d.cls ? ` · ${CLASSES[d.cls].name}` : ''}</small>`);
      this.tip(c, () => `<b style="color:${R.color}">${found ? esc(d.name) : 'Undiscovered'}</b>${found ? `<div style="color:${E.tier === 'legendary' ? '#ffe27a' : '#ffb35a'}">${esc(E.name)}: ${esc(E.desc)}</div><div style="color:var(--muted)">"${esc(d.flavor)}"</div>` : ''}<div class="ts">Source: ${d.source ? esc(MONSTERS[d.source]?.name || d.source) : 'Any rare drop'}, Forge ascension, caches</div>`);
      grid.appendChild(c);
    }
    body.appendChild(grid);
  },

  // ------------------------------------------------------------ season pass
  panel_season(body) {
    const g = this.g, S = g.S, P2 = S.season, info = seasonInfo(), tier = g.passTier();
    const into = P2.exp - tier * PASS.perTier;
    body.appendChild(h('div', 'season-head', `<div><div class="sn">Season ${info.n}: ${esc(info.name)}</div><div class="muted">${ico('timer', 'ico inl')}Ends in ${fmtDur(info.ends)} · ${fmt(P2.exp)} season points</div></div><div class="tierbig"><small>TIER</small>${tier}</div>`));
    body.appendChild(h('div', 'g-bar big', `<i style="width:${tier >= PASS.tiers ? '100%' : pct(into, PASS.perTier)}"></i><span>${tier >= PASS.tiers ? 'MAX TIER' : `${fmt(into)} / ${PASS.perTier} to tier ${tier + 1}`}</span>`));
    const acts = h('div', 'acts-row');
    if (!P2.premium) { const b = h('button', 'btn', `Unlock Premium · <span class="gem" style="display:inline-block;vertical-align:-3px"></span> ${PASS.premium.diamonds}`); b.onclick = () => g.buyPremiumPass(); acts.appendChild(b); }
    else acts.appendChild(h('span', 'prem-on', 'PREMIUM ACTIVE'));
    const all = h('button', 'btn green small', 'Claim All'); all.disabled = !g.passClaimable(); all.onclick = () => g.claimAllPass(); acts.appendChild(all);
    body.appendChild(acts);
    const track = h('div', 'pass');
    for (let t = 1; t <= PASS.tiers; t++) {
      const col = h('div', 'pt' + (t <= tier ? ' reached' : '') + (t % 5 === 0 ? ' big' : ''));
      col.appendChild(h('div', 'ptn', String(t)));
      for (const prem of [false, true]) {
        const r = passReward(t, prem), got = (prem ? P2.prem : P2.free).includes(t);
        const icon = r.items ? ITEMS[r.items[0][0]].icon : r.mats ? MATERIALS[Object.keys(r.mats)[0]].icon : r.diamonds ? 'diamond' : 'gold';
        const c = h('button', 'pr' + (prem ? ' prem' : '') + (got ? ' got' : '') + (t <= tier && !got && (!prem || P2.premium) ? ' ready' : '') + (prem && !P2.premium ? ' lockd' : ''), `${ico(icon)}<small>${esc(r.label)}</small>`);
        c.onclick = () => g.claimPass(t, prem);
        col.appendChild(c);
      }
      track.appendChild(col);
    }
    body.appendChild(track);
    requestAnimationFrame(() => { track.scrollLeft = Math.max(0, (tier - 2) * 86); });
    body.appendChild(h('div', 'note', 'Earn season points from missions, kills, dungeons, world bosses and guild wars. At the end of the month your Season leaderboard rank pays out Diamonds (and a title for #1).'));
  },

  // ------------------------------------------------------------ festival
  panel_event(body) {
    const g = this.g, S = g.S, ev = g.event;
    if (!ev) {
      const n = nextEvent();
      body.appendChild(h('div', 'note', `No festival right now. Next up: <b>${esc(n.ev.name)}</b> in ${fmtDur(n.secs)}.`));
      const L = h('div', 'list');
      for (const e of EVENTS) L.appendChild(h('div', 'row slim', `<div class="ic">${ico('event')}</div><div class="tx"><b style="color:${e.color}">${esc(e.name)}</b>${esc(e.desc)}<br><span class="muted">${e.start} → ${e.end} (UTC)</span></div>`));
      body.appendChild(L); return;
    }
    const tok = ev.currency, have = g.matCount(tok);
    body.appendChild(h('div', 'ev-head', `<div class="ev-t" style="color:${ev.color}">${esc(ev.name)}</div><p>${esc(ev.desc)}</p><div class="ev-meta"><span>${ico(MATERIALS[tok].icon, 'ico inl')}<b>${fmt(have)}</b> ${esc(matName(tok))}</span><span class="muted">${ico('timer', 'ico inl')}Ends in ${fmtDur(eventEnds(ev))}</span><span class="muted">Collected ${fmt(S.ev.got)} this festival</span></div>`));
    const how = h('div', 'ev-how');
    how.innerHTML = `<div><img alt="" src="${g.monsterIcon(ev.monster)}"><span><b>${esc(MONSTERS[ev.monster].name)}</b>Found in every zone · 2-4 tokens each</span></div><div><img alt="" src="${g.monsterIcon(ev.boss)}"><span><b>${esc(MONSTERS[ev.boss].name)}</b>World Boss · 40 tokens</span></div><div>${ico('skull')}<span><b>Any monster</b>10% chance for a token</span></div>`;
    body.appendChild(how);
    const grid = h('div', 'mall-grid');
    for (const it of g.eventShopItems()) {
      const icon = it.kind === 'pet' ? `<img alt="" src="${g.petIcon(ev.pet)}">` : it.kind === 'wings' ? ico('wings') : it.kind === 'title' ? ico('crown') : it.kind === 'item' ? ico(ITEMS[it.id2].icon) : ico(MATERIALS[it.id2].icon);
      const c = h('div', 'mall-item', `<div class="mi">${icon}</div><div>${esc(it.name)}</div><div class="price">${ico(MATERIALS[tok].icon, 'ico inl')}${fmt(it.cost)}</div><small class="muted">${it.owned ? 'Owned' : `${it.left}/${it.max} left`}</small>`);
      const b = h('button', 'btn small' + (it.owned ? ' gray' : ''), it.owned ? 'Owned' : 'Exchange'); b.disabled = it.owned || it.left <= 0 || have < it.cost; b.onclick = () => g.eventBuy(it.id);
      c.appendChild(b); grid.appendChild(c);
    }
    body.appendChild(grid);
  },

  // ------------------------------------------------------------ leaderboards
  panel_rank(body) {
    const g = this.g, S = g.S;
    const tab = this.tabs(body, 'rankTab', [['br', 'Battle Rating'], ['level', 'Level'], ['wboss', 'World Boss'], ['dungeon', 'Dungeon Speed'], ['season', 'Season'], ['war', 'Guild War'], ['guild', 'Guilds']]);
    if (tab === 'dungeon') {
      const ch = h('div', 'chips');
      for (const d of DUNGEONS) { const b = h('button', 'chip' + ((this.sel.lbDungeon || 'd1') === d.id ? ' sel' : ''), esc(d.name)); b.onclick = () => { this.sel.lbDungeon = d.id; this.renderPanel(); }; ch.appendChild(b); }
      body.appendChild(ch);
    }
    const { rows, fmtv } = g.lbRows(tab);
    const t = h('div', 'rank-table');
    const valHead = { br: 'BR', level: 'Level', wboss: 'Best damage', dungeon: 'Best time', season: 'Points', war: 'Wins', guild: 'Power' }[tab];
    t.appendChild(h('div', 'rank-row hd', `<span class="rk">#</span><span>${tab === 'guild' ? 'Guild' : 'Name'}</span><span class="cls">${tab === 'guild' ? 'Level' : 'Class'}</span><span style="text-align:right">${valHead}</span>`));
    rows.slice(0, 20).forEach((r, i) => t.appendChild(this.rankRow(r, i, tab, fmtv)));
    const mi = rows.findIndex((r) => r.me);
    if (mi >= 20) t.appendChild(this.rankRow(rows[mi], mi, tab, fmtv));
    body.appendChild(t);
    if (tab === 'season') body.appendChild(h('div', 'note', `Season ends in ${fmtDur(seasonInfo().ends)}. Rewards: ${SEASON_RANK_REWARDS.map((x) => x.label).join(' · ')}`));
    if (tab === 'guild' && !S.guild) body.appendChild(h('div', 'note', 'Join or found a guild to appear on this board.'));
  },
  rankRow(r, i, tab, fmtv) {
    const cls = tab === 'guild' ? `<span class="cls">Lv ${r.lv}</span>` : `<span class="cls" style="color:${CLASSES[r.cls]?.elemColor || '#fff'}">${CLASSES[r.cls]?.name || ''}</span>`;
    const nm = tab === 'guild' ? `<span style="color:${r.color}">${esc(r.name)}</span>` : `${esc(r.name)}${r.guild ? ` <small class="muted">&lt;${esc(r.guild)}&gt;</small>` : ''}`;
    return h('div', 'rank-row' + (r.me ? ' me' : ''), `<span class="rk ${i < 3 ? 'top' + (i + 1) : ''}">${i + 1}</span><span>${nm}</span>${cls}<span class="num" style="text-align:right">${fmtv(r.v)}</span>`);
  },
};
export function installSystemsUI(UI) { Object.assign(UI.prototype, P); }
