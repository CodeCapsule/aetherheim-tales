// Clicking another player opens a small menu: add them as a friend, inspect their character, invite them to your
// party or ask for a trade. Friends are kept by name in your save, and the Online panel lists them with who is on now.
// Friend requests and inspect answers travel on the realtime channel ('f' broadcast); an inspect answer carries the
// other player's worn gear and main stats, cleaned like any gear that comes over the network.
import { mp } from './mp.js';
import { CLASSES, SLOTS, SLOT_INFO, WEAPON_ICONS, TITLES } from './data.js';
import { RACES } from './data-classes.js';
import { itemLines } from './loot.js';
import { cleanEq } from './dz.js';
import { ico } from './icons.js';
import { UIZ, vw, vh } from './touchfit.js';

const FRIENDS_MAX = 60;
const ASK_SECS = 30;
const MENU_KEEP = 45; // the player menu closes when the player moves further away than this

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// session state: the friend request on screen, requests we sent, inspects we asked for, inspects we answered
const ss = { ask: null, sent: new Map(), insp: new Map(), answered: new Map() };

export function cleanFriends(v) {
  if (!Array.isArray(v)) return [];
  const seen = new Set();
  return v.filter((f) => f && typeof f.n === 'string' && f.n && !seen.has(f.n) && seen.add(f.n)).slice(0, FRIENDS_MAX)
    .map((f) => ({ n: str(f.n, 16), c: has(CLASSES, f.c) ? f.c : 'knight', l: num(f.l, 1, 200, 1) | 0, at: num(f.at, 0, 1e13, 0) }));
}
// what another player sent about their character
function cleanInspect(d, cls) {
  if (!d || typeof d !== 'object') d = {};
  const eq = {}, src = d.eq && typeof d.eq === 'object' ? d.eq : {};
  for (const s of SLOTS) { const e = cleanEq(src[s], cls); if (e && e.slot === s) eq[s] = e; }
  return {
    eq, br: num(d.br, 0, 1e9, 0) | 0, hp: num(d.hp, 0, 1e9, 0) | 0, mp: num(d.mp, 0, 1e9, 0) | 0, atk: num(d.atk, 0, 1e9, 0) | 0, def: num(d.def, 0, 1e9, 0) | 0,
    crit: Math.round(num(d.crit, 0, 100, 0) * 10) / 10, race: has(RACES, d.race) ? d.race : null, path: str(d.path, 32) || null,
    title: str(d.title, 40) || null, guild: str(d.guild, 24) || null, kills: num(d.kills, 0, 1e7, 0) | 0,
  };
}

