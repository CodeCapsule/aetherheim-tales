// Mini-games (from Lv 8), in the Mini-games window. The first three games of each kind every day pay rewards.
// - Spirit Cards: sixteen face-down cards hide eight pairs of pets; find the pairs within 24 flips. Gold for every
//   pair, and a Lucky Ticket for clearing the board.
// - Tower Defense: monsters march along a road towards the town gate; build Arrow, Frost and Cannon towers on the
//   stone pads with the coins they drop (and upgrade them to Lv 3), and hold ten waves. Gold for every wave held, and a Lucky Ticket and Star
//   Essence for all ten. It runs on its own little clock (td.step), separate from the 3D world.
import { PETS } from './data.js';
import { dayKey } from './systems-data.js';

export const GAMES_LV = 8, GAMES_A_DAY = 3;
export const CARD_FLIPS = 24;
// Tower Defense: the road (canvas units 480 x 300), the build pads and the towers
export const TD_PATH = [[0, 60], [140, 60], [140, 220], [300, 220], [300, 80], [420, 80], [420, 250], [480, 250]];
export const TD_PADS = [[90, 120], [200, 120], [200, 270], [240, 160], [360, 140], [360, 30], [470, 170], [80, 20], [250, 40]];
export const TD_TOWERS = {
  arrow: { name: 'Arrow', cost: 40, range: 80, rate: 0.7, dmg: 8, color: '#ffd84a' },
  frost: { name: 'Frost', cost: 50, range: 75, rate: 0.9, dmg: 5, slow: 0.5, color: '#9ae8ff' },
  cannon: { name: 'Cannon', cost: 70, range: 75, rate: 1.5, dmg: 22, splash: 30, color: '#ff8a5a' },
};
export const TD_WAVES = 10, TD_MAX_LV = 3;
export const tdUpCost = (T) => TD_TOWERS[T.kind].cost * T.lv; // a tower's next level
const tdDmg = (T) => TD_TOWERS[T.kind].dmg * (1 + 0.6 * (T.lv - 1)), tdRange = (T) => TD_TOWERS[T.kind].range * (1 + 0.1 * (T.lv - 1));
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const segLen = TD_PATH.slice(1).map((p, i) => Math.hypot(p[0] - TD_PATH[i][0], p[1] - TD_PATH[i][1]));
const PATH_LEN = segLen.reduce((a, b) => a + b, 0);
const along = (d) => { for (let i = 0; i < segLen.length; i++) { if (d <= segLen[i]) { const k = d / segLen[i], a = TD_PATH[i], b = TD_PATH[i + 1]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; } d -= segLen[i]; } return TD_PATH[TD_PATH.length - 1]; };

