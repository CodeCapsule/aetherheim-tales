// Game Master console: a full-screen panel opened from the server list on the title screen (owner and editors only).
// It reads the players/* status documents the game reports, the live config and the global gifts from the artifact's
// shared database, and writes announcements, EXP/Gold events, maintenance notices and gifts. A local copy (no database)
// shows this browser's own save instead.
import { CLASSES, ITEMS, DUNGEONS } from './data.js';
import { MATERIALS, WORLD_BOSS, activeEvent, seasonInfo, secsToDayEnd, fmtDur } from './systems-data.js';
import { RARITY } from './loot.js';
import { live, onLive, LIVE_VERSION } from './live.js';
import { ico } from './icons.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const ago = (t) => { if (!t) return '—'; const s = Math.max(0, (Date.now() - t) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`; };
const hrs = (sec) => (sec >= 3600 ? `${(sec / 3600).toFixed(1)} h` : `${Math.round(sec / 60)} min`);
const ONLINE_MS = 3 * 60 * 1000;
const EVENT_LABEL = { login: 'Login', level: 'Level up', death: 'Death', dungeon: 'Dungeon clear', dungeonFail: 'Dungeon failed', loot: 'Rare loot', red: 'Red item', enhance: 'Enhance', soul: 'Soulstone', worldboss: 'World boss', war: 'Guild war', gift: 'Gift', story: 'Story', set: 'Set item' };
const HIDE_KEY = 'alfheim_admin_err_hide';

function localStatus(S) {
  if (!S) return null;
  return {
    id: 'local', local: true, name: S.name, cls: S.cls, level: S.level, br: 0, gold: S.gold, diamonds: S.diamonds, zone: 'This browser', where: 'world',
    playSecs: S.stats?.playSecs || 0, deaths: S.stats?.deaths || 0, kills: Object.values(S.kills || {}).reduce((a, b) => a + b, 0),
    dgClears: Object.values(S.dgn?.clears || {}).reduce((a, b) => a + b, 0), guild: S.guild?.name || null, red: S.life?.red || 0,
    equip: Object.entries(S.equip || {}).filter(([, e]) => e).map(([slot, e]) => ({ slot, name: e.name, q: e.quality, enh: e.enh || 0, lvl: e.lvl })),
    prof: Object.fromEntries(Object.entries(S.prof || {}).map(([k, v]) => [k, v.lv])), pets: Object.keys(S.pets || {}).length, mounts: (S.mounts || []).length,
    lastSeen: Date.now(), firstSeen: S.stats?.firstSeen, events: [], errors: live.errors.slice(0, 10), version: LIVE_VERSION,
  };
}

