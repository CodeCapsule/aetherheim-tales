// Tailoring at Coco's: costume ingredients dropped by monsters, dyes mixed from herbs and crops, and costumes sewn
// from them (the same costumes Coco sells, now also made by hand).
import { COSTUMES } from './data-world.js';
import { MATERIALS } from './systems-data.js';
import { RARITY } from './loot.js';
import { DYES, TAILOR_DROPS, costumeRecipe } from './data-crafting.js';
import { registerIcon } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- icons
const INK = 'stroke="#24160f" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
const sv = (defs, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${defs}</defs>${body}</svg>`;
const lg = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const glint = '<ellipse cx="22" cy="20" rx="3.2" ry="1.7" fill="#fff" opacity=".8" transform="rotate(-35 22 20)"/>';
registerIcon('tl_linen', sv(lg('a', '#fff6e0', '#d8c49a'), `<path d="M10 22H46A8 12 0 0 1 46 46H10Z" fill="url(#a)" ${INK}/><ellipse cx="10" cy="34" rx="6" ry="12" fill="#efe2c4" ${INK}/><ellipse cx="10" cy="34" rx="2" ry="4" fill="#b89a6a"/><path d="M46 46L56 52L54 44" fill="#efe2c4" ${INK}/><path d="M20 22V46M30 22V46" stroke="#c8b080" stroke-width="2"/>${glint}`));
registerIcon('tl_silk', sv(lg('a', '#ffe8f4', '#ff9ac8'), `<rect x="16" y="12" width="32" height="7" rx="3" fill="#c8905a" ${INK}/><rect x="16" y="45" width="32" height="7" rx="3" fill="#c8905a" ${INK}/><rect x="20" y="19" width="24" height="26" fill="url(#a)" ${INK}/><path d="M20 24H44M20 30H44M20 36H44M20 41H44" stroke="#ff7ab8" stroke-width="1.6"/><path d="M44 32C54 34 56 46 50 54" fill="none" stroke="#ff7ab8" stroke-width="2.5"/>${glint}`));
registerIcon('tl_feather', sv(lg('a', '#ffffff', '#9ad8ff'), `<path d="M48 8C30 12 16 30 14 52C26 46 44 30 48 8Z" fill="url(#a)" ${INK}/><path d="M14 52L40 20" stroke="#5a8ab8" stroke-width="2.5" stroke-linecap="round"/><path d="M14 52L10 58" stroke="#24160f" stroke-width="3" stroke-linecap="round"/>${glint}`));
registerIcon('tl_velvet', sv(lg('a', '#c89aff', '#5a2aa8'), `<path d="M8 26L32 14L56 26V44L32 56L8 44Z" fill="url(#a)" ${INK}/><path d="M8 26L32 38L56 26M32 38V56" fill="none" stroke="#2a1050" stroke-width="2"/><path d="M22 24l2 4 4 1-4 1-2 4-2-4-4-1 4-1zM42 40l1.5 3 3 1-3 1-1.5 3-1.5-3-3-1 3-1z" fill="#fff4b0"/>`));
const DYE_C = { tl_dye_rose: ['#ffb0c8', '#ff3a7a'], tl_dye_sky: ['#c8ecff', '#2a8aff'], tl_dye_gold: ['#fff2a0', '#ffa81a'], tl_dye_leaf: ['#d8ffb0', '#3ab83a'], tl_dye_shadow: ['#d8b0ff', '#5a1aa8'] };
for (const [id, [a, b]] of Object.entries(DYE_C)) registerIcon(id, sv(lg('a', a, b), `<rect x="26" y="6" width="12" height="8" rx="2" fill="#c8905a" ${INK}/><path d="M27 14H37V22L48 36A12 12 0 0 1 38 56H26A12 12 0 0 1 16 36L27 22Z" fill="#eaf4ff" ${INK}/><path d="M18.5 38H45.5A10 10 0 0 1 38 53H26A10 10 0 0 1 18.5 38Z" fill="url(#a)"/>${glint}`));

const T = {
  // a monster kill can drop costume ingredients (finer cloth from stronger monsters)
  tailorDrop(m) {
    const lv = m.level || 1, d = m.def0 || {}, boost = (d.elite ? 2 : 1) * (d.boss ? 3 : 1) * (m.dz ? 3 : 1);
    for (const [id, lo, hi, ch] of TAILOR_DROPS) {
      if (lv < lo || lv > hi || Math.random() > ch * boost) continue;
      this.addMat(id, 1, true);
      this.lootMsg(MATERIALS[id].name, RARITY[MATERIALS[id].quality].color);
    }
  },
  craftDye(id, n = 1) {
    const r = DYES.find((x) => x.id === id); if (!r) return;
    const cost = { gold: r.gold * n, mats: Object.fromEntries(Object.entries(r.mats).map(([k, v]) => [k, v * n])) };
    if (!this.canAfford(cost)) { this.ui.toast(this.missingText(cost), 'warn'); this.sfx.play('error'); return; }
    this.pay(cost); this.addMat(id, n, true); this.gainMastery('survival', 2 * n);
    this.sfx.play('pickup'); this.ui.toast(`Mixed ${MATERIALS[id].name} x${n}`, 'good');
    this.ui.refreshPanel(); this.save();
  },
  tailorCostume(cid) {
    const S = this.S, c = COSTUMES.find((x) => x.id === cid); if (!c) return;
    if (S.costumes.includes(cid)) { this.ui.toast('You already own this costume', 'warn'); return; }
    const r = costumeRecipe(c), cost = { gold: r.gold, mats: r.mats };
    if (!this.canAfford(cost)) { this.ui.toast(this.missingText(cost), 'warn'); this.sfx.play('error'); return; }
    this.pay(cost);
    S.life.tailored = (S.life.tailored || 0) + 1; this.gainMastery('survival', 10);
    this.gainCostume(cid);
    this.sfx.play('legend'); this.fx.buff(this.player, '#ffb8e8');
    this.ui.chat('system', `You sewed <b>[${esc(c.name)}]</b> at Coco's.`);
    this.ui.refreshPanel(); this.save();
  },
};
export function installTailor(Game) { Object.assign(Game.prototype, T); }