const G = {
  friends() { if (!Array.isArray(this.S.friends)) this.S.friends = cleanFriends(this.S.friends); return this.S.friends; },
  isFriend(name) { return this.friends().some((f) => f.n === name); },
  friendKey(name) { for (const [key, pr] of mp.peers) if (pr.info.name === name) return key; return null; },
  socialSend(t, data = {}) {
    if (mp.status !== 'online' || !mp.channel) return;
    mp.channel.send({ type: 'broadcast', event: 'f', payload: { i: mp.id, t, ...data } }).catch(() => {});
  },
  // ------------------------------------------------------------ friends
  friendAdd(key) {
    const pr = mp.peers.get(key);
    if (mp.status !== 'online' || !pr) { this.ui.toast('That player is not online', 'warn'); return; }
    const name = pr.info.name;
    if (this.isFriend(name)) { this.ui.toast(`${name} is already your friend`, 'warn'); return; }
    if (this.friends().length >= FRIENDS_MAX) { this.ui.toast(`Your friend list is full (${FRIENDS_MAX})`, 'warn'); return; }
    const last = ss.sent.get(key);
    if (last && Date.now() - last < 10000) { this.ui.toast(`You already asked ${name}`, 'warn'); return; }
    ss.sent.set(key, Date.now());
    this.socialSend('freq', { to: key });
    this.ui.toast(`Friend request sent to ${name}`, 'good');
  },
  friendAnswer(yes) {
    const q = ss.ask; ss.ask = null; this.ui.askPop('friend-ask', null);
    if (!q) return;
    const pr = mp.peers.get(q.from);
    if (!pr) { this.ui.toast('The friend request is no longer valid', 'warn'); return; }
    if (!yes) { this.socialSend('fdec', { to: q.from }); return; }
    if (!this.isFriend(pr.info.name) && this.friends().length >= FRIENDS_MAX) { this.ui.toast(`Your friend list is full (${FRIENDS_MAX})`, 'warn'); this.socialSend('fdec', { to: q.from }); return; }
    this.friendStore(pr.info);
    this.socialSend('facc', { to: q.from });
    this.ui.chat('system', `You and <b>${esc(pr.info.name)}</b> are now friends.`);
    this.sfx.play('quest');
  },
  friendStore(info) {
    const F = this.friends(), f = F.find((x) => x.n === info.name);
    if (f) { f.c = info.cls; f.l = info.level; } else if (F.length < FRIENDS_MAX) F.push({ n: info.name, c: info.cls, l: info.level, at: Date.now() });
    this.save();
    if (this.ui.panelName === 'online') this.ui.softRefresh();
  },
  friendRemove(name) {
    this.S.friends = this.friends().filter((f) => f.n !== name);
    this.save();
    this.ui.toast(`${name} was removed from your friends`, 'good');
    if (this.ui.panelName === 'online') this.ui.softRefresh();
  },
  // a player appeared on the server: friends get their own greeting
  friendOnline(info) {
    if (!this.isFriend(info.name)) return false;
    const f = this.friends().find((x) => x.n === info.name); f.c = info.cls; f.l = info.level;
    this.ui.chat('system', `Your friend <b>${esc(info.name)}</b> (Lv ${info.level} ${esc(CLASSES[info.cls]?.name || '')}) is online.`);
    return true;
  },
  // ------------------------------------------------------------ inspect
  inspect(key) {
    const pr = mp.peers.get(key);
    if (mp.status !== 'online' || !pr) { this.ui.toast('That player is not online', 'warn'); return; }
    ss.insp.set(key, Date.now());
    this.socialSend('insp', { to: key });
    this.ui.inspectWin({ key, info: pr.info, data: null });
  },
  inspectData() {
    const S = this.S, p = this.player, eq = {};
    for (const s of SLOTS) if (S.equip[s]) { const { lock, engraved, ...e } = S.equip[s]; eq[s] = e; } // eslint-disable-line no-unused-vars
    return {
      eq, br: Math.round(this.br || 0), hp: Math.round(p.maxHp), mp: Math.round(p.maxMp), atk: Math.round(this.atkOf(p)), def: Math.round(this.defOf(p)), crit: Math.round(this.critOf(p) * 10) / 10,
      race: S.app?.race || null, path: S.awaken != null ? CLASSES[S.cls].paths?.[S.awaken] || null : null,
      title: TITLES[Math.min(TITLES.length - 1, S.title || 0)] || null, guild: S.guild?.name || null, kills: Object.values(S.kills || {}).reduce((a, b) => a + (+b || 0), 0),
    };
  },
  // ------------------------------------------------------------ incoming
  socialMsg(m) {
    if (!m || typeof m !== 'object' || m.to !== mp.id) return;
    const from = str(m.i, 40), pr = mp.peers.get(from); if (!pr) return;
    const name = pr.info.name, t = m.t;
    if (t === 'freq') {
      if (this.isFriend(name)) { this.friendStore(pr.info); this.socialSend('facc', { to: from }); return; } // already friends on our side
      if (ss.ask && ss.ask.until > Date.now() && ss.ask.from !== from) { this.socialSend('fbusy', { to: from }); return; }
      ss.ask = { from, until: Date.now() + ASK_SECS * 1000 };
      this.ui.askPop('friend-ask', {
        title: 'Friend request', cls: 'friend', secs: ASK_SECS, until: ss.ask.until,
        text: `<b>${esc(name)}</b> (Lv ${pr.info.level} ${esc(CLASSES[pr.info.cls]?.name || '')}) wants to be your friend.`,
        yes: () => this.friendAnswer(true), no: () => this.friendAnswer(false),
      });
      this.sfx.play('open');
    } else if (t === 'facc') {
      if (!ss.sent.has(from)) return; ss.sent.delete(from);
      const was = this.isFriend(name);
      this.friendStore(pr.info);
      if (!was) { this.ui.chat('system', `<b>${esc(name)}</b> accepted your friend request. You are now friends.`); this.sfx.play('quest'); }
    } else if (t === 'fdec' || t === 'fbusy') {
      if (!ss.sent.has(from)) return; ss.sent.delete(from);
      this.ui.toast(t === 'fdec' ? `${name} declined your friend request` : `${name} is busy right now`, 'warn');
    } else if (t === 'insp') {
      const last = ss.answered.get(from);
      if (last && Date.now() - last < 1000) return;
      ss.answered.set(from, Date.now());
      this.socialSend('inspr', { to: from, d: this.inspectData() });
    } else if (t === 'inspr') {
      const asked = ss.insp.get(from);
      if (!asked || Date.now() - asked > 20000) return;
      ss.insp.delete(from);
      this.ui.inspectWin({ key: from, info: pr.info, data: cleanInspect(m.d, pr.info.cls) });
    }
  },
  socialPeerGone(key) {
    if (ss.ask && ss.ask.from === key) { ss.ask = null; this.ui.askPop('friend-ask', null); }
    if (this.ui.pmenuKey === key) this.ui.playerMenu(null);
  },
  socialUpdate() {
    if (ss.ask && ss.ask.until < Date.now()) { this.socialSend('fdec', { to: ss.ask.from }); ss.ask = null; this.ui.askPop('friend-ask', null); }
    const key = this.ui.pmenuKey; if (!key) return;
    const e = this.rplayers.find((x) => x.peerId === key);
    if (!e || e.netHidden || Math.hypot(e.pos.x - this.player.pos.x, e.pos.z - this.player.pos.z) > MENU_KEEP) this.ui.playerMenu(null);
  },
};

