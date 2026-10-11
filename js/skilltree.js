// Skill tree: learning and resetting nodes, the totals they add up to (read by recalc), and the passive effects that
// react in combat. Hooks are called from game.js: treeOnCast, treeOnHit, treeOnKill, treeHurt, treeOnDeath, treeTick.
import { SKILL_TREES, TREE_NODES, TIER_PTS, skillPoints, resetCost } from './data-skills.js';

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const AREA = ['aoeSelf', 'aoeTarget', 'zone'];

const T = {
  tree() { return SKILL_TREES[this.S.cls]; },
  treeRank(id) { return this.S.tree[id] || 0; },
  // points spent (in one branch, or in all of them)
  treeSpent(branch = null) {
    let n = 0;
    for (const [id, r] of Object.entries(this.S.tree)) { const nd = TREE_NODES[id]; if (nd && nd.cls === this.S.cls && (branch == null || nd.branch === branch)) n += r; }
    return n;
  },
  treePointsLeft() { return skillPoints(this.S.level) - this.treeSpent(); },
  // why a node cannot take another point right now ('' when it can)
  treeBlock(id) {
    const n = TREE_NODES[id];
    if (!n || n.cls !== this.S.cls) return 'Not your class';
    if (this.treeRank(id) >= n.max) return 'Fully learned';
    const need = TIER_PTS[n.t] - this.treeSpent(n.branch);
    if (need > 0) return `Spend ${need} more point${need > 1 ? 's' : ''} in ${this.tree()[n.branch].name}`;
    if (this.treePointsLeft() < 1) return 'No skill points left (you earn them by leveling up)';
    return '';
  },
  learnNode(id) {
    const why = this.treeBlock(id);
    if (why) { this.ui.toast(why, 'warn'); this.sfx.play('error'); return false; }
    this.S.tree[id] = this.treeRank(id) + 1;
    const n = TREE_NODES[id];
    this.recalc(); this.sfx.play('level'); this.fx.buff(this.player, this.tree()[n.branch].color);
    if (this.S.tree[id] === n.max && n.t === 5) this.ui.toast(`${n.n} awakened!`, 'good');
    this.ui.refreshPanel(); this.save();
    return true;
  },
  resetTree() {
    const spent = this.treeSpent(); if (!spent) return;
    const cost = resetCost(this.S.level);
    if (this.S.gold < cost) { this.ui.toast('Not enough Gold', 'warn'); this.sfx.play('error'); return; }
    this.S.gold -= cost;
    for (const id of Object.keys(this.S.tree)) if (TREE_NODES[id]?.cls === this.S.cls) delete this.S.tree[id];
    this.recalc(); this.ui.refreshWallet(); this.ui.refreshPanel(); this.save();
    this.ui.toast(`Skill tree reset: ${spent} points returned`, 'good');
  },
  // totals of every learned node: stats, masteries, passives and capstones
  treeAgg() {
    const A = { stat: {}, skill: {}, cd: {}, pas: {}, cap: {} };
    for (const [id, r] of Object.entries(this.S.tree)) {
      const n = TREE_NODES[id]; if (!n || n.cls !== this.S.cls || !r) continue;
      const v = n.v * r;
      if (n.k === 'stat') A.stat[n.key] = (A.stat[n.key] || 0) + v;
      else if (n.k === 'skill') A.skill[n.sk] = (A.skill[n.sk] || 0) + v;
      else if (n.k === 'skillCd') A.cd[n.sk] = (A.cd[n.sk] || 0) + v;
      else if (n.t === 5) A.cap[n.k] = { v, sk: n.sk || null, name: n.n };
      else A.pas[n.k] = (A.pas[n.k] || 0) + v;
    }
    return A;
  },
  tp(kind) { return this.tAgg?.pas[kind] || 0; },
  tcap(kind) { return this.tAgg?.cap[kind] || null; },
  treeSkillMult(sk) {
    let m = 1 + (this.tAgg?.skill[sk.id] || 0) / 100;
    if (AREA.includes(sk.kind)) m *= 1 + this.tp('aoeAmp') / 100;
    const surge = this.tcap('arcaneSurge');
    if (surge && !sk.basic && (this.procCD.surge || 0) <= this.time) {
      this.procCD.surge = this.time + 10; m *= 1 + surge.v / 100;
      this.fx.text(this.player.pos.clone().setY(this.player.pos.y + this.player.height + 0.5), 'Arcane Surge!', 'crit');
    }
    return m;
  },
  treeCdMult(sk) { return 1 - (this.tAgg?.cd[sk.id] || 0) / 100; },
  treeFreeCast(sk) { return !sk.basic && !!this.tcap('arcaneSurge') && (this.procCD.surge || 0) <= this.time; },
  // on casting a skill: Renewal heals, Battle Hymn stacks, Earthbreaker / Tsunami every 4th cast
  treeOnCast(sk) {
    if (sk.basic) return;
    const p = this.player;
    if (this.tp('castHeal')) this.heal(p, p.maxHp * this.tp('castHeal') / 100);
    if (this.tp('castBuff')) {
      let b = p.buffs.find((x) => x.id === 'hymn');
      if (!b) { b = { id: 'hymn', icon: 'crown', stacks: 0, mods: { atk: 1 } }; p.buffs.push(b); }
      b.stacks = Math.min(3, b.stacks + 1); b.mods.atk = 1 + this.tp('castBuff') / 100 * b.stacks; b.until = this.time + 6;
    }
    const sw = this.tcap('shockwave');
    if (sw && ++this.treeCasts % 4 === 0) this.after(0.3, () => {
      if (p.dead) return;
      const c = p.pos.clone();
      if (this.S.cls === 'priest') { this.fx.ring(c, 0x4ab8ff, 6, 0.6); this.fx.emit(c.clone().setY(c.y + 0.5), { count: 50, colors: [0x6ad0ff, 0xffffff], speed: 7, life: 0.7, size: 0.7, up: 4 }); }
      else this.fx.quake(c, 6);
      this.sfx.play('boom'); this.aoe(c, 6, sw.v / 100, 0, true);
    });
  },
  // damage you deal (o.fixed == null): Ambush, Exploit Weakness / Drown, Death Mark, Avatar
  treeDealMult(dst) {
    let m = 1;
    if (dst.maxHp) {
      if (dst.hp > dst.maxHp * 0.9) m *= 1 + this.tp('opener') / 100;
      if (dst.hp < dst.maxHp * 0.3) m *= 1 + this.tp('execute') / 100;
    }
    const mark = this.tcap('deathmark');
    if (mark && dst.markT > this.time) { m *= 1 + mark.v / 100; dst.markT = 0; }
    if (this.treeEmpowered()) m *= 1 + this.tcap('empower').v / 100;
    return m;
  },
  treeEmpowered() { const e = this.tcap('empower'); return !!e && this.player.buffs.some((b) => b.id === e.sk && b.until > this.time); },
  // damage you take from monsters: Evasion / Holy Ward (returns true when dodged) and Last Stand / Aegis
  treeDodge() { return Math.random() * 100 < this.tp('dodge'); },
  treeTakeMult() { const p = this.player; return p.hp < p.maxHp * 0.35 ? 1 - this.tp('lowHpDr') / 100 : 1; },
  // your direct hits
  treeOnHit(dst, dmg, crit, sk) {
    const p = this.player, A = this.tAgg; if (!A) return;
    const head = () => dst.pos.clone().setY(dst.pos.y + dst.height + 0.4);
    const boss = dst.def0?.boss || dst.wb;
    if (crit && this.tp('critHeal')) this.heal(p, dmg * this.tp('critHeal') / 100);
    if (!dst.dead && !boss && Math.random() * 100 < this.tp('stunChance')) { dst.stun = Math.max(dst.stun || 0, 1); this.fx.text(head(), 'Stunned', 'miss'); }
    if (!dst.dead && Math.random() * 100 < this.tp('poisonChance')) this.treePoison(dst, 0.4, 4);
    if (!dst.dead && Math.random() * 100 < this.tp('burnChance')) this.treeBurn(dst);
    if (!dst.dead && Math.random() * 100 < this.tp('chainChance')) this.chainLightning(dst);
    if (sk?.basic && this.tp('cleave')) {
      for (const m of this.monsters) if (m !== dst && !m.dead && (m.map || this.world) === this.map && flat(m.pos, dst.pos) < 3 + m.radius * 0.5) this.damage(p, m, 0, { fixed: dmg * this.tp('cleave') / 100, proc: true });
    }
    if (sk?.basic && Math.random() * 100 < this.tp('doubleHit')) this.after(0.12, () => { if (!dst.dead) this.damage(p, dst, 0, { fixed: dmg, proc: true, cls: 'crit' }); });
    if (crit && this.tcap('deathmark') && !dst.dead) { dst.markT = this.time + 4; this.fx.text(head(), 'Marked', 'miss'); }
    if (this.treeEmpowered() && (this.procCD.empHeal || 0) <= this.time) { this.procCD.empHeal = this.time + 0.3; this.heal(p, p.maxHp * 0.01); }
    const ph = this.tcap('phantom');
    if (ph && ++this.treeHits % 6 === 0) {
      const near = this.monsters.filter((m) => !m.dead && (m.map || this.world) === this.map && flat(m.pos, dst.pos) < 8).sort((a, b) => flat(a.pos, dst.pos) - flat(b.pos, dst.pos)).slice(0, 3);
      for (const m of near) { this.fx.slash(m.pos, Math.random() * 6, 0xb07aff, 1.6, 0.3); this.damage(p, m, ph.v / 100, { proc: true }); }
    }
    const ms = this.tcap('meteorShower');
    if (ms && crit && sk && !sk.basic && Math.random() < 0.25 && (this.procCD.meteor || 0) <= this.time && !dst.dead) {
      this.procCD.meteor = this.time + 5; const c = dst.pos.clone();
      this.fx.meteor(c, 0xff8a2a, 0.6, () => { this.sfx.play('boom'); this.aoe(c, 5, ms.v / 100, 0, true); });
    }
  },
  // Envenom / Plague Bearer poison and Ignite burn (dot = fraction of Attack per second)
  treePoison(t, dot, secs) {
    if (t.dead) return;
    const p = this.player, amp = 1 + this.tp('dotAmp') / 100;
    t.poisonedT = Math.max(t.poisonedT || 0, this.time + secs);
    for (let i = 1; i <= secs; i++) this.after(i, () => { if (!t.dead) { this.fx.emit(t.pos.clone().setY(t.pos.y + t.height * 0.6), { count: 7, color: 0x7aff5a, speed: 1.5, life: 0.5, size: 0.5, up: 1 }); this.damage(p, t, dot * amp, { canCrit: false, proc: true, cls: 'pet' }); } });
  },
  treeBurn(t) {
    if ((t.burnT || 0) > this.time) return;
    t.burnT = this.time + 3; const p = this.player;
    for (let i = 1; i <= 3; i++) this.after(i, () => { if (!t.dead) { this.fx.emit(t.pos.clone().setY(t.pos.y + t.height * 0.6), { count: 8, colors: [0xff6a1a, 0xffc04a], speed: 2, life: 0.5, size: 0.5, up: 2 }); this.damage(p, t, 0.4, { canCrit: false, proc: true, cls: 'pet' }); } });
  },
  treeOnKill(m) {
    const p = this.player;
    if (this.tp('killHeal')) this.heal(p, p.maxHp * this.tp('killHeal') / 100);
    if (this.tp('killMp')) p.mp = Math.min(p.maxMp, p.mp + p.maxMp * this.tp('killMp') / 100);
    if (this.tp('killHaste')) for (const k of Object.keys(this.cd)) this.cd[k] -= this.tp('killHaste');
    const pl = this.tcap('plague');
    if (pl && (m.poisonedT || 0) > this.time) {
      const c = m.pos.clone();
      this.fx.emit(c.clone().setY(c.y + 1), { count: 40, colors: [0x7aff5a, 0x3ac84a, 0xd8ff8a], speed: 6, life: 0.7, size: 0.7 });
      this.fx.ring(c, 0x7aff5a, 5, 0.4);
      for (const o of [...this.monsters]) if (o !== m && !o.dead && (o.map || this.world) === this.map && flat(o.pos, c) < 5 + o.radius * 0.5) { this.damage(p, o, pl.v / 100, { proc: true }); this.treePoison(o, 0.4, 4); }
    }
  },
  // after taking damage: Unbreakable
  treeHurt() {
    const p = this.player, ls = this.tcap('lastStand');
    if (ls && p.hp > 0 && p.hp < p.maxHp * 0.25 && (this.procCD.lastStand || 0) <= this.time) {
      this.procCD.lastStand = this.time + 60;
      p.shield = (p.shield || 0) + p.maxHp * ls.v / 100;
      p.buffs.push({ id: 'unbreakable', icon: 'soul_worldtree', until: this.time + 10, shield: true });
      this.fx.circle(p.pos, '#ffd36b', 2.2, 1.2, p.model); this.fx.text(p.pos.clone().setY(p.pos.y + p.height + 0.4), 'Unbreakable', 'heal');
    }
  },
  // a killing blow: Phoenix Rising (returns true when it saved you)
  treeOnDeath() {
    const p = this.player, pr = this.tcap('phoenixRise');
    if (!pr || this.time < (this.procCD.phoenixRise || 0)) return false;
    this.procCD.phoenixRise = this.time + 240;
    p.hp = Math.round(p.maxHp * pr.v / 100);
    this.fx.pillar(p.pos, 0xff6a2a, 2.4, 12, 1.2); this.fx.ring(p.pos, 0xff7a2a, 6, 0.6);
    this.fx.emit(p.pos.clone().setY(p.pos.y + 1), { count: 70, colors: [0xff6a2a, 0xffd04a, 0xffffff], speed: 7, life: 1, size: 0.8, up: 4 });
    this.ui.toast('Phoenix Rising! You rise from the ashes.', 'good'); this.sfx.play('boom');
    const c = p.pos.clone(); this.after(0.1, () => this.aoe(c, 6, 3, 0, true));
    return true;
  },
  // healing beyond Max HP: Divine Overflow turns it into a shield
  treeOverheal(excess) {
    const ov = this.tcap('overheal'); if (!ov || excess <= 0) return;
    const p = this.player, cap = p.maxHp * ov.v / 100;
    if ((p.shield || 0) >= cap) return;
    p.shield = Math.min(cap, (p.shield || 0) + excess);
    if (!p.buffs.some((b) => b.id === 'overflow')) p.buffs.push({ id: 'overflow', icon: 'soul_holy_nova', until: this.time + 15, shield: true });
    else p.buffs.find((b) => b.id === 'overflow').until = this.time + 15;
  },
  // HP and MP regeneration nodes, every 5s
  treeTick(dt) {
    const A = this.tAgg, p = this.player; if (!A || p.dead) return;
    this.treeRegenT = (this.treeRegenT || 0) + dt;
    if (this.treeRegenT < 5) return;
    this.treeRegenT = 0;
    if (A.stat.regen && p.hp < p.maxHp) this.heal(p, p.maxHp * A.stat.regen / 100);
    if (A.stat.mregen) p.mp = Math.min(p.maxMp, p.mp + p.maxMp * A.stat.mregen / 100);
  },
};
export function installSkillTree(Game) { Object.assign(Game.prototype, T); }
