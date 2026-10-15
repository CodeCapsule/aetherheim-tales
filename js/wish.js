// Star Wish: a daily lottery wheel. Two free wishes every day, more for Diamonds (one, or ten at a time). Twelve prizes
// sit around the wheel; the grand prize is the Starlight Unicorn, and the 100th wish without it is sure to bring it.
// Prizes are granted the moment you wish (closing the window loses nothing); the wheel only shows where it landed.
import { ico } from './icons.js';
import { MATERIALS, dayKey } from './systems-data.js';
import { ITEMS, MOUNTS } from './data.js';

export const WISH_FREE = 2, WISH_PITY = 100;
export const WISH_ONE = { diamonds: 30 }, WISH_TEN = { diamonds: 270 };
// w: weight (the grand prize is about 1 in 300 wishes)
export const WISH_PRIZES = [
  { id: 'gold', w: 22, gold: 3000 },
  { id: 'lucky', w: 14, lucky: 10 },
  { id: 'stone', w: 12, mats: [['enh_stone', 5]] },
  { id: 'ess', w: 12, mats: [['star_essence', 1]] },
  { id: 'gold2', w: 8, gold: 15000, rare: true },
  { id: 'egg', w: 6, items: [['pet_egg', 1]] },
  { id: 'stone2', w: 6, mats: [['enh_stone2', 3]] },
  { id: 'ticket', w: 6, items: [['lucky_ticket', 1]], rare: true },
  { id: 'charm', w: 5, items: [['enh_luck', 1]] },
  { id: 'ess3', w: 4, mats: [['star_essence', 3]], rare: true },
  { id: 'dia', w: 4, diamonds: 50, rare: true },
  { id: 'unicorn', w: 0.35, mount: 'mount_unicorn', grand: true },
];
const GRAND = WISH_PRIZES.findIndex((p) => p.grand);
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export function prizeLabel(p) {
  if (p.gold) return `${fmt(p.gold)} Gold`;
  if (p.diamonds) return `${p.diamonds} Diamonds`;
  if (p.lucky) return `${p.lucky} Lucky Points`;
  if (p.mount) return MOUNTS.find((m) => m.id === p.mount)?.name || p.mount;
  const [id, n] = (p.items || p.mats)[0], name = ITEMS[id]?.name || MATERIALS[id]?.name || id;
  return n > 1 ? `${name} x${n}` : name;
}
function prizeIcon(g, p) {
  if (p.mount) return `<img alt="" src="${g.mountIcon(p.mount)}">`;
  if (p.gold) return ico('gold'); if (p.diamonds) return ico('diamond'); if (p.lucky) return ico('lucky_ticket');
  const id = (p.items || p.mats)[0][0];
  return ico(ITEMS[id]?.icon || MATERIALS[id]?.icon || id);
}
function pick(rng = Math.random) {
  const tot = WISH_PRIZES.reduce((a, p) => a + p.w, 0);
  let r = rng() * tot;
  for (let i = 0; i < WISH_PRIZES.length; i++) { r -= WISH_PRIZES[i].w; if (r < 0) return i; }
  return 0;
}

// ============================================================ game side
const G = {
  wishState() { const S = this.S; if (!S.wish || S.wish.day !== dayKey()) S.wish = { n: 0, pity: 0, ...(S.wish || {}), day: dayKey(), free: 0 }; return S.wish; },
  wishFreeLeft() { return Math.max(0, WISH_FREE - this.wishState().free); },
  // n: 1 or 10; a single wish uses a free one first. Returns the prize indexes.
  wish(n = 1) {
    const W = this.wishState();
    const free = n === 1 && this.wishFreeLeft() > 0;
    if (!free && !this.pay(n === 10 ? WISH_TEN : WISH_ONE)) return null;
    if (free) W.free++;
    const out = [];
    for (let k = 0; k < n; k++) {
      W.n++; W.pity = (W.pity || 0) + 1;
      const i = W.pity >= WISH_PITY ? GRAND : pick();
      if (i === GRAND) W.pity = 0;
      out.push(i); this.wishGrant(WISH_PRIZES[i]);
    }
    this.track && this.track('wish');
    this.ui.refreshWallet(); this.ui.refreshActs(); this.save();
    return out;
  },
  wishGrant(p) {
    const S = this.S;
    if (p.mount && S.mounts.includes(p.mount)) { S.diamonds += 300; return; } // a second unicorn turns into 300 Diamonds
    this.grant({ gold: p.gold, diamonds: p.diamonds, lucky: p.lucky, items: p.items, mats: p.mats, mount: p.mount });
    if (p.grand) this.ui.chat('announce', `<b>[Announcement]</b> The stars answered ${esc(S.name)}'s wish: <b>[${prizeLabel(p)}]</b>!`);
  },
};

