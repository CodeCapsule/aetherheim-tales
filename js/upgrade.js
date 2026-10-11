// Gear upgrades mixed into Game: enhancement from +1 to +15 (stones, success rates, fail stacks, Lucky and Protection
// charms) and the extended gem system (arcane gems, five gem levels, Soulstones with named powers, the Socket Drill and
// the Soul Forge). installUpgrade(Game) adds the methods.
import {
  MATERIALS, GEMS, GEM_LV, GEM_MAX, GEM_COMBINE, gemId, parseGem, parseSoul, SOULS, soulId, SOUL_FORGE, SOCKET_MAX, DRILL_MAX, drillCost, SOCKETS,
  ENH_MAX, ENH_RATE, ENH_STONES, ENH_FAIL_BONUS, ENH_FAIL_MAX, ENH_LUCK, enhCost, enhRisk, REFINE,
} from './systems-data.js';
import { RARITY, EFFECTS, fitSockets } from './loot.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const matName = (id) => MATERIALS[id]?.name || id;
const ENH_COLOR = (e) => (e >= 15 ? 0xff5a2a : e >= 10 ? 0xc46bff : e >= 7 ? 0x5ab8ff : 0xffe07a);
const BASIC = ['ruby', 'sapphire', 'emerald', 'topaz'];
const ARCANE = Object.keys(GEMS).filter((t) => GEMS[t].arcane);
// a random gem type: arcane gems are rarer
export const randomGemType = () => (Math.random() < 0.3 ? pick(ARCANE) : pick(BASIC));
// stone tier a monster or dungeon of this level gives
export const stoneFor = (lvl) => (lvl >= 130 ? (Math.random() < 0.6 ? 'enh_stone3' : 'enh_stone2') : lvl >= 60 ? (Math.random() < 0.7 ? 'enh_stone2' : 'enh_stone') : 'enh_stone');