// ------------------------------------------------------------ a Tower Defense game (no DOM; the window draws it)
export const TD_HP = (w) => 14 + 8 * w + (w >= 6 ? 10 * (w - 5) : 0); // a foe's HP in wave w
export function newTd() { return { coins: 150, lives: 10, wave: 0, held: 0, towers: [], foes: [], shots: [], spawnLeft: 0, spawnT: 0, waveT: 2, over: false, won: false, t: 0 }; }
export function tdStep(td, dt) {
  if (td.over) return;
  td.t += dt;
  // waves: after a short break the next one marches
  if (!td.foes.length && !td.spawnLeft) {
    if (td.wave > td.held) td.held = td.wave;
    if (td.wave >= TD_WAVES) { td.over = true; td.won = true; return; }
    td.waveT -= dt;
    if (td.waveT <= 0) { td.wave++; td.spawnLeft = 5 + td.wave * 2; td.spawnT = 0; td.waveT = 3; }
  }
  if (td.spawnLeft > 0) {
    td.spawnT -= dt;
    if (td.spawnT <= 0) { td.spawnT = 0.8; td.spawnLeft--; const hp = TD_HP(td.wave); td.foes.push({ d: 0, hp, max: hp, speed: 36 + td.wave * 2, slowT: 0, boss: td.spawnLeft === 0 && td.wave % 5 === 0 }); if (td.foes[td.foes.length - 1].boss) { const f = td.foes[td.foes.length - 1]; f.hp = f.max = hp * 6; f.speed *= 0.7; } }
  }
  for (const f of td.foes) {
    f.slowT = Math.max(0, f.slowT - dt);
    f.d += f.speed * (f.slowT > 0 ? 0.5 : 1) * dt;
    [f.x, f.y] = along(f.d);
  }
  // foes reaching the gate cost lives
  for (const f of td.foes) if (f.d >= PATH_LEN && !f.gone) { f.gone = true; td.lives -= f.boss ? 3 : 1; }
  td.foes = td.foes.filter((f) => !f.gone && f.hp > 0);
  if (td.lives <= 0) { td.lives = 0; td.over = true; return; }
  // towers fire at the foe furthest along within range
  for (const T of td.towers) {
    const D = TD_TOWERS[T.kind], R = tdRange(T); T.cd -= dt; if (T.cd > 0) continue;
    let tgt = null;
    for (const f of td.foes) if (Math.hypot(f.x - T.x, f.y - T.y) <= R && (!tgt || f.d > tgt.d)) tgt = f;
    if (!tgt) continue;
    T.cd = D.rate;
    td.shots.push({ x: T.x, y: T.y, tx: tgt.x, ty: tgt.y, t: 0.15, color: D.color });
    const hit = (f, dmg) => { f.hp -= dmg; if (f.hp <= 0 && !f.dead) { f.dead = true; td.coins += f.boss ? 40 : 6; } };
    if (D.splash) { for (const f of td.foes) if (Math.hypot(f.x - tgt.x, f.y - tgt.y) <= D.splash) hit(f, tdDmg(T)); }
    else hit(tgt, tdDmg(T));
    if (D.slow) tgt.slowT = 1.5;
  }
  td.foes = td.foes.filter((f) => f.hp > 0);
  for (const s of td.shots) s.t -= dt;
  td.shots = td.shots.filter((s) => s.t > 0);
}
export function tdBuild(td, pad, kind) {
  const D = TD_TOWERS[kind], P = TD_PADS[pad];
  if (!D || !P || td.over || td.towers.some((t) => t.pad === pad) || td.coins < D.cost) return false;
  td.coins -= D.cost; td.towers.push({ pad, kind, x: P[0], y: P[1], cd: 0, lv: 1 });
  return true;
}
export function tdUpgrade(td, pad) {
  const T = td.towers.find((t) => t.pad === pad);
  if (!T || td.over || T.lv >= TD_MAX_LV || td.coins < tdUpCost(T)) return false;
  td.coins -= tdUpCost(T); T.lv++;
  return true;
}

const G = {
  gamesOk() { if (this.S.level < GAMES_LV && !this.S.gm) { this.ui.toast(`Mini-games open at Lv ${GAMES_LV}`, 'warn'); return false; } return true; },
  gamesDay() { const S = this.S; if (!S.games || S.games.day !== dayKey()) S.games = { day: dayKey(), cards: 0, td: 0, best: S.games?.best || 0 }; return S.games; },
  gamesLeft(kind) { return Math.max(0, GAMES_A_DAY - this.gamesDay()[kind]); },
  // ---------------------------------------------------------------- Spirit Cards
  cardsNew() {
    if (!this.gamesOk()) return null;
    const pool = PETS.slice().sort(() => Math.random() - 0.5).slice(0, 8).map((p) => p.id);
    const deck = [...pool, ...pool].sort(() => Math.random() - 0.5).map((id) => ({ id, up: false, done: false }));
    this.cards = { deck, flips: 0, pairs: 0, open: [], over: false, paid: this.gamesLeft('cards') > 0 };
    if (this.cards.paid) this.gamesDay().cards++;
    this.save();
    return this.cards;
  },
  cardFlip(i) {
    const C = this.cards; if (!C || C.over) return null;
    const c = C.deck[i]; if (!c || c.up || c.done || C.open.length >= 2) return null;
    c.up = true; C.open.push(i); C.flips++;
    if (C.open.length === 2) {
      const [a, b] = C.open.map((k) => C.deck[k]);
      if (a.id === b.id) { a.done = b.done = true; C.open = []; C.pairs++; this.sfx.play('coin'); }
      else this.after(0.8, () => { for (const k of C.open) C.deck[k].up = false; C.open = []; this.ui.panelName === 'games' && this.ui.renderPanel(); });
    }
    if (C.pairs === 8 || (C.flips >= CARD_FLIPS && C.open.length !== 2)) this.cardsEnd();
    else if (C.flips >= CARD_FLIPS) this.after(0.85, () => this.cardsEnd());
    return c;
  },
  cardsEnd() {
    const C = this.cards; if (!C || C.over) return;
    C.over = true;
    if (C.paid && C.pairs) {
      const gold = C.pairs * (150 + this.S.level * 10); this.S.gold += gold;
      if (C.pairs === 8) this.addItem('lucky_ticket', 1);
      this.ui.toast(`Spirit Cards: ${C.pairs} pairs · +${fmt(gold)} Gold${C.pairs === 8 ? ' · a Lucky Ticket!' : ''}`, 'good');
      this.ui.refreshWallet(); this.track && this.track('minigame');
    } else this.ui.toast(`Spirit Cards: ${C.pairs} pairs${C.paid ? '' : ' (just for fun today)'}`);
    this.sfx.play(C.pairs === 8 ? 'legend' : 'quest');
    this.save();
    if (this.ui.panelName === 'games') this.ui.renderPanel();
  },
  // ---------------------------------------------------------------- Tower Defense
  tdNew() {
    if (!this.gamesOk()) return null;
    this.td = newTd(); this.td.paid = this.gamesLeft('td') > 0;
    if (this.td.paid) this.gamesDay().td++;
    this.save();
    return this.td;
  },
  tdTick(dt) {
    const td = this.td; if (!td || td.over) return;
    tdStep(td, dt);
    if (td.over) this.tdEnd();
  },
  tdEnd() {
    const td = this.td; if (!td || td.rewarded) return;
    td.rewarded = true;
    const G2 = this.gamesDay(); G2.best = Math.max(G2.best || 0, td.held);
    if (td.paid && td.held) {
      const gold = td.held * (200 + this.S.level * 12); this.S.gold += gold;
      if (td.won) { this.addItem('lucky_ticket', 1); this.addMat('star_essence', 2, true); }
      this.ui.toast(`Tower Defense: ${td.held} waves held · +${fmt(gold)} Gold${td.won ? ' · Lucky Ticket and 2 Star Essence!' : ''}`, 'good');
      this.ui.refreshWallet(); this.track && this.track('minigame');
    } else this.ui.toast(`Tower Defense: ${td.held} waves held${td.paid ? '' : ' (just for fun today)'}`);
    this.sfx.play(td.won ? 'legend' : 'quest');
    this.save();
  },
};