// ============================================================ the window
// the 12 prizes go clockwise around a 4 x 4 board; the middle holds the buttons
const RING = [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1]];
const U = {
  panel_wish(body) {
    const g = this.g, S = g.S, W = g.wishState(), free = g.wishFreeLeft(), F = this.wishFx;
    const board = h('div', 'wish-board');
    WISH_PRIZES.forEach((p, i) => {
      const [x, y] = RING[i];
      const c = h('div', 'wish-cell' + (p.grand ? ' grand' : p.rare ? ' rare' : ''), `${prizeIcon(g, p)}<small>${prizeLabel(p)}</small>`);
      c.style.gridColumn = x + 1; c.style.gridRow = y + 1; c.dataset.i = i;
      if (F && F.at === i) c.classList.add('hl');
      board.appendChild(c);
    });
    const mid = h('div', 'wish-mid');
    mid.innerHTML = `<div class="wm-t">${ico('wish')}<b>Make a wish</b></div>
      <div class="muted">${free ? `${free} free wish${free === 1 ? '' : 'es'} left today` : 'Free wishes return tomorrow'} · ${WISH_PITY - (W.pity || 0)} to a sure Unicorn</div>`;
    const acts = h('div', 'wm-acts');
    const one = h('button', 'btn' + (free ? ' green' : ''), free ? 'Wish (free)' : `Wish · <span class="gem"></span>${WISH_ONE.diamonds}`);
    const ten = h('button', 'btn', `Wish x10 · <span class="gem"></span>${WISH_TEN.diamonds}`);
    const busy = F && !F.done;
    one.disabled = busy || (!free && S.diamonds < WISH_ONE.diamonds); ten.disabled = busy || S.diamonds < WISH_TEN.diamonds;
    one.onclick = () => this.wishGo(1); ten.onclick = () => this.wishGo(10);
    acts.append(one, ten); mid.appendChild(acts);
    mid.style.gridColumn = '2 / 4'; mid.style.gridRow = '2 / 4';
    board.appendChild(mid);
    body.appendChild(board);
    if (F && F.done) {
      const got = h('div', 'wish-got', `<b>You received</b>${F.res.map((i) => `<span class="wg${WISH_PRIZES[i].grand ? ' grand' : WISH_PRIZES[i].rare ? ' rare' : ''}">${prizeIcon(g, WISH_PRIZES[i])}${prizeLabel(WISH_PRIZES[i])}</span>`).join('')}`);
      body.appendChild(got);
    }
    body.appendChild(h('div', 'note', `Two free wishes every day. Prizes go straight to your bag and wallet. The grand prize is the <b>Starlight Unicorn</b> (a second one becomes 300 Diamonds). You have made ${fmt(W.n)} wish${W.n === 1 ? '' : 'es'}.`));
  },
  // wish, then run the light around the wheel to where it landed (the best prize of a ten-wish)
  wishGo(n) {
    const g = this.g, res = g.wish(n); if (!res) return;
    const best = res.reduce((b, i) => (WISH_PRIZES[i].grand ? i : WISH_PRIZES[b].grand ? b : WISH_PRIZES[i].rare && !WISH_PRIZES[b].rare ? i : b), res[0]);
    const from = this.wishFx?.at ?? 0, steps = 24 + ((best - from + 12) % 12);
    const F = this.wishFx = { at: from, from, steps, t0: performance.now(), dur: 2400, res, done: false };
    g.sfx.play('chest');
    this.renderPanel();
    const tick = () => {
      if (this.wishFx !== F) return;
      const t = Math.min(1, (performance.now() - F.t0) / F.dur), k = Math.floor((1 - (1 - t) ** 3) * F.steps);
      const at = (F.from + k) % 12;
      if (at !== F.at) {
        F.at = at; g.sfx.play('click');
        if (this.panelName === 'wish') for (const c of this.panel.querySelectorAll('.wish-cell')) c.classList.toggle('hl', +c.dataset.i === at);
      }
      if (t < 1) { requestAnimationFrame(tick); return; }
      F.done = true;
      const top = WISH_PRIZES[best];
      g.sfx.play(top.grand ? 'legend' : top.rare ? 'rare' : 'coin');
      if (top.grand) { this.banner('STAR WISH!', prizeLabel(top), 'loot5'); g.fx.shake && g.fx.shake(0.3); }
      this.toast(res.length === 1 ? `Star Wish: ${prizeLabel(top)}` : `Ten wishes granted · best: ${prizeLabel(top)}`, 'good');
      if (this.panelName === 'wish') this.renderPanel();
    };
    requestAnimationFrame(tick);
  },
};

export function installWish(Game) { Object.assign(Game.prototype, G); }
export function installWishUI(UI) { Object.assign(UI.prototype, U); }