export class AdminPanel {
  constructor(getSave) {
    this.getSave = getSave; this.el = null; this.players = []; this.tab = 'overview'; this.sel = null; this.q = ''; this.sort = 'lastSeen'; this.feedType = 'all';
    this.names = {}; this.unsub = null; this.offLive = null; this.tick = null;
  }
  // on claude.ai: owner and editors; in a copy elsewhere (local dev, GitHub Pages) only on a dev host or with #admin
  allowed() { return live.framed ? live.admin : (['localhost', '127.0.0.1', ''].includes(location.hostname) || location.hash === '#admin'); }
  canWrite() { return !!(live.db && live.admin); }
  open(tab) {
    if (!this.allowed()) return;
    if (tab) this.tab = tab;
    if (!this.el) { this.el = h('section', 'screen admin'); this.el.id = 'scr-admin'; $('app').appendChild(this.el); }
    this.el.hidden = false;
    if (live.db && live.admin && !this.unsub) {
      this.unsub = live.db.collection('players').orderBy('lastSeen', 'desc').limit(500).onSnapshot((q) => {
        this.players = q.docs.map((d) => ({ id: d.id, ...d.data() })); this.resolveNames(); this.render();
      }, (e) => { this.err = e.code; this.render(); });
    }
    this.offLive = this.offLive || onLive(() => this.render());
    clearInterval(this.tick); this.tick = setInterval(() => { if (!this.el.hidden && this.tab === 'overview') this.render(); }, 15000);
    this.render();
  }
  close() { if (this.el) this.el.hidden = true; clearInterval(this.tick); if (this.unsub) { this.unsub(); this.unsub = null; } this.onClose && this.onClose(); }
  async resolveNames() {
    if (!live.user) return;
    const ids = this.players.map((p) => p.id);
    try { const ps = await live.user.profiles(ids); for (const id of ids) this.names[id] = ps[id]?.name || ''; this.render(); } catch { /* names stay blank */ }
  }
  list() {
    if (live.db && live.admin) return this.players;
    const S = this.getSave(); const L = localStatus(S); return L ? [L] : [];
  }
  render() {
    if (!this.el || this.el.hidden) return;
    const keepScroll = this.el.querySelector('.adm-body')?.scrollTop || 0;
    const mode = live.db && live.admin ? 'live' : live.framed ? 'nodb' : 'local';
    this.el.innerHTML = '';
    const head = h('div', 'adm-head', `<div class="adm-title">${ico('crown', 'ico')}<div><b>Game Master Console</b><small>Aetherheim Tales · ${esc(LIVE_VERSION)}</small></div></div>
      <div class="adm-status ${mode}">${mode === 'live' ? `<i></i>Live database · ${this.players.length} player${this.players.length === 1 ? '' : 's'} reporting` : mode === 'nodb' ? '<i></i>Database unavailable in this view' : '<i></i>Local copy · this browser only'}</div>`);
    const x = h('button', 'btn gray small adm-close', 'Back'); x.onclick = () => this.close(); head.appendChild(x);
    this.el.appendChild(head);
    const tabs = h('div', 'tabs adm-tabs');
    for (const [id, label] of [['overview', 'Overview'], ['players', 'Players'], ['activity', 'Activity'], ['errors', 'Errors'], ['broadcast', 'Broadcast & Events'], ['gifts', 'Gifts'], ['local', 'This Browser']]) {
      const b = h('button', this.tab === id ? 'sel' : '', label); b.onclick = () => { this.tab = id; this.sel = null; this.render(); }; tabs.appendChild(b);
    }
    this.el.appendChild(tabs);
    const body = h('div', 'adm-body'); this.el.appendChild(body);
    if (mode !== 'live' && ['broadcast', 'gifts'].includes(this.tab)) body.appendChild(h('div', 'adm-note warn', mode === 'local' ? 'This is a local copy of the game, so there is no shared database. Broadcasts, events and gifts work in the published claude.ai version, opened by the owner or an editor.' : 'The shared database is not available in this view, so changes cannot be saved. Open the game from its claude.ai link while signed in.'));
    this['tab_' + this.tab](body);
    body.scrollTop = keepScroll;
    this.bindTips();
  }

