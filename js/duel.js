// Duels and the Arena (from Lv 20).
// - Duels: challenge another player (player menu or the Arena window); when they accept, a ring of light opens where
//   you stand and after a 3-second count you fight 1 v 1. Nobody dies: the first to fall to 1 HP, step out of the ring
//   or leave loses; after 90 seconds the one with more HP left wins. Every client applies the hits it takes (the same
//   'z' hit messages as the Danger Zone), and duel messages travel on the 'v' event.
// - Arena: a rating ladder (Elo, starting at 1000) shared by duels and by fights against the arena champions, phantom
//   duelists at your level whose strength follows their rating (five rated fights a day, with Gold for a win). The
//   ladder lists the champions, the players online and you, with tiers from Bronze to Champion.
import { mp } from './mp.js';
import { dayKey } from './systems-data.js';

export const DUEL_RING = 15, DUEL_SECS = 90, DUEL_COUNT = 3, ARENA_LV = 20, ARENA_A_DAY = 5, ELO_K = 32;
export const ARENA_TIERS = [[0, 'Bronze', '#c88a5a'], [1100, 'Silver', '#c8d4e8'], [1250, 'Gold', '#ffd84a'], [1400, 'Platinum', '#7ae8e0'], [1600, 'Diamond', '#9ad0ff'], [1800, 'Champion', '#ff7ae0']];
export const arenaTier = (r) => ARENA_TIERS.reduce((t, x) => (r >= x[0] ? x : t), ARENA_TIERS[0]);
export const ARENA_CHAMPS = [
  ['Pudding', 880], ['Tofu', 960], ['Bubbles', 1030], ['Felix', 1100], ['Yuki', 1170], ['Mirabelle', 1240], ['RuneKnight', 1320],
  ['Zephyrus', 1400], ['Celestine', 1490], ['Ignis', 1580], ['Valkyr', 1680], ['Lunaria', 1800],
].map(([name, r], i) => ({ id: 'ch' + i, name, r }));
// rating change for a, who scored s (1 win, 0.5 draw, 0 loss) against b
export const elo = (ra, rb, s) => Math.round(ELO_K * (s - 1 / (1 + Math.pow(10, (rb - ra) / 400))));
const num = (v, lo, hi, d = 0) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');

