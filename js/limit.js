// Limit Break: a gauge on skill slot 7 fills while you fight (hits you land, hits you take, kills; elites and bosses
// fill it faster). Until the Lv 200 ultimate is learned, slot 7 holds the Limit Break itself: with a full gauge, key 7
// unleashes a burst in your class colour that strikes and stuns everything around you and lifts your attack for a
// while. Once you have an ultimate, a full gauge readies it at once even while it is cooling down. Trials (normalized
// stats) leave the gauge alone. The gauge is not saved: it starts empty each session.
import * as THREE from 'three';
import { CLASSES } from './data.js';
import { SKILL_BY_ID } from './data-classes.js';

export const LB_MAX = 100;
export const LIMIT_BREAK = { id: 'limit_break', name: 'Limit Break', type: 'xp', k: 'nova', r: 8, m: 9, stun: 1.5, lv: 1, cd: 0, mp: 0,
  desc: 'With a full gauge: a burst that strikes everything within 8 m for 900% attack and stuns for 1.5 s, then +15% attack for 8 s' };
const GAIN = { hit: 1.2, skillHit: 2, hurt: 3, kill: 5, elite: 14, boss: 30 };

const G = {
  lbGain(n) {
    if (this.trial || this.player.dead || !(n > 0)) return;
    const was = this.lb || 0; this.lb = Math.min(LB_MAX, was + n);
    if (was < LB_MAX && this.lb >= LB_MAX) {
      this.ui.toast(this.S.ult ? `Limit Break ready: press 7 to ready ${SKILL_BY_ID[this.S.ult]?.name || 'your ultimate'}` : 'Limit Break ready! Press 7', 'good');
      this.sfx.play('chime'); this.fx.buff(this.player, '#ffe07a');
    }
  },
  lbOnHit(sk) { if (sk?.id !== LIMIT_BREAK.id) this.lbGain(sk && !sk.basic ? GAIN.skillHit : GAIN.hit); },
  lbOnHurt() { this.lbGain(GAIN.hurt); },
  lbOnKill(m) { const d = m.def0 || {}; this.lbGain(d.boss || m.wb ? GAIN.boss : d.elite ? GAIN.elite : GAIN.kill); },
  lbFull() { return (this.lb || 0) >= LB_MAX; },
  // key 7 / slot 7
  limitBreak() {
    const p = this.player, S = this.S;
    if (p.dead || p.stun > 0 || this.rolling) return false;
    if (this.trial) { this.ui.toast('No Limit Break in a trial: every hero fights with the same strength', 'warn'); return false; }
    if (!this.lbFull()) { this.ui.toast(`Limit Break gauge ${Math.floor(this.lb || 0)}% — fight to fill it`, 'warn'); this.sfx.play('error'); return false; }
    this.lb = 0;
    const col = CLASSES[S.cls].elemColor, hex = typeof col === 'string' ? new THREE.Color(col).getHex() : col;
    if (S.ult && SKILL_BY_ID[S.ult]) {
      this.cd[S.ult] = 0;
      this.fx.pillar(p.pos, hex, 1.6, 10, 0.8); this.sfx.play('level');
      this.ui.toast(`Limit Break: ${SKILL_BY_ID[S.ult].name} is ready`, 'good');
      return true;
    }
    if (this.mounted) this.dismount(true);
    p.state = 'cast'; p.actDur = p.actT = 0.6; this.lastCombat = this.time;
    this.fx.pillar(p.pos, hex, 3, 16, 1.1); this.fx.shake(0.5); this.sfx.play('boom');
    this.fx.emit(p.pos.clone().setY(p.pos.y + 1.2), { count: 60, colors: [hex, 0xffffff, 0xffe07a], speed: 9, life: 0.7, size: 0.7, spread: 1 });
    this.after(0.25, () => { if (!p.dead) this.k_nova(LIMIT_BREAK, null, LIMIT_BREAK.m); });
    p.buffs = p.buffs.filter((b) => b.id !== LIMIT_BREAK.id); p.buffs.push({ id: LIMIT_BREAK.id, icon: LIMIT_BREAK.id, until: this.time + 8, mods: { atk: 1.15 } });
    this.ui.banner('LIMIT BREAK!', CLASSES[S.cls].name, 'level');
    this.track && this.track('skill');
    return true;
  },
};

export function installLimit(Game) { Object.assign(Game.prototype, G); }