  // ------------------------------------------------------------ overview
  tab_overview(body) {
    const P = this.list(), now = Date.now();
    const online = P.filter((p) => now - p.lastSeen < ONLINE_MS), day = P.filter((p) => now - p.lastSeen < 86400000);
    const avg = P.length ? P.reduce((a, p) => a + (p.level || 0), 0) / P.length : 0;
    const top = P.reduce((a, p) => Math.max(a, p.level || 0), 0);
    const tiles = [
      ['Players', fmt(P.length), 'have reported in'], ['Online now', fmt(online.length), 'active in the last 3 min'], ['Active today', fmt(day.length), 'seen in the last 24 h'],
      ['Average level', avg.toFixed(1), `highest Lv ${top}`], ['Play time', hrs(P.reduce((a, p) => a + (p.playSecs || 0), 0)), 'all players'],
      ['Gold held', fmt(P.reduce((a, p) => a + (p.gold || 0), 0)), 'across all heroes'], ['Dungeon clears', fmt(P.reduce((a, p) => a + (p.dgClears || 0), 0)), 'total'],
      ['Deaths', fmt(P.reduce((a, p) => a + (p.deaths || 0), 0)), 'total'], ['Red items', fmt(P.reduce((a, p) => a + (p.red || 0), 0)), 'forged'],
    ];
    const tg = h('div', 'adm-tiles');
    for (const [k, v, sub] of tiles) tg.appendChild(h('div', 'adm-tile', `<span>${k}</span><b>${v}</b><small>${sub}</small>`));
    body.appendChild(tg);
    const grid = h('div', 'adm-grid');
    // level distribution
    const bins = Array.from({ length: 10 }, (_, i) => ({ label: `${i * 20 + 1}`, range: `${i * 20 + 1}-${i * 20 + 20}`, n: 0 }));
    for (const p of P) bins[Math.min(9, Math.floor(((p.level || 1) - 1) / 20))].n++;
    grid.appendChild(this.barChart('Players by level', bins, 'level band'));
    // classes
    const cls = Object.keys(CLASSES).map((c) => ({ label: CLASSES[c].name, n: P.filter((p) => p.cls === c).length }));
    grid.appendChild(this.hbarChart('Players by class', cls));
    // server clocks
    const s = now / 1000, slot = Math.floor(s / WORLD_BOSS.every), into = s - slot * WORLD_BOSS.every, wbOn = into < WORLD_BOSS.lasts;
    const ev = activeEvent(), season = seasonInfo(), c = live.config || {}, b = c.boost && c.boost.until > now ? c.boost : null;
    grid.appendChild(h('div', 'adm-card', `<h4>Server clock</h4><dl>
      <dt>World boss</dt><dd>${wbOn ? `<span class="good">Active</span> · ends in ${fmtDur(WORLD_BOSS.lasts - into)}` : `next in ${fmtDur(WORLD_BOSS.every - into)}`}</dd>
      <dt>Daily reset</dt><dd>in ${fmtDur(secsToDayEnd())} (00:00 UTC)</dd>
      <dt>Festival</dt><dd>${ev ? esc(ev.name) : 'none'}</dd>
      <dt>Season</dt><dd>${esc(season?.name || '')} (${esc(season?.key || '')})</dd>
      <dt>Live event</dt><dd>${b ? `<span class="good">${esc(b.name)}</span> · x${b.exp} EXP · x${b.gold} Gold · ends ${new Date(b.until).toLocaleString()}` : 'none'}</dd>
      <dt>Announcement</dt><dd>${c.motd ? esc(c.motd) : 'none'}</dd></dl>`));
    // where players are now
    const zones = {};
    for (const p of online) zones[p.zone || '?'] = (zones[p.zone || '?'] || 0) + 1;
    const zl = Object.entries(zones).sort((a, b2) => b2[1] - a[1]);
    grid.appendChild(h('div', 'adm-card', `<h4>Online players by zone</h4>${zl.length ? `<ul class="adm-zl">${zl.map(([z, n]) => `<li><span>${esc(z)}</span><b>${n}</b></li>`).join('')}</ul>` : '<p class="muted">Nobody is online right now.</p>'}`));
    body.appendChild(grid);
    if (live.framed && live.db) body.appendChild(h('div', 'adm-note', 'Players appear here after they open the game while signed in with Contributor access or higher (view-only visitors cannot report). Status updates arrive about once a minute while someone plays.'));
  }
  barChart(title, bins, unit) {
    const max = Math.max(1, ...bins.map((b) => b.n));
    const c = h('div', 'adm-card', `<h4>${title}</h4>`);
    const ch = h('div', 'adm-bars');
    for (const b of bins) {
      const col = h('div', 'adm-bar', `<em>${b.n || ''}</em><i style="height:${Math.round((b.n / max) * 100)}%"></i><span>${b.label}</span>`);
      col.dataset.tip = `${b.n} player${b.n === 1 ? '' : 's'} · ${unit} ${b.range || b.label}`;
      ch.appendChild(col);
    }
    c.appendChild(ch);
    c.appendChild(h('small', 'muted', 'Each bar is 20 levels, labelled by its first level.'));
    return c;
  }
  hbarChart(title, rows) {
    const max = Math.max(1, ...rows.map((r) => r.n));
    const c = h('div', 'adm-card', `<h4>${title}</h4>`);
    const ch = h('div', 'adm-hbars');
    for (const r of rows) { const row = h('div', 'adm-hbar', `<span>${esc(r.label)}</span><i><b style="width:${(r.n / max) * 100}%"></b></i><em>${r.n}</em>`); row.dataset.tip = `${r.label}: ${r.n} player${r.n === 1 ? '' : 's'}`; ch.appendChild(row); }
    c.appendChild(ch);
    return c;
  }
  bindTips() {
    let tip = $('adm-tip'); if (!tip) { tip = h('div', 'adm-tipbox'); tip.id = 'adm-tip'; document.body.appendChild(tip); }
    this.el.querySelectorAll('[data-tip]').forEach((n) => {
      n.onmouseenter = () => { tip.textContent = n.dataset.tip; tip.hidden = false; };
      n.onmousemove = (e) => { tip.style.left = e.clientX + 12 + 'px'; tip.style.top = e.clientY - 30 + 'px'; };
      n.onmouseleave = () => { tip.hidden = true; };
    });
    tip.hidden = true;
  }

