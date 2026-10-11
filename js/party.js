// Parties for real players on the same server: invitations, a party frame, party chat and shared EXP.
// Membership travels in presence (each member publishes the party id and when they joined; the earliest member
// leads), so no server is needed and reloading the page keeps you in your party. Monsters run separately in each
// browser, so a kill's EXP is shared by message: the killer splits it with party members nearby, plus a bonus per
// extra member, and every member applies their own level penalty and EXP boosts to their share.
import { mp } from './mp.js';
import { CLASSES } from './data.js';
import { curveStats, MAX_LEVEL } from './data-world.js';
import { lookFor } from './life.js';

const PARTY_MAX = 4;
const PARTY_RANGE = 60; // members this close to a kill (world units, open world only) share its EXP
const PARTY_BONUS = 0.1; // +10% total EXP per extra member nearby
const INVITE_SECS = 30;
const XP_FLUSH = 1.2; // seconds between EXP share messages (kills in between are added up)
const ALONE_SECS = 20; // a party with nobody else in it for this long disbands
const STORE = 'aetherheim_party';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const str = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, n);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const partyId = (v) => (/^[a-z0-9]{4,16}$/.test(v) ? v : null);
const newId = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

// session state that is not published: the invitation on screen, the party we are inviting people into, recent invites
const ps = { invite: null, pending: null, sent: new Map(), prev: null, names: {}, leader: null, quietUntil: 0, aloneT: 0, restoring: false };

function remember() {
  try {
    if (mp.party.id) sessionStorage.setItem(STORE, JSON.stringify({ id: mp.party.id, pj: mp.party.pj, server: mp.server }));
    else sessionStorage.removeItem(STORE);
  } catch { /* storage unavailable */ }
}

// party members sorted by join time; the first one leads. Each: { key, me, pj, pr? }
export function partyMembers() {
  if (!mp.party.id) return [];
  const out = [{ key: mp.id, me: true, pj: mp.party.pj }];
  for (const [key, pr] of mp.peers) if (pr.info.party === mp.party.id) out.push({ key, pr, pj: pr.info.pj || 0 });
  return out.sort((a, b) => a.pj - b.pj || (a.key < b.key ? -1 : 1));
}