// ============================================================ UI
const U = {
  // a request with Accept / Decline and a countdown bar (friend and trade requests)
  askPop(id, o) {
    let el = $(id);
    if (!o) { if (el) { clearInterval(el.tick); el.remove(); } this.askStack(); return; }
    if (el) clearInterval(el.tick); else { el = h('div', 'frame ask-pop'); el.id = id; $('hud').appendChild(el); }
    el.className = 'frame ask-pop ' + (o.cls || '');
    el.innerHTML = `<div class="th">${esc(o.title)}</div><div class="tt">${o.text}</div><div class="ta"></div><div class="tf"><i></i></div>`;
    const yes = h('button', 'btn small green', 'Accept'), no = h('button', 'btn small gray', 'Decline');
    yes.onclick = () => o.yes(); no.onclick = () => o.no();
    el.querySelector('.ta').append(yes, no);
    const bar = el.querySelector('.tf i');
    el.tick = setInterval(() => { bar.style.width = Math.max(0, (o.until - Date.now()) / (o.secs * 10)) + '%'; }, 250);
    this.askStack();
  },
  // several requests at once stack downwards
  askStack() {
    let n = 0;
    for (const el of [$('party-invite'), ...document.querySelectorAll('.ask-pop')]) if (el && !el.hidden) el.style.setProperty('--pop-i', n++);
  },
  // ------------------------------------------------------------ the player menu
  playerMenu(e, x, y) {
    let el = $('pmenu');
    if (!e) { if (el) el.hidden = true; this.pmenuKey = null; return; }
    const g = this.g, key = e.peerId, pr = mp.peers.get(key); if (!pr) return;
    if (!el) { el = h('div', 'frame'); el.id = 'pmenu'; $('hud').appendChild(el); }
    this.pmenuKey = key;
    const info = pr.info, friend = g.isFriend(info.name), inParty = g.partyHas(key);
    el.hidden = false;
    el.innerHTML = `<div class="pmh"><div class="pmp"><img alt="" src="${g.heroIcon(e)}"></div><div class="pmt"><b>${esc(info.name)}</b><small>Lv ${info.level} ${esc(CLASSES[info.cls]?.name || '')}</small>${info.guild ? `<small class="gd">&lt;${esc(info.guild)}&gt;</small>` : ''}</div><button class="x-close" aria-label="Close"></button></div><div class="pma"></div>`;
    el.querySelector('.x-close').onclick = (ev) => { ev.stopPropagation(); this.playerMenu(null); };
    const acts = el.querySelector('.pma');
    const add = (icon, label, fn, why = '') => {
      const b = h('button', 'pmb', `${ico(icon, 'ico inl')}<span>${label}</span>${why ? `<small>${esc(why)}</small>` : ''}`);
      b.disabled = !!why;
      b.onclick = (ev) => { ev.stopPropagation(); g.sfx.play('click'); this.playerMenu(null); fn(); };
      acts.appendChild(b);
    };
    if (friend) add('friend_x', 'Remove Friend', () => this.modal('Remove friend?', `Remove ${info.name} from your friends?`, [{ label: 'Remove', cls: 'red', fn: () => g.friendRemove(info.name) }, { label: 'Keep', cls: 'gray' }]));
    else add('friend_add', 'Add Friend', () => g.friendAdd(key));
    add('inspect', 'Inspect Character', () => g.inspect(key));
    add('party_add', 'Invite to Party', () => g.partyInvite(key), inParty ? 'Already in your party' : info.party ? 'Already in a party' : '');
    add('trade', 'Trade', () => g.tradeRequest(key), g.tr ? 'Finish your trade first' : '');
    // next to where you clicked, inside the screen
    const W = el.offsetWidth, H = el.offsetHeight; // x, y are screen px; the HUD may be zoomed (touchfit.js)
    const px = x != null ? x / UIZ.k : vw() / 2 - W / 2, py = y != null ? y / UIZ.k : 90;
    el.style.left = Math.max(8, Math.min(vw() - W - 8, px + 14)) + 'px';
    el.style.top = Math.max(8, Math.min(vh() - H - 8, py - 24)) + 'px';
  },
  // ------------------------------------------------------------ the inspect window
  inspectWin(o) {
    let el = $('inspect-win');
    if (!o) { if (el) el.remove(); $('tooltip').hidden = true; return; }
    const g = this.g, info = o.info, d = o.data;
    if (!el) { el = h('div', 'frame'); el.id = 'inspect-win'; $('panels').appendChild(el); }
    el.dataset.key = o.key;
    const e = g.rplayers.find((x) => x.peerId === o.key), C = CLASSES[info.cls];
    el.innerHTML = `<button class="x-close" aria-label="Close"></button><div class="iw-h"><b>${esc(info.name)}</b><small>Lv ${info.level} ${esc(C?.name || '')}${d?.path ? ` · ${esc(d.path)}` : ''}</small>${d?.title ? `<em>«${esc(d.title)}»</em>` : ''}</div><div class="iw-b"></div>`;
    el.querySelector('.x-close').onclick = () => this.inspectWin(null);
    const body = el.querySelector('.iw-b');
    if (!d) { body.appendChild(h('div', 'note', `Asking ${esc(info.name)} for a look…`)); return; }
    const wrap = h('div', 'char-wrap iw');
    const col = (slots) => {
      const c = h('div', 'eq-col');
      for (const s of slots) {
        const eq = d.eq[s];
        const b = h('div', 'cell ' + (eq ? 'q' + eq.quality : 'empty'), eq ? `${ico(eq.icon)}${eq.enh ? `<span class="enh">+${eq.enh}</span>` : ''}` : `<span class="ghost">${ico(s === 'weapon' ? WEAPON_ICONS[info.cls] : SLOT_INFO[s].icon)}</span>`);
        this.tip(b, () => (eq ? itemLines(eq, d.eq).map((l, i) => (i === 0 ? `<b style="color:${l.color}">${esc(l.text)}</b>` : `<div style="color:${l.color || 'var(--muted)'}">${esc(l.text)}</div>`)).join('') : `<b>${SLOT_INFO[s].label}</b>Empty slot`));
        c.appendChild(b);
      }
      return c;
    };
    wrap.appendChild(col(['weapon', 'helm', 'armor', 'gloves']));
    const port = h('div', 'char-portrait');
    if (e) { const img = new Image(); img.alt = ''; img.src = g.heroFullIcon(info.name, e.look); port.appendChild(img); }
    wrap.appendChild(port);
    wrap.appendChild(col(['boots', 'necklace', 'ring']));
    const st = h('div', 'stats-col');
    st.appendChild(h('div', 'br-big', `<span class="flame"></span><small>CP</small>${fmt(d.br)}`));
    st.appendChild(h('div', 'stats', `<span>Class</span><span>${esc(C?.name || '')}</span><span>Race</span><span>${esc(RACES[d.race]?.name || '—')}</span>
      <span>Max HP</span><span>${fmt(d.hp)}</span><span>Max MP</span><span>${fmt(d.mp)}</span><span>Attack</span><span>${fmt(d.atk)}</span><span>Defense</span><span>${fmt(d.def)}</span>
      <span>Critical</span><span>${d.crit.toFixed(1)}%</span><span>Guild</span><span>${d.guild ? esc(d.guild) : '—'}</span><span>Monsters slain</span><span>${fmt(d.kills)}</span>`));
    wrap.appendChild(st);
    body.appendChild(wrap);
    const row = h('div', 'acts-row');
    if (mp.peers.has(o.key)) {
      if (!g.isFriend(info.name)) { const b = h('button', 'btn small', 'Add Friend'); b.onclick = () => g.friendAdd(o.key); row.appendChild(b); }
      if (!g.partyHas(o.key) && !info.party) { const b = h('button', 'btn small blue', 'Invite to Party'); b.onclick = () => g.partyInvite(o.key); row.appendChild(b); }
      const b = h('button', 'btn small green', 'Trade'); b.disabled = !!g.tr; b.onclick = () => { this.inspectWin(null); g.tradeRequest(o.key); }; row.appendChild(b);
    }
    body.appendChild(row);
  },
  // ------------------------------------------------------------ friends in the Online panel
  friendsBlock(body) {
    const g = this.g, F = g.friends();
    const on = F.filter((f) => g.friendKey(f.n)).length;
    const box = h('div', 'party-box friends');
    box.appendChild(h('div', 'lbl', `${ico('friends', 'ico inl')} Friends · ${on} online / ${F.length}`));
    if (!F.length) box.appendChild(h('div', 'muted fr-none', 'No friends yet. Click a player in the world and choose <b>Add Friend</b>.'));
    const list = [...F].sort((a, b) => (!!g.friendKey(b.n) - !!g.friendKey(a.n)) || a.n.localeCompare(b.n));
    for (const f of list) {
      const key = g.friendKey(f.n), pr = key && mp.peers.get(key), info = pr?.info;
      const r = h('div', 'row slim fr' + (key ? ' on' : ''), `<i class="fr-dot"></i><div class="tx"><b>${esc(f.n)}</b>Lv ${info ? info.level : f.l} ${esc(CLASSES[info ? info.cls : f.c]?.name || '')}${info ? ` · ${esc(info.zone || '')}` : ' · <span class="muted">Offline</span>'}</div>`);
      if (key) {
        const m = h('button', 'btn small', 'Menu'); m.onclick = (ev) => { const e = g.rplayers.find((x) => x.peerId === key); if (e && !e.netHidden) { const b = ev.target.getBoundingClientRect(); this.playerMenu(e, b.left, b.bottom + 30); } else this.toast(`${f.n} is in ${info.zone || 'another area'}`, 'warn'); }; r.appendChild(m);
        const w = h('button', 'btn small blue', 'Where?'); w.disabled = info.map !== 'world' || !!g.dg || !!g.war || !!g.trial; w.onclick = () => g.mpGoTo(key); r.appendChild(w);
      }
      const x = h('button', 'btn small gray', 'Remove'); x.onclick = () => this.modal('Remove friend?', `Remove ${f.n} from your friends?`, [{ label: 'Remove', cls: 'red', fn: () => g.friendRemove(f.n) }, { label: 'Keep', cls: 'gray' }]); r.appendChild(x);
      box.appendChild(r);
    }
    body.appendChild(box);
  },
};

export function installSocial(Game) { Object.assign(Game.prototype, G); }
export function installSocialUI(UI) { Object.assign(UI.prototype, U); }