const G = {
  arenaInit() { const S = this.S; if (!S.arena || typeof S.arena !== 'object') S.arena = { r: 1000, w: 0, l: 0, d: 0, day: '', n: 0 }; },
  arenaOk(say = true) {
    if (this.S.level < ARENA_LV && !this.S.gm) { if (say) this.ui.toast(`The Arena opens at Lv ${ARENA_LV}`, 'warn'); return false; }
    if (this.dg || this.trial || this.war || this.dzIn || this.map !== this.world) { if (say) this.ui.toast('Duels and arena fights happen in the open world', 'warn'); return false; }
    if (this.duel || this.arenaFight || this.realmFight) { if (say) this.ui.toast('Finish your current fight first', 'warn'); return false; }
    return true;
  },
  arenaRate(theirs, s, label) {
    const A = this.S.arena, d = elo(A.r, theirs, s);
    A.r = Math.max(0, A.r + d); if (s === 1) A.w++; else if (s === 0) A.l++; else A.d++;
    this.ui.chat('system', `${label}: ${s === 1 ? 'victory' : s === 0 ? 'defeat' : 'a draw'} · Arena rating ${fmt(A.r)} (${d >= 0 ? '+' : ''}${d}) · ${arenaTier(A.r)[1]}`);
    this.mpTrackNow && this.mpTrackNow();
    return d;
  },
  // a lethal hit while dueling leaves you at 1 HP and ends the fight (game.js damage)
  duelGuard() {
    if (this.duel?.live) { this.duelEnd(0, 'fell'); return true; }
    if (this.arenaFight) { this.arenaLost(); return true; }
    return false;
  },
  duelFoe(e) { const D = this.duel; return !!(D && D.live && e && e.kind === 'rp' && e.peerId === D.peer && !e.netHidden); },
  duelSend(t, data = {}) { if (mp.status === 'online' && mp.channel) mp.channel.send({ type: 'broadcast', event: 'v', payload: { i: mp.id, t, ...data } }).catch(() => {}); },
  // ---------------------------------------------------------------- challenging another player
  duelAsk(key) {
    const pr = mp.peers.get(key), e = (this.rplayers || []).find((x) => x.peerId === key);
    if (!this.arenaOk()) return false;
    if (!pr || !e || e.netHidden) { this.ui.toast('That player is not here', 'warn'); return false; }
    if (pr.info.gm || this.S.gm) { this.ui.toast('Game Masters do not duel', 'warn'); return false; }
    if (flat(e.pos, this.player.pos) > 25) { this.ui.toast('Stand within 25 m to challenge someone', 'warn'); return false; }
    this.duelAsked = { key, until: Date.now() + 30000 };
    this.duelSend('ask', { to: key, r: this.S.arena.r });
    this.ui.toast(`Duel challenge sent to ${pr.info.name}`, 'good');
    return true;
  },
  duelAnswer(yes) {
    const A = this.duelInvite; this.duelInvite = null; if (!A) return;
    if (!yes || !this.arenaOk(yes)) { this.duelSend('no', { to: A.key }); return; }
    const pr = mp.peers.get(A.key), e = (this.rplayers || []).find((x) => x.peerId === A.key);
    if (!pr || !e) { this.ui.toast('They have gone', 'warn'); return; }
    const c = { x: (e.pos.x + this.player.pos.x) / 2, z: (e.pos.z + this.player.pos.z) / 2 };
    this.duelSend('go', { to: A.key, x: c.x, z: c.z, r: this.S.arena.r });
    this.duelStart(A.key, c, A.r);
  },
  duelMsg(m) {
    if (!m || typeof m !== 'object' || (m.to && m.to !== mp.id)) return;
    const key = String(m.i || ''), pr = mp.peers.get(key); if (!pr) return;
    const name = pr.info.name;
    if (m.t === 'ask') {
      if (this.duel || this.arenaFight || this.duelInvite || !this.arenaOk(false)) { this.duelSend('no', { to: key, busy: 1 }); return; }
      this.duelInvite = { key, r: num(m.r, 0, 5000, 1000), until: Date.now() + 30000 };
      this.sfx.play('open');
      this.ui.modal('Duel challenge', `${esc(name)} (Lv ${pr.info.level}, arena ${fmt(this.duelInvite.r)}) challenges you to a duel. Nobody dies: the first to fall to 1 HP, leave the ring or run out of time loses.`, [
        { label: 'Accept', cls: 'green', fn: () => this.duelAnswer(true) }, { label: 'Decline', cls: 'gray', fn: () => this.duelAnswer(false) }]);
    } else if (m.t === 'no') {
      if (this.duelAsked?.key === key) { this.duelAsked = null; this.ui.toast(m.busy ? `${name} cannot duel right now` : `${name} declined the duel`, 'warn'); }
    } else if (m.t === 'go') {
      if (this.duelAsked?.key !== key || this.duelAsked.until < Date.now() || this.duel) return;
      this.duelAsked = null;
      this.duelStart(key, { x: num(m.x, -400, 400), z: num(m.z, -400, 400) }, num(m.r, 0, 5000, 1000));
    } else if (m.t === 'end') {
      const D = this.duel; if (!D || D.peer !== key) return;
      this.duelEnd(m.res === 'draw' ? 0.5 : 1, m.why || 'won', true); // they lost (or agreed a draw)
    }
  },
  duelStart(peer, c, theirR) {
    const pr = mp.peers.get(peer);
    this.duel = { peer, name: pr?.info.name || 'your rival', x: c.x, z: c.z, r: theirR, t: -DUEL_COUNT, live: false, ringT: 0 };
    this.ui.closeModal(); this.ui.closePanels();
    this.auto && this.toggleAuto(false);
    this.ui.banner('DUEL', `vs ${this.duel.name}`, 'level'); this.sfx.play('boom');
    this.fx.ring({ x: c.x, y: this.world.heightAt(c.x, c.z), z: c.z }, 0xffd84a, DUEL_RING, 1.2);
  },
  duelUpdate(dt) {
    const D = this.duel; if (!D) return;
    const p = this.player, pr = mp.peers.get(D.peer), e = (this.rplayers || []).find((x) => x.peerId === D.peer);
    D.t += dt; D.ringT -= dt;
    if (D.ringT <= 0) { D.ringT = 2; this.fx.ring({ x: D.x, y: this.world.heightAt(D.x, D.z), z: D.z }, D.live ? 0xff6a4a : 0xffd84a, DUEL_RING, 2); }
    if (!D.live) {
      const n = Math.ceil(-D.t);
      if (n !== D.said && n > 0) { D.said = n; this.ui.banner(String(n), 'Get ready', 'level'); this.sfx.play('click'); }
      if (D.t >= 0) { D.live = true; this.ui.banner('FIGHT!', `vs ${D.name}`, 'loot5'); this.sfx.play('boom'); this.setTarget(e || null); }
      return;
    }
    if (!pr || !e || e.netHidden) { this.duelEnd(1, 'left'); return; } // they left: you win
    if (flat(p.pos, D) > DUEL_RING + 3) { this.duelEnd(0, 'ring'); return; }
    if (D.t >= DUEL_SECS) {
      const mine = p.hp / p.maxHp * 100, theirs = pr.net.h ?? 100;
      if (Math.abs(mine - theirs) < 1) this.duelEnd(0.5, 'time'); else if (mine < theirs) this.duelEnd(0, 'time');
      // the other side ends it when they are lower; if their word never comes, it ends as a win 5 seconds later
      else if (D.t >= DUEL_SECS + 5) this.duelEnd(1, 'time');
    }
  },
  // s: 1 you won, 0 you lost, 0.5 draw. told: the other side already sent the result.
  duelEnd(s, why, told = false) {
    const D = this.duel; if (!D) return;
    this.duel = null;
    const p = this.player;
    if (!told && s !== 1) this.duelSend('end', { to: D.peer, res: s === 0.5 ? 'draw' : 'lost', why });
    if (s === 0) p.hp = Math.max(1, Math.min(p.hp, Math.round(p.maxHp * 0.3)));
    const d = this.arenaRate(D.r, s, `Duel with ${D.name}`);
    const words = { fell: 'fell to 1 HP', ring: 'stepped out of the ring', left: 'left', time: 'ran out of time', won: 'won' };
    this.ui.banner(s === 1 ? 'VICTORY' : s === 0 ? 'DEFEAT' : 'DRAW', `Arena ${fmt(this.S.arena.r)} (${d >= 0 ? '+' : ''}${d})`, s === 1 ? 'loot5' : '');
    this.ui.chat('announce', `<b>[Duel]</b> ${esc(s === 1 ? this.S.name : D.name)} defeated ${esc(s === 1 ? D.name : this.S.name)}${s === 0.5 ? ' (a draw)' : ''}${why !== 'won' && why !== 'fell' ? ` (${words[why] || why})` : ''}.`);
    this.sfx.play(s === 1 ? 'legend' : 'error');
    if (this.player.target?.peerId === D.peer) this.setTarget(null);
    this.engage = false;
    this.save();
  },
  // ---------------------------------------------------------------- arena champions (solo)
  arenaLeft() { const A = this.S.arena; if (A.day !== dayKey()) { A.day = dayKey(); A.n = 0; } return Math.max(0, ARENA_A_DAY - A.n); },
  arenaChallenge(id) {
    const C = ARENA_CHAMPS.find((x) => x.id === id), p = this.player, S = this.S; if (!C) return false;
    if (!this.arenaOk()) return false;
    if (!this.arenaLeft()) { this.ui.toast('Five rated arena fights a day: come back tomorrow', 'warn'); return false; }
    this.S.arena.n++;
    const a = p.yaw, [x, z] = this.world.nearestFree(p.pos.x + Math.sin(a) * 7, p.pos.z + Math.cos(a) * 7);
    const m = this.createMonster({ type: 'rival', x, z, r: 0, lvl: [S.level, S.level] }, { exact: true, summoned: true });
    // strength follows the champion's rating: about 8% of your Max HP a hit at 1000, and a long fight
    const k = C.r / 1000, K = 50 + 8 * S.level;
    m.maxHp = m.hp = Math.round(this.atkOf(p) * 16 * k * (K + 3 + 2.4 * S.level) / K);
    m.atk = p.maxHp * 0.07 * k * (K + this.defOf(p)) / K; m.def = 3 + 2.4 * S.level;
    m.arena = C.id; m.wanderT = 1e9; m.noLeash = true; m.target = p; m.tagged = false;
    m.labelHtml = `Lv${S.level} ${esc(C.name)} <em>ARENA ${C.r}</em>`; if (m.np) m.np.querySelector('.n').innerHTML = m.labelHtml;
    this.arenaFight = { m, C, x: p.pos.x, z: p.pos.z, t: 0 };
    this.ui.closePanels(); this.auto && this.toggleAuto(false);
    this.fx.ring(p.pos, 0xffd84a, DUEL_RING, 1.2); this.ui.banner('ARENA', `vs ${C.name} (${C.r})`, 'level'); this.sfx.play('boom');
    this.setTarget(m);
    return true;
  },
  arenaUpdate(dt) {
    const F = this.arenaFight; if (!F) return;
    F.t += dt;
    if (F.m.dead) return;
    if (flat(this.player.pos, F) > DUEL_RING + 15) this.arenaLost('You left the arena');
    else if (F.t > 120) this.arenaLost('Time is up');
  },
  arenaWon(m) {
    const F = this.arenaFight; this.arenaFight = null; if (!F) return;
    const d = this.arenaRate(F.C.r, 1, `Arena fight with ${F.C.name}`), gold = 2000 + this.S.level * 40;
    this.S.gold += gold; this.ui.refreshWallet();
    this.ui.banner('VICTORY', `+${fmt(gold)} Gold · Arena ${fmt(this.S.arena.r)} (+${d})`, 'loot5'); this.sfx.play('legend');
    this.track && this.track('arena');
    this.save();
  },
  arenaLost(why = 'You fell') {
    const F = this.arenaFight; this.arenaFight = null; if (!F) return;
    const p = this.player; p.hp = Math.max(1, Math.min(p.hp, Math.round(p.maxHp * 0.3)));
    if (!F.m.removed) this.removeEnt(F.m);
    const d = this.arenaRate(F.C.r, 0, `Arena fight with ${F.C.name}`);
    this.ui.banner('DEFEAT', `${why} · Arena ${fmt(this.S.arena.r)} (${d})`, ''); this.sfx.play('error');
    this.save();
  },
};