  // ------------------------------------------------------------ players
  tab_players(body) {
    const now = Date.now();
    let P = this.list();
    const bar = h('div', 'adm-bar-row');
    const q = h('input', 'adm-input'); q.placeholder = 'Search hero or guild'; q.value = this.q; q.oninput = () => { this.q = q.value; this.renderPlayersTable(tbl); };
    const so = h('select', 'adm-input', [['lastSeen', 'Last seen'], ['level', 'Level'], ['br', 'Battle Rating'], ['gold', 'Gold'], ['playSecs', 'Play time']].map(([v, l]) => `<option value="${v}"${this.sort === v ? ' selected' : ''}>Sort: ${l}</option>`).join(''));
    so.onchange = () => { this.sort = so.value; this.renderPlayersTable(tbl); };
    bar.appendChild(q); bar.appendChild(so);
    bar.appendChild(h('span', 'muted', `${P.filter((p) => now - p.lastSeen < ONLINE_MS).length} online · ${P.length} total`));
    body.appendChild(bar);
    const wrap = h('div', 'adm-split');
    const tbl = h('div', 'adm-table-wrap');
    wrap.appendChild(tbl);
    const det = h('div', 'adm-detail'); wrap.appendChild(det);
    body.appendChild(wrap);
    this.renderPlayersTable(tbl);
    this.renderDetail(det);
  }
  renderPlayersTable(tbl) {
    const now = Date.now(), q = this.q.trim().toLowerCase();
    let P = this.list().filter((p) => !q || `${p.name} ${p.guild || ''} ${this.names[p.id] || ''}`.toLowerCase().includes(q));
    P = [...P].sort((a, b) => (b[this.sort] || 0) - (a[this.sort] || 0));
    tbl.innerHTML = `<table class="adm-table"><thead><tr><th></th><th>Hero</th><th>Class</th><th class="n">Lv</th><th class="n">BR</th><th>Zone</th><th class="n">Gold</th><th class="n">Played</th><th>Last seen</th></tr></thead><tbody></tbody></table>`;
    const tb = tbl.querySelector('tbody');
    if (!P.length) tb.innerHTML = '<tr><td colspan="9" class="muted">No players yet.</td></tr>';
    for (const p of P) {
      const on = now - p.lastSeen < ONLINE_MS;
      const tr = h('tr', this.sel === p.id ? 'sel' : '', `<td><i class="dot ${on ? 'on' : ''}" title="${on ? 'Online' : 'Offline'}"></i></td><td><b>${esc(p.name)}</b>${p.flags?.macro ? ' <span class="bad" title="The same input sequence with identical timing repeated for a long time: please review">⚑ review</span>' : ''}${this.names[p.id] ? `<small>${esc(this.names[p.id])}</small>` : ''}</td>
        <td>${esc(CLASSES[p.cls]?.name || p.cls)}</td><td class="n">${p.level}</td><td class="n">${fmt(p.br)}</td><td>${esc(p.zone || '')}</td><td class="n">${fmt(p.gold)}</td><td class="n">${hrs(p.playSecs || 0)}</td><td>${on ? '<span class="good">Online</span>' : ago(p.lastSeen)}</td>`);
      tr.onclick = () => { this.sel = p.id; this.render(); };
      tb.appendChild(tr);
    }
  }
  renderDetail(det) {
    const p = this.list().find((x) => x.id === this.sel);
    if (!p) { det.innerHTML = '<p class="muted">Select a player to see their gear, progress, recent activity and errors.</p>'; return; }
    det.innerHTML = `<h3>${esc(p.name)} <small>Lv ${p.level} ${esc(CLASSES[p.cls]?.name || '')}${p.guild ? ` · ${esc(p.guild)}` : ''}</small></h3>
      ${this.names[p.id] ? `<p class="muted">Account: ${esc(this.names[p.id])}</p>` : ''}
      <dl class="adm-dl"><dt>Battle Rating</dt><dd>${fmt(p.br)}</dd><dt>Gold / Diamonds</dt><dd>${fmt(p.gold)} / ${fmt(p.diamonds)}</dd><dt>Location</dt><dd>${esc(p.zone || '')}${p.pos ? ` (${p.pos.join(', ')})` : ''}</dd>
      <dt>Play time</dt><dd>${hrs(p.playSecs || 0)}</dd><dt>Kills / Deaths</dt><dd>${fmt(p.kills)} / ${fmt(p.deaths)}</dd><dt>Dungeon clears</dt><dd>${fmt(p.dgClears)}</dd>
      <dt>Collections / Red</dt><dd>${p.collSets || 0} sets / ${p.red || 0} Red</dd><dt>Pets / Mounts</dt><dd>${p.pets || 0} / ${p.mounts || 0}</dd>
      <dt>Device</dt><dd>${esc(p.device || '')} · ${esc(p.version || '')}</dd><dt>First seen</dt><dd>${p.firstSeen ? new Date(p.firstSeen).toLocaleDateString() : '—'}</dd></dl>
      <h4>Equipment</h4><ul class="adm-eq">${(p.equip || []).map((e) => `<li style="color:${RARITY[e.q]?.color || '#fff'}">${esc(e.name)}${e.enh ? ` +${e.enh}` : ''} <small>Lv ${e.lvl}</small></li>`).join('') || '<li class="muted">Nothing equipped</li>'}</ul>
      <h4>Professions</h4><p class="muted">${Object.entries(p.prof || {}).map(([k, v]) => `${k} ${v}`).join(' · ') || '—'}</p>
      <h4>Recent activity</h4><ul class="adm-feed small">${(p.events || []).slice(0, 10).map((e) => `<li><span class="tag t-${e.type}">${EVENT_LABEL[e.type] || e.type}</span>${esc(e.text)}<small>${ago(e.t)}</small></li>`).join('') || '<li class="muted">No activity yet</li>'}</ul>
      ${(p.errors || []).length ? `<h4>Errors</h4><ul class="adm-feed small">${p.errors.map((e) => `<li><span class="tag t-death">x${e.n}</span>${esc(e.msg)}<small>${esc(e.src || '')}</small></li>`).join('')}</ul>` : ''}`;
    if (live.db && live.owner && !p.local) det.appendChild(this.giftForm((gift) => live.db.collection(`players/${p.id}/mail`).add(gift), `Send ${esc(p.name)} a gift`));
    else if (live.db && !p.local) det.appendChild(h('p', 'muted', 'Only the owner can send gifts to one player; editors can post gifts for everyone on the Gifts tab.'));
  }