const G = {
  partyInit() {
    this.partyXp = new Map(); this.partyXpAt = null; this.partyXpT = 0; this.partyChatT = 0; this.partyBarT = 0;
    try {
      const s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      if (s && s.server === mp.server && partyId(s.id)) { mp.party.id = s.id; mp.party.pj = num(s.pj, 0, 1e13, Date.now()); ps.restoring = true; }
    } catch { /* storage unavailable */ }
  },
  partyHas(key) { return !!mp.party.id && (key === mp.id || mp.peers.get(key)?.info.party === mp.party.id); },
  partyLeader() { return partyMembers()[0]?.key || null; },
  partySend(t, data = {}) {
    if (mp.status !== 'online' || !mp.channel) return;
    mp.channel.send({ type: 'broadcast', event: 'p', payload: { i: mp.id, t, ...data } }).catch(() => {});
  },
  // ------------------------------------------------------------ invitations
  partyInvite(key) {
    const pr = mp.peers.get(key);
    if (mp.status !== 'online' || !pr) { this.ui.toast('That player is not online', 'warn'); return; }
    const name = pr.info.name;
    if (this.partyHas(key)) { this.ui.toast(`${name} is already in your party`, 'warn'); return; }
    if (pr.info.party) { this.ui.toast(`${name} is already in a party`, 'warn'); return; }
    if (partyMembers().length >= PARTY_MAX) { this.ui.toast(`Your party is full (${PARTY_MAX} players)`, 'warn'); return; }
    const last = ps.sent.get(key);
    if (last && Date.now() - last < 10000) { this.ui.toast(`You already invited ${name}`, 'warn'); return; }
    ps.sent.set(key, Date.now());
    const id = mp.party.id || (ps.pending = ps.pending || newId());
    this.partySend('inv', { to: key, party: id });
    this.ui.toast(`Party invitation sent to ${name}`, 'good');
  },
  partyAnswer(accept) {
    const inv = ps.invite; ps.invite = null; this.ui.partyInvitePopup(null);
    if (!inv) return;
    const pr = mp.peers.get(inv.from);
    if (!pr) { this.ui.toast('The invitation is no longer valid', 'warn'); return; }
    if (!accept) { this.partySend('dec', { to: inv.from }); return; }
    if (mp.party.id) { this.ui.toast('Leave your party first', 'warn'); return; }
    let size = 0;
    for (const p of mp.peers.values()) if (p.info.party === inv.party) size++;
    if (pr.info.party !== inv.party) size++; // the inviter joins when we accept
    if (size + 1 > PARTY_MAX) { this.ui.toast('That party is already full', 'warn'); this.partySend('busy', { to: inv.from, why: 'full' }); return; }
    mp.party.id = inv.party; mp.party.pj = Date.now(); ps.quietUntil = Date.now() + 5000; ps.aloneT = 0;
    remember(); this.mpTrackNow();
    this.partySend('acc', { to: inv.from, party: inv.party, pj: mp.party.pj });
    this.ui.chat('party', `You joined <b>${esc(pr.info.name)}</b>'s party.`);
    this.sfx.play('quest'); this.partySync();
  },
  partyLeave(note = 'You left the party.') {
    if (!mp.party.id) return;
    mp.party.id = null; mp.party.pj = 0; ps.pending = null; ps.prev = null; ps.leader = null; ps.aloneT = 0;
    remember(); this.mpTrackNow();
    if (note) this.ui.chat('party', note);
    this.partySync();
  },
  partyKick(key) {
    if (this.partyLeader() !== mp.id || !this.partyHas(key) || key === mp.id) return;
    this.partySend('kick', { to: key, party: mp.party.id });
    this.ui.toast(`Removed ${mp.peers.get(key)?.info.name || 'the player'} from the party`, 'good');
  },
  partySay(text) {
    text = str(text, 120).trim(); if (!text) return;
    if (!mp.party.id) { this.ui.toast('You are not in a party', 'warn'); return; }
    if (performance.now() - this.partyChatT < 800) return;
    this.partyChatT = performance.now();
    this.ui.chat('party', esc(text), this.S.name);
    this.partySend('chat', { party: mp.party.id, msg: text });
  },
  // ------------------------------------------------------------ incoming
  partyMsg(m) {
    if (!m || typeof m !== 'object') return;
    const from = str(m.i, 40), pr = mp.peers.get(from);
    if (!pr || (m.to && m.to !== mp.id)) return;
    const name = pr.info.name, t = m.t;
    if (t === 'inv') {
      const id = partyId(m.party); if (!id) return;
      if (mp.party.id) { this.partySend('busy', { to: from, why: 'party' }); return; }
      if (ps.invite && ps.invite.until > Date.now() && ps.invite.from !== from) { this.partySend('busy', { to: from, why: 'busy' }); return; }
      ps.invite = { from, party: id, name, level: pr.info.level, cls: pr.info.cls, until: Date.now() + INVITE_SECS * 1000 };
      this.ui.partyInvitePopup(ps.invite); this.sfx.play('open');
    } else if (t === 'acc') {
      const id = partyId(m.party); ps.sent.delete(from);
      if (!mp.party.id && id && id === ps.pending) {
        mp.party.id = id; mp.party.pj = Math.min(Date.now(), num(m.pj, 0, 1e13, Date.now()) - 1); ps.pending = null; ps.aloneT = 0;
        remember(); this.mpTrackNow();
      }
      this.ui.chat('party', `<b>${esc(name)}</b> accepted your invitation.`); this.sfx.play('quest');
    } else if (t === 'dec') { ps.sent.delete(from); this.ui.toast(`${name} declined the invitation`, 'warn'); }
    else if (t === 'busy') { ps.sent.delete(from); this.ui.toast(m.why === 'full' ? 'The party is full' : m.why === 'party' ? `${name} is already in a party` : `${name} is busy right now`, 'warn'); }
    else if (t === 'kick') {
      if (mp.party.id && m.party === mp.party.id && this.partyLeader() === from) this.partyLeave(`<b>${esc(name)}</b> removed you from the party.`);
    } else if (t === 'chat') {
      if (!mp.party.id || m.party !== mp.party.id) return;
      const text = str(m.msg, 120).trim(); if (!text) return;
      this.ui.chat('party', esc(text), name);
      const e = this.rplayers.find((x) => x.peerId === from); if (e && !e.netHidden) this.mpBubble(e, text);
    } else if (t === 'xp') this.partyGetExp(m);
  },
  // presence changed: announce who joined or left, who leads, and recolour party members
  partySync() {
    const mem = partyMembers(), keys = mem.map((x) => x.key);
    // after a reload, the first sync that finds the others is not news
    const quiet = Date.now() < ps.quietUntil || (ps.restoring && mem.length > 1);
    if (mem.length > 1) ps.restoring = false;
    if (mp.party.id && ps.prev) {
      for (const x of mem) if (!x.me && !ps.prev.includes(x.key) && !quiet) this.ui.chat('party', `<b>${esc(x.pr.info.name)}</b> joined the party.`);
      for (const k of ps.prev) if (!keys.includes(k) && k !== mp.id) this.ui.chat('party', `<b>${esc(ps.names[k] || 'A member')}</b> left the party.`);
      if (ps.leader && keys[0] !== ps.leader && keys.length > 1 && ps.prev.length > 1 && !quiet) this.ui.chat('party', keys[0] === mp.id ? 'You are now the party leader.' : `<b>${esc(mp.peers.get(keys[0])?.info.name)}</b> is now the party leader.`);
    }
    ps.prev = mp.party.id ? keys : null; ps.leader = keys[0] || null;
    for (const x of mem) if (!x.me) ps.names[x.key] = x.pr.info.name;
    for (const e of this.rplayers || []) e.np?.classList.toggle('party', keys.includes(e.peerId));
    this.ui.refreshParty && this.ui.refreshParty();
  },
  // ------------------------------------------------------------ shared EXP
  // called for each of our kills: returns the EXP we keep and queues the share for party members nearby
  partyShareExp(m, base) {
    if (!mp.party.id || this.dg || this.war || mp.status !== 'online') return base;
    let near = 0;
    for (const x of partyMembers()) {
      if (x.me) continue;
      const n = x.pr.net;
      if (x.pr.info.map === 'world' && n.w && Math.hypot(n.x - m.pos.x, n.z - m.pos.z) <= PARTY_RANGE) near++;
    }
    if (!near) return base;
    const share = base * (1 + PARTY_BONUS * near) / (near + 1);
    const lv = m.level | 0;
    this.partyXp.set(lv, (this.partyXp.get(lv) || 0) + share);
    this.partyXpAt = { x: Math.round(m.pos.x), z: Math.round(m.pos.z) };
    return share;
  },
  partyGetExp(m) {
    if (!mp.party.id || m.party !== mp.party.id || this.dg || this.war || this.player.dead) return;
    const x = num(m.x, -5200, 5200, 1e9), z = num(m.z, -5200, 5200, 1e9);
    if (Math.hypot(this.player.pos.x - x, this.player.pos.z - z) > PARTY_RANGE + 15) return;
    let total = 0;
    for (const row of Array.isArray(m.xp) ? m.xp.slice(0, 24) : []) {
      if (!Array.isArray(row)) continue;
      const lv = num(row[0], 1, MAX_LEVEL + 3, 1) | 0;
      total += this.personalExp(num(row[1], 0, curveStats(lv).exp * 400, 0), lv);
    }
    if (total <= 0) return;
    const p = this.player;
    this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.6), `+${fmt(total)} Party EXP`, 'exp pexp');
    this.gainExp(total);
  },
  partyUpdate(dt) {
    if (!this.partyXp) return; // multiplayer is off
    if (ps.invite && ps.invite.until < Date.now()) { const inv = ps.invite; ps.invite = null; this.ui.partyInvitePopup(null); this.partySend('dec', { to: inv.from }); }
    if (this.partyXp.size) {
      this.partyXpT -= dt;
      if (this.partyXpT <= 0) {
        this.partyXpT = XP_FLUSH;
        this.partySend('xp', { party: mp.party.id, ...this.partyXpAt, xp: [...this.partyXp].map(([lv, a]) => [lv, Math.round(a)]) });
        this.partyXp.clear();
      }
    } else this.partyXpT = XP_FLUSH;
    if (!mp.party.id || mp.status !== 'online') return;
    // a party nobody else is in disbands (the others left, or an invitation was never accepted)
    if (partyMembers().length < 2) { ps.aloneT += dt; if (ps.aloneT > ALONE_SECS) this.partyLeave('Your party has disbanded.'); } else ps.aloneT = 0;
    this.partyBarT -= dt;
    if (this.partyBarT <= 0) { this.partyBarT = 0.3; this.ui.refreshPartyBars && this.ui.refreshPartyBars(); }
  },
};

