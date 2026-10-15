// Attribute Stars: from Lv 34 a new star opens every 2 levels, 18 in all by Lv 68. Awakening a star rolls one random
// stat and a value within the star's range; upgrading it (Star Essence and gold) raises the top of that range, tier 1
// to 5, and a re-roll draws a new value (or a new stat), which you keep or discard. The bonuses join the passive stats
// recalc already reads (game.js), so they count everywhere a passive does.
import { ico } from './icons.js';
import { MATERIALS } from './systems-data.js';

export const STAR_START = 34, STAR_EVERY = 2, STAR_MAX = 18, STAR_TIERS = 5;
export const starLevel = (i) => STAR_START + STAR_EVERY * i; // star i (0-17)
// each stat's roll range: from lo up to hi[tier - 1]
export const STAR_STATS = {
  atkPct: { name: 'Attack', short: 'ATK', lo: 0.2, hi: [1.2, 2, 2.8, 3.6, 4.5], color: '#ff8a5a', cp: 60 },
  hpPct: { name: 'Max HP', short: 'HP', lo: 0.2, hi: [1.2, 2, 2.8, 3.6, 4.5], color: '#7aff7a', cp: 40 },
  defPct: { name: 'Defense', short: 'DEF', lo: 0.2, hi: [1.2, 2, 2.8, 3.6, 4.5], color: '#7ac8ff', cp: 40 },
  crit: { name: 'Critical chance', short: 'CRIT', lo: 0.1, hi: [0.6, 1, 1.4, 1.8, 2.2], color: '#ffd84a', cp: 80 },
  critDmg: { name: 'Critical damage', short: 'CDMG', lo: 0.5, hi: [3, 5, 7, 9, 11], color: '#ffb02a', cp: 15 },
  dodge: { name: 'Dodge', short: 'DODGE', lo: 0.1, hi: [0.5, 0.8, 1.1, 1.4, 1.7], color: '#b8f0ff', cp: 80 },
  skillDmg: { name: 'Skill damage', short: 'SKILL', lo: 0.2, hi: [1.2, 2, 2.8, 3.6, 4.5], color: '#c8a0ff', cp: 50 },
};
const KEYS = Object.keys(STAR_STATS);
export const starUpCost = (t) => ({ gold: 4000 * t * t, mats: { star_essence: t * 2 } }); // tier t -> t + 1
export const STAR_REROLL = { gold: 1500, mats: { star_essence: 1 } };
export const STAR_RESTAT = { gold: 4000, mats: { star_essence: 3 } };
const round = (v) => Math.round(v * 10) / 10;
const roll = (key, tier) => { const st = STAR_STATS[key]; return round(st.lo + Math.random() * (st.hi[tier - 1] - st.lo)); };
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmtV = (key, v) => `+${v.toFixed(1).replace(/\.0$/, '')}%`;
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
// what something costs, with what you have (red when short)
export const costChips = (g, c = {}) => {
  const out = [];
  if (c.gold) out.push(`<span class="need ${g.S.gold >= c.gold ? '' : 'no'}"><span class="coin"></span>${fmt(c.gold)}</span>`);
  if (c.diamonds) out.push(`<span class="need ${g.S.diamonds >= c.diamonds ? '' : 'no'}"><span class="gem"></span>${fmt(c.diamonds)}</span>`);
  for (const [id, n] of Object.entries(c.mats || {})) out.push(`<span class="need ${g.matCount(id) >= n ? '' : 'no'}" title="${MATERIALS[id]?.name || id}">${ico(MATERIALS[id]?.icon || id, 'ico inl')}${g.matCount(id)}/${n}</span>`);
  return out.join('');
};