const U = {
  // ============================================================ enhancement
  enhChance(eq, luck = false) {
    const t = (eq.enh || 0) + 1; if (t > ENH_MAX) return 0;
    return Math.min(1, ENH_RATE[t - 1] + Math.min(ENH_FAIL_MAX, eq.fs || 0) + (luck ? ENH_LUCK : 0));
  },
  enhance(slot) { this.enhanceItem({ where: 'equip', slot }); },
  // o: { luck: use a Lucky Charm, protect: use a Protection Charm }
  enhanceItem(ref, o = {}) {
    const S = this.S, eq = this.refItem(ref); if (!eq) return null;
    eq.enh = eq.enh || 0;
    if (eq.enh >= ENH_MAX) { this.ui.toast(`Already at +${ENH_MAX}`, 'warn'); return null; }
    const cost = enhCost(eq), target = eq.enh + 1;
    const luck = !!o.luck && this.countItem('enh_luck') > 0;
    const protect = !!o.protect && enhRisk(target) > 0 && this.countItem('enh_protect') > 0;
    if (!this.pay(cost)) return null;
    if (luck) this.removeItem('enh_luck', 1);
    const chance = this.enhChance(eq, luck);
    this.track('enhance');
    const p = this.player, at = p.pos.clone().setY(p.pos.y + 1.2);
    let res;
    if (Math.random() < chance) {
      eq.enh = target; eq.fs = 0;
      res = { ok: true, to: target };
      this.sfx.play(target >= 10 ? 'legend' : 'level');
      this.fx.pillar(p.pos, ENH_COLOR(target), 1.4 + target / 10, 8 + target / 2, 0.9);
      this.fx.emit(at, { count: 30 + target * 4, color: ENH_COLOR(target), speed: 4, life: 1, size: 0.5, up: 4, jitter: 1 });
      this.ui.toast(`Success! ${eq.name} is now +${target}`, 'good');
      if (target === 10 || target === 15) this.ui.banner(`+${target}!`, eq.name, target === 15 ? 'loot6' : 'loot5');
      if (target >= 10) this.ui.chat('announce', `<b>[Announcement]</b> ${esc(S.name)} enhanced <span style="color:${RARITY[eq.quality].color}">[${esc(eq.name)}]</span> to <b>+${target}</b>!`);
      if (target >= 15) { this.unlockTitle('Peerless Smith'); this.fx.shake(0.4); }
      this.logEvent && this.logEvent('enhance', `${eq.name} +${target}`, target >= 10);
    } else {
      eq.fs = Math.min(ENH_FAIL_MAX, (eq.fs || 0) + ENH_FAIL_BONUS);
      let lost = enhRisk(target);
      if (lost && protect) { this.removeItem('enh_protect', 1); lost = 0; }
      eq.enh = Math.max(0, eq.enh - lost);
      res = { ok: false, lost, protectedUsed: protect, to: eq.enh };
      this.sfx.play('error'); this.fx.shake(0.15);
      this.fx.emit(at, { count: 24, color: 0x8a8a9a, speed: 3, life: 0.7, size: 0.45, up: 1, jitter: 1 });
      this.ui.toast(lost ? `Failed — ${eq.name} dropped to +${eq.enh}. Next try +${Math.round(eq.fs * 100)}%` : `Failed${protect ? ' — the Protection Charm shattered instead' : ''}. Next try +${Math.round(eq.fs * 100)}%`, 'warn');
    }
    if (ref.where === 'equip') this.recalc();
    this.ui.enhResult = { ...res, t: performance.now(), uid: eq.uid };
    this.ui.refreshWallet(); this.ui.refreshPanel(); this.save();
    return res;
  },
  refineStones(i, times = 1) {
    const r = REFINE[i]; if (!r) return;
    let n = 0;
    for (let k = 0; k < times; k++) { if (!this.canAfford({ gold: r.gold, mats: { [r.from]: r.n } })) break; this.pay({ gold: r.gold, mats: { [r.from]: r.n } }); n++; }
    if (!n) { this.ui.toast(this.missingText({ gold: r.gold, mats: { [r.from]: r.n } }), 'warn'); this.sfx.play('error'); return; }
    this.addMat(r.to, n, true);
    this.sfx.play('level'); this.fx.buff(this.player, '#c8a0ff');
    this.ui.toast(`Refined ${n} ${matName(r.to)}`, 'good'); this.ui.refreshPanel(); this.save();
  },

  // ============================================================ gems & soulstones
  socketGem(ref, i, gid) {
    const eq = this.refItem(ref); if (!eq) return;
    const gm = parseGem(gid), fx = parseSoul(gid); if (!gm && !fx) return;
    fitSockets(eq);
    if (i < 0 || i >= eq.gems.length || eq.gems[i]) return;
    if (fx && eq.gems.some((x) => parseSoul(x))) { this.ui.toast('Only one Soulstone fits in an item', 'warn'); return; }
    if (!this.takeMat(gid, 1)) { this.ui.toast('You do not have that gem', 'warn'); return; }
    eq.gems[i] = gid;
    if (ref.where === 'equip') this.recalc();
    this.track('gem'); this.sfx.play(fx ? 'legend' : 'level'); this.fx.buff(this.player, fx ? '#ff9ae8' : GEMS[gm.type].color);
    this.ui.toast(fx ? `${SOULS[fx]} awakens in ${eq.name}!` : `Socketed ${matName(gid)}`, 'good');
    if (fx) this.ui.chat('system', `<b>${esc(eq.name)}</b> gained the power <span style="color:#ff9ae8">${esc(EFFECTS[fx].name)}</span>: ${esc(EFFECTS[fx].desc)}`);
    this.ui.refreshPanel(); this.save();
  },
  unsocketCost(gid) { const gm = parseGem(gid); return gm ? 150 * gm.lv * gm.lv : 5000; },
  unsocketGem(ref, i) {
    const eq = this.refItem(ref); if (!eq || !eq.gems?.[i]) return;
    if (!this.pay({ gold: this.unsocketCost(eq.gems[i]) })) return;
    this.addMat(eq.gems[i], 1, true); eq.gems[i] = null;
    if (ref.where === 'equip') this.recalc();
    this.sfx.play('click'); this.ui.toast('Gem removed', 'good'); this.ui.refreshPanel(); this.save();
  },
  combineGems(type, lv, times = 1) {
    if (lv >= GEM_MAX || !GEMS[type]) return;
    const id = gemId(type, lv), cost = { gold: GEM_COMBINE[lv].gold, mats: { [id]: 3 } };
    let n = 0;
    for (let k = 0; k < times && this.canAfford(cost); k++) { this.pay(cost); n++; }
    if (!n) { this.ui.toast(this.missingText(cost), 'warn'); this.sfx.play('error'); return; }
    this.addMat(gemId(type, lv + 1), n, true);
    this.track('gem', n); this.sfx.play('level'); this.fx.buff(this.player, GEMS[type].color);
    this.ui.toast(`Combined ${n}x ${matName(gemId(type, lv + 1))}!`, 'good');
    if (lv + 1 === GEM_MAX) this.ui.chat('announce', `<b>[Announcement]</b> ${esc(this.S.name)} crafted a <span style="color:${RARITY[6].color}">[${esc(matName(gemId(type, lv + 1)))}]</span>!`);
    this.ui.refreshPanel(); this.save();
  },
  socketCount(eq) { return Math.min(SOCKET_MAX, (SOCKETS[eq.quality] || 0) + (eq.xs || 0)); },
  drillSocket(ref) {
    const eq = this.refItem(ref); if (!eq) return;
    if ((eq.xs || 0) >= DRILL_MAX || this.socketCount(eq) >= SOCKET_MAX) { this.ui.toast('This item cannot hold more sockets', 'warn'); return; }
    if (this.countItem('socket_drill') < 1) { this.ui.toast('You need a Socket Drill (Opal sells them)', 'warn'); return; }
    if (!this.pay(drillCost(eq))) return;
    this.removeItem('socket_drill', 1);
    eq.xs = (eq.xs || 0) + 1; fitSockets(eq);
    this.sfx.play('level'); this.fx.buff(this.player, '#7ad8ff');
    this.ui.toast(`${eq.name} now has ${eq.gems.length} sockets`, 'good'); this.ui.refreshPanel(); this.save();
  },
  // Soul Forge: three Brilliant gems of any kind, Star Essence and gold become a random Soulstone.
  soulForgeGems() {
    return Object.keys(this.S.mats).filter((id) => { const g = parseGem(id); return g && g.lv === SOUL_FORGE.gemLv; }).sort((a, b) => this.matCount(b) - this.matCount(a));
  },
  canSoulForge() {
    const have = this.soulForgeGems().reduce((a, id) => a + this.matCount(id), 0);
    return have >= SOUL_FORGE.gems && this.canAfford({ gold: SOUL_FORGE.gold, mats: SOUL_FORGE.mats });
  },
  soulForge() {
    if (!this.canSoulForge()) { this.ui.toast(`Needs ${SOUL_FORGE.gems} Brilliant gems, ${SOUL_FORGE.mats.star_essence} Star Essence and ${fmt(SOUL_FORGE.gold)} Gold`, 'warn'); this.sfx.play('error'); return; }
    this.pay({ gold: SOUL_FORGE.gold, mats: SOUL_FORGE.mats });
    let need = SOUL_FORGE.gems;
    for (const id of this.soulForgeGems()) { const n = Math.min(need, this.matCount(id)); this.takeMat(id, n); need -= n; if (!need) break; }
    this.grantSoul(pick(Object.keys(SOULS)), 'Soul Forge');
  },
  grantSoul(fx, from) {
    const id = soulId(fx);
    this.addMat(id, 1, true);
    this.sfx.play('legend'); this.fx.pillar(this.player.pos, 0xff9ae8, 1.8, 12, 1.1); this.fx.shake(0.3);
    this.ui.banner('SOULSTONE!', `${SOULS[fx]} · ${EFFECTS[fx].desc}`, 'loot5');
    this.ui.chat('announce', `<b>[Announcement]</b> ${esc(this.S.name)} obtained the <span style="color:#ff9ae8">[${esc(MATERIALS[id].name)}]</span>${from ? ` from the ${esc(from)}` : ''}!`);
    this.logEvent && this.logEvent('soul', MATERIALS[id].name, true);
    this.ui.refreshPanel(); this.save();
  },
  // bag items added by the upgrade systems; returns true when handled
  useUpgradeItem(id) {
    if (id === 'soul_cache') { this.removeItem(id, 1); this.grantSoul(pick(Object.keys(SOULS)), 'Soulstone Chest'); return true; }
    if (id === 'enh_luck' || id === 'enh_protect') { this.ui.sel.fgTab = 'enhance'; this.ui.togglePanel('forge', true); return true; }
    if (id === 'socket_drill') { this.ui.sel.fgTab = 'gems'; this.ui.togglePanel('forge', true); return true; }
    return false;
  },
};

export function installUpgrade(Game) { Object.assign(Game.prototype, U); }
export { ENH_STONES };