const U = {
  panel_arena(body) {
    const g = this.g, S = g.S, A = S.arena, T = arenaTier(A.r);
    body.appendChild(h('div', 'ar-me', `<span class="ar-tier" style="--tc:${T[2]}">${T[1]}</span><b>${fmt(A.r)}</b> rating · ${A.w} won · ${A.l} lost${A.d ? ` · ${A.d} drawn` : ''} · <span class="muted">${g.arenaLeft()} of ${ARENA_A_DAY} rated arena fights left today</span>`));
    const tab = this.tabs(body, 'arTab', [['ladder', 'Ladder'], ['duel', 'Duels']]);
    if (tab === 'ladder') {
      const rows = [...ARENA_CHAMPS.map((c) => ({ name: c.name, r: c.r, champ: c })), { name: S.name, r: A.r, me: true },
        ...[...mp.peers.values()].filter((pr) => pr.info.level >= ARENA_LV && !pr.info.gm).map((pr) => ({ name: pr.info.name, r: pr.info.ar || 1000, online: true }))].sort((a, b) => b.r - a.r);
      const L = h('div', 'list ar-list');
      rows.forEach((x, i) => {
        const t = arenaTier(x.r);
        const r = h('div', 'row slim' + (x.me ? ' me' : ''), `<div class="ar-rank">${i + 1}</div><div class="tx"><b>${esc(x.name)}${x.me ? ' (you)' : ''}</b><small><span style="color:${t[2]}">${t[1]}</span> · ${fmt(x.r)}${x.champ ? ' · arena champion' : x.online ? ' · online' : ''}</small></div>`);
        if (x.champ) { const b = h('button', 'btn small', 'Fight'); b.disabled = !g.arenaLeft() || S.level < ARENA_LV; b.onclick = () => g.arenaChallenge(x.champ.id); r.appendChild(b); }
        L.appendChild(r);
      });
      body.appendChild(L);
      body.appendChild(h('div', 'note', `Arena champions fight at your level, as strong as their rating. Five rated fights a day; a win pays Gold. Duels with other players count for the ladder too. Tiers: ${ARENA_TIERS.map((x) => `${x[1]} ${x[0] || ''}`.trim()).join(' · ')}.`));
    } else {
      const near = (g.rplayers || []).filter((e) => !e.netHidden && mp.peers.get(e.peerId)).map((e) => ({ e, pr: mp.peers.get(e.peerId), d: Math.round(flat(e.pos, g.player.pos)) })).sort((a, b) => a.d - b.d);
      const L = h('div', 'list');
      for (const { e, pr, d } of near) {
        const r = h('div', 'row slim', `<div class="tx"><b>${esc(pr.info.name)}</b><small>Lv ${pr.info.level} · arena ${fmt(pr.info.ar || 1000)} · ${d} m away</small></div>`);
        const b = h('button', 'btn small', 'Challenge'); b.disabled = d > 25 || pr.info.level < ARENA_LV || !!g.duel; b.title = d > 25 ? 'Walk within 25 m' : pr.info.level < ARENA_LV ? `They need Lv ${ARENA_LV}` : '';
        b.onclick = () => g.duelAsk(e.peerId); r.appendChild(b); L.appendChild(r);
      }
      if (!near.length) L.appendChild(h('div', 'muted', 'Nobody is nearby. Players you can see appear here (or click a player and choose Duel).'));
      body.appendChild(L);
      body.appendChild(h('div', 'note', `A duel is 1 v 1 inside a ring of light (${DUEL_RING} m) and nobody dies: falling to 1 HP, stepping out of the ring or leaving loses, and after ${DUEL_SECS} seconds the one with more HP left wins. Both ratings change.`));
    }
  },
};

export function installDuel(Game) { Object.assign(Game.prototype, G); }
export function installDuelUI(UI) { Object.assign(UI.prototype, U); }