const U = {
  panel_games(body) {
    const g = this.g;
    if (g.S.level < GAMES_LV && !g.S.gm) { body.appendChild(h('div', 'note', `Mini-games open at Lv ${GAMES_LV}.`)); return; }
    const tab = this.tabs(body, 'gmTab', [['cards', `Spirit Cards (${g.gamesLeft('cards')}/${GAMES_A_DAY})`], ['td', `Tower Defense (${g.gamesLeft('td')}/${GAMES_A_DAY})`]]);
    if (tab === 'cards') this.cardsView(body); else this.tdView(body);
  },
  cardsView(body) {
    const g = this.g, C = g.cards;
    if (!C) {
      body.appendChild(h('div', 'note', `Sixteen cards hide eight pairs of pets. Find them within ${CARD_FLIPS} flips: Gold for every pair, a Lucky Ticket for clearing the board. The first ${GAMES_A_DAY} games each day pay rewards.`));
      const b = h('button', 'btn green', 'Deal the cards'); b.onclick = () => { g.cardsNew(); this.renderPanel(); }; body.appendChild(b);
      return;
    }
    body.appendChild(h('div', 'mg-top', `<b>${C.pairs} / 8 pairs</b><span>${CARD_FLIPS - C.flips} flips left${C.paid ? '' : ' · just for fun'}</span>`));
    const grid = h('div', 'mg-cards');
    C.deck.forEach((c, i) => {
      const b = h('button', 'mg-card' + (c.up || c.done ? ' up' : '') + (c.done ? ' done' : ''), c.up || c.done ? `<img alt="" src="${g.petIcon(c.id)}">` : '<span>✦</span>');
      b.setAttribute('aria-label', c.up || c.done ? 'Card face up' : `Card ${i + 1}`);
      b.disabled = C.over || c.done; b.onclick = () => { if (g.cardFlip(i)) this.renderPanel(); };
      grid.appendChild(b);
    });
    body.appendChild(grid);
    if (C.over) { const b = h('button', 'btn green', 'Play again'); b.onclick = () => { g.cardsNew(); this.renderPanel(); }; body.appendChild(b); }
  },
  tdView(body) {
    const g = this.g, td = g.td;
    if (!td) {
      body.appendChild(h('div', 'note', `Monsters march on the town gate. Tap a stone pad to build an Arrow (${TD_TOWERS.arrow.cost}), Frost (${TD_TOWERS.frost.cost}, slows) or Cannon (${TD_TOWERS.cannon.cost}, hits a group) tower with the coins they drop; tap a tower to upgrade it (up to Lv ${TD_MAX_LV}). Hold ${TD_WAVES} waves. The first ${GAMES_A_DAY} games each day pay rewards. Best today: ${g.gamesDay().best || 0} waves.`));
      const b = h('button', 'btn green', 'Start'); b.onclick = () => { g.tdNew(); this.renderPanel(); }; body.appendChild(b);
      return;
    }
    const top = h('div', 'mg-top', ''); body.appendChild(top);
    const cv = h('canvas', 'td-cv'); cv.width = 480; cv.height = 300; body.appendChild(cv);
    const bar = h('div', 'td-bar'); body.appendChild(bar);
    const sel = this.sel.tdPad, built = sel != null && td.towers.find((t) => t.pad === sel);
    if (built) {
      const D = TD_TOWERS[built.kind], max = built.lv >= TD_MAX_LV;
      const b = h('button', 'btn small', max ? `${D.name} · max level` : `Upgrade ${D.name} ➜ Lv ${built.lv + 1} · ${tdUpCost(built)}`); b.style.setProperty('--tc', D.color);
      b.disabled = max || td.over || td.coins < tdUpCost(built);
      b.onclick = () => { if (tdUpgrade(td, sel)) { g.sfx.play('upgrade'); this.renderPanel(); } };
      bar.appendChild(b);
    } else for (const [k, D] of Object.entries(TD_TOWERS)) {
      const b = h('button', 'btn small', `${D.name} · ${D.cost}`); b.style.setProperty('--tc', D.color);
      b.disabled = sel == null || td.coins < D.cost || td.over || td.towers.some((t) => t.pad === sel);
      b.onclick = () => { if (tdBuild(td, sel, k)) { g.sfx.play('upgrade'); this.sel.tdPad = null; this.renderPanel(); } };
      bar.appendChild(b);
    }
    if (td.over) { const b = h('button', 'btn green', 'Play again'); b.onclick = () => { g.tdNew(); this.renderPanel(); }; bar.appendChild(b); }
    cv.onclick = (ev) => {
      const r = cv.getBoundingClientRect(), x = (ev.clientX - r.left) * 480 / r.width, y = (ev.clientY - r.top) * 300 / r.height;
      const i = TD_PADS.findIndex((P) => Math.hypot(P[0] - x, P[1] - y) < 18);
      if (i >= 0) { this.sel.tdPad = i; this.renderPanel(); }
    };
    const draw = () => {
      const c = cv.getContext('2d'); if (!c) return;
      top.innerHTML = `<b>Wave ${td.wave} / ${TD_WAVES}</b><span>♥ ${td.lives} · coins ${td.coins}${td.over ? (td.won ? ' · VICTORY' : ' · the gate fell') : ''}${td.paid ? '' : ' · just for fun'}</span>`;
      c.fillStyle = '#3a6a3a'; c.fillRect(0, 0, 480, 300);
      c.strokeStyle = '#c8a46a'; c.lineWidth = 22; c.lineJoin = 'round'; c.beginPath(); TD_PATH.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
      c.fillStyle = '#8a6a3a'; c.fillRect(462, 230, 18, 40);
      TD_PADS.forEach(([x, y], i) => { c.fillStyle = i === this.sel.tdPad ? '#ffe7a8' : '#9a9aa8'; c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill(); });
      for (const T of td.towers) { const D = TD_TOWERS[T.kind]; c.fillStyle = D.color; c.beginPath(); c.arc(T.x, T.y, 9 + T.lv, 0, 7); c.fill(); c.strokeStyle = '#1a1020'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#1a1020'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText(String(T.lv), T.x, T.y + 4); }
      for (const f of td.foes) { c.fillStyle = f.boss ? '#9a2a6a' : f.slowT > 0 ? '#7ab8ff' : '#e85a4a'; c.beginPath(); c.arc(f.x, f.y, f.boss ? 10 : 7, 0, 7); c.fill(); c.fillStyle = '#000'; c.fillRect(f.x - 9, f.y - 14, 18, 3); c.fillStyle = '#7aff7a'; c.fillRect(f.x - 9, f.y - 14, 18 * Math.max(0, f.hp / f.max), 3); }
      for (const s of td.shots) { c.strokeStyle = s.color; c.lineWidth = 2; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.tx, s.ty); c.stroke(); }
    };
    draw();
    // its own little clock while the window is open
    clearInterval(this.tdTimer);
    this.tdTimer = setInterval(() => {
      if (this.panelName !== 'games' || this.sel.gmTab !== 'td' || g.td !== td || !cv.isConnected) { clearInterval(this.tdTimer); return; }
      const was = td.over; g.tdTick(0.05); draw();
      if (td.over && !was) this.renderPanel();
    }, 50);
  },
};

export function installMiniGames(Game) { Object.assign(Game.prototype, G); }
export function installMiniGamesUI(UI) { Object.assign(UI.prototype, U); }