  // ------------------------------------------------------------ activity feed
  tab_activity(body) {
    const evs = [];
    for (const p of this.list()) for (const e of p.events || []) evs.push({ ...e, who: p.name });
    evs.sort((a, b) => b.t - a.t);
    const types = ['all', ...new Set(evs.map((e) => e.type))];
    const chips = h('div', 'chips');
    for (const t of types) { const b = h('button', 'chip' + (this.feedType === t ? ' sel' : ''), t === 'all' ? 'All' : EVENT_LABEL[t] || t); b.onclick = () => { this.feedType = t; this.render(); }; chips.appendChild(b); }
    body.appendChild(chips);
    const L = h('ul', 'adm-feed');
    const list = evs.filter((e) => this.feedType === 'all' || e.type === this.feedType).slice(0, 150);
    L.innerHTML = list.map((e) => `<li><span class="tag t-${e.type}">${EVENT_LABEL[e.type] || e.type}</span><b>${esc(e.who)}</b> ${esc(e.text)}<small>${ago(e.t)}</small></li>`).join('') || '<li class="muted">No activity yet.</li>';
    body.appendChild(L);
  }

  // ------------------------------------------------------------ errors
  tab_errors(body) {
    let hideBefore = 0; try { hideBefore = +localStorage.getItem(HIDE_KEY) || 0; } catch { /* storage unavailable */ }
    const groups = new Map();
    for (const p of this.list()) for (const e of p.errors || []) {
      if (e.t < hideBefore) continue;
      const g = groups.get(e.msg) || { msg: e.msg, src: e.src, n: 0, players: new Set(), last: 0, versions: new Set() };
      g.n += e.n || 1; g.players.add(p.name); g.last = Math.max(g.last, e.t); if (p.version) g.versions.add(p.version); groups.set(e.msg, g);
    }
    const rows = [...groups.values()].sort((a, b) => b.last - a.last);
    const bar = h('div', 'adm-bar-row', `<span class="muted">${rows.length ? `${rows.length} distinct error${rows.length === 1 ? '' : 's'} reported by players` : 'No errors reported.'}</span>`);
    const hide = h('button', 'btn small gray', 'Hide current errors'); hide.onclick = () => { try { localStorage.setItem(HIDE_KEY, String(Date.now())); } catch { /* ignore */ } this.render(); };
    const show = h('button', 'btn small gray', 'Show all'); show.onclick = () => { try { localStorage.removeItem(HIDE_KEY); } catch { /* ignore */ } this.render(); };
    bar.appendChild(hide); bar.appendChild(show);
    body.appendChild(bar);
    if (!rows.length) return;
    const t = h('div', 'adm-table-wrap', `<table class="adm-table"><thead><tr><th>Error</th><th class="n">Count</th><th>Players</th><th>Where</th><th>Last</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="err">${esc(r.msg)}</td><td class="n">${r.n}</td><td>${esc([...r.players].slice(0, 4).join(', '))}${r.players.size > 4 ? ` +${r.players.size - 4}` : ''}</td><td>${esc(r.src || '')}<small>${esc([...r.versions].join(', '))}</small></td><td>${ago(r.last)}</td></tr>`).join('')}</tbody></table>`);
    body.appendChild(t);
  }

  // ------------------------------------------------------------ broadcast, live events, maintenance
  async saveConfig(patch) {
    if (!this.canWrite()) return;
    try { await live.db.doc('config/live').set({ ...(live.config || {}), ...patch }); this.flash('Saved — players see it within a minute.'); } catch (e) { this.flash(`Could not save (${e.code || 'error'})`, true); }
  }
  flash(msg, bad) { const f = h('div', 'adm-flash' + (bad ? ' bad' : ''), esc(msg)); this.el.appendChild(f); setTimeout(() => f.remove(), 2600); }
  tab_broadcast(body) {
    const c = live.config || {}, now = Date.now(), dis = this.canWrite() ? '' : ' disabled';
    const motd = h('div', 'adm-card', `<h4>Announcement</h4><p class="muted">Shown on the title screen and posted in every player's chat when they play.</p>
      <textarea class="adm-input" id="adm-motd" maxlength="240" rows="3" placeholder="e.g. Double EXP this weekend!">${esc(c.motd || '')}</textarea>
      <div class="adm-bar-row"><button class="btn small green" id="adm-motd-go"${dis}>Publish</button><button class="btn small gray" id="adm-motd-clear"${dis}>Clear</button>${c.motdT ? `<span class="muted">Published ${ago(c.motdT)}</span>` : ''}</div>`);
    body.appendChild(motd);
    motd.querySelector('#adm-motd-go').onclick = () => { const v = motd.querySelector('#adm-motd').value.trim(); if (v) this.saveConfig({ motd: v, motdT: Date.now() }); };
    motd.querySelector('#adm-motd-clear').onclick = () => this.saveConfig({ motd: '', motdT: Date.now() });
    const b = c.boost && c.boost.until > now ? c.boost : null;
    const ev = h('div', 'adm-card', `<h4>EXP / Gold event</h4><p class="muted">Multiplies EXP and Gold from monsters for every player until it ends.</p>
      ${b ? `<p><span class="good">Running:</span> ${esc(b.name)} · x${b.exp} EXP · x${b.gold} Gold · ends ${new Date(b.until).toLocaleString()}</p>` : '<p class="muted">No event running.</p>'}
      <div class="adm-form"><label>Name <input class="adm-input" id="ev-name" value="${esc(b?.name || 'Double EXP Event')}" maxlength="40"></label>
      <label>EXP <select class="adm-input" id="ev-exp">${[1, 1.5, 2, 3].map((v) => `<option${(b?.exp || 2) === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Gold <select class="adm-input" id="ev-gold">${[1, 1.5, 2, 3].map((v) => `<option${(b?.gold || 1) === v ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Hours <select class="adm-input" id="ev-hrs">${[1, 2, 6, 12, 24, 48, 72].map((v) => `<option${v === 24 ? ' selected' : ''}>${v}</option>`).join('')}</select></label></div>
      <div class="adm-bar-row"><button class="btn small green" id="ev-go"${dis}>${b ? 'Restart event' : 'Start event'}</button>${b ? `<button class="btn small gray" id="ev-stop"${dis}>End now</button>` : ''}</div>`);
    body.appendChild(ev);
    ev.querySelector('#ev-go').onclick = () => this.saveConfig({ boost: { name: ev.querySelector('#ev-name').value.trim() || 'Live Event', exp: +ev.querySelector('#ev-exp').value, gold: +ev.querySelector('#ev-gold').value, until: Date.now() + (+ev.querySelector('#ev-hrs').value) * 3600000 } });
    const st = ev.querySelector('#ev-stop'); if (st) st.onclick = () => this.saveConfig({ boost: null });
    const m = c.maint || {};
    const mt = h('div', 'adm-card', `<h4>Maintenance notice</h4><p class="muted">A warning banner on the title screen and a notice in game (the game keeps working).</p>
      <textarea class="adm-input" id="mt-text" maxlength="200" rows="2" placeholder="e.g. Update tonight at 20:00 UTC">${esc(m.text || '')}</textarea>
      <div class="adm-bar-row"><button class="btn small ${m.on ? 'gray' : 'red'}" id="mt-go"${dis}>${m.on ? 'Turn off' : 'Show notice'}</button>${m.on ? '<span class="good">Notice is showing</span>' : ''}</div>`);
    body.appendChild(mt);
    mt.querySelector('#mt-go').onclick = () => this.saveConfig({ maint: { on: !m.on, text: mt.querySelector('#mt-text').value.trim(), t: Date.now() } });
  }

  // ------------------------------------------------------------ gifts
  giftForm(send, title) {
    const f = h('div', 'adm-card', `<h4>${title}</h4><div class="adm-form">
      <label>Title <input class="adm-input" data-k="title" maxlength="50" value="A gift from the Game Masters"></label>
      <label>Note <input class="adm-input" data-k="note" maxlength="120" placeholder="Optional message"></label>
      <label>Gold <input class="adm-input" data-k="gold" type="number" min="0" max="10000000" value="0"></label>
      <label>Diamonds <input class="adm-input" data-k="diamonds" type="number" min="0" max="100000" value="0"></label>
      <label>Item <select class="adm-input" data-k="item"><option value="">—</option>${Object.entries(ITEMS).filter(([, it]) => it.type !== 'quest').map(([id, it]) => `<option value="${id}">${esc(it.name)}</option>`).join('')}</select></label>
      <label>Qty <input class="adm-input" data-k="itemQty" type="number" min="1" max="999" value="1"></label>
      <label>Material <select class="adm-input" data-k="mat"><option value="">—</option>${Object.entries(MATERIALS).filter(([, m]) => !m.notrade).map(([id, m]) => `<option value="${id}">${esc(m.name)}</option>`).join('')}</select></label>
      <label>Qty <input class="adm-input" data-k="matQty" type="number" min="1" max="999" value="1"></label></div>
      <div class="adm-bar-row"><button class="btn small green"${this.canWrite() ? '' : ' disabled'}>Send</button></div>`);
    const v = (k) => f.querySelector(`[data-k="${k}"]`).value;
    f.querySelector('button').onclick = async () => {
      const gift = { title: v('title').trim() || 'A gift', note: v('note').trim(), gold: Math.max(0, Math.min(1e7, +v('gold') || 0)), diamonds: Math.max(0, Math.min(1e5, +v('diamonds') || 0)), items: v('item') ? [[v('item'), Math.max(1, Math.min(999, +v('itemQty') || 1))]] : [], mats: v('mat') ? [[v('mat'), Math.max(1, Math.min(999, +v('matQty') || 1))]] : [], t: Date.now() };
      if (!gift.gold && !gift.diamonds && !gift.items.length && !gift.mats.length) { this.flash('Add something to the gift first', true); return; }
      try { await send(gift); this.flash('Gift sent'); this.render(); } catch (e) { this.flash(`Could not send (${e.code || 'error'})`, true); }
    };
    return f;
  }
  tab_gifts(body) {
    const form = this.giftForm((gift) => {
      const days = +this.el.querySelector('#gf-days').value || 7, minLv = +this.el.querySelector('#gf-lv').value || 0;
      return live.db.collection('gifts').add({ ...gift, until: Date.now() + days * 86400000, minLv });
    }, 'Gift for every player');
    const extra = h('div', 'adm-form', `<label>Claimable for <select class="adm-input" id="gf-days">${[1, 3, 7, 14, 30].map((d) => `<option value="${d}"${d === 7 ? ' selected' : ''}>${d} day${d > 1 ? 's' : ''}</option>`).join('')}</select></label>
      <label>Minimum level <input class="adm-input" id="gf-lv" type="number" min="0" max="200" value="0"></label>`);
    form.insertBefore(extra, form.querySelector('.adm-bar-row'));
    body.appendChild(form);
    const L = h('div', 'adm-card', '<h4>Recent gifts</h4>');
    const ul = h('ul', 'adm-feed');
    for (const gf of live.gifts || []) {
      const parts = [gf.gold && `${fmt(gf.gold)} Gold`, gf.diamonds && `${fmt(gf.diamonds)} Diamonds`, ...(gf.items || []).map(([id, n]) => `${ITEMS[id]?.name || id} x${n}`), ...(gf.mats || []).map(([id, n]) => `${MATERIALS[id]?.name || id} x${n}`)].filter(Boolean);
      const li = h('li', '', `<span class="tag t-gift">${gf.until < Date.now() ? 'Expired' : 'Active'}</span><b>${esc(gf.title)}</b> ${esc(parts.join(', '))}${gf.minLv ? ` · Lv ${gf.minLv}+` : ''}<small>${ago(gf.t)}</small>`);
      if (this.canWrite()) { const d = h('button', 'btn small gray', 'Delete'); d.onclick = async () => { try { await live.db.doc('gifts/' + gf.id).delete(); this.flash('Gift removed'); } catch (e) { this.flash(`Could not delete (${e.code || 'error'})`, true); } }; li.appendChild(d); }
      ul.appendChild(li);
    }
    if (!ul.children.length) ul.innerHTML = '<li class="muted">No gifts yet.</li>';
    L.appendChild(ul); body.appendChild(L);
  }

  // ------------------------------------------------------------ this browser's save
  tab_local(body) {
    const S = this.getSave();
    if (!S) { body.appendChild(h('div', 'adm-note', 'No hero saved in this browser yet.')); return; }
    const p = localStatus(S);
    body.appendChild(h('div', 'adm-card', `<h4>${esc(S.name)} · Lv ${S.level} ${esc(CLASSES[S.cls]?.name || '')}</h4><dl class="adm-dl">
      <dt>Gold / Diamonds</dt><dd>${fmt(S.gold)} / ${fmt(S.diamonds)}</dd><dt>Bag</dt><dd>${S.bag.length} / ${S.bagMax || 48}</dd><dt>Play time</dt><dd>${hrs(p.playSecs)}</dd>
      <dt>Dungeons cleared</dt><dd>${Object.entries(S.dgn?.clears || {}).map(([id, n]) => `${esc(DUNGEONS.find((d) => d.id === id)?.name || id)} x${n}`).join(', ') || '—'}</dd>
      <dt>Save size</dt><dd>${fmt(JSON.stringify(S).length / 1024)} KB</dd></dl>`));
    const raw = h('div', 'adm-card', '<h4>Raw save (read only)</h4>');
    const ta = h('textarea', 'adm-input mono'); ta.readOnly = true; ta.rows = 12; ta.value = JSON.stringify(S, null, 1);
    const cp = h('button', 'btn small', 'Copy to clipboard'); cp.onclick = async () => { try { await navigator.clipboard.writeText(ta.value); this.flash('Copied'); } catch { ta.select(); } };
    raw.appendChild(ta); raw.appendChild(cp); body.appendChild(raw);
  }
}