// ============================================================ game side
const G = {
  starsInit() { const S = this.S; if (!Array.isArray(S.stars) || S.stars.length !== STAR_MAX) S.stars = Array.from({ length: STAR_MAX }, (_, i) => (S.stars?.[i] && STAR_STATS[S.stars[i].s] ? S.stars[i] : null)); },
  starsOpen() { return Math.max(0, Math.min(STAR_MAX, Math.floor((this.S.level - STAR_START) / STAR_EVERY) + 1)); },
  // what the stars add (recalc merges it into the passive stats)
  starTotals() {
    const out = {};
    for (const s of this.S.stars || []) if (s && STAR_STATS[s.s]) out[s.s] = (out[s.s] || 0) + s.v;
    return out;
  },
  addStarStats(ps) { for (const [k, v] of Object.entries(this.starTotals())) ps[k] = (ps[k] || 0) + v; },
  starCP() { let n = 0; for (const [k, v] of Object.entries(this.starTotals())) n += v * STAR_STATS[k].cp; return Math.round(n); },
  starAwaken(i) {
    const S = this.S; this.starsInit();
    if (i >= this.starsOpen()) { this.ui.toast(`This star opens at Lv ${starLevel(i)}`, 'warn'); return; }
    if (S.stars[i]) return;
    const s = KEYS[(Math.random() * KEYS.length) | 0];
    S.stars[i] = { s, v: roll(s, 1), t: 1 };
    this.starDone(`Star ${i + 1} awakened: ${STAR_STATS[s].name} ${fmtV(s, S.stars[i].v)}`);
  },
  starUpgrade(i) {
    const st = this.S.stars[i]; if (!st) return;
    if (st.t >= STAR_TIERS) { this.ui.toast('This star is at its highest tier', 'warn'); return; }
    if (!this.pay(starUpCost(st.t))) return;
    st.t++;
    this.starDone(`Star ${i + 1} is now tier ${st.t}: its range reaches ${fmtV(st.s, STAR_STATS[st.s].hi[st.t - 1])}`);
  },
  // a new value (or stat, with restat) to keep or discard
  starReroll(i, restat = false) {
    const S = this.S, st = S.stars[i]; if (!st) return;
    if (!this.pay(restat ? STAR_RESTAT : STAR_REROLL)) return;
    const s = restat ? KEYS[(Math.random() * KEYS.length) | 0] : st.s;
    S.starRoll = { i, s, v: roll(s, st.t) };
    this.sfx.play('upgrade'); this.ui.refreshPanel(); this.save();
  },
  starKeep(keep) {
    const S = this.S, r = S.starRoll; if (!r) return;
    S.starRoll = null;
    if (keep && S.stars[r.i]) { S.stars[r.i].s = r.s; S.stars[r.i].v = r.v; this.starDone(`Star ${r.i + 1}: ${STAR_STATS[r.s].name} ${fmtV(r.s, r.v)}`); return; }
    this.ui.refreshPanel(); this.save();
  },
  starDone(msg) {
    this.recalc(); this.sfx.play('level'); this.fx.buff(this.player, '#ffe07a');
    this.ui.toast(msg, 'good'); this.ui.refreshPanel(); this.save();
  },
  // after a level up: a new star may have opened
  starsLevelUp(from) {
    for (let i = 0; i < STAR_MAX; i++) {
      const L = starLevel(i);
      if (from < L && this.S.level >= L) {
        this.ui.chat('system', `A new <b>Attribute Star</b> opened (star ${i + 1} of ${STAR_MAX}). Awaken it in the Hero window (C).`);
        if (i === 0) this.ui.banner('ATTRIBUTE STARS', 'Awaken your first star in the Hero window (C)', 'level');
        this.ui.markMenu('char');
      }
    }
  },
};

