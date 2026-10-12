// Windows for the breakthrough trials: the Trial Warden's list (sigils and entry), the in-trial tracker, campfire
// cooking and the Hall of Firsts. installTrialsUI(UI) mixes these into UI.prototype.
import { ITEMS } from './data.js';
import { TRIALS, ROMAN_T, trialLabel, COOKING } from './data-trials.js';
import { CLASSES } from './data-classes.js';
import { ico } from './icons.js';
import { mmss } from './trials.js';
import { mp, serverName } from './mp.js';

const $ = (id) => document.getElementById(id);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const day = (t) => new Date(t).toISOString().slice(0, 10);

const P = {
  // ------------------------------------------------------------ entering / leaving
  enterTrial() { this.closePanels(); this.closeDialog(); this.refreshQuest(); this.refreshActs(); $('hud').classList.add('in-dungeon', 'in-trial'); },
  leaveTrial() { $('hud').classList.remove('in-dungeon', 'in-trial'); this.refreshQuest(); this.refreshActs(); this.closeModal(); },

  // ------------------------------------------------------------ tracker
  renderTrialTracker() {
    const g = this.g, tr = g.trial, list = $('qt-list'); list.innerHTML = '';
    const it = h('div', 'qt-item', `<span class="qtag trial">${esc(trialLabel(tr.T.n))}</span><span class="qn">${esc(tr.T.name)}</span><div class="qo">${esc(tr.goal || tr.T.challenge)}</div><div class="dg-meta"><span id="tr-time"></span><span id="tr-extra"></span></div>`);
    list.appendChild(it);
    const row = h('div', 'tr-acts');
    if (tr.directions) { const b = h('button', 'btn small blue', 'Directions'); b.onclick = () => this.modal('Directions', tr.directions, [{ label: 'OK' }]); row.appendChild(b); }
    const leave = h('button', 'btn small gray', 'Give Up');
    leave.onclick = () => this.modal('Give up the trial?', tr.done ? 'Return to Sylvan Haven.' : 'Leaving counts as a failed attempt: the sigil is spent, your XP and mastery are kept.', [{ label: 'Leave', fn: () => { if (!tr.done) { tr.done = 'fail'; g.ui.chat('system', `You left ${esc(trialLabel(tr.T.n))}.`); } g.leaveTrial(); } }, { label: 'Stay', cls: 'gray' }]);
    row.appendChild(leave);
    list.appendChild(row);
    this.updateTrialHUD();
  },
  updateTrialHUD() {
    const g = this.g, tr = g.trial; if (!tr) return;
    const te = $('tr-time'), xe = $('tr-extra'); if (!te) return;
    this.txt(te, tr.T.time ? `${tr.T.kind === 'hunger' ? 'Survive' : 'Time left'} ${mmss(tr.left)}` : `Time ${mmss(tr.t)}`);
    te.style.color = tr.T.time && tr.T.kind !== 'hunger' && tr.left < 120 ? '#ff8a7a' : '';
    let x = '';
    if (tr.T.kind === 'hunger') x = `Stomach ${Math.round(tr.food)}%`;
    else if (tr.T.kind === 'gauntlet') x = `Boss ${Math.min(5, tr.idx + 1)}/5`;
    else if (tr.T.kind === 'maze') x = `Walls shift in ${Math.ceil(tr.maze.shiftT)}s`;
    else if (tr.twins && !tr.alone) x = `${tr.active.def0.name.split(',')[0]} attacks`;
    this.txt(xe, x);
    if (xe) xe.style.color = tr.T.kind === 'hunger' && tr.food < 25 ? '#ff8a7a' : '';
  },

  // ------------------------------------------------------------ the Trial Warden's window
  panel_trials(body) {
    const g = this.g, S = g.S;
    body.appendChild(h('div', 'note', `A trial wall stands at every 20th level: your XP bar fills, but the next level waits until you pass. Stats are <b>the same for every ${esc(CLASSES[S.cls].name)}</b> inside, so only your skills and your play count. Each attempt uses one Trial Sigil; failing keeps your XP and mastery. A clear grants a title, an aura everyone sees and 3 skill points.`));
    const sel = this.sel.trial ?? (TRIALS.find((t) => !g.trialCleared(t.n))?.n || 10);
    const wrap = h('div', 'tr-wrap'), listEl = h('div', 'tr-list');
    for (const T of TRIALS) {
      const done = g.trialCleared(T.n), why = g.trialBlock(T.n);
      const st = done ? 'Cleared' : S.level < T.lv ? `Lv ${T.lv}` : why === 'Needs a Trial Sigil' ? 'Needs sigil' : why ? 'Locked' : 'Ready';
      const b = h('button', `tr-row${sel === T.n ? ' sel' : ''}${done ? ' done' : ''}`, `<span class="tr-n" style="--ac:${T.aura}">${ROMAN_T[T.n] === 'Final' ? '★' : ROMAN_T[T.n]}</span><span class="tr-t"><b>${esc(T.name)}</b><small>Lv ${T.lv} · ${esc(T.tests)}</small></span><span class="tr-s ${done ? 'good' : st === 'Ready' ? 'ready' : ''}">${st}</span>`);
      b.onclick = () => { this.sel.trial = T.n; this.renderPanel(); };
      listEl.appendChild(b);
    }
    wrap.appendChild(listEl);
    const T = TRIALS.find((t) => t.n === sel), done = S.trials?.[T.n], why = g.trialBlock(T.n);
    const det = h('div', 'tr-det');
    det.innerHTML = `<div class="tr-head" style="--ac:${T.aura}"><span class="tr-aura"></span><div><b>${esc(trialLabel(T.n))}: ${esc(T.name)}</b><small>Wall at Lv ${T.lv}</small></div></div>
      <div class="tr-line"><span>Challenge</span>${esc(T.challenge)}</div><div class="tr-line"><span>Tests</span>${esc(T.tests)}</div>
      <div class="tr-line"><span>Reward</span>Title «${esc(T.title)}», its aura and 3 skill points</div>
      ${done ? `<div class="tr-line good"><span>Cleared</span>${done.legacy ? 'Passed before trials existed' : `${day(done.t)} in ${mmss(done.secs || 0)}`}</div>` : ''}
      ${S.trialTries?.[T.n] ? `<div class="tr-line"><span>Attempts</span>${S.trialTries[T.n]}</div>` : ''}`;
    if (!done) {
      const have = g.countItem(`sigil_${T.n}`);
      det.appendChild(h('div', 'lbl', `${esc(ITEMS[`sigil_${T.n}`].name)} · you have ${have}`));
      det.appendChild(h('div', 'needs', this.costLine(g.sigilCost(T.n))));
      const acts = h('div', 'acts');
      const cb = h('button', 'btn', 'Craft Sigil'); cb.disabled = !g.canAfford(g.sigilCost(T.n)); cb.onclick = () => g.craftSigil(T.n); acts.appendChild(cb);
      const eb = h('button', 'btn green', 'Enter Trial'); eb.disabled = !!why; eb.title = why; eb.onclick = () => this.modal(`Enter ${trialLabel(T.n)}?`, `${T.challenge}. One attempt uses your sigil. Your stats become the fixed ${CLASSES[S.cls].name} values for Lv ${T.lv}; pets stay behind and auto-hit is off.`, [{ label: 'Enter', fn: () => { this.closePanels(); g.enterTrial(T.n); } }, { label: 'Not yet', cls: 'gray' }]);
      acts.appendChild(eb);
      det.appendChild(acts);
      if (why && why !== 'Needs a Trial Sigil') det.appendChild(h('div', 'muted', esc(why)));
    } else {
      const acts = h('div', 'acts');
      const ab = h('button', 'btn' + (S.aura === T.n ? ' gray' : ''), S.aura === T.n ? 'Aura shown' : 'Show this aura'); ab.disabled = S.aura === T.n; ab.onclick = () => g.setAura(T.n); acts.appendChild(ab);
      det.appendChild(acts);
    }
    wrap.appendChild(det);
    body.appendChild(wrap);
  },

  // ------------------------------------------------------------ campfire cooking
  panel_cooking(body) {
    const g = this.g;
    body.appendChild(h('div', 'note', 'Cook over the fire: food heals over time and some dishes grant a 2-minute bonus. Raw Meat drops from beasts; crops come from the farm, herbs from the wilds. Cooking trains Survival mastery.'));
    for (const r of COOKING) {
      const it = ITEMS[r.out], row = h('div', 'ck-row');
      row.innerHTML = `<span class="ck-ic">${ico(it.icon)}</span><span class="ck-t"><b>${esc(it.name)}</b><small>${esc(it.desc)}</small><span class="needs">${this.insChips(r.ins)}</span></span>`;
      const acts = h('span', 'ck-a');
      for (const n of [1, 5]) { const b = h('button', 'btn small', `Cook${n > 1 ? ' ×' + n : ''}`); b.onclick = () => g.cook(r.id, n); acts.appendChild(b); }
      row.appendChild(acts);
      body.appendChild(row);
    }
    const foods = g.S.bag.map((b, i) => ({ b, i })).filter(({ b }) => !b.eq && ITEMS[b.id]?.type === 'food');
    if (foods.length) {
      body.appendChild(h('div', 'lbl', 'Your food'));
      const fl = h('div', 'ck-foods');
      for (const { b } of foods) { const e = h('button', 'btn small blue', `${ico(ITEMS[b.id].icon, 'ico inl')} Eat ${esc(ITEMS[b.id].name)} (${b.qty})`); e.onclick = () => g.eatFood(b.id); fl.appendChild(e); }
      body.appendChild(fl);
    }
  },

  // ------------------------------------------------------------ Hall of Firsts
  panel_prestige(body) {
    const g = this.g, B = g.prestige || {};
    body.appendChild(h('div', 'note', `The first players seen on server <b>${esc(serverName(mp.server || 'S1'))}</b> to clear each trial and to own each Ancient item. Clears reach this board from everyone online.`));
    const t = h('div', 'pr-table');
    for (const T of TRIALS) {
      const r = B['t' + T.n];
      t.appendChild(h('div', 'pr-row' + (r ? '' : ' empty'), `<span class="tr-n" style="--ac:${T.aura}">${ROMAN_T[T.n] === 'Final' ? '★' : ROMAN_T[T.n]}</span><span>${esc(T.name)}</span><b>${r ? esc(r.name) : '—'}</b><small>${r ? day(r.t) : 'Unclaimed'}</small>`));
    }
    const anc = Object.entries(B).filter(([k]) => k[0] === 'a');
    if (anc.length) {
      t.appendChild(h('div', 'lbl', 'Ancient items'));
      for (const [k, r] of anc) t.appendChild(h('div', 'pr-row', `<span class="tr-n" style="--ac:#d8a060">A</span><span>${esc(ITEMS[k.slice(1)]?.name || g.ancientName?.(k) || k.slice(1))}</span><b>${esc(r.name)}</b><small>${day(r.t)}</small>`));
    }
    body.appendChild(t);
  },
};

export function installTrialsUI(UI) { Object.assign(UI.prototype, P); }