// ============================================================ UI
const U = {
  partyLook(key) {
    const pr = mp.peers.get(key);
    return this.g.rplayers.find((e) => e.peerId === key)?.look || (pr ? lookFor(pr.info) : this.g.playerLook());
  },
  // party frame under the wallet: one row per other member
  refreshParty() {
    const g = this.g, hud = $('hud'); if (!hud) return;
    let el = $('hud-party');
    if (!el) { el = h('div', ''); el.id = 'hud-party'; hud.appendChild(el); }
    const mem = partyMembers(), others = mem.filter((x) => !x.me);
    el.hidden = !mp.party.id;
    if (el.hidden) { hud.style.setProperty('--party-h', '0px'); hud.style.setProperty('--party-w', '0px'); return; }
    el.innerHTML = `<div class="ph">Party <small>${mem.length}/${PARTY_MAX}${mem[0]?.me ? ' · Leader' : ''}</small></div>`;
    if (!others.length) el.appendChild(h('div', 'pm-wait', 'Waiting for members…'));
    for (const x of others) {
      const info = x.pr.info;
      const r = h('div', 'pm' + (x === mem[0] ? ' lead' : ''), `<div class="pi"><img alt="" src="${g.heroIcon({ name: info.name, look: this.partyLook(x.key) })}"></div>
        <div class="pmt"><b>${esc(info.name)}</b><small>Lv ${info.level} ${esc(CLASSES[info.cls]?.name || '')}</small><div class="bar hp"><i></i></div><em></em></div>`);
      r.dataset.key = x.key;
      r.onclick = () => { const e = g.rplayers.find((p) => p.peerId === x.key); if (e && !e.netHidden && e.model.visible) g.setTarget(e); else this.toast(`${info.name} is in ${info.zone || 'another area'}`, 'warn'); };
      el.appendChild(r);
    }
    hud.style.setProperty('--party-h', el.offsetHeight + 8 + 'px'); hud.style.setProperty('--party-w', el.offsetWidth + 8 + 'px');
    this.refreshPartyBars();
    if (this.panelName === 'online') this.softRefresh();
  },
  refreshPartyBars() {
    const g = this.g, el = $('hud-party'); if (!el || el.hidden) return;
    for (const r of el.querySelectorAll('.pm')) {
      const pr = mp.peers.get(r.dataset.key); if (!pr) continue;
      const n = pr.net, away = pr.info.map !== 'world' || !n.w || !!g.dg || !!g.war;
      const far = away || Math.hypot(n.x - g.player.pos.x, n.z - g.player.pos.z) > PARTY_RANGE;
      r.querySelector('.bar i').style.width = (n.s === 4 ? 0 : n.h ?? 100) + '%';
      r.classList.toggle('far', far);
      const tag = r.querySelector('em'), txt = n.s === 4 ? 'Defeated' : away ? esc(pr.info.zone || 'Away') : far ? 'Too far to share EXP' : '';
      if (tag.innerHTML !== txt) tag.innerHTML = txt;
    }
  },
  partyInvitePopup(inv) {
    let el = $('party-invite');
    if (!inv) { if (el) el.hidden = true; clearInterval(this.inviteTick); return; }
    if (!el) { el = h('div', 'frame'); el.id = 'party-invite'; $('hud').appendChild(el); }
    el.hidden = false;
    el.innerHTML = `<div class="th">Party invitation</div><div class="tt"><b>${esc(inv.name)}</b> (Lv ${inv.level} ${esc(CLASSES[inv.cls]?.name || '')}) invites you to a party. Party members nearby share EXP from kills.</div><div class="ta"></div><div class="tf"><i></i></div>`;
    const yes = h('button', 'btn small green', 'Accept'), no = h('button', 'btn small gray', 'Decline');
    yes.onclick = () => this.g.partyAnswer(true); no.onclick = () => this.g.partyAnswer(false);
    el.querySelector('.ta').append(yes, no);
    const bar = el.querySelector('.tf i');
    clearInterval(this.inviteTick);
    this.inviteTick = setInterval(() => { bar.style.width = Math.max(0, (inv.until - Date.now()) / (INVITE_SECS * 10)) + '%'; }, 250);
  },
  // target frame: invite another player
  refreshPartyBtn(t) {
    let b = $('tg-invite');
    if (!b) { b = h('button', 'btn small blue', 'Invite'); b.id = 'tg-invite'; b.onclick = (e) => { e.stopPropagation(); const tt = this.g.player.target; if (tt && tt.kind === 'rp') this.g.partyInvite(tt.peerId); }; $('hud-target').appendChild(b); }
    b.hidden = !(t && t.kind === 'rp' && !this.g.partyHas(t.peerId) && mp.status === 'online');
  },
  // the party block at the top of the Online panel
  partyBlock(body) {
    const g = this.g, mem = partyMembers();
    if (!mp.party.id) { body.appendChild(h('div', 'note', `Not in a party. Press <b>Invite</b> next to a player (or on their target frame) to team up. Party members within ${PARTY_RANGE} m share EXP from every kill, with a ${Math.round(PARTY_BONUS * 100)}% bonus per extra member. Type <b>/p</b> before a chat message to talk to your party.`)); return; }
    const lead = mem[0]?.me;
    const box = h('div', 'party-box');
    box.appendChild(h('div', 'lbl', `Your party · ${mem.length}/${PARTY_MAX}`));
    for (const x of mem) {
      const name = x.me ? g.S.name : x.pr.info.name, lv = x.me ? g.S.level : x.pr.info.level, cls = x.me ? g.S.cls : x.pr.info.cls;
      const r = h('div', 'row slim' + (x.me ? ' me' : ''), `<div class="ic"><img class="ico" alt="" src="${x.me ? g.headIcon() : g.heroIcon({ name, look: this.partyLook(x.key) })}"></div>
        <div class="tx"><b>${esc(name)}${x === mem[0] ? ' <span class="crown">Leader</span>' : ''}${x.me ? ' <span class="muted">(you)</span>' : ''}</b>Lv ${lv} ${esc(CLASSES[cls]?.name || '')}</div>`);
      if (lead && !x.me) { const k = h('button', 'btn small gray', 'Remove'); k.onclick = () => g.partyKick(x.key); r.appendChild(k); }
      box.appendChild(r);
    }
    const row = h('div', 'acts-row');
    const lv = h('button', 'btn small gray', 'Leave Party'); lv.onclick = () => g.partyLeave(); row.appendChild(lv);
    box.appendChild(row);
    body.appendChild(box);
  },
};

export function installParty(Game) { Object.assign(Game.prototype, G); }
export function installPartyUI(UI) { Object.assign(UI.prototype, U); }