// ============================================================ the window
const U = {
  panel_stars(body) {
    const g = this.g, S = g.S; g.starsInit();
    const open = g.starsOpen(), T = g.starTotals();
    const sum = Object.entries(T).map(([k, v]) => `<span style="color:${STAR_STATS[k].color}">${STAR_STATS[k].name} ${fmtV(k, v)}</span>`).join(' · ');
    body.appendChild(h('div', 'st-sum', open ? `<b>${S.stars.filter(Boolean).length} / ${STAR_MAX}</b> stars awakened${sum ? ` · ${sum}` : ''}` : `Attribute Stars open at <b>Lv ${STAR_START}</b>, then one more every 2 levels up to 18 stars at Lv ${starLevel(STAR_MAX - 1)}.`));
    const grid = h('div', 'st-grid');
    S.stars.forEach((st, i) => {
      const locked = i >= open, sel = this.sel.star === i;
      const c = h('button', 'st-cell' + (locked ? ' locked' : st ? ' on' : ' ready') + (sel ? ' sel' : ''));
      c.innerHTML = locked ? `<span class="sn">${i + 1}</span><small>Lv ${starLevel(i)}</small>` : st ? `<span class="star" style="color:${STAR_STATS[st.s].color}">★</span><b>${STAR_STATS[st.s].short}</b><small>${fmtV(st.s, st.v)}</small><i class="tp">${'•'.repeat(st.t)}</i>` : '<span class="star">☆</span><small>Awaken</small>';
      c.setAttribute('aria-label', `Star ${i + 1}: ${locked ? `opens at Lv ${starLevel(i)}` : st ? `${STAR_STATS[st.s].name} ${fmtV(st.s, st.v)}, tier ${st.t}` : 'ready to awaken'}`);
      c.onclick = () => { this.sel.star = i; if (!locked && !st) g.starAwaken(i); else this.renderPanel(); };
      grid.appendChild(c);
    });
    body.appendChild(grid);
    const i = this.sel.star, st = i != null ? S.stars[i] : null;
    const det = h('div', 'detail st-det2');
    if (!st) { det.innerHTML = `<div class="dtx">${open ? 'Tap a glowing star to awaken it: it rolls one stat (Attack, Max HP, Defense, Critical chance, Critical damage, Dodge or Skill damage) and a value in its range. Upgrade a star to raise the top of its range, then re-roll for a better value.' : `Reach Lv ${STAR_START} to open your first star.`}</div>`; body.appendChild(det); return; }
    const D = STAR_STATS[st.s];
    det.innerHTML = `<div class="dtx"><b style="color:${D.color}">Star ${i + 1} · ${D.name} ${fmtV(st.s, st.v)}</b><br>Tier ${st.t} / ${STAR_TIERS} · range ${fmtV(st.s, D.lo)} to ${fmtV(st.s, D.hi[st.t - 1])}${st.t < STAR_TIERS ? ` · next tier up to ${fmtV(st.s, D.hi[st.t])}` : ''}</div>`;
    const R = S.starRoll && S.starRoll.i === i ? S.starRoll : null;
    if (R) {
      const better = R.s !== st.s || R.v > st.v;
      det.appendChild(h('div', 'st-roll', `New roll: <b style="color:${STAR_STATS[R.s].color}">${STAR_STATS[R.s].name} ${fmtV(R.s, R.v)}</b> <span class="muted">(now ${D.name} ${fmtV(st.s, st.v)})</span>`));
      const a = h('div', 'acts');
      const k = h('button', 'btn small' + (better ? ' green' : ''), 'Keep the new roll'); k.onclick = () => g.starKeep(true); a.appendChild(k);
      const d = h('button', 'btn small gray', 'Discard'); d.onclick = () => g.starKeep(false); a.appendChild(d);
      det.appendChild(a);
    } else {
      const a = h('div', 'st-acts');
      const add = (label, note, cost, fn, off, btn) => { const r = h('div', 'st-act', `<div><b>${label}</b><small>${note}</small><div class="cost">${cost ? costChips(g, cost) : ''}</div></div>`); const b = h('button', 'btn small', btn); b.disabled = off || (cost && !g.canAfford(cost)); b.onclick = fn; r.appendChild(b); a.appendChild(r); };
      if (st.t < STAR_TIERS) add('Upgrade tier', `Tier ${st.t} → ${st.t + 1}: the range reaches ${fmtV(st.s, D.hi[st.t])}`, starUpCost(st.t), () => g.starUpgrade(i), false, 'Upgrade');
      else add('Upgrade tier', 'Highest tier reached', null, () => {}, true, 'Max');
      add('Re-roll value', `A new ${D.name} value in this star's range; keep or discard it`, STAR_REROLL, () => g.starReroll(i), false, 'Re-roll');
      add('Re-roll stat', 'A new stat and value; keep or discard it', STAR_RESTAT, () => g.starReroll(i, true), false, 'New stat');
      det.appendChild(a);
    }
    body.appendChild(det);
    body.appendChild(h('div', 'note', `${ico('star_essence', 'ico inl')} Star Essence comes from bosses, salvaging Unique gear and better, Elias' Curios and the Star Wish.`));
  },
};

export function installStars(Game) { Object.assign(Game.prototype, G); }
export function installStarsUI(UI) { Object.assign(UI.prototype, U); }
