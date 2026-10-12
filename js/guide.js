// The Crafter's Path guide quests (data-guide.js): progress on game events, step rewards, the quest tracker line with
// auto-path, and the Quest Log's Guide tab with a page for gathering, farming, refining and forging.
import { GUIDE, GUIDE_PAGES } from './data-guide.js';
import { GATHER, TIER_REQ } from './data-world.js';
import { ITEMS } from './data.js';
import { MATERIALS } from './systems-data.js';
import { ico } from './icons.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function initGuideSave(S) {
  const G = S.guide && typeof S.guide === 'object' ? S.guide : {};
  S.guide = { i: Math.max(0, Math.min(GUIDE.length, G.i | 0)), p: Math.max(0, G.p | 0), hide: !!G.hide };
}
const rewardText = (r) => [r.gold ? `${fmt(r.gold)} Gold` : '', r.exp ? `${fmt(r.exp)} EXP` : '',
  ...(r.items || []).map(([id, n]) => `${ITEMS[id].name} x${n}`), ...Object.entries(r.mats || {}).map(([id, n]) => `${MATERIALS[id].name} x${n}`)].filter(Boolean).join(', ');

const G = {
  guideStep() { const g = this.S.guide; return g && g.i < GUIDE.length ? GUIDE[g.i] : null; },
  // a game event (gather_tree, plant, refine, ...) moves the current step along
  guideEvent(ev, n = 1) {
    const st = this.guideStep(); if (!st || st.ev !== ev) return;
    const g = this.S.guide; g.p += n;
    if (g.p < st.n) { this.ui.refreshQuest(); return; }
    g.i++; g.p = 0;
    this.guideReward(st.reward);
    this.ui.chat('system', `<b>[Guide]</b> ${esc(st.name)} complete! Reward: ${esc(rewardText(st.reward))}.`);
    this.ui.toast(`Guide: ${st.name} complete!`, 'good');
    this.sfx.play('quest');
    const nx = this.guideStep();
    this.ui.chat('system', nx ? `<b>[Guide]</b> Next: ${esc(nx.goal)}. ${esc(nx.tip)}` : '<b>[Guide]</b> You finished the Crafter\'s Path! Every step stays in the Guide tab of your Quest Log (L).');
    this.ui.refreshQuest(); this.save();
  },
  guideReward(r) {
    const S = this.S;
    if (r.gold) S.gold += r.gold;
    for (const [id, n] of Object.entries(r.mats || {})) this.addMat(id, n, true);
    for (const [id, n] of r.items || []) if (!this.addItem(id, n)) S.auc.claims.push({ kind: 'item', id, qty: n, note: 'Guide reward' });
    if (r.exp) this.gainExp(r.exp);
    this.ui.refreshWallet();
  },
  // auto-path to the nearest place the current step needs: a node you can gather, your farm plots, or an NPC
  guideGo() {
    const st = this.guideStep(), p = this.player; if (!st || p.dead) return;
    if (this.dg || this.war || this.trial) { this.ui.toast(this.war ? 'Finish the battle first' : this.trial ? 'Finish the trial first' : 'Leave the dungeon first', 'warn'); return; }
    this.engage = false; this.pendingSkill = null; this.pendingTalk = null; this.pendingPortal = null; this.pendingLife = null;
    if (!GATHER[st.go] && st.go !== 'farm') {
      const n = this.npcById(st.go); if (!n) return;
      this.talkTo(n, true);
      if (this.pendingTalk) this.ui.toast(`Auto-path: heading to ${n.data.name} the ${n.data.title}`);
      return;
    }
    const near = (list) => list.reduce((b, e) => (!b || flat(p.pos, e.pos) < flat(p.pos, b.pos) ? e : b), null);
    let T;
    if (st.go === 'farm') T = near(this.plots);
    else {
      const lv = this.profLv(GATHER[st.go].prof), ok = this.nodes.filter((e) => e.nkind === st.go && TIER_REQ[e.tier] <= lv);
      T = near(ok.filter((e) => e.ready)) || near(ok);
    }
    if (!T) { this.ui.toast('There is nothing like that nearby', 'warn'); return; }
    if (flat(p.pos, T.pos) < (T.kind === 'plot' ? 3.6 : 3)) { p.path = []; this.lifeAct(T); return; }
    this.pendingLife = T;
    this.pathTo(T.pos.x, T.pos.z, true, true);
    this.ui.toast(`Auto-path: heading to ${st.go === 'farm' ? 'your homestead' : T.name}`);
  },
};

// ============================================================ UI
const U = {
  // the Guide line in the quest tracker
  guideTracker(list) {
    const g = this.g, st = g.guideStep(); if (!st || g.S.guide.hide) return;
    const it = h('div', 'qt-item', `<span class="qtag guide">Guide</span><span class="qn">${esc(st.name)}</span><div class="qo">${esc(st.goal)}${st.n > 1 ? ` (${g.S.guide.p}/${st.n})` : ''}</div>`);
    it.title = st.tip;
    it.onclick = () => { g.sfx.play('click'); g.guideGo(); };
    list.appendChild(it);
  },
  // Quest Log › Guide
  guidePanel(body) {
    const g = this.g, S = g.S, st = g.guideStep(), idx = S.guide.i;
    const head = h('div', 'guide-cur');
    if (st) {
      head.innerHTML = `<div class="gc-top"><span class="qtag guide">Guide</span><b>The Crafter's Path</b><span class="muted">Step ${idx + 1} of ${GUIDE.length}</span></div>
        <div class="gc-name">${esc(st.name)}</div><div class="gc-goal">${esc(st.goal)}${st.n > 1 ? ` (${S.guide.p}/${st.n})` : ''}</div><div class="gc-tip">${esc(st.tip)}</div>
        <div class="gc-rw">Reward: ${esc(rewardText(st.reward))}</div><div class="acts-row"></div>`;
      const row = head.querySelector('.acts-row');
      const go = h('button', 'btn small blue', 'Show me'); go.onclick = () => { this.closePanels(); g.guideGo(); }; row.appendChild(go);
      const hide = h('button', 'btn small gray', S.guide.hide ? 'Show in tracker' : 'Hide from tracker');
      hide.onclick = () => { S.guide.hide = !S.guide.hide; g.save(); this.refreshQuest(); this.renderPanel(); };
      row.appendChild(hide);
    } else head.innerHTML = `<div class="gc-top"><span class="qtag guide">Guide</span><b>The Crafter's Path</b><span class="good">Complete</span></div><div class="gc-tip">You know the whole craft now: gather, farm, refine and forge. The pages below stay here for later.</div>`;
    body.appendChild(head);
    for (const P of GUIDE_PAGES) {
      const sec = h('div', 'guide-sec');
      sec.innerHTML = `<div class="gs-h"><span class="gs-ic">${ico(P.icon)}</span><div><b>${esc(P.title)}</b><small>${esc(P.where)}</small></div></div><ol>${P.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`;
      const qs = h('div', 'gs-q');
      GUIDE.forEach((q, i) => {
        if (q.sec !== P.sec) return;
        const state = i < idx ? 'done' : i === idx ? 'cur' : '';
        qs.appendChild(h('span', 'gq ' + state, `${state === 'done' ? '✓ ' : ''}${esc(q.goal)}`));
      });
      sec.appendChild(qs);
      body.appendChild(sec);
    }
  },
};

export function installGuide(Game) { Object.assign(Game.prototype, G); }
export function installGuideUI(UI) { Object.assign(UI.prototype, U); }
